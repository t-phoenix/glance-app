import { describe, expect, it } from 'vitest';
import { classifyQr } from '@/src/parsers/qr';

const vcard = `BEGIN:VCARD
VERSION:3.0
FN:Priya Sharma
ORG:Avail
EMAIL:p@x.io
X-SOCIALPROFILE;type=twitter:https://x.com/priya_zk
END:VCARD`;

describe('parsers/qr', () => {
  it('U-QR-01 linkedin', () => {
    expect(classifyQr('https://www.linkedin.com/in/priya-s-123/')).toMatchObject({ kind: 'linkedin', value: 'priya-s-123' });
  });
  it('U-QR-02 shortlink', () => {
    expect(classifyQr('https://lnkd.in/abc')).toMatchObject({ kind: 'shortlink', needsResolve: true });
    expect(classifyQr('https://scan.page/p/xTTC9k')).toMatchObject({ kind: 'shortlink', value: 'xTTC9k', needsResolve: true });
  });
  it('U-QR-03 x and twitter', () => {
    expect(classifyQr('https://x.com/priyabuilds?s=21')).toMatchObject({ kind: 'x', value: 'priyabuilds' });
    expect(classifyQr('https://twitter.com/PriyaBuilds')).toMatchObject({ kind: 'x', value: 'priyabuilds' });
    expect(classifyQr('https://mobile.twitter.com/priyabuilds')).toMatchObject({ kind: 'x', value: 'priyabuilds' });
    expect(classifyQr('https://twitter.com/intent/user?screen_name=priyabuilds')).toMatchObject({ kind: 'x', value: 'priyabuilds' });
    expect(classifyQr('twitter://user?screen_name=priyabuilds')).toMatchObject({ kind: 'x', value: 'priyabuilds' });
  });
  it('U-QR-15 profile links without a scheme', () => {
    expect(classifyQr('linkedin.com/in/priya-s-123')).toMatchObject({ kind: 'linkedin', value: 'priya-s-123' });
    expect(classifyQr('https://www.linkedin.com/in/ivantohelpyou?fromQR=1')).toMatchObject({ kind: 'linkedin', value: 'ivantohelpyou' });
    expect(classifyQr('https://in.linkedin.com/in/priya-s-123')).toMatchObject({ kind: 'linkedin', value: 'priya-s-123' });
    expect(classifyQr('https://x.com/i/user/1234567890123456789').kind).toBe('url');
  });
  it('U-QR-04 telegram', () => {
    expect(classifyQr('https://t.me/priya_zk')).toMatchObject({ kind: 'telegram', value: 'priya_zk' });
    expect(classifyQr('tg://resolve?domain=priya_zk')).toMatchObject({ kind: 'telegram', value: 'priya_zk' });
  });
  it('U-QR-05 whatsapp', () => {
    expect(classifyQr('https://wa.me/919812345678')).toMatchObject({ kind: 'whatsapp', value: '+919812345678' });
  });
  it('U-QR-06 whatsapp opaque', () => {
    expect(classifyQr('https://wa.me/qr/ABCDEF')).toMatchObject({ kind: 'whatsapp_link', opaque: true });
  });
  it('U-QR-07 vcard', () => {
    const parsed = classifyQr(vcard);
    expect(parsed.kind).toBe('vcard');
    expect(parsed.contact?.name).toBe('Priya Sharma');
    expect(parsed.contact?.company).toBe('Avail');
    expect(parsed.contact?.handles.some((handle) => handle.platform === 'email' && handle.value === 'p@x.io')).toBe(true);
    expect(parsed.contact?.handles.some((handle) => handle.platform === 'x' && handle.value === 'priya_zk')).toBe(true);
  });
  it('U-QR-08 mecard', () => {
    const parsed = classifyQr('MECARD:N:Sharma,Priya;EMAIL:p@x.io;;');
    expect(parsed.kind).toBe('mecard');
    expect(parsed.contact?.name).toBe('Priya Sharma');
    expect(parsed.contact?.email).toBe('p@x.io');
  });
  it('U-QR-09 jwt unverified', () => {
    const payload = Buffer.from(JSON.stringify({ name: 'Priya', email: 'p@x.io' })).toString('base64url');
    const token = `aaa.${payload}.bbb`;
    const parsed = classifyQr(token);
    expect(parsed.kind).toBe('jwt');
    expect(parsed.verified).toBe(false);
    expect(parsed.contact?.name).toBe('Priya');
  });
  it('U-QR-10 address and ens', () => {
    expect(classifyQr(`0x${'ab'.repeat(20)}`).kind).toBe('address');
    expect(classifyQr('priya.eth')).toMatchObject({ kind: 'ens', value: 'priya.eth' });
  });
  it('U-QR-11 unsafe payment', () => {
    expect(classifyQr(`ethereum:0x${'ab'.repeat(20)}@8453/transfer?value=1`).unsafe).toBe(true);
    expect(classifyQr('wc:abc').kind).toBe('payment');
  });
  it('U-QR-12 devcon ticket', () => {
    expect(classifyQr('https://devcon.org/ticket/karan/x7f2k')).toMatchObject({ kind: 'devcon_ticket', value: 'karan' });
  });
  it('U-QR-13 opaque badge', () => {
    expect(classifyQr('A7F2-99X1').kind).toBe('opaque');
  });
  it('U-QR-14 invalid without throwing', () => {
    expect(classifyQr('').kind).toBe('invalid');
    expect(classifyQr('a'.repeat(11 * 1024)).kind).toBe('invalid');
    expect(classifyQr('ok\u0000nope').kind).toBe('invalid');
  });
});
