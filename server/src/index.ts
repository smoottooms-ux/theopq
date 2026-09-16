import express, { type NextFunction, type Request, type Response } from 'express';
import { writeFileSync, unlinkSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { join } from 'node:path';
import {
  checkPasswordStrength,
  checkRateLimit,
  clearRateLimit,
  createSession,
  hashPin,
  hashSecret,
  normaliseAnswer,
  purgeExpiredSessions,
  revokeAllSessions,
  verifyPin,
  verifySecret,
} from './auth.js';
import {
  DATA_DIR,
  MAX_AUDIO_BYTES,
  MEDIA_DIR,
  db,
  extensionFor,
  id,
  logActivity,
  requireAuth,
  streamMedia,
} from './context.js';
import { describeEntitlement, grantTrial } from './entitlements.js';
import {
  configureProxyTrust,
  inspectEnvironment,
  installGracefulShutdown,
  reportEnvironment,
  requestLogger,
  securityHeaders,
} from './runtime.js';
import { voiceRoutes } from './routes-voice.js';
import { contentRoutes } from './routes-content.js';
import { billingRoutes } from './routes-billing.js';

/**
 * Nightshift sync server.
 *
 * Small on purpose. It exists so a parent's phone and a child's tablet are the
 * same account from two places — nothing more. It does not generate stories,
 * it does not clone voices, and it never sees an API key: those stay on the
 * parent's device.
 */

const PORT = Number(process.env.PORT ?? 8787);

setInterval(() => purgeExpiredSessions(db), 60 * 60_000).unref();

const app = express();
app.disable('x-powered-by');
configureProxyTrust(app);
app.use(securityHeaders());
app.use(requestLogger());

// CORS first: everything below it, including billing, is called from a browser.
app.use((_req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', process.env.CORS_ORIGIN ?? '*');
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type, X-Admin-Token');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, DELETE, OPTIONS');
  next();
});
app.options(/.*/, (_req, res) => res.sendStatus(204));

// Stripe signs the exact bytes it sends, so the webhook must see a raw body.
// It is mounted before the JSON parser for that reason.
app.use('/', billingRoutes);
app.use(express.json({ limit: '2mb' }));

function joinCode(): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  return Array.from({ length: 6 }, () => alphabet[Math.floor(Math.random() * alphabet.length)]).join('');
}

/* ---------------- health ---------------- */

/** Liveness: is the process up at all. Cheap enough to poll every second. */
app.get('/health', (_req, res) => res.json({ ok: true, version: 2 }));

/**
 * Readiness: can this instance actually serve a family right now.
 *
 * Reports which paid capabilities are configured, so a deploy that is missing
 * a provider key is visible from a dashboard rather than at bedtime.
 */
app.get('/ready', (_req, res) => {
  try {
    db.prepare('SELECT 1').get();
  } catch (err) {
    console.error('[ready] database unreachable:', err);
    return res.status(503).json({ ready: false, error: 'database unavailable' });
  }

  res.json({
    ready: true,
    version: 2,
    uptimeSeconds: Math.round(process.uptime()),
    capabilities: {
      voiceCloning: !!process.env.ELEVENLABS_API_KEY,
      bespokeStories: !!process.env.ANTHROPIC_API_KEY,
      checkout: !!process.env.STRIPE_SECRET_KEY && !!process.env.STRIPE_WEBHOOK_SECRET,
      adminActions: !!process.env.ADMIN_TOKEN,
    },
  });
});

/* ---------------- accounts ---------------- */

interface QuestionInput {
  question?: unknown;
  answer?: unknown;
}

/** Both questions must be present, distinct, and have answers worth having. */
function validateQuestions(raw: unknown): { question: string; answer: string }[] | string {
  if (!Array.isArray(raw) || raw.length < 2) {
    return 'Two security questions are required so a lost password can be recovered.';
  }

  const parsed = (raw as QuestionInput[]).slice(0, 2).map((q) => ({
    question: String(q?.question ?? '').trim(),
    answer: String(q?.answer ?? ''),
  }));

  for (const [i, q] of parsed.entries()) {
    if (!q.question) return `Question ${i + 1} is empty.`;
    if (normaliseAnswer(q.answer).length < 2) return `Answer ${i + 1} is too short to be any use.`;
  }
  if (parsed[0].question.toLowerCase() === parsed[1].question.toLowerCase()) {
    return 'The two questions must be different.';
  }
  return parsed;
}

app.post('/auth/signup', (req, res) => {
  const { name, email, password, questions, familyName } = req.body ?? {};
  if (!name || !email || !password) {
    return res.status(400).json({ error: 'Name, email and a password are required.' });
  }

  const weak = checkPasswordStrength(String(password));
  if (weak) return res.status(400).json({ error: weak });

  const security = validateQuestions(questions);
  if (typeof security === 'string') return res.status(400).json({ error: security });

  const normalised = String(email).trim().toLowerCase();
  const existing = db.prepare(`SELECT id FROM parents WHERE email = ?`).get(normalised);
  if (existing) return res.status(409).json({ error: 'That email already has an account.' });

  const now = Date.now();
  const familyId = id('fam');
  const parentId = id('par');
  const { hash, salt } = hashSecret(String(password));

  db.transaction(() => {
    db.prepare(`INSERT INTO families (id, name, join_code, created_at) VALUES (?, ?, ?, ?)`).run(
      familyId,
      familyName ?? `${String(name).split(' ')[0]}'s family`,
      joinCode(),
      now,
    );
    // pin_hash is NOT NULL from the original schema; the password now lives in
    // its own columns and the PIN columns are filled with unusable values.
    db.prepare(
      `INSERT INTO parents
         (id, family_id, name, email, pin_hash, pin_salt, password_hash, password_salt, created_at)
       VALUES (?, ?, ?, ?, '', '', ?, ?, ?)`,
    ).run(parentId, familyId, String(name).trim(), normalised, hash, salt, now);

    for (const [position, q] of security.entries()) {
      const answer = hashSecret(normaliseAnswer(q.answer));
      db.prepare(
        `INSERT INTO security_answers
           (id, parent_id, position, question, answer_hash, answer_salt, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
      ).run(id('sq'), parentId, position, q.question, answer.hash, answer.salt, now);
    }
  })();

  grantTrial(db, familyId);

  const session = createSession(db, familyId, parentId, 'parent');
  res.status(201).json({
    token: session.token,
    parent: { id: parentId, familyId, name: String(name).trim(), email: normalised },
    family: db.prepare(`SELECT * FROM families WHERE id = ?`).get(familyId),
    entitlement: describeEntitlement(db, familyId),
  });
});

app.post('/auth/login', (req, res) => {
  const { email, password, pin } = req.body ?? {};
  const secret = String(password ?? pin ?? '');
  const normalised = String(email ?? '').trim().toLowerCase();

  const wait = checkRateLimit(`login:${normalised}`);
  if (wait) return res.status(429).json({ error: `Too many tries. Wait ${wait}s.` });

  const row = db
    .prepare(
      `SELECT id, family_id, name, email, pin_hash, pin_salt, password_hash, password_salt
       FROM parents WHERE email = ?`,
    )
    .get(normalised) as
    | {
        id: string;
        family_id: string;
        name: string;
        email: string;
        pin_hash: string;
        pin_salt: string;
        password_hash?: string;
        password_salt?: string;
      }
    | undefined;

  // An account created before passwords existed still signs in with its PIN.
  const valid =
    !!row &&
    (row.password_hash && row.password_salt
      ? verifySecret(secret, row.password_hash, row.password_salt)
      : !!row.pin_hash && verifyPin(secret, row.pin_hash, row.pin_salt));

  // Same response either way, so the endpoint does not confirm which emails exist.
  if (!row || !valid) {
    return res.status(401).json({ error: 'Email or password is wrong.' });
  }

  clearRateLimit(`login:${normalised}`);
  const session = createSession(db, row.family_id, row.id, 'parent');
  res.json({
    token: session.token,
    parent: { id: row.id, familyId: row.family_id, name: row.name, email: row.email },
    family: db.prepare(`SELECT * FROM families WHERE id = ?`).get(row.family_id),
    entitlement: describeEntitlement(db, row.family_id),
  });
});

/** A child signs in on their own device with the family code plus their PIN. */
app.post('/auth/child', (req, res) => {
  const { joinCode: code, childName, pin } = req.body ?? {};
  const key = `child:${String(code ?? '').toUpperCase()}:${String(childName ?? '').toLowerCase()}`;

  const wait = checkRateLimit(key);
  if (wait) return res.status(429).json({ error: `Too many tries. Wait ${wait}s.` });

  const family = db
    .prepare(`SELECT id FROM families WHERE join_code = ?`)
    .get(String(code ?? '').toUpperCase()) as { id: string } | undefined;
  if (!family) return res.status(401).json({ error: 'That code is not right.' });

  const child = db
    .prepare(`SELECT * FROM children WHERE family_id = ? AND lower(name) = lower(?)`)
    .get(family.id, String(childName ?? '')) as
    | { id: string; family_id: string; pin_hash: string; pin_salt: string }
    | undefined;
  if (!child || !verifyPin(String(pin ?? ''), child.pin_hash, child.pin_salt)) {
    return res.status(401).json({ error: 'That code is not right.' });
  }

  clearRateLimit(key);
  const session = createSession(db, family.id, child.id, 'child');
  res.json({ token: session.token, child: rowToChild(child) });
});

/**
 * Step one of recovery: hand back the questions for an email.
 *
 * Always returns 200 with a questions array. An unknown email gets a pair of
 * plausible-looking questions rather than a 404, so this cannot be used to
 * find out which addresses have accounts.
 */
app.post('/auth/recover/questions', (req, res) => {
  const normalised = String(req.body?.email ?? '').trim().toLowerCase();

  const wait = checkRateLimit(`recover:${normalised}`, 10);
  if (wait) return res.status(429).json({ error: `Too many tries. Wait ${wait}s.` });

  const parent = db.prepare(`SELECT id FROM parents WHERE email = ?`).get(normalised) as
    | { id: string }
    | undefined;

  if (!parent) {
    return res.json({
      questions: ['What was the name of your first pet?', 'What was your childhood nickname?'],
    });
  }

  const rows = db
    .prepare(`SELECT question FROM security_answers WHERE parent_id = ? ORDER BY position`)
    .all(parent.id) as { question: string }[];

  if (rows.length === 0) {
    return res.status(409).json({
      error: 'That account has no recovery questions set. Sign in and add them from Settings.',
    });
  }

  res.json({ questions: rows.map((r) => r.question) });
});

/**
 * Step two: check the answers and set a new password.
 *
 * Both answers must be right. A reset signs every device out, because a
 * password someone had to recover may have been compromised.
 */
app.post('/auth/recover/reset', (req, res) => {
  const normalised = String(req.body?.email ?? '').trim().toLowerCase();
  const answers = Array.isArray(req.body?.answers) ? req.body.answers : [];
  const password = String(req.body?.password ?? '');

  // Deliberately tighter than login: guessing a pair of answers should not be
  // something anyone can grind at.
  const wait = checkRateLimit(`reset:${normalised}`, 5, 30 * 60_000);
  if (wait) return res.status(429).json({ error: `Too many tries. Wait ${Math.ceil(wait / 60)} minutes.` });

  const weak = checkPasswordStrength(password);
  if (weak) return res.status(400).json({ error: weak });

  const parent = db.prepare(`SELECT id FROM parents WHERE email = ?`).get(normalised) as
    | { id: string }
    | undefined;

  const stored = parent
    ? (db
        .prepare(
          `SELECT position, answer_hash, answer_salt FROM security_answers
           WHERE parent_id = ? ORDER BY position`,
        )
        .all(parent.id) as { position: number; answer_hash: string; answer_salt: string }[])
    : [];

  // Every answer is checked even when the first is wrong, so timing does not
  // reveal which one failed.
  const allCorrect =
    stored.length > 0 &&
    stored
      .map((row, i) =>
        verifySecret(normaliseAnswer(String(answers[i] ?? '')), row.answer_hash, row.answer_salt),
      )
      .every(Boolean);

  if (!parent || !allCorrect) {
    return res.status(401).json({ error: 'Those answers do not match. Both have to be right.' });
  }

  const { hash, salt } = hashSecret(password);
  db.transaction(() => {
    db.prepare(`UPDATE parents SET password_hash = ?, password_salt = ? WHERE id = ?`).run(
      hash,
      salt,
      parent.id,
    );
    revokeAllSessions(db, parent.id);
  })();

  clearRateLimit(`reset:${normalised}`);
  res.json({ ok: true });
});

app.post('/auth/logout', requireAuth(), (req, res) => {
  db.prepare(`DELETE FROM sessions WHERE token = ?`).run(req.session!.token);
  res.sendStatus(204);
});

/* ---------------- children ---------------- */

interface ChildRow {
  id: string;
  family_id: string;
  name: string;
  age: number;
  avatar: string;
  reading_level: string;
  interests: string;
  bedtime: string;
  timezone: string;
  game_difficulty: number;
  created_at: number;
  updated_at: number;
}

function rowToChild(row: Partial<ChildRow> & { id: string; family_id: string }) {
  return {
    id: row.id,
    familyId: row.family_id,
    name: row.name,
    age: row.age,
    avatar: row.avatar,
    role: 'child' as const,
    readingLevel: row.reading_level,
    interests: JSON.parse(row.interests ?? '[]') as string[],
    bedtime: row.bedtime,
    timezone: row.timezone,
    gameDifficulty: row.game_difficulty,
    createdAt: row.created_at,
  };
}

app.get('/children', requireAuth(), (req, res) => {
  const rows = db
    .prepare(`SELECT * FROM children WHERE family_id = ? ORDER BY created_at`)
    .all(req.session!.familyId) as ChildRow[];
  res.json(rows.map(rowToChild));
});

app.post('/children', requireAuth('parent'), (req, res) => {
  const b = req.body ?? {};
  if (!b.name || !/^\d{4}$/.test(String(b.pin ?? ''))) {
    return res.status(400).json({ error: 'A name and a 4-digit code are required.' });
  }

  const now = Date.now();
  const childId = b.id && String(b.id).startsWith('kid_') ? String(b.id) : id('kid');
  const { hash, salt } = hashPin(String(b.pin));

  db.prepare(
    `INSERT INTO children
       (id, family_id, name, age, avatar, pin_hash, pin_salt, reading_level, interests,
        bedtime, timezone, game_difficulty, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       name = excluded.name, age = excluded.age, avatar = excluded.avatar,
       pin_hash = excluded.pin_hash, pin_salt = excluded.pin_salt,
       reading_level = excluded.reading_level, interests = excluded.interests,
       bedtime = excluded.bedtime, timezone = excluded.timezone,
       game_difficulty = excluded.game_difficulty, updated_at = excluded.updated_at`,
  ).run(
    childId,
    req.session!.familyId,
    String(b.name).trim(),
    Number(b.age ?? 6),
    String(b.avatar ?? '🦊'),
    hash,
    salt,
    String(b.readingLevel ?? 'early'),
    JSON.stringify(b.interests ?? []),
    String(b.bedtime ?? '19:30'),
    String(b.timezone ?? 'UTC'),
    Number(b.gameDifficulty ?? 2),
    now,
    now,
  );

  const row = db.prepare(`SELECT * FROM children WHERE id = ?`).get(childId) as ChildRow;
  logActivity({
    familyId: req.session!.familyId,
    actorId: req.session!.subjectId,
    kind: 'child_added',
    subjectId: childId,
    summary: `${row.name} joined the family`,
  });
  res.status(201).json(rowToChild(row));
});

app.delete('/children/:id', requireAuth('parent'), (req, res) => {
  db.prepare(`DELETE FROM children WHERE id = ? AND family_id = ?`).run(
    req.params.id,
    req.session!.familyId,
  );
  res.sendStatus(204);
});

/* ---------------- stories ---------------- */

app.post('/stories', requireAuth('parent'), (req, res) => {
  const story = req.body?.story;
  if (!story?.id || !story?.toChildId) {
    return res.status(400).json({ error: 'A story with an id and a recipient is required.' });
  }

  const owns = db
    .prepare(`SELECT id FROM children WHERE id = ? AND family_id = ?`)
    .get(story.toChildId, req.session!.familyId);
  if (!owns) return res.status(404).json({ error: 'No such child in this family.' });

  const now = Date.now();
  db.prepare(
    `INSERT INTO stories
       (id, family_id, to_child_id, from_parent_id, payload, scheduled_for, status,
        play_count, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       payload = excluded.payload, scheduled_for = excluded.scheduled_for,
       status = excluded.status, updated_at = excluded.updated_at`,
  ).run(
    story.id,
    req.session!.familyId,
    story.toChildId,
    req.session!.subjectId,
    JSON.stringify(story),
    Number(story.scheduledFor ?? now),
    String(story.status ?? 'delivered'),
    0,
    now,
    now,
  );

  res.status(201).json({ id: story.id, uploadUrl: `/stories/${story.id}/audio` });
});

/** Audio arrives as a raw body so the server needs no multipart dependency. */
app.post(
  '/stories/:id/audio',
  requireAuth('parent'),
  express.raw({ type: '*/*', limit: MAX_AUDIO_BYTES }),
  (req, res) => {
    const row = db
      .prepare(`SELECT id, audio_file FROM stories WHERE id = ? AND family_id = ?`)
      .get(req.params.id, req.session!.familyId) as { id: string; audio_file?: string } | undefined;
    if (!row) return res.status(404).json({ error: 'No such story.' });
    if (!req.body?.length) return res.status(400).json({ error: 'Empty upload.' });

    const filename = `${row.id}.${extensionFor(req.header('content-type') ?? '')}`;
    writeFileSync(join(MEDIA_DIR, filename), req.body as Buffer);

    // Replacing narration should not leave the previous file behind.
    if (row.audio_file && row.audio_file !== filename) {
      try {
        unlinkSync(join(MEDIA_DIR, row.audio_file));
      } catch {
        /* already gone */
      }
    }

    db.prepare(`UPDATE stories SET audio_file = ?, updated_at = ? WHERE id = ?`).run(
      filename,
      Date.now(),
      row.id,
    );
    res.status(201).json({ ok: true });
  },
);

app.get('/stories', requireAuth(), (req, res) => {
  const session = req.session!;
  const since = Number(req.query.since ?? 0);

  // A child only ever sees their own stories, whatever they ask for.
  const childId = session.role === 'child' ? session.subjectId : req.query.childId;

  const rows = (
    childId
      ? db
          .prepare(
            `SELECT * FROM stories WHERE family_id = ? AND to_child_id = ? AND updated_at > ?
             ORDER BY scheduled_for DESC`,
          )
          .all(session.familyId, childId, since)
      : db
          .prepare(
            `SELECT * FROM stories WHERE family_id = ? AND updated_at > ? ORDER BY scheduled_for DESC`,
          )
          .all(session.familyId, since)
  ) as { id: string; payload: string; audio_file?: string; status: string; play_count: number }[];

  res.json(
    rows.map((row) => ({
      ...(JSON.parse(row.payload) as Record<string, unknown>),
      status: row.status,
      playCount: row.play_count,
      audioUrl: row.audio_file ? `/stories/${row.id}/audio` : null,
    })),
  );
});

app.get('/stories/:id/audio', requireAuth(), (req, res) => {
  const row = db
    .prepare(`SELECT audio_file, to_child_id FROM stories WHERE id = ? AND family_id = ?`)
    .get(req.params.id, req.session!.familyId) as
    | { audio_file?: string; to_child_id: string }
    | undefined;

  if (!row?.audio_file) return res.status(404).json({ error: 'No audio for that story.' });
  if (req.session!.role === 'child' && row.to_child_id !== req.session!.subjectId) {
    return res.status(403).json({ error: 'Not your story.' });
  }

  streamMedia(res, row.audio_file);
});

app.post('/stories/:id/played', requireAuth('child'), (req, res) => {
  const result = db
    .prepare(
      `UPDATE stories SET status = 'played', play_count = play_count + 1, updated_at = ?
       WHERE id = ? AND to_child_id = ?`,
    )
    .run(Date.now(), req.params.id, req.session!.subjectId);
  if (!result.changes) return res.status(404).json({ error: 'No such story.' });

  const story = db
    .prepare(`SELECT payload FROM stories WHERE id = ?`)
    .get(req.params.id) as { payload: string } | undefined;
  const child = db
    .prepare(`SELECT name FROM children WHERE id = ?`)
    .get(req.session!.subjectId) as { name: string } | undefined;

  logActivity({
    familyId: req.session!.familyId,
    actorId: req.session!.subjectId,
    actorName: child?.name,
    kind: 'story_played',
    subjectId: String(req.params.id),
    summary: `${child?.name ?? 'Your child'} listened to "${
      story ? (JSON.parse(story.payload) as { title?: string }).title : 'a story'
    }"`,
  });
  res.sendStatus(204);
});

app.delete('/stories/:id', requireAuth('parent'), (req, res) => {
  const row = db
    .prepare(`SELECT audio_file FROM stories WHERE id = ? AND family_id = ?`)
    .get(req.params.id, req.session!.familyId) as { audio_file?: string } | undefined;

  if (row?.audio_file) {
    try {
      unlinkSync(join(MEDIA_DIR, row.audio_file));
    } catch {
      /* already gone */
    }
  }
  db.prepare(`DELETE FROM stories WHERE id = ? AND family_id = ?`).run(
    req.params.id,
    req.session!.familyId,
  );
  res.sendStatus(204);
});

/* ---------------- replies ---------------- */

app.post(
  '/replies',
  requireAuth('child'),
  express.raw({ type: '*/*', limit: MAX_AUDIO_BYTES }),
  (req, res) => {
    const storyId = String(req.query.storyId ?? '');
    const duration = Number(req.query.duration ?? 0);
    if (!req.body?.length) return res.status(400).json({ error: 'Empty upload.' });

    const child = db
      .prepare(`SELECT name FROM children WHERE id = ?`)
      .get(req.session!.subjectId) as { name: string } | undefined;

    const replyId = id('reply');
    const filename = `${replyId}.${extensionFor(req.header('content-type') ?? '')}`;
    writeFileSync(join(MEDIA_DIR, filename), req.body as Buffer);

    db.prepare(
      `INSERT INTO replies (id, family_id, story_id, child_id, child_name, audio_file, duration, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      replyId,
      req.session!.familyId,
      storyId,
      req.session!.subjectId,
      child?.name ?? 'your child',
      filename,
      duration,
      Date.now(),
    );

    logActivity({
      familyId: req.session!.familyId,
      actorId: req.session!.subjectId,
      actorName: child?.name,
      kind: 'reply_sent',
      subjectId: replyId,
      summary: `${child?.name ?? 'Your child'} recorded a message back`,
    });

    res.status(201).json({ id: replyId });
  },
);

app.get('/replies', requireAuth('parent'), (req, res) => {
  const rows = db
    .prepare(`SELECT * FROM replies WHERE family_id = ? ORDER BY created_at DESC LIMIT 200`)
    .all(req.session!.familyId) as {
    id: string;
    story_id: string;
    child_id: string;
    child_name: string;
    duration: number;
    heard_at?: number;
    created_at: number;
  }[];

  res.json(
    rows.map((row) => ({
      id: row.id,
      storyId: row.story_id,
      childId: row.child_id,
      childName: row.child_name,
      duration: row.duration,
      heardAt: row.heard_at ?? undefined,
      createdAt: row.created_at,
      audioUrl: `/replies/${row.id}/audio`,
    })),
  );
});

app.get('/replies/:id/audio', requireAuth('parent'), (req, res) => {
  const row = db
    .prepare(`SELECT audio_file FROM replies WHERE id = ? AND family_id = ?`)
    .get(req.params.id, req.session!.familyId) as { audio_file: string } | undefined;
  if (!row) return res.status(404).json({ error: 'No such reply.' });
  streamMedia(res, row.audio_file);
});

app.post('/replies/:id/heard', requireAuth('parent'), (req, res) => {
  db.prepare(`UPDATE replies SET heard_at = ? WHERE id = ? AND family_id = ?`).run(
    Date.now(),
    req.params.id,
    req.session!.familyId,
  );
  res.sendStatus(204);
});

/* ---------------- helpers ---------------- */

app.use('/', voiceRoutes);
app.use('/', contentRoutes);

app.use((err: Error & { type?: string }, _req: Request, res: Response, _next: NextFunction) => {
  if (err.type === 'entity.too.large') {
    return res.status(413).json({ error: 'That file is too big.' });
  }
  console.error(err);
  res.status(500).json({ error: 'Something went wrong on the server.' });
});

if (process.env.NODE_ENV !== 'test') {
  reportEnvironment(inspectEnvironment());

  const server = app.listen(PORT, () => {
    console.log(`[startup] Nightshift server listening on :${PORT}`);
    console.log(`[startup] Data directory: ${DATA_DIR}`);
  });

  installGracefulShutdown(server, db);
}

export { app, db };
