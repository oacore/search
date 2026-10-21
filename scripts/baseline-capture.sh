#!/usr/bin/env bash
# baseline-capture.sh <golden|recapture|rebaseline> [options] - the local equivalent of
# .github/workflows/baseline-capture.yml (42 §4, §6, §9). Local mode (owner notes §1): host parity builds
# (scripts/build-parity.mjs) and host stacks (scripts/e2e-stack.mjs), host Chromium; the captures are this
# machine's host baseline (macOS arm64). The workflow runs the same steps with E2E_MODE=docker.
#
# Modes:
#   golden      42 §4 + §6 items 1-2 on G = --ref (default p2-local/golden, the local stand-in for the
#               owner's tag upgrade-golden, I-06):
#                 build    the golden parity builds of G: default, nodsn (I-07), harness (T-802); plus a second
#                          default build for T-014 (a) / VF-09
#                 accept   T-006 and T-013 on the golden build, the credential scan (stand-in for
#                          `docker history`), T-901 (host), VF-09 (next-diff of the two default builds);
#                          results and digests in $ARTIFACT_DIR/golden.json
#                 capture  record mode of T-6xx, T-7xx, T-8xx --captures times (default 3), each from fresh
#                          stacks on their own port slots (the stacks of capture i stay up until capture i+1 has
#                          its slot, so no two captures share one); every capture first deletes the capture set
#                          from the working tree (scripts/baseline-tools.mjs clear), so each one writes every file
#                          anew; outputs copied to <out>/c1..cN; then `diff -r c1 c2 && diff -r c1 c3`
#                 extract  test/baseline/build/ from the golden build (T-003, T-004, T-005, T-007, T-010 inputs)
#   recapture   tool re-capture (42 §9): the same captures of the chain-head reference --ref
#   rebaseline  product re-baseline (42 §9, D15): --before <ref> --after <ref>; builds and 3 captures of each;
#               before c1 must equal the committed baselines, after c1 vs before c1 is reported (never run
#               locally so far: no D15 change exists)
#
# Options: --ref <ref>  --before <ref> --after <ref>  --captures <n> (3)  --out <dir> ($ARTIFACT_DIR/capture
#          for golden, $ARTIFACT_DIR/capture-<mode> otherwise)  --steps "<build accept capture extract>"
#          --base-npm-ls <file> (T-013 reference; default $ARTIFACT_DIR/inertness/item3-npm-ls-base-prime-installed.json)
# Writes <out>/capture.json (runs, slots, results) and exits non-zero when a step fails or two captures differ.
# A difference between captures is a determinism bug (40 §5, 42 §6): fix the harness or the owning test, never
# mask it, then capture again.
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

mode="${1:-}"
shift || true
ref=""
before=""
after=""
captures=3
out=""
steps=""
base_npm_ls="$ARTIFACT_DIR/inertness/item3-npm-ls-base-prime-installed.json"
while [ $# -gt 0 ]; do
  case "$1" in
    --ref) ref="$2"; shift 2 ;;
    --before) before="$2"; shift 2 ;;
    --after) after="$2"; shift 2 ;;
    --captures) captures="$2"; shift 2 ;;
    --out) out="$2"; shift 2 ;;
    --steps) steps="$2"; shift 2 ;;
    --base-npm-ls) base_npm_ls="$2"; shift 2 ;;
    -h | --help) sed -n '2,38p' "$0"; exit 0 ;;
    *) echo "unknown option $1" >&2; exit 2 ;;
  esac
done
case "$mode" in
  golden) ref="${ref:-p2-local/golden}"; steps="${steps:-build accept capture extract}"; out="${out:-$ARTIFACT_DIR/capture}" ;;
  recapture) ref="${ref:-p2-local/golden}"; steps="${steps:-build capture}"; out="${out:-$ARTIFACT_DIR/capture-recapture}" ;;
  rebaseline)
    [ -n "$before" ] && [ -n "$after" ] || { echo "rebaseline needs --before <ref> --after <ref>" >&2; exit 2; }
    steps="${steps:-build capture}"; out="${out:-$ARTIFACT_DIR/capture-rebaseline}" ;;
  *) echo "usage: baseline-capture.sh golden|recapture|rebaseline [options] (see --help)" >&2; exit 2 ;;
esac
has() { case " $steps " in *" $1 "*) return 0 ;; esac; return 1; }
mkdir -p "$out"
stamp="$(date -u +%Y%m%dT%H%M%SZ)"
log="$out/capture-$stamp.log"
results=()
stacks=()
fail=0
note() { echo "$*" | tee -a "$log"; }
result() { results+=("$1"); }
down_all() {
  for s in "${stacks[@]:-}"; do [ -n "$s" ] && node scripts/e2e-stack.mjs down --run "$s" >>"$log" 2>&1; done
  stacks=()
}
trap down_all EXIT
json_str() { node -e 'process.stdout.write(JSON.stringify(process.argv[1]))' "$1"; }
build_key() { # <ref> <variant> [suffix]
  node scripts/build-parity.mjs --key-only --ref "$1" --variant "$2" | node -pe 'JSON.parse(require("fs").readFileSync(0)).key'
}
build_dir() { echo "$ARTIFACT_DIR/builds/$(build_key "$1" "$2")${3:+-$3}"; }

do_build() { # <ref>
  local r="$1" rc=0
  note "== build $r (default + nodsn in parallel, then harness; at most two Next builds at once)"
  node scripts/build-parity.mjs --ref "$r" >>"$log" 2>&1 &
  local p1=$!
  node scripts/build-parity.mjs --ref "$r" --variant nodsn >>"$log" 2>&1 &
  local p2=$!
  wait $p1 || rc=1
  wait $p2 || rc=1
  node scripts/build-parity.mjs --ref "$r" --variant harness >>"$log" 2>&1 || rc=1
  if [ "$mode" = golden ]; then
    # T-014 (a) / VF-09: a second build of the same tree, compared below
    node scripts/build-parity.mjs --ref "$r" --suffix vf09 >>"$log" 2>&1 || rc=1
  fi
  result "{\"step\":\"build\",\"ref\":$(json_str "$r"),\"rc\":$rc}"
  note "   build rc=$rc"
  return $rc
}

do_accept() { # golden acceptance (42 §4)
  local b key acc="$out/accept" rc
  b="$(build_dir "$ref" default)"
  key="$(basename "$b")"
  mkdir -p "$acc"
  note "== accept $ref (build $key)"
  NEXT_DIR="$b/.next" APP_ROOT="$b" PATH="$(dirname "$node18"):$PATH" \
    npx jest --selectProjects static --runTestsByPath test/static/t006-design-config.test.js >"$acc/t006.log" 2>&1
  rc=$?; result "{\"step\":\"accept\",\"check\":\"T-006\",\"rc\":$rc}"; note "   T-006 rc=$rc"
  node scripts/baseline-tools.mjs npm-ls --build "$b" --base "$base_npm_ls" --out "$acc/t013-npm-ls.json" >"$acc/t013.log" 2>&1
  rc=$?; result "{\"step\":\"accept\",\"check\":\"T-013 installed tree\",\"rc\":$rc}"; note "   T-013 installed tree rc=$rc"
  local tok=0
  for v in default nodsn harness; do
    node scripts/baseline-tools.mjs token-scan --build "$(build_dir "$ref" "$v")" --out "$acc/token-scan-$v.json" >>"$acc/token-scan.log" 2>&1 || tok=1
  done
  result "{\"step\":\"accept\",\"check\":\"credential scan\",\"rc\":$tok}"; note "   credential scan rc=$tok"
  bash test/ops/t901.sh --host --build "$key" --run "golden-t901-$stamp" >"$acc/t901.log" 2>&1
  rc=$?; result "{\"step\":\"accept\",\"check\":\"T-901 host\",\"rc\":$rc}"; note "   T-901 host rc=$rc"
  node scripts/next-diff.mjs "$b/.next" "$b-vf09/.next" --json >"$acc/vf09-next-diff.json" 2>"$acc/vf09.log"
  rc=$?; result "{\"step\":\"accept\",\"check\":\"VF-09 two builds of G\",\"rc\":$rc}"; note "   VF-09 rc=$rc (a mismatch is recorded, not fatal)"
  node -e '
    const fs = require("fs"), p = require("path"), dir = process.argv[1], rows = JSON.parse(process.argv[2])
    const read = (f) => { try { return JSON.parse(fs.readFileSync(p.join(dir, f), "utf8")) } catch { return null } }
    const vf = read("vf09-next-diff.json")
    const out = {
      "T-006": { rc: rows.find((r) => r.check === "T-006").rc, log: "accept/t006.log" },
      "T-013": { ...read("t013-npm-ls.json"), rc: rows.find((r) => r.check === "T-013 installed tree").rc },
      credentialScan: { variants: Object.fromEntries(["default", "nodsn", "harness"].map((v) => [v, read("token-scan-" + v + ".json")])),
        dockerHistory: "DEFERRED (no image; owner notes §1, I-23)" },
      "T-901": { rc: rows.find((r) => r.check === "T-901 host").rc, mode: "host", log: "accept/t901.log" },
      "VF-09": vf ? { identical: vf.identical, files: vf.files, differ: vf.differ.length, onlyA: vf.onlyA.length, onlyB: vf.onlyB.length } : null,
    }
    fs.writeFileSync(p.join(dir, "acceptance.json"), JSON.stringify({ acceptance: out }, null, 1) + "\n")
  ' "$acc" "[$(IFS=,; echo "${results[*]}")]"
  node scripts/baseline-tools.mjs golden --ref "$ref" --tag "$ref" --out "$ARTIFACT_DIR/golden.json" --accept "$acc/acceptance.json" >>"$log" 2>&1
  return 0
}

record() { # <run id> <playwright args...>
  local id="$1"
  shift
  node scripts/e2e-stack.mjs test --run "$id" --record "$@" >>"$log" 2>&1
}
up() { # <run id> <ref> [extra up args]
  local id="$1" r="$2"
  shift 2
  stacks+=("$id")
  node scripts/e2e-stack.mjs up --run "$id" --ref "$r" "$@" >>"$log" 2>&1
}
slot_of() { node -pe 'JSON.parse(require("fs").readFileSync(process.argv[1] + "/runs/" + process.argv[2] + "/env.json", "utf8")).slot' "$ARTIFACT_DIR" "$1" 2>/dev/null; }

capture_once() { # <ref> <dir> <i>
  local r="$1" dir="$2" i="$3" id rc=0 rcs=""
  id="bc-$stamp-$(basename "$dir")-c$i"
  note "== capture c$i of $r"
  node scripts/baseline-tools.mjs clear >>"$log" 2>&1
  up "$id" "$r" || { note "   up $id failed"; return 1; }
  record "$id" --project chromium --project wire; rcs+="chromium+wire=$? "
  record "$id" --project visual -g 'T-801'; rcs+="visual-T-801=$? "
  up "$id-du" "$r" --variant harness || { note "   up $id-du failed"; return 1; }
  record "$id-du" --project visual -g 'T-802'; rcs+="visual-T-802=$? "
  node scripts/e2e-stack.mjs down --run "$id-du" >>"$log" 2>&1
  case "$rcs" in *=[1-9]*) rc=1 ;; esac
  node scripts/baseline-tools.mjs collect --to "$dir/c$i" >>"$log" 2>&1 || rc=1
  result "{\"step\":\"capture\",\"capture\":\"c$i\",\"ref\":$(json_str "$r"),\"run\":\"$id\",\"slot\":$(slot_of "$id"),\"runHarness\":\"$id-du\",\"slotHarness\":$(slot_of "$id-du"),\"rc\":$rc,\"record\":$(json_str "$rcs")}"
  note "   c$i: $rcs (slot $(slot_of "$id"), harness slot $(slot_of "$id-du"))"
  return $rc
}

capture_set() { # <ref> <dir>
  local r="$1" dir="$2" i rc=0
  mkdir -p "$dir"
  for i in $(seq 1 "$captures"); do capture_once "$r" "$dir" "$i" || rc=1; done
  down_all
  note "== diff -r of $dir"
  local d=0
  for i in $(seq 2 "$captures"); do
    if diff -r "$dir/c1" "$dir/c$i" >"$dir/diff-c1-c$i.txt" 2>&1; then note "   diff -r c1 c$i: exit 0"; else d=1; note "   diff -r c1 c$i: DIFFERENT (see $dir/diff-c1-c$i.txt)"; fi
  done
  node scripts/baseline-tools.mjs diff --out "$dir" --n "$captures" >>"$log" 2>&1
  result "{\"step\":\"diff\",\"dir\":$(json_str "$dir"),\"identical\":$([ $d = 0 ] && echo true || echo false)}"
  [ $d = 0 ] && [ $rc = 0 ]
}

case "$mode" in
  golden | recapture)
    if has build; then do_build "$ref" || fail=1; fi
    if [ "$mode" = golden ] && has accept; then do_accept || fail=1; fi
    if has capture; then capture_set "$ref" "$out" || fail=1; fi
    if [ "$mode" = golden ] && has extract; then
      node scripts/baseline-tools.mjs extract --build "$(build_dir "$ref" default)" --to "$repo/test/baseline/build" >>"$log" 2>&1
      rc=$?; result "{\"step\":\"extract\",\"rc\":$rc}"; note "== extract rc=$rc"; [ $rc = 0 ] || fail=1
    fi
    ;;
  rebaseline)
    if has build; then do_build "$before" || fail=1; do_build "$after" || fail=1; fi
    if has capture; then
      capture_set "$before" "$out/before" || fail=1
      capture_set "$after" "$out/after" || fail=1
      # before vs the committed baselines: no difference allowed
      rm -rf "$out/committed" && mkdir -p "$out/committed"
      git archive HEAD $(node scripts/baseline-tools.mjs paths) | tar -x -C "$out/committed"
      if diff -r "$out/committed" "$out/before/c1" >"$out/diff-committed-before.txt" 2>&1; then note "   before = committed"; else fail=1; note "   before differs from the committed baselines: stop (42 §9 step 2)"; fi
      diff -r "$out/before/c1" "$out/after/c1" >"$out/diff-before-after.txt" 2>&1
      note "   after vs before: $(grep -c '^diff\|^Only\|^Binary' "$out/diff-before-after.txt") entries (declare each as a kind: product row)"
    fi
    ;;
esac

printf '{"mode":"%s","ref":%s,"commit":%s,"stamp":"%s","captures":%s,"out":%s,"steps":[%s],"ok":%s}\n' \
  "$mode" "$(json_str "${ref:-$before..$after}")" "$(json_str "$(git rev-parse "${ref:-HEAD}^{commit}" 2>/dev/null)")" "$stamp" "$captures" \
  "$(json_str "$out")" "$(IFS=,; echo "${results[*]}")" "$([ $fail = 0 ] && echo true || echo false)" >"$out/capture.json"
note "summary: $out/capture.json (ok=$([ $fail = 0 ] && echo true || echo false))"
exit $fail
