import { describe, expect, it } from 'vitest';
import { listFileUris, replaceFileUris } from '@/src/services/portFiles';

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
});
