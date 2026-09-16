import type { Child, Parent, Settings, Story, VoiceProfile } from '../types';
import { id } from './ids';
import { audioStore } from './storage';
import { generateStory, type GenerateInput } from './story/generate';
import { TOPIC_LIST } from './story/packs';
import { heartfeltById } from './story/heartfelt';
import { notifyStoryReady } from './notifications';
import {
  cacheRemoteAudio,
  composeStory as composeRemote,
  type CloudSession,
} from './cloud';

/**
 * The pipeline a story runs through between "send" and a child pressing play.
 *
 * When the family is connected, the server writes and narrates it against the
 * operator's provider accounts — the parent never supplies a key. Offline, or
 * if anything upstream fails, the on-device story engine produces the book and
 * the child's phone reads it aloud. Either way a story arrives tonight.
 */

export interface SendInput {
  parent: Parent;
  child: Child;
  voice?: VoiceProfile;
  settings: Settings;
  cloud?: CloudSession | null;
  brief: Omit<GenerateInput, 'child' | 'parentName'>;
  /** Epoch ms. Defaults to the child's next bedtime. */
  scheduledFor?: number;
  /** Pre-recorded narration — the parent read it themselves. */
  recorded?: Blob;
  onProgress?: (stage: string) => void;
}

export async function composeStory(input: SendInput): Promise<Story> {
  const { parent, child, voice, brief, recorded, cloud } = input;
  const report = input.onProgress ?? (() => undefined);

  report('Writing the story…');
  const written = generateStory({ ...brief, child, parentName: parent.name });

  const story: Story = {
    id: id('story'),
    familyId: child.familyId,
    fromParentId: parent.id,
    fromParentName: parent.name,
    toChildId: child.id,
    title: written.title,
    topic: brief.topic,
    tone: brief.tone,
    length: brief.length,
    pages: written.pages,
    personalNote: brief.personalNote,
    comprehension: written.comprehension,
    vocabulary: written.vocabulary,
    talkPrompts: [],
    voiceProfileId: voice?.id,
    voiceProvider: recorded ? 'recorded' : voice?.status === 'ready' ? 'managed' : 'device',
    durationEstimate: written.durationEstimate,
    status: 'ready',
    scheduledFor: input.scheduledFor ?? nextBedtime(child),
    createdAt: Date.now(),
    playCount: 0,
  };

  // The parent read it themselves: nothing to generate, nothing to spend.
  if (recorded) {
    report('Saving your recording…');
    story.audioKey = await audioStore.put(id('aud'), recorded);
    if (cloud) {
      await composeRemote(cloud, story, buildBrief(input, story), false).catch(() => undefined);
    }
    return story;
  }

  if (!cloud) {
    // Offline or self-hosted-without-a-server: the book still ships.
    story.voiceProvider = 'device';
    return story;
  }

  report(voice?.status === 'ready' ? 'Recording it in your voice…' : 'Sending…');
  try {
    const remote = await composeRemote(
      cloud,
      story,
      buildBrief(input, story),
      voice?.status === 'ready',
    );

    const merged: Story = {
      ...story,
      title: remote.title ?? story.title,
      pages: remote.pages?.length ? remote.pages : story.pages,
      comprehension: remote.comprehension ?? story.comprehension,
      vocabulary: remote.vocabulary ?? story.vocabulary,
      talkPrompts: remote.talkPrompts ?? [],
      voiceProvider: remote.voiceProvider ?? story.voiceProvider,
      failureReason: remote.narrationNote,
    };

    if (remote.audioUrl) {
      report('Downloading it for offline…');
      merged.audioKey = await cacheRemoteAudio(cloud, remote.audioUrl);
    }

    return merged;
  } catch (err) {
    // Quota and payment problems must surface; anything else degrades quietly.
    if ((err as Error & { upgrade?: boolean }).upgrade) throw err;
    story.voiceProvider = 'device';
    story.failureReason = err instanceof Error ? err.message : 'Could not reach the server.';
    return story;
  }
}

function buildBrief(input: SendInput, story: Story) {
  const topic = TOPIC_LIST.find((t) => t.id === input.brief.topic);
  const heartfelt =
    input.brief.topic === 'heartfelt'
      ? heartfeltById(input.brief.heartfeltId ?? 'missed-tonight')
      : undefined;

  return {
    childName: input.child.name,
    age: input.child.age,
    readingLevel: input.child.readingLevel,
    interests: input.child.interests,
    parentName: input.parent.name,
    topic: input.brief.topic,
    topicLabel: topic?.label ?? 'Adventure',
    tone: input.brief.tone,
    pages: story.pages.length,
    personalNote: input.brief.personalNote,
    heartfeltLabel: heartfelt?.label,
  };
}

export async function deliver(story: Story, child: Child): Promise<Story> {
  const delivered: Story = { ...story, status: 'delivered', deliveredAt: Date.now() };
  if (delivered.scheduledFor <= Date.now()) {
    await notifyStoryReady(delivered, child.name);
  }
  return delivered;
}

/** The next occurrence of the child's bedtime, today or tomorrow. */
export function nextBedtime(child: Child): number {
  const [hour, minute] = child.bedtime.split(':').map(Number);
  const when = new Date();
  when.setHours(hour, minute, 0, 0);
  if (when.getTime() <= Date.now()) when.setDate(when.getDate() + 1);
  return when.getTime();
}

export function describeSchedule(at: number): string {
  const when = new Date(at);
  const today = new Date();
  const tomorrow = new Date();
  tomorrow.setDate(today.getDate() + 1);

  const time = when.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  if (when.toDateString() === today.toDateString()) return `tonight at ${time}`;
  if (when.toDateString() === tomorrow.toDateString()) return `tomorrow at ${time}`;
  return `${when.toLocaleDateString([], { weekday: 'short', day: 'numeric', month: 'short' })} at ${time}`;
}
