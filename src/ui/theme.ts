// Tidepool: cool greys with a teal bias plus flat pastels. Pastel fills always carry Ink text; no gradients.
export const brand = {
  tide: '#8EE3D4',
  harbor: '#9CC3FF',
  glacier: '#A9DDF2',
  dusk: '#B7C0FF',
  sea: '#A6E9C1',
  butter: '#F5D98B',
  blush: '#F7A1A1',
  ink: '#0E1215',
  paper: '#EEF3F2',
};

export const dark = {
  bg: '#0E1215',
  surface1: '#161B1F',
  surface2: '#1F262B',
  text: '#EEF3F2',
  text2: '#AEB8BE',
  text3: '#8794A0',
  action: brand.tide,
  actionText: brand.ink,
  link: brand.tide,
  linked: brand.sea,
  pending: '#8794A0',
  warning: brand.butter,
  danger: brand.blush,
  dangerFill: brand.blush,
  border: '#2C353B',
  input: '#2C353B',
  scrim: 'rgba(5, 9, 11, 0.72)',
  onColor: brand.ink,
  tide: brand.tide,
  harbor: brand.harbor,
  glacier: brand.glacier,
  dusk: brand.dusk,
  sea: brand.sea,
  butter: brand.butter,
};

export const light: Theme = {
  bg: '#F3F7F6',
  surface1: '#FFFFFF',
  surface2: '#E6EEEC',
  text: brand.ink,
  text2: '#43525A',
  text3: '#566570',
  action: brand.tide,
  actionText: brand.ink,
  link: '#17766B',
  linked: '#1E7A50',
  pending: '#566570',
  warning: '#8A5E00',
  danger: '#B3393D',
  dangerFill: brand.blush,
  border: '#D5DFDD',
  input: '#C7D3D1',
  scrim: 'rgba(14, 18, 21, 0.45)',
  onColor: brand.ink,
  tide: brand.tide,
  harbor: brand.harbor,
  glacier: brand.glacier,
  dusk: brand.dusk,
  sea: brand.sea,
  butter: brand.butter,
};

export type Theme = typeof dark;

export type Role = 'tide' | 'harbor' | 'glacier' | 'dusk' | 'sea' | 'butter';
export const ROLES: Role[] = ['tide', 'harbor', 'glacier', 'dusk', 'sea', 'butter'];

/** Stable pastel for a person's initials, so the same name always gets the same color. */
export function avatarTone(name: string): Role {
  let hash = 0;
  for (const char of name.trim().toLowerCase()) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return ROLES[hash % ROLES.length] ?? 'tide';
}

export function initials(name: string): string {
  const words = name.trim().replace(/^@/, '').split(/\s+/).filter(Boolean);
  const first = words[0];
  if (!first) return '?';
  const last = words.length > 1 ? words[words.length - 1] : undefined;
  return `${first.slice(0, 1)}${last ? last.slice(0, 1) : ''}`.toUpperCase();
}

/** Tab badge text: nothing for zero, the count up to 9, then 9+. */
export function badgeLabel(count: number): string | null {
  if (!Number.isFinite(count) || count <= 0) return null;
  return count > 9 ? '9+' : String(Math.floor(count));
}

function luminance(hex: string): number {
  const value = hex.replace('#', '');
  const channels = [0, 2, 4].map((index) => parseInt(value.slice(index, index + 2), 16) / 255);
  const [r = 0, g = 0, b = 0] = channels.map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrast(a: string, b: string): number {
  const [x, y] = [luminance(a), luminance(b)];
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}
