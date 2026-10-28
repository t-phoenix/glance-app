export type Platform =
  | 'x'
  | 'linkedin'
  | 'telegram'
  | 'whatsapp'
  | 'github'
  | 'farcaster'
  | 'lens'
  | 'ens'
  | 'email'
  | 'web'
  | 'other';

export interface HandleCheck {
  ok: boolean;
  value: string;
  reason?: string;
}

function cleanAt(raw: string): string {
  return raw.trim().replace(/^@+/, '');
}

export function validateHandle(platform: Platform, raw: string): HandleCheck {
  const trimmed = raw.trim();
  switch (platform) {
    case 'x': {
      const value = cleanAt(trimmed);
      if (!/^@?[A-Za-z0-9_]{1,15}$/.test(trimmed) || value.length < 1 || value.length > 15) {
        return { ok: false, value, reason: 'X handles are 1–15 letters, numbers or underscores.' };
      }
      return { ok: true, value: value.toLowerCase() };
    }
    case 'telegram': {
      const value = cleanAt(trimmed);
      if (!/^@?[A-Za-z][A-Za-z0-9_]{4,31}$/.test(trimmed)) {
        return { ok: false, value, reason: 'Telegram handles start with a letter and are 5–32 characters.' };
      }
      return { ok: true, value };
    }
    case 'linkedin': {
      const value = trimmed.replace(/^@/, '');
      if (!/^[A-Za-z0-9\-_%]{3,100}$/.test(value)) {
        return { ok: false, value, reason: 'That LinkedIn slug does not look right.' };
      }
      return { ok: true, value };
    }
    case 'whatsapp': {
      const value = trimmed.startsWith('+') ? trimmed.replace(/[\s-]/g, '') : `+${trimmed.replace(/[\s-]/g, '')}`;
      if (!/^\+[1-9]\d{7,14}$/.test(value)) {
        return { ok: false, value: trimmed, reason: 'Use a full number with country code, like +919812345678.' };
      }
      return { ok: true, value };
    }
    case 'ens': {
      const value = trimmed.toLowerCase();
      if (!/^[a-z0-9-]+(\.[a-z0-9-]+)*\.eth$/.test(value)) {
        return { ok: false, value, reason: 'ENS names end in .eth.' };
      }
      return { ok: true, value };
    }
    case 'email': {
      const value = trimmed.toLowerCase();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) || value.length > 120) {
        return { ok: false, value, reason: 'That email does not look right.' };
      }
      return { ok: true, value };
    }
    case 'github':
    case 'farcaster':
    case 'lens': {
      const value = cleanAt(trimmed);
      if (!/^[A-Za-z0-9-]{1,39}$/.test(value)) {
        return { ok: false, value, reason: 'Use the public handle, without a URL.' };
      }
      return { ok: true, value };
    }
    case 'web':
    case 'other': {
      if (trimmed.length < 1 || trimmed.length > 300) return { ok: false, value: trimmed, reason: 'Too long.' };
      return { ok: true, value: trimmed };
    }
    default:
      return { ok: false, value: trimmed, reason: 'Unknown platform.' };
  }
}

export function validatePersonName(raw: string): HandleCheck {
  const value = raw.trim();
  if (!value) return { ok: true, value: '' };
  if (value.length > 80) return { ok: false, value, reason: 'Keep the name under 80 characters.' };
  if (/^\d+$/.test(value)) return { ok: false, value, reason: 'A name needs letters, not only digits.' };
  return { ok: true, value };
}

export function validateCompany(raw: string): HandleCheck {
  const value = raw.trim();
  if (!value) return { ok: true, value: '' };
  if (value.length > 80) return { ok: false, value, reason: 'Keep this under 80 characters.' };
  return { ok: true, value };
}

export function validateHint(raw: string): HandleCheck {
  const value = raw.trim();
  if (value.length > 140) return { ok: false, value, reason: 'Keep the reminder under 140 characters.' };
  return { ok: true, value };
}
