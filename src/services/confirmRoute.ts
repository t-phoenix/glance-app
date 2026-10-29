import { anchorFromQr, classifyQr } from '@/src/parsers/qr';
import { profileUrl } from '@/src/services/followupLinks';

export interface ConfirmRequest {
  platform: 'x' | 'linkedin';
  value: string;
  url: string;
  name: string;
  company: string;
  hint: string;
  photo: string;
  bio: string;
  nonce: string;
}

let current: ConfirmRequest | null = null;
const watchers = new Set<() => void>();

/** Remember the account this scan opened. The confirm screen reads this, not a previous visit. */
export function stageConfirm(request: ConfirmRequest): void {
  current = request;
  for (const watch of watchers) watch();
}

export function latestConfirm(): ConfirmRequest | null {
  return current;
}

export function watchConfirm(watch: () => void): () => void {
  watchers.add(watch);
  return () => { watchers.delete(watch); };
}

/** A direct profile QR is that profile. A link that still needs a redirect is left for the resolver. */
export function accountFromScan(raw: string): { platform: 'x' | 'linkedin'; value: string; url: string } | null {
  const qr = classifyQr(raw.trim().replace(/\0/g, ''));
  if (qr.kind !== 'x' && qr.kind !== 'linkedin') return null;
  const anchor = anchorFromQr(qr);
  if (!anchor || (anchor.platform !== 'x' && anchor.platform !== 'linkedin') || !anchor.value) return null;
  return { platform: anchor.platform, value: anchor.value, url: anchor.url || profileUrl(anchor.platform, anchor.value) };
}

/** Drop a dossier that belongs to a different account than the one on screen. */
export function sameAccount(dossier: { platform: string; value: string } | null | undefined, platform: string, value: string): boolean {
  return !!dossier && !!value && dossier.platform === platform && dossier.value.toLowerCase() === value.toLowerCase();
}
