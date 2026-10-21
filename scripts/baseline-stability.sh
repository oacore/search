#!/usr/bin/env bash
# baseline-stability.sh <tag> [options] - one compare run of the stability proof (42 §6 item 5, VF-10): every tier
# against the committed baselines of the chain head, retries 0 (config), on the golden builds of --ref, with the
# worker count of the run and the file order permuted by a recorded seed. Local share only (owner notes §1: host
# baseline, macOS arm64); the 7 runs on ubuntu-24.04-arm are DEFERRED.
#
# Options: --workers 1|4 (default 4)  --seed <n> (default: from the tag)  --shards <k> (default 4)
#          --ref <ref> (default p2-local/golden)  --parts "<unit static harness checks e2e ops1 du t901 t907>"
# File order: Playwright and Jest sort test files (Playwright 1.64 does not keep the CLI file order: checked at
# 2.5), so the order is varied by sharding: each tier runs as --shards shards (`--shard=i/k`) in an order
# permuted by the seed; the `wire` project runs after every chromium shard (`--no-deps`), never beside one.
# RSS of the app process (ps, KiB) is read when the default stack is ready (idle) and after the chromium + wire
# sweep. Writes $ARTIFACT_DIR/stability/<tag>/{summary.tsv,summary.json,logs, Jest JSON, Playwright reports}; exits
# non-zero when a part fails.
set -uo pipefail
set +x

repo="$(cd "$(dirname "$0")/.." && pwd)"
cd "$repo"
export ARTIFACT_DIR="${ARTIFACT_DIR:-$repo/../search-upgrade-artifacts}"
export NEXT_TELEMETRY_DISABLED=1
. "${NVM_DIR:-$HOME/.nvm}/nvm.sh" >/dev/null
node24="$(nvm which 24)"
node18="$(nvm which 18.20.8)"
export PATH="$(dirname "$node24"):$PATH"

tag="${1:?usage: baseline-stability.sh <tag> [--workers 1|4] [--seed n] [--shards k] [--ref ref] [--parts ...]}"
shift
workers=4
seed=""
shards=4
ref=p2-local/golden
parts="unit static harness checks e2e t907 ops1 du t901"
while [ $# -gt 0 ]; do
  case "$1" in
    --workers) workers="$2"; shift 2 ;;
    --seed) seed="$2"; shift 2 ;;
    --shards) shards="$2"; shift 2 ;;
    --ref) ref="$2"; shift 2 ;;
    --parts) parts="$2"; shift 2 ;;
    -h | --help) sed -n '2,17p' "$0"; exit 0 ;;
    *) echo "unknown option $1" >&2; exit 2 ;;
  esac
done
[ -n "$seed" ] || seed="$(node -e 'const c=require("crypto");console.log(parseInt(c.createHash("sha256").update(process.argv[1]).digest("hex").slice(0,8),16))' "$tag")"
out="$ARTIFACT_DIR/stability/$tag"
mkdir -p "$out"
sum="$out/summary.tsv"
key_of() { node scripts/build-parity.mjs --key-only --ref "$ref" --variant "$1" | node -pe 'JSON.parse(require("fs").readFileSync(0)).key'; }
kd="$(key_of default)"
B="$ARTIFACT_DIR/builds/$kd"
BB="$ARTIFACT_DIR/builds/$kd-vf09"
# the shard order of this run: a seeded permutation of 1..k (mulberry32, the recorded-seed PRNG of the gates)
order="$(node --input-type=module -e '
  import { mulberry32 } from "./scripts/gate-stats.mjs"
  const [seed, k] = process.argv.slice(1).map(Number)
  const r = mulberry32(seed); const a = Array.from({ length: k }, (_, i) => i + 1)
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]] }
  console.log(a.join(" "))' "$seed" "$shards")"
printf 'head\t%s\tref %s\tbuild %s\tworkers %s\tseed %s\tshard order %s\tstart %s\n' "$(git rev-parse --short HEAD)" "$(git rev-parse --short "$ref")" "$kd" "$workers" "$seed" "$order" "$(date -u +%FT%TZ)" >>"$sum"
rec() { printf '%s\t%s\t%s\t%s\n' "$1" "$2" "$(date -u +%FT%TZ)" "$3" >>"$sum"; }
keep() { [ "$2" != 0 ] && cp -R "$ARTIFACT_DIR/runs/$3/test-results" "$out/$1-test-results" 2>/dev/null; return 0; }
pwcount() { grep -hE '^\s+[0-9]+ (passed|failed|flaky|skipped|did not run|interrupted)' "$@" | tr -s ' ' | tr '\n' ' '; }
stacks=()
down_all() { for s in "${stacks[@]:-}"; do [ -n "$s" ] && node scripts/e2e-stack.mjs down --run "$s" >/dev/null 2>&1; done; }
trap down_all EXIT
has() { case " $parts " in *" $1 "*) return 0 ;; esac; return 1; }
rss_of() { node scripts/baseline-tools.mjs rss --run "$1"; }
fail=0
jest18() { TZ=UTC PATH="$(dirname "$node18"):$PATH" npx jest "$@"; }
jest_sum() { node -e '
  let p = 0, t = 0, f = 0
  for (const file of process.argv.slice(1)) { try { const r = require(file); p += r.numPassedTests; t += r.numTotalTests; f += r.numFailedTestSuites } catch {} }
  console.log(`${p}/${t} tests, ${f} failed suites`)' "$@"; }

if has unit; then
  rc=0; files=()
  for i in $order; do
    jest18 --selectProjects node dom --maxWorkers="$workers" --shard="$i/$shards" --json --outputFile="$out/unit-$i.json" >"$out/unit-$i.log" 2>&1 || rc=1
    files+=("$out/unit-$i.json")
  done
  rec unit $rc "$(jest_sum "${files[@]}")"; [ $rc = 0 ] || fail=1
fi
if has static; then
  rc=0; files=()
  for i in $order; do
    NEXT_DIR="$B/.next" APP_ROOT="$B" NEXT_DIR_A="$B/.next" NEXT_DIR_B="$BB/.next" \
      jest18 --selectProjects static --maxWorkers="$workers" --shard="$i/$shards" --json --outputFile="$out/static-$i.json" >"$out/static-$i.log" 2>&1 || rc=1
    files+=("$out/static-$i.json")
  done
  rec static $rc "$(jest_sum "${files[@]}")"; [ $rc = 0 ] || fail=1
fi
if has harness; then
  npm run -s test:harness >"$out/harness.log" 2>&1; rc=$?; rec harness $rc ""; [ $rc = 0 ] || fail=1
fi
if has checks; then
  sha256sum -c test/baseline/SHA256SUMS >"$out/sha256sum.log" 2>&1; rc=$?; rec baseline-sums $rc "$(grep -c ': OK$' "$out/sha256sum.log") OK"; [ $rc = 0 ] || fail=1
  npm run -s lint:parity >"$out/lint-parity.log" 2>&1; rc=$?; rec lint-parity $rc "$(tail -1 "$out/lint-parity.log")"; [ $rc = 0 ] || fail=1
  npm run -s docs:check >"$out/docs-check.log" 2>&1; rc=$?; rec docs-check $rc "$(grep -E 'ERROR [0-9]+' "$out/docs-check.log" | tail -1)"; [ $rc = 0 ] || fail=1
  npm run -s fixtures:scrub-check >"$out/scrub.log" 2>&1; rc=$?; rec scrub $rc "$(tail -1 "$out/scrub.log")"; [ $rc = 0 ] || fail=1
fi
if has e2e || has t907; then
  run="ST$tag"
  stacks+=("$run")
  node scripts/e2e-stack.mjs up --run "$run" --ref "$ref" >"$out/up-default.log" 2>&1 || { rec up-default 1 "see up-default.log"; fail=1; }
  rec rss-idle 0 "$(rss_of "$run") KiB"
  if has e2e; then
    rc=0
    for i in $order; do
      node scripts/e2e-stack.mjs test --run "$run" --project chromium --workers="$workers" --shard="$i/$shards" >"$out/e2e-chromium-$i.log" 2>&1 || { rc=1; keep "e2e-chromium-$i" 1 "$run"; }
      cp "$ARTIFACT_DIR/runs/$run/report.json" "$out/e2e-chromium-$i.report.json" 2>/dev/null
    done
    rec e2e-chromium $rc "$(pwcount "$out"/e2e-chromium-*.log)"; [ $rc = 0 ] || fail=1
    node scripts/e2e-stack.mjs test --run "$run" --no-deps --project wire >"$out/e2e-wire.log" 2>&1; rc=$?
    rec e2e-wire $rc "$(pwcount "$out/e2e-wire.log")"; keep e2e-wire $rc "$run"; [ $rc = 0 ] || fail=1
    cp "$ARTIFACT_DIR/runs/$run/report.json" "$out/e2e-wire.report.json" 2>/dev/null
    rec rss-after-sweep 0 "$(rss_of "$run") KiB"
    rc=0
    for i in $order; do
      node scripts/e2e-stack.mjs test --run "$run" --project visual -g 'T-801' --workers="$workers" --shard="$i/$shards" >"$out/e2e-visual-t801-$i.log" 2>&1 || { rc=1; keep "e2e-visual-t801-$i" 1 "$run"; }
      cp "$ARTIFACT_DIR/runs/$run/report.json" "$out/e2e-visual-t801-$i.report.json" 2>/dev/null
    done
    rec e2e-visual-t801 $rc "$(pwcount "$out"/e2e-visual-t801-*.log)"; [ $rc = 0 ] || fail=1
  fi
  if has t907; then
    P2_OPS=1 node scripts/e2e-stack.mjs test --run "$run" e2e/ops/t907-smoke.spec.mjs --project ops -g 'T-907 c2' --workers="$workers" >"$out/t907-c2.log" 2>&1; rc=$?
    rec t907-c2 $rc "$(pwcount "$out/t907-c2.log")"; keep t907-c2 $rc "$run"; [ $rc = 0 ] || fail=1
    P2_OPS=1 P2_OPS_REHEARSE=1 node scripts/e2e-stack.mjs test --run "$run" e2e/ops/t907-smoke.spec.mjs --project ops -g 'T-907 c[13]' --workers="$workers" >"$out/t907-c13-rehearsal.log" 2>&1; rc=$?
    rec t907-c13-rehearsal $rc "$(pwcount "$out/t907-c13-rehearsal.log")"; keep t907-c13 $rc "$run"; [ $rc = 0 ] || fail=1
  fi
  node scripts/e2e-stack.mjs down --run "$run" >"$out/down-default.log" 2>&1
  for f in proxy-access.log ssr-problems.ndjson; do cp "$ARTIFACT_DIR/runs/$run/$f" "$out/default-$f" 2>/dev/null; done
fi
if has ops1; then
  run="ST$tag-ops1"
  stacks+=("$run")
  node scripts/e2e-stack.mjs up --run "$run" --ref "$ref" --overlay cs-ops-1 >"$out/up-ops1.log" 2>&1 || { rec up-ops1 1 "see up-ops1.log"; fail=1; }
  node scripts/e2e-stack.mjs test --run "$run" e2e/http/t604-next-data.spec.mjs e2e/journeys/t702-navigation-network.spec.mjs --project chromium --workers="$workers" >"$out/e2e-ops1.log" 2>&1; rc=$?
  rec e2e-ops1 $rc "$(pwcount "$out/e2e-ops1.log")"; keep e2e-ops1 $rc "$run"; [ $rc = 0 ] || fail=1
  node scripts/e2e-stack.mjs down --run "$run" >"$out/down-ops1.log" 2>&1
fi
if has du; then
  run="ST$tag-du"
  stacks+=("$run")
  node scripts/e2e-stack.mjs up --run "$run" --ref "$ref" --variant harness >"$out/up-du.log" 2>&1 || { rec up-du 1 "see up-du.log"; fail=1; }
  node scripts/e2e-stack.mjs test --run "$run" --project visual -g 'T-802' --workers="$workers" >"$out/e2e-t802.log" 2>&1; rc=$?
  rec e2e-t802 $rc "$(pwcount "$out/e2e-t802.log")"; keep e2e-t802 $rc "$run"; [ $rc = 0 ] || fail=1
  cp "$ARTIFACT_DIR/runs/$run/report.json" "$out/e2e-t802.report.json" 2>/dev/null
  node scripts/e2e-stack.mjs down --run "$run" >"$out/down-du.log" 2>&1
fi
if has t901; then
  bash test/ops/t901.sh --host --build "$kd" --run "ST$tag-t901" >"$out/t901.log" 2>&1; rc=$?
  rec t901-host $rc "$(pwcount "$out/t901.log")"; keep t901 $rc "ST$tag-t901"; [ $rc = 0 ] || fail=1
fi
printf 'end\t%s\tok %s\n' "$(date -u +%FT%TZ)" "$([ $fail = 0 ] && echo true || echo false)" >>"$sum"
# diff-pixels annotations of the visual reports: every one must be 0 (40 §1)
node -e '
  const fs = require("fs"), path = require("path"), dir = process.argv[1]
  let shots = 0, nonzero = 0, tests = 0, failed = 0, skipped = 0, flaky = 0, retries = 0
  const walk = (s) => { for (const x of s.suites || []) walk(x); for (const sp of s.specs || []) for (const t of sp.tests || []) { tests++
    if (t.status === "skipped") skipped++; if (t.status === "unexpected") failed++; if (t.status === "flaky") flaky++
    for (const r of t.results || []) { if (r.retry > 0) retries++; for (const a of r.annotations || t.annotations || []) if (a.type === "diff-pixels") {
      // a comparison annotation is "<n> <file>"; other diff-pixels notes (T-801 c3 "n/a ...") are no comparison
      const m = /^(\d+) /.exec(a.description); if (m) { shots++; if (Number(m[1]) > 0) nonzero++ } else if (/^missing baseline/.test(a.description)) nonzero++ } } } }
  for (const f of fs.readdirSync(dir).filter((f) => f.endsWith(".report.json"))) { try { walk(JSON.parse(fs.readFileSync(path.join(dir, f), "utf8"))) } catch {} }
  const lines = fs.readFileSync(path.join(dir, "summary.tsv"), "utf8").trim().split("\n")
  const head = lines.filter((l) => l.startsWith("head\t")).pop()
  const rows = lines.filter((l) => !/^(head|end)\t/.test(l)).map((l) => { const [part, rc, at, result] = l.split("\t"); return { part, rc: Number(rc), at, result } })
  fs.writeFileSync(path.join(dir, "summary.json"), JSON.stringify({ head, rows, playwright: { tests, failed, flaky, skipped, retries, diffPixelsAnnotations: shots, diffPixelsNonZero: nonzero },
    ok: rows.every((r) => r.rc === 0) && !failed && !flaky && !retries && !nonzero }, null, 1) + "\n")
' "$out"
cat "$sum"
exit $fail
