/** Word lists behind the learning games. Ordered easiest-first within each set. */

/** CVC and early-blend words for sounding out. */
export const PHONICS_WORDS: { word: string; sounds: string[]; emoji: string }[] = [
  { word: 'cat', sounds: ['c', 'a', 't'], emoji: '🐱' },
  { word: 'dog', sounds: ['d', 'o', 'g'], emoji: '🐶' },
  { word: 'sun', sounds: ['s', 'u', 'n'], emoji: '☀️' },
  { word: 'bed', sounds: ['b', 'e', 'd'], emoji: '🛏️' },
  { word: 'pig', sounds: ['p', 'i', 'g'], emoji: '🐷' },
  { word: 'cup', sounds: ['c', 'u', 'p'], emoji: '🥤' },
  { word: 'hat', sounds: ['h', 'a', 't'], emoji: '🎩' },
  { word: 'bus', sounds: ['b', 'u', 's'], emoji: '🚌' },
  { word: 'fox', sounds: ['f', 'o', 'x'], emoji: '🦊' },
  { word: 'web', sounds: ['w', 'e', 'b'], emoji: '🕸️' },
  { word: 'net', sounds: ['n', 'e', 't'], emoji: '🥅' },
  { word: 'map', sounds: ['m', 'a', 'p'], emoji: '🗺️' },
  { word: 'ship', sounds: ['sh', 'i', 'p'], emoji: '🚢' },
  { word: 'fish', sounds: ['f', 'i', 'sh'], emoji: '🐟' },
  { word: 'star', sounds: ['s', 't', 'ar'], emoji: '⭐' },
  { word: 'moon', sounds: ['m', 'oo', 'n'], emoji: '🌙' },
  { word: 'tree', sounds: ['t', 'r', 'ee'], emoji: '🌳' },
  { word: 'rain', sounds: ['r', 'ai', 'n'], emoji: '🌧️' },
  { word: 'frog', sounds: ['f', 'r', 'o', 'g'], emoji: '🐸' },
  { word: 'nest', sounds: ['n', 'e', 's', 't'], emoji: '🪹' },
];

/** Dolch-style high-frequency words, banded by difficulty. */
export const SIGHT_WORDS: Record<1 | 2 | 3, string[]> = {
  1: ['the', 'and', 'is', 'you', 'we', 'to', 'in', 'it', 'he', 'she', 'go', 'my', 'me', 'up', 'see'],
  2: ['said', 'what', 'were', 'they', 'have', 'from', 'come', 'some', 'there', 'their', 'would', 'about', 'could', 'been', 'make'],
  3: ['because', 'through', 'thought', 'enough', 'people', 'should', 'together', 'different', 'another', 'important', 'friend', 'always', 'before', 'never', 'often'],
};

/** Near-miss distractors keep the sight-word game about reading, not guessing. */
export const SIGHT_DISTRACTORS: Record<string, string[]> = {
  the: ['teh', 'hte', 'tha'],
  and: ['nad', 'add', 'end'],
  said: ['sed', 'sad', 'slid'],
  what: ['whta', 'want', 'that'],
  were: ['where', 'wear', 'ware'],
  they: ['thay', 'them', 'then'],
  have: ['hav', 'here', 'gave'],
  from: ['form', 'farm', 'frim'],
  come: ['came', 'cone', 'coem'],
  some: ['same', 'sone', 'some_'],
  there: ['their', 'these', 'threw'],
  their: ['there', 'thier', 'theirs'],
  would: ['world', 'wold', 'could'],
  because: ['becuase', 'becase', 'before'],
  through: ['though', 'throuh', 'thorough'],
  thought: ['though', 'throught', 'taught'],
  enough: ['enogh', 'rough', 'though'],
  people: ['peple', 'poeple', 'purple'],
  should: ['shold', 'shoud', 'could'],
  together: ['togather', 'togethr', 'tomorrow'],
  different: ['diffrent', 'differnt', 'difficult'],
  another: ['anther', 'antoher', 'anyone'],
  important: ['importent', 'impotant', 'imported'],
  friend: ['freind', 'frend', 'fried'],
  always: ['alway', 'alwyas', 'already'],
  before: ['befor', 'belore', 'between'],
  never: ['nevar', 'newer', 'nether'],
  often: ['ofen', 'offen', 'oftan'],
};

/** Fallback distractors when a word has no hand-written near-misses. */
export function makeDistractors(word: string): string[] {
  const swaps: string[] = [];
  if (word.length > 2) {
    const chars = word.split('');
    [chars[1], chars[2]] = [chars[2], chars[1]];
    swaps.push(chars.join(''));
  }
  swaps.push(word.replace(/[aeiou]/, (v) => (v === 'a' ? 'e' : 'a')));
  swaps.push(word.slice(0, -1) + (word.endsWith('s') ? '' : 's'));
  return [...new Set(swaps)].filter((s) => s !== word).slice(0, 3);
}

/** Emoji patterns for the logic game, grouped by rule complexity. */
export const PATTERNS: { key: string; sequence: string[]; answer: string; options: string[]; level: 1 | 2 | 3 }[] = [
  { key: 'pat:ab', sequence: ['🔴', '🔵', '🔴', '🔵', '🔴'], answer: '🔵', options: ['🔵', '🔴', '🟡'], level: 1 },
  { key: 'pat:aab', sequence: ['🐱', '🐱', '🐶', '🐱', '🐱'], answer: '🐶', options: ['🐶', '🐱', '🐭'], level: 1 },
  { key: 'pat:abc', sequence: ['⭐', '🌙', '☀️', '⭐', '🌙'], answer: '☀️', options: ['☀️', '⭐', '🌙'], level: 2 },
  { key: 'pat:grow', sequence: ['🟦', '🟦🟦', '🟦🟦🟦', '🟦🟦🟦🟦'], answer: '🟦🟦🟦🟦🟦', options: ['🟦🟦🟦🟦🟦', '🟦🟦', '🟦🟦🟦'], level: 2 },
  { key: 'pat:abb', sequence: ['🍎', '🍌', '🍌', '🍎', '🍌'], answer: '🍌', options: ['🍌', '🍎', '🍇'], level: 2 },
  { key: 'pat:rotate', sequence: ['⬆️', '➡️', '⬇️', '⬅️', '⬆️'], answer: '➡️', options: ['➡️', '⬇️', '⬅️'], level: 3 },
  { key: 'pat:skip', sequence: ['2', '4', '6', '8'], answer: '10', options: ['10', '9', '12'], level: 3 },
  { key: 'pat:skip5', sequence: ['5', '10', '15', '20'], answer: '25', options: ['25', '30', '22'], level: 3 },
  { key: 'pat:double', sequence: ['1', '2', '4', '8'], answer: '16', options: ['16', '12', '10'], level: 3 },
  { key: 'pat:alt', sequence: ['🟩', '🟨', '🟩', '🟨', '🟩', '🟨'], answer: '🟩', options: ['🟩', '🟨', '🟧'], level: 1 },
];
