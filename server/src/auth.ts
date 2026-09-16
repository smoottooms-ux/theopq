import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import type { Database } from 'better-sqlite3';
import type { Request } from 'express';

/**
 * Credentials.
 *
 * PINs are four digits, which is a tiny keyspace — so they are salted and run
 * through scrypt with real cost parameters, and the login route is rate
 * limited per identity. A four-digit PIN is a usability decision for sleepy
 * parents and small children; the server is what makes it survivable.
 */

const SCRYPT_COST = { N: 16384, r: 8, p: 1, keylen: 64 };

export function hashPin(pin: string): { hash: string; salt: string } {
  const salt = randomBytes(16).toString('hex');
  const hash = scryptSync(pin, salt, SCRYPT_COST.keylen, SCRYPT_COST).toString('hex');
  return { hash, salt };
}

export function verifyPin(pin: string, hash: string, salt: string): boolean {
  const candidate = scryptSync(pin, salt, SCRYPT_COST.keylen, SCRYPT_COST);
  const expected = Buffer.from(hash, 'hex');
  if (candidate.length !== expected.length) return false;
  return timingSafeEqual(candidate, expected);
}

const SESSION_TTL_MS = 90 * 24 * 60 * 60 * 1000;

export interface Session {
  token: string;
  familyId: string;
  subjectId: string;
  role: 'parent' | 'child';
}

export function createSession(
  db: Database,
  familyId: string,
  subjectId: string,
  role: 'parent' | 'child',
): Session {
  const token = randomBytes(32).toString('base64url');
  const now = Date.now();
  db.prepare(
    `INSERT INTO sessions (token, family_id, subject_id, role, created_at, expires_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
  ).run(token, familyId, subjectId, role, now, now + SESSION_TTL_MS);
  return { token, familyId, subjectId, role };
}

export function readSession(db: Database, req: Request): Session | null {
  const header = req.header('authorization');
  if (!header?.startsWith('Bearer ')) return null;

  const token = header.slice(7);
  const row = db
    .prepare(`SELECT token, family_id, subject_id, role, expires_at FROM sessions WHERE token = ?`)
    .get(token) as
    | { token: string; family_id: string; subject_id: string; role: 'parent' | 'child'; expires_at: number }
    | undefined;

  if (!row) return null;
  if (row.expires_at < Date.now()) {
    db.prepare(`DELETE FROM sessions WHERE token = ?`).run(token);
    return null;
  }

  return { token: row.token, familyId: row.family_id, subjectId: row.subject_id, role: row.role };
}

export function purgeExpiredSessions(db: Database): void {
  db.prepare(`DELETE FROM sessions WHERE expires_at < ?`).run(Date.now());
}

/* ---------------- rate limiting ---------------- */

const attempts = new Map<string, { count: number; until: number }>();

/** Returns the seconds a caller must wait, or 0 when they may proceed. */
export function checkRateLimit(key: string, max = 6, windowMs = 15 * 60_000): number {
  const now = Date.now();
  const entry = attempts.get(key);

  if (!entry || entry.until < now) {
    attempts.set(key, { count: 1, until: now + windowMs });
    return 0;
  }
  if (entry.count >= max) return Math.ceil((entry.until - now) / 1000);

  entry.count++;
  return 0;
}

export function clearRateLimit(key: string): void {
  attempts.delete(key);
}
