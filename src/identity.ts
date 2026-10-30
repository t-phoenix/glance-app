/** Names the installed app stores. Legacy names are read once so a copy from the previous install still opens. */

export const BUNDLE_ID = 'xyz.abhinil.glance';
export const LEGACY_BUNDLE_ID = 'xyz.abhinil.recall';
export const SCHEME = 'glance';
export const DB_FILE = 'glance.db';
export const LEGACY_DB_FILE = 'recall.db';

export const SECRET = {
  wallet: 'glance.wallet.key',
  anthropic: 'glance.anthropic',
  groq: 'glance.groq',
  twitter: 'glance.twitter',
  backup: 'glance.backup.key',
  appPassword: 'glance.app.password',
  linkedin: 'glance.linkedin.session',
  telegram: 'glance.telegram.session',
  whatsapp: 'glance.whatsapp.session',
} as const;

export const LEGACY_SECRET = {
  wallet: 'recall.wallet.key',
  anthropic: 'recall.anthropic',
  groq: 'recall.groq',
  twitter: 'recall.twitter',
  backup: 'recall.backup.key',
  appPassword: 'recall.app.password',
  linkedin: 'recall.linkedin.session',
  telegram: 'recall.telegram.session',
  whatsapp: 'recall.whatsapp.session',
} as const;

export type SecretRole = keyof typeof SECRET;

export function legacyKeyFor(key: string): string | null {
  for (const role of Object.keys(SECRET) as SecretRole[]) {
    if (SECRET[role] === key) return LEGACY_SECRET[role];
  }
  return null;
}

/** Prefer the Glance key. A copy made by the previous install still uses the old key name. */
export function secretFromPort(secrets: Record<string, string | undefined> | undefined, role: SecretRole): string | null {
  const current = secrets?.[SECRET[role]];
  if (typeof current === 'string' && current) return current;
  const legacy = secrets?.[LEGACY_SECRET[role]];
  if (typeof legacy === 'string' && legacy) return legacy;
  return null;
}

export function glanceUrl(path: string): string {
  return `${SCHEME}://${path.replace(/^\//, '')}`;
}
