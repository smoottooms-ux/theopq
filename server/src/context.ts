import { createReadStream, existsSync, mkdirSync, statSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { join, resolve } from 'node:path';
import type { NextFunction, Request, Response } from 'express';
import { openDb } from './db.js';
import { readSession, type Session } from './auth.js';
import { installEntitlementSchema } from './entitlements.js';

/** Shared runtime: one database, one media directory, one auth guard. */

export const DATA_DIR = resolve(process.env.DATA_DIR ?? './data');
export const MEDIA_DIR = join(DATA_DIR, 'media');
export const TEMP_DIR = join(DATA_DIR, 'tmp');
/** Audio uploads are capped; a long story in MP3 sits well under this. */
export const MAX_AUDIO_BYTES = 25 * 1024 * 1024;

mkdirSync(MEDIA_DIR, { recursive: true });
mkdirSync(TEMP_DIR, { recursive: true });

export const db = openDb({ file: join(DATA_DIR, 'nightshift.db') });
installEntitlementSchema(db);

db.exec(`
  CREATE TABLE IF NOT EXISTS voices (
    id             TEXT PRIMARY KEY,
    family_id      TEXT NOT NULL REFERENCES families(id) ON DELETE CASCADE,
    parent_id      TEXT NOT NULL,
    provider_voice_id TEXT,
    status         TEXT NOT NULL,
    label          TEXT NOT NULL,
    consent_name   TEXT,
    consent_at     INTEGER,
    sample_count   INTEGER NOT NULL DEFAULT 0,
    failure_reason TEXT,
    created_at     INTEGER NOT NULL,
    updated_at     INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS voice_samples (
    id          TEXT PRIMARY KEY,
    family_id   TEXT NOT NULL,
    parent_id   TEXT NOT NULL,
    prompt_id   TEXT NOT NULL,
    filename    TEXT NOT NULL,
    content_type TEXT NOT NULL,
    created_at  INTEGER NOT NULL
  );

  /** Append-only family journal: what happened, when, and to whom. */
  CREATE TABLE IF NOT EXISTS activity (
    id          TEXT PRIMARY KEY,
    family_id   TEXT NOT NULL REFERENCES families(id) ON DELETE CASCADE,
    actor_id    TEXT,
    actor_name  TEXT,
    kind        TEXT NOT NULL,
    subject_id  TEXT,
    summary     TEXT NOT NULL,
    detail      TEXT,
    created_at  INTEGER NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_voices_family ON voices(family_id);
  CREATE INDEX IF NOT EXISTS idx_activity_family ON activity(family_id, created_at);
`);

export const id = (prefix: string): string =>
  `${prefix}_${Date.now().toString(36)}${randomBytes(4).toString('hex')}`;

declare module 'express-serve-static-core' {
  interface Request {
    session?: Session;
  }
}

export function requireAuth(role?: 'parent' | 'child') {
  return (req: Request, res: Response, next: NextFunction) => {
    const session = readSession(db, req);
    if (!session) return res.status(401).json({ error: 'Not signed in.' });
    if (role && session.role !== role) return res.status(403).json({ error: 'Wrong account type.' });
    req.session = session;
    next();
  };
}

export function extensionFor(contentType: string): string {
  if (contentType.includes('mpeg')) return 'mp3';
  if (contentType.includes('mp4')) return 'm4a';
  if (contentType.includes('ogg')) return 'ogg';
  if (contentType.includes('wav')) return 'wav';
  return 'webm';
}

export function contentTypeFor(filename: string): string {
  if (filename.endsWith('.mp3')) return 'audio/mpeg';
  if (filename.endsWith('.m4a')) return 'audio/mp4';
  if (filename.endsWith('.ogg')) return 'audio/ogg';
  if (filename.endsWith('.wav')) return 'audio/wav';
  return 'audio/webm';
}

export function streamMedia(res: Response, filename: string): void {
  // Filenames are server-generated, but the join is still guarded so a crafted
  // row can never escape the media directory.
  const path = join(MEDIA_DIR, filename);
  if (!path.startsWith(MEDIA_DIR) || !existsSync(path)) {
    res.status(404).json({ error: 'File missing.' });
    return;
  }
  res.setHeader('Content-Type', contentTypeFor(filename));
  res.setHeader('Content-Length', statSync(path).size);
  res.setHeader('Cache-Control', 'private, max-age=31536000, immutable');
  createReadStream(path).pipe(res);
}

/**
 * Writes a line to the family journal.
 *
 * Everything a family does is recorded so the archive can be browsed by week,
 * years later — which is the point: these are the nights a parent missed, and
 * they should be able to scroll back through every one of them.
 */
export function logActivity(entry: {
  familyId: string;
  actorId?: string;
  actorName?: string;
  kind:
    | 'story_sent'
    | 'story_played'
    | 'lullaby_sent'
    | 'reply_sent'
    | 'reply_heard'
    | 'voice_ready'
    | 'child_added'
    | 'game_played'
    | 'talk_answered'
    | 'plan_changed';
  subjectId?: string;
  summary: string;
  detail?: unknown;
}): void {
  db.prepare(
    `INSERT INTO activity (id, family_id, actor_id, actor_name, kind, subject_id, summary, detail, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    id('act'),
    entry.familyId,
    entry.actorId ?? null,
    entry.actorName ?? null,
    entry.kind,
    entry.subjectId ?? null,
    entry.summary,
    entry.detail ? JSON.stringify(entry.detail) : null,
    Date.now(),
  );
}
