import type { GameSession, SkillCard, SkillId } from '../types';

/**
 * Spaced repetition, SM-2 flavoured.
 *
 * The point of the games is that a child keeps the thing they learned. Cards a
 * child gets wrong come back within minutes; cards they nail move out to days.
 * Without this, a "learning game" is just a slot machine with flashcards.
 */

const MIN_EASE = 1.3;
const DAY = 86_400_000;

export function newCard(key: string, skill: SkillId): SkillCard {
  return { key, skill, ease: 2.5, interval: 0, dueAt: Date.now(), reps: 0, lapses: 0 };
}

/**
 * @param quality 0-5 as in SM-2. The games send 5 for a fast correct answer,
 *   3 for a slow one, and 1 for wrong.
 */
export function review(card: SkillCard, quality: number): SkillCard {
  const next = { ...card, reps: card.reps + 1, lastResult: quality >= 3 ? ('right' as const) : ('wrong' as const) };

  if (quality < 3) {
    next.lapses += 1;
    next.interval = 0;
    next.ease = Math.max(MIN_EASE, card.ease - 0.2);
    // Bring it back inside the same session, not tomorrow.
    next.dueAt = Date.now() + 3 * 60_000;
    return next;
  }

  next.ease = Math.max(
    MIN_EASE,
    card.ease + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02)),
  );

  if (card.interval === 0) next.interval = 1;
  else if (card.interval === 1) next.interval = 3;
  else next.interval = Math.round(card.interval * next.ease);

  next.dueAt = Date.now() + next.interval * DAY;
  return next;
}

/** Cards due now, hardest first, capped so a session stays bite-sized. */
export function dueCards(cards: SkillCard[], skill: SkillId, limit: number): SkillCard[] {
  const now = Date.now();
  return cards
    .filter((c) => c.skill === skill && c.dueAt <= now)
    .sort((a, b) => a.ease - b.ease || a.dueAt - b.dueAt)
    .slice(0, limit);
}

/**
 * Builds a round: everything due, topped up with unseen material.
 * New items are introduced slowly so a child is never drowning in novelty.
 */
export function buildRound<T extends { key: string }>(
  pool: T[],
  cards: SkillCard[],
  skill: SkillId,
  size: number,
  maxNew = 4,
): { items: T[]; cards: SkillCard[] } {
  const byKey = new Map(cards.filter((c) => c.skill === skill).map((c) => [c.key, c]));

  // A child's very first round has nothing due, so the new-item cap would make
  // it uselessly short. Introduce a full round once, then throttle.
  const introLimit = byKey.size === 0 ? size : maxNew;
  const due = dueCards(cards, skill, size);
  const chosen: T[] = [];
  const outCards: SkillCard[] = [];

  for (const card of due) {
    const item = pool.find((p) => p.key === card.key);
    if (item) {
      chosen.push(item);
      outCards.push(card);
    }
  }

  let added = 0;
  for (const item of pool) {
    if (chosen.length >= size || added >= introLimit) break;
    if (byKey.has(item.key)) continue;
    chosen.push(item);
    outCards.push(newCard(item.key, skill));
    added++;
  }

  // Still short? Reuse the least-recently-due cards rather than ending early.
  if (chosen.length < size) {
    const rest = cards
      .filter((c) => c.skill === skill && !outCards.some((o) => o.key === c.key))
      .sort((a, b) => a.dueAt - b.dueAt);
    for (const card of rest) {
      if (chosen.length >= size) break;
      const item = pool.find((p) => p.key === card.key);
      if (item) {
        chosen.push(item);
        outCards.push(card);
      }
    }
  }

  return { items: chosen, cards: outCards };
}

export interface SkillSummary {
  skill: SkillId;
  label: string;
  /** 0-1 share of this skill's cards that are genuinely retained. */
  mastery: number;
  learning: number;
  mastered: number;
  total: number;
}

const SKILL_LABELS: Record<SkillId, string> = {
  phonics: 'Sounding out words',
  sightWords: 'Sight words',
  numberSense: 'Number sense',
  comprehension: 'Understanding stories',
  patterns: 'Patterns & logic',
};

/** A card is "mastered" once it survives to a week-long interval. */
export function summarise(cards: SkillCard[]): SkillSummary[] {
  return (Object.keys(SKILL_LABELS) as SkillId[]).map((skill) => {
    const mine = cards.filter((c) => c.skill === skill);
    const mastered = mine.filter((c) => c.interval >= 7).length;
    const learning = mine.filter((c) => c.interval > 0 && c.interval < 7).length;
    return {
      skill,
      label: SKILL_LABELS[skill],
      mastery: mine.length ? mastered / mine.length : 0,
      learning,
      mastered,
      total: mine.length,
    };
  });
}

/** Minutes played today, for the screen-time cap. */
export function minutesToday(sessions: GameSession[], childId: string): number {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const ms = sessions
    .filter((s) => s.childId === childId && s.createdAt >= start.getTime())
    .reduce((n, s) => n + s.ms, 0);
  return Math.round(ms / 60_000);
}

export function accuracy(sessions: GameSession[], childId: string, game?: string): number {
  const mine = sessions.filter((s) => s.childId === childId && (!game || s.game === game));
  const total = mine.reduce((n, s) => n + s.total, 0);
  if (!total) return 0;
  return mine.reduce((n, s) => n + s.correct, 0) / total;
}

/** Consecutive days with at least one session, counting back from today. */
export function streak(sessions: GameSession[], childId: string): number {
  const days = new Set(
    sessions
      .filter((s) => s.childId === childId)
      .map((s) => new Date(s.createdAt).toDateString()),
  );
  let count = 0;
  const cursor = new Date();
  while (days.has(cursor.toDateString())) {
    count++;
    cursor.setDate(cursor.getDate() - 1);
  }
  return count;
}
