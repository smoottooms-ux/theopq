import type { AppData, Child, SkillCard, SkillId, Story } from '../types';
import { buildRound } from '../lib/srs';
import {
  BLENDING_WORDS,
  GO_NO_GO_ROUNDS,
  MANIPULATION_ITEMS,
  OPPOSITE_ITEMS,
  PATTERNS,
  PHONICS_WORDS,
  RHYME_SETS,
  SIGHT_DISTRACTORS,
  SIGHT_WORDS,
  SORT_CARDS,
  makeDistractors,
} from '../data/words';

/**
 * The games.
 *
 * Design rule for everything in here: a round must be impossible to win by
 * tapping fast. Every question has one correct answer that requires reading,
 * sounding out, counting, or remembering. No timers that reward panic, no
 * points for noise, no loot boxes.
 */

export type QuestionKind = 'choice' | 'build' | 'numberline' | 'gonogo' | 'sort' | 'speak';

export interface Question {
  /** Spaced-repetition key for this specific item. */
  key: string;
  kind: QuestionKind;
  /** Big text shown above the answers. */
  prompt: string;
  /** Optional emoji/graphic hint. */
  visual?: string;
  /** Read aloud by the device when the question appears. */
  speak?: string;
  choices?: string[];
  answer: string;
  /** For 'build': the letter tiles offered, already shuffled. */
  tiles?: string[];
  /** For 'numberline': the range drawn. */
  range?: [number, number];
  /** Shown after a wrong answer. Teaching, not scolding. */
  explain?: string;
  /** A rule banner kept on screen — used where holding the rule IS the task. */
  rule?: string;
  /** For 'gonogo': the stream of stimuli and whether each should be tapped. */
  stimuli?: { emoji: string; go: boolean }[];
  /** For 'sort': the two bins and which one is correct under the current rule. */
  bins?: [string, string];
  /** For 'speak': nothing is graded; the answer goes to the parent. */
  openEnded?: boolean;
}

export interface GameDef {
  id: string;
  title: string;
  emoji: string;
  blurb: string;
  skill: SkillId;
  /** Questions per round. */
  size: number;
  build(ctx: BuildContext): { questions: Question[]; cards: SkillCard[] };
}

export interface BuildContext {
  child: Child;
  data: AppData;
  /** Tonight's story, when there is one — powers the recall game. */
  story?: Story;
}

const shuffle = <T,>(arr: T[]): T[] => {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
};

/* ---------------- Word Builder (phonics) ---------------- */

const wordBuilder: GameDef = {
  id: 'word-builder',
  title: 'Word Builder',
  emoji: '🔤',
  blurb: 'Hear the word, build it sound by sound.',
  skill: 'phonics',
  size: 8,
  build({ child, data }) {
    const cap = child.gameDifficulty === 1 ? 10 : child.gameDifficulty === 2 ? 16 : PHONICS_WORDS.length;
    const pool = PHONICS_WORDS.slice(0, cap).map((w) => ({ ...w, key: `phon:${w.word}` }));
    const { items, cards } = buildRound(pool, data.cards, 'phonics', wordBuilder.size);

    const questions = items.map((item): Question => {
      // Offer the real sounds plus two decoys, so it is never just "use them all".
      const decoyPool = ['b', 'k', 'm', 'r', 'sh', 'ee', 'oo', 'p', 'l', 'd'].filter(
        (s) => !item.sounds.includes(s),
      );
      const decoys = shuffle(decoyPool).slice(0, 2);
      return {
        key: item.key,
        kind: 'build',
        prompt: 'Build this word',
        visual: item.emoji,
        speak: item.word,
        answer: item.word,
        tiles: shuffle([...item.sounds, ...decoys]),
        explain: `${item.word} = ${item.sounds.join(' · ')}`,
      };
    });

    return { questions, cards };
  },
};

/* ---------------- Sight Word Sprint ---------------- */

const sightWords: GameDef = {
  id: 'sight-words',
  title: 'Sight Words',
  emoji: '👀',
  blurb: 'Words you have to know by sight, not by sounding out.',
  skill: 'sightWords',
  size: 10,
  build({ child, data }) {
    const band = child.gameDifficulty;
    const pool = [
      ...SIGHT_WORDS[1],
      ...(band >= 2 ? SIGHT_WORDS[2] : []),
      ...(band >= 3 ? SIGHT_WORDS[3] : []),
    ].map((word) => ({ key: `sight:${word}`, word }));

    const { items, cards } = buildRound(pool, data.cards, 'sightWords', sightWords.size);

    const questions = items.map((item): Question => {
      const wrong = (SIGHT_DISTRACTORS[item.word] ?? makeDistractors(item.word)).slice(0, 2);
      return {
        key: item.key,
        kind: 'choice',
        prompt: 'Which one is spelled right?',
        speak: item.word,
        answer: item.word,
        choices: shuffle([item.word, ...wrong]),
        explain: `It is "${item.word}".`,
      };
    });

    return { questions, cards };
  },
};

/* ---------------- Number Line ---------------- */

const numberLine: GameDef = {
  id: 'number-line',
  title: 'Number Jump',
  emoji: '🔢',
  blurb: 'Hop along the number line. Real number sense, not drills.',
  skill: 'numberSense',
  size: 10,
  build({ child, data }) {
    const max = child.gameDifficulty === 1 ? 10 : child.gameDifficulty === 2 ? 20 : 50;
    const pool: { key: string; a: number; b: number; op: '+' | '-' }[] = [];

    for (let a = 1; a <= max; a++) {
      for (let b = 1; b <= Math.min(a, child.gameDifficulty === 3 ? 12 : 6); b++) {
        if (a + b <= max) pool.push({ key: `num:${a}+${b}`, a, b, op: '+' });
        if (a - b >= 0) pool.push({ key: `num:${a}-${b}`, a, b, op: '-' });
      }
    }

    const { items, cards } = buildRound(shuffle(pool), data.cards, 'numberSense', numberLine.size);

    const questions = items.map((item): Question => {
      const result = item.op === '+' ? item.a + item.b : item.a - item.b;
      return {
        key: item.key,
        kind: 'numberline',
        prompt: `${item.a} ${item.op} ${item.b} = ?`,
        speak: `What is ${item.a} ${item.op === '+' ? 'plus' : 'minus'} ${item.b}?`,
        answer: String(result),
        range: [0, max],
        explain:
          item.op === '+'
            ? `Start at ${item.a} and hop ${item.b} forward — you land on ${result}.`
            : `Start at ${item.a} and hop ${item.b} back — you land on ${result}.`,
      };
    });

    return { questions, cards };
  },
};

/* ---------------- Story Recall ---------------- */

const storyRecall: GameDef = {
  id: 'story-recall',
  title: 'Story Detective',
  emoji: '🔍',
  blurb: "Questions about tonight's story. Listen carefully first!",
  skill: 'comprehension',
  size: 6,
  build({ story }) {
    if (!story || story.comprehension.length === 0) return { questions: [], cards: [] };

    const questions: Question[] = story.comprehension.map((q, i) => ({
      key: `recall:${story.id}:${i}`,
      kind: 'choice',
      prompt: q.q,
      answer: q.choices[q.answer],
      choices: shuffle(q.choices),
      explain: `Look again at page ${q.page + 1}.`,
    }));

    const vocab: Question[] = story.vocabulary.map((v) => ({
      key: `vocab:${story.id}:${v.word}`,
      kind: 'choice',
      prompt: `What does "${v.word}" mean?`,
      speak: v.word,
      answer: v.meaning,
      choices: shuffle([
        v.meaning,
        ...story.vocabulary.filter((o) => o.word !== v.word).map((o) => o.meaning),
        'a kind of loud noise',
      ]).slice(0, 3),
      explain: `${v.word} means ${v.meaning}.`,
    }));

    // Vocabulary answers must still contain the right one after slicing.
    const safeVocab = vocab.filter((q) => q.choices?.includes(q.answer));

    return { questions: [...questions, ...safeVocab].slice(0, storyRecall.size), cards: [] };
  },
};

/* ---------------- Pattern Logic ---------------- */

const patternLogic: GameDef = {
  id: 'patterns',
  title: 'What Comes Next',
  emoji: '🧩',
  blurb: 'Spot the rule, then finish the pattern.',
  skill: 'patterns',
  size: 8,
  build({ child, data }) {
    const pool = PATTERNS.filter((p) => p.level <= child.gameDifficulty);
    const { items, cards } = buildRound(pool, data.cards, 'patterns', patternLogic.size);

    const questions = items.map((item): Question => ({
      key: item.key,
      kind: 'choice',
      prompt: 'What comes next?',
      visual: item.sequence.join('  '),
      answer: item.answer,
      choices: shuffle(item.options),
      explain: 'Say the pattern out loud — it helps you hear the rule.',
    }));

    return { questions, cards };
  },
};

/* ---------------- Sound Detective (phoneme blending) ---------------- */

/**
 * The child hears a word broken into sounds and says what it is.
 *
 * Blending and segmenting phonemes predict later reading better than anything
 * else measured here, which is why this game sits at the top of the list.
 */
const soundDetective: GameDef = {
  id: 'sound-detective',
  title: 'Sound Detective',
  emoji: '🕵️',
  blurb: 'Hear the sounds. Work out the word.',
  skill: 'blending',
  size: 8,
  build({ child, data }) {
    const pool = BLENDING_WORDS.filter((w) => w.level <= child.gameDifficulty);
    const { items, cards } = buildRound(pool, data.cards, 'blending', soundDetective.size);

    const questions = items.map((item): Question => {
      const wrong = shuffle(
        BLENDING_WORDS.filter((w) => w.word !== item.word).map((w) => w.word),
      ).slice(0, 2);
      return {
        key: item.key,
        kind: 'choice',
        prompt: 'What word is this?',
        // Spoken with gaps so the sounds stay separate.
        speak: item.sounds.join(' ... '),
        visual: item.sounds.join(' · '),
        answer: item.word,
        choices: shuffle([item.word, ...wrong]),
        explain: `${item.sounds.join(' ')} makes "${item.word}".`,
      };
    });

    return { questions, cards };
  },
};

/* ---------------- Sound Swap (phoneme manipulation) ---------------- */

/**
 * Deleting or changing a sound inside a word — the hardest phonological skill
 * in this app, and the one most tightly linked to decoding.
 */
const soundSwap: GameDef = {
  id: 'sound-swap',
  title: 'Sound Swap',
  emoji: '🔄',
  blurb: 'Take a sound out. What word is left?',
  skill: 'manipulation',
  size: 8,
  build({ child, data }) {
    const pool = MANIPULATION_ITEMS.filter((i) => i.level <= child.gameDifficulty);
    const { items, cards } = buildRound(pool, data.cards, 'manipulation', soundSwap.size);

    const questions = items.map((item): Question => ({
      key: item.key,
      kind: 'choice',
      prompt: item.instruction,
      speak: item.instruction.replace(/\//g, ''),
      answer: item.answer,
      choices: shuffle([item.answer, ...item.distractors]),
      explain: `It leaves "${item.answer}".`,
    }));

    return { questions, cards };
  },
};

/* ---------------- Rhyme Time ---------------- */

const rhymeTime: GameDef = {
  id: 'rhyme-time',
  title: 'Rhyme Time',
  emoji: '🎶',
  blurb: 'Find the word that sounds the same at the end.',
  skill: 'rhyme',
  size: 8,
  build({ child, data }) {
    const pool = RHYME_SETS.filter((r) => r.level <= child.gameDifficulty);
    const { items, cards } = buildRound(pool, data.cards, 'rhyme', rhymeTime.size);

    const questions = items.map((item): Question => ({
      key: item.key,
      kind: 'choice',
      prompt: `Which word rhymes with "${item.word}"?`,
      visual: item.emoji,
      speak: item.word,
      answer: item.rhyme,
      choices: shuffle([item.rhyme, ...item.others]),
      explain: `"${item.word}" and "${item.rhyme}" end the same way.`,
    }));

    return { questions, cards };
  },
};

/* ---------------- Freeze! (inhibitory control) ---------------- */

/**
 * Go/No-Go. The child taps everything in one category and must hold still for
 * the exception. Inhibitory control of this kind predicts school readiness and
 * feeds into early maths and letter knowledge, so it is worth its own game.
 */
const freeze: GameDef = {
  id: 'freeze',
  title: 'Freeze!',
  emoji: '✋',
  blurb: 'Tap fast — but stop yourself on the odd one out.',
  skill: 'focus',
  size: 3,
  build({ child, data }) {
    const pool = GO_NO_GO_ROUNDS.filter((r) => r.level <= child.gameDifficulty);
    const { items, cards } = buildRound(pool, data.cards, 'focus', Math.min(pool.length, 3));

    const questions = items.map((item): Question => ({
      key: item.key,
      kind: 'gonogo',
      prompt: item.rule,
      rule: item.rule,
      stimuli: item.stimuli,
      answer: 'complete',
      explain: 'Slow down on the ones you are not meant to tap. Stopping is the skill.',
    }));

    return { questions, cards };
  },
};

/* ---------------- Opposite Day (conflict) ---------------- */

/** A day/night Stroop task: the obvious answer is always the wrong one. */
const oppositeDay: GameDef = {
  id: 'opposite-day',
  title: 'Opposite Day',
  emoji: '🙃',
  blurb: 'Say the opposite of what you see. Harder than it sounds.',
  skill: 'focus',
  size: 10,
  build({ child, data }) {
    const pool = OPPOSITE_ITEMS.filter((i) => i.level <= child.gameDifficulty);
    const { items, cards } = buildRound(pool, data.cards, 'focus', oppositeDay.size);

    const questions = items.map((item): Question => ({
      key: item.key,
      kind: 'choice',
      prompt: 'Pick the OPPOSITE',
      rule: 'Everything means its opposite today.',
      visual: item.show,
      answer: item.answer,
      choices: item.options,
      explain: `The opposite is "${item.answer}".`,
    }));

    return { questions, cards };
  },
};

/* ---------------- Sort It Twice (cognitive flexibility) ---------------- */

/**
 * A card sort where the rule flips halfway through. Switching an established
 * rule is the standard measure of cognitive flexibility in young children,
 * and it is genuinely hard — the mid-round switch is the whole point.
 */
const sortItTwice: GameDef = {
  id: 'sort-it-twice',
  title: 'Sort It Twice',
  emoji: '🗂️',
  blurb: 'Sort by colour. Then the rule changes.',
  skill: 'flexibility',
  size: 10,
  build({ child, data }) {
    const { items, cards } = buildRound(
      SORT_CARDS,
      data.cards,
      'flexibility',
      Math.min(sortItTwice.size, SORT_CARDS.length),
    );

    const half = Math.ceil(items.length / 2);
    // Easier settings get a longer run on the first rule before the switch.
    const switchAt = child.gameDifficulty === 1 ? Math.max(half, items.length - 3) : half;

    const questions = items.map((item, i): Question => {
      const byColour = i < switchAt;
      return {
        key: `${item.key}:${byColour ? 'colour' : 'shape'}`,
        kind: 'sort',
        prompt: byColour ? 'Sort by COLOUR' : 'Now sort by SHAPE',
        rule: byColour ? 'Colour game' : 'Shape game — the rule changed!',
        visual: item.emoji,
        bins: byColour ? ['Red', 'Not red'] : ['Round', 'Pointy'],
        answer: byColour
          ? item.colour === 'red'
            ? 'Red'
            : 'Not red'
          : item.shape === 'round'
            ? 'Round'
            : 'Pointy',
        explain: byColour
          ? 'Look at the colour, not the shape.'
          : 'The rule changed — shape now, not colour.',
      };
    });

    return { questions, cards };
  },
};

/* ---------------- Story Talk (dialogic reading) ---------------- */

/**
 * The flagship, and the one with the deepest evidence behind it.
 *
 * Shared reading builds language most when the grown-up asks open questions
 * and the child answers out loud. The parent cannot be there to ask, so the
 * story asks in their voice and the child's answer is recorded and sent back
 * to them. Nothing is graded — being asked and answering is the intervention.
 */
const storyTalk: GameDef = {
  id: 'story-talk',
  title: 'Story Talk',
  emoji: '💬',
  blurb: "Questions from tonight's story. Say your answer out loud.",
  skill: 'talk',
  size: 4,
  build({ story }) {
    const prompts = story?.talkPrompts ?? [];
    if (!story || prompts.length === 0) return { questions: [], cards: [] };

    const questions = prompts.slice(0, storyTalk.size).map(
      (prompt, i): Question => ({
        key: `talk:${story.id}:${i}`,
        kind: 'speak',
        prompt: prompt.prompt,
        speak: prompt.prompt,
        answer: '',
        openEnded: true,
      }),
    );

    return { questions, cards: [] };
  },
};

export const GAMES: GameDef[] = [
  soundDetective,
  soundSwap,
  rhymeTime,
  wordBuilder,
  sightWords,
  numberLine,
  patternLogic,
  freeze,
  oppositeDay,
  sortItTwice,
  storyRecall,
  storyTalk,
];

export function gameById(id: string): GameDef | undefined {
  return GAMES.find((g) => g.id === id);
}
