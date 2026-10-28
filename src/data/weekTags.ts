export const PRESET_TAGS = ['IBW', 'Devcon', 'EthGlobal Pragma', 'ETHGlobal Hackathon'] as const;

export interface EventTag {
  name: string;
  color: string;
}

export const TAG_COLORS = ['#9CC3FF', '#A6E9C1', '#F7A1A1', '#F5D98B', '#B7C0FF', '#A9DDF2', '#F2B8D4', '#8EE3D4'];

// Tags saved before the Tidepool rebrand keep their stored color; this shows them as the matching pastel.
const LEGACY_TAG_COLORS: Record<string, string> = {
  '#5B8CFF': '#9CC3FF',
  '#3DD68C': '#A6E9C1',
  '#FF8A73': '#F7A1A1',
  '#F2C14E': '#F5D98B',
  '#C084FC': '#B7C0FF',
  '#229ED9': '#A9DDF2',
  '#F2555A': '#F2B8D4',
  '#14B8A6': '#8EE3D4',
  '#8796A8': '#AEB8BE',
};

export function tagDisplayColor(color: string): string {
  return LEGACY_TAG_COLORS[color.toUpperCase()] ?? color;
}

export const DEFAULT_EVENT_TAGS: EventTag[] = [
  { name: 'IBW', color: '#9CC3FF' },
  { name: 'Devcon', color: '#A6E9C1' },
  { name: 'EthGlobal Pragma', color: '#F5D98B' },
  { name: 'ETHGlobal Hackathon', color: '#B7C0FF' },
];

export function readEventTags(raw: string | null | undefined): EventTag[] {
  if (!raw?.trim()) return DEFAULT_EVENT_TAGS;
  try {
    const parsed = JSON.parse(raw) as EventTag[];
    if (!Array.isArray(parsed)) return DEFAULT_EVENT_TAGS;
    return parsed
      .filter((tag) => tag && typeof tag.name === 'string' && tag.name.trim() && typeof tag.color === 'string')
      .map((tag) => ({ name: tag.name.trim(), color: tag.color }));
  } catch {
    return DEFAULT_EVENT_TAGS;
  }
}

export type PresetTag = (typeof PRESET_TAGS)[number];

export function presetForEventName(name: string | null | undefined): PresetTag | null {
  if (!name) return null;
  if (/pragma/i.test(name)) return 'EthGlobal Pragma';
  if (/ethglobal|eth global/i.test(name)) return 'ETHGlobal Hackathon';
  if (/devcon/i.test(name)) return 'Devcon';
  if (/\bibw\b/i.test(name)) return 'IBW';
  return null;
}

export function geoLabel(lat: number | null | undefined, lng: number | null | undefined): string {
  if (lat == null || lng == null) return 'No location';
  return `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
}
