/**
 * Read-along timing.
 *
 * The point of the app is that a child sees the words light up as their
 * grown-up says them, the way a finger moves under the line when someone reads
 * to you properly. Timing comes from three places depending on who is
 * speaking, in descending order of accuracy:
 *
 *   1. Real alignment from the voice provider  — exact, used for cloned voices
 *   2. Speech synthesis boundary events        — exact, used by the device reader
 *   3. An estimate from the audio duration     — used for a parent's own recording,
 *                                                because nothing tells us where
 *                                                the words fell in their take
 *
 * The estimate is deliberately weighted rather than uniform: long words take
 * longer to say, and punctuation buys a pause.
 */

export interface WordTiming {
  /** Index into the flattened word list. */
  index: number;
  /** Page this word belongs to. */
  page: number;
  word: string;
  /** Character offset within the whole script, for boundary-event matching. */
  offset: number;
  start: number;
  end: number;
}

export interface ReadAlongScript {
  /** Page texts, in order. */
  pages: string[];
  words: WordTiming[];
  /** Where each page begins, in seconds. */
  pageStarts: number[];
  duration: number;
}

const WORD_PATTERN = /\S+/g;

interface RawWord {
  word: string;
  page: number;
  offset: number;
}

/** Flattens pages into words while remembering where each one came from. */
function flatten(pages: string[]): { words: RawWord[]; script: string } {
  const words: RawWord[] = [];
  let script = '';

  pages.forEach((text, page) => {
    const base = script.length;
    let match: RegExpExecArray | null;
    WORD_PATTERN.lastIndex = 0;
    while ((match = WORD_PATTERN.exec(text))) {
      words.push({ word: match[0], page, offset: base + match.index });
    }
    script += text;
    if (page < pages.length - 1) script += '\n\n';
  });

  return { words, script };
}

/**
 * How long a word takes to say, in arbitrary units.
 *
 * Roughly proportional to length, with a floor so "a" is not instantaneous,
 * plus extra for the pause that punctuation implies.
 */
function weightOf(word: string): number {
  let weight = Math.max(2, word.replace(/[^A-Za-z0-9']/g, '').length);
  if (/[,;:]$/.test(word)) weight += 2;
  if (/[.!?]$/.test(word)) weight += 4;
  if (/[—–]/.test(word)) weight += 2;
  return weight;
}

/** Best-effort timings from nothing but a total duration. */
export function estimateScript(pages: string[], duration: number): ReadAlongScript {
  const { words } = flatten(pages);
  const total = words.reduce((sum, w) => sum + weightOf(w.word), 0) || 1;

  // A read-aloud starts a beat after play and ends a beat before the file does.
  const lead = Math.min(0.35, duration * 0.02);
  const usable = Math.max(0.1, duration - lead);

  let elapsed = lead;
  const timed: WordTiming[] = words.map((w, index) => {
    const span = (weightOf(w.word) / total) * usable;
    const start = elapsed;
    elapsed += span;
    return { index, page: w.page, word: w.word, offset: w.offset, start, end: elapsed };
  });

  return {
    pages,
    words: timed,
    pageStarts: pageStartsFrom(timed, pages.length),
    duration,
  };
}

/**
 * Exact timings from a provider that returns per-character alignment.
 *
 * The provider's character stream will not match our script byte for byte —
 * it normalises whitespace — so the two are walked together and matched on
 * non-whitespace characters only.
 */
export function scriptFromAlignment(
  pages: string[],
  characters: string[],
  startTimes: number[],
  endTimes: number[],
): ReadAlongScript {
  const { words } = flatten(pages);

  // Index every non-space character in the provider's stream.
  const stream: { char: string; start: number; end: number }[] = [];
  characters.forEach((char, i) => {
    if (/\S/.test(char)) {
      stream.push({ char, start: startTimes[i] ?? 0, end: endTimes[i] ?? startTimes[i] ?? 0 });
    }
  });

  let cursor = 0;
  const timed: WordTiming[] = words.map((w, index) => {
    const letters = w.word.replace(/\s/g, '');
    const from = Math.min(cursor, Math.max(0, stream.length - 1));
    const to = Math.min(stream.length, cursor + letters.length);
    cursor = to;

    const start = stream[from]?.start ?? 0;
    const end = stream[Math.max(from, to - 1)]?.end ?? start;
    return { index, page: w.page, word: w.word, offset: w.offset, start, end };
  });

  const duration = endTimes.length ? (endTimes[endTimes.length - 1] ?? 0) : 0;
  return { pages, words: timed, pageStarts: pageStartsFrom(timed, pages.length), duration };
}

function pageStartsFrom(words: WordTiming[], pageCount: number): number[] {
  const starts = new Array<number>(pageCount).fill(0);
  for (let page = 0; page < pageCount; page++) {
    starts[page] = words.find((w) => w.page === page)?.start ?? starts[Math.max(0, page - 1)];
  }
  return starts;
}

/** The word being spoken at a given moment. Binary search: this runs per frame. */
export function wordAt(script: ReadAlongScript, seconds: number): number {
  const { words } = script;
  if (words.length === 0) return -1;
  if (seconds < words[0].start) return -1;

  let low = 0;
  let high = words.length - 1;
  let found = -1;

  while (low <= high) {
    const mid = (low + high) >> 1;
    if (words[mid].start <= seconds) {
      found = mid;
      low = mid + 1;
    } else {
      high = mid - 1;
    }
  }
  return found;
}

/**
 * Maps a speech-synthesis boundary event to a word.
 *
 * The browser reports a character offset into the text it was given, so the
 * offsets recorded during flattening are what make this work.
 */
export function wordAtOffset(script: ReadAlongScript, charIndex: number): number {
  let found = -1;
  for (const w of script.words) {
    if (w.offset <= charIndex) found = w.index;
    else break;
  }
  return found;
}

/** Splits a page into renderable tokens, preserving the line breaks. */
export function tokenisePage(
  script: ReadAlongScript,
  page: number,
): { word: string; index: number; breakAfter: boolean }[] {
  const text = script.pages[page] ?? '';
  const pageWords = script.words.filter((w) => w.page === page);

  const out: { word: string; index: number; breakAfter: boolean }[] = [];
  let cursor = 0;

  for (const w of pageWords) {
    const at = text.indexOf(w.word, cursor);
    const nextCursor = at >= 0 ? at + w.word.length : cursor;
    const following = text.slice(nextCursor, nextCursor + 2);
    out.push({ word: w.word, index: w.index, breakAfter: following.startsWith('\n') });
    cursor = nextCursor;
  }

  return out;
}

/* ============================================================
   Speaking a script, with a fallback that always works
   ============================================================ */

export type ReaderMode = 'voice' | 'silent';

export interface ReaderHandle {
  stop(): void;
  mode: ReaderMode;
}

/**
 * Whether this device can actually read out loud.
 *
 * `window.speechSynthesis` existing proves nothing: plenty of Android builds
 * expose the API with no voice installed, where `speak()` fails silently and
 * no events ever fire. Checking the voice list is the only reliable signal,
 * and it can populate asynchronously.
 */
export async function speechAvailable(timeoutMs = 1200): Promise<boolean> {
  const synth = typeof window !== 'undefined' ? window.speechSynthesis : undefined;
  if (!synth) return false;
  if (synth.getVoices().length > 0) return true;

  await new Promise<void>((resolve) => {
    const done = () => resolve();
    synth.addEventListener('voiceschanged', done, { once: true });
    setTimeout(done, timeoutMs);
  });

  return synth.getVoices().length > 0;
}

export interface ReadOptions {
  script: ReadAlongScript;
  /** The exact text handed to the synthesiser, so offsets line up. */
  text: string;
  rate?: number;
  onWord(index: number): void;
  onDone(): void;
  /** Told which mode actually started, so the UI can be honest about it. */
  onMode?(mode: ReaderMode): void;
}

/**
 * Reads a script aloud, highlighting as it goes — and if the device cannot
 * speak, still runs the highlighting on a timer.
 *
 * The silent mode matters: a book whose words light up at reading pace is
 * still a usable book, and a parent can read from it. Doing nothing at all,
 * with a Pause button that never finishes, is the worst possible outcome and
 * is what happens if you trust the API's presence alone.
 */
export async function readAloud(options: ReadOptions): Promise<ReaderHandle> {
  const { script, text, rate = 0.85, onWord, onDone, onMode } = options;

  const startSilent = (): ReaderHandle => {
    onMode?.('silent');
    let raf = 0;
    let stopped = false;
    const startedAt = performance.now();
    // Without audio there is no real duration, so the written estimate paces it.
    const speed = rate > 0 ? 1 / rate : 1;

    const tick = () => {
      if (stopped) return;
      const elapsed = ((performance.now() - startedAt) / 1000) / speed;
      const index = wordAt(script, elapsed);
      onWord(index);

      if (elapsed >= script.duration) {
        stopped = true;
        onDone();
        return;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    return {
      mode: 'silent',
      stop: () => {
        stopped = true;
        cancelAnimationFrame(raf);
      },
    };
  };

  if (!(await speechAvailable())) return startSilent();

  const synth = window.speechSynthesis;
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.rate = rate;

  let fellBack: ReaderHandle | null = null;
  let finished = false;

  utterance.onboundary = (event) => {
    if (fellBack) return;
    onWord(wordAtOffset(script, event.charIndex));
  };
  utterance.onend = () => {
    if (fellBack || finished) return;
    finished = true;
    onDone();
  };
  utterance.onerror = () => {
    // Some devices only fail once asked to speak. Switch over rather than
    // leaving the reader stuck on a button that says Pause.
    if (fellBack || finished) return;
    fellBack = startSilent();
  };

  synth.cancel();
  synth.speak(utterance);
  onMode?.('voice');

  // A watchdog for the quietest failure of all: speak() accepted, nothing
  // spoken, no error raised.
  const watchdog = window.setTimeout(() => {
    if (fellBack || finished) return;
    if (!synth.speaking) fellBack = startSilent();
  }, 1400);

  return {
    mode: 'voice',
    stop: () => {
      window.clearTimeout(watchdog);
      fellBack?.stop();
      synth.cancel();
    },
  };
}
