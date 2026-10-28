import { describe, expect, it } from 'vitest';
import { acceptModelOutput, emptyNote, parseStructuredNote } from '@/src/ai/structure';
import { splitGroupNote } from '@/src/ai/split';

const transcript = 'Priya builds ZK identity at Avail. I will send the intro on Telegram by 2026-11-05.';

describe('ai', () => {
  it('U-AI-01 rejects a payload with no evidence object fields kept', () => {
    const note = parseStructuredNote({
      person: { name: 'Priya', role: '', company: 'Avail', what_they_do: '' },
      topics: [],
      they_need: [],
      can_help_me_with: [],
      actions: [],
      tags: [],
      evidence: {},
      draft_followup: '',
    });
    const accepted = acceptModelOutput(transcript, JSON.stringify(note), false);
    expect(accepted.note?.person.name).toBe('');
    expect(accepted.note?.person.company).toBe('');
  });
  it('U-AI-02 drops a quote that is not in the transcript', () => {
    const note = emptyNote();
    note.person.name = 'Priya';
    note.person.company = 'Avail';
    note.evidence = { 'person.name': 'Priya', 'person.company': 'not in the note' };
    const accepted = acceptModelOutput(transcript, JSON.stringify(note), false);
    expect(accepted.note?.person.name).toBe('Priya');
    expect(accepted.note?.person.company).toBe('');
  });
  it('U-AI-03 repairs once', () => {
    expect(acceptModelOutput(transcript, 'nope', false).repair).toBe(true);
    expect(acceptModelOutput(transcript, 'still nope', true).repair).toBe(false);
    expect(acceptModelOutput(transcript, 'still nope', true).note).toBeNull();
  });
  it('U-AI-04 split maps to stubs or unmatched', () => {
    const stubs = [
      { id: 'a', name: 'Priya', handle: 'priya' },
      { id: 'b', name: 'Karan', handle: 'karan' },
      { id: 'c', name: 'Asha', handle: 'asha' },
      { id: 'd', name: 'Dev', handle: 'dev' },
      { id: 'e', name: 'Omar', handle: 'omar' },
    ];
    const split = splitGroupNote('Priya is building proofs. Karan runs a fund. Asha wants an intro. Dev is hiring.', stubs);
    expect(split.assignments.map((row) => row.stubId).sort()).toEqual(['a', 'b', 'c', 'd']);
    expect(split.unmentioned).toEqual(['e']);
  });
});
