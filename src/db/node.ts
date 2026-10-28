import type { Db } from '@/src/db/types';

export interface NodeStatement {
  run(...params: unknown[]): unknown;
  all(...params: unknown[]): unknown[];
  get(...params: unknown[]): unknown;
}

interface NodeDatabase {
  exec(sql: string): void;
  prepare(sql: string): NodeStatement;
}

export function openNodeDb(): Db {
  const { DatabaseSync } = require('node:sqlite') as { DatabaseSync: new (path: string) => NodeDatabase };
  const db = new DatabaseSync(':memory:');
  return wrap(db);
}

function wrap(db: NodeDatabase): Db {
  return {
    exec(sql: string) {
      db.exec(sql);
    },
    run(sql: string, params: readonly (string | number | null)[] = []) {
      db.prepare(sql).run(...params);
    },
    all<T>(sql: string, params: readonly (string | number | null)[] = []) {
      return db.prepare(sql).all(...params) as T[];
    },
    get<T>(sql: string, params: readonly (string | number | null)[] = []) {
      return db.prepare(sql).get(...params) as T | undefined;
    },
  };
}
