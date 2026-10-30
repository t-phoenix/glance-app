import Constants from 'expo-constants';
import * as FileSystem from 'expo-file-system/legacy';
import type { GlanceRepository } from '@/src/db/repository';
import { SECRET, secretFromPort, type SecretRole } from '@/src/identity';
import { getSecret, setSecret } from '@/src/services/secrets';
import { listFileUris, replaceFileUris } from '@/src/services/portFiles';

const PORT_FILE = 'port-in.json';
const RESULT_FILE = 'port-result.txt';

interface PortBundle {
  version: 1;
  database: string;
  secrets: Record<string, string>;
  media: { uri: string; data: string }[];
}

function portPath(): string {
  return `${FileSystem.documentDirectory}${PORT_FILE}`;
}

/** Read a one-time copy dropped into this app's documents, then delete it. */
export async function consumePortFile(repo: GlanceRepository, databaseFile: string): Promise<boolean> {
  const path = portPath();
  const info = await FileSystem.getInfoAsync(path);
  if (!info.exists) return false;
  const bundle = JSON.parse(await FileSystem.readAsStringAsync(path)) as PortBundle;
  if (bundle.version !== 1 || typeof bundle.database !== 'string') throw new Error('bad port');
  const dir = `${FileSystem.documentDirectory}ported/`;
  await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
  const pairs: { from: string; to: string }[] = [];
  for (const [index, item] of (bundle.media ?? []).entries()) {
    if (!item?.uri?.startsWith('file://') || typeof item.data !== 'string') continue;
    const ext = item.uri.split('.').pop()?.replace(/[^a-z0-9]/gi, '').slice(0, 8) || 'bin';
    const dest = `${dir}${index}.${ext}`;
    await FileSystem.writeAsStringAsync(dest, item.data, { encoding: FileSystem.EncodingType.Base64 });
    pairs.push({ from: item.uri, to: dest });
  }
  repo.restore(replaceFileUris(bundle.database, pairs));
  const secrets: Record<string, boolean> = {};
  for (const role of Object.keys(SECRET) as SecretRole[]) {
    const value = secretFromPort(bundle.secrets, role);
    if (value) await setSecret(SECRET[role], value);
    secrets[role] = Boolean(await getSecret(SECRET[role]));
  }
  await FileSystem.deleteAsync(path, { idempotent: true });
  await FileSystem.writeAsStringAsync(
    `${FileSystem.documentDirectory}${RESULT_FILE}`,
    JSON.stringify({ counts: repo.counts(), databaseFile, secrets }),
  );
  return true;
}

/** Expo Go only. Sends this install's database, files, and keychain entries to the Mac. */
export async function sendDevPort(repo: GlanceRepository): Promise<boolean> {
  const token = process.env.EXPO_PUBLIC_PORT_TOKEN;
  const origin = process.env.EXPO_PUBLIC_PORT_ORIGIN;
  if (!token || !origin || Constants.executionEnvironment !== 'storeClient') return false;
  const database = repo.dump();
  const media: { uri: string; data: string }[] = [];
  for (const uri of listFileUris(database)) {
    try {
      const info = await FileSystem.getInfoAsync(uri);
      if (!info.exists) continue;
      media.push({ uri, data: await FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.Base64 }) });
    } catch {
      // A missing photo stays as a dead link. The people and keys still move.
    }
  }
  const secrets: Record<string, string> = {};
  for (const key of Object.values(SECRET)) {
    const value = await getSecret(key);
    if (value) secrets[key] = value;
  }
  try {
    const response = await fetch(`${origin}/__glance_port`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-port-token': token },
      body: JSON.stringify({ version: 1, database, secrets, media } satisfies PortBundle),
    });
    return response.ok || response.status === 204;
  } catch {
    return false;
  }
}
