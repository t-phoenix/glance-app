import { chooseProfilePhoto } from '@/src/services/primaryAccount';

/**
 * A smaller X portrait arrives faster. LinkedIn links stay untouched:
 * each size has its own signature, so rewriting shrink_800_800 to shrink_200_200 makes the picture fail.
 */
export function portraitUrl(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const url = raw.trim();
  if (!url) return null;
  if (url.startsWith('file:') || url.startsWith('data:')) return url;
  if (!/^https?:\/\//i.test(url)) return null;
  if (/licdn\.com/i.test(url)) return url;
  return url.replace(/_(?:400x400|bigger|normal|reasonably_small)\./g, '_200x200.');
}

/** Stable file name for a portrait. Query tokens on LinkedIn change; the path does not. */
export function portraitKey(url: string): string {
  try {
    const path = new URL(url).pathname;
    return path.replace(/[^a-zA-Z0-9._-]+/g, '_').replace(/^_+/, '').slice(-96) || 'face';
  } catch {
    return 'face';
  }
}

/** A later lookup must not erase a name, bio, or link that is already saved. */
export function keepText(next: string | null | undefined, current: string | null | undefined): string | null {
  const incoming = next?.trim();
  if (incoming) return incoming;
  return current?.trim() || null;
}

/** A later lookup must not replace a real portrait with a blank or a logo. */
export function keepPhoto(next: string | null | undefined, current: string | null | undefined): string | null {
  if (current?.startsWith('file:') || current?.startsWith('data:')) return current;
  if (next?.startsWith('file:') || next?.startsWith('data:')) return next;
  return chooseProfilePhoto(next, current);
}
