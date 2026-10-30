import { describe, expect, it } from 'vitest';
import { documentRelative, joinDocumentUri, listFileUris, replaceFileUris } from '@/src/services/portFiles';
import { openNodeDb } from '@/src/db/node';
import { GlanceRepository } from '@/src/db/repository';
import { classifyQr } from '@/src/parsers/qr';

describe('porting Expo Go files', () => {
  it('collects local files and leaves remote portraits', () => {
    const database = JSON.stringify({
      person: [{ photo_uri: 'file:///var/expo/priya.jpg' }, { photo_uri: 'https://pbs.twimg.com/a.jpg' }],
      encounter: [{ audio_uri: 'file:///var/expo/note.m4a', photo_uri: 'file:///var/expo/priya.jpg' }],
    });
    expect(listFileUris(database)).toEqual(['file:///var/expo/priya.jpg', 'file:///var/expo/note.m4a']);
  });

  it('rewrites each local file onto the installed app path', () => {
    const database = '{"photo_uri":"file:///var/expo/priya.jpg","again":"file:///var/expo/priya.jpg"}';
    expect(replaceFileUris(database, [{ from: 'file:///var/expo/priya.jpg', to: 'file:///var/glance/0.jpg' }])).toBe(
      '{"photo_uri":"file:///var/glance/0.jpg","again":"file:///var/glance/0.jpg"}',
    );
  });

  it('points a saved photo at the Documents folder from this install when the file is still there', () => {
    const oldUri = 'file:///var/mobile/Containers/Data/Application/OLD-UUID/Documents/portraits/face.img';
    const docs = 'file:///var/mobile/Containers/Data/Application/NEW-UUID/Documents';
    expect(documentRelative(oldUri)).toBe('portraits/face.img');
    expect(joinDocumentUri(docs, 'portraits/face.img')).toBe(`${docs}/portraits/face.img`);
    const repo = new GlanceRepository(openNodeDb());
    const saved = repo.capture({ qr: classifyQr('https://www.linkedin.com/in/ada'), displayName: 'Ada' });
    repo.updatePerson(saved.personId, { photo_uri: oldUri });
    const handle = repo.handles(saved.personId)[0];
    expect(handle).toBeTruthy();
    repo.updateHandle(handle!.id, { avatarUri: oldUri });
    expect(repo.repairDocumentUris(docs, () => false)).toBe(0);
    expect(repo.person(saved.personId)?.photo_uri).toBe(oldUri);
    expect(repo.repairDocumentUris(docs, (relative) => relative === 'portraits/face.img')).toBe(2);
    expect(repo.person(saved.personId)?.photo_uri).toBe(`${docs}/portraits/face.img`);
    expect(repo.handles(saved.personId)[0]?.avatar_uri).toBe(`${docs}/portraits/face.img`);
  });
});
