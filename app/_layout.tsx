import 'react-native-get-random-values';
import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useFonts, BricolageGrotesque_700Bold } from '@expo-google-fonts/bricolage-grotesque';
import { JetBrainsMono_500Medium } from '@expo-google-fonts/jetbrains-mono';
import * as SplashScreen from 'expo-splash-screen';
import { AppProvider, useApp } from '@/src/state/AppContext';
import { DISPLAY, Toast } from '@/src/ui/components';
import { Launch } from '@/src/ui/Launch';

SplashScreen.preventAutoHideAsync().catch(() => undefined);

function Root() {
  const { theme, themeName, locked, unlock, toast } = useApp();
  const [loaded] = useFonts({ BricolageGrotesque_700Bold, JetBrainsMono_500Medium });
  useEffect(() => {
    if (loaded) SplashScreen.hideAsync().catch(() => undefined);
  }, [loaded]);
  if (!loaded) return null;
  return (
    <>
      <StatusBar style={themeName === 'dark' ? 'light' : 'dark'} />
      <Stack screenOptions={{ headerStyle: { backgroundColor: theme.bg }, headerTintColor: theme.link, headerTitleStyle: { color: theme.text, fontFamily: DISPLAY, fontSize: 18 }, headerShadowVisible: false, headerBackButtonDisplayMode: 'minimal', contentStyle: { backgroundColor: theme.bg } }}>
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="scan" options={{ headerShown: false, presentation: 'fullScreenModal' }} />
        <Stack.Screen name="profile-confirm" options={{ title: 'Confirm', headerBackVisible: false }} />
        <Stack.Screen name="capture/[personId]" options={{ title: 'Note' }} />
        <Stack.Screen name="review/[encounterId]" options={{ title: 'Review' }} />
        <Stack.Screen name="person/[id]" options={{ title: 'Person' }} />
        <Stack.Screen name="identity/[personId]" options={{ title: 'Account' }} />
        <Stack.Screen name="huddle/[id]" options={{ title: 'Huddle' }} />
        <Stack.Screen name="wallet" options={{ title: 'Wallet' }} />
        <Stack.Screen name="settings" options={{ title: 'Settings' }} />
        <Stack.Screen name="recap" options={{ title: 'Recap' }} />
      </Stack>
      {toast ? <Toast theme={theme} text={toast} /> : null}
      {locked ? <Launch theme={theme} unlock={unlock} /> : null}
    </>
  );
}

export default function Layout() {
  return (
    <SafeAreaProvider>
      <AppProvider>
        <Root />
      </AppProvider>
    </SafeAreaProvider>
  );
}
