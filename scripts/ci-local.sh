#!/usr/bin/env bash
# ci-local.sh - the jobs of .github/workflows/ci.yml on a workstation (local mode, no Docker):
#   unit     Jest node + dom on Node 18.20.8
#   harness  test:harness on tooling Node 24
#   image    two `--install ci` host parity builds of HEAD (the image job's two no-cache images), then
#            T-006, T-011, T-013, T-014 (a) on their .next
#   e2e      smoke on the host parity build (own run id and ports)
# Usage: ARTIFACT_DIR=<dir> bash scripts/ci-local.sh [unit|harness|image|e2e ...]   (default: all)
# Writes $ARTIFACT_DIR/ci-local/<timestamp>.json and exits non-zero when a job fails.
set -uo pipefail
repo="$(cd "$(dirname "$0")/.." && pwd)"
cd "$repo"
export ARTIFACT_DIR="${ARTIFACT_DIR:-$repo/../search-upgrade-artifacts}"
export NEXT_TELEMETRY_DISABLED=1
. "${NVM_DIR:-$HOME/.nvm}/nvm.sh" >/dev/null
node18="$(nvm which 18.20.8)"
node24="$(nvm which 24)"
jobs=("$@")
[ ${#jobs[@]} -eq 0 ] && jobs=(unit harness image e2e)
stamp="$(date -u +%Y%m%dT%H%M%SZ)"
out="$ARTIFACT_DIR/ci-local"
mkdir -p "$out"
results=()

run_job() {
  local name="$1"
  shift
  local start=$SECONDS
  echo "=== $name"
  if "$@" >"$out/$stamp-$name.log" 2>&1; then rc=0; else rc=$?; fi
  results+=("{\"job\":\"$name\",\"rc\":$rc,\"seconds\":$((SECONDS - start)),\"log\":\"$out/$stamp-$name.log\"}")
  echo "    rc=$rc ($((SECONDS - start)) s) log $out/$stamp-$name.log"
}

job_unit() { PATH="$(dirname "$node18"):$PATH" npm run test:unit; }
job_harness() { PATH="$(dirname "$node24"):$PATH" npm run test:harness; }
job_image() {
  export PATH="$(dirname "$node24"):$PATH"
  local a b
  a="$(node scripts/build-parity.mjs --mode host --install ci --suffix ci-a --json | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>console.log(JSON.parse(s).dir))')" || return 1
  b="$(node scripts/build-parity.mjs --mode host --install ci --suffix ci-b --json | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>console.log(JSON.parse(s).dir))')" || return 1
  NEXT_DIR="$a/.next" APP_ROOT="$a" NEXT_DIR_A="$a/.next" NEXT_DIR_B="$b/.next" PATH="$(dirname "$node18"):$PATH" \
    npm run test:static -- -t 'T-006|T-011|T-013|T-014'
}
job_e2e() {
  export PATH="$(dirname "$node24"):$PATH"
  local id="ci-local-$stamp"
  node scripts/build-parity.mjs --mode host || return 1
  node scripts/e2e-stack.mjs up --run "$id" || { node scripts/e2e-stack.mjs down --run "$id"; return 1; }
  node scripts/e2e-stack.mjs test --run "$id" --project chromium --project visual -g 'T-612|T-725|T-801'
  local rc=$?
  node scripts/e2e-stack.mjs down --run "$id"
  return $rc
}

for j in "${jobs[@]}"; do run_job "$j" "job_$j"; done
printf '{"at":"%s","head":"%s","jobs":[%s]}\n' "$stamp" "$(git rev-parse HEAD)" "$(IFS=,; echo "${results[*]}")" >"$out/$stamp.json"
echo "summary: $out/$stamp.json"
! grep -q '"rc":[1-9]' "$out/$stamp.json"
