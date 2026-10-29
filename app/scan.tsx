import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Keyboard, Linking, Platform as Device, Pressable, ScrollView, Text, View, useWindowDimensions } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as Haptics from 'expo-haptics';
import * as Location from 'expo-location';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useApp } from '@/src/state/AppContext';
import { Avatar, Button, Field, Icon, PlatformMark, platformName } from '@/src/ui/components';
import { validatePersonName } from '@/src/parsers/handles';
import { geoLabel, presetForEventName } from '@/src/data/weekTags';
import { matchEvents } from '@/src/services/eventMatcher';
import { anchorFromQr, classifyQr } from '@/src/parsers/qr';
import { accountFromScan, stageConfirm } from '@/src/services/confirmRoute';
import { applyDossier, fillPrimaryAccount, isPrimaryPlatform } from '@/src/services/primaryAccount';
import { fetchXDossier } from '@/src/services/profiles';
import { profileReady } from '@/src/services/profileDossier';
import { LinkedInProfileFetch } from '@/src/ui/LinkedInProfileFetch';
import { getSecret, SECRET } from '@/src/services/secrets';
import { resolveQr } from '@/src/services/qrResolve';
import { searchAccounts, type AccountCard } from '@/src/services/accountSearch';
import { profileUrl } from '@/src/services/followupLinks';
import { AccountRegistry } from '@/src/ui/AccountRegistry';
import { LinkedInDirectory } from '@/src/ui/LinkedInDirectory';
import type { Platform } from '@/src/parsers/handles';

export default function ScanScreen() {
  const { theme, repo, bump, showToast, net, revision } = useApp();
  const insets = useSafeAreaInsets();
  const { height: windowHeight, width: windowWidth } = useWindowDimensions();
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const params = useLocalSearchParams<{ huddle?: string; payload?: string }>();
  const [permission, requestPermission] = useCameraPermissions();
  const [manual, setManual] = useState(false);
  const [handle, setHandle] = useState('');
  const [platform, setPlatform] = useState<Platform>('x');
  const [name, setName] = useState('');
  const [company, setCompany] = useState('');
  const [hint, setHint] = useState('');
  const [status, setStatus] = useState('Point at a profile QR');
  const [hits, setHits] = useState<AccountCard[]>([]);
  const [searching, setSearching] = useState(false);
  const [picked, setPicked] = useState<AccountCard | null>(null);
  const [directoryQuery, setDirectoryQuery] = useState('');
  const busy = useRef(false);
  const recent = useRef('');
  const [held, setHeld] = useState(false);
  const searchGen = useRef(0);
  const huddle = typeof params.huddle === 'string' ? params.huddle : undefined;
  void revision;
  const rushCount = huddle ? repo?.huddlePeople(huddle).length ?? 0 : 0;
  const box = Math.min(250, windowWidth - 120);
  const boxTop = windowHeight * 0.42 - box / 2;
  const boxLeft = (windowWidth - box) / 2;
  const dim = 'rgba(5, 9, 11, 0.62)';

  async function saveRaw(raw: string, fromList?: AccountCard) {
    if (!repo || busy.current || raw === recent.current) return;
    busy.current = true;
    setHeld(true);
    setStatus('Reading the link…');
    let stay = true;
    try {
      const direct = accountFromScan(raw);
      const qr = direct ? classifyQr(direct.url) : await resolveQr(raw.trim());
      if (qr.unsafe) {
        showToast("This QR is a payment or wallet link. Glance won't open it.");
        return;
      }
      if (qr.kind === 'invalid') {
        showToast('That code could not be read.');
        return;
      }
      const resolved = anchorFromQr(qr);
      const preview = direct ?? (resolved && (resolved.platform === 'x' || resolved.platform === 'linkedin') ? resolved : null);
      if (!huddle && preview && (preview.platform === 'x' || preview.platform === 'linkedin')) {
        const card = fromList ?? (picked && raw === picked.url ? picked : null);
        const nonce = String(Date.now());
        stay = false;
        stageConfirm({
          platform: preview.platform,
          value: preview.value,
          url: preview.url || card?.url || '',
          name: card?.displayName || '',
          company: card ? company : '',
          hint: card ? hint : '',
          photo: card?.avatarUrl || '',
          bio: card?.bio || '',
          nonce,
        });
        router.replace({
          pathname: '/profile-confirm',
          params: {
            platform: preview.platform,
            value: preview.value,
            url: preview.url || card?.url || '',
            name: card?.displayName || '',
            company: card ? company : '',
            hint: card ? hint : '',
            photo: card?.avatarUrl || '',
            bio: card?.bio || '',
            nonce,
          },
        });
        return;
      }
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
      const card = picked && raw === picked.url ? picked : null;
      const saved = repo.capture({
        qr,
        huddleId: huddle ?? null,
        eventId: event?.event.id ?? null,
        tag,
        lat,
        lng,
        offline,
        realName: name || card?.displayName || undefined,
        company: company || undefined,
        hint: hint || undefined,
        displayName: name || card?.displayName || undefined,
        photoUri: card?.avatarUrl || undefined,
      });
      if (!lat) {
        void Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }).then((position) => {
          repo.patchEncounter(saved.encounterId, { lat: position.coords.latitude, lng: position.coords.longitude });
          bump();
        }).catch(() => undefined);
      }
      const anchor = anchorFromQr(qr);
      let filled = false;
      if (anchor && isPrimaryPlatform(anchor.platform) && saved.personId) {
        setStatus('Saving the public profile…');
        const twitter = (await getSecret(SECRET.twitter)) ?? undefined;
        filled = await fillPrimaryAccount(repo, saved.personId, anchor.platform, anchor.value, anchor.url, twitter, name || card?.displayName || undefined, card ? { avatarUrl: card.avatarUrl, bio: card.bio, displayName: card.displayName } : undefined);
        if (huddle && anchor.platform === 'x') {
          const personId = saved.personId;
          void fetchXDossier(anchor.value, twitter).then((dossier) => {
            if (dossier && profileReady(dossier)) {
              applyDossier(repo, personId, dossier);
              bump();
            }
          }).catch(() => undefined);
        }
        if (huddle && anchor.platform === 'linkedin') setPendingLinkedIn({ personId: saved.personId, value: anchor.value });
      }
      bump();
      void Haptics.notificationAsync(saved.duplicate ? Haptics.NotificationFeedbackType.Warning : Haptics.NotificationFeedbackType.Success);
      if (saved.unsafe) return;
      const place = geoLabel(lat, lng);
      if (anchor && isPrimaryPlatform(anchor.platform) && !filled) {
        showToast(`Saved @${anchor.value}. The public name and photo did not load.`);
      } else if (anchor?.platform === 'web') {
        showToast('Saved the page link. It did not open as an X, LinkedIn, Telegram, or WhatsApp profile.');
      } else {
        showToast(offline ? `Saved offline · ${saved.label}` : `Saved · ${saved.label} · ${place}`);
      }
      if (huddle) {
        recent.current = raw;
        setTimeout(() => { if (recent.current === raw) recent.current = ''; }, 2500);
        return;
      }
      stay = false;
      router.replace({ pathname: '/capture/[personId]', params: { personId: saved.personId, encounter: saved.encounterId, tag: tag ?? '' } });
    } catch {
      showToast('That code could not be read.');
    } finally {
      if (stay) {
        busy.current = false;
        setHeld(false);
        setStatus('Point at a profile QR');
      }
    }
  }

  useFocusEffect(useCallback(() => {
    busy.current = false;
    recent.current = '';
    setHeld(false);
    setStatus('Point at a profile QR');
    return () => {
      busy.current = true;
      setHeld(true);
    };
  }, []));

  useEffect(() => {
    const showEvent = Device.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Device.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const show = Keyboard.addListener(showEvent, (event) => setKeyboardHeight(event.endCoordinates.height));
    const hide = Keyboard.addListener(hideEvent, () => setKeyboardHeight(0));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  useEffect(() => {
    if (!manual) return;
    const query = handle.trim();
    setPicked(null);
    if (query.length < 2) {
      setHits([]);
      setSearching(false);
      setDirectoryQuery('');
      return;
    }
    const gen = ++searchGen.current;
    setSearching(true);
    const timer = setTimeout(() => {
      void (async () => {
        const twitter = platform === 'x' ? (await getSecret(SECRET.twitter)) ?? undefined : undefined;
        const target = platform === 'linkedin' || platform === 'telegram' || platform === 'whatsapp' ? platform : 'x';
        if (target === 'linkedin' || target === 'telegram' || target === 'whatsapp') setDirectoryQuery(query);
        else setDirectoryQuery('');
        if (target === 'linkedin') setHits([]);
        try {
          const found = await searchAccounts(target, query, twitter, target === 'linkedin' ? { exactOnly: true } : undefined);
          if (searchGen.current !== gen) return;
          setHits((current) => (target === 'linkedin' && current.length ? current : found));
        } catch {
          if (searchGen.current !== gen) return;
          if (target !== 'linkedin') setHits([]);
        } finally {
          if (searchGen.current === gen && target !== 'linkedin') setSearching(false);
        }
      })();
    }, 400);
    return () => clearTimeout(timer);
  }, [manual, handle, platform]);

  const [pendingLinkedIn, setPendingLinkedIn] = useState<{ personId: string; value: string } | null>(null);
  const consumed = useRef(false);
  useEffect(() => {
    if (consumed.current || !repo || typeof params.payload !== 'string') return;
    consumed.current = true;
    void saveRaw(params.payload);
  }, [repo, params.payload]);

  return (
    <View style={{ flex: 1, backgroundColor: theme.bg }}>
      {pendingLinkedIn ? (
        <LinkedInProfileFetch
          quiet
          theme={theme}
          slug={pendingLinkedIn.value}
          onDossier={(dossier) => {
            if (!repo || !profileReady(dossier)) return;
            applyDossier(repo, pendingLinkedIn.personId, dossier);
            bump();
            setPendingLinkedIn(null);
          }}
        />
      ) : null}
      {permission?.granted ? (
        <CameraView
          style={{ flex: 1 }}
          facing="back"
          barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
          onBarcodeScanned={held ? undefined : ({ data }) => void saveRaw(data)}
        />
      ) : null}
      {permission?.granted && !manual ? (
        <View pointerEvents="none" style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}>
          <View style={{ position: 'absolute', top: 0, left: 0, right: 0, height: boxTop, backgroundColor: dim }} />
          <View style={{ position: 'absolute', top: boxTop + box, left: 0, right: 0, bottom: 0, backgroundColor: dim }} />
          <View style={{ position: 'absolute', top: boxTop, left: 0, width: boxLeft, height: box, backgroundColor: dim }} />
          <View style={{ position: 'absolute', top: boxTop, right: 0, width: boxLeft, height: box, backgroundColor: dim }} />
          {([['top', 'left'], ['top', 'right'], ['bottom', 'left'], ['bottom', 'right']] as const).map(([v, h]) => (
            <View
              key={`${v}${h}`}
              style={{
                position: 'absolute',
                width: 52,
                height: 52,
                top: v === 'top' ? boxTop - 3 : boxTop + box - 49,
                left: h === 'left' ? boxLeft - 3 : boxLeft + box - 49,
                borderColor: theme.tide,
                borderTopWidth: v === 'top' ? 5 : 0,
                borderBottomWidth: v === 'bottom' ? 5 : 0,
                borderLeftWidth: h === 'left' ? 5 : 0,
                borderRightWidth: h === 'right' ? 5 : 0,
                [`border${v === 'top' ? 'Top' : 'Bottom'}${h === 'left' ? 'Left' : 'Right'}Radius`]: 26,
              }}
            />
          ))}
        </View>
      ) : null}
      {!permission?.granted ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 14 }}>
          <Icon name="camera.viewfinder" color={theme.tide} size={44} />
          <Text style={{ color: theme.text, textAlign: 'center', fontSize: 17, lineHeight: 23 }}>Glance needs the camera to scan QR codes and name badges.</Text>
          <Button theme={theme} label="Allow camera" icon="camera.fill" onPress={() => void requestPermission()} />
        </View>
      ) : null}
      <Pressable accessibilityLabel="Close scanner" onPress={() => router.back()} style={{ position: 'absolute', top: insets.top + 8, left: 16, width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(14, 18, 21, 0.75)', alignItems: 'center', justifyContent: 'center' }}>
        <Icon name="xmark" color="#EEF3F2" />
      </Pressable>
      {status === 'Point at a profile QR' ? (
        manual ? null : <Text style={{ position: 'absolute', top: boxTop + box + 24, alignSelf: 'center', color: '#EEF3F2', fontSize: 16, fontWeight: '600', textAlign: 'center', paddingHorizontal: 24 }}>Point at a profile QR</Text>
      ) : (
        <View style={{ position: 'absolute', zIndex: 20, top: '40%', alignSelf: 'center', backgroundColor: theme.surface1, borderRadius: 24, paddingHorizontal: 24, paddingVertical: 20, alignItems: 'center', gap: 12, maxWidth: 280 }}>
          <ActivityIndicator size="large" color={theme.tide} />
          <Text style={{ color: theme.text, textAlign: 'center', fontSize: 16 }}>{status}</Text>
        </View>
      )}
      {huddle ? (
        <View accessibilityLiveRegion="polite" style={{ position: 'absolute', top: insets.top + 8, right: 16, flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: 'rgba(14, 18, 21, 0.85)', borderRadius: 24, paddingVertical: 5, paddingRight: 5, paddingLeft: 14 }}>
          <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: theme.tide }} />
          <Text style={{ color: '#EEF3F2', fontSize: 16, fontWeight: '700' }}>Rush · {rushCount} scanned</Text>
          <Button theme={theme} kind="light" size="small" label="End" accessibilityLabel="End Rush and say who's who" onPress={() => router.push({ pathname: '/huddle/[id]', params: { id: huddle } })} style={{ minHeight: 36, borderRadius: 18 }} />
        </View>
      ) : null}
      <View style={{ position: 'absolute', left: 16, right: 16, bottom: keyboardHeight > 0 ? keyboardHeight + 8 : insets.bottom + 16, gap: 8 }}>
        {manual || net === 'offline' ? (
          <ScrollView style={{ maxHeight: Math.max(220, windowHeight - (keyboardHeight > 0 ? keyboardHeight + 8 : insets.bottom + 16) - insets.top - 120), backgroundColor: theme.surface1, borderRadius: 26 }} contentContainerStyle={{ padding: 16, gap: 10 }} keyboardShouldPersistTaps="handled">
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              {(['x', 'linkedin', 'telegram', 'whatsapp'] as Platform[]).map((item) => (
                <Pressable
                  key={item}
                  accessibilityRole="button"
                  accessibilityLabel={platformName(item)}
                  onPress={() => setPlatform(item)}
                  style={{ alignItems: 'center', gap: 4, padding: 4, borderRadius: 16, borderWidth: 2, borderColor: platform === item ? theme.link : 'transparent', minWidth: 64 }}
                >
                  <PlatformMark platform={item} size={36} />
                  <Text style={{ color: theme.text3, fontSize: 11 }}>{platformName(item)}</Text>
                </Pressable>
              ))}
            </View>
            <Field
              theme={theme}
              value={handle}
              onChangeText={setHandle}
              autoCapitalize="none"
              placeholder={platform === 'whatsapp' ? 'Phone with country code, +91…' : 'Name, username, or @handle'}
              accessibilityLabel={platform === 'whatsapp' ? 'Phone number' : 'Search'}
            />
            <Text style={{ color: theme.text3 }}>
              {platform === 'whatsapp'
                ? 'Link WhatsApp to search the contacts on that account, or type a phone number with the country code.'
                : platform === 'x'
                  ? 'Results update as you type. A saved twitterapi.io key searches X by name. Without it, Glance checks the handle and public pages.'
                  : platform === 'linkedin'
                    ? 'Sign in once. A name then lists people with the profile photo, handle, and headline from LinkedIn search.'
                    : 'Sign in once. A name searches Telegram’s public usernames and shows the profile photo and bio.'}
            </Text>
            {platform === 'linkedin' ? (
              <LinkedInDirectory
                theme={theme}
                query={directoryQuery}
                onPeople={(people) => {
                  setHits(people);
                  setSearching(false);
                }}
                onSettled={() => setSearching(false)}
              />
            ) : null}
            {platform === 'telegram' || platform === 'whatsapp' ? (
              <AccountRegistry
                kind={platform}
                theme={theme}
                query={directoryQuery}
                onPeople={(people) => {
                  setHits(people);
                  setSearching(false);
                }}
                onSettled={() => setSearching(false)}
              />
            ) : null}
            {searching ? <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 36 }}><ActivityIndicator color={theme.tide} /><Text style={{ color: theme.text2 }}>Searching…</Text></View> : null}
            {!searching && handle.trim().length >= 2 && hits.length === 0 ? <Text style={{ color: theme.text3 }}>{platform === 'linkedin' ? 'No one in the LinkedIn directory matched that name.' : 'No public account matched that.'}</Text> : null}
            {hits.map((hit) => (
              <Pressable key={`${hit.platform}:${hit.value}`} onPress={() => { if (hit.platform === 'linkedin') void saveRaw(hit.url, hit); else setPicked(hit); }} style={{ flexDirection: 'row', gap: 10, alignItems: 'center', backgroundColor: picked?.value === hit.value && picked.platform === hit.platform ? theme.surface2 : 'transparent', borderRadius: 16, padding: 8, minHeight: 60 }}>
                <Avatar theme={theme} uri={hit.avatarUrl} name={hit.displayName || hit.value} size={44} />
                <View style={{ flex: 1 }}>
                  <Text style={{ color: theme.text, fontWeight: '600' }} numberOfLines={1}>{hit.displayName || hit.value}</Text>
                  <Text style={{ color: theme.text3, fontSize: 12 }} numberOfLines={1}>{hit.platform === 'whatsapp' ? hit.value : `@${hit.value}`}</Text>
                  {hit.bio ? <Text style={{ color: theme.text2, fontSize: 13 }} numberOfLines={2}>{hit.bio}</Text> : null}
                </View>
                <PlatformMark platform={hit.platform} size={22} />
              </Pressable>
            ))}
            {picked ? (
              <View style={{ backgroundColor: theme.surface2, borderRadius: 20, padding: 14, gap: 10 }}>
                <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
                  <Avatar theme={theme} uri={picked.avatarUrl} name={picked.displayName || picked.value} size={56} />
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: theme.text, fontSize: 20, fontFamily: 'BricolageGrotesque_700Bold' }}>{picked.displayName || picked.value}</Text>
                    <Text style={{ color: theme.text2 }}>{picked.platform === 'whatsapp' ? picked.value : `@${picked.value}`}</Text>
                  </View>
                  <PlatformMark platform={picked.platform} size={28} />
                </View>
                {picked.bio ? <Text style={{ color: theme.text2 }}>{picked.bio}</Text> : null}
                <Field theme={theme} value={name} onChangeText={setName} placeholder="Name you know, optional" accessibilityLabel="Real name" />
                <Field theme={theme} value={company} onChangeText={setCompany} placeholder="Company, optional" accessibilityLabel="Company" />
                <Field theme={theme} value={hint} onChangeText={setHint} placeholder="How you'll recognise them" accessibilityLabel="Recognition hint" />
                {name && !validatePersonName(name).ok ? <Text style={{ color: theme.warning }}>{validatePersonName(name).reason}</Text> : null}
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  <Button theme={theme} kind="ghost" size="small" icon="xmark" label="Close" onPress={() => setPicked(null)} />
                  <Button
                    theme={theme}
                    kind="secondary"
                    size="small"
                    icon="arrow.up.right"
                    label="Open"
                    onPress={() => {
                      const link = picked.url || profileUrl(picked.platform, picked.value);
                      void Linking.openURL(link).catch(() => showToast('Could not open that profile.'));
                    }}
                  />
                  <Button theme={theme} size="small" icon="checkmark" label="Add" onPress={() => void saveRaw(picked.url)} style={{ flex: 1 }} />
                </View>
              </View>
            ) : null}
          </ScrollView>
        ) : null}
        <Button theme={theme} kind={manual ? 'secondary' : 'light'} icon={manual ? 'qrcode.viewfinder' : 'magnifyingglass'} label={manual ? 'Back to the camera' : 'Search by name instead'} onPress={() => setManual((open) => !open)} />
      </View>
    </View>
  );
}

