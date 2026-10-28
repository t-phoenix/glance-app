import { acceptModelOutput, applyEvidence, emptyNote, type StructuredNote } from '@/src/ai/structure';
import { STRUCTURE_PROMPT } from '@/src/ai/prompt';

const HAIKU = 'claude-haiku-5-5';
const SONNET = 'claude-sonnet-5-5';

interface MessageResponse {
  content?: { type: string; text?: string }[];
}

async function messages(key: string, model: string, content: unknown, maxTokens = 2000): Promise<string> {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': key,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model,
      max_tokens: maxTokens,
      system: STRUCTURE_PROMPT,
      messages: [{ role: 'user', content }],
    }),
  });
  if (response.status === 401 || response.status === 403) throw new Error('auth');
  if (!response.ok) throw new Error(String(response.status));
  const json = (await response.json()) as MessageResponse;
  return (json.content ?? []).filter((block) => block.type === 'text' && block.text).map((block) => block.text).join('\n');
}

export async function scoreAccountMatches(
  key: string,
  brief: string,
  hits: { platform: string; value: string; displayName: string | null; bio: string | null; score: number }[],
): Promise<Map<string, number>> {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({
      model: HAIKU,
      max_tokens: 800,
      system: 'Score whether each candidate is the same person as the primary account. Return only JSON {"scores":[{"key":"platform:value","score":80}]}. Scores are integers 0-100. Use only the candidates given.',
      messages: [{ role: 'user', content: `${brief}\nCandidates:\n${JSON.stringify(hits)}` }],
    }),
  });
  if (!response.ok) return new Map();
  const json = (await response.json()) as MessageResponse;
  const text = (json.content ?? []).map((block) => block.text ?? '').join('\n');
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start < 0 || end < start) return new Map();
  const parsed = JSON.parse(text.slice(start, end + 1)) as { scores?: { key?: string; score?: number }[] };
  const scores = new Map<string, number>();
  for (const row of parsed.scores ?? []) {
    if (!row.key || typeof row.score !== 'number') continue;
    scores.set(row.key.toLowerCase(), Math.max(0, Math.min(100, Math.round(row.score))));
  }
  return scores;
}

export async function structureWithClaude(key: string, transcript: string): Promise<StructuredNote | null> {
  const ask = `Transcript:\n"""${transcript}"""\nReturn the JSON object.`;
  let text = await messages(key, HAIKU, ask);
  let accepted = acceptModelOutput(transcript, text, false);
  if (accepted.repair) {
    text = await messages(key, SONNET, `${ask}\nThe previous output was not valid JSON. Return only the JSON object.`);
    accepted = acceptModelOutput(transcript, text, true);
  }
  return accepted.note;
}

export function heuristicNote(transcript: string): StructuredNote {
  const note = emptyNote();
  const cleaned = transcript.trim();
  if (!cleaned) return note;
  note.person.what_they_do = cleaned;
  note.evidence['person.what_they_do'] = cleaned;
  const name = cleaned.match(/\b([A-Z][a-z]+(?:\s[A-Z][a-z]+)?)\b/)?.[1];
  if (name && cleaned.includes(name)) {
    note.person.name = name;
    note.evidence['person.name'] = name;
  }
  const action = cleaned.match(/(?:i will|i'll|i’ll|follow up|send|introduce)[^.!\n]*/i)?.[0]?.trim();
  if (action && cleaned.toLowerCase().includes(action.toLowerCase())) {
    const channel = /telegram/i.test(cleaned) ? 'telegram' : /whatsapp/i.test(cleaned) ? 'whatsapp' : /linkedin/i.test(cleaned) ? 'linkedin' : /email/i.test(cleaned) ? 'email' : /\bx\b|twitter/i.test(cleaned) ? 'x' : null;
    note.actions.push({ text: action, owner: /they will|they'll|he will|she will/i.test(action) ? 'them' : 'me', due: cleaned.match(/20\d\d-\d\d-\d\d/)?.[0] ?? null, channel });
    note.evidence['actions.0.text'] = action;
  }
  return applyEvidence(cleaned, note);
}

export async function readBadge(key: string, base64: string, mediaType: 'image/jpeg' | 'image/png'): Promise<{ name: string; company: string; role: string; handles: string[] } | null> {
  const text = await messages(
    key,
    SONNET,
    [
      { type: 'image', source: { type: 'base64', media_type: mediaType, data: base64 } },
      { type: 'text', text: 'Read every conference badge in this photo. Return JSON {"badges":[{"name":"","company":"","role":"","handles":[]}]} . Only text you can see. No commentary.' },
    ],
    1500,
  );
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start < 0 || end < start) return null;
  const parsed = JSON.parse(text.slice(start, end + 1)) as { badges?: { name?: string; company?: string; role?: string; handles?: string[] }[] };
  const badge = parsed.badges?.[0];
  if (!badge) return null;
  return { name: badge.name ?? '', company: badge.company ?? '', role: badge.role ?? '', handles: badge.handles ?? [] };
}
