#!/usr/bin/env bash
# T-008 (41 A, P0; R-014, R-015, R-027, R-054, R-066): the install in a linux/arm64 alpine container.
#   c1  `npm ci --include=dev --legacy-peer-deps` (the flags of the Dockerfile) succeeds with no fallback
#       (a failing `npm ci` fails the script; there is no `|| npm install`);
#   c2  under `npm_config_userconfig=/dev/null`, `npm ls --all --no-legacy-peer-deps` problems are a subset of
#       the 02 §1 rule 6 allow-list;
#   c3  musl and gnu @next/swc-* follow the locked next (none at Next 10), the binary this platform needs is
#       installed (sharp musl from 15);
#   c4  @oacore/design 5.0.74 with integrity sha512-kwYolSk… (until DV9);
#   c5  @mdi/svg, @babel/runtime and yargs resolve from the app root (node-fetch until W4a, CS-N12-1).
# The checks are test/static/lib/P0-16/install-checks.js (the same code as test/static/t008-install.test.js,
# which runs c1-c5 without a container).
#
#   bash test/ops/t008.sh [--ref <git ref>] [--image node:18-alpine[@sha256:<index digest>]]
#       Docker mode: `git archive <ref>` (package.json, package-lock.json, design.config.js and the checks) is
#       mounted read-only into the image, installed in /app and verified there. The GitHub Packages token comes
#       from the user npm config, is passed by name only (-e NPM_TOKEN), is written
#       to /app/.npmrc for the install and removed at once; it is never printed. Disabled: Docker is out of
#       scope (owner rule of 2026-10-22), so this path always refuses (DEFERRED, exit 3).
#   bash test/ops/t008.sh --tree <dir> [--lock-only]
#       Local rehearsal, no container: the same checks on an installed tree (or, with --lock-only, on the
#       package.json and package-lock.json of <dir>). Run with the runtime Node (18.20.8). Not evidence for
#       the alpine arm64 claim.
# Output: the JSON report of the checks on stdout (and under $ARTIFACT_DIR/t008/ in Docker mode); exit 0 only
# if every check holds.
set -euo pipefail
set +x

repo="$(cd "$(dirname "$0")/../.." && pwd)"
checks="test/static/lib/P0-16/install-checks.js"
ref=HEAD
image="${T008_IMAGE:-node:18-alpine}"
tree=""
lock_only=()
while [ $# -gt 0 ]; do
  case "$1" in
    --ref) ref="$2"; shift 2 ;;
    --image) image="$2"; shift 2 ;;
    --tree) tree="$2"; shift 2 ;;
    --lock-only) lock_only=(--lock-only); shift ;;
    -h | --help) sed -n '2,28p' "$0"; exit 0 ;;
    *) echo "unknown option $1" >&2; exit 2 ;;
  esac
done

if [ -n "$tree" ]; then
  [ -f "$tree/package.json" ] && [ -f "$tree/package-lock.json" ] || { echo "T-008: $tree has no package.json and package-lock.json" >&2; exit 2; }
  case "$(node -p 'process.versions.node')" in
    18.*) ;;
    *) echo "T-008: Node $(node -v), not the runtime Node 18: the strict-mode npm ls problems may differ" >&2 ;;
  esac
  exec node "$repo/$checks" --verify-tree "$tree" ${lock_only[@]+"${lock_only[@]}"}
fi

# Docker is out of scope: the container path refuses whatever the environment says
echo "T-008 (alpine arm64): DEFERRED, docker mode is disabled (Docker is out of scope; run --tree <dir> instead)" >&2
exit 3

artifacts="${ARTIFACT_DIR:-$repo/../search-upgrade-artifacts}"
commit="$(git -C "$repo" rev-parse "$ref^{commit}")"
ctx="$(mktemp -d "${TMPDIR:-/tmp}/p2-t008-XXXXXX")"
trap 'rm -rf "$ctx"' EXIT
git -C "$repo" archive --format=tar "$commit" package.json package-lock.json design.config.js test/static/lib/P0-16 | tar -x -C "$ctx"

# the GitHub Packages token, from the user npm config (never echoed)
NPM_TOKEN="$(node -e '
  const fs = require("fs"), os = require("os"), path = require("path")
  const file = process.env.npm_config_userconfig || path.join(os.homedir(), ".npmrc")
  const lines = fs.existsSync(file) ? fs.readFileSync(file, "utf8").split("\n") : []
  const get = (k) => { const l = lines.find((x) => x.trim().startsWith(`//npm.pkg.github.com/:${k}=`)); return l ? l.slice(l.indexOf("=") + 1).trim() : "" }
  let t = get("_authToken")
  if (!t && get("_auth")) t = Buffer.from(get("_auth"), "base64").toString("utf8").split(":").slice(1).join(":")
  if (!t && get("_password")) t = Buffer.from(get("_password"), "base64").toString("utf8")
  const ref = t.match(/^\$\{(\w+)\}$/)
  if (ref) t = process.env[ref[1]] || ""
  process.stdout.write(t)
')"
export NPM_TOKEN
[ -n "$NPM_TOKEN" ] || { echo "T-008: no GitHub Packages token in the user npm config" >&2; exit 2; }

mkdir -p "$artifacts/t008"
out="$artifacts/t008/$(date -u +%Y%m%dT%H%M%SZ).json"
# set -e inside the container: a failing `npm ci` ends the run (no fallback)
docker run --rm --platform linux/arm64 -e NPM_TOKEN -v "$ctx:/src:ro" "$image" sh -ec '
  [ "$(uname -m)" = aarch64 ] || { echo "T-008: not linux/arm64" >&2; exit 2; }
  [ -f /etc/alpine-release ] || { echo "T-008: not alpine" >&2; exit 2; }
  mkdir -p /app && cd /app
  cp /src/package.json /src/package-lock.json /src/design.config.js .
  printf "@oacore:registry=https://npm.pkg.github.com/\n//npm.pkg.github.com/:_authToken=%s\n" "$NPM_TOKEN" > .npmrc
  rc=0
  npm ci --include=dev --legacy-peer-deps >/tmp/npm-ci.log 2>&1 || rc=$?
  rm -f .npmrc
  if [ "$rc" -ne 0 ]; then tail -n 40 /tmp/npm-ci.log | grep -v "_authToken" >&2; echo "T-008 c1: npm ci exited $rc (no fallback)" >&2; exit "$rc"; fi
  NODE_OPTIONS= npm_config_userconfig=/dev/null node /src/'"$checks"' --verify-tree /app
' | tee "$out"
unset NPM_TOKEN
echo "T-008: report $out" >&2
