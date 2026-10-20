# Review: docs-quality (M8, plus doc-level gaps for M1/M4/M5/M6/M7)

Reviewer key: `docs-quality` · Date: 2026-10-19 · Subject: `docs/upgrade/` (README, 00-decisions, 10, 20, 30, 40, 50, 60, 90, findings/01-08, findings/baselines).
Scratch/repro: `<scratch>/exp/docs-quality/` (`check-docs.py`, `ids.py`, `icu.js`, `host.js`).

---

## 0. Verdict

The docs are accurate where they are specific (every mechanical ID/anchor/count check passes, 14 of 14 sampled `file:line` citations are correct) and they are NOT bloated (plan docs total about 196 KB, about 50k tokens). The problems are structural and are all about what a future session would NOT find:

1. Three owner-critical items have no home at all: the pre-antd gate (M5), the "≥95% confidence" measurement (M7) and the phase-6/7 plans (M6). Phases 6 and 7 are two table rows in `50 §5` that say "detailed plans are written when S is passed".
2. M1 (latest versions) is not enforceable from the docs: there is no register of targets vs latest; 16 packages' end-of-track targets are below the registry latest today and 11 of them have no later step that reaches latest.
3. M4 stops at "verbatim compiled copy"; the ownership end state (what search owns after phase 7, how the copy is kept honest, what happens to assets/CSS/CLI) is missing.
4. The Phase-2 work order is circular as written (baselines are captured before the tests and the fixtures they depend on exist), so the very first task of the next session cannot be executed in the documented order.
5. A fresh session has no playbook: no branch/PR/commit rules beyond one branch name, no status home (the status vocabulary points at columns that do not exist), no "how to run" prerequisites, and the baseline commit `f5cfc20` exists only as a local-only merge commit.
6. Several sources of truth are maintained twice and already disagree (wave to test mapping: 35 + 10 mismatches; risk to test links: 13 + 38 non-mirrored), and four ID families collide (`D#`, `W#` in findings/01, `S`/`G`, `O`/`U`/`R9`).

Recommendation: keep the existing nine files (fix them), add 9 new files and one script (section 5), and apply the ID renames in section 6. Total target size stays under about 280 KB with no file over 30 KB.

---

## 1. Mechanical check results (reproducible: `python3 -I check-docs.py <docs/upgrade>`)

| Check | Result |
|---|---|
| T-### defined (rows in 40 §4) / referenced | 114 defined; 116 distinct referenced; the 2 extra are `T-111`, `T-112`, deliberately "unused" (40:258). 0 broken. |
| R-### | 67 defined = 67 referenced; 0 broken |
| Q-### | 68 defined = 68 referenced; 0 broken; contiguous 1-68 |
| S-# | 8 defined = 8 referenced |
| CS-* | 81 defined = 81 referenced; 0 undefined |
| OD-## | 30 defined (`## OD-nn` headings) = 30 referenced |
| Markdown links + anchors | 72 links checked, 0 broken (GitHub slug algorithm) |
| `NN §x.y` refs into findings | 94 checked, 0 broken |
| Test priorities | P0 61, P1 46, P2 7 = matches 40:389 and README |
| Risk counts | C6/H27/M25/L9 = 67; SILENT 46 (C5/H23/M15/L3) = matches 10 |
| Quirk classes | PRESERVE 61 + watch 4 + ESCALATES 3 = 68 = matches 30 |
| Tests defined but never referenced outside 40 | T-107, T-109, T-206, T-304, T-306, T-307, T-505, T-703, T-717, T-906 |
| Tests whose Risks column is "-" | T-109, T-303, T-405, T-413, T-717, T-803, T-804, T-906 |
| CS entries never scheduled in 50 | CS-JFD-1, CS-LEAF-1, CS-MOBX-3, CS-SEN-2, CS-NODE-1..4, CS-R18-6 (the first four are "no change"; CS-NODE-1/2 duplicate CS-N12-6/CS-N11-5) |
| Waves referenced but not in 50 §4 | `W9` (22 references, no row) |
| Home-directory mount (`mnt`) paths | README:12, 60:10, findings/04 (4), a home-directory `mnt` path in findings/01, 05, 08 |
| Traceability snippet in 40:472-481 | runs; 66 OK, 1 GAP (R-065, documented) |
| `[VERIFY]` markers | 40 total (README 5, 10:2, 20:13, 30:5, 40:10, 60:2, 90:3); README checklist has 27 checkboxes with no IDs linking them to the inline markers |
| `path:line` citations | about 330 (10: 118, 20: 99, 30: 87, 40: 10, 60: 10, README: 10); sampled 14 -> 14 correct at tree a825839 |
| Status columns | 0 of R/Q/T/wave tables have one (see DQ-09) |

Positive findings to keep: every doc opens with Purpose / When-to-use; the README doc map ("one place per topic") and ID table are a good idea; cross-links and counts are consistent; the ESCALATES/PRESERVE model is clear.

---

## 2. Findings

Severity: critical / high / medium / low. `docs` = file(s) to change.

### DQ-01 (critical, process-gap, M5) There is no pre-antd gate
- `50-roadmap.md:97`: phase 7 precondition is "Phase 6 done. Per component: T-802 ... 0 px". `50:88`: gate S sits BEFORE phase 6 and is a wave-style checklist ("Entire suite ... two clean nightly cycles ... prod stable for 1 week").
- Between S and phase 7 the whole HTTP layer (axios), data layer (swr), state (MobX to zustand), language (TS) and tooling change (phase 6, 15-25 d), yet the only requirement is "every phase-6 PR re-runs the full suite" (`50:96`). Nothing is measurable, nothing re-proves equivalence against the golden image after phase 6, nothing checks that the detectors still detect on the new code, and there is no feasibility proof that antd can reach 0 px.
- Owner requirement M5 says CRITICAL, "absolutely nothing broken, rigorous and measurable".
- Fix: NEW `55-gates.md` (GATE-S end of track, GATE-ANTD before phase 7, GATE-DONE at the end) with numeric criteria, evidence artifacts and sign-off. Draft criteria in section 7.

### DQ-02 (high, process-gap, M7) "≥95% confidence" is never defined or measured
- Only occurrences: README:13 ("~95% confidence"), 90:30, 10:10, 40:172. `40 §3.3` ("confidence gate") is a qualitative checklist; `40 §3.1` calls itself "how the ~95% target is built up" but has no number.
- No code-coverage thresholds, no mutation/fault-injection, no flake budget, no differential corpus size (the fixture set is about 15 scenarios, `40:117-124`), no statistical statement.
- Legend defect: `10:10` says every SILENT risk "has a dedicated detector test, marked ★"; 16 of 46 SILENT risks have no ★ anywhere in their row (R-014, R-038, R-039, R-040, R-042, R-046, R-048, R-049, R-051, R-052, R-053, R-055, R-058, R-059, R-065, R-067). The traceability matrix (40 §5) only tests "some P0/P1 test ID is mentioned", not that it detects the failure.
- Fix: NEW `45-confidence-model.md`. Draft in section 8 (seeded-fault recall with a binomial bound: 59 of 59 injected faults detected gives 95% one-sided confidence that recall is at least 95%; coverage ratchets; differential corpus; reliability; runtime evidence).

### DQ-03 (high, phase6-7-plan, M6) Phases 6 and 7 have no executable plan
- `50 §5` (lines 92-97) is the entire plan: two rows, effort "15-25 d" / "25-40 d". Heading says "their detailed plans are written when S is passed".
- No change-site catalogue (nothing like CS-AXIOS-*, CS-SWR-*, CS-ZUS-*, CS-TS-*, CS-ANTD-*), no phase-specific tests (28 test rows say "phase 6" in the Wave column but none exist for phase 7 except re-use of T-801/T-802), no ordering, no rollback.
- The only design-to-antd mapping in the repo is `findings/04 §7` (lines 413-440), and no plan doc links to it (grep for "04 §7": 0 hits).
- Undefined: what "pure CSS" means for 26 CSS-module files / 177 dashed classes / PostCSS chain (OD-11 option D just defers to "phase 7"); `@oacore/core-ui` adoption (peer `antd ^5.27.6`, `react ^19.1.1` vs dashboard antd `^6.3.1`; dashboard consumes `@oacore/core-ui ^2.0.20`, core-ui repo is `0.0.1`); antd SSR style strategy on the pages router (there is no `pages/_document` today, Q-054; adding one or antd `extractStyle` changes SSR HTML that T-602 pins); forms; TS conversion order.
- Fix: NEW `70-phase6-functional-libs.md` and `80-phase7-antd.md`; skeletons in section 9.

### DQ-04 (high, version-target, M1) No latest-version register; many end-of-track targets are below latest with no path to latest
- README §3 has a "Target (track)" column only; `[VERIFY]` flags the latest column; no "latest at date" column, no justification column, no "wave that reaches latest" column.
- Registry today (`npm view <pkg> version`, 2026-10-19):

| Package | Plan target | Latest today | Docs justification | Step reaching latest |
|---|---|---|---|---|
| next / react / react-dom | 16.x / 19.x | 16.4.2 / 19.3.1 | - | ok |
| @sentry/browser,node | 7.119.1 (CS-SEN-1) | 11.8.0 | OD-14 (open) | none ("decide B vs C in phase 6") |
| mobx / mobx-react-lite | 6.15 / 4.1 | 7.0.6 / 5.1.0 | OD-13 | zustand in phase 6 (explicit) |
| eslint | 9 | 10.13.0 | plugins | phase 6 (README "Later") |
| stylelint | 16 | 17.16.0 | needs Node 20.19 | none |
| i18n-iso-countries | keep 6.8.0 | 7.14.0 | OD-27 visible text | none |
| react-ga4 | keep 2.1.0 | 3.0.1 | OD-27 | none |
| postcss-preset-env / cssnano / custom-media | 7.8.3 / 4 / 8 | 11.6.1 / 9.9.0 / 12.0.3 | W8 "optional" | none (skipped is allowed, `50:87`) |
| jest + jest-environment-jsdom | 29.7.0 | 30.5.2 | "Jest 30 can come later [VERIFY]" (40:156) | none |
| msw | 2.x | 3.0.3 (needs Node >=22.12) | Node 18 baseline | possible only after W4(e); no step |
| @testing-library/jest-dom | 6.x | 7.0.1 | - | none |
| @babel/core | 7 | 8.0.7 | 01: Next bundles Babel 7 | W9 (undefined) |
| typescript | (dashboard 5.9) | 7.0.2 | OD-07 | none |
| Node | 22 | `npm view node` 26.12.0 (LTS status UNCONFIRMED); 24 is the dashboard's | OD-05 | "Node 24 after S" |

- Fix: NEW `02-version-targets.md` with the columns above, regenerated by script, and a rule "a target below latest needs a reason AND a named later step". Add owner decision D6 (latest-stable policy) to 00.

### DQ-05 (high, design-ownership, M4) Ownership end state is missing
- `60-design-copy-plan.md:23`: recommends vendoring compiled ES5 CJS `lib/` because "the code is thrown away in phase 7". But M4 says search must OWN every design component and asset it uses. Compiled output with inlined hashed class maps (`button-button-3fr3r`) is not something a team can maintain; `60:19` already admits W6/W7 need edits in compiled code (Q-051, Histoslider/MathMarkdown `defaultProps`).
- Missing: provenance record (tarball integrity hash from package-lock, design repo SHA `bbc35a0`, the uncommitted rename `github.svg -> githubF.svg`), a CI check that the copy still equals the package except the documented edits, an edit policy (which edits are allowed after W5), the fate of every non-component artifact (icon sprite generator `bin/` + `design.config.js` + `@mdi/svg`, 53 CSS files incl. global reboot/sanitize/foundation tokens, `lib/config.js`, logos/svgs, LICENSE, 12 runtime third-party deps) after phase 7, and a "design/ is deleted and cannot return" exit check. OD-21 weighs pixel parity only, not ownership/readability.
- Fix: rename/extend 60 to `60-design-ownership.md`; outline in section 10; extend OD-21.

### DQ-06 (high, process-gap) Phase-2 order is circular; the golden-image build is under-specified
- README:203-205 and `50:57`: harness -> capture baselines (incl. golden image) -> write P0 tests -> (2.7) record fixtures. But `40 §6` steps 6-9 "Run T-601/T-602/T-603/T-604 ... in record mode", "Run T-801/T-802 with --update-snapshots", "Run every T-7xx journey in record mode" need those tests to exist, and every one of them needs the fixture resolver (`40:108`, SSR preload `40:131`) whose fixtures are recorded last (`40 §6` step 10; `50:57` item 2.7).
- Golden image: `40 §6` step 2 says "Build the production Dockerfile ... with the test build args". `Dockerfile:24` hard-codes `RUN npm run build && ...`, and `package.json:76` build runs `node ./data/data-loader.js` against the live production API (Q-026). `build:test` (40:128) exists only as a proposal, so the unchanged Dockerfile cannot build the "test" image; a Dockerfile change contradicts "unchanged app" and the inertness proof (40 §6 step 1 hashes only `.next/static`). There is no `.dockerignore` and `Dockerfile:17` is `COPY . .`, so a local build ships host `node_modules`, `.next`, `docs/`, baseline PNGs into the context. The registry where `search:baseline-<sha>-<arch>` is pushed is not named.
- Fix: reorder to harness -> fixtures -> tests green on unchanged -> baselines -> golden image -> CI; specify the golden build (a `Dockerfile.baseline` or build-arg, `.dockerignore`, registry, build from a clean checkout in CI).

### DQ-07 (high, process-gap) The baseline commit is local-only; branch model is unclear
- `git branch -r --contains f5cfc20` is empty; `f5cfc20` is a local merge commit on local `main`; `git rev-parse f5cfc20^{tree}` = `origin/main^{tree}` = `a825839...` (tree-identical to `cc0e228`). A fresh clone cannot `git show f5cfc20:path`, yet README:30, `10:14`, `20` cite "at f5cfc20" everywhere.
- `docs/upgrade-plan` is 28 commits ahead of `origin/main` (27 are old local history such as `468a3df Config update (#428)`; only `497ff4c` is the docs commit). A PR would carry them.
- `origin/HEAD -> origin/master`, but `master` is stale (`git rev-list --left-right --count origin/master...origin/main` = `5 204`: 5 commits only on master, 204 only on main; master's last commit is 2026-02-04). Deploy workflows trigger on `main` and `stage` (`aks_deploy.yml:5`, `aks_stage_deploy.yml:5`). Docs say "branch from `main`" (README:202, 50:65) without saying so; `origin/main.old` also exists.
- No rule for how the track coexists with a moving `main` (data refresh commits, other features): when to re-sync, whether baselines are re-derived.
- Fix: cite "origin/main@cc0e228 (tree a825839)"; state canonical branches in the playbook; rebase the docs branch onto `origin/main` before the PR.

### DQ-08 (high, process-gap) No session playbook / operating protocol
Missing, concretely:
- Branch naming beyond `upgrade/phase-2-safety-net` (README:202); PR title/body template; commit format; review/sign-off rule; how ESCALATES PRs are labelled.
- How a wave reaches staging: `aks_stage_deploy.yml` runs only on push to branch `stage` (namespace `core-frontend-stage`, image tag `<sha7>-stg`, nightly 04:00) and builds with `APP_ENV=staging` (API `api-stg.core.ac.uk`, `env.config.js:9-11`), so the "24 h soak" tests a different backend. Prod: push to `main`, nightly 03:00, namespace `core-frontend`, deployment `core-frontend-search`. `50:75` still says `kubectl rollout undo deployment/<name>`.
- Prerequisites to run anything: `NPM_TOKEN` (GitHub Packages, `.npmrc.dist`) just to `npm ci` (Dockerfile:18, README of repo), `API_KEY` (env.config.js throws), the machine default is Node 24.18.1 while the baseline needs Node 18 (`.nvmrc` does not exist yet; CS-W0-5), Docker daemon was not running here (`docker images` failed), Playwright needs Node >= 20.
- No repo-root pointer file that sends someone starting a new work session to `docs/upgrade/README.md` (checked: none).
- No start/end-of-session checklists, no "where do I record X" table.
- Fix: NEW `01-playbook.md` (section 11).

### DQ-09 (medium, process-gap) The status vocabulary has nowhere to live
- README:101-109 defines statuses for risks, quirks, tests, decisions, waves. `10:13` "Every row starts as OPEN", `30:16` "Status ... PINNED". But none of the R, Q, T, wave tables has a Status column (script check). Only OD entries have a `Status:` line. README §8 "Done" is a flat checklist with 3 items.
- A session that finishes T-101 or W0 has no defined place to say so.
- Fix: NEW `STATUS.md` holding the only mutable state: phase/wave table, branch/PR links, golden digests, per-ID status tables (generated skeleton from the registers), VERIFY items with IDs, session log. README keeps stable content only.

### DQ-10 (medium, contradiction) Wave to test and risk to test links are maintained twice and disagree
- Wave to test: 40 §4 "Wave" column vs 50 §4 "Tests that must be green". With ranges expanded: 35 P1/P2 (test, wave) pairs in 40 are missing from the 50 row (e.g. T-107/T-306/T-505 for W3; T-114/T-410/T-709 for W0; T-004 for W7; T-401 for W1/W6; T-904 for W5-W7; T-420 for W4/W6) and 10 pairs listed in 50 contradict 40 (50 lists T-205/T-206/T-207/T-210 in W3 while 40 says "phase 6"; T-003/T-004/T-005 in W0 while 40 says W4+; T-603 in W4 while 40 says W2/W6/W7; T-202/T-204 in W3 while 40 says W4+). 40 §4 header says P1 = "before the wave(s) listed" so the gate for those waves is under-specified in 50.
- Risk to test: 10 "Tests" column vs 40 "Risks" column. 13 R-to-T links not mirrored (e.g. R-010 to T-801; R-011 to T-202/T-204..T-208 via the range "T-201-T-208"; R-062 to T-701) and 38 T-to-R links not mirrored (e.g. T-705 lists R-012 but R-012's Tests omits it; T-403 lists R-001; T-902/T-903/T-904 list R-041/R-048/R-003/R-040).
- Fix: one authoritative direction each (40 inventory owns both Wave and Risks; 10 and 50 are generated or drop the column), `tools/check-docs.py` fails CI on drift; delete the hand-kept 40 §5 table (4.7 KB).

### DQ-11 (medium, contradiction) ID namespaces collide
- `D1-D5` = owner decisions (00) vs `D0-D6` = design-vendoring steps (60 §4; README:96, 50:84). README:182 says "(60 D1, D5)", which a reader parses as decisions D1/D5. `D3` is both "no react-hook-form" and "Switch imports".
- `findings/01 §7.2` uses `W0-W8` with a different meaning (W2 = dev tooling, W3 = leaf libs, W4 = state prep, W5 = Next 10-12, W8 = Babel/PostCSS retirement) than the plan's W0-W8. README errata #1 ("01 §1, W4") and #10 ("01 §7.2 W8") use the findings' numbering with no marker, so "W4" reads as plan W4 (Next 10 to 12).
- `S` is a wave/gate (50, README:94) and `S-1..S-8` are security notes; `G1-G7` are CI gates (40 §8) and "gate S" is a gate; `E1-E21` endpoints vs "30 §E" ESCALATES vs test layer E; `O1-O14` (50 §2) and `U1-U4` (Q-048) are not in the README ID table; `R9`/`R5` in findings are route/recommendation numbers next to `R-009`/`R-005`.
- Fix: rename (section 6) and add every prefix to the README ID table.

### DQ-12 (medium, clarity) `W9` is used 22 times but is not defined; orphan change sites
- `W9` appears in 10 (R-001, R-008, R-011, R-032, R-060, R-065), 20 (CS-N11-3, CS-N16-2, Babel header), 40 (T-121, T-203, T-724, next/jest note), 90 (OD-10/11/16), 50 (diagram, O5, O10, §5). 50 §4 has rows W0-W8 and S only. No entry/exit/tests/effort/owner. README:94 says `W0...W9`, "defined in 50 §4".
- CS-BAB-1..5 (the only content of W9) are scheduled "when Babel is dropped".
- Fix: define W9 (or fold it into the phase-6 doc as P6e) with entry/exit; schedule or explicitly mark as not scheduled: CS-R18-6, CS-NODE-3/4; remove duplicates CS-NODE-1/2 and CS-N16-1 (same Dockerfile lines as CS-N12-6/CS-N11-5, different timing: "W4 end or W6").

### DQ-13 (medium, clarity) Normative test content lives in documents labelled "raw, corrected by errata"
- 28 of the 114 test rows delegate their case list to findings (T-101, 102, 103, 105, 106, 107, 108, 109, 110, 114, 116, 204, 205, 301, 302, 303, 402, 411, 412, 417, 418, 501, 502, 601, 602, 722, 801, 803). README:80 says the findings are "read-only ... corrected by §7 errata" and README §7 holds 16 corrections.
- Stale figures survive anyway: T-002 and 40:100 say "59 files importing *.module.css" (from findings/05 line 150); actual is 66 (`git grep -lE "^import .*\.module\.css" -- '*.jsx'` = 66, 0 in `.js`); errata #8 fixed 27 to 26 but not 59. Style reads: docs say 428, `git grep -noE "styles\.[A-Za-z_]+"` = 430.
- A future session implementing T-101 must read 06 §7.2 and then mentally apply the errata.
- Fix: move the 28 case tables into `41-test-inventory.md` (or `specs/`), or edit the findings in place with `SUPERSEDED` markers and put one `findings/README.md` banner listing which sections are normative.

### DQ-14 (medium, clarity) Entry doc carries material that is not stable orientation
- README is 19.7 KB: errata (§7, 3.5 KB), verification checklist (3.2 KB, 27 unlinked checkboxes), "Next concrete step", progress log, and a version table that duplicates 20.
- Fix: README <= 8 KB (what/where/rules/doc map/ID table/glossary), everything mutable to `STATUS.md`, errata to `findings/ERRATA.md`, version table to `02-version-targets.md`. Give each `[VERIFY]` an ID (`VF-01..`) and one home (STATUS).

### DQ-15 (medium, factual-error) The Node 18 to 22 ICU claim is unsupported
- Repeated in `10 R-042` ("ICU 7x to 78 ... TR to Turkiye"), `90 OD-05` ("TR 'Turkey'/'Turkiye' may change"), `40 T-108` (per-Node snapshots of TR, CZ, HK, MK...).
- Evidence: `Intl.DisplayNames('en',{type:'region'})` for all 676 AA..ZZ codes is IDENTICAL on nvm Node 18.20.8 (ICU 74.2), 22.18.0 (77.1) and 24.18.1 (78.3); TR is already "Turkiye" on 18.20.8 (`exp/docs-quality/icu.js`). UNCONFIRMED for `node:18-alpine` (Docker daemon not running; image may use different ICU data).
- Impact: the "accept ICU diffs as environmental" policy (OD-05) contradicts "0 differing pixels" (40 §1) and "never re-capture" (40 §6); either the claim is false (remove the exception) or a documented allow-list mechanism is needed.
- Fix: replace with a measured diff list from the actual golden image vs candidate image; delete the example.

### DQ-16 (medium, process-gap) No single Definition of Done; ops checks have no pass criteria
- Three different "mergeable/deployable" lists: 40 §3.3 (6 + 3 items), 50 §4 shape (9 steps), 50 per-wave "Exit" cells. T-902 (soak), T-903 (canary), T-904 (manual checklist) list what to watch (`40:383-385`) but no thresholds (RSS, p95, 5xx rate, Sentry delta, GA hit rate), no rollback trigger, no owner, and the "checklists" that `40:42` says live in `docs/upgrade/` do not exist.
- No effort roll-up: 15-25 (phase 2) + 36-60 (W0-S, `50:90`) + 15-25 + 25-40 = 91-150 person-days, excluding calendar waits (8+ waves x 24 h soak + 1 h canary + S: 1 week + 2 nightly cycles).
- Fix: DoD checklist in `01-playbook.md`; thresholds in `45-confidence-model.md`; `ops/` checklists per T-902/903/904; effort roll-up in 50.

### DQ-17 (medium, contradiction) README presents open choices as targets; 00-decisions lacks the owner's M-requirements
- README §3 "Target (track)" states Node 22, ESLint 9, Sentry 7.119.1, i18n 6.8, "CSS unchanged", while OD-05/14/15/27/16 are all OPEN; README §2 lists "Binding decisions" D1-D5 only.
- `00-decisions.md` (owner-only) has no entry for: latest-stable policy (M1), ownership of design assets (M4 end state), pre-antd gate (M5), TypeScript/pure CSS/ESLint/Prettier/Husky scope (M6: its phase-6 line lists only "axios, swr, zustand, react-router"), 95% confidence (M7).
- Fix: owner adds D6-D11; README marks every table cell that depends on an OD with the OD ID.

### DQ-18 (medium, open-decision) Missing open decisions
Not in 90: (a) adopt `@oacore/core-ui` or raw antd, and its private-registry/peer-version implications; (b) meaning of "pure CSS" (CSS Modules kept? PostCSS removed?); (c) TypeScript strictness and conversion scope; (d) coverage/mutation/fault-injection thresholds (M7); (e) pixel tolerance for antd internals (focus rings, antialiasing) and who may waive; (f) registry for the golden image; (g) baseline CPU architecture (see DQ-19); (h) branch flow (feature to `stage` to `main`?) and policy for a moving `main`; (i) whether the vendored design keeps readable `src/` for ownership (extend OD-21); (j) antd SSR style strategy.

### DQ-19 (medium, process-gap) Visual determinism across architecture/environment is not specified
- `40 §6.2` builds the golden image for amd64 and arm64; `40 §2.5` pins a Playwright container but not the CPU architecture of the screenshot baselines; local machine is macOS arm64 (Docker), workflows run `ubuntu-24.04-arm` for deploys, no `ci.yml` exists to read the runner of the new gates. Chromium text rasterisation can differ between arm64 and amd64 builds; "0 differing pixels" then fails for reasons unrelated to the app. UNCONFIRMED (needs a baseline run on both).
- Fix: state the baseline architecture and run all comparisons on it; add a cross-arch determinism experiment to Phase 2 exit.

### DQ-20 (low, contradiction) Inconsistent open-decision timing
- OD index (90:8-19) vs each Status line: OD-13 index says "Phase 6", Status says "needed by W3". 50 §3 Entry lists OD-01/04/09 but README:201 and 90:9 list nine (OD-15, 24, 25, 28, 29, 30 missing in 50). OD-05 (Node) is "needed by W4" but the Node of the golden image/harness/ICU snapshots is a phase-2 matter.

### DQ-21 (low, weak-test) ★ legend and the traceability check are weaker than stated
See DQ-02 (16 SILENT risks without ★); the 40:472 snippet counts mentions only; R-065 is "accepted" in 40:466 although README:104 requires an OD reference for ACCEPTED and none exists.

### DQ-22 (low, clarity) Path hygiene
- README:12 and 60:10 cite the dashboard and design repos by sandbox mount names (`mnt/dashboard`, `mnt/design` under the home directory). Real paths: `../{dashboard,design,core-ui,@dashboard,core-fe-architecture}`.
- `core-fe-architecture/index.html` (org architecture guide: client-first, React Router, `src/features/<f>/{components,hooks,store,types}`, `services/` with axios+SWR, `stores/`, `styles/`, `.husky/`) is never referenced; M6 depends on it. It is client-first React Router, which conflicts with SSR (R-005); the plan must say how search maps to it or where it deliberately differs.
- `findings/baselines/*.json` contain 188 lines with absolute sandbox paths (`<sandbox-root>/search/...`: eslint-baseline 156, stylelint-baseline 28, resolved configs 4); T-001 (40:223) compares by (file, rule, line-content) but never says paths must be re-based.

### DQ-23 (low, clarity) Undefined jargon
Used without definition: `gSSP` (13 uses; expanded once in 40 §2.1), `gIP` (R-055), `formap` (11), ICU, MSW, AKS, "soak", "canary", "stage" (branch), ETag. README glossary has 5 entries; add about 15 (section 6).

### DQ-24 (low, process-gap) Line citations are valid only at one tree
About 330 `path:line` citations hold at tree a825839; after the first CS edits (W0 touches `package.json:18,27,33,41`) later rows such as `package.json:36-39` (Next/React) drift. Add: "line refs are for tree a825839; for each wave re-anchor with `git grep` and the quoted `Current` text" and put a grep-able anchor in each CS row.

### DQ-25 (low, contradiction) Small inconsistencies in change-site/test text
- CS-R18-5 "drop `@testing-library/react-hooks`" (20:98), but 40 §2.2/§2.7 never add it (renderHook is a local helper).
- W4 step (b) enables `future: { webpack5: true }` (50:83, 20:27, OD-26) but there is no CS ID for that edit.
- 20 sorts "Current" lines from `f5cfc20`, docs' section "Next 12 -> 13" CS-N13-5 references `test/utils/render.js` that does not exist yet (fine, but mark "future file").
- Q numbering is non-monotonic by section (Q-050..052 sit in §E after Q-068); harmless but state it.

### DQ-26 (medium, process-gap) Phase 1 is "DONE" without an exit record; no doc change control
- README:149 "Phase 1 complete", `50:16` "Phase 1 Docs (DONE)", but README:151 says the docs were "not independently reviewed". There is no acceptance record, no doc version/changelog, no rule for editing registers (never renumber IDs; new risks get next number even if Critical, but "sorted by severity" `10:14` then breaks), and `00-decisions` is "owner edits only" with no process to request an addition.
- Fix: add Phase 1b "independent review + owner approval" with a record in STATUS; doc rules in the playbook.

### DQ-27 (low, clarity) Bloat and duplication (cut list)
- `40-test-strategy.md` 62 KB / 571 lines: split into strategy+harness+parity+determinism (about 25 KB), inventory (about 30 KB), baselines+CI+triage (about 10 KB).
- 40 §5 (4.7 KB) is derived data; replace by the script.
- `50 §2` O1-O14: about 12 of 14 restate R/CS/OD/40 entries (O4=R-017/CS-N12-1, O5=OD-12, O6=errata #1, O8=OD-13, O9=CS-LINT-1, O10=OD-10, O11=OD-05, O12=R-009, ...); keep as a 1-line index or drop.
- README errata + checklist (6.7 KB) move out; README §3 version table moves to `02-version-targets.md`.
- Resulting plan-doc volume stays near 200 KB because new content (gates, confidence, phase 6/7) replaces removed duplicates.

### DQ-28 (medium, phase6-7-plan) Target layout and CSS end state are not planned
Same family as DQ-03 but separately actionable: phase 6/7 need a "target repo layout" section (org guide feature layout vs Next pages router; `pages/` stays; where `features/`, `services/`, `stores/`, `styles/` go; path aliases to tsconfig `paths` replacing `next.config.js:86-100`) and a CSS end state (plain co-located `.css` as in the dashboard: 38 files, 0 CSS modules, `theme.css` custom properties; vs search's 26 module files, camelCase hack, custom-media, `@extend`). Both need owner decisions before the antd work.

### DQ-29 (low, resolved-verify) Items from README §8 that could be settled today
See `resolved_verify_items` in the structured output (latest versions, Host header on Node 18, tooling versions, lint baseline counts, ICU).

---

## 3. M1-M9 coverage matrix (docs as they are)

| Req | Covered? | Where / gap |
|---|---|---|
| M1 latest stable | Partly | Next/React yes; 12+ other targets below latest with no later step (DQ-04). Needs `02-version-targets.md` + D6. |
| M2 Jest/RTL + Playwright, UI unchanged | Yes (strong) | 40; gaps: coverage thresholds (DQ-02), cross-arch determinism (DQ-19). |
| M3 bugs preserved | Yes | 30, D1/D1a. |
| M4 own design components/assets | Partly | W5 verbatim copy yes; ownership end state, provenance, edit policy, asset fate no (DQ-05). |
| M5 pre-antd gate | No | DQ-01. |
| M6 adopt dashboard libs | Outline only | DQ-03, DQ-28. TS/Prettier/Husky are W1/OD-07 pieces; "pure CSS" undefined; org guide unreferenced. |
| M7 ≥95% measured | No | DQ-02. |
| M8 clear for a fresh session | Mostly | strong registers; missing playbook/status/glossary; duplicates (DQ-08..DQ-14, DQ-27). |
| M9 planning only | Yes | - |

---

## 4. What a fresh session experiences today (walk-through)

1. Reads README (19.7 KB), finds "Next concrete step 1: get owner answers for 9 ODs". Cannot tell where a session should obtain them, or that 00 cannot be edited by the session.
2. Tries `git show f5cfc20` on another machine: fails (DQ-07). `git log` shows 28 extra commits on the docs branch.
3. Tries to run the baseline: needs `NPM_TOKEN`, `API_KEY`, Node 18 (machine default 24), Docker running, and `build:test` (does not exist). None of this is written down (DQ-08).
4. Reaches "capture baselines" before any test or fixture exists (DQ-06).
5. Finishes T-101 and has nowhere to record it (DQ-09).
6. Reads "W4" in README errata and does not know it means finding 01's W4 (DQ-11).
7. Reaches phase 6/7 and finds two rows (DQ-03).

---

## 5. Proposed target documentation structure

Principle: one owner file per topic; mutable state only in `STATUS.md`; derived tables are generated by `tools/check-docs.py`; findings are frozen evidence (not normative). Size caps are guidance to keep each file readable in one pass (about 10k tokens).

| File | Owns | Cap | Status |
|---|---|---|---|
| `README.md` | What/why, rules in 10 lines, doc map, reading order per task type ("doing a wave", "writing tests", "triage"), ID table, glossary (~20 terms) | 8 KB | trim existing (19.7 KB) |
| `STATUS.md` | ONLY mutable file: current phase/wave, branches/PRs, golden image digests/registry, per-ID status tables (R, Q, T, W, OD, VF), VERIFY register, session log | 10 KB (tables grow) | NEW |
| `00-decisions.md` | Owner decisions D1-D5 + new D6-D11 (latest-stable, design ownership end state, pre-antd gate, phase 6/7 scope incl. TS/pure CSS, confidence definition, branch/baseline policy). Owner-only | 6 KB | extend |
| `01-playbook.md` | Session start/end checklists, branch/PR/commit rules, DoD, how to run each tier, prerequisites, deploy-to-stage/rollback commands, where to record what, doc-change rules | 12 KB | NEW |
| `02-version-targets.md` | M1 register: package, today, latest@date, track target, reason, wave that reaches latest; script-regenerated | 8 KB | NEW |
| `10-risk-register.md` | Risks (+ Status col) | 27 KB | keep, fix legend |
| `20-change-sites.md` | CS rows for phases 3-5 (+ pointer to P6/P7 CS in 70/80) | 24 KB | keep, dedupe |
| `30-quirks-register.md` | Quirks (+ Status col), security notes | 23 KB | keep |
| `40-test-strategy.md` | Parity contract, stack/harness, layers, determinism, triage | 25 KB | split |
| `41-test-inventory.md` | T-### tables incl. the 28 case lists lifted from findings; Wave/Risks columns authoritative | 32 KB | NEW (split) |
| `42-baselines-and-ci.md` | Baseline capture (re-ordered), CI gates CI-1..CI-7, golden image build spec | 10 KB | NEW (split) |
| `45-confidence-model.md` | M7: definition of ≥95%, metrics, thresholds, scripts, sign-off | 10 KB | NEW |
| `50-roadmap.md` | Phases 2-5 waves, entry/exit, rollback, effort roll-up; W9 defined; pointers to 70/80 | 12 KB | trim |
| `55-gates.md` | GATE-S, GATE-ANTD, GATE-DONE: numeric criteria, evidence, sign-off template | 10 KB | NEW |
| `60-design-ownership.md` | W5 vendoring steps (DV0-DV6) + ownership/provenance/edit policy/end-state fate | 16 KB | extend 60 |
| `70-phase6-functional-libs.md` | TS, ESLint 10, axios, swr, zustand, layout, CS-P6 rows, tests, order, rollback | 18 KB | NEW |
| `80-phase7-antd.md` | antd rollout: mapping, theme, SSR styles, pure CSS, forms, per-component acceptance, retirement | 20 KB | NEW |
| `90-open-decisions.md` | ODs (+ index table with status) | 18 KB | extend |
| `findings/` | Frozen evidence; `findings/README.md` banner (non-normative, wave-label caveat), `findings/ERRATA.md` | - | keep + 2 small files |
| `ops/` (created at first use) | T-902/T-903/T-904 checklists with thresholds; wave dossiers `waves/Wn.md` from a template (entry, CS list, tests, risks, ODs, rollback, evidence) | 2-4 KB each | NEW |
| `tools/check-docs.py` | ID/anchor/count/derived-table checks (prototype: `exp/docs-quality/check-docs.py`) run in CI-1 | - | NEW |

Reading order per task: orient = README + STATUS; doing wave N = 50 row + `waves/Wn.md` + CS rows + T rows; triage = 40 §9 + 30 + 10.

---

## 6. ID and glossary fixes

| Problem | Rename |
|---|---|
| `D0-D6` design-vendoring steps (60 §4, 50:84, README:96,182) vs `D1-D5` decisions | steps become `DV0-DV6`; fix README:182 to "60 DV1, DV5" |
| `W0-W8` inside findings/01 §7.2 | label `FW0-FW8` in findings/01 or add a banner; README errata #1/#10 cite "01 FW4"/"01 FW8" |
| Gate `S` vs `S-#` security vs `G1-G7` CI gates | gates `GATE-S`, `GATE-ANTD`, `GATE-DONE`; CI gates `CI-1..CI-7`; security stays `S-#` |
| `O1-O14` (50 §2), `U1-U4` (Q-048) | `OC-1..14`; `Q-048.U1`; add both to README ID table |
| Section letters `30 §E` vs `E1-E21` vs test layer E | cite "30 §ESCALATES" |
| Findings' `R5`/`R9` | cite as "03 §5 rec. 5", "02 rec. 9" |
| `V1-V20`, `J1-J17` | unchanged, but add a mapping column to the T-7xx table (T-703 = J1 ... T-719 = J17) |

Glossary additions: gSSP, gIP, formap, MSW, ICU, AKS, stage/main branches, soak, canary, golden image registry, VF (verify item), DoD, GATE-*, seeded fault, differential corpus.

---

## 7. Draft: pre-antd gate (for `55-gates.md`)

GATE-ANTD passes only if ALL are true, each with an evidence file under `docs/upgrade/evidence/gate-antd/` and two sign-offs (author + independent reviewer):

1. Freeze: phase-6 merged; the candidate image has run in prod 7 days with no new Sentry issue class, 5xx/p95/RSS within the thresholds in 45.
2. Golden equivalence: candidate vs golden image over the entire matrix: T-801 (V1-V18 x 4 widths) 0 differing pixels; T-602 SSR SEO snapshots diff 0; T-601/T-603 status+headers diff 0; every T-7xx request log identical except changes recorded as DECIDED ODs; console allow-list unchanged; axe violation set unchanged.
3. Differential corpus: at least 300 URL x state cases (works/outputs/search/provider incl. unicode, long, missing-field variants), golden vs candidate, 0 mismatches after normalisation; shadow replay of at least 5,000 production GET URLs: 99.9%+ equal status+normalised body hash, every diff triaged.
4. Detector validity after phase 6: the seeded-fault suite re-run against the NEW implementation (axios/swr/zustand/TS): 59 of 59 faults caught (or the Clopper-Pearson lower bound still at least 0.95).
5. Swap harness ready: T-802 supports `IMPL=design|antd`; behaviour contracts (roles, labels, keyboard, focus return) for all 23 units exist and pass on `design` BEFORE any antd import.
6. Feasibility spike: the 5 hardest units (Select/autocomplete + advanced search, Modal+focus lock, TextField/Form, Header, Histoslider) rendered with antd at 0 px against golden screenshots for all static states; list of states that cannot reach 0 px (focus ring Q-066, hover/active, animations) with an owner-approved treatment.
7. Performance budget: T-007 numbers recorded, antd ceiling set by the owner.
8. Rollback rehearsal on staging with the last pre-antd digest; the golden image still builds and runs.
9. Open items: zero open `VF-*` for phases 6-7, all ODs due DECIDED.
10. Owner sign-off recorded in STATUS.

---

## 8. Draft: confidence model (for `45-confidence-model.md`)

Define "≥95% confidence" as a conjunction of measured criteria (thresholds are proposals for the owner to ratify):

| # | Criterion | Metric and threshold | How measured |
|---|---|---|---|
| C1 | Detector validity | Seeded-fault recall. One reproducible fault patch per SILENT risk (46) plus Critical/High LOUD ones, in `test/faults/R-###.patch`; apply to a throwaway worktree; expect a named failing test. 59 of 59 detected, which gives 95% one-sided confidence that recall is at least 95% (0.95 = 0.05^(1/59)); otherwise exact binomial lower bound >= 0.95 | script + CI job `faults` |
| C2 | Structural coverage | Jest line/branch on `api utils lib store hooks`: calibrate on baseline (suggest 90/85), ratchet, never decrease; 100% of routes (02 §4.1), V1-V18, J1-J17, E1-E21 touched by at least one test (computed from request logs), 68/68 quirks PINNED, 67/67 risks mapped and fault-injected | c8/istanbul + script |
| C3 | Differential parity | Corpus size at least 300 cases, 0 mismatches (upper 95% bound on mismatch rate about 1%); replay of production URLs | golden vs candidate runner |
| C4 | Reliability | 20 consecutive green CI runs on the unchanged app; baselines byte-identical 3x; 0 quarantined/skipped tests; cross-arch result recorded | CI history |
| C5 | Runtime evidence | Staging soak 24 h + nightly + prod canary 1 h; thresholds: 5xx rate <= baseline + 0.05 pp, p95 <= +10%, RSS <= +10% (limit 768 Mi), new Sentry issue classes 0, GA hit volume within +-5% | dashboards, T-902/903 |
| C6 | Change hygiene | Each PR links R/CS/T/Q IDs; no baseline files in wave PRs; lint parity | PR template + CI |
| C7 | Open items | 0 open `VF-*`, 0 open ODs due | STATUS check |
| C8 | Independent review | Second reviewer signs each gate | STATUS |

Statement used in sign-offs: "As of <date>, C1-C8 pass for <wave>; recall >= 95% at 95% confidence; corpus mismatch 0/<n>."

---

## 9. Draft skeletons: phase 6 and phase 7 docs

### `70-phase6-functional-libs.md`
- 0 Entry: GATE-S passed; ODs 02, 07, 11, 12, 13, 14, 19, 20 DECIDED.
- 1 Target layout (org guide vs pages router; `tsconfig paths` replacing `next.config.js:86-100`).
- 2 Steps (each wave-shaped: PRs, CS rows, tests, stage soak, prod, rollback):
  - P6a TypeScript enablement (`allowJs`, no conversion), ESLint 10 + typescript-eslint, Prettier, husky/lint-staged parity with the dashboard (`lint-staged: *.{js,jsx,ts,tsx}`).
  - P6b axios: one instance reproducing the `api/index.js` contract; T-101/T-102/T-205/T-115 run UNCHANGED against it. Rows for: string-body Content-Type (axios defaults POST string bodies to `application/x-www-form-urlencoded` unless set, vs today's `text/plain;charset=UTF-8`, Q-019) [UNCONFIRMED against axios 1.20 source], Blob CSV, error object shape, `withCredentials`, Authorization on all hosts (S-2), Host header (Q-022, OD-20), `?t=undefined` (Q-016).
  - P6c swr: which flows move (client-only: aggregations, similar works, claim account, report); gSSP stays; `SWRConfig fallback` from SSR props; `revalidateOnFocus:false`, dedupe interval, `keepPreviousData` chosen so request logs equal baseline (R-029, Q-021).
  - P6d zustand: per-request store via context (R-004, T-209), one store at a time (claim, report, similar-works, search, data-providers, filters last), reactivity contract T-203 replaced by an equivalent selector contract, in-place `checked` mutation aliasing (R-030).
  - P6e (= W9) Babel to SWC after CS-BAB-1..5.
  - P6f TS conversion order leaf to root.
- 3 Tests: new IDs continue bands (T-122.., T-212.., T-725.., T-805..), Wave `P6a`..`P6f`.
- 4 Exit: GATE-ANTD.

### `80-phase7-antd.md`
- 0 Entry: GATE-ANTD.
- 1 Foundations: antd 6 + React 19 compatibility; theme tokens from design tokens (`--primary:#b75400`, gray scale); CSS-variable vs cssinjs; SSR style extraction on the pages router and its effect on SSR HTML/CSS order (R-023, Q-054) [UNCONFIRMED: check antd 6 SSR docs]; `@oacore/core-ui` decision.
- 2 Unit-by-unit table from findings/04 §7 (23 units) with: antd target, local-keep units (SearchResult, Histoslider, MathMarkdown, MetadataList), acceptance states, order (leaf first; global reboot CSS replaced last), Q-066/Q-068 quirks that must be re-created in CSS.
- 3 Pure CSS conversion: 26 module files, 177 dashed classes, 221 camelCase reads (OD-11), custom-media (6 uses) to literal queries, `@extend` removal, PostCSS/cssnano retirement, each step 0 px.
- 4 Forms: antd `Form` (D3) for claim, report, add-provider; message texts unchanged.
- 5 Acceptance per PR: T-802 `IMPL=antd` 0 px vs golden screenshots; behaviour contracts; T-803 no new axe violations; T-801 0 px; bundle budget.
- 6 Retirement: delete `design/`, icon sprite pipeline decision, remove `next-images`/`@mdi/svg` as applicable; CI guard against re-introducing `design/`.
- 7 Exit: GATE-DONE.

---

## 10. Draft: design ownership plan (extension of 60)

1. Provenance: `design/PROVENANCE.md` with the tarball integrity from `package-lock.json`, design repo SHA `bbc35a0`, note of the uncommitted rename `github.svg -> githubF.svg`, the generated `lib/config.js` values; `design/CHANGES.md` listing every allowed deviation (path-only edits, Q-051, `defaultProps` x2) with the PR.
2. Verification script `scripts/verify-design-verbatim.sh`: unpack the pinned tarball, `diff -r` against `design/`, fail unless the diff equals CHANGES.md; runs in CI-3.
3. Inventory table of all artifacts: JS closure (121 src files / compiled counterparts), 53 CSS files, config, assets, CLI `bin/` + `design.config.js`, third-party deps (12), LICENSE; each with phase-7 fate: replaced by antd / kept as local component / moved to `src/styles` or `src/assets` / deleted.
4. Edit policy: before W5 exit no edits; after, only through CS rows with a test; no logic or UI changes (D1).
5. Ownership decision for readable sources (extend OD-21): vendor compiled for pixel parity now, and keep a readable `src/` copy in `design/_src-reference/` (not imported) so the team owns an editable source until phase 7 retires it; or accept compiled-only with the owner's explicit sign-off.
6. End state: no `@oacore/design` anywhere, `design/` removed after phase 7, CI check forbids re-introduction, GitHub Packages token removed from Docker build (S-3).

---

## 11. Draft: `01-playbook.md` outline

1. Session start: read README + STATUS; `git fetch`; verify `git rev-parse origin/main^{tree}` equals the baseline tree in STATUS; `nvm use <STATUS node>`; env prerequisites table (`NPM_TOKEN`, `API_KEY`, Docker running, Node versions).
2. Branches: base = `origin/main`; `upgrade/p2-<topic>`, `upgrade/w<N>-<cs-group>`, `upgrade/esc-q0xx`, `docs/<topic>`; stage promotion = merge to `stage` (workflow builds `APP_ENV=staging`, namespace `core-frontend-stage`), prod = merge to `main` (03:00 nightly also rebuilds).
3. PR rules: one CS group per PR; title `[W4][CS-N12-1] ...`; body template (IDs, evidence, gate checklist, rollback); ESCALATES PRs separate and labelled; baseline files only in re-capture PRs; no force-push to `main`/`stage`.
4. Commit rules: one bump per commit; imperative subject with CS ID; repo attribution trailer rules.
5. How to run: table (dev server, `npm run build` needs live API, `build:test`, Jest projects, Playwright container, golden image build/run, `check-docs.py`).
6. DoD (single list): tests per 41 + 55; docs updated (STATUS, statuses flipped, CS lines re-anchored); soak/canary criteria from `ops/`.
7. Where to record: status changes in STATUS only; decisions as OD `DECIDED`; policy to 00 via owner; new risk = next R number (note severity-sort exception); new quirk = next Q number; new test = next free number in band.
8. Rollback commands for stage and prod (namespace, deployment `core-frontend-search`, previous image tag lookup).
9. Stop conditions (e.g. CS-N12-3 "stop and use OD-03"), who to ask, session end checklist (run `check-docs.py`, update log).
10. Repo-root pointer stub: "Before any work read docs/upgrade/README.md and STATUS.md".

---

## 12. Reproduction commands

- `python3 -I <scratch>/exp/docs-quality/check-docs.py docs/upgrade`
- `git branch -r --contains f5cfc20` (empty); `git rev-parse 'f5cfc20^{tree}' 'origin/main^{tree}'` (equal); `git rev-list --count origin/main..docs/upgrade-plan` (28); `git rev-list --left-right --count origin/master...origin/main` (5 204).
- `node icu.js` under nvm-installed Node `18.20.8`, `22.18.0`, `24.18.1` (identical output); `node host.js` (Host header ignored by native fetch on all three).
- `npm view <pkg> version` for the table in DQ-04 (2026-10-19).
- Wave/test mismatch computation: see the Python in this session (expansion of `T-aaa-T-bbb` ranges and `Wa-Wb` ranges), reproducible from `40 §4` "Wave" column vs `50 §4` rows.
