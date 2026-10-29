import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import * as Linking from 'expo-linking';
import { router, useLocalSearchParams } from 'expo-router';
import { useApp } from '@/src/state/AppContext';
import { AiConfirm } from '@/src/ui/AiConfirm';
import { ActionBar, Avatar, Button, Card, Field, Icon, Label, MONO, PlatformMark, Screen, platformName } from '@/src/ui/components';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AccountRegistry } from '@/src/ui/AccountRegistry';
import { LinkedInDirectory } from '@/src/ui/LinkedInDirectory';
import { primaryProfilePhoto } from '@/src/services/primaryAccount';
import { matchBrief, parseDossier } from '@/src/services/profileDossier';
import { scoreAccountMatches } from '@/src/services/anthropic';
import { discoverAccounts, githubUsersByName } from '@/src/services/discover';
import { searchAccounts } from '@/src/services/accountSearch';
import { profileUrl } from '@/src/services/followupLinks';
import { estimateMatchCost } from '@/src/services/notes';
import { getSecret, SECRET } from '@/src/services/secrets';
import type { Platform } from '@/src/parsers/handles';

const PLATFORMS: Platform[] = ['x', 'linkedin', 'telegram', 'whatsapp', 'github'];

function searchHint(platform: Platform): string {
  if (platform === 'x') return 'Search X by name or @handle';
  if (platform === 'linkedin') return 'Search LinkedIn by name';
  if (platform === 'telegram') return 'Public Telegram username';
  if (platform === 'whatsapp') return 'Contact name or +phone';
  if (platform === 'github') return 'Search GitHub by name or login';
  return 'Name or username';
}

function savedName(display: string | null | undefined, handle: string | null | undefined): string {
  const name = (display || '').trim();
  if (!name || name === 'Unknown' || name.startsWith('@') || name === handle) return '';
  return name;
}

function percent(score: number | null): string {
  if (score == null) return '—';
  const value = score <= 1 ? Math.round(score * 100) : Math.round(score);
  return `${value}%`;
}

export default function IdentityScreen() {
  const { theme, repo, revision, bump, showToast, net } = useApp();
  const { personId, pick, ai } = useLocalSearchParams<{ personId: string; pick?: string; ai?: string }>();
  const person = repo?.person(personId);
  const handles = repo?.handles(personId) ?? [];
  const [status, setStatus] = useState(pick === '1' ? 'Looking up other platforms…' : 'Primary account is already saved.');
  const [ask, setAsk] = useState(false);
  const [busy, setBusy] = useState(false);
  const [hasKey, setHasKey] = useState(ai === '1');
  const [chosen, setChosen] = useState<Record<string, string>>({});
  const [draft, setDraft] = useState<Partial<Record<Platform, string>>>({});
  const [active, setActive] = useState<Partial<Record<Platform, string>>>({});
  const [looking, setLooking] = useState<Partial<Record<Platform, boolean>>>({});
  const started = useRef(false);
  const insets = useSafeAreaInsets();
  const searchGen = useRef<Partial<Record<Platform, number>>>({});
  void revision;
  const estimate = estimateMatchCost(hasKey);
  const primary = handles.find((handle) => (handle.status === 'anchor' || handle.status === 'confirmed') && handle.platform !== 'web' && handle.platform !== 'other');
  const pending = handles.filter((handle) => handle.status === 'suggested' || handle.status === 'conflict');

  async function searchOthers(useAi: boolean) {
    if (!repo || !primary) {
      setStatus('Save a primary account before looking for others.');
      return;
    }
    if (net === 'offline' || net === 'captive') {
      setStatus('Offline. The lookup runs when you are back online.');
      return;
    }
    setBusy(true);
    setStatus(`Checking other platforms for ${primary.display_name || primary.value}…`);
    try {
      const twitter = (await getSecret(SECRET.twitter)) ?? undefined;
      const known = savedName(person?.display_name || primary.display_name, primary.value);
      const dossier = parseDossier(primary.raw_json);
      const found = await discoverAccounts(primary.platform, primary.value, twitter, known || undefined, dossier);
      if (known) {
        setDraft((current) => ({
          ...current,
          x: primary.platform === 'x' ? current.x : current.x || known,
          linkedin: primary.platform === 'linkedin' ? current.linkedin : current.linkedin || known,
        }));
      }
      if (useAi) {
        const key = await getSecret(SECRET.anthropic);
        if (key) {
          const scores = await scoreAccountMatches(
            key,
            matchBrief({ platform: primary.platform, value: primary.value, name: person?.display_name || primary.display_name, dossier: parseDossier(primary.raw_json) }),
            found.hits,
          );
          for (const hit of found.hits) {
            const next = scores.get(`${hit.platform}:${hit.value}`.toLowerCase());
            if (next != null) hit.score = next;
          }
        }
      }
      for (const hit of found.hits) {
        repo.upsertHandle({
          personId,
          platform: hit.platform,
          value: hit.value,
          url: hit.url,
          status: 'suggested',
          confidence: hit.score >= 80 ? 'high' : hit.score >= 55 ? 'medium' : 'low',
          score: hit.score,
          evidence: { note: hit.evidence },
        displayName: hit.displayName,
        bio: hit.bio,
        avatarUri: hit.avatarUrl,
        source: useAi ? 'ai-match' : 'discover',
        });
      }
      setStatus(found.hits.length ? 'Pick one account on each platform. Unselected profiles stay unlinked.' : 'No other public profiles matched this person.');
      bump();
    } catch {
      setStatus('The lookup did not finish. You can try again.');
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    if (!repo || started.current || pick !== '1') return;
    started.current = true;
    void searchOthers(ai === '1');
  }, [repo, personId, pick]);

  useEffect(() => {
    const timer = setTimeout(() => setActive(draft), 400);
    return () => clearTimeout(timer);
  }, [draft]);

  function remember(cards: { platform: Platform; value: string; url: string; displayName: string | null; bio: string | null; avatarUrl?: string | null }[], note: string) {
    if (!repo || !personId) return;
    for (const card of cards) {
      if (primary && card.platform === primary.platform && card.value.toLowerCase() === primary.value.toLowerCase()) continue;
      repo.upsertHandle({
        personId,
        platform: card.platform,
        value: card.value,
        url: card.url,
        status: 'suggested',
        confidence: 'medium',
        score: 60,
        evidence: { note },
        displayName: card.displayName,
        bio: card.bio,
        avatarUri: card.avatarUrl || undefined,
        source: 'manual-search',
      });
    }
    bump();
  }

  useEffect(() => {
    const query = (active.x ?? '').trim();
    const gen = (searchGen.current.x ?? 0) + 1;
    searchGen.current.x = gen;
    if (query.length < 2 || primary?.platform === 'x') {
      setLooking((current) => ({ ...current, x: false }));
      return;
    }
    setLooking((current) => ({ ...current, x: true }));
    void (async () => {
      const twitter = (await getSecret(SECRET.twitter)) ?? undefined;
      const cards = await searchAccounts('x', query, twitter);
      if (searchGen.current.x !== gen) return;
      remember(cards, `You searched X for “${query}”.`);
      setLooking((current) => ({ ...current, x: false }));
    })();
  }, [active.x]);

  useEffect(() => {
    const query = (active.github ?? '').trim();
    const gen = (searchGen.current.github ?? 0) + 1;
    searchGen.current.github = gen;
    if (query.length < 2 || primary?.platform === 'github') {
      setLooking((current) => ({ ...current, github: false }));
      return;
    }
    setLooking((current) => ({ ...current, github: true }));
    void (async () => {
      const hits = await githubUsersByName(query);
      if (searchGen.current.github !== gen) return;
      remember(hits, `You searched GitHub for “${query}”.`);
      setLooking((current) => ({ ...current, github: false }));
    })();
  }, [active.github]);

  useEffect(() => {
    const linkedin = (active.linkedin ?? '').trim().length >= 2;
    const telegram = (active.telegram ?? '').trim().length >= 2;
    const whatsapp = (active.whatsapp ?? '').trim().length >= 2;
    setLooking((current) => ({ ...current, linkedin, telegram, whatsapp }));
  }, [active.linkedin, active.telegram, active.whatsapp]);

  function toggle(platform: string, id: string) {
    setChosen((current) => {
      if (current[platform] === id) {
        const next = { ...current };
        delete next[platform];
        return next;
      }
      return { ...current, [platform]: id };
    });
  }

  function finish(requirePick: boolean) {
    if (!repo) return;
    let linked = 0;
    for (const id of Object.values(chosen)) {
      const result = repo.confirmHandle(id);
      if (result.ok) linked += 1;
      else showToast(`One account is already linked to ${result.otherName}.`);
    }
    if (requirePick && linked === 0) {
      showToast('Choose an account first.');
      return;
    }
    bump();
    if (linked) showToast(`Connected ${linked}.`);
    router.replace({ pathname: '/person/[id]', params: { id: personId } });
  }

  return (
    <Screen theme={theme}>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 48 }} keyboardShouldPersistTaps="handled">
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
          <Avatar theme={theme} uri={primaryProfilePhoto(person?.photo_uri, handles)} name={person?.display_name || primary?.value || 'Unknown'} size={64} ring={primary ? 'confirmed' : 'pending'} />
          <View style={{ flex: 1, gap: 2 }}>
            <Text accessibilityRole="header" style={{ color: theme.text, fontSize: 26, fontFamily: 'BricolageGrotesque_700Bold', letterSpacing: -0.4 }} numberOfLines={2}>{person?.display_name ?? 'Account'}</Text>
            <Text style={{ color: theme.text2, fontSize: 14 }}>{status}</Text>
          </View>
        </View>
        <Label theme={theme}>Primary account</Label>
        {primary ? (
          <Card theme={theme} tone="sea" style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <PlatformMark platform={primary.platform} size={40} />
            <View style={{ flex: 1 }}>
              <Text style={{ color: theme.text, fontSize: 16, fontWeight: '600' }}>{primary.display_name || person?.display_name}</Text>
              <Text style={{ color: theme.text3, fontSize: 13, fontFamily: MONO }}>{platformName(primary.platform)} · {primary.value}</Text>
            </View>
            <Pressable accessibilityLabel={`Open ${platformName(primary.platform)}`} onPress={() => void Linking.openURL(primary.url || profileUrl(primary.platform, primary.value))} hitSlop={8} style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}>
              <Icon name="arrow.up.right" color={theme.link} size={18} />
            </Pressable>
          </Card>
        ) : <Text style={{ color: theme.text3 }}>No primary account yet.</Text>}
        {primary?.bio || person?.summary ? <Text style={{ color: theme.text2, fontSize: 15, lineHeight: 21 }}>{primary?.bio || person?.summary}</Text> : null}
        {pick !== '1' ? <Button theme={theme} kind="ai" icon="person.2" label="Find other accounts" onPress={() => { void getSecret(SECRET.anthropic).then((key) => { setHasKey(Boolean(key)); setAsk(true); }); }} /> : null}
        {busy ? <Text style={{ color: theme.text2 }}>Checking public profiles. This can take a few seconds.</Text> : null}
        {PLATFORMS.filter((platform) => platform !== primary?.platform).map((platform) => {
          const rows = pending.filter((handle) => handle.platform === platform).sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
          return (
            <View key={platform} style={{ gap: 8 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <PlatformMark platform={platform} size={26} />
                <Text style={{ color: theme.text, fontSize: 19, fontFamily: 'BricolageGrotesque_700Bold' }}>{platformName(platform)}</Text>
                {looking[platform] || (busy && rows.length === 0) ? <ActivityIndicator color={theme.tide} /> : null}
              </View>
              <Field theme={theme} value={draft[platform] ?? ''} onChangeText={(text) => setDraft((current) => ({ ...current, [platform]: text }))} autoCapitalize="none" placeholder={searchHint(platform)} accessibilityLabel={`Search ${platformName(platform)}`} />
              {(platform === 'linkedin' && (active.linkedin ?? '').trim().length >= 2) ? <LinkedInDirectory theme={theme} query={active.linkedin ?? ''} onPeople={(people) => remember(people, `You searched LinkedIn for “${active.linkedin ?? ''}”.`)} onSettled={() => setLooking((current) => ({ ...current, linkedin: false }))} /> : null}
              {(platform === 'telegram' && (active.telegram ?? '').trim().length >= 2) ? <AccountRegistry kind="telegram" theme={theme} query={active.telegram ?? ''} onPeople={(people) => remember(people, `You searched Telegram for “${active.telegram ?? ''}”.`)} onSettled={() => setLooking((current) => ({ ...current, telegram: false }))} /> : null}
              {(platform === 'whatsapp' && (active.whatsapp ?? '').trim().length >= 2) ? <AccountRegistry kind="whatsapp" theme={theme} query={active.whatsapp ?? ''} onPeople={(people) => remember(people, `You searched WhatsApp for “${active.whatsapp ?? ''}”.`)} onSettled={() => setLooking((current) => ({ ...current, whatsapp: false }))} /> : null}
              {platform === 'x' ? <Text style={{ color: theme.text3, fontSize: 13 }}>A twitterapi.io key in Settings searches X by name. Without it, only an exact @handle is checked.</Text> : null}
              {(() => {
                const picked = rows.find((handle) => handle.id === chosen[platform]);
                const searched = rows.filter((handle) => handle.source_provider === 'manual-search' && handle.id !== picked?.id);
                const suggested = rows.filter((handle) => handle.source_provider !== 'manual-search' && handle.id !== picked?.id);
                const row = (handle: (typeof rows)[number], selected: boolean) => {
                  const link = handle.url || profileUrl(handle.platform, handle.value);
                  return (
                    <Pressable key={handle.id} accessibilityLabel={selected ? 'Clear selection' : 'Select account'} onPress={() => toggle(platform, handle.id)} style={{ flexDirection: 'row', gap: 10, alignItems: 'center', backgroundColor: theme.surface1, borderRadius: 18, padding: 12, borderWidth: 1.5, borderColor: selected ? theme.sea : 'transparent' }}>
                      <Avatar theme={theme} uri={handle.avatar_uri} name={handle.display_name || handle.value} size={44} />
                      <View style={{ flex: 1 }}>
                        <Text style={{ color: theme.text }} numberOfLines={1}>{handle.display_name || handle.value}</Text>
                        <Text style={{ color: theme.text3, fontSize: 13, fontFamily: MONO }} numberOfLines={1}>{handle.platform === 'whatsapp' ? handle.value : `@${handle.value}`}</Text>
                        {handle.bio ? <Text style={{ color: theme.text2, fontSize: 13 }} numberOfLines={2}>{handle.bio}</Text> : null}
                        {handle.score != null ? (
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6 }}>
                            <View style={{ flex: 1, height: 6, borderRadius: 3, backgroundColor: theme.surface2, overflow: 'hidden' }}>
                              <View style={{ width: percent(handle.score) === '—' ? '0%' : (percent(handle.score) as `${number}%`), height: 6, borderRadius: 3, backgroundColor: (handle.score <= 1 ? handle.score * 100 : handle.score) >= 70 ? theme.sea : theme.butter }} />
                            </View>
                            <Text style={{ color: theme.text2, fontSize: 12, fontFamily: MONO }}>{percent(handle.score)} match</Text>
                          </View>
                        ) : null}
                        {selected ? <Text style={{ color: theme.linked, fontSize: 13, fontWeight: '600', marginTop: 4 }}>Selected</Text> : null}
                      </View>
                      <Pressable accessibilityLabel="Open profile" onPress={() => void Linking.openURL(link)} hitSlop={8}>
                        <Icon name="arrow.up.right" color={theme.link} size={18} />
                      </Pressable>
                      <Icon name={selected ? 'checkmark.circle.fill' : 'circle'} color={selected ? theme.sea : theme.text3} size={22} />
                    </Pressable>
                  );
                };
                return (
                  <View style={{ gap: 8 }}>
                    {picked ? row(picked, true) : null}
                    {searched.length > 0 ? <Label theme={theme}>Search</Label> : null}
                    {searched.map((handle) => row(handle, false))}
                    {suggested.length > 0 ? <Label theme={theme}>Suggested</Label> : null}
                    {suggested.map((handle) => row(handle, false))}
                    {!busy && !looking[platform] && !picked && searched.length === 0 && suggested.length === 0 ? <Text style={{ color: theme.text3 }}>{platform === 'whatsapp' ? 'No number on the public profile. Search your linked contacts, or type a phone with the country code.' : 'Nothing yet. Search by name above, or run Find.'}</Text> : null}
                  </View>
                );
              })()}
            </View>
          );
        })}
      </ScrollView>
      <ActionBar theme={theme} bottom={Math.max(16, insets.bottom)}>
        <Button theme={theme} kind="secondary" label="Complete" onPress={() => { if (!busy) finish(false); }} style={{ flex: 1 }} />
        <Button theme={theme} icon="checkmark" label={busy ? 'Saving' : `Save ${Object.keys(chosen).length || ''} account${Object.keys(chosen).length === 1 ? '' : 's'}`.replace('  ', ' ')} disabled={busy} onPress={() => { if (!busy) finish(true); }} style={{ flex: 1 }} />
      </ActionBar>
      <AiConfirm
        theme={theme}
        visible={ask}
        title={estimate.title}
        detail={estimate.detail}
        estimate={estimate.estimate}
        busy={busy}
        canRun
        runLabel="Look up accounts"
        onCancel={() => setAsk(false)}
        onRun={() => { setAsk(false); void searchOthers(hasKey); }}
      />
    </Screen>
  );
}
