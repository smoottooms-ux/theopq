import { useCallback, useEffect, useRef, useState } from 'react';
import { App as CapApp } from '@capacitor/app';
import { useApp } from './store';
import {
  CloudAuthError,
  fetchAccount,
  fetchActivity,
  fetchVoices,
  loadCloudSession,
  logRemoteActivity,
  markPlayedRemote as remoteMarkPlayed,
  pullChildren,
  pullReplies,
  pullStories,
  pushReply as remotePushReply,
  pushStory as remotePushStory,
  saveCloudSession,
  type AccountView,
  type CloudSession,
} from './cloud';
import type { ChildReply, Story, VoiceProfile } from '../types';

/**
 * Keeps the local store and the sync server in step.
 *
 * Every operation is best-effort: a parent in a dead zone still gets their
 * story saved locally and pushed on the next sync, and a child with no signal
 * still plays what is already on the device.
 */
/**
 * Account state is shared across every `useCloud` caller.
 *
 * Without this each screen keeps its own copy, so anything that is not the
 * home screen renders as if the family had no plan at all. One module-level
 * cache plus a subscriber list keeps them in step and stops four components
 * fetching the same thing on mount.
 */
let accountCache: AccountView | null = null;
let accountInFlight: Promise<AccountView | null> | null = null;
const accountSubscribers = new Set<(view: AccountView | null) => void>();

function publishAccount(view: AccountView | null): void {
  accountCache = view;
  accountSubscribers.forEach((notify) => notify(view));
}

export function useCloud({ autoSync = false }: { autoSync?: boolean } = {}) {
  const { update, session: localSession } = useApp();
  const [cloud, setCloud] = useState<CloudSession | null>(() => loadCloudSession());
  const [syncing, setSyncing] = useState(false);
  const [lastSync, setLastSync] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [account, setAccount] = useState<AccountView | null>(accountCache);
  const inFlight = useRef(false);

  useEffect(() => {
    accountSubscribers.add(setAccount);
    return () => {
      accountSubscribers.delete(setAccount);
    };
  }, []);

  const disconnect = useCallback(() => {
    saveCloudSession(null);
    setCloud(null);
    setLastSync(null);
    publishAccount(null);
  }, []);

  const connect = useCallback((next: CloudSession) => {
    saveCloudSession(next);
    setCloud(next);
    setError(null);
  }, []);

  const handle = useCallback(
    (err: unknown) => {
      if (err instanceof CloudAuthError) {
        disconnect();
        setError(err.message);
      } else {
        setError(err instanceof Error ? err.message : 'Sync failed.');
      }
    },
    [disconnect],
  );

  const syncNow = useCallback(async () => {
    if (!cloud || inFlight.current) return;
    inFlight.current = true;
    setSyncing(true);
    setError(null);

    try {
      if (cloud.role === 'parent') {
        const [children, replies, voices, accountView, journal] = await Promise.all([
          pullChildren(cloud),
          pullReplies(cloud, []),
          fetchVoices(cloud).catch(() => []),
          fetchAccount(cloud).catch(() => null),
          fetchActivity(cloud).catch(() => []),
        ]);

        publishAccount(accountView);
        update((d) => {
          // Server-side children win: a second device must not resurrect a
          // profile the parent deleted on the first.
          d.children = children.map((remote) => ({
            ...remote,
            pin: d.children.find((c) => c.id === remote.id)?.pin ?? '0000',
          }));
          d.replies = mergeReplies(d.replies, replies);
          d.voices = voices.map(
            (v): VoiceProfile => ({
              id: v.id,
              parentId: v.parentId,
              provider: 'managed',
              status: v.status,
              samples: Array.from({ length: v.sampleCount }, (_, i) => ({
                id: `${v.id}:${i}`,
                promptId: String(i),
                duration: 0,
                quality: 1,
                createdAt: v.updatedAt,
              })),
              failureReason: v.failureReason,
              updatedAt: v.updatedAt,
            }),
          );
          d.journal = journal;
        });
      } else {
        const [stories, journal] = await Promise.all([
          pullStories(cloud, []),
          fetchActivity(cloud).catch(() => []),
        ]);
        update((d) => {
          d.stories = mergeStories(d.stories, stories);
          d.journal = journal;
        });
      }
      setLastSync(Date.now());
    } catch (err) {
      handle(err);
    } finally {
      inFlight.current = false;
      setSyncing(false);
    }
  }, [cloud, handle, update]);

  const pushStory = useCallback(
    async (story: Story) => {
      if (!cloud || cloud.role !== 'parent') return;
      try {
        await remotePushStory(cloud, story);
      } catch (err) {
        handle(err);
      }
    },
    [cloud, handle],
  );

  const pushReply = useCallback(
    async (reply: ChildReply, blob: Blob) => {
      if (!cloud || cloud.role !== 'child') return;
      try {
        await remotePushReply(cloud, reply, blob);
      } catch (err) {
        handle(err);
      }
    },
    [cloud, handle],
  );

  const markPlayed = useCallback(
    async (storyId: string) => {
      if (!cloud || cloud.role !== 'child') return;
      try {
        await remoteMarkPlayed(cloud, storyId);
      } catch {
        // A play count is not worth surfacing an error over.
      }
    },
    [cloud],
  );

  /** Adds a line to the family journal, where one exists to add it to. */
  const journal = useCallback(
    async (entry: {
      kind: string;
      summary: string;
      subjectId?: string;
      actorName?: string;
      detail?: unknown;
    }) => {
      if (!cloud) return;
      await logRemoteActivity(cloud, entry);
    },
    [cloud],
  );

  const refreshAccount = useCallback(async () => {
    if (!cloud || cloud.role !== 'parent') return null;
    // Collapse concurrent callers onto one request.
    accountInFlight ??= fetchAccount(cloud)
      .catch(() => null)
      .finally(() => {
        accountInFlight = null;
      });
    const view = await accountInFlight;
    publishAccount(view);
    return view;
  }, [cloud]);

  // Any parent screen that mounts without an account yet fetches one, so the
  // plan, voice and settings screens are never blank on a deep link.
  useEffect(() => {
    if (cloud?.role === 'parent' && !accountCache) void refreshAccount();
  }, [cloud, refreshAccount]);

  // Sync when the app comes back to the foreground — that is when a child is
  // most likely opening it to find tonight's story. Only the landing screens
  // opt in, so a deep-linked screen does not kick off a second sync.
  useEffect(() => {
    if (!cloud || !autoSync) return;
    void syncNow();

    const listener = CapApp.addListener('appStateChange', ({ isActive }) => {
      if (isActive) void syncNow();
    });
    const onVisible = () => {
      if (document.visibilityState === 'visible') void syncNow();
    };
    document.addEventListener('visibilitychange', onVisible);

    return () => {
      void listener.then((l) => l.remove()).catch(() => undefined);
      document.removeEventListener('visibilitychange', onVisible);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoSync, cloud?.token, localSession?.userId]);

  return {
    cloud,
    connected: !!cloud,
    account,
    syncing,
    lastSync,
    error,
    connect,
    disconnect,
    syncNow,
    refreshAccount,
    pushStory,
    pushReply,
    markPlayed,
    journal,
  };
}

/** Remote wins on shared fields; local-only rows and local audio are kept. */
function mergeStories(local: Story[], remote: Story[]): Story[] {
  const byId = new Map(local.map((s) => [s.id, s]));
  const merged = remote.map((r) => {
    const mine = byId.get(r.id);
    return mine ? { ...mine, ...r, audioKey: r.audioKey ?? mine.audioKey } : r;
  });
  const seen = new Set(merged.map((s) => s.id));
  return [...merged, ...local.filter((s) => !seen.has(s.id))].sort(
    (a, b) => b.createdAt - a.createdAt,
  );
}

function mergeReplies(local: ChildReply[], remote: ChildReply[]): ChildReply[] {
  const byId = new Map(local.map((r) => [r.id, r]));
  const merged = remote.map((r) => ({ ...(byId.get(r.id) ?? {}), ...r }));
  const seen = new Set(merged.map((r) => r.id));
  return [...merged, ...local.filter((r) => !seen.has(r.id))].sort(
    (a, b) => b.createdAt - a.createdAt,
  );
}
