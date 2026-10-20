# 50 — Roadmap: order, steps, effort

**Purpose.** The execution order from today's stack to GATE-F, one step at a time, with binary entry and exit per step.
**Read it** to pick the next step and check its entry, then execute it with [01](01-playbook.md). **Owns:** OC-1..OC-24; steps 2.0–2.8 and W0…W8 (entry, exit, step-specific rollback, security column, effort, calendar); parallelism. Elsewhere: CS rows [20](20-change-sites.md), tests [41](41-test-inventory.md), runbook, rollback and DoD 01, gates [55](55-gates-and-confidence.md), versions [02](02-version-matrix.md), phases 6–7 [70](70-phase6.md), [80](80-phase7-antd.md).

## 1. Phase order

Binding order: [00](00-decisions.md) §5. Phases 3 (bump) and 4 (fix) interleave per step: a step bumps, fixes, is green on the full pre-merge suite and goes to prod alone before the next starts ([90](90-open-decisions.md) OD-01, default A). Phase 5 (design copy) = W0.5 and W5. The version track ends at GATE-S.

- **Step** = one deployable unit through 01 §4 (branch, CS PRs, pre-merge suite incl. C6-CI, prod merge, 48 h watch, record). **"X DONE"** = `records/X.md` signed and X marked DONE in [STATUS](STATUS.md) §4.
- **Renamed** (review:00 X20.2, X50.5): W4c is now Next 12.1.6 (the draft's W4c, Next 11.1, cannot build the app); W6b WITHDRAWN (→ W5.5); W9 = 6.7; L1 sweep = 6.10; L2 sweep = part of 7.F; OC-1..OC-14 = the draft's O1–O14.

## 2. Ordering constraints

| OC | Constraint | Evidence | How handled |
|---|---|---|---|
| OC-1 | Tests and baselines before any dependency change, hygiene included | D1, D2; X40.5 (R-084) | Phase 2 before W0; test devDependencies proven inert (T-013, T-014; [42](42-baselines-and-ci.md) §5) |
| OC-2 | Lint is red today (13 ESLint + 16 stylelint findings) | findings/05 §2.3 | Lint parity (T-001), not lint-zero; no `--fix` for ESLint/stylelint (R-049) |
| OC-3 | `@oacore/design` 5.0.74 peers `react ^17.0.1`, pulls react-slick | findings/04; R-014 | W5 widens peers (CS-DSN-3/-4) before W6a |
| OC-4 | `data/data-loader.js:5` requires the undeclared, hoisted `node-fetch`; Next 12 stops hoisting it | X10.20 (R-017) | W4a (CS-N12-1) before W4c |
| OC-5 | Decorators need Babel; Babel 8 is unusable; Next keeps Babel while `babel.config.js` exists | X02.9; findings/05 §1 | Babel 7.29.x (W2e) through GATE-S; `export x from` removed at W0 (CS-BAB-3); SWC mandatory at 6.7 |
| OC-6 | 32 decorator lines in 5 stores (26 MobX in `store/filters.js`, 6 `@invalidatePreviousRequests`) | `git grep -nE '^[[:space:]]*@[a-zA-Z]' -- store` | CS-BAB-1 with CS-BAB-2 at 6.5 (70) |
| OC-7 | Next 13 needs React ≥18.2; Next 12 accepts 17 and 18 | 02 §3.1 | React 18 on 12.3.7 (W6a) before W6c; React 19 on 15.5.28 (W7b) before W7c |
| OC-8 | mobx-react-lite 4.1 supports React 16.8–19; mobx 7 / mlr 5 need React 18, drop decorators | findings/01 §8.1; X02.8 | W3 stays on mobx 6 / mlr 4; MobX removed at 6.5; fallback CS-MOBX-3 (OD-13) |
| OC-9 | ESLint >7, stylelint >13 need the private `@oacore/*` configs replaced | findings/01 §1; X02.1–X02.3 | W1 replaces configs and versions together |
| OC-10 | Next 16 defaults to Turbopack, which rejects `webpack()` | findings/02 §1.2 (R-036) | `--webpack` (CS-N16-2) through the track; revisit after 6.9 and 7.F (OD-10) |
| OC-11 | OpenSSL flag needed at 10.2.3 + webpack 5, not from 12.1.6; 12.3.7 fails on Node 26 | X20.4, X02.4; 02 §2 | Runtime Node 18 to W4d, 24 at W4e (OD-05), 26 at 6.10; flag removed at W4c |
| OC-12 | The PostCSS chain must keep its output while it processes design CSS | findings/04 §3.2, 05 §3.4 (R-008, R-009) | W8 one plugin per commit, T-003 identical, T-801 0 px |
| OC-13 | RTL 12 is the last release for React 17 | 02 §3.5 | All RTL via `test/utils/render.js`, swapped at W6a (CS-R18-5) |
| OC-14 | Baselines must come from the production artefact | X40.4 (R-091) | Golden image at 2.4 (Node 18 alpine arm64, webpack 4, prod env; 42 §4) |
| OC-15 | Gateway `_next/data` rule live before any Next ≥12.2 in prod | X10.1, X20.1 (R-068) | CS-OPS-1 at 2.0, an in-repo PR the existing deploy applies; W4d entry checks prod |
| OC-16 | W0b before W4b | X20.1, X10.3 | CS-W0b-3 is needed from webpack 5 (R-040); the other rows precede their breaking version |
| OC-17 | W1 needs tooling Node 24; serial before W2 | X50.3, X02.5 | One stage; Prettier rewrites files W2/W3 touch; lint-staged 17 needs Node ≥22.22.1 |
| OC-18 | W0.5 after the 2.5 baselines | X60.2; review:roadmap-process RP-14 | Tarball proven identical against baselines from the registry package (T-014, T-016) |
| OC-19 | W5.5 after W5, before W6a | X50.5; OD-40 | React 18 spike needs W5's widened peers; proven fixes land on React 17 |
| OC-20 | CS-R19-2/-3 before React 19 and before CS-R19-1 | X20.12; review:00 §5 C-9 | First PRs of W7b; CS-R19-1 own PR at 6.1 |
| OC-21 | One deployable step in flight; no merge to `main` during a step's watch | X50.1, X50.3 (R-088) | 01 §4 "Never"; §7 |
| OC-22 | Design CSS frozen (DV7) before PostCSS plugins are removed | X60.6, X70.2 | 6.9: CS-DSN-6, then CS-CSS-1..4 |
| OC-23 | zustand port in JS before TS conversion | X70.3, X70.6 | 6.5 before 6.6 (70) |
| OC-24 | No antd code on `main` before GATE-A is signed by the Owner | D10 | antd spikes on unmerged branches only (80, 7.0) |

## 3. Phase 2 — safety net and baselines (2.0–2.8)

No runtime behaviour change. 2.0 and 2.1 are deployable (01 §4); 2.2–2.8 are test, CI and docs PRs (01 §6 non-deployable steps), whose merges still redeploy an unchanged runtime tree (R-088). 2.0a and 2.0b are WITHDRAWN (2026-10-20, with OD-29): one step 2.0. Until `CI / gate` is required (2.6) PRs and the 2.0/2.1 runbooks follow the 01 §6 bootstrap rules. Workflows appear at: prototype `ci.yml` 2.1; `baseline-capture.yml` 2.4; `golden-canary.yml`, `gate-s.yml`, `soak.yml` 2.5; full `ci.yml`, `CI / gate` 2.6; `faults.yml`, `mutation.yml` 2.7 (42 §10); other harness files: 40 §10. Entry always includes the previous exit. Record: `records/phase-2.md`, a section per step.

| Step | Content | Entry (extra) | Exit (binary) | pd |
|---|---|---|---|---|
| 2.0 | Branch `upgrade/p2-20-gateway`: CS-OPS-6, then CS-OPS-1 (label `infra`, owner signs); one runbook pass, one watch. CS: 20 §2.0 | Phase 1b approved, docs PR merged (README §8); 01 §2 start check done (a product commit before B0 moves `<base>`); plan runs under the STATUS §2 defaults; STATUS §1 People filled; VF-04 (read access), VF-16, VF-18, VF-26 settled (an answer may be "unavailable") | CS-OPS-6 and CS-OPS-1 merged, their 20 proofs met; CS-OPS-1 on prod (deploy run log and the probe list, 01 §6); VF-01 part (1) recorded (20 §2.0); VF-14 (prod probe path) settled; calibration watch recorded (55 C6-prod); signals export `2.0` committed (55 C6-NI), each missing source recorded unavailable with an owner-signed latest export date | 1–2 |
| 2.1 | Branch `upgrade/p2-21-harness`, one runbook pass: CS-W0-9 first (= `<base'>`); then the harness PRs of the 5-day calibration spike (root devDependencies, `jest.config.js`, scripts, T-006/T-011..T-014, 1 test per layer, prototype `ci.yml`), each T-013-checked against `<base'>`; then CS-W0-8 (with `.dockerignore`), -7, -1, -10; CS-NODE-5 verify; inertness proof (42 §5). CS: 20 §2.1 | — | T-006, T-011..T-014 green; calibration watch recorded (55 C6-prod); CS-W0-1 in prod (D17 freeze starts); `<base'>` and the `node:18-alpine` digest in STATUS §1; VF-05 (npm ci, ICU), VF-07, VF-09, VF-11 settled; re-estimate in STATUS (VF-17) | 5–8 |
| 2.2 | Fixtures recorded once with an API key, scrubbed, committed (OD-24/25) | API key held by the implementer, never committed | Every 41 fixture scenario ID exists; scrub check passes (40 §6); fixture SHA-256 set in STATUS §1 (42 §7); VF-03 settled on the 2.2 sample | 2–3 |
| 2.3 | All plain P0 tests, incl. the React-17 hydration inventory (T-728) | — | Every plain P0 row of 41 green on the unchanged app, 3 runs, `retries: 0`; VF-22 and VF-13 (GA part) settled | 18–28 |
| 2.4 | Golden commit G (tag `upgrade-golden`); golden image built by `baseline-capture.yml` (new, mode `golden`; arm64; rebuilt from G when needed, OD-46) | CS-OPS-1 on `main` (= prod, 42 §4) | G and the first build's digest in STATUS §1; G meets 42 §4; image never deployed | 1 |
| 2.5 | Baselines captured from the golden image; C4 corpus built | VF-04 (DSN host, CSP outcome) settled | 3 captures byte-identical; stability proof (42 §6); committed (42 §7); B0 in STATUS §1; VF-10 settled; VF-03 re-settled on the corpus responses; C4 corpus built, sanitised (scrub report owner-signed, 42 §7), accepted (55 C4) and committed, its SHA-256 set and draw seeds in STATUS §1; golden-vs-golden corpus run 0 diffs with every URL rendered twice (two renders that differ = a determinism bug, fixed in the harness, never normalised); C6-prod row 7 N, M set and calibration H0 recorded (55 C6-prod); `golden-canary.yml`, `gate-s.yml`, `soak.yml` live; C6-NI `2.0` export verified (55 C6-NI) | 5–8 |
| 2.6 | CI workflows (CS-NODE-4) | — | 20 consecutive green `CI / gate` runs on the unchanged app (55 C5); `CI / gate` the only required check on `main` (CI-7), settings screenshot in the record | 1–2 |
| 2.7 | P1 tests for W0–W4e; C1–C3 baselines | — | Every 41 P1 row whose Wave starts in W0–W4e green; C2 recorded (55 C2; VF-08 settled); C3 measured on G, incl. the attribution check (55 C3); R fault patches per 41 §3 BR row, ≥59 valid (risk, mechanism) pairs, first-run recall recorded, all killed (55 C1 (a)); a patch and `.expect` per clause of each non-exempt PINNED quirk, valid and killed, `test/faults/Q-clauses.json` (`none` marks seeded and owner-signed) and the exempt list (C1-Q; design paths in a derived image); C4 positive controls fixed in `test/faults/controls.json`, each ≥1 diff on its aspect (55 C4); `faults.yml`, `mutation.yml`, `run-faults.mjs`, `merge-coverage.mjs`, `gate-stats.mjs` (known-answer tests in T-012), `outdated-at.mjs` exist | 11–17 |
| 2.8 | Phase-2 exit record | — | All P0 green on G; 3 identical captures + stability proof; CI-7 required; CS-OPS-1 and CS-OPS-6 live (the 2.0 record); C1–C5 recorded; C6-CI calibration (3 runs with the golden image in every arm, 55 C6-CI) and today's rollout 5xx/404 (C6-prod row 10) recorded; C6-prod row 8 passed on prod or its exclusion owner-signed (55 C6); OD-35 2.8 items signed (C1-Q exempt list and `none` marks, C6-prod and C6-CI calibration re-sets); golden digest in STATUS; signed by Implementer, Reviewer, Owner | — |

Rollback: 2.0 and 2.1 — 01 §5 (revert; the deploy workflow re-applies the previous `kube/` manifests); never revert CS-OPS-1 while Next ≥12.2 is in prod; CS-W0-8's Dockerfile and workflow flag revert together. 2.2–2.8 change no runtime: revert the PR; baselines change only by re-capture (42 §9). Optional: the P0 suite on `node:24-alpine` with Next 10 (informs OD-05).

## 4. Version track (W0 … W8, GATE-S)

Each row also needs the DoD (01 §6, incl. the 55 §1 step column), every CS Proof in 20 under the step's heading (60 for W0.5, W5), and tests = all P0 + the 41 rows whose Wave lists the step. Versions per 02, re-resolved at step start (02 §5). **Rollback** = revert the merge, or re-run the previous deploy first (01 §5); the column adds only what is specific. **Sec** = Next advisories open in prod during the step (`npm audit`, total / critical); the unused image optimizer stays as today (OD-41, S-10); today's 10.2.3 has 16, a superset of 12.3.7's, incl. GHSA-2xp9-vwfh-vxw4 (image-optimizer RCE, fixed in 15.5.24). **Cal** = pd + 2 (48 h watch; C6-CI runs inside pd).

| Step | Content | Entry (extra) | Exit beyond DoD (binary) | Rollback | Sec | pd | Cal |
|---|---|---|---|---|---|---|---|
| W0 | Dead deps out, undeclared declared, `export x from` rewritten, bibtex-parse-js + i18n data vendored, `\|\| npm install` → retry chain | 2.8 DONE; T-008 green on linux/arm64; VF-19 settled | `.next` identical to the baseline build except the chunks holding the vendored bibtex/i18n modules; T-108, T-114, T-410, T-602, T-801 green; T-008 strict problem set shrinks only by logrocket-react; signals export `W0` committed at the merge (55 C6-NI) | Restores the 450 bibtex lock entries | 16; audit 146 → 94 | 2–3 | 4–5 |
| W0b | Six Next-proofing changes, one PR each, neutral on 10.2.3 | — | CS-N11-9 placed (here if neutral, else W4c) and recorded | Removes all six; re-land the innocent rows as a new W0b run | 16 | 2–3 | 4–5 |
| W0.5 | Design 5.0.74 tarball as `file:` dependency (CS-DSN-1, 60) | 2.5 baselines exist (OC-18) | [60](60-design-ownership.md) §5 W0.5 row: VG-1..VG-7 vs the W0b build, T-016 | Back to the registry spec (needs `NPM_TOKEN`) | 16 | 1 | 3 |
| W1 | Lint, format, hooks on tooling Node 24; `@oacore/*` configs removed (why now: §4.1) | — | T-001 new-tool baseline captured on unchanged code and frozen; `.next` identical except the Prettier-touched modules; T-801 0 px | Back to old configs (needs `NPM_TOKEN`) | 16 | 3–5 | 5–7 |
| W2a | Sentry 7.120.4 | W1 DONE (OC-17) | T-608 shows today's crash semantics; GHSA-593m-55hh-j8gv gone from `npm audit`; SDK calibration (55 C6-NI) | Back to Sentry 5.30 semantics | 16 | 1–2 | 3–4 |
| W2b | LogRocket 12.4.0 + CSP host, one PR | — | T-116 diff signed as an AD row; T-720 0 violations; SDK calibration (55 C6-NI) | Never revert the CSP without the SDK (R-026) | 16 | 1 | 3 |
| W2c | core-js 3.51.0 | — | Client chunk diff = core-js bodies only | — | 16 | 0.5 | 2.5 |
| W2d | postcss 8.5.31 | — | T-003 declaration sets identical | — | 16; postcss advisories closed | 0.5 | 2.5 |
| W2e | Babel 7.29.x; react-focus-lock, katex lock-only PRs (02 §3.7) | — | `.next/static` diff = Babel helpers only | — | 16 | 1–2 | 3–4 |
| W3 | mobx 6.16.1 + mobx-react-lite 4.1.1 | — | T-203 reactivity table identical | — | 16 | 1–2 | 3–4 |
| W4a | data-loader on global `fetch` (CS-N12-1) | Prerequisites: T-604, T-702, T-004, T-003, T-801 and the forced-500 fixture (T-601) green; OD-03, OD-05, OD-37, OD-38 usable | T-117 four cases equal; AD rows for log text and undici timeout signed (OD-08) | Build-time only | 16 | 1 | 3 |
| W4b | 10.2.3 + `future.webpack5` | — | 0 HTML, 0 CSS diffs (T-602, T-003) | — | 16 | 1–2 | 3–4 |
| W4c | Next 12.1.6, react-ga4 3.0.1, source-maps flag, OpenSSL flag removed, lock regenerated, OD-37/OD-38 applied | If OD-37 = A, its closing step named in 02 §4 | Musl SWC entries in the lock (T-008); minifier diffs = signed AD rows with T-801 0 px (VF-06); VF-05 (lock patcher), VF-24 settled; audit count recorded; react-ga4 SDK calibration (55 C6-NI) | Revert restores the old lock exactly (`npm ls --omit=dev` equal) | 14 / 2 (lock of Next 12.1.6 alone, review 2026-10-20; re-count on the branch) | 3–5 | 5–7 |
| W4d | Next 12.3.7 | CS-OPS-1 live on prod (OC-15); VF-14, VF-25 settled | T-604/T-702 via the proxy with the rule: JSON + `pageProps`, 0 document requests; VF-01 part (2): the prod `_next/data` probe right after rollout = 200 JSON, else revert at once (20 §2.0); T-015 floor recorded; header deltas as AD rows (OD-39) | Keep CS-OPS-1 (R-068) | 15 / 1 | 2–3 | 4–5 |
| W4e | Runtime Node 24 (image by digest) | — | T-908 every logo host OK; first-rollout Host/Authorization check passed (01 §4 step 8, VF-02) | Target = the Node 18 image | 15 / 1 | 1–2 | 3–4 |
| W5 | Design vendored as in-repo directory package, DV0–DV6 (60) | DV0: T-417, T-418, T-802 against the phase-2 golden baselines identical, 0 px (diff = W4 regression: stop) | VG-1..VG-7 pass (55 §6); VF-27 settled | Restores the W0.5 tarball | 15 / 1 | 8–12 | 10–14 |
| W5.5 | ESCALATES fixes on React 17, proven sites only (§4.2) | — | §4.2 steps 3–5 done; spike: 0 hydration events outside the T-728 pinned diff | Revert only the failing fix (re-landing needs a new signature) | 15 / 1 | 2–4 | 4–6 |
| W6a | React 18.3.1 on 12.3.7; RTL 16 swap | W5.5 DONE (OC-19) | T-701/T-728 0 events outside the pinned diff, its tuple set recorded (55 C7 (1)); streaming header deltas as AD rows | — | 15 / 1 | 2–3 | 4–5 |
| W6c | Next 13.5.11 | — | CSP-on-308 loss as an AD row (OD-39); VF-21 settled; audit count recorded | — | 31 / 2 (lock of Next 13.5.11 alone; the worst interim stop): start W6d right after the record | 2–3 | 4–5 |
| W6d | Next 14.2.35 | VF-20 settled | Musl SWC binary in the alpine arm64 image (T-008, T-901) | — | 23 / 2: start W7a right after the record | 1–2 | 3–4 |
| W7a | Next 15.5.28, React 18 kept | CS-OPS-1 live (without it the client blanks from 15.4) | T-729 head diff as AD rows (OD-39); T-015 recorded; CI-8 blocking from here (42) | Target 14.2.35 (2 critical): fix forward unless 55 C6 is breached | 0 | 2–3 | 4–5 |
| W7b | React 19.3.1; CS-R19-2/-3 first | T-404 green on React 18 with CS-R19-2/-3 merged (OC-20) | T-701/T-728 against the pinned diff, tuple set re-recorded (55 C7 (1)); T-602 title not empty | Revert only the React commit | 0 | 2–3 | 4–5 |
| W7c | Next 16.4.2 with `--webpack` | — | Build log shows webpack, no "Unrecognized key" | — | 0 | 2–3 | 4–5 |
| W8 | PostCSS chain majors, mandatory; last CS PR: the GATE-S sweep (02 §5 on every row, 55 GATE-x.1) | — | Each plugin at latest with T-003 identical and T-801 0 px, or an EXCEPTION row in 02 §4 (blocker evidence, closes at 6.9) | Revert one plugin's commit → EXCEPTION row | 0; cssnano 4 advisories closed | 3–5 | 5–7 |
| GATE-S | End of the version track | W8 DONE | 55 §3 all true (incl. final Playwright bump + golden re-capture, 42 §9; gate commit ≥14 days in prod); `records/gate-S.md` signed | — | 0 | 3–5 | ≥14 |

Next 12.3.7 is in prod from W4d through W6a (five steps): do not pause the track there. The critical RCE (image optimizer, reachable as today, OD-41), rewrite smuggling (<15.5.13) and rewrite SSRF (<15.5.21) stay open until W7a, as on 10.2.3 today (X10.9).

### 4.1 Why W1 runs before stability

D11 (M6) adopts these tools after stability, but search already runs ESLint 7, Prettier 2 and husky 4, so W1 is M1 version work, not M6 adoption: it removes the private `@oacore/*` configs and has zero runtime effect (`.next` identical except Prettier-touched sources, T-801 0 px); lint-staged joins under the same rule. The dashboard-convention part (TS blocks, typescript-eslint for TS, `*.{ts,tsx}` globs) is 6.2 (70). (X50.3)

### 4.2 W5.5 proof procedure (OD-09, OD-40; 30 §E)

1. Branch `upgrade/w55-spike` from `main` after W5 DONE, never merged: React 18.3.1 with W5's widened peers.
2. On it run T-701 and T-728 (3 TZ × cookie states × 3 engines), T-723 and T-732 through the proxy, and the T-014 method for Q-052.
3. Per candidate (Q-050, Q-051, Q-052, Q-072, Q-075, Q-093) record the result in `records/W5.5.md`: red = PROVEN, green = REJECTED (stays PRESERVE). Q-050 is tested only if VF-03 or the C4 corpus responses (55 C4) show `Z`, offset or date-only values. This settles VF-23.
4. Each PROVEN site: one `escalates` PR on React 17 (CS-R18-2, -3, -4, CS-ESC-1..3), owner `SIGNED:`, T-801 0 px, AD row if SSR HTML changes.
5. Rebase the spike on the fixes: every previously red test is green. Nothing PROVEN: no deploy; write the record, go to W6a.

## 5. Phases 6 and 7

| Phase | Entry | Scope | Exit | pd |
|---|---|---|---|---|
| 6 | GATE-S signed | 6.0–6.10: [70](70-phase6.md) | GATE-A signed by the Owner (55 §4; D10) | 43–70 |
| 7 | GATE-A signed | 7.0, 7.1, `7.2.<DU>`, 7.F: [80](80-phase7-antd.md) | GATE-F (55 §5) | 54–85 (+8–12 only if OD-33 becomes P2) |

## 6. Effort and calendar

pd = one implementer's working days; phases 2, 6, 7 bottom-up from review:roadmap-process RP-19, the version track from §4. Unverified: re-estimate after each calibration spike (2.1: 5 days; 6.0: first week, 70; 7.0: 5 days, 80), record in STATUS (VF-17).

| Scope | pd | Calendar (one implementer) |
|---|---|---|
| Phase 2 | 44–69 | pd + 4 d (2.0, 2.1: 2 d watch each) |
| Version track W0…GATE-S | 48–76 | floor 24 units × 2 d = 48 d; ≈ 73–133 d incl. the 14-day GATE-S window |
| Phase 6 | 43–70 | pd + 2 d per deployable sub-wave (70) + 14 d before GATE-A |
| Phase 7 | 54–85 | pd + 2 d per deployable unit (80) + 14 d before GATE-F |
| Total | 189–300 | — |
| Buffer | +20% pd; per rollback +1 cycle (the step's pd + 2 d) | assumption until VF-17 |

- Lower bound: the next step's engineering overlaps the current watch (§7); upper: no overlap. W5.5 with nothing PROVEN saves 2 d.
- Nothing waits on GitHub schedules (late starts, none 2026-10-02..12, disabled after 60 idle days; X50.15). The watch runs by wall clock from the recorded rollout.
- Merge to prod in working hours, and only when someone who can merge a revert or re-run the deploy is available through the 48 h watch (01 §5).
- Each gate window (≥14 d) holds every merge to `main` (01 §2 gate window hold); an urgent change restarts it (+14 d).

## 7. Parallelism

- Alongside any step: test writing (P1 rows of later Waves) and doc PRs.
- Steps are serial: never two deployable steps in flight (OC-21).
- Overlap: step N+1 may run 01 §4 steps 1–4 (branch, CS PRs, CI) during step N's watch, branching from `main` after N's merge; it merges only after N's record. If N rolls back, re-create N+1's branch from the reverted `main`.
