# Record phase 2: safety net and baselines (lean mode)

Record 2.0–2.8 | DONE in lean mode, with the open items of §2.8.5 (none blocks jump 1) | 2026-10-20..2026-10-27

- **Rules in force:** D18 (lean target, "relatively sure"), D19 (scope: upgrades, stability, local tests; no GitHub, CI, Docker or DevOps change), D20 (no CI), owner 2026-10-22 ([00](../00-decisions.md) §4b). Gates: [55](../55-gates-and-confidence.md) §0.
- **Where it ran:** one workstation (macOS arm64, 8 CPU, 16 GB). Host parity builds (`scripts/build-parity.mjs`), host stacks (`scripts/e2e-stack.mjs`), host Chromium, runtime Node 18.20.8, tooling Node 24, `retries: 0`.
- **Not done anywhere:** nothing was pushed, merged into `main`, tagged on origin or deployed. `git diff f5cfc20 -- .github kube Dockerfile .dockerignore` is empty.
- **Branches (local):** `upgrade/p2-2<n>-*`; sub-branches were merged with `--no-ff`. This record is on `upgrade/p2-28-exit`, created from `upgrade/p2-27-p1-faults` at `26a4c03`.
- **Sign-offs (01 §7):** Implementer: _. Reviewer: the lean review and two independent verification rounds (§2.8.2), no named person. Owner: pending; the owner signs this record.

## 2.0 Gateway rule and Dependabot: WITHDRAWN (D19)

- **Not run.** CS-OPS-1 (a `kube/` route) and CS-OPS-6 (a `.github/` file) were not applied. With no deploy, the 2.0 probe list, the calibration watch and the signals export `2.0` were not done either.
- **What replaces the gateway rule:** the app-side `_next/data` fix CS-N12-9 in jump 2 (OD-03 D). CS-OPS-1 stays an owner option at deploy time ([20](../20-change-sites.md) §Deploy-time items).
- **Still tested:** a test-only proxy overlay keeps exercising the rule (T-604 and T-702 "with CS-OPS-1").

## 2.1 Harness: DONE (local)

- **Branch and base:** `upgrade/p2-21-harness` (`4f95364`). `<base'>` = `09eb636`, the merge of CS-W0-9.
- **Applied and kept:**
  - CS-W0-9: the `build:test` script only. Its Dockerfile half was reverted.
  - CS-W0-1: `@oacore/design` pinned to exactly 5.0.74. The D17 freeze starts here.
  - CS-W0-10: `overrides` with the browserslist pins and the test-tooling `@babel/*` and `@jridgewell/*` pins, all proven inert.
- **Applied, then reverted** (`63fd000`, D19): CS-W0-7, CS-W0-8 with `.dockerignore`, and the prototype CI workflow.
- **Inertness** (42 §5), on host builds:
  - T-013: the lock is immutable and `npm ls --omit=dev --all` is identical.
  - T-014: two builds are identical.
  - T-006 and T-011..T-014 are green.
- **VF-07 CLOSED:** msw 2.15.0 runs in Jest on Node 18 through the ESM resolver `test/esm-resolver.js`. An exception row for 02 §3.5 is still open (§2.8.5).

## 2.2 Fixtures: DONE

- **Branch:** `upgrade/p2-22-fixtures` (`c84ca94`).
- **Recording:** the fixtures were recorded once from the live API. The key was held outside the repository and was never committed. The fixtures were then scrubbed: `npm run fixtures:scrub-check` reports 0 problems, and the SHA-256 set is in `test/fixtures/SHA256SUMS`.
- **Deviation (owner decision):** the frozen data snapshot contains public provider contact e-mails. It therefore stays local and git-excluded (`test/fixtures/data-snapshot/`). Its SHA-256 set is committed in `test/fixtures/SHA256SUMS` and `test/baseline/manifest.json`, so a regenerated snapshot is detected.
- **VF-03 settled in part:** the live 410 body was not observed.

## 2.3 P0 tests: DONE

- **Branch:** `upgrade/p2-23-p0-tests` (`86007bd`).
- **Result:** every plain P0 row of [41](../41-test-inventory.md) is green on the unchanged app, 3 runs in a row with `retries: 0`.
- **T-728 dev inventory:** 396 loads, 0 unmapped. It was re-recorded at `26a4c03` for the app-tree hash.
- **VF-22 CLOSED:** a disabled filter value has no pointer path and no keyboard path.
- **New quirks:** Q-099..Q-103 were registered in [30](../30-quirks-register.md).

## 2.4 Golden commit: DONE (local stand-in)

- **G** = `689fec9`, with the local tag `p2-local/golden`. The owner's tag `upgrade-golden` on origin is DEFERRED.
- **Golden image replaced by host parity builds of G:** the default build, the harness variant and the variant without a Sentry DSN.
- **Acceptance:** T-006, T-013, T-901 in host mode, and a credential scan of the build trees.
- **VF-09 CLOSED:** two builds of G are identical.
- **42 §4 path check:** 0 paths outside the allowed list.

## 2.5 Baselines: DONE (local, host baseline)

- **Branch:** `upgrade/p2-25-baselines` (`98b3485`).
- **B0-local:** 3 captures are byte-identical over 1,010 files.
- **Stability proof, local share:** 4 of 4 compare runs green. Each run used `--workers` 1 or 4 and a seeded shard order. All 422 pixel comparisons had 0 differing pixels.
- **Limitation:** the baseline is for this host (macOS arm64, Chromium). A capture on another machine is a tool re-capture (42 §9).
- **C4 corpus tools:** built and self-tested on the pilot list (`test/corpus/pilot/`). The real corpus needs 30 days of logs (VF-26) and is DEFERRED.

## 2.6 CI: WITHDRAWN (D20)

- **No workflow** was written.
- **Kept and run locally:** the ledger and audit tools (`scripts/ad-ledger.mjs`, `scripts/audit-gate.mjs`).
- **Local full-suite run:** `bash scripts/ci-local.sh` (42 §10).

## 2.7 P1 tests, breakage catalogue, coverage: DONE (lean)

- **Branch:** `upgrade/p2-27-p1-faults` (`26a4c03`).
- **P1 tests:** every P1 row whose Wave starts in W0–W4e is green. The exception is the DEFERRED halves listed in §2.8.4.
- **Breakage catalogue** (core risk patches; `test/faults/kill-summary.json`):
  - 75 R patches: 74 valid, 74 killed, 0 survivors.
  - R-075-a is invalid because it fails loudly on 10.2.3. Its silent twin R-075-b is killed.
  - All 47 BR risks of 41 §3 are covered, and N_f = 74 (at least 59 needed).
  - Every kill rests on a detector that went red on a real assertion. This was re-checked after the fault-runner fix of 2026-10-27.
- **Coverage** (one merged report on G): 88.79% of app statements, below the 90% target (OD-35).
- **Mutation:** only a partial core-file pass ran, 90.58% for the five core files together. The rest was not run (D18).
- **VF-08 CLOSED:** Stryker 10 runs on a staged copy without `babel.config.js`.

## 2.8 Exit

### 2.8.1 Final full local run (authoritative)

`bash scripts/ci-local.sh` ran once on `26a4c03`: exit 0, all six jobs `success`, summary in `$ARTIFACT_DIR/ci-local/20261027T131838Z.json`. Nothing was red, so nothing was re-run. It used four build trees, which the owner allowed for this run.

| Job | Result |
|---|---|
| lint (21 s) | Lint parity OK.<br>Docs check ERROR 0, WARN 21.<br>Ledger offline pass.<br>Fixture scrub check and SHA256SUMS: 0 problems.<br>Audit skipped by design (`CI_LOCAL_AUDIT` unset). |
| unit (268 s) | Jest `node` + `dom`: 1097/1097 tests, 59/59 suites, 1/1 snapshot. |
| image (64 s) | `test:harness` 25/25.<br>Browser targets OK.<br>Layer A static 91/91, incl. T-014 (a) on the twin pair.<br>T-008 on the installed tree green.<br>T-901 host 11/11.<br>T-721 negative control 3/3. |
| e2e (1579 s) | chromium + wire 945/945.<br>visual 386/386.<br>CS-OPS-1 overlay (T-604, T-702) 26/26.<br>T-802 on the harness variant 73/73. |
| ops (25 s) | Jest ops 18/18 (T-902, T-903, T-904, T-908).<br>T-907 c2 7/7.<br>T-907 c1/c3 rehearsal 2/2. |

- **Extra T-008 runs** on the default build (Node 18.20.8):
  - `test/static/t008-install.test.js`: 9/9.
  - `bash test/ops/t008.sh --tree <build>`: OK. Its 7 problems are all allow-listed, and 2 of them are tooling-only.
- **Builds** (lean: a `cp -Rc` clone of the repository tree with its `node_modules`, then only the app build step):
  - default `2dcca855347eb615`
  - harness `9675716646fa8994`
  - nodsn `7a0e91a90636a54b`
  - twin `2dcca855347eb615-ci-b`
- **Disk:** 100 GB free afterwards. No stack or server was left running.
- **Dependency sync (2026-10-27):**
  - At 2.7 the Stryker tree was added to the lock with `--package-lock-only`, but it was never installed in the repository's `node_modules`. Every lean build tree therefore failed T-008 c2 (`missing:@stryker-mutator/core`, `missing:@stryker-mutator/jest-runner`).
  - Fix: one `npm ci --include=dev --legacy-peer-deps` in the repository root, on Node 18.20.8, with no stack running. It exited 0, and `package.json` and the lock did not change.
  - The build trees were then re-made from the synced tree.

### 2.8.2 Review and verification

- **Lean review (2026-10-22):**
  - 9 targeted regressions were applied in a throwaway copy, and 7 were caught.
  - The two HIGH misses were fixed test-side: a CSV export of a filtered search, and pagination dropping the sort. The fix added T-421, journey cases in T-706 and T-711, and the fault patches R-019-c and R-028-c. T-736 c1 was flaky; it now waits per Tab stop.
  - The audit found no skipped or `.only` tests, no retries, no test without an assertion, and no committed key or PII.
- **Independent verification, two rounds (2026-10-27).** Each round passed four checks:
  - (A) the new tests go red under the two regressions and green without them;
  - (B) T-736 c1 passed 5 runs in a row;
  - (C) `test:ops` and T-901 are green with no workflow file and no Docker, and the runner is offline;
  - (E) scope: no DevOps diff, no app source change outside the listed sites, clean wording and paths.
- **Check (D), one full run all green, failed in both rounds.** The causes:
  - T-008 c2: the install state above.
  - T-728 c4 (round 1 only): the app-tree hash was stale after the DevOps revert. The dev inventory was re-recorded on `26a4c03`.
  - Both causes were fixed. The final run of §2.8.1 is the evidence for (D). It was made by the final-run step, not by a third verifier round.
- **The verifiers' low items are closed:**
  - `scripts/ci-local.sh` now runs the whole suite (ops job and scrub check added).
  - The four Docker-only recipe files were removed.
  - Docs and comments no longer name removed files.
  - The opt-in audit step is documented (42 §10).
  - The CS-W0-10 row lists the `@babel/*` and `@jridgewell/*` pins.

### 2.8.3 MET

- Every P0 and due P1 test is green on the unchanged app, `retries: 0`, 0 flakes in the final run.
- Golden screenshots are 0 px: the visual tier is 386/386 and T-802 is 73/73, with 0 differing pixels in every comparison.
- The SSR, HTTP and SEO contract checks (T-601–T-612, T-729) and the pinned quirks are green.
- Breakage catalogue: 74/74 valid patches killed.
- The local full-suite runner is offline, and the scope rule holds.

### 2.8.4 DESCOPED and DEFERRED

**Descoped by the owner (lean mode, D18; 55 §0):**

- the quirk-level breakage patches (C1-Q / FQ-*);
- the sealed fault batch and its statistic;
- mutation testing, except one sampled run at GATE-S;
- triple runs per step, the 20-run CI series and the flake budget;
- the 14-day and statistical prod windows (GATE-x.6, C6-NI);
- the C6-CI soak;
- CI itself (D20).

**Deferred to the owner (deploy-time items or outside the track):**

- Any push, PR, merge, the docs PR (README §8 action 1(f)), the tags `upgrade-baseline` and `upgrade-golden`, and the final deploy with its 48 h watch and smoke check.
- The Dockerfile, `kube/` and workflow items of [20](../20-change-sites.md) §Deploy-time items. Needed at the final deploy: the Node 24 base image and the design install flag. Checks only: the OpenSSL flag line and HUSKY. Option: the gateway rule.
- The Docker halves: T-008 in alpine, T-901 in the container, VF-05.
- The WebKit and Firefox legs (T-724, T-805 c1, the T-801 engine subset) and the floor-engine clause of T-724, because the browser downloads were not approved.
- T-009 on a release-recipe build, which needs the live data-loader.
- T-907 c1/c3 against a deployment, and the T-904 manual checklist.
- The real C4 corpus and the signals exports (VF-26, VF-04, VF-16, VF-18).

### 2.8.5 Open items (owner decisions or known limits; none blocks jump 1)

1. **Coverage below target (OD-35):** 88.79% against the 90% target. The strict attribution rule is not met only because of Babel helpers that have no source position. If only units with a source statement are counted, coverage is 91.00%. Printed only under D18.
2. **`last-modified` in the T-603 contract:** the tests treat it as presence-only. The matching 40 §1 and 42 §8 wording is an acceptance change: it needs the owner's `SIGNED:` and a new T-012 constants hash.
3. **Allow-list rows the plan still has to record:**
   - The KaTeX console line (Q-101) has no allow-list entry; each test declares it itself. An entry needs an AD row.
   - The two tooling-only peer problems in T-008 (`@types/react`, `picomatch`) need a 02 §4 row or a lock fix.
   - The msw exception of VF-07 needs a 02 §3.5 row.
4. **Wording the owner should settle:**
   - The VG-2 "byte-equal" rule cannot hold on minified chunks.
   - Should `lint:js` cover `.mjs`?
   - Should the raw build-derived baseline `test/baseline/build/` be committed? Today only the derived references are.
   - Should the ~110 MB of PNG baselines move to Git LFS? Every file is below 42 §7's limits.
5. **Known harness limits:**
   - Host baselines only.
   - No nginx: the allow-all listener does not rewrite `/static/search/**`.
   - The resolver ignores `Accept` (E9 BibTeX vs APA), so the cite modal shows only its heading.
   - The proxy rewrites `core.ac.uk` links, so T-801 V8/V9, T-728 and T-605 pin a popover branch that production does not render.
   - T-611 c2 cannot run under `sandbox-exec`.
6. **Fault records:** lean records made before the runner fix of 2026-10-27 may under-report their Jest detectors. The kills themselves stand.
7. **Builds must be re-keyed after this exit's commit.** The commit rewords one comment line in the root `stryker.config.mjs`, which is inside the runtime tree. The build keys and the T-728 c4 app-tree hash therefore move, even though no app byte changes. Before the next full local run, re-key the builds and re-record the dev inventory (01 §10 item 6). Jump 1 changes `package.json`, which needs new builds anyway.

### 2.8.6 Next

The version track, jump 1 (tooling, leaf libraries, design copy; [50](../50-roadmap.md) §4.0) is awaiting the owner's go-ahead. It starts on a branch from `upgrade/p2-28-exit` (01 §10).
