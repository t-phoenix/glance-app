export interface LinkedInPerson {
  value: string;
  displayName: string;
  bio: string | null;
  avatarUrl: string | null;
}

const SLUG = /^[A-Za-z0-9\-_%]{3,100}$/;
const QUERY_ID = 'voyagerSearchDashClusters.b0928897b71bd00a5a7291755dcd64f0';
const RESULT_LIMIT = 20;

export function isLinkedInProfilePhoto(url: string | null): boolean {
  if (!url) return false;
  return /profile-displayphoto|profile-framedphoto/i.test(url) && !/company-logo|background_|feedshare|ghost-img/i.test(url);
}

export function linkedinPeopleSearchUrl(query: string): string {
  return `https://www.linkedin.com/search/results/people/?keywords=${encodeURIComponent(query.trim())}&origin=GLOBAL_SEARCH_HEADER`;
}

function cleanName(raw: string): string {
  return raw
    .replace(/\\u0026/g, '&')
    .replace(/&amp;/g, '&')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/^View\s+/i, '')
    .replace(/(?:['’])s profile$/i, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function usableName(name: string): boolean {
  if (name.length < 2 || name.length > 80) return false;
  return !/sign in|join linkedin|skip to|status is/i.test(name);
}

function slugFromUrl(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const match = value.match(/\/in\/([A-Za-z0-9\-_%]{3,100})/i);
  if (!match?.[1]) return null;
  try {
    return decodeURIComponent(match[1]);
  } catch {
    return match[1];
  }
}

function textField(value: unknown): string | null {
  if (typeof value === 'string') return cleanName(value) || null;
  if (!value || typeof value !== 'object') return null;
  const text = (value as { text?: unknown }).text;
  return typeof text === 'string' ? cleanName(text) || null : null;
}

function usablePhoto(url: string | null): string | null {
  if (!url) return null;
  const cleaned = url.replace(/\\u0026/g, '&').replace(/&amp;/g, '&').replace(/\\\//g, '/');
  if (!/^https:\/\//i.test(cleaned)) return null;
  if (/ghost-img|default-avatar|data:image|company-logo|static\.licdn\.com\/aero/i.test(cleaned)) return null;
  return cleaned;
}

function builtPhoto(root: string, segment: string): string | null {
  const base = root.endsWith('/') ? root : `${root}/`;
  return usablePhoto(`${base}${segment.replace(/^\//, '')}`);
}

/** Profile photo only. Company logos and the next card's image are ignored. */
export function linkedinPhotoFromText(raw: string): string | null {
  const roots = [...raw.matchAll(/"rootUrl":"(https:[^"]+)"/g)].map((match) => match[1] ?? '');
  const segments = [...raw.matchAll(/"fileIdentifyingUrlPathSegment":"([^"]+)"/g)].map((match) => match[1] ?? '').filter(Boolean);
  const built = roots.flatMap((root) => segments.map((segment) => builtPhoto(root, segment))).filter((url): url is string => isLinkedInProfilePhoto(url));
  const sized = pickLinkedInPhoto(built);
  if (sized) return sized;
  const direct = [...raw.matchAll(/https:\/\/media\.licdn\.com\/dms\/image\/[^"\\\s<]+/g)]
    .map((match) => usablePhoto(match[0] ?? null))
    .filter((url): url is string => isLinkedInProfilePhoto(url));
  return pickLinkedInPhoto(direct);
}

/** Use a size LinkedIn actually signed. Never invent a different shrink size. */
function pickLinkedInPhoto(urls: string[]): string | null {
  return urls.find((url) => /200_200|shrink_200/.test(url))
    ?? urls.find((url) => /400_400|shrink_400/.test(url))
    ?? urls.find((url) => /100_100|shrink_100/.test(url))
    ?? urls[0]
    ?? null;
}

function avatarFrom(record: Record<string, unknown>): string | null {
  const portrait = record.profilePicture ?? record.image;
  if (!portrait || typeof portrait !== 'object') return null;
  const raw = JSON.stringify(portrait);
  if (raw.length > 80000) return null;
  return linkedinPhotoFromText(raw);
}

/** People cards from a logged-in LinkedIn search page or its embedded JSON. */
export function linkedinPeopleFromHtml(html: string): LinkedInPerson[] {
  const source = html.replace(/\\"/g, '"').replace(/\\\//g, '/');
  const found: LinkedInPerson[] = [];
  const seen = new Set<string>();
  const push = (value: string, displayName: string | null, bio: string | null, avatarUrl: string | null = null) => {
    if (!SLUG.test(value)) return;
    const name = displayName ? cleanName(displayName) : '';
    if (!usableName(name) || seen.has(value.toLowerCase())) return;
    seen.add(value.toLowerCase());
    found.push({ value, displayName: name, bio: bio ? cleanName(bio) || null : null, avatarUrl });
  };
  for (const match of source.matchAll(/<a\b([^>]*href="[^"]*\/in\/[A-Za-z0-9\-_%]{3,100}[^"]*"[^>]*)>([\s\S]{0,500}?)<\/a>/gi)) {
    const tag = match[1] ?? '';
    const slug = slugFromUrl(tag.match(/href="([^"]+)"/i)?.[1] ?? '');
    const aria = cleanName(tag.match(/aria-label="([^"]*)"/i)?.[1] ?? '');
    const text = cleanName((match[2] ?? '').replace(/<[^>]+>/g, ' '));
    const at = match.index ?? 0;
    const listStart = source.lastIndexOf('<li', at);
    const listEnd = source.indexOf('</li>', at);
    const around = listStart >= 0 && listEnd > at && listEnd - listStart < 5000 ? source.slice(listStart, listEnd) : source.slice(at, at + 900);
    const bio = around.match(/entity-result__primary-subtitle[\s\S]{0,180}?>([^<]{2,160})</i)?.[1] ?? null;
    const photo = linkedinPhotoFromText(around);
    if (slug) push(slug, aria || text, bio, photo);
    if (found.length >= RESULT_LIMIT) return found;
  }
  for (const match of source.matchAll(/"publicIdentifier":"([A-Za-z0-9\-_%]{3,100})"/g)) {
    if (found.length >= RESULT_LIMIT) break;
    const slug = match[1] ?? '';
    const at = match.index ?? 0;
    const blob = source.slice(Math.max(0, at - 500), at + 800);
    const first = blob.match(/"firstName":"([^"]+)"/)?.[1] ?? '';
    const last = blob.match(/"lastName":"([^"]+)"/)?.[1] ?? '';
    const headline = blob.match(/"headline":"([^"]*)"/)?.[1] ?? null;
    const title = blob.match(/"navigationUrl":"[^"]*\/in\/[^"]+"[\s\S]{0,200}?"text":"([^"]+)"/)?.[1] ?? '';
    push(slug, cleanName(`${first} ${last}`) || title, headline, linkedinPhotoFromText(blob));
  }
  return found;
}

/** People cards from LinkedIn's signed-in search response. */
export function linkedinPeopleFromPayload(payload: unknown): LinkedInPerson[] {
  const found: LinkedInPerson[] = [];
  const seen = new Map<string, LinkedInPerson>();
  const push = (person: LinkedInPerson) => {
    const photo = isLinkedInProfilePhoto(person.avatarUrl) ? person.avatarUrl : null;
    const next = { ...person, avatarUrl: photo };
    if (!SLUG.test(next.value) || !usableName(next.displayName)) return;
    const key = next.value.toLowerCase();
    const previous = seen.get(key);
    if (!previous) {
      seen.set(key, next);
      found.push(next);
      return;
    }
    if (!previous.avatarUrl && next.avatarUrl) previous.avatarUrl = next.avatarUrl;
    if (!previous.bio && next.bio) previous.bio = next.bio;
  };
  const walk = (node: unknown, depth: number) => {
    if (found.length >= RESULT_LIMIT || depth > 12 || !node || typeof node !== 'object') return;
    if (Array.isArray(node)) {
      for (const item of node) walk(item, depth + 1);
      return;
    }
    const record = node as Record<string, unknown>;
    const slug = (typeof record.publicIdentifier === 'string' ? record.publicIdentifier : null) ?? slugFromUrl(record.navigationUrl) ?? slugFromUrl(record.bserpEntityNavigationalUrl);
    const personRecord = typeof record.firstName === 'string' || typeof record.headline === 'string' || Boolean(slugFromUrl(record.navigationUrl) || slugFromUrl(record.bserpEntityNavigationalUrl));
    const name = textField(record.title) || cleanName(`${typeof record.firstName === 'string' ? record.firstName : ''} ${typeof record.lastName === 'string' ? record.lastName : ''}`);
    const bio = textField(record.primarySubtitle) || (typeof record.headline === 'string' ? cleanName(record.headline) : null);
    if (slug && name && personRecord) push({ value: slug, displayName: name, bio, avatarUrl: avatarFrom(record) });
    for (const value of Object.values(record)) walk(value, depth + 1);
  };
  walk(payload, 0);
  return found;
}

/** Reads the open LinkedIn people-search page. Runs inside that page, so the signed-in session stays in the browser. */
export function linkedinExtractScript(query: string): string {
  const keywords = encodeURIComponent(query.trim());
  return `(function () {
    function send(payload) {
      if (window.ReactNativeWebView) window.ReactNativeWebView.postMessage(JSON.stringify(payload));
    }
    var here = location.href || '';
    var title = document.title || '';
    if (!/linkedin\\.com/i.test(here)) return true;
    if (/\\/(login|uas\\/login|checkpoint|authwall)/i.test(here) || /sign up \\| linkedin|join linkedin|authwall/i.test(title)) {
      send({ query: ${JSON.stringify(query)}, title: title, login: true });
      return true;
    }
    function slugOf(value) {
      var match = String(value || '').match(/\\/in\\/([A-Za-z0-9\\-_%]{3,100})/i);
      if (!match) return '';
      try { return decodeURIComponent(match[1]); } catch (error) { return match[1]; }
    }
    function profilePhoto(node) {
      var raw = JSON.stringify((node && (node.profilePicture || node.image)) || {});
      function good(url) { return /profile-displayphoto|profile-framedphoto/i.test(url) && !/company-logo|feedshare|ghost-img/i.test(url); }
      function pick(list) {
        return list.find(function (url) { return good(url) && /200_200|shrink_200/.test(url); })
          || list.find(function (url) { return good(url) && /400_400|shrink_400/.test(url); })
          || list.find(function (url) { return good(url) && /100_100|shrink_100/.test(url); })
          || list.find(good)
          || null;
      }
      var direct = (raw.match(/https:\\/\\/media\\.licdn\\.com\\/dms\\/image\\/[^"]+/g) || []).map(function (url) { return url.replace(/\\\\u0026/g, '&').replace(/&amp;/g, '&'); });
      var hit = pick(direct);
      if (hit) return hit;
      var root = (raw.match(/"rootUrl":"(https:[^"]+)"/) || [])[1];
      var segments = (raw.match(/"fileIdentifyingUrlPathSegment":"[^"]+"/g) || []).map(function (item) { return item.replace(/.*"fileIdentifyingUrlPathSegment":"/, '').slice(0, -1); });
      if (!root) return null;
      var base = root.endsWith('/') ? root : root + '/';
      return pick(segments.map(function (segment) { return base + segment.replace(/^\\//, ''); }));
    }
    function peopleFrom(data) {
      var out = [];
      var seen = {};
      function walk(node, depth) {
        if (!node || typeof node !== 'object' || depth > 12 || out.length >= 20) return;
        if (Array.isArray(node)) { node.forEach(function (item) { walk(item, depth + 1); }); return; }
        var slug = node.publicIdentifier || slugOf(node.navigationUrl) || slugOf(node.bserpEntityNavigationalUrl);
        var personRecord = node.firstName || node.headline || slugOf(node.navigationUrl) || slugOf(node.bserpEntityNavigationalUrl);
        var name = (node.title && node.title.text) || [node.firstName, node.lastName].filter(Boolean).join(' ');
        name = String(name || '').replace(/^View\\s+/i, '').replace(/['’]s profile$/i, '').replace(/\\s+/g, ' ').trim();
        var bio = (node.primarySubtitle && node.primarySubtitle.text) || node.headline || null;
        if (personRecord && slug && name && name.length > 1 && name.length < 81 && !/sign in|join linkedin|skip to/i.test(name)) {
          var key = String(slug).toLowerCase();
          if (!seen[key]) {
            seen[key] = true;
            out.push({ value: String(slug), displayName: name, bio: bio, avatarUrl: profilePhoto(node) });
          }
        }
        Object.keys(node).forEach(function (key) { walk(node[key], depth + 1); });
      }
      walk(data, 0);
      return out;
    }
    var csrf = (document.cookie.match(/JSESSIONID="?(ajax:[^";]+)"?/) || [])[1] || '';
    if (!csrf) return true;
    if (window.__recallLiAbort) window.__recallLiAbort.abort();
    var controller = new AbortController();
    window.__recallLiAbort = controller;
    var token = ${JSON.stringify(query)};
    window.__recallLiQuery = token;
    function page(start) {
      var variables = '(start:' + start + ',count:10,origin:GLOBAL_SEARCH_HEADER,query:(keywords:${keywords},flagshipSearchIntent:SEARCH_SRP,queryParameters:List((key:resultType,value:List(PEOPLE))),includeFiltersInResponse:false))';
      return fetch('/voyager/api/graphql?variables=' + variables + '&queryId=${QUERY_ID}', {
        credentials: 'include',
        signal: controller.signal,
        headers: { accept: 'application/vnd.linkedin.normalized+json+2.1', 'csrf-token': csrf, 'x-restli-protocol-version': '2.0.0' }
      }).then(function (response) {
        if (response.status === 401 || response.status === 403) return { login: true, people: [] };
        return response.json().then(function (data) { return { login: false, people: peopleFrom(data) }; }).catch(function () { return { login: false, people: [] }; });
      });
    }
    function current() { return window.__recallLiQuery === token; }
    function combine(lists) {
      var people = [];
      var seen = {};
      lists.forEach(function (list) {
        list.forEach(function (person) {
          var key = person.value.toLowerCase();
          if (seen[key]) return;
          seen[key] = true;
          people.push(person);
        });
      });
      return people.slice(0, 20);
    }
    page(0).then(function (first) {
      if (!current()) return;
      if (first.login) { send({ query: token, login: true }); return; }
      send({ query: token, people: combine([first.people]), login: false });
      return page(10).then(function (second) {
        if (!current() || second.login) return;
        send({ query: token, people: combine([first.people, second.people]), login: false });
      });
    }).catch(function (error) {
      if (!current() || (error && error.name === 'AbortError')) return;
      send({ query: token, status: 0 });
    });
    return true;
  })(); true;`;
}
