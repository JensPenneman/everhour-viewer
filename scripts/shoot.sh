#!/usr/bin/env bash
# Headless-Chrome screenshot helper. Usage: ./scripts/shoot.sh <name> <url> [width] [height]
set -euo pipefail

NAME="${1:?usage: shoot.sh <name> <url> [width] [height]}"
URL="${2:?usage: shoot.sh <name> <url> [width] [height]}"
WIDTH="${3:-1440}"
HEIGHT="${4:-900}"

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
OUT="$ROOT/screenshots/$NAME.png"
CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
PROFILE=$(mktemp -d)
trap 'rm -rf "$PROFILE"' EXIT

"$CHROME" \
  --headless=new \
  --hide-scrollbars \
  --disable-gpu \
  --no-first-run \
  --no-default-browser-check \
  --user-data-dir="$PROFILE" \
  --window-size="${WIDTH},${HEIGHT}" \
  --virtual-time-budget=4000 \
  --screenshot="$OUT" \
  "$URL" 2>/dev/null

echo "$OUT"
