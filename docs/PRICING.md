# What to charge

Research done September 2026. Update the numbers before you rely on them.

## What the market charges

| Product | Price | Notes |
|---|---|---|
| Gramms | $5.99/mo | Voice cloning. The commodity floor. |
| SleepyVoice | $4.99/mo | Annual Pro tier. |
| Bedtime Stories | $2/story | No subscription, free voice setup. |
| **Sleepytale** | **$17/mo** | Voice cloning. Described in reviews as the most expensive on the market. |
| Story Spark | $39.99/mo | Creator tier, aimed at people making content, not parents. |

So the real band for a parent-facing voice-cloning app is **$5–$17**, and $17 is already being
called expensive by reviewers.

## The thing that decides the price

Not positioning — **your provider bill**.

A four-minute story is roughly **4,000 characters** of narration. At a realistic blended rate of
about **$0.12 per 1,000 characters**, that is **≈$0.48 a story**.

| If a family gets… | Characters/month | Your cost/month |
|---|---|---|
| One new story every night | 120,000 | **≈$14.40** |
| The old 400k quota, used fully | 400,000 | **≈$48.00** |

**The original 400k quota loses money at any price on this list.** A family on £9.99 using their
allowance would have cost roughly five times what they paid.

### What fixes it

The library. Lullabies, learning books and songs are **fixed text** — generated once per voice and
replayed forever at zero marginal cost. Only genuinely new personalised stories need fresh
narration. So the rule is:

> **Replays unlimited. Creation metered.**

Steady state for a real family:

| | Characters | Cost |
|---|---|---|
| Recording the library, once per voice | ~60,000 one-off | ≈$7 once |
| 10 fresh personalised stories/month | 40,000 | ≈$4.80/mo |
| Unlimited replays of everything | 0 | $0 |

**≈$5/month per active family**, after a one-off setup cost. That is a business.

## The recommendation

| Plan | Price | Why |
|---|---|---|
| **Monthly** | **£12.99** | Meaningfully under Sleepytale's $17, comfortably above the $5.99 tier that signals "cheap AI toy". Story Station does more than any of them — four shelves, twelve learning games, the child's voice reply — so it should not be priced at the floor. |
| **Yearly** | **£99** (~£8.25/mo) | This is the actual product. See below. |
| **Lifetime** | **£249** | Cash now from early believers. Cap it at the first 100 and say so. |
| **Trial** | 14 days, no card | The "oh" moment is hearing your own voice read to your kid. That happens on day one. |

### On your £14.99

£14.99 is defensible — it is still under Sleepytale and your product is richer. I would not fight
you on it. But I would rather be £2 cheaper than the most expensive thing on the market than £2
away from it, because "cheaper than the expensive one" is an easier sentence for a tired parent
than "roughly the same as the expensive one."

**The £2 matters far less than the annual plan.** Push annual.

### Why annual, hard

Novelty churn is brutal in this category. The emotional hit lands in week one; by week four it is
a habit or it is deleted. A monthly plan gives a parent three chances to cancel before the habit
forms. An annual plan gives them none, and £99 up front is worth more than eight months of £12.99
that never arrive.

Offer annual **first**, with monthly as the smaller option underneath.

## Before you set a price, do this

1. Open your ElevenLabs bill and find your **actual** blended cost per 1,000 characters.
2. Multiply by 4 for a story, by 30 for a heavy month.
3. If that number is more than a third of your price, cut the story quota, not the price.

Then edit `server/src/entitlements.ts`. It is one file.
