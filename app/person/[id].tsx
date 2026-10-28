import { useEffect, useRef, useState } from 'react';
import { Alert, Image, Pressable, ScrollView, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import * as Linking from 'expo-linking';
import { useAudioPlayer } from 'expo-audio';
import { useApp } from '@/src/state/AppContext';
import { Avatar, Button, Card, Chip, Field, Icon, Label, List, ListItem, MONO, PlatformMark, Screen, platformName } from '@/src/ui/components';
import { AiConfirm } from '@/src/ui/AiConfirm';
import { EventTags } from '@/src/ui/EventTags';
import { geoLabel } from '@/src/data/weekTags';
import { formatIstDay, formatIstTime } from '@/src/lib/time';
import { profileUrl } from '@/src/services/followupLinks';
import { getSecret, SECRET } from '@/src/services/secrets';
import { primaryProfilePhoto, upgradeWebAnchor } from '@/src/services/primaryAccount';
import { structureWithClaude } from '@/src/services/anthropic';
import { transcribeRecording } from '@/src/services/transcribe';
import { bulletsFromStructured, bulletsFromText, estimateNoteCost, estimateVoiceCost } from '@/src/services/notes';
import type { RecallRepository } from '@/src/db/repository';

function clock(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
}

function VoiceMemo({ theme, uri, ms }: { theme: ReturnType<typeof useApp>['theme']; uri: string; ms: number | null }) {
  const player = useAudioPlayer(uri);
  return (
    <Pressable
      accessibilityLabel={player.playing ? 'Pause voice memo' : 'Play voice memo'}
      onPress={() => { if (player.playing) player.pause(); else player.play(); }}
      style={{ flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 56, backgroundColor: theme.surface2, borderRadius: 16, paddingHorizontal: 10 }}
    >
      <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: theme.tide, alignItems: 'center', justifyContent: 'center' }}>
        <Icon name={player.playing ? 'pause.fill' : 'play.fill'} color={theme.onColor} size={16} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ color: theme.text, fontSize: 16 }}>Voice memo</Text>
        <Text style={{ color: theme.text3, fontSize: 13 }}>{player.playing ? 'Playing' : 'Tap to play'}</Text>
      </View>
      <Text style={{ color: theme.text2, fontFamily: MONO, fontSize: 13 }}>{ms ? clock(ms) : ''}</Text>
    </Pressable>
  );
}

function MeetingNote({
  theme,
  repo,
  encounter,
  bump,
  onAnalyse,
}: {
  theme: ReturnType<typeof useApp>['theme'];
  repo: RecallRepository;
  encounter: ReturnType<RecallRepository['encounters']>[number];
  bump: () => void;
  onAnalyse: (note: string) => void;
}) {
  const [text, setText] = useState(encounter.transcript ?? '');
  useEffect(() => { setText(encounter.transcript ?? ''); }, [encounter.transcript]);
  const when = `${formatIstDay(encounter.at)} · ${formatIstTime(encounter.at)}`;
  const where = geoLabel(encounter.lat, encounter.lng);
  function save(next = text) {
    repo.patchEncounter(encounter.id, { transcript: next });
    bump();
  }
  return (
    <Card theme={theme} style={{ gap: 12 }}>
      <View style={{ gap: 2 }}>
        <Text style={{ color: theme.text, fontSize: 16, fontWeight: '600' }}>{when}</Text>
        <Text style={{ color: theme.text3, fontSize: 13 }}>{encounter.tag || repo.eventName(encounter.event_id) || 'No event tag'} · {where}</Text>
      </View>
      {encounter.audio_uri ? <VoiceMemo theme={theme} uri={encounter.audio_uri} ms={encounter.audio_ms} /> : null}
      <Field theme={theme} value={text} onChangeText={setText} onBlur={() => save()} multiline placeholder="What you talked about" accessibilityLabel="Meeting note" style={{ minHeight: 120, textAlignVertical: 'top', backgroundColor: theme.surface2, lineHeight: 22 }} />
      <EventTags theme={theme} value={encounter.tag} onChange={(tag) => { repo.patchEncounter(encounter.id, { tag }); repo.setSetting('current_tag', tag); bump(); }} />
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <Button theme={theme} kind="ai" size="small" icon="sparkles" label="Analyse" onPress={() => onAnalyse(text)} style={{ flex: 1 }} />
        <Button theme={theme} size="small" icon="checkmark" label="Save" onPress={() => save()} style={{ flex: 1 }} />
      </View>
    </Card>
  );
}

export default function PersonScreen() {
  const { theme, repo, revision, bump, showToast } = useApp();
  const { id } = useLocalSearchParams<{ id: string }>();
  const person = repo?.person(id);
  const handles = repo?.handles(id) ?? [];
  const encounters = repo?.encounters(id) ?? [];
  const suggestions = handles.filter((handle) => handle.status === 'suggested' || handle.status === 'conflict');
  const [ask, setAsk] = useState<{ encounterId: string; kind: 'voice' | 'note'; note: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [canRun, setCanRun] = useState(false);
  const [voiceClaude, setVoiceClaude] = useState(false);
  const upgraded = useRef(false);
  useEffect(() => {
    if (!repo || upgraded.current) return;
    const anchor = repo.handles(id).find((handle) => handle.status === 'anchor' && handle.platform === 'web');
    if (!anchor) return;
    upgraded.current = true;
    void (async () => {
      const twitter = (await getSecret(SECRET.twitter)) ?? undefined;
      const filled = await upgradeWebAnchor(repo, id, twitter);
      if (filled) bump();
    })();
  }, [repo, id, bump]);
  void revision;
  if (!person || !repo) return <Screen theme={theme}><Text style={{ color: theme.text, padding: 24 }}>This person is gone.</Text></Screen>;
  const linked = handles.filter((handle) => (handle.status === 'confirmed' || handle.status === 'anchor') && handle.platform !== 'web');
  const face = primaryProfilePhoto(person.photo_uri, handles);
  const photos = encounters.flatMap((encounter) => repo.encounterPhotos(encounter.id).map((uri) => ({ uri, encounterId: encounter.id })));
  const latest = encounters[0];
  const estimate = ask?.kind === 'voice' ? estimateVoiceCost(voiceClaude) : estimateNoteCost(ask?.note || ' ');

  function openProfile(platform: string, value: string, url: string | null) {
    void Linking.openURL(url || profileUrl(platform, value));
  }

  async function beginAnalyse(encounterId: string, note: string) {
    const encounter = repo?.encounters(id).find((item) => item.id === encounterId);
    if (!encounter) return;
    if (encounter.audio_uri) {
      const [groq, anthropic] = await Promise.all([getSecret(SECRET.groq), getSecret(SECRET.anthropic)]);
      setCanRun(Boolean(groq));
      setVoiceClaude(Boolean(anthropic));
      setAsk({ encounterId, kind: 'voice', note });
      return;
    }
    if (!note.trim()) {
      showToast('Add a note or a voice memo before analysing.');
      return;
    }
    const key = await getSecret(SECRET.anthropic);
    setCanRun(Boolean(key));
    setVoiceClaude(false);
    setAsk({ encounterId, kind: 'note', note });
  }

  function writeNote(encounterId: string, current: string, bullets: string) {
    if (!repo) return;
    const next = current.trim() ? `${current.trim()}\n${bullets}` : bullets;
    repo.patchEncounter(encounterId, { transcript: next });
    bump();
    setAsk(null);
    showToast('Added to the note.');
  }

  async function runAnalyse() {
    if (!repo || !ask) return;
    setBusy(true);
    try {
      if (ask.kind === 'voice') {
        const encounter = repo.encounters(id).find((item) => item.id === ask.encounterId);
        const groq = await getSecret(SECRET.groq);
        if (!groq || !encounter?.audio_uri) {
          showToast('Add a Groq key in Settings so the recording can be transcribed.');
          return;
        }
        const transcript = await transcribeRecording(encounter.audio_uri, groq);
        const anthropic = await getSecret(SECRET.anthropic);
        let bullets = '';
        if (anthropic) {
          const structured = await structureWithClaude(anthropic, transcript);
          bullets = structured ? bulletsFromStructured(structured) : '';
          if (structured) {
            repo.saveDraft(ask.encounterId, structured);
            repo.finishAi('structure_note', ask.encounterId);
          }
        }
        if (!bullets) bullets = bulletsFromText(transcript);
        writeNote(ask.encounterId, ask.note, bullets);
        return;
      }
      const key = await getSecret(SECRET.anthropic);
      if (!key) return;
      const structured = await structureWithClaude(key, ask.note);
      if (!structured) {
        showToast('AI returned nothing usable.');
        return;
      }
      repo.saveDraft(ask.encounterId, structured);
      repo.finishAi('structure_note', ask.encounterId);
      writeNote(ask.encounterId, ask.note, bulletsFromStructured(structured));
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'The analysis did not finish.');
    } finally {
      setBusy(false);
    }
  }

  const role = [person.role, person.company].filter(Boolean).join(' · ') || person.state;
  return (
    <Screen theme={theme}>
      <ScrollView contentContainerStyle={{ paddingBottom: 48 }}>
        <View style={{ backgroundColor: `${theme.glacier}22`, borderBottomLeftRadius: 32, borderBottomRightRadius: 32, padding: 20, paddingTop: 8, gap: 14 }}>
          <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 14 }}>
            <Avatar theme={theme} uri={face} name={person.display_name || 'Unknown'} size={84} ring={linked.length ? 'confirmed' : 'pending'} />
            <View style={{ flex: 1, gap: 2, paddingBottom: 4 }}>
              <Text accessibilityRole="header" style={{ color: theme.text, fontFamily: 'BricolageGrotesque_700Bold', fontSize: 30, letterSpacing: -0.5 }} numberOfLines={2}>{person.display_name}</Text>
              <Text style={{ color: theme.text2, fontSize: 15 }} numberOfLines={2}>{role}</Text>
            </View>
          </View>
          {person.recognise_hint ? <Text style={{ color: theme.text3, fontSize: 14 }}>{person.recognise_hint}</Text> : null}
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
            {linked.map((handle) => (
              <Pressable key={handle.id} accessibilityLabel={`Open ${platformName(handle.platform)}`} onPress={() => openProfile(handle.platform, handle.value, handle.url)} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: theme.surface1, borderRadius: 18, paddingLeft: 4, paddingRight: 12, minHeight: 40 }}>
                <PlatformMark platform={handle.platform} size={30} />
                <Text style={{ color: theme.text, fontSize: 13, fontFamily: MONO }} numberOfLines={1}>{handle.platform === 'whatsapp' ? handle.value : `@${handle.value}`}</Text>
              </Pressable>
            ))}
            <Chip theme={theme} label={suggestions.length ? `${suggestions.length} to review` : 'Find accounts'} onPress={() => router.push({ pathname: '/identity/[personId]', params: { personId: id } })} />
          </View>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <Button theme={theme} kind={person.starred ? 'primary' : 'secondary'} size="small" icon={person.starred ? 'star.fill' : 'star'} label={person.starred ? 'Starred' : 'Star'} onPress={() => { repo.setStar(id, !person.starred); bump(); }} style={{ flex: 1 }} />
            <Button
              theme={theme}
              kind="secondary"
              size="small"
              icon="camera.fill"
              label="Photo"
              style={{ flex: 1 }}
              onPress={() => {
                if (!latest) {
                  showToast('There is no meeting to attach a photo to.');
                  return;
                }
                void ImagePicker.launchCameraAsync({ quality: 0.8 }).then((result) => {
                  const uri = result.canceled ? '' : result.assets[0]?.uri;
                  if (!uri) return;
                  repo.addEncounterPhoto(latest.id, uri);
                  bump();
                });
              }}
            />
          </View>
        </View>
        <View style={{ padding: 16, gap: 16 }}>
          {person.summary ? <Text style={{ color: theme.text2, lineHeight: 22, fontSize: 16 }}>{person.summary}</Text> : null}
          <List theme={theme}>
            <ListItem theme={theme} icon="person.2" tone="glacier" title="Possible accounts" subtitle={suggestions.length ? `${suggestions.length} to review` : 'Look up other platforms'} onPress={() => router.push({ pathname: '/identity/[personId]', params: { personId: id } })} last />
          </List>
          <View style={{ gap: 10 }}>
            <Label theme={theme}>Notes</Label>
            {encounters.length === 0 ? <Text style={{ color: theme.text3 }}>No notes yet.</Text> : null}
            {encounters.map((encounter) => (
              <MeetingNote key={encounter.id} theme={theme} repo={repo} encounter={encounter} bump={bump} onAnalyse={(note) => void beginAnalyse(encounter.id, note)} />
            ))}
          </View>
          <View style={{ gap: 10 }}>
            <Label theme={theme}>Photos · {photos.length}</Label>
            <Text style={{ color: theme.text3, fontSize: 14 }}>Pictures taken at the event. The face above stays the profile photo.</Text>
            {photos.length > 0 ? (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
                {photos.map((photo) => <Image key={photo.uri} source={{ uri: photo.uri }} style={{ width: 140, height: 180, borderRadius: 16, backgroundColor: theme.surface2 }} />)}
              </ScrollView>
            ) : <Text style={{ color: theme.text2 }}>No event photo yet.</Text>}
          </View>
          <Button
            theme={theme}
            kind="ghost"
            icon="trash"
            label={`Delete ${person.display_name ?? 'this person'}`}
            onPress={() => {
              Alert.alert(`Delete ${person.display_name ?? 'this person'} and all notes about them?`, undefined, [
                { text: 'Cancel', style: 'cancel' },
                { text: `Delete ${person.display_name ?? 'person'}`, style: 'destructive', onPress: () => { repo.deletePerson(id); bump(); router.back(); } },
              ]);
            }}
          />
        </View>
      </ScrollView>
      <AiConfirm
        theme={theme}
        visible={ask != null}
        title={estimate.title}
        detail={estimate.detail}
        estimate={estimate.estimate}
        busy={busy}
        canRun={canRun}
        blocked={ask?.kind === 'voice' ? 'Add a Groq key in Settings. Expo Go cannot transcribe on the phone, so Groq Whisper reads the recording.' : undefined}
        onCancel={() => setAsk(null)}
        onFree={ask?.kind === 'note' ? () => { if (ask) writeNote(ask.encounterId, ask.note, bulletsFromText(ask.note)); } : undefined}
        onRun={() => void runAnalyse()}
      />
    </Screen>
  );
}
