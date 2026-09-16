import type { SkillId } from '../types';

/**
 * The Story Station library.
 *
 * Four shelves, all built the same way so one player and one recorder serve
 * every one of them:
 *
 *   story          — bedtime books, written to wind a child down
 *   learning-book  — books with something concrete to learn, built on repetition
 *   song           — songs that teach: letters, numbers, days, colours, body
 *   lullaby        — short, soft, meant to be looped (see lullabies.ts)
 *
 * Everything original here is written for this app. Everything traditional
 * records where it came from, because a product being sold cannot ship
 * lyrics someone else owns.
 *
 * Pages are short on purpose: one or two sentences, so a highlighted word
 * keeps up with the voice and a four-year-old can follow the line.
 */

export type ShelfKind = 'story' | 'learning-book' | 'song';

export interface LibraryPage {
  /** One or two short sentences. Kept short so read-along tracks cleanly. */
  text: string;
  /** Art key, drawn by components/StoryArt.tsx. */
  art: string;
}

export interface LibraryItem {
  id: string;
  kind: ShelfKind;
  title: string;
  /** One line the parent reads when choosing. */
  blurb: string;
  emoji: string;
  /** What a child actually gets out of it. Shown to the parent, not the child. */
  teaches: string;
  skill?: SkillId;
  ageMin: number;
  ageMax: number;
  /** Roughly how long a slow read takes, in seconds. */
  duration: number;
  pages: LibraryPage[];
  /** Provenance for anything not written for this app. */
  origin?: string;
  /** For songs: the tune to sing it to, so a parent is never guessing. */
  tune?: string;
}

/* ============================================================
   Bedtime stories
   ============================================================ */

const STORIES: LibraryItem[] = [
  {
    id: 'tugboat',
    kind: 'story',
    title: 'The Sleepy Little Tugboat',
    blurb: 'A small boat finishes her work and goes quiet.',
    emoji: '⛵',
    teaches: 'Winding down. The whole book slows as it goes, which helps a busy child slow with it.',
    ageMin: 2,
    ageMax: 6,
    duration: 180,
    pages: [
      { text: 'All day, the little tugboat pushed the big ships in.\nPush, push, push.', art: 'boat' },
      { text: 'She pushed the red ship. She pushed the blue ship.\nShe pushed the enormous grey one that hummed.', art: 'shore' },
      { text: 'Now the sun is low. The water has gone flat and orange.', art: 'dusk' },
      { text: 'The big ships are tied up. Their lights blink slowly.\nBlink. Blink.', art: 'lamp' },
      { text: 'The little tugboat turns for home.\nHer engine goes quieter. And quieter.', art: 'boat' },
      { text: 'She bumps her soft old tyres against the dock.\nBump. There.', art: 'home' },
      { text: 'The water rocks her. A little. A little less.', art: 'soft' },
      { text: 'Goodnight, little tugboat.\nThe harbour will still be here in the morning.', art: 'moon' },
    ],
  },
  {
    id: 'bear-yawn',
    kind: 'story',
    title: "Bear Can't Find His Yawn",
    blurb: 'Bear has lost his yawn. Everyone helps him look.',
    emoji: '🐻',
    teaches: 'It is gently funny, and yawning is contagious — most children yawn by page four.',
    ageMin: 2,
    ageMax: 6,
    duration: 195,
    pages: [
      { text: 'Bear sat up in bed.\n"I have lost my yawn," he said.', art: 'home' },
      { text: 'He looked under the blanket. No yawn.\nHe looked inside his boot. No yawn.', art: 'soft' },
      { text: 'Owl came to help. "Try opening very wide," said Owl.\nBear opened very wide. Nothing came out.', art: 'friend' },
      { text: 'Mouse came to help. She yawned a tiny mouse yawn to show him.\nAaah.', art: 'meadow' },
      { text: 'Bear watched. His eyes went a bit heavy.\nBut still — no yawn.', art: 'thought' },
      { text: 'Then Badger came, and did the biggest yawn in the whole wood.\nAaaaaaah.', art: 'friend' },
      { text: 'And Bear felt something come up from his toes,\nall the way up, and out.\nAaaaaaaaaah.', art: 'soft' },
      { text: '"There it is," said Bear. And he lay down.\nGoodnight, Bear.', art: 'moon' },
    ],
  },
  {
    id: 'night-bus',
    kind: 'story',
    title: 'The Last Bus Home',
    blurb: 'A bus collects sleepy passengers and takes them all home.',
    emoji: '🚌',
    teaches: 'A predictable, repeating pattern — children can join in by the third stop.',
    ageMin: 3,
    ageMax: 7,
    duration: 200,
    pages: [
      { text: 'The last bus of the night pulls up.\nIts doors go pssshh.', art: 'town' },
      { text: 'A fox gets on, carrying a paper bag.\n"Home, please," says the fox.', art: 'friend' },
      { text: 'A heron gets on, folding herself up small.\n"Home, please," says the heron.', art: 'walk' },
      { text: 'A very small hedgehog gets on, all by himself.\n"Home, please," he says, in a very small voice.', art: 'lamp' },
      { text: 'The bus goes along the dark road.\nThe windows are warm and yellow.', art: 'night' },
      { text: 'One by one, they get off.\nGoodnight, fox. Goodnight, heron.', art: 'home' },
      { text: 'The driver walks the hedgehog right to his door.\n"Goodnight," she says.', art: 'home' },
      { text: 'Then the bus goes home too, and parks, and switches off its lights.\nGoodnight, bus.', art: 'moon' },
    ],
  },
  {
    id: 'owl-waits',
    kind: 'story',
    title: 'Owl Learns to Wait',
    blurb: 'Owl wants it NOW. The night has other ideas.',
    emoji: '🦉',
    teaches: 'Waiting. Being able to wait is one of the better predictors of how school goes.',
    ageMin: 3,
    ageMax: 7,
    duration: 210,
    pages: [
      { text: 'Owl wanted the moon to come out.\nShe wanted it NOW.', art: 'dusk' },
      { text: '"Not yet," said the sky. "The sun is still going down."\nOwl huffed.', art: 'thought' },
      { text: 'Owl counted her feathers to pass the time.\nOne, two, three, four, five.', art: 'meadow' },
      { text: 'The sky went pink. Then purple. Then a very deep blue.\nStill no moon.', art: 'night' },
      { text: '"Not yet," said the sky. "Nearly."\nOwl took a big breath in, and let it out slowly.', art: 'soft' },
      { text: 'And then — there. A thin silver edge over the hill.', art: 'moon' },
      { text: 'The moon came up whole and round and bright,\nand it was worth every single minute.', art: 'moon' },
      { text: 'Owl watched it for a while. Then she closed her eyes.\nGoodnight, Owl.', art: 'soft' },
    ],
  },
  {
    id: 'ten-quiet',
    kind: 'story',
    title: 'Ten Quiet Things',
    blurb: 'Counting down from ten, one quiet thing at a time.',
    emoji: '🔟',
    teaches: 'Counting backwards from ten, and the countdown itself settles a wound-up child.',
    skill: 'numberSense',
    ageMin: 2,
    ageMax: 6,
    duration: 165,
    pages: [
      { text: 'Ten quiet things are happening right now.', art: 'dusk' },
      { text: 'Ten: the kettle has stopped.\nNine: the cat has found her spot.', art: 'home' },
      { text: 'Eight: the street light hums.\nSeven: a door clicks shut somewhere.', art: 'lamp' },
      { text: 'Six: the fridge goes quiet.\nFive: the last car goes past.', art: 'night' },
      { text: 'Four: a moth taps the window.\nThree: the heating ticks.', art: 'soft' },
      { text: 'Two: your breathing slows down.', art: 'soft' },
      { text: 'One: the house is still.', art: 'moon' },
      { text: 'Goodnight.', art: 'moon' },
    ],
  },
  {
    id: 'lighthouse',
    kind: 'story',
    title: 'The Lighthouse Keeper Says Goodnight',
    blurb: 'Someone is awake all night, keeping watch. On purpose.',
    emoji: '🗼',
    teaches: 'For children whose grown-up works nights — it makes being awake at night an ordinary, useful thing.',
    ageMin: 3,
    ageMax: 8,
    duration: 205,
    pages: [
      { text: 'While you are going to sleep, somebody else is going to work.', art: 'dusk' },
      { text: 'The lighthouse keeper climbs the winding stairs.\nUp, and up, and up.', art: 'lamp' },
      { text: 'She switches the big light on.\nIt sweeps across the water. Round. And round.', art: 'shore' },
      { text: 'Out at sea, a fishing boat sees it and knows which way is home.', art: 'boat' },
      { text: 'The keeper drinks her tea and watches the dark.\nShe does not mind being awake. It is her job.', art: 'night' },
      { text: 'She thinks about her own house, and the bed in it,\nand somebody sleeping there who she loves.', art: 'home' },
      { text: 'The light goes round. The boats come in.\nThe night gets on with itself.', art: 'shore' },
      { text: 'And in the morning she will come home,\nand you will both be there.\nGoodnight.', art: 'moon' },
    ],
  },
];

/* ============================================================
   Learning books
   ============================================================ */

const LEARNING_BOOKS: LibraryItem[] = [
  {
    id: 'abc-bedtime',
    kind: 'learning-book',
    title: 'A Is for Almost Asleep',
    blurb: 'The whole alphabet, on the way to bed.',
    emoji: '🔤',
    teaches: 'Letter names and letter sounds — knowing these before school is one of the strongest head starts there is.',
    skill: 'phonics',
    ageMin: 2,
    ageMax: 6,
    duration: 190,
    pages: [
      { text: 'A is for almost. B is for bed.\nC is for curtains, closed.', art: 'home' },
      { text: 'D is for dark. E is for eyes.\nF is for feet, warm under the blanket.', art: 'soft' },
      { text: 'G is for goodnight. H is for hush.\nI is for in you get.', art: 'home' },
      { text: 'J is for jammies. K is for kiss.\nL is for lamp, switched off.', art: 'lamp' },
      { text: 'M is for moon. N is for night.\nO is for owl, awake outside.', art: 'moon' },
      { text: 'P is for pillow. Q is for quiet.\nR is for rest.', art: 'soft' },
      { text: 'S is for sleepy. T is for tired.\nU is for under the covers.', art: 'soft' },
      { text: 'V is for very. W is for warm.\nX is for the kiss at the end of a letter.', art: 'note' },
      { text: 'Y is for yawn. Z is for the sound of sleeping.\nZzzzzz.', art: 'moon' },
    ],
  },
  {
    id: 'counting-down',
    kind: 'learning-book',
    title: 'Five Little Sleepyheads',
    blurb: 'Five in the bed. One by one, they drop off.',
    emoji: '5️⃣',
    teaches: 'Counting down and taking one away — early subtraction, before it is ever called that.',
    skill: 'numberSense',
    ageMin: 2,
    ageMax: 6,
    duration: 150,
    pages: [
      { text: 'Five little sleepyheads, all in a row.', art: 'home' },
      { text: 'One shuts her eyes. How many are left?\nFour.', art: 'soft' },
      { text: 'Four little sleepyheads. One starts to snore.\nHow many are left? Three.', art: 'soft' },
      { text: 'Three little sleepyheads. One rolls over.\nHow many are left? Two.', art: 'soft' },
      { text: 'Two little sleepyheads. One drifts away.\nHow many are left? One.', art: 'night' },
      { text: 'One little sleepyhead, all on her own.\nShe yawns. She closes her eyes.', art: 'soft' },
      { text: 'How many are left?\nNone. They are all asleep.', art: 'moon' },
      { text: 'And now there is only you.\nGoodnight.', art: 'moon' },
    ],
  },
  {
    id: 'colours',
    kind: 'learning-book',
    title: 'What Colour Is the Night?',
    blurb: 'Every colour, hiding in the dark.',
    emoji: '🎨',
    teaches: 'Colour names, and looking closely at something that seems like it has no colour at all.',
    ageMin: 2,
    ageMax: 5,
    duration: 155,
    pages: [
      { text: 'People say the night is black. Let us have a proper look.', art: 'night' },
      { text: 'The sky near the roofs is orange, from the street lights.', art: 'town' },
      { text: 'Higher up it goes purple. Higher still, deep blue.', art: 'dusk' },
      { text: 'The moon is not white. It is the colour of butter.', art: 'moon' },
      { text: 'The grass has gone grey, but it is still green underneath.', art: 'meadow' },
      { text: 'A fox goes past. Red, even in the dark.', art: 'friend' },
      { text: 'Your curtains are yellow where the lamp shines through.', art: 'lamp' },
      { text: 'So the night is not black at all.\nIt is every colour, turned down low.', art: 'moon' },
    ],
  },
  {
    id: 'opposites',
    kind: 'learning-book',
    title: 'Loud Day, Quiet Night',
    blurb: 'Opposites, from morning to bedtime.',
    emoji: '↔️',
    teaches: 'Opposite pairs — a big jump in vocabulary, because words come in twos here.',
    ageMin: 3,
    ageMax: 6,
    duration: 145,
    pages: [
      { text: 'In the morning everything is loud.\nAt night everything is quiet.', art: 'town' },
      { text: 'The sun is up. Now the sun is down.', art: 'dusk' },
      { text: 'You were fast all day. Now you are slow.', art: 'walk' },
      { text: 'Your shoes were on. Now your shoes are off.', art: 'home' },
      { text: 'The curtains were open. Now they are closed.', art: 'home' },
      { text: 'The light was bright. Now it is dim.', art: 'lamp' },
      { text: 'Your eyes were wide. Now they are nearly shut.', art: 'soft' },
      { text: 'You were awake.\nNow — almost — asleep.', art: 'moon' },
    ],
  },
  {
    id: 'feelings',
    kind: 'learning-book',
    title: 'How Do You Feel Tonight?',
    blurb: 'Naming feelings, including the awkward ones.',
    emoji: '💛',
    teaches: 'Putting names to feelings. Children who can name a feeling have a far easier time managing it.',
    ageMin: 3,
    ageMax: 8,
    duration: 175,
    pages: [
      { text: 'Before you go to sleep, let us check how you are.', art: 'thought' },
      { text: 'Some nights you feel happy, and bedtime is easy.', art: 'home' },
      { text: 'Some nights you feel wriggly, and your legs will not stay still.\nThat is normal.', art: 'soft' },
      { text: 'Some nights you feel sad, and you do not know why.\nThat is allowed too.', art: 'thought' },
      { text: 'Some nights you feel cross with somebody.\nYou can be cross and still be loved.', art: 'doubt' },
      { text: 'Some nights you feel worried about tomorrow.\nTomorrow is not here yet.', art: 'night' },
      { text: 'Whatever you feel tonight, it has a name,\nand it will not feel exactly like this in the morning.', art: 'soft' },
      { text: 'You are safe. You are loved.\nGoodnight.', art: 'moon' },
    ],
  },
  {
    id: 'days-week',
    kind: 'learning-book',
    title: 'Seven Sleeps in a Week',
    blurb: 'The days of the week, one bedtime at a time.',
    emoji: '📅',
    teaches: 'The days in order, and that time is made of repeating chunks — how children learn to wait for things.',
    skill: 'patterns',
    ageMin: 3,
    ageMax: 7,
    duration: 160,
    pages: [
      { text: 'A week is seven sleeps long. Here they all are.', art: 'dusk' },
      { text: 'Monday night: everyone is a bit tired from starting again.', art: 'home' },
      { text: 'Tuesday night: the week is properly going now.', art: 'walk' },
      { text: 'Wednesday night: halfway. Look how far you have come.', art: 'path' },
      { text: 'Thursday night: nearly, nearly.', art: 'night' },
      { text: 'Friday night: the best one. No rushing tomorrow.', art: 'feast' },
      { text: 'Saturday night: long and slow and yours.', art: 'meadow' },
      { text: 'Sunday night: quiet, and ready.\nThen Monday comes round again, and we start once more.', art: 'moon' },
    ],
  },
  {
    id: 'shapes',
    kind: 'learning-book',
    title: 'Shapes in My Room',
    blurb: 'Circles, squares and triangles, hiding in plain sight.',
    emoji: '🔷',
    teaches: 'Shape names, and spotting shapes in real objects — the first step towards geometry and to reading letters.',
    skill: 'patterns',
    ageMin: 2,
    ageMax: 6,
    duration: 150,
    pages: [
      { text: 'Everything in your room is made of shapes.\nLet us find them.', art: 'home' },
      { text: 'The clock is a circle. So is the doorknob.\nSo is the moon out there.', art: 'moon' },
      { text: 'Your window is a square. So is the picture on the wall.', art: 'home' },
      { text: 'The roof of the dolls house is a triangle.\nSo is a slice of toast, cut corner to corner.', art: 'home' },
      { text: 'Your bed is a rectangle. So is your book.\nSo is the door.', art: 'soft' },
      { text: 'A ball is a circle from every side. That one is called a sphere.', art: 'meadow' },
      { text: 'Look around once more. How many circles can you see?', art: 'thought' },
      { text: 'Now close your eyes.\nThat shape is a good one too.', art: 'moon' },
    ],
  },
  {
    id: 'seed-tree',
    kind: 'learning-book',
    title: 'From a Seed to a Tree',
    blurb: 'Slow things, happening in order.',
    emoji: '🌳',
    teaches: 'Sequence and growing over time — and that very slow progress is still progress.',
    skill: 'patterns',
    ageMin: 3,
    ageMax: 8,
    duration: 170,
    pages: [
      { text: 'First there is a seed. It is smaller than your fingernail.', art: 'meadow' },
      { text: 'It goes into the dark ground. Nothing happens.\nFor a long time, nothing happens.', art: 'dark' },
      { text: 'Then a white root goes down. Then a green shoot goes up.', art: 'meadow' },
      { text: 'The shoot gets two leaves. Then four. Then more than you can count.', art: 'valley' },
      { text: 'It takes a whole year to get as tall as your knee.', art: 'path' },
      { text: 'It takes ten more to get taller than your house.', art: 'summit' },
      { text: 'Nobody ever saw it growing. It grew anyway, the whole time.', art: 'thought' },
      { text: 'You are doing that too, right now, while you sleep.\nGoodnight.', art: 'moon' },
    ],
  },
];

/* ============================================================
   Learning songs
   ============================================================ */

const SONGS: LibraryItem[] = [
  {
    id: 'alphabet-song',
    kind: 'song',
    title: 'The Alphabet Song',
    blurb: 'The one everybody knows.',
    emoji: '🔠',
    teaches: 'Letter names, in order. Most children learn the alphabet from this song before anything else.',
    skill: 'phonics',
    origin: 'Traditional; lyrics published 1835. Melody is the French folk tune "Ah! vous dirai-je, maman". Public domain.',
    tune: 'Twinkle, Twinkle, Little Star',
    ageMin: 2,
    ageMax: 6,
    duration: 45,
    pages: [
      { text: 'A B C D E F G', art: 'meadow' },
      { text: 'H I J K, L M N O P', art: 'meadow' },
      { text: 'Q R S, T U V', art: 'meadow' },
      { text: 'W X, Y and Z', art: 'meadow' },
      { text: 'Now I know my A B C.\nNext time won’t you sing with me?', art: 'moon' },
    ],
  },
  {
    id: 'head-shoulders',
    kind: 'song',
    title: 'Head, Shoulders, Knees and Toes',
    blurb: 'Point to each one. Then go faster.',
    emoji: '🦵',
    teaches: 'Body parts, plus listening and moving at the same time — which is harder than it sounds and good for focus.',
    skill: 'focus',
    origin: 'Traditional. Melody is "There Is a Tavern in the Town". Public domain.',
    tune: 'There Is a Tavern in the Town',
    ageMin: 2,
    ageMax: 6,
    duration: 50,
    pages: [
      { text: 'Head, shoulders, knees and toes,\nknees and toes.', art: 'meadow' },
      { text: 'Head, shoulders, knees and toes,\nknees and toes.', art: 'meadow' },
      { text: 'And eyes and ears and mouth and nose.', art: 'friend' },
      { text: 'Head, shoulders, knees and toes,\nknees and toes.', art: 'meadow' },
    ],
  },
  {
    id: 'old-macdonald',
    kind: 'song',
    title: 'Old MacDonald Had a Farm',
    blurb: 'Animals and the noises they make.',
    emoji: '🐄',
    teaches: 'Animal names and animal sounds, and a repeating pattern a child can predict and join in with.',
    origin: 'Traditional folk song, collected 1917. Public domain.',
    tune: 'Old MacDonald',
    ageMin: 2,
    ageMax: 6,
    duration: 90,
    pages: [
      { text: 'Old MacDonald had a farm, E I E I O.', art: 'meadow' },
      { text: 'And on that farm he had a cow, E I E I O.\nWith a moo moo here and a moo moo there.', art: 'meadow' },
      { text: 'Here a moo, there a moo, everywhere a moo moo.\nOld MacDonald had a farm, E I E I O.', art: 'valley' },
      { text: 'And on that farm he had a duck, E I E I O.\nWith a quack quack here and a quack quack there.', art: 'shore' },
      { text: 'Here a quack, there a quack, everywhere a quack quack.\nOld MacDonald had a farm, E I E I O.', art: 'meadow' },
      { text: 'And on that farm he had a sheep, E I E I O.\nWith a baa baa here and a baa baa there.', art: 'meadow' },
      { text: 'Here a baa, there a baa, everywhere a baa baa.\nOld MacDonald had a farm, E I E I O.', art: 'moon' },
    ],
  },
  {
    id: 'if-youre-happy',
    kind: 'song',
    title: "If You're Happy and You Know It",
    blurb: 'Clap, stamp, and say hooray.',
    emoji: '👏',
    teaches: 'Naming a feeling and matching it to an action — and the last verse is a good way to shake out bedtime fidgets.',
    origin: 'Traditional. Public domain.',
    tune: "If You're Happy and You Know It",
    ageMin: 2,
    ageMax: 6,
    duration: 75,
    pages: [
      { text: "If you're happy and you know it, clap your hands.\n(clap clap)", art: 'feast' },
      { text: "If you're happy and you know it, clap your hands.\n(clap clap)", art: 'feast' },
      { text: "If you're happy and you know it, and you really want to show it,", art: 'together' },
      { text: "If you're happy and you know it, clap your hands.\n(clap clap)", art: 'feast' },
      { text: "If you're sleepy and you know it, close your eyes.\n(shhh)", art: 'soft' },
      { text: "If you're sleepy and you know it, close your eyes.\n(shhh)", art: 'soft' },
      { text: "If you're sleepy and you know it, and your bed is where you'll show it,", art: 'home' },
      { text: "If you're sleepy and you know it, close your eyes.\n(shhh)", art: 'moon' },
    ],
  },
  {
    id: 'five-little-ducks',
    kind: 'song',
    title: 'Five Little Ducks',
    blurb: 'Five go out. Fewer come back. Then everybody comes home.',
    emoji: '🦆',
    teaches: 'Counting down and taking one away, and it ends with everyone safely home — which matters at bedtime.',
    skill: 'numberSense',
    origin: 'Traditional nursery song. Public domain.',
    tune: 'Five Little Ducks',
    ageMin: 2,
    ageMax: 6,
    duration: 100,
    pages: [
      { text: 'Five little ducks went out one day,\nover the hills and far away.', art: 'shore' },
      { text: 'Mother duck said, "Quack quack quack quack."\nBut only four little ducks came back.', art: 'shore' },
      { text: 'Four little ducks went out one day,\nover the hills and far away.', art: 'meadow' },
      { text: 'Mother duck said, "Quack quack quack quack."\nBut only three little ducks came back.', art: 'meadow' },
      { text: 'Three little ducks went out one day,\nover the hills and far away.', art: 'valley' },
      { text: 'Mother duck said, "Quack quack quack quack."\nBut only two little ducks came back.', art: 'valley' },
      { text: 'Two little ducks went out one day,\nover the hills and far away.', art: 'path' },
      { text: 'Mother duck said, "Quack quack quack quack."\nBut only one little duck came back.', art: 'path' },
      { text: 'One little duck went out one day,\nover the hills and far away.', art: 'dusk' },
      { text: 'Mother duck said, "Quack quack quack quack."\nAnd all five little ducks came back.', art: 'home' },
    ],
  },
  {
    id: 'days-song',
    kind: 'song',
    title: 'The Days of the Week Song',
    blurb: 'Seven days, in order, to a tune everyone already knows.',
    emoji: '🗓️',
    teaches: 'The days in order. Singing them sticks far better than saying them.',
    skill: 'patterns',
    origin: 'Original words written for Story Station, sung to the public-domain tune "Twinkle, Twinkle, Little Star".',
    tune: 'Twinkle, Twinkle, Little Star',
    ageMin: 3,
    ageMax: 7,
    duration: 45,
    pages: [
      { text: 'Monday, Tuesday, Wednesday too,', art: 'meadow' },
      { text: 'Thursday, Friday, nearly through.', art: 'path' },
      { text: 'Saturday and Sunday rest,', art: 'home' },
      { text: 'Seven days, I know them best.', art: 'valley' },
      { text: 'Then it starts again anew —\nMonday, Tuesday, Wednesday too.', art: 'moon' },
    ],
  },
  {
    id: 'colour-song',
    kind: 'song',
    title: 'The Colour Song',
    blurb: 'A colour, and something that is that colour.',
    emoji: '🌈',
    teaches: 'Colour names tied to real things, which is how they actually stick.',
    origin: 'Original words written for Story Station, sung to "Twinkle, Twinkle, Little Star".',
    tune: 'Twinkle, Twinkle, Little Star',
    ageMin: 2,
    ageMax: 6,
    duration: 50,
    pages: [
      { text: 'Red is an apple, red is a rose,', art: 'meadow' },
      { text: 'Blue is the sea where the sailing boat goes.', art: 'shore' },
      { text: 'Yellow is butter, yellow is sun,', art: 'valley' },
      { text: 'Green is the grass where the little legs run.', art: 'meadow' },
      { text: 'Orange, purple, brown and white —\nall the colours, then goodnight.', art: 'moon' },
    ],
  },
  {
    id: 'counting-song',
    kind: 'song',
    title: 'One, Two, Buckle My Shoe',
    blurb: 'Counting to twenty, two at a time.',
    emoji: '👟',
    teaches: 'Numbers to twenty, and rhyming pairs — two things at once, which is why it has lasted 200 years.',
    skill: 'numberSense',
    origin: 'Traditional nursery rhyme, first printed 1805. Public domain.',
    tune: 'One, Two, Buckle My Shoe',
    ageMin: 3,
    ageMax: 7,
    duration: 60,
    pages: [
      { text: 'One, two, buckle my shoe.', art: 'home' },
      { text: 'Three, four, knock at the door.', art: 'home' },
      { text: 'Five, six, pick up sticks.', art: 'meadow' },
      { text: 'Seven, eight, lay them straight.', art: 'meadow' },
      { text: 'Nine, ten, a big fat hen.', art: 'valley' },
      { text: 'Eleven, twelve, dig and delve.', art: 'path' },
      { text: 'Thirteen, fourteen, maids a-courting.', art: 'town' },
      { text: 'Fifteen, sixteen, maids in the kitchen.', art: 'home' },
      { text: 'Seventeen, eighteen, maids a-waiting.', art: 'home' },
      { text: 'Nineteen, twenty, my plate’s empty.', art: 'moon' },
    ],
  },
];

export const LIBRARY: LibraryItem[] = [...STORIES, ...LEARNING_BOOKS, ...SONGS];

export function libraryItem(id: string): LibraryItem | undefined {
  return LIBRARY.find((item) => item.id === id);
}

export function shelf(kind: ShelfKind): LibraryItem[] {
  return LIBRARY.filter((item) => item.kind === kind);
}

/** Everything a parent is asked to record, in the order it is worth doing. */
export function recordingOrder(): LibraryItem[] {
  return [...SONGS, ...STORIES, ...LEARNING_BOOKS];
}

/** The whole text, for narration and for the read-along view. */
export function scriptFor(item: LibraryItem): string {
  return item.pages.map((p) => p.text).join('\n\n');
}

export const SHELF_META: Record<ShelfKind, { label: string; emoji: string; blurb: string }> = {
  story: {
    label: 'Bedtime stories',
    emoji: '🌙',
    blurb: 'Written to slow a child down, not wind them up.',
  },
  'learning-book': {
    label: 'Learning books',
    emoji: '📚',
    blurb: 'Letters, numbers, colours and feelings — hidden inside a bedtime story.',
  },
  song: {
    label: 'Songs',
    emoji: '🎵',
    blurb: 'The songs that teach. Sing them yourself, or let your voice do it.',
  },
};
