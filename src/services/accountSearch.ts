import type { Platform } from '@/src/parsers/handles';
import { validateHandle } from '@/src/parsers/handles';
import { anchorFromQr, classifyQr } from '@/src/parsers/qr';
import { nameSlugs } from '@/src/services/discover';
import { profileUrl } from '@/src/services/followupLinks';
import { fetchPublicProfile } from '@/src/services/profiles';

export interface AccountCard {
  platform: 'x' | 'linkedin' | 'telegram' | 'whatsapp';
  value: string;
  url: string;
  displayName: string | null;
  bio: string | null;
  avatarUrl: string | null;
}

const SITE: Record<AccountCard['platform'], string> = {
  x: 'site:x.com',
  linkedin: 'site:linkedin.com/in',
  telegram: 'site:t.me',
  whatsapp: '',
};

/** Pull profile links out of a search results page. */
export function profileLinksFromHtml(platform: AccountCard['platform'], html: string): string[] {
  const expanded = html.replace(/&amp;/g, '&').replace(/%2F/gi, '/').replace(/%3A/gi, ':');
  const decoded = [...expanded.matchAll(/uddg=([^&"]+)/g)].map((match) => {
    try {
      return decodeURIComponent(match[1] ?? '');
    } catch {
      return '';
    }
  });
  const urls = [...(expanded.match(/https?:\/\/[^\s"'<>]+/gi) ?? []), ...decoded];
  const found: string[] = [];
  const seen = new Set<string>();
  for (const raw of urls) {
    const anchor = anchorFromQr(classifyQr(raw.replace(/&amp;/g, '&')));
    if (!anchor || anchor.platform !== platform) continue;
    const key = anchor.value.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    found.push(anchor.value);
    if (found.length >= 8) break;
  }
  return found;
}

async function load(platform: AccountCard['platform'], value: string, twitterKey?: string): Promise<AccountCard | null> {
  if (platform === 'whatsapp') return null;
  try {
    const profile = await fetchPublicProfile(platform, value, twitterKey);
    if (!profile?.displayName || /sign in|log in|login/i.test(profile.displayName)) return null;
    return {
      platform,
      value,
      url: profileUrl(platform, value),
      displayName: profile.displayName,
      bio: profile.bio,
      avatarUrl: profile.avatarUrl,
    };
  } catch {
    return null;
  }
}

async function xSearch(query: string, twitterKey: string): Promise<AccountCard[]> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    const response = await fetch(`https://api.twitterapi.io/twitter/user/search?query=${encodeURIComponent(query)}`, {
      signal: controller.signal,
      headers: { 'X-API-Key': twitterKey },
    });
    if (!response.ok) return [];
    const json = (await response.json()) as { users?: Record<string, unknown>[] };
    const cards: AccountCard[] = [];
    for (const row of json.users ?? []) {
      const raw = String(row.screen_name || row.userName || row.username || '').replace(/^@/, '');
      if (!/^[A-Za-z0-9_]{1,15}$/.test(raw)) continue;
      const value = raw.toLowerCase();
      const picture = typeof row.profile_image_url_https === 'string' ? row.profile_image_url_https : typeof row.profilePicture === 'string' ? row.profilePicture : null;
      cards.push({
        platform: 'x',
        value,
        url: `https://x.com/${value}`,
        displayName: typeof row.name === 'string' ? row.name : null,
        bio: typeof row.description === 'string' ? row.description : null,
        avatarUrl: picture?.replace('_normal.', '_400x400.') ?? null,
      });
      if (cards.length >= 8) break;
    }
    return cards;
  } catch {
    return [];
  } finally {
    clearTimeout(timer);
  }
}

function titleCase(word: string): string {
  return word ? `${word[0]?.toUpperCase() ?? ''}${word.slice(1)}` : word;
}

/** LinkedIn's public name directory. One word uses their + wildcard. */
export function linkedinDirectoryUrl(query: string): string | null {
  const words = query.toLowerCase().replace(/[^a-z\s]/g, ' ').split(/\s+/).filter((word) => word.length > 1);
  if (!words.length) return null;
  const first = titleCase(words[0] ?? '');
  if (words.length === 1) return `https://www.linkedin.com/pub/dir/${encodeURIComponent(first)}/+`;
  const last = titleCase(words[words.length - 1] ?? '');
  return `https://www.linkedin.com/pub/dir/${encodeURIComponent(first)}/${encodeURIComponent(last)}`;
}

/** Names and slugs from a LinkedIn directory or search page. */
export function linkedinHitsFromHtml(html: string): { value: string; displayName: string | null }[] {
  if (/authwall|join linkedin|sign up \| linkedin|attention required/i.test(html) && !/\/in\/[A-Za-z0-9]/i.test(html)) return [];
  const found: { value: string; displayName: string | null }[] = [];
  const seen = new Set<string>();
  const push = (value: string, displayName: string | null) => {
    const slug = value.split(/[?#]/)[0] ?? '';
    if (!/^[A-Za-z0-9\-_%]{3,100}$/.test(slug)) return;
    const key = slug.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    found.push({ value: slug, displayName: displayName && displayName.length > 1 ? displayName : null });
  };
  for (const match of html.matchAll(/href="[^"]*\/in\/([A-Za-z0-9\-_%]{3,100})[^"]*"[^>]*>([^<]{0,80})/gi)) {
    const label = (match[2] ?? '').replace(/\s+/g, ' ').trim();
    push(match[1] ?? '', label && !/^https?:/i.test(label) ? label : null);
  }
  for (const slug of profileLinksFromHtml('linkedin', html)) push(slug, null);
  return found.slice(0, 8);
}

function linkedinSlugGuesses(query: string): string[] {
  const slugs = nameSlugs(query);
  const compact = slugs.map((slug) => slug.replace(/-/g, '')).filter((slug) => slug.length >= 3 && slug.length <= 100);
  return [...new Set([...slugs, ...compact])].slice(0, 4);
}

async function readHtml(url: string): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        Accept: 'text/html',
        'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1',
      },
    });
    if (!response.ok && response.status !== 999) return '';
    return response.status === 999 ? '' : await response.text();
  } catch {
    return '';
  } finally {
    clearTimeout(timer);
  }
}

/** LinkedIn slugs published on Wikidata for people whose name matches the query. */
export function wikidataLinkedinSlugs(searchJson: unknown, entitiesJson: unknown, query: string): string[] {
  const words = query.toLowerCase().split(/\W+/).filter((word) => word.length > 2);
  const rows = ((searchJson as { search?: { id?: string; label?: string }[] } | null)?.search ?? []);
  const allowed = new Set(rows.filter((row) => {
    const label = (row.label ?? '').toLowerCase();
    const hits = words.filter((word) => label.includes(word)).length;
    return words.length === 1 ? hits === 1 : hits >= Math.min(words.length, 2);
  }).map((row) => row.id).filter((id): id is string => Boolean(id)));
  const entities = (entitiesJson as { entities?: Record<string, { claims?: { P6634?: { mainsnak?: { datavalue?: { value?: unknown } } }[] } }> } | null)?.entities ?? {};
  const slugs: string[] = [];
  for (const [id, entity] of Object.entries(entities)) {
    if (!allowed.has(id)) continue;
    for (const claim of entity.claims?.P6634 ?? []) {
      const value = claim.mainsnak?.datavalue?.value;
      if (typeof value === 'string' && /^[A-Za-z0-9\-_%]{3,100}$/.test(value)) slugs.push(value);
    }
  }
  return [...new Set(slugs)].slice(0, 6);
}

async function wikidataLinkedin(query: string): Promise<string[]> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    const headers = { Accept: 'application/json', 'User-Agent': 'Glance/1.0 (personal notes app)' };
    const search = await fetch(`https://www.wikidata.org/w/api.php?action=wbsearchentities&search=${encodeURIComponent(query)}&language=en&format=json&type=item&limit=8`, { signal: controller.signal, headers });
    if (!search.ok) return [];
    const searchJson = await search.json() as { search?: { id?: string }[] };
    const ids = (searchJson.search ?? []).map((row) => row.id).filter((id): id is string => Boolean(id)).slice(0, 8);
    if (!ids.length) return [];
    const entities = await fetch(`https://www.wikidata.org/w/api.php?action=wbgetentities&ids=${ids.join('|')}&props=claims&format=json`, { signal: controller.signal, headers });
    if (!entities.ok) return [];
    return wikidataLinkedinSlugs(searchJson, await entities.json(), query);
  } catch {
    return [];
  } finally {
    clearTimeout(timer);
  }
}

async function linkedinByName(query: string, twitterKey?: string): Promise<AccountCard[]> {
  const directory = linkedinDirectoryUrl(query);
  const [html, wikiSlugs] = await Promise.all([
    directory ? readHtml(directory) : Promise.resolve(''),
    wikidataLinkedin(query),
  ]);
  const hits = linkedinHitsFromHtml(html);
  const guessed = new Set(linkedinSlugGuesses(query).map((slug) => slug.toLowerCase()));
  const listed = new Set([...hits.map((hit) => hit.value.toLowerCase()), ...wikiSlugs.map((slug) => slug.toLowerCase())]);
  const slugs = [...new Set([...hits.map((hit) => hit.value), ...wikiSlugs, ...linkedinSlugGuesses(query)])].slice(0, 6);
  const words = query.toLowerCase().split(/\W+/).filter((word) => word.length > 2);
  const loaded = await Promise.all(slugs.map(async (slug) => {
    const fromDir = hits.find((hit) => hit.value.toLowerCase() === slug.toLowerCase());
    const profile = await load('linkedin', slug, twitterKey);
    if (profile?.displayName) {
      const known = listed.has(slug.toLowerCase());
      const name = profile.displayName.toLowerCase();
      if (!known && guessed.has(slug.toLowerCase()) && words.length >= 2 && !words.every((word) => name.includes(word))) return null;
      if (!known && guessed.has(slug.toLowerCase()) && words.length === 1 && !name.includes(words[0] ?? '')) return null;
      return profile;
    }
    if (!fromDir?.displayName) return null;
    return {
      platform: 'linkedin' as const,
      value: slug,
      url: profileUrl('linkedin', slug),
      displayName: fromDir.displayName,
      bio: null,
      avatarUrl: null,
    };
  }));
  const cards: AccountCard[] = [];
  const seen = new Set<string>();
  for (const card of loaded) {
    if (!card || seen.has(card.value.toLowerCase())) continue;
    seen.add(card.value.toLowerCase());
    cards.push(card);
  }
  return cards;
}

async function webHandles(platform: AccountCard['platform'], query: string): Promise<string[]> {
  const site = SITE[platform];
  if (!site) return [];
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    const q = platform === 'linkedin' ? `${query} linkedin.com/in` : `${query} ${site}`;
    const response = await fetch(`https://html.duckduckgo.com/html/?q=${encodeURIComponent(q)}`, {
      signal: controller.signal,
      headers: { 'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1' },
    });
    if (!response.ok) return [];
    return profileLinksFromHtml(platform, await response.text());
  } catch {
    return [];
  } finally {
    clearTimeout(timer);
  }
}

/** Live account search. Nothing is saved. WhatsApp only accepts a phone number. */
export async function searchAccounts(platform: AccountCard['platform'], query: string, twitterKey?: string, options?: { exactOnly?: boolean }): Promise<AccountCard[]> {
  const q = query.trim().replace(/^@+/, '');
  if (q.length < 2) return [];
  if (platform === 'whatsapp') {
    const typed = q.startsWith('+') ? q : `+${q.replace(/[^\d]/g, '')}`;
    const checked = validateHandle('whatsapp', typed);
    if (!checked.ok) return [];
    return [{
      platform: 'whatsapp',
      value: checked.value,
      url: profileUrl('whatsapp', checked.value),
      displayName: null,
      bio: 'WhatsApp does not publish a name, bio, or photo. This is the number you typed.',
      avatarUrl: null,
    }];
  }
  const found: AccountCard[] = [];
  const seen = new Set<string>();
  const push = (card: AccountCard | null) => {
    if (!card || seen.has(card.value.toLowerCase())) return;
    seen.add(card.value.toLowerCase());
    found.push(card);
  };
  const exact = validateHandle(platform as Platform, q);
  if (exact.ok) push(await load(platform, exact.value, twitterKey));
  if (platform === 'x' && twitterKey) {
    for (const card of await xSearch(q, twitterKey)) push(card);
  }
  if (platform === 'linkedin' && !options?.exactOnly) {
    for (const card of await linkedinByName(q, twitterKey)) push(card);
  }
  if (!options?.exactOnly && found.length < 5) {
    const handles = (await webHandles(platform, q)).filter((value) => !seen.has(value.toLowerCase())).slice(0, 4);
    for (const card of await Promise.all(handles.map((value) => load(platform, value, twitterKey)))) push(card);
  }
  return found.slice(0, 8);
}
