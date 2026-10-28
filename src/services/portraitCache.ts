import { Directory, File, Paths } from 'expo-file-system';
import { portraitKey, portraitUrl } from '@/src/services/enrich';

const memory = new Map<string, string>();
const inflight = new Map<string, Promise<string | null>>();

export function rememberedPortrait(raw: string | null | undefined): string | null {
  const url = portraitUrl(raw);
  if (!url || url.startsWith('file:') || url.startsWith('data:')) return url;
  return memory.get(portraitKey(url)) ?? null;
}

function portraitFile(key: string): File {
  const dir = new Directory(Paths.cache, 'portraits');
  if (!dir.exists) dir.create({ intermediates: true, idempotent: true });
  return new File(dir, `${key}.img`);
}

function looksLikeImage(bytes: Uint8Array): boolean {
  if (bytes.length < 32) return false;
  if (bytes[0] === 0xff && bytes[1] === 0xd8) return true;
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return true;
  if (bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46) return true;
  return bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46;
}

async function keepImage(file: File, key: string): Promise<string | null> {
  try {
    const bytes = await file.bytes();
    if (!looksLikeImage(bytes)) {
      if (file.exists) file.delete();
      return null;
    }
    memory.set(key, file.uri);
    return file.uri;
  } catch {
    return null;
  }
}

/** Download a portrait once and reuse the file the next time that account appears. */
export function cachePortrait(raw: string | null | undefined): Promise<string | null> {
  const url = portraitUrl(raw);
  if (!url) return Promise.resolve(null);
  if (url.startsWith('file:') || url.startsWith('data:')) return Promise.resolve(url);
  const key = portraitKey(url);
  const saved = memory.get(key);
  if (saved) return Promise.resolve(saved);
  const pending = inflight.get(key);
  if (pending) return pending;
  const job = (async () => {
    try {
      const file = portraitFile(key);
      if (file.exists) return keepImage(file, key);
      const headers = /licdn\.com/i.test(url) ? { Referer: 'https://www.linkedin.com/', Accept: 'image/*' } : undefined;
      const downloaded = await File.downloadFileAsync(url, file, { idempotent: true, headers });
      return keepImage(downloaded, key);
    } catch {
      return null;
    } finally {
      inflight.delete(key);
    }
  })();
  inflight.set(key, job);
  return job;
}
