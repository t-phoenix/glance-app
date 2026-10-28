import { useEffect, useRef, useState, type ComponentType, type Ref } from 'react';
import { Keyboard, Modal, Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import WebViewOrigin from 'react-native-webview';
import type { AccountCard } from '@/src/services/accountSearch';
import { profileUrl } from '@/src/services/followupLinks';
import { fetchPublicProfile } from '@/src/services/profiles';
import { telegramExtractScript, telegramPeopleFromRows, whatsAppContactsFromRows, whatsAppExtractScript } from '@/src/services/registrySearch';
import { getSecret, SECRET, setSecret } from '@/src/services/secrets';
import { Button } from '@/src/ui/components';
import type { Theme } from '@/src/ui/theme';

const SAFARI = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1';

type Kind = 'telegram' | 'whatsapp';
type WebHandle = { injectJavaScript: (script: string) => void };
type WebMessage = { nativeEvent: { data: string } };

const SearchWebView = WebViewOrigin as unknown as ComponentType<{
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
  onLoadEnd?: () => void;
  onMessage?: (event: WebMessage) => void;
  onError?: () => void;
}>;

const SETUP = {
  telegram: {
    secret: SECRET.telegram,
    loginUrl: 'https://web.telegram.org/a/',
    homeUrl: 'https://web.telegram.org/a/',
    title: 'Telegram',
    button: 'Sign in to Telegram',
    note: 'Sign in once. A name searches Telegram’s public usernames, with the photo and bio from that profile.',
  },
  whatsapp: {
    secret: SECRET.whatsapp,
    loginUrl: 'https://web.whatsapp.com/',
    homeUrl: 'https://web.whatsapp.com/',
    title: 'WhatsApp',
    button: 'Link WhatsApp',
    note: 'Link WhatsApp once. A name searches the contacts on that account. A phone number looks up that chat. WhatsApp does not publish a public name directory.',
  },
} as const;

export function AccountRegistry({
  kind,
  theme,
  query,
  onPeople,
  onSettled,
}: {
  kind: Kind;
  theme: Theme;
  query: string;
  onPeople: (people: AccountCard[]) => void;
  onSettled: () => void;
}) {
  const setup = SETUP[kind];
  const insets = useSafeAreaInsets();
  const web = useRef<WebHandle>(null);
  const loginWeb = useRef<WebHandle>(null);
  const [session, setSession] = useState<'unknown' | 'in' | 'out'>('unknown');
  const [loginOpen, setLoginOpen] = useState(false);
  const queryRef = useRef(query);
  const peopleRef = useRef(onPeople);
  const settled = useRef(onSettled);
  const generation = useRef(0);
  queryRef.current = query;
  peopleRef.current = onPeople;
  settled.current = onSettled;

  useEffect(() => {
    let alive = true;
    void getSecret(setup.secret).then((value) => {
      if (alive) setSession(value === '1' ? 'in' : 'out');
    });
    return () => {
      alive = false;
    };
  }, [setup.secret]);

  useEffect(() => {
    generation.current += 1;
    if (session === 'out') settled.current();
    if (session !== 'in' || query.trim().length < 2) return;
    const script = kind === 'telegram' ? telegramExtractScript(query) : whatsAppExtractScript(query);
    const timer = setTimeout(() => web.current?.injectJavaScript(script), 400);
    const giveUp = setTimeout(() => settled.current(), 12000);
    return () => {
      clearTimeout(timer);
      clearTimeout(giveUp);
    };
  }, [kind, query, session]);

  const read = (event: WebMessage) => {
    let message: { query?: string; login?: boolean; rows?: { title: string; subtitle: string }[]; contacts?: { name: string; id: string }[] };
    try {
      message = JSON.parse(event.nativeEvent.data) as typeof message;
    } catch {
      return;
    }
    if (message.query && message.query !== queryRef.current) return;
    if (message.login) {
      void setSecret(setup.secret, '');
      setSession('out');
      settled.current();
      return;
    }
    const mine = generation.current;
    const people = kind === 'telegram'
      ? telegramPeopleFromRows(message.rows ?? []).map((person) => ({
        platform: 'telegram' as const,
        value: person.value,
        url: profileUrl('telegram', person.value),
        displayName: person.displayName,
        bio: person.bio,
        avatarUrl: null,
      }))
      : whatsAppContactsFromRows(message.contacts ?? []).filter((person) => {
        const words = queryRef.current.toLowerCase().split(/\s+/).filter((word) => word.length > 1);
        const haystack = `${person.displayName} ${person.value}`.toLowerCase();
        return words.length === 0 || words.every((word) => haystack.includes(word.replace(/[^\d]/g, '') || word));
      }).map((person) => ({
        platform: 'whatsapp' as const,
        value: person.value,
        url: profileUrl('whatsapp', person.value),
        displayName: person.displayName,
        bio: 'From your linked WhatsApp contacts.',
        avatarUrl: null,
      }));
    if (!people.length) {
      settled.current();
      return;
    }
    void setSecret(setup.secret, '1');
    setSession('in');
    peopleRef.current(people);
    settled.current();
    if (kind !== 'telegram') return;
    void Promise.all(people.map(async (card) => {
      try {
        const profile = await fetchPublicProfile('telegram', card.value);
        if (!profile) return card;
        return { ...card, displayName: card.displayName || profile.displayName, bio: profile.bio || card.bio, avatarUrl: profile.avatarUrl };
      } catch {
        return card;
      }
    })).then((next) => {
      if (generation.current === mine) peopleRef.current(next);
    });
  };

  return (
    <View style={{ gap: 8 }}>
      <Text style={{ color: theme.text3 }}>{setup.note}</Text>
      {session === 'out' ? <Button theme={theme} label={setup.button} onPress={() => { Keyboard.dismiss(); setLoginOpen(true); }} /> : null}
      <Modal visible={loginOpen} animationType="slide" presentationStyle="fullScreen" onRequestClose={() => setLoginOpen(false)}>
        <View style={{ flex: 1, backgroundColor: theme.bg, paddingTop: insets.top }}>
          <View style={{ height: 56, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center' }}>
            <Pressable accessibilityLabel={`Close ${setup.title} sign in`} onPress={() => setLoginOpen(false)} style={{ minWidth: 64, minHeight: 44, justifyContent: 'center' }}>
              <Text style={{ color: theme.link, fontSize: 17, fontWeight: "600" }}>Close</Text>
            </Pressable>
            <Text style={{ flex: 1, textAlign: 'center', color: theme.text, fontFamily: 'BricolageGrotesque_700Bold', fontSize: 18 }}>{setup.title}</Text>
            <View style={{ minWidth: 64 }} />
          </View>
          <SearchWebView
            ref={loginWeb}
            style={{ flex: 1 }}
            source={{ uri: setup.loginUrl }}
            userAgent={SAFARI}
            sharedCookiesEnabled
            thirdPartyCookiesEnabled
            domStorageEnabled
            incognito={false}
            cacheEnabled
            setSupportMultipleWindows={false}
            onMessage={(event) => {
              if (event.nativeEvent.data !== 'ready') return;
              void setSecret(setup.secret, '1');
              setSession('in');
              setLoginOpen(false);
            }}
            onLoadEnd={() => {
              loginWeb.current?.injectJavaScript(`(function () {
                var ready = ${kind === 'telegram'
                  ? "!!document.querySelector('#telegram-search-input, .input-search input')"
                  : "!!(document.querySelector('#pane-side') || document.querySelector('#side'))"};
                if (ready && window.ReactNativeWebView) window.ReactNativeWebView.postMessage('ready');
              })(); true;`);
            }}
          />
        </View>
      </Modal>
      {session === 'in' && query.trim().length >= 2 ? (
        <View pointerEvents="none" style={{ position: 'absolute', top: -1600, left: 0, width: 390, height: 700, opacity: 0 }}>
          <SearchWebView
            ref={web}
            style={{ width: 390, height: 700 }}
            source={{ uri: setup.homeUrl }}
            userAgent={SAFARI}
            sharedCookiesEnabled
            thirdPartyCookiesEnabled
            domStorageEnabled
            incognito={false}
            cacheEnabled
            setSupportMultipleWindows={false}
            onLoadEnd={() => {
              const script = kind === 'telegram' ? telegramExtractScript(queryRef.current) : whatsAppExtractScript(queryRef.current);
              web.current?.injectJavaScript(script);
            }}
            onMessage={read}
            onError={() => settled.current()}
          />
        </View>
      ) : null}
    </View>
  );
}
