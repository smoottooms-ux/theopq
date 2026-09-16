# Deploying Nightshift

Three things can be deployed independently. You need the app; the server and a voice provider are
both optional.

---

## 1. The Android app

CI builds it — see the README. If you want a store listing:

1. Generate a keystore once and **keep it forever** (losing it means you can never update the app):
   ```bash
   keytool -genkey -v -keystore release.keystore -alias nightshift \
           -keyalg RSA -keysize 2048 -validity 10000
   ```
2. Add the four `ANDROID_*` secrets listed in the README.
3. Tag a release: `git tag v1.0.0 && git push --tags`. The signed APK is attached to the release.

Play Store also wants an App Bundle rather than an APK. Swap `assembleRelease` for `bundleRelease`
in `.github/workflows/android.yml` and collect `app/build/outputs/bundle/release/app-release.aab`.

### Store listing disclosures you will need

Google will ask. Answer honestly:

- **Data collected:** email address and a PIN hash, only if the user connects a sync server they
  themselves run. Nothing is collected by default.
- **Audio:** recorded with explicit consent; sent to ElevenLabs only when the user supplies their
  own ElevenLabs key; stored on-device otherwise.
- **Children's policy:** the child-facing side has no ads, no in-app purchases, no third-party
  analytics, no external links, and no chat with anyone outside the family.
- **AI disclosure:** the app synthesises a parent's voice with the parent's recorded consent, and
  labels non-cloned narration as such everywhere it appears.

---

## 2. The sync server

Any host that runs Node 20 and gives you a persistent disk. `DATA_DIR` must survive restarts —
it holds the SQLite database and every audio file.

### Docker

```dockerfile
FROM node:20-slim
WORKDIR /srv
COPY server/package*.json ./
RUN npm ci --omit=dev
COPY server/ ./
RUN npm run build
ENV DATA_DIR=/data PORT=8787
VOLUME /data
EXPOSE 8787
CMD ["node", "dist/index.js"]
```

```bash
docker build -t nightshift-server .
docker run -d -p 8787:8787 -v nightshift-data:/data --restart unless-stopped nightshift-server
```

### Behind a reverse proxy

Audio uploads can reach 25 MB, so raise the proxy's body limit or uploads fail with a confusing
413:

```nginx
location / {
    proxy_pass http://127.0.0.1:8787;
    client_max_body_size 30m;
    proxy_read_timeout 120s;
}
```

Put it behind HTTPS. The Android WebView will refuse a plaintext origin, and you are moving
recordings of children.

Set `CORS_ORIGIN` to your web app's origin in production rather than leaving it `*`.

### Backups

Two things matter and they are both in `DATA_DIR`:

```bash
# SQLite is in WAL mode, so use the backup API rather than copying the file
sqlite3 "$DATA_DIR/nightshift.db" ".backup '/backups/nightshift-$(date +%F).db'"
rsync -a "$DATA_DIR/media/" /backups/media/
```

The media directory is the irreplaceable part — those are recordings of a parent's voice and a
child talking back.

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
| ElevenLabs | Paid plan required for voice cloning. A ~4 minute story is roughly 4,000 characters; check their current per-character pricing and do the arithmetic for 30 nights. |
| Anthropic | Optional. Only used if you add a key for bespoke story writing. |

A family that never adds either key pays nothing and still gets illustrated stories, the games,
and the parent reading aloud in their own actual recorded voice.
