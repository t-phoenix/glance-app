import type { Platform } from '@/src/parsers/handles';
import { validateHandle } from '@/src/parsers/handles';
import { fetchPublicProfile, handlesInText, type PublicProfile } from '@/src/services/profiles';
import { dossierSearchText, scoreWithDossier, type ProfileDossier } from '@/src/services/profileDossier';
import { profileUrl } from '@/src/services/followupLinks';

export interface AccountHit {
  platform: Platform;
  value: string;
  url: string;
  displayName: string | null;
  bio: string | null;
  confidence: 'high' | 'medium' | 'low';
  score: number;
  evidence: string;
  avatarUrl?: string | null;
}

export interface DiscoverResult {
  hits: AccountHit[];
  anchorName: string | null;
  anchorBio: string | null;
}

const OTHERS: Platform[] = ['x', 'linkedin', 'telegram', 'whatsapp', 'github', 'farcaster'];

function nameOverlap(left: string | null, right: string | null): boolean {
  if (!left || !right) return false;
  const words = new Set(left.toLowerCase().split(/\W+/).filter((word) => word.length > 2));
  return right.toLowerCase().split(/\W+/).some((word) => words.has(word));
}

function usable(profile: PublicProfile | null): profile is PublicProfile {
  if (!profile?.displayName) return false;
  return !/sign in|log in|login|authwall/i.test(profile.displayName);
}

function add(hits: AccountHit[], seen: Set<string>, hit: AccountHit): void {
  const key = `${hit.platform}:${hit.value.toLowerCase()}`;
  if (seen.has(key)) return;
  seen.add(key);
  hits.push(hit);
}

/** A phone only counts when the person published it with a country code. */
export function phonesInText(text: string): string[] {
  const found = new Set<string>();
  for (const match of text.matchAll(/(?:\+|00)\d[\d\s().-]{6,16}\d/g)) {
    const digits = match[0].replace(/[^\d]/g, '').replace(/^00/, '');
    if (digits.length >= 8 && digits.length <= 15) found.add(`+${digits}`);
  }
  return [...found];
}

/** LinkedIn-style slugs from a public display name. Drops single-letter initials. */
export function nameSlugs(name: string): string[] {
  const words = name.toLowerCase().replace(/[^a-z\s-]/g, ' ').split(/[\s-]+/).filter((word) => word.length > 1);
  if (words.length < 2) return [];
  const full = words.join('-');
  const ends = `${words[0]}-${words[words.length - 1]}`;
  return [...new Set([full, ends])].filter((slug) => slug.length >= 3 && slug.length <= 100);
}

async function fromWeb3Bio(path: string): Promise<{ platform: string; value: string }[]> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    const response = await fetch(`https://api.web3.bio/profile/${path}`, { signal: controller.signal });
    if (!response.ok) return [];
    const json = (await response.json()) as unknown;
    const rows = Array.isArray(json) ? json : [json];
    const found: { platform: string; value: string }[] = [];
    for (const row of rows) {
      if (!row || typeof row !== 'object') continue;
      const links = (row as { links?: unknown }).links;
      if (!links) continue;
      const entries = Array.isArray(links) ? links : Object.entries(links as Record<string, unknown>).map(([key, item]) => ({ platform: key, ...(item as object) }));
      for (const item of entries) {
        if (!item || typeof item !== 'object') continue;
        const record = item as { platform?: string; handle?: string; link?: string };
        const site = (record.platform ?? '').toLowerCase();
        const handle = record.handle || '';
        const mapped = site === 'twitter' ? 'x' : site;
        if (handle && OTHERS.includes(mapped as Platform)) found.push({ platform: mapped, value: handle.replace(/^@/, '') });
        if (record.link) {
          for (const parsed of handlesInText(record.link)) found.push(parsed);
        }
      }
    }
    return found;
  } catch {
    return [];
  } finally {
    clearTimeout(timer);
  }
}

/** X accounts whose name matches. Needs a twitterapi.io key. Nothing is confirmed. */
export async function xUsersByName(name: string, twitterKey: string): Promise<AccountHit[]> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    const response = await fetch(`https://api.twitterapi.io/twitter/user/search?query=${encodeURIComponent(name)}`, {
      signal: controller.signal,
      headers: { 'X-API-Key': twitterKey },
    });
    if (!response.ok) return [];
    const json = (await response.json()) as { users?: Record<string, unknown>[] };
    const hits: AccountHit[] = [];
    for (const row of json.users ?? []) {
      const raw = String(row.screen_name || row.userName || row.username || '').replace(/^@/, '');
      if (!/^[A-Za-z0-9_]{1,15}$/.test(raw)) continue;
      const value = raw.toLowerCase();
      const picture = typeof row.profile_image_url_https === 'string' ? row.profile_image_url_https : typeof row.profilePicture === 'string' ? row.profilePicture : null;
      hits.push({
        platform: 'x',
        value,
        url: profileUrl('x', value),
        displayName: typeof row.name === 'string' ? row.name : null,
        bio: typeof row.description === 'string' ? row.description : null,
        confidence: 'medium',
        score: 70,
        avatarUrl: picture?.replace('_normal.', '_400x400.') ?? null,
        evidence: `X search for “${name}”. Confirm it is them.`,
      });
      if (hits.length >= 8) break;
    }
    return hits;
  } catch {
    return [];
  } finally {
    clearTimeout(timer);
  }
}

/** GitHub accounts for a typed name or login. Nothing is confirmed. */
export async function githubUsersByName(query: string): Promise<AccountHit[]> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    const response = await fetch(`https://api.github.com/search/users?q=${encodeURIComponent(query)}&per_page=5`, {
      signal: controller.signal,
      headers: { Accept: 'application/vnd.github+json', 'User-Agent': 'Glance/1.0' },
    });
    if (!response.ok) return [];
    const json = (await response.json()) as { items?: { login?: string; avatar_url?: string }[] };
    const hits: AccountHit[] = [];
    for (const item of json.items ?? []) {
      const login = item.login ?? '';
      if (!login) continue;
      const profile = await fetchPublicProfile('github', login);
      hits.push({
        platform: 'github',
        value: login,
        url: profileUrl('github', login),
        displayName: profile?.displayName || login,
        bio: profile?.bio ?? null,
        confidence: 'medium',
        score: 60,
        avatarUrl: profile?.avatarUrl || item.avatar_url || null,
        evidence: `GitHub search for “${query}”. Confirm it is them.`,
      });
    }
    return hits;
  } catch {
    return [];
  } finally {
    clearTimeout(timer);
  }
}

/** Look up the same person on the other public profiles Glance can read. Nothing is confirmed. */
export async function discoverAccounts(platform: string, value: string, twitterKey?: string, knownName?: string, dossier?: ProfileDossier | null): Promise<DiscoverResult> {
  const hits: AccountHit[] = [];
  const seen = new Set<string>([`${platform}:${value.toLowerCase()}`]);
  let anchorName: string | null = null;
  let anchorBio: string | null = null;
  let profile: PublicProfile | null = null;
  try {
    profile = await fetchPublicProfile(platform, value, twitterKey);
  } catch {
    profile = null;
  }
  if (dossier && !anchorName) anchorName = dossier.name;
  if (dossier && !anchorBio) anchorBio = dossier.about || dossier.headline;
  if (dossier) {
    for (const found of handlesInText(dossierSearchText(dossier))) {
      if (found.platform === platform && found.value.toLowerCase() === value.toLowerCase()) continue;
      add(hits, seen, {
        platform: found.platform as Platform,
        value: found.value,
        url: profileUrl(found.platform, found.value),
        displayName: null,
        bio: null,
        confidence: 'high',
        score: 92,
        evidence: 'Linked from their profile. Confirm it is the same person.',
      });
    }
  }
  if (usable(profile)) {
    anchorName = profile.displayName || anchorName;
    anchorBio = profile.bio || anchorBio;
    for (const found of handlesInText(`${profile.bio ?? ''}\n${profile.raw}`)) {
      if (found.platform === platform && found.value.toLowerCase() === value.toLowerCase()) continue;
      add(hits, seen, {
        platform: found.platform as Platform,
        value: found.value,
        url: profileUrl(found.platform, found.value),
        displayName: null,
        bio: null,
        confidence: 'high',
        score: 92,
        evidence: 'Linked from their public bio. Confirm it is the same person.',
      });
    }
  }
  const webPaths = [`${platform === 'x' ? 'twitter' : platform}/${encodeURIComponent(value)}`, `${encodeURIComponent(value)}.eth`];
  for (const path of webPaths) {
  for (const found of await fromWeb3Bio(path)) {
    if (!OTHERS.includes(found.platform as Platform)) continue;
    add(hits, seen, {
      platform: found.platform as Platform,
      value: found.value,
      url: profileUrl(found.platform, found.value),
      displayName: null,
      bio: null,
      confidence: 'medium',
      score: 74,
      evidence: 'Listed beside this profile on web3.bio. Confirm it is the same person.',
    });
  }
  }
  const handle = value.replace(/^@/, '');
  for (const other of OTHERS) {
    if (other === platform) continue;
    const checked = validateHandle(other, handle);
    if (!checked.ok) continue;
    const key = `${other}:${checked.value.toLowerCase()}`;
    if (seen.has(key)) continue;
    let otherProfile: PublicProfile | null = null;
    try {
      otherProfile = await fetchPublicProfile(other, checked.value, twitterKey);
    } catch {
      otherProfile = null;
    }
    if (!usable(otherProfile)) continue;
    const close = nameOverlap(anchorName, otherProfile.displayName);
    add(hits, seen, {
      platform: other,
      value: checked.value,
      url: profileUrl(other, checked.value),
      displayName: otherProfile.displayName,
      bio: otherProfile.bio,
      confidence: close ? 'high' : 'medium',
      score: close ? 86 : 58,
      avatarUrl: otherProfile.avatarUrl,
      evidence: `Same handle @${checked.value} has a public ${other} profile${otherProfile.displayName ? `: ${otherProfile.displayName}` : ''}. Confirm it is them.`,
    });
    if (other === 'github') await addLinksFromText(hits, seen, await githubLinks(checked.value), `the GitHub profile ${checked.value}`);
  }
  if (platform === 'github') await addLinksFromText(hits, seen, await githubLinks(value), 'their GitHub profile');
  await addPublishedContacts(hits, seen, `${anchorBio ?? ''}\n${dossier ? dossierSearchText(dossier) : ''}`);
  if (!anchorName && knownName && knownName !== 'Unknown' && !knownName.startsWith('@')) anchorName = knownName;
  if (anchorName && platform !== 'x' && twitterKey) {
    for (const hit of await xUsersByName(anchorName, twitterKey)) add(hits, seen, hit);
  }
  if (anchorName) await addNameMatches(hits, seen, anchorName, handle, twitterKey);
  const ranked = hits.map((hit) => {
    const next = scoreWithDossier(hit, dossier ?? null);
    return { ...hit, score: next.score, evidence: next.evidence };
  });
  return { hits: topPerPlatform(ranked), anchorName, anchorBio };
}

function topPerPlatform(hits: AccountHit[]): AccountHit[] {
  const grouped = new Map<string, AccountHit[]>();
  for (const hit of [...hits].sort((a, b) => b.score - a.score)) {
    const list = grouped.get(hit.platform) ?? [];
    if (list.length >= 8) continue;
    list.push(hit);
    grouped.set(hit.platform, list);
  }
  return [...grouped.values()].flat();
}

async function addPublishedContacts(hits: AccountHit[], seen: Set<string>, text: string): Promise<void> {
  for (const phone of phonesInText(text)) {
    add(hits, seen, {
      platform: 'whatsapp',
      value: phone,
      url: profileUrl('whatsapp', phone),
      displayName: null,
      bio: null,
      confidence: 'high',
      score: 90,
      evidence: 'Phone number published on their public profile. Confirm it is theirs.',
    });
  }
}

async function githubLinks(login: string): Promise<string> {
  try {
    const response = await fetch(`https://api.github.com/users/${encodeURIComponent(login)}`, {
      headers: { Accept: 'application/vnd.github+json', 'User-Agent': 'Glance/1.0' },
    });
    if (!response.ok) return '';
    const json = (await response.json()) as { twitter_username?: string | null; blog?: string | null; bio?: string | null };
    const lines = [json.bio ?? '', json.blog ?? ''];
    if (json.twitter_username) lines.push(`https://x.com/${json.twitter_username.replace(/^@/, '')}`);
    return lines.filter(Boolean).join('\n');
  } catch {
    return '';
  }
}

async function addLinksFromText(hits: AccountHit[], seen: Set<string>, text: string, where: string): Promise<void> {
  for (const found of handlesInText(text)) {
    add(hits, seen, {
      platform: found.platform as Platform,
      value: found.value,
      url: profileUrl(found.platform, found.value),
      displayName: null,
      bio: null,
      confidence: 'medium',
      score: 84,
      evidence: `Linked from ${where}. Confirm it is the same person.`,
    });
  }
  await addPublishedContacts(hits, seen, text);
}

async function addLinkedInByName(hits: AccountHit[], seen: Set<string>, name: string, twitterKey?: string): Promise<void> {
  for (const slug of nameSlugs(name)) {
    const checked = validateHandle('linkedin', slug);
    if (!checked.ok || seen.has(`linkedin:${checked.value.toLowerCase()}`)) continue;
    let profile: PublicProfile | null = null;
    try {
      profile = await fetchPublicProfile('linkedin', checked.value, twitterKey);
    } catch {
      profile = null;
    }
    if (!usable(profile) || !nameOverlap(name, profile.displayName)) continue;
    add(hits, seen, {
      platform: 'linkedin',
      value: checked.value,
      url: profileUrl('linkedin', checked.value),
      displayName: profile.displayName,
      bio: profile.bio,
      avatarUrl: profile.avatarUrl,
      confidence: 'medium',
      score: 70,
      evidence: `Public LinkedIn name matches ${name}. Confirm it is them.`,
    });
  }
}

async function addNameMatches(hits: AccountHit[], seen: Set<string>, name: string, handle: string, twitterKey?: string): Promise<void> {
  const names = new Set<string>([name]);
  try {
    const response = await fetch(`https://api.github.com/search/users?q=${encodeURIComponent(`${name} in:name`)}&per_page=5`, {
      headers: { Accept: 'application/vnd.github+json', 'User-Agent': 'Glance/1.0' },
    });
    if (response.ok) {
      const json = (await response.json()) as { items?: { login?: string }[] };
      for (const item of (json.items ?? []).slice(0, 5)) {
        const login = item.login ?? '';
        if (!login || seen.has(`github:${login.toLowerCase()}`)) continue;
        const profile = await fetchPublicProfile('github', login);
        if (!usable(profile)) continue;
        const same = login.toLowerCase() === handle.toLowerCase();
        const shared = name.toLowerCase().split(/\W+/).filter((word) => word.length > 2 && (profile.displayName ?? '').toLowerCase().split(/\W+/).includes(word)).length;
        if (!same && shared < 2 && !(shared >= 1 && login.toLowerCase().includes(handle.toLowerCase()))) continue;
        if (profile.displayName) names.add(profile.displayName);
        add(hits, seen, {
          platform: 'github',
          value: login,
          url: profileUrl('github', login),
          displayName: profile.displayName,
          bio: profile.bio,
          avatarUrl: profile.avatarUrl,
          confidence: same ? 'high' : 'medium',
          score: same ? 88 : 64,
          evidence: `GitHub name matches ${name}. Confirm it is them.`,
        });
        await addLinksFromText(hits, seen, await githubLinks(login), `the GitHub profile ${login}`);
      }
    }
  } catch {
    // A failed name search still leaves the same-handle results.
  }
  for (const candidate of names) await addLinkedInByName(hits, seen, candidate, twitterKey);
}

export function evidenceLabel(json: string | null): string {
  if (!json) return '';
  try {
    const parsed = JSON.parse(json) as unknown;
    if (parsed && typeof parsed === 'object' && 'note' in parsed) return String((parsed as { note: unknown }).note ?? '');
    if (Array.isArray(parsed)) {
      return parsed
        .map((item) => (item && typeof item === 'object' && 'detail' in item ? String((item as { detail: unknown }).detail ?? '') : ''))
        .filter(Boolean)
        .join(' · ');
    }
  } catch {
    return '';
  }
  return '';
}
