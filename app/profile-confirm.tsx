import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, ScrollView, Text, View } from 'react-native';
import * as Location from 'expo-location';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useApp } from '@/src/state/AppContext';
import { ActionBar, Avatar, Button, Screen } from '@/src/ui/components';
import { LinkedInProfileFetch } from '@/src/ui/LinkedInProfileFetch';
import { classifyQr } from '@/src/parsers/qr';
import { presetForEventName } from '@/src/data/weekTags';
import { matchEvents } from '@/src/services/eventMatcher';
import { profileUrl } from '@/src/services/followupLinks';
import { applyDossier } from '@/src/services/primaryAccount';
import { fetchXDossier } from '@/src/services/profiles';
import { latestConfirm, sameAccount, watchConfirm, type ConfirmRequest } from '@/src/services/confirmRoute';
import { dossierFromKnown, preferDossier, profileReady, type ProfileDossier } from '@/src/services/profileDossier';
import { getSecret, SECRET } from '@/src/services/secrets';

function one(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return value[value.length - 1] ?? '';
  return value ?? '';
}

export default function ProfileConfirmScreen() {
  const { theme, repo, bump, showToast, net } = useApp();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ platform?: string; value?: string; url?: string; name?: string; company?: string; hint?: string; photo?: string; bio?: string; nonce?: string }>();
  const [request, setRequest] = useState<ConfirmRequest | null>(() => latestConfirm());
  useEffect(() => watchConfirm(() => setRequest(latestConfirm())), []);
  const platform = request?.platform || one(params.platform);
  const value = request?.value || one(params.value);
  const url = request?.url || one(params.url) || (platform && value ? profileUrl(platform, value) : '');
  const typedName = request?.name || one(params.name);
  const typedCompany = request?.company || one(params.company);
  const hint = request?.hint || one(params.hint);
  const knownPhoto = request?.photo || one(params.photo);
  const knownBio = request?.bio || one(params.bio);
  const seeded = dossierFromKnown({ platform, value, name: typedName, bio: knownBio, photo: knownPhoto, company: typedCompany });
  const accountKey = `${platform}:${value}:${request?.nonce || one(params.nonce)}`;
  const [seenAccount, setSeenAccount] = useState(accountKey);
  const [dossier, setDossier] = useState<ProfileDossier | null>(seeded);
  const [status, setStatus] = useState(profileReady(seeded) ? 'Check this is the right person.' : platform === 'linkedin' ? 'Reading the LinkedIn profile…' : 'Reading the X profile…');
  const [attempt, setAttempt] = useState(0);
  const [saving, setSaving] = useState(false);
  const dossierRef = useRef(dossier);
  const visible = sameAccount(dossier, platform, value) ? dossier : seeded;
  dossierRef.current = visible;
  const [painted, setPainted] = useState(false);
  const [gaveUp, setGaveUp] = useState(false);
  const localFace = Boolean(visible?.photo?.startsWith('file:') || visible?.photo?.startsWith('data:image/'));
  const faceShown = platform !== 'linkedin' || localFace || painted;
  const ready = profileReady(visible) && faceShown && sameAccount(visible, platform, value);
  const supported = platform === 'x' || platform === 'linkedin';
  const shownPhoto = useRef(visible?.photo);
  if (seenAccount !== accountKey) {
    setSeenAccount(accountKey);
    setDossier(seeded);
    setPainted(false);
    setGaveUp(false);
    setStatus(profileReady(seeded) ? 'Check this is the right person.' : platform === 'linkedin' ? 'Reading the LinkedIn profile…' : 'Reading the X profile…');
  }
  if (shownPhoto.current !== visible?.photo) {
    shownPhoto.current = visible?.photo;
    if (painted) setPainted(false);
  }

  useEffect(() => {
    if (platform !== 'linkedin' || faceShown) return;
    const timer = setTimeout(() => {
      setGaveUp(true);
      setStatus((current) => (current.startsWith('Reading') ? 'The photo did not load. Try again.' : current));
    }, 12000);
    return () => clearTimeout(timer);
  }, [platform, attempt, faceShown]);

  useEffect(() => {
    if (platform !== 'x' || !value) return;
    let alive = true;
    setStatus('Reading the X profile…');
    void (async () => {
      try {
        const twitter = (await getSecret(SECRET.twitter)) ?? undefined;
        const next = await fetchXDossier(value, twitter);
        if (!alive) return;
        if (!sameAccount(next, platform, value)) return;
        const merged = preferDossier(sameAccount(dossierRef.current, platform, value) ? dossierRef.current : null, next);
        setDossier(merged);
        setStatus(profileReady(merged) ? 'Check this is the right person.' : 'The name and photo did not load. Add an X key in Settings, then try again.');
      } catch (error) {
        if (!alive) return;
        setStatus(error instanceof Error && error.message === 'auth' ? 'The X key was refused. Check it in Settings, then try again.' : 'The X profile did not load. Try again.');
      }
    })();
    return () => {
      alive = false;
    };
  }, [platform, value, attempt]);

  async function confirm() {
    if (!repo || !visible || !ready || saving) return;
    setSaving(true);
    try {
      const qr = classifyQr(url);
      let lat: number | null = null;
      let lng: number | null = null;
      try {
        const allowed = await Location.getForegroundPermissionsAsync();
        const granted = allowed.granted || (await Location.requestForegroundPermissionsAsync()).granted;
        if (granted) {
          const position = await Promise.race([
            Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }),
            new Promise<null>((resolve) => setTimeout(() => resolve(null), 1500)),
          ]);
          if (position) {
            lat = position.coords.latitude;
            lng = position.coords.longitude;
          }
        }
      } catch {
        lat = null;
      }
      const event = matchEvents(repo.events(), new Date().toISOString(), lat, lng)[0];
      const chosen = repo.setting('current_tag');
      const tag = presetForEventName(event?.event.name) ?? event?.event.name ?? (chosen || null);
      const offline = net === 'offline' || net === 'captive';
      const saved = repo.capture({
        qr,
        eventId: event?.event.id ?? null,
        tag,
        lat,
        lng,
        offline,
        realName: typedName || visible.name || undefined,
        company: typedCompany || visible.company || undefined,
        hint: hint || undefined,
        displayName: typedName || visible.name || undefined,
        photoUri: visible.photo || undefined,
      });
      if (saved.personId) applyDossier(repo, saved.personId, { ...visible, name: typedName || visible.name });
      bump();
      router.replace({ pathname: '/capture/[personId]', params: { personId: saved.personId, encounter: saved.encounterId, tag: tag ?? '' } });
    } catch {
      setSaving(false);
      showToast('That profile could not be saved.');
    }
  }

  const counts = [
    visible?.experience.length ? `${visible.experience.length} roles` : '',
    visible?.education.length ? `${visible.education.length} schools` : '',
    visible?.links.length ? `${visible.links.length} links` : '',
  ].filter(Boolean).join(' · ');

  return (
    <Screen theme={theme}>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 20, gap: 14, paddingBottom: 32 }}>
        {!supported ? <Text style={{ color: theme.text }}>This profile cannot be confirmed.</Text> : null}
        <View style={{ alignItems: 'center', gap: 12, paddingTop: 12 }}>
          {faceShown || gaveUp ? null : <ActivityIndicator color={theme.tide} />}
          <Avatar theme={theme} uri={visible?.photo} name={visible?.name || typedName || value || 'Profile'} size={96} ring={ready ? 'confirmed' : 'pending'} onLoad={() => { setPainted(true); setStatus('Check this is the right person.'); }} />
          <Text accessibilityRole="header" style={{ color: theme.text, fontFamily: 'BricolageGrotesque_700Bold', fontSize: 28, letterSpacing: -0.4, textAlign: 'center' }}>{visible?.name || typedName || (value ? `@${value}` : 'Profile')}</Text>
          {value ? <Text style={{ color: theme.text3, fontSize: 16 }}>{platform === 'whatsapp' ? value : `@${value}`}</Text> : null}
          {visible?.headline ? <Text style={{ color: theme.text2, fontSize: 16, textAlign: 'center' }}>{visible.headline}</Text> : null}
          {visible?.company || visible?.location ? <Text style={{ color: theme.text3, fontSize: 15, textAlign: 'center' }}>{[visible.company, visible.location].filter(Boolean).join(' · ')}</Text> : null}
        </View>
        {visible?.about ? <Text style={{ color: theme.text2, fontSize: 16, lineHeight: 22 }} numberOfLines={4}>{visible.about}</Text> : null}
        {counts ? <Text style={{ color: theme.text3, fontSize: 14 }}>{counts}</Text> : null}
        <Text style={{ color: theme.text2, fontSize: 15, lineHeight: 21 }}>{status}</Text>
        {platform === 'linkedin' && value ? (
          <LinkedInProfileFetch
            key={`${value}:${attempt}`}
            theme={theme}
            slug={value}
            knownPhoto={knownPhoto}
            onDossier={(next) => {
              if (!sameAccount(next, platform, value)) return;
              const merged = preferDossier(sameAccount(dossierRef.current, platform, value) ? dossierRef.current : null, next);
              setDossier(merged);
              if (merged?.photo?.startsWith('file:') || merged?.photo?.startsWith('data:image/')) setStatus('Check this is the right person.');
              else if (merged?.name) setStatus('Reading the profile photo…');
            }}
          />
        ) : null}
        {!ready && supported ? <Button theme={theme} kind="secondary" label="Try again" onPress={() => { setGaveUp(false); setPainted(false); setAttempt((current) => current + 1); }} /> : null}
      </ScrollView>
      <ActionBar theme={theme} bottom={Math.max(16, insets.bottom)}>
        <Button theme={theme} kind="secondary" label="Back" onPress={() => router.replace('/scan')} style={{ flex: 1 }} />
        <Button theme={theme} icon="checkmark" label={saving ? 'Saving' : 'Confirm'} disabled={!ready || saving} onPress={() => void confirm()} style={{ flex: 1 }} />
      </ActionBar>
    </Screen>
  );
}
