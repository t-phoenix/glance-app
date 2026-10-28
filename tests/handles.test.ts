import { describe, expect, it } from 'vitest';
import { validateCompany, validateHandle, validateHint, validatePersonName } from '@/src/parsers/handles';

describe('handles', () => {
  it('U-H-01 x accepts @ and lowercases', () => {
    expect(validateHandle('x', '@Priya_ZK')).toEqual({ ok: true, value: 'priya_zk' });
  });
  it('U-H-02 x rejects 16 characters', () => {
    expect(validateHandle('x', 'a'.repeat(16)).ok).toBe(false);
  });
  it('U-H-03 telegram rejects a leading digit', () => {
    expect(validateHandle('telegram', '1priya').ok).toBe(false);
  });
  it('U-H-04 telegram accepts 5 characters', () => {
    expect(validateHandle('telegram', 'priya').ok).toBe(true);
  });
  it('U-H-05 telegram rejects 4 characters', () => {
    expect(validateHandle('telegram', 'priy').ok).toBe(false);
  });
  it('U-H-06 linkedin slug', () => {
    expect(validateHandle('linkedin', 'priya-s-123').ok).toBe(true);
  });
  it('U-H-07 whatsapp requires plus', () => {
    expect(validateHandle('whatsapp', '919812345678')).toEqual({ ok: true, value: '+919812345678' });
    expect(validateHandle('whatsapp', '+919812345678').ok).toBe(true);
  });
  it('U-H-08 whatsapp rejects a short number', () => {
    expect(validateHandle('whatsapp', '+91123').ok).toBe(false);
  });
  it('U-H-09 ens', () => {
    expect(validateHandle('ens', 'Priya.eth')).toEqual({ ok: true, value: 'priya.eth' });
  });
  it('U-H-10 address', () => {
    expect(validateHandle('ens', `0x${'ab'.repeat(20)}`).ok).toBe(false);
  });
  it('U-H-11 name rejects digits only and 81 chars', () => {
    expect(validatePersonName('12345').ok).toBe(false);
    expect(validatePersonName('Priya').ok).toBe(true);
    expect(validatePersonName('a'.repeat(81)).ok).toBe(false);
  });
  it('U-H-12 company and hint limits', () => {
    expect(validateCompany('a'.repeat(81)).ok).toBe(false);
    expect(validateHint('blue hoodie').ok).toBe(true);
    expect(validateHint('x'.repeat(141)).ok).toBe(false);
  });
});
