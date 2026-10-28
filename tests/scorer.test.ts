import { describe, expect, it } from 'vitest';
import { scoreCandidate } from '@/src/services/scorer';

const base = {
  linkedFromConfirmedBio: false,
  postedAboutEventThisWeek: false,
  nameMatch: false,
  sameCompanyDomain: false,
  avatarLooksSimilar: false,
  previouslyRejected: false,
};

describe('scorer', () => {
  it('U-S-01 bio link is high and not preselected', () => {
    const score = scoreCandidate({ ...base, linkedFromConfirmedBio: true });
    expect(score.level).toBe('high');
    expect(score.preselect).toBe(false);
    expect(score.excluded).toBe(false);
  });
  it('U-S-02 event post plus name is high', () => {
    expect(scoreCandidate({ ...base, postedAboutEventThisWeek: true, nameMatch: true }).level).toBe('high');
  });
  it('U-S-03 name and company is medium', () => {
    expect(scoreCandidate({ ...base, nameMatch: true, sameCompanyDomain: true }).level).toBe('medium');
  });
  it('U-S-04 avatar alone is at most medium', () => {
    const score = scoreCandidate({ ...base, avatarLooksSimilar: true });
    expect(score.level).not.toBe('high');
    expect(score.level).toBe('medium');
  });
  it('U-S-05 name only is low', () => {
    const score = scoreCandidate({ ...base, nameMatch: true });
    expect(score.level).toBe('low');
    expect(score.preselect).toBe(false);
  });
  it('U-S-06 already linked is I1', () => {
    const score = scoreCandidate({ ...base, alreadyConfirmedForPersonId: 'Marco R.' });
    expect(score.flag).toBe('I1');
    expect(score.excluded).toBe(true);
  });
  it('U-S-07 rejected is excluded', () => {
    expect(scoreCandidate({ ...base, previouslyRejected: true, nameMatch: true }).excluded).toBe(true);
  });
});
