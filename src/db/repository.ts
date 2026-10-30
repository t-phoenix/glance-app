import type { StructuredNote } from '@/src/ai/structure';
import { FTS_SQL, SCHEMA_SQL } from '@/src/db/schema';
import type { Db } from '@/src/db/types';
import { createId } from '@/src/lib/id';
import { istDateKey, nowIso } from '@/src/lib/time';
import { anchorFromQr, classifyQr, type QrClassification } from '@/src/parsers/qr';
import type { Platform } from '@/src/parsers/handles';
import { keepPhoto, keepText } from '@/src/services/enrich';
import { primaryProfilePhoto } from '@/src/services/primaryAccount';
import { documentRelative, joinDocumentUri, listFileUris } from '@/src/services/portFiles';

export interface ListContext {
  platform: string | null;
  value: string | null;
  face: string | null;
  at: string | null;
  tag: string | null;
  lat: number | null;
  lng: number | null;
}

export interface PersonRow {
  id: string;
  display_name: string | null;
  real_name: string | null;
  recognise_hint: string | null;
  photo_uri: string | null;
  state: string;
  starred: number;
  summary: string | null;
  mentioned: number;
  company: string | null;
  role: string | null;
  merged_into: string | null;
  created_at: string;
  updated_at: string;
}

export interface HandleRow {
  id: string;
  person_id: string;
  platform: Platform;
  value: string;
  url: string | null;
  status: string;
  confidence: string | null;
  score: number | null;
  evidence_json: string | null;
  display_name: string | null;
  bio: string | null;
  avatar_uri: string | null;
  followers: number | null;
  typed_json: string | null;
  source_provider: string | null;
  fetched_at: string | null;
  raw_json: string | null;
  confirmed_at: string | null;
}

export type ActionStatus = 'open' | 'waiting' | 'done';

export interface ActionRow {
  id: string;
  person_id: string;
  encounter_id: string | null;
  text: string;
  owner: 'me' | 'them';
  status: ActionStatus;
  due: string | null;
  channel: string | null;
  draft: string | null;
  done_at: string | null;
  dismissed_at: string | null;
}

export interface TaskDraft {
  text: string;
  owner: 'me' | 'them';
  due: string | null;
  channel: string | null;
  draft: string | null;
  keep: boolean;
}

export interface CaptureInput {
  qr: QrClassification | null;
  displayName?: string;
  realName?: string;
  company?: string;
  role?: string;
  hint?: string;
  photoUri?: string | null;
  badgePhotoUri?: string | null;
  audioUri?: string | null;
  audioMs?: number | null;
  transcript?: string | null;
  huddleId?: string | null;
  eventId?: string | null;
  tag?: string | null;
  lat?: number | null;
  lng?: number | null;
  accuracyM?: number | null;
  at?: string;
  starred?: boolean;
  offline?: boolean;
  faceOnly?: boolean;
}

export interface CaptureResult {
  personId: string;
  encounterId: string;
  duplicate: boolean;
  unsafe: boolean;
  label: string;
}

const JOB_PRIORITY: Record<string, number> = {
  decode_badge: 0,
  enrich_anchor: 0,
  verify_offline: 0,
  transcribe: 1,
  structure_note: 1,
  split_huddle: 1,
  find_related: 2,
  avatar_compare: 2,
  reverse_avatar: 2,
};

export class GlanceRepository {
  fts = false;

  constructor(private db: Db) {
    db.exec(SCHEMA_SQL);
    this.migrate();
    try {
      db.exec(FTS_SQL);
      this.fts = true;
    } catch {
      this.fts = false;
    }
  }

  setting(key: string, fallback = ''): string {
    return this.db.get<{ value: string }>('SELECT value FROM setting WHERE key = ?', [key])?.value ?? fallback;
  }

  setSetting(key: string, value: string): void {
    this.db.run('INSERT INTO setting (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value', [key, value]);
  }

  dailyCap(): number {
    const raw = Number(this.setting('daily_cap', '2'));
    return Number.isFinite(raw) && raw > 0 ? raw : 2;
  }

  logError(code: string, detail: string): void {
    this.db.run('INSERT INTO error_log (code, detail, at) VALUES (?, ?, ?)', [code, detail.slice(0, 500), nowIso()]);
    this.db.run('DELETE FROM error_log WHERE id NOT IN (SELECT id FROM error_log ORDER BY id DESC LIMIT 500)');
  }

  /**
   * A reinstall keeps the files and gives Documents a new address.
   * Saved file:// links still name the old address, so the picture draws blank.
   */
  repairDocumentUris(documentsUri: string, exists: (relativePath: string) => boolean): number {
    const rewrite = (text: string): string | null => {
      let next = text;
      let changed = false;
      for (const uri of listFileUris(text)) {
        const relative = documentRelative(uri);
        if (!relative || !exists(relative)) continue;
        const moved = joinDocumentUri(documentsUri, relative);
        if (moved === uri) continue;
        next = next.split(uri).join(moved);
        changed = true;
      }
      return changed ? next : null;
    };
    const columns: [string, string][] = [
      ['person', 'photo_uri'],
      ['handle', 'avatar_uri'],
      ['handle', 'raw_json'],
      ['encounter', 'photo_uri'],
      ['encounter', 'audio_uri'],
      ['encounter', 'badge_photo_uri'],
      ['encounter', 'photos_json'],
    ];
    let updated = 0;
    for (const [table, column] of columns) {
      const rows = this.db.all<{ id: string; value: string }>(`SELECT id, ${column} AS value FROM ${table} WHERE ${column} LIKE '%file:%'`);
      for (const row of rows) {
        const next = rewrite(row.value);
        if (!next) continue;
        this.db.run(`UPDATE ${table} SET ${column} = ? WHERE id = ?`, [next, row.id]);
        updated += 1;
      }
    }
    return updated;
  }

  seedEvents(rows: { id: string; name: string; kind: string; starts_at: string; ends_at: string; lat: number | null; lng: number | null; radius_m: number; source: string; source_url: string | null }[]): number {
    let added = 0;
    for (const row of rows) {
      const kind = ['conference', 'side', 'hackathon', 'party', 'other'].includes(row.kind) ? row.kind : 'other';
      const existing = this.db.get('SELECT id FROM event WHERE id = ?', [row.id]);
      if (existing) continue;
      this.db.run(
        'INSERT INTO event (id, name, kind, starts_at, ends_at, lat, lng, radius_m, source, source_url) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [row.id, row.name, kind, row.starts_at, row.ends_at, row.lat, row.lng, row.radius_m, row.source, row.source_url],
      );
      added++;
    }
    return added;
  }

  events(): { id: string; name: string; kind: string; starts_at: string; ends_at: string; lat: number | null; lng: number | null; radius_m: number }[] {
    return this.db.all('SELECT id, name, kind, starts_at, ends_at, lat, lng, radius_m FROM event ORDER BY starts_at');
  }

  capture(input: CaptureInput): CaptureResult {
    if (input.qr?.unsafe) {
      return { personId: '', encounterId: '', duplicate: false, unsafe: true, label: 'Payment QR' };
    }
    const at = input.at ?? nowIso();
    const anchor = input.qr ? anchorFromQr(input.qr) : null;
    const existing = anchor ? this.findPersonByHandle(anchor.platform, anchor.value) : undefined;
    if (existing) {
      const encounterId = this.addEncounter(existing.id, input, at);
      this.touch(existing.id);
      this.reindex(existing.id);
      return { personId: existing.id, encounterId, duplicate: true, unsafe: false, label: existing.display_name || anchor?.value || 'Saved' };
    }
    const personId = createId('per');
    const name = personLabel(input, anchor);
    this.db.run(
      `INSERT INTO person (id, display_name, real_name, recognise_hint, photo_uri, state, starred, summary, mentioned, company, role, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, 'stub', ?, NULL, 0, ?, ?, ?, ?)`,
      [personId, name, input.realName ?? input.qr?.contact?.name ?? null, input.hint ?? null, input.photoUri ?? null, input.starred ? 1 : 0, input.company ?? input.qr?.contact?.company ?? null, input.role ?? input.qr?.contact?.title ?? null, at, at],
    );
    if (anchor) {
      this.insertHandle({
        personId,
        platform: anchor.platform,
        value: anchor.value,
        url: anchor.url ?? null,
        status: input.offline ? 'pending_offline' : 'anchor',
        typed: input.offline ? { realName: input.realName ?? '', company: input.company ?? '' } : null,
      });
    } else if (input.qr?.kind === 'opaque' || input.qr?.kind === 'text' || input.qr?.kind === 'devcon_ticket') {
      this.insertHandle({
        personId,
        platform: 'other',
        value: input.qr.value || input.qr.raw.slice(0, 120),
        url: input.qr.url ?? null,
        status: input.offline ? 'pending_offline' : 'anchor',
        displayName: input.qr.kind === 'devcon_ticket' ? input.qr.value ?? null : null,
      });
    }
    for (const handle of input.qr?.contact?.handles ?? []) {
      if (anchor && handle.platform === anchor.platform && handle.value === anchor.value) continue;
      this.insertHandle({
        personId,
        platform: handle.platform,
        value: handle.value,
        url: handle.url ?? null,
        status: 'suggested',
        confidence: 'medium',
      });
    }
    const encounterId = this.addEncounter(personId, input, at);
    if (input.offline && anchor) this.enqueue('verify_offline', personId, 'network');
    else if (anchor && anchor.platform !== 'other') this.enqueue('enrich_anchor', personId, 'network');
    if (input.badgePhotoUri) this.enqueue('decode_badge', encounterId, 'network');
    if (input.audioUri && !input.transcript) this.enqueue('transcribe', encounterId, null);
    if (input.transcript) this.enqueue('structure_note', encounterId, 'network');
    this.reindex(personId);
    return { personId, encounterId, duplicate: false, unsafe: false, label: name };
  }

  private addEncounter(personId: string, input: CaptureInput, at: string): string {
    const id = createId('enc');
    this.db.run(
      `INSERT INTO encounter (id, person_id, huddle_id, event_id, at, lat, lng, accuracy_m, raw_qr, qr_kind, photo_uri, badge_photo_uri, audio_uri, audio_ms, transcript, review_state, tag)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?)`,
      [
        id,
        personId,
        input.huddleId ?? null,
        input.eventId ?? null,
        at,
        input.lat ?? null,
        input.lng ?? null,
        input.accuracyM ?? null,
        input.qr?.raw ?? null,
        input.qr?.kind ?? null,
        input.photoUri ?? null,
        input.badgePhotoUri ?? null,
        input.audioUri ?? null,
        input.audioMs ?? null,
        input.transcript ?? null,
        input.tag ?? null,
      ],
    );
    return id;
  }

  insertHandle(input: {
    personId: string;
    platform: Platform;
    value: string;
    url?: string | null;
    status: string;
    confidence?: string | null;
    score?: number | null;
    evidence?: unknown;
    displayName?: string | null;
    bio?: string | null;
    avatarUri?: string | null;
    followers?: number | null;
    typed?: unknown;
    source?: string | null;
  }): string {
    const id = createId('hnd');
    this.db.run(
      `INSERT OR IGNORE INTO handle (id, person_id, platform, value, url, status, confidence, score, evidence_json, display_name, bio, avatar_uri, followers, typed_json, source_provider, fetched_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        input.personId,
        input.platform,
        input.value,
        input.url ?? null,
        input.status,
        input.confidence ?? null,
        input.score ?? null,
        input.evidence ? JSON.stringify(input.evidence) : null,
        input.displayName ?? null,
        input.bio ?? null,
        input.avatarUri ?? null,
        input.followers ?? null,
        input.typed ? JSON.stringify(input.typed) : null,
        input.source ?? null,
        input.source ? nowIso() : null,
      ],
    );
    return id;
  }

  findPersonByHandle(platform: string, value: string): PersonRow | undefined {
    return this.db.get<PersonRow>(
      `SELECT p.* FROM person p JOIN handle h ON h.person_id = p.id
       WHERE h.platform = ? AND lower(h.value) = lower(?) AND h.status IN ('anchor','confirmed','pending_offline','conflict')
         AND p.merged_into IS NULL AND p.state != 'dropped'
       LIMIT 1`,
      [platform, value],
    );
  }

  person(id: string): PersonRow | undefined {
    return this.db.get<PersonRow>('SELECT * FROM person WHERE id = ?', [id]);
  }

  handles(personId: string): HandleRow[] {
    return this.db.all<HandleRow>('SELECT * FROM handle WHERE person_id = ? ORDER BY status, platform', [personId]);
  }

  peopleToday(date = new Date()): PersonRow[] {
    const key = istDateKey(date);
    const start = new Date(`${key}T00:00:00+05:30`).toISOString();
    const end = new Date(new Date(`${key}T00:00:00+05:30`).getTime() + 86_400_000).toISOString();
    return this.db.all<PersonRow>(
      `SELECT DISTINCT p.* FROM person p
       JOIN encounter e ON e.person_id = p.id
       WHERE p.merged_into IS NULL AND p.state != 'dropped' AND e.at >= ? AND e.at < ?
       ORDER BY e.at DESC`,
      [start, end],
    );
  }

  allPeople(): PersonRow[] {
    return this.db.all<PersonRow>(
      `SELECT * FROM person WHERE merged_into IS NULL AND state != 'dropped' ORDER BY updated_at DESC`,
    );
  }

  search(query: string): PersonRow[] {
    const needle = query.trim().toLowerCase();
    if (!needle) return this.allPeople();
    if (!this.fts) {
      return this.allPeople().filter((person) => {
        const handles = this.handles(person.id).map((handle) => handle.value).join(' ');
        return `${person.display_name ?? ''} ${person.summary ?? ''} ${handles}`.toLowerCase().includes(needle);
      });
    }
    const tokens = needle
      .split(/\s+/)
      .map((token) => token.replace(/[^\p{L}\p{N}_@.+-]/gu, ''))
      .filter(Boolean);
    if (!tokens.length) return [];
    const match = tokens.map((token) => `"${token.replaceAll('"', '')}"*`).join(' ');
    const rows = this.db.all<{ person_id: string }>('SELECT person_id FROM search_fts WHERE search_fts MATCH ?', [match]);
    const ids = [...new Set(rows.map((row) => row.person_id))];
    return ids.map((id) => this.person(id)).filter((row): row is PersonRow => !!row && !row.merged_into && row.state !== 'dropped');
  }

  /** One read for list rows: primary account, portrait, and the latest meeting. */
  listContext(personIds: string[]): Map<string, ListContext> {
    const ids = [...new Set(personIds.filter(Boolean))];
    const map = new Map<string, ListContext>();
    for (const id of ids) map.set(id, { platform: null, value: null, face: null, at: null, tag: null, lat: null, lng: null });
    if (!ids.length) return map;
    const marks = ids.map(() => '?').join(',');
    const people = this.db.all<{ id: string; photo_uri: string | null }>(`SELECT id, photo_uri FROM person WHERE id IN (${marks})`, ids);
    const handles = this.db.all<{ person_id: string; platform: string; value: string; status: string; avatar_uri: string | null }>(
      `SELECT person_id, platform, value, status, avatar_uri FROM handle WHERE person_id IN (${marks}) AND status IN ('anchor', 'confirmed') AND platform != 'web'`,
      ids,
    );
    const meetings = this.db.all<{ person_id: string; at: string; tag: string | null; lat: number | null; lng: number | null }>(
      `SELECT person_id, at, tag, lat, lng FROM encounter WHERE person_id IN (${marks}) ORDER BY at DESC`,
      ids,
    );
    const byPerson = new Map<string, typeof handles>();
    for (const handle of handles) {
      const rows = byPerson.get(handle.person_id) ?? [];
      rows.push(handle);
      byPerson.set(handle.person_id, rows);
    }
    const photos = new Map(people.map((person) => [person.id, person.photo_uri]));
    for (const id of ids) {
      const rows = byPerson.get(id) ?? [];
      const label = rows.find((row) => row.status === 'anchor') ?? rows.find((row) => row.status === 'confirmed');
      const current = map.get(id)!;
      current.platform = label?.platform ?? null;
      current.value = label?.value ?? null;
      current.face = primaryProfilePhoto(photos.get(id), rows);
    }
    for (const meeting of meetings) {
      const current = map.get(meeting.person_id);
      if (!current || current.at) continue;
      current.at = meeting.at;
      current.tag = meeting.tag;
      current.lat = meeting.lat;
      current.lng = meeting.lng;
    }
    return map;
  }

  setStar(personId: string, starred: boolean): void {
    this.db.run('UPDATE person SET starred = ?, updated_at = ? WHERE id = ?', [starred ? 1 : 0, nowIso(), personId]);
  }

  setState(personId: string, state: string): void {
    this.db.run('UPDATE person SET state = ?, updated_at = ? WHERE id = ?', [state, nowIso(), personId]);
    this.reindex(personId);
  }

  updatePerson(personId: string, patch: Partial<Pick<PersonRow, 'display_name' | 'real_name' | 'recognise_hint' | 'company' | 'role' | 'summary' | 'photo_uri'>>): void {
    const current = this.person(personId);
    if (!current) return;
    this.db.run(
      `UPDATE person SET display_name = ?, real_name = ?, recognise_hint = ?, company = ?, role = ?, summary = ?, photo_uri = ?, updated_at = ? WHERE id = ?`,
      [
        patch.display_name === undefined ? current.display_name : keepText(patch.display_name, current.display_name),
        patch.real_name === undefined ? current.real_name : keepText(patch.real_name, current.real_name),
        patch.recognise_hint === undefined ? current.recognise_hint : keepText(patch.recognise_hint, current.recognise_hint),
        patch.company === undefined ? current.company : keepText(patch.company, current.company),
        patch.role === undefined ? current.role : keepText(patch.role, current.role),
        patch.summary === undefined ? current.summary : keepText(patch.summary, current.summary),
        patch.photo_uri === undefined ? current.photo_uri : keepPhoto(patch.photo_uri, current.photo_uri),
        nowIso(),
        personId,
      ],
    );
    this.reindex(personId);
  }

  updateHandle(id: string, patch: { status?: string; displayName?: string | null; bio?: string | null; avatarUri?: string | null; followers?: number | null; source?: string | null; url?: string | null; score?: number | null; confidence?: string | null; profile?: string | null }): void {
    const current = this.db.get<HandleRow>('SELECT * FROM handle WHERE id = ?', [id]);
    if (!current) return;
    this.db.run(
      `UPDATE handle SET status = ?, display_name = ?, bio = ?, avatar_uri = ?, followers = ?, source_provider = ?, fetched_at = ?, url = ?, score = ?, confidence = ?, raw_json = ? WHERE id = ?`,
      [
        patch.status?.trim() || current.status,
        patch.displayName === undefined ? current.display_name : keepText(patch.displayName, current.display_name),
        patch.bio === undefined ? current.bio : keepText(patch.bio, current.bio),
        patch.avatarUri === undefined ? current.avatar_uri : keepPhoto(patch.avatarUri, current.avatar_uri),
        patch.followers == null ? current.followers : patch.followers,
        patch.source === undefined ? current.source_provider : keepText(patch.source, current.source_provider),
        nowIso(),
        patch.url === undefined ? current.url : keepText(patch.url, current.url),
        patch.score == null ? current.score : patch.score,
        patch.confidence === undefined ? current.confidence : keepText(patch.confidence, current.confidence),
        patch.profile === undefined ? current.raw_json : keepText(patch.profile, current.raw_json),
        id,
      ],
    );
    this.reindex(current.person_id);
  }

  confirmHandle(handleId: string): { ok: true } | { ok: false; code: 'I1'; otherName: string } {
    const handle = this.db.get<HandleRow>('SELECT * FROM handle WHERE id = ?', [handleId]);
    if (!handle) return { ok: false, code: 'I1', otherName: 'someone' };
    const other = this.db.get<{ display_name: string | null }>(
      `SELECT p.display_name FROM handle h JOIN person p ON p.id = h.person_id
       WHERE h.platform = ? AND lower(h.value) = lower(?) AND h.status = 'confirmed' AND h.person_id != ? AND p.merged_into IS NULL`,
      [handle.platform, handle.value, handle.person_id],
    );
    if (other) return { ok: false, code: 'I1', otherName: other.display_name || 'someone else' };
    this.db.run(`UPDATE handle SET status = 'confirmed', confirmed_at = ? WHERE id = ?`, [nowIso(), handleId]);
    this.touch(handle.person_id);
    this.reindex(handle.person_id);
    return { ok: true };
  }

  rejectHandle(handleId: string): void {
    const handle = this.db.get<HandleRow>('SELECT * FROM handle WHERE id = ?', [handleId]);
    if (!handle || handle.status === 'anchor') return;
    this.db.run(`UPDATE handle SET status = 'rejected' WHERE id = ?`, [handleId]);
    this.touch(handle.person_id);
    this.reindex(handle.person_id);
  }

  saveDraft(encounterId: string, note: StructuredNote): void {
    const encounter = this.db.get<{ person_id: string }>('SELECT person_id FROM encounter WHERE id = ?', [encounterId]);
    if (!encounter) return;
    this.db.run(`UPDATE encounter SET ai_json = ?, ai_version = 'glance-1' WHERE id = ?`, [JSON.stringify(note), encounterId]);
    const person = this.person(encounter.person_id);
    if (!person || person.state === 'kept' || person.state === 'dropped') return;
    this.setState(encounter.person_id, 'needs_review');
    if (note.person.name) this.updatePerson(encounter.person_id, { display_name: note.person.name, company: note.person.company || person.company, role: note.person.role || person.role, summary: note.person.what_they_do || person.summary });
  }

  patchEncounter(id: string, patch: { transcript?: string | null; audio_uri?: string | null; audio_ms?: number | null; photo_uri?: string | null; lat?: number | null; lng?: number | null; tag?: string | null; event_id?: string | null }): void {
    const current = this.db.get<{ transcript: string | null; audio_uri: string | null; audio_ms: number | null; photo_uri: string | null; person_id: string; lat: number | null; lng: number | null; tag: string | null; event_id: string | null }>(
      'SELECT transcript, audio_uri, audio_ms, photo_uri, person_id, lat, lng, tag, event_id FROM encounter WHERE id = ?',
      [id],
    );
    if (!current) return;
    this.db.run('UPDATE encounter SET transcript = ?, audio_uri = ?, audio_ms = ?, photo_uri = ?, lat = ?, lng = ?, tag = ?, event_id = ? WHERE id = ?', [
      patch.transcript === undefined ? current.transcript : patch.transcript,
      patch.audio_uri === undefined ? current.audio_uri : patch.audio_uri,
      patch.audio_ms === undefined ? current.audio_ms : patch.audio_ms,
      patch.photo_uri === undefined ? current.photo_uri : patch.photo_uri,
      patch.lat === undefined ? current.lat : patch.lat,
      patch.lng === undefined ? current.lng : patch.lng,
      patch.tag === undefined ? current.tag : patch.tag,
      patch.event_id === undefined ? current.event_id : patch.event_id,
      id,
    ]);
    this.reindex(current.person_id);
  }

  saveReview(encounterId: string, note: StructuredNote): void {
    const encounter = this.db.get<{ person_id: string }>('SELECT person_id FROM encounter WHERE id = ?', [encounterId]);
    if (!encounter) return;
    this.db.run(`UPDATE encounter SET ai_json = ?, ai_version = 'glance-1', review_state = 'reviewed' WHERE id = ?`, [JSON.stringify(note), encounterId]);
    const person = this.person(encounter.person_id);
    if (!person) return;
    this.updatePerson(encounter.person_id, {
      display_name: note.person.name || person.display_name,
      company: note.person.company || person.company,
      role: note.person.role || person.role,
      summary: note.person.what_they_do || person.summary,
    });
    this.db.run('DELETE FROM action WHERE encounter_id = ? AND done_at IS NULL', [encounterId]);
    for (const action of note.actions) {
      this.db.run(
        `INSERT INTO action (id, person_id, encounter_id, text, owner, status, due, channel, draft) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [createId('act'), encounter.person_id, encounterId, action.text, action.owner, action.owner === 'them' ? 'waiting' : 'open', action.due, action.channel, note.draft_followup || null],
      );
    }
    this.setState(encounter.person_id, 'kept');
  }

  actions(bucket: ActionStatus | 'overdue', today = istDateKey()): ActionRow[] {
    const status: ActionStatus = bucket === 'overdue' ? 'open' : bucket;
    const rows = this.db.all<ActionRow>(
      `SELECT * FROM action WHERE dismissed_at IS NULL AND status = ? ORDER BY due IS NULL, due, done_at DESC`,
      [status],
    );
    if (bucket === 'overdue') return rows.filter((row) => !!row.due && row.due < today);
    if (bucket === 'done') return [...rows].sort((a, b) => (b.done_at ?? '').localeCompare(a.done_at ?? ''));
    return rows;
  }

  addAction(input: { personId: string; text: string; owner: 'me' | 'them'; due?: string | null; channel?: string | null; draft?: string | null; encounterId?: string | null }): string {
    const id = createId('act');
    const status: ActionStatus = input.owner === 'them' ? 'waiting' : 'open';
    this.db.run(
      `INSERT INTO action (id, person_id, encounter_id, text, owner, status, due, channel, draft) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, input.personId, input.encounterId ?? null, input.text.trim(), input.owner, status, input.due || null, input.channel ?? null, input.draft ?? null],
    );
    return id;
  }

  /** Writes only the tasks left checked. */
  saveTasks(personId: string, drafts: TaskDraft[]): number {
    let saved = 0;
    for (const draft of drafts) {
      if (!draft.keep || !draft.text.trim()) continue;
      this.addAction({ personId, text: draft.text, owner: draft.owner, due: draft.due, channel: draft.channel, draft: draft.draft });
      saved += 1;
    }
    return saved;
  }

  updateAction(id: string, patch: { text?: string; due?: string | null; draft?: string | null }): void {
    const current = this.db.get<ActionRow>('SELECT * FROM action WHERE id = ?', [id]);
    if (!current) return;
    this.db.run('UPDATE action SET text = ?, due = ?, draft = ? WHERE id = ?', [
      patch.text === undefined ? current.text : patch.text.trim(),
      patch.due === undefined ? current.due : patch.due || null,
      patch.draft === undefined ? current.draft : patch.draft,
      id,
    ]);
  }

  setActionStatus(id: string, status: ActionStatus): void {
    this.db.run('UPDATE action SET status = ?, done_at = ? WHERE id = ?', [status, status === 'done' ? nowIso() : null, id]);
  }

  completeAction(id: string): void {
    this.setActionStatus(id, 'done');
  }

  dismissAction(id: string): void {
    this.db.run('UPDATE action SET dismissed_at = ? WHERE id = ?', [nowIso(), id]);
  }

  encounters(personId: string): { id: string; at: string; event_id: string | null; transcript: string | null; photo_uri: string | null; audio_uri: string | null; audio_ms: number | null; ai_json: string | null; review_state: string; lat: number | null; lng: number | null; tag: string | null; raw_qr: string | null }[] {
    return this.db.all('SELECT id, at, event_id, transcript, photo_uri, audio_uri, audio_ms, ai_json, review_state, lat, lng, tag, raw_qr FROM encounter WHERE person_id = ? ORDER BY at DESC', [personId]);
  }

  encounter(id: string): { id: string; person_id: string; transcript: string | null; ai_json: string | null; event_id: string | null } | undefined {
    return this.db.get('SELECT id, person_id, transcript, ai_json, event_id FROM encounter WHERE id = ?', [id]);
  }

  deletePerson(personId: string): string[] {
    const files = this.db.all<{ photo_uri: string | null; audio_uri: string | null; badge_photo_uri: string | null }>(
      'SELECT photo_uri, audio_uri, badge_photo_uri FROM encounter WHERE person_id = ?',
      [personId],
    );
    const person = this.person(personId);
    if (this.fts) this.db.run('DELETE FROM search_fts WHERE person_id = ?', [personId]);
    this.db.run('DELETE FROM person WHERE id = ?', [personId]);
    const paths = files.flatMap((file) => [file.photo_uri, file.audio_uri, file.badge_photo_uri]);
    if (person?.photo_uri) paths.push(person.photo_uri);
    return paths.filter((path): path is string => !!path);
  }

  mergePeople(sourceId: string, targetId: string): void {
    this.db.run('UPDATE encounter SET person_id = ? WHERE person_id = ?', [targetId, sourceId]);
    this.db.run('UPDATE action SET person_id = ? WHERE person_id = ?', [targetId, sourceId]);
    const handles = this.handles(sourceId);
    for (const handle of handles) {
      const clash = this.db.get('SELECT id FROM handle WHERE person_id = ? AND platform = ? AND value = ?', [targetId, handle.platform, handle.value]);
      if (!clash) this.db.run('UPDATE handle SET person_id = ? WHERE id = ?', [targetId, handle.id]);
    }
    this.db.run(`UPDATE person SET state = 'archived', merged_into = ?, updated_at = ? WHERE id = ?`, [targetId, nowIso(), sourceId]);
    if (this.fts) this.db.run('DELETE FROM search_fts WHERE person_id = ?', [sourceId]);
    this.reindex(targetId);
  }

  enqueue(kind: string, refId: string, requires: 'network' | 'charging' | null, priority?: number): void {
    const existing = this.db.get(
      `SELECT id FROM job WHERE kind = ? AND ref_id = ? AND status IN ('queued','running','failed','blocked_offline','blocked_budget')`,
      [kind, refId],
    );
    if (existing) return;
    this.db.run(
      `INSERT INTO job (id, kind, ref_id, priority, requires, status, tries, next_at) VALUES (?, ?, ?, ?, ?, 'queued', 0, ?)`,
      [createId('job'), kind, refId, priority ?? JOB_PRIORITY[kind] ?? 1, requires, nowIso()],
    );
  }

  jobs(): { id: string; kind: string; ref_id: string; priority: number; requires: string | null; status: string; tries: number; next_at: string | null; started_at: string | null; error_code: string | null }[] {
    return this.db.all('SELECT id, kind, ref_id, priority, requires, status, tries, next_at, started_at, error_code FROM job');
  }

  updateJob(id: string, patch: { status?: string; tries?: number; next_at?: string | null; started_at?: string | null; error_code?: string | null; error_detail?: string | null }): void {
    const current = this.db.get<{ status: string; tries: number; next_at: string | null; started_at: string | null; error_code: string | null; error_detail: string | null }>(
      'SELECT status, tries, next_at, started_at, error_code, error_detail FROM job WHERE id = ?',
      [id],
    );
    if (!current) return;
    this.db.run(
      `UPDATE job SET status = ?, tries = ?, next_at = ?, started_at = ?, error_code = ?, error_detail = ? WHERE id = ?`,
      [
        patch.status ?? current.status,
        patch.tries ?? current.tries,
        patch.next_at === undefined ? current.next_at : patch.next_at,
        patch.started_at === undefined ? current.started_at : patch.started_at,
        patch.error_code === undefined ? current.error_code : patch.error_code,
        patch.error_detail === undefined ? current.error_detail : patch.error_detail,
        id,
      ],
    );
  }

  recordSpend(providerId: string, usd: number, status: 'paid' | 'paid_failed' | 'rejected', txHash: string | null): void {
    this.db.run('INSERT INTO spend (id, provider_id, usd, status, tx_hash, at) VALUES (?, ?, ?, ?, ?, ?)', [createId('spd'), providerId, usd, status, txHash, nowIso()]);
  }

  spentToday(date = new Date()): number {
    const key = istDateKey(date);
    const start = new Date(`${key}T00:00:00+05:30`).toISOString();
    const row = this.db.get<{ total: number | null }>(
      `SELECT SUM(usd) AS total FROM spend WHERE status IN ('paid','paid_failed') AND at >= ?`,
      [start],
    );
    return row?.total ?? 0;
  }

  spendHistory(): { id: string; provider_id: string; usd: number; status: string; tx_hash: string | null; at: string }[] {
    return this.db.all('SELECT id, provider_id, usd, status, tx_hash, at FROM spend ORDER BY at DESC LIMIT 50');
  }

  startHuddle(eventId: string | null): string {
    const id = createId('hud');
    this.db.run('INSERT INTO huddle (id, event_id, started_at) VALUES (?, ?, ?)', [id, eventId, nowIso()]);
    return id;
  }

  endHuddle(id: string, transcript: string | null): void {
    this.db.run('UPDATE huddle SET ended_at = ?, transcript = ? WHERE id = ?', [nowIso(), transcript, id]);
  }

  huddlePeople(huddleId: string): PersonRow[] {
    return this.db.all<PersonRow>(
      `SELECT DISTINCT p.* FROM person p JOIN encounter e ON e.person_id = p.id WHERE e.huddle_id = ? AND p.merged_into IS NULL`,
      [huddleId],
    );
  }

  markMentioned(personId: string): void {
    this.db.run('UPDATE person SET mentioned = 1, updated_at = ? WHERE id = ?', [nowIso(), personId]);
  }

  allowPaid(personId: string): boolean {
    const person = this.person(personId);
    return !!person && (person.starred === 1 || person.mentioned === 1);
  }

  counts(): Record<string, number> {
    const tables = ['person', 'handle', 'encounter', 'action', 'event', 'job', 'spend'];
    const out: Record<string, number> = {};
    for (const table of tables) {
      out[table] = this.db.get<{ n: number }>(`SELECT COUNT(*) AS n FROM ${table}`)?.n ?? 0;
    }
    return out;
  }

  dump(): string {
    const tables = ['event', 'person', 'handle', 'huddle', 'encounter', 'action', 'job', 'spend', 'setting', 'watch', 'wallet_tx'];
    const dump: Record<string, unknown[]> = {};
    for (const table of tables) dump[table] = this.db.all(`SELECT * FROM ${table}`);
    return JSON.stringify(dump);
  }

  restore(json: string): void {
    const dump = JSON.parse(json) as Record<string, Record<string, unknown>[]>;
    this.db.exec('PRAGMA foreign_keys = OFF;');
    this.db.exec('BEGIN IMMEDIATE');
    try {
      for (const table of ['action', 'encounter', 'handle', 'huddle', 'job', 'spend', 'watch', 'wallet_tx', 'person', 'event', 'setting']) {
        this.db.run(`DELETE FROM ${table}`);
      }
      for (const [table, rows] of Object.entries(dump)) {
        for (const raw of rows) {
          const row = { ...raw };
          if (table === 'action' && (row.status == null || row.status === '')) {
            row.status = row.done_at ? 'done' : row.owner === 'them' ? 'waiting' : 'open';
          }
          const keys = Object.keys(row);
          const placeholders = keys.map(() => '?').join(', ');
          this.db.run(
            `INSERT INTO ${table} (${keys.join(', ')}) VALUES (${placeholders})`,
            keys.map((key) => {
              const value = row[key];
              if (value == null) return null;
              if (typeof value === 'number') return value;
              return String(value);
            }),
          );
        }
      }
      this.db.exec('COMMIT');
    } catch (error) {
      try {
        this.db.exec('ROLLBACK');
      } catch {
        // The transaction was already closed.
      }
      throw error;
    }
    this.db.exec('PRAGMA foreign_keys = ON;');
    for (const person of this.allPeople()) this.reindex(person.id);
  }

  addWatch(name: string, note = ''): void {
    this.db.run('INSERT INTO watch (id, name, note, created_at) VALUES (?, ?, ?, ?)', [createId('wat'), name.trim(), note, nowIso()]);
  }

  watchlist(): { id: string; name: string; note: string | null }[] {
    return this.db.all('SELECT id, name, note FROM watch ORDER BY created_at DESC');
  }

  aiAllowed(kind: string, refId: string): boolean {
    return this.setting(`ai:${kind}:${refId}`) === 'yes';
  }

  allowAi(kind: string, refId: string): void {
    this.setSetting(`ai:${kind}:${refId}`, 'yes');
    this.db.run(`UPDATE job SET status = 'queued', next_at = ?, error_detail = NULL WHERE kind = ? AND ref_id = ? AND status = 'blocked_budget'`, [nowIso(), kind, refId]);
  }

  finishAi(kind: string, refId: string): void {
    this.db.run(`UPDATE job SET status = 'done', started_at = NULL WHERE kind = ? AND ref_id = ? AND status != 'done'`, [kind, refId]);
  }

  upsertHandle(input: {
    personId: string;
    platform: Platform;
    value: string;
    url?: string | null;
    status: string;
    confidence?: string | null;
    score?: number | null;
    evidence?: unknown;
    displayName?: string | null;
    bio?: string | null;
    avatarUri?: string | null;
    source?: string | null;
  }): string {
    const existing = this.db.get<HandleRow>(
      'SELECT * FROM handle WHERE person_id = ? AND platform = ? AND lower(value) = lower(?)',
      [input.personId, input.platform, input.value],
    );
    if (existing) {
      if (existing.status === 'rejected' || existing.status === 'confirmed') return existing.id;
      this.updateHandle(existing.id, {
        status: existing.status === 'anchor' ? 'anchor' : input.status,
        displayName: input.displayName,
        bio: input.bio,
        avatarUri: input.avatarUri,
        url: input.url,
        score: input.score,
        confidence: input.confidence,
        source: input.source,
      });
      return existing.id;
    }
    return this.insertHandle(input);
  }

  ensureAnchor(personId: string): void {
    const handles = this.handles(personId);
    if (handles.some((handle) => ['anchor', 'confirmed', 'suggested', 'pending_offline'].includes(handle.status))) return;
    const rows = this.db.all<{ raw_qr: string | null }>('SELECT raw_qr FROM encounter WHERE person_id = ? AND raw_qr IS NOT NULL ORDER BY at DESC', [personId]);
    for (const row of rows) {
      if (!row.raw_qr) continue;
      const anchor = anchorFromQr(classifyQr(row.raw_qr));
      if (!anchor) continue;
      this.upsertHandle({
        personId,
        platform: anchor.platform,
        value: anchor.value,
        url: anchor.url ?? null,
        status: 'anchor',
        source: 'qr',
      });
      return;
    }
  }

  recordTransfer(to: string, amount: string, txHash: string | null, status: string): void {
    this.db.run(
      'INSERT INTO wallet_tx (id, kind, to_address, amount, tx_hash, status, at) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [createId('wtx'), 'send', to, amount, txHash, status, nowIso()],
    );
  }

  transfers(): { id: string; to_address: string | null; amount: string | null; tx_hash: string | null; status: string; at: string }[] {
    return this.db.all('SELECT id, to_address, amount, tx_hash, status, at FROM wallet_tx ORDER BY at DESC LIMIT 30');
  }

  eventName(id: string | null): string | null {
    if (!id) return null;
    return this.db.get<{ name: string }>('SELECT name FROM event WHERE id = ?', [id])?.name ?? null;
  }

  private migrate(): void {
    const cols = this.db.all<{ name: string }>('PRAGMA table_info(encounter)');
    if (!cols.some((col) => col.name === 'tag')) this.db.exec('ALTER TABLE encounter ADD COLUMN tag TEXT');
    if (!cols.some((col) => col.name === 'photos_json')) this.db.exec('ALTER TABLE encounter ADD COLUMN photos_json TEXT');
    const handleCols = this.db.all<{ name: string }>('PRAGMA table_info(handle)');
    if (!handleCols.some((col) => col.name === 'raw_json')) this.db.exec('ALTER TABLE handle ADD COLUMN raw_json TEXT');
    const actionCols = this.db.all<{ name: string }>('PRAGMA table_info(action)');
    if (!actionCols.some((col) => col.name === 'status')) {
      this.db.exec(`ALTER TABLE action ADD COLUMN status TEXT NOT NULL DEFAULT 'open'`);
      this.db.exec(`UPDATE action SET status = 'done' WHERE done_at IS NOT NULL`);
      this.db.exec(`UPDATE action SET status = 'waiting' WHERE done_at IS NULL AND owner = 'them'`);
      this.db.exec(`UPDATE action SET status = 'open' WHERE done_at IS NULL AND owner = 'me'`);
    }
  }

  encounterPhotos(id: string): string[] {
    const row = this.db.get<{ photo_uri: string | null; photos_json: string | null }>('SELECT photo_uri, photos_json FROM encounter WHERE id = ?', [id]);
    if (!row) return [];
    let saved: string[] = [];
    try {
      const parsed = row.photos_json ? JSON.parse(row.photos_json) as unknown : [];
      if (Array.isArray(parsed)) saved = parsed.filter((item): item is string => typeof item === 'string' && item.length > 0);
    } catch {
      saved = [];
    }
    if (row.photo_uri && !saved.includes(row.photo_uri)) saved.unshift(row.photo_uri);
    return saved;
  }

  addEncounterPhoto(id: string, uri: string): void {
    const photos = this.encounterPhotos(id);
    if (!photos.includes(uri)) photos.push(uri);
    this.db.run('UPDATE encounter SET photos_json = ?, photo_uri = ? WHERE id = ?', [JSON.stringify(photos), uri, id]);
  }

  private touch(personId: string): void {
    this.db.run('UPDATE person SET updated_at = ? WHERE id = ?', [nowIso(), personId]);
  }

  reindex(personId: string): void {
    const person = this.person(personId);
    if (!this.fts) return;
    if (!person || person.merged_into) {
      this.db.run('DELETE FROM search_fts WHERE person_id = ?', [personId]);
      return;
    }
    const handles = this.handles(personId).filter((handle) => handle.status !== 'rejected' && handle.status !== 'gone').map((handle) => `${handle.platform}:${handle.value}`).join(' ');
    const transcripts = this.db.all<{ transcript: string | null; event_id: string | null }>('SELECT transcript, event_id FROM encounter WHERE person_id = ?', [personId]);
    const transcript = transcripts.map((row) => row.transcript ?? '').join('\n');
    const eventName = transcripts.map((row) => this.eventName(row.event_id) ?? '').join(' ');
    this.db.run('DELETE FROM search_fts WHERE person_id = ?', [personId]);
    this.db.run(
      'INSERT INTO search_fts (person_id, display_name, handles, transcript, summary, tags, event_name) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [personId, person.display_name ?? '', handles, transcript, person.summary ?? '', '', eventName],
    );
  }
}

function personLabel(input: CaptureInput, anchor: { platform: string; value: string } | null): string {
  if (input.displayName) return input.displayName;
  if (input.realName) return input.realName;
  if (input.qr?.contact?.name) return input.qr.contact.name;
  if (input.qr?.kind === 'devcon_ticket' && input.qr.value) return input.qr.value;
  if (anchor && anchor.platform !== 'web' && anchor.platform !== 'other') {
    const value = anchor.value.replace(/^@/, '');
    if (anchor.platform === 'whatsapp' || anchor.platform === 'ens' || value.startsWith('0x')) return value;
    return `@${value}`;
  }
  if (anchor?.platform === 'web') {
    try {
      const url = new URL(anchor.value);
      const path = url.pathname.replace(/\/$/, '');
      return `${url.hostname.replace(/^www\./, '')}${path && path !== '/' ? path : ''}`;
    } catch {
      return anchor.value.slice(0, 80);
    }
  }
  if (input.faceOnly) return 'Wave';
  return 'Unknown';
}

