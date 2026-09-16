import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import type {
  AppData,
  Child,
  ChildReply,
  GameSession,
  Parent,
  Session,
  SkillCard,
  Settings,
  Story,
  VoiceProfile,
} from '../types';
import { id, joinCode } from './ids';
import { emptyData, loadData, loadSession, saveData, saveSession } from './storage';

interface Ctx {
  data: AppData;
  session: Session | null;
  loading: boolean;
  /** The signed-in parent, if the current session is a parent session. */
  parent: Parent | null;
  /** The signed-in child, if the current session is a child session. */
  child: Child | null;
  update(fn: (draft: AppData) => void): void;
  signUpParent(input: { name: string; email: string; pin: string }): Promise<Parent>;
  signInParent(email: string, pin: string): Promise<Parent>;
  signInChild(childId: string, pin: string): Promise<Child>;
  signOut(): Promise<void>;
  addChild(input: Omit<Child, 'id' | 'familyId' | 'role' | 'createdAt'>): Child;
  upsertVoice(voice: VoiceProfile): void;
  addStory(story: Story): void;
  patchStory(storyId: string, patch: Partial<Story>): void;
  addReply(reply: ChildReply): void;
  recordSession(session: GameSession, cards: SkillCard[]): void;
  setSettings(patch: Partial<Settings>): void;
}

const AppContext = createContext<Ctx | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<AppData>(emptyData);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const saveTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    void (async () => {
      const [d, s] = await Promise.all([loadData(), loadSession()]);
      setData(d);
      setSession(s);
      setLoading(false);
    })();
  }, []);

  // Writes are debounced: games update state many times a second.
  const persist = useCallback((next: AppData) => {
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => void saveData(next), 200);
  }, []);

  const update = useCallback(
    (fn: (draft: AppData) => void) => {
      setData((prev) => {
        const next: AppData = {
          ...prev,
          parents: [...prev.parents],
          children: [...prev.children],
          voices: [...prev.voices],
          stories: [...prev.stories],
          replies: [...prev.replies],
          cards: [...prev.cards],
          sessions: [...prev.sessions],
          settings: { ...prev.settings },
        };
        fn(next);
        persist(next);
        return next;
      });
    },
    [persist],
  );

  const setActiveSession = useCallback(async (next: Session | null) => {
    setSession(next);
    await saveSession(next);
  }, []);

  const signUpParent: Ctx['signUpParent'] = useCallback(
    async ({ name, email, pin }) => {
      const normalised = email.trim().toLowerCase();
      if (data.parents.some((p) => p.email === normalised)) {
        throw new Error('There is already an account with that email on this device.');
      }

      const family = data.family ?? {
        id: id('fam'),
        name: `${name.split(' ')[0]}'s family`,
        joinCode: joinCode(),
        createdAt: Date.now(),
      };

      const parent: Parent = {
        id: id('par'),
        familyId: family.id,
        name: name.trim(),
        email: normalised,
        pin,
        role: 'parent',
        createdAt: Date.now(),
      };

      update((d) => {
        d.family = family;
        d.parents.push(parent);
      });
      await setActiveSession({ role: 'parent', userId: parent.id });
      return parent;
    },
    [data.family, data.parents, setActiveSession, update],
  );

  const signInParent: Ctx['signInParent'] = useCallback(
    async (email, pin) => {
      const normalised = email.trim().toLowerCase();
      const parent = data.parents.find((p) => p.email === normalised);
      if (!parent) throw new Error('No account found for that email on this device.');
      if (parent.pin !== pin) throw new Error('That PIN does not match.');
      await setActiveSession({ role: 'parent', userId: parent.id });
      return parent;
    },
    [data.parents, setActiveSession],
  );

  const signInChild: Ctx['signInChild'] = useCallback(
    async (childId, pin) => {
      const kid = data.children.find((c) => c.id === childId);
      if (!kid) throw new Error('That profile is gone.');
      if (kid.pin !== pin) throw new Error('That is not the right code.');
      await setActiveSession({ role: 'child', userId: kid.id });
      return kid;
    },
    [data.children, setActiveSession],
  );

  const signOut = useCallback(() => setActiveSession(null), [setActiveSession]);

  const addChild: Ctx['addChild'] = useCallback(
    (input) => {
      const kid: Child = {
        ...input,
        id: id('kid'),
        familyId: data.family?.id ?? '',
        role: 'child',
        createdAt: Date.now(),
      };
      update((d) => {
        d.children.push(kid);
      });
      return kid;
    },
    [data.family?.id, update],
  );

  const upsertVoice: Ctx['upsertVoice'] = useCallback(
    (voice) => {
      update((d) => {
        const i = d.voices.findIndex((v) => v.id === voice.id);
        if (i >= 0) d.voices[i] = voice;
        else d.voices.push(voice);
      });
    },
    [update],
  );

  const addStory: Ctx['addStory'] = useCallback(
    (story) => {
      update((d) => {
        d.stories.unshift(story);
      });
    },
    [update],
  );

  const patchStory: Ctx['patchStory'] = useCallback(
    (storyId, patch) => {
      update((d) => {
        const i = d.stories.findIndex((s) => s.id === storyId);
        if (i >= 0) d.stories[i] = { ...d.stories[i], ...patch };
      });
    },
    [update],
  );

  const addReply: Ctx['addReply'] = useCallback(
    (reply) => {
      update((d) => {
        d.replies.unshift(reply);
      });
    },
    [update],
  );

  const recordSession: Ctx['recordSession'] = useCallback(
    (gameSession, cards) => {
      update((d) => {
        d.sessions.unshift(gameSession);
        // Keep the log bounded; the progress view only reads recent history.
        if (d.sessions.length > 400) d.sessions.length = 400;
        for (const card of cards) {
          const i = d.cards.findIndex((c) => c.key === card.key && c.skill === card.skill);
          if (i >= 0) d.cards[i] = card;
          else d.cards.push(card);
        }
      });
    },
    [update],
  );

  const setSettings: Ctx['setSettings'] = useCallback(
    (patch) => {
      update((d) => {
        d.settings = { ...d.settings, ...patch };
      });
    },
    [update],
  );

  const parent = useMemo(
    () => (session?.role === 'parent' ? data.parents.find((p) => p.id === session.userId) ?? null : null),
    [data.parents, session],
  );

  const child = useMemo(
    () => (session?.role === 'child' ? data.children.find((c) => c.id === session.userId) ?? null : null),
    [data.children, session],
  );

  const value = useMemo<Ctx>(
    () => ({
      data,
      session,
      loading,
      parent,
      child,
      update,
      signUpParent,
      signInParent,
      signInChild,
      signOut,
      addChild,
      upsertVoice,
      addStory,
      patchStory,
      addReply,
      recordSession,
      setSettings,
    }),
    [
      data, session, loading, parent, child, update, signUpParent, signInParent,
      signInChild, signOut, addChild, upsertVoice, addStory, patchStory,
      addReply, recordSession, setSettings,
    ],
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp(): Ctx {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used inside <AppProvider>');
  return ctx;
}

/** Stories addressed to this child that are due and not yet played. */
export function pendingStories(data: AppData, childId: string): Story[] {
  const now = Date.now();
  return data.stories
    .filter(
      (s) =>
        s.toChildId === childId &&
        (s.status === 'ready' || s.status === 'delivered') &&
        s.scheduledFor <= now,
    )
    .sort((a, b) => b.scheduledFor - a.scheduledFor);
}

export function storyLibrary(data: AppData, childId: string): Story[] {
  return data.stories
    .filter((s) => s.toChildId === childId && s.status !== 'draft' && s.status !== 'generating')
    .sort((a, b) => b.createdAt - a.createdAt);
}
