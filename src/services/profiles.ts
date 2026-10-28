export interface PublicProfile {
  displayName: string | null;
  bio: string | null;
  avatarUrl: string | null;
  followers: number | null;
  raw: string;
}

function meta(html: string, key: string): string | null {
  const patterns = [
    new RegExp(`<meta[^>]+(?:property|name)=["']${key}["'][^>]+content=["']([^"']+)["']`, 'i'),
    new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']${key}["']`, 'i'),
  ];
  for (const pattern of patterns) {
    const found = pattern.exec(html)?.[1];
    if (found) return decode(found);
  }
  return null;
}

function decode(value: string): string {
  return value
    .replaceAll('&amp;', '&')
    .replaceAll('&quot;', '"')
    .replaceAll('&#39;', "'")
    .replaceAll('&lt;', '<')
    .replaceAll('&gt;', '>');
}

const BROWSER = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1';

function documentTitle(html: string): string | null {
  const found = html.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1];
  return found ? decode(found).replace(/\s+/g, ' ').trim() : null;
}

/** Pull a person's name out of a public page title. Login walls return no name. */
export function cleanProfileTitle(raw: string | null, platform: string): { name: string | null; bio: string | null } {
  if (!raw) return { name: null, bio: null };
  const text = decode(raw).replace(/\s+/g, ' ').trim();
  if (/sign in|log in|login|authwall|join linkedin|security verification/i.test(text)) return { name: null, bio: null };
  if (platform === 'x') {
    const name = text.replace(/\s*\(@[^)]+\)\s*(?:on X|\/ X).*$/i, '').replace(/\s+on X$/i, '').trim();
    return { name: name || null, bio: null };
  }
  if (platform === 'linkedin') {
    const withoutSite = text.replace(/\s*\|\s*LinkedIn\s*$/i, '').trim();
    const [name, ...rest] = withoutSite.split(' - ');
    return { name: name?.trim() || null, bio: rest.join(' - ').trim() || null };
  }
  if (platform === 'telegram') {
    return { name: text.replace(/\s+[–-]\s+Telegram$/i, '').trim() || null, bio: null };
  }
  return { name: text, bio: null };
}

async function fetchText(url: string, headers: Record<string, string> = {}): Promise<{ status: number; text: string }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    const response = await fetch(url, { headers: { Accept: 'text/html', 'User-Agent': BROWSER, ...headers }, signal: controller.signal });
    const text = (await response.text()).slice(0, 512_000);
    return { status: response.status, text };
  } finally {
    clearTimeout(timer);
  }
}

export async function fetchPublicProfile(platform: string, value: string, twitterKey?: string): Promise<PublicProfile | null> {
  if (platform === 'telegram') {
    const { status, text } = await fetchText(`https://t.me/${encodeURIComponent(value)}`);
    if (status === 404) return null;
    if (status >= 400) throw new Error(String(status));
    return { displayName: meta(text, 'og:title'), bio: meta(text, 'og:description'), avatarUrl: meta(text, 'og:image'), followers: null, raw: 't.me' };
  }
  if (platform === 'github') {
    const { status, text } = await fetchText(`https://api.github.com/users/${encodeURIComponent(value)}`, { Accept: 'application/vnd.github+json' });
    if (status === 404) return null;
    if (status >= 400) throw new Error(String(status));
    const json = JSON.parse(text) as { name?: string; bio?: string; avatar_url?: string; followers?: number; login?: string };
    return { displayName: json.name || json.login || null, bio: json.bio ?? null, avatarUrl: json.avatar_url ?? null, followers: json.followers ?? null, raw: 'github' };
  }
  if (platform === 'ens' || value.endsWith('.eth') || value.startsWith('0x')) {
    const { status, text } = await fetchText(`https://api.web3.bio/profile/${encodeURIComponent(value)}`);
    if (status === 404) return null;
    if (status >= 400) throw new Error(String(status));
    const json = JSON.parse(text) as { displayName?: string; description?: string; avatar?: string; identity?: string };
    return { displayName: json.displayName || json.identity || null, bio: json.description ?? null, avatarUrl: json.avatar ?? null, followers: null, raw: text.slice(0, 4000) };
  }
  if (platform === 'farcaster') {
    const { status, text } = await fetchText(`https://warpcast.com/${encodeURIComponent(value)}`);
    if (status === 404) return null;
    if (status >= 400) throw new Error(String(status));
    const title = meta(text, 'og:title');
    if (!title) return null;
    return { displayName: title, bio: meta(text, 'og:description'), avatarUrl: meta(text, 'og:image'), followers: null, raw: 'warpcast' };
  }
  if (platform === 'linkedin') {
    const { status, text } = await fetchText(`https://www.linkedin.com/in/${encodeURIComponent(value)}`, {
      'User-Agent': 'facebookexternalhit/1.1',
    });
    if (status === 404) return null;
    const cleaned = cleanProfileTitle(meta(text, 'og:title') || documentTitle(text), 'linkedin');
    if (!cleaned.name) return null;
    return {
      displayName: cleaned.name,
      bio: meta(text, 'og:description') || cleaned.bio,
      avatarUrl: meta(text, 'og:image'),
      followers: null,
      raw: 'linkedin-og',
    };
  }
  if (platform === 'x') {
    if (twitterKey) {
      const { status, text } = await fetchText(`https://api.twitterapi.io/twitter/user/info?userName=${encodeURIComponent(value)}`, { 'X-API-Key': twitterKey });
      if (status === 401 || status === 403) throw new Error('auth');
      if (status === 404) return null;
      if (status >= 400) throw new Error(String(status));
      const json = JSON.parse(text) as { data?: { name?: string; description?: string; profilePicture?: string; followers?: number } };
      const data = json.data;
      return { displayName: data?.name ?? null, bio: data?.description ?? null, avatarUrl: data?.profilePicture ?? null, followers: data?.followers ?? null, raw: 'twitterapi' };
    }
    const page = await fetchText(`https://x.com/${encodeURIComponent(value)}`, { 'User-Agent': 'Twitterbot/1.0' });
    const cleaned = cleanProfileTitle(meta(page.text, 'og:title') || documentTitle(page.text), 'x');
    if (page.status < 400 && cleaned.name) {
      return { displayName: cleaned.name, bio: meta(page.text, 'og:description'), avatarUrl: meta(page.text, 'og:image'), followers: null, raw: 'x-og' };
    }
    const card = await fetchText(`https://api.vxtwitter.com/${encodeURIComponent(value)}`, { Accept: 'application/json' });
    if (card.status >= 400) return null;
    const json = JSON.parse(card.text) as { name?: string; description?: string; profile_image_url?: string; followers_count?: number };
    if (!json.name) return null;
    return {
      displayName: json.name,
      bio: json.description ?? null,
      avatarUrl: json.profile_image_url?.replace('_normal.', '_400x400.') ?? null,
      followers: json.followers_count ?? null,
      raw: 'vxtwitter',
    };
  }
  return null;
}

export function handlesInText(text: string): { platform: string; value: string }[] {
  const found: { platform: string; value: string }[] = [];
  const urls = text.match(/https?:\/\/[^\s)]+/g) ?? [];
  for (const url of urls) {
    if (url.includes('x.com/') || url.includes('twitter.com/')) {
      const value = url.split('/').filter(Boolean).pop()?.replace(/[?].*/, '').replace(/^@/, '').toLowerCase();
      if (value) found.push({ platform: 'x', value });
    } else if (url.includes('t.me/')) {
      const value = url.split('/').filter(Boolean).pop()?.replace(/[?].*/, '') ?? '';
      if (value) found.push({ platform: 'telegram', value });
    } else if (url.includes('linkedin.com/in/')) {
      const value = url.split('linkedin.com/in/')[1]?.split(/[/?]/)[0];
      if (value) found.push({ platform: 'linkedin', value });
    } else if (url.includes('wa.me/') || url.includes('api.whatsapp.com/')) {
      const digits = (url.split('wa.me/')[1] ?? url.split('phone=')[1] ?? '').split(/[?&]/)[0]?.replace(/[^\d]/g, '') ?? '';
      if (digits.length >= 8) found.push({ platform: 'whatsapp', value: `+${digits}` });
    } else if (url.includes('github.com/')) {
      const value = url.split('github.com/')[1]?.split(/[/?]/)[0];
      if (value) found.push({ platform: 'github', value });
    } else if (url.includes('warpcast.com/')) {
      const value = url.split('warpcast.com/')[1]?.split(/[/?]/)[0]?.replace(/^@/, '');
      if (value && value !== '~') found.push({ platform: 'farcaster', value });
    }
  }
  for (const match of text.matchAll(/(?:^|\s)@([A-Za-z][A-Za-z0-9_]{3,31})/g)) {
    const value = match[1];
    if (value) found.push({ platform: 'telegram', value });
  }
  return found;
}
