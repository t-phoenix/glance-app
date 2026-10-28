import { validateHandle, type Platform } from '@/src/parsers/handles';
import { anchorFromQr, classifyQr } from '@/src/parsers/qr';
import { profileUrl } from '@/src/services/followupLinks';

export const OWN_PLATFORMS = ['x', 'linkedin', 'telegram', 'github', 'whatsapp', 'web'] as const;
export type OwnPlatform = (typeof OWN_PLATFORMS)[number];

export function parseOwnLink(
  platform: OwnPlatform,
  raw: string,
  label?: string,
): { ok: true; value: string; url: string } | { ok: false; reason: string } {
  const text = raw.trim();
  if (!text) return { ok: false, reason: 'Paste a link, a handle, or a number.' };
  if (platform === 'web') {
    const href = /^https?:\/\//i.test(text) ? text : `https://${text}`;
    try {
      const url = new URL(href);
      if (url.protocol !== 'http:' && url.protocol !== 'https:') return { ok: false, reason: 'Use an http or https link.' };
    } catch {
      return { ok: false, reason: 'That does not look like a link.' };
    }
    const name = (label ?? '').trim();
    if (!name) return { ok: false, reason: 'Name this link, like Website or Hackernoon.' };
    if (name.length > 40) return { ok: false, reason: 'Keep the name under 40 characters.' };
    return { ok: true, value: name, url: href };
  }
  const anchor = anchorFromQr(classifyQr(text));
  if (anchor?.platform === platform && anchor.value) {
    return { ok: true, value: anchor.value, url: profileUrl(platform, anchor.value) };
  }
  if (/^https?:\/\//i.test(text) || text.includes('/')) {
    return { ok: false, reason: `That link is not a ${platform} profile.` };
  }
  const checked = validateHandle(platform as Platform, text);
  if (!checked.ok) return { ok: false, reason: checked.reason ?? 'Check that value.' };
  return { ok: true, value: checked.value, url: profileUrl(platform, checked.value) };
}
