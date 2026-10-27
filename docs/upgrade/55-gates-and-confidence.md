# 55 — Gates and confidence

**Purpose.** Every binary acceptance criterion; the lean criteria in force since 2026-10-22 are §0 (D18–D20): "≥95% confidence" as C1–C8 (D12/M7), pre-merge runtime (C6-CI) and watch thresholds, GATE-S, GATE-A (pre-antd; D10/M5), GATE-F, W5 checks, residual gaps.
**Read it** before a C6-CI or watch verdict, at W5 exit and before any gate. **Owns:** C1–C8 (definitions, thresholds, statistics), GATE-x.n (x = S, A, F), VG, RG, the gate record. Elsewhere: tests [41](41-test-inventory.md), commands [40](40-test-strategy.md) §10, CI and baselines [42](42-baselines-and-ci.md), runbook and records [01](01-playbook.md), versions [02](02-version-matrix.md), statuses [STATUS](STATUS.md).

All thresholds are **DECIDED (2026-10-20, owner confirmed the recommended defaults)**: OD-35 (OQ-3); watch setup OD-47 (2026-10-20, owner in chat: existing monitoring, no stage soak, no traffic split; the stage soak's checks moved pre-merge as C6-CI). No gate depends on stage, on deploy by digest, on a canary or split, on private artefact storage or on new infrastructure. They change only under [90](90-open-decisions.md) rule 6, never in a record.

## 0. Lean gates (D18–D20, 2026-10-22): what applies now

The owner's decisions D18 ("relatively sure"), D19 (scope) and D20 (no CI) ([00](00-decisions.md) §4b) override §1–§8 wherever they conflict. §1–§8 stay as the reference for what each check measures and for a stricter run later; their IDs are kept. Every check below is binary, runs on the workstation, and needs no CI, Docker, deploy or prod window. A deploy happens once, after GATE-S, by the owner.

| Check | When | Pass (binary) |
|---|---|---|
| Jump check | end of each jump 1–5 ([50](50-roadmap.md) §4.0), on the jump's tip | One `bash scripts/ci-local.sh` (all six jobs; the staged form of [42](42-baselines-and-ci.md) §10 counts as one run), every job `success`: every P0 and due P1 test green, T-801/T-802 0 px against the B0-local baselines, the SSR/HTTP/SEO contract checks (T-601–T-612, T-729) and every pinned quirk green, `retries: 0`, T-008 green. A red test is re-run once: green = a flake, fixed in the harness (40 §8) before the next jump; red again = a regression, fixed only at a listed change site (20, 60) or accepted only by a signed AD row (42 §8), never by changing the test (D1). |
| Heavy checks | the midpoint (end of jump 3) and GATE-S | (a) Breakage catalogue re-run: `npm run faults -- --lean` over every R patch in `test/faults/` (C1 (a) with the lean validity: the patch applies, a stale patch refreshed for the same risk and detectors (C1 freshness), the build succeeds, the named detectors go red, the `.expect` holds): 0 valid survivors. (b) Old-vs-new corpus: `npm run corpus` with the golden build as reference and the jump tip as candidate over the committed URL list (the pilot list `test/corpus/pilot/` until the owner supplies logs, VF-26): 0 diffs that no AD row explains. (c) One merged coverage report (`npm run coverage`), printed, not gating. |
| GATE-S (lean stabilisation gate) | end of jump 5 | The jump check and the heavy checks; GATE-x.1 versions (02 §5 sweep on every row, `npm run outdated-at -- <Tr>` lists only 02 §4 rows); one opt-in audit run (`CI_LOCAL_AUDIT=1`, CI-8) recorded; one sampled mutation run (`npm run mutation` on the C2 core files): the five core files together ≥90% (2.7: 90.58%); C8 (docs check ERROR 0, records written); RG-1..RG-8 accepted by name; `records/gate-S.md` with the deploy-time items the owner applies ([20](20-change-sites.md) §Deploy-time items), signed by the owner. |
| Final deploy | after GATE-S, by the owner | Today's deploy process (01 §5 rollback as today). 48 h watch with the existing monitoring: C6-prod rows 1–7, 9 and 10 where a source exists, a breach = rollback first. Then one human smoke check of about 15 minutes (search with a filter and a sort, a works page, an outputs page, the data-providers list and one provider page, the CSV download, the cookie banner): no visible difference, no error. Results in `records/gate-S.md`. |

WITHDRAWN or DESCOPED (2026-10-22, D18–D20), IDs kept:

| Item | Lean status |
|---|---|
| C1 (b) sealed batch, its statistic L, C1 build faults; C1-Q quirk-clause patches | WITHDRAWN (D18): quirks are pinned directly by the P0/P1 tests; the catalogue (a) stays |
| C1 validity extras (≤20% P0 red, T-901 green, all tiers per fault) | WITHDRAWN (D18): lean validity above |
| C2 per step and gate | WITHDRAWN except the one sampled run at GATE-S |
| C3 thresholds (a)–(d) | printed only (2.7: 88.79% of app statements; OD-35) |
| C4 N ≥500 per step, N ≥2,000 at GATE-S, fresh corpora, live A/B, positive controls per gate | WITHDRAWN (D18); the old-vs-new run of the heavy checks remains |
| C5: 20 consecutive green runs, 3 green runs per head, the 1/100 flake budget, the 20 + 20 triage runs (40 §9) | WITHDRAWN (D18, D20): one run per jump, a red test re-run once |
| C6-CI soak at prod limits | WITHDRAWN (D19: it needs Docker) |
| C6-prod per step, calibration watches, C6-NI, signals exports | WITHDRAWN (D18): one 48 h watch after the final deploy |
| GATE-x.2 "3 consecutive green `CI / gate` runs" | one green local run (D20) |
| GATE-x.6 (14-day window, per-day tests, pod RSS slope, live A/B) | WITHDRAWN (D18) |
| GATE-x.7 CI-only binaries and actions | WITHDRAWN (D20); test tools stay at their 02 target |
| GATE-x.8 rollback rehearsal on CI | DEFERRED to the owner's deploy (rollback as today, 01 §5) |
| C7 | kept through the jump check on Chromium; the WebKit and Firefox legs are DEFERRED (browser downloads not approved) |
| GATE-A, GATE-F | outside the version track; their lean form is set before phase 6 |
| VG-1..VG-7 | kept (jump 1, design copy) |

## 1. What "≥95% confidence" means

A gate passes only if every GATE-x.n row holds at one recorded commit, the one prod runs; GATE-x.4 = C1–C8 all pass; no partial credit ([00](00-decisions.md) D12). Three criteria are one-sided 95% statistics: C1 (detector recall ≥0.95), C4 (per-URL defect rate ≤ ~3/N), C6-NI (prod error rate not above ×1.05; printed only, never gating, since OD-47 withdrew the split). Each holds at 95%; jointly they hold at ≥85% (Bonferroni; ≥90% for the two that gate). A joint 95% needs α = 0.05/3 each (C1 H ≥ 80, since 0.0167^(1/80) = 0.950; C4 bound ≈ 4.1/N; C6-NI α = 0.0167 per gate): owner choice under OD-35. The others are necessary conditions. What none of them covers is a residual gap (§7). No threshold is loosened after a measurement on a candidate except a signed resource budget (90 rule 6). `scripts/gate-stats.mjs` (new; C6-NI part 2.5, the rest 2.7) computes the C1, C4 and C6-NI statistics from the JSON of `npm run faults`, `corpus`, `mutation`, `coverage` (40 §10) and the C6 exports; its known-answer tests are part of T-012, and a change to it is an acceptance change (40 §8 rule 8).

| | Every deployable step (01 §7 record) | Every gate |
|---|---|---|
| C1 | `faults.yml` on the step head: R patches of risks biting in the step, Q clause patches the step's diff touches (C1-Q); kill matrix | full catalogue (R and Q) killed; the gate's sealed batch (C1 (b)) |
| C2 | if the step touches the C2 files | yes |
| C3 | (b) | (a)–(d) |
| C4 | N ≥500 (2.5 corpus) at W4c, W4d, W6a, W6c, W7a, W7b, W7c, 6.3, 6.5, 6.6, 6.7 and each 7.2 step (where R-003, R-010, R-068, R-069, R-071, R-073 bite, plus the Next 12, transport and compiler steps) | N ≥2,000 at GATE-S; ≥1,000 at GATE-A, GATE-F, plus a fresh corpus there; positive controls |
| C5 | 3 green `CI / gate` runs on the head (01 §4) | flake rate since the previous gate |
| C6 | C6-CI (pre-merge), C6-prod | + GATE-x.6 checks; C6-NI printed |
| C7, C8 | the step's due tests; PR IDs (01 §3) | all items |

The step column is part of the 01 §6 DoD: run by 01 §4 step 3a, results in the 01 §7 record.

## 2. Confidence criteria C1–C8

### C1 Detector efficacy (seeded faults)

- **Scope** (review:00 §4, X45.1): every C/H risk and every SILENT risk reproducible on the baseline, class **BR** in 41 §3, which names each fault and its detectors (e.g. `next.config.js:45-77` as a no-op → T-002, T-801 red). Fault = `test/faults/R-###.patch` (variants `-a`, `-b`…), applied by `npm run faults` in a throwaway worktree, never merged.
- **Catalogue size N_f ≥ 59** distinct (risk, mechanism) pairs, at most 2 variants per risk (41 §3 has 47 BR rows).
- **Validity.** A fault counts only if, with the patch applied, `next build` succeeds, T-901 is green (unless T-901 is a 41 §3 detector of the fault's risk, e.g. R-082, R-084, R-091), ≤20% of P0 tests are red, and its `test/faults/R-###*.expect` (a black-box assertion of the 10 row's Effect: status, header, DOM or request) holds. The Reviewer writes patch and `.expect` from the 10 row without reading 41 §3's detectors. Faults always run all tiers (42 §10).
- **Pass = (a) and (b).**
  - (a) **Regression catalogue** `test/faults/`: every valid fault killed at every gate and every step that runs it; a survivor fails until a detector is added (41) and the fault re-run. Never used for L; its 2.7 first run (written blind, before any detector is added for it) is recorded as the baseline recall.
  - (b) **Sealed batch** (the C1 statistic): the Reviewer writes H ≥ 59 new valid (risk, mechanism) faults not in the catalogue, sealed before their run (normally before the gate window; a replacement after a failed L may come later): ≥1 per C/H risk biting since the previous gate (GATE-S: since 2.7) with a runtime 10 Effect, and ≥20 that perturb hunks of the CS PRs merged since then, drawn with a recorded seed (revert the hunk, or flip one condition or default in it). The other such risks are listed in the record: build, install or image-ENV ones (e.g. R-014, R-017, R-027, R-070) get sealed **build faults**, each of which must turn its 41 §3 detectors (T-008, T-901, the CI `image` job) red (red/total beside L; one not red fails C1); Process and N/A ones (e.g. R-072, R-088, R-089) none. The Reviewer keeps the batch outside the repo, on no pushed branch, until its run; its SHA-256 list is committed in the gate record PR first. `faults.yml` with `sealed: <gate>` runs them once at the gate commit from the Reviewer's branch `faults/sealed-<gate>`, pushed at run time and checked against that list, the runtime faults under the validity rule (fewer than 59 valid: the Reviewer adds faults and only those run); survivors are misses. L = Beta⁻¹(0.05; x, H − x + 1), the exact one-sided 95% Clopper-Pearson bound (x = H: 0.05^(1/H), 0.9505 at 59, 0.9497 at 58); pass ⇔ L ≥ 0.95. Else C1 fails: add detectors and write a new batch; an old batch is never re-run for L. After the gate the batch joins the catalogue.
  - A fault killed only by T-801 is flagged **(1L)** single-layer; it counts as killed.
- **UO risks** (not in C1): at the Bites-in step, on a throwaway branch, revert the mitigating CS on the candidate; the named detector must go red (record it). No mitigating CS: record the detector result on the candidate.
- **Freshness:** a PR that makes a patch stale (`git apply --3way` fails, 42 §10) updates it, same risk and detectors; the updated patch must still satisfy its `.expect`. So the catalogue always targets `main` (phase-6 code at GATE-A, antd code at GATE-F).
- **C1-Q quirk pins (M3, D8).** Unit = the **Q clause** (30 §1 rule 1, e.g. `Q-058 c3`).
  - **Scope:** every clause of a PINNED PRESERVE or WATCH quirk whose behaviour the parity image produces in the compose topology (Where in the image, or in the HTTPRoute YAML that `e2e/proxy/generate.mjs` reads). **Exempt:** the quirks 30 §1 rule 1 names (behaviour set by a deploy workflow or a prod secret, outside every image), pinned by the J-layer detectors named there; the list is fixed at 2.7, approved with OD-35 before 2.8, and changes only under 90 rule 6. A clause is marked `none` in `test/faults/Q-clauses.json`, with a reason and an owner `SIGNED:` line (an acceptance change, 40 §8 rule 8), when it states no app behaviour (a reference or a planned change), when a CS or AD row removed its behaviour (30 §1 rule 5), or when its behaviour has no black-box observable (unreachable, internal or build-only; seeded at 2.7 with Q-007, Q-025, Q-032, Q-061 and any the Reviewer adds); the gate record lists the `none` clauses beside the exempt list.
  - **Fault:** `test/faults/Q-###-c<k>.patch`, the minimal fix of that behaviour (never merged), and `.expect`, a black-box assertion of the fixed behaviour, both written by the Reviewer from the 30 row: at 2.7 (50 §3), or in the PR that first pins the clause. Valid only if, applied, the build passes, T-901 is green, `.expect` holds, ≤20% of P0 tests are red, and every red test's failing assertions are on the URLs, fixtures or states the `.expect` names and report only the fixed behaviour (kill matrix; Reviewer); a red test outside the row's "Pinned by" list (typically a whole-page oracle: T-003, T-605, T-610, T-702, T-728, T-801, T-803, T-805) is added to it in 30 in the same PR. The clause is PINNED only when its own patch is valid and killed (≥1 Pinned-by test red).
  - **Design paths** under `node_modules/@oacore/design/` (design Where until W5) are applied by `run-faults.mjs` in a derived image (`FROM` the parity image: `patch -p1 -d node_modules/@oacore/design`, then `npm run build:test`); from W5 the fault is re-based onto `vendor/oacore-design/`.
  - **Freshness:** a PR that moves or replaces patched code (W5, 6.6, 7.1, 7.2) rewrites the patch and `.expect` in the same PR and updates the 30 Where. **Trigger:** a step runs a clause patch when its diff touches a file the patch modifies (`git apply --numstat`).
  - **Pass:** every non-exempt, non-`none` clause valid and killed at every gate and every triggered step; the record prints killed/total and the exempt and `none` lists. Not part of the C1 statistic.
- Per-fault status: STATUS §4. Always reported with C4.

### C2 Mutation score

StrykerJS (`npm run mutation`; version per 02; VF-08) on `api/ utils/ store/ hooks/ lib/ data/ templates/**/{utils,hooks}/` (`.ts/.tsx` after 6.6). Score = Stryker `mutationScore` (no-coverage = survived); exclusions only in `stryker.config.mjs` with a reason each. **Pass:** ≥80% overall; ≥90% on each core file (`api/index.js`, `api/internalize.js`, `utils/filters-transform.js`, `store/filters.js`, `hooks/use-sync-url-params-with-store/`); no value below its 2.7 measurement (`records/phase-2.md`), rewritten files included.

### C3 Coverage

Merged V8 (`npm run coverage`): Jest + Playwright `page.coverage` + `NODE_V8_COVERAGE` on `next start` (parity image). App = `api data hooks lib main modules pages store templates utils`. **Pass:** (a) ≥90% of app statements; (b) every file the step's CS rows change ([20](20-change-sites.md), 60, 70, 80) run by ≥1 black-box test (layers G–J, 40 §3); (c) every T-601 route, V1–V39 (V19, V20 do not exist), J1–J32, E1–E22 and PINNED quirk clause (30 §1 rule 1) touched by a green test, for items whose covering P0/P1 test is due at the gate (41 §0; P2-only items, J15 and J31, excluded); (d) ≥95% of all R, V, J, E items and 100% of non-`none` Q clauses have a green test due at the gate (a clause's tests = the Pinned-by tests red under its own patch in the kill matrix; exempt quirks: their 30 Pinned by) (`docs:check` over 41, the kill matrix and the test report). First measured on G at 2.7 (`records/phase-2.md`). Bundle coverage counts only if `merge-coverage.mjs` attributes ≥99% of executed bundle statements to app sources on the golden build (2.7 record) [VERIFY: Next 10.2.3 server-chunk source maps]; else (a) uses Jest + Chromium `page.coverage` only and OD-35 re-sets its threshold before 2.8.

### C4 Differential corpus

- **Corpus:** N URLs from 30 days of gateway or Cloudflare logs (VF-26; fallback a 30-day GA4 `page_path` export; neither: owner decision under OD-35 before 2.5), sampled by observed traffic share with a floor of 50 per routed prefix ([30](30-quirks-register.md) Q-005), plus the T-612 edge URLs; the bound applies to that mix. Committed only in the sanitised form of 42 §7 (paths and ids, sanitised query, no IP, user-agent, referrer or cookie field; owner-signed scrub report); the raw extract stays in `$ARTIFACT_DIR`. Built at 2.5: SSR API responses recorded once through the SSR stub in record mode (40 §2.2), browser read-only calls (E2, E8, E18, E21, E22) as a scrubbed HAR (Playwright route in HAR-record mode) through the golden image. The image inlines `test-key` (`next.config.js:12`, sent as `Bearer` by `api/index.js:38-41`), so the recorder replaces `Authorization` with `Bearer $API_KEY` from its own environment and never writes the key. Replays serve E15 `/members` from the one-eligible-member fixture (40 §5: `pickFeaturedMember` is random); the recorded `/members` is kept for T-113 only. **Acceptance:** 0 recorded 401, 403 or 429; a per-endpoint status histogram in the manifest; for 50 seeded URLs the status class equals a direct request with the key; else re-record. Stored per 42 §7; reused at every step and gate. The per-step 500 URLs and the 10% screenshot set are seeded per-stratum draws fixed at 2.5 (seeds and digest in STATUS §1); every run at a head counts, none is re-drawn. GATE-A and GATE-F add a fresh corpus (N ≥1,000, a new 30-day window, sanitised and recorded the same way through the chain-head reference).
- **Run:** `npm run corpus -- --golden <digest> --candidate <digest>` (`gate-s.yml`; `--golden` = chain-head reference, the golden image until a D15 link exists, 42 §9). Per URL: status, contract headers (42 §8), normalised SSR HTML (40 §1), SSR body DOM (T-728), class census (T-605), `__NEXT_DATA__`/`_next/data` (T-610), console, pageerror, request trace; a browser pass with the T-701/T-728 checks in UTC, America/Los_Angeles and Asia/Tokyo; screenshots (1440/768/375) for 10% (100% at GATE-F). `--live`: the live A/B below. `corpus` refuses equal `--golden` and `--candidate` digests (except `--self`, the 2.5 golden-vs-golden run) and records per URL each container's `imageID` and `__NEXT_DATA__.buildId`; a mismatch with the requested digests fails the run.
- **Pass:** 0 unexplained diffs. Each diff is attributed to the aspect that observed it, in that test's key syntax (headers T-603 `<route class>@proxy/<header>`, SSR head T-602, SSR body DOM T-728, classes T-605, data T-610, request trace T-607 (SSR wire) and T-702 (browser), console T-701; screenshots T-801, never AD-acceptable), and is explained only by an AD row matching (test, key, from, to) exactly, `from` = the golden value at that URL; per-row URL counts go in the record. **Statistic (rule of three):** 0 diffs in N bounds the per-URL defect rate at 1 − 0.05^(1/N) ≈ 3/N (0.30% at 1,000; 0.15% at 2,000), only for diff classes the oracle sees, on recorded data (RG-1). Always stated next to C1.
- **Positive controls** (2.7 and every gate): `corpus --candidate <fault parity image>` for one catalogue fault per aspect: headers R-083, SSR head R-003, SSR body DOM R-013, data R-005, request trace R-016 (wire `Host` of every SSR call; alternate R-076), classes R-001, console R-026 (CSP violation; alternate the Q-071 clause patch, which drops the GA warning), screenshots R-008 at 375 px. Each control changes read-only corpus URLs (never a fault seen only on a mutating call or a state change, e.g. R-028, R-033), gave ≥1 diff on its aspect at 2.7 and is fixed in `test/faults/controls.json` (an acceptance change, 40 §8 rule 8). A control with 0 diffs on its aspect fails C4; the record lists them. `--live` has the same digest check and one control under the same rule (in `controls.json`): a release image of a catalogue fault with a status `.expect`, run beside the reference, must fail the A/B.
- **Live A/B** (`npm run corpus -- --live`, GATE-x.6): release-recipe images of the reference (previous gate commit; GATE-S: the 2.8 commit) and of the gate commit, built in one `gate-s.yml` job and run side by side on the CI runner in the compose topology's `live` profile (egress to the API only, no stub), live API with the real key (an Actions secret; quota ≥8,000 requests plus re-requests, VF-26). Both builds fetch the same live data, so data drift cancels. 2,000 URLs from the window's logs, sanitised as in 42 §7, seeded stratified draw, ≥200 per routed prefix (smaller prefixes pooled into one stratum of ≥200); per URL the order ref, cand, cand, ref, one URL at a time. Latency = per-URL geometric mean per arm. Pass = the 97.5% paired-bootstrap upper bound (per look, C6-NI Looks; 10,000 resamples, recorded seed) of each stratum's geometric-mean ratio cand/ref ≤ 1.10, and 0 candidate-only 5xx URLs (re-requested 5× alternately: 5xx on the candidate ≥3/5, on the reference 0/5).

### C5 Reliability

**Pass:** 20 consecutive green `CI / gate` runs on the unchanged app (2.6); 3 byte-identical captures (42 §6); `retries: 0`; reports show 0 skipped/todo/fixme, `forbidOnly: true`; flake rate <1/100 = (red runs classified (b) or (c) in 40 §9 item 1) / (`CI / gate` + `golden-canary.yml` runs since the previous gate; first from 2.6). A red run counts only after that triage; class (a) is a regression, never a flake. Each flake gets a fix PR.

### C6 Runtime

**C6-CI** (pre-merge; replaces the 24 h stage soak, OD-47 2026-10-20): `soak.yml` at 01 §4 step 3a of every deployable step from W0 (T-902): parity images of the reference (the previous DONE step's merge commit), of the candidate and of the golden image (42 §4; the cumulative arm), in the compose topology at prod limits (`mem_limit: 768m`, the prod CPU limit, 42 §2 env), replay the C4 corpus URLs through the SSR stub at a fixed rate in alternating 30-minute blocks on one runner (rate and duration fixed at 2.5; default 10 rps, 90 min per arm, inside the 6 h job limit). Rows compare the candidate with the reference measured in the same job; rows 3 and 7 also with the golden arm of the same job, row 4 also with the 2.8 record (cumulative caps, so tolerances cannot ratchet; timing is compared only within one job, so runner drift cancels, while memory does not depend on runner speed). **Calibration** (pre-registered, 90 rule 6): at 2.8, 3 runs with the golden image in all three arms; a row that any of them breaches is re-set to the smallest tolerance all three pass, old and new values recorded, signed under OD-35 at 2.8. A breach re-runs once on a fresh runner; a second breach stops (01 §8). Stage, when a step uses it, adds evidence and never replaces a row. 2.0 and 2.1 run before the harness: their stand-ins are the 01 §6 bootstrap rows.

| # | Metric (source) | Pass |
|---|---|---|
| 1 | Container restarts, OOM kills (Docker events) | 0 |
| 2 | 5xx (proxy log) | ≤ reference |
| 3 | p95 latency per routed prefix | ≤1.10 × reference and ≤1.10 × the golden arm |
| 4 | Max RSS; RSS slope per 10,000 requests (linear fit) | ≤1.10 × reference, ≤1.10 × the 2.8 record and <700Mi (prod limit 768Mi); slope ≤ max(reference, 2.8 record) + the 2.8 calibrated tolerance |
| 5 | Upstream calls (stub log) | per-URL request set identical |
| 6 | T-907 checks against the compose app, at start and end | green |
| 7 | CPU-seconds per replayed request (container CPU counter) | ≤1.10 × reference and ≤1.10 × the golden arm |

How the soak's risks are still caught: leaks and CPU (R-048) by rows 4 and 7 at prod limits and 5× the old soak's rate; slow, time-driven growth by C6-prod rows 3 and 9 in the 48 h watch and GATE-x.6's 7-day pod RSS slope; restarts by row 1 and C6-prod row 3; the live API path by the GATE-x.6 live A/B and C6-prod (RG-1, RG-6).

**C6-prod:** 48 h watch from rollout completion (T-903; 01 §4 step 9) with the team's existing monitoring only (Sentry, LogRocket, GA4, gateway and Cloudflare logs, the cluster's existing dashboards; VF-16 names the sources); a row without a source is recorded `unavailable` and printed, and its risk is caught pre-merge by C6-CI (C6-prod rows 3, 4, 9 ↔ C6-CI rows 1, 3, 7). Rows 1–9 exclude the rollout window (mixed pods 404 `_next/data/<buildId>`, Q-095), row 10 covers it. Baseline = the same 2 weekdays of the previous 4 weeks (8 days). Breach: rollback first (01 §5); a false breach costs one re-run, the safe direction. H0 = the false-breach probability for an unchanged app.

| # | Metric | Pass |
|---|---|---|
| 1 | Error events per 1,000 page views (C6-NI signal) | Breach: the pooled 48 h rate above 1.25 × the pooled baseline at one-sided α = 0.01 (`gate-stats.mjs`: z = (ln r − ln 1.25)/√(φ(1/x0 + 1/x1)) > 2.326, φ from the 8 baseline days; H0 ≤1%), or both days above the max of the 8 baseline daily rates (H0 1/45 = 2.2%). One day above the max: triage only (40 §9; H0 20%) |
| 2 | SSR 5xx per 1,000 requests (gateway) | as row 1 (H0 ≤3.2% per row) |
| 3 | Restarts, OOMKills | 0; if the 2.0 export has restarts: each day, restarts per pod-day ≤ the export's maximum daily value (cumulative cap) and every (termination reason, exit code) in the export's set |
| 4 | p95 latency `/search/*`, `/works/*` | ≤1.10 × baseline (8 days pooled; upstream drift is checked by the GATE-x.6 live A/B, not here) |
| 5 | GA page_view per session | ±5% of baseline |
| 6 | T-907 on prod | green |
| 7 | New error types (Sentry issues; LogRocket error groups if Sentry unusable) | Breach: a new error group whose top frame is in app chunks under `/static/search/_next/static/` with ≥N events or ≥M users in the watch. Group key (`gate-stats.mjs` on the event export, not the vendor's grouping, which rebuilt chunks can split): (type, normalised message, top in-app frame symbolicated with the image's own maps, S-9). N, M set by the owner at 2.5 (VF-04) as the smallest values under which none of the 2.0 export's 14 disjoint 48 h windows and neither calibration watch breaches (H0 measured, recorded). Other new groups: logged, triaged within 24 h (40 §9) |
| 8 | Telemetry liveness (T-907 prod probe): a live `doi:null` output (Q-074a, ID from VF-03) loaded in a browser; where VF-04 shows a server DSN also `/data-providers/?q=100%25` (Q-073d) | ≥1 Sentry or LogRocket event per probe within 10 min, at 0 h and 48 h |
| 9 | CPU-seconds per 1,000 requests; HPA replicas | ≤1.10 × baseline (8 days pooled); replicas <15 throughout |
| 10 | Rollout window: 5xx and `_next/data` 404 per rollout | Breach: the row 1 test with x0 = the sum over the last 3 recorded rollouts (n0 = 3), x1 = this rollout (n1 = 1), φ = 1 (H0 ≤1%); above their max only: triage (today's recorded at 2.8) |

**Calibration** (pre-registered, 90 rule 6): the 2.0 and 2.1 watches also measure rows 4, 5, 7 and 9 where their sources exist and are **calibration watches**: a breach of row 3, 4, 5 or 9 whose causes all match the 2.0 export (row 3: its termination reasons and exit codes; rows 4, 5, 9: the prefixes, metrics and hours of day of its own excursions) is recorded instead of rolled back; any other breach rolls back. At 2.5 `gate-stats.mjs` applies rows 3, 4, 5 and 9, like row 7, to each of the 2.0 export's 14 disjoint 48 h windows against its other days (breach share = the row's measured H0, recorded). A row with H0 > 5% or a recorded calibration breach is re-set to the smallest tolerance under which the export windows (H0 ≤ 5%) and both watches pass, old and new values recorded, signed under OD-35 at 2.8, before the W0 watch.

Rows 1, 7 and C6-NI (i)/(iii) and C7(8) count only once row 8 has passed on prod (2.8 exit). If it cannot pass (no prod DSN, CSP blocks events: Q-096, VF-04), the owner signs at 2.8 that they are not counted and RG-3 names it; C6-NI (ii) is then the main printed signal.

**C6-NI:** non-inferiority at each gate, **printed only** (report-only; the concurrent split was WITHDRAWN with OD-47, 2026-10-20). It never gates on a months-apart comparison: drift between such windows is not app behaviour. (i)–(iii) are computed against the pre-window and printed in the gate statement; RG-3 names the drift blind spot. The prod guards are C6-prod per step and, at each gate, GATE-x.6's per-day checks and live A/B, which compare concurrent or recent data.

**Export** (`gate-stats.mjs` input; committed as `test/signals/<tag>.json`, 42 §7: daily counts and rates and SHA-256 keys of error groups, never message text; SHA-256 in STATUS §1 and the record): at the 2.0 exit (`2.0`: for 2.5 and the C6 baselines), at the W0 prod merge (`W0`) and at the end of every gate window (`S`, `A`, `F`): the daily series of every candidate signal (Sentry events, GA page views, gateway/Cloudflare 5xx and requests, LogRocket error sessions and sessions), the error-group keys with daily counts for C6-prod row 7, daily p95 per routed prefix, per-pod RSS series, restarts with termination reasons and exit codes, CPU-seconds per 1,000 requests, each as far back as its source retains (target 28 days; SaaS retention is finite). A gate's **pre-window** is the previous export (GATE-S `W0`, GATE-A `S`, GATE-F `A`); if it is absent, the executor stops before the gate window starts (01 §8). A source unreachable by the 2.0 exit is recorded `unavailable: <source>, VF-nn` with an owner-signed latest export date inside its retention; a source with <28 days is named. 2.5 verifies. Rates per unit (page view, request, session), per day. **Excluded days:** only for an external root cause (upstream API, Cloudflare, AKS node or network) shown by a system the search image does not control, signed by the owner and the Reviewer; at most 2 per window, each extending the window by a day, all listed in the record; app-caused or unknown-cause incidents stay in. H0: λ1/λ0 ≥ m vs H1: < m, margin m = 1.05, one-sided α = 0.025.

- **Test** (printed): day-level bootstrap (robust to overdispersion): draw pre and post days with replacement, 10,000 draws, recorded seed; U = 97.5th percentile of rate_post / rate_pre; non-inferior ⇔ U < m. **Size check:** `gate-stats.mjs` simulates the test's size at the margin with the fitted φ (10,000 replicate windows); if it exceeds 0.025 the simulated critical quantile replaces the percentile; both are recorded. Also printed, as a cross-check: the exact conditional binomial p (conditioning on k makes x1 binomial):

```
pre: x0 events / n0 units    post: x1 events / n1 units    k = x0 + x1
π0 = m·n1 / (m·n1 + n0)
p  = P(X ≤ x1), X ~ Bin(k, π0) = Σ_{i=0..x1} C(k,i)·π0^i·(1−π0)^(k−i);   non-inferior ⇔ p ≤ 0.025
check: python3 -c "from scipy.stats import binomtest as b; print(b(x1,k,pi0,alternative='less').pvalue)"
```

- **Signals** (fixed at 2.5 by VF-04): (i) Sentry error events / GA page views, only if prod events arrive (Q-096: legacy DSN host vs CSP; C6-prod row 8); (ii) gateway or Cloudflare 5xx / requests, always; (iii) LogRocket error sessions / sessions, if (i) is unusable.
- **Power** (printed per signal, from its pre-window before the GATE-x.6 window starts, frozen in the gate record PR): the pass probability at a true ratio of 1.0, Φ(ln m / SE − 1.96), SE = √(φ · (1/x0 + 1/x̂1)), x̂1 = x0 · n1/n0, φ = variance/mean of the pre daily counts (m = 1.05, φ = 1: x0 ≳ 6,600); below 0.80 the signal is marked uninformative.
- **Looks** (GATE-x.6 per-day checks and live A/B): at most 2 per gate commit, pre-registered in the gate record PR; look 2 only after look 1 failed and 40 §9 found no app cause, on a fresh window or draw (GATE-x.1 Tr counts from the first window). Two failed looks: stop (01 §8). Every look is recorded.
- **SDK changes** since the pre-window's prod commit (W2a, W2b, W4c react-ga4, 6.8): a signal is comparable only if that step's **SDK calibration** showed equal error-event counts per fixture (parity images before and after the step; fixtures Q-074a–e, the forced-500 fixture and the T-741 set; in the step record), else it is printed as not comparable. Counted are the events the SDK emits, never transport requests (batching and retries of aborted uploads differ by version): Sentry `store` events and envelope items of type `event` at the guard and the counting stub (40 §2.4), LogRocket error captures by an init-script spy [VERIFY: a spy point that sees LogRocket 10 and 12; settled by the W2b calibration], GA `page_view` entries by the T-719 `dataLayer` spy.
- Report too: 0 confirmed regression reports in N_s post-window sessions (GA, VF-18) bounds the per-session regression probability at 3/N_s. A confirmed regression fails the gate.

### C7 React layer (review:react-mobx G-R1..G-R8)

All of: (1) 0 hydration errors outside the T-728 pinned diff on every channel (T-701, T-728) over T-601 routes × fixtures × TZ {UTC, America/Los_Angeles, Asia/Tokyo} × cookie {absent, essential, essential+analytics} × {Chromium, WebKit, Firefox}; inside it, the set of (route, fixture, TZ, cookie state, engine, error code, DOM path of the first mismatch) equals the W6a record exactly (from W7b: the W7b record), minus entries removed by signed ESCALATES fixes; a new or changed entry fails; (2) SSR-vs-hydrated diff (T-728) empty except the pinned diff and signed ESCALATES fixes; (3) raw `<title>` and SEO tags byte-equal (T-602), post-hydration head per T-729; (4) request counts (API, `/account`, Sentry, GA, LogRocket) equal in both cookie states (T-702, 41 §2.2); (5) Jest console gate green (40 §2.1); (6) T-203 table unchanged (T-212 from 6.0); (7) T-404 green under both JSX runtimes; (8) C6-prod row 7 not breached (stage has no DSN, Q-096; counts only after C6-prod row 8) and 0 server Sentry events at the counting stub (T-610).

### C8 Hygiene and independent review

All of: no VF due by this gate OPEN (STATUS §3); no OD due by this gate un-DECIDED (STATUS §2: OPEN ODs need the owner); `npm run docs:check` green; every PR since the previous gate names its step and IDs; every step record since then signed; the Reviewer is a second engineer, not the Implementer; bot approvals never count.

## 3. Gate template and GATE-S

Every gate: one commit, deployed to prod by its merge; **all tiers** (every 41 row due, manual T-904 included) plus C1–C8; record (§8) signed by Implementer, Reviewer, Owner (`SIGNED:` comments, 01 §3). Due = Wave or Bites-in step at or before the gate.

| ID | Criterion (binary) |
|---|---|
| GATE-x.1 Versions | 02 §1 rule 4 and §4 hold at the gate's **version cut-off Tr** (D6) = committer date of the gate commit's last change to `package.json`, `package-lock.json` or `e2e/package*.json` (`git log -1 --format=%cI <commit> -- <those paths>`; the Docker runner recipe and the pinned actions of the first plan were removed, D19, D20); that change is the last commit of the **gate sweep** (02 §5 on every row, test tools and CI-only pins included: GATE-S in W8, GATE-A in 6.10, GATE-F in 7.F) and Tr ≥ the start of the gate's first GATE-x.6 window − 10 days (a look 2 or a restarted window needs no new sweep); evaluated by `scripts/outdated-at.mjs <Tr>` (02 §5 step 5); a row open past its 02 §4 column passes only under §4 (b); versions published after Tr are listed in the gate record and taken in the first step after the gate (after GATE-F: a post-GATE-F maintenance step entered in 02 §4); a CI-8 advisory ≥ high on the gate day still fails; `npm ci --legacy-peer-deps` passes and the strict-mode `npm ls --all` problem set ⊆ the 02 §4 allow-list (T-008); at GATE-F strict `npm_config_userconfig=/dev/null npm ci --no-legacy-peer-deps` passes and `npm ls --all` exits 0; CI-8 green, blocking (allow-list 42) |
| GATE-x.2 Suite | Computed from the gate run's JSON reports: ≥1 executed, passing test per (active P0 or due P1 row, Cases clause) (title prefix `T-###` plus clause, 40 §7, 41 §0); `docs:check --tests` fails on a clause with no test; each P2 passing or owner-waived in the record (§4 (c)); 0 failed, 0 skipped; `docs:check` rejects a test title whose T-ID is not in 41; 3 consecutive green `CI / gate` runs at the commit; `retries: 0`; STATUS §4 DONE flips follow the report |
| GATE-x.3 Parity | Vs the approved chain head + AD ledger (42 §9): T-801/T-802 0 px read from the JSON reports (the exact comparator's `diff-pixels` annotation = 0 per screenshot, 40 §1; a screenshot without one fails), every viewport and engine (41 §2.5); T-601–T-612 green, snapshots identical; T-702/T-607 logs identical; T-701/T-728 no new events (tuple set, C7 (1)), SSR body DOM identical; T-803 identical violation set; T-805/T-806 identical; T-001 parity |
| GATE-x.4 Confidence | C1–C8 pass |
| GATE-x.5 Risks | 41 §3: each C/H and SILENT risk has ≥1 black-box detector; each due C/H risk MITIGATED or CLOSED; every PRESERVE and WATCH quirk PINNED in every clause (30 §1 rule 1), its pins due at the gate (41 §0) and green, and each non-exempt, non-`none` clause's C1-Q fault valid and killed (killed/total, the exempt and `none` lists printed); each due approved ESCALATES item (OD-09, OD-40) FIXED and signed |
| GATE-x.6 Production | ≥14 consecutive days prod ran only the gate commit's merge (no merge to `main` in the window, 01 §2 gate window hold; an urgent one restarts it), no rollback; every window day passes C6-prod row 2's test (that day vs the pre-window, α = 0.01/14) and row 3; ≥1 pod with uptime ≥7 d whose RSS slope (linear fit) ≤ max(pre-window slope, 5 MiB/day) (if AKS node maintenance recycles pods sooner, on cluster evidence from the existing monitoring: the longest-lived pod ≥72 h plus the **gate C6-CI run**: `soak.yml` with the gate commit as candidate and the previous gate commit, GATE-S: the 2.8 commit, as reference); a check whose source the 2.0 export records `unavailable` (VF-16) is replaced, under an owner `SIGNED:` line at 2.8, by its gate C6-CI counterpart (restarts ↔ C6-CI row 1; RSS slope ↔ row 4; gateway 5xx ↔ row 2 plus, once C6-prod row 8 has passed, the same daily test on Sentry, else LogRocket, error events per 1,000 page views), each substitution listed in the gate record (§8); the **live A/B** (C4) passes; C6-NI is printed; C6-CI and the watch of every step since the previous gate passed. Search Console (VF-16) is report-only (RG-3): indexed `/works/` + `/outputs/` pages < 0.80 × or Article structured-data errors per valid item > 1.25 × the pre-window triggers 40 §9 triage (the SEO head is gated by T-602 and C4) |
| GATE-x.7 Harness | Test tooling at its 02 target; CI-only binaries and actions (nginx, dnsmasq, runner base image, pinned actions) at registry latest at Tr (GATE-x.1); each tool bump since the previous gate linked by a 42 §9 re-capture |
| GATE-x.8 Operations | Rollback readiness with repo and CI only (01 §5): the rollback target of the gate commit (the previous step's merge) builds with the release recipe on CI and its image passes T-901 and the T-907 checks in the compose topology; a `git revert -m 1` of the gate's last deployable merge on a throwaway branch leaves exactly the target's runtime tree (`git diff --quiet <target> HEAD <PI>`) and gets a green `CI / gate`; every merge since the previous gate deployed green through `aks_deploy.yml`, the path a revert takes, and their run durations are recorded as the rollback time |
| GATE-x.9 Acceptance | RG-1..RG-8 (and any new RG) accepted by name; §8 statement signed by all three |

**GATE-S** (entry W8 DONE, [50](50-roadmap.md)): the template, C4 N ≥2,000, and in GATE-x.7 the final Playwright bump + golden re-capture (42 §9), part of the GATE-S sweep (GATE-x.1). It replaces "Prod stable for 1 week" and "two clean nightly cycles" (review:00 X55.2, X50.1).

## 4. GATE-A (pre-antd, M5)

Entry: 6.10 DONE ([70](70-phase6.md)). The template at commit A on the phase-6 code (C1 full catalogue, C2 on rewritten files, C4 N ≥1,000 plus the fresh corpus), plus (review:00 X55.1):

| ID | Criterion |
|---|---|
| GATE-A.10 No antd | `git grep -nE -e "from ['\"]@?ant[d-]" -e "require\(['\"]@?ant[d-]" -- . ':!docs' ':!test' ':!e2e'` = 0 hits; `npm ls antd @ant-design/cssinjs @ant-design/icons` empty; T-004 shows no antd module (D10, OC-24) |
| GATE-A.11 Swap harness | T-802 harness build has the `IMPL` switch (`design`/`antd`, OD-30); behaviour contracts (role, accessible name, keyboard path, focus return; T-802, T-417, 60 preserved behaviours, 80 §3 checklist) of every used DU-01..DU-24 unit pass with `IMPL=design`; a prop census (DU, prop keys, enumerated values) logged across the E2E suite and C4 has a T-802 state for every combination: 0 uncovered |
| GATE-A.12 Mapping | Every existing V1–V39, J1–J32 and every PINNED Q row whose Where is a template, module or design path maps to ≥1 DU unit, each unit to an antd target or "owned" (60, 80): 0 unmapped |
| GATE-A.13 Budget, target | OD-49 DECIDED (performance budget); commit A in STATUS §1 as the phase-7 rollback target |

- Exceptions are exactly, each with an owner `SIGNED:` line and listed in the gate record: (a) the documentation items GATE-A.12, GATE-A.13, GATE-F.13; (b) GATE-x.1 for a 02 §4 row recorded `EXCEPTION` whose upstream blocker 02 documents, covered by an owner-signed OD created before Tr; (c) GATE-x.2 for P2 rows. Never the rest of GATE-x.1–x.9, never C1–C8. A failing C criterion is fixed and re-measured (C6-NI: Looks), never waived; a pixel or behaviour difference never passes (M2, D7).
- The 0-px antd spike (Modal + Select, 80 §1) is **not** a GATE-A criterion: it runs in step 7.0 on an unmerged branch ([80](80-phase7-antd.md); review:00 X80.2), as D10 allows no antd on `main` before GATE-A is signed by the Owner.

## 5. GATE-F (end of phase 7)

Entry: 7.F DONE (80). The template (C4 N ≥1,000 plus the fresh corpus) plus (review:00 X55.3):

| ID | Criterion |
|---|---|
| GATE-F.10 | `git grep -n -e '@oacore/design' -e "from ['\"]design" -- . ':!docs' ':!*.md'` = 0 hits (CI guard CS-AN-6; `THIRD_PARTY_NOTICES.md` keeps the name) |
| GATE-F.11 | `vendor/oacore-design/` absent; no compiled vendor code; `@oacore` registry config and `NPM_TOKEN` removed (CS-DSN-7; D9) |
| GATE-F.12 | Every DU-01..DU-24 unit is antd restyled to match (D5) or readable search-owned source (60; end-state split owner-confirmed, OD-21); `THIRD_PARTY_NOTICES.md` carries the design MIT notice (60 §2) |
| GATE-F.13 | L2 sweep done (7.F); no 02 §4 row open at GATE-F without an owner-signed OD |

## 6. W5 vendoring checks VG-1..VG-7

W0.5 and W5 exits (50) for the tarball and the directory package (layout C, OD-21; [60](60-design-ownership.md) §5). Reference = the `main` build just before the step (W0b for W0.5, W4e for W5), production and minified (review:00 X55.4). Any failure = stop (01 §8). T-016 automates VG-1, VG-2 and also runs at W0.5.

| ID | Check | Pass |
|---|---|---|
| VG-1 Install shape | `test ! -L node_modules/@oacore/design`; file count of the installed package (W0.5), of `git ls-files vendor/oacore-design` (W5) | copy; 466 (tarball count) |
| VG-2 Compiler untouched | each vendored module's source in client and server bundles vs its file | byte-equal (wrapper aside); 0 added `core-js/` imports |
| VG-3 CSS bytes | SHA-256 per `<link rel=stylesheet>`, in order, every T-601 route, `sourceMappingURL` comments stripped | identical |
| VG-4 Assets | media file-name set; prod sprite `/static/search/icons.svg` bytes (48 symbols) | identical |
| VG-5 Whole build | `.next`, buildId normalised (T-014) | identical; only after VF-09 proves two unchanged builds identical, else "N/A" |
| VG-6 SSR HTML | full SSR HTML of every T-601 route | identical (buildId normalised) |
| VG-7 Existing tests | T-801, T-802, T-417, T-418, T-416, T-701; sprite URL 200, every `<use>` bbox non-zero | green |

Lockfile rule: `git diff <pre-step> -- package-lock.json` touches only the `@oacore/design` entries, the root dependency spec and the removals CS-DSN-4/-5 name (60 §5).

## 7. Residual gaps RG-1..RG-8

Not provable before prod; accepted by name at each gate (GATE-x.9). A new gap gets the next RG ID here (01 §9); no unnamed waivers.

| ID | Gap | Why tests cannot close it | Mitigation |
|---|---|---|---|
| RG-1 | Live API data variety | fixtures and C4 use recorded data | shape-variance fixtures (40 §6); C4 from real URLs; live API in the GATE-x.6 live A/B; C6-prod |
| RG-2 | Real gateway, k8s, Cloudflare | proxy generated from the YAML; edge not emulated | T-612; VF-01 (gateway evidence, W4d prod probe, 20 §2.0); T-907; T-904 edge list (VF-14) |
| RG-3 | Third-party ingestion (GA, Sentry, LogRocket), Google indexing; prod client errors unobservable if C6-prod row 8 cannot pass; with C6-NI printed only, a cumulative error-rate rise smaller than the drift between exports | SaaS not reachable from CI; windows months apart confound drift with the app | T-719, T-741; T-904 checklist; C6-prod row 8; C6-prod per step against recent baselines; GATE-x.6 per-day checks, live A/B and Search Console report (triage trigger) |
| RG-4 | Non-deterministic races (Q-021) | outcome depends on network timing | T-211 (fixed stub delays), T-734 claim race (Q-091); other interleavings not enumerated |
| RG-5 | Browsers beyond the three engines | outside the matrix | T-724 (+ one engine at the Next floor), T-015; OD-16, VF-25 |
| RG-6 | In-cluster Host path, prod only | stage never internalises its API host (`api/internalize.js:24`; X40.17) | T-607; API log check at the first rollout of W4e and 6.3 (01 §4 step 8; VF-02) |
| RG-7 | Upstream API failures invisible in prod logs | `utils/logger.js:2` is silent in production; E1/E4/E6 failures render 200 soft pages (X10.24) | C6-CI row 5; failure fixtures (T-5xx, T-731) |
| RG-8 | No prod-equivalent pre-prod | stage is optional, 1 replica, 1Gi (`kube/stage/deployment.yaml:9,93`) vs HPA 4–15, 768Mi (`kube/prod/hpa.yaml:11-12`, `deployment.yaml:94`), ~0 traffic; no canary or split (OD-47); where VF-16 finds no prod restart or pod-RSS source, growth over days is not measured | C6-CI at prod limits; C6-prod, rollback first (01 §5); T-611; GATE-x.6 substitution by the gate C6-CI run |

## 8. Gate record and sign-off

`docs/upgrade/records/gate-{S,A,F}.md`; 01 §7 step-record fields are not repeated.

```
Gate <S|A|F> | commit | runtime tree | prod deploy run | window | date | chain head B<n> | new AD rows
GATE-x.1..x.9 (+ A/F.10-13): criterion | evidence URL | pass
C1..C8: threshold | measured | pass  (C1: catalogue killed/N_f, sealed x/H, L, build faults red/total, excluded risks, batch SHA-256 list,
  (1L), kill matrix, C1-Q clauses killed/total, exempt and `none` lists; C2: overall, core, 2.7; C4: N, diffs, bound,
  positive controls; C5: flakes/runs; C6-CI per step; C6-NI (printed): export files; per signal: power, x0 n0 x1 n1, U, p,
  SDK calibration; looks)
AD rows in force: id list; counts per kind (delta, product)
Exceptions (§4 (a)-(c): A.12, A.13, F.13; x.1 rows with OD; x.2 P2 rows): item | reason | owner SIGNED: URL
Substitutions (GATE-x.6, `unavailable` sources): check | substitute | result | owner SIGNED: URL (2.8)
RG-1..RG-8 (+ new): accepted by <name> <date>
Sign-offs: Implementer | Reviewer | Owner: name, date, SIGNED: URL
```

Statement: "As of <date>, C1–C8 pass for GATE-<x> at <commit> (deploy run <r>), each statistic one-sided at 95% (jointly ≥85%, OD-35): fault recall <x>/<H> on the sealed batch (lower bound <L>), catalogue <n>/<n> killed, build faults <b>/<b> red; quirk clauses <q>/<q> killed (exempt: <list>; none: <list>); mutation <M>% overall, ≥<Mc>% per core file; coverage <K>%; corpus 0/<N> unexplained diffs (per-URL defect rate ≤<U> at 95%, recorded data); prod C6-NI printed (report-only): U = <U> for <signals>; thresholds changed under 90 rule 6: <none | old → new>; RG-1..RG-8 accepted."
