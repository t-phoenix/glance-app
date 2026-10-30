import type { GlanceRepository } from '@/src/db/repository';
import type { Platform } from '@/src/parsers/handles';
import { anchorFromQr } from '@/src/parsers/qr';
import { profileUrl } from '@/src/services/followupLinks';
import { parseDossier, preferDossier, serializeDossier, type ProfileDossier } from '@/src/services/profileDossier';
import { fetchPublicProfile } from '@/src/services/profiles';
import { resolveQr } from '@/src/services/qrResolve';

const PRIMARY = new Set(['x', 'linkedin', 'telegram', 'whatsapp', 'github', 'farcaster']);

export function isPrimaryPlatform(platform: string): platform is Platform {
  return PRIMARY.has(platform);
}

/** Prefer the photo already shown in search. Skip logos and placeholder images. */
export function chooseProfilePhoto(known: string | null | undefined, fetched: string | null | undefined): string | null {
  const usable = (url: string | null | undefined) => {
    if (!url || !/^https?:\/\//i.test(url)) return null;
    if (/ghost-img|company-logo|static\.licdn\.com\/aero|background_|feedshare/i.test(url)) return null;
    return url;
  };
  return usable(known) || usable(fetched);
}

/** Face shown in lists and on the person page. Event photos are not this picture. */
export function primaryProfilePhoto(
  personPhoto: string | null | undefined,
  handles: { status: string; platform: string; avatar_uri: string | null }[],
): string | null {
  const linked = handles.filter((handle) => (handle.status === 'anchor' || handle.status === 'confirmed') && handle.platform !== 'web' && handle.avatar_uri);
  const primary = linked.find((handle) => handle.status === 'anchor') ?? linked[0];
  if (primary?.avatar_uri) return primary.avatar_uri;
  if (personPhoto && /^https?:\/\//i.test(personPhoto)) return personPhoto;
  return null;
}

/** Save the resolved profile onto the person: name, bio, photo, and the real account link. */
export async function fillPrimaryAccount(
  repo: GlanceRepository,
  personId: string,
  platform: Platform,
  value: string,
  url: string | null | undefined,
  twitterKey?: string,
  typedName?: string,
  known?: { avatarUrl?: string | null; bio?: string | null; displayName?: string | null },
): Promise<boolean> {
  let profile: Awaited<ReturnType<typeof fetchPublicProfile>> = null;
  try {
    profile = await fetchPublicProfile(platform, value, twitterKey);
  } catch {
    profile = null;
  }
  const person = repo.person(personId);
  const link = url || profileUrl(platform, value);
  const generated = !person?.display_name || person.display_name === 'Unknown' || person.display_name.startsWith('@') || person.display_name.includes('/');
  const face = chooseProfilePhoto(known?.avatarUrl, profile?.avatarUrl);
  const bio = profile?.bio || known?.bio || person?.summary || undefined;
  repo.updatePerson(personId, {
    display_name: typedName || (generated ? profile?.displayName || known?.displayName || person?.display_name : person?.display_name) || undefined,
    real_name: profile?.displayName || known?.displayName || person?.real_name || undefined,
    summary: bio,
    photo_uri: face || (person?.photo_uri && /^https?:\/\//i.test(person.photo_uri) ? person.photo_uri : undefined),
  });
  const handle = repo.handles(personId).find((row) => row.platform === platform && row.value.toLowerCase() === value.toLowerCase());
  if (!handle) return false;
  repo.updateHandle(handle.id, {
    displayName: profile?.displayName || known?.displayName || undefined,
    bio: profile?.bio || known?.bio || undefined,
    avatarUri: face ?? undefined,
    url: link,
    source: profile?.raw || (face ? 'search' : 'profile'),
  });
  return Boolean(profile?.displayName || known?.displayName || profile?.bio || known?.bio || face);
}

/** Save the X or LinkedIn dossier on the anchor and copy the compact fields onto the person. */
export function applyDossier(repo: GlanceRepository, personId: string, next: ProfileDossier): void {
  const handle = repo.handles(personId).find((row) => row.platform === next.platform && row.value.toLowerCase() === next.value.toLowerCase());
  const dossier = preferDossier(parseDossier(handle?.raw_json), next);
  if (!dossier) return;
  repo.updatePerson(personId, {
    display_name: dossier.name || undefined,
    real_name: dossier.name || undefined,
    summary: dossier.about || undefined,
    photo_uri: dossier.photo || undefined,
    company: dossier.company || undefined,
    role: dossier.headline || undefined,
  });
  if (!handle) return;
  repo.updateHandle(handle.id, {
    displayName: dossier.name || undefined,
    bio: dossier.about || dossier.headline || undefined,
    avatarUri: dossier.photo || undefined,
    url: profileUrl(dossier.platform, dossier.value),
    source: dossier.platform === 'linkedin' ? 'linkedin-profile' : 'x-profile',
    profile: serializeDossier(dossier),
  });
}

/** A saved page link is not the account. Follow it once and replace the anchor. */
export async function upgradeWebAnchor(repo: GlanceRepository, personId: string, twitterKey?: string): Promise<boolean> {
  const anchor = repo.handles(personId).find((handle) => handle.status === 'anchor' || handle.status === 'pending_offline');
  if (!anchor || anchor.platform !== 'web') return false;
  const resolved = await resolveQr(anchor.url || anchor.value);
  const next = anchorFromQr(resolved);
  if (!next || !isPrimaryPlatform(next.platform)) return false;
  repo.updateHandle(anchor.id, { status: 'suggested' });
  repo.upsertHandle({
    personId,
    platform: next.platform,
    value: next.value,
    url: next.url ?? null,
    status: 'anchor',
    source: 'resolve',
  });
  return fillPrimaryAccount(repo, personId, next.platform, next.value, next.url, twitterKey);
}
