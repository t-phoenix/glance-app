import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Animated, Easing, Image, Pressable, StyleSheet, Text, TextInput, View, type PressableProps, type StyleProp, type TextInputProps, type ViewStyle } from 'react-native';
import { SymbolView } from 'expo-symbols';
import { portraitUrl } from '@/src/services/enrich';
import { cachePortrait, rememberedPortrait } from '@/src/services/portraitCache';
import { avatarTone, brand, initials, type Role, type Theme } from '@/src/ui/theme';

export const DISPLAY = 'BricolageGrotesque_700Bold';
export const MONO = 'JetBrainsMono_500Medium';

export function Icon({ name, color, size = 22 }: { name: string; color: string; size?: number }) {
  return <SymbolView name={name as never} tintColor={color} size={size} weight="medium" />;
}

export function Screen({ theme, children, style }: { theme: Theme; children: ReactNode; style?: ViewStyle }) {
  return <View style={[{ flex: 1, backgroundColor: theme.bg, overflow: 'hidden' }, style]}>{children}</View>;
}

export function Title({ theme, children, size = 34 }: { theme: Theme; children: ReactNode; size?: number }) {
  return <Text accessibilityRole="header" style={{ color: theme.text, fontFamily: DISPLAY, fontSize: size, letterSpacing: -0.6 }}>{children}</Text>;
}

export function Label({ theme, children, color }: { theme: Theme; children: ReactNode; color?: string }) {
  return <Text style={{ color: color ?? theme.text3, fontSize: 12, fontWeight: '700', letterSpacing: 0.9, textTransform: 'uppercase' }}>{children}</Text>;
}

export function Card({ theme, children, style, tone, onPress, accessibilityLabel }: { theme: Theme; children: ReactNode; style?: StyleProp<ViewStyle>; tone?: Role | 'danger'; onPress?: () => void; accessibilityLabel?: string }) {
  const edge = tone ? (tone === 'danger' ? theme.dangerFill : theme[tone]) : null;
  const body: StyleProp<ViewStyle> = [{ backgroundColor: theme.surface1, borderRadius: 22, padding: 16, gap: 10, borderWidth: edge ? 1 : 0, borderColor: edge ? `${edge}66` : 'transparent' }, style];
  if (!onPress) return <View style={body}>{children}</View>;
  return <Pressable accessibilityRole="button" accessibilityLabel={accessibilityLabel} onPress={onPress} style={({ pressed }) => [body, { opacity: pressed ? 0.85 : 1 }]}>{children}</Pressable>;
}

export function Pill({ theme, label, tone, icon }: { theme: Theme; label?: string; tone: Role | 'muted' | 'danger'; icon?: string }) {
  const color = tone === 'muted' ? theme.text3 : tone === 'danger' ? theme.danger : theme[tone];
  const background = tone === 'muted' ? theme.surface2 : `${tone === 'danger' ? theme.dangerFill : theme[tone]}26`;
  return (
    <View style={{ minHeight: 24, paddingHorizontal: 9, borderRadius: 12, backgroundColor: background, flexDirection: 'row', alignItems: 'center', gap: 4 }}>
      {icon ? <Icon name={icon} color={tone === 'muted' ? theme.text3 : color} size={11} /> : null}
      {label ? <Text style={{ color: tone === 'muted' ? theme.text3 : color, fontSize: 12, fontWeight: '700' }}>{label}</Text> : null}
    </View>
  );
}

type ButtonKind = 'primary' | 'secondary' | 'danger' | 'ghost' | 'ai' | 'done' | 'light';

export function Button({
  theme,
  label,
  onPress,
  kind = 'primary',
  disabled,
  accessibilityLabel,
  icon,
  size = 'large',
  style,
}: {
  theme: Theme;
  label: string;
  onPress: () => void;
  kind?: ButtonKind;
  disabled?: boolean;
  accessibilityLabel?: string;
  icon?: string;
  size?: 'large' | 'small';
  style?: StyleProp<ViewStyle>;
}) {
  const fills: Record<ButtonKind, string> = {
    primary: theme.action,
    secondary: theme.surface2,
    danger: theme.dangerFill,
    ghost: 'transparent',
    ai: theme.dusk,
    done: theme.sea,
    light: theme.text,
  };
  const onFill = kind === 'secondary' || kind === 'ghost' ? theme.text : kind === 'light' ? theme.bg : theme.onColor;
  const small = size === 'small';
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled: !!disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [{
        minHeight: small ? 44 : 56,
        borderRadius: small ? 14 : 18,
        alignItems: 'center',
        justifyContent: 'center',
        flexDirection: 'row',
        gap: 8,
        paddingHorizontal: small ? 14 : 18,
        backgroundColor: fills[kind],
        borderWidth: kind === 'ghost' ? 1 : 0,
        borderColor: theme.border,
        opacity: disabled ? 0.4 : pressed ? 0.82 : 1,
        transform: [{ scale: pressed && !disabled ? 0.98 : 1 }],
      }, style]}
    >
      {icon ? <Icon name={icon} color={onFill} size={small ? 16 : 18} /> : null}
      <Text style={{ color: onFill, fontSize: small ? 15 : 17, fontWeight: '700' }} numberOfLines={1}>{label}</Text>
    </Pressable>
  );
}

/** The bottom bar for a screen's main actions: secondary on the left, primary on the right, in thumb reach. */
export function ActionBar({ theme, children, bottom = 16 }: { theme: Theme; children: ReactNode; bottom?: number }) {
  return <View style={{ flexDirection: 'row', gap: 10, paddingHorizontal: 16, paddingTop: 12, paddingBottom: bottom, backgroundColor: theme.bg, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.border }}>{children}</View>;
}

export function Chip({ theme, label, active, onPress, count, tone }: { theme: Theme; label: string; active?: boolean; onPress?: () => void; count?: number; tone?: Role }) {
  const fill = active ? (tone ? theme[tone] : theme.text) : theme.surface2;
  const ink = active ? (tone ? theme.onColor : theme.bg) : theme.text;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: !!active }}
      accessibilityLabel={count != null ? `${label}, ${count}` : label}
      onPress={onPress}
      hitSlop={4}
      style={({ pressed }) => ({ minHeight: 36, paddingHorizontal: 14, borderRadius: 18, backgroundColor: fill, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 6, opacity: pressed ? 0.8 : 1 })}
    >
      <Text style={{ color: ink, fontSize: 14, fontWeight: '600' }}>{label}</Text>
      {count != null ? <Text style={{ color: ink, fontSize: 13, fontWeight: '700', opacity: 0.75 }}>{count}</Text> : null}
    </Pressable>
  );
}

export function Field(props: TextInputProps & { theme: Theme }) {
  const { theme, style, onFocus, onBlur, ...rest } = props;
  const [focused, setFocused] = useState(false);
  return (
    <TextInput
      placeholderTextColor={theme.text3}
      selectionColor={theme.link}
      {...rest}
      onFocus={(event) => { setFocused(true); onFocus?.(event); }}
      onBlur={(event) => { setFocused(false); onBlur?.(event); }}
      style={[{ minHeight: 52, borderWidth: 1.5, borderColor: focused ? theme.link : 'transparent', borderRadius: 16, paddingHorizontal: 16, paddingVertical: 14, color: theme.text, backgroundColor: theme.surface1, fontSize: 16 }, style]}
    />
  );
}

export function Banner({ theme, text, action, onAction }: { theme: Theme; text: string; action?: string; onAction?: () => void }) {
  return (
    <View accessibilityRole="alert" style={{ minHeight: 44, marginHorizontal: 16, borderRadius: 14, backgroundColor: `${theme.butter}1F`, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
      <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: theme.butter }} />
      <Text style={{ color: theme.text, flex: 1, fontSize: 14 }}>{text}</Text>
      {action ? <Pressable onPress={onAction} hitSlop={8}><Text style={{ color: theme.link, fontSize: 14, fontWeight: '600' }}>{action}</Text></Pressable> : null}
    </View>
  );
}

export function Toast({ theme, text }: { theme: Theme; text: string }) {
  return (
    <View pointerEvents="none" accessibilityLiveRegion="polite" accessibilityRole="alert" style={{ position: 'absolute', top: 60, left: 16, right: 16, minHeight: 52, borderRadius: 18, backgroundColor: theme.text, justifyContent: 'center', paddingHorizontal: 18, paddingVertical: 12, shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 20, shadowOffset: { width: 0, height: 10 } }}>
      <Text style={{ color: theme.bg, fontSize: 15, fontWeight: '600' }}>{text}</Text>
    </View>
  );
}

function useCachedPortrait(uri?: string | null): string | null {
  const remote = portraitUrl(uri);
  const [, refresh] = useState(0);
  useEffect(() => {
    if (!remote || remote.startsWith('file:') || remote.startsWith('data:')) return;
    if (rememberedPortrait(remote)) return;
    let alive = true;
    void cachePortrait(remote).then((saved) => {
      if (alive && saved) refresh((tick) => tick + 1);
    });
    return () => {
      alive = false;
    };
  }, [remote]);
  if (!remote) return null;
  return rememberedPortrait(remote) || remote;
}

/** ring: 'confirmed' draws Sea glass around someone with a linked account; 'pending' draws a quiet grey ring. */
export function Avatar({ theme, uri, name, size = 48, ring, onLoad }: { theme: Theme; uri?: string | null; name: string; size?: number; ring?: 'confirmed' | 'pending'; onLoad?: () => void }) {
  const shown = useCachedPortrait(uri);
  const headers = shown && /licdn\.com/i.test(shown) ? { Referer: 'https://www.linkedin.com/' } : undefined;
  const face = shown ? (
    <Image onLoad={onLoad} source={{ uri: shown, cache: 'force-cache', headers }} fadeDuration={0} style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: theme.surface2 }} />
  ) : (
    <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: theme[avatarTone(name || '?')], alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ color: theme.onColor, fontFamily: DISPLAY, fontSize: Math.round(size * 0.36) }}>{initials(name || '?')}</Text>
    </View>
  );
  if (!ring) return face;
  return (
    <View style={{ padding: 2, borderRadius: size, borderWidth: 2.5, borderColor: ring === 'confirmed' ? theme.sea : theme.border }}>
      {face}
    </View>
  );
}

export function platformName(platform: string): string {
  if (platform === 'x') return 'X';
  if (platform === 'linkedin') return 'LinkedIn';
  if (platform === 'telegram') return 'Telegram';
  if (platform === 'whatsapp') return 'WhatsApp';
  if (platform === 'github') return 'GitHub';
  if (platform === 'web') return 'Link';
  return platform;
}

const MARK: Record<string, { bg: string; glyph: string }> = {
  x: { bg: brand.paper, glyph: 'X' },
  linkedin: { bg: brand.harbor, glyph: 'in' },
  telegram: { bg: brand.glacier, glyph: '✈' },
  whatsapp: { bg: brand.sea, glyph: 'W' },
  github: { bg: '#C9D3D8', glyph: 'GH' },
  web: { bg: brand.butter, glyph: '↗' },
};

export function PlatformMark({ platform, size = 28 }: { platform: string; size?: number }) {
  const mark = MARK[platform] ?? { bg: brand.dusk, glyph: platform.slice(0, 1).toUpperCase() };
  return (
    <View style={{ width: size, height: size, borderRadius: Math.round(size * 0.3), backgroundColor: mark.bg, alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ color: brand.ink, fontWeight: '800', fontSize: Math.max(11, Math.round(size * (mark.glyph.length > 1 ? 0.36 : 0.46))) }}>{mark.glyph}</Text>
    </View>
  );
}

export function IconButton({
  theme,
  name,
  label,
  onPress,
  color,
  background,
}: {
  theme: Theme;
  name: string;
  label: string;
  onPress: () => void;
  color?: string;
  background?: string;
}) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} style={({ pressed }) => ({ alignItems: 'center', gap: 6, minWidth: 64, opacity: pressed ? 0.75 : 1 })}>
      <View style={{ width: 48, height: 48, borderRadius: 16, backgroundColor: background ?? theme.surface2, alignItems: 'center', justifyContent: 'center' }}>
        <Icon name={name} color={color ?? theme.text} size={20} />
      </View>
      <Text style={{ color: theme.text2, fontSize: 12, fontWeight: '600' }} numberOfLines={1}>{label}</Text>
    </Pressable>
  );
}

export function Row({ theme, title, subtitle, trailing, image, onPress, accessibilityLabel, ring, badge }: { theme: Theme; title: string; subtitle?: string; trailing?: string; image?: string | null; onPress?: PressableProps['onPress']; accessibilityLabel?: string; ring?: 'confirmed' | 'pending'; badge?: ReactNode }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={accessibilityLabel ?? title} onPress={onPress} style={({ pressed }) => ({ minHeight: 72, paddingHorizontal: 16, paddingVertical: 10, flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: pressed ? theme.surface1 : 'transparent' })}>
      <Avatar theme={theme} uri={image} name={title} size={48} ring={ring} />
      <View style={{ flex: 1 }}>
        <Text numberOfLines={1} style={{ color: theme.text, fontSize: 17, fontWeight: '600' }}>{title}</Text>
        {subtitle ? <Text numberOfLines={1} style={{ color: theme.text2, fontSize: 14, marginTop: 2 }}>{subtitle}</Text> : null}
      </View>
      {badge}
      {trailing ? <Text style={{ color: theme.text3, fontSize: 13, fontFamily: MONO }}>{trailing}</Text> : null}
    </Pressable>
  );
}

/** A grouped list row for settings-style lists: icon tile, title, optional subtitle, trailing slot. */
export function ListItem({ theme, icon, tone, title, subtitle, trailing, onPress, last, mono }: { theme: Theme; icon?: string; tone?: Role | 'danger'; title: string; subtitle?: string; trailing?: ReactNode; onPress?: () => void; last?: boolean; mono?: boolean }) {
  const color = tone ? (tone === 'danger' ? theme.danger : theme[tone]) : theme.text2;
  const inner = (
    <>
      {icon ? (
        <View style={{ width: 34, height: 34, borderRadius: 10, backgroundColor: tone ? `${tone === 'danger' ? theme.dangerFill : theme[tone]}26` : theme.surface2, alignItems: 'center', justifyContent: 'center' }}>
          <Icon name={icon} color={color} size={17} />
        </View>
      ) : null}
      <View style={{ flex: 1, paddingVertical: 10 }}>
        <Text style={{ color: theme.text, fontSize: 16 }} numberOfLines={1}>{title}</Text>
        {subtitle ? <Text style={{ color: theme.text3, fontSize: 13, fontFamily: mono ? MONO : undefined, marginTop: 1 }} numberOfLines={2}>{subtitle}</Text> : null}
      </View>
      {trailing ?? (onPress ? <Icon name="chevron.right" color={theme.text3} size={14} /> : null)}
    </>
  );
  const style = { minHeight: 56, flexDirection: 'row' as const, alignItems: 'center' as const, gap: 14, borderBottomWidth: last ? 0 : StyleSheet.hairlineWidth, borderBottomColor: theme.border };
  return onPress
    ? <Pressable accessibilityRole="button" accessibilityLabel={title} onPress={onPress} style={({ pressed }) => [style, { opacity: pressed ? 0.75 : 1 }]}>{inner}</Pressable>
    : <View style={style}>{inner}</View>;
}

export function List({ theme, children }: { theme: Theme; children: ReactNode }) {
  return <View style={{ backgroundColor: theme.surface1, borderRadius: 22, paddingHorizontal: 16 }}>{children}</View>;
}

/** Sheet chrome shared by every modal: scrim, rounded top, grab handle. */
export function SheetFrame({ theme, children, onClose }: { theme: Theme; children: ReactNode; onClose?: () => void }) {
  return (
    <View style={{ flex: 1, backgroundColor: theme.scrim, justifyContent: 'flex-end' }}>
      {onClose ? <Pressable accessibilityLabel="Close" style={{ flex: 1 }} onPress={onClose} /> : null}
      <View style={{ backgroundColor: theme.surface1, borderTopLeftRadius: 32, borderTopRightRadius: 32, paddingHorizontal: 20, paddingTop: 10, paddingBottom: 34, gap: 14 }}>
        <View style={{ alignSelf: 'center', width: 40, height: 5, borderRadius: 3, backgroundColor: theme.border, marginBottom: 4 }} />
        {children}
      </View>
    </View>
  );
}

/**
 * Glance mark: a speech bubble whose eyes look up and to the left, the look of someone remembering.
 * Built from Views on the same 100-unit grid as the SVG mark, so it needs no SVG library.
 */
export function GlanceMark({ size = 64, color = brand.tide, eye = brand.ink, animated = false }: { size?: number; color?: string; eye?: string; animated?: boolean }) {
  const u = size / 100;
  const look = useRef(new Animated.Value(0)).current;
  const blink = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (!animated) return;
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(look, { toValue: 1, duration: 700, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      Animated.delay(900),
      // a soft squint, not a full blink: closing to a sliver read as the eyes vanishing
      Animated.timing(blink, { toValue: 0.55, duration: 160, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      Animated.timing(blink, { toValue: 1, duration: 220, easing: Easing.out(Easing.quad), useNativeDriver: true }),
      Animated.delay(500),
      Animated.timing(look, { toValue: 0, duration: 700, easing: Easing.inOut(Easing.cubic), useNativeDriver: true }),
      Animated.delay(800),
    ]));
    loop.start();
    return () => loop.stop();
  }, [animated, look, blink]);
  const eyeStyle = { position: 'absolute' as const, width: 7 * u, height: 13 * u, borderRadius: 3.5 * u, backgroundColor: eye, top: 36 * u };
  const shift = { transform: [
    { translateX: look.interpolate({ inputRange: [0, 1], outputRange: [4 * u, 0] }) },
    { translateY: look.interpolate({ inputRange: [0, 1], outputRange: [6 * u, 0] }) },
    { scaleY: blink },
  ] };
  return (
    <View accessible accessibilityLabel="Glance" style={{ width: size, height: size }}>
      <View style={{ position: 'absolute', left: 20 * u, top: 50 * u, width: 30 * u, height: 32 * u, backgroundColor: color, borderTopLeftRadius: 4 * u }} />
      <View style={{ position: 'absolute', left: 18 * u, top: 18 * u, width: 64 * u, height: 64 * u, borderRadius: 32 * u, backgroundColor: color }} />
      <Animated.View style={[eyeStyle, { left: 37 * u }, animated ? shift : null]} />
      <Animated.View style={[eyeStyle, { left: 52 * u }, animated ? shift : null]} />
    </View>
  );
}
