/**
 * Enrollment scripts.
 *
 * Chosen for three things at once: broad phonetic coverage (every English
 * vowel and most consonant clusters appear across the set), bedtime prosody
 * rather than newsreader prosody, and sentences a parent will not feel stupid
 * saying out loud at 2am in a truck cab.
 */

export interface EnrollPrompt {
  id: string;
  label: string;
  text: string;
  /** Roughly how long a natural read takes, in seconds. */
  target: number;
}

export const ENROLL_PROMPTS: EnrollPrompt[] = [
  {
    id: 'warm-open',
    label: 'Say hello',
    text: "Hey, it's me. I'm right here. Get comfy, and we'll start when you're ready.",
    target: 9,
  },
  {
    id: 'story-voice',
    label: 'Your reading voice',
    text: 'Once upon a quiet evening, a small brown owl pushed open the round window and looked out at the whole sleeping town below.',
    target: 13,
  },
  {
    id: 'range',
    label: 'Big and small',
    text: 'The giant shouted, "Who goes there?" But the little mouse only whispered back, "It is just me, sir. I am very, very small."',
    target: 14,
  },
  {
    id: 'numbers',
    label: 'Counting down',
    text: 'Three, two, one — and up we go, past the roof, past the clouds, past eight bright stars and one enormous yellow moon.',
    target: 13,
  },
  {
    id: 'soft',
    label: 'Winding down',
    text: 'Close your eyes now. Nothing left to do. The house is warm, the door is shut, and everyone you love is safe tonight.',
    target: 13,
  },
  {
    id: 'sign-off',
    label: 'Goodnight',
    text: "Goodnight, sweetheart. I love you more than anything. I'll see you in the morning.",
    target: 9,
  },
];

/** Providers want roughly a minute of clean speech; six prompts clears that. */
export const MIN_SAMPLES = 4;
