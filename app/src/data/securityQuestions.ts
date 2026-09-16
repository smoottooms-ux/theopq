/**
 * Security questions offered at sign-up.
 *
 * Chosen to be things a person remembers for decades but that are not printed
 * on a public profile: no mother's maiden name, no birth city, no favourite
 * colour. Anything a determined stranger could read off a social account has
 * been left out on purpose, and writing your own is always an option.
 */

export const SECURITY_QUESTIONS: string[] = [
  'What was the name of your first pet?',
  'What was your childhood nickname?',
  'What street did you live on when you were eight?',
  'What was the make and model of your first car?',
  'What was the name of your first school?',
  'What was your first job?',
  'What is the first name of your oldest cousin?',
  'What town were your parents married in?',
  'What was the name of the first band you saw live?',
  'What did you want to be when you grew up?',
];

/** The value used when someone writes their own question instead. */
export const CUSTOM_QUESTION = '__custom__';

/** Answers this short are too easy to guess to be worth anything. */
export const MIN_ANSWER_LENGTH = 2;
