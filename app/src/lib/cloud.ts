import type { Child, ChildReply, Story } from '../types';
import { audioStore } from './storage';
import { id } from './ids';
import { API_URL } from './config';

/**
 * Talks to the Nightshift sync server.
 *
 * This is what makes "the same app" true across two devices: a parent in a
 * truck stop pushes the story, the child's tablet pulls it. When no server is
 * configured every call short-circuits and the app stays fully local, so
 * offline is the default rather than a failure mode.
 */

export interface CloudSession {
  serverUrl: string;
  token: string;
  role: 'parent' | 'child';
  subjectId: string;
  joinCode?: string;
}

const SESSION_KEY = 'nightshift.cloud.v1';

export function loadCloudSession(): CloudSession | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    return raw ? (JSON.parse(raw) as CloudSession) : null;
  } catch {
    return null;
  }
}

export function saveCloudSession(session: CloudSession | null): void {
  try {
    if (session) localStorage.setItem(SESSION_KEY, JSON.stringify(session));
    else localStorage.removeItem(SESSION_KEY);
  } catch {
    /* private browsing; sync simply stays off */
  }
}

/** The hosted server wins; a self-hosted URL is only used when one is set. */
function base(serverUrl: string): string {
  return (serverUrl || API_URL).replace(/\/+$/, '');
}

export function defaultServerUrl(): string {
  return API_URL;
}

async function request<T>(
  session: Pick<CloudSession, 'serverUrl' | 'token'>,
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const res = await fetch(base(session.serverUrl) + path, {
    ...init,
    headers: {
      ...(init.headers ?? {}),
      Authorization: `Bearer ${session.token}`,
    },
  });

  if (res.status === 401) throw new CloudAuthError('Your sync session expired. Sign in again.');
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string; upgrade?: boolean };
    const error = new Error(body.error ?? `Server returned ${res.status}.`);
    // 402 means the family is out of quota; the UI offers an upgrade rather
    // than showing a dead end.
    if (body.upgrade || res.status === 402) (error as Error & { upgrade?: boolean }).upgrade = true;
    throw error;
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

export class CloudAuthError extends Error {}

/* ---------------- connecting ---------------- */

export async function checkServer(serverUrl: string): Promise<boolean> {
  try {
    const res = await fetch(`${base(serverUrl)}/health`);
    return res.ok;
  } catch {
    return false;
  }
}

export interface EntitlementView {
  plan: string;
  planLabel: string;
  blurb: string;
  status: 'active' | 'past_due' | 'canceled' | 'expired';
  renewsAt: number;
  narration: { used: number; limit: number };
  stories: { used: number; limit: number };
  voices: { used: number; limit: number };
}

export interface AccountView {
  entitlement: EntitlementView;
  capabilities: { voiceCloning: boolean; bespokeStories: boolean };
}

export async function cloudSignUp(
  serverUrl: string,
  input: { name: string; email: string; pin: string },
): Promise<{ session: CloudSession; joinCode: string }> {
  const res = await fetch(`${base(serverUrl)}/auth/signup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  const body = (await res.json()) as {
    token?: string;
    error?: string;
    parent?: { id: string };
    family?: { join_code: string };
  };
  if (!res.ok || !body.token) throw new Error(body.error ?? 'Could not create that account.');

  const session: CloudSession = {
    serverUrl: base(serverUrl),
    token: body.token,
    role: 'parent',
    subjectId: body.parent!.id,
    joinCode: body.family!.join_code,
  };
  saveCloudSession(session);
  return { session, joinCode: body.family!.join_code };
}

export async function cloudSignIn(
  serverUrl: string,
  email: string,
  pin: string,
): Promise<{ session: CloudSession; joinCode: string }> {
  const res = await fetch(`${base(serverUrl)}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, pin }),
  });
  const body = (await res.json()) as {
    token?: string;
    error?: string;
    parent?: { id: string };
    family?: { join_code: string };
  };
  if (!res.ok || !body.token) throw new Error(body.error ?? 'Email or PIN is wrong.');

  const session: CloudSession = {
    serverUrl: base(serverUrl),
    token: body.token,
    role: 'parent',
    subjectId: body.parent!.id,
    joinCode: body.family!.join_code,
  };
  saveCloudSession(session);
  return { session, joinCode: body.family!.join_code };
}

/** A child pairing their own device using the family code and their PIN. */
export async function cloudChildSignIn(
  serverUrl: string,
  joinCode: string,
  childName: string,
  pin: string,
): Promise<{ session: CloudSession; child: Child }> {
  const res = await fetch(`${base(serverUrl)}/auth/child`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ joinCode, childName, pin }),
  });
  const body = (await res.json()) as { token?: string; error?: string; child?: Child };
  if (!res.ok || !body.token) throw new Error(body.error ?? 'That code is not right.');

  const session: CloudSession = {
    serverUrl: base(serverUrl),
    token: body.token,
    role: 'child',
    subjectId: body.child!.id,
    joinCode,
  };
  saveCloudSession(session);
  return { session, child: body.child! };
}

/* ---------------- pushing ---------------- */

export async function pushChild(
  session: CloudSession,
  child: Child,
  pin: string,
): Promise<void> {
  await request(session, '/children', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...child, pin }),
  });
}

export async function pushStory(session: CloudSession, story: Story): Promise<void> {
  // The audio key is device-local and meaningless to another device.
  const { audioKey: _audioKey, ...portable } = story;
  await request(session, '/stories', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ story: portable }),
  });

  if (story.audioKey) {
    const blob = await audioStore.get(story.audioKey);
    if (blob) {
      await request(session, `/stories/${story.id}/audio`, {
        method: 'POST',
        headers: { 'Content-Type': blob.type || 'audio/webm' },
        body: blob,
      });
    }
  }
}

export async function pushReply(
  session: CloudSession,
  reply: ChildReply,
  blob: Blob,
): Promise<void> {
  await request(
    session,
    `/replies?storyId=${encodeURIComponent(reply.storyId)}&duration=${reply.duration}`,
    {
      method: 'POST',
      headers: { 'Content-Type': blob.type || 'audio/webm' },
      body: blob,
    },
  );
}

export async function markPlayedRemote(session: CloudSession, storyId: string): Promise<void> {
  await request(session, `/stories/${storyId}/played`, { method: 'POST' });
}

export async function markReplyHeard(session: CloudSession, replyId: string): Promise<void> {
  await request(session, `/replies/${replyId}/heard`, { method: 'POST' });
}

/* ---------------- pulling ---------------- */

type RemoteStory = Story & { audioUrl: string | null };

/**
 * Pulls stories and downloads any narration into the local blob store, so the
 * child can play tonight's story on the school run with no signal.
 */
export async function pullStories(
  session: CloudSession,
  known: Story[],
): Promise<Story[]> {
  const remote = await request<RemoteStory[]>(session, '/stories');
  const byId = new Map(known.map((s) => [s.id, s]));
  const out: Story[] = [];

  for (const item of remote) {
    const { audioUrl, ...story } = item;
    const existing = byId.get(story.id);

    // A local copy that already has audio does not need downloading again.
    let audioKey = existing?.audioKey;
    if (audioUrl && !audioKey) {
      try {
        const res = await fetch(base(session.serverUrl) + audioUrl, {
          headers: { Authorization: `Bearer ${session.token}` },
        });
        if (res.ok) audioKey = await audioStore.put(id('aud'), await res.blob());
      } catch {
        // No signal right now. The story still arrives as a readable book.
      }
    }

    out.push({ ...(story as Story), audioKey });
  }

  // Anything only on this device (drafts, unsent) survives the merge.
  const remoteIds = new Set(out.map((s) => s.id));
  return [...out, ...known.filter((s) => !remoteIds.has(s.id))].sort(
    (a, b) => b.createdAt - a.createdAt,
  );
}

type RemoteReply = ChildReply & { audioUrl: string };

export async function pullReplies(
  session: CloudSession,
  known: ChildReply[],
): Promise<ChildReply[]> {
  const remote = await request<RemoteReply[]>(session, '/replies');
  const byId = new Map(known.map((r) => [r.id, r]));
  const out: ChildReply[] = [];

  for (const item of remote) {
    const { audioUrl, ...reply } = item;
    let audioKey = byId.get(reply.id)?.audioKey;

    if (!audioKey) {
      try {
        const res = await fetch(base(session.serverUrl) + audioUrl, {
          headers: { Authorization: `Bearer ${session.token}` },
        });
        if (res.ok) audioKey = await audioStore.put(id('aud'), await res.blob());
      } catch {
        continue; // Skip until there is signal; it will arrive on the next sync.
      }
    }

    if (audioKey) out.push({ ...(reply as ChildReply), audioKey });
  }

  return out.sort((a, b) => b.createdAt - a.createdAt);
}

export async function pullChildren(session: CloudSession): Promise<Child[]> {
  return request<Child[]>(session, '/children');
}

/* ---------------- managed voice, stories and lullabies ---------------- */

export async function fetchAccount(session: CloudSession): Promise<AccountView> {
  return request<AccountView>(session, '/account');
}

export interface ManagedVoice {
  id: string;
  parentId: string;
  status: 'processing' | 'ready' | 'failed';
  sampleCount: number;
  failureReason?: string;
  updatedAt: number;
}

export async function fetchVoices(session: CloudSession): Promise<ManagedVoice[]> {
  return request<ManagedVoice[]>(session, '/voices');
}

/** Uploads one enrollment take. Returns the id to pass to `enrollVoice`. */
export async function uploadVoiceSample(
  session: CloudSession,
  promptId: string,
  blob: Blob,
): Promise<string> {
  const { sampleId } = await request<{ sampleId: string }>(
    session,
    `/voice/samples?promptId=${encodeURIComponent(promptId)}`,
    { method: 'POST', headers: { 'Content-Type': blob.type || 'audio/webm' }, body: blob },
  );
  return sampleId;
}

export async function enrollVoice(
  session: CloudSession,
  sampleIds: string[],
  parentName: string,
  consentName: string,
): Promise<ManagedVoice> {
  return request<ManagedVoice>(session, '/voice/enroll', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sampleIds, parentName, consentName }),
  });
}

export async function previewVoice(session: CloudSession, text: string): Promise<Blob> {
  const res = await fetch(`${base(session.serverUrl)}/voice/preview`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${session.token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ text }),
  });
  if (!res.ok) throw await asError(res);
  return res.blob();
}

export async function deleteManagedVoice(session: CloudSession): Promise<void> {
  await request(session, '/voice', { method: 'DELETE' });
}

export interface ComposeBrief {
  childName: string;
  age: number;
  readingLevel: string;
  interests: string[];
  parentName: string;
  topic: string;
  topicLabel: string;
  tone: string;
  pages: number;
  personalNote?: string;
  heartfeltLabel?: string;
}

/**
 * Sends the brief plus a locally-written fallback. The server upgrades the
 * text if it can and narrates it in the parent's voice; if anything upstream
 * fails, the fallback is what ships.
 */
export async function composeStory(
  session: CloudSession,
  story: Story,
  brief: ComposeBrief,
  narrate: boolean,
): Promise<Story & { audioUrl: string | null; narrationNote?: string }> {
  const { audioKey: _audioKey, ...portable } = story;
  return request(session, '/stories/compose', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ story: portable, brief, narrate }),
  });
}

export async function narrateLullaby(
  session: CloudSession,
  lullabyId: string,
  text: string,
): Promise<Blob> {
  const res = await fetch(`${base(session.serverUrl)}/lullabies/narrate`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${session.token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ lullabyId, text }),
  });
  if (!res.ok) throw await asError(res);
  return res.blob();
}

/** Downloads server-held audio into the local store so it plays offline. */
export async function cacheRemoteAudio(
  session: CloudSession,
  path: string,
): Promise<string | undefined> {
  try {
    const res = await fetch(base(session.serverUrl) + path, {
      headers: { Authorization: `Bearer ${session.token}` },
    });
    if (!res.ok) return undefined;
    return audioStore.put(id('aud'), await res.blob());
  } catch {
    return undefined;
  }
}

/* ---------------- the family journal ---------------- */

export interface ActivityEntry {
  id: string;
  actorName?: string;
  kind: string;
  subjectId?: string;
  summary: string;
  detail?: Record<string, unknown>;
  createdAt: number;
}

export async function fetchActivity(
  session: CloudSession,
  before?: number,
): Promise<ActivityEntry[]> {
  const query = before ? `?before=${before}` : '';
  return request<ActivityEntry[]>(session, `/activity${query}`);
}

export async function logRemoteActivity(
  session: CloudSession,
  entry: { kind: string; summary: string; subjectId?: string; actorName?: string; detail?: unknown },
): Promise<void> {
  await request(session, '/activity', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(entry),
  }).catch(() => undefined);
}

/* ---------------- billing ---------------- */

export interface PlanOption {
  id: string;
  label: string;
  price: number;
  period: string;
  blurb: string;
  available: boolean;
}

export async function fetchPlans(
  serverUrl: string,
): Promise<{ checkoutAvailable: boolean; plans: PlanOption[] }> {
  const res = await fetch(`${base(serverUrl)}/billing/plans`);
  if (!res.ok) throw new Error('Could not load plans.');
  return res.json() as Promise<{ checkoutAvailable: boolean; plans: PlanOption[] }>;
}

export async function startCheckout(session: CloudSession, plan: string): Promise<string> {
  const { url } = await request<{ url: string }>(session, '/billing/checkout', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ plan }),
  });
  return url;
}

/** Shared error shaping for the endpoints that return audio rather than JSON. */
async function asError(res: Response): Promise<Error> {
  if (res.status === 401) return new CloudAuthError('Your session expired. Sign in again.');
  const body = (await res.json().catch(() => ({}))) as { error?: string; upgrade?: boolean };
  const error = new Error(body.error ?? `Server returned ${res.status}.`);
  if (body.upgrade) (error as Error & { upgrade?: boolean }).upgrade = true;
  return error;
}
