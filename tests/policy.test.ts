import { describe, expect, it } from 'vitest';
import { applyNetwork, backoffMs, onRetryableFailure, recoverStuck, type JobRow } from '@/src/services/queuePolicy';
import { checkSpend } from '@/src/services/spendGuard';
import { matchEvents } from '@/src/services/eventMatcher';
import { verifyOfflineName } from '@/src/services/verify';

const job = (patch: Partial<JobRow> = {}): JobRow => ({
  id: 'j',
  kind: 'enrich_anchor',
  ref_id: 'p',
  priority: 0,
  requires: 'network',
  status: 'queued',
  tries: 0,
  next_at: null,
  started_at: null,
  error_code: 'P1',
  ...patch,
});

describe('queue spend events verify', () => {
  it('U-Q-01 backoff then dead after 5', () => {
    const now = new Date('2026-11-01T12:00:00Z');
    let current = job();
    current = onRetryableFailure(current, now, 0);
    expect(current.tries).toBe(1);
    expect(current.status).toBe('failed');
    expect(new Date(current.next_at!).getTime() - now.getTime()).toBe(backoffMs(1, 0));
    current = { ...current, tries: 4, status: 'failed' };
    current = onRetryableFailure(current, now, 0);
    expect(current.status).toBe('dead');
    expect(current.tries).toBe(5);
  });
  it('U-Q-02 stuck running returns to queued', () => {
    const now = new Date('2026-11-01T12:03:00Z');
    const stuck = job({ status: 'running', started_at: '2026-11-01T12:00:00Z' });
    expect(recoverStuck(stuck, now).status).toBe('queued');
  });
  it('U-Q-03 offline blocks network jobs only', () => {
    expect(applyNetwork(job(), false).status).toBe('blocked_offline');
    expect(applyNetwork(job({ requires: null, kind: 'transcribe' }), false).status).toBe('queued');
    expect(applyNetwork(job({ status: 'blocked_offline' }), true).status).toBe('queued');
  });
  it('U-G-01 cap blocks', () => {
    expect(checkSpend({ priceUsd: 0.06, listedUsd: 0.06, spentTodayUsd: 1.96, dailyCapUsd: 2, balanceUsd: 10, walletReady: true }).code).toBe('W2');
  });
  it('U-G-02 balance blocks', () => {
    expect(checkSpend({ priceUsd: 0.06, listedUsd: 0.06, spentTodayUsd: 0, dailyCapUsd: 2, balanceUsd: 0.04, walletReady: true }).code).toBe('W1');
  });
  it('U-G-03 price above list blocks', () => {
    expect(checkSpend({ priceUsd: 0.4, listedUsd: 0.06, spentTodayUsd: 0, dailyCapUsd: 2, balanceUsd: 10, walletReady: true }).code).toBe('W4');
  });
  it('U-E-01 time and geofence', () => {
    const matches = matchEvents(
      [{ id: 'ibw', name: 'IBW', starts_at: '2026-11-01T04:30:00Z', ends_at: '2026-11-01T13:30:00Z', lat: 19.0972, lng: 72.8746, radius_m: 300 }],
      '2026-11-01T08:00:00Z',
      19.0974,
      72.8748,
    );
    expect(matches.map((match) => match.event.id)).toEqual(['ibw']);
  });
  it('U-E-02 nearer event first', () => {
    const events = [
      { id: 'far', name: 'Far', starts_at: '2026-11-01T04:00:00Z', ends_at: '2026-11-01T16:00:00Z', lat: 19.07, lng: 72.87, radius_m: 5000 },
      { id: 'near', name: 'Near', starts_at: '2026-11-01T04:00:00Z', ends_at: '2026-11-01T16:00:00Z', lat: 19.0972, lng: 72.8746, radius_m: 5000 },
    ];
    const matches = matchEvents(events, '2026-11-01T08:00:00Z', 19.0972, 72.8746);
    expect(matches.map((match) => match.event.id)[0]).toBe('near');
    expect(matches).toHaveLength(2);
  });
  it('U-E-03 crosses midnight', () => {
    const matches = matchEvents(
      [{ id: 'late', name: 'Late', starts_at: '2026-11-01T18:30:00Z', ends_at: '2026-11-01T20:30:00Z', lat: null, lng: null, radius_m: 300 }],
      '2026-11-01T20:00:00Z',
      null,
      null,
    );
    expect(matches).toHaveLength(1);
  });
  it('U-V-01 name token matches', () => {
    expect(verifyOfflineName('Priya', 'Priya Sharma', true).kind).toBe('match');
  });
  it('U-V-02 conflict', () => {
    expect(verifyOfflineName('Priya', 'Pratik S.', true).kind).toBe('conflict');
  });
  it('U-V-03 gone', () => {
    expect(verifyOfflineName('Priya', null, false).kind).toBe('gone');
  });
});
