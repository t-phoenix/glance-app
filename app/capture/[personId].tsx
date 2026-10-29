import { useEffect, useRef, useState } from 'react';
import { Image, KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, View } from 'react-native';
import * as Linking from 'expo-linking';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { useApp } from '@/src/state/AppContext';
import { ActionBar, Avatar, Button, Card, Field, Label, MONO, PlatformMark, Screen, platformName } from '@/src/ui/components';
import { AiConfirm } from '@/src/ui/AiConfirm';
import { EventTags } from '@/src/ui/EventTags';
import { VoiceNote } from '@/src/ui/VoiceNote';
import { structureWithClaude } from '@/src/services/anthropic';
import { getSecret, SECRET } from '@/src/services/secrets';
import { bulletsFromStructured, bulletsFromText, estimateMatchCost, estimateVoiceCost } from '@/src/services/notes';
import { transcribeRecording } from '@/src/services/transcribe';
import { profileUrl } from '@/src/services/followupLinks';
import { primaryProfilePhoto, upgradeWebAnchor } from '@/src/services/primaryAccount';

export default function CaptureScreen() {
  const { theme, repo, bump, showToast } = useApp();
  const params = useLocalSearchParams<{ personId: string; encounter?: string; tag?: string }>();
  const person = repo?.person(params.personId);
  const encounterId = typeof params.encounter === 'string' ? params.encounter : repo?.encounters(params.personId)[0]?.id;
  const encounter = repo?.encounters(params.personId).find((item) => item.id === encounterId);
  const [note, setNote] = useState(encounter?.transcript ?? '');
  const [audioUri, setAudioUri] = useState<string | null>(encounter?.audio_uri ?? null);
  const [audioMs, setAudioMs] = useState(encounter?.audio_ms ?? 0);
  const [tag, setTag] = useState(typeof params.tag === 'string' ? params.tag : '');
  const [ask, setAsk] = useState(false);
  const [busy, setBusy] = useState(false);
  const [canRun, setCanRun] = useState(false);
  const [voiceClaude, setVoiceClaude] = useState(false);
  const [askFind, setAskFind] = useState(false);
  const [findWithAi, setFindWithAi] = useState(false);
  const [reading, setReading] = useState(false);
  const upgraded = useRef(false);
  const insets = useSafeAreaInsets();
  const [typing, setTyping] = useState(false);
  useEffect(() => {
    if (!repo || upgraded.current) return;
    const anchor = repo.handles(params.personId).find((handle) => handle.status === 'anchor');
    if (!anchor || anchor.platform !== 'web') return;
    upgraded.current = true;
    setReading(true);
    void (async () => {
      try {
        const twitter = (await getSecret(SECRET.twitter)) ?? undefined;
        const filled = await upgradeWebAnchor(repo, params.personId, twitter);
        if (filled) bump();
      } finally {
        setReading(false);
      }
    })();
  }, [repo, params.personId, bump]);
  const estimate = estimateVoiceCost(voiceClaude);
  const matchEstimate = estimateMatchCost(findWithAi);
  const handles = repo?.handles(params.personId) ?? [];
  const primary = handles.find((handle) => (handle.status === 'anchor' || handle.status === 'confirmed') && handle.platform !== 'web');
  const face = primaryProfilePhoto(person?.photo_uri, handles);

  function applyTag(next: string) {
    setTag(next);
    if (repo && encounterId) {
      repo.patchEncounter(encounterId, { tag: next });
      repo.setSetting('current_tag', next);
      bump();
    }
  }

  function keepRecording(uri: string, ms: number) {
    setAudioUri(uri);
    setAudioMs(ms);
    if (repo && encounterId) repo.patchEncounter(encounterId, { audio_uri: uri, audio_ms: ms });
  }

  async function runVoice() {
    if (!repo || !audioUri) return;
    setBusy(true);
    try {
      const groq = await getSecret(SECRET.groq);
      if (!groq) {
        showToast('Add a Groq key in Settings so the recording can be transcribed.');
        return;
      }
      const transcript = await transcribeRecording(audioUri, groq);
      const anthropic = await getSecret(SECRET.anthropic);
      let bullets = '';
      if (anthropic) {
        try {
          const structured = await structureWithClaude(anthropic, transcript);
          bullets = structured ? bulletsFromStructured(structured) : '';
          if (encounterId && structured) {
            repo.saveDraft(encounterId, structured);
            repo.finishAi('structure_note', encounterId);
          }
        } catch {
          bullets = '';
        }
      }
      if (!bullets) bullets = bulletsFromText(transcript);
      const next = note.trim() ? `${note.trim()}\n${bullets}` : bullets;
      setNote(next);
      if (encounterId) repo.patchEncounter(encounterId, { transcript: next, audio_uri: audioUri, audio_ms: audioMs });
      setAsk(false);
      showToast('Bullet notes are in the field. Edit them before you save.');
      bump();
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'The recording could not be transcribed.');
    } finally {
      setBusy(false);
    }
  }

  function analyse() {
    if (!audioUri) {
      showToast('Record a voice note first. Typed notes stay as you wrote them.');
      return;
    }
    void Promise.all([getSecret(SECRET.groq), getSecret(SECRET.anthropic)]).then(([groq, anthropic]) => {
      setCanRun(Boolean(groq));
      setVoiceClaude(Boolean(anthropic));
      setAsk(true);
    });
  }

  function takePhoto() {
    void ImagePicker.launchCameraAsync({ quality: 0.8, allowsEditing: false }).then((result) => {
      const uri = result.canceled ? '' : result.assets[0]?.uri;
      if (!uri || !encounterId || !repo) return;
      repo.addEncounterPhoto(encounterId, uri);
      bump();
      showToast('Photo saved');
    });
  }

  function saveNote() {
    if (!repo || !encounterId) return;
    repo.patchEncounter(encounterId, { transcript: note, audio_uri: audioUri, audio_ms: audioMs, tag: tag || null });
    bump();
    void getSecret(SECRET.anthropic).then((key) => {
      setFindWithAi(Boolean(key));
      setAskFind(true);
    });
  }

  const showField = typing || note.trim().length > 0;
  return (
    <Screen theme={theme}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={90}>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16, gap: 14, paddingBottom: 24 }} keyboardShouldPersistTaps="handled" automaticallyAdjustKeyboardInsets>
      {primary && primary.platform !== 'web' ? (
        <Card theme={theme} style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <Avatar theme={theme} uri={face} name={person?.display_name || primary.value} size={52} ring="confirmed" />
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={{ color: theme.text, fontSize: 18, fontWeight: '600' }} numberOfLines={1}>{person?.display_name}</Text>
            <Text style={{ color: theme.text3, fontSize: 13, fontFamily: MONO }}>{primary.platform === 'whatsapp' ? primary.value : `@${primary.value}`}</Text>
            {primary.bio || person?.summary ? <Text style={{ color: theme.text2, fontSize: 14 }} numberOfLines={2}>{primary.bio || person?.summary}</Text> : null}
          </View>
          <Pressable accessibilityLabel={`Open ${platformName(primary.platform)}`} onPress={() => void Linking.openURL(profileUrl(primary.platform, primary.value) || primary.url || '')} hitSlop={8}>
            <PlatformMark platform={primary.platform} size={34} />
          </Pressable>
        </Card>
      ) : (
        <Text accessibilityRole="header" style={{ color: theme.text, fontFamily: 'BricolageGrotesque_700Bold', fontSize: 30 }}>{person?.display_name ?? 'Note'}</Text>
      )}
      {reading ? <Text style={{ color: theme.text2 }}>Opening the account behind this QR…</Text> : null}
      <VoiceNote theme={theme} size="hero" audioUri={audioUri} audioMs={audioMs} onRecorded={keepRecording} onAnalyse={analyse} />
      {!showField ? (
        <Pressable accessibilityRole="button" onPress={() => setTyping(true)} hitSlop={8} style={{ minHeight: 44, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ color: theme.link, fontSize: 17, fontWeight: '600' }}>Type a note instead</Text>
        </Pressable>
      ) : null}
      {showField ? (
        <View style={{ gap: 8 }}>
          <Label theme={theme}>Note</Label>
          <Field theme={theme} value={note} onChangeText={setNote} multiline autoFocus={typing && !note} placeholder="Typed notes stay as you wrote them. A recording is filled in by Analyse." accessibilityLabel="Note" style={{ minHeight: 140, textAlignVertical: 'top', lineHeight: 22 }} />
        </View>
      ) : null}
      <EventTags theme={theme} value={tag || null} onChange={applyTag} />
      <Label theme={theme}>Photos</Label>
      <Text style={{ color: theme.text3, fontSize: 14 }}>Pictures from the event. The face above stays the profile photo.</Text>
      {encounterId && repo && repo.encounterPhotos(encounterId).length > 0 ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
          {repo.encounterPhotos(encounterId).map((uri) => (
            <Image key={uri} source={{ uri }} style={{ width: 120, height: 160, borderRadius: 16 }} />
          ))}
        </ScrollView>
      ) : <Text style={{ color: theme.text2 }}>No event photo yet.</Text>}
      </ScrollView>
      <ActionBar theme={theme} bottom={Math.max(16, insets.bottom)}>
        <Button theme={theme} kind="secondary" icon="camera.fill" label="Photo" onPress={takePhoto} style={{ paddingHorizontal: 16 }} />
        <Button theme={theme} icon="checkmark" label="Save note" onPress={saveNote} style={{ flex: 1 }} />
      </ActionBar>
      </KeyboardAvoidingView>
      <AiConfirm
        theme={theme}
        visible={ask}
        title={estimate.title}
        detail={estimate.detail}
        estimate={estimate.estimate}
        busy={busy}
        canRun={canRun}
        blocked="Add a Groq key in Settings. Expo Go cannot transcribe on the phone, so Groq Whisper reads the recording."
        onCancel={() => setAsk(false)}
        onRun={() => void runVoice()}
      />
      <AiConfirm
        theme={theme}
        visible={askFind}
        title={matchEstimate.title}
        detail={matchEstimate.detail}
        estimate={matchEstimate.estimate}
        canRun
        runLabel="Look up accounts"
        onCancel={() => { setAskFind(false); router.back(); }}
        onRun={() => {
          setAskFind(false);
          router.replace({ pathname: '/identity/[personId]', params: { personId: params.personId, pick: '1', ai: findWithAi ? '1' : '0' } });
        }}
      />
    </Screen>
  );
}
