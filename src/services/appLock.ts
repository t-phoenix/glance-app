import { pbkdf2 } from '@noble/hashes/pbkdf2.js';
import { sha256 } from '@noble/hashes/sha2.js';
import { bytesToHex } from '@noble/hashes/utils.js';

export interface LockConfig {
  face: boolean;
  passcode: boolean;
}

export const MIN_PASSWORD = 4;
const ROUNDS = 4000;

export function isLocking(config: LockConfig): boolean {
  return config.face || config.passcode;
}

/** Stored as `salt:hash`, so the Keychain never holds the password itself. */
export function hashPassword(password: string, salt: string): string {
  return `${salt}:${bytesToHex(pbkdf2(sha256, password, salt, { c: ROUNDS, dkLen: 32 }))}`;
}

export function checkPassword(password: string, stored: string | null): boolean {
  if (!stored) return false;
  const salt = stored.slice(0, stored.indexOf(':'));
  if (!salt) return false;
  const attempt = hashPassword(password, salt);
  if (attempt.length !== stored.length) return false;
  let diff = 0;
  for (let index = 0; index < attempt.length; index += 1) diff |= attempt.charCodeAt(index) ^ stored.charCodeAt(index);
  return diff === 0;
}

/** Wait before the next try: free for 4 misses, then 30 s doubling up to 10 minutes. */
export function lockoutMs(failures: number): number {
  if (failures < 5) return 0;
  return Math.min(30_000 * 2 ** (failures - 5), 600_000);
}
