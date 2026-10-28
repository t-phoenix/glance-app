import type { Platform } from '@/src/parsers/handles';
import { anchorFromQr, classifyQr, type QrClassification } from '@/src/parsers/qr';

function metaUrl(html: string): string[] {
  const found: string[] = [];
  const patterns = [
    /<meta[^>]+property=["']og:url["'][^>]+content=["']([^"']+)["']/gi,
    /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:url["']/gi,
    /<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']+)["']/gi,
  ];
  for (const pattern of patterns) {
    for (const match of html.matchAll(pattern)) {
      if (match[1]) found.push(match[1]);
    }
  }
  return found;
}

function hrefs(html: string): string[] {
  const found: string[] = [];
  for (const match of html.matchAll(/https?:\/\/[^\s"'<>]+/gi)) {
    const url = match[0]?.replace(/&amp;/g, '&');
    if (url) found.push(url);
  }
  return found;
}

export function socialsInPage(page: string): { platform: Platform; value: string; url: string }[] {
  const found: { platform: Platform; value: string; url: string }[] = [];
  const seen = new Set<string>();
  const candidates = [...metaUrl(page), ...hrefs(page)];
  for (const url of candidates) {
    const anchor = anchorFromQr(classifyQr(url));
    if (!anchor || anchor.platform === 'web' || anchor.platform === 'other') continue;
    const key = `${anchor.platform}:${anchor.value.toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    found.push({ platform: anchor.platform, value: anchor.value, url: anchor.url || url });
    if (found.length >= 8) break;
  }
  return found;
}

const ACCOUNT = new Set(['x', 'linkedin', 'telegram', 'whatsapp', 'github', 'farcaster']);

const BROWSER = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1';

/** A short-link page often hides the real profile in a refresh tag. */
export function nextHop(html: string, currentUrl: string): string | null {
  const refresh = html.match(/http-equiv=["']refresh["'][^>]*content=["'][^"']*url=([^"'>\s]+)/i)
    ?? html.match(/content=["'][^"']*url=([^"'>\s]+)["'][^>]*http-equiv=["']refresh["']/i);
  const raw = refresh?.[1]?.replace(/&amp;/g, '&');
  if (!raw) return null;
  try {
    const next = new URL(raw, currentUrl).toString();
    return next === currentUrl ? null : next;
  } catch {
    return null;
  }
}

function redirectParam(url: string): string | null {
  try {
    const parsed = new URL(url);
    for (const key of ['url', 'u', 'redirect', 'target', 'dest']) {
      const value = parsed.searchParams.get(key);
      if (value && /^https?:\/\//i.test(value)) return value;
    }
  } catch {
    return null;
  }
  return null;
}

/** Prefer the page the short link actually opens, then a profile link in that page. */
export function pickResolved(raw: string, finalUrl: string, html: string): QrClassification {
  const direct = classifyQr(finalUrl);
  const directAnchor = anchorFromQr(direct);
  if (directAnchor && ACCOUNT.has(directAnchor.platform)) {
    return { ...direct, raw };
  }
  const hop = nextHop(html, finalUrl) ?? redirectParam(finalUrl);
  if (hop) {
    const hopped = classifyQr(hop);
    const hopAnchor = anchorFromQr(hopped);
    if (hopAnchor && ACCOUNT.has(hopAnchor.platform)) return { ...hopped, raw };
  }
  const links = socialsInPage(`${finalUrl}\n${html}`);
  const primary = links.find((link) => ['x', 'linkedin', 'telegram', 'whatsapp'].includes(link.platform)) ?? links[0];
  if (!primary) return direct.kind === 'invalid' ? classifyQr(raw) : { ...direct, raw };
  const resolved = classifyQr(primary.url);
  return {
    ...resolved,
    raw,
    contact: { name: resolved.contact?.name, handles: links.filter((link) => link !== primary) },
  };
}

async function readPage(start: string): Promise<{ url: string; html: string }> {
  let current = start;
  for (let hop = 0; hop < 5; hop++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);
    try {
      const response = await fetch(current, {
        redirect: 'follow',
        signal: controller.signal,
        headers: { Accept: 'text/html', 'User-Agent': BROWSER },
      });
      const html = (await response.text()).slice(0, 300_000);
      const landed = response.url || current;
      const masked = classifyQr(landed).kind === 'shortlink' || classifyQr(landed).needsResolve === true;
      const next = masked ? nextHop(html, landed) ?? redirectParam(landed) ?? await locationOf(current) : null;
      if (next && next !== landed && next !== current && hop < 4) {
        current = next;
        continue;
      }
      return { url: landed, html };
    } finally {
      clearTimeout(timer);
    }
  }
  return { url: current, html: '' };
}

async function locationOf(url: string): Promise<string | null> {
  try {
    const response = await fetch(url, { method: 'HEAD', redirect: 'manual', headers: { 'User-Agent': BROWSER } });
    const location = response.headers.get('location');
    if (!location || response.status < 300 || response.status >= 400) return null;
    return new URL(location, url).toString();
  } catch {
    return null;
  }
}

function isAccount(qr: QrClassification): boolean {
  const anchor = anchorFromQr(qr);
  return !!anchor && ACCOUNT.has(anchor.platform);
}

function stringsIn(value: unknown, found: string[] = []): string[] {
  if (typeof value === 'string') {
    if (/^https?:\/\//i.test(value)) found.push(value);
    return found;
  }
  if (Array.isArray(value)) {
    for (const item of value) stringsIn(item, found);
    return found;
  }
  if (value && typeof value === 'object') {
    for (const item of Object.values(value)) stringsIn(item, found);
  }
  return found;
}

/** qr-code.io hides the real profile in this JSON, not in the page HTML. */
export function destinationFromScanPage(payload: unknown): string | null {
  if (!payload || typeof payload !== 'object') return null;
  const data = (payload as { data?: Record<string, unknown> }).data;
  const urls = stringsIn(payload);
  const account = urls.find((url) => isAccount(classifyQr(url)));
  if (account) return account;
  if (data && typeof data.whatsapp_number === 'string') {
    const dial = typeof data.dial_code === 'string' ? data.dial_code : '';
    const digits = `${dial}${data.whatsapp_number}`.replace(/[^\d]/g, '');
    if (digits.length >= 8) return `https://wa.me/${digits}`;
  }
  return urls.find((url) => !/scan\.page|scanned\.page|qr-code\.io/i.test(url)) ?? null;
}

async function scanPageTarget(url: string): Promise<string | null> {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }
  const host = parsed.hostname.replace(/^www\./, '');
  if (host !== 'scan.page' && host !== 'scanned.page') return null;
  const id = parsed.pathname.split('/').filter(Boolean)[1];
  if (!id) return null;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    const response = await fetch(`https://scan.page/api/qr-code?uId=${encodeURIComponent(id)}`, {
      signal: controller.signal,
      headers: { Accept: 'application/json', 'User-Agent': BROWSER },
    });
    if (!response.ok) return null;
    return destinationFromScanPage(await response.json());
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/** Follow a QR link and read the profile it lands on. Does not open a browser. */
export async function resolveQr(input: string, depth = 0): Promise<QrClassification> {
  const first = classifyQr(input);
  if (first.unsafe || first.kind === 'invalid' || depth > 3) return first;
  const shouldFetch = first.kind === 'url' || first.kind === 'shortlink' || first.needsResolve;
  if (!shouldFetch) return first;
  const start = first.url || (first.raw.startsWith('http') ? first.raw : '');
  if (!start) return first;
  try {
    const hidden = await scanPageTarget(start);
    if (hidden && hidden !== start) {
      const next = await resolveQr(hidden, depth + 1);
      if (isAccount(next) || (next.kind !== 'url' && next.kind !== 'shortlink' && next.kind !== 'invalid')) {
        return { ...next, raw: first.raw };
      }
    }
    const page = await readPage(start);
    return pickResolved(first.raw, page.url, page.html);
  } catch {
    return first;
  }
}
