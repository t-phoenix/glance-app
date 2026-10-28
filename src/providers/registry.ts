import { appError, err, ok, type Result } from '@/src/lib/result';

export interface ProviderCall<I, O> {
  id: string;
  need: string;
  paid: boolean;
  listedUsd: number;
  requiresKey: boolean;
  call: (input: I) => Promise<Result<O>>;
}

export interface Circuit {
  failures: number;
  openUntil: number;
}

export interface RegistryOptions<I, O> {
  now?: () => number;
  allowPaid?: boolean;
  spend?: (provider: ProviderCall<I, O>) => Result<true>;
  onAuthFailure?: (providerId: string) => void;
}

const OPEN_MS = 10 * 60 * 1000;

export class ProviderRegistry<I, O> {
  private circuits = new Map<string, Circuit>();

  constructor(private chains: Record<string, ProviderCall<I, O>[]>) {}

  circuit(id: string, now = Date.now()): Circuit {
    return this.circuits.get(id) ?? { failures: 0, openUntil: now };
  }

  /** Test hook and the health check both use this. Three failures open the breaker for 10 minutes. */
  recordFailure(id: string, now = Date.now()): void {
    const current = this.circuit(id, now);
    const failures = current.failures + 1;
    this.circuits.set(id, {
      failures,
      openUntil: failures >= 3 ? now + OPEN_MS : current.openUntil,
    });
  }

  recordSuccess(id: string): void {
    this.circuits.set(id, { failures: 0, openUntil: 0 });
  }

  isOpen(id: string, now = Date.now()): boolean {
    const circuit = this.circuits.get(id);
    return !!circuit && circuit.failures >= 3 && now < circuit.openUntil;
  }

  async call(need: string, input: I, opts: RegistryOptions<I, O> = {}): Promise<Result<O>> {
    const now = opts.now ? opts.now() : Date.now();
    const chain = this.chains[need] ?? [];
    const failures: string[] = [];
    for (const provider of chain) {
      if (this.isOpen(provider.id, now)) {
        failures.push(`${provider.id}: circuit open`);
        continue;
      }
      if (provider.paid && opts.allowPaid === false) {
        failures.push(`${provider.id}: paid skipped`);
        continue;
      }
      if (provider.paid && opts.spend) {
        const gate = opts.spend(provider);
        if (!gate.ok) return gate;
      }
      const result = await provider.call(input);
      if (result.ok) {
        this.recordSuccess(provider.id);
        return result;
      }
      failures.push(`${provider.id}: ${result.error.code}`);
      this.recordFailure(provider.id, now);
      if (provider.requiresKey && (result.error.code === 'P3' || result.error.code === 'W4')) {
        opts.onAuthFailure?.(provider.id);
        return result;
      }
      if (!result.error.retryable && result.error.code === 'P4') return result;
    }
    return err('P5', appError('P5').message, true, failures.join('; '));
  }
}

export function httpStatusToError(status: number, retryAfter?: string): Result<never> {
  if (status === 401 || status === 403) return err('P3', appError('P3').message, false);
  if (status === 404) return err('P4', appError('P4').message, false);
  if (status === 429) return err('P2', retryAfter ? `Retrying in ${retryAfter} s.` : appError('P2').message, true);
  if (status >= 500 || status === 408) return err('P1', appError('P1').message, true);
  return err('P5', appError('P5').message, false);
}
