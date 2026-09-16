/**
 * The lullaby book.
 *
 * Every text here is public domain — traditional, or by an author dead well
 * over a century. That matters: this is a product being sold, and a lullaby
 * app that ships copyrighted lyrics is a lawsuit with a bedtime theme.
 * Each entry records where it came from so the claim can be checked.
 *
 * Nothing modern goes in this file without a cleared licence. In particular,
 * "Baby Mine", "You Are My Sunshine" and "Somewhere Over the Rainbow" are NOT
 * public domain and must never be added.
 */

export interface Lullaby {
  id: string;
  title: string;
  /** Where the text comes from, and why we are confident it is free to use. */
  origin: string;
  /** Roughly how long a slow read takes, in seconds. */
  duration: number;
  mood: 'classic' | 'gentle' | 'folk' | 'hymn';
  art: string;
  verses: string[];
}

export const LULLABIES: Lullaby[] = [
  {
    id: 'twinkle',
    title: 'Twinkle, Twinkle, Little Star',
    origin: 'Jane Taylor, "The Star", 1806. Public domain.',
    duration: 95,
    mood: 'classic',
    art: 'moon',
    verses: [
      'Twinkle, twinkle, little star,\nHow I wonder what you are.\nUp above the world so high,\nLike a diamond in the sky.',
      'When the blazing sun is gone,\nWhen he nothing shines upon,\nThen you show your little light,\nTwinkle, twinkle, all the night.',
      'Then the traveller in the dark\nThanks you for your tiny spark;\nHe could not see which way to go,\nIf you did not twinkle so.',
      'In the dark blue sky you keep,\nAnd often through my curtains peep,\nFor you never shut your eye\nTill the sun is in the sky.',
      'Twinkle, twinkle, little star,\nHow I wonder what you are.',
    ],
  },
  {
    id: 'hush-little-baby',
    title: 'Hush, Little Baby',
    origin: 'Traditional American folk lullaby, 19th century. Public domain.',
    duration: 85,
    mood: 'folk',
    art: 'soft',
    verses: [
      "Hush, little baby, don't say a word,\nPapa's gonna buy you a mockingbird.",
      "And if that mockingbird won't sing,\nPapa's gonna buy you a diamond ring.",
      "And if that diamond ring turns brass,\nPapa's gonna buy you a looking glass.",
      "And if that looking glass gets broke,\nPapa's gonna buy you a billy goat.",
      "And if that billy goat won't pull,\nPapa's gonna buy you a cart and bull.",
      "And if that cart and bull turn over,\nPapa's gonna buy you a dog named Rover.",
      "And if that dog named Rover won't bark,\nPapa's gonna buy you a horse and cart.",
      "And if that horse and cart fall down,\nYou'll still be the sweetest little baby in town.",
    ],
  },
  {
    id: 'all-the-pretty-horses',
    title: 'All the Pretty Little Horses',
    origin: 'Traditional American lullaby, 19th century. Public domain.',
    duration: 70,
    mood: 'folk',
    art: 'meadow',
    verses: [
      'Hush-a-bye, don\'t you cry,\nGo to sleep, my little baby.',
      'When you wake, you shall have\nAll the pretty little horses.',
      'Blacks and bays, dapples and greys,\nAll the pretty little horses.',
      'Hush-a-bye, don\'t you cry,\nGo to sleep, my little baby.',
    ],
  },
  {
    id: 'all-through-the-night',
    title: 'All Through the Night',
    origin: 'Welsh air "Ar Hyd y Nos"; English words by Harold Boulton, 1884. Public domain.',
    duration: 80,
    mood: 'gentle',
    art: 'dusk',
    verses: [
      'Sleep, my child, and peace attend thee,\nAll through the night.\nGuardian angels God will send thee,\nAll through the night.',
      'Soft the drowsy hours are creeping,\nHill and vale in slumber sleeping,\nI my loving vigil keeping,\nAll through the night.',
      'While the moon her watch is keeping,\nAll through the night.\nWhile the weary world is sleeping,\nAll through the night.',
      'O\'er thy spirit gently stealing,\nVisions of delight revealing,\nBreathes a pure and holy feeling,\nAll through the night.',
    ],
  },
  {
    id: 'brahms',
    title: "Lullaby and Goodnight",
    origin: 'Brahms\' "Wiegenlied", Op. 49 No. 4, 1868; traditional English text. Public domain.',
    duration: 60,
    mood: 'classic',
    art: 'soft',
    verses: [
      'Lullaby and goodnight,\nWith roses bedight,\nWith lilies o\'erspread\nIs my baby\'s sweet bed.',
      'Lay thee down now and rest,\nMay thy slumber be blessed.\nLay thee down now and rest,\nMay thy slumber be blessed.',
      'Lullaby and goodnight,\nThy mother\'s delight,\nBright angels beside\nMy darling abide.',
      'They will guard thee at rest,\nThou shalt wake on my breast.\nThey will guard thee at rest,\nThou shalt wake on my breast.',
    ],
  },
  {
    id: 'golden-slumbers',
    title: 'Golden Slumbers',
    origin: 'Thomas Dekker, "Patient Grissel", 1603. Public domain.',
    duration: 45,
    mood: 'classic',
    art: 'soft',
    verses: [
      'Golden slumbers kiss your eyes,\nSmiles await you when you rise.\nSleep, pretty baby, do not cry,\nAnd I will sing a lullaby.',
      'Care is heavy, therefore sleep you,\nYou are care, and care must keep you.\nSleep, pretty baby, do not cry,\nAnd I will sing a lullaby.',
    ],
  },
  {
    id: 'sleep-baby-sleep',
    title: 'Sleep, Baby, Sleep',
    origin: 'Traditional German folk song ("Schlaf, Kindlein, schlaf"), 17th century. Public domain.',
    duration: 55,
    mood: 'folk',
    art: 'meadow',
    verses: [
      'Sleep, baby, sleep.\nYour father tends the sheep.\nYour mother shakes the dreamland tree,\nAnd from it fall sweet dreams for thee.\nSleep, baby, sleep.',
      'Sleep, baby, sleep.\nThe large stars are the sheep,\nThe little stars are the lambs, I guess,\nThe gentle moon is the shepherdess.\nSleep, baby, sleep.',
    ],
  },
  {
    id: 'now-the-day-is-over',
    title: 'Now the Day Is Over',
    origin: 'Sabine Baring-Gould, 1865. Public domain.',
    duration: 65,
    mood: 'hymn',
    art: 'dusk',
    verses: [
      'Now the day is over,\nNight is drawing nigh,\nShadows of the evening\nSteal across the sky.',
      'Now the darkness gathers,\nStars begin to peep,\nBirds and beasts and flowers\nSoon will be asleep.',
      'Through the long night watches\nMay thine angels spread\nTheir white wings above me,\nWatching round my bed.',
      'When the morning wakens,\nThen may I arise\nPure and fresh and sinless\nIn thy holy eyes.',
    ],
  },
  {
    id: 'bye-baby-bunting',
    title: 'Bye, Baby Bunting',
    origin: 'Traditional English nursery rhyme, recorded 1784. Public domain.',
    duration: 30,
    mood: 'gentle',
    art: 'soft',
    verses: [
      'Bye, baby bunting,\nDaddy\'s gone a-hunting,\nGone to fetch a rabbit skin\nTo wrap the baby bunting in.',
      'Bye, baby bunting,\nMother\'s gone a-milking,\nSister\'s gone a-silking,\nBrother\'s gone to buy a skin\nTo wrap the baby bunting in.',
    ],
  },
  {
    id: 'the-sandman',
    title: 'The Sandman Comes',
    origin: 'Traditional German ("Der Sandmann"), 19th century; traditional English text. Public domain.',
    duration: 50,
    mood: 'gentle',
    art: 'night',
    verses: [
      'The sandman comes, the sandman comes,\nHe brings such pretty snow-white sand\nFor every child throughout the land.',
      'He is a kindly, gentle man,\nHe gives good children all he can,\nAnd then they close their eyes and sleep,\nAnd through the night sweet dreams they keep.',
    ],
  },
];

export function lullabyById(id: string): Lullaby | undefined {
  return LULLABIES.find((l) => l.id === id);
}

/** The full spoken text, used for narration and for the reading view. */
export function lullabyScript(lullaby: Lullaby): string {
  return lullaby.verses.join('\n\n');
}
