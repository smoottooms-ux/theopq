import type { AppData, Child, SkillCard, SkillId, Story } from '../types';
import { buildRound } from '../lib/srs';
import {
  PATTERNS,
  PHONICS_WORDS,
  SIGHT_DISTRACTORS,
  SIGHT_WORDS,
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

export type QuestionKind = 'choice' | 'build' | 'numberline';

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

export const GAMES: GameDef[] = [wordBuilder, sightWords, numberLine, storyRecall, patternLogic];

export function gameById(id: string): GameDef | undefined {
  return GAMES.find((g) => g.id === id);
}
