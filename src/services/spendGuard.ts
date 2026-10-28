import type { ErrorCode } from '@/src/lib/result';

export interface SpendInput {
  priceUsd: number;
  listedUsd: number;
  spentTodayUsd: number;
  dailyCapUsd: number;
  balanceUsd: number | null;
  walletReady: boolean;
}

export interface SpendDecision {
  ok: boolean;
  code?: Extract<ErrorCode, 'W1' | 'W2' | 'W3' | 'W4'>;
  maxAmountUsd: number;
}

/** Listed price plus 10% is the most a provider may charge. */
export function maxAmountFor(listedUsd: number): number {
  return Math.round(listedUsd * 1.1 * 1_000_000) / 1_000_000;
}

export function checkSpend(input: SpendInput): SpendDecision {
  const maxAmountUsd = maxAmountFor(input.listedUsd);
  if (!input.walletReady) return { ok: false, code: 'W3', maxAmountUsd };
  if (input.priceUsd - maxAmountUsd > 0.000001) return { ok: false, code: 'W4', maxAmountUsd };
  if (input.spentTodayUsd + input.priceUsd > input.dailyCapUsd + 0.000001) return { ok: false, code: 'W2', maxAmountUsd };
  if (input.balanceUsd == null || input.balanceUsd + 0.000001 < input.priceUsd) return { ok: false, code: 'W1', maxAmountUsd };
  return { ok: true, maxAmountUsd };
}
