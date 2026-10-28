import * as SecureStore from 'expo-secure-store';

const OPTIONS = { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY } as const;

export async function getSecret(key: string): Promise<string | null> {
  try {
    return await SecureStore.getItemAsync(key);
  } catch {
    return null;
  }
}

export async function setSecret(key: string, value: string): Promise<void> {
  if (!value) {
    await SecureStore.deleteItemAsync(key);
    return;
  }
  await SecureStore.setItemAsync(key, value, OPTIONS);
}

export const SECRET = {
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
