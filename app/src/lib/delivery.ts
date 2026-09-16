import type { Child, Parent, Settings, Story, VoiceProfile } from '../types';
import { id } from './ids';
import { audioStore } from './storage';
import { generateStory, narrationScript, type GenerateInput } from './story/generate';
import { llmAvailable } from './story/llm-available';
import { getProvider } from './voice';
import { notifyStoryReady } from './notifications';

/**
 * The pipeline a story runs through between "send" and a child pressing play.
 *
 * Deliberately fail-soft: if narration cannot be produced, the story is still
 * delivered as a readable book with the device narrator available. A child
 * getting *something* from their parent beats an error message at bedtime.
 */

export interface SendInput {
  parent: Parent;
  child: Child;
  voice?: VoiceProfile;
  settings: Settings;
  brief: Omit<GenerateInput, 'child' | 'parentName'>;
  /** Epoch ms. Defaults to the child's next bedtime. */
  scheduledFor?: number;
  /** Pre-recorded narration — the parent read it themselves. */
  recorded?: Blob;
  onProgress?: (stage: string) => void;
}

export async function composeStory(input: SendInput): Promise<Story> {
  const { parent, child, voice, settings, brief, recorded } = input;
  const report = input.onProgress ?? (() => undefined);

  report('Writing the story…');
  const generateInput: GenerateInput = { ...brief, child, parentName: parent.name };
  // The Anthropic SDK is a large dependency, so it is only pulled in when a
  // key is actually configured. Most installs never download it.
  const written = llmAvailable(settings)
    ? await import('./story/llm').then((m) => m.generateStoryWithLlm(generateInput, settings))
    : generateStory(generateInput);

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
    voiceProfileId: voice?.id,
    voiceProvider: recorded ? 'recorded' : voice?.status === 'ready' ? voice.provider : 'device',
    durationEstimate: written.durationEstimate,
    status: 'ready',
    scheduledFor: input.scheduledFor ?? nextBedtime(child),
    createdAt: Date.now(),
    playCount: 0,
  };

  if (recorded) {
    report('Saving your recording…');
    story.audioKey = await audioStore.put(id('aud'), recorded);
    return story;
  }

  if (voice?.status === 'ready') {
    const provider = getProvider(voice.provider);
    if (provider.synthesizeFile) {
      report('Recording it in your voice…');
      try {
        const blob = await provider.synthesizeFile({
          text: narrationScript(story),
          voice,
          settings,
          style: 'bedtime',
        });
        story.audioKey = await audioStore.put(id('aud'), blob);
      } catch (err) {
        // Keep the story. Downgrade the narration and say so honestly.
        story.voiceProvider = 'device';
        story.failureReason =
          err instanceof Error ? err.message : 'Narration could not be generated.';
      }
    }
  }

  return story;
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
