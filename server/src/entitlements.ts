import type { Database } from 'better-sqlite3';

/**
 * Plans, quotas and usage.
 *
 * The whole point of this file is that a paying family never sees an API key.
 * The operator holds one ElevenLabs account and one Anthropic account; this
 * module decides who is allowed to spend against them and how much.
 *
 * Quotas are denominated in the units that actually cost money:
 *  - narrated characters (ElevenLabs bills per character)
 *  - cloned voices (a plan seat, not a per-use cost)
 *  - stories written by the model
 */

export type PlanId = 'trial' | 'family' | 'family_annual' | 'lifetime' | 'comp';

export interface Plan {
  id: PlanId;
  label: string;
  /** Pence/cents per period. 0 means it is not sold. */
  price: number;
  period: 'trial' | 'month' | 'year' | 'once';
  narrationChars: number;
  storiesPerPeriod: number;
  voiceSlots: number;
  blurb: string;
}

export const PLANS: Record<PlanId, Plan> = {
  trial: {
    id: 'trial',
    label: 'Free trial',
    price: 0,
    period: 'trial',
    // Roughly five full-length stories in a cloned voice — enough to hear
    // your own voice read to your kid before you decide it is worth paying for.
    narrationChars: 20_000,
    storiesPerPeriod: 8,
    voiceSlots: 1,
    blurb: 'One voice, eight stories. Long enough to know if this is for you.',
  },
  family: {
    id: 'family',
    label: 'Family',
    price: 999,
    period: 'month',
    narrationChars: 400_000,
    storiesPerPeriod: 120,
    voiceSlots: 2,
    blurb: 'Two grown-ups, unlimited kids, a story every night with room to spare.',
  },
  family_annual: {
    id: 'family_annual',
    label: 'Family, yearly',
    price: 8999,
    period: 'year',
    narrationChars: 400_000,
    storiesPerPeriod: 120,
    voiceSlots: 2,
    blurb: 'The same thing, two months cheaper.',
  },
  lifetime: {
    id: 'lifetime',
    label: 'Lifetime',
    price: 24999,
    period: 'once',
    narrationChars: 400_000,
    storiesPerPeriod: 120,
    voiceSlots: 3,
    blurb: 'Pay once. Quotas still reset monthly.',
  },
  comp: {
    id: 'comp',
    label: 'Complimentary',
    price: 0,
    period: 'month',
    narrationChars: 400_000,
    storiesPerPeriod: 120,
    voiceSlots: 3,
    blurb: 'Granted by the operator.',
  },
};

export interface Entitlement {
  familyId: string;
  plan: PlanId;
  status: 'active' | 'past_due' | 'canceled' | 'expired';
  periodStart: number;
  periodEnd: number;
  usedChars: number;
  usedStories: number;
  usedVoices: number;
  externalRef?: string;
}

const MONTH_MS = 30 * 24 * 60 * 60 * 1000;

export function installEntitlementSchema(db: Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS entitlements (
      family_id     TEXT PRIMARY KEY REFERENCES families(id) ON DELETE CASCADE,
      plan          TEXT NOT NULL,
      status        TEXT NOT NULL,
      period_start  INTEGER NOT NULL,
      period_end    INTEGER NOT NULL,
      used_chars    INTEGER NOT NULL DEFAULT 0,
      used_stories  INTEGER NOT NULL DEFAULT 0,
      used_voices   INTEGER NOT NULL DEFAULT 0,
      external_ref  TEXT
    );

    CREATE TABLE IF NOT EXISTS usage_events (
      id          TEXT PRIMARY KEY,
      family_id   TEXT NOT NULL,
      kind        TEXT NOT NULL,
      amount      INTEGER NOT NULL,
      detail      TEXT,
      created_at  INTEGER NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_usage_family ON usage_events(family_id, created_at);
  `);
}

/** Every family gets a trial the moment they sign up. */
export function grantTrial(db: Database, familyId: string): void {
  const now = Date.now();
  db.prepare(
    `INSERT OR IGNORE INTO entitlements
       (family_id, plan, status, period_start, period_end)
     VALUES (?, 'trial', 'active', ?, ?)`,
  ).run(familyId, now, now + 14 * 24 * 60 * 60 * 1000);
}

function rowToEntitlement(row: Record<string, unknown>): Entitlement {
  return {
    familyId: row.family_id as string,
    plan: row.plan as PlanId,
    status: row.status as Entitlement['status'],
    periodStart: row.period_start as number,
    periodEnd: row.period_end as number,
    usedChars: row.used_chars as number,
    usedStories: row.used_stories as number,
    usedVoices: row.used_voices as number,
    externalRef: (row.external_ref as string) ?? undefined,
  };
}

/**
 * Reads the current entitlement, rolling the usage window over if the period
 * has elapsed. A paid plan rolls into a fresh month; a trial simply expires.
 */
export function getEntitlement(db: Database, familyId: string): Entitlement {
  const row = db.prepare(`SELECT * FROM entitlements WHERE family_id = ?`).get(familyId) as
    | Record<string, unknown>
    | undefined;

  if (!row) {
    grantTrial(db, familyId);
    return getEntitlement(db, familyId);
  }

  const current = rowToEntitlement(row);
  if (Date.now() <= current.periodEnd) return current;

  if (current.plan === 'trial') {
    db.prepare(`UPDATE entitlements SET status = 'expired' WHERE family_id = ?`).run(familyId);
    return { ...current, status: 'expired' };
  }

  // Paid plans keep running; the quota window resets.
  const now = Date.now();
  db.prepare(
    `UPDATE entitlements
     SET period_start = ?, period_end = ?, used_chars = 0, used_stories = 0
     WHERE family_id = ?`,
  ).run(now, now + MONTH_MS, familyId);

  return { ...current, periodStart: now, periodEnd: now + MONTH_MS, usedChars: 0, usedStories: 0 };
}

export interface QuotaCheck {
  ok: boolean;
  reason?: string;
  /** What the client should offer the user instead. */
  upgrade?: boolean;
}

export function checkQuota(
  db: Database,
  familyId: string,
  need: { chars?: number; story?: boolean; voice?: boolean },
): QuotaCheck {
  const ent = getEntitlement(db, familyId);
  const plan = PLANS[ent.plan] ?? PLANS.trial;

  if (ent.status === 'expired') {
    return { ok: false, upgrade: true, reason: 'Your free trial has ended.' };
  }
  if (ent.status === 'canceled') {
    return { ok: false, upgrade: true, reason: 'This subscription was cancelled.' };
  }
  if (ent.status === 'past_due') {
    return { ok: false, upgrade: true, reason: 'The last payment did not go through.' };
  }

  if (need.voice && ent.usedVoices >= plan.voiceSlots) {
    return {
      ok: false,
      upgrade: plan.id === 'trial',
      reason: `Your plan includes ${plan.voiceSlots} voice${plan.voiceSlots === 1 ? '' : 's'}.`,
    };
  }
  if (need.story && ent.usedStories >= plan.storiesPerPeriod) {
    return {
      ok: false,
      upgrade: true,
      reason: `You have used all ${plan.storiesPerPeriod} stories in this period.`,
    };
  }
  if (need.chars && ent.usedChars + need.chars > plan.narrationChars) {
    return {
      ok: false,
      upgrade: true,
      reason: 'That would go past the narration included in your plan.',
    };
  }

  return { ok: true };
}

export function recordUsage(
  db: Database,
  familyId: string,
  kind: 'narration' | 'story' | 'voice',
  amount: number,
  detail?: string,
): void {
  const column =
    kind === 'narration' ? 'used_chars' : kind === 'story' ? 'used_stories' : 'used_voices';

  db.transaction(() => {
    db.prepare(`UPDATE entitlements SET ${column} = ${column} + ? WHERE family_id = ?`).run(
      amount,
      familyId,
    );
    db.prepare(
      `INSERT INTO usage_events (id, family_id, kind, amount, detail, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
    ).run(
      `use_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`,
      familyId,
      kind,
      amount,
      detail ?? null,
      Date.now(),
    );
  })();
}

/** Releases a voice slot when a family deletes a clone. */
export function releaseVoiceSlot(db: Database, familyId: string): void {
  db.prepare(
    `UPDATE entitlements SET used_voices = MAX(0, used_voices - 1) WHERE family_id = ?`,
  ).run(familyId);
}

export function setPlan(
  db: Database,
  familyId: string,
  plan: PlanId,
  status: Entitlement['status'],
  externalRef?: string,
): void {
  const now = Date.now();
  const definition = PLANS[plan];
  const periodEnd =
    definition.period === 'year'
      ? now + 365 * 24 * 60 * 60 * 1000
      : definition.period === 'once'
        ? now + 100 * 365 * 24 * 60 * 60 * 1000
        : now + MONTH_MS;

  db.prepare(
    `INSERT INTO entitlements (family_id, plan, status, period_start, period_end, external_ref)
     VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT(family_id) DO UPDATE SET
       plan = excluded.plan,
       status = excluded.status,
       period_start = excluded.period_start,
       period_end = excluded.period_end,
       external_ref = COALESCE(excluded.external_ref, entitlements.external_ref),
       used_chars = 0,
       used_stories = 0`,
  ).run(familyId, plan, status, now, periodEnd, externalRef ?? null);
}

/** The shape the app renders on its Plan screen. */
export function describeEntitlement(db: Database, familyId: string) {
  const ent = getEntitlement(db, familyId);
  const plan = PLANS[ent.plan] ?? PLANS.trial;
  return {
    plan: plan.id,
    planLabel: plan.label,
    blurb: plan.blurb,
    status: ent.status,
    renewsAt: ent.periodEnd,
    narration: { used: ent.usedChars, limit: plan.narrationChars },
    stories: { used: ent.usedStories, limit: plan.storiesPerPeriod },
    voices: { used: ent.usedVoices, limit: plan.voiceSlots },
  };
}
