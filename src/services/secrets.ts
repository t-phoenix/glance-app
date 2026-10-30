import * as SecureStore from 'expo-secure-store';
import { legacyKeyFor } from '@/src/identity';

const OPTIONS = { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY } as const;

async function readKey(key: string): Promise<string | null> {
  try {
    return await SecureStore.getItemAsync(key);
  } catch {
    return null;
  }
}

export async function getSecret(key: string): Promise<string | null> {
  const current = await readKey(key);
  if (current) return current;
  const legacy = legacyKeyFor(key);
  if (!legacy) return null;
  return readKey(legacy);
}

export async function setSecret(key: string, value: string): Promise<void> {
  if (!value) {
    await SecureStore.deleteItemAsync(key);
    return;
  }
  await SecureStore.setItemAsync(key, value, OPTIONS);
}

export { LEGACY_SECRET, SECRET } from '@/src/identity';
