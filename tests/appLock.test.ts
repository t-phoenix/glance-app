import { describe, expect, it } from 'vitest';
import { checkPassword, hashPassword, isLocking, lockoutMs } from '@/src/services/appLock';

describe('app lock', () => {
  it('accepts the right password and rejects others', () => {
    const stored = hashPassword('tide42', 'salt_a');
    expect(stored.startsWith('salt_a:')).toBe(true);
    expect(stored).not.toContain('tide42');
    expect(checkPassword('tide42', stored)).toBe(true);
    expect(checkPassword('tide43', stored)).toBe(false);
    expect(checkPassword('', stored)).toBe(false);
    expect(checkPassword('tide42', null)).toBe(false);
    expect(checkPassword('tide42', 'nosalt')).toBe(false);
  });

  it('salts, so the same password stores differently', () => {
    expect(hashPassword('tide42', 'salt_a')).not.toBe(hashPassword('tide42', 'salt_b'));
  });

  it('only locks when a method is on', () => {
    expect(isLocking({ face: false, passcode: false })).toBe(false);
    expect(isLocking({ face: true, passcode: false })).toBe(true);
    expect(isLocking({ face: false, passcode: true })).toBe(true);
  });

  it('slows down guessing after five misses', () => {
    expect(lockoutMs(4)).toBe(0);
    expect(lockoutMs(5)).toBe(30_000);
    expect(lockoutMs(6)).toBe(60_000);
    expect(lockoutMs(40)).toBe(600_000);
  });
});
