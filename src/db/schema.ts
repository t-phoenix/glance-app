export const SCHEMA_SQL = `
PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS event (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('conference','side','hackathon','party','other')),
  starts_at TEXT NOT NULL,
  ends_at TEXT NOT NULL,
  lat REAL,
  lng REAL,
  radius_m INTEGER DEFAULT 300,
  source TEXT,
  source_url TEXT
);

CREATE TABLE IF NOT EXISTS person (
  id TEXT PRIMARY KEY,
  display_name TEXT,
  real_name TEXT,
  recognise_hint TEXT,
  photo_uri TEXT,
  state TEXT NOT NULL DEFAULT 'stub' CHECK (state IN ('stub','enriching','needs_review','kept','dropped','archived')),
  starred INTEGER NOT NULL DEFAULT 0,
  summary TEXT,
  mentioned INTEGER NOT NULL DEFAULT 0,
  company TEXT,
  role TEXT,
  merged_into TEXT REFERENCES person(id),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS handle (
  id TEXT PRIMARY KEY,
  person_id TEXT NOT NULL REFERENCES person(id) ON DELETE CASCADE,
  platform TEXT NOT NULL CHECK (platform IN ('x','linkedin','telegram','whatsapp','github','farcaster','lens','ens','email','web','other')),
  value TEXT NOT NULL,
  url TEXT,
  status TEXT NOT NULL CHECK (status IN ('anchor','suggested','confirmed','rejected','pending_offline','conflict','gone')),
  confidence TEXT CHECK (confidence IN ('high','medium','low')),
  score REAL,
  evidence_json TEXT,
  display_name TEXT,
  bio TEXT,
  avatar_uri TEXT,
  followers INTEGER,
  typed_json TEXT,
  source_provider TEXT,
  fetched_at TEXT,
  raw_json TEXT,
  confirmed_at TEXT,
  UNIQUE (platform, value, person_id)
);
CREATE INDEX IF NOT EXISTS handle_lookup ON handle(platform, value);

CREATE TABLE IF NOT EXISTS huddle (
  id TEXT PRIMARY KEY,
  event_id TEXT REFERENCES event(id),
  started_at TEXT NOT NULL,
  ended_at TEXT,
  photo_uri TEXT,
  audio_uri TEXT,
  transcript TEXT,
  split_json TEXT
);

CREATE TABLE IF NOT EXISTS encounter (
  id TEXT PRIMARY KEY,
  person_id TEXT NOT NULL REFERENCES person(id) ON DELETE CASCADE,
  huddle_id TEXT REFERENCES huddle(id),
  event_id TEXT REFERENCES event(id),
  at TEXT NOT NULL,
  lat REAL,
  lng REAL,
  accuracy_m REAL,
  raw_qr TEXT,
  qr_kind TEXT,
  photo_uri TEXT,
  photos_json TEXT,
  badge_photo_uri TEXT,
  audio_uri TEXT,
  audio_ms INTEGER,
  transcript TEXT,
  ai_json TEXT,
  ai_version TEXT,
  review_state TEXT NOT NULL DEFAULT 'pending' CHECK (review_state IN ('pending','reviewed')),
  tag TEXT
);

CREATE TABLE IF NOT EXISTS action (
  id TEXT PRIMARY KEY,
  person_id TEXT NOT NULL REFERENCES person(id) ON DELETE CASCADE,
  other_person_id TEXT REFERENCES person(id),
  encounter_id TEXT REFERENCES encounter(id),
  text TEXT NOT NULL,
  owner TEXT NOT NULL CHECK (owner IN ('me','them')),
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','waiting','done')),
  due TEXT,
  channel TEXT,
  draft TEXT,
  done_at TEXT,
  dismissed_at TEXT
);

CREATE TABLE IF NOT EXISTS job (
  id TEXT PRIMARY KEY,
  kind TEXT NOT NULL,
  ref_id TEXT NOT NULL,
  priority INTEGER NOT NULL DEFAULT 1,
  requires TEXT,
  status TEXT NOT NULL CHECK (status IN ('queued','running','done','failed','dead','blocked_offline','blocked_budget')),
  tries INTEGER NOT NULL DEFAULT 0,
  next_at TEXT,
  started_at TEXT,
  error_code TEXT,
  error_detail TEXT
);
CREATE INDEX IF NOT EXISTS job_ready ON job(status, priority, next_at);

CREATE TABLE IF NOT EXISTS spend (
  id TEXT PRIMARY KEY,
  provider_id TEXT NOT NULL,
  usd REAL NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('paid','paid_failed','rejected')),
  tx_hash TEXT,
  at TEXT NOT NULL,
  job_id TEXT
);

CREATE TABLE IF NOT EXISTS provider_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  provider_id TEXT,
  ms INTEGER,
  http INTEGER,
  ok INTEGER,
  cost REAL,
  at TEXT
);

CREATE TABLE IF NOT EXISTS provider_health (
  provider_id TEXT PRIMARY KEY,
  ok INTEGER,
  ms INTEGER,
  checked_at TEXT,
  error TEXT,
  consecutive_fail INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS setting (
  key TEXT PRIMARY KEY,
  value TEXT
);

CREATE TABLE IF NOT EXISTS error_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT,
  detail TEXT,
  at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS watch (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  note TEXT,
  event_id TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS wallet_tx (
  id TEXT PRIMARY KEY,
  kind TEXT NOT NULL,
  to_address TEXT,
  amount TEXT,
  tx_hash TEXT,
  status TEXT NOT NULL,
  at TEXT NOT NULL
);

`;

export const FTS_SQL = `
CREATE VIRTUAL TABLE IF NOT EXISTS search_fts USING fts5(
  person_id UNINDEXED,
  display_name,
  handles,
  transcript,
  summary,
  tags,
  event_name,
  tokenize = 'unicode61 remove_diacritics 2'
);
`;
