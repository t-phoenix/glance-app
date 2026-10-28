import { openDatabaseSync, type SQLiteBindValue } from 'expo-sqlite';
import type { Db } from '@/src/db/types';

export function openExpoDb(): Db {
  const db = openDatabaseSync('recall.db');
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
