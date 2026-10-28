import { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, KeyboardAvoidingView, Text, View } from 'react-native';
import { Button, DISPLAY, Field, GlanceMark, Icon } from '@/src/ui/components';
import { useApp, type UnlockResult } from '@/src/state/AppContext';
import type { Theme } from '@/src/ui/theme';

// the people Glance remembers: pastel bubbles around the mark, offsets from the centre of a 320 box
const BUBBLES = [
  { x: -112, y: -78, size: 30, tone: 'harbor' as const, drift: 2600 },
  { x: 104, y: -104, size: 18, tone: 'butter' as const, drift: 3100 },
  { x: 126, y: 30, size: 36, tone: 'sea' as const, drift: 2900 },
  { x: -128, y: 46, size: 16, tone: 'dusk' as const, drift: 3400 },
  { x: -36, y: -134, size: 12, tone: 'glacier' as const, drift: 2400 },
  { x: 58, y: 118, size: 22, tone: 'dusk' as const, drift: 3200 },
  { x: -70, y: 112, size: 26, tone: 'butter' as const, drift: 2800 },
];

/**
 * Replaces the bare Unlock screen: Glance looks around as the people it remembers pop in, while Face ID runs on its own.
 * With no lock set it just plays and opens. A password field or a retry button appears only if Face ID does not unlock.
 */
export function Launch({ theme, unlock }: { theme: Theme; unlock: () => Promise<UnlockResult> }) {
  const { enterPassword, lock } = useApp();
  const [state, setState] = useState<'waiting' | UnlockResult>('waiting');
  const [busy, setBusy] = useState(false);
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const pops = useRef(BUBBLES.map(() => new Animated.Value(0))).current;
  const drifts = useRef(BUBBLES.map(() => new Animated.Value(0))).current;
  const rise = useRef(new Animated.Value(0)).current;
  const tried = useRef(false);

  async function attempt() {
    if (busy) return;
    setBusy(true);
    try {
      setState(await unlock());
    } catch {
      setState(lock.passcode ? 'password' : 'retry');
    } finally {
      setBusy(false);
    }
  }

  async function submit() {
    if (!password || busy) return;
    setBusy(true);
    const problem = await enterPassword(password);
    setBusy(false);
    if (problem) {
      setError(problem);
      setPassword('');
    }
  }

  useEffect(() => {
    const loops: Animated.CompositeAnimation[] = [];
    void AccessibilityInfo.isReduceMotionEnabled().then((reduce) => {
      if (reduce) {
        rise.setValue(1);
        pops.forEach((pop) => pop.setValue(1));
        return;
      }
      Animated.timing(rise, { toValue: 1, duration: 900, delay: 200, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
      Animated.stagger(140, pops.map((pop) => Animated.spring(pop, { toValue: 1, friction: 5, tension: 120, useNativeDriver: true }))).start();
      BUBBLES.forEach((bubble, index) => {
        const drift = drifts[index]!;
        const loop = Animated.loop(Animated.sequence([
          Animated.timing(drift, { toValue: 1, duration: bubble.drift, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
          Animated.timing(drift, { toValue: 0, duration: bubble.drift, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        ]));
        loops.push(loop);
        loop.start();
      });
    });
    // give the animation a beat before the system Face ID sheet covers it
    const timer = setTimeout(() => {
      if (tried.current) return;
      tried.current = true;
      void attempt();
    }, 650);
    return () => {
      clearTimeout(timer);
      loops.forEach((loop) => loop.stop());
    };
  }, []);

  const lift = rise.interpolate({ inputRange: [0, 1], outputRange: [18, 0] });
  return (
    <View style={{ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, backgroundColor: theme.bg, alignItems: 'center', justifyContent: 'center' }}>
      <View style={{ width: 320, height: 320, alignItems: 'center', justifyContent: 'center' }}>
        {BUBBLES.map((bubble, index) => (
          <Animated.View
            key={`${bubble.x},${bubble.y}`}
            style={{
              position: 'absolute',
              left: 160 + bubble.x - bubble.size / 2,
              top: 160 + bubble.y - bubble.size / 2,
              width: bubble.size,
              height: bubble.size,
              borderRadius: bubble.size / 2,
              backgroundColor: theme[bubble.tone],
              opacity: pops[index]!.interpolate({ inputRange: [0, 0.3, 1], outputRange: [0, 1, 1] }),
              transform: [
                { translateY: drifts[index]!.interpolate({ inputRange: [0, 1], outputRange: [-5, 5] }) },
                { scale: pops[index]! },
              ],
            }}
          />
        ))}
        <GlanceMark size={132} color={theme.tide} eye={theme.onColor} animated />
      </View>
      <Animated.View style={{ alignItems: 'center', gap: 6, opacity: rise, transform: [{ translateY: lift }] }}>
        <Text accessibilityRole="header" style={{ color: theme.text, fontFamily: DISPLAY, fontSize: 64, letterSpacing: -3 }}>
          glance<Text style={{ color: theme.sea }}>.</Text>
        </Text>
        <Text style={{ color: theme.text2, fontSize: 17, textAlign: 'center' }}>Glance today, know them tomorrow.</Text>
      </Animated.View>
      <KeyboardAvoidingView behavior="padding" style={{ position: 'absolute', bottom: 0, left: 0, right: 0, paddingBottom: 56, paddingHorizontal: 24, alignItems: 'center', gap: 12 }}>
        {state === 'password' ? (
          <View style={{ alignSelf: 'stretch', gap: 10 }}>
            <Field
              theme={theme}
              value={password}
              onChangeText={(value) => { setPassword(value); setError(null); }}
              onSubmitEditing={() => void submit()}
              placeholder="App password"
              accessibilityLabel="App password"
              secureTextEntry
              autoFocus
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="go"
            />
            {error ? <Text accessibilityLiveRegion="polite" style={{ color: theme.danger, fontSize: 14 }}>{error}</Text> : null}
            <View style={{ flexDirection: 'row', gap: 8 }}>
              {lock.face ? <Button theme={theme} kind="secondary" icon="faceid" label="Face ID" accessibilityLabel="Try Face ID again" onPress={() => void attempt()} /> : null}
              <Button theme={theme} label="Unlock" icon="lock.open" accessibilityLabel="Unlock Glance" disabled={!password || busy} onPress={() => void submit()} style={{ flex: 1 }} />
            </View>
          </View>
        ) : state === 'retry' && !busy ? (
          <Button theme={theme} label="Unlock" icon="faceid" accessibilityLabel="Unlock Glance" onPress={() => void attempt()} style={{ alignSelf: 'stretch' }} />
        ) : lock.face || lock.passcode ? (
          <View style={{ alignItems: 'center', gap: 8 }}>
            <Icon name={lock.face ? 'faceid' : 'lock'} color={theme.text3} size={28} />
            <Text style={{ color: theme.text3, fontSize: 13 }}>{lock.face ? 'Unlocking with Face ID' : 'Locked'}</Text>
          </View>
        ) : null}
      </KeyboardAvoidingView>
    </View>
  );
}
