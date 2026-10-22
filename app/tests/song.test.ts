import { songGrid, syllablesIn, syllablesInLine } from '../src/lib/song';

let fails = 0;
const ok = (n: string, c: boolean, extra = '') => {
  console.log((c ? '  ✓ ' : '  ✗ ') + n + (!c && extra ? ` — ${extra}` : ''));
  if (!c) fails++;
};

/* ---- syllables ---- */
ok('single letters are one beat', syllablesIn('A') === 1 && syllablesIn('Z') === 1);
ok('W is three beats (dou-ble-u)', syllablesIn('W') === 3, String(syllablesIn('W')));
ok('twinkle is two', syllablesIn('twinkle') === 2, String(syllablesIn('twinkle')));
ok('little is two', syllablesIn('little') === 2, String(syllablesIn('little')));
ok('star is one', syllablesIn('star') === 1, String(syllablesIn('star')));
ok('shoulders is two', syllablesIn('shoulders') === 2, String(syllablesIn('shoulders')));
ok('time is one (silent e)', syllablesIn('time') === 1, String(syllablesIn('time')));
ok('punctuation does not add a beat', syllablesIn('C.') === syllablesIn('C'));
ok('a line sums its words', syllablesInLine('A B C') === 3, String(syllablesInLine('A B C')));

/* ---- the alphabet song: the case he hit ---- */
const ALPHABET = [
  'A B C D E F G',
  'H I J K, L M N O P',
  'Q R S, T U V',
  'W X, Y and Z',
  'Now I know my A B C.\nNext time won’t you sing with me?',
];
const { script, lines } = songGrid(ALPHABET, 45);

ok('every word is timed', script.words.length === ALPHABET.join(' ').split(/\s+/).filter(Boolean).length,
   `${script.words.length} words`);
ok('timings only move forwards', script.words.every((w, i) => i === 0 || w.start >= script.words[i-1].start));
ok('no word has zero length', script.words.every((w) => w.end > w.start));
ok('the song fits its duration', script.duration <= 46, String(script.duration));

// The rhythm test: within a line of equal-syllable words, spacing is EVEN.
const firstLine = script.words.slice(0, 7); // A B C D E F G
const gaps = firstLine.slice(1).map((w, i) => w.start - firstLine[i].start);
const spread = Math.max(...gaps) - Math.min(...gaps);
ok('equal-syllable words are evenly spaced', spread < 0.001, `spread=${spread.toFixed(4)}s`);
console.log(`     "A B C D E F G" → ${gaps[0].toFixed(2)}s per letter, steady`);

// W must get three times the room of X.
const wIndex = script.words.findIndex((w) => w.word === 'W');
const w = script.words[wIndex];
const x = script.words[wIndex + 1];
const wLen = w.end - w.start;
const xLen = x.end - x.start;
ok('W is sung three times as long as X', Math.abs(wLen / xLen - 3) < 0.01,
   `W=${wLen.toFixed(2)}s X=${xLen.toFixed(2)}s`);

// Lines must be in order, with a rest between them.
ok('lines are in order', lines.every((l, i) => i === 0 || l.start > lines[i-1].start));
ok('every line has a slot', lines.every((l) => l.duration > 0.3));
ok('the multi-line page became two sung lines', lines.length === 6, `${lines.length} lines`);
ok('there is a breath between phrases',
   lines.slice(1).every((l, i) => l.start > lines[i].start + 0.3));

// Pages must advance with the lines.
ok('page starts advance', script.pageStarts.every((s, i) => i === 0 || s >= script.pageStarts[i-1]));

/* ---- a repeated-word lyric must not confuse the grid ---- */
const DUCKS = ['Mother duck said, "Quack quack quack quack."'];
const ducks = songGrid(DUCKS, 10);
const quacks = ducks.script.words.filter((w) => /quack/i.test(w.word));
ok('four quacks are four distinct words', quacks.length === 4, `${quacks.length}`);
ok('each quack has its own slot',
   quacks.every((q, i) => i === 0 || q.start > quacks[i-1].start),
   quacks.map(q=>q.start.toFixed(2)).join(','));
ok('repeated words get distinct offsets',
   new Set(quacks.map((q) => q.offset)).size === 4,
   quacks.map(q=>q.offset).join(','));

/* ---- compare against the old prose estimate ---- */
console.log('\n  --- rhythm comparison on "A B C D E F G" ---');
const proseGapSpread = (() => {
  // Reproduce the old weightOf-based estimate for the same line.
  const weightOf = (word: string) => {
    let wt = Math.max(2, word.replace(/[^A-Za-z0-9']/g, '').length);
    if (/[,;:]$/.test(word)) wt += 2;
    if (/[.!?]$/.test(word)) wt += 4;
    return wt;
  };
  const allWords = ALPHABET.join('\n\n').match(/\S+/g)!;
  const total = allWords.reduce((s, w) => s + weightOf(w), 0);
  let t = 0.35;
  const starts: number[] = [];
  for (const w of allWords) { starts.push(t); t += (weightOf(w) / total) * (45 - 0.35); }
  const g = starts.slice(1, 7).map((s, i) => s - starts[i]);
  return { spread: Math.max(...g) - Math.min(...g), per: g[0] };
})();
console.log(`  old prose estimate: ${proseGapSpread.per.toFixed(2)}s per letter`);
console.log(`  new musical grid:   ${gaps[0].toFixed(2)}s per letter`);

console.log(fails ? `\n${fails} FAILED` : '\nall song-timing checks passed');
process.exit(fails ? 1 : 0);
