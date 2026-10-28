export type Confidence = 'high' | 'medium' | 'low';

export interface ScoreSignal {
  signal: string;
  detail: string;
  weight: number;
}

export interface ScoreInput {
  linkedFromConfirmedBio: boolean;
  postedAboutEventThisWeek: boolean;
  nameMatch: boolean;
  sameCompanyDomain: boolean;
  avatarLooksSimilar: boolean;
  alreadyConfirmedForPersonId?: string | null;
  previouslyRejected: boolean;
}

export interface ScoreOutput {
  excluded: boolean;
  flag?: 'I1';
  level: Confidence;
  score: number;
  evidence: ScoreSignal[];
  preselect: false;
}

/**
 * Rank a candidate. Low is a real result, never hidden and never pre-selected.
 * An avatar similarity alone cannot reach High. A face hint is never proof.
 */
export function scoreCandidate(input: ScoreInput): ScoreOutput {
  if (input.previouslyRejected) {
    return { excluded: true, level: 'low', score: 0, evidence: [], preselect: false };
  }
  if (input.alreadyConfirmedForPersonId) {
    return {
      excluded: true,
      flag: 'I1',
      level: 'low',
      score: 0,
      evidence: [{ signal: 'already_linked', detail: input.alreadyConfirmedForPersonId, weight: 0 }],
      preselect: false,
    };
  }

  const evidence: ScoreSignal[] = [];
  if (input.linkedFromConfirmedBio) {
    evidence.push({ signal: 'bio_link', detail: 'Linked from a confirmed profile', weight: 0.72 });
  }
  if (input.postedAboutEventThisWeek && input.nameMatch) {
    evidence.push({ signal: 'event_post', detail: 'Posted about this event and the name matches', weight: 0.7 });
  }
  if (input.sameCompanyDomain && input.nameMatch) {
    evidence.push({ signal: 'name_and_company', detail: 'Same name and company domain', weight: 0.45 });
  }
  if (input.avatarLooksSimilar) {
    evidence.push({ signal: 'avatar', detail: 'Avatar looks similar. This is not proof.', weight: 0.35 });
  }
  if (input.nameMatch && evidence.length === 0) {
    evidence.push({ signal: 'name_only', detail: 'Name match only', weight: 0.2 });
  } else if (input.nameMatch && !evidence.some((item) => item.signal === 'name_only')) {
    evidence.push({ signal: 'name', detail: 'Name matches', weight: 0.15 });
  }

  const score = Math.min(1, evidence.reduce((sum, item) => sum + item.weight, 0));
  let level: Confidence = 'low';
  if (input.linkedFromConfirmedBio || (input.postedAboutEventThisWeek && input.nameMatch)) level = 'high';
  else if ((input.sameCompanyDomain && input.nameMatch) || input.avatarLooksSimilar) level = 'medium';
  else level = 'low';

  if (input.avatarLooksSimilar && !input.linkedFromConfirmedBio && !(input.postedAboutEventThisWeek && input.nameMatch)) {
    if (level === 'high') level = 'medium';
  }

  return { excluded: false, level, score, evidence, preselect: false };
}
