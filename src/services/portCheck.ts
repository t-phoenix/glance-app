import { DB_FILE, type SecretRole } from '@/src/identity';

export interface PortResult {
  counts: Record<string, number>;
  databaseFile: string;
  secrets: Record<string, boolean>;
}

const EXACT = ['person', 'handle', 'encounter', 'action', 'huddle', 'watch', 'wallet_tx', 'spend', 'job'] as const;

/** Returns the reasons a port is not safe to trust. An empty list means the copy matches. */
export function portProblems(source: Record<string, number>, result: PortResult, roles: readonly SecretRole[]): string[] {
  const problems: string[] = [];
  if (result.databaseFile !== DB_FILE) problems.push(`database file is ${result.databaseFile}`);
  for (const table of EXACT) {
    const got = result.counts[table] ?? 0;
    const expected = source[table] ?? 0;
    if (got !== expected) problems.push(`${table} ${got} != ${expected}`);
  }
  if ((result.counts.event ?? 0) < (source.event ?? 0)) problems.push('events dropped');
  if ((result.counts.setting ?? 0) < (source.setting ?? 0)) problems.push('settings dropped');
  for (const role of roles) {
    if (!result.secrets[role]) problems.push(`missing ${role}`);
  }
  return problems;
}
