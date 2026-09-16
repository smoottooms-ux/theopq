#!/usr/bin/env bash
#
# Backs up the database and every audio file.
#
#   ./server/scripts/backup.sh /path/to/backups
#
# The media directory is the irreplaceable part: those are recordings of a
# parent's voice and of their child talking back. Losing them is not a bug you
# can apologise your way out of. Run this from cron, nightly.

set -euo pipefail

DEST="${1:-./backups}"
DATA_DIR="${DATA_DIR:-./data}"
STAMP="$(date +%Y-%m-%d-%H%M)"
TARGET="$DEST/$STAMP"

[ -d "$DATA_DIR" ] || { echo "No data directory at $DATA_DIR" >&2; exit 1; }
mkdir -p "$TARGET"

# SQLite runs in WAL mode, so copying the file mid-write gives a torn database.
# .backup takes a consistent snapshot while the server keeps serving.
if command -v sqlite3 >/dev/null 2>&1; then
  sqlite3 "$DATA_DIR/storystation.db" ".backup '$TARGET/storystation.db'"
else
  echo "sqlite3 not installed — falling back to a file copy." >&2
  echo "Stop the server first, or this snapshot may be inconsistent." >&2
  cp "$DATA_DIR/storystation.db"* "$TARGET/"
fi

# Audio only ever gets added to, so a link-based mirror stays cheap.
if command -v rsync >/dev/null 2>&1; then
  rsync -a --link-dest="$DEST/latest/media" "$DATA_DIR/media/" "$TARGET/media/"
else
  cp -r "$DATA_DIR/media" "$TARGET/media"
fi

ln -sfn "$STAMP" "$DEST/latest"

# Keep a month of daily snapshots; hard links mean they cost almost nothing.
find "$DEST" -maxdepth 1 -type d -name '20*' -mtime +30 -exec rm -rf {} + 2>/dev/null || true

echo "Backed up to $TARGET"
du -sh "$TARGET" 2>/dev/null || true
