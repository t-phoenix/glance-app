export type JobStatus = 'queued' | 'running' | 'done' | 'failed' | 'dead' | 'blocked_offline' | 'blocked_budget';

export interface JobRow {
  id: string;
  kind: string;
  ref_id: string;
  priority: number;
  requires: 'network' | 'charging' | null;
  status: JobStatus;
  tries: number;
  next_at: string | null;
  started_at: string | null;
  error_code: string | null;
}

const MAX_TRIES = 5;

/** 2s * 2^n, plus deterministic jitter from the attempt so tests stay stable. */
export function backoffMs(triesAfterFailure: number, jitterSeed = 0): number {
  const base = 2000 * 2 ** Math.max(0, triesAfterFailure - 1);
  const jitter = (jitterSeed % 400) - 200;
  return Math.max(500, base + jitter);
}

export function onRetryableFailure(job: JobRow, now: Date, jitterSeed = 0): JobRow {
  const tries = job.tries + 1;
  if (tries >= MAX_TRIES) {
    return { ...job, tries, status: 'dead', next_at: null, started_at: null, error_code: job.error_code };
  }
  const next = new Date(now.getTime() + backoffMs(tries, jitterSeed));
  return { ...job, tries, status: 'failed', next_at: next.toISOString(), started_at: null };
}

export function recoverStuck(job: JobRow, now: Date): JobRow {
  if (job.status !== 'running' || !job.started_at) return job;
  const age = now.getTime() - new Date(job.started_at).getTime();
  if (age > 2 * 60 * 1000) return { ...job, status: 'queued', started_at: null };
  return job;
}

export function applyNetwork(job: JobRow, online: boolean): JobRow {
  if (job.requires !== 'network') return job;
  if (!online && (job.status === 'queued' || job.status === 'failed')) return { ...job, status: 'blocked_offline' };
  if (online && job.status === 'blocked_offline') return { ...job, status: 'queued' };
  return job;
}
