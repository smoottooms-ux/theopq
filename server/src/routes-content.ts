import express from 'express';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { MEDIA_DIR, db, id, logActivity, requireAuth } from './context.js';
import { checkQuota, describeEntitlement, recordUsage } from './entitlements.js';
import {
  ProviderError,
  storyWritingConfigured,
  synthesize,
  voiceCloningConfigured,
  writeStory,
  type StoryBrief,
} from './providers.js';

/**
 * Story composition and lullabies.
 *
 * The client always sends a locally-generated fallback story alongside the
 * brief. If the server can write a better one it does; if the model is
 * unavailable or refuses, the fallback ships. Either way a child gets a story
 * tonight, which is the only requirement that actually matters.
 */
export const contentRoutes = express.Router();

contentRoutes.get('/account', requireAuth(), (req, res) => {
  const entitlement = describeEntitlement(db, req.session!.familyId);
  res.json({
    entitlement,
    capabilities: {
      voiceCloning: voiceCloningConfigured(),
      bespokeStories: storyWritingConfigured(),
    },
  });
});

interface ComposeBody {
  story: Record<string, unknown> & {
    id: string;
    toChildId: string;
    title: string;
    pages: { text: string; art: string }[];
    comprehension?: unknown[];
    vocabulary?: unknown[];
    talkPrompts?: unknown[];
  };
  brief?: Partial<StoryBrief> & { heartfeltLabel?: string };
  /** Skip narration — the parent recorded themselves instead. */
  narrate?: boolean;
}

contentRoutes.post('/stories/compose', requireAuth('parent'), express.json({ limit: '1mb' }), async (req, res) => {
  const body = req.body as ComposeBody;
  const fallback = body?.story;
  if (!fallback?.id || !fallback?.toChildId || !fallback?.pages?.length) {
    return res.status(400).json({ error: 'A story with an id, a recipient and pages is required.' });
  }

  const child = db
    .prepare(`SELECT id, name FROM children WHERE id = ? AND family_id = ?`)
    .get(fallback.toChildId, req.session!.familyId) as { id: string; name: string } | undefined;
  if (!child) return res.status(404).json({ error: 'No such child in this family.' });

  const quota = checkQuota(db, req.session!.familyId, { story: true });
  if (!quota.ok) return res.status(402).json({ error: quota.reason, upgrade: quota.upgrade });

  // 1. Write it, preferring the model when the operator has it configured.
  let story = { ...fallback };
  if (body.brief && storyWritingConfigured()) {
    const written = await writeStory({
      childName: body.brief.childName ?? child.name,
      age: body.brief.age ?? 6,
      readingLevel: body.brief.readingLevel ?? 'early',
      interests: body.brief.interests ?? [],
      parentName: body.brief.parentName ?? 'your grown-up',
      topic: body.brief.topic ?? 'adventure',
      topicLabel: body.brief.topicLabel ?? 'Adventure',
      tone: body.brief.tone ?? 'gentle',
      pages: body.brief.pages ?? 7,
      personalNote: body.brief.personalNote,
      heartfelt: body.brief.heartfeltLabel ? { label: body.brief.heartfeltLabel } : undefined,
    });

    if (written) {
      story = {
        ...story,
        title: written.title,
        pages: written.pages,
        comprehension: written.comprehension,
        vocabulary: written.vocabulary,
        talkPrompts: written.talkPrompts,
        writtenBy: 'model',
      };
    }
  }

  // 2. Narrate it in the parent's voice, if they have one and want it.
  let audioFile: string | null = null;
  let narrationNote: string | undefined;

  if (body.narrate !== false) {
    const voice = db
      .prepare(`SELECT provider_voice_id FROM voices WHERE family_id = ? AND parent_id = ? AND status = 'ready'`)
      .get(req.session!.familyId, req.session!.subjectId) as { provider_voice_id?: string } | undefined;

    if (voice?.provider_voice_id) {
      const script = story.pages.map((p) => p.text).join('\n\n');
      const charge = checkQuota(db, req.session!.familyId, { chars: script.length });

      if (!charge.ok) {
        narrationNote = charge.reason;
      } else {
        try {
          const { audio } = await synthesize(script, voice.provider_voice_id, 'bedtime');
          audioFile = `${story.id}.mp3`;
          writeFileSync(join(MEDIA_DIR, audioFile), audio);
          recordUsage(db, req.session!.familyId, 'narration', script.length, story.id);
        } catch (err) {
          // Deliver the book anyway; the child can still have it read aloud.
          narrationNote = err instanceof ProviderError ? err.message : 'Narration failed.';
        }
      }
    }
  }

  // 3. Store and hand it back.
  const now = Date.now();
  const stored = {
    ...story,
    voiceProvider: audioFile ? 'managed' : body.narrate === false ? 'recorded' : 'device',
    failureReason: narrationNote,
  };

  db.prepare(
    `INSERT INTO stories
       (id, family_id, to_child_id, from_parent_id, payload, audio_file, scheduled_for, status,
        play_count, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       payload = excluded.payload, audio_file = COALESCE(excluded.audio_file, stories.audio_file),
       scheduled_for = excluded.scheduled_for, status = excluded.status, updated_at = excluded.updated_at`,
  ).run(
    story.id,
    req.session!.familyId,
    story.toChildId,
    req.session!.subjectId,
    JSON.stringify(stored),
    audioFile,
    Number(story.scheduledFor ?? now),
    'delivered',
    now,
    now,
  );

  recordUsage(db, req.session!.familyId, 'story', 1, story.id);
  logActivity({
    familyId: req.session!.familyId,
    actorId: req.session!.subjectId,
    actorName: String(body.brief?.parentName ?? ''),
    kind: 'story_sent',
    subjectId: story.id,
    summary: `Sent "${story.title}" to ${child.name}`,
    detail: { childId: child.id, narrated: !!audioFile },
  });

  res.status(201).json({
    ...stored,
    audioUrl: audioFile ? `/stories/${story.id}/audio` : null,
    narrationNote,
  });
});

/**
 * Lullabies.
 *
 * Narrated with a steadier, slower voice setting than a story: a lullaby is
 * meant to be background, not performance.
 */
contentRoutes.post('/lullabies/narrate', requireAuth('parent'), express.json(), async (req, res) => {
  const text = String(req.body?.text ?? '').slice(0, 4000);
  const lullabyId = String(req.body?.lullabyId ?? id('lul'));
  if (!text.trim()) return res.status(400).json({ error: 'Nothing to sing.' });

  const voice = db
    .prepare(`SELECT provider_voice_id FROM voices WHERE family_id = ? AND parent_id = ? AND status = 'ready'`)
    .get(req.session!.familyId, req.session!.subjectId) as { provider_voice_id?: string } | undefined;
  if (!voice?.provider_voice_id) return res.status(404).json({ error: 'No voice is ready yet.' });

  const quota = checkQuota(db, req.session!.familyId, { chars: text.length });
  if (!quota.ok) return res.status(402).json({ error: quota.reason, upgrade: quota.upgrade });

  try {
    const { audio, contentType } = await synthesize(text, voice.provider_voice_id, 'lullaby');
    recordUsage(db, req.session!.familyId, 'narration', text.length, `lullaby:${lullabyId}`);
    res.setHeader('Content-Type', contentType);
    res.send(audio);
  } catch (err) {
    const status = err instanceof ProviderError ? err.status : 502;
    res.status(status).json({ error: err instanceof Error ? err.message : 'Narration failed.' });
  }
});

/* ---------------- the family journal ---------------- */

contentRoutes.get('/activity', requireAuth(), (req, res) => {
  const limit = Math.min(Number(req.query.limit ?? 200), 500);
  const before = Number(req.query.before ?? Date.now());

  const rows = db
    .prepare(
      `SELECT * FROM activity WHERE family_id = ? AND created_at < ?
       ORDER BY created_at DESC LIMIT ?`,
    )
    .all(req.session!.familyId, before, limit) as {
    id: string;
    actor_name?: string;
    kind: string;
    subject_id?: string;
    summary: string;
    detail?: string;
    created_at: number;
  }[];

  res.json(
    rows.map((row) => ({
      id: row.id,
      actorName: row.actor_name ?? undefined,
      kind: row.kind,
      subjectId: row.subject_id ?? undefined,
      summary: row.summary,
      detail: row.detail ? (JSON.parse(row.detail) as unknown) : undefined,
      createdAt: row.created_at,
    })),
  );
});

contentRoutes.post('/activity', requireAuth(), express.json(), (req, res) => {
  const { kind, summary, subjectId, detail, actorName } = req.body ?? {};
  const allowed = new Set(['story_played', 'game_played', 'talk_answered', 'reply_heard']);
  if (!allowed.has(String(kind))) return res.status(400).json({ error: 'Unknown event.' });

  logActivity({
    familyId: req.session!.familyId,
    actorId: req.session!.subjectId,
    actorName: actorName ? String(actorName) : undefined,
    kind: String(kind) as 'story_played',
    subjectId: subjectId ? String(subjectId) : undefined,
    summary: String(summary ?? kind).slice(0, 300),
    detail,
  });
  res.sendStatus(201);
});
