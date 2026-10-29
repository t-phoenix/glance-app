import { isLinkedInProfilePhoto, linkedinPhotoFromText } from '@/src/services/linkedinDirectory';
import { scoreCandidate } from '@/src/services/scorer';

export interface ProfileLink {
  url: string;
}

export interface ProfileRole {
  title: string;
  company: string | null;
  dates: string | null;
}

export interface ProfileSchool {
  school: string;
  degree: string | null;
  dates: string | null;
}

export interface ProfileDossier {
  platform: 'x' | 'linkedin';
  value: string;
  name: string | null;
  photo: string | null;
  headline: string | null;
  about: string | null;
  location: string | null;
  company: string | null;
  links: ProfileLink[];
  phone: string | null;
  experience: ProfileRole[];
  education: ProfileSchool[];
  /** Set when the saved file is the scanned member's LinkedIn photo, not a picture from the page. */
  photoSource?: 'profile';
}

function clean(value: string): string {
  return value.replace(/\\u0026/g, '&').replace(/&amp;/g, '&').replace(/&#39;|&apos;/g, "'").replace(/&quot;/g, '"').replace(/\s+/g, ' ').trim();
}

function plain(value: unknown): string | null {
  if (typeof value === 'string') {
    const text = clean(value);
    return text || null;
  }
  if (value && typeof value === 'object' && 'text' in value) return plain((value as { text: unknown }).text);
  return null;
}

function named(value: unknown): string | null {
  const direct = plain(value);
  if (direct) return direct;
  if (value && typeof value === 'object' && 'name' in value) return plain((value as { name: unknown }).name);
  return null;
}

function usablePhoto(url: string | null | undefined): string | null {
  if (!url) return null;
  if (url.startsWith('file:')) return url;
  if (url.startsWith('data:image/') && url.length > 32 && url.length < 400_000) return url;
  if (!/^https?:\/\//i.test(url)) return null;
  if (/ghost-img|company-logo|static\.licdn\.com\/aero|background_|feedshare/i.test(url)) return null;
  return url;
}

function faceUrl(platform: 'x' | 'linkedin', url: string | null): string | null {
  if (!url) return null;
  if (url.startsWith('file:') || url.startsWith('data:image/')) return usablePhoto(url);
  if (platform === 'linkedin') return isLinkedInProfilePhoto(url) ? url : null;
  return usablePhoto(url);
}

function savedFace(url: string | null): boolean {
  return Boolean(url?.startsWith('file:') || url?.startsWith('data:image/'));
}

function bestPhoto(platform: 'x' | 'linkedin', next: string | null, current: string | null): string | null {
  const incoming = faceUrl(platform, next);
  const saved = faceUrl(platform, current);
  if (savedFace(incoming)) return incoming;
  if (savedFace(saved)) return saved;
  if (platform === 'linkedin' && saved && incoming) return saved;
  return incoming || saved;
}

function longer(next: string | null, current: string | null): string | null {
  if (!next) return current;
  if (!current) return next;
  return next.length >= current.length ? next : current;
}

function years(value: unknown): string | null {
  if (!value || typeof value !== 'object') return null;
  const range = value as { start?: { year?: number }; end?: { year?: number } };
  const start = range.start?.year;
  const end = range.end?.year;
  if (start && end) return `${start} – ${end}`;
  if (start) return `${start} – now`;
  return end ? String(end) : null;
}

function phoneFrom(value: string | null): string | null {
  if (!value) return null;
  const match = value.match(/\+\d[\d\s().-]{6,16}\d/);
  if (!match) return null;
  const digits = match[0].replace(/[^\d]/g, '');
  if (digits.length < 8 || digits.length > 15) return null;
  return `+${digits}`;
}

function pushLink(links: ProfileLink[], seen: Set<string>, url: string | null) {
  if (!url || !/^https?:\/\//i.test(url)) return;
  const key = url.split('?')[0]?.toLowerCase() ?? url;
  if (seen.has(key) || /linkedin\.com\/(feed|login|signup)/i.test(key)) return;
  seen.add(key);
  links.push({ url });
}

/** A confirm can continue only when the face and the name both loaded. */
export function profileReady(dossier: ProfileDossier | null): boolean {
  if (!dossier?.name?.trim() || !dossier.photo) return false;
  return Boolean(faceUrl(dossier.platform, dossier.photo));
}

export function richness(dossier: ProfileDossier): number {
  return (dossier.about ? 2 : 0) + (dossier.headline ? 1 : 0) + (dossier.location ? 1 : 0) + (dossier.phone ? 1 : 0) + dossier.experience.length + dossier.education.length + dossier.links.length + (profileReady(dossier) ? 4 : 0);
}

/** Keep a saved face when a later read comes back without one, and keep the fuller text either way. */
export function preferDossier(current: ProfileDossier | null, next: ProfileDossier | null): ProfileDossier | null {
  if (!next) return current;
  if (!current || current.platform !== next.platform || current.value.toLowerCase() !== next.value.toLowerCase()) return next;
  const photo = bestPhoto(next.platform, next.photo, current.photo);
  const photoSource = photo && photo === next.photo && next.photoSource === 'profile' ? 'profile' : photo && photo === current.photo && current.photoSource === 'profile' ? 'profile' : undefined;
  return {
    platform: next.platform,
    value: next.value || current.value,
    name: next.name || current.name,
    photo,
    headline: next.headline || current.headline,
    about: longer(next.about, current.about),
    location: next.location || current.location,
    company: next.company || current.company,
    links: next.links.length ? next.links : current.links,
    phone: next.phone || current.phone,
    experience: next.experience.length ? next.experience : current.experience,
    education: next.education.length ? next.education : current.education,
    photoSource,
  };
}

/** The face, name, and bio already shown on a search card, before the fuller profile read. */
export function dossierFromKnown(input: { platform: string; value: string; name?: string | null; bio?: string | null; photo?: string | null; company?: string | null }): ProfileDossier | null {
  if ((input.platform !== 'x' && input.platform !== 'linkedin') || !input.value) return null;
  const name = plain(input.name);
  const bio = plain(input.bio);
  const photo = faceUrl(input.platform, input.photo ?? null);
  if (!name && !bio && !photo) return null;
  return {
    platform: input.platform,
    value: input.value,
    name,
    photo,
    headline: input.platform === 'linkedin' ? bio : null,
    about: input.platform === 'x' ? bio : null,
    location: null,
    company: plain(input.company),
    links: [],
    phone: null,
    experience: [],
    education: [],
  };
}

export function serializeDossier(dossier: ProfileDossier): string {
  return JSON.stringify(dossier);
}

export function parseDossier(raw: string | null | undefined): ProfileDossier | null {
  if (!raw || !raw.startsWith('{')) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<ProfileDossier>;
    if (parsed.platform !== 'x' && parsed.platform !== 'linkedin') return null;
    if (typeof parsed.value !== 'string' || !parsed.value) return null;
    return {
      platform: parsed.platform,
      value: parsed.value,
      name: plain(parsed.name),
      photo: usablePhoto(typeof parsed.photo === 'string' ? parsed.photo : null),
      headline: plain(parsed.headline),
      about: plain(parsed.about),
      location: plain(parsed.location),
      company: plain(parsed.company),
      links: Array.isArray(parsed.links) ? parsed.links.filter((link): link is ProfileLink => Boolean(link && typeof link.url === 'string' && /^https?:\/\//i.test(link.url))) : [],
      phone: phoneFrom(typeof parsed.phone === 'string' ? parsed.phone : null),
      experience: Array.isArray(parsed.experience) ? parsed.experience.flatMap((item) => {
        if (!item || typeof item !== 'object') return [];
        const title = plain((item as ProfileRole).title);
        if (!title) return [];
        return [{ title, company: plain((item as ProfileRole).company), dates: plain((item as ProfileRole).dates) }];
      }) : [],
      education: Array.isArray(parsed.education) ? parsed.education.flatMap((item) => {
        if (!item || typeof item !== 'object') return [];
        const school = plain((item as ProfileSchool).school);
        if (!school) return [];
        return [{ school, degree: plain((item as ProfileSchool).degree), dates: plain((item as ProfileSchool).dates) }];
      }) : [],
      photoSource: parsed.photoSource === 'profile' ? 'profile' : undefined,
    };
  } catch {
    return null;
  }
}

/** Text the matcher can read. The phone stays in the dossier and is included here for the on-device lookup only. */
export function dossierSearchText(dossier: ProfileDossier): string {
  return [
    dossier.about,
    dossier.headline,
    dossier.location,
    dossier.company,
    dossier.phone,
    ...dossier.links.map((link) => link.url),
    ...dossier.experience.map((role) => `${role.title} ${role.company ?? ''}`),
  ].filter(Boolean).join('\n');
}

export function matchBrief(input: { platform: string; value: string; name: string | null; dossier: ProfileDossier | null }): string {
  const dossier = input.dossier;
  const lines = [
    `Primary ${input.platform} ${input.value}.`,
    `Name: ${input.name ?? dossier?.name ?? ''}.`,
    dossier?.headline ? `Headline: ${dossier.headline}.` : '',
    dossier?.company ? `Company: ${dossier.company}.` : '',
    dossier?.location ? `Location: ${dossier.location}.` : '',
    dossier?.about ? `About: ${dossier.about.slice(0, 500)}.` : '',
    dossier?.links.length ? `Links: ${dossier.links.map((link) => link.url).join(' ')}.` : '',
  ];
  return lines.filter(Boolean).join(' ');
}

export function mentionsCompany(text: string | null, company: string | null): boolean {
  const name = company?.trim();
  if (!name || name.length < 3 || !text) return false;
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`\\b${escaped}\\b`, 'i').test(text);
}

export function mentionsPlace(text: string | null, location: string | null): boolean {
  const place = location?.split(',')[0]?.trim();
  if (!place || place.length < 4 || !text) return false;
  const escaped = place.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`\\b${escaped}\\b`, 'i').test(text);
}

/** Raise a suggestion when the candidate shares the primary company or city. Never selects it. */
export function scoreWithDossier(
  hit: { score: number; evidence: string; bio: string | null; displayName: string | null },
  dossier: ProfileDossier | null,
): { score: number; evidence: string } {
  if (!dossier) return { score: hit.score, evidence: hit.evidence };
  const blob = `${hit.bio ?? ''} ${hit.displayName ?? ''}`;
  let score = hit.score;
  let evidence = hit.evidence;
  if (mentionsCompany(blob, dossier.company)) {
    const ranked = scoreCandidate({
      linkedFromConfirmedBio: false,
      postedAboutEventThisWeek: false,
      nameMatch: true,
      sameCompanyDomain: true,
      avatarLooksSimilar: false,
      previouslyRejected: false,
    });
    score = Math.max(score, Math.round(ranked.score * 100));
    if (dossier.company && !evidence.includes(dossier.company)) evidence = `${evidence} Same company ${dossier.company}.`.trim();
  }
  if (mentionsPlace(blob, dossier.location)) {
    score = Math.min(100, score + 8);
    const place = dossier.location?.split(',')[0]?.trim();
    if (place && !evidence.includes(place)) evidence = `${evidence} Same place ${place}.`.trim();
  }
  return { score, evidence };
}

function recordsOf(payload: unknown): Record<string, unknown>[] {
  const found: Record<string, unknown>[] = [];
  const walk = (node: unknown, depth: number) => {
    if (depth > 14 || !node || typeof node !== 'object') return;
    if (Array.isArray(node)) {
      for (const item of node) walk(item, depth + 1);
      return;
    }
    const record = node as Record<string, unknown>;
    found.push(record);
    if (found.length > 400) return;
    for (const value of Object.values(record)) walk(value, depth + 1);
  };
  walk(payload, 0);
  return found;
}

function photoOf(record: Record<string, unknown>): string | null {
  const picture = record.profilePicture ?? record.displayImage;
  if (typeof picture === 'string') return isLinkedInProfilePhoto(picture) ? picture : null;
  if (!picture || typeof picture !== 'object') return null;
  const raw = JSON.stringify(picture);
  if (raw.length > 80000) return null;
  return linkedinPhotoFromText(raw);
}

/** The picture is sometimes a separate record. Follow this profile's asset id, and skip every other member. */
function linkedPhoto(profile: Record<string, unknown>, records: Record<string, unknown>[]): string | null {
  const inline = photoOf(profile);
  if (inline) return inline;
  const asset = JSON.stringify(profile.profilePicture ?? profile.displayImage ?? '').match(/digitalmediaAsset:([A-Za-z0-9_-]+)/)?.[1];
  if (!asset) return null;
  for (const record of records) {
    const raw = JSON.stringify(record);
    if (raw.length > 80000 || !raw.includes(asset) || !raw.includes('rootUrl')) continue;
    if (raw.includes('"publicIdentifier"') || raw.includes('"vanityName"')) continue;
    const url = linkedinPhotoFromText(raw);
    if (url) return url;
  }
  return null;
}

function emptyDossier(platform: 'x' | 'linkedin', value: string): ProfileDossier {
  return { platform, value, name: null, photo: null, headline: null, about: null, location: null, company: null, links: [], phone: null, experience: [], education: [] };
}

/** People, jobs, schools, and contact fields from a signed-in LinkedIn response. */
export function linkedinDossierFromPayload(payload: unknown, slug: string): ProfileDossier {
  const dossier = emptyDossier('linkedin', slug);
  const records = recordsOf(payload);
  const profile = records.find((record) => {
    const id = plain(record.publicIdentifier) || plain(record.vanityName);
    return id?.toLowerCase() === slug.toLowerCase();
  });
  if (profile) {
    const first = plain(profile.firstName);
    const last = plain(profile.lastName);
    dossier.name = clean(`${first ?? ''} ${last ?? ''}`) || plain(profile.name) || null;
    dossier.headline = plain(profile.headline);
    dossier.about = plain(profile.summary) || plain(profile.about);
    dossier.location = plain(profile.geoLocationName) || plain(profile.locationName) || named(profile.geoLocation) || plain(profile.location);
    dossier.photo = linkedPhoto(profile, records);
  }
  const seenJobs = new Set<string>();
  const seenSchools = new Set<string>();
  const seenLinks = new Set<string>();
  for (const record of records) {
    const title = plain(record.title);
    const company = named(record.companyName) || named(record.company);
    if (title && company && title.length < 120 && !/profile|sign in/i.test(title)) {
      const key = `${title}|${company}`.toLowerCase();
      if (!seenJobs.has(key) && dossier.experience.length < 8) {
        seenJobs.add(key);
        dossier.experience.push({ title, company, dates: years(record.dateRange) || years(record.date) });
      }
    }
    const school = named(record.schoolName) || named(record.school);
    if (school && school.length < 160) {
      const key = school.toLowerCase();
      if (!seenSchools.has(key) && dossier.education.length < 6) {
        seenSchools.add(key);
        dossier.education.push({ school, degree: plain(record.degreeName) || plain(record.degree), dates: years(record.dateRange) });
      }
    }
    const phone = phoneFrom(plain(record.number) || plain(record.phoneNumber) || (typeof record.phoneNumber === 'object' ? plain((record.phoneNumber as { number?: unknown }).number) : null));
    if (phone && !dossier.phone) dossier.phone = phone;
    const url = plain(record.url);
    const ownProfile = url ? new RegExp(`linkedin\\.com\\/in\\/${slug}\\b`, 'i').test(url) : false;
    pushLink(dossier.links, seenLinks, ownProfile ? null : url);
    pushLink(dossier.links, seenLinks, plain(record.website));
  }
  if (!dossier.company) dossier.company = dossier.experience[0]?.company ?? companyFromHeadline(dossier.headline);
  return dossier;
}

function companyFromHeadline(headline: string | null): string | null {
  if (!headline) return null;
  const at = headline.match(/\bat\s+([^|·,]{2,80})$/i)?.[1]?.trim();
  return at || null;
}

function meta(html: string, key: string): string | null {
  const patterns = [
    new RegExp(`<meta[^>]+(?:property|name)=["']${key}["'][^>]+content=["']([^"']+)["']`, 'i'),
    new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']${key}["']`, 'i'),
  ];
  for (const pattern of patterns) {
    const found = pattern.exec(html)?.[1];
    if (found) return clean(found);
  }
  return null;
}

function assetIdOf(profile: Record<string, unknown> | undefined): string | null {
  if (!profile) return null;
  const raw = JSON.stringify(profile.profilePicture ?? profile.displayImage ?? '');
  return raw.match(/digitalmediaAsset:([A-Za-z0-9_-]+)/)?.[1]
    ?? raw.match(/([A-Za-z0-9]{2,}03AQ[A-Za-z0-9_-]{2,})/)?.[1]
    ?? null;
}

/** The scanned member's picture. A URL is used only when it contains that member's photo id. */
export function linkedinMemberPhoto(slug: string, payloads: unknown[], html: string, fallback: string | null = null): string | null {
  const profile = payloads.flatMap((payload) => recordsOf(payload)).find((record) => {
    const id = plain(record.publicIdentifier) || plain(record.vanityName);
    return id?.toLowerCase() === slug.toLowerCase();
  });
  const asset = assetIdOf(profile);
  if (!asset) return fallback && isLinkedInProfilePhoto(fallback) ? fallback : null;
  const decoded = html.replace(/&amp;/g, '&').replace(/\\\//g, '/').replace(/\\u0026/g, '&');
  const urls = [...decoded.matchAll(/https:\/\/media\.licdn\.com\/dms\/image\/[^"'\s<>\\]+/g)]
    .map((match) => match[0] ?? '')
    .filter((url) => url.includes(asset) && isLinkedInProfilePhoto(url));
  const page = urls.find((url) => /200_200|400_400|800_800|shrink_200|shrink_400|shrink_800/.test(url)) ?? urls[0] ?? null;
  if (page) return page;
  return fallback && isLinkedInProfilePhoto(fallback) && fallback.includes(asset) ? fallback : null;
}

/** One scanned or tapped LinkedIn account. The photo is that member's, never the signed-in page image. */
export function assembleLinkedInDossier(slug: string, payloads: unknown[], html: string): ProfileDossier | null {
  const fromPage = html ? linkedinDossierFromHtml(html, slug) : null;
  const fromApi = payloads.map((payload) => linkedinDossierFromPayload(payload, slug));
  const merged = fromApi.reduce<ProfileDossier | null>((current, next) => preferDossier(current, next), fromPage);
  if (!merged) return null;
  const face = linkedinMemberPhoto(slug, payloads, html, fromApi.find((item) => item.photo && isLinkedInProfilePhoto(item.photo))?.photo ?? null);
  return {
    ...merged,
    name: fromApi.find((item) => item.name)?.name ?? merged.name,
    headline: fromApi.find((item) => item.headline)?.headline ?? merged.headline,
    about: fromApi.find((item) => item.about)?.about ?? merged.about,
    photo: face,
  };
}

/** Name and photo from a signed-in profile page when the API shape is thin. */
export function linkedinDossierFromHtml(html: string, slug: string): ProfileDossier {
  const dossier = emptyDossier('linkedin', slug);
  const title = meta(html, 'og:title') || html.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1] || null;
  if (title && !/sign in|join linkedin|authwall/i.test(title)) {
    const withoutSite = clean(title).replace(/\s*\|\s*LinkedIn\s*$/i, '');
    const [name, ...rest] = withoutSite.split(' - ');
    dossier.name = name?.trim() || null;
    dossier.headline = rest.join(' - ').trim() || null;
  }
  dossier.about = meta(html, 'og:description');
  const image = meta(html, 'og:image');
  dossier.photo = image && isLinkedInProfilePhoto(image) ? image : null;
  dossier.company = companyFromHeadline(dossier.headline);
  return dossier;
}

function xPhoto(value: unknown): string | null {
  const url = plain(value);
  if (!url) return null;
  const sized = url.replace('_normal.', '_400x400.');
  return usablePhoto(sized);
}

/** Name, photo, bio, location, and links from an X user record. */
export function xDossierFromRecord(record: unknown, value: string): ProfileDossier {
  const dossier = emptyDossier('x', value.replace(/^@/, '').toLowerCase());
  const row = record && typeof record === 'object' ? record as Record<string, unknown> : {};
  const data = row.data && typeof row.data === 'object' ? row.data as Record<string, unknown> : row;
  dossier.name = plain(data.name);
  dossier.about = plain(data.description) || plain(data.bio);
  dossier.location = plain(data.location);
  dossier.photo = xPhoto(data.profilePicture) || xPhoto(data.profile_image_url) || xPhoto(data.profile_image_url_https);
  const website = plain(data.url) || plain(data.website);
  const seen = new Set<string>();
  pushLink(dossier.links, seen, website && /twitter\.com|x\.com/i.test(website) ? null : website);
  const entities = data.entities && typeof data.entities === 'object' ? data.entities as { description?: { urls?: { expanded_url?: string; url?: string }[] }; url?: { urls?: { expanded_url?: string }[] } } : null;
  for (const item of entities?.description?.urls ?? []) pushLink(dossier.links, seen, plain(item.expanded_url) || plain(item.url));
  for (const item of entities?.url?.urls ?? []) pushLink(dossier.links, seen, plain(item.expanded_url));
  return dossier;
}
