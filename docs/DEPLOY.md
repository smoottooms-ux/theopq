# Deploying Story Station

Three things can be deployed independently. You need the app; the server and a voice provider are
both optional.

---

## 1. The Android app

CI builds it — see the README. If you want a store listing:

1. Generate a keystore once and **keep it forever** (losing it means you can never update the app):
   ```bash
   keytool -genkey -v -keystore release.keystore -alias storystation \
           -keyalg RSA -keysize 2048 -validity 10000
   ```
2. Add the four `ANDROID_*` secrets listed in the README.
3. Tag a release: `git tag v1.0.0 && git push --tags`. The signed APK is attached to the release.

Play Store also wants an App Bundle rather than an APK. Swap `assembleRelease` for `bundleRelease`
in `.github/workflows/android.yml` and collect `app/build/outputs/bundle/release/app-release.aab`.

### Store listing disclosures you will need

Google will ask. Answer honestly:

- **Data collected:** email address, a scrypt hash of the PIN, the child's first name and age, and
  the stories and recordings the family creates.
- **Audio:** voice recordings are collected with explicit typed consent, sent to our voice provider
  to build the narration model, and the raw samples are deleted once the model is built.
- **Children's policy:** the child-facing side has no ads, no in-app purchases, no third-party
  analytics, no external links, and no chat with anyone outside the family.
- **AI disclosure:** the app synthesises a parent's voice with the parent's recorded consent, and
  labels non-cloned narration as such everywhere it appears.

---

## 2. The sync server

### Start here

```bash
./server/scripts/setup.sh
```

Creates `server/.env`, generates an `ADMIN_TOKEN`, installs, builds, runs the tests, and finishes
with a pre-flight report telling you exactly what is still missing. Safe to re-run — it never
overwrites an existing `.env`.

Then put your `ELEVENLABS_API_KEY` in `server/.env` and check it:

```bash
cd server && npm run doctor
```

`doctor` doesn't just look for the variable — it calls ElevenLabs, confirms the key works,
confirms the plan actually includes Instant Voice Cloning, and tells you how many stories your
remaining character quota is worth. It exits non-zero when something would break the product, so
you can use it as a deploy gate:

```bash
npm run doctor && npm start
```

### Running it

Pick one. All four read the same `.env`.

| | Command | Notes |
|---|---|---|
| **Docker + TLS** | `docker compose up -d` | Recommended. Caddy gets certificates automatically — set `DOMAIN` in `.env`. |
| **Docker alone** | `docker build -t storystation server && docker run -d -p 8787:8787 -v story-station-data:/data --env-file .env storystation` | You supply TLS. |
| **Fly.io** | `fly deploy --config server/deploy/fly.toml --dockerfile server/Dockerfile` | Create the volume first; see comments in the file. |
| **Render** | Point a Blueprint at `server/deploy/render.yaml` | Set the secret env vars in the dashboard. |
| **Bare VPS** | `server/deploy/storystation.service` | systemd unit, hardened, plus `nginx.conf` for the proxy. |

**One instance only.** SQLite has exactly one writer. Every config here pins a single machine on
purpose — do not scale it horizontally without moving to Postgres first.

### What the server does on startup

It inspects its own configuration and says so plainly in the logs. Missing voice key → warning, and
it serves stories anyway. A Stripe key with no webhook secret → **fatal, and it refuses to start**,
because that combination takes money and never learns the payment succeeded.

Two probes:

- `GET /health` — liveness. Cheap, no database access.
- `GET /ready` — readiness. Touches the database and reports which capabilities are configured, so
  a deploy missing a provider key is visible from a dashboard instead of at bedtime.

On `SIGTERM` it stops accepting connections, lets in-flight requests finish, checkpoints the SQLite
WAL and closes cleanly, with a 15-second cap before it gives up.

### Behind a reverse proxy

Both bundled configs already handle this, but if you write your own: audio uploads reach 25 MB, so
raise the body limit or they fail with a confusing 413, and raise read timeouts to ~180s because
generating narration for a long story is not fast.

Set `TRUST_PROXY_HOPS` to the number of proxies in front of the server, or rate limiting sees your
proxy's IP for everyone.

Put it behind HTTPS. The Android WebView refuses a plaintext origin, and you are moving recordings
of children.

Set `CORS_ORIGIN` to your app's origin rather than leaving it `*`.

### Environment

Copy `server/.env.example` and fill it in. The ones that matter:

| Variable | Why |
|---|---|
| `ELEVENLABS_API_KEY` | Voice cloning and narration. Without it the app still ships stories, read by the child's device. |
| `ANTHROPIC_API_KEY` | Bespoke story writing. Without it the built-in engine is used. |
| `CORS_ORIGIN` | Set to your web origin. Leaving it `*` in production is sloppy. |
| `ADMIN_TOKEN` | Lets you grant and cancel plans by hand. `openssl rand -hex 32`. |
| `STRIPE_*` | Optional. Payments work without them being set — you just grant plans yourself. |

### Turning payments on

1. Create three Stripe Prices (monthly, yearly, one-off) and put their ids in `STRIPE_PRICE_*`.
2. Add a webhook endpoint pointing at `https://your-server/billing/webhook`, subscribed to
   `checkout.session.completed`, `invoice.payment_failed` and `customer.subscription.deleted`.
3. Put the signing secret in `STRIPE_WEBHOOK_SECRET` and the API key in `STRIPE_SECRET_KEY`.
4. Set `APP_URL` so checkout returns the parent to the right place.

Until all of that is set, `/billing/plans` reports `checkoutAvailable: false`, the app shows a
"contact us" card instead of a buy button, and you grant plans with the admin endpoint. That is a
perfectly good way to run the first fifty customers.

### Watching what it costs you

Every billable call is written to `usage_events` with the family, kind and amount:

```sql
-- narrated characters this month, by family
SELECT family_id, SUM(amount) AS chars
FROM usage_events
WHERE kind = 'narration' AND created_at > strftime('%s', 'now', '-30 days') * 1000
GROUP BY family_id ORDER BY chars DESC;
```

Compare that against your provider invoice. If a family is consistently near the cap, either the
plan is underpriced or they're your best case study — find out which.

### Backups

```bash
./server/scripts/backup.sh /path/to/backups
```

Takes a consistent SQLite snapshot with the backup API (copying a WAL-mode database mid-write
gives you a torn file), hard-links the media directory against the previous snapshot so a month of
dailies costs almost nothing, and prunes anything older than 30 days.

Put it in cron, nightly:

```cron
0 4 * * * cd /opt/storystation && DATA_DIR=/var/lib/storystation ./server/scripts/backup.sh /backups
```

**Test a restore before you need one.** The media directory is the irreplaceable part — those are
recordings of a parent's voice and of their child talking back. Losing them is not something you
can apologise your way out of.

---

## 3. The web build

`app/dist/` is a static PWA. Any host works.

```bash
cd app && npm run build
npx vercel deploy --prod app/dist      # or netlify, or an S3 bucket, or nginx
```

It must be served over HTTPS: microphone access, notifications and service workers all require a
secure origin.

---

## Costs, honestly

| | |
|---|---|
| The app | Free. Runs entirely offline. |
| Sync server | Whatever a small VPS costs you. It is one Node process and a SQLite file. |
| ElevenLabs | **Your** cost, not the customer's. A ~4 minute story is roughly 4,000 characters. The Family plan allows 400k characters/month ≈ 100 stories. Multiply by their current per-character rate and check your margin before launch. |
| Anthropic | **Your** cost. One story is a few thousand tokens. Only spent when `ANTHROPIC_API_KEY` is set. |

Do this arithmetic before you price. The £9.99 default in `entitlements.ts` is a placeholder, not
advice — run the numbers against real provider rates and set it yourself.

If your provider accounts go down or run dry, nothing breaks for the customer: stories are still
written, still delivered, and still read aloud by the child's device, and the app says so plainly.
