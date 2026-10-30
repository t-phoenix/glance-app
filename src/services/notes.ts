import type { StructuredNote } from '@/src/ai/structure';
import type { TaskDraft } from '@/src/db/repository';

export function bulletsFromText(text: string): string {
  const lines = text
    .split(/\n+/)
    .flatMap((line) => line.split(/(?<=[.!?])\s+/))
    .map((line) => line.trim())
    .filter(Boolean);
  return lines.map((line) => (line.startsWith('-') ? line : `- ${line}`)).join('\n');
}

export function bulletsFromStructured(note: StructuredNote): string {
  const lines: string[] = [];
  const who = [note.person.name, note.person.role, note.person.company].filter(Boolean).join(', ');
  if (who) lines.push(`- ${who}`);
  if (note.person.what_they_do) lines.push(`- ${note.person.what_they_do}`);
  for (const topic of note.topics) if (topic) lines.push(`- ${topic}`);
  for (const need of note.they_need) if (need) lines.push(`- They need: ${need}`);
  for (const help of note.can_help_me_with) if (help) lines.push(`- Can help with: ${help}`);
  for (const action of note.actions) {
    if (!action.text) continue;
    lines.push(`- ${action.owner === 'me' ? 'I will' : 'They will'}: ${action.text}`);
  }
  if (note.draft_followup) lines.push(`- Follow up: ${note.draft_followup}`);
  return lines.join('\n');
}

export function estimateMatchCost(hasKey: boolean): { title: string; detail: string; estimate: string } {
  return {
    title: 'Find their other accounts',
    estimate: hasKey ? 'Estimate: under $0.01' : 'Estimate: $0',
    detail: hasKey
      ? 'Uses the name, handle, and bio already saved from the primary account. Glance checks X, LinkedIn, Telegram, WhatsApp, and GitHub, then Claude Haiku scores how likely each public profile is the same person. You choose one account per platform. Anthropic bills your key. Glance does not add a fee.'
      : 'Uses the name, handle, and bio already saved from the primary account and checks public pages on X, LinkedIn, Telegram, WhatsApp, and GitHub. Scores come from the handle and name match. No model is called. You choose one account per platform.',
  };
}

export function estimateVoiceCost(hasClaude: boolean): { title: string; detail: string; estimate: string } {
  return {
    title: 'Turn this recording into bullets',
    estimate: 'Estimate: under $0.01',
    detail: hasClaude
      ? 'Groq Whisper transcribes the voice memo, then Claude Haiku rewrites that transcript as bullets: who they are, what you talked about, and what was promised. Text you already typed is not sent. The audio file stays on this phone. Groq and Anthropic bill their own keys. Glance does not add a fee.'
      : 'Groq Whisper transcribes the voice memo and Glance splits that transcript into bullets on this phone. Text you already typed is not sent. No Claude call is made. The audio file stays on this phone.',
  };
}

export function taskDrafts(note: StructuredNote): TaskDraft[] {
  const draft = note.draft_followup.trim() || null;
  return note.actions
    .filter((action) => action.text.trim())
    .map((action) => ({
      text: action.text.trim(),
      owner: action.owner,
      due: action.due,
      channel: action.channel,
      draft,
      keep: true,
    }));
}

export function estimateFollowupCost(text: string): { title: string; detail: string; estimate: string } {
  const priced = estimateNoteCost(text);
  return {
    title: 'Make follow-ups',
    estimate: priced.estimate,
    detail: `Claude Haiku reads the notes already saved for this person (${text.length} characters) and proposes one task per promise. The recording is not sent. Nothing is saved until you keep or drop each task. Anthropic bills your own key. Glance does not add a fee.`,
  };
}

export function estimateNoteCost(text: string): { title: string; detail: string; estimate: string } {
  const inputTokens = Math.ceil((text.length + 1200) / 4);
  const outputTokens = 600;
  const usd = (inputTokens * 1 + outputTokens * 5) / 1_000_000;
  const estimate = usd < 0.01 ? 'Estimate: under $0.01' : `Estimate: about $${usd.toFixed(2)}`;
  return {
    title: 'Draft bullet notes',
    estimate,
    detail: `Claude Haiku reads this note (${text.length} characters) and rewrites the gist as bullets: who they are, what you talked about, and what was promised. The recording and the note stay on this phone. No account is linked. Anthropic bills your own key. This estimate uses $1 per million input tokens and $5 per million output tokens; Anthropic's invoice is the real charge. Glance does not add a fee.`,
  };
}
