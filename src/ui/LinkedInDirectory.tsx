import { useEffect, useRef, useState, type ComponentType, type Ref } from 'react';
import { Keyboard, Modal, Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import WebViewOrigin from 'react-native-webview';
import type { AccountCard } from '@/src/services/accountSearch';
import { isLinkedInProfilePhoto, linkedinExtractScript, linkedinPeopleFromHtml, linkedinPeopleFromPayload, type LinkedInPerson } from '@/src/services/linkedinDirectory';
import { profileUrl } from '@/src/services/followupLinks';
import { getSecret, SECRET, setSecret } from '@/src/services/secrets';
import { Button } from '@/src/ui/components';
import type { Theme } from '@/src/ui/theme';

const SAFARI = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1';

type WebHandle = { injectJavaScript: (script: string) => void };
type WebMessage = { nativeEvent: { data: string } };
type WebLoad = { nativeEvent: { url: string } };

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
  onLoadEnd?: (event: WebLoad) => void;
  onNavigationStateChange?: (event: { url?: string; loading?: boolean }) => void;
  onMessage?: (event: WebMessage) => void;
  onError?: () => void;
}>;

function cardsFrom(people: LinkedInPerson[]): AccountCard[] {
  return people.slice(0, 20).map((person) => ({
    platform: 'linkedin' as const,
    value: person.value,
    url: profileUrl('linkedin', person.value),
    displayName: person.displayName,
    bio: person.bio,
    avatarUrl: isLinkedInProfilePhoto(person.avatarUrl) ? person.avatarUrl : null,
  }));
}

function mergePeople(groups: LinkedInPerson[][]): LinkedInPerson[] {
  const map = new Map<string, LinkedInPerson>();
  for (const group of groups) {
    for (const person of group) {
      const key = person.value.toLowerCase();
      const previous = map.get(key);
      if (!previous) {
        map.set(key, person);
        continue;
      }
      map.set(key, {
        value: previous.value,
        displayName: previous.displayName || person.displayName,
        bio: previous.bio || person.bio,
        avatarUrl: isLinkedInProfilePhoto(previous.avatarUrl) ? previous.avatarUrl : person.avatarUrl,
      });
    }
  }
  return [...map.values()].slice(0, 20);
}

export function LinkedInDirectory({
  theme,
  query,
  onPeople,
  onSettled,
}: {
  theme: Theme;
  query: string;
  onPeople: (people: AccountCard[]) => void;
  onSettled: (login: boolean) => void;
}) {
  const insets = useSafeAreaInsets();
  const web = useRef<WebHandle>(null);
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
    void getSecret(SECRET.linkedin).then((value) => {
      if (alive) setSession(value === '1' ? 'in' : 'out');
    });
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    generation.current += 1;
    if (session === 'out') settled.current(true);
    const current = query.trim();
    if (session !== 'in' || current.length < 2) return;
    const timer = setTimeout(() => web.current?.injectJavaScript(linkedinExtractScript(current)), 60);
    const giveUp = setTimeout(() => settled.current(true), 12000);
    return () => {
      clearTimeout(timer);
      clearTimeout(giveUp);
    };
  }, [query, session]);

  const publish = (people: LinkedInPerson[]) => {
    const mine = generation.current;
    const cards = cardsFrom(people);
    if (!cards.length) return;
    if (generation.current !== mine) return;
    peopleRef.current(cards);
    settled.current(false);
  };

  const read = (event: WebMessage) => {
    let message: { query?: string; html?: string; body?: string; people?: LinkedInPerson[]; login?: boolean; status?: number };
    try {
      message = JSON.parse(event.nativeEvent.data) as typeof message;
    } catch {
      return;
    }
    if (message.query && message.query !== queryRef.current) return;
    const login = Boolean(message.login) || message.status === 401 || message.status === 403;
    let fromApi: LinkedInPerson[] = [];
    if (typeof message.body === 'string' && message.body.startsWith('{')) {
      try {
        fromApi = linkedinPeopleFromPayload(JSON.parse(message.body) as unknown);
      } catch {
        fromApi = [];
      }
    }
    const people = mergePeople([
      Array.isArray(message.people) ? message.people : [],
      fromApi,
      typeof message.html === 'string' ? linkedinPeopleFromHtml(message.html) : [],
    ]);
    if (people.length) {
      void setSecret(SECRET.linkedin, '1');
      setSession('in');
      publish(people);
      return;
    }
    if (login) {
      void setSecret(SECRET.linkedin, '');
      setSession('out');
      settled.current(true);
    }
  };

  const search = () => {
    const current = queryRef.current.trim();
    if (current.length < 2) return;
    web.current?.injectJavaScript(linkedinExtractScript(current));
  };

  return (
    <View style={{ gap: 8 }}>
      {session === 'out' ? (
        <Button theme={theme} label="Sign in to LinkedIn" onPress={() => { Keyboard.dismiss(); setLoginOpen(true); }} />
      ) : null}
      <Modal visible={loginOpen} animationType="slide" presentationStyle="fullScreen" onRequestClose={() => setLoginOpen(false)}>
        <View style={{ flex: 1, backgroundColor: theme.bg, paddingTop: insets.top }}>
          <View style={{ height: 56, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center' }}>
            <Pressable accessibilityLabel="Close LinkedIn sign in" onPress={() => setLoginOpen(false)} style={{ minWidth: 64, minHeight: 44, justifyContent: 'center' }}>
              <Text style={{ color: theme.link, fontSize: 17, fontWeight: "600" }}>Close</Text>
            </Pressable>
            <Text style={{ flex: 1, textAlign: 'center', color: theme.text, fontFamily: 'BricolageGrotesque_700Bold', fontSize: 18 }}>LinkedIn</Text>
            <View style={{ minWidth: 64 }} />
          </View>
          <SearchWebView
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
              if (/linkedin\.com\/(feed|mynetwork|search\/results)(\/|$|\?)/i.test(url) && !/login|authwall|checkpoint|uas\/login/i.test(url)) {
                void setSecret(SECRET.linkedin, '1');
                setSession('in');
                setLoginOpen(false);
              }
            }}
          />
        </View>
      </Modal>
      {session === 'in' && query.trim().length >= 2 ? (
        <View pointerEvents="none" style={{ position: 'absolute', top: -1600, left: 0, width: 390, height: 700, opacity: 0 }}>
          <SearchWebView
            ref={web}
            style={{ width: 390, height: 700 }}
            source={{ uri: 'https://www.linkedin.com/feed/' }}
            userAgent={SAFARI}
            sharedCookiesEnabled
            thirdPartyCookiesEnabled
            domStorageEnabled
            incognito={false}
            cacheEnabled
            setSupportMultipleWindows={false}
            onLoadEnd={(event) => {
              const url = event.nativeEvent.url || '';
              if (/login|authwall|checkpoint|uas\/login/i.test(url)) {
                void setSecret(SECRET.linkedin, '');
                setSession('out');
                settled.current(true);
                return;
              }
              search();
            }}
            onMessage={read}
            onError={() => settled.current(true)}
          />
        </View>
      ) : null}
    </View>
  );
}
