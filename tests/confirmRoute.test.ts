import { describe, expect, it } from 'vitest';
import { accountFromScan, latestConfirm, sameAccount, stageConfirm } from '@/src/services/confirmRoute';
import { assembleLinkedInDossier } from '@/src/services/profileDossier';

describe('confirm follows the scanned account', () => {
  it('reads the profile in the QR, including a second LinkedIn account', () => {
    expect(accountFromScan('https://www.linkedin.com/in/brettmorin/')).toMatchObject({ platform: 'linkedin', value: 'brettmorin' });
    expect(accountFromScan('  https://www.linkedin.com/in/brettmorin/?trk=public_profile\n')).toMatchObject({ value: 'brettmorin' });
    expect(accountFromScan('https://www.linkedin.com/in/husting')).toMatchObject({ value: 'husting' });
    expect(accountFromScan('https://lnkd.in/abc')).toBeNull();
    expect(accountFromScan('https://x.com/brett')).toMatchObject({ platform: 'x', value: 'brett' });
  });

  it('keeps the latest scan when the confirm screen is still open', () => {
    stageConfirm({ platform: 'linkedin', value: 'husting', url: 'https://www.linkedin.com/in/husting', name: 'Patrick Husting', company: '', hint: '', photo: '', bio: '', nonce: '1' });
    stageConfirm({ platform: 'linkedin', value: 'brettmorin', url: 'https://www.linkedin.com/in/brettmorin', name: '', company: '', hint: '', photo: '', bio: '', nonce: '2' });
    expect(latestConfirm()?.value).toBe('brettmorin');
    expect(sameAccount({ platform: 'linkedin', value: 'husting' }, 'linkedin', 'brettmorin')).toBe(false);
    expect(sameAccount({ platform: 'linkedin', value: 'brettmorin' }, 'linkedin', 'brettmorin')).toBe(true);
  });

  it('loads Brett from a payload that also contains Patrick', () => {
    const photo = (id: string) => `https://media.licdn.com/dms/image/v2/${id}/200_200/0/1?e=1&v=beta&t=${id}`;
    const person = (slug: string, first: string, id: string) => ({
      publicIdentifier: slug,
      firstName: first,
      lastName: 'Person',
      headline: `${first} headline`,
      summary: `${first} about`,
      profilePicture: { displayImageReference: { vectorImage: { rootUrl: `https://media.licdn.com/dms/image/v2/${id}/`, artifacts: [{ fileIdentifyingUrlPathSegment: `200_200/0/1?e=1&v=beta&t=${id}` }] } } },
    });
    const payload = { included: [person('husting', 'Patrick', 'D4D03AQHpatrick'), person('brettmorin', 'Brett', 'D4D03AQHbrett')] };
    const brett = assembleLinkedInDossier('brettmorin', [payload], `<img src="${photo('D4D03AQHpatrick')}">`);
    expect(brett?.value).toBe('brettmorin');
    expect(brett?.name).toBe('Brett Person');
    expect(brett?.headline).toBe('Brett headline');
    expect(brett?.about).toBe('Brett about');
    expect(brett?.photo).toContain('D4D03AQHbrett');
    expect(brett?.photo).not.toContain('patrick');
  });
});
