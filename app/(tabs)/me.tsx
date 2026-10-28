import { memo, useMemo, useRef, useState } from 'react';
import { Animated, KeyboardAvoidingView, LayoutAnimation, Modal, Platform, Pressable, ScrollView, Text, View, useWindowDimensions } from 'react-native';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useApp } from '@/src/state/AppContext';
import { Button, Field, Icon, Label, List, ListItem, PlatformMark, Screen, SheetFrame, Title, platformName } from '@/src/ui/components';
import { QrMark } from '@/src/ui/QrMark';
import { OWN_PLATFORMS, parseOwnLink, type OwnPlatform } from '@/src/services/ownLink';

interface MyLink {
  platform: OwnPlatform;
  value: string;
  url: string;
}

function readLinks(raw: string): MyLink[] {
  try {
    const parsed = JSON.parse(raw) as Partial<MyLink>[];
    if (!Array.isArray(parsed)) return [];
    const links: MyLink[] = [];
    for (const item of parsed) {
      if (!item?.platform || !item.value || !OWN_PLATFORMS.includes(item.platform)) continue;
      const rebuilt = item.platform === 'web' ? null : parseOwnLink(item.platform, item.value);
      const href = item.url || (rebuilt && rebuilt.ok ? rebuilt.url : '');
      if (!href) continue;
      links.push({ platform: item.platform, value: item.value, url: href });
    }
    return links;
  } catch {
    return [];
  }
}

function fieldHint(platform: OwnPlatform): string {
  if (platform === 'x') return 'https://x.com/you or @handle';
  if (platform === 'linkedin') return 'https://linkedin.com/in/you';
  if (platform === 'telegram') return 'https://t.me/you or @username';
  if (platform === 'github') return 'https://github.com/you';
  if (platform === 'whatsapp') return 'Phone with country code, or wa.me link';
  return 'https://yoursite.com';
}

export default function MeScreen() {
  const { theme, repo, revision, bump, showToast } = useApp();
  const insets = useSafeAreaInsets();
  const [platform, setPlatform] = useState<OwnPlatform>('x');
  const [handle, setHandle] = useState('');
  const [linkName, setLinkName] = useState('');
  const [selected, setSelected] = useState(0);
  const [adding, setAdding] = useState(false);
  void revision;
  const spent = repo?.spentToday() ?? 0;
  const cap = repo?.dailyCap() ?? 2;
  const watch = repo?.watchlist() ?? [];
  const links = readLinks(repo?.setting('my_links', '[]') ?? '[]');
  const shown = Math.min(selected, Math.max(links.length - 1, 0));
  const page = useWindowDimensions().width - 32;
  const scrollX = useRef(new Animated.Value(0)).current;
  const pager = useRef<React.ComponentRef<typeof ScrollView>>(null);
  // set while the code scrolls the pager itself, so passing cards don't flip the selection or tick haptics
  const target = useRef<number | null>(null);
  const live = useRef(0);
  live.current = shown;
  const count = useRef(0);
  count.current = links.length;

  function go(index: number) {
    target.current = index;
    setSelected(index);
    pager.current?.scrollTo({ x: index * page, animated: true });
  }

  // the scroll position drives the cards on the native thread; JS only hears about it to move the selection
  const onScroll = useMemo(() => Animated.event([{ nativeEvent: { contentOffset: { x: scrollX } } }], {
    useNativeDriver: true,
    listener: (event: { nativeEvent: { contentOffset: { x: number } } }) => {
      const index = Math.max(0, Math.min(count.current - 1, Math.round(event.nativeEvent.contentOffset.x / page)));
      if (target.current !== null) {
        if (index === target.current) target.current = null;
        return;
      }
      if (index === live.current) return;
      live.current = index;
      LayoutAnimation.configureNext(LayoutAnimation.create(180, 'easeInEaseOut', 'scaleX'));
      setSelected(index);
      void Haptics.selectionAsync();
    },
  }), [page, scrollX]);

  function save(next: MyLink[]) {
    repo?.setSetting('my_links', JSON.stringify(next));
    bump();
  }

  function add() {
    const checked = parseOwnLink(platform, handle, linkName);
    if (!checked.ok) { showToast(checked.reason); return; }
    const next = links.filter((item) => item.url !== checked.url);
    next.push({ platform, value: checked.value, url: checked.url });
    save(next);
    // the new card isn't laid out yet; onContentSizeChange scrolls to it once it is
    target.current = next.length - 1;
    setSelected(next.length - 1);
    setHandle('');
    setLinkName('');
    setAdding(false);
  }

  return (
    <Screen theme={theme}>
      <ScrollView contentContainerStyle={{ paddingTop: insets.top + 16, paddingHorizontal: 16, paddingBottom: 140, gap: 14 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <Title theme={theme}>Me</Title>
          <Button theme={theme} kind="secondary" size="small" icon="plus" label="Add a link" onPress={() => setAdding(true)} />
        </View>
        {links.length > 0 ? (
          <Animated.ScrollView
            ref={pager}
            horizontal
            showsHorizontalScrollIndicator={false}
            accessibilityHint={links.length > 1 ? 'Swipe left or right to switch codes' : undefined}
            scrollEventThrottle={16}
            onScroll={onScroll}
            onScrollBeginDrag={() => { target.current = null; }}
            onContentSizeChange={() => { if (target.current !== null) pager.current?.scrollTo({ x: target.current * page, animated: true }); }}
            style={{ marginHorizontal: -16, flexGrow: 0 }}
            contentContainerStyle={{ paddingHorizontal: 16 }}
            snapToInterval={page}
            snapToAlignment="start"
            decelerationRate="fast"
            disableIntervalMomentum
          >
            {links.map((item, index) => <QrCard key={`${item.platform}:${item.url}`} item={item} index={index} page={page} scrollX={scrollX} frame={theme.tide} />)}
          </Animated.ScrollView>
        ) : (
          <Pressable accessibilityRole="button" accessibilityLabel="Add a link" onPress={() => setAdding(true)} style={{ borderRadius: 30, borderWidth: 2, borderStyle: 'dashed', borderColor: theme.border, padding: 28, alignItems: 'center', gap: 10 }}>
            <Icon name="qrcode" color={theme.text3} size={40} />
            <Text style={{ color: theme.text, fontSize: 17, fontWeight: '600' }}>No code yet</Text>
            <Text style={{ color: theme.text2, textAlign: 'center' }}>Add a link and Glance makes a QR people can scan.</Text>
          </Pressable>
        )}
        {links.length > 1 ? (
          <View style={{ flexDirection: 'row', gap: 6, justifyContent: 'center' }}>
            {links.map((item, index) => (
              <Pressable key={item.url} accessibilityRole="button" accessibilityLabel={`Show code ${index + 1} of ${links.length}`} hitSlop={8} onPress={() => go(index)}>
                <View style={{ height: 6, borderRadius: 3, backgroundColor: theme.text, width: index === shown ? 22 : 6, opacity: index === shown ? 1 : 0.3 }} />
              </Pressable>
            ))}
          </View>
        ) : null}
        {links.length > 0 ? <Label theme={theme}>Your links · swipe the code or tap one</Label> : null}
        {links.length > 0 ? (
          <List theme={theme}>
            {links.map((item, index) => (
              <Pressable key={`${item.platform}:${item.url}`} accessibilityRole="button" accessibilityState={{ selected: index === shown }} accessibilityLabel={`Show code for ${item.platform === 'web' ? item.value : platformName(item.platform)}`} onPress={() => go(index)} style={{ flexDirection: 'row', gap: 12, alignItems: 'center', minHeight: 60, borderBottomWidth: index === links.length - 1 ? 0 : 0.5, borderBottomColor: theme.border }}>
                <PlatformMark platform={item.platform} size={34} />
                <View style={{ flex: 1 }}>
                  <Text style={{ color: theme.text, fontSize: 16 }} numberOfLines={1}>{item.platform === 'web' ? item.value : platformName(item.platform)}</Text>
                  <Text style={{ color: theme.text3, fontSize: 13, fontFamily: 'JetBrainsMono_500Medium' }} numberOfLines={1}>{item.platform === 'web' ? item.url : item.value}</Text>
                </View>
                {index === shown ? <Icon name="checkmark.circle.fill" color={theme.link} size={20} /> : null}
                <Pressable accessibilityLabel={`Remove ${item.value}`} onPress={() => { save(links.filter((_, itemIndex) => itemIndex !== index)); go(0); }} hitSlop={10} style={{ width: 36, height: 44, alignItems: 'center', justifyContent: 'center' }}>
                  <Icon name="trash" color={theme.danger} size={17} />
                </Pressable>
              </Pressable>
            ))}
          </List>
        ) : null}
        <List theme={theme}>
          <ListItem theme={theme} icon="wallet.pass" tone="sea" title="Wallet" subtitle={`Spent today $${spent.toFixed(2)} of $${cap.toFixed(2)}`} onPress={() => router.push('/wallet')} />
          <ListItem theme={theme} icon="moon.stars" tone="butter" title="Recap" subtitle="Keep or drop today's people" onPress={() => router.push('/recap')} />
          <ListItem theme={theme} icon="key" tone="dusk" title="Keys and settings" subtitle="Data stays on this phone" onPress={() => router.push('/settings')} last />
        </List>
        <Label theme={theme}>Want to meet</Label>
        {watch.length === 0 ? <Text style={{ color: theme.text2, lineHeight: 21 }}>Add speakers in Settings. There is no public attendee list for IBW or Devcon.</Text> : (
          <List theme={theme}>
            {watch.map((item, index) => <ListItem key={item.id} theme={theme} icon="star" tone="glacier" title={item.name} last={index === watch.length - 1} />)}
          </List>
        )}
      </ScrollView>
      <Modal visible={adding} transparent animationType="slide" onRequestClose={() => setAdding(false)}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <SheetFrame theme={theme} onClose={() => setAdding(false)}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text style={{ color: theme.text, fontSize: 24, fontFamily: 'BricolageGrotesque_700Bold' }}>Add a link</Text>
              <Pressable accessibilityLabel="Close" onPress={() => setAdding(false)} hitSlop={8} style={{ minHeight: 44, justifyContent: 'center' }}>
                <Text style={{ color: theme.link, fontSize: 17, fontWeight: '600' }}>Cancel</Text>
              </Pressable>
            </View>
            <Text style={{ color: theme.text2, lineHeight: 21 }}>Paste a profile link, a WhatsApp number, or any site. The code opens that page.</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
              {OWN_PLATFORMS.map((item) => (
                <Pressable key={item} accessibilityRole="button" accessibilityState={{ selected: platform === item }} accessibilityLabel={platformName(item)} onPress={() => setPlatform(item)} style={{ alignItems: 'center', gap: 4, padding: 6, borderRadius: 16, borderWidth: 2, borderColor: platform === item ? theme.link : 'transparent', minWidth: 64 }}>
                  <PlatformMark platform={item} size={34} />
                  <Text style={{ color: platform === item ? theme.text : theme.text3, fontSize: 12 }}>{platformName(item)}</Text>
                </Pressable>
              ))}
            </View>
            {platform === 'web' ? <Field theme={theme} value={linkName} onChangeText={setLinkName} placeholder="Name, like Website or Hackernoon" accessibilityLabel="Link name" /> : null}
            <Field theme={theme} value={handle} onChangeText={setHandle} autoCapitalize="none" autoCorrect={false} placeholder={fieldHint(platform)} accessibilityLabel="Profile link" onSubmitEditing={add} returnKeyType="done" />
            <Button theme={theme} icon="plus" label={`Add ${platformName(platform)}`} onPress={add} />
          </SheetFrame>
        </KeyboardAvoidingView>
      </Modal>
    </Screen>
  );
}

// memo: a QR is ~1,000 Views, and the screen re-renders on every background job tick
const QrCard = memo(function QrCard({ item, index, page, scrollX, frame }: { item: MyLink; index: number; page: number; scrollX: Animated.Value; frame: string }) {
  const range = [(index - 1) * page, index * page, (index + 1) * page];
  const name = item.platform === 'web' ? item.value : platformName(item.platform);
  return (
    <Animated.View
      accessibilityLabel={`QR code for ${name}`}
      style={{
        width: page,
        padding: 3,
        borderRadius: 30,
        backgroundColor: frame,
        opacity: scrollX.interpolate({ inputRange: range, outputRange: [0.4, 1, 0.4], extrapolate: 'clamp' }),
        transform: [
          { perspective: 900 },
          { rotateY: scrollX.interpolate({ inputRange: range, outputRange: ['28deg', '0deg', '-28deg'], extrapolate: 'clamp' }) },
          { scale: scrollX.interpolate({ inputRange: range, outputRange: [0.86, 1, 0.86], extrapolate: 'clamp' }) },
        ],
      }}
    >
      <View style={{ gap: 10, alignItems: 'center', backgroundColor: '#FFFFFF', borderRadius: 27, padding: 20 }}>
        <QrMark value={item.url} color="#0E1215" background="#FFFFFF" />
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <PlatformMark platform={item.platform} size={24} />
          <Text style={{ color: '#0E1215', fontSize: 18, fontFamily: 'BricolageGrotesque_700Bold' }}>{name}</Text>
        </View>
        <Text style={{ color: '#43525A', textAlign: 'center', fontSize: 13 }} numberOfLines={1}>{item.url}</Text>
      </View>
    </Animated.View>
  );
});
