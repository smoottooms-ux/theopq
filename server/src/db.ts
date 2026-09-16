import Database from 'better-sqlite3';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

/**
 * Schema.
 *
 * One family per row; everything else hangs off family_id. Audio is not stored
 * in SQLite — the row keeps a filename and the bytes live under DATA_DIR/media,
 * which keeps the database small enough to back up by copying one file.
 */

export interface DbOptions {
  file: string;
}

/** Idempotent migration helper: SQLite has no ADD COLUMN IF NOT EXISTS. */
function addColumnIfMissing(
  db: Database.Database,
  table: string,
  column: string,
  definition: string,
): void {
  const columns = db.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[];
  if (columns.some((c) => c.name === column)) return;
  db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
}

export function openDb({ file }: DbOptions): Database.Database {
  mkdirSync(dirname(file), { recursive: true });
  const db = new Database(file);

  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  db.exec(`
    CREATE TABLE IF NOT EXISTS families (
      id          TEXT PRIMARY KEY,
      name        TEXT NOT NULL,
      join_code   TEXT NOT NULL UNIQUE,
      created_at  INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS parents (
      id            TEXT PRIMARY KEY,
      family_id     TEXT NOT NULL REFERENCES families(id) ON DELETE CASCADE,
      name          TEXT NOT NULL,
      email         TEXT NOT NULL UNIQUE,
      pin_hash      TEXT NOT NULL,
      pin_salt      TEXT NOT NULL,
      created_at    INTEGER NOT NULL
    );

    /**
     * Security questions for password recovery.
     *
     * Answers are hashed exactly like passwords: an answer to "your first pet"
     * is reused across services far more often than a password is, so storing
     * one in the clear would be worse than storing a password in the clear.
     */
    CREATE TABLE IF NOT EXISTS security_answers (
      id          TEXT PRIMARY KEY,
      parent_id   TEXT NOT NULL REFERENCES parents(id) ON DELETE CASCADE,
      position    INTEGER NOT NULL,
      question    TEXT NOT NULL,
      answer_hash TEXT NOT NULL,
      answer_salt TEXT NOT NULL,
      created_at  INTEGER NOT NULL,
      UNIQUE(parent_id, position)
    );

    CREATE TABLE IF NOT EXISTS children (
      id             TEXT PRIMARY KEY,
      family_id      TEXT NOT NULL REFERENCES families(id) ON DELETE CASCADE,
      name           TEXT NOT NULL,
      age            INTEGER NOT NULL,
      avatar         TEXT NOT NULL,
      pin_hash       TEXT NOT NULL,
      pin_salt       TEXT NOT NULL,
      reading_level  TEXT NOT NULL,
      interests      TEXT NOT NULL DEFAULT '[]',
      bedtime        TEXT NOT NULL,
      timezone       TEXT NOT NULL,
      game_difficulty INTEGER NOT NULL DEFAULT 2,
      created_at     INTEGER NOT NULL,
      updated_at     INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS stories (
      id             TEXT PRIMARY KEY,
      family_id      TEXT NOT NULL REFERENCES families(id) ON DELETE CASCADE,
      to_child_id    TEXT NOT NULL REFERENCES children(id) ON DELETE CASCADE,
      from_parent_id TEXT NOT NULL,
      payload        TEXT NOT NULL,
      audio_file     TEXT,
      scheduled_for  INTEGER NOT NULL,
      status         TEXT NOT NULL,
      play_count     INTEGER NOT NULL DEFAULT 0,
      created_at     INTEGER NOT NULL,
      updated_at     INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS replies (
      id          TEXT PRIMARY KEY,
      family_id   TEXT NOT NULL REFERENCES families(id) ON DELETE CASCADE,
      story_id    TEXT NOT NULL,
      child_id    TEXT NOT NULL,
      child_name  TEXT NOT NULL,
      audio_file  TEXT NOT NULL,
      duration    REAL NOT NULL,
      heard_at    INTEGER,
      created_at  INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS sessions (
      token       TEXT PRIMARY KEY,
      family_id   TEXT NOT NULL REFERENCES families(id) ON DELETE CASCADE,
      subject_id  TEXT NOT NULL,
      role        TEXT NOT NULL,
      created_at  INTEGER NOT NULL,
      expires_at  INTEGER NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_stories_child ON stories(to_child_id, updated_at);
    CREATE INDEX IF NOT EXISTS idx_replies_family ON replies(family_id, created_at);
    CREATE INDEX IF NOT EXISTS idx_sessions_expiry ON sessions(expires_at);
  `);

  // Accounts originally had only a four-digit PIN. Passwords were added later,
  // so the columns are introduced here rather than in the CREATE above.
  addColumnIfMissing(db, 'parents', 'password_hash', 'TEXT');
  addColumnIfMissing(db, 'parents', 'password_salt', 'TEXT');

  return db;
}
