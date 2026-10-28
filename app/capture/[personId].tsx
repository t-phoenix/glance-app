import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Image, KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, View } from 'react-native';
import * as Linking from 'expo-linking';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { RecordingPresets, requestRecordingPermissionsAsync, setAudioModeAsync, useAudioPlayer, useAudioRecorder, useAudioRecorderState } from 'expo-audio';
import * as ImagePicker from 'expo-image-picker';
import { useApp } from '@/src/state/AppContext';
import { ActionBar, Avatar, Button, Card, Field, Icon, Label, MONO, PlatformMark, Screen, platformName } from '@/src/ui/components';
import { AiConfirm } from '@/src/ui/AiConfirm';
import { EventTags } from '@/src/ui/EventTags';
import { structureWithClaude } from '@/src/services/anthropic';
import { getSecret, SECRET } from '@/src/services/secrets';
import { bulletsFromStructured, bulletsFromText, estimateMatchCost, estimateVoiceCost } from '@/src/services/notes';
import { transcribeRecording } from '@/src/services/transcribe';
import { profileUrl } from '@/src/services/followupLinks';
import { primaryProfilePhoto, upgradeWebAnchor } from '@/src/services/primaryAccount';

type Phase = 'idle' | 'recording' | 'saving' | 'saved' | 'error';

function clock(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
}

export default function CaptureScreen() {
  const { theme, repo, bump, showToast } = useApp();
  const params = useLocalSearchParams<{ personId: string; encounter?: string; tag?: string }>();
  const person = repo?.person(params.personId);
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const rec = useAudioRecorderState(recorder, 250);
  const [note, setNote] = useState('');
  const [phase, setPhase] = useState<Phase>('idle');
  const [recError, setRecError] = useState('');
  const [audioUri, setAudioUri] = useState<string | null>(null);
  const [audioMs, setAudioMs] = useState(0);
  const [tag, setTag] = useState(typeof params.tag === 'string' ? params.tag : '');
  const [ask, setAsk] = useState(false);
  const [busy, setBusy] = useState(false);
  const [canRun, setCanRun] = useState(false);
  const [voiceClaude, setVoiceClaude] = useState(false);
  const [askFind, setAskFind] = useState(false);
  const [findWithAi, setFindWithAi] = useState(false);
  const [reading, setReading] = useState(false);
  const player = useAudioPlayer(audioUri);
  const upgraded = useRef(false);
  const insets = useSafeAreaInsets();
  const [typing, setTyping] = useState(false);
  const halo = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (phase !== 'recording') { halo.setValue(0); return; }
    const loop = Animated.loop(Animated.timing(halo, { toValue: 1, duration: 1600, easing: Easing.out(Easing.quad), useNativeDriver: true }));
    loop.start();
    return () => loop.stop();
  }, [phase, halo]);
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
  const encounterId = typeof params.encounter === 'string' ? params.encounter : repo?.encounters(params.personId)[0]?.id;
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

  async function startRecording() {
    setRecError('');
    try {
      const permission = await requestRecordingPermissionsAsync();
      if (!permission.granted) {
        setPhase('error');
        setRecError('Allow the microphone for Expo Go in iPhone Settings, then try again.');
        return;
      }
      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
      await recorder.prepareToRecordAsync();
      recorder.record();
      await new Promise((resolve) => setTimeout(resolve, 250));
      const status = recorder.getStatus();
      if (!status.isRecording) {
        setPhase('error');
        setRecError('The microphone did not start. Allow it for Expo Go in iPhone Settings.');
        return;
      }
      setPhase('recording');
    } catch (error) {
      setPhase('error');
      setRecError(error instanceof Error ? error.message : 'Recording could not start.');
    }
  }

  async function stopRecording() {
    setPhase('saving');
    try {
      await recorder.stop();
      const status = recorder.getStatus();
      const uri = recorder.uri || status.url;
      if (!uri) {
        setPhase('error');
        setRecError('The recording file was not saved.');
        return;
      }
      setAudioUri(uri);
      setAudioMs(status.durationMillis || rec.durationMillis);
      setPhase('saved');
    } catch (error) {
      setPhase('error');
      setRecError(error instanceof Error ? error.message : 'Could not stop the recording.');
    }
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
      setNote((current) => (current.trim() ? `${current.trim()}\n${bullets}` : bullets));
      if (encounterId) repo.patchEncounter(encounterId, { transcript: bullets, audio_uri: audioUri, audio_ms: audioMs });
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
    if (phase === 'recording') {
      showToast('Stop the recording first.');
      return;
    }
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

  const caption = phase === 'recording'
    ? `Recording ${clock(rec.durationMillis)}`
    : phase === 'saving'
      ? 'Saving the recording…'
      : phase === 'saved'
        ? `Recorded ${clock(audioMs)}. Analyse turns this recording into notes.`
        : phase === 'error'
          ? recError
          : 'Tap to record. How you met, what you talked about, what you promised.';

  const showField = typing || note.trim().length > 0;
  const recording = phase === 'recording';
  const ring = (delay: number) => ({
    opacity: halo.interpolate({ inputRange: [0, 1], outputRange: [0.55 - delay, 0] }),
    transform: [{ scale: halo.interpolate({ inputRange: [0, 1], outputRange: [1 + delay, 1.7 + delay] }) }],
  });
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
      <View style={{ alignItems: 'center', gap: 16, paddingVertical: 16 }}>
        {recording || audioUri ? <Text style={{ color: theme.text, fontFamily: MONO, fontSize: 44 }}>{clock(recording ? rec.durationMillis : audioMs)}</Text> : null}
        <View style={{ width: 150, height: 150, alignItems: 'center', justifyContent: 'center' }}>
          <Animated.View pointerEvents="none" style={[{ position: 'absolute', width: 88, height: 88, borderRadius: 44, borderWidth: 2, borderColor: theme.tide }, ring(0)]} />
          <Animated.View pointerEvents="none" style={[{ position: 'absolute', width: 88, height: 88, borderRadius: 44, borderWidth: 2, borderColor: theme.tide }, ring(0.25)]} />
          {!recording ? <View pointerEvents="none" style={{ position: 'absolute', width: 118, height: 118, borderRadius: 59, borderWidth: 2, borderColor: `${theme.tide}40` }} /> : null}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={recording ? 'Stop recording' : 'Start recording'}
            disabled={phase === 'saving'}
            onPress={() => void (recording ? stopRecording() : startRecording())}
            style={({ pressed }) => ({ width: 88, height: 88, borderRadius: 44, backgroundColor: recording ? theme.dangerFill : theme.action, alignItems: 'center', justifyContent: 'center', transform: [{ scale: pressed ? 0.95 : 1 }] })}
          >
            {recording ? <View style={{ width: 28, height: 28, borderRadius: 8, backgroundColor: theme.onColor }} /> : <Icon name="mic.fill" color={theme.actionText} size={34} />}
          </Pressable>
        </View>
        <Text style={{ color: phase === 'error' ? theme.warning : theme.text2, textAlign: 'center', fontSize: 15, lineHeight: 21, maxWidth: 300 }}>{caption}</Text>
        {audioUri ? (
          <Button theme={theme} kind="secondary" size="small" icon={player.playing ? 'pause.fill' : 'play.fill'} label={player.playing ? 'Pause' : 'Play back'} onPress={() => { if (player.playing) player.pause(); else player.play(); }} />
        ) : null}
        {!showField ? (
          <Pressable accessibilityRole="button" onPress={() => setTyping(true)} hitSlop={8} style={{ minHeight: 44, justifyContent: 'center' }}>
            <Text style={{ color: theme.link, fontSize: 17, fontWeight: '600' }}>Type a note instead</Text>
          </Pressable>
        ) : null}
      </View>
      {showField ? (
        <View style={{ gap: 8 }}>
          <Label theme={theme}>Note</Label>
          <Field theme={theme} value={note} onChangeText={setNote} multiline autoFocus={typing && !note} placeholder="Type the note. Typed text is saved as you wrote it." accessibilityLabel="Note" style={{ minHeight: 140, textAlignVertical: 'top', lineHeight: 22 }} />
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
        {audioUri ? <Button theme={theme} kind="ai" icon="sparkles" label="Analyse" onPress={analyse} style={{ paddingHorizontal: 16 }} /> : null}
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
