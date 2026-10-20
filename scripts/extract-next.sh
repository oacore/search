#!/usr/bin/env bash
# extract-next.sh <image> <dir> - copies what the static tests read out of a parity image (42 §6 item 2,
# 40 §3 layer A): /app/.next, /app/public and @oacore/design/lib/config.js, into <dir> (APP_ROOT layout:
# <dir>/.next, <dir>/public, <dir>/node_modules/@oacore/design/lib/config.js). Docker mode only.
set -euo pipefail
image="${1:?usage: extract-next.sh <image> <dir>}"
dir="${2:?usage: extract-next.sh <image> <dir>}"
mkdir -p "$dir/node_modules/@oacore/design/lib"
cid="$(docker create --platform linux/arm64 "$image")"
trap 'docker rm -f "$cid" >/dev/null 2>&1 || true' EXIT
docker cp "$cid:/app/.next" "$dir/.next"
docker cp "$cid:/app/public" "$dir/public"
docker cp "$cid:/app/node_modules/@oacore/design/lib/config.js" "$dir/node_modules/@oacore/design/lib/config.js"
docker cp "$cid:/app/package.json" "$dir/package.json"
docker cp "$cid:/app/package-lock.json" "$dir/package-lock.json"
echo "extracted $image into $dir (NEXT_DIR=$dir/.next APP_ROOT=$dir)"
