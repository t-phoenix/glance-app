import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Pressable, Text, View } from 'react-native';
import { RecordingPresets, requestRecordingPermissionsAsync, setAudioModeAsync, useAudioPlayer, useAudioRecorder, useAudioRecorderState } from 'expo-audio';
import { Button, Icon, MONO } from '@/src/ui/components';
import type { Theme } from '@/src/ui/theme';

function clock(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
}

type Phase = 'idle' | 'recording' | 'saving' | 'error';

/** Record a voice note, play it back, and hand it to Analyse. Typed notes stay outside this control. */
export function VoiceNote({
  theme,
  audioUri,
  audioMs,
  onRecorded,
  onAnalyse,
  size = 'row',
}: {
  theme: Theme;
  audioUri: string | null;
  audioMs: number;
  onRecorded: (uri: string, ms: number) => void;
  onAnalyse?: () => void;
  size?: 'hero' | 'row';
}) {
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const rec = useAudioRecorderState(recorder, 250);
  const player = useAudioPlayer(audioUri);
  const [phase, setPhase] = useState<Phase>('idle');
  const [recError, setRecError] = useState('');
  const halo = useRef(new Animated.Value(0)).current;
  const recording = phase === 'recording';
  const hero = size === 'hero';

  useEffect(() => {
    if (!recording || !hero) {
      halo.setValue(0);
      return;
    }
    const loop = Animated.loop(Animated.timing(halo, { toValue: 1, duration: 1600, easing: Easing.out(Easing.quad), useNativeDriver: true }));
    loop.start();
    return () => loop.stop();
  }, [recording, hero, halo]);

  async function startRecording() {
    setRecError('');
    try {
      const permission = await requestRecordingPermissionsAsync();
      if (!permission.granted) {
        setPhase('error');
        setRecError('Allow the microphone for Glance in iPhone Settings, then try again.');
        return;
      }
      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
      await recorder.prepareToRecordAsync();
      recorder.record();
      await new Promise((resolve) => setTimeout(resolve, 250));
      const status = recorder.getStatus();
      if (!status.isRecording) {
        setPhase('error');
        setRecError('The microphone did not start. Allow it for Glance in iPhone Settings.');
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
      onRecorded(uri, status.durationMillis || rec.durationMillis);
      setPhase('idle');
    } catch (error) {
      setPhase('error');
      setRecError(error instanceof Error ? error.message : 'Could not stop the recording.');
    }
  }

  const ring = (delay: number) => ({
    opacity: halo.interpolate({ inputRange: [0, 1], outputRange: [0.55 - delay, 0] }),
    transform: [{ scale: halo.interpolate({ inputRange: [0, 1], outputRange: [1 + delay, 1.7 + delay] }) }],
  });

  const caption = recording
    ? `Recording ${clock(rec.durationMillis)}`
    : phase === 'saving'
      ? 'Saving the recording…'
      : phase === 'error'
        ? recError
        : audioUri
          ? `Recorded ${clock(audioMs)}. Analyse writes this into the note.`
          : 'Tap to record. How you met, what you talked about, what you promised.';

  const playback = audioUri && !recording && phase !== 'saving' ? (
    <View style={{ flexDirection: 'row', gap: 10, justifyContent: hero ? 'center' : 'flex-start' }}>
      <Button
        theme={theme}
        kind="secondary"
        size="small"
        icon={player.playing ? 'pause.fill' : 'play.fill'}
        label={player.playing ? 'Pause' : 'Play'}
        onPress={() => { if (player.playing) player.pause(); else player.play(); }}
      />
      {onAnalyse ? <Button theme={theme} kind="ai" size="small" icon="sparkles" label="Analyse" onPress={onAnalyse} /> : null}
    </View>
  ) : null;

  if (!hero) {
    const title = recording ? 'Recording' : audioUri ? 'Voice memo' : 'Record a voice note';
    const detail = phase === 'error'
      ? recError
      : recording
        ? clock(rec.durationMillis)
        : phase === 'saving'
          ? 'Saving the recording…'
          : audioUri
            ? `${clock(audioMs)} · Analyse writes this into the note`
            : 'Say what you remember. Analyse turns it into the note.';
    return (
      <View style={{ gap: 10 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={recording ? 'Stop recording' : audioUri ? (player.playing ? 'Pause voice memo' : 'Play voice memo') : 'Start recording'}
            disabled={phase === 'saving'}
            onPress={() => {
              if (recording) void stopRecording();
              else if (audioUri) { if (player.playing) player.pause(); else player.play(); }
              else void startRecording();
            }}
            style={({ pressed }) => ({
              width: 52,
              height: 52,
              borderRadius: 26,
              backgroundColor: recording ? theme.dangerFill : theme.action,
              alignItems: 'center',
              justifyContent: 'center',
              transform: [{ scale: pressed ? 0.96 : 1 }],
            })}
          >
            {recording
              ? <View style={{ width: 18, height: 18, borderRadius: 4, backgroundColor: theme.onColor }} />
              : <Icon name={audioUri && player.playing ? 'pause.fill' : audioUri ? 'play.fill' : 'mic.fill'} color={theme.actionText} size={22} />}
          </Pressable>
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={{ color: theme.text, fontSize: 16, fontWeight: '600' }}>{title}</Text>
            <Text style={{ color: phase === 'error' ? theme.warning : theme.text3, fontSize: 13, lineHeight: 18 }}>{detail}</Text>
          </View>
        </View>
        {audioUri && !recording && phase !== 'saving' && onAnalyse ? (
          <Button theme={theme} kind="ai" size="small" icon="sparkles" label="Analyse" onPress={onAnalyse} />
        ) : null}
        {audioUri && !recording && phase !== 'saving' ? (
          <Pressable accessibilityRole="button" onPress={() => void startRecording()} hitSlop={8}>
            <Text style={{ color: theme.link, fontSize: 15, fontWeight: '600' }}>Record again</Text>
          </Pressable>
        ) : null}
      </View>
    );
  }

  return (
    <View style={{ alignItems: 'center', gap: 16, paddingVertical: 8 }}>
      {recording || audioUri ? <Text style={{ color: theme.text, fontFamily: MONO, fontSize: 44 }}>{clock(recording ? rec.durationMillis : audioMs)}</Text> : null}
      <View style={{ width: 150, height: 150, alignItems: 'center', justifyContent: 'center' }}>
        <Animated.View pointerEvents="none" style={[{ position: 'absolute', width: 88, height: 88, borderRadius: 44, borderWidth: 2, borderColor: theme.tide }, ring(0)]} />
        <Animated.View pointerEvents="none" style={[{ position: 'absolute', width: 88, height: 88, borderRadius: 44, borderWidth: 2, borderColor: theme.tide }, ring(0.25)]} />
        {!recording ? <View pointerEvents="none" style={{ position: 'absolute', width: 118, height: 118, borderRadius: 59, borderWidth: 2, borderColor: `${theme.tide}40` }} /> : null}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={recording ? 'Stop recording' : audioUri ? 'Record again' : 'Start recording'}
          disabled={phase === 'saving'}
          onPress={() => void (recording ? stopRecording() : startRecording())}
          style={({ pressed }) => ({ width: 88, height: 88, borderRadius: 44, backgroundColor: recording ? theme.dangerFill : theme.action, alignItems: 'center', justifyContent: 'center', transform: [{ scale: pressed ? 0.95 : 1 }] })}
        >
          {recording ? <View style={{ width: 28, height: 28, borderRadius: 8, backgroundColor: theme.onColor }} /> : <Icon name="mic.fill" color={theme.actionText} size={34} />}
        </Pressable>
      </View>
      <Text style={{ color: phase === 'error' ? theme.warning : theme.text2, textAlign: 'center', fontSize: 15, lineHeight: 21, maxWidth: 300 }}>{caption}</Text>
      {playback}
    </View>
  );
}
