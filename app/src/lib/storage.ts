import { Preferences } from '@capacitor/preferences';
import type { AppData, Session } from '../types';

const DATA_KEY = 'nightshift.data.v1';
const SESSION_KEY = 'nightshift.session.v1';

export const emptyData = (): AppData => ({
  parents: [],
  children: [],
  voices: [],
  stories: [],
  lullabies: [],
  replies: [],
  cards: [],
  sessions: [],
  journal: [],
  settings: {
    dailyGameMinutes: 30,
    storyBeforeGames: false,
    notificationsEnabled: true,
  },
  version: 1,
});

export async function loadData(): Promise<AppData> {
  const { value } = await Preferences.get({ key: DATA_KEY });
  if (!value) return emptyData();
  try {
    return { ...emptyData(), ...(JSON.parse(value) as AppData) };
  } catch {
    // A corrupt blob should never brick the app; start clean instead.
    return emptyData();
  }
}

export async function saveData(data: AppData): Promise<void> {
  await Preferences.set({ key: DATA_KEY, value: JSON.stringify(data) });
}

export async function loadSession(): Promise<Session | null> {
  const { value } = await Preferences.get({ key: SESSION_KEY });
  if (!value) return null;
  try {
    return JSON.parse(value) as Session;
  } catch {
    return null;
  }
}

export async function saveSession(session: Session | null): Promise<void> {
  if (!session) await Preferences.remove({ key: SESSION_KEY });
  else await Preferences.set({ key: SESSION_KEY, value: JSON.stringify(session) });
}

/* ------------------------------------------------------------------
   Audio blobs live in IndexedDB rather than Preferences: recordings and
   generated narration are megabytes, and Preferences is a key/value
   store meant for small strings.
   ------------------------------------------------------------------ */

const DB_NAME = 'nightshift-audio';
const STORE = 'blobs';

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(STORE)) req.result.createObjectStore(STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function tx<T>(mode: IDBTransactionMode, fn: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return openDb().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const request = fn(db.transaction(STORE, mode).objectStore(STORE));
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      }),
  );
}

export const audioStore = {
  put: (key: string, blob: Blob) => tx('readwrite', (s) => s.put(blob, key)).then(() => key),
  get: (key: string) => tx<Blob | undefined>('readonly', (s) => s.get(key)),
  remove: (key: string) => tx('readwrite', (s) => s.delete(key)).then(() => undefined),
  keys: () => tx<IDBValidKey[]>('readonly', (s) => s.getAllKeys()),
};

/** Object URLs are revoked on release so long sessions do not leak memory. */
const urlCache = new Map<string, string>();

export async function audioUrl(key: string): Promise<string | null> {
  const cached = urlCache.get(key);
  if (cached) return cached;
  const blob = await audioStore.get(key);
  if (!blob) return null;
  const url = URL.createObjectURL(blob);
  urlCache.set(key, url);
  return url;
}

export function releaseAudioUrl(key: string): void {
  const url = urlCache.get(key);
  if (url) {
    URL.revokeObjectURL(url);
    urlCache.delete(key);
  }
}
