import type { AppData, Child, Parent, Story, VoiceRecording } from '../types';
import { LIBRARY, type LibraryItem, type ShelfKind } from '../data/library';
import { nextBedtime } from './delivery';
import { id } from './ids';

/**
 * Auto-pilot.
 *
 * The promise is that a parent sets this up once and then does nothing. So
 * when the app opens, it checks whether tonight is covered for each child and
 * quietly fills the gap from the library, rotating through the shelves so the
 * same book does not arrive four nights running.
 *
 * It only ever picks from material that already exists — no generation, no
 * spend, no network — which means it works in a dead zone at 11pm.
 */

export interface AutoPick {
  child: Child;
  item: LibraryItem;
  scheduledFor: number;
}

/** Whether this child already has something waiting for tonight. */
export function coveredTonight(data: AppData, child: Child): boolean {
  const bedtime = nextBedtime(child);
  const windowStart = bedtime - 20 * 3600_000;

  return data.stories.some(
    (s) =>
      s.toChildId === child.id &&
      s.status !== 'draft' &&
      s.scheduledFor >= windowStart &&
      s.scheduledFor <= bedtime + 3600_000,
  );
}

/**
 * Picks the least recently sent item from the enabled shelves.
 *
 * Preferring what a parent has actually recorded means auto-pilot sounds like
 * them from the very first night, before any voice is built.
 */
export function pickForTonight(data: AppData, child: Child): LibraryItem | null {
  const shelves = data.settings.autoPilotShelves as ShelfKind[];
  const pool = LIBRARY.filter(
    (item) =>
      shelves.includes(item.kind) && child.age >= item.ageMin - 1 && child.age <= item.ageMax + 2,
  );
  if (pool.length === 0) return null;

  const lastSent = new Map<string, number>();
  for (const story of data.stories) {
    if (story.toChildId !== child.id || !story.libraryItemId) continue;
    const seen = lastSent.get(story.libraryItemId) ?? 0;
    if (story.createdAt > seen) lastSent.set(story.libraryItemId, story.createdAt);
  }

  const recorded = new Set(data.recordings.map((r) => r.itemId));

  return [...pool].sort((a, b) => {
    // Never-sent first, then oldest; a recorded version wins a tie.
    const sentA = lastSent.get(a.id) ?? 0;
    const sentB = lastSent.get(b.id) ?? 0;
    if (sentA !== sentB) return sentA - sentB;
    return Number(recorded.has(b.id)) - Number(recorded.has(a.id));
  })[0];
}

/**
 * Builds the story record for an auto-picked library item.
 *
 * If the parent has already recorded this one, the recording is attached
 * here — otherwise auto-pilot would hand a child the device narrator reading
 * a song their own parent had sat down and sung, which is the opposite of
 * what the app is for.
 */
export function buildAutoStory(
  parent: Parent,
  child: Child,
  item: LibraryItem,
  recordings: VoiceRecording[] = [],
): Story {
  const mine = recordings
    .filter((r) => r.itemId === item.id && r.parentId === parent.id)
    .sort((a, b) => b.createdAt - a.createdAt)[0];

  return {
    id: id('story'),
    familyId: child.familyId,
    fromParentId: parent.id,
    fromParentName: parent.name,
    toChildId: child.id,
    title: item.title,
    topic: 'calm',
    tone: 'gentle',
    length: 'short',
    pages: item.pages,
    comprehension: [],
    vocabulary: [],
    talkPrompts: [],
    libraryItemId: item.id,
    audioKey: mine?.audioKey,
    voiceProvider: mine ? 'recorded' : 'device',
    durationEstimate: item.duration,
    status: 'delivered',
    scheduledFor: nextBedtime(child),
    createdAt: Date.now(),
    deliveredAt: Date.now(),
    playCount: 0,
    autoPilot: true,
  };
}

/** What auto-pilot would do right now, without doing it. */
export function planTonight(data: AppData, parent: Parent | null): AutoPick[] {
  if (!parent || !data.settings.autoPilot) return [];

  return data.children
    .filter((child) => !coveredTonight(data, child))
    .map((child) => {
      const item = pickForTonight(data, child);
      return item ? { child, item, scheduledFor: nextBedtime(child) } : null;
    })
    .filter((pick): pick is AutoPick => pick !== null);
}
