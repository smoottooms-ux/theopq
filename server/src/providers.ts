import Anthropic from '@anthropic-ai/sdk';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import { z } from 'zod';

/**
 * Provider calls, held server-side.
 *
 * This file is the reason a customer never has to open an ElevenLabs account.
 * The operator supplies one set of credentials through the environment, and
 * every family's usage is metered against it by `entitlements.ts`.
 *
 * Required environment:
 *   ELEVENLABS_API_KEY   voice cloning and narration
 *   ANTHROPIC_API_KEY    bespoke story writing (optional — the app falls back
 *                        to its built-in story engine without it)
 */

const ELEVEN_API = 'https://api.elevenlabs.io/v1';

export const voiceCloningConfigured = (): boolean => !!process.env.ELEVENLABS_API_KEY;
export const storyWritingConfigured = (): boolean => !!process.env.ANTHROPIC_API_KEY;

function elevenKey(): string {
  const key = process.env.ELEVENLABS_API_KEY;
  if (!key) throw new ProviderError('Voice cloning is not configured on this server.', 503);
  return key;
}

export class ProviderError extends Error {
  constructor(
    message: string,
    readonly status = 502,
  ) {
    super(message);
  }
}

/* ---------------- voice ---------------- */

export interface EnrollSample {
  buffer: Buffer;
  contentType: string;
}

export async function enrollVoice(
  samples: EnrollSample[],
  label: string,
): Promise<{ voiceId: string }> {
  const form = new FormData();
  form.append('name', label);
  form.append(
    'description',
    'Bedtime narration voice, enrolled with recorded consent inside the Nightshift app.',
  );
  form.append('labels', JSON.stringify({ app: 'nightshift', use: 'bedtime-stories' }));

  samples.forEach((sample, i) => {
    form.append(
      'files',
      new Blob([new Uint8Array(sample.buffer)], { type: sample.contentType }),
      `sample-${i + 1}.${extensionFor(sample.contentType)}`,
    );
  });

  const res = await fetch(`${ELEVEN_API}/voices/add`, {
    method: 'POST',
    headers: { 'xi-api-key': elevenKey() },
    body: form,
  });
  if (!res.ok) throw await providerError(res, 'Voice enrollment failed');

  const data = (await res.json()) as { voice_id?: string };
  if (!data.voice_id) throw new ProviderError('The voice provider returned no voice id.');
  return { voiceId: data.voice_id };
}

export async function synthesize(
  text: string,
  voiceId: string,
  style: 'bedtime' | 'lullaby' | 'neutral' = 'bedtime',
): Promise<{ audio: Buffer; contentType: string }> {
  const settings =
    style === 'lullaby'
      ? { stability: 0.75, similarity_boost: 0.85, style: 0.05, use_speaker_boost: true }
      : style === 'bedtime'
        ? { stability: 0.62, similarity_boost: 0.85, style: 0.15, use_speaker_boost: true }
        : { stability: 0.45, similarity_boost: 0.8, style: 0.3, use_speaker_boost: true };

  const res = await fetch(`${ELEVEN_API}/text-to-speech/${voiceId}`, {
    method: 'POST',
    headers: {
      'xi-api-key': elevenKey(),
      'Content-Type': 'application/json',
      Accept: 'audio/mpeg',
    },
    body: JSON.stringify({ text, model_id: 'eleven_multilingual_v2', voice_settings: settings }),
  });
  if (!res.ok) throw await providerError(res, 'Narration failed');

  return { audio: Buffer.from(await res.arrayBuffer()), contentType: 'audio/mpeg' };
}

export async function deleteVoice(voiceId: string): Promise<void> {
  if (!process.env.ELEVENLABS_API_KEY) return;
  await fetch(`${ELEVEN_API}/voices/${voiceId}`, {
    method: 'DELETE',
    headers: { 'xi-api-key': process.env.ELEVENLABS_API_KEY },
  }).catch(() => undefined);
}

function extensionFor(mime: string): string {
  if (mime.includes('mp4')) return 'm4a';
  if (mime.includes('ogg')) return 'ogg';
  if (mime.includes('mpeg')) return 'mp3';
  if (mime.includes('wav')) return 'wav';
  return 'webm';
}

/** Provider failures become messages an operator can act on from the logs. */
async function providerError(res: Response, prefix: string): Promise<ProviderError> {
  let detail = '';
  try {
    const body = (await res.json()) as { detail?: { message?: string; status?: string } | string };
    detail =
      typeof body.detail === 'string'
        ? body.detail
        : (body.detail?.message ?? body.detail?.status ?? '');
  } catch {
    detail = await res.text().catch(() => '');
  }

  console.error(`[provider] ${prefix}: ${res.status} ${detail}`);

  // Never leak the operator's billing state to a customer's phone.
  if (res.status === 401 || res.status === 403) {
    return new ProviderError('Voice service is unavailable right now. Try again shortly.', 503);
  }
  if (res.status === 402 || /quota|credit/i.test(detail)) {
    return new ProviderError('Voice service is temporarily unavailable.', 503);
  }
  if (res.status === 429) {
    return new ProviderError('Busy right now — try again in a minute.', 429);
  }
  return new ProviderError(`${prefix}. Try again shortly.`, 502);
}

/* ---------------- story writing ---------------- */

const ART_KEYS = [
  'door', 'path', 'cliff', 'friend', 'bridge', 'summit', 'home', 'moon', 'meadow',
  'rain', 'listen', 'feast', 'rocket', 'launch', 'alarm', 'repair', 'planet', 'earth',
  'shore', 'dive', 'dark', 'free', 'whales', 'boat', 'egg', 'valley', 'storm',
  'crossing', 'hatch', 'town', 'walk', 'doubt', 'share', 'together', 'stage', 'night',
  'freeze', 'step', 'cheer', 'dusk', 'lamp', 'thought', 'soft', 'note', 'letter',
] as const;

const StorySchema = z.object({
  title: z.string(),
  pages: z.array(z.object({ text: z.string(), art: z.enum(ART_KEYS) })),
  comprehension: z.array(
    z.object({
      q: z.string(),
      choices: z.array(z.string()),
      answer: z.number(),
      page: z.number(),
    }),
  ),
  vocabulary: z.array(z.object({ word: z.string(), meaning: z.string() })),
  /**
   * Dialogic-reading prompts. The evidence base for shared reading says the
   * questions a grown-up asks mid-story matter as much as the story, so the
   * model writes them and the player asks them in the parent's voice.
   */
  talkPrompts: z.array(
    z.object({
      afterPage: z.number(),
      prompt: z.string(),
      kind: z.enum(['completion', 'recall', 'open', 'wh', 'distancing']),
    }),
  ),
});

export type WrittenStory = z.infer<typeof StorySchema>;

export interface StoryBrief {
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
  heartfelt?: { label: string };
}

export async function writeStory(brief: StoryBrief): Promise<WrittenStory | null> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return null;

  try {
    const client = new Anthropic({ apiKey });
    const response = await client.messages.parse({
      model: 'claude-opus-5',
      max_tokens: 16000,
      thinking: { type: 'adaptive' },
      output_config: { format: zodOutputFormat(StorySchema) },
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: renderBrief(brief) }],
    });

    if (response.stop_reason === 'refusal') return null;
    const parsed = response.parsed_output;
    if (!parsed?.pages?.length) return null;

    return {
      ...parsed,
      comprehension: parsed.comprehension.filter(
        (q) => q.choices.length >= 2 && q.answer >= 0 && q.answer < q.choices.length,
      ),
      talkPrompts: parsed.talkPrompts.filter(
        (p) => p.afterPage >= 0 && p.afterPage < parsed.pages.length,
      ),
    };
  } catch (err) {
    // Bedtime does not wait for an API. The client falls back to its own engine.
    console.error('[provider] story writing failed:', err);
    return null;
  }
}

const SYSTEM_PROMPT = `You write bedtime stories that a parent's own voice will read aloud to their child, usually because that parent is working a night shift and cannot be there.

Rules that matter:
- Write to be SPOKEN, not read. Short clauses. Natural breath points. Nothing the narrator cannot say out loud.
- One page = one paragraph of 2-5 sentences. The last page always ends the child's day: calm, safe, and explicitly goodnight.
- Never frighten. Tension is fine; peril, injury, death and cruelty are not.
- The child is the protagonist and solves the problem themselves, with help but not rescue.
- Never reference screens, apps, brands, or the fact that this is generated.
- Never imply the parent is absent because of anything the child did.
- Teach 2-3 real words the story genuinely uses, defined in language the child's level can hold.
- Comprehension questions must be answerable from the pages alone, with exactly one correct choice and plausible wrong ones. 'answer' is the 0-based index into 'choices'. 'page' is the 0-based page the answer lives on.
- Write 2-4 talkPrompts using the CROWD framework from dialogic reading. These are spoken aloud mid-story and the child answers out loud, so they must be short, warm, and genuinely open. Use the parent's voice and first person ("I wonder what you'd have done there?"). Spread them across the story and never put one on the final page.
- Match the requested reading level honestly: pre-reader means 5-8 word sentences and concrete nouns.`;

function renderBrief(brief: StoryBrief): string {
  const lines = [
    `Child's name: ${brief.childName}`,
    `Age: ${brief.age}`,
    `Reading level: ${brief.readingLevel}`,
    brief.interests.length ? `Loves: ${brief.interests.join(', ')}` : null,
    `Parent's name as the child says it: ${brief.parentName}`,
    `Tone: ${brief.tone}`,
    `Pages: ${brief.pages}`,
  ];

  if (brief.heartfelt) {
    lines.push(
      '',
      `This is NOT a story. It is a spoken message from ${brief.parentName} to ${brief.childName}: "${brief.heartfelt.label}".`,
      'Write it in first person as the parent. Plain, warm, direct. No fiction.',
      'Return empty comprehension, vocabulary and talkPrompts arrays.',
      brief.personalNote
        ? `Build it around the parent's own words, keeping their words intact somewhere in the middle: "${brief.personalNote}"`
        : 'The parent gave no specifics, so keep it honest and general rather than inventing details.',
    );
  } else {
    lines.push(
      '',
      `Topic: ${brief.topicLabel}`,
      brief.personalNote
        ? `Open page 1 with the parent speaking directly to the child, using these words: "${brief.personalNote}". Then begin the story on page 2.`
        : 'Begin with the story itself.',
    );
  }

  return lines.filter(Boolean).join('\n');
}
