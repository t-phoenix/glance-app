import { useEffect, useRef, useState, type ComponentType, type Ref } from 'react';
import { Keyboard, Modal, Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import WebViewOrigin from 'react-native-webview';
import { isLinkedInProfilePhoto, linkedinProfileScript } from '@/src/services/linkedinDirectory';
import { assembleLinkedInDossier, type ProfileDossier } from '@/src/services/profileDossier';
import { storePortrait } from '@/src/services/portraitCache';
import { getSecret, SECRET, setSecret } from '@/src/services/secrets';
import { Button } from '@/src/ui/components';
import type { Theme } from '@/src/ui/theme';

const SAFARI = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1';

type WebHandle = { injectJavaScript: (script: string) => void };
type WebMessage = { nativeEvent: { data: string } };
type ProfileMessage = { slug?: string; login?: boolean; payloads?: unknown[]; html?: string; faces?: string[] };
type WebLoad = { nativeEvent: { url: string } };

const ProfileWebView = WebViewOrigin as unknown as ComponentType<{
  ref?: Ref<WebHandle | null>;
  source: { uri: string };
  style?: { flex?: number; width?: number; height?: number };
  userAgent?: string;
  sharedCookiesEnabled?: boolean;
  thirdPartyCookiesEnabled?: boolean;
  domStorageEnabled?: boolean;
  incognito?: boolean;
  cacheEnabled?: boolean;
  setSupportMultipleWindows?: boolean;
  onLoadEnd?: (event: WebLoad) => void;
  onNavigationStateChange?: (event: { url?: string; loading?: boolean }) => void;
  onMessage?: (event: WebMessage) => void;
  onError?: () => void;
}>;

/** Loads one LinkedIn profile through the signed-in page. Shows sign-in when the session is missing. */
export function LinkedInProfileFetch({ theme, slug, knownPhoto = '', onDossier, quiet = false }: { theme: Theme; slug: string; knownPhoto?: string; onDossier: (dossier: ProfileDossier) => void; quiet?: boolean }) {
  const insets = useSafeAreaInsets();
  const web = useRef<WebHandle>(null);
  const [session, setSession] = useState<'unknown' | 'in' | 'out'>('unknown');
  const [loginOpen, setLoginOpen] = useState(false);
  const slugRef = useRef(slug);
  const report = useRef(onDossier);
  const pending = useRef<ProfileDossier | null>(null);
  const knownRef = useRef(knownPhoto);
  slugRef.current = slug;
  knownRef.current = knownPhoto;
  report.current = onDossier;

  useEffect(() => {
    let alive = true;
    void getSecret(SECRET.linkedin).then((value) => {
      if (alive) setSession(value === '1' ? 'in' : 'out');
    });
    return () => {
      alive = false;
    };
  }, []);

  const read = (event: WebMessage) => {
    let message: ProfileMessage;
    try {
      message = JSON.parse(event.nativeEvent.data) as ProfileMessage;
    } catch {
      return;
    }
    if (message.slug && message.slug !== slugRef.current) return;
    if (message.login) {
      void setSecret(SECRET.linkedin, '');
      setSession('out');
      return;
    }
    if (!message.payloads) return;
    const page = [typeof message.html === 'string' ? message.html : '', ...(Array.isArray(message.faces) ? message.faces : [])].join('\n');
    const dossier = assembleLinkedInDossier(slugRef.current, message.payloads, page);
    if (!dossier) return;
    void setSecret(SECRET.linkedin, '1');
    setSession('in');
    pending.current = dossier;
    const known = knownRef.current && isLinkedInProfilePhoto(knownRef.current) ? knownRef.current : null;
    const member = dossier.photo && isLinkedInProfilePhoto(dossier.photo) ? dossier.photo : null;
    const address = known || member;
    report.current(known ? { ...dossier, photo: null } : dossier);
    if (!address) return;
    void storePortrait(slugRef.current, address).then((uri) => {
      if (!uri || pending.current !== dossier) return;
      report.current({ ...dossier, photo: uri, photoSource: 'profile' });
    });
  }

  return (
    <View style={{ gap: 8 }}>
      {session === 'out' && !quiet ? (
        <Button theme={theme} kind="secondary" icon="person.crop.circle" label="Sign in to LinkedIn" onPress={() => { Keyboard.dismiss(); setLoginOpen(true); }} />
      ) : null}
      <Modal visible={loginOpen} animationType="slide" presentationStyle="fullScreen" onRequestClose={() => setLoginOpen(false)}>
        <View style={{ flex: 1, backgroundColor: theme.bg, paddingTop: insets.top }}>
          <View style={{ height: 56, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center' }}>
            <Pressable accessibilityLabel="Close LinkedIn sign in" onPress={() => setLoginOpen(false)} style={{ minWidth: 64, minHeight: 44, justifyContent: 'center' }}>
              <Text style={{ color: theme.link, fontSize: 17, fontWeight: '600' }}>Close</Text>
            </Pressable>
            <Text style={{ flex: 1, textAlign: 'center', color: theme.text, fontFamily: 'BricolageGrotesque_700Bold', fontSize: 18 }}>LinkedIn</Text>
            <View style={{ minWidth: 64 }} />
          </View>
          <ProfileWebView
            style={{ flex: 1 }}
            source={{ uri: 'https://www.linkedin.com/login' }}
            userAgent={SAFARI}
            sharedCookiesEnabled
            thirdPartyCookiesEnabled
            domStorageEnabled
            incognito={false}
            cacheEnabled
            setSupportMultipleWindows={false}
            onNavigationStateChange={(event) => {
              const url = event.url || '';
              if (event.loading) return;
              if (/linkedin\.com\/(feed|mynetwork|search\/results|in)\b/i.test(url) && !/login|authwall|checkpoint|uas\/login/i.test(url)) {
                void setSecret(SECRET.linkedin, '1');
                setSession('in');
                setLoginOpen(false);
              }
            }}
          />
        </View>
      </Modal>
      {session === 'in' ? (
        <View pointerEvents="none" style={{ position: 'absolute', top: -1600, left: 0, width: 390, height: 700, opacity: 0 }}>
          <ProfileWebView
            ref={web}
            style={{ width: 390, height: 700 }}
            key={slug}
            source={{ uri: `https://www.linkedin.com/in/${encodeURIComponent(slug)}/` }}
            userAgent={SAFARI}
            sharedCookiesEnabled
            thirdPartyCookiesEnabled
            domStorageEnabled
            incognito={false}
            cacheEnabled={false}
            setSupportMultipleWindows={false}
            onLoadEnd={(event) => {
              const url = event.nativeEvent.url || '';
              if (/login|authwall|checkpoint|uas\/login/i.test(url)) {
                void setSecret(SECRET.linkedin, '');
                setSession('out');
                return;
              }
              web.current?.injectJavaScript(linkedinProfileScript(slugRef.current));
            }}
            onMessage={read}
          />
        </View>
      ) : null}
    </View>
  );
}
