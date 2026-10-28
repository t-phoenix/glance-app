import { describe, expect, it } from 'vitest';
import { presetForEventName } from '@/src/data/weekTags';
import { bulletsFromText } from '@/src/services/notes';
import { cleanProfileTitle } from '@/src/services/profiles';
import { linkedinDirectoryUrl, linkedinHitsFromHtml, profileLinksFromHtml, searchAccounts, wikidataLinkedinSlugs } from '@/src/services/accountSearch';
import { linkedinPeopleFromHtml, linkedinPeopleFromPayload, linkedinPeopleSearchUrl } from '@/src/services/linkedinDirectory';
import { telegramPeopleFromRows, whatsAppContactsFromRows } from '@/src/services/registrySearch';
import { nameSlugs, phonesInText } from '@/src/services/discover';
import { destinationFromScanPage, nextHop, pickResolved, socialsInPage } from '@/src/services/qrResolve';
import { chooseProfilePhoto, primaryProfilePhoto } from '@/src/services/primaryAccount';
import { readEventTags } from '@/src/data/weekTags';
import { parseOwnLink } from '@/src/services/ownLink';
import { usdcToUnits, walletReplaceAllowed } from '@/src/services/wallet';

describe('usable flows', () => {
  it('uses the primary account photo, not an event photo', () => {
    const handles = [
      { status: 'anchor', platform: 'linkedin', avatar_uri: 'https://media.licdn.com/face.jpg' },
      { status: 'confirmed', platform: 'x', avatar_uri: 'https://pbs.twimg.com/other.jpg' },
    ];
    expect(primaryProfilePhoto('file:///event.jpg', handles)).toBe('https://media.licdn.com/face.jpg');
    expect(primaryProfilePhoto('file:///event.jpg', [])).toBeNull();
    expect(primaryProfilePhoto('https://cdn.example/face.jpg', [])).toBe('https://cdn.example/face.jpg');
    expect(chooseProfilePhoto('https://media.licdn.com/dms/image/profile-displayphoto.jpg', 'https://static.licdn.com/aero/logo.png')).toBe('https://media.licdn.com/dms/image/profile-displayphoto.jpg');
    expect(chooseProfilePhoto(null, 'https://cdn.example/face.jpg')).toBe('https://cdn.example/face.jpg');
  });

  it('reads saved event tags and keeps the defaults when none are saved', () => {
    expect(readEventTags('').map((tag) => tag.name)).toEqual(['IBW', 'Devcon', 'EthGlobal Pragma', 'ETHGlobal Hackathon']);
    expect(readEventTags(JSON.stringify([{ name: 'Side event', color: '#FF8A73' }]))).toEqual([{ name: 'Side event', color: '#FF8A73' }]);
  });

  it('reads a full profile link, a WhatsApp number, or a named site', () => {
    expect(parseOwnLink('linkedin', 'https://www.linkedin.com/in/balajissrinivasan')).toMatchObject({ ok: true, value: 'balajissrinivasan' });
    expect(parseOwnLink('x', 'https://x.com/balajis')).toMatchObject({ ok: true, value: 'balajis' });
    expect(parseOwnLink('whatsapp', '+919812345678')).toMatchObject({ ok: true, url: 'https://wa.me/919812345678' });
    expect(parseOwnLink('web', 'hackernoon.com/u/ada', 'Hackernoon')).toMatchObject({ ok: true, value: 'Hackernoon', url: 'https://hackernoon.com/u/ada' });
    expect(parseOwnLink('web', 'https://example.com', '').ok).toBe(false);
    expect(parseOwnLink('linkedin', 'https://x.com/balajis').ok).toBe(false);
  });

  it('splits a note into bullets on the phone', () => {
    expect(bulletsFromText('Met at the booth. She builds proofs.')).toBe('- Met at the booth.\n- She builds proofs.');
  });

  it('maps the week tags', () => {
    expect(presetForEventName('Devcon 8')).toBe('Devcon');
    expect(presetForEventName('Pragma Mumbai')).toBe('EthGlobal Pragma');
    expect(presetForEventName('ETHGlobal Mumbai')).toBe('ETHGlobal Hackathon');
    expect(presetForEventName('IBW 2026 Conference')).toBe('IBW');
  });

  it('keeps the existing wallet unless REPLACE is typed', () => {
    expect(walletReplaceAllowed('0xabc', '0xABC', '')).toBe(true);
    expect(walletReplaceAllowed('0xabc', '0xdef', '')).toBe(false);
    expect(walletReplaceAllowed('0xabc', '0xdef', 'REPLACE')).toBe(true);
    expect(usdcToUnits('0.25')).toBe(250_000n);
    expect(usdcToUnits('0')).toBeNull();
    expect(usdcToUnits('1.1234567')).toBeNull();
  });

  it('uses the account the short link opens', () => {
    const page = '<a href="https://github.com/someoneelse">footer</a>';
    expect(pickResolved('https://t.co/abc', 'https://x.com/priyabuilds', page)).toMatchObject({ kind: 'x', value: 'priyabuilds' });
    expect(pickResolved('https://lnkd.in/abc', 'https://lnkd.in/abc', '<a href="https://www.linkedin.com/in/priya-s-123">profile</a>')).toMatchObject({ kind: 'linkedin', value: 'priya-s-123' });
    expect(pickResolved('https://t.co/abc', 'https://t.co/abc', '<meta http-equiv="refresh" content="0;url=https://x.com/priyabuilds">')).toMatchObject({ kind: 'x', value: 'priyabuilds' });
    expect(nextHop('<meta http-equiv="refresh" content="0;url=https://x.com/priyabuilds">', 'https://t.co/abc')).toBe('https://x.com/priyabuilds');
  });

  it('reads the account hidden inside a qr-code.io scan page', () => {
    const payload = { status: 'DRAFT', type: 'url', data: { url: 'https://x.com/balajis?s=20', status: true } };
    expect(destinationFromScanPage(payload)).toBe('https://x.com/balajis?s=20');
    expect(destinationFromScanPage({ data: { url: 'https://scan.page/' } })).toBeNull();
  });

  it('searches LinkedIn by a person name', () => {
    expect(linkedinDirectoryUrl('balaji srinivasan')).toBe('https://www.linkedin.com/pub/dir/Balaji/Srinivasan');
    expect(linkedinDirectoryUrl('Priya')).toBe('https://www.linkedin.com/pub/dir/Priya/+');
    const page = '<a href="https://www.linkedin.com/in/balaji-srinivasan">Balaji Srinivasan</a><a href="https://www.linkedin.com/in/priya-s-123">Priya S</a>';
    expect(linkedinHitsFromHtml(page)).toEqual([
      { value: 'balaji-srinivasan', displayName: 'Balaji Srinivasan' },
      { value: 'priya-s-123', displayName: 'Priya S' },
    ]);
    expect(linkedinHitsFromHtml('<title>Sign Up | LinkedIn</title><p>Join LinkedIn</p>')).toEqual([]);
    const search = { search: [{ id: 'Q1', label: 'Balaji Srinivasan' }, { id: 'Q2', label: 'Someone Else' }] };
    const entities = { entities: { Q1: { claims: { P6634: [{ mainsnak: { datavalue: { value: 'balajissrinivasan' } } }] } }, Q2: { claims: { P6634: [{ mainsnak: { datavalue: { value: 'someone' } } }] } } } };
    expect(wikidataLinkedinSlugs(search, entities, 'Balaji Srinivasan')).toEqual(['balajissrinivasan']);
  });

  it('reads people from a signed-in LinkedIn directory page', () => {
    expect(linkedinPeopleSearchUrl('Balaji Srinivasan')).toBe('https://www.linkedin.com/search/results/people/?keywords=Balaji%20Srinivasan&origin=GLOBAL_SEARCH_HEADER');
    const page = '<a href="https://www.linkedin.com/in/balajissrinivasan?miniProfileUrn=urn" aria-label="View Balaji Srinivasan’s profile"><span>Balaji Srinivasan</span></a><div class="entity-result__primary-subtitle">Author of the Network State</div>';
    expect(linkedinPeopleFromHtml(page)[0]).toMatchObject({ value: 'balajissrinivasan', displayName: 'Balaji Srinivasan', bio: 'Author of the Network State' });
    expect(linkedinPeopleFromHtml('<title>Sign Up | LinkedIn</title>')).toEqual([]);
    const withPhoto = '<li><img src="https://media.licdn.com/dms/image/v2/D4E/company-logo_200_200/0/9" /><img src="https://media.licdn.com/dms/image/v2/D4E/profile-displayphoto-shrink_200_200/0/1" /><a href="https://www.linkedin.com/in/balajissrinivasan" aria-label="View Balaji Srinivasan’s profile"><span>Balaji Srinivasan</span></a></li><li><img src="https://media.licdn.com/dms/image/v2/D4E/profile-displayphoto-shrink_400_400/0/other" /><a href="https://www.linkedin.com/in/other-person" aria-label="View Other Person’s profile"><span>Other Person</span></a></li>';
    const parsed = linkedinPeopleFromHtml(withPhoto);
    expect(parsed[0]).toMatchObject({ value: 'balajissrinivasan', avatarUrl: 'https://media.licdn.com/dms/image/v2/D4E/profile-displayphoto-shrink_200_200/0/1' });
    expect(parsed[1]).toMatchObject({ value: 'other-person', avatarUrl: 'https://media.licdn.com/dms/image/v2/D4E/profile-displayphoto-shrink_400_400/0/other' });
    expect(linkedinPeopleFromPayload({
      included: [{
        publicIdentifier: 'signed-size',
        firstName: 'Signed',
        lastName: 'Size',
        headline: 'Engineer',
        profilePicture: {
          vectorImage: {
            rootUrl: 'https://media.licdn.com/dms/image/v2/D4E/',
            artifacts: [
              { fileIdentifyingUrlPathSegment: 'profile-displayphoto-shrink_800_800/0/1?e=1&v=beta&t=big' },
              { fileIdentifyingUrlPathSegment: 'profile-displayphoto-shrink_200_200/0/1?e=1&v=beta&t=small' },
            ],
          },
        },
      }],
    })[0]?.avatarUrl).toBe('https://media.licdn.com/dms/image/v2/D4E/profile-displayphoto-shrink_200_200/0/1?e=1&v=beta&t=small');
    expect(linkedinPeopleFromPayload({
      included: [{
        publicIdentifier: 'priya-s-123',
        firstName: 'Priya',
        lastName: 'Sharma',
        headline: 'Engineer',
        companyLogo: { vectorImage: { rootUrl: 'https://media.licdn.com/dms/image/v2/LOGO/', artifacts: [{ fileIdentifyingUrlPathSegment: 'company-logo_200_200/0/x' }] } },
        profilePicture: { vectorImage: { rootUrl: 'https://media.licdn.com/dms/image/v2/ABC/', artifacts: [{ fileIdentifyingUrlPathSegment: 'profile-displayphoto-shrink_100_100/0/a' }, { fileIdentifyingUrlPathSegment: 'profile-displayphoto-shrink_400_400/0/b' }] } },
      }, {
        navigationUrl: 'https://www.linkedin.com/in/other-person',
        title: { text: 'Other Person' },
        image: { vectorImage: { rootUrl: 'https://media.licdn.com/dms/image/v2/ZZZ/', artifacts: [{ fileIdentifyingUrlPathSegment: 'profile-displayphoto-shrink_200_200/0/z' }] } },
      }],
    }).map((person) => ({ value: person.value, avatarUrl: person.avatarUrl }))).toEqual([
      { value: 'priya-s-123', avatarUrl: 'https://media.licdn.com/dms/image/v2/ABC/profile-displayphoto-shrink_400_400/0/b' },
      { value: 'other-person', avatarUrl: 'https://media.licdn.com/dms/image/v2/ZZZ/profile-displayphoto-shrink_200_200/0/z' },
    ]);
    expect(linkedinPeopleFromPayload({
      included: [
        { publicIdentifier: 'priya-s-123', firstName: 'Priya', lastName: 'Sharma', headline: 'Engineer' },
        { navigationUrl: 'https://www.linkedin.com/in/balajissrinivasan', title: { text: 'Balaji Srinivasan' }, primarySubtitle: { text: 'Investor' } },
        { publicIdentifier: 'orphan' },
      ],
    })).toEqual([
      { value: 'priya-s-123', displayName: 'Priya Sharma', bio: 'Engineer', avatarUrl: null },
      { value: 'balajissrinivasan', displayName: 'Balaji Srinivasan', bio: 'Investor', avatarUrl: null },
    ]);
  });

  it('reads Telegram usernames and WhatsApp contacts from a signed-in registry', () => {
    expect(telegramPeopleFromRows([
      { title: 'Balaji', subtitle: '@balajis' },
      { title: 'News', subtitle: '120 subscribers' },
      { title: 'Balaji', subtitle: '@balajis' },
    ])).toEqual([{ value: 'balajis', displayName: 'Balaji', bio: null }]);
    expect(whatsAppContactsFromRows([
      { name: 'Priya', id: '14155550134@c.us' },
      { name: 'Group', id: '14155550134-1@g.us' },
    ])).toEqual([{ value: '+14155550134', displayName: 'Priya', bio: null }]);
  });

  it('reads profile links out of a search page', () => {
    const html = '<a href="https://x.com/balajis">Balaji</a><a href="https://x.com/i/flow">skip</a><a href="https://www.linkedin.com/in/balaji-srinivasan">in</a>';
    expect(profileLinksFromHtml('x', html)).toEqual(['balajis']);
    expect(profileLinksFromHtml('linkedin', html)).toEqual(['balaji-srinivasan']);
  });

  it('treats a typed phone as a WhatsApp account and does not invent one', async () => {
    const found = await searchAccounts('whatsapp', '+14155550134');
    expect(found).toMatchObject([{ platform: 'whatsapp', value: '+14155550134' }]);
    expect(await searchAccounts('whatsapp', 'balaji')).toEqual([]);
  });

  it('only treats a published country-code number as WhatsApp', () => {
    expect(phonesInText('Ping me at +1 415 555 0134 tomorrow')).toEqual(['+14155550134']);
    expect(phonesInText('Met in 2026 at booth 12')).toEqual([]);
    expect(nameSlugs('Balaji S. Srinivasan')).toEqual(['balaji-srinivasan']);
    expect(nameSlugs('Balaji')).toEqual([]);
  });

  it('reads a name from a public profile title', () => {
    expect(cleanProfileTitle('Elon Musk (@elonmusk) on X', 'x').name).toBe('Elon Musk');
    expect(cleanProfileTitle('Bill Gates - Gates Foundation | LinkedIn', 'linkedin')).toMatchObject({ name: 'Bill Gates', bio: 'Gates Foundation' });
    expect(cleanProfileTitle('Sign In | LinkedIn', 'linkedin').name).toBeNull();
  });

  it('reads profile links out of a page', () => {
    const page = '<meta property="og:url" content="https://x.com/priyabuilds"><a href="https://github.com/priyabuilds">git</a>';
    expect(socialsInPage(page).map((item) => `${item.platform}:${item.value}`)).toEqual(['x:priyabuilds', 'github:priyabuilds']);
  });
});
