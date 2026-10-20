#!/usr/bin/env bash
# build-image.sh <parity|release|harness> <ref> <tag> [--variant nodsn] [--no-cache]
# The single Docker recipe of 42 §2 for test images:
#   - `git archive <ref>` into an empty directory (never the working tree);
#   - parity/harness: the frozen data snapshot test/fixtures/data-snapshot/ copied into data/ (42 §1), and the
#     build args BUILD_SCRIPT=build:test APP_ENV=production API_KEY=test-key GA_TRACKING_CODE=G-TEST000000
#     SENTRY_DSN=https://public@o0.ingest.sentry.io/0 (nodsn: empty DSN, I-07);
#   - harness: test/harness-pages/** injected as pages/__du-harness/** (T-802; never in a parity image);
#   - release: today's deploy args with the live data-loader; never run locally with live data (I-10);
#   - docker buildx build --platform linux/arm64 --secret id=npm_token,env=NPM_TOKEN --metadata-file, plus
#     --build-arg NPM_TOKEN when the ref's Dockerfile still declares ARG NPM_TOKEN (every ref before
#     CS-W0-8): such images carry the token in their history and are never pushed or saved; they are
#     labelled and removed after use (I-03).
# The token is derived in-process from the user npm config and only ever placed in this process's
# environment; it is never printed or written to a file. Prints the image ID.
# Docker mode only (owner notes: local mode builds with scripts/build-parity.mjs --mode host).
set -euo pipefail
set +x

mode="${1:?usage: build-image.sh <parity|release|harness> <ref> <tag> [--variant nodsn] [--no-cache]}"
ref="${2:?ref}"
tag="${3:?tag}"
shift 3
variant=default
cache=()
while [ $# -gt 0 ]; do
  case "$1" in
    --variant) variant="$2"; shift 2 ;;
    --no-cache) cache=(--no-cache); shift ;;
    *) echo "unknown option $1" >&2; exit 2 ;;
  esac
done
case "$mode" in parity|release|harness) ;; *) echo "mode must be parity, release or harness" >&2; exit 2 ;; esac
if [ "$mode" = release ] && [ "${P2_ALLOW_RELEASE:-}" != 1 ]; then
  echo "release builds run the live data-loader: CI only (I-10); set P2_ALLOW_RELEASE=1 there" >&2
  exit 2
fi

repo="$(cd "$(dirname "$0")/.." && pwd)"
artifacts="${ARTIFACT_DIR:-$repo/../search-upgrade-artifacts}"
commit="$(git -C "$repo" rev-parse "$ref^{commit}")"
ctx="$(mktemp -d "${TMPDIR:-/tmp}/p2-image-XXXXXX")"
trap 'rm -rf "$ctx"' EXIT
git -C "$repo" archive --format=tar "$commit" | tar -x -C "$ctx"

args=()
if [ "$mode" != release ]; then
  if [ -d "$repo/test/fixtures/data-snapshot" ]; then cp -a "$repo/test/fixtures/data-snapshot/." "$ctx/data/"; fi
  dsn='https://public@o0.ingest.sentry.io/0'
  [ "$variant" = nodsn ] && dsn=''
  args+=(--build-arg BUILD_SCRIPT=build:test --build-arg APP_ENV=production --build-arg API_KEY=test-key
    --build-arg GA_TRACKING_CODE=G-TEST000000 --build-arg "SENTRY_DSN=$dsn")
fi
if [ "$mode" = harness ]; then
  [ -d "$ctx/test/harness-pages" ] || { echo "harness: test/harness-pages/ is absent at $commit" >&2; exit 2; }
  mkdir -p "$ctx/pages/__du-harness"
  cp -a "$ctx/test/harness-pages/." "$ctx/pages/__du-harness/"
fi

# the GitHub Packages token, from the user npm config (never echoed)
NPM_TOKEN="$(node -e '
  const fs = require("fs"), os = require("os"), path = require("path")
  const file = process.env.npm_config_userconfig || path.join(os.homedir(), ".npmrc")
  const lines = fs.existsSync(file) ? fs.readFileSync(file, "utf8").split("\n") : []
  const get = (k) => { const l = lines.find((x) => x.trim().startsWith(`//npm.pkg.github.com/:${k}=`)); return l ? l.slice(l.indexOf("=") + 1).trim() : "" }
  let t = get("_authToken")
  if (!t && get("_auth")) t = Buffer.from(get("_auth"), "base64").toString("utf8").split(":").slice(1).join(":")
  if (!t && get("_password")) t = Buffer.from(get("_password"), "base64").toString("utf8")
  process.stdout.write(t)
')"
export NPM_TOKEN
[ -n "$NPM_TOKEN" ] || { echo "no GitHub Packages token in the user npm config" >&2; exit 2; }

labels=(--label "org.search.p2.commit=$commit" --label "org.search.p2.mode=$mode" --label "org.search.p2.variant=$variant")
if git -C "$repo" show "$commit:Dockerfile" | grep -q '^ARG NPM_TOKEN'; then
  # pre-CS-W0-8 recipe: the token is a build arg (in the image history): never pushed, never saved
  args+=(--build-arg "NPM_TOKEN=$NPM_TOKEN")
  labels+=(--label "p2-credential-bearing=1")
fi
mkdir -p "$artifacts/out"
docker buildx build --platform linux/arm64 --load "${cache[@]}" \
  --secret id=npm_token,env=NPM_TOKEN \
  --metadata-file "$artifacts/out/$(echo "$tag" | tr ':/' '__').json" \
  "${labels[@]}" "${args[@]}" -t "$tag" "$ctx" >&2
unset NPM_TOKEN
docker image inspect --format '{{.Id}}' "$tag"
