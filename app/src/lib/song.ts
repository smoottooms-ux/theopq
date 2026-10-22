import type { ReadAlongScript, WordTiming } from './readalong';

/**
 * Musical timing for songs.
 *
 * A speech engine reads a lyric as prose. It rattles "A B C D E F G" out in
 * under a second because those are seven short tokens, then slows right down
 * for "Now I know my A B C." — so a parent trying to sing along gets words
 * flung at them, then a crawl, then a sprint. Driving the highlight from the
 * engine's own word events faithfully reproduces that mess.
 *
 * A song is not prose. It has a meter: each line of the lyric is a phrase of
 * the tune, and within a phrase the words land on beats. This builds that
 * grid, so the highlight becomes the metronome and the voice is paced to
 * follow it rather than the other way round.
 *
 * The unit is the syllable, because that is what a note carries. "W" in the
 * alphabet song is three syllables — dou-ble-u — and takes three times the
 * room of "X", which is exactly how it is sung.
 */

/** Letter names, in syllables. Only W is longer than one. */
const LETTER_SYLLABLES: Record<string, number> = { w: 3 };

const VOWEL_GROUPS = /[aeiouy]+/g;

/**
 * Syllables in a word, by heuristic.
 *
 * Counting vowel groups is right far more often than it is wrong, and the
 * failure mode here is a word being a beat long or short — not a crash. The
 * adjustments below are the cases common enough in nursery rhymes to matter.
 */
export function syllablesIn(word: string): number {
  const clean = word.toLowerCase().replace(/[^a-z']/g, '');
  if (!clean) return 1;

  // Single letters are sung by name.
  if (clean.length === 1) return LETTER_SYLLABLES[clean] ?? 1;

  let count = (clean.match(VOWEL_GROUPS) ?? []).length;

  // A trailing silent "e" carries no note: "time", "name", "little".
  if (/[^aeiouy]e$/.test(clean) && count > 1) count -= 1;
  // "-le" after a consonant is its own beat: "twink-le", "lit-tle".
  if (/[^aeiouy]le$/.test(clean)) count += 1;
  // "-tion" / "-sion" is one beat, already counted once by the vowel group.
  // Diphthong endings like "-ia" split: "Ma-ri-a".
  if (/[aeiou]ia$/.test(clean)) count += 1;

  return Math.max(1, count);
}

/** Syllables in a whole line. */
export function syllablesInLine(line: string): number {
  const words = line.match(/\S+/g) ?? [];
  return words.reduce((n, w) => n + syllablesIn(w), 0);
}

export interface SongTimingOptions {
  /**
   * Seconds of rest after each sung line.
   *
   * A phrase of a nursery tune ends on a held note, and a singer breathes
   * there. Without it every line runs straight into the next and the whole
   * thing feels rushed no matter how slow the words are.
   */
  lineRest?: number;
}

interface Line {
  text: string;
  page: number;
  /** Offset of this line's first character within the flattened script. */
  offset: number;
}

/** Splits pages into lines, keeping each line's absolute character offset. */
function linesOf(pages: string[]): Line[] {
  const out: Line[] = [];
  let base = 0;

  pages.forEach((text, page) => {
    let cursor = 0;
    for (const part of text.split('\n')) {
      if (part.trim()) out.push({ text: part, page, offset: base + cursor });
      cursor += part.length + 1; // the newline
    }
    base += text.length;
    if (page < pages.length - 1) base += 2; // the '\n\n' join
  });

  return out;
}

/**
 * The grid: word timings and the sung lines, computed together.
 *
 * One pass produces both, because deriving the lines by searching the word
 * list afterwards goes wrong the moment a lyric repeats a word — and nursery
 * rhymes repeat constantly ("quack quack quack quack").
 */
export interface SongGrid {
  script: ReadAlongScript;
  lines: SungLine[];
}

/**
 * How long a phrase has before the next one is due.
 *
 * The voice is driven off the same grid as the highlight, one phrase at a
 * time, so the two cannot drift apart. Speaking the whole lyric in one breath
 * is what let the engine set the tempo.
 */
export interface SungLine {
  text: string;
  start: number;
  /** Seconds from this line's first word to the next line's first word. */
  duration: number;
}

export function songGrid(
  pages: string[],
  duration: number,
  options: SongTimingOptions = {},
): SongGrid {
  const lineRest = options.lineRest ?? 0.35;

  const parsed = linesOf(pages).map((line) => ({
    ...line,
    words: line.text.match(/\S+/g) ?? [],
    syllables: Math.max(1, syllablesInLine(line.text)),
  }));

  const totalSyllables = parsed.reduce((n, l) => n + l.syllables, 0) || 1;
  const totalRest = lineRest * Math.max(0, parsed.length - 1);

  // A beat of lead so the first word is not clipped, then the sung part.
  const lead = Math.min(0.5, duration * 0.03);
  const sung = Math.max(0.5, duration - lead - totalRest);
  const perSyllable = sung / totalSyllables;

  const words: WordTiming[] = [];
  const lines: SungLine[] = [];
  let clock = lead;
  let index = 0;

  for (const line of parsed) {
    const lineStart = clock;
    let cursor = 0;

    for (const word of line.words) {
      const at = line.text.indexOf(word, cursor);
      cursor = at < 0 ? cursor : at + word.length;

      const span = syllablesIn(word) * perSyllable;
      words.push({
        index: index++,
        page: line.page,
        word,
        offset: line.offset + (at < 0 ? 0 : at),
        start: clock,
        end: clock + span,
      });
      clock += span;
    }

    lines.push({
      text: line.text,
      start: lineStart,
      duration: Math.max(0.4, clock - lineStart + lineRest),
    });
    clock += lineRest;
  }

  const pageStarts = pages.map((_, page) => words.find((w) => w.page === page)?.start ?? 0);

  return {
    script: { pages, words, pageStarts, duration: Math.max(duration, clock) },
    lines,
  };
}

/** Just the timings, for callers that only highlight. */
export function songScript(
  pages: string[],
  duration: number,
  options: SongTimingOptions = {},
): ReadAlongScript {
  return songGrid(pages, duration, options).script;
}
