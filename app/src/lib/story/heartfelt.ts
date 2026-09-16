/**
 * Heartfelt messages.
 *
 * These are not stories. They are the thing a parent wants to say and cannot
 * say right now — and "cannot" covers far more than being at work. Being in
 * the next room with a baby on you, on a call you cannot leave, ill, or
 * simply out of patience by seven o'clock all count, and a parent in the same
 * house needs these as much as one four hundred miles away.
 *
 * The templates carry the shape; the parent's own sentences carry the weight,
 * so every one leaves room for them and none pretend to be finished without
 * it.
 *
 * Placeholders: {child} {parent}
 */

export type HeartfeltId =
  | 'cant-be-there'
  | 'next-room'
  | 'proud'
  | 'when-i-was'
  | 'sorry'
  | 'miss-you'
  | 'hard-day'
  | 'big-day-tomorrow'
  | 'just-because';

export interface HeartfeltTemplate {
  id: HeartfeltId;
  label: string;
  emoji: string;
  blurb: string;
  /** What the parent should type into the personal note box. */
  promptForParent: string;
  /** Each entry becomes one page. {note} is where the parent's words land. */
  pages: string[];
}

export const HEARTFELT: HeartfeltTemplate[] = [
  {
    id: 'cant-be-there',
    label: "I can't be there tonight",
    emoji: '🌃',
    blurb: 'Work, travel, a shift, a hospital — whatever is keeping you away.',
    promptForParent: 'Where you are, and one specific thing you will do together when you are back.',
    pages: [
      "Hey {child}. It's {parent}. I'm not there to tuck you in tonight, so I recorded this instead. Press play and I'm right here.",
      '{note}',
      "I know a recording isn't the same as me sitting on the edge of your bed. I'm not going to pretend it is. But it's me, and it's yours, and you can play it as many times as you want.",
      "Close your eyes now, {child}. I love you. I'll see you soon. Goodnight.",
    ],
  },
  {
    id: 'next-room',
    label: "I'm here, just not free right now",
    emoji: '🚪',
    blurb: 'For when you are in the house but your hands are full.',
    promptForParent: 'What you are doing, in plain words. Children mind being fobbed off far more than they mind waiting.',
    pages: [
      "Hi {child}. It's {parent}. I'm right here in the house — I just can't come in yet.",
      '{note}',
      "That's not you being pushed to the back of the queue. Grown-ups only have so many hands, and sometimes the timing is rubbish. It isn't about you.",
      "So start without me. Get in, get comfy, and let this be the bit we do together tonight.",
      "I'll come in and check on you. Goodnight, {child}. I love you.",
    ],
  },
  {
    id: 'proud',
    label: "I'm proud of you",
    emoji: '🏅',
    blurb: 'Say it out loud, with the specifics.',
    promptForParent: 'The exact thing they did. Be specific — vague praise bounces off.',
    pages: [
      "Hey {child}, it's {parent}. I wanted to tell you something before you go to sleep, and I wanted you to hear me say it, not just read it.",
      '{note}',
      "I want you to notice what I said there. I didn't say you're clever, or lucky, or that it came easy. I said what you *did*. That part is yours. Nobody can take it off you.",
      "You're going to have days where it doesn't go like that. Everyone does. On those days, come back and play this one.",
      "I'm proud of you, {child}. Really proud. Goodnight.",
    ],
  },
  {
    id: 'when-i-was',
    label: 'When I was your age',
    emoji: '📻',
    blurb: 'A true story from your own childhood.',
    promptForParent: 'A real memory from when you were their age. Messy is better than perfect.',
    pages: [
      "Hi {child}. It's {parent}. Tonight I'm not going to make a story up. I'm going to tell you a true one, about me, from when I was about the age you are now.",
      '{note}',
      "I've thought about that a lot over the years. I didn't understand it at the time. A lot of things don't make sense until later — that's normal, that's not you being slow.",
      "One day you'll tell your own version of that story to someone. That's how it works. It gets passed along.",
      'Goodnight, {child}. Sleep well.',
    ],
  },
  {
    id: 'sorry',
    label: 'I owe you an apology',
    emoji: '🤍',
    blurb: 'Model the repair. It teaches more than the apology.',
    promptForParent: 'What you got wrong, in plain words. No "but" at the end.',
    pages: [
      "Hey {child}. It's {parent}. I've got something to say and I'd rather say it than let it sit.",
      '{note}',
      "That's on me. Not on you. You didn't cause it and you didn't deserve it, and I'm not going to explain it away.",
      "Grown-ups get it wrong too. The difference isn't never messing up — it's coming back and saying so. That's what I'm doing right now.",
      "I love you, {child}. Nothing changes that, ever. Goodnight.",
    ],
  },
  {
    id: 'miss-you',
    label: 'I miss you',
    emoji: '🛻',
    blurb: 'For the long hauls, the long stretches, and the weeks apart.',
    promptForParent: 'Where you are, and one small thing you saw today they would like.',
    pages: [
      "Hi {child}, it's {parent}. I'm a long way from you tonight and I wanted you to hear my voice before you sleep.",
      '{note}',
      "Here's something I want you to know: the distance is a fact, but it isn't a feeling. I don't feel far from you. I carry you around all day, in my head, everywhere I go.",
      "Count the sleeps if it helps. Or don't. Either way it's getting smaller, every single night, including this one.",
      'Goodnight, {child}. I love you. I miss you. See you soon.',
    ],
  },
  {
    id: 'hard-day',
    label: 'You had a hard day',
    emoji: '🫂',
    blurb: 'For after the bad ones.',
    promptForParent: 'Name what happened, without fixing it or minimising it.',
    pages: [
      "Hey {child}. It's {parent}. I heard about today. I'm not going to tell you it was fine, because it wasn't.",
      '{note}',
      "You're allowed to feel rotten about that. You don't have to be cheerful about it for anybody, including me. Feeling bad about a bad thing means you're working properly.",
      "It will not feel like this forever. I promise you that, and I don't promise things I'm not sure about. Tomorrow will be a bit different. The day after, different again.",
      "You're not on your own with it. Goodnight, {child}. I love you.",
    ],
  },
  {
    id: 'just-because',
    label: 'No reason at all',
    emoji: '💫',
    blurb: "Nothing happened. You just wanted them to hear it.",
    promptForParent: 'Something you noticed about them this week. Small and specific beats big and general.',
    pages: [
      "Hi {child}. It's {parent}. Nothing's wrong — I just wanted to say something before you go to sleep.",
      '{note}',
      "That's it. That's the whole message. Sometimes a thing is worth saying even when there's no reason to say it.",
      'Goodnight, {child}. I love you.',
    ],
  },
  {
    id: 'big-day-tomorrow',
    label: 'Big day tomorrow',
    emoji: '⭐',
    blurb: 'The pep talk you would give at the door.',
    promptForParent: "What's happening tomorrow, and the one thing you want them to remember.",
    pages: [
      "Hi {child}. It's {parent}. Tomorrow's the day, and I might not be there in the morning, so I'm doing this now.",
      '{note}',
      "Here's the deal: you don't have to be brilliant. You have to turn up and try, and that is completely within your control. The rest isn't, and it isn't your job.",
      "If it goes great, I want to hear everything. If it goes badly, I want to hear everything. Same face either way. That's a promise.",
      'Now sleep, because tired makes everything harder. Goodnight, {child}. You have got this.',
    ],
  },
];

export function heartfeltById(id: HeartfeltId): HeartfeltTemplate {
  return HEARTFELT.find((h) => h.id === id) ?? HEARTFELT[0];
}
