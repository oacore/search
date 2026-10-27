#!/usr/bin/env bash
# ci-local.sh - the whole local test suite on a workstation (42 §10, owner rules of 2026-10-22: the tests are a
# local safety net for the upgrade; no CI, no GitHub, no Docker). Host parity builds (scripts/build-parity.mjs)
# and host stacks (scripts/e2e-stack.mjs), host Chromium. It runs offline: no network lookup, no install, no
# build, and it reads no file under .github/.
#
#   lint   lint parity (T-001), docs check, the accepted-diffs ledger (structural checks; the signature
#          lookups are never made here); the dependency audit gate only with CI_LOCAL_AUDIT=1 (it asks the
#          registry; reported, blocking only with AUDIT_BLOCKING=true)
#   unit   Jest node + dom on the runtime Node 18.20.8, TZ=UTC, V8 coverage into $ARTIFACT_DIR/coverage/jest
#   image  on the parity build of HEAD and its twin (`--suffix ci-b`, T-014 (a)): test:harness and the browser
#          targets; layer A, the whole static project, on the first build's .next; T-008 on its installed
#          tree; T-901 (host); the T-721 negative control
#   e2e    tiers G-I on the host build: chromium + wire in one invocation, visual (all but T-802) in its own,
#          the CS-OPS-1 overlay stack (T-604, T-702), the harness-variant stack (T-802); the variant without a
#          Sentry DSN must exist too (T-608 c2 starts a stack of its own on it)
#   gate   all four jobs green; only evaluated when lint, unit, image and e2e all ran
# The builds are made beforehand and only reused here (owner notes section 0, lean: an APFS clone of the
# repository tree that reuses its installed node_modules, then only the app build step; never `npm ci`): a
# missing build fails its step and names the key (`node scripts/build-parity.mjs --key-only [--variant v]`).
#
# Usage: ARTIFACT_DIR=<dir> bash scripts/ci-local.sh [lint|unit|image|e2e|gate ...]   (default: all five)
# Env:   CI_LOCAL_AUDIT=1        run the dependency audit gate (network: the registry)
#        AUDIT_BLOCKING=true     the audit gate fails the lint job (default: it is reported only)
#        CI_LOCAL_LEDGER_BASE    the git ref whose merge base holds the previous ledger (default: master)
#        CI_LOCAL_KEEP_GOING=1   run the steps after a red one too (diagnosis; the job stays red). By default a
#                                job stops at its first red step.
# Writes $ARTIFACT_DIR/ci-local/<timestamp>.json (+ one log per job) and exits non-zero when a job fails.
set -uo pipefail
set +x
repo="$(cd "$(dirname "$0")/.." && pwd)"
cd "$repo"
export ARTIFACT_DIR="${ARTIFACT_DIR:-$repo/../search-upgrade-artifacts}"
export NEXT_TELEMETRY_DISABLED=1
. "${NVM_DIR:-$HOME/.nvm}/nvm.sh" >/dev/null
node18="$(nvm which 18.20.8)"
node24="$(nvm which 24)"
dir18="$(dirname "$node18")"
export PATH="$(dirname "$node24"):$PATH"
jobs=("$@")
[ ${#jobs[@]} -eq 0 ] && jobs=(lint unit image e2e gate)
stamp="$(date -u +%Y%m%dT%H%M%SZ)"
out="$ARTIFACT_DIR/ci-local"
mkdir -p "$out"
results=()
stacks=()
rcs_lint="" rcs_unit="" rcs_image="" rcs_e2e=""

down_all() {
  local s
  for s in ${stacks[@]+"${stacks[@]}"}; do node scripts/e2e-stack.mjs down --run "$s" >/dev/null 2>&1 || true; done
}
trap down_all EXIT

failed_steps=()
step() { # step <name> <command...>: one step of a job, its result is the command's (CI_LOCAL_KEEP_GOING=1: 0)
  local name="$1" rc
  shift
  echo "--- $name"
  "$@"
  rc=$?
  echo "--- $name: rc=$rc"
  if [ $rc -ne 0 ] && [ "${CI_LOCAL_KEEP_GOING:-}" = 1 ]; then
    failed_steps+=("$name")
    return 0
  fi
  return $rc
}

run_job() {
  local name="$1" rc start=$SECONDS
  echo "=== $name"
  failed_steps=()
  if "job_$name" >"$out/$stamp-$name.log" 2>&1; then rc=0; else rc=$?; fi
  # with CI_LOCAL_KEEP_GOING=1 the steps after a red one ran too: the job is red all the same
  if [ $rc -eq 0 ] && [ ${#failed_steps[@]} -gt 0 ]; then rc=1; fi
  eval "rcs_$name=$rc"
  results+=("{\"job\":\"$name\",\"rc\":$rc,\"seconds\":$((SECONDS - start)),\"log\":\"$out/$stamp-$name.log\"}")
  echo "    rc=$rc ($((SECONDS - start)) s) log $out/$stamp-$name.log"
}

# the build of HEAD for <build-parity args> exists (it is never made here: no install, no build)
need_build() { # need_build <suffix or -> <build-parity args...>
  local suffix="$1" key dir
  shift
  key="$(node scripts/build-parity.mjs --mode host "$@" --key-only | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>console.log(JSON.parse(s).key))')" || return 1
  [ "$suffix" != - ] && key="$key-$suffix"
  dir="$ARTIFACT_DIR/builds/$key"
  if [ -f "$dir/build.json" ] && [ -f "$dir/.next/BUILD_ID" ]; then
    echo "build $key at $dir"
    return 0
  fi
  echo "missing build $key (build-parity args: ${*:-none}): make it first (lean recipe, see the header); nothing is built here" >&2
  return 1
}

# a field of the JSON record `build-parity.mjs --json` prints (after need_build: the existing build is reused)
build_field() { # build_field <field> <build-parity args...>
  local field="$1"
  shift
  node scripts/build-parity.mjs --mode host "$@" --json | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>console.log(JSON.parse(s)[process.argv[1]]))' "$field"
}

# ---------- lint ----------
job_lint() {
  step "Lint parity (T-001)" npm run lint:parity || return 1
  step "Docs check (40 §10)" npm run docs:check || return 1
  step "Accepted-diffs ledger, structural checks (42 §8)" node scripts/ad-ledger.mjs --base "${CI_LOCAL_LEDGER_BASE:-master}" --offline || return 1
  if [ "${CI_LOCAL_AUDIT:-}" != 1 ]; then
    echo "--- Dependency audit gate: skipped (it asks the registry; CI_LOCAL_AUDIT=1 runs it)"
    return 0
  fi
  # reported only, unless the owner made it blocking
  echo "--- Dependency audit gate"
  npm audit --omit=dev --audit-level=high --json >"$out/$stamp-npm-audit.json" || true
  node scripts/audit-gate.mjs "$out/$stamp-npm-audit.json"
  local rc=$?
  echo "--- Dependency audit gate: rc=$rc"
  if [ $rc -ne 0 ] && [ "${AUDIT_BLOCKING:-}" != true ]; then
    echo "audit gate rc=$rc is not blocking (AUDIT_BLOCKING is not true): continue-on-error"
    return 0
  fi
  return $rc
}

# ---------- unit ----------
job_unit() {
  step "Jest, node and dom projects, V8 coverage (C3)" env PATH="$dir18:$PATH" TZ=UTC npm run test:unit -- --ci --coverage --coverageProvider=v8 \
    --coverageReporters=json --coverageDirectory="$ARTIFACT_DIR/coverage/jest"
}

# ---------- image ----------
job_image() {
  local a_key a_dir b_dir id="ci-local-$stamp"
  # the parity build of HEAD; the twin of T-014 (a) = a second build of the same tree
  step "Parity build of HEAD" need_build - || return 1
  step "Harness variant (T-802)" need_build - --variant harness || return 1
  step "Twin build (T-014 (a))" need_build ci-b || return 1
  a_key="$(build_field key)" || return 1
  a_dir="$(build_field dir)" || return 1
  b_dir="$(build_field dir --suffix ci-b)" || return 1
  echo "image build $a_key at $a_dir; twin at $b_dir"
  step "Harness self-tests (T-012, T-612 YAML, SSR stub)" npm run test:harness || return 1
  step "Browser targets equal the committed copy (CS-W0-10)" bash -c 'npx browserslist | diff - test/static/fixtures/browserslist.txt' || return 1
  step "Layer A on the image .next, runtime Node (T-002 .. T-018)" env PATH="$dir18:$PATH" NEXT_DIR="$a_dir/.next" APP_ROOT="$a_dir" \
    NEXT_DIR_A="$a_dir/.next" NEXT_DIR_B="$b_dir/.next" npm run test:static || return 1
  step "T-008 on the installed tree (host equivalent of the alpine arm64 container)" env PATH="$dir18:$PATH" bash test/ops/t008.sh --tree "$a_dir" || return 1
  stacks+=("$id-t901")
  step "T-901, the container contract (host equivalent)" bash test/ops/t901.sh --host --build "$a_key" --run "$id-t901" || return 1
  stacks+=("$id-t721")
  step "T-721 stack" node scripts/e2e-stack.mjs up --run "$id-t721" --build "$a_key" || return 1
  step "T-721 negative control" node scripts/e2e-stack.mjs test --run "$id-t721" e2e/journeys/t721-asset-4xx.spec.mjs --project chromium -g 'T-721 c2'
  local rc=$?
  node scripts/e2e-stack.mjs down --run "$id-t721"
  return $rc
}

# ---------- e2e ----------
job_e2e() {
  local id="ci-local-$stamp" rc=0
  step "Parity build of HEAD" need_build - || return 1
  step "Harness variant (T-802)" need_build - --variant harness || return 1
  step "Variant without a Sentry DSN (T-608 c2, I-07)" need_build - --variant nodsn || return 1
  stacks+=("$id")
  if step "Stack" node scripts/e2e-stack.mjs up --run "$id"; then
    step "Browser projects, then wire (retries 0, from the Playwright config)" node scripts/e2e-stack.mjs test --run "$id" --project chromium --project wire || rc=1
    step "Visual, its own invocation" node scripts/e2e-stack.mjs test --run "$id" --project visual --grep-invert 'T-802' || rc=1
  else rc=1; fi
  node scripts/e2e-stack.mjs down --run "$id"
  stacks+=("$id-ops1")
  if step "Stack with the CS-OPS-1 rule" node scripts/e2e-stack.mjs up --run "$id-ops1" --overlay cs-ops-1; then
    step "T-604 and T-702 with CS-OPS-1" node scripts/e2e-stack.mjs test --run "$id-ops1" e2e/http/t604-next-data.spec.mjs e2e/journeys/t702-navigation-network.spec.mjs --project chromium || rc=1
  else rc=1; fi
  node scripts/e2e-stack.mjs down --run "$id-ops1"
  stacks+=("$id-du")
  if step "Stack of the harness variant" node scripts/e2e-stack.mjs up --run "$id-du" --variant harness; then
    step "T-802 on the harness variant" node scripts/e2e-stack.mjs test --run "$id-du" --project visual -g 'T-802' || rc=1
  else rc=1; fi
  node scripts/e2e-stack.mjs down --run "$id-du"
  return $rc
}

# ---------- gate ----------
job_gate() {
  local j v ok=0
  for j in lint unit image e2e; do
    v="$(eval "echo \$rcs_$j")"
    if [ "$v" = 0 ]; then echo "$j success"; else echo "$j failure (rc=${v:-not run})"; ok=1; fi
  done
  return $ok
}

for j in "${jobs[@]}"; do
  case "$j" in
    lint | unit | image | e2e) run_job "$j" ;;
    gate)
      if [ -n "$rcs_lint" ] && [ -n "$rcs_unit" ] && [ -n "$rcs_image" ] && [ -n "$rcs_e2e" ]; then run_job gate
      else echo "=== gate: skipped (lint, unit, image and e2e must all run in this call)"; fi ;;
    *) echo "unknown job $j (lint|unit|image|e2e|gate)" >&2; exit 2 ;;
  esac
done
printf '{"at":"%s","head":"%s","jobs":[%s]}\n' "$stamp" "$(git rev-parse HEAD)" "$(IFS=,; echo "${results[*]}")" >"$out/$stamp.json"
echo "summary: $out/$stamp.json"
! grep -q '"rc":[1-9]' "$out/$stamp.json"
