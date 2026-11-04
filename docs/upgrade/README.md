# Upgrade plan: `search`

**Purpose.** Entry point: what the project is, the rules, the docs, the errata, where work stands and what to do next. **Read first**, then [STATUS](STATUS.md); the next action is §8. Bare numbers (`50`, `41 §3`) are the docs `NN-*.md` here; in 40 and 41 a bare 03 to 08 means `findings/0N-*.md`.

## 1. What and why

`search` is CORE's public search UI (`/search`, `/works/:id`, `/outputs/:id` + `/display/:id`, `/data-providers`, `/data-providers/:id`): Next.js 10.2.3 pages router with SSR, React 17, MobX, the private UI library `@oacore/design` 5.0.74, CSS Modules, JavaScript; Docker on AKS (arm64) behind `kube/*/httproute.yaml`. Goal: the owner requirements M1–M9 (00 D6–D14) with no behaviour change.

| Repo (path from the repo root) | Role |
|---|---|
| `search` (this repo) | The app; this plan in `docs/upgrade/` |
| `../dashboard` (`48e3466`) | Target library choice (D11); Vite SPA, no tests; not a version source (D6) |
| `../@dashboard` | dashboard-next scaffold + core-ui copy; reference |
| `../design` (git `bbc35a0`) | Source of `@oacore/design`, deprecated (D9); vendoring uses the tarball (60 §1) |
| `../core-ui` | Reference only (OD-34) |
| `../core-fe-architecture/index.html` | Org guide; its React Router SPA, React Hook Form, `stores/` layout: not adopted (D11) |

## 2. Binding decisions ([00](00-decisions.md))

M1–M9 (owner requirements, verbatim) and D1–D20 are in 00; read it once before any step. D18–D20 (owner, 2026-10-22; 00 §4b) set the lean mode that applies now: "relatively sure" (the automated local suite green after each of five jumps, one deploy at the end, a 15-minute smoke check), the scope rule (version upgrades, stability and local tests only; no GitHub, CI, Docker or DevOps change; deploy-time items are recorded for the owner, never applied) and no CI (`bash scripts/ci-local.sh` is the full suite). D15 (re-baseline for product changes) was decided on 2026-10-20 (OQ-2); D16 (security fixes outside D1) was WITHDRAWN the same day (owner in chat: existing defects stay, S-4 included; 00 §6); D17 (design frozen at 5.0.74) stays PROVISIONAL (no owner question covered it). Scope (00 §6): today's deploy process is kept, no new infrastructure, and the owner alone signs.

## 3. Stack: today → end state

| Area | Today (tree `a825839`) | End state (versions: latest per [02](02-version-matrix.md)) |
|---|---|---|
| Runtime | Node 18 alpine, arm64 | Node LTS (OD-05) |
| Framework | Next 10.2.3, webpack 4, Babel | Next pages router, `--webpack` (OD-10), SWC |
| React, state | React 17.0.2; mobx 6.13.7, mobx-react-lite 3.4.3 | React; zustand (70 §3.5) |
| HTTP, data | `fetch` wrapper `api/index.js` | axios behind the wrapper; SWR only with request parity (OD-43) |
| UI, CSS | `@oacore/design` 5.0.74; CSS Modules + camelCase patch; PostCSS chain | antd at 0 px + owned units (D5, D9); standard CSS, CSS Modules (OD-33) |
| Language, lint | JS; ESLint 7, stylelint 13, Prettier 2, husky 4; lint red | TypeScript (OD-07); ESLint + typescript-eslint, stylelint, Prettier, husky + lint-staged |
| Tests, CI | none; deploy on push and nightly | Jest + RTL, Playwright, run locally by `bash scripts/ci-local.sh` (42 §10; no CI, D20) |
| Observability | Sentry 5.30, LogRocket 10, react-ga4 2.1.0 | `@sentry/nextjs` (OD-14), LogRocket, react-ga4 |
| Packages | npm, `--legacy-peer-deps`, install fallback | npm (OD-06), strict install |

## 4. Top risks ([10](10-risk-register.md), [30](30-quirks-register.md))

The Critical rows of 10 §2, each with its change site and step; the security notes of 30 are preserved like quirks (S-4: OD-36).

## 5. Doc map and reading order

| Doc | Owns (only here) |
|---|---|
| [STATUS](STATUS.md) | digests, owner confirmations, VF register, status ledger, PRs, log |
| [00](00-decisions.md) | D1–D20, phase order (owner edits only) |
| [01](01-playbook.md) | git and PR rules, step runbook, rollback, DoD, records, stop conditions, doc change control |
| [02](02-version-matrix.md) | every version, exceptions, Node policy, re-resolution |
| [10](10-risk-register.md) / [30](30-quirks-register.md) | risks / quirks, Q→T pins, security notes |
| [20](20-change-sites.md) | change sites 2.0–W8 with Anchors and proofs |
| [40](40-test-strategy.md) | parity contract, harness, determinism, fixtures, triage, commands |
| [41](41-test-inventory.md) | tests, catalogues E/V/J, fixtures, risk → detector index |
| [42](42-baselines-and-ci.md) | images, Docker recipe, golden image, capture, storage, AD ledger, CI |
| [50](50-roadmap.md) | OC-1..24, steps 2.0–W8 (entry, exit, rollback, security, effort) |
| [55](55-gates-and-confidence.md) | C1–C8, C6-CI and watch, GATE-S/A/F, VG, RG |
| [60](60-design-ownership.md) | design provenance, DU units, layouts, CS-DSN, DV steps |
| [70](70-phase6.md) / [80](80-phase7-antd.md) | phase 6 (6.0–6.10) / phase 7 (7.0–7.F) |
| [90](90-open-decisions.md) | OD-01..OD-49 |

**Orient:** README → STATUS → 00. **Step:** §8 → 50 row → 01 → 20 (60 for W0.5, W5) → 41 rows whose Wave lists it → 30, 10 → 55 §1 step column (the rest of 55 at a gate). **Harness, tests:** 40 → 41 → 42. **Versions:** 02. **Phase 6/7:** 70 or 80 → 55 → 60. **Red test:** 40 §9 → 30 → 10 → 42 §8. **Decisions:** 90 → 00.

## 6. IDs, statuses, glossary

| IDs | Meaning | Owner |
|---|---|---|
| M1–M9; D1, D1a, D2–D5, D4a, D6–D20 | requirements; decisions, D(5+n) = Mn; D18–D20 the lean-mode rules of 2026-10-22 | 00 |
| 2.0–2.8 (2.0a, 2.0b WITHDRAWN 2026-10-20: one step 2.0); W0, W0b, W0.5, W1, W2a–W2e, W3, W4a–W4e, W5, W5.5, W6a, W6c, W6d, W7a–W7c, W8; 6.0–6.10; 7.0, 7.1, 7.2.DU-nn, 7.F | steps. W4c is now Next 12.1.6 (was 11.1); W6b WITHDRAWN (→ W5.5); W9 = 6.7; L1 = 6.10; L2 in 7.F | 50, 70, 80 |
| GATE-S/A/F, GATE-x.n; C1–C8; VG-1..7; RG-1..8 | gates, criteria, confidence, W5 checks, residual gaps | 55 |
| OC-1..24 | ordering constraints (= old O1–O14 + new) | 50 |
| R-###; Q-### (Q-048.U1–U4); S-# | risks; quirks; security notes | 10; 30 |
| T-###; P0, P1, P2, P0@x, P1@x; E1–E22, V1–V39, J1–J32 | tests, priorities (41 §0); endpoints, visual states, journeys | 41 |
| CS-<GROUP>-n | change sites | 20, 60, 70, 80 |
| DU-01..24; DV0–DV9 | design units; design steps (DV0–DV6 = old D0–D6) | 60 |
| CI-1..8; AD-###; B0..Bn | CI gates (CI-n = old Gn); accepted diffs; baseline chain | 42 |
| OD-##; VF-##; ER-##; FW0–FW8 | decisions; open facts; errata; findings/01 waves | 90; STATUS; README |

Review labels (`X10.1`, `OQ-3`, `NE-02`) are cited, never redefined.

**Statuses** (STATUS §4 lists non-defaults only): risk OPEN → MITIGATED → CLOSED; quirk UNPINNED → PINNED; ESCALATES CANDIDATE → PROVEN → FIX-APPROVED → FIXED, or REJECTED (30 §1); test and CS TODO → DONE; step NOT STARTED → IN PROGRESS → DONE or ROLLED BACK; VF OPEN → CLOSED; fault FAULT-VERIFIED. ODs: `OPEN (default: X)`, `DECIDED (date): X`, `SUPERSEDED (by OD-nn)`, `WITHDRAWN (reason)`; D17 alone is PROVISIONAL (00 §4). Open facts: `[VERIFY: what settles it]`.

**Glossary.** *gSSP/gIP*: `getServerSideProps`/`getInitialProps`. *formap*: `data/.formap.json` provider map. *MSW*: request mocks, Jest only. *ICU*: Unicode data behind `Intl`. *AKS*: Azure Kubernetes. *`main`/`stage`*: branches deploying prod/stage. *Step*: one deployable unit (01 §4); *Wave* (41): steps where a test may fail. *C6-CI*: the pre-merge runtime run on the CI runner (55 C6); *watch*: 48 h on prod with the existing monitoring (55 C6); no stage soak, canary or split (OD-47). *Golden commit G, golden image*: the baseline commit and its parity image (42 §4). *Parity/release image*: frozen-data test build/deployed build. *Baseline chain*: B0 + signed re-captures (42 §9). *AD ledger*: `test/baseline/ACCEPTED-DIFFS.yml`. *Parity contract*: 40 §1. *Proxy*: nginx generated from the HTTPRoute YAML. *DoD*: 01 §6. *Seeded fault*: patch re-creating a risk (55 C1). *Corpus*: real URLs replayed (55 C4). *SILENT/LOUD/LOUD-browser*: no error/build or server error/console only. *Layout C*: design as a local package (60 §4).

## 7. Errata

`findings/01–08` and `findings/baselines/` are frozen evidence: normative only where 41 cites them as a case list, always read with that row's `Corr:` text and the ER rows below; elsewhere the plan wins. Their W0–W8 are FW0–FW8. `path:line` holds for tree `a825839` (01 §9). Review evidence lives in `findings/review-2026-10-19/`: `review:00` = `00-verified-findings.md` (entries `review:00 X##.#`), `review:<dim>` = `<dim>.md`, `review:<dim>.verdicts` = `<dim>.verdicts.md`. Resolved verify items: review:00 §2 (80), applied in the owning docs; open: STATUS §3.

| ER | findings/ | Finding says | Correct fact | Now in |
|---|---|---|---|---|
| ER-01 | 01 §1, 05 | decorators only in `store/filters.js` | 32 lines in 5 stores (26 MobX, 6 custom); needs CS-BAB-1 + CS-BAB-2 | 50 OC-6 |
| ER-02 | 07 | `/search/` 301 | 308 + `Refresh` | 30 Q-002 |
| ER-03 | 02 | server bundles `@sentry/browser` | true only from webpack 5 (W4b): 0 server events | 10 R-040 |
| ER-04 | 02 | stub gets `Host` override | native fetch drops it on Node 18–26 (review:00 §2 #1) | 30 Q-022 |
| ER-05 | 04, 05, 07 | CSS patch lines | `next.config.js:45-77`, return `:55` | 20 CS-W0b-2 |
| ER-06 | 05 | CSS import `_app.jsx:14` | `pages/_app.jsx:15-19` | 60 §8 |
| ER-07 | 01, 05 | 69 files / 102 lines | 101 imports, 68 files | 60 §3 |
| ER-08 | 05, 02 | 27 files, 178 selectors | 26 files, 177 classes; 363 `styles.x` member reads, 202 of them camelCase-only, 24 dangling (Q-099; 221/430 are grep tokens) | 10 R-001 |
| ER-09 | 03 §7 | fix quirks before React 18 | only proven ESCALATES (OD-09) | 30 §E |
| ER-10 | 01 §7.2 | react-hook-form | antd `Form` (D3) | 80 §4 |
| ER-11 | 01 | `cssnano` unused | used; W8 decides | 20 W8 |
| ER-12 | 04 | copy `src/` | tarball, then directory package | 60 §4 |
| ER-13 | 07 | placeholder open | "Search more than 356 million…" | 30 Q-004 |
| ER-14 | 07 | `author[].name` open | an object | 30 Q-053 |
| ER-15 | 06, 07 | sort "recent" | pushes `relevance` | 30 Q-043 |
| ER-16 | 07 | Leaflet 1.8 | 1.9.4 | 02 §3.2 |
| ER-17 | 01 §0 | `npm ls` ~638; bibtex 557 | 7 problems; 450 entries; 12 stale latests | 02 |
| ER-18 | 01 §7.2 | waves; Next 11.1.4 | FW0–FW8; 11.1.4 cannot build the app | 50 |
| ER-19 | 02 §4.1, §6.1 | works 410; OpenSSL flag | HTTP 500; flag until 12.1.6; rewrite breaks 12.2+ | 30 Q-001, 10 R-068 |
| ER-20 | 03 | StrictMode on | off (OD-22); R-012 = `jsx()`; writes outside actions | 10 R-081 |
| ER-21 | 04 §0–§7 | 106 CSS files; no fonts | 53 + 7; 4 stale lib files; fonts exist; processed CSS | 60 |
| ER-22 | 05 | layer split; nightly redeploys | breaks icons (R-022); never rolls out (Q-095); 403 outside | 10, 30 |
| ER-23 | 06 | claim last wins; E1–E21 | Q-091; axios urlencoded, Blob → String; E22; Q-090 | 41 §2 |
| ER-24 | 07 §8.3 | selector IDs | `work-search-output-N`, `#select-app-bar-search` (X40.15) | 40 §7 |
| ER-25 | 07 §2–§3 | J5, J6, J12, consent | full nav; T-602 + T-729; Q-080; Q-070; Q-097 | 41 §2.4 |
| ER-26 | 07 §1.1, §5, §8.1 | routes; masks; `APP_ENV=local` | Q-005; 0 px; `APP_ENV=production` | 40 §1 |
| ER-27 | 08 | zustand in 40 files | 22; icons 5.6.1 + 6.1.0; husky shim | 70 §1 |
| ER-28 | baselines/ | lint JSON paths | absolute: normalise | 41 T-001 |
| ER-29 | review-2026-10-19/ | working directories outside the repo | not in the repo: cite review IDs only | README §7 |

## 8. Status

**Last updated:** 2026-11-04. Phase 1 DONE; Phase 1b review DONE, owner approval pending. OQ-1..OQ-18 DECIDED (2026-10-20, owner confirmed the recommended defaults) and the owner scope decisions of 2026-10-20 applied (00 §6). Owner decisions of 2026-10-22: D18 (lean target), D19 (scope rule), D20 (no CI), applied to the plan (00 §4b; 01 §10, 20 §Deploy-time items, 42 §10, 50 §4.0, 55 §0). **Phase 2: DONE in lean mode, with open items** (2026-10-27, [records/phase-2.md](records/phase-2.md)): one local full-suite run on `26a4c03` green in every job (Jest 1097/1097, static 91/91, chromium + wire 945/945, visual 386/386, T-802 73/73, ops 18 + 9); breakage catalogue 74/74 valid patches killed; steps 2.0 and 2.6 WITHDRAWN (D19, D20); nothing pushed or deployed. The record's open items are owner decisions or known limits; none blocks jump 1.

**Version track, jump 1 (tooling, leaf libraries, design copy): Jump 1 DONE** (2026-10-28, [records/jump-1.md](records/jump-1.md)). W0, W0b, W0.5, W1, W2a–W2e, W3 and W5 are merged on the local branch `upgrade/jump1-tooling-leaf-design`. So are the fixes of two reviews (T-733, T-738, T-804, T-806 written), the owner's decisions of 2026-10-28 (katex held at 0.16.22, core-js held at 3.46.0, `@sentry/*` compiled for the client by CS-SEN-4) and the signed rows AD-010..AD-049. The jump check (`bash scripts/ci-local.sh` on `87a39d4`, twice) gave 2,710 passed, 1 failed, 28 did not run each time (the 28 `@wire` tests passed separately): lint, unit, image and ops green, e2e red on exactly T-610 c3. That test saw two minified mobx 6.16.1 frame names in a server stack (the same methods under new names; deterministic, not a regression). The owner signed AD-048/AD-049 on 2026-10-28 ("I sign AD-048 and AD-049 as proposed (T-610 c3: the mobx 6.16.1 minified frame names i.It -> i.Kt and i.O -> i.g)."). They are applied, and T-610 c3 and the 28 `@wire` tests are green on the same build, so the gate of ci-local reads green with no runtime change. A third full ci-local on `855c09b` (the close review, `$ARTIFACT_DIR/ci-local/20261028T180016Z.json`) was green in every job: 2,739 passed, 0 failed. The close-review fixes and the polish after it change test tooling, three test titles and docs only (build key `e343464ce23af57f` unchanged). On 2026-10-28 the owner settled the five owner decisions after jump 1, option (a) each (`records/jump-1.md`, section 11, which quotes the full message exactly; the date corrected on 2026-10-29: first recorded as 2026-10-29 by mistake; the owner confirmed the corrected date on 2026-10-29). Owner's words: "I accept option (a) for all five decisions" … "(4) reword the T-904 c3 checklist" (the app cut the message at 300 characters after "(4) reword the T-904 c3 checklist"; its first sentence accepts option (a) for all five decisions, decision 5 included). The decisions: AD-052/AD-053 (first AD-050/AD-051, withdrawn for their date) record AD-035's change for T-727 and T-730, the W1 T-001 lint baseline is the tool link B1-local of the baseline chain (STATUS §1), the 42 §8 key-rule extensions are signed as one acceptance change (their C1 re-run is due at the midpoint heavy check), the T-904 c3 checklist text is reworded, and `records/phase-2.md`, `records/W5.md` and `records/jump-1.md` are signed; no runtime change. Nothing pushed or deployed; `git diff f5cfc20 -- .github kube Dockerfile .dockerignore` is empty.

**Version track, jump 2 (webpack 5, Next 12.1.6 then 12.3.7, runtime Node 24): Jump 2 DONE** (2026-10-31, [records/jump-2.md](records/jump-2.md)). W4a, W4b, W4c, W4c.2, W4d (with the app-side `_next/data` rule CS-N12-9, so the gateway rule CS-OPS-1 is not needed on 12.3.7) and W4e are merged on the local branch `upgrade/jump2-webpack5-next12-node24`, from the jump-1 tip. So are the fixes of three reviews (two regressions of 12.3.7 fixed in `pages/_app.jsx`: CS-N12-12 keeps the S-4 page visible after hydration, CS-N12-13 stops the browser's API calls on SSR 500 pages; CS-N12-11 kept the page title at W4d), and the owner's decisions of 2026-10-29 (the go-ahead; the throttle; OD-37 A with `cssnano-simple` 2.0.0, so T-801 stays 0 px; the 12.1/12.3 pin sets; three acceptance changes). On 2026-10-30 the owner signed jump 2 batch round 1 ("I sign jump 2 batch round 1 (.p2-work/jump2/owner-batch.md, after the pre-sign check) with every recommendation: D1 a, D2 b, D3 a, D4 a, D5 c, D6 as recommended, D7 a and c, D8 a, D9 a, D10 a, D11 a, D12 all four, D14 a, D15 a."): 81 rows AD-054..AD-140 filed, AD-010/AD-011 withdrawn, and batch decisions 1..15 applied, among them the new route announcer test T-743, `experimental.largePageDataBytes: 0` (CS-N12-14, so users' query strings stay out of the server log) and five B2-local re-captures. The jump check (`bash scripts/ci-local.sh` once on `d344247`, `$ARTIFACT_DIR/ci-local/20261030T085301Z.json`) gave 2,714 passed, 8 failed, 28 did not run (the 28 `@wire` tests apart: 27 passed, 1 failed): 9 reds, all expected, no regression (the runtime end-state review re-ran each once with the same text). On 2026-10-30 the owner signed jump 2 batch round 2 ("I sign jump 2 batch round 2 (.p2-work/jump2/owner-batch-2.md, after the pre-sign check) with every recommendation: confirm C1..C6, R2-1 a, R2-2 a, R2-3 a, R2-4 a, R2-5 b, R2-6 a, R2-7 a, R2-8 a.") and on 2026-10-31 round 3 ("I sign jump 2 batch round 3 (.p2-work/jump2/owner-batch-3.md, after the pre-sign check) with R3-1 a, including AD-151, the lean form of the re-measurement and the record text of section (d) step 3."); both are applied, and they sign the record (its Sign-offs line lists what was written after them). The ledger has 141 rows, 127 in force (AD-152 of round 4, below, among them). Eight of the 9 reds are green on the same build in the runs of their steps (T-743 c1..c4: AD-144..AD-147, the announcer reads the title before the h1 on 12.3.7; T-606 c1 and T-610 c3: AD-148, Next's experimental-feature notice, and the T-610 census re-capture; T-611 c1: the B0 re-baseline, AD-143's gzip read as build-bound; T-607 c2: the wire capture now waits for a quiet stub, which fixes its determinism bug, then the re-capture); T-104 c2 turns green with the final deploy (the Node base image, batch decision 5 (c)). Two more framework changes are pinned at new T-612 c2 entries (AD-149, the image endpoint's answer to a local SVG; AD-150, the body of Next's trailing-slash 308). T-611 c2's peak RSS on Node 24, red in 7 of 32 sweeps run alone, is settled by AD-151 (B0 650 -> 785 MiB, limit 863.5 MiB); the check against the 768Mi pod limit stays a deploy-time item (20 §Deploy-time items). The final one-call run of the close (`bash scripts/ci-local.sh` once on `2295b72`, `$ARTIFACT_DIR/ci-local/20261031T000408Z.json`) gave 2,749 passed, 1 failed, 0 did not run, the 28 `@wire` tests in the one call: the one red is T-104 c2, which keeps the unit and gate jobs red until the final deploy, and T-014 (a) is green (it goes red only on a server module-id swap of the twin). The close run's three end-state reviews then found T-611 c2 red by its heapTotal in 3 of 35 sweeps alone on the same build (198.1 MiB against the old limit 198; green in that run): the owner settled that on 2026-10-31 in round 4 ("Sign R4-1 (a), R4-2 (a)"; AD-152, B0 180 -> 199 MiB, limit 218.9 MiB; section 14, item 11), and their other findings are settled ([records/jump-2.md](records/jump-2.md), section 4). The final run of round 4 (`bash scripts/ci-local.sh` once on `40bed4c`, `$ARTIFACT_DIR/ci-local/20261031T085613Z.json`; [records/jump-2.md](records/jump-2.md), section 1.2) gave the same count, 2,749 passed, 1 failed, 0 did not run, the 28 `@wire` tests in the one call: the one red is T-104 c2, which keeps the unit and gate jobs red until the final deploy; T-014 (a) is green, and T-611 c2 is green (heapTotal 196.06 MiB, limit 218.9), so nothing is pending on it before jump 3 (its C1 re-run stays at the midpoint heavy check, section 13). Nothing pushed or deployed; `git diff f5cfc20 -- .github kube Dockerfile .dockerignore` is empty.

**Version track, jump 3 (React 18.3.1, Next 13.5, Next 14.2): in progress; W5.5 DONE on Chromium** (2026-11-03, [records/W5.5.md](records/W5.5.md)); **W6a landing** (2026-11-04, [records/W6a.md](records/W6a.md)). The owner's go-ahead came on 2026-10-31 ("Start jump 3"); the branch `upgrade/jump3-react18-next14` starts from the jump-2 tip. A React 18.3.1 spike on Next 12.3.7 (`upgrade/w55-spike`, never merged) proved all six ESCALATES candidates of 30 §E (Q-052 in `next dev` only), found a second nested-anchor site (the dropdown content of a work's Available Versions) and a React 18 regression of the navigation crash recovery (a header search from a work or output page ends on a blank page), and rejected Q-008 in production (it stays PRESERVE); VF-23 is settled on Chromium, WebKit and Firefox are DEFERRED. On 2026-11-01 the owner signed the batch W5.5 ("Sign W55-A to L (a)"): eight fixes on React 17 at the rows CS-R18-2, -3, -4, -7 and CS-ESC-1..4, the hooks' flag set once at the app root (W55-K), the repaired sidebar reading one CSS module (W55-L), the rows AD-153..AD-162 and the re-baselines of link B3-local. They are merged; with all eight on the spike (`upgrade/w55-spike-fixed`, never merged) React 18 shows 0 hydration events in 630 loads, and the settled DOM, API calls and Sentry equal React 17's on 630 of 630. A visitor with JavaScript on sees the same pages as today (T-801 0 px), and work and output pages no longer paint a squeezed sidebar before they finish loading; on output pages the report card and licence still change look at hydration, a smaller jump than today; with JavaScript off the server's plain sidebar shows (the four T-801 PNGs of AD-159..AD-162). On the tip (`c87e87f`, React 17.0.2, build `1cdbab06d8637b8c`) chromium + wire 994 of 994, visual 392 of 392, T-802 73 of 73, Jest unit 1,104 of 1,105 (T-104 c2, until the final deploy) and static 93 of 94 (T-014 (a), no twin build in that run). The ledger has 151 rows, 137 in force. By the owner's reading W55-J (a), what stays red on the spike is W6a's work, none of it accepted ([records/W5.5.md](records/W5.5.md), section 4.2). W6a (React 18.3.1 on Next 12.3.7, React Testing Library 16.3.3) is on `upgrade/jump3-react18-next14--w6a`, 13 commits over the jump tip, unmerged. On 2026-11-03 the owner signed the batch W6a ("Sign all (a)"): the React 18 pin sets (the tuple set on Chromium is empty; WebKit and Firefox DEFERRED), the Jest allow-list, five test tool changes, the settle fix of the T-728 tile-fade flake, and two app changes that keep today's behaviour on React 18: the first-visit cookie popup renders in the hydration frame (CS-R18-3), and a second claim submit with the same e-mail asks `/account` no more often than today (CS-R18-8). On 2026-11-04 the owner signed the second round, the W6a rows ("Sign all (a)"): AD-163..AD-173 and the declared rows of link B4-local. One of them is a difference a visitor can meet, accepted as a React 18 fact: on a data provider page, after a query is typed into the outputs search, a double click on the field's floating Search label no longer runs the search, which runs once the visitor clicks back into the field and leaves it, or presses Enter in it. A keyboard visitor now gets the focus back on the Report button after closing the Report form or its success message; the HTML is streamed (no ETag and no 304 for a client that revalidates by itself; browsers never do, the pages are `no-store`), and every page is 18 bytes smaller. The settled pages equal today's: on the W6a tip T-701 shows 0 hydration events in 270 tests and `visual` passes 392 of 392 (T-801 0 px). There the reds were exactly the tests of the W6a rows, T-013 c1..c3 until the merge, T-104 c2 and T-014 (a), and every value of the rows held on the same build before the merge. The merge, the rows, link B4-local and the run on the jump tip follow; W6a is DONE when that run is green except T-104 c2 and T-014 (a). Nothing pushed or deployed; `git diff f5cfc20 -- .github kube Dockerfile .dockerignore` is empty.

**Owner decisions:** see 00 and 90; STATUS §2 *Confirmed*. **Still pending:** Phase 1b approval (the docs PR); D17 and the OPEN ODs; the owner closing #389 and #410 (OQ-18). Every push, PR, tag on origin and the deploy are the owner's (D20).

**Next actions, in order:**
1. **Version track, jump 3, W6a's landing:** the merge of `upgrade/jump3-react18-next14--w6a` into `upgrade/jump3-react18-next14`, the repository's `node_modules` brought in sync once, the rows AD-163..AD-173, link B4-local and the run on the jump tip (`.p2-work/jump3/owner-batch-w6a-rows.md`, section (d) steps 3 to 8; [records/W6a.md](records/W6a.md), section 10); the SHA-256 sets of B4-local then go to the owner in the next round. Then W6c (Next 13.5.11) in its own run from a green tip, W6d, and the jump check with the heavy checks of the midpoint (the C1 re-runs and fault-patch refresh of [records/jump-2.md](records/jump-2.md), section 13, [records/W5.5.md](records/W5.5.md), section 9, and [records/W6a.md](records/W6a.md), section 9).
2. **Later, by the owner:** pushing the local branches (after the wording-rule history check), the docs PR (action 1(f) of the first plan: `git rebase --onto origin/main f5cfc20 docs/upgrade-plan`, push, `gh pr create --base main`), and after GATE-S the single deploy with the deploy-time items (20 §Deploy-time items; needed so far: the Node base image on Node 24, which also turns T-104 c2 green, and the design install flag `--install-links`; to check with it: the memory limit on Node 24, with the 69-request sweep repeated on the first image, `--include=dev` kept for `cssnano-simple`, the loader's request headers), the deferred prod-only checks ([records/jump-2.md](records/jump-2.md), section 12), the 48 h watch and the smoke check (55 §0).

## 9. Work-session protocol

0. **Lean mode (D18–D20):** during the version track the protocol is [01](01-playbook.md) §10 (local branches, lean builds, disk budget, pacing); items 1–4 below apply to the owner's final deploy.
1. **Start:** README → STATUS → the step's docs (§5); `nvm use 24`; `git fetch origin && git log --first-parent --format='%h %s' <head>..origin/main` (`<head>` = SHA in the last STATUS §6 row); classify each commit per 01 §2 (track merge, docs/test merge, data refresh, infra change, product change).
2. Branch from `origin/main` (01 §2); never commit or push to `main` (`stage`: as today, optional, 01 §4).
3. **Work:** one PR per CS group, one bump per commit, IDs in titles `[<step>][<CS-ID>]` (01 §3); run the 01 §4 runbook; stop per 01 §8.
4. **End:** update §8 and STATUS (ledger, VF register, log row with the `origin/main` SHA) in a `docs/status-<date>` PR (01 §9); `node tools/check-docs.mjs docs/upgrade --repo .` reports ERROR 0. Full rules: [01](01-playbook.md).
