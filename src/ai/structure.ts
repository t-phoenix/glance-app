export interface StructuredPerson {
  name: string;
  role: string;
  company: string;
  what_they_do: string;
}

export interface StructuredAction {
  text: string;
  owner: 'me' | 'them';
  due: string | null;
  channel: 'telegram' | 'x' | 'linkedin' | 'whatsapp' | 'email' | null;
}

export interface StructuredNote {
  person: StructuredPerson;
  topics: string[];
  they_need: string[];
  can_help_me_with: string[];
  actions: StructuredAction[];
  tags: string[];
  evidence: Record<string, string>;
  draft_followup: string;
}

export function emptyNote(): StructuredNote {
  return {
    person: { name: '', role: '', company: '', what_they_do: '' },
    topics: [],
    they_need: [],
    can_help_me_with: [],
    actions: [],
    tags: [],
    evidence: {},
    draft_followup: '',
  };
}

function asString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function asStringList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map(asString).filter(Boolean);
}

export function parseStructuredNote(input: unknown): StructuredNote | null {
  if (!input || typeof input !== 'object') return null;
  const raw = input as Record<string, unknown>;
  const personRaw = (raw.person ?? {}) as Record<string, unknown>;
  const actionsRaw = Array.isArray(raw.actions) ? raw.actions : [];
  const evidence = raw.evidence && typeof raw.evidence === 'object' ? (raw.evidence as Record<string, unknown>) : {};
  const note: StructuredNote = {
    person: {
      name: asString(personRaw.name),
      role: asString(personRaw.role),
      company: asString(personRaw.company),
      what_they_do: asString(personRaw.what_they_do),
    },
    topics: asStringList(raw.topics),
    they_need: asStringList(raw.they_need),
    can_help_me_with: asStringList(raw.can_help_me_with),
    actions: actionsRaw.map((item) => {
      const action = (item ?? {}) as Record<string, unknown>;
      const owner: 'me' | 'them' = action.owner === 'them' ? 'them' : 'me';
      const allowed = ['telegram', 'x', 'linkedin', 'whatsapp', 'email'] as const;
      const channel = allowed.find((item) => item === action.channel) ?? null;
      const due = asString(action.due);
      return { text: asString(action.text), owner, due: due || null, channel };
    }).filter((action) => action.text),
    tags: asStringList(raw.tags),
    evidence: Object.fromEntries(Object.entries(evidence).map(([key, value]) => [key, asString(value)])),
    draft_followup: asString(raw.draft_followup),
  };
  return note;
}

export function extractJsonObject(text: string): unknown | null {
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start < 0 || end <= start) return null;
  try {
    return JSON.parse(text.slice(start, end + 1));
  } catch {
    return null;
  }
}

function quoteInTranscript(transcript: string, quote: string | undefined): boolean {
  if (!quote || quote.trim().length < 2) return false;
  return transcript.toLowerCase().includes(quote.trim().toLowerCase());
}

/** Drop every field whose evidence quote is missing or not in the transcript. */
export function applyEvidence(transcript: string, note: StructuredNote): StructuredNote {
  const next = emptyNote();
  const keep = (path: string) => quoteInTranscript(transcript, note.evidence[path]);
  if (keep('person.name')) next.person.name = note.person.name;
  if (keep('person.role')) next.person.role = note.person.role;
  if (keep('person.company')) next.person.company = note.person.company;
  if (keep('person.what_they_do')) next.person.what_they_do = note.person.what_they_do;
  next.topics = note.topics.filter((_, index) => keep(`topics.${index}`));
  next.they_need = note.they_need.filter((_, index) => keep(`they_need.${index}`));
  next.can_help_me_with = note.can_help_me_with.filter((_, index) => keep(`can_help_me_with.${index}`));
  next.actions = note.actions.filter((_, index) => keep(`actions.${index}.text`));
  next.tags = note.tags.filter((_, index) => keep(`tags.${index}`));
  if (keep('draft_followup')) next.draft_followup = note.draft_followup;
  next.evidence = Object.fromEntries(
    Object.entries(note.evidence).filter(([, quote]) => quoteInTranscript(transcript, quote)),
  );
  return next;
}

export interface AcceptResult {
  note: StructuredNote | null;
  repair: boolean;
}

/** One repair retry. A second invalid payload is rejected. */
export function acceptModelOutput(transcript: string, text: string, alreadyRepaired: boolean): AcceptResult {
  const parsed = parseStructuredNote(extractJsonObject(text));
  if (!parsed) return { note: null, repair: !alreadyRepaired };
  return { note: applyEvidence(transcript, parsed), repair: false };
}
