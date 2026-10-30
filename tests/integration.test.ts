import { describe, expect, it } from 'vitest';
import { err, ok } from '@/src/lib/result';
import { ProviderRegistry, type ProviderCall } from '@/src/providers/registry';
import { backupKeyFromSecret, decryptBackup, encryptBackup, type BackupPayload } from '@/src/services/backupCrypto';
import { openNodeDb } from '@/src/db/node';
import { GlanceRepository } from '@/src/db/repository';
import { classifyQr } from '@/src/parsers/qr';

describe('registry', () => {
  it('I-01 opens the breaker after three failures and uses the next provider', async () => {
    let primaryHits = 0;
    const primary: ProviderCall<string, string> = {
      id: 'twitterapi',
      need: 'x.profile',
      paid: false,
      listedUsd: 0,
      requiresKey: true,
      call: async () => {
        primaryHits++;
        return err('P1', 'down', true);
      },
    };
    const backup: ProviderCall<string, string> = {
      id: 'stablesocial',
      need: 'x.profile',
      paid: true,
      listedUsd: 0.06,
      requiresKey: false,
      call: async () => ok('profile'),
    };
    const registry = new ProviderRegistry({ 'x.profile': [primary, backup] });
    await registry.call('x.profile', 'priya', { allowPaid: true });
    await registry.call('x.profile', 'priya', { allowPaid: true });
    const third = await registry.call('x.profile', 'priya', { allowPaid: true });
    expect(third.ok).toBe(true);
    expect(registry.isOpen('twitterapi', Date.now())).toBe(true);
    const before = primaryHits;
    await registry.call('x.profile', 'priya', { allowPaid: true });
    expect(primaryHits).toBe(before);
  });

  it('I-02 auth failure does not continue to a paid provider', async () => {
    let paid = 0;
    const registry = new ProviderRegistry<string, string>({
      'x.profile': [
        { id: 'twitterapi', need: 'x.profile', paid: false, listedUsd: 0, requiresKey: true, call: async () => err('P3', 'bad key', false) },
        { id: 'stablesocial', need: 'x.profile', paid: true, listedUsd: 0.06, requiresKey: false, call: async () => { paid++; return ok('x'); } },
      ],
    });
    const result = await registry.call('x.profile', 'priya', { allowPaid: true });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('P3');
    expect(paid).toBe(0);
  });
});

describe('repository', () => {
  it('I-06 offline scan stores a stub and a blocked-ready verify job', () => {
    const repo = new GlanceRepository(openNodeDb());
    const saved = repo.capture({ qr: classifyQr('https://t.me/priya_zk'), offline: true, realName: 'Priya' });
    expect(saved.duplicate).toBe(false);
    expect(repo.person(saved.personId)?.state).toBe('stub');
    expect(repo.handles(saved.personId)[0]?.status).toBe('pending_offline');
    expect(repo.jobs().some((job) => job.kind === 'verify_offline')).toBe(true);
  });

  it('I-09 rush keeps paid lookups for starred or mentioned people', () => {
    const repo = new GlanceRepository(openNodeDb());
    const huddle = repo.startHuddle(null);
    const ids = ['priya', 'karan', 'asha', 'dev', 'omar'].map((name) => {
      const saved = repo.capture({ qr: classifyQr(`https://t.me/${name}_zk`), huddleId: huddle, displayName: name });
      return saved.personId;
    });
    repo.setStar(ids[0]!, true);
    repo.markMentioned(ids[1]!);
    expect(repo.allowPaid(ids[0]!)).toBe(true);
    expect(repo.allowPaid(ids[1]!)).toBe(true);
    expect(repo.allowPaid(ids[4]!)).toBe(false);
    expect(repo.huddlePeople(huddle)).toHaveLength(5);
  });

  it('I-10 delete removes the person, handles and search row', () => {
    const repo = new GlanceRepository(openNodeDb());
    const saved = repo.capture({ qr: classifyQr('https://x.com/priyabuilds'), displayName: 'Priya' });
    expect(repo.search('priya')).toHaveLength(1);
    repo.deletePerson(saved.personId);
    expect(repo.person(saved.personId)).toBeUndefined();
    expect(repo.handles(saved.personId)).toHaveLength(0);
    expect(repo.search('priya')).toHaveLength(0);
  });

  it('I-11 backup round trip keeps row counts and omits wallet keys', () => {
    const repo = new GlanceRepository(openNodeDb());
    repo.capture({ qr: classifyQr('https://t.me/priya_zk') });
    repo.setSetting('wallet_address', '0xabc');
    const payload: BackupPayload = {
      version: 1,
      exportedAt: new Date().toISOString(),
      address: '0xabc',
      database: repo.dump(),
      media: [],
    };
    expect(payload.database.includes('wallet_private')).toBe(false);
    const key = backupKeyFromSecret('device-key');
    const encoded = encryptBackup(payload, key);
    const restored = decryptBackup(encoded, key);
    const next = new GlanceRepository(openNodeDb());
    next.restore(restored.database);
    expect(next.counts().person).toBe(repo.counts().person);
    expect(next.counts().handle).toBe(repo.counts().handle);
  });

  it('E-07 unsafe qr is not saved', () => {
    const repo = new GlanceRepository(openNodeDb());
    const saved = repo.capture({ qr: classifyQr('ethereum:0xabc@8453/transfer') });
    expect(saved.unsafe).toBe(true);
    expect(repo.allPeople()).toHaveLength(0);
  });

  it('confirm refuses an account already linked elsewhere', () => {
    const repo = new GlanceRepository(openNodeDb());
    const a = repo.capture({ qr: classifyQr('https://t.me/priya_zk'), displayName: 'Priya' });
    const b = repo.capture({ qr: null, displayName: 'Other' });
    const handleId = repo.insertHandle({ personId: b.personId, platform: 'telegram', value: 'priya_zk', status: 'suggested' });
    repo.confirmHandle(repo.handles(a.personId)[0]!.id);
    const result = repo.confirmHandle(handleId);
    expect(result.ok).toBe(false);
  });
});
