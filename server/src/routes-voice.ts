import express from 'express';
import { readFileSync, unlinkSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  MAX_AUDIO_BYTES,
  TEMP_DIR,
  db,
  extensionFor,
  id,
  logActivity,
  requireAuth,
} from './context.js';
import {
  checkQuota,
  recordUsage,
  releaseVoiceSlot,
} from './entitlements.js';
import { ProviderError, deleteVoice, enrollVoice, synthesize, voiceCloningConfigured } from './providers.js';

/**
 * Voice enrollment, run entirely through the operator's provider account.
 *
 * Samples are uploaded one at a time as raw bodies — no multipart dependency,
 * and a dropped connection only costs the parent one take rather than the
 * whole session.
 */
export const voiceRoutes = express.Router();

interface VoiceRow {
  id: string;
  family_id: string;
  parent_id: string;
  provider_voice_id?: string;
  status: string;
  label: string;
  consent_name?: string;
  consent_at?: number;
  sample_count: number;
  failure_reason?: string;
  updated_at: number;
}

const toVoice = (row: VoiceRow) => ({
  id: row.id,
  parentId: row.parent_id,
  provider: 'managed' as const,
  status: row.status,
  label: row.label,
  consentName: row.consent_name,
  consentAt: row.consent_at,
  sampleCount: row.sample_count,
  failureReason: row.failure_reason,
  updatedAt: row.updated_at,
});

voiceRoutes.get('/voices', requireAuth(), (req, res) => {
  const rows = db
    .prepare(`SELECT * FROM voices WHERE family_id = ?`)
    .all(req.session!.familyId) as VoiceRow[];
  res.json(rows.map(toVoice));
});

/** One take. Returns a sample id to include in the enrollment call. */
voiceRoutes.post(
  '/voice/samples',
  requireAuth('parent'),
  express.raw({ type: '*/*', limit: MAX_AUDIO_BYTES }),
  (req, res) => {
    if (!req.body?.length) return res.status(400).json({ error: 'Empty upload.' });

    const promptId = String(req.query.promptId ?? 'unknown');
    const contentType = req.header('content-type') ?? 'audio/webm';
    const sampleId = id('smp');
    const filename = `${sampleId}.${extensionFor(contentType)}`;

    writeFileSync(join(TEMP_DIR, filename), req.body as Buffer);
    db.prepare(
      `INSERT INTO voice_samples (id, family_id, parent_id, prompt_id, filename, content_type, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      sampleId,
      req.session!.familyId,
      req.session!.subjectId,
      promptId,
      filename,
      contentType,
      Date.now(),
    );

    res.status(201).json({ sampleId });
  },
);

/** Finalises enrollment: consent is checked, then the clone is built. */
voiceRoutes.post('/voice/enroll', requireAuth('parent'), express.json(), async (req, res) => {
  if (!voiceCloningConfigured()) {
    return res.status(503).json({ error: 'Voice cloning is not available on this server.' });
  }

  const { sampleIds, consentName, parentName } = req.body ?? {};
  if (!Array.isArray(sampleIds) || sampleIds.length < 3) {
    return res.status(400).json({ error: 'At least three usable recordings are needed.' });
  }
  if (!consentName || String(consentName).trim().toLowerCase() !== String(parentName ?? '').trim().toLowerCase()) {
    return res.status(400).json({ error: 'Typed consent does not match the account name.' });
  }

  const existing = db
    .prepare(`SELECT * FROM voices WHERE family_id = ? AND parent_id = ?`)
    .get(req.session!.familyId, req.session!.subjectId) as VoiceRow | undefined;

  // Re-recording an existing voice reuses its slot rather than buying another.
  const quota = checkQuota(db, req.session!.familyId, { voice: !existing?.provider_voice_id });
  if (!quota.ok) return res.status(402).json({ error: quota.reason, upgrade: quota.upgrade });

  const rows = db
    .prepare(
      `SELECT * FROM voice_samples WHERE family_id = ? AND id IN (${sampleIds.map(() => '?').join(',')})`,
    )
    .all(req.session!.familyId, ...sampleIds.map(String)) as {
    id: string;
    filename: string;
    content_type: string;
  }[];

  if (rows.length < 3) return res.status(400).json({ error: 'Those recordings are no longer available.' });

  const voiceId = existing?.id ?? id('voice');
  const now = Date.now();

  db.prepare(
    `INSERT INTO voices (id, family_id, parent_id, status, label, consent_name, consent_at, sample_count, created_at, updated_at)
     VALUES (?, ?, ?, 'processing', ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       status = 'processing', consent_name = excluded.consent_name,
       consent_at = excluded.consent_at, sample_count = excluded.sample_count,
       failure_reason = NULL, updated_at = excluded.updated_at`,
  ).run(
    voiceId,
    req.session!.familyId,
    req.session!.subjectId,
    `Nightshift · ${parentName}`,
    String(consentName).trim(),
    now,
    rows.length,
    now,
    now,
  );

  try {
    // Replacing a clone should not leave the old one billing on the provider.
    if (existing?.provider_voice_id) await deleteVoice(existing.provider_voice_id);

    const { voiceId: providerVoiceId } = await enrollVoice(
      rows.map((row) => ({
        buffer: readFileSync(join(TEMP_DIR, row.filename)),
        contentType: row.content_type,
      })),
      `Nightshift · ${parentName}`,
    );

    db.prepare(
      `UPDATE voices SET provider_voice_id = ?, status = 'ready', updated_at = ? WHERE id = ?`,
    ).run(providerVoiceId, Date.now(), voiceId);

    if (!existing?.provider_voice_id) {
      recordUsage(db, req.session!.familyId, 'voice', 1, voiceId);
    }

    logActivity({
      familyId: req.session!.familyId,
      actorId: req.session!.subjectId,
      actorName: String(parentName),
      kind: 'voice_ready',
      subjectId: voiceId,
      summary: `${parentName} taught Nightshift their voice`,
    });

    cleanupSamples(rows);
    const row = db.prepare(`SELECT * FROM voices WHERE id = ?`).get(voiceId) as VoiceRow;
    res.status(201).json(toVoice(row));
  } catch (err) {
    const message = err instanceof ProviderError ? err.message : 'Voice enrollment failed.';
    db.prepare(`UPDATE voices SET status = 'failed', failure_reason = ?, updated_at = ? WHERE id = ?`).run(
      message,
      Date.now(),
      voiceId,
    );
    cleanupSamples(rows);
    res.status(err instanceof ProviderError ? err.status : 502).json({ error: message });
  }
});

/** A short "hear yourself" clip. Metered like any other narration. */
voiceRoutes.post('/voice/preview', requireAuth('parent'), express.json(), async (req, res) => {
  const row = db
    .prepare(`SELECT * FROM voices WHERE family_id = ? AND parent_id = ? AND status = 'ready'`)
    .get(req.session!.familyId, req.session!.subjectId) as VoiceRow | undefined;

  if (!row?.provider_voice_id) return res.status(404).json({ error: 'No voice is ready yet.' });

  const text = String(req.body?.text ?? 'Goodnight. Sleep well. I love you.').slice(0, 300);
  const quota = checkQuota(db, req.session!.familyId, { chars: text.length });
  if (!quota.ok) return res.status(402).json({ error: quota.reason, upgrade: quota.upgrade });

  try {
    const { audio, contentType } = await synthesize(text, row.provider_voice_id, 'bedtime');
    recordUsage(db, req.session!.familyId, 'narration', text.length, 'preview');
    res.setHeader('Content-Type', contentType);
    res.send(audio);
  } catch (err) {
    const status = err instanceof ProviderError ? err.status : 502;
    res.status(status).json({ error: err instanceof Error ? err.message : 'Preview failed.' });
  }
});

voiceRoutes.delete('/voice', requireAuth('parent'), async (req, res) => {
  const row = db
    .prepare(`SELECT * FROM voices WHERE family_id = ? AND parent_id = ?`)
    .get(req.session!.familyId, req.session!.subjectId) as VoiceRow | undefined;
  if (!row) return res.sendStatus(204);

  if (row.provider_voice_id) await deleteVoice(row.provider_voice_id);
  db.prepare(`DELETE FROM voices WHERE id = ?`).run(row.id);
  releaseVoiceSlot(db, req.session!.familyId);
  res.sendStatus(204);
});

function cleanupSamples(rows: { id: string; filename: string }[]): void {
  for (const row of rows) {
    try {
      unlinkSync(join(TEMP_DIR, row.filename));
    } catch {
      /* already gone */
    }
    db.prepare(`DELETE FROM voice_samples WHERE id = ?`).run(row.id);
  }
}
