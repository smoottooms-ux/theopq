#!/usr/bin/env bash
#
# One-command setup for the Nightshift server.
#
#   ./server/scripts/setup.sh
#
# Creates .env if it does not exist, generates an admin token, installs,
# builds, and runs the pre-flight check. Safe to run repeatedly: it never
# overwrites an existing .env and never prints a secret.

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
SERVER_DIR="$REPO_ROOT/server"
ENV_FILE="$SERVER_DIR/.env"

bold() { printf '\033[1m%s\033[0m\n' "$1"; }
dim()  { printf '\033[2m%s\033[0m\n' "$1"; }
ok()   { printf '\033[32m✓\033[0m %s\n' "$1"; }
warn() { printf '\033[33m!\033[0m %s\n' "$1"; }
die()  { printf '\033[31m✗\033[0m %s\n' "$1" >&2; exit 1; }

echo
bold "Nightshift server setup"
dim "────────────────────────────────────────────"

# ---------- prerequisites ----------

command -v node >/dev/null 2>&1 || die "Node is not installed. Install Node 22 or newer."

NODE_MAJOR="$(node -p 'process.versions.node.split(".")[0]')"
if [ "$NODE_MAJOR" -lt 20 ]; then
  die "Node $NODE_MAJOR is too old. The server needs 20+, and the mobile app build needs 22+."
fi
ok "Node $(node -v)"

# ---------- environment ----------

if [ -f "$ENV_FILE" ]; then
  ok ".env already exists — leaving it alone"
else
  cp "$SERVER_DIR/.env.example" "$ENV_FILE"

  # A generated token beats a placeholder nobody remembers to change.
  if command -v openssl >/dev/null 2>&1; then
    TOKEN="$(openssl rand -hex 32)"
  else
    TOKEN="$(node -e 'console.log(require("crypto").randomBytes(32).toString("hex"))')"
  fi

  # BSD and GNU sed disagree about -i, so write through a temp file instead.
  tmp="$(mktemp)"
  sed "s|^ADMIN_TOKEN=.*|ADMIN_TOKEN=$TOKEN|" "$ENV_FILE" > "$tmp" && mv "$tmp" "$ENV_FILE"
  chmod 600 "$ENV_FILE"

  ok "Created server/.env with a fresh ADMIN_TOKEN"
  warn "Add your ELEVENLABS_API_KEY to server/.env — without it nobody gets a cloned voice"
fi

# ---------- build ----------

cd "$SERVER_DIR"

echo
dim "Installing dependencies…"
if [ -f package-lock.json ]; then npm ci --silent; else npm install --silent; fi
ok "Dependencies installed"

dim "Building…"
npm run build --silent
ok "Built"

dim "Running tests…"
if npm test --silent >/dev/null 2>&1; then
  ok "Tests pass"
else
  warn "Tests did not pass — run 'npm test' in server/ to see why"
fi

# ---------- pre-flight ----------

echo
node --env-file-if-exists=.env dist/doctor.js || true

# ---------- what to do next ----------

echo
bold "Next"
dim "────────────────────────────────────────────"
cat <<'NEXT'
  1. Put your ELEVENLABS_API_KEY in server/.env, then re-run:
       cd server && npm run doctor

  2. Start it:
       cd server && npm start                 # directly
       docker compose up -d                   # or with TLS via Caddy

  3. Point the app at it and rebuild:
       cd app && VITE_API_URL=https://your-domain npm run build

  4. Give yourself a plan:
       curl -X POST https://your-domain/admin/plan \
         -H "x-admin-token: $(grep '^ADMIN_TOKEN=' server/.env | cut -d= -f2)" \
         -H 'Content-Type: application/json' \
         -d '{"email":"you@example.com","plan":"comp"}'
NEXT
echo
