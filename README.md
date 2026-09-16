# Nightshift

**Bedtime stories read in your own voice — for the parents who aren't home at bedtime.**

You're on nights. You're over the road. You're doing a double. Your kid still goes to bed at 7:30.
Nightshift is how you're still the one who reads the story.

One app, two sides. You sign in as the grown-up, teach it your voice once, and send stories.
Your child signs in on their own device and — at their bedtime, every night — gets a notification,
opens an illustrated book, and hears **you** read it.

---

## What it actually does

### The grown-up side

| | |
|---|---|
| **Voice Studio** | Read six short scripted passages. The app scores each take on-device (too quiet, clipping, dead air) and tells you how to fix it before anything is uploaded. Explicit typed consent is required before a single sample leaves the phone. |
| **Story Builder** | Pick the child, the topic, the tone, the length. Add a personal message that gets spoken in your voice before the story starts. Schedule it for bedtime or send it right now. |
| **Heartfelt messages** | Seven templates for the things you actually need to say and aren't there to say: *I had to work tonight*, *I'm proud of you*, *I owe you an apology*, *Big day tomorrow*. The templates carry the shape; your own typed words carry the weight, and they're spoken exactly as you wrote them. |
| **Read it yourself** | Skip the AI entirely. Record yourself reading the whole story in one take. Highest fidelity there is, costs nothing. |
| **Library** | Everything you've sent, whether it was played, and how many times. Plus the voice messages your kid recorded back to you. |
| **Progress** | What your child has genuinely retained — not what they tapped today. |

### The child side

| | |
|---|---|
| **Tonight's story** | One big play button. Illustrated pages that turn themselves in time with the narration. |
| **Talk back** | One button, hold it, say anything. It lands in the parent's library. This is the feature parents cry about. |
| **Bookshelf** | Every story ever sent, kept forever, playable offline. |
| **Five learning games** | Phonics word-building, sight words, number-line arithmetic, pattern logic, and comprehension questions generated from the story they heard tonight. |

---

## The games are not brain fog

That was the requirement, so it drove the design. Every game obeys three rules:

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

**Story Detective** is the one that matters most: its questions are generated from the exact
story the child heard that night, using the story's own slot values — so the marked answer is
always correct, and listening to a parent's voice is what makes the game winnable.

---

## Three honest limitations

Read these before you build a business on it.

**1. Voice cloning needs a paid API key.** On-device cloning that genuinely sounds like you does
not exist yet. Nightshift uses ElevenLabs instant voice cloning — you add your own key in Settings,
it's stored on-device, and it's sent only to elevenlabs.io. Without a key the app still works
completely: stories are narrated by the device's built-in reader, or by you, recorded live.

**Everywhere a device-narrated story appears, the app says "Device narrator — not a real voice."**
It never lets a child believe they're hearing their parent when they aren't.

**2. Story writing works offline, and gets better with a key.** The built-in engine
(`app/src/lib/story/`) is a hand-written eight-beat narrative system with seven topic packs, two
reading registers, and five tones — it produces real stories with no network at all. Add an
Anthropic API key and stories are instead written fresh for each child around their actual
interests. If that call fails at 7:30pm, it falls back to the offline engine silently, because
bedtime doesn't wait for an API.

**3. Sync is self-hosted.** There is no Nightshift cloud. Without a server the app is fully local,
which only works if parent and child share a device. Run `server/` yourself (one file, SQLite,
deploys anywhere) and your phone and their tablet become the same account. Your API keys never
touch it.

---

## Getting the APK

The APK is built by GitHub Actions, because that's where the Android SDK lives.

1. Push to any branch, or open the **Actions** tab → **Build Android APK** → **Run workflow**.
2. When it finishes, download the `nightshift-apk-<n>` artifact from the run summary.
3. Unzip, move `nightshift-debug-*.apk` to the phone, and open it. Android will ask you to allow
   installing from unknown sources — that's expected for a sideloaded APK.

**For a signed release build** (needed for the Play Store), add four repository secrets and the
workflow builds and signs `nightshift-release-*.apk` automatically:

| Secret | What it is |
|---|---|
| `ANDROID_KEYSTORE_BASE64` | `base64 -w0 release.keystore` |
| `ANDROID_KEYSTORE_PASSWORD` | Keystore password |
| `ANDROID_KEY_ALIAS` | Key alias |
| `ANDROID_KEY_PASSWORD` | Key password |

Push a `v*` tag and the APKs are attached to a GitHub Release.

### Building it locally instead

Needs Node 20+, JDK 21 and the Android SDK.

```bash
cd app
npm install
npm run build
npx cap sync android
cd android && ./gradlew assembleDebug
# app/android/app/build/outputs/apk/debug/app-debug.apk
```

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
cd server
npm install
npm run build
npm start                 # listens on :8787
```

Environment: `PORT`, `DATA_DIR` (default `./data`), `CORS_ORIGIN` (default `*` — set this in
production).

Then in the app: **Settings → Sync**, enter the server address, create a cloud account. You'll get
a six-character family code. Type that code plus your child's own 4-digit code into their tablet
once (**"This is my child's device"** on the welcome screen) and it's paired for good.

Run the tests — they cover the full parent-to-child path including cross-family isolation:

```bash
cd server && npm test     # 16 tests
```

**Security notes.** PINs are four digits because a sleepy parent and a six-year-old have to type
them; the server compensates with per-identity scrypt (N=16384) and rate limiting, and login
responses never confirm whether an email exists. Every query is scoped to the caller's family, a
child can only ever read their own stories, and the API keys stay on the parent's device — the
server never sees them.

---

## Layout

```
app/                      Mobile app — React + TypeScript + Vite + Capacitor
  src/lib/
    voice/                Provider adapters: ElevenLabs, device narrator, self-recorded
    story/                Story engine — topic packs, generator, heartfelt templates, LLM path
    srs.ts                Spaced repetition (SM-2)
    audio.ts              Recording, live level metering, on-device quality scoring
    cloud.ts              Sync client
    delivery.ts           Compose → narrate → schedule → deliver
  src/games/              The five learning games
  src/components/         Design system, icons, procedural SVG story art
  src/screens/            parent/ child/ auth/
  android/                Native Android project (generated, committed)
  tools/                  Procedural icon, splash and notification-icon renderers
server/                   Self-hosted sync server — Express + SQLite
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
   `choice`, `build`, or `numberline`.
2. It gets the shared runner, scoring, haptics, and spaced-repetition scheduling for free.
