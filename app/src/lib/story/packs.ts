import type { StoryTopic } from '../../types';

/**
 * Hand-written story material, one pack per topic.
 *
 * Every story is assembled from a fixed eight-beat arc (call → journey →
 * trouble → helper → turn → resolve → home → goodnight) so the shape is
 * always a real story rather than a pile of sentences. Each beat offers
 * `simple` lines for pre-readers and `rich` lines for older children; the
 * generator picks the register from the child's reading level.
 *
 * Placeholders: {child} {parent} {friend} {place} {thing}
 */

export type BeatKey =
  | 'call'
  | 'journey'
  | 'trouble'
  | 'helper'
  | 'turn'
  | 'resolve'
  | 'home'
  | 'goodnight';

export const BEAT_ORDER: BeatKey[] = [
  'call',
  'journey',
  'trouble',
  'helper',
  'turn',
  'resolve',
  'home',
  'goodnight',
];

export interface Beat {
  art: string;
  simple: string[];
  rich: string[];
}

export interface TopicPack {
  id: StoryTopic;
  label: string;
  emoji: string;
  blurb: string;
  titles: string[];
  friends: string[];
  places: string[];
  things: string[];
  vocabulary: { word: string; meaning: string }[];
  beats: Record<BeatKey, Beat>;
}

export const PACKS: Record<Exclude<StoryTopic, 'heartfelt'>, TopicPack> = {
  adventure: {
    id: 'adventure',
    label: 'Adventure',
    emoji: '🗺️',
    blurb: 'Maps, hidden doors, and one brave step at a time.',
    titles: ['{child} and the Door in the Hill', 'The Map That Whispered', '{child} and the Lantern Path'],
    friends: ['a small grey fox', 'a talking compass', 'a one-eared rabbit', 'an old tortoise named Pim'],
    places: ['the Hollow Hills', 'the Quiet Wood', 'the Long Stone Bridge', 'the Valley of Round Doors'],
    things: ['a folded paper map', 'a brass lantern', 'a key made of river glass', 'a silver whistle'],
    vocabulary: [
      { word: 'courage', meaning: 'doing the right thing even when you feel scared' },
      { word: 'discover', meaning: 'to find something for the very first time' },
      { word: 'trail', meaning: 'a path that shows you the way' },
    ],
    beats: {
      call: {
        art: 'door',
        simple: [
          'One morning {child} found {thing} under the bed. It was old and soft at the corners. It had a little mark shaped like a star.',
          '{child} woke up early. On the windowsill sat {thing}. Nobody knew how it got there.',
        ],
        rich: [
          'The morning began ordinary, which is how the best mornings disguise themselves. Then {child} found {thing} tucked beneath the bed, worn soft at the corners, marked with a small star that had not been there the night before.',
          'Some things wait years to be found. {thing} had been waiting under the loose board by the window, and on that particular Tuesday, {child} finally looked down.',
        ],
      },
      journey: {
        art: 'path',
        simple: [
          'The star pointed toward {place}. {child} put on boots and went out the door. The grass was cold and wet.',
          '{child} followed the mark all the way to {place}. The wind pushed gently, like a hand on the back.',
        ],
        rich: [
          'The star pointed east, toward {place}, and {child} went — boots laced, breath fogging, the whole world still asleep except for one determined pair of feet.',
          'The path to {place} was longer than it looked, the way honest paths usually are. {child} walked until the houses got smaller and the sky got wider.',
        ],
      },
      trouble: {
        art: 'cliff',
        simple: [
          'Then the path stopped. There was a wide gap, too big to jump. {child} sat down and felt very small.',
          'A thick fog rolled in. {child} could not see the way back or the way forward.',
        ],
        rich: [
          'And then the path simply stopped, the way paths sometimes do, at the edge of a gap far too wide to jump. {child} sat down on a cold stone and felt extremely small in a very large world.',
          'The fog arrived without asking. It swallowed the trail behind and the trail ahead, and left {child} standing in the middle of nothing at all.',
        ],
      },
      helper: {
        art: 'friend',
        simple: [
          'Then {friend} came out of the mist. "You are not stuck," it said. "You are just early."',
          'Something rustled. It was {friend}. "I know this place," it said kindly. "Walk with me."',
        ],
        rich: [
          'Then {friend} stepped out of the mist, unhurried, entirely unsurprised. "You are not stuck," it said. "You are only early. There is a difference, and it matters."',
          'A rustle, a pause, and {friend} appeared at {child}\'s elbow. "I have crossed worse than this before breakfast," it said. "Walk with me and watch your feet."',
        ],
      },
      turn: {
        art: 'bridge',
        simple: [
          '{friend} showed {child} the old stones under the water. They were a bridge all along. {child} took one step, then another.',
          'Together they found a rope hidden in the grass. {child} held on tight and did not let go.',
        ],
        rich: [
          '{friend} brushed away the moss, and there they were: flat stones set under the water, a bridge that had been there the entire time, waiting for someone patient enough to look. {child} took one step. Then another. Then the rest.',
          'The rope was buried in the long grass, exactly where {friend} said it would be. {child} gripped it with both hands, and found that holding on was mostly a decision.',
        ],
      },
      resolve: {
        art: 'summit',
        simple: [
          'On the other side was a small round door. Behind it was a room full of warm yellow light. It smelled like bread.',
          'At the top {child} could see everything — the whole valley, the town, and home.',
        ],
        rich: [
          'On the far side stood a small round door, and behind it a room the colour of afternoon honey, warm and low-ceilinged and smelling faintly of bread. Someone had clearly been expecting company.',
          'From the top, the whole valley laid itself out — the crooked river, the roofs of town, and somewhere among them, a window with a light left on.',
        ],
      },
      home: {
        art: 'home',
        simple: [
          '{child} walked home with {friend}. The sky turned pink, then purple. The lights were on.',
          'They went back the same way. It felt much shorter now. Everything looked friendly.',
        ],
        rich: [
          'The walk home took the same number of steps and somehow far fewer. The sky went pink, then plum, then the deep blue that means the day has finished its work.',
          'They returned by the same trail, which is a strange thing about trails: they shrink once you know them. {child} was home before the first star finished arriving.',
        ],
      },
      goodnight: {
        art: 'moon',
        simple: [
          '{child} put {thing} back under the bed. Tomorrow it might point somewhere new. Goodnight, {child}.',
          '{child} climbed into bed. {friend} waited by the window. Sleep well, brave one.',
        ],
        rich: [
          '{child} tucked {thing} back beneath the bed, where brave things wait. Tomorrow the star might point somewhere new. Tonight it pointed at a pillow. Goodnight, {child}.',
          'Boots by the door, map on the shelf, {friend} keeping watch from the windowsill. The adventure would keep. Sleep well, {child}.',
        ],
      },
    },
  },

  animals: {
    id: 'animals',
    label: 'Animals',
    emoji: '🦊',
    blurb: 'Creatures with opinions, and a lesson tucked inside.',
    titles: ['The Fox Who Forgot to Hurry', '{child} and the Very Polite Badger', 'The Meadow Meeting'],
    friends: ['a badger in a knitted scarf', 'a heron with excellent manners', 'a hedgehog named Button', 'a loud but loyal goose'],
    places: ['the Long Meadow', 'the Old Orchard', 'the Reedy Pond', 'the Hedgerow'],
    things: ['a basket of pears', 'a lost blue mitten', 'a jar of honey', 'a very important acorn'],
    vocabulary: [
      { word: 'patient', meaning: 'able to wait calmly without getting upset' },
      { word: 'burrow', meaning: 'a cosy tunnel an animal digs to live in' },
      { word: 'gather', meaning: 'to collect things and bring them together' },
    ],
    beats: {
      call: {
        art: 'meadow',
        simple: [
          'In {place}, everyone was busy. {child} came to visit and found {thing} sitting alone on a rock.',
          'The animals of {place} had a problem. {thing} had gone missing, and nobody knew where.',
        ],
        rich: [
          'In {place}, everyone had somewhere urgent to be — which is how {thing} came to be sitting alone on a flat rock, thoroughly ignored, until {child} came through the gate.',
          '{place} ran on a very old schedule, and that morning the schedule had broken: {thing} was missing, and not one animal would admit to having seen it last.',
        ],
      },
      journey: {
        art: 'path',
        simple: [
          '{child} asked the rabbits. They were too busy. {child} asked the crows. They only laughed.',
          'So {child} went looking. The grass was tall. The bees were loud and friendly.',
        ],
        rich: [
          '{child} asked the rabbits, who were far too busy being rabbits. {child} asked the crows, who laughed in that way crows have, which is not entirely kind.',
          'So {child} went looking alone, wading through grass shoulder-high, while the bees conducted their loud and cheerful business overhead.',
        ],
      },
      trouble: {
        art: 'rain',
        simple: [
          'Then it started to rain. Everyone ran to hide. {child} was left standing in the wet.',
          'The animals began to argue. They got louder and louder. Nobody was listening.',
        ],
        rich: [
          'Then the rain arrived all at once, the way summer rain does, and every creature in {place} vanished into a hole or a hedge. {child} stood alone in the downpour, entirely out of ideas.',
          'The argument started small and grew teeth. Everyone spoke; nobody listened. {child} watched a whole meadow forget how to be neighbours.',
        ],
      },
      helper: {
        art: 'friend',
        simple: [
          'Then {friend} came out slowly. "Sit," it said. "Let us think, not run."',
          '{friend} tapped the ground three times. Everyone went quiet. "One at a time," it said.',
        ],
        rich: [
          'Then {friend} emerged without hurrying, shook the rain off, and said, "Sit down. Thinking is faster than running, though it rarely feels that way."',
          '{friend} tapped the ground three times — an old signal in {place} — and the whole meadow went quiet. "One at a time," it said. "And the smallest speaks first."',
        ],
      },
      turn: {
        art: 'listen',
        simple: [
          'So they listened. The tiny mouse spoke last and knew the answer all along.',
          '{child} looked again in the quiet. There it was, right where nobody had thought to look.',
        ],
        rich: [
          'So they listened, properly, and the smallest mouse — who had been trying to speak since breakfast — told them exactly where to look. She had known since Tuesday.',
          'In the quiet, {child} looked again, and found it precisely where nobody thinks to look: in plain sight, under everybody\'s nose.',
        ],
      },
      resolve: {
        art: 'feast',
        simple: [
          '{thing} was safe. Everyone said sorry to the mouse. Then they shared supper under the wide tree.',
          'The meadow was happy again. They made room for the mouse at the front.',
        ],
        rich: [
          '{thing} was recovered, apologies were made — real ones, with eye contact — and supper was shared under the wide tree while the rain finished up politely elsewhere.',
          'The meadow put itself back together, and from that day the smallest voice in {place} got to speak first, which changed rather a lot.',
        ],
      },
      home: {
        art: 'home',
        simple: [
          '{friend} walked {child} to the gate. "Come back soon," it said. "You listen well."',
          'The sun came out just before it set. It made the wet grass shine like glass.',
        ],
        rich: [
          '{friend} walked {child} as far as the gate. "Come back soon," it said. "You listen, and that is rarer than it should be."',
          'The sun made a brief apology at the end of the day, and lit every wet blade of grass in {place} until the whole field glittered.',
        ],
      },
      goodnight: {
        art: 'moon',
        simple: [
          'Back home, {child} was warm and dry. In {place}, the animals were sleeping too. Goodnight, {child}.',
          '{child} yawned. Somewhere a badger yawned too. Sleep well, kind one.',
        ],
        rich: [
          'Back home, dry socks and a warm room. Out in {place}, a whole meadow of small breathing creatures settling into their burrows. Goodnight, {child}.',
          '{child} yawned, and somewhere across the dark fields a badger yawned back. Sleep well, listener.',
        ],
      },
    },
  },

  space: {
    id: 'space',
    label: 'Space',
    emoji: '🚀',
    blurb: 'Rockets, quiet planets, and the size of things.',
    titles: ['{child} and the Slow Comet', 'The Planet That Hummed', '{child} Goes Past the Moon'],
    friends: ['a repair robot called Nine', 'a very calm alien geologist', 'a satellite that told jokes', 'an astronaut named Vega'],
    places: ['the Sea of Tranquillity', 'the rings of Saturn', 'a small moon with no name', 'the quiet side of Mars'],
    things: ['a cracked helmet visor', 'a jar of red dust', 'a radio with one working knob', 'a seed packet from Earth'],
    vocabulary: [
      { word: 'orbit', meaning: 'the curved path one thing takes around another in space' },
      { word: 'gravity', meaning: 'the pull that keeps you on the ground' },
      { word: 'crater', meaning: 'a big bowl-shaped dent made by something crashing' },
    ],
    beats: {
      call: {
        art: 'rocket',
        simple: [
          'The radio crackled at bedtime. A voice said, "{child}, we need you. Bring {thing}."',
          '{child} looked up and saw a light that was not a star. It was moving. It was waiting.',
        ],
        rich: [
          'The radio crackled just past bedtime, which is when radios do their most interesting work. "{child}," it said. "We need you up here. Bring {thing}."',
          'One of the stars was not a star. It moved, then stopped, then moved again — and {child} understood, the way children do, that it was waiting to be noticed.',
        ],
      },
      journey: {
        art: 'launch',
        simple: [
          'The rocket went up. The sky turned from blue to black. Earth got small and round and blue.',
          'Up and up. {child} floated out of the seat and laughed.',
        ],
        rich: [
          'The rocket pressed {child} into the seat, and then the blue outside the window thinned into black, and Earth became what it has always been: small, round, and entirely blue.',
          'Then the engines hushed, and {child} floated free of the seat and laughed out loud, because there is no other correct response.',
        ],
      },
      trouble: {
        art: 'alarm',
        simple: [
          'Near {place}, a light began to blink red. The air machine had stopped working.',
          'A rock hit the ship. It spun. {child} held on and counted breaths.',
        ],
        rich: [
          'Near {place}, something on the panel began to blink red — patiently, then insistently. The air recycler had stopped, and space does not negotiate.',
          'A stone the size of a fist found the ship, and the stars swung past the window far too fast. {child} held on and counted breaths, in and out, which is what you do.',
        ],
      },
      helper: {
        art: 'friend',
        simple: [
          'Then {friend} floated in. "Panic uses air," it said. "So we will not panic."',
          '{friend} tapped the panel. "This is fixable," it said. "Most things are."',
        ],
        rich: [
          'Then {friend} drifted through the hatch, unbothered. "Panic uses oxygen," it observed. "So we shall not be panicking today."',
          '{friend} studied the panel for a long moment and said, "This is fixable. Most things are, if you go slowly and stop guessing."',
        ],
      },
      turn: {
        art: 'repair',
        simple: [
          'They worked together. {child} held the light. {friend} turned the bolts. The air came back.',
          '{child} remembered {thing} and used it to seal the crack. It worked.',
        ],
        rich: [
          'They worked in shifts: {child} on the light, {friend} on the bolts, both of them quiet and careful. Then a hiss, a green blink, and clean cold air on their faces.',
          'It was {thing} that saved them — pressed into the crack and held there until the seal took hold. {child} had brought it for no reason at all, which is sometimes the best reason.',
        ],
      },
      resolve: {
        art: 'planet',
        simple: [
          'They landed on {place}. It was quiet. It was the quietest place {child} had ever been.',
          'They planted the seeds in the red dust. One tiny green shoot came up.',
        ],
        rich: [
          'They set down on {place}, and {child} learned what real quiet sounds like — no wind, no traffic, no hum. Only a heartbeat and the tick of cooling metal.',
          'They pressed seeds into cold red dust, and days later one absurd, stubborn green shoot arrived, which is the whole story of life in a single sentence.',
        ],
      },
      home: {
        art: 'earth',
        simple: [
          'On the way home, {child} watched Earth get big again. All that blue. All that water.',
          'The ship came down through the clouds. The window was warm.',
        ],
        rich: [
          'On the way back, Earth grew from a marble to a world, and {child} pressed both hands against the glass at the sheer amount of blue.',
          'They came down through cloud, and the window went warm, and somewhere beneath all that weather was a house with the porch light on.',
        ],
      },
      goodnight: {
        art: 'moon',
        simple: [
          '{child} got into bed. The stars were still out there, doing their work. Goodnight, {child}.',
          'Somewhere far above, a tiny green shoot was growing in the dark. Sleep well.',
        ],
        rich: [
          '{child} got into bed under an ordinary ceiling, while the stars carried on above it, patient and busy. Goodnight, {child}.',
          'Far away on {place}, one small green shoot kept growing in the dark, entirely unsupervised. Sleep well, astronaut.',
        ],
      },
    },
  },

  ocean: {
    id: 'ocean',
    label: 'Ocean',
    emoji: '🐋',
    blurb: 'Deep water, slow whales, and things that glow.',
    titles: ['{child} and the Whale Who Sang Off-Key', 'The Light at the Bottom', 'The Tide That Waited'],
    friends: ['an old sea turtle named Tell', 'a small octopus with big plans', 'a whale calf learning to sing', 'a crab who ran a lost-and-found'],
    places: ['the Kelp Forest', 'the Deep Blue Shelf', 'the Coral Town', 'the Whale Road'],
    things: ['a pearl the size of a pea', 'a bell from a sunken ship', 'a message in a bottle', 'a shell that held a voice'],
    vocabulary: [
      { word: 'current', meaning: 'water in the sea that moves in one direction, like a river' },
      { word: 'glow', meaning: 'to give off a soft steady light' },
      { word: 'shallow', meaning: 'not very deep' },
    ],
    beats: {
      call: {
        art: 'shore',
        simple: [
          'The sea left {thing} on the sand. {child} picked it up. It was still warm.',
          'At the edge of the water, {child} heard singing. It came from far out and far down.',
        ],
        rich: [
          'The tide went out and left {thing} behind on the wet sand, still warm, as though it had been carried by someone in a hurry.',
          'Standing ankle-deep, {child} heard singing — low and long, from somewhere far out and very far down.',
        ],
      },
      journey: {
        art: 'dive',
        simple: [
          '{child} took a big breath and went under. The water was green, then blue, then dark blue.',
          'Down past {place}, the fish moved like one big silver cloud.',
        ],
        rich: [
          '{child} took the biggest breath in the world and went under, through green water into blue water into the deep blue that has no name.',
          'Past {place}, ten thousand fish turned all at once, like one enormous silver thought changing its mind.',
        ],
      },
      trouble: {
        art: 'dark',
        simple: [
          'Then the light ran out. It was very dark and very cold. {child} did not know which way was up.',
          'A net was tangled in the rocks. Something was stuck inside it.',
        ],
        rich: [
          'Then the light gave up entirely, and it was dark and cold, and {child} could not tell up from down, which is the oldest fear there is.',
          'A torn net had snagged on the rocks, and something inside it was struggling, and had been for a long time.',
        ],
      },
      helper: {
        art: 'friend',
        simple: [
          'A soft light came close. It was {friend}. "Bubbles go up," it said. "Always."',
          '{friend} swam beside {child}. "Slow hands," it said. "Fast hands make knots tighter."',
        ],
        rich: [
          'A soft light drifted close, and it was {friend}. "Watch your bubbles," it said. "Bubbles always know which way is up. Follow them."',
          '{friend} came alongside and said, "Slow hands. Fast hands only tighten knots. Ask me how I know."',
        ],
      },
      turn: {
        art: 'free',
        simple: [
          'Together they pulled the net loose. The whale calf swam free. It sang a wobbly thank-you.',
          '{child} followed the bubbles up and up until the water turned bright again.',
        ],
        rich: [
          'They worked the net loose strand by strand, and the whale calf slid free and sang a thank-you so off-key that {child} laughed out loud underwater, which wastes air but was worth it.',
          '{child} followed the bubbles up, and the dark thinned to blue, and the blue thinned to green, and then there was sky.',
        ],
      },
      resolve: {
        art: 'whales',
        simple: [
          'The whales came to say thank you. They were bigger than houses. They were very gentle.',
          '{child} held {thing} up. The whole pod hummed at once. The water shook.',
        ],
        rich: [
          'The pod came to say thank you — animals bigger than houses, moving with the care of someone carrying a full cup across a room.',
          '{child} held {thing} up, and the entire pod hummed at once, and the water itself trembled with it.',
        ],
      },
      home: {
        art: 'boat',
        simple: [
          '{friend} brought {child} back to the shallow water. The sand was warm underfoot.',
          'The sun was low. The waves pushed {child} gently toward home.',
        ],
        rich: [
          '{friend} escorted {child} back to the shallows, where the sand was warm and the world was simple again.',
          'The sun sat low and orange on the water, and every wave gave {child} a small push toward home, as though the sea had decided that was enough for one day.',
        ],
      },
      goodnight: {
        art: 'moon',
        simple: [
          '{child} went to bed with salt still in their hair. Far out, the whales kept singing. Goodnight, {child}.',
          'The tide came in slowly. {child} was already asleep. Sleep well, deep diver.',
        ],
        rich: [
          'Salt still in the hair, sand still in the socks. Far out past the shelf, the whales kept singing all night, off-key and unbothered. Goodnight, {child}.',
          'The tide came back in, patient as ever, and found {child} already asleep. Sleep well, diver.',
        ],
      },
    },
  },

  dinosaurs: {
    id: 'dinosaurs',
    label: 'Dinosaurs',
    emoji: '🦕',
    blurb: 'Big feet, small mammals, and a very long time ago.',
    titles: ['{child} and the Long-Neck Herd', 'The Egg in the Fern Valley', 'Footprints Bigger Than Beds'],
    friends: ['a young Triceratops named Bump', 'a feathered raptor with one white wing', 'a wise old Diplodocus', 'a tiny early mammal called Pip'],
    places: ['the Fern Valley', 'the Ash Plain', 'the Warm River Bend', 'the Cliff of Nests'],
    things: ['a speckled egg', 'a tooth as big as a hand', 'a fern frond that never wilted', 'a smooth river stone'],
    vocabulary: [
      { word: 'herd', meaning: 'a big group of animals that stay together' },
      { word: 'fossil', meaning: 'the shape of a living thing left in stone for millions of years' },
      { word: 'hatch', meaning: 'to break out of an egg' },
    ],
    beats: {
      call: {
        art: 'egg',
        simple: [
          'In {place}, {child} found {thing}. It was warm. Something inside it moved.',
          'The ground shook — thump, thump, thump. Something very big was walking toward {place}.',
        ],
        rich: [
          'Down in {place}, half-hidden under ferns, {child} found {thing}. It was warm to the touch, and then — unmistakably — something inside it moved.',
          'The ground kept time: thump, thump, thump. Something the size of a house was walking toward {place}, and it was in no particular hurry.',
        ],
      },
      journey: {
        art: 'valley',
        simple: [
          '{child} carried it carefully through the tall ferns. The air smelled green and wet.',
          'They walked past the big footprints. Each one was deeper than a bathtub.',
        ],
        rich: [
          '{child} carried it in both arms through ferns taller than doorways, in air that smelled green and wet and impossibly old.',
          'They passed a line of footprints, each one deeper than a bathtub, filled with rainwater and small darting fish.',
        ],
      },
      trouble: {
        art: 'storm',
        simple: [
          'Then the sky went dark and the wind came fast. The herd started to run the wrong way.',
          'The river rose. The way back was gone. {child} was on the wrong side.',
        ],
        rich: [
          'Then the sky bruised over and the wind came in sideways, and the herd panicked and ran — the wrong way, toward the cliffs.',
          'The river rose fast and brown, and the crossing simply was not there any more, and {child} was on the wrong side of it.',
        ],
      },
      helper: {
        art: 'friend',
        simple: [
          '{friend} came close and knelt down low. "Climb up," it said. "I know the high path."',
          'A small voice said, "Follow me." It was {friend}, no bigger than a cat, and not at all afraid.',
        ],
        rich: [
          '{friend} shouldered through the ferns and knelt down low. "Climb up," it said. "I know the high path. I have used it twice and survived both times."',
          'A small voice said "Follow me" from around ankle height. It was {friend} — no bigger than a cat, and entirely unimpressed by the weather.',
        ],
      },
      turn: {
        art: 'crossing',
        simple: [
          '{friend} led them along the ridge. {child} held on tight. They got past the water.',
          'The herd heard {friend} calling and turned around. They all went the right way together.',
        ],
        rich: [
          '{friend} took the ridge slowly, one careful foot at a time, and {child} held on with both hands until the flooded valley was safely behind them.',
          'The herd heard {friend} calling and swung around — forty tonnes of animal changing its mind at once — and went the right way after all.',
        ],
      },
      resolve: {
        art: 'hatch',
        simple: [
          'In the morning the egg cracked open. A tiny head poked out and looked right at {child}.',
          'The storm passed. The valley was green again. Everyone was safe.',
        ],
        rich: [
          'By morning the shell had cracked, and a small wet head pushed out, blinked twice, and looked directly at {child} as though they had an appointment.',
          'The storm moved off east, the valley steamed in the new sun, and every single member of the herd was accounted for.',
        ],
      },
      home: {
        art: 'home',
        simple: [
          '{child} gave the baby back to the herd. The big ones made a low rumble. It meant thank you.',
          'The sun came up over {place}. It was warm on {child}\'s back all the way home.',
        ],
        rich: [
          '{child} handed the hatchling back to the herd, and the adults made a low rumble deep in their chests that you felt in your ribs before you heard it. It meant thank you.',
          'The sun came up over {place} and stayed warm on {child}\'s back the whole way home.',
        ],
      },
      goodnight: {
        art: 'moon',
        simple: [
          'That was a very long time ago. But the stars were the same ones. Goodnight, {child}.',
          '{child} closed their eyes and heard thump, thump, thump — far away, and getting softer. Sleep well.',
        ],
        rich: [
          'All of that happened a very, very long time ago. But the stars overhead were the same stars, which is a comforting thing to know. Goodnight, {child}.',
          '{child} closed their eyes and heard it still — thump, thump, thump — far off across the valley, getting softer. Sleep well, small explorer.',
        ],
      },
    },
  },

  kindness: {
    id: 'kindness',
    label: 'Kindness',
    emoji: '💛',
    blurb: 'Small good things that turn out to be big.',
    titles: ['The Smallest Kindness in Town', '{child} and the Bench by the Gate', 'What the New Kid Needed'],
    friends: ['a neighbour called Mrs Okonjo', 'a shy new kid named Sam', 'a lonely old dog', 'the baker on the corner'],
    places: ['the corner shop', 'the park by the bridge', 'the school gate', 'the old bench on Hill Street'],
    things: ['half a sandwich', 'a spare umbrella', 'a drawing folded in four', 'a seat saved on purpose'],
    vocabulary: [
      { word: 'kindness', meaning: 'doing something good for someone without needing anything back' },
      { word: 'lonely', meaning: 'feeling sad because you are by yourself' },
      { word: 'notice', meaning: 'to see something that other people walk past' },
    ],
    beats: {
      call: {
        art: 'town',
        simple: [
          'At {place}, {child} saw someone sitting alone. Everyone else walked past.',
          'It was raining hard at {place}. One person had no coat.',
        ],
        rich: [
          'At {place}, someone was sitting alone, and the whole world walked past without looking. {child} looked.',
          'The rain came down at {place} in the serious way, and one person stood in it without a coat, pretending not to mind.',
        ],
      },
      journey: {
        art: 'walk',
        simple: [
          '{child} was not sure what to do. Helping felt scary. Doing nothing felt worse.',
          '{child} thought about it all the way home. The thought would not go away.',
        ],
        rich: [
          '{child} stood there weighing it up. Helping felt embarrassing and enormous. Doing nothing felt smaller and much, much worse.',
          'The thought followed {child} all the way home, up the stairs, and into bed, where it sat on the end of the duvet and refused to leave.',
        ],
      },
      trouble: {
        art: 'doubt',
        simple: [
          'Someone laughed. {child}\'s face went hot. It felt like the wrong thing to do.',
          'The first try did not work. The person said no thank you and looked away.',
        ],
        rich: [
          'Someone laughed — not cruelly, but loudly — and {child}\'s face went hot, and for a moment the whole thing seemed like a terrible idea.',
          'The first attempt landed badly. "No thank you," they said, and looked at the ground, and {child} did not know what to do with their hands.',
        ],
      },
      helper: {
        art: 'friend',
        simple: [
          '{friend} said, "Try again tomorrow. Kind things often need two tries."',
          '{friend} said quietly, "You do not have to fix it. You just have to stay."',
        ],
        rich: [
          '{friend} said, "Try again tomorrow. Kind things nearly always need a second go. The first one is just knocking."',
          '{friend} said, quietly, "You do not have to fix anything. You only have to stay. Most people leave, and that is the whole problem."',
        ],
      },
      turn: {
        art: 'share',
        simple: [
          'So {child} came back. This time {child} just sat down and said nothing at all.',
          '{child} left {thing} on the bench and walked away. The next day it was gone, and there was a note.',
        ],
        rich: [
          'So {child} came back the next day, and did not offer advice, and did not make a speech. {child} just sat down on the same bench and stayed there.',
          '{child} left {thing} on the bench and walked off without waiting to be thanked. The next day it was gone, and in its place was a note folded very small.',
        ],
      },
      resolve: {
        art: 'together',
        simple: [
          'They talked a little. Then they talked a lot. By Friday they were friends.',
          'Other people started doing it too. Then it was just how things were at {place}.',
        ],
        rich: [
          'They talked a little on Tuesday, and a lot by Thursday, and by Friday there was laughing, which is how you know.',
          'Then someone else did the same thing. Then someone else. Within a month it was simply how {place} worked, and nobody could remember it being otherwise.',
        ],
      },
      home: {
        art: 'home',
        simple: [
          '{child} did not tell anyone. It felt good anyway. Maybe better.',
          'At dinner {child} smiled at nothing. Nobody asked why.',
        ],
        rich: [
          '{child} never told anyone, which somehow made it better rather than worse — a good thing kept warm instead of spent.',
          'At dinner {child} smiled at nothing in particular, and nobody asked why, and that was fine.',
        ],
      },
      goodnight: {
        art: 'moon',
        simple: [
          'You are the kind of person who notices, {child}. That is worth more than you know. Goodnight.',
          'Small kind things add up. {child} did one today. Sleep well.',
        ],
        rich: [
          'You are the kind of person who notices, {child}. That is rarer and worth more than almost anything else you could be. Goodnight.',
          'Kindness is not one big moment. It is a hundred small ones, and {child} added one today. Sleep well.',
        ],
      },
    },
  },

  bravery: {
    id: 'bravery',
    label: 'Bravery',
    emoji: '🦁',
    blurb: 'Being scared and going anyway.',
    titles: ['{child} and the Thing in the Dark', 'The Day {child} Went First', 'Louder Than the Worry'],
    friends: ['a scruffy dog named Rooster', 'a firefighter called Dez', 'a girl who had done it before', 'an old coach with a whistle'],
    places: ['the high diving board', 'the dark end of the hallway', 'the stage in the school hall', 'the deep end'],
    things: ['a lucky bottle cap', 'a note in a pocket', 'a whistle on a string', 'a pair of worn-out trainers'],
    vocabulary: [
      { word: 'brave', meaning: 'feeling afraid and choosing to do it anyway' },
      { word: 'nervous', meaning: 'worried and fluttery about something coming up' },
      { word: 'practice', meaning: 'doing something again and again until it gets easier' },
    ],
    beats: {
      call: {
        art: 'stage',
        simple: [
          'Tomorrow was the day. {child} had to stand at {place} in front of everyone.',
          '{child} had said yes last week. Now it was tonight, and yes felt much bigger.',
        ],
        rich: [
          'Tomorrow was the day. {place}, in front of everyone, with nowhere to hide and no way to un-volunteer.',
          'Saying yes had been easy last week. Tonight, with the thing actually arriving, yes had grown considerably in size.',
        ],
      },
      journey: {
        art: 'night',
        simple: [
          '{child} could not sleep. The worry got louder at night. It always does.',
          '{child} practised in the mirror. It sounded fine there. It would not sound fine tomorrow.',
        ],
        rich: [
          '{child} lay awake while the worry got louder, which is what worry does at night — it turns the volume up because it knows nobody else is listening.',
          '{child} practised in the mirror, where it sounded fine. Mirrors are generous. Crowds are not.',
        ],
      },
      trouble: {
        art: 'freeze',
        simple: [
          'When the moment came, {child} froze. Everything went quiet and very loud at the same time.',
          '{child} got halfway and stopped. Legs would not move. Everyone was waiting.',
        ],
        rich: [
          'And when the moment came, {child} froze solid. The room went silent and deafening at once, the way it does.',
          '{child} got halfway and stopped dead. The legs simply declined. Everyone was waiting, which made it worse, which made the legs worse.',
        ],
      },
      helper: {
        art: 'friend',
        simple: [
          '{friend} said, "You are not broken. Scared is normal. Do it scared."',
          '{friend} said, "Count three breaths. Then just do the first small bit."',
        ],
        rich: [
          '{friend} leaned in and said, "Nothing has gone wrong. Scared is the normal price. You do it scared or you do not do it at all."',
          '{friend} said, "Three breaths. Then only the first small bit. Not the whole thing — nobody can do the whole thing. Just the first bit."',
        ],
      },
      turn: {
        art: 'step',
        simple: [
          'So {child} took one breath. Then one step. Then another one.',
          '{child} held {thing} tight and started. The first word was the hardest. The rest came out fine.',
        ],
        rich: [
          'So {child} took one breath, and then one step, and discovered the thing nobody tells you: after the first step, the rest are ordinary.',
          '{child} gripped {thing} hard enough to leave a mark and began. The first word cost everything. The rest were free.',
        ],
      },
      resolve: {
        art: 'cheer',
        simple: [
          'It was over fast. People clapped. {child} was shaking and grinning at the same time.',
          'It was not perfect. It did not need to be. {child} did it.',
        ],
        rich: [
          'It was over far faster than it had any right to be. People clapped. {child} shook and grinned simultaneously, which is the correct response to surviving something.',
          'It was not perfect. There was a wobble in the middle and a bit that got skipped. It did not matter even slightly. {child} did it.',
        ],
      },
      home: {
        art: 'home',
        simple: [
          'All the way home {child} kept feeling it again. That good, tired, proud feeling.',
          '{child} put {thing} back in a pocket. It had done its job.',
        ],
        rich: [
          'All the way home {child} kept replaying it, and each time it got a little easier to believe. That good, shaky, tired kind of proud.',
          '{child} put {thing} back in the pocket where it lived. It had done its job, which was mostly to be held.',
        ],
      },
      goodnight: {
        art: 'moon',
        simple: [
          'The next scary thing will be easier. That is how it works. Goodnight, {child}.',
          'Brave is not a feeling. Brave is a choice. {child} made it today. Sleep well.',
        ],
        rich: [
          'The next scary thing will be a little easier, and the one after that easier still. That is genuinely how it works. Goodnight, {child}.',
          'Brave was never a feeling. Brave is what you call it when someone goes anyway. {child} went. Sleep well.',
        ],
      },
    },
  },

  calm: {
    id: 'calm',
    label: 'Calm & sleepy',
    emoji: '🌙',
    blurb: 'Slow, soft, and built to end in sleep.',
    titles: ['The Slow Boat', 'Everything Is Putting Itself Away', 'The House That Breathed'],
    friends: ['a sleepy grey cat', 'the moon, keeping watch', 'a lamplighter on a long street', 'an owl with nothing urgent to do'],
    places: ['the still lake', 'the long quiet field', 'the room at the top of the house', 'the harbour at low tide'],
    things: ['a soft grey blanket', 'a warm cup', 'a single lit window', 'a slow ticking clock'],
    vocabulary: [
      { word: 'still', meaning: 'not moving at all, completely quiet' },
      { word: 'drift', meaning: 'to move slowly and gently, without trying' },
      { word: 'rest', meaning: 'to stop and let your body get strong again' },
    ],
    beats: {
      call: {
        art: 'dusk',
        simple: [
          'The day is finished now. It did everything it needed to do.',
          'Outside, {place} has gone quiet. The light is going soft and orange.',
        ],
        rich: [
          'The day has finished its work. It did what it needed to, and now it is setting down its tools one by one.',
          'Out at {place}, the noise has drained away, and the light has gone soft and low and orange at the edges.',
        ],
      },
      journey: {
        art: 'lamp',
        simple: [
          'One by one, the lights are going out. First the shops. Then the street. Then the houses.',
          'The birds have stopped. The wind has sat down. Everything is slowing.',
        ],
        rich: [
          'One by one the lights go out — the shops first, then the long street, then the windows of the houses, until only one is left, and that one is yours.',
          'The birds have finished. The wind has sat down in the long grass. Everything is slowing to the speed of breathing.',
        ],
      },
      trouble: {
        art: 'thought',
        simple: [
          'Sometimes a busy thought comes. That is alright. Let it float past like a leaf.',
          'If your body feels wriggly, that is alright too. It is just letting the day out.',
        ],
        rich: [
          'Sometimes a busy thought arrives at exactly the wrong hour. That is alright. You do not have to chase it. Let it float past like a leaf on slow water.',
          'If the body feels wriggly, that is alright too. That is just today leaving, one fidget at a time.',
        ],
      },
      helper: {
        art: 'friend',
        simple: [
          '{friend} is here. {friend} is not worried about anything at all.',
          'Breathe in slowly. Hold it. Now let it go, longer than you took it in.',
        ],
        rich: [
          '{friend} is here, curled and unhurried, worried about absolutely nothing, which is a skill worth copying.',
          'Breathe in slowly, and hold it a moment, and let it out longer than you took it in. Again. That is all there is to it.',
        ],
      },
      turn: {
        art: 'soft',
        simple: [
          'Feel your feet get heavy. Then your legs. Then your arms.',
          'The blanket is warm. The pillow is cool. Both of those are good.',
        ],
        rich: [
          'Feel the feet get heavy first, then the legs, then the arms, as though someone is gently turning down a dial from the bottom up.',
          'The blanket is warm and the pillow is cool, and your body is exactly the right temperature in exactly the right place.',
        ],
      },
      resolve: {
        art: 'boat',
        simple: [
          'Now you are on a slow boat on {place}. It goes where it likes. You do not have to steer.',
          'The water is smooth. The boat rocks a little. A little. A little.',
        ],
        rich: [
          'Now there is a slow boat on {place}, and you are in it, and it goes wherever it likes, and you do not have to steer or decide or hurry.',
          'The water is smooth as a table. The boat rocks a little. A little. A little less.',
        ],
      },
      home: {
        art: 'home',
        simple: [
          'Everyone you love is safe tonight. The doors are shut. The house is warm.',
          'Nothing needs doing now. Not one thing until morning.',
        ],
        rich: [
          'Everyone you love is safe tonight, and the doors are shut, and the house is warm, and it will still be warm in the morning.',
          'There is nothing left that needs doing. Not one single thing between here and the morning.',
        ],
      },
      goodnight: {
        art: 'moon',
        simple: [
          'Goodnight, {child}. I love you. Sleep now.',
          'Sleep well, {child}. I will be here. Goodnight.',
        ],
        rich: [
          'Goodnight, {child}. You are loved, completely and without conditions, and you can stop now. Sleep.',
          'Sleep well, {child}. I am here, and I will still be here, and there is nothing left to hold. Goodnight.',
        ],
      },
    },
  },
};

export const TOPIC_LIST: { id: StoryTopic; label: string; emoji: string; blurb: string }[] = [
  ...Object.values(PACKS).map((p) => ({ id: p.id, label: p.label, emoji: p.emoji, blurb: p.blurb })),
  {
    id: 'heartfelt',
    label: 'Heartfelt',
    emoji: '💌',
    blurb: 'Not a story — a message. For the nights you had to work.',
  },
];
