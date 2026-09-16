import Anthropic from '@anthropic-ai/sdk';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import { z } from 'zod';
import type { Settings } from '../../types';
import type { GenerateInput, GeneratedStory } from './generate';
import { estimateDuration, generateStory } from './generate';
import { heartfeltById } from './heartfelt';
import { PACKS } from './packs';

/**
 * Optional upgrade path: write the story with Claude instead of the built-in
 * template engine.
 *
 * The app works without this. When an API key is present the stories get
 * genuinely bespoke — the child's real interests, this week's events, the
 * parent's own note woven through — and when anything goes wrong we fall
 * straight back to the offline generator rather than showing an error at
 * bedtime.
 */

const StorySchema = z.object({
  title: z.string(),
  pages: z.array(
    z.object({
      text: z.string(),
      art: z.enum([
        'door', 'path', 'cliff', 'friend', 'bridge', 'summit', 'home', 'moon',
        'meadow', 'rain', 'listen', 'feast', 'rocket', 'launch', 'alarm',
        'repair', 'planet', 'earth', 'shore', 'dive', 'dark', 'free', 'whales',
        'boat', 'egg', 'valley', 'storm', 'crossing', 'hatch', 'town', 'walk',
        'doubt', 'share', 'together', 'stage', 'night', 'freeze', 'step',
        'cheer', 'dusk', 'lamp', 'thought', 'soft', 'note', 'letter',
      ]),
    }),
  ),
  comprehension: z.array(
    z.object({
      q: z.string(),
      choices: z.array(z.string()),
      answer: z.number(),
      page: z.number(),
    }),
  ),
  vocabulary: z.array(z.object({ word: z.string(), meaning: z.string() })),
});

export async function generateStoryWithLlm(
  input: GenerateInput,
  settings: Settings,
): Promise<GeneratedStory> {
  const apiKey = settings.anthropicKey?.trim();
  if (!apiKey) return generateStory(input);

  try {
    const client = new Anthropic({ apiKey, dangerouslyAllowBrowser: true });

    const response = await client.messages.parse({
      model: 'claude-opus-5',
      max_tokens: 16000,
      thinking: { type: 'adaptive' },
      output_config: { format: zodOutputFormat(StorySchema) },
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: buildBrief(input) }],
    });

    if (response.stop_reason === 'refusal') return generateStory(input);

    const parsed = response.parsed_output;
    if (!parsed?.pages?.length) return generateStory(input);

    return {
      title: parsed.title,
      pages: parsed.pages,
      // Drop any question whose answer index does not point at a real choice.
      comprehension: parsed.comprehension.filter(
        (q) => q.choices.length >= 2 && q.answer >= 0 && q.answer < q.choices.length,
      ),
      vocabulary: parsed.vocabulary,
      durationEstimate: estimateDuration(parsed.pages),
    };
  } catch {
    // Bedtime does not wait for an API. Fall back silently.
    return generateStory(input);
  }
}

const SYSTEM_PROMPT = `You write bedtime stories that a parent's own voice will read aloud to their child, usually because that parent is working a night shift and cannot be there.

Rules that matter:
- Write to be SPOKEN, not read. Short clauses. Natural breath points. No text the narrator cannot say out loud.
- One page = one paragraph of 2-5 sentences. The last page always ends the child's day: calm, safe, and explicitly goodnight.
- Never frighten. Tension is fine; peril, injury, death, and cruelty are not.
- The child is the protagonist and solves the problem themselves, with help but not rescue.
- Never reference screens, apps, brands, or the fact that this is generated.
- Never imply the parent is absent because of anything the child did.
- Teach 2-3 real words the story genuinely uses, defined in language the child's level can hold.
- Comprehension questions must be answerable from the pages alone, with exactly one correct choice and plausible wrong ones. 'answer' is the 0-based index into 'choices'. 'page' is the 0-based page the answer lives on.
- Match the requested reading level honestly: pre-reader means 5-8 word sentences and concrete nouns.`;

function buildBrief(input: GenerateInput): string {
  const { child, parentName, topic, tone, length, personalNote, heartfeltId } = input;
  const pageTarget = length === 'short' ? '5' : length === 'medium' ? '7' : '9';

  const lines = [
    `Child's name: ${child.name}`,
    `Age: ${child.age}`,
    `Reading level: ${child.readingLevel}`,
    child.interests.length ? `Loves: ${child.interests.join(', ')}` : null,
    `Parent's name as the child says it: ${parentName}`,
    `Tone: ${tone}`,
    `Pages: ${pageTarget}`,
  ];

  if (topic === 'heartfelt') {
    const t = heartfeltById(heartfeltId ?? 'missed-tonight');
    lines.push(
      '',
      `This is NOT a story. It is a spoken message from ${parentName} to ${child.name}: "${t.label}".`,
      'Write it in first person as the parent. Plain, warm, direct. No fiction, no metaphor-heavy writing.',
      'Return an empty comprehension array and an empty vocabulary array.',
      personalNote
        ? `Build it around the parent's own words, and keep their words intact somewhere in the middle: "${personalNote}"`
        : 'The parent gave no specifics, so keep it honest and general rather than inventing details.',
    );
  } else {
    const pack = PACKS[topic];
    lines.push(
      '',
      `Topic: ${pack.label} — ${pack.blurb}`,
      personalNote
        ? `Open page 1 with the parent speaking directly to the child, using these words: "${personalNote}". Then begin the story on page 2.`
        : 'Begin with the story itself.',
    );
  }

  return lines.filter(Boolean).join('\n');
}
