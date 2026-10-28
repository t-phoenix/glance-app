import { namesMatch } from '@/src/lib/jaro';

export type VerifyOutcome =
  | { kind: 'match' }
  | { kind: 'gone' }
  | { kind: 'conflict'; typed: string; fetched: string };

export function verifyOfflineName(typed: string, fetched: string | null, found: boolean): VerifyOutcome {
  if (!found) return { kind: 'gone' };
  if (!typed.trim()) return { kind: 'match' };
  if (!fetched) return { kind: 'match' };
  if (namesMatch(typed, fetched)) return { kind: 'match' };
  return { kind: 'conflict', typed: typed.trim(), fetched: fetched.trim() };
}
