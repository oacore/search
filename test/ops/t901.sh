#!/usr/bin/env bash
# T-901 (41 J, P0; CI-5): the container contract of the parity image, `npm run test:image -- <image>`.
# The nine clauses are the tests of e2e/ops/t901-container.spec.mjs (Playwright `ops` project), run against a
# stack of the image:
#   c1 tree from `git archive`, `npm ci` only, one Dockerfile      c6 no "patching" / "wasm" line
#   c2 image ENV (BUILD_TARGET=azure, NODE_ENV=production, APP_ENV)  c7 SIGTERM under 20 rps (in-flight, exit time)
#   c3 prod deployment env, 768m memory limit                        c8 time to ready
#   c4 /api/healthz/ and six routes via the proxy                    c9 keepAliveTimeout, headersTimeout
#   c5 image size
# Records (size, exit time, time to ready, timeouts) go to $ARTIFACT_DIR/t901/record-<run>.json; the comparison
# with B0 reads test/baseline/t901.json once it exists (2.5).
#
#   bash test/ops/t901.sh <image id or repo@sha256:digest> [--ref <git ref>]
#       Docker mode (CI): the compose topology of e2e/compose.yml with the app container of the image
#       (`mem_limit: 768m`), the stack of scripts/e2e-stack.mjs in docker mode. Disabled unless
#       P2_DOCKER_MODE=enabled: owner notes, no Docker in the local run, so this path is DEFERRED (exit 3) and
#       has never been run. Needs the image in images.json for the ref (`npm run build:parity -- --mode docker`).
#   bash test/ops/t901.sh --host [--build <key of $ARTIFACT_DIR/images.json>] [--run <id>]
#       Local mode: the same spec against the `next start` process of a host parity build (Node 18.20.8) behind
#       the Node proxy, with the clauses only a container can answer replaced by their host equivalents (see the
#       header of the spec). Not evidence for the image.
# Run with the tooling Node (24). Exit 0 only if every test is green.
set -euo pipefail
set +x

repo="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$repo"
export ARTIFACT_DIR="${ARTIFACT_DIR:-$repo/../search-upgrade-artifacts}"
image=""
host=0
build=""
ref=HEAD
run=""
while [ $# -gt 0 ]; do
  case "$1" in
    --host) host=1; shift ;;
    --build) build="$2"; shift 2 ;;
    --ref) ref="$2"; shift 2 ;;
    --run) run="$2"; shift 2 ;;
    -h | --help) sed -n '2,25p' "$0"; exit 0 ;;
    -*) echo "unknown option $1" >&2; exit 2 ;;
    *) image="$1"; shift ;;
  esac
done

if [ "$host" = 0 ]; then
  if [ -z "$image" ]; then
    echo "usage: npm run test:image -- <image id or repo@sha256:digest> | --host [--build <key>]" >&2
    exit 2
  fi
  if [ "${P2_DOCKER_MODE:-}" != enabled ]; then
    echo "T-901 (image ${image}): DEFERRED, docker mode is disabled (local mode only); set P2_DOCKER_MODE=enabled in CI" >&2
    exit 3
  fi
fi

[ "$(node -p 'process.versions.node.split(".")[0]')" -ge 20 ] || { echo "T-901: run with the tooling Node (24), not $(node -v)" >&2; exit 2; }
run="${run:-t901-$$}"
stack=(node scripts/e2e-stack.mjs)
cleanup() { "${stack[@]}" down --run "$run" >/dev/null 2>&1 || true; }
trap cleanup EXIT

if [ "$host" = 1 ]; then
  up=("${stack[@]}" up --run "$run")
  [ -n "$build" ] && up+=(--build "$build")
  "${up[@]}"
else
  id="$(docker image inspect --format '{{.Id}}' "$image")" || { echo "T-901: image $image is not available locally" >&2; exit 2; }
  "${stack[@]}" up --run "$run" --mode docker --ref "$ref"
  # the stack takes the image of images.json for the ref: it must be the image under test
  running="$(node -e '
    const s = JSON.parse(require("fs").readFileSync(process.env.ARTIFACT_DIR + "/runs/" + process.argv[1] + "/env.json", "utf8"))
    process.stdout.write(s.image && s.image.imageId ? s.image.imageId : "")' "$run")"
  [ "$running" = "$id" ] || { echo "T-901: the stack runs ${running:-no image}, not $image ($id)" >&2; exit 2; }
fi

P2_OPS=1 "${stack[@]}" test --run "$run" e2e/ops/t901-container.spec.mjs --project ops
