import type { Platform } from '@/src/parsers/handles';

export type QrKind =
  | 'linkedin'
  | 'shortlink'
  | 'x'
  | 'telegram'
  | 'whatsapp'
  | 'whatsapp_link'
  | 'vcard'
  | 'mecard'
  | 'jwt'
  | 'address'
  | 'ens'
  | 'payment'
  | 'devcon_ticket'
  | 'github'
  | 'farcaster'
  | 'url'
  | 'text'
  | 'opaque'
  | 'invalid';

export interface ParsedContact {
  name?: string;
  company?: string;
  email?: string;
  title?: string;
  handles: { platform: Platform; value: string; url?: string }[];
}

export interface QrClassification {
  kind: QrKind;
  raw: string;
  value?: string;
  url?: string;
  needsResolve?: boolean;
  opaque?: boolean;
  unsafe?: boolean;
  verified?: boolean;
  contact?: ParsedContact;
}

const MAX_BYTES = 10 * 1024;

function invalid(raw: string): QrClassification {
  return { kind: 'invalid', raw };
}

function isBinaryJunk(raw: string): boolean {
  if (raw.includes('\u0000')) return true;
  let controls = 0;
  for (const ch of raw) {
    const code = ch.charCodeAt(0);
    if (code < 9 || (code > 13 && code < 32)) controls++;
  }
  return controls > 0 && controls / raw.length > 0.05;
}

function byteLength(value: string): number {
  return new TextEncoder().encode(value).length;
}

function decodeBase64Url(input: string): string {
  const padded = input.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(input.length / 4) * 4, '=');
  const binary = globalThis.atob(padded);
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

function decodeJwtPayload(token: string): Record<string, unknown> | null {
  const parts = token.split('.');
  if (parts.length !== 3 || parts.some((part) => !part)) return null;
  try {
    const json = decodeBase64Url(parts[1]!);
    const parsed = JSON.parse(json) as unknown;
    if (!parsed || typeof parsed !== 'object') return null;
    return parsed as Record<string, unknown>;
  } catch {
    return null;
  }
}

function parseVcard(raw: string): ParsedContact {
  const unfolded = raw.replace(/\r?\n[ \t]/g, '');
  const contact: ParsedContact = { handles: [] };
  for (const line of unfolded.split(/\r?\n/)) {
    const idx = line.indexOf(':');
    if (idx < 0) continue;
    const key = line.slice(0, idx).split(';')[0]?.toUpperCase() ?? '';
    const value = line.slice(idx + 1).trim();
    if (!value) continue;
    if (key === 'FN') contact.name = value;
    if (key === 'ORG') contact.company = value.split(';')[0];
    if (key === 'TITLE') contact.title = value;
    if (key === 'EMAIL') contact.handles.push({ platform: 'email', value: value.toLowerCase() });
    if (key === 'URL' || key === 'X-SOCIALPROFILE') {
      const social = classifyUrl(value);
      if (social.kind === 'x' && social.value) contact.handles.push({ platform: 'x', value: social.value, url: value });
      else if (social.kind === 'linkedin' && social.value) contact.handles.push({ platform: 'linkedin', value: social.value, url: value });
      else if (social.kind === 'telegram' && social.value) contact.handles.push({ platform: 'telegram', value: social.value, url: value });
      else if (social.kind === 'github' && social.value) contact.handles.push({ platform: 'github', value: social.value, url: value });
      else contact.handles.push({ platform: 'web', value, url: value });
    }
  }
  if (contact.handles.some((h) => h.platform === 'email')) {
    contact.email = contact.handles.find((h) => h.platform === 'email')?.value;
  }
  return contact;
}

function parseMecard(raw: string): ParsedContact {
  const body = raw.replace(/^MECARD:/i, '').replace(/;;\s*$/, '');
  const contact: ParsedContact = { handles: [] };
  for (const part of body.split(';')) {
    const idx = part.indexOf(':');
    if (idx < 0) continue;
    const key = part.slice(0, idx).toUpperCase();
    const value = part.slice(idx + 1).trim();
    if (key === 'N') {
      const [last, first] = value.split(',');
      contact.name = [first, last].filter(Boolean).join(' ').trim() || value;
    }
    if (key === 'ORG') contact.company = value;
    if (key === 'EMAIL') {
      contact.email = value.toLowerCase();
      contact.handles.push({ platform: 'email', value: value.toLowerCase() });
    }
    if (key === 'TEL') contact.handles.push({ platform: 'whatsapp', value: value });
    if (key === 'URL') contact.handles.push({ platform: 'web', value, url: value });
  }
  return contact;
}

function withScheme(raw: string): string {
  if (!raw || /^[a-z][a-z0-9+.-]*:/i.test(raw)) return raw;
  const host = /^(?:[a-z0-9-]+\.)+(?:com|me|org|io|xyz|eth|ly|co)(?:[/:?#]|$)/i.test(raw);
  const path = /^(?:[a-z0-9-]+\.)+[a-z]{2,}\/\S/i.test(raw);
  if (host || path) return `https://${raw}`;
  return raw;
}

function pathParts(url: URL): string[] {
  return url.pathname.split('/').filter(Boolean).map((part) => {
    try {
      return decodeURIComponent(part);
    } catch {
      return part;
    }
  });
}

function classifyUrl(raw: string): QrClassification {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return invalid(raw);
  }
  const host = url.hostname.replace(/^www\./, '').toLowerCase();
  const parts = pathParts(url);
  const path = `/${parts.join('/')}`;

  if (host === 'linkedin.com' || host.endsWith('.linkedin.com')) {
    const at = parts.findIndex((part) => part.toLowerCase() === 'in' || part.toLowerCase() === 'pub');
    const slug = at >= 0 ? parts[at + 1] ?? '' : '';
    if (slug && /^[A-Za-z0-9\-_%]{3,100}$/.test(slug)) return { kind: 'linkedin', raw, value: slug, url: raw };
    return { kind: 'url', raw, url: raw, value: raw, needsResolve: true };
  }
  if (host === 'scan.page' || host === 'scanned.page') {
    return { kind: 'shortlink', raw, value: parts[1] || parts[0] || '', url: raw, needsResolve: true };
  }
  if (['lnkd.in', 't.co', 'bit.ly', 'tinyurl.com', 'tiny.cc', 'ow.ly', 'buff.ly', 'rebrand.ly', 'cutt.ly', 'is.gd', 'rb.gy', 'shorturl.at'].includes(host)) {
    return { kind: 'shortlink', raw, value: parts[0] ?? '', url: raw, needsResolve: true };
  }
  if (host === 'x.com' || host === 'twitter.com' || host.endsWith('.twitter.com')) {
    const screen = url.searchParams.get('screen_name') ?? '';
    if (/^[A-Za-z0-9_]{1,15}$/.test(screen)) return { kind: 'x', raw, value: screen.toLowerCase(), url: raw };
    const reserved = new Set(['i', 'intent', 'share', 'home', 'search', 'settings', 'messages', 'explore', 'compose', 'hashtag']);
    const handle = (parts[0] ?? '').replace(/^@/, '');
    if (/^[A-Za-z0-9_]{1,15}$/.test(handle) && !reserved.has(handle.toLowerCase())) {
      return { kind: 'x', raw, value: handle.toLowerCase(), url: raw };
    }
    return { kind: 'url', raw, url: raw, value: raw, needsResolve: true };
  }
  if (host === 't.me' || host === 'telegram.me') {
    const handle = parts[0] ?? '';
    if (!/^[A-Za-z][A-Za-z0-9_]{4,31}$/.test(handle)) return { kind: 'url', raw, url: raw, value: raw, needsResolve: true };
    return { kind: 'telegram', raw, value: handle, url: raw };
  }
  if (host === 'wa.me' || host === 'api.whatsapp.com') {
    const segment = path.split('/').filter(Boolean);
    if (segment[0] === 'qr') return { kind: 'whatsapp_link', raw, opaque: true, value: segment[1] };
    const digits = (segment[0] ?? url.searchParams.get('phone') ?? '').replace(/[^\d]/g, '');
    if (digits.length >= 8) return { kind: 'whatsapp', raw, value: `+${digits.replace(/^\+/, '')}`, url: raw };
  }
  if (host === 'github.com') {
    const handle = parts[0] ?? '';
    if (/^[A-Za-z0-9-]{1,39}$/.test(handle) && !['features', 'about'].includes(handle.toLowerCase())) {
      return { kind: 'github', raw, value: handle, url: raw };
    }
  }
  if ((host === 'warpcast.com' || host === 'farcaster.xyz') && parts[0] && parts[0] !== '~') {
    const handle = parts[0].replace(/^@/, '');
    if (/^[A-Za-z0-9-]{1,39}$/.test(handle)) return { kind: 'farcaster', raw, url: raw, value: handle };
  }
  if (host === 'devcon.org' && parts[0] === 'ticket') {
    const name = parts[1] ?? '';
    return { kind: 'devcon_ticket', raw, value: name, url: raw };
  }
  if (host.endsWith('.eth') || path.endsWith('.eth')) {
    const ens = host.endsWith('.eth') ? host : path.split('/').pop() ?? '';
    if (/^[a-z0-9-]+(\.[a-z0-9-]+)*\.eth$/.test(ens)) return { kind: 'ens', raw, value: ens, url: raw };
  }
  return { kind: 'url', raw, url: raw, value: raw };
}

/** Decode a QR on the phone. Never opens a browser or a wallet. */
export function classifyQr(input: string): QrClassification {
  const raw = withScheme(input.normalize('NFC').trim());
  if (!raw || byteLength(raw) > MAX_BYTES || isBinaryJunk(raw)) return invalid(input);

  if (/^wc:/i.test(raw) || /^ethereum:/i.test(raw) || /^solana:/i.test(raw)) {
    return { kind: 'payment', raw, unsafe: true, value: raw };
  }
  if (/^0x[a-fA-F0-9]{40}$/.test(raw)) return { kind: 'address', raw, value: raw };
  if (/^[a-z0-9-]+(\.[a-z0-9-]+)*\.eth$/i.test(raw)) return { kind: 'ens', raw, value: raw.toLowerCase() };
  if (/^BEGIN:VCARD/i.test(raw)) return { kind: 'vcard', raw, contact: parseVcard(raw) };
  if (/^MECARD:/i.test(raw)) return { kind: 'mecard', raw, contact: parseMecard(raw) };
  if (/^tg:\/\//i.test(raw)) {
    try {
      const url = new URL(raw);
      const domain = url.searchParams.get('domain') ?? '';
      if (/^[A-Za-z][A-Za-z0-9_]{4,31}$/.test(domain)) return { kind: 'telegram', raw, value: domain };
    } catch {
      return invalid(raw);
    }
  }
  if (/^(?:twitter|x):\/\//i.test(raw)) {
    const screen = raw.match(/[?&]screen_name=([A-Za-z0-9_]{1,15})/i)?.[1];
    if (screen) return { kind: 'x', raw, value: screen.toLowerCase() };
    return { kind: 'url', raw, value: raw, needsResolve: true };
  }
  if (/^https?:\/\//i.test(raw)) return classifyUrl(raw);

  const jwt = decodeJwtPayload(raw);
  if (jwt && (typeof jwt.name === 'string' || typeof jwt.email === 'string' || typeof jwt.sub === 'string')) {
    const contact: ParsedContact = { handles: [] };
    if (typeof jwt.name === 'string') contact.name = jwt.name;
    if (typeof jwt.email === 'string') {
      contact.email = jwt.email.toLowerCase();
      contact.handles.push({ platform: 'email', value: contact.email });
    }
    return { kind: 'jwt', raw, verified: false, contact, value: contact.name ?? contact.email };
  }

  if (/^[A-Z0-9]{2,8}(-[A-Z0-9]{2,8})+$/i.test(raw) || /^[A-Z0-9]{6,16}$/i.test(raw)) {
    return { kind: 'opaque', raw, value: raw, opaque: true };
  }
  if (raw.length > 0 && raw.length <= 280) return { kind: 'text', raw, value: raw };
  return invalid(raw);
}

export function anchorFromQr(qr: QrClassification): { platform: Platform; value: string; url?: string } | null {
  switch (qr.kind) {
    case 'linkedin':
      return qr.value ? { platform: 'linkedin', value: qr.value, url: qr.url } : null;
    case 'x':
      return qr.value ? { platform: 'x', value: qr.value, url: qr.url } : null;
    case 'telegram':
      return qr.value ? { platform: 'telegram', value: qr.value, url: qr.url } : null;
    case 'whatsapp':
      return qr.value ? { platform: 'whatsapp', value: qr.value, url: qr.url } : null;
    case 'github':
      return qr.value ? { platform: 'github', value: qr.value, url: qr.url } : null;
    case 'farcaster':
      return qr.value ? { platform: 'farcaster', value: qr.value, url: qr.url } : null;
    case 'ens':
      return qr.value ? { platform: 'ens', value: qr.value, url: qr.url } : null;
    case 'address':
      return qr.value ? { platform: 'ens', value: qr.value } : null;
    case 'url':
    case 'shortlink': {
      const href = qr.url || (qr.raw.startsWith('http') ? qr.raw : '');
      return href ? { platform: 'web', value: href.slice(0, 300), url: href } : null;
    }
    case 'vcard':
    case 'mecard':
    case 'jwt': {
      const handle = qr.contact?.handles[0];
      if (handle) return handle;
      if (qr.contact?.name) return { platform: 'other', value: qr.contact.name };
      return null;
    }
    default:
      return null;
  }
}
