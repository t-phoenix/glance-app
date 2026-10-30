import * as FileSystem from 'expo-file-system/legacy';
import { defaultDatabaseDirectory, openDatabaseSync, type SQLiteBindValue } from 'expo-sqlite';
import { DB_FILE, LEGACY_DB_FILE } from '@/src/identity';
import type { Db } from '@/src/db/types';

function openNamed(name: string): Db {
  const db = openDatabaseSync(name);
  const bind = (params: readonly (string | number | null)[] = []): SQLiteBindValue[] =>
    params.map((value) => value) as SQLiteBindValue[];
  return {
    exec(sql) {
      db.execSync(sql);
    },
    run(sql, params) {
      db.runSync(sql, bind(params));
    },
    all(sql, params) {
      return db.getAllSync(sql, bind(params));
    },
    get(sql, params) {
      return db.getFirstSync(sql, bind(params)) ?? undefined;
    },
  };
}

async function exists(path: string): Promise<boolean> {
  if (!path) return false;
  try {
    return (await FileSystem.getInfoAsync(path)).exists;
  } catch {
    return false;
  }
}

/** Opens glance.db. An install that still has the previous file keeps using that file so the copy can be read. */
export async function openInstalledExpoDb(): Promise<{ db: Db; file: string }> {
  const docs = FileSystem.documentDirectory ?? '';
  const nativeDir = (defaultDatabaseDirectory ?? '').replace(/\/$/, '');
  const legacyCandidates = [`${docs}SQLite/${LEGACY_DB_FILE}`, nativeDir ? `${nativeDir}/${LEGACY_DB_FILE}` : ''];
  const nextCandidates = [`${docs}SQLite/${DB_FILE}`, nativeDir ? `${nativeDir}/${DB_FILE}` : ''];
  const legacyExists = (await Promise.all(legacyCandidates.map((path) => exists(path)))).some(Boolean);
  const nextExists = (await Promise.all(nextCandidates.map((path) => exists(path)))).some(Boolean);
  const file = nextExists ? DB_FILE : legacyExists ? LEGACY_DB_FILE : DB_FILE;
  if (docs) {
    const note = `chosen=${file}\nlegacy=${legacyExists ? 1 : 0}\ncurrent=${nextExists ? 1 : 0}\n`;
    await FileSystem.writeAsStringAsync(`${docs}db-choice.txt`, note).catch(() => undefined);
  }
  return { db: openNamed(file), file };
}
