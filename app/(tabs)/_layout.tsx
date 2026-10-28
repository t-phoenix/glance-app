import { Pressable, Text, View } from 'react-native';
import { Tabs, router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { useApp } from '@/src/state/AppContext';
import { Icon } from '@/src/ui/components';
import { badgeLabel, type Theme } from '@/src/ui/theme';

export default function TabsLayout() {
  const { theme, repo, revision } = useApp();
  const insets = useSafeAreaInsets();
  void revision;
  const overdue = badgeLabel(repo?.actions('overdue').length ?? 0);
  return (
    <Tabs
      screenOptions={{ headerShown: false, tabBarStyle: { display: 'none' } }}
      tabBar={({ state }) => (
        <View style={{ paddingBottom: insets.bottom, paddingTop: 8, paddingHorizontal: 8, backgroundColor: theme.bg, borderTopWidth: 1, borderTopColor: theme.border, flexDirection: 'row', alignItems: 'flex-start', height: 64 + insets.bottom }}>
          {(['today', 'people'] as const).map((name, index) => (
            <TabButton key={name} theme={theme} icon={name === 'today' ? 'sun.max' : 'person.2'} label={name === 'today' ? 'Today' : 'People'} active={state.index === index} onPress={() => router.navigate(name === 'today' ? '/(tabs)/today' : '/(tabs)/people')} />
          ))}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Scan a QR code"
            accessibilityHint="Hold to start Rush mode"
            onPress={() => router.push('/scan')}
            onLongPress={() => {
              if (!repo) return;
              void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              const id = repo.startHuddle(null);
              router.push({ pathname: '/scan', params: { huddle: id } });
            }}
            delayLongPress={450}
            style={({ pressed }) => ({ width: 72, height: 72, borderRadius: 24, backgroundColor: theme.action, alignItems: 'center', justifyContent: 'center', marginTop: -30, marginHorizontal: 6, borderWidth: 5, borderColor: theme.bg, transform: [{ scale: pressed ? 0.95 : 1 }] })}
          >
            <Icon name="qrcode.viewfinder" color={theme.actionText} size={30} />
          </Pressable>
          {(['followups', 'me'] as const).map((name, index) => (
            <TabButton key={name} theme={theme} icon={name === 'me' ? 'person.crop.circle' : 'checklist'} label={name === 'me' ? 'Me' : 'Follow-ups'} badge={name === 'followups' ? overdue : null} active={state.index === index + 2} onPress={() => router.navigate(name === 'me' ? '/(tabs)/me' : '/(tabs)/followups')} />
          ))}
        </View>
      )}
    >
      <Tabs.Screen name="today" options={{ title: 'Today' }} />
      <Tabs.Screen name="people" options={{ title: 'People' }} />
      <Tabs.Screen name="followups" options={{ title: 'Follow-ups' }} />
      <Tabs.Screen name="me" options={{ title: 'Me' }} />
    </Tabs>
  );
}

function TabButton({ theme, icon, label, active, onPress, badge }: { theme: Theme; icon: string; label: string; active: boolean; onPress: () => void; badge?: string | null }) {
  return (
    <Pressable
      accessibilityRole="tab"
      accessibilityState={{ selected: active }}
      accessibilityLabel={badge ? `${label}, ${badge} overdue` : label}
      onPress={onPress}
      style={{ flex: 1, minHeight: 48, alignItems: 'center', justifyContent: 'center', gap: 4 }}
    >
      <View>
        <Icon name={icon} color={active ? theme.link : theme.text3} size={21} />
        {badge ? (
          <View style={{ position: 'absolute', top: -6, right: -12, minWidth: 20, height: 20, borderRadius: 10, paddingHorizontal: 5, backgroundColor: theme.butter, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: theme.bg }}>
            <Text style={{ color: theme.onColor, fontSize: 11, fontWeight: '800' }}>{badge}</Text>
          </View>
        ) : null}
      </View>
      <Text style={{ color: active ? theme.text : theme.text3, fontSize: 12, fontWeight: active ? '700' : '500' }}>{label}</Text>
    </Pressable>
  );
}
