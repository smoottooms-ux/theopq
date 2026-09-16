# Nightshift sync server.
#
#   docker build -t nightshift-server -f server/Dockerfile server
#   docker run -d -p 8787:8787 -v nightshift-data:/data --env-file .env nightshift-server
#
# Two stages so the runtime image carries no compilers: better-sqlite3 is a
# native module and needs them to build, but not to run.

# ---------- build ----------
FROM node:22-slim AS build

# better-sqlite3 falls back to compiling from source when no prebuilt binary
# matches the platform, so the toolchain has to exist here.
RUN apt-get update \
 && apt-get install -y --no-install-recommends python3 make g++ \
 && rm -rf /var/lib/apt/lists/*

WORKDIR /build
COPY package*.json ./
RUN npm ci

COPY tsconfig.json ./
COPY src ./src
RUN npm run build

# Drop dev dependencies from the tree we are about to copy across.
RUN npm prune --omit=dev

# ---------- runtime ----------
FROM node:22-slim AS runtime

# Audio files are the irreplaceable part, so the data volume is separate from
# the application directory and owned by the unprivileged user.
ENV NODE_ENV=production \
    DATA_DIR=/data \
    PORT=8787

WORKDIR /srv

COPY --from=build /build/node_modules ./node_modules
COPY --from=build /build/dist ./dist
COPY --from=build /build/package.json ./package.json

RUN mkdir -p /data && chown -R node:node /data /srv
USER node

VOLUME ["/data"]
EXPOSE 8787

# Readiness rather than liveness: an instance with a dead database should be
# pulled out of rotation, not just restarted.
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||8787)+'/ready').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "dist/index.js"]
