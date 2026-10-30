-- Glance SQLite schema v1 (expo-sqlite, WAL). Times are UTC ISO-8601; displayed in IST.
PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

CREATE TABLE event (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('conference','side','hackathon','party','other')),
  starts_at TEXT NOT NULL, ends_at TEXT NOT NULL,          -- may cross midnight
  lat REAL, lng REAL, radius_m INTEGER DEFAULT 300,
  source TEXT, source_url TEXT
);

CREATE TABLE person (
  id TEXT PRIMARY KEY,
  display_name TEXT,                 -- best known name (your choice wins)
  real_name TEXT,
  recognise_hint TEXT,               -- "blue Avail hoodie"
  photo_uri TEXT,                    -- your photo
  state TEXT NOT NULL DEFAULT 'stub'
    CHECK (state IN ('stub','enriching','needs_review','kept','dropped','archived')),
  starred INTEGER NOT NULL DEFAULT 0,
  summary TEXT,
  merged_into TEXT REFERENCES person(id),
  created_at TEXT NOT NULL, updated_at TEXT NOT NULL
);

CREATE TABLE handle (
  id TEXT PRIMARY KEY,
  person_id TEXT NOT NULL REFERENCES person(id) ON DELETE CASCADE,
  platform TEXT NOT NULL CHECK (platform IN ('x','linkedin','telegram','whatsapp','github','farcaster','lens','ens','email','web','other')),
  value TEXT NOT NULL,               -- normalised handle / slug / E.164 / address
  url TEXT,
  status TEXT NOT NULL CHECK (status IN ('anchor','suggested','confirmed','rejected','pending_offline','conflict','gone')),
  confidence TEXT CHECK (confidence IN ('high','medium','low')),
  score REAL,
  evidence_json TEXT,                -- [{signal, detail, weight}]
  display_name TEXT, bio TEXT, avatar_uri TEXT, followers INTEGER,   -- per-platform persona (D16)
  typed_json TEXT,                   -- what you typed while offline, for verification
  source_provider TEXT, fetched_at TEXT, raw_json TEXT,
  confirmed_at TEXT,
  UNIQUE (platform, value, person_id)
);
CREATE INDEX handle_lookup ON handle(platform, value);

CREATE TABLE huddle (
  id TEXT PRIMARY KEY, event_id TEXT REFERENCES event(id),
  started_at TEXT NOT NULL, ended_at TEXT,
  photo_uri TEXT, audio_uri TEXT, transcript TEXT, split_json TEXT
);

CREATE TABLE encounter (
  id TEXT PRIMARY KEY,
  person_id TEXT NOT NULL REFERENCES person(id) ON DELETE CASCADE,
  huddle_id TEXT REFERENCES huddle(id),
  event_id TEXT REFERENCES event(id),
  at TEXT NOT NULL, lat REAL, lng REAL, accuracy_m REAL,
  raw_qr TEXT, qr_kind TEXT,
  photo_uri TEXT, badge_photo_uri TEXT, audio_uri TEXT, audio_ms INTEGER,
  transcript TEXT, ai_json TEXT, ai_version TEXT,
  review_state TEXT NOT NULL DEFAULT 'pending' CHECK (review_state IN ('pending','reviewed'))
);

CREATE TABLE action (
  id TEXT PRIMARY KEY,
  person_id TEXT NOT NULL REFERENCES person(id) ON DELETE CASCADE,
  other_person_id TEXT REFERENCES person(id),   -- intros
  encounter_id TEXT REFERENCES encounter(id),
  text TEXT NOT NULL, owner TEXT NOT NULL CHECK (owner IN ('me','them')),
  due TEXT, channel TEXT, draft TEXT,
  done_at TEXT, dismissed_at TEXT
);

CREATE TABLE job (
  id TEXT PRIMARY KEY,
  kind TEXT NOT NULL, ref_id TEXT NOT NULL,
  priority INTEGER NOT NULL DEFAULT 1,
  requires TEXT,                               -- 'network' | 'charging' | NULL
  status TEXT NOT NULL CHECK (status IN ('queued','running','done','failed','dead','blocked_offline','blocked_budget')),
  tries INTEGER NOT NULL DEFAULT 0, next_at TEXT, started_at TEXT,
  error_code TEXT, error_detail TEXT
);
CREATE INDEX job_ready ON job(status, priority, next_at);

CREATE TABLE spend (
  id TEXT PRIMARY KEY, provider_id TEXT NOT NULL, usd REAL NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('paid','paid_failed','rejected')),
  tx_hash TEXT, at TEXT NOT NULL, job_id TEXT
);

CREATE TABLE provider_log (provider_id TEXT, ms INTEGER, http INTEGER, ok INTEGER, cost REAL, at TEXT);
CREATE TABLE provider_health (provider_id TEXT PRIMARY KEY, ok INTEGER, ms INTEGER, checked_at TEXT, error TEXT, consecutive_fail INTEGER DEFAULT 0);
CREATE TABLE setting (key TEXT PRIMARY KEY, value TEXT);   -- daily_cap, my_handles, quiet_hours

CREATE VIRTUAL TABLE search_fts USING fts5(
  person_id UNINDEXED, display_name, handles, transcript, summary, tags, event_name,
  tokenize = 'unicode61 remove_diacritics 2'
);
