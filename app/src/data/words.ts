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

/* ------------------------------------------------------------------
   Phonological awareness material.

   The evidence is consistent that phonemic blending, segmenting and
   manipulation predict later reading better than rhyming does, so the
   games weight them that way — rhyme is the on-ramp, manipulation is the
   destination.
   ------------------------------------------------------------------ */

/** Blending: the child hears the sounds separately and names the word. */
export const BLENDING_WORDS: { key: string; word: string; sounds: string[]; emoji: string; level: 1 | 2 | 3 }[] = [
  { key: 'blend:sun', word: 'sun', sounds: ['s', 'u', 'n'], emoji: '☀️', level: 1 },
  { key: 'blend:map', word: 'map', sounds: ['m', 'a', 'p'], emoji: '🗺️', level: 1 },
  { key: 'blend:bed', word: 'bed', sounds: ['b', 'e', 'd'], emoji: '🛏️', level: 1 },
  { key: 'blend:dog', word: 'dog', sounds: ['d', 'o', 'g'], emoji: '🐶', level: 1 },
  { key: 'blend:cup', word: 'cup', sounds: ['k', 'u', 'p'], emoji: '🥤', level: 1 },
  { key: 'blend:fish', word: 'fish', sounds: ['f', 'i', 'sh'], emoji: '🐟', level: 2 },
  { key: 'blend:moon', word: 'moon', sounds: ['m', 'oo', 'n'], emoji: '🌙', level: 2 },
  { key: 'blend:star', word: 'star', sounds: ['s', 't', 'ar'], emoji: '⭐', level: 2 },
  { key: 'blend:rain', word: 'rain', sounds: ['r', 'ai', 'n'], emoji: '🌧️', level: 2 },
  { key: 'blend:frog', word: 'frog', sounds: ['f', 'r', 'o', 'g'], emoji: '🐸', level: 2 },
  { key: 'blend:train', word: 'train', sounds: ['t', 'r', 'ai', 'n'], emoji: '🚂', level: 3 },
  { key: 'blend:bridge', word: 'bridge', sounds: ['b', 'r', 'i', 'j'], emoji: '🌉', level: 3 },
  { key: 'blend:spoon', word: 'spoon', sounds: ['s', 'p', 'oo', 'n'], emoji: '🥄', level: 3 },
  { key: 'blend:cloud', word: 'cloud', sounds: ['k', 'l', 'ow', 'd'], emoji: '☁️', level: 3 },
];

/**
 * Manipulation: deleting or swapping a phoneme.
 * `answer` is what is left after the change — always a real word.
 */
export const MANIPULATION_ITEMS: {
  key: string;
  word: string;
  instruction: string;
  answer: string;
  distractors: string[];
  level: 1 | 2 | 3;
}[] = [
  { key: 'man:cat-c', word: 'cat', instruction: 'Say "cat" without the /k/', answer: 'at', distractors: ['ca', 'tac'], level: 1 },
  { key: 'man:sand-s', word: 'sand', instruction: 'Say "sand" without the /s/', answer: 'and', distractors: ['san', 'nad'], level: 1 },
  { key: 'man:stop-s', word: 'stop', instruction: 'Say "stop" without the /s/', answer: 'top', distractors: ['sop', 'pot'], level: 1 },
  { key: 'man:bend-b', word: 'bend', instruction: 'Say "bend" without the /b/', answer: 'end', distractors: ['ben', 'den'], level: 2 },
  { key: 'man:train-t', word: 'train', instruction: 'Say "train" without the /t/', answer: 'rain', distractors: ['tain', 'rail'], level: 2 },
  { key: 'man:spin-s', word: 'spin', instruction: 'Say "spin" without the /s/', answer: 'pin', distractors: ['sin', 'nip'], level: 2 },
  { key: 'man:cart-c', word: 'cart', instruction: 'Say "cart" without the /k/', answer: 'art', distractors: ['car', 'rat'], level: 2 },
  { key: 'man:cat-b', word: 'cat', instruction: 'Change the /k/ in "cat" to /b/', answer: 'bat', distractors: ['cab', 'tab'], level: 3 },
  { key: 'man:pin-w', word: 'pin', instruction: 'Change the /p/ in "pin" to /w/', answer: 'win', distractors: ['pen', 'nip'], level: 3 },
  { key: 'man:hat-m', word: 'hat', instruction: 'Change the /h/ in "hat" to /m/', answer: 'mat', distractors: ['ham', 'tam'], level: 3 },
  { key: 'man:sock-r', word: 'sock', instruction: 'Change the /s/ in "sock" to /r/', answer: 'rock', distractors: ['sick', 'lock'], level: 3 },
  { key: 'man:ring-k', word: 'ring', instruction: 'Change the /r/ in "ring" to /k/', answer: 'king', distractors: ['rang', 'wing'], level: 3 },
];

/** Rhyme: the gentlest entry point into hearing sound inside words. */
export const RHYME_SETS: { key: string; word: string; emoji: string; rhyme: string; others: string[]; level: 1 | 2 | 3 }[] = [
  { key: 'rhyme:cat', word: 'cat', emoji: '🐱', rhyme: 'hat', others: ['dog', 'cup'], level: 1 },
  { key: 'rhyme:star', word: 'star', emoji: '⭐', rhyme: 'car', others: ['moon', 'tree'], level: 1 },
  { key: 'rhyme:moon', word: 'moon', emoji: '🌙', rhyme: 'spoon', others: ['sun', 'night'], level: 1 },
  { key: 'rhyme:bed', word: 'bed', emoji: '🛏️', rhyme: 'head', others: ['sleep', 'pillow'], level: 1 },
  { key: 'rhyme:frog', word: 'frog', emoji: '🐸', rhyme: 'log', others: ['pond', 'jump'], level: 2 },
  { key: 'rhyme:mouse', word: 'mouse', emoji: '🐭', rhyme: 'house', others: ['cheese', 'small'], level: 2 },
  { key: 'rhyme:bear', word: 'bear', emoji: '🐻', rhyme: 'chair', others: ['woods', 'honey'], level: 2 },
  { key: 'rhyme:whale', word: 'whale', emoji: '🐋', rhyme: 'tail', others: ['ocean', 'big'], level: 2 },
  { key: 'rhyme:night', word: 'night', emoji: '🌃', rhyme: 'light', others: ['dark', 'sleep'], level: 3 },
  { key: 'rhyme:dream', word: 'dream', emoji: '💭', rhyme: 'cream', others: ['sleep', 'think'], level: 3 },
  { key: 'rhyme:sheep', word: 'sheep', emoji: '🐑', rhyme: 'sleep', others: ['wool', 'farm'], level: 3 },
  { key: 'rhyme:cloud', word: 'cloud', emoji: '☁️', rhyme: 'loud', others: ['rain', 'sky'], level: 3 },
];

/* ------------------------------------------------------------------
   Executive function material.

   Inhibitory control predicts school readiness and contributes
   independently to early maths, letter knowledge and phonemic awareness,
   so it earns its own games rather than being a side effect.
   ------------------------------------------------------------------ */

/** Go/No-Go: tap everything in the "go" set, withhold on the rest. */
export const GO_NO_GO_ROUNDS: {
  key: string;
  rule: string;
  goLabel: string;
  stimuli: { emoji: string; go: boolean }[];
  level: 1 | 2 | 3;
}[] = [
  {
    key: 'gng:animals',
    rule: 'Tap every animal. Do NOT tap the fish.',
    goLabel: 'animals',
    stimuli: [
      { emoji: '🐶', go: true }, { emoji: '🐟', go: false }, { emoji: '🐱', go: true },
      { emoji: '🐰', go: true }, { emoji: '🐟', go: false }, { emoji: '🐻', go: true },
      { emoji: '🦊', go: true }, { emoji: '🐟', go: false }, { emoji: '🐸', go: true },
      { emoji: '🐟', go: false }, { emoji: '🦉', go: true }, { emoji: '🐭', go: true },
    ],
    level: 1,
  },
  {
    key: 'gng:fruit',
    rule: 'Tap every fruit. Do NOT tap anything yellow.',
    goLabel: 'fruit that is not yellow',
    stimuli: [
      { emoji: '🍎', go: true }, { emoji: '🍌', go: false }, { emoji: '🍓', go: true },
      { emoji: '🍇', go: true }, { emoji: '🍋', go: false }, { emoji: '🍒', go: true },
      { emoji: '🍌', go: false }, { emoji: '🍑', go: true }, { emoji: '🍉', go: true },
      { emoji: '🍋', go: false }, { emoji: '🫐', go: true }, { emoji: '🍊', go: true },
    ],
    level: 2,
  },
  {
    key: 'gng:night',
    rule: 'Tap everything you see at NIGHT. Do NOT tap the sun.',
    goLabel: 'night things',
    stimuli: [
      { emoji: '🌙', go: true }, { emoji: '☀️', go: false }, { emoji: '⭐', go: true },
      { emoji: '🦉', go: true }, { emoji: '☀️', go: false }, { emoji: '🌛', go: true },
      { emoji: '🕯️', go: true }, { emoji: '☀️', go: false }, { emoji: '🌠', go: true },
      { emoji: '🦇', go: true }, { emoji: '☀️', go: false }, { emoji: '🌌', go: true },
    ],
    level: 3,
  },
];

/**
 * Opposite Day: a Stroop-style conflict where the obvious answer is wrong.
 * Classic day/night task — see the sun, say "night".
 */
export const OPPOSITE_ITEMS: { key: string; show: string; answer: string; options: string[]; level: 1 | 2 | 3 }[] = [
  { key: 'opp:sun', show: '☀️', answer: 'Night', options: ['Night', 'Day'], level: 1 },
  { key: 'opp:moon', show: '🌙', answer: 'Day', options: ['Day', 'Night'], level: 1 },
  { key: 'opp:big', show: '🐘', answer: 'Small', options: ['Small', 'Big'], level: 1 },
  { key: 'opp:small', show: '🐜', answer: 'Big', options: ['Big', 'Small'], level: 1 },
  { key: 'opp:up', show: '⬆️', answer: 'Down', options: ['Down', 'Up'], level: 2 },
  { key: 'opp:down', show: '⬇️', answer: 'Up', options: ['Up', 'Down'], level: 2 },
  { key: 'opp:hot', show: '🔥', answer: 'Cold', options: ['Cold', 'Hot'], level: 2 },
  { key: 'opp:cold', show: '❄️', answer: 'Hot', options: ['Hot', 'Cold'], level: 2 },
  { key: 'opp:fast', show: '🐇', answer: 'Slow', options: ['Slow', 'Fast'], level: 3 },
  { key: 'opp:slow', show: '🐢', answer: 'Fast', options: ['Fast', 'Slow'], level: 3 },
  { key: 'opp:loud', show: '📢', answer: 'Quiet', options: ['Quiet', 'Loud'], level: 3 },
  { key: 'opp:quiet', show: '🤫', answer: 'Loud', options: ['Loud', 'Quiet'], level: 3 },
];

/**
 * Sort It Twice: a card-sort where the rule changes halfway.
 * Switching rules mid-task is the standard measure of cognitive flexibility.
 */
export const SORT_CARDS: {
  key: string;
  emoji: string;
  colour: 'red' | 'blue' | 'yellow';
  shape: 'round' | 'pointy';
}[] = [
  { key: 'sort:apple', emoji: '🍎', colour: 'red', shape: 'round' },
  { key: 'sort:ball', emoji: '🔴', colour: 'red', shape: 'round' },
  { key: 'sort:heart', emoji: '❤️', colour: 'red', shape: 'pointy' },
  { key: 'sort:kite', emoji: '🪁', colour: 'red', shape: 'pointy' },
  { key: 'sort:blueberry', emoji: '🫐', colour: 'blue', shape: 'round' },
  { key: 'sort:bluecircle', emoji: '🔵', colour: 'blue', shape: 'round' },
  { key: 'sort:bluediamond', emoji: '🔷', colour: 'blue', shape: 'pointy' },
  { key: 'sort:fish', emoji: '🐟', colour: 'blue', shape: 'pointy' },
  { key: 'sort:lemon', emoji: '🍋', colour: 'yellow', shape: 'round' },
  { key: 'sort:sun', emoji: '🟡', colour: 'yellow', shape: 'round' },
  { key: 'sort:star', emoji: '⭐', colour: 'yellow', shape: 'pointy' },
  { key: 'sort:bolt', emoji: '⚡', colour: 'yellow', shape: 'pointy' },
];
