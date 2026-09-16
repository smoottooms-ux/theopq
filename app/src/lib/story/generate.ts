import type {
  Child,
  ComprehensionQuestion,
  Story,
  StoryLength,
  StoryPage,
  StoryTone,
  StoryTopic,
} from '../../types';
import { seeded } from '../ids';
import { heartfeltById, type HeartfeltId } from './heartfelt';
import { BEAT_ORDER, PACKS, type BeatKey, type TopicPack } from './packs';

export interface GenerateInput {
  child: Child;
  parentName: string;
  topic: StoryTopic;
  tone: StoryTone;
  length: StoryLength;
  personalNote?: string;
  heartfeltId?: HeartfeltId;
  /** Deterministic output for the same seed — handy for previews and tests. */
  seed?: string;
}

export interface GeneratedStory {
  title: string;
  pages: StoryPage[];
  comprehension: ComprehensionQuestion[];
  vocabulary: { word: string; meaning: string }[];
  durationEstimate: number;
}

/** Beats used at each length. Short stories keep the spine and drop the scenery. */
const LENGTH_BEATS: Record<StoryLength, BeatKey[]> = {
  short: ['call', 'trouble', 'helper', 'resolve', 'goodnight'],
  medium: ['call', 'journey', 'trouble', 'helper', 'turn', 'resolve', 'goodnight'],
  long: BEAT_ORDER,
};

/** Tone colour, dropped in as a single extra sentence on one mid-story beat. */
const TONE_LINES: Record<StoryTone, string[]> = {
  playful: [
    'Which, if you think about it, is a very odd way for a Tuesday to behave.',
    'Nobody had warned anybody about any of this, which seemed unfair.',
  ],
  gentle: [
    'There was no rush. There never really is.',
    'It was alright to go slowly. Slow was allowed.',
  ],
  epic: [
    'Years later, people would still tell this part wrong.',
    'It was the kind of moment that decides what the rest of a life looks like.',
  ],
  silly: [
    'Somewhere, inexplicably, a duck applauded.',
    'This would later be described, incorrectly, as "the sensible part".',
  ],
  sincere: [
    'I want you to hear this bit properly, so I am going to slow down.',
    'This is the part I think about when I think about you.',
  ],
};

/** Roughly 130 words a minute is a calm bedtime read. */
const WORDS_PER_MINUTE = 130;

export function generateStory(input: GenerateInput): GeneratedStory {
  if (input.topic === 'heartfelt') return generateHeartfelt(input);

  const pack = PACKS[input.topic as Exclude<StoryTopic, 'heartfelt'>];
  const rand = seeded(input.seed ?? `${input.child.id}:${input.topic}:${Date.now()}`);
  const pick = <T,>(arr: T[]): T => arr[Math.floor(rand() * arr.length)];

  const slots = {
    child: input.child.name,
    parent: input.parentName,
    friend: pick(pack.friends),
    place: pick(pack.places),
    thing: pick(pack.things),
  };

  const register: 'simple' | 'rich' = registerFor(input);
  const beats = LENGTH_BEATS[input.length];
  const toneBeatIndex = beats.length > 3 ? 1 + Math.floor(rand() * (beats.length - 3)) : -1;

  const pages: StoryPage[] = beats.map((key, i) => {
    const beat = pack.beats[key];
    const lines = beat[register].length ? beat[register] : beat.simple;
    let text = fill(pick(lines), slots);
    if (i === toneBeatIndex) text += ` ${pick(TONE_LINES[input.tone])}`;
    return { text, art: beat.art };
  });

  // The parent's own words open the story, in their own voice, before the tale.
  if (input.personalNote?.trim()) {
    pages.unshift({
      text: `${fill(pick(OPENERS), slots)} ${input.personalNote.trim()}`,
      art: 'note',
    });
  }

  const title = fill(pick(pack.titles), slots);
  const vocabulary = pickVocabulary(pack, input.child, rand);

  return {
    title,
    pages,
    comprehension: buildQuestions(pack, slots, pages, vocabulary, rand),
    vocabulary,
    durationEstimate: estimateDuration(pages),
  };
}

const OPENERS = [
  'Hey {child}, it is {parent}. Before the story, something just for you:',
  'Hi {child}. {parent} here. One thing first:',
  '{child}, it is me. Listen to this bit before we start:',
];

function registerFor(input: GenerateInput): 'simple' | 'rich' {
  const level = input.child.readingLevel;
  if (level === 'pre-reader' || level === 'early') return 'simple';
  if (input.tone === 'gentle' && level === 'growing') return 'simple';
  return 'rich';
}

function fill(template: string, slots: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (m, key: string) => slots[key] ?? m);
}

/**
 * Two or three words the story actually uses, so the vocabulary game is
 * reinforcing tonight's story rather than testing random dictionary entries.
 */
function pickVocabulary(pack: TopicPack, child: Child, rand: () => number) {
  const count = child.readingLevel === 'pre-reader' ? 2 : 3;
  const pool = [...pack.vocabulary];
  const out: typeof pack.vocabulary = [];
  while (out.length < count && pool.length) {
    out.push(pool.splice(Math.floor(rand() * pool.length), 1)[0]);
  }
  return out;
}

/**
 * Comprehension questions are built from the slot values that were actually
 * used, not from parsing the prose — so the marked answer is always right.
 */
function buildQuestions(
  pack: TopicPack,
  slots: Record<string, string>,
  pages: StoryPage[],
  vocabulary: { word: string; meaning: string }[],
  rand: () => number,
): ComprehensionQuestion[] {
  const questions: ComprehensionQuestion[] = [];

  questions.push(
    makeChoice(
      `Who helped ${slots.child} in the story?`,
      slots.friend,
      pack.friends.filter((f) => f !== slots.friend),
      pages.findIndex((p) => p.art === 'friend'),
      rand,
    ),
  );

  questions.push(
    makeChoice(
      'Where did the story happen?',
      slots.place,
      pack.places.filter((p) => p !== slots.place),
      0,
      rand,
    ),
  );

  questions.push(
    makeChoice(
      `What did ${slots.child} have with them?`,
      slots.thing,
      pack.things.filter((t) => t !== slots.thing),
      0,
      rand,
    ),
  );

  const word = vocabulary[0];
  if (word) {
    questions.push(
      makeChoice(
        `In the story, what does "${word.word}" mean?`,
        word.meaning,
        pack.vocabulary.filter((v) => v.word !== word.word).map((v) => v.meaning),
        0,
        rand,
      ),
    );
  }

  return questions.filter((q) => q.choices.length >= 2);
}

function makeChoice(
  q: string,
  answer: string,
  distractors: string[],
  page: number,
  rand: () => number,
): ComprehensionQuestion {
  const wrong = shuffle(distractors, rand).slice(0, 2);
  const choices = shuffle([answer, ...wrong], rand);
  return { q, choices, answer: choices.indexOf(answer), page: Math.max(0, page) };
}

function shuffle<T>(arr: T[], rand: () => number): T[] {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

function generateHeartfelt(input: GenerateInput): GeneratedStory {
  const template = heartfeltById(input.heartfeltId ?? 'cant-be-there');
  const note = input.personalNote?.trim();

  const slots = {
    child: input.child.name,
    parent: input.parentName,
    work: 'work',
  };

  const pages: StoryPage[] = template.pages
    .map((raw): StoryPage | null => {
      if (raw.includes('{note}')) {
        // Without the parent's own words the template page is an empty promise.
        if (!note) return null;
        return { text: note, art: 'note' };
      }
      return { text: fill(raw, slots), art: 'letter' };
    })
    .filter((p): p is StoryPage => p !== null);

  return {
    title: `${template.emoji} ${template.label}`,
    pages,
    comprehension: [],
    vocabulary: [],
    durationEstimate: estimateDuration(pages),
  };
}

export function estimateDuration(pages: StoryPage[]): number {
  const words = pages.reduce((n, p) => n + p.text.split(/\s+/).filter(Boolean).length, 0);
  // Add a beat of silence between pages; a read-aloud is not a race.
  return Math.round((words / WORDS_PER_MINUTE) * 60 + pages.length * 1.5);
}

/** The full narration script, including page breaks as natural pauses. */
export function narrationScript(story: Pick<Story, 'pages'>): string {
  return story.pages.map((p) => p.text).join('\n\n');
}
