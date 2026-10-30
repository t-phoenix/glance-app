import { describe, expect, it } from 'vitest';
import { openNodeDb } from '@/src/db/node';
import { GlanceRepository } from '@/src/db/repository';
import { classifyQr } from '@/src/parsers/qr';

function savedPerson() {
  const repo = new GlanceRepository(openNodeDb());
  const saved = repo.capture({ qr: classifyQr('https://t.me/priya_zk'), displayName: 'Priya' });
  return { repo, personId: saved.personId };
}

describe('follow-up board', () => {
  it('keeps an undated task in Open, and a past date overdue but still Open', () => {
    const { repo, personId } = savedPerson();
    repo.addAction({ personId, text: 'Send the deck', owner: 'me' });
    repo.addAction({ personId, text: 'Send the intro', owner: 'me', due: '2020-01-01' });
    expect(repo.actions('open', '2026-10-29').map((row) => row.text)).toEqual(['Send the intro', 'Send the deck']);
    expect(repo.actions('overdue', '2026-10-29').map((row) => row.text)).toEqual(['Send the intro']);
    expect(repo.actions('waiting', '2026-10-29')).toHaveLength(0);
  });

  it('moves a card to another column and leaves who promised it alone', () => {
    const { repo, personId } = savedPerson();
    const id = repo.addAction({ personId, text: 'Send the intro', owner: 'them' });
    expect(repo.actions('waiting').map((row) => row.id)).toEqual([id]);
    repo.setActionStatus(id, 'open');
    expect(repo.actions('open').map((row) => row.id)).toEqual([id]);
    expect(repo.actions('waiting')).toHaveLength(0);
    expect(repo.actions('open')[0]?.owner).toBe('them');
    repo.setActionStatus(id, 'done');
    expect(repo.actions('done').map((row) => row.id)).toEqual([id]);
    expect(repo.actions('open')).toHaveLength(0);
    expect(repo.actions('done')[0]?.done_at).toBeTruthy();
    repo.setActionStatus(id, 'open');
    expect(repo.actions('open')[0]?.done_at).toBeNull();
  });

  it('saves only the proposals left checked', () => {
    const { repo, personId } = savedPerson();
    const saved = repo.saveTasks(personId, [
      { text: 'Keep this', owner: 'me', due: null, channel: null, draft: null, keep: true },
      { text: 'Drop this', owner: 'them', due: '2026-11-02', channel: 'telegram', draft: 'hi', keep: false },
      { text: '   ', owner: 'me', due: null, channel: null, draft: null, keep: true },
    ]);
    expect(saved).toBe(1);
    expect(repo.actions('open').map((row) => row.text)).toEqual(['Keep this']);
    expect(repo.actions('waiting')).toHaveLength(0);
    const kept = repo.saveTasks(personId, [
      { text: 'They send the list', owner: 'them', due: null, channel: null, draft: null, keep: true },
    ]);
    expect(kept).toBe(1);
    expect(repo.actions('waiting').map((row) => row.status)).toEqual(['waiting']);
  });

  it('removes an extra account and leaves the primary one', () => {
    const { repo, personId } = savedPerson();
    const anchor = repo.handles(personId).find((handle) => handle.status === 'anchor');
    expect(anchor).toBeTruthy();
    repo.rejectHandle(anchor!.id);
    expect(repo.handles(personId).find((handle) => handle.id === anchor!.id)?.status).toBe('anchor');
    const extra = repo.upsertHandle({ personId, platform: 'x', value: 'wrong', status: 'confirmed' });
    repo.rejectHandle(extra);
    expect(repo.handles(personId).find((handle) => handle.id === extra)?.status).toBe('rejected');
  });

  it('maps rows that predate status, and does not remap after a move', () => {
    const db = openNodeDb();
    db.exec(`
      CREATE TABLE person (id TEXT PRIMARY KEY, display_name TEXT);
      CREATE TABLE action (
        id TEXT PRIMARY KEY,
        person_id TEXT NOT NULL,
        text TEXT NOT NULL,
        owner TEXT NOT NULL,
        due TEXT,
        done_at TEXT,
        dismissed_at TEXT
      );
      INSERT INTO person (id, display_name) VALUES ('per_a', 'Ada');
      INSERT INTO action (id, person_id, text, owner, due) VALUES ('a1', 'per_a', 'Send the deck', 'me', '2020-01-01');
      INSERT INTO action (id, person_id, text, owner) VALUES ('a2', 'per_a', 'They send the intro', 'them');
      INSERT INTO action (id, person_id, text, owner, done_at) VALUES ('a3', 'per_a', 'Closed', 'me', '2020-01-02T00:00:00.000Z');
      INSERT INTO action (id, person_id, text, owner, dismissed_at) VALUES ('a4', 'per_a', 'Dropped', 'them', '2020-01-03T00:00:00.000Z');
    `);
    const repo = new GlanceRepository(db);
    expect(repo.actions('open', '2026-10-29').map((row) => row.text)).toEqual(['Send the deck']);
    expect(repo.actions('overdue', '2026-10-29').map((row) => row.text)).toEqual(['Send the deck']);
    expect(repo.actions('waiting').map((row) => row.text)).toEqual(['They send the intro']);
    expect(repo.actions('done').map((row) => row.text)).toEqual(['Closed']);
    repo.setActionStatus('a2', 'open');
    const again = new GlanceRepository(db);
    expect(again.actions('open', '2026-10-29').map((row) => row.text)).toEqual(['Send the deck', 'They send the intro']);
    expect(again.actions('waiting')).toHaveLength(0);
    expect(again.actions('done').map((row) => row.text)).toEqual(['Closed']);
  });
});
