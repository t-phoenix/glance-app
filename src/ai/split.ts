import type { StructuredNote } from '@/src/ai/structure';
import { emptyNote } from '@/src/ai/structure';

export interface StubRef {
  id: string;
  name: string;
  handle: string;
}

export interface HuddleSplit {
  assignments: { stubId: string; text: string }[];
  unmatched: string[];
  unmentioned: string[];
}

function sentences(transcript: string): string[] {
  return transcript
    .split(/(?<=[.!?])\s+|\n+/)
    .map((part) => part.trim())
    .filter(Boolean);
}

function mentions(sentence: string, stub: StubRef): boolean {
  const hay = sentence.toLowerCase();
  const name = stub.name.trim().toLowerCase();
  const handle = stub.handle.trim().toLowerCase().replace(/^@/, '');
  if (name && name.length > 1 && hay.includes(name)) return true;
  if (handle && handle.length > 1 && hay.includes(handle)) return true;
  return false;
}

/** Assign each sentence to a stub already in the huddle. Never invent a person. */
export function splitGroupNote(transcript: string, stubs: StubRef[]): HuddleSplit {
  const buckets = new Map<string, string[]>();
  const unmatched: string[] = [];
  for (const sentence of sentences(transcript)) {
    const hit = stubs.find((stub) => mentions(sentence, stub));
    if (!hit) {
      unmatched.push(sentence);
      continue;
    }
    const list = buckets.get(hit.id) ?? [];
    list.push(sentence);
    buckets.set(hit.id, list);
  }
  const assignments = [...buckets.entries()].map(([stubId, parts]) => ({ stubId, text: parts.join(' ') }));
  const unmentioned = stubs.filter((stub) => !buckets.has(stub.id)).map((stub) => stub.id);
  return { assignments, unmatched, unmentioned };
}

export function noteFromAssignment(text: string, name: string): StructuredNote {
  const note = emptyNote();
  note.person.what_they_do = text;
  note.person.name = name;
  note.evidence = {
    'person.name': name,
    'person.what_they_do': text,
  };
  return note;
}
