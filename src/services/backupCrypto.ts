import { gcm } from '@noble/ciphers/aes.js';
import { sha256 } from '@noble/hashes/sha2.js';

function randomBytes(length: number): Uint8Array {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return bytes;
}

export interface BackupPayload {
  version: 1;
  exportedAt: string;
  address: string | null;
  database: string;
  media: { path: string; sha256: string }[];
}

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

export function backupKeyFromSecret(secret: string): Uint8Array {
  return sha256(textEncoder.encode(secret));
}

export function encryptBackup(payload: BackupPayload, key: Uint8Array): string {
  const nonce = randomBytes(12);
  const cipher = gcm(key, nonce);
  const body = cipher.encrypt(textEncoder.encode(JSON.stringify(payload)));
  const out = new Uint8Array(nonce.length + body.length);
  out.set(nonce, 0);
  out.set(body, nonce.length);
  return bytesToB64(out);
}

export function decryptBackup(encoded: string, key: Uint8Array): BackupPayload {
  const bytes = b64ToBytes(encoded);
  const nonce = bytes.slice(0, 12);
  const body = bytes.slice(12);
  const plain = gcm(key, nonce).decrypt(body);
  const parsed = JSON.parse(textDecoder.decode(plain)) as BackupPayload;
  if (parsed.version !== 1 || !parsed.database) throw new Error('bad backup');
  if (parsed.database.includes('PRIVATE KEY') || parsed.database.includes('wallet_private')) {
    throw new Error('backup refused a wallet key');
  }
  return parsed;
}

export function sha256Hex(bytes: Uint8Array): string {
  return [...sha256(bytes)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

function bytesToB64(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function b64ToBytes(value: string): Uint8Array {
  const binary = atob(value);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i);
  return out;
}
