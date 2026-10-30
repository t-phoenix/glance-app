import { describe, expect, it } from 'vitest';
import { openNodeDb } from '@/src/db/node';
import { GlanceRepository } from '@/src/db/repository';
import { classifyQr } from '@/src/parsers/qr';
import { applyDossier } from '@/src/services/primaryAccount';
import { handlesInText } from '@/src/services/profiles';
import { isLinkedInProfilePhoto } from '@/src/services/linkedinDirectory';
import {
  assembleLinkedInDossier,
  dossierFromKnown,
  dossierSearchText,
  linkedinDossierFromHtml,
  linkedinDossierFromPayload,
  matchBrief,
  parseDossier,
  preferDossier,
  profileReady,
  scoreWithDossier,
  serializeDossier,
  xDossierFromRecord,
  type ProfileDossier,
} from '@/src/services/profileDossier';
import { scoreCandidate } from '@/src/services/scorer';

const PHOTO = 'https://media.licdn.com/dms/image/v2/D4E/profile-displayphoto-shrink_200_200/0/priya';
const X_PHOTO = 'https://pbs.twimg.com/profile_images/1/priya_400x400.jpg';

const linkedinPayload = {
  included: [
    {
      publicIdentifier: 'priya-shah',
      firstName: 'Priya',
      lastName: 'Shah',
      headline: 'Engineer at Harbor',
      summary: 'Builds proofs. https://x.com/priyabuilds',
      geoLocationName: 'Bengaluru, India',
      profilePicture: {
        rootUrl: 'https://media.licdn.com/dms/image/v2/D4E/profile-displayphoto-shrink_',
        fileIdentifyingUrlPathSegment: '200_200/0/priya',
      },
    },
    { title: 'Engineer', companyName: 'Harbor', dateRange: { start: { year: 2022 } } },
    { schoolName: 'IIT Bombay', degreeName: 'BTech', dateRange: { start: { year: 2016 }, end: { year: 2020 } } },
    { phoneNumber: { number: '+919800011122' } },
  ],
};

describe('profile dossier', () => {
  it('reads a LinkedIn profile, job, school, and phone', () => {
    const dossier = linkedinDossierFromPayload(linkedinPayload, 'priya-shah');
    expect(dossier.name).toBe('Priya Shah');
    expect(dossier.photo).toContain('profile-displayphoto');
    expect(dossier.headline).toBe('Engineer at Harbor');
    expect(dossier.company).toBe('Harbor');
    expect(dossier.location).toBe('Bengaluru, India');
    expect(dossier.experience[0]).toMatchObject({ title: 'Engineer', company: 'Harbor', dates: '2022 – now' });
    expect(dossier.education[0]).toMatchObject({ school: 'IIT Bombay', degree: 'BTech', dates: '2016 – 2020' });
    expect(dossier.phone).toBe('+919800011122');
    expect(profileReady(dossier)).toBe(true);
    expect(handlesInText(dossierSearchText(dossier))).toContainEqual({ platform: 'x', value: 'priyabuilds' });
  });

  it('refuses a confirm when the face or the name is missing', () => {
    const named = linkedinDossierFromPayload(linkedinPayload, 'priya-shah');
    expect(profileReady({ ...named, photo: null })).toBe(false);
    expect(profileReady({ ...named, name: null })).toBe(false);
    expect(profileReady({ ...named, photo: 'https://static.licdn.com/aero/ghost-img.png' })).toBe(false);
  });

  it('reads an X profile with a website and a location', () => {
    const dossier = xDossierFromRecord({
      data: {
        name: 'Priya Shah',
        description: 'Builds proofs',
        location: 'Bengaluru',
        url: 'https://www.linkedin.com/in/priya-shah',
        profilePicture: 'https://pbs.twimg.com/profile_images/1/priya_normal.jpg',
      },
    }, 'priyabuilds');
    expect(dossier.name).toBe('Priya Shah');
    expect(dossier.photo).toBe(X_PHOTO);
    expect(dossier.location).toBe('Bengaluru');
    expect(dossier.links.map((link) => link.url)).toContain('https://www.linkedin.com/in/priya-shah');
    expect(profileReady(dossier)).toBe(true);
    expect(handlesInText(dossierSearchText(dossier))).toContainEqual({ platform: 'linkedin', value: 'priya-shah' });
  });

  it('keeps a saved face when the next read has none', () => {
    const ready = xDossierFromRecord({ name: 'Priya Shah', description: 'Builds proofs', profilePicture: X_PHOTO }, 'priyabuilds');
    const thin = xDossierFromRecord({ name: 'Priya Shah', description: 'A longer about that arrived later' }, 'priyabuilds');
    expect(profileReady(preferDossier(ready, thin))).toBe(true);
    expect(preferDossier(ready, thin)?.photo).toBe(X_PHOTO);
    const stored = parseDossier(serializeDossier(ready));
    expect(stored?.name).toBe('Priya Shah');
    expect(stored?.photo).toBe(X_PHOTO);
  });

  it('uses company and city in the score and leaves the match unselected', () => {
    const dossier: ProfileDossier = {
      platform: 'linkedin',
      value: 'priya-shah',
      name: 'Priya Shah',
      photo: PHOTO,
      headline: 'Engineer at Harbor',
      about: null,
      location: 'Bengaluru, India',
      company: 'Harbor',
      links: [],
      phone: null,
      experience: [],
      education: [],
    };
    const scored = scoreWithDossier({
      score: 40,
      evidence: 'Name match only.',
      bio: 'Engineer at Harbor in Bengaluru',
      displayName: 'Priya Shah',
    }, dossier);
    expect(scored.score).toBeGreaterThanOrEqual(60);
    expect(scored.evidence).toContain('Same company Harbor');
    expect(scored.evidence).toContain('Bengaluru');
    expect(scoreCandidate({
      linkedFromConfirmedBio: true,
      postedAboutEventThisWeek: false,
      nameMatch: true,
      sameCompanyDomain: false,
      avatarLooksSimilar: false,
      previouslyRejected: false,
    }).preselect).toBe(false);
  });

  it('keeps a LinkedIn face that no longer uses the displayphoto name', () => {
    const photo = 'https://media.licdn.com/dms/image/v2/D4D03AQHpriya/200_200/0/171?e=1&v=beta&t=abc';
    expect(isLinkedInProfilePhoto(photo)).toBe(true);
    expect(isLinkedInProfilePhoto('https://media.licdn.com/dms/image/v2/D4E0BAQlogo/company-logo_200_200/0/1')).toBe(false);
    const dossier = linkedinDossierFromPayload({
      included: [{
        publicIdentifier: 'priya-shah',
        firstName: 'Priya',
        lastName: 'Shah',
        headline: 'Engineer',
        profilePicture: {
          displayImageReference: {
            vectorImage: {
              rootUrl: 'https://media.licdn.com/dms/image/v2/D4D03AQHpriya/',
              artifacts: [{ fileIdentifyingUrlPathSegment: '200_200/0/171?e=1&v=beta&t=abc' }],
            },
          },
        },
      }],
    }, 'priya-shah');
    expect(dossier.photo).toBe(photo);
    expect(profileReady(dossier)).toBe(true);
    const known = dossierFromKnown({ platform: 'linkedin', value: 'priya-shah', name: 'Priya Shah', bio: 'Engineer', photo });
    expect(known?.headline).toBe('Engineer');
    expect(profileReady(known)).toBe(true);
    const merged = preferDossier(known, { ...dossier, photo: null, about: 'Builds proofs' });
    expect(merged?.photo).toBe(photo);
    expect(merged?.about).toBe('Builds proofs');
    const downloaded = preferDossier(known, { ...dossier, photo: 'file:///portraits/priya.img' });
    expect(downloaded?.photo).toBe('file:///portraits/priya.img');
    expect(profileReady(downloaded)).toBe(true);
    expect(preferDossier(downloaded, { ...dossier, photo })?.photo).toBe('file:///portraits/priya.img');
    const other = 'https://media.licdn.com/dms/image/v2/D4D03AQHother/200_200/0/9?e=1&v=beta&t=no';
    expect(preferDossier(known, { ...dossier, photo: other })?.photo).toBe(photo);
  });

  it('uses the scanned member face, not the signed-in viewer in the header', () => {
    const theirs = 'https://media.licdn.com/dms/image/v2/D4D03AQHtheir/200_200/0/171?e=1&v=beta&t=them';
    const mine = 'https://media.licdn.com/dms/image/v2/D4D03AQHmine/200_200/0/171?e=1&v=beta&t=me';
    const dossier = linkedinDossierFromPayload({
      included: [
        {
          publicIdentifier: 'me-the-viewer',
          firstName: 'Abhinil',
          lastName: 'Agarwal',
          headline: 'My own headline',
          profilePicture: { displayImageReference: { vectorImage: { rootUrl: 'https://media.licdn.com/dms/image/v2/D4D03AQHmine/', artifacts: [{ fileIdentifyingUrlPathSegment: '200_200/0/171?e=1&v=beta&t=me' }] } } },
        },
        {
          publicIdentifier: 'priya-shah',
          firstName: 'Priya',
          lastName: 'Shah',
          headline: 'Engineer',
          profilePicture: { displayImageReference: { vectorImage: { rootUrl: 'https://media.licdn.com/dms/image/v2/D4D03AQHtheir/', artifacts: [{ fileIdentifyingUrlPathSegment: '200_200/0/171?e=1&v=beta&t=them' }] } } },
        },
      ],
    }, 'priya-shah');
    expect(dossier.name).toBe('Priya Shah');
    expect(dossier.photo).toBe(theirs);
    expect(dossier.photo).not.toBe(mine);
    const page = linkedinDossierFromHtml(
      `<html><head><meta property="og:title" content="Priya Shah - Engineer | LinkedIn"><meta property="og:image" content="${theirs}"></head><body><img src="${mine}"></body></html>`,
      'priya-shah',
    );
    expect(page.photo).toBe(theirs);
    expect(linkedinDossierFromHtml(`<html><body><img src="${mine}"></body></html>`, 'priya-shah').photo).toBeNull();
  });

  it('follows the scanned profile asset and ignores the signed-in member', () => {
    const theirs = 'https://media.licdn.com/dms/image/v2/D4D03AQHtheir/200_200/0/171?e=1&v=beta&t=them';
    const mine = 'https://media.licdn.com/dms/image/v2/D4D03AQHmine/200_200/0/171?e=1&v=beta&t=me';
    const dossier = linkedinDossierFromPayload({
      included: [
        {
          publicIdentifier: 'me-the-viewer',
          firstName: 'Abhinil',
          lastName: 'Agarwal',
          profilePicture: { displayImageReference: { vectorImage: { rootUrl: 'https://media.licdn.com/dms/image/v2/D4D03AQHmine/', artifacts: [{ fileIdentifyingUrlPathSegment: '200_200/0/171?e=1&v=beta&t=me' }] } } },
        },
        {
          publicIdentifier: 'priya-shah',
          firstName: 'Priya',
          lastName: 'Shah',
          headline: 'Engineer',
          profilePicture: { displayImageUrn: 'urn:li:digitalmediaAsset:D4D03AQHtheir' },
        },
        {
          entityUrn: 'urn:li:digitalmediaAsset:D4D03AQHtheir',
          rootUrl: 'https://media.licdn.com/dms/image/v2/D4D03AQHtheir/',
          artifacts: [{ fileIdentifyingUrlPathSegment: '200_200/0/171?e=1&v=beta&t=them' }],
        },
      ],
    }, 'priya-shah');
    expect(dossier.photo).toBe(theirs);
    expect(dossier.photo).not.toBe(mine);
    const bare = linkedinDossierFromPayload({
      included: [
        {
          publicIdentifier: 'me-the-viewer',
          profilePicture: { displayImageReference: { vectorImage: { rootUrl: 'https://media.licdn.com/dms/image/v2/D4D03AQHmine/', artifacts: [{ fileIdentifyingUrlPathSegment: '200_200/0/171?e=1&v=beta&t=me' }] } } },
        },
        { publicIdentifier: 'priya-shah', firstName: 'Priya', lastName: 'Shah', headline: 'Engineer' },
      ],
    }, 'priya-shah');
    expect(bare.photo).toBeNull();
  });

  it('reads the tapped account and stores that profile on the phone', () => {
    const patrick = 'https://media.licdn.com/dms/image/v2/D4D03AQHpatrick/200_200/0/1?e=1&v=beta&t=pat';
    const mine = 'https://media.licdn.com/dms/image/v2/D4D03AQHmine/200_200/0/1?e=1&v=beta&t=me';
    const payload = {
      included: [
        {
          publicIdentifier: 'me-the-viewer',
          firstName: 'Abhinil',
          lastName: 'Agarwal',
          headline: 'My headline',
          summary: 'The signed-in member wrote a much longer about section that must not replace the scanned person.',
          profilePicture: { displayImageReference: { vectorImage: { rootUrl: 'https://media.licdn.com/dms/image/v2/D4D03AQHmine/', artifacts: [{ fileIdentifyingUrlPathSegment: '200_200/0/1?e=1&v=beta&t=me' }] } } },
        },
        {
          publicIdentifier: 'husting',
          firstName: 'Patrick',
          lastName: 'Husting',
          headline: 'Rebooting is a Development Strategy',
          summary: 'Over my glorious career.',
          geoLocationName: 'Sammamish, Washington',
          profilePicture: { displayImageReference: { vectorImage: { rootUrl: 'https://media.licdn.com/dms/image/v2/D4D03AQHpatrick/', artifacts: [{ fileIdentifyingUrlPathSegment: '200_200/0/1?e=1&v=beta&t=pat' }] } } },
        },
        { title: 'Founder', companyName: 'Show Day', dateRange: { start: { year: 2018 } } },
        { schoolName: 'State University', degreeName: 'BS', dateRange: { start: { year: 1990 }, end: { year: 1994 } } },
        { url: 'https://ghostwriter-ai.com' },
      ],
    };
    const html = `<html><head><meta property="og:title" content="Abhinil Agarwal | LinkedIn"><meta property="og:image" content="${mine}"><meta property="og:description" content="The signed-in member"></head><img src="${mine}"><img src="https://media.licdn.com/dms/image/v2/D4D03AQHpatrick/profile-displayphoto-shrink_400_400/0/9?e=2&v=beta&t=page"></html>`;
    const dossier = assembleLinkedInDossier('husting', [payload], html);
    expect(dossier?.value).toBe('husting');
    expect(dossier?.name).toBe('Patrick Husting');
    expect(dossier?.headline).toBe('Rebooting is a Development Strategy');
    expect(dossier?.about).toBe('Over my glorious career.');
    expect(dossier?.photo).toBe('https://media.licdn.com/dms/image/v2/D4D03AQHpatrick/profile-displayphoto-shrink_400_400/0/9?e=2&v=beta&t=page');
    expect(dossier?.location).toBe('Sammamish, Washington');
    expect(dossier?.company).toBe('Show Day');
    expect(dossier?.experience[0]).toMatchObject({ title: 'Founder', company: 'Show Day', dates: '2018 – now' });
    expect(dossier?.education[0]).toMatchObject({ school: 'State University', degree: 'BS', dates: '1990 – 1994' });
    expect(dossier?.links.map((link) => link.url)).toContain('https://ghostwriter-ai.com');
    const card = dossierFromKnown({ platform: 'linkedin', value: 'husting', name: 'Patrick Husting', bio: 'Rebooting is a Development Strategy', photo: patrick });
    expect(preferDossier(card, { ...dossier!, photo: mine })?.photo).toBe(patrick);
    const savedFace = preferDossier(card, { ...dossier!, photo: 'file:///portraits/husting.img', photoSource: 'profile' });
    expect(savedFace?.photo).toBe('file:///portraits/husting.img');
    expect(savedFace?.photoSource).toBe('profile');
    const repo = new GlanceRepository(openNodeDb());
    const captured = repo.capture({ qr: classifyQr('https://www.linkedin.com/in/husting') });
    applyDossier(repo, captured.personId, savedFace!);
    const person = repo.person(captured.personId);
    expect(person?.display_name).toBe('Patrick Husting');
    expect(person?.photo_uri).toBe('file:///portraits/husting.img');
    expect(person?.summary).toBe('Over my glorious career.');
    expect(person?.role).toBe('Rebooting is a Development Strategy');
    expect(person?.company).toBe('Show Day');
    const handle = repo.handles(captured.personId).find((row) => row.platform === 'linkedin');
    expect(handle?.value).toBe('husting');
    expect(handle?.avatar_uri).toBe('file:///portraits/husting.img');
    const stored = parseDossier(handle?.raw_json);
    expect(stored?.photoSource).toBe('profile');
    expect(stored?.about).toBe('Over my glorious career.');
    expect(stored?.experience[0]?.title).toBe('Founder');
    expect(stored?.links[0]?.url).toBe('https://ghostwriter-ai.com');
  });

  it('keeps the phone out of the scoring brief', () => {
    const dossier = linkedinDossierFromPayload(linkedinPayload, 'priya-shah');
    const brief = matchBrief({ platform: 'linkedin', value: 'priya-shah', name: 'Priya Shah', dossier });
    expect(brief).toContain('Company: Harbor');
    expect(brief).toContain('Bengaluru');
    expect(brief).not.toContain('9800011122');
  });
});
