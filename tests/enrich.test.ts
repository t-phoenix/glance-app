import { describe, expect, it } from 'vitest';
import { keepPhoto, keepText, portraitKey, portraitUrl } from '@/src/services/enrich';
import { openNodeDb } from '@/src/db/node';
import { GlanceRepository } from '@/src/db/repository';
import { classifyQr } from '@/src/parsers/qr';

const LINKEDIN = 'https://media.licdn.com/dms/image/v2/D4E/profile-displayphoto-shrink_800_800/0/1710000000000/priya?e=999&v=beta&t=token-a';
const LINKEDIN_REFRESHED = 'https://media.licdn.com/dms/image/v2/D4E/profile-displayphoto-shrink_800_800/0/1710000000000/priya?e=1000&v=beta&t=token-b';
const X = 'https://pbs.twimg.com/profile_images/123/priya_400x400.jpg';

describe('portrait size', () => {
  it('keeps a signed LinkedIn portrait and asks X for a small one', () => {
    expect(portraitUrl(LINKEDIN)).toBe(LINKEDIN);
    expect(portraitUrl(X)).toBe('https://pbs.twimg.com/profile_images/123/priya_200x200.jpg');
    expect(portraitUrl('file:///var/portraits/priya.img')).toBe('file:///var/portraits/priya.img');
    expect(portraitUrl(null)).toBeNull();
  });

  it('treats a refreshed LinkedIn link as the same portrait', () => {
    expect(portraitKey(portraitUrl(LINKEDIN)!)).toBe(portraitKey(portraitUrl(LINKEDIN_REFRESHED)!));
  });
});

describe('enrichment keeps saved profile fields', () => {
  it('keeps text and a real photo when the next lookup is empty or a logo', () => {
    expect(keepText(null, 'Priya Shah')).toBe('Priya Shah');
    expect(keepText('  ', 'Builds proofs')).toBe('Builds proofs');
    expect(keepText('Asha', 'Priya')).toBe('Asha');
    expect(keepPhoto(null, X)).toBe(X);
    expect(keepPhoto('https://static.licdn.com/aero/client/img/ghost-img.png', X)).toBe(X);
    expect(keepPhoto(LINKEDIN, X)).toBe(LINKEDIN);
    expect(keepPhoto('https://cdn.example/new.jpg', 'file:///var/portraits/priya.img')).toBe('file:///var/portraits/priya.img');
  });

  it('does not wipe a saved person when a later write is blank', () => {
    const repo = new GlanceRepository(openNodeDb());
    const saved = repo.capture({ qr: classifyQr('https://x.com/priyabuilds'), displayName: 'Priya' });
    const handle = repo.handles(saved.personId)[0]!;
    repo.updateHandle(handle.id, {
      displayName: 'Priya Shah',
      bio: 'Builds proofs',
      avatarUri: X,
      url: 'https://x.com/priyabuilds',
      score: 90,
    });
    repo.updatePerson(saved.personId, { summary: 'Builds proofs', photo_uri: X, company: 'Harbor' });
    repo.upsertHandle({
      personId: saved.personId,
      platform: 'x',
      value: 'priyabuilds',
      status: 'suggested',
      displayName: null,
      bio: null,
      avatarUri: null,
      url: null,
      score: null,
    });
    repo.updatePerson(saved.personId, { display_name: '', summary: null, photo_uri: 'https://static.licdn.com/aero/ghost.png', company: ' ' });
    const next = repo.handles(saved.personId)[0]!;
    const person = repo.person(saved.personId)!;
    expect(next.display_name).toBe('Priya Shah');
    expect(next.bio).toBe('Builds proofs');
    expect(next.avatar_uri).toBe(X);
    expect(next.url).toBe('https://x.com/priyabuilds');
    expect(next.score).toBe(90);
    expect(next.status).toBe('anchor');
    expect(person.display_name).toBe('Priya');
    expect(person.summary).toBe('Builds proofs');
    expect(person.photo_uri).toBe(X);
    expect(person.company).toBe('Harbor');
  });

  it('reads the same portrait for a list that the person page uses', () => {
    const repo = new GlanceRepository(openNodeDb());
    const first = repo.capture({ qr: classifyQr('https://www.linkedin.com/in/priya-shah'), displayName: 'Priya', lat: 12.97, lng: 77.59, tag: 'ETHIndia' });
    const second = repo.capture({ qr: classifyQr('https://t.me/asha_zk'), displayName: 'Asha' });
    repo.updateHandle(repo.handles(first.personId)[0]!.id, { avatarUri: LINKEDIN, displayName: 'Priya Shah' });
    repo.updatePerson(second.personId, { photo_uri: 'https://cdn.example/asha.jpg' });
    const cards = repo.listContext([first.personId, second.personId, first.personId]);
    expect(cards.get(first.personId)).toMatchObject({
      platform: 'linkedin',
      value: 'priya-shah',
      face: LINKEDIN,
      tag: 'ETHIndia',
      lat: 12.97,
    });
    expect(cards.get(second.personId)?.face).toBe('https://cdn.example/asha.jpg');
    expect(cards.size).toBe(2);
    expect(repo.listContext([]).size).toBe(0);
  });
});
