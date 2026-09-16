# Story Station

**Bedtime stories, lullabies and learning — read in your own voice, whether or not you can be there.**

You're on nights. You're over the road. You're doing a double. You're in the next room with your
hands full, or you're right there on the sofa and completely out of road. Your kid still goes to
bed at 7:30. Story Station is how you're still the one who reads the story.

One app, two sides. You sign in as the grown-up, teach it your voice once, and send stories.
Your child signs in on their own device and — at their bedtime, every night — gets a notification,
opens an illustrated book, and hears **you** read it.

---

## The deal, in one paragraph

Record **ten short songs** — most under a minute. That is the only recording you ever have to do.
After that, every bedtime story, learning book and lullaby in the app reads itself **in your voice**,
and auto-pilot sends one every night without you touching it. Your child opens the app at bedtime
and watches the words light up as you read them.

---

## The four shelves

| Shelf | What's on it |
|---|---|
| **Bedtime stories** | Six books written to slow a child down. One is about a lighthouse keeper who works nights on purpose. |
| **Learning books** | Eight books that teach letters, counting, colours, opposites, feelings, days of the week, shapes and how slow things grow — hidden inside a bedtime story. |
| **Songs** | Eight songs that teach: the alphabet, counting to twenty, body parts, animal sounds, days, colours. All traditional or written for this app — provenance recorded in the file. |
| **Lullabies** | Ten public-domain lullabies, plus six synthesised sleep sounds and a fade-out timer. |

Every one of them is a **read-along**: the words light up as the voice says them, like a finger
moving under the line, and the pages turn themselves. Tap a word to jump there.

---

## What it actually does

### The grown-up side

| | |
|---|---|
| **Recording studio** | Record the ten. **Hear it first** so you know how it goes, or **hear it in your headphones while you record** as a prompt. The words light up as you read. Each take is scored on-device (too quiet, clipping, dead air) with a plain-English fix. |
| **Voice Studio** | Builds your voice from those recordings. Explicit typed consent is required before a single sample leaves the phone. |
| **Auto-pilot** | On by default. Every night it picks something you haven't sent recently and queues it, preferring things you recorded yourself. Works with no signal. |
| **Story Builder** | Pick the child, the topic, the tone, the length. Add a personal message that gets spoken in your voice before the story starts. Schedule it for bedtime or send it right now. |
| **Heartfelt messages** | Seven templates for the things you actually need to say and aren't there to say: *I had to work tonight*, *I'm proud of you*, *I owe you an apology*, *Big day tomorrow*. The templates carry the shape; your own typed words carry the weight, and they're spoken exactly as you wrote them. |
| **Read it yourself** | Skip the AI entirely. Record yourself reading the whole story in one take. Highest fidelity there is, costs nothing. |
| **Lullabies** | Ten public-domain lullabies plus "your own words", sent in your voice or sung by you. |
| **Library** | Everything you've sent, whether it was played, and how many times. Plus the voice messages your kid recorded back to you. |
| **Archive** | Every night, grouped by week, kept forever. Nothing is ever auto-deleted. |
| **Progress** | What your child has genuinely retained — not what they tapped today. |

### The child side

| | |
|---|---|
| **Tonight's story** | One big play button. Illustrated pages that turn themselves in time with the narration. |
| **Talk back** | One button, hold it, say anything. It lands in the parent's library. This is the feature parents cry about. |
| **Lullabies** | Play on repeat, six synthesised sleep sounds, and a timer that fades everything out instead of cutting it. |
| **Bookshelf** | Every story ever sent, grouped by week, kept forever, playable offline. |
| **Twelve learning games** | Grouped into Reading, Numbers, Thinking and Talking. For the nights they still have energy. |
| **Read-along** | Words light up in time with the voice on every book and song. If the device has no reading voice installed, they still light up at reading pace so you can read it together. |

---

## The games are not brain fog

That was the requirement, so it drove the design. The twelve games were chosen from what the
evidence actually supports, not what demos well.

**Reading** — phonemic blending, segmenting and manipulation predict later reading better than
anything else measured in early childhood, and better than rhyming, so they lead the list:

| Game | What it trains |
|---|---|
| **Sound Detective** | Blending: hear `/s/ /u/ /n/`, name the word |
| **Sound Swap** | Manipulation: "say *cat* without the /k/" — the hardest and most predictive |
| **Rhyme Time** | Rhyme, as the on-ramp to hearing sound inside words |
| **Word Builder** | Segmenting: build the word from its sounds |
| **Sight Words** | High-frequency words that can't be sounded out |
| **Story Detective** | Comprehension, from the story heard tonight |

**Numbers** — *Number Jump*: addition and subtraction on a visible number line, not flashcards.

**Thinking** — inhibitory control predicts school readiness and contributes independently to early
maths, letter knowledge and phonemic awareness, so it gets its own games rather than being a side
effect:

| Game | Paradigm |
|---|---|
| **Freeze!** | Go/No-Go — tap the category, withhold on the exception. *Not* tapping scores as much as tapping |
| **Opposite Day** | Day/night Stroop — the obvious answer is always wrong |
| **Sort It Twice** | Card sort where the rule flips mid-round (cognitive flexibility) |
| **What Comes Next** | Pattern and sequence rules |

**Talking** — **Story Talk** is the flagship. Shared reading builds language most when a grown-up
asks open questions and the child answers aloud (the CROWD prompts of dialogic reading). The parent
isn't there to ask — so the story pauses, asks in *their* voice, and the child's spoken answer is
recorded and sent back to them. Nothing is graded. Being asked and answering *is* the intervention.

Every game obeys three rules:

1. **You cannot win by tapping fast.** Every question has exactly one right answer that requires
   reading, sounding out, counting, or remembering. No timers that reward panic, no points for noise.
2. **Getting it wrong teaches something.** A wrong answer holds on screen for 2.4 seconds with a
   plain-language explanation, not a buzzer.
3. **What you learn, you keep.** Every item is tracked by an SM-2 spaced-repetition scheduler
   (`app/src/lib/srs.ts`). Miss a word and it comes back in three minutes. Nail it repeatedly and it
   moves out to days, then weeks. The parent's Progress screen reports *mastery* — items that
   survived to a week-long interval — not raw taps.

There are no streaks-as-hooks, no loot boxes, no currency, and no infinite scroll. There is a
daily minute cap and an optional "story before games" lock, both off by default and both the
parent's call.

**Sources for the above:**
[dialogic reading systematic review](https://reachoutandread.org/wp-content/uploads/2023/06/Pillinger_2022_A-story-so-far-A-systematic-review-of-the-dialogic-reading-literature.pdf) ·
[phonological awareness and reading](https://www.readingrockets.org/topics/phonological-and-phonemic-awareness/articles/phonological-awareness-instructional-and) ·
[components of phonological awareness](https://link.springer.com/article/10.1007/BF01027184) ·
[executive function through games (NAEYC)](https://www.naeyc.org/resources/pubs/yc/summer2024/executive-function-games) ·
[executive function training in preschoolers](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC6734167/)

---

## Selling it: customers never sign up for anything but you

**A customer needs one account, and it's yours.** No ElevenLabs account, no Anthropic account, no
API keys, no "paste this token into Settings." They enter an email and a 4-digit PIN and start a
free trial.

That works because every paid capability runs **server-side against your provider accounts**:

```
Parent's phone ──▶ your server ──▶ ElevenLabs   (voice cloning + narration)
                        │
                        └────────▶ Anthropic    (story writing)
```

You put `ELEVENLABS_API_KEY` and `ANTHROPIC_API_KEY` in the server's environment once. The app has
no idea those services exist — `grep -ri elevenlabs app/src` returns nothing.

**Metering is built in**, because those calls cost you real money. `server/src/entitlements.ts`
tracks the three things that actually bill — narrated characters, stories written, and cloned voice
slots — per family, per period:

| Plan | Price | Narration | Stories | Voices |
|---|---|---|---|---|
| Free trial | — | 20k chars (~5 stories) | 8 | 1 |
| Family | £12.99/mo | 120k chars | 30 | 2 |
| Family, yearly | £99/yr | 120k chars | 30 | 2 |
| Lifetime | £249 | 120k chars/mo | 30 | 3 |

**Replays are free and unlimited.** Only *creating* new narration is metered, and the recorded
library is generated once per voice and then replayed forever. That is what makes the unit
economics work — see `docs/PRICING.md`.

Edit that file to change pricing or limits. Hitting a limit returns HTTP 402 and the app routes the
parent to the plan screen instead of showing an error.

**Payments are optional until you want them.** Stripe Checkout is wired up (`/billing/checkout`,
signature-verified webhook at `/billing/webhook`), but with no Stripe keys the server still runs
and you grant plans by hand:

```bash
curl -X POST https://api.your-domain.com/admin/plan \
  -H "x-admin-token: $ADMIN_TOKEN" -H 'Content-Type: application/json' \
  -d '{"email":"parent@example.com","plan":"family"}'
```

That's enough to pilot with real families and take money by invoice before you touch Stripe.

---

## Three honest limitations

**1. Your provider bill scales with usage.** A ~4 minute story is roughly 4,000 characters of
narration. The Family plan's 400k characters is about 100 stories a month — price it against
ElevenLabs' current per-character rate before you launch, not after.

**2. The app degrades rather than failing.** If your ElevenLabs key is missing, rate-limited or out
of credit, stories still get written, still get delivered, and still get read aloud by the child's
device — and the parent is told plainly. **Everywhere a device-narrated story appears, the app says
"Device narrator — not a real voice."** It never lets a child believe they're hearing their parent
when they aren't, and it never leaks your billing state to a customer's phone.

**3. Story writing works with no network at all.** The built-in engine (`app/src/lib/story/`) is a
hand-written eight-beat narrative system with seven topic packs, two reading registers and five
tones. The app always generates a story locally and sends it as a fallback; your server upgrades it
with Claude when it can. If that call fails at 7:30pm, the fallback ships. Bedtime doesn't wait for
an API.

---

## Getting the APK

The APK is built by GitHub Actions, because that's where the Android SDK lives.

1. Push to any branch, or open the **Actions** tab → **Build Android APK** → **Run workflow**.
2. When it finishes, download the `story-station-apk-<n>` artifact from the run summary.
3. Unzip, move `story-station-debug-*.apk` to the phone, and open it. Android will ask you to allow
   installing from unknown sources — that's expected for a sideloaded APK.

**For a signed release build** (needed for the Play Store), add four repository secrets and the
workflow builds and signs `story-station-release-*.apk` automatically:

| Secret | What it is |
|---|---|
| `ANDROID_KEYSTORE_BASE64` | `base64 -w0 release.keystore` |
| `ANDROID_KEYSTORE_PASSWORD` | Keystore password |
| `ANDROID_KEY_ALIAS` | Key alias |
| `ANDROID_KEY_PASSWORD` | Key password |

Push a `v*` tag and the APKs are attached to a GitHub Release.

### Building it locally instead

Needs Node 22+ (the Capacitor CLI requires it), JDK 21 and the Android SDK.

```bash
cd app
npm install
npm run build
npx cap sync android
cd android && ./gradlew assembleDebug
# app/android/app/build/outputs/apk/debug/app-debug.apk
```

### Pointing a build at your server

```bash
cd app
cp .env.example .env          # set VITE_API_URL to your server
VITE_API_URL=https://api.your-domain.com npm run build
```

`VITE_API_URL` is baked in at build time. When it's set, the app never shows a server-address field
to anyone — customers just sign in. Leave it unset and the build is self-hosted mode, where the
parent supplies the address themselves.

### Running it as a website

It's a PWA, so it works on iPhone too — no APK, no store, just a URL:

```bash
cd app && npm install && npm run dev      # http://localhost:5173
npm run build && npm run preview          # production bundle
```

Deploy `app/dist/` to any static host. On iOS, Share → Add to Home Screen.
Caveat: scheduled nightly notifications are Android-only; the web build can only notify while
the tab is alive.

---

## Running the sync server

```bash
./server/scripts/setup.sh          # creates .env, builds, tests, pre-flight report
# put your ELEVENLABS_API_KEY in server/.env, then:
cd server && npm run doctor        # calls the providers and proves the setup works
npm start                          # or: docker compose up -d   (adds TLS via Caddy)
```

`npm run doctor` is the one to remember. It calls ElevenLabs, confirms the key works, confirms the
plan includes Instant Voice Cloning, and reports how many stories your remaining quota is worth. It
exits non-zero on anything that would break the product, so it works as a deploy gate.

Deployment configs for Docker Compose, Fly, Render and bare systemd are in `server/deploy/`. Full
walkthrough in [docs/DEPLOY.md](docs/DEPLOY.md).

**One instance only** — SQLite has a single writer.

Every variable is documented in `server/.env.example`. The two that unlock the paid features are
`ELEVENLABS_API_KEY` (voice cloning and narration) and `ANTHROPIC_API_KEY` (bespoke story writing).
Without them the server still runs — `/account` reports `capabilities.voiceCloning: false` and the
app tells parents plainly that voice building is offline rather than failing at bedtime.

Then in the app: **Settings → Sync**, enter the server address, create a cloud account. You'll get
a six-character family code. Type that code plus your child's own 4-digit code into their tablet
once (**"This is my child's device"** on the welcome screen) and it's paired for good.

Run the tests — they cover the full parent-to-child path, quota enforcement, plan grants and
cross-family isolation:

```bash
cd server && npm test     # 31 tests
```

**Security notes.** PINs are four digits because a sleepy parent and a six-year-old have to type
them; the server compensates with per-identity scrypt (N=16384) and rate limiting, and login
responses never confirm whether an email exists. Every query is scoped to the caller's family and a
child can only ever read their own stories. Provider errors are logged in full server-side but
returned to the app as generic "temporarily unavailable" messages, so a customer's phone never
learns about your billing state. Stripe webhooks are HMAC-verified against the raw body with a
five-minute replay window; the admin token is compared in constant time.

---

## Layout

```
app/                      Mobile app — React + TypeScript + Vite + Capacitor
  src/lib/
    config.ts             Build-time API URL — what makes the app sellable
    voice/                Narration routes: managed clone, self-recorded, device narrator
    story/                Offline story engine — topic packs, generator, heartfelt templates
    srs.ts                Spaced repetition (SM-2) and skill grouping
    audio.ts              Recording, live level metering, on-device quality scoring
    ambient.ts            Six sleep sounds synthesised with Web Audio — no assets
    cloud.ts              API client
    useCloud.ts           Sync, shared account state, family journal
    delivery.ts           Compose → narrate → schedule → deliver
  src/data/               Lullabies (public domain) and all game word lists
  src/games/              The twelve learning games
  src/components/         Design system, icons, procedural SVG story art
  src/screens/            parent/ child/ auth/
  android/                Native Android project (generated, committed)
  tools/                  Procedural icon, splash and notification-icon renderers
server/
  src/entitlements.ts     Plans, quotas, usage — edit this to change pricing
  src/providers.ts        ElevenLabs + Anthropic, held server-side
  src/routes-voice.ts     Enrollment against your provider account
  src/routes-content.ts   Story composition, lullaby narration, family journal
  src/routes-billing.ts   Stripe checkout, webhook, admin plan grants
.github/workflows/        APK build + CI
```

### A note on the artwork

Every illustration is drawn as SVG at runtime from a seed derived from the story id
(`app/src/components/StoryArt.tsx`), so a child re-reading a story always sees the same pictures,
nothing is fetched, and it works on a plane at 3am. The app icon, splash screens and notification
icon are rasterised by a hand-written PNG encoder in `app/tools/` — no ImageMagick, no design
tools, reproducible in CI.

---

## Adding a new story topic

1. Add a pack to `PACKS` in `app/src/lib/story/packs.ts` — titles, friends, places, things,
   vocabulary, and text for all eight beats in both `simple` and `rich` registers.
2. That's it. It appears in the Story Builder, generates comprehension questions automatically,
   and the art keys you used are already supported.

## Adding a new game

1. Add a `GameDef` to `app/src/games/index.ts` with a `build()` that returns questions of kind
   `choice`, `build`, `numberline`, `gonogo`, `sort` or `speak`.
2. Map its skill to an area in `SKILL_AREAS` (`app/src/lib/srs.ts`).
3. It gets the shared runner, scoring, haptics, and spaced-repetition scheduling for free.

## Adding a lullaby

`app/src/data/lullabies.ts`. **Public domain only** — each entry records its provenance, and the
file names the modern lullabies that must never be added. This is a product you're selling; a
lullaby app that ships copyrighted lyrics is a lawsuit with a bedtime theme.
