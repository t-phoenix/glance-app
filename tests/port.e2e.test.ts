import { copyFileSync, mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { openNodeDb } from '@/src/db/node';
import { GlanceRepository } from '@/src/db/repository';
import {
  BUNDLE_ID,
  DB_FILE,
  LEGACY_DB_FILE,
  LEGACY_SECRET,
  SCHEME,
  SECRET,
  glanceUrl,
  legacyKeyFor,
  secretFromPort,
  type SecretRole,
} from '@/src/identity';
import { classifyQr } from '@/src/parsers/qr';
import { portProblems } from '@/src/services/portCheck';
import { replaceFileUris } from '@/src/services/portFiles';

const wallet = `0x${'ab'.repeat(32)}`;

describe('Glance names', () => {
  it('E2E-NAME-01 stores Glance names and still recognises the previous key names', () => {
    for (const role of Object.keys(SECRET) as SecretRole[]) {
      expect(SECRET[role].startsWith('glance.')).toBe(true);
      expect(SECRET[role].includes('recall')).toBe(false);
      expect(LEGACY_SECRET[role].startsWith('recall.')).toBe(true);
      expect(legacyKeyFor(SECRET[role])).toBe(LEGACY_SECRET[role]);
    }
    expect(legacyKeyFor('unrelated')).toBeNull();
    expect(BUNDLE_ID).toBe('xyz.abhinil.glance');
    expect(DB_FILE).toBe('glance.db');
    expect(LEGACY_DB_FILE).toBe('recall.db');
    expect(SCHEME).toBe('glance');
    expect(glanceUrl('/scan?payload=https%3A%2F%2Fx.com%2Fpriya')).toBe('glance://scan?payload=https%3A%2F%2Fx.com%2Fpriya');
    const app = JSON.parse(readFileSync('app.json', 'utf8')) as { expo: { slug: string; scheme: string; ios: { bundleIdentifier: string } } };
    expect(app.expo.slug).toBe('glance');
    expect(app.expo.scheme).toBe(SCHEME);
    expect(app.expo.ios.bundleIdentifier).toBe(BUNDLE_ID);
  });
});

describe('port onto a new install', () => {
  it('E2E-PORT-01 keeps people, notes, files, settings, and legacy keys', () => {
    const source = new GlanceRepository(openNodeDb());
    const saved = source.capture({
      qr: classifyQr('https://x.com/priyabuilds'),
      displayName: 'Priya',
      realName: 'Priya Sharma',
      company: 'Banyan',
      photoUri: 'file:///var/mobile/Containers/Data/Application/OLD/Documents/ported/0.jpg',
      audioUri: 'file:///var/mobile/Containers/Data/Application/OLD/Documents/ported/1.m4a',
      transcript: 'Met at the booth. Send the intro.',
      starred: true,
    });
    source.setSetting('wallet_address', '0xabc');
    source.setSetting('theme', 'light');
    source.addWatch('Priya', 'met at IBW');
    const database = replaceFileUris(source.dump(), [
      { from: 'file:///var/mobile/Containers/Data/Application/OLD/Documents/ported/0.jpg', to: 'file:///var/glance/ported/0.jpg' },
      { from: 'file:///var/mobile/Containers/Data/Application/OLD/Documents/ported/1.m4a', to: 'file:///var/glance/ported/1.m4a' },
    ]);
    const carried = {
      [LEGACY_SECRET.wallet]: wallet,
      [LEGACY_SECRET.anthropic]: 'sk-ant-test',
      [LEGACY_SECRET.appPassword]: 'hash:salt',
    };
    expect(secretFromPort(carried, 'wallet')).toBe(wallet);
    expect(secretFromPort({ ...carried, [SECRET.wallet]: `0x${'cd'.repeat(32)}` }, 'wallet')).toBe(`0x${'cd'.repeat(32)}`);
    expect(secretFromPort(carried, 'groq')).toBeNull();

    const next = new GlanceRepository(openNodeDb());
    next.restore(database);
    const person = next.person(saved.personId);
    expect(person?.display_name).toBe('Priya');
    expect(person?.real_name).toBe('Priya Sharma');
    expect(person?.company).toBe('Banyan');
    expect(person?.starred).toBe(1);
    expect(person?.photo_uri).toBe('file:///var/glance/ported/0.jpg');
    expect(next.encounters(saved.personId)[0]?.transcript).toBe('Met at the booth. Send the intro.');
    expect(next.encounters(saved.personId)[0]?.audio_uri).toBe('file:///var/glance/ported/1.m4a');
    expect(next.setting('wallet_address')).toBe('0xabc');
    expect(next.setting('theme')).toBe('light');
    expect(next.watchlist()).toHaveLength(1);
    expect(next.search('priyabuilds')).toHaveLength(1);
    expect(next.counts().person).toBe(source.counts().person);
    expect(next.counts().handle).toBe(source.counts().handle);
    expect(next.counts().encounter).toBe(source.counts().encounter);

    const problems = portProblems(source.counts(), {
      counts: next.counts(),
      databaseFile: DB_FILE,
      secrets: { wallet: true, anthropic: true, appPassword: true },
    }, ['wallet', 'anthropic', 'appPassword']);
    expect(problems).toEqual([]);

    const extra = next.capture({ qr: classifyQr('https://t.me/priya_zk'), displayName: 'Asha' });
    expect(extra.duplicate).toBe(false);
    expect(extra.unsafe).toBe(false);
    expect(next.person(extra.personId)?.display_name).toBe('Asha');
    const blocked = next.capture({ qr: classifyQr('ethereum:0xabc@8453/transfer') });
    expect(blocked.unsafe).toBe(true);
    expect(next.counts().person).toBe(2);
  });

  it('E2E-PORT-02 refuses a result that dropped people or the wallet', () => {
    const problems = portProblems(
      { person: 16, handle: 139, encounter: 18, event: 80, setting: 7, action: 0, huddle: 0, watch: 1, wallet_tx: 0, spend: 0, job: 27 },
      { counts: { person: 0, handle: 0, encounter: 0, event: 80, setting: 7, job: 0 }, databaseFile: 'recall.db', secrets: { wallet: false } },
      ['wallet'],
    );
    expect(problems.some((item) => item.startsWith('person'))).toBe(true);
    expect(problems.some((item) => item.includes('recall.db'))).toBe(true);
    expect(problems).toContain('missing wallet');
  });

  it('E2E-PORT-03 rolls a failed restore back', () => {
    const source = new GlanceRepository(openNodeDb());
    source.capture({ qr: classifyQr('https://t.me/priya_zk'), displayName: 'Priya' });
    const next = new GlanceRepository(openNodeDb());
    next.capture({ qr: classifyQr('https://x.com/keepme'), displayName: 'Keep' });
    expect(() => next.restore('{"person":[{"id":"only-id"}]}')).toThrow();
    expect(next.person(next.allPeople()[0]!.id)?.display_name).toBe('Keep');
  });
});

const portJson = process.env.GLANCE_PORT_JSON;
const portDb = process.env.GLANCE_PORT_DB;

describe('handoff bundle', () => {
  it.skipIf(!portJson)('E2E-PORT-05 restores the phone handoff without dropping rows or the wallet key', () => {
    const bundle = JSON.parse(readFileSync(portJson!, 'utf8')) as { version: number; database: string; secrets: Record<string, string>; media: unknown[] };
    expect(bundle.version).toBe(1);
    expect(bundle.media.length).toBeGreaterThan(0);
    const next = new GlanceRepository(openNodeDb());
    next.restore(bundle.database);
    expect(next.counts().person).toBeGreaterThan(0);
    expect(next.counts().handle).toBeGreaterThan(0);
    expect(next.counts().encounter).toBeGreaterThan(0);
    expect(next.setting('wallet_address')).toMatch(/^0x[0-9a-fA-F]{40}$/);
    const key = secretFromPort(bundle.secrets, 'wallet');
    expect(key).toMatch(/^0x[0-9a-fA-F]{64}$/);
    expect(secretFromPort(bundle.secrets, 'groq')).toBeTruthy();
    expect(secretFromPort(bundle.secrets, 'twitter')).toBeTruthy();
    expect(secretFromPort(bundle.secrets, 'linkedin')).toBe('1');
  });
});


describe('ported phone database', () => {
  it.skipIf(!portDb)('E2E-PORT-04 round-trips the copied phone database', () => {
    const dir = mkdtempSync(join(tmpdir(), 'glance-port-'));
    const copy = join(dir, 'source.db');
    copyFileSync(portDb!, copy);
    const source = new GlanceRepository(openNodeDb(copy));
    const before = source.counts();
    const address = source.setting('wallet_address');
    expect(before.person).toBeGreaterThan(0);
    const next = new GlanceRepository(openNodeDb());
    next.restore(source.dump());
    expect(next.counts()).toEqual(before);
    expect(next.setting('wallet_address')).toBe(address);
    expect(next.setting('theme').length).toBeGreaterThan(0);
    const problems = portProblems(before, { counts: next.counts(), databaseFile: DB_FILE, secrets: { wallet: true } }, ['wallet']);
    expect(problems).toEqual([]);
  });
});
