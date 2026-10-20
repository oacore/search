# 00 — Verified findings (consolidated input for rewriting `docs/upgrade/`)

Date: 2026-10-19. Consolidator over 15 adversarial review dimensions (409 findings, each with a verdict).
Full reports and verdict logs: `findings/review-2026-10-19/<dim>.md` and `<dim>.verdicts.md`. Raw experiment evidence: `<scratch>/exp/<dim>/`. The `versions` reviewer could not write its report. Its 116-row matrix and raw evidence are under `<scratch>/exp/versions/`: `registry.json`, `audit/`, `nextmatrix/`, `jestlab*/`, `eslint10lab/`, `final*/`, `waves/`.

**How to read an entry.** `### X<doc>.<n>` = one consolidated finding.
- `Sources` lists every original ID merged into the entry.
- Verdict codes:
  - `C` = confirmed.
  - `P` = partially. The corrected statement is the one written here.
  - `V+` = added by a verifier.
  - `U` = unverified. No adversarial pass ran (all docs-quality `DQ-*` and empirical `EM-*`). Each `U` entry names the confirmed findings that corroborate it.
  - `?` = unverifiable. Marked [VERIFY] with what settles it.
- Severity is the highest surviving severity among the merged sources, after any verifier downgrade.
- `M#` means an owner requirement, M1–M9.
- `Change` gives the exact edit to make in the target doc. Secondary docs that need the same fact are named.

Subject repo baseline: `origin/main@cc0e228` (tree `a825839`), identical to local `f5cfc20`. Paths: search (this repo, repo root), dashboard `../dashboard`, design `../design` (git `bbc35a0`), core-ui `../core-ui`, org guide `../core-fe-architecture/index.html`.

---

## 0. Counts

- **409 findings** from 15 dimensions: versions 33, nextjs-early 26, nextjs-late 24, react-mobx 23, design-system 19, business-logic 31, ui-flows 26, tooling-ci-deploy 34, test-strategy 32, dashboard-target 33, roadmap-process 35, risk-hunter 17, http-contract 26, docs-quality 28, empirical 22.
- **Verdicts:** 254 confirmed, 93 partially, 9 verifier-added, 50 unverified (DQ 28, EM 22), 1 unverifiable (DT-29), 2 refuted (nextjs-late-02, nextjs-late-17; see Appendix A).
- **Severity:** 22 critical, 135 high, 182 medium, 70 low.
- **After dedup:** 223 consolidated entry headings, of which about 25 are short cross-reference stubs that point to the entry holding the fact (kept so every target doc sees its items). Every one of the 409 source IDs is placed (Appendix B). The critical/high items that survive verification are listed in §7.

| Target | Entries | Target | Entries |
|---|---|---|---|
| README | 7 | 50-roadmap | 15 |
| 00-decisions | 8 | 55-gates (NEW) | 5 |
| 01-playbook (NEW) | 5 | 60-design-ownership | 18 |
| 02-version-matrix (NEW) | 21 | 70-phase6 (NEW) | 15 |
| 10-risk-register | 27 | 80-phase7-antd (NEW) | 8 |
| 20-change-sites | 24 | 90-open-decisions | 3 |
| 30-quirks-register | 25 | findings/ERRATA (NEW) | 1 |
| 40/41/42 tests | 40 | 45-confidence (NEW) | 1 |

### Cross-cutting themes

1. **The deploy pipeline defeats the wave procedure.** Several facts combine:
   - The stage cron deploys `main` every night.
   - Every push to `main` deploys prod.
   - Prod can be dispatched from any branch.
   - Tags are mutable, and a same-SHA nightly rebuild never rolls out.
   - There is no canary and no rollback by digest.
2. **Silent prod regressions have no CS or R row.**
   - The `/search/_next/data` rewrite returns 404 on Next 12.2+ and returns HTML on 15/16 (blank page).
   - A multi-child `<title>` gets a literal `<!-- -->` on 13+ with React 18, and is empty on 15/16 with React 19.
   - With webpack 5 the server runs `@sentry/browser`.
   - The CSS minifier output drifts from Next 11.
   - Header drift.
   - The head-manager changes at 15.
   - LogRocket 12 needs a new CSP host.
   - axios behaviour differs.
   - zustand 5 SSR uses the initial-state snapshot.
3. **W4 cannot execute as written.**
   - Next 11.1.4 cannot build the real app.
   - The OpenSSL flag is needed until Next 12.
   - Next 11 and later lint during `next build`.
   - `future.webpack5` is rejected by Next 11.
   - A verified sequence exists: 10.2.3+wp5 → 12.1.6 → 12.3.7 → Node 24.
4. **The baseline is buggier than the docs say.**
   - SSR 500s: works 410, empty `publishedDate` with a numeric year, `dataProviders: []`.
   - Blank pages after hydration.
   - The SEO head is corrupted after hydration.
   - Nested `<a>` elements.
   - Executing JSON-LD XSS.
   - Wrong consent-cookie key.
   - The GA `search` hit is a no-op.
5. **The test harness fails on its own baseline, or is blind to what matters.**
   - The msw and jest-dom ranges fail.
   - Tests placed under `pages/` break the build.
   - `.gitignore` swallows test directories.
   - `build:test` is not the shipped image.
   - MSW is not wire-level.
   - React 17 production hydration is silent.
   - T-708 is red on the baseline.
   - GA collect assertions cannot fire because GA is blocked.
6. **M5 and M7 are not measurable.** There is no pre-antd gate and no confidence model.
7. **M1 gaps.**
   - About 20 targets are below latest with no step that closes the gap.
   - ESLint 9 is EOL.
   - Node 22 is in maintenance.
   - TypeScript 7 has no compiler API.
   - The Node used for tooling and the Node used at runtime are conflated.
8. **M4 gaps.**
   - There is no ownership end state.
   - Vendoring is not "identical by construction": Babel re-transpiles the code, `.gitignore` swallows `bin/build`, and the sprite output depends on `NODE_ENV`.
9. **M6 gaps.** Phases 6 and 7 are only outlines. Dashboard conventions do not transfer to Next SSR:
   - global CSS;
   - zustand SSR;
   - the axios adapter;
   - SWR fallback;
   - antd SSR styles;
   - TypeScript config.
10. **M8 gaps.**
    - There is no status home.
    - IDs collide.
    - Mappings are duplicated and disagree.
    - The baseline SHA is local-only.
    - Paths are wrong.

---

## 1. Findings by target doc

### README.md

### XRD.1 — Repos/paths table; the home-directory mount paths do not exist
low · C/U · Sources: RP-33(C), DQ-22(U)
- **Fact:** README:12 and 60:10 cite the dashboard and design repos through home-directory mount paths (`mnt/dashboard`, `mnt/design`), and the findings cite a home-directory `mnt` path. None of these exist. The org guide is never referenced.
- **Evidence:** listing the home-directory `mnt` directory → no such file.
- **Change:** add a "Repos" table with the absolute paths in the header above, including `@dashboard/` (dashboard-next scaffold, core-ui copy). State that the org guide prescribes a client-first React Router SPA, and that its routing, React Hook Form usage and `stores/` layout are not adopted (see X70.12).

### XRD.2 — Baseline commit is local-only; default branch is `main`; stale `origin/HEAD`
high · C · Sources: RP-23, TCD-30, TCD-11(part), RH-05(part), DQ-07(U)
- **Fact:** No remote branch contains `f5cfc20`. Its tree equals that of `origin/main` `cc0e228` (`a825839`).
  - Local `main` is 27 tree-identical merge commits ahead, and the docs branch is 28 ahead.
  - Remote HEAD is `main`. Local `refs/remotes/origin/HEAD` points to `master`, which is stale. `master` and `main.old` are legacy.
  - Stale PRs: #389 (master, Node 24/React 19) and #410 (main.old, Next 15.5.14).
- **Evidence:** `git branch -r --contains f5cfc20` → empty; `git rev-list --left-right --count main...origin/main` = `27 0`; `git ls-remote --symref origin HEAD` → main.
- **Change:**
  - Cite the baseline as "origin/main@cc0e228 (tree a825839)". PR base = `main`.
  - Run `git remote set-head origin --auto`.
  - Rebase the docs branch with `--onto origin/main f5cfc20`, and tag the baseline on origin.
  - The playbook verifies the tree hash at the start of every session.
  - The owner closes #389 and #410 with a link to the plan.

### XRD.3 — README §3 version table shows open choices and below-latest numbers as targets
high · C/P/U · Sources: VER-22, VER-29, RP-09(P), HC-25, DQ-04(U), DQ-17(U)
- **Fact:** These "Target" cells depend on OPEN decisions: Node 22 (OD-05), ESLint 9 (OD-15), Sentry 7.119.1 (OD-14), i18n 6.8 (OD-27), CSS unchanged (OD-16).
  - "Dashboard versions" are behind the registry: antd ^6.3.1 vs 6.6.6, axios ^1.13.6 vs 1.20.0, swr ^2.4.1 vs 2.5.1, zustand ^5.0.11 vs 5.0.15, @sentry/react ^10.49 vs 11.8.0, typescript ~5.9.3 vs 7.0.2/6.0.3, lint-staged ^16.3.1 vs 17.6.0, icons ^5.5.1 vs 6.3.4.
  - Registry "latest" moves within days. On 2026-10-15..19 these were published: core-js 3.51.0, next 16.4.2, @sentry 11.8.0, eslint 10.13.0, postcss 8.5.31.
- **Evidence:** `dashboard/package.json` vs `npm view` on 2026-10-19; versions verdicts.
- **Change:** replace §3 with a pointer to NEW `02-version-matrix.md`, and add one rule: "the dashboard defines library choice, not versions; each wave pins the registry latest on the wave date". Any cell that depends on an OD carries that OD's ID and the word "proposed".

### XRD.4 — README §8 checklist: about 40 items are already answered
medium · C/P/U · Sources: VER-28(P), UI-15, BL-31, BL-08, NE-21, nextjs-late-20, HC-06, RM-23, EM-21(U)
- **Fact:** see §2, "Resolved [VERIFY] items". §8 currently tells the next session to redo them.
- **Change:** split §8 into two parts:
  - (a) an ordered next-session runbook, which moves to `01-playbook.md`;
  - (b) a VF-## register in `STATUS.md` holding only the items that are still open (§3 of this file).

### XRD.5 — Entry doc is too big and mixes stable orientation with mutable state
medium · U · Sources: DQ-14, DQ-27 (corroborated by RP-18, RP-22)
- **Fact:** README is 19.7 KB and holds errata (3.5 KB), a 27-item checklist (3.2 KB), a log and a version table. A fresh session must read about 200 KB.
- **Change:** cap README at 8 KB. It keeps:
  - what and why;
  - the rules in 10 lines;
  - the doc map;
  - a reading order per task (orient; do wave N; write tests; triage);
  - the ID table;
  - the glossary;
  - the repos table.

  Move the errata to `findings/ERRATA.md`, status to `STATUS.md`, and versions to `02`.

### XRD.6 — ID collisions and undefined jargon
medium · U · Sources: DQ-11, DQ-23 (corroborated by DQ-12 W9)
- **Fact:** these IDs collide:
  - D1–D5 decisions vs D0–D6 design-vendoring steps (README:182 "60 D1, D5");
  - W0–W8 in findings/01 §7.2, which have different meanings;
  - gate S vs S-1..8 security notes vs G1–G7 CI gates;
  - O1–O14 and U1–U4, which are missing from the ID table.

  Undefined terms: gSSP (13 uses), gIP, formap, ICU, MSW, AKS, soak, canary, stage branch, ETag.
- **Change:** rename as follows:
  - design steps → `DV0–DV6`;
  - findings waves → `FW0–FW8` (add a banner in findings/01);
  - gates → `GATE-S` / `GATE-A` / `GATE-F` (see X55);
  - CI gates → `CI-1..CI-8`;
  - `O#` → `OC-#`;
  - `U#` → `Q-048.U#`.

  Add every prefix to the ID table. Add about 15 glossary entries: gSSP, gIP, formap, MSW, ICU, AKS, stage/main, soak, canary, golden image, VF, DoD, GATE-*, seeded fault, differential corpus.

### XRD.7 — Key numbers and top-risk text to correct
medium · C/U · Sources: nextjs-late-04, VER-14, DQ-13(U), NE-02
- **Fact:**
  - The CSS camelCase hack **throws** on Next 13+ (`reg.test is not a function`) and fails the build. It is not a silent no-op.
  - bibtex-parse-js accounts for 450 lock entries, not 557.
  - 66 files import `*.module.css`, not 59 (`git grep -lE "^import .*\.module\.css" -- '*.jsx'`).
  - Next 11.1.4 cannot build the real app.
- **Change:** update README "key numbers" and "top risks".

---

### 00-decisions.md (owner-only edits; proposed text from RP §9)

### X00.1 — Add D6 "Latest versions (M1)" plus an exceptions ledger
high · C/P/U · Sources: RP-26, RP-09(P), VER-29, DQ-04(U), DQ-17(U)
- **Proposed text:** "At every gate (S, A, F), every dependency is at the latest stable registry version on the gate date, except entries in the M1 exceptions ledger (02). Each exception gives the blocker with evidence and the step that reaches latest. Versions are re-checked with `npm view` at the start of every wave and pinned exactly."

### X00.2 — Extend D1/D1a to phases 6–7 and rewrite the phase list
medium · C · Sources: RP-26, DT-21, TCD-32
- **Fact:** 00 lists phase 6 as "axios, swr, zustand, react-router where applicable". react-router is not in M6. TypeScript, pure CSS, ESLint, Prettier and Husky are missing.
- **Proposed text:**
  - "D1/D1a apply unchanged to phases 6 and 7: logic and behaviour identical, no improvements; only the implementation changes."
  - Phase 6 = TypeScript (see 02), axios, swr, zustand, ESLint 10 + typescript-eslint, Prettier, husky + lint-staged, pure CSS (OD-33), Sentry latest.
  - react-router and Vite: N/A. SSR, SEO and status codes require Next (R-005, OD-02).
  - Phase 7 = antd, plus ownership of the units antd does not replace.

### X00.3 — Add D4b (ownership end state, M4) and D4c (design freeze)
high · C/P/U · Sources: RP-12, DS-05(P), RP-04, VER-16, DQ-05(U)
- **D4b:** "At GATE-F there is no `@oacore/design` and no compiled vendor code. Every used design component, utility, icon, asset and global CSS rule is either an antd component restyled to match exactly (D5), or readable source owned by search."
- **D4c:** "From phase 2, design stays at 5.0.74 (exact pin, then the vendored tarball). Header and footer content changes are made in search under the change-control protocol."

### X00.4 — Add D7 "Gates (M5)"
critical · C/U · Sources: RP-05, DQ-01(U)
- **Fact:** gate S sits before phase 6. The phase-7 precondition is only "Phase 6 done", and phase 6 replaces the HTTP layer, the state layer, the language and possibly the compiler.
- **Evidence:** 50-roadmap.md:88, :96-97; grep "pre-antd" → 0 hits.
- **Proposed text:** "Three gates, GATE-S (end of version track), GATE-A (pre-antd, after phase 6) and GATE-F (end of phase 7), with the binary criteria in 55. No antd work starts before GATE-A is signed by Owner and Ops."

### X00.5 — Add D8 "Confidence (M7)"
high · C/P/U · Sources: RP-06, TS-01(P), test-strategy-V2, RM-13(P), DQ-02(U)
- **Proposed text:** "≥95% confidence = the conjunction of the measures in 45 (detector efficacy, structural coverage, differential parity with its stated detection power, reliability, production non-inferiority at 95%), all passing at each gate."

### X00.6 — Add a change-control and re-baseline rule (OD-31)
critical · C · Sources: RP-04
- **Fact:**
  - `origin/main` has 32 commits since 2026-07-01, from 7 author strings (6 people).
  - design shipped 5.0.70–5.0.74 on 2026-09-10/11, and search adopted them (#449, #451).
  - 40 §6 says baselines are never re-captured, so any product PR turns T-801, T-6xx and T-7xx red, with no legal path forward.
- **Evidence:** `git log origin/main --since=2026-07-01 --oneline | wc -l` = 32; design `git log bbc35a0..3a0fb9d`.
- **Proposed text:** choose (A) or (B).
  - (A) Freeze `main` for product changes until GATE-S.
  - (B) Re-baseline protocol:
    - the product PR lands alone;
    - before and after captures are taken on the current stack;
    - the diff is limited to declared regions;
    - a row is added to the accepted-diff ledger;
    - the owner signs off.

### X00.7 — Security exception for S-4: owner decision needed
critical · C/U · Sources: HC-09 (violates M3 if shipped silently), UI-17, EM-01(U)
- **Fact:** JSON-LD breakout is a stored XSS that **executes today** (see X30.1). D1a covers only bugs that become severe *after* an upgrade, so fixing this is outside D1/D1a.
- **Change:** add a decision slot: "Security fixes that do not change visible behaviour (escaping `<` as `<` in JSON-LD) may be made as separate, owner-approved PRs outside the upgrade track." The owner decides (OQ-1).

### X00.8 — Docs rule (M8)
low · C/U · Sources: RP-26, DQ-09(U)
- **Proposed text:** "STATUS.md is the only mutable file. README holds no status. Every [VERIFY] item has a VF-## ID, an owner and a status."

---

### NEW 01-playbook.md

### X01.1 — There is no session playbook
high · U/C · Sources: DQ-08(U), DQ-16(U), DQ-26(U), RP-18(C)
- **Fact:** only one branch name exists in the docs (README:202). The docs have none of the following:
  - a PR template or commit rules;
  - a Definition of Done;
  - the stage/prod mechanics;
  - real rollback commands;
  - prerequisites;
  - a repo-root pointer file to the upgrade docs.
- **Prerequisites the playbook must state:**
  - `NPM_TOKEN` for GitHub Packages;
  - `API_KEY`;
  - a running Docker daemon;
  - two Node versions: the runtime Node, 18 until W4(e), and the tooling Node, 24;
  - Playwright needs Node ≥20.
- **Change:** create `01-playbook.md` from the DQ §11 outline:
  - session start and end checklists;
  - branches: base `origin/main`; `upgrade/p2-<topic>`, `upgrade/<step>-<slug>`, `upgrade/esc-q0xx`;
  - PR, commit and DoD rules;
  - how to run each tier;
  - real names: namespaces `core-frontend` and `core-frontend-stage`, deployment `core-frontend-search`;
  - stop conditions;
  - a repo-root pointer stub: "read docs/upgrade/README.md and STATUS.md first".

### X01.2 — Corrected per-step runbook (replaces 50 §4 "every wave has the same shape")
critical · C/P · Sources: RP-02(P), RP-01, RP-03, RP-16, TCD-01, TCD-02, RH-05 (runbook text: roadmap-process.md §4)
- **Fact:** if CS PRs merge to `main`, every merge is a prod deploy before any soak happens (`aks_deploy.yml:3-6`, push main). The plan never says where CS PRs merge, or how a wave reaches stage.
  - The stage workflow accepts `workflow_dispatch` for any ref. The protection rules of the `azure` environment are UNCONFIRMED.
- **Change:** adopt this runbook for every deployable step (each lettered step of W0…W8, and each phase-6/7 sub-wave):
  1. Create an integration branch `upgrade/<S>-<slug>` from `origin/main`.
  2. Each CS-group PR targets that branch. One bump per commit. ESCALATES fixes go in their own PRs.
  3. Require 3 consecutive green CI runs on the branch head.
  4. Open the PR to `main`, but do not merge it.
  5. Deploy to stage, either by merging `--no-ff` into `stage` or by dispatching (OD-29 decides; a protected stage branch makes reset/force-push an approval step). Record the digest.
  6. Soak for 24 h (X40.17). Verify the digest at the start and the end of the soak.
  7. Do the T-904 items that apply to this step.
  8. Merge to `main` with a merge commit (no squash). Prod deploys. Record the digest.
  9. Watch prod for 48 h against the thresholds in 45 C6.
  10. Re-align `stage` with `main`.
  11. Write `records/<S>.md`.

  **Rollback** = re-apply the previous **recorded digest**, then revert on `main`. Never rebuild for a rollback. **Never** put two steps on stage at once.

### X01.3 — Single DoD, plus per-step records and sign-offs
medium · C/U · Sources: RP-18, DQ-16(U)
- **Fact:** three different "mergeable/deployable" lists exist (40 §3.3, the 50 §4 shape, the per-wave Exit text). These exit criteria are not binary: "verified on staging", "Prod stable for 1 week", "W2, W3 green". The only sign-offs mentioned are OD-09 and D1a.
- **Change:** one DoD list. Each step gets `docs/upgrade/records/<step>.md` containing:
  - SHAs and digests;
  - 3 CI run URLs;
  - the 0-px report;
  - the network and SSR diffs;
  - the soak and prod-watch tables;
  - the T-904 evidence;
  - risk status changes;
  - sign-offs by Implementer, Reviewer, Ops and Owner.

  Use the exact wording replacements in roadmap-process.md §10.

### X01.4 — Doc change control and line anchors
low · U · Sources: DQ-24, DQ-26 (corroborated by RP-18)
- **Fact:** about 334 `path:line` citations are valid only for tree `a825839` (14/14 sampled correct). Phase 1 is marked DONE but has no exit record, even though README:151 says the docs were never independently reviewed.
- **Change:**
  - IDs are append-only.
  - The playbook says how to request a change to 00 and who may flip statuses.
  - At each wave start, re-anchor citations via `git grep` of the quoted text, and add an Anchor column to CS rows.
  - Add "Phase 1b: independent review + owner approval" with a record.

### X01.5 — Tooling Node vs runtime Node (pointer)
high · see X02.5.

---

### NEW 02-version-matrix.md (M1)

### X02.0 — Version register and re-resolution rule
high · C/P/U · Sources: VER-29, VER-22, RP-09(P), DQ-04(U)
- **Fact:** no doc states "latest". 16 targets are below the registry latest, and 11 of them have no later step. Corrected list, i.e. items with no step at all:
  - stylelint 17
  - msw 3
  - Playwright
  - i18n-iso-countries
  - react-ga4
  - the PostCSS majors
  - Babel 8
  - the vendored design deps
  - lint-staged
  - Node 26
- **Change:** create `02` with these columns: package | installed | latest@date | peers/engines | target per wave | final | blocker (evidence) | closing step | status (ACCEPTED needs an OD).
  - Seed it from `exp/versions/data/registry.json` and `waves/`.
  - Every wave starts by re-running the matrix and pinning exact versions.
  - M1 is evaluated at each gate against the registry on that date. npm 11 `min-release-age` is optional.

### X02.1 — ESLint: target 10.13.0 at W1 (ESLint 9 is EOL)
high · C · Sources: VER-01, TCD-06, TCD-15, DT-07 (conflict, see §6), RP-29, DT-24
- **Fact:** ESLint 9 has been EOL since 2026-08-06, and all 51 9.x releases are deprecated.
  - ESLint 10.13.0 (engines ^20.19 || ^22.13 || >=24) works with eslint-plugin-react 7.37.5, jsx-a11y 6.10.2, import 2.32.0 and react-hooks 7.1.1, although their peers are capped at ^9. 243 of 245 baseline rules load.
  - `react/jsx-filename-extension` crashes because it calls `context.getFilename`, which ESLint 10 removed. `import/no-cycle disableScc` is unknown. The verifier found 7 of 103 react rules and 4 of 46 import rules crash on ESLint 10.
  - `@babel/eslint-parser` 7.x crashes on ESLint 10 (`scopeManager.addGlobals is not a function`). Its 8.x needs Babel 8.
  - The typescript-eslint parser parses every app file except the 2 `templates/*/hooks/index.js` files that use `export x from`.
- **Evidence:** eslint.org/version-support; `exp/versions/eslint10lab`; `npm view eslint@9.39.5 deprecated`.
- **Change:**
  - W1 uses tooling Node 24 with eslint 10.13.0, @eslint/js 10.0.1 and globals 17.13.0, flat config.
  - Parser: typescript-eslint for JS/JSX.
  - `eslint-plugin-import-x` registered under the key `import`, so the 38 existing `eslint-disable` directives keep resolving.
  - Crashing rules are replaced or dropped, with a lint-parity note.
  - CS-BAB-3 (the 2 `export x from` rewrites) moves to W0.

### X02.2 — stylelint 17.16.0 with explicitly ported rules
high · P · Sources: TCD-07
- **Fact:** stylelint-config-standard@40 peers ^17 only.
  - 61 of the 77 baseline rules are valid on 17. They reproduce the 16 baseline findings plus 1 new one (`value-keyword-case`).
  - `property-no-unknown` must be ported by hand. It failed only because the resolved JSON serialised `/^:import/` as `{}`.
  - Adopting config-standard wholesale adds 40 findings.
- **Change:**
  - stylelint 17.16.0, stylelint-order 8.1.2, stylelint-config-css-modules 4.6.0, stylelint-prettier 5.0.3.
  - Rules are generated from `findings/baselines/stylelint-resolved-config.json`.
  - Never run `--fix`. Freeze the findings as a ratchet.

### X02.3 — Prettier, husky, lint-staged and script runner
medium · C · Sources: TCD-17, TCD-18, DT-23, DT-22, RP-29
- **Fact:** the dashboard has no Prettier. The org preset is `{trailingComma:'es5', semi:false, singleQuote:true, endOfLine:'lf', quoteProps:'consistent'}`.
  - Prettier 3.9.10 reformats 8 files, formatting only.
  - husky 9.1.7 sets `core.hooksPath`, so the old `.git/hooks` stubs become inert.
  - The dashboard hook still has the deprecated v8 shim ("WILL FAIL in v10").
  - lint-staged 17.6.0 needs Node ≥22.22.1. npm-run-all2 9.0.3 needs ^22.22.2 || ^24.15.
- **Change:**
  - Use an own `prettier.config.js` with the 5 options inlined (trailingComma explicit). This drops the private `@oacore/prettier-config`.
  - One format-only commit, listed in `.git-blame-ignore-revs`.
  - Drop eslint-plugin-prettier.
  - The hook is just `npx lint-staged`. Set `HUSKY=0` in Docker.
  - Tool versions are pinned against tooling Node 24 (X02.5).

### X02.4 — Runtime Node: 24 at W4(e), not 22; Node 26 later
high · C/P · Sources: VER-06, NE-12(P), nextjs-late-10, RP-08, HC-25 (violates M1: "keep Node 22")
- **Fact:** release status as of 2026-10-19:
  - Node 18 and 20 are EOL.
  - Node 22 has been in maintenance since 2025-10-21; EOL is 2027-04-30.
  - Node 24 is LTS until 2028-04-30.
  - Node 26 becomes LTS on 2026-10-28.

  Verified on Next:
  - 12.3.7 through 16.4.2 build and serve on Node 24.18.1.
  - 12.3.7 fails on Node 26.12.0 (`SlowBuffer` was removed).
  - node:18-alpine was last pushed 2025-03-27, so nightly rebuilds pick up no patches.

  OD-05 already lists Node 24 as option B. The gap is that no step reaches Node 26.
- **Evidence:** nodejs/Release `schedule.json`; `exp/versions/nextmatrix`; `exp/nextjs-late` builds.
- **Change:**
  - CS-N12-6, CS-NODE-1 and OD-05 target `node:24-alpine`, pinned by digest, after 12.3.7.
  - Delete option C (Node 20).
  - Add a Node 26 step after Next ≥13.5, in the L1 sweep or after GATE-S.
  - Alpine arm64 is [VERIFY] (T-901).

### X02.5 — Separate tooling Node from runtime Node
high · C/P/U · Sources: VER-07(P), TCD-08, DT-22, EM-10(U)
- **Fact:** the latest tooling needs newer Node than the app runs on:
  | Package | Node needed |
  |---|---|
  | eslint 10 | ^20.19 / ^22.13 / >=24 |
  | stylelint 17 | ≥20.19 |
  | lint-staged 17.6 | ≥22.22.1 |
  | jsdom 30, npm-run-all2 9 | ^22.22.2 / ^24.15 / ≥26 |
  | cssnano 9.9 | ^22.22.3 / ^24.15 |
  | msw 3, @axe-core/playwright 4.14 | ≥22.12 |
  | @babel/* 8 | ^22.18 / ≥24.11 |
  | Playwright | ≥20 |

  The local nvm 22.18.0 fails several of these. The newest versions that still fit Node 18: lint-staged 15.5.2, stylelint 16.26.1, jest-dom 6.9.1, @playwright/test 1.61.1. No ESLint version fits.
- **Change:**
  - In 40 §2, CS-W0-5 and the playbook: `.nvmrc` = tooling Node 24, used by CI for lint, format, hooks and Playwright.
  - Runtime Node = Dockerfile `ARG NODE_VERSION` (18 → 24).
  - Jest projects that pin ICU and build output run on the wave's runtime Node.
  - The Docker build installs devDeps on Node 18 with engine warnings only (no engine-strict).
  - Local `next dev` or `build` on Node 24 with Next 10 is [VERIFY]. Only md4 with the OpenSSL flag was proven on 24.

### X02.6 — Test tooling pins and the path to latest
high · C/P · Sources: VER-08 (violates M1), VER-09 (violates M1), TS-02, TS-11(P), BL-11, TCD-29, VER-30(P), VER-33, EM-10(U)
- **Fact:**
  - **Jest:** Jest 30.5.2 (babel-jest and jest-environment-jsdom 30) works today with React 17.0.2, RTL 12.1.5, user-event 14.6.8, jest-dom 6.9.1 and jest-fixed-jsdom 0.0.11. It passes on Node 18.20.8, 22.18 and 24.18, so Jest 29 is an unnecessary later migration.
  - **jest-dom:** 6.10.0 is deprecated ("use 6.9.1"). npm resolves `^6` to 6.9.1. 7.0.1 needs Node ≥22.
  - **msw in Jest:** msw 2.15.0 (latest 2.x) works in Jest only with a `transformIgnorePatterns` allow-list: rettime, until-async, @open-draft/deferred-promise, @inquirer/*.
  - **msw as a Node 18 `--require` preload:** `require('msw/node')` fails with ERR_REQUIRE_ESM from 2.11.3 (VER verifier). TS reported failure from 2.11.2. 2.11.1 works in every test, so 2.11.2 is [VERIFY]. msw ≥2.11 works on Node ≥20.19 via require(esm).
  - **msw 3.0.3:** ESM-only, Node ≥22.12. It fails under Jest CJS on Node 18 even with the allow-list. On Node 24 it is [VERIFY].
  - **Playwright:** @playwright/test 1.64.1 (Node ≥20), image `mcr.microsoft.com/playwright:v1.64.1-noble-arm64`. @axe-core/playwright 4.14.0 (Node ≥22.12).
  - **RTL 16:** RTL 16.3.3 peers `@testing-library/dom ^10`. 40 §2.7 never lists dom.
  - **react-hooks testing:** CS-R18-5 drops `@testing-library/react-hooks`, but 40 never installs it.
- **Change:** in 40 §2.7 and 02:
  - jest, babel-jest and jest-environment-jsdom 30.5.2;
  - jest-fixed-jsdom 0.0.11;
  - RTL 12.1.5, then 16.3.3 + dom 10.4.2 at W6;
  - user-event 14.6.8;
  - jest-dom 6.9.1, then 7.0.1 once Jest runs on Node ≥22;
  - msw 2.15.0 in Jest, with the allow-list;
  - Playwright and axe in their own `e2e/package.json`, image pinned by digest.

  M1 exceptions:
  - msw 3: blocked by Jest CJS. Closing step: re-test msw 3 under Jest 30 on Node 24 (or in Jest ESM mode) at phase 6.0.
  - The Node-18 preload is replaced by a real HTTP SSR stub (X40.6), which removes the need for a Node-18 msw pin altogether.
  - GATE-S includes a final Playwright bump and a baseline re-capture from the golden image under the harness-change protocol.

### X02.7 — Sentry: 7.120.4 at W2; @sentry/nextjs 11.8.0 as end state
medium · C/P · Sources: VER-12, DT-28(P), RH-02, RH-03
- **Fact:** 7.120.4 (2025-07-29) is the latest 7.x and fixes GHSA-593m-55hh-j8gv (<7.119.1).
  - The latest is 11.8.0 (2026-10-15). Engines: >=20.19 <22 || >=22.12 <23 || >=23.2. @sentry/nextjs peers next ^14 || ^15 || ^16.
  - The dashboard's @sentry/react is client-only, so it would drop server errors.
- **Change:**
  - W2 pins 7.120.4 exactly.
  - Add a named step after Next ≥14 and Node ≥22.12: @sentry/nextjs 11.8.0 with instrumentation files and a keep-behaviour config: `onUncaughtExceptionIntegration({exitEvenIfOtherHandlersAreRegistered:true})`, `tracePropagationTargets: []` (see X10.4 and X10.16).
  - CSP connect-src covers the ingest host (R-026). Verify with T-904.

### X02.8 — mobx 6.16.1 + mobx-react-lite 4.1.1 at W3 (not 6.15)
medium · C/P · Sources: VER-13, RM-08(P)
- **Fact:** the latest 6.x is 6.16.1 (2026-06-08). The latest overall is 7.0.6 / mlr 5.1.0 (peers mobx ^7, React 18/19).
  - mobx 7 drops legacy decorators (`store/filters.js` uses 26) and always uses Proxy.
  - mlr 4.1.1 depends on `use-sync-external-store ^1.4.0` (shim on React 17).
- **Change:** W3 = 6.16.1 / 4.1.1. Record an M1 exception: closed by removing MobX in phase 6.5.
  - Fallback if phase 6 slips: after W7, do CS-BAB-1, then mobx 7 / mlr 5.

### X02.9 — Babel 8 is unusable, so removing Babel is mandatory
high · C · Sources: VER-10 (violates M1 while Babel removal is optional), RM-09, DT-07
- **Fact:**
  - @babel/core 8.0.7 is ESM and needs Node ^22.18 || ≥24.11.
  - Next 16.4.2 compiles app code with its bundled Babel 7.2x (7.27.0 and 7.26.3 strings both reported).
  - Decorators 8 without an explicit `version` fall back to 2023-11 semantics, which breaks MobX legacy decorators and `invalidatePreviousRequests(target,key,descriptor)`.
  - preset-env 8 removes `useBuiltIns`. preset-react 8 defaults to the automatic runtime.
  - plugin-proposal-class-properties is deprecated.
- **Change:**
  - Pin @babel/* to 7.29.x and @babel/runtime to 7.29.10.
  - Make CS-BAB-1..5 plus the SWC move (W9 → phase 6.7) mandatory. This closes M1 for @babel/*, core-js and babel-plugin-add-react-displayname.
  - Record this evidence in OD-12 and 20 §Babel.

### X02.10 — TypeScript: 6.0.3 now, with a committed step to TS 7
high · C/P · Sources: VER-11, TCD-16 (violates M1 until step added), RP-10, RH-14, DT-06
- **Fact:** typescript 7.0.2 (latest, native) `exports['.']` points to `./lib/version.cjs` plus `unstable/*`. There is no classic compiler API.
  - typescript-eslint 8.71.2 and 8.72.0 peer `<6.1.0`, so strict install fails with ERESOLVE.
  - Next 16.4.2 builds with TS 7 via `experimental.useTypeScriptCli`, which defaults to true (`config-shared.js:263`). Otherwise it errors: "install TypeScript 6".
  - An alias strategy works: `typescript→@typescript/typescript6@^6.0.2` plus `@typescript/native→typescript@^7.0.2`. Then tsc 7.0.2 is used for checks and tsc6 6.0.3 for the API.
  - The docs name no TypeScript version (OD-07).
- **Change:**
  - OD-07 pins typescript 6.0.3 for the parser and API.
  - Committed closing step at phase 6.1: run `tsc` 7 in CI via the alias.
  - Switch to plain typescript 7.x once typescript-eslint's peer includes it. Re-check at phase-6 start and at each gate.

### X02.11 — react-ga4 3.0.1: move to W4(c), the first webpack-5 Next
high · P/U · Sources: VER-03(P), EM-19(U), UI-03(P)
- **Fact:** 3.0.1 is ESM-only (`type: module`, exports only `./dist/index.mjs`).
  - It does not build on Next 10.2.3 + webpack 4 ("Module not found"), nor on 10.2.3 + `future.webpack5` (Terser: class fields). It builds on Next ≥11.1.4.
  - The source diff from 2.1.0 is type annotations only. `send({hitType:'search'})` hits the same default "doesn't exist" branch in both versions.
- **Change:** remove it from W2 and from OD-27's "keep" advice. Upgrade at W4(c) (Next 12.1.6), guarded by T-305 and T-719. In Jest, use `jest.mock('react-ga4', factory)`.

### X02.12 — i18n-iso-countries: vendor the 6.8.0 data and drop the dependency
medium · C/U · Sources: VER-19, EM-11(U), RP-32
- **Fact:** 7.14.0 has no `exports` map, so the deep import still works. R-031 is wrong. 9 names change at element `[0]`:
  - CN → "People's Republic of China"
  - CG → "Republic of the Congo"
  - CD → "Democratic Republic of the Congo"
  - CI → "Cote d'Ivoire"
  - GM → "Republic of The Gambia"
  - IR → "Islamic Republic of Iran"
  - MK → "The Republic of North Macedonia"
  - TZ → "United Republic of Tanzania"
  - TR → "Türkiye"
- **Change:** recommended path: copy the 250-name `en` map from 6.8.0 into an owned data file and remove the dependency. This meets M1 by removal with 0 text change. Alternatives in OD-27 (owner): upgrade plus an override map, or accept the 9 text changes. Fix R-031.

### X02.13 — bibtex-parse-js: wrong numbers; vendor 0.0.24 verbatim
medium · C · Sources: VER-14 (violates M3 if the ORCID swap lands before T-114)
- **Fact:** the package accounts for 450 lock entries (1760 → 1310), not 557.
  - Removing it takes the audit from 146 to 94 findings and criticals from 39 to 6. The criticals come from its deps (ava, xml2js).
  - 0.0.24 is the latest release, so M1 is already met by keeping it.
  - @orcid/bibtex-parse-js 0.0.25 has no deps, but throws `TypeError` objects where 0.0.24 throws strings. `citation.jsx:67` calls `toJSON` in render with no try/catch.
- **Change:** OD-17 recommendation: vendor the 11 KB `bibtexParse.js` 0.0.24 verbatim. Behaviour stays identical and the dependency tree goes away. [VERIFY] the licence. Use the ORCID fork only after T-114 pins the thrown type and the owner accepts the change. Fix the numbers in README:48, 90:163, 20:151.

### X02.14 — PostCSS chain: make W8 mandatory
medium · C · Sources: VER-15
- **Fact:** cssnano 4.1.11 is a prod dependency. Its postcss-7 chain carries 36 moderate and 5–6 high prod advisories (removing it: 46 → 5).
  - cssnano 9.9.0 needs Node ^22.22.3 || ^24.15. postcss 8.4.14 is vulnerable (≤8.5.22); latest is 8.5.31.
  - preset-env 11.6.1 and custom-media 12.0.3 are ESM-only (Node ≥20.19). They compiled on 12.3.7.
- **Change:** W8 becomes mandatory: "upgrade or remove cssnano", decided by T-003 and T-801. Bump postcss to 8.5.31 in W2.

### X02.15 — Exact Next pins; no codemod upgrade
medium · C · Sources: VER-24, NE-23, nextjs-late-21, HC-25
- **Fact:** verified peers and engines:
  | Next | React peer | Node engines |
  |---|---|---|
  | 12.1.6 | — | — |
  | 12.3.7 | ^17.0.2 \|\| ^18 | ≥12.22 |
  | 13.5.11 | ^18.2 | ≥16.14 |
  | 14.2.35 | ^18.2 | ≥18.17 |
  | 15.5.28 | ^18.2 \|\| ^19 | ^18.18 \|\| ^19.8 \|\| ≥20 |
  | 16.4.2 | ^18.2 \|\| ^19 | ≥20.9 |

  Next 16 + React 18 builds but is deprecated; removal is planned for 17. `npx @next/codemod upgrade latest` also bumps React, which would merge W7(a) and W7(b).
- **Change:** write exact versions into CS-N11-8, N12-5, N13-6, N14-1, N15-1 and N16-5. Install with `npm i next@<v> --save-exact`, or run the codemod with `--skip-react-upgrade`. Note that these are path-only intermediates.

### X02.16 — Design-closure dependencies: M1 exceptions table (detail in X60.5)
medium · C/P · Sources: VER-20(P), DS-06, RM-16
- **Fact:** these are not drop-in upgrades:
  - **@babel/runtime 8.0.7** has no `./regenerator` export. `search-result.js:9` requires it, so the build fails.
  - **throttle-debounce 5** changes the signature to `throttle(delay, callback, opts)`. `search-bar.js:173` calls `throttle(d,false,fn)`, which would throw a TypeError when the user types in the Header search.
  - **svgo 4 and yargs 18** are ESM-only, so the sprite CLI breaks.
  - **d3-array 3 and d3-scale 4** are ESM-only.
  - **katex 0.19** renames `.sizing` to `.katex-sizing`.
  - **sanitize.css 13** diffs are UNCONFIRMED.
  - **@tippyjs/react 4.2.6** is the latest release but has been unmaintained since 2022.
  - **react-cookie** latest is 8.1.2; **react-focus-lock** is 2.13.7 (safe); **react-slick 0.31.0** peers ^19.
- **Change:** see X60.5.

### X02.17 — Add audit gate G8 (prod only)
medium · C · Sources: VER-23
- **Fact:** the final stack's prod audit is 0. The full tree has 29 findings (10 high) in dev deps, and those cannot be fixed because braces 3.0.3 and sprintf-js 1.1.3 are already the latest. Interim states fail until Next ≥15.5.24/16.3.3 and until bibtex and cssnano 4 are removed.
- **Change:** G8 = `npm audit --omit=dev --audit-level=high`. Warn-only until the Next-fix wave, blocking after that, with an allow-list for held deps (d3-color).

### X02.18 — Pre-verified versions for phases 6–7
medium · C · Sources: VER-21, DT-08, DT-17, VER-31
- **Fact:**
  - axios 1.20.0; swr 2.5.1; zustand 5.0.15 (peer react ≥18).
  - antd 6.6.6 (peer react ≥18; deps @ant-design/icons ^6.3.4 and cssinjs ^2.1.2).
  - @ant-design/static-style-extract 2.1.0.
  - The dashboard loads two icon copies, 5.6.1 and 6.1.0. antd 6 requires icons ≥6.
  - antd minors change visuals: mask blur until 6.2.x, size-enum renames in 6.3.x.
- **Change:** pin antd and @ant-design/* exactly. Re-query at phase start.

### X02.19 — logrocket 12.4.0 (requires CSP change, see X20.6)
medium · C · Sources: VER-02

### X02.20 — caniuse-lite and browserslist drift (see X10.18)
medium · P · Sources: RH-10(P), VER-17

---

### 10-risk-register.md

### X10.1 — NEW: the `_next/data` prefix rewrite breaks, and this is certain
critical · C/P/U · Sources: NE-01, nextjs-late-01, HC-01(P), HC-21, NE-20, HC-23, EM-03(U)
- **Fact:** `next.config.js:15-21` registers `/search/_next/data/* → /_next/data/*` as an afterFiles rewrite. Through a gateway replica, the result depends on the Next version:
  | Next | Result |
  |---|---|
  | 10.2.3, 11.1.4, 12.0.10, 12.1.6, 13.5.11, 14.2.35 | 200 JSON |
  | 12.2.6, 12.3.7 | 404 HTML. Every client navigation silently becomes a full reload and state is lost. |
  | 15.5.28, 16.4.2 | 200 `text/html`, detected from the original `req.url`. The client renders with `{}` props, hits a TypeError and goes blank; the next clicks fail. |

  - The getDataHref patch works on all 8 builds, so CS-N12-3's stop condition never fires.
  - A `beforeFiles` rule fixes 12.3 only.
  - A gateway `URLRewrite` fixes every version and is neutral on 10.2.3.
  - T-702 and T-604 (P0) catch it **if** they run through the proxy, so this is not silent when the gate runs. That is why HC-01 was downgraded from "OD-03 A is wrong" to "promote B".
- **Evidence:** `exp/nextjs-early/app12.2.6`, `real12` curl results; `exp/http-contract/out/n1237r17/data_prefixed.hdr` (404); `out/n1558/data_prefixed.hdr` (200 text/html); `n16.4.2 route-module.js:405-416`.
- **Change:**
  - Add a new risk: certain, SILENT on 12.2–12.3 and LOUD on 15/16.
  - Mitigation: the gateway rule (X20.1), applied as an ops pre-step before any 12.x prod deploy. Fallback: client namespace `/static/search` (`_app.jsx:96`). `beforeFiles` is rejected as insufficient.
  - Rewrite R-002's trigger and mechanism. OD-03 is needed by W4, not W6.

### X10.2 — NEW: a `<title>` with several children is corrupted in SSR
high (critical in 3 sources; downgraded because T-602 catches it once built as specified) · C · Sources: RM-01, nextjs-late-03, RH-01 (violates M3 without `?? ''`), HC-02
- **Fact:** three pages pass an array of children to `<title>`: `pages/works/[id].jsx:144`, `pages/outputs/[id].jsx:128`, `pages/data-providers/index.jsx:85`. The unused `modules/title` has the same pattern.
  | Stack | SSR `<title>` |
  |---|---|
  | Next 10 / 12 | `X - CORE` (correct) |
  | Next 13.5–16 + React 18 | `X<!-- --> - CORE` (literal text, RCDATA) |
  | Next 15/16 + React 19 | empty `<title>` |

  - Hydration repairs `document.title`, so the tab and screenshots look right. Crawlers, Scholar and unfurlers see the broken title.
  - data-providers renders clean on React 18 and empty on React 19.
  - A template literal is byte-identical on all 8 combinations. It must keep today's null/undefined output: use `` `${data.title ?? ''} - CORE` ``, because a plain `${data.title}` would print "undefined".
- **Change:**
  - New risk: H/H, SILENT, SEO.
  - CS in W0b (X20.1).
  - T-602 compares the raw `<title>` bytes from the HTTP body via a DOM parser with JS off, without stripping comments.
  - Add a Jest SSR test using `renderToReadableStream`.

### X10.3 — NEW: under webpack 5 the server runs `@sentry/browser`, so server error reports are lost
high · C · Sources: NE-04, nextjs-late-05
- **Fact:** `next.config.js:97` aliases `@sentry/node → @sentry/browser` using `config.isServer`, which is undefined.
  - On webpack 4, Next externalises `@sentry/node` before the alias applies.
  - On webpack 5 (10.2.3+flag, 11.1.4, 12.x through 16.4), the server bundles the browser SDK. Seen in real12 `.next/server/chunks/92.js` and SSR `sentry-kind` = `browser`.
  - In Node, the browser SDK delivered 0 events; `@sentry/node` delivered them.
  - The fix `isServer ? '@sentry/node' : '@sentry/browser'` is verified neutral on 10.2.3: the client chunk is unchanged and the server requires `@sentry/node` again.
- **Change:**
  - New risk.
  - R-040 "Bites in" becomes W4(b), not W2/W6.
  - Q-065 is fixed in W0b.
  - T-004 becomes P0 and asserts that the server requires `@sentry/node`.

### X10.4 — Crash semantics are wrong today and change at Sentry ≥8
high · C · Sources: RH-02, TS-21, nextjs-late-19
- **Fact:** SENTRY_DSN is passed at build time, so `Sentry.init` runs on the server.
  - `@sentry/node` 5.30 `OnUncaughtException` calls `logAndExitProcess` and exits 1 after a flush, even when the app has its own `process.on` handlers (`_app.jsx:21-27`). Reproduced.
  - 7.119 keeps `exitEvenIfOtherHandlersAreRegistered: true`.
  - 11.8 defaults it to false, so the process survives.
  - Next 13.5+/16 register their own log-only listeners.
  - Q-009, R-055 and findings/05 S2 ("never crashes") are therefore wrong. Whether the prod DSN is non-empty on AKS is UNCONFIRMED.
- **Change:**
  - Correct Q-009 and R-055.
  - New risk at Sentry ≥8, with the keep-behaviour option (X02.7).
  - New test T-608 (X40.19).
  - Allow-list Next's new log lines in the T-606/T-902 log checks.

### X10.5 — NEW: from Next 11 the CSS minifier changes the built CSS
high · C · Sources: NE-05
- **Fact:** 13 rules differ between 10.2.3 and 12.1.6/12.3.7:
  - lossy `rgba→hsla`: `.marker-cluster-small rgba(181,226,140,.6)` → `hsla(91,60%,72%,.6)`, which is `rgb(182,226,141)`;
  - alpha rounding: `.0666…` → `.067`;
  - `h2,h3` / `h4,h5` groups re-merged.

  10.2.3 with webpack 5 shows 0 diffs, so the cause is the minifier (cssnano-simple 2 → 3 → bundled). T-003(d) fails. The T-801 pixel effect is UNCONFIRMED.
- **Change:**
  - R-043 bites in W4.
  - New OD-37:
    - (A) restore the 10.2.3 output with a custom minimizer plugin on cssnano-simple 2.0.0. Feasibility is UNCONFIRMED, and it is an old pin that M1 would require removing later.
    - (B) accept the change only if T-801 shows 0 px. List the diff categories in the T-003 triage.

### X10.6 — NEW: `next build` lints on Next 11–15 and fails on today's errors
high · C/U · Sources: NE-03, nextjs-late-06, EM-04(U)
- **Fact:** Next 11–15 lint pages, components, lib and src during build (15 also reads flat config), and throw `CompileError` on errors.
  - The baseline has 7 errors: `lib/loader.js` (max-len ×2, class-methods-use-this) and `pages/search/index.jsx` (no-console ×4).
  - The image installs devDeps, so ESLint and `.eslintrc.yml` are present.
  - W1 is not a W4 prerequisite.
- **Change:**
  - New LOUD risk.
  - `eslint: { ignoreDuringBuilds: true }` in W0b. It is inert on 10.2.3 because lint there is gated behind `experimental.eslint`.
  - Remove the key at W7(c): Next 16 no longer recognises it.
  - T-001 remains the lint gate.

### X10.7 — The CSS camelCase hack **throws** on Next 13+
high · C/U · Sources: nextjs-late-04, EM-06(U), NE-15
- **Fact:** from Next 13 the first `oneOf` entry is the next/font rule, whose `test` is a string, so `reg.test(...)` throws (`next.config.js:49,57`) and the build fails.
  - The early `return config` at :55 would also skip the aliases at :86-100.
  - Through 12.3.7 both key forms are still exported (client and SSR).
  - A robust recursive patch has been verified:
    - it matches RegExp tests and patches every css-loader with `options.modules`;
    - it throws if it patches nothing;
    - CSS md5 is identical on 10.2.3 and 12.3.7;
    - classes work on 13.5–16.4.
- **Change:** fix R-001 "Shows as" (it is LOUD at 13+) and the README top-risk text. CS in W0b (X20.1).

### X10.8 — NEW: head-manager behaviour; the baseline head is already corrupted after hydration
high · C/P · Sources: UI-01, nextjs-late-07(P), nextjs-late-V1, RH-16
- **Fact:** with the real `modules/meta` and `main/head.jsx` (next-head-count 9), the Next 10.2.3 post-hydration head on works/outputs pages:
  - keeps `citation_*`;
  - reduces DC.creator from 3 to 1;
  - removes DC.title, DCTERMS.abstract, DC.issued, DC.identifier, DC.subject and the JSON-LD;
  - duplicates viewport, charset and the 5 favicon links.

  - What survives depends on the data (author and subject counts), because Next ≤14 inspects only the last next-head-count siblings.
  - 14.2 matches the baseline.
  - From 15.0, Next manages only `[data-next-head]` tags, so every Meta tag survives hydration. After client navigation they are stale, as in Next 10.
  - Googlebot renders JS, so W7(a) is a silent SEO change.
- **Change:**
  - New risk plus a Q row (X30.5).
  - Rewrite T-708 (X40.8).
  - New OD: accept the 15+ behaviour (D1a) or restructure Meta. Restructuring changes SSR order and needs proof.

### X10.9 — Interim prod stops carry open Next advisories, including a critical RCE
high · C/P · Sources: VER-05(P), NE-16(P), nextjs-late-15, HC-20
- **Fact:** GHSA-2xp9-vwfh-vxw4 (image-optimizer RCE, CVSS4 9.5) affects ≥10.0.0 <15.5.24 and 16.0.0–16.3.3.
  | Next | Next advisories (npm audit) |
  |---|---|
  | 12.3.7 | 15 (1 critical, 3 high) |
  | 14.2.35 | 23 (2 critical, 8 high) |
  | 15.5.28, 16.4.2 | 0 |

  - The interim versions also carry rewrite request smuggling (<15.5.13) and SSRF in rewrites (<15.5.21). The app uses rewrites.
  - `/static/search/_next/image/` is live through the gateway: 200 for a local SVG on the real baseline, 400 for remote URLs. There is no `images.unoptimized` in the repo.
  - sharp is not installed, so whether the RCE needs AVIF/sharp is UNCONFIRMED.
  - Today's 10.2.3 is exposed to a superset of these, so the interim versions are not a regression.
- **Change:**
  - Add a security column per prod step in 50.
  - Keep the prod dwell on 12.3.7 and 14.2.35 short. The first prod Next 15 is ≥15.5.24 (15.5.28).
  - Owner OD-41: block `/static/search/_next/image` at the gateway. It is behaviour-neutral (the app does not use next/image), but D1 needs sign-off.

### X10.10 — axios behaviour differences: extend R-016 and R-028
high · C/P/V+ · Sources: BL-05, BL-06, BL-07, BL-21, BL-08, BL-22(P), DT-04(P), DT-14(P), dashboard-target-V-02, RH-08, VER-31
- **Fact:** measured on axios 1.20.0, Node 18.20.8, 22.18 and 24.18.
  - **Host header.** The default Node http adapter sends a Host override, while undici drops it. The fetch adapter drops it.
  - **Blob responses.** `responseType:'blob'` returns a **String** in Node. `fetchCitations` then calls `blob.text()`, the TypeError is swallowed, and SSR citations become `[]` silently (`api/outputs.js:36-49`, `works/[id].jsx:100-112`). The fetch adapter returns a Blob.
  - **JSON parsing.** JSON-looking bodies are parsed regardless of Content-Type: text/json and vnd.api+json → object; no Content-Type with body `123` → number. text/csv → string. Bad JSON → string, where today it is a SyntaxError.
  - **String POST bodies.** These go out as `application/x-www-form-urlencoded`; today they are `text/plain;charset=UTF-8` (Q-019, browser-verified). This happens even with a transport-only instance (`adapter:'fetch'`, identity transforms, no default headers), unless the request sets `Content-Type:false`.
  - **Params.** Arrays serialise as `arr[]=`. undefined/null are dropped, but Q-016 needs `t=undefined`. `,()!~'*` stay literal.
  - **Other headers.** UA is `axios/1.20.0` instead of `node`. Accept-Encoding is `gzip, compress, deflate, br`. The default Accept differs.
  - **Errors.** Network errors say `Network Error`, not `fetch failed`. `error.data` is absent. The message is `Request failed with status code N`, without the URL.
  - **Error serialisation.** `JSON.stringify(AxiosError)` (~1.9 KB) includes `config.headers.Authorization`, the internalised `svc.cluster.local` URL and the stack. Today's error is `{name,response:{},data,type,status,headers:{}}`. It would leak into `__NEXT_DATA__` via `pages/data-providers/[id].jsx:113-118`.
  - **Proxy.** axios honours HTTP(S)_PROXY.
  - **Keep-alive.** Off on Node 18 and on from Node 20. This is moot: phase 6 runs after Node 24.
- **Change:**
  - Extend R-016 and R-028 with these verified facts.
  - Mitigation: the transport spec in X70.4.
  - Tests compare raw request bytes and error objects (X40.38).

### X10.11 — NEW: zustand 5 SSR snapshot and hydration
high · P/V+ · Sources: DT-03(P), dashboard-target-V-01, BL-24(P), DT-15(P)
- **Fact:** zustand 5's server and hydration snapshot is `api.getInitialState()` (`esm/react.mjs:6-10`).
  - Search's `useStore(initialState)` calls `extend()` after creation (`store/index.jsx:32-35`, `root.js:37-40`).
    - A naive port makes `/data-providers` SSR 500 (it destructures `dataProviders.params` from null) or render empty.
    - Seeding the store at creation fixes only the server. The client singleton then hydrates with null, which gives React #418 (reproduced).
  - Selectors that return new references loop forever in v5. `DataProviders.results` is computed over 15,672 items, so it needs `useShallow`.
  - zustand 5 peers react ≥18.
  - `persist` warns on server sets.
  - The singleton leak is already covered by R-004.
- **Change:** new risk. Spec in X70.3. Tests in X40.38.

### X10.12 — NEW: antd SSR CSS order
high · C · Sources: DT-05, DS-15, RH-13, DT-19, VER-21
- **Fact:** the antd extractStyle `<style>` is rendered after Next's CSS `<link>`s (`_document.js:508` then `:529`), so antd wins ties of equal specificity.
  - Verified: `.ant-btn{border-radius:40px}` computes to 2px without a layer and 40px with `<StyleProvider layer>`.
  - The dashboard's 396 `.ant-*` overrides rely on the opposite order.
  - While both coexist, the unlayered vendored design global CSS beats layered antd.
- **Change:** new risk. Spec and tests in X80.1.

### X10.13 — SWR request-count changes: rewrite R-029's mitigation
high · C/P · Sources: BL-12(P), DT-11, DT-12, DT-13, BL-23(P)
- **Fact:** with `fallback` and default options, SWR makes 1 extra request per key after hydration and replaces the SSR text ("from-ssr" → "from-api"). With `revalidateIfStale`, `revalidateOnFocus` and `revalidateOnReconnect` all false, it makes 0.
  - The dashboard's effective config is `swrConfig` underneath `swrDefaultConfig`:
    - `keepPreviousData: true`;
    - `compare` via JSON.stringify;
    - `revalidateIfStale: true`;
    - `errorRetryCount: 1` after 5 s;
    - 10 s dedupe (its comment says 2 s).
  - Baseline counts:
    - clear-all = 2 POSTs;
    - E18 fires on every ClaimCard render, plus once un-awaited in SSR;
    - E21/E22 logo GETs once per card;
    - E8 refetches on every mount;
    - no retries.
  - These per-render and per-card effects are not SWR use cases. Only `SimilarWorks.fetchSimilar` is read-on-mount.
- **Change:** rewrite the R-029 mitigation to "SWR only where request-log parity is proven" (X70.5).

### X10.14 — NEW: vendored design code is re-transpiled by search's Babel
critical · C · Sources: DS-01, RP-13
- **Fact:** Next's babel-loader includes the project dir and excludes only node_modules.
  - Search's `useBuiltIns:'usage'` injects ESM `import "core-js/..."` lines into the compiled CJS files. 0 of the 114 lib files contain `module.exports`; they use `exports.x=`.
  - Webpack 4 and 5 then treat each file as harmony and drop its exports. Reproduced with Next 10.2.3's own loader: `default` is undefined, giving a ReferenceError in the browser and undefined components in SSR.
  - The server bundles these files instead of requiring them, and babel-jest transforms them too.
- **Change:** new risk (LOUD). Fix in X60.1/X60.2.

### X10.15 — LogRocket 12 CSP host change; downgrade R-062
medium · C/P/U · Sources: VER-02, RH-04(P), EM-09(U)
- **Fact:** the default hosts change:
  - 10.0.0: `cdn/r.lgrckt-in.com`
  - 11.0.0 to 12.4.0: `cdn/r.logr-in.com`

  `csp.config.js:6` allows only `*.logrocket.com *.lgrckt-in.com`, so recording stops in prod. T-720 and T-719 catch it if they run, because `LogRocket.init` runs on every prod render.
  - R-062 (SSR import crash) is refuted: `require`, `init` and `captureMessage` are safe on Node 18 and 24.
  - Probes also show test traffic hitting the real LogRocket project ("Session quota exceeded").
- **Change:** CS-LR-2 (X20.6). Downgrade R-062. The harness aborts LogRocket hosts (X40.16).

### X10.16 — NEW: Sentry ≥8 adds `sentry-trace` and `baggage` to every server fetch
medium · C · Sources: RH-03
- **Fact:** with only a DSN set (`@sentry/node` 11.8 undici instrumentation, spans off), these headers are sent to api.core.ac.uk, doi.org and logo hosts. The 40 §1 server row compares only 4 headers.
- **Change:** new risk. Keep-behaviour `tracePropagationTargets: []`. Record the full outbound header set (X40.6).

### X10.17 — The Next runtime raises the browser floor whatever `.browserslistrc` says
medium · C/P · Sources: nextjs-late-09, RH-10(P), DT-31
- **Fact:**
  - The client runtime uses `?.` and `??` from 12.3.
  - Webpack module wrappers become arrow functions from 15.
  - Next 16 states a floor of Chrome/Edge/Firefox 111 and Safari 16.4.
  - Untranspiled node_modules (React 19, mobx, Sentry ≥8) add their own floors.
  - antd 6 targets "last 2 versions".
  - `.browserslistrc` resolves to ie_mob 10/11, op_mini all, kaios 2.5 and bb 7.
- **Change:** restate OD-16: keep `.browserslistrc` for CSS/Babel parity, but explicitly accept Next's and antd's JS floor after checking GA browser share before W4. Add one smoke run on an engine at the floor, plus es-check on client chunks.

### X10.18 — caniuse-lite drift re-rates R-065
medium · P/C/U · Sources: RH-10 (violates M1 unless unpinned later), DS-11(P), VER-17, DQ-21(U)
- **Fact:** the lock has caniuse-lite 1.0.30001754; the registry has 1.0.30001816.
  - Any lock regeneration re-resolves browserslist (4.27.0 → 4.29.4 on a strict install), which changes Babel and PostCSS output.
  - R-065 is rated L/L and is "accepted" without an OD.
- **Change:**
  - Re-rate R-065 to M and give it an OD.
  - Pin caniuse-lite and browserslist via `overrides` for the track, with an explicit unpin step at the L1 sweep.
  - CI asserts that the resolved browserslist output is unchanged.
  - The W5 lockfile diff may touch only the design entry.

### X10.19 — SWC and sharp platform binaries: correct R-027
medium · C/P · Sources: NE-11(P), VER-26, nextjs-late-14(P)
- **Fact:**
  - Next 12.3 loads the SWC bindings even when Babel is configured (page analysis). If `@next/swc-*` entries are missing it fetches them from the registry and patches the lockfile.
  - 12.1.6 prints "patching" even with a correct npm-10 v3 lock (it reads `lock.dependencies`).
  - A macOS npm ≥10 lock does include the `linux-arm64-musl` and `x64-musl` entries, so R-027's claim is wrong.
  - Only 14.x lacks a WASM fallback. 13.5, 15 and 16 fall back to a runtime registry download (fragile, not a hard failure).
  - From 15, sharp `@img/sharp-linuxmusl-arm64` arrives as an optional dependency.
- **Change:**
  - Update R-027.
  - T-008 asserts the musl entries (all waves) and the sharp musl entry (from 15).
  - T-901 runs on arm64 alpine. At 12.3.7 it fails on "patching"/"wasm" log lines.
  - For 12.1.6, keep lockfile v2 or set `NEXT_IGNORE_INCORRECT_LOCKFILE` [VERIFY].

### X10.20 — data-loader: no validation, no timeout; an outage blocks deploys
medium · C · Sources: BL-18, NE-17, BL-19
- **Fact:** on Node 18:
  - a 200 with `[]` overwrites all three files and exits 0;
  - a 500 exits 1 with a race-dependent partial write;
  - a hang never exits.

  The build runs on every push and nightly, so an API outage blocks hotfixes. CS-N12-1 (global fetch) changes the log text to `TypeError: fetch failed` and adds undici's 300 s timeout. Next 11 hoists node-fetch 2.6.7 instead of 2.6.1.
- **Change:**
  - OD-08 A states these semantics explicitly.
  - Extend T-117 (X40.37).
  - Either accept the log and timeout change via an OD, or declare node-fetch 2.6.1 explicitly for W4.

### X10.21 — React 19 reorders the head and injects image preloads
low/medium · P · Sources: RM-10(P)
- **Fact:** React 19 emits `<link rel=preload as=image>` before `#__next` and hoists meta/link/title ahead of noscript/script.
  - JSON-LD is already last in Meta, so only a full normalised-HTML snapshot would falsely fail.
- **Change:** new risk (L/M). Normalise image preloads and the order of non-SEO tags. Keep strict assertions on SEO meta order and the parsed JSON-LD.

### X10.22 — React 19 drops `src=""` and non-`<a>` `href=""`
low · P · Sources: RM-21(P)
- **Fact:** the behaviour is confirmed. No concrete call site was found.
- **Change:** new risk (L). Covered by a T-417 case and the console gate.

### X10.23 — Node 24 OpenSSL security level 2 could drop logos fetched from weak-TLS hosts
low · P · Sources: RH-15(P)
- **Fact:** `checkLogo` swallows errors, so the default logo would render. The impact is likely tiny.
- **Change:** add a one-off probe at the Node-24 wave: TLS-connect to every distinct member-logo host plus doi.org on Node 22 and 24, then diff.

### X10.24 — Upstream API failures are invisible in prod logs
medium · C · Sources: BL-20, TS-22(P part)
- **Fact:** `utils/logger.js:2` and `Loader.log` are no-ops in production. E1/E4/E6 failures render 200 soft pages, so the soak and canary 5xx metrics cannot detect an API outage.
- **Change:** list this as a residual gap. Use stub-side and ops request logs (upstream status distribution) as the soak signal.

### X10.25 — Corrections to existing rows
mixed · Sources as listed

| Row | Correction | Sources |
|---|---|---|
| R-006 (C) | **Low.** The webpack-5 `process` polyfill has `.on` as a noop on 10+wp5, 11.1.4, 12.3.7 and 13–16. 0 pageerrors on the real app. Drop CS-N11-6. Reassess only for Turbopack. | NE-09, nextjs-late-16, EM resolved |
| R-007 | At 11.x the SVGs are unaffected (next-image-loader skips svg when a custom rule exists). `CoreB.png` fails the build (LOUD). `[object Object]` happens only if next-images is removed later. T-005 must check 9 file URLs + 5 data URIs (inline limit 8192 B). | NE-10 |
| R-010 | `_app.jsx:101` does not mismatch. The real sites are the `/display` breadcrumb, nested anchors, `Intl.DisplayNames` and the consent popup (X30.6). | RM-06, UI-06 |
| R-012/R-059 | The trigger is a `jsx()`-created element on React 19. createElement (classic runtime, used by search) still applies defaultProps. The design lib uses `react/jsx-runtime` in 61 of 114 files, so SearchResult and Footer lose MathMarkdown defaults on React 19 alone. CS-R19-1 (switch to the automatic runtime) is what breaks Histoslider. | RM-02 |
| R-013 | Stays **LOUD-browser**: nested `<a>` plus #418/#423 in production on 13.5 without legacyBehavior. The nextjs-late-17 refutation holds. | nextjs-late-17 (refuted) |
| R-015 | The `latest` spec is held by the lock (npm ci/install keep the locked version). The hazard is lock regeneration or `npm update`. | VER-16 |
| R-027 | See X10.19. | NE-11, VER-26 |
| R-031 | 7.14.0 has no exports map; 9 names change. | VER-19 |
| R-033 | Add the SearchResult hooks inside `.map` (X30.15). | DS-10 |
| R-039/Q-049 | The data-provider template is not an observer. The trigger is React 18 render timing or the store rewrite. Add a navigation-from-`/search?sort=recent` variant. | RM-18 |
| R-040 | See X10.3. | NE-04 |
| R-042, OD-05, T-108 | Expect **no diff**. All 676 region names are identical on Node 18.20.8, 22.18, 22.23.3, 24.x and 26.12 (TR is already "Türkiye" on 18). Drop "accept ICU diffs". Alpine is [VERIFY]. | VER-25, DQ-15(U), TS-24(P) |
| R-043 | Bites in W4 (X10.5). | NE-05 |
| R-044 | **Low.** The react/react-dom directory aliases build and hydrate on 13–16 with React 18/19. | nextjs-late-16 |
| R-045 | Resolved by evidence. redirect+props gives 308 and notFound+props gives 404 on 11–16. Prod props validation is dev-only in both 10 and 16. Mark **Low**. | NE-22, nextjs-late-16, HC-23 |
| R-003, R-016, R-026 | Not affected by Next in W4 (SEO head, fetch polyfill guard and CSP identical 10.2.3 vs 12.3.7). | NE-22 |
| R-052 | **Low.** Only a shallow Link query change scrolls to top from 13; the app passes no `shallow` to Pagination. | nextjs-late-18 |
| R-055 | See X10.4. | RH-02 |
| R-056 | react-cookie 4.1.1 guards useLayoutEffect with `isInBrowser()`. Tippy's `element.ref` warning is dev-only, so it goes in the Jest allow-list, not T-701. | RM-17 |
| R-061 | **Hygiene.** husky 9 `prepare` without `.git` exits 0. | VER-27 |
| R-062 | Downgrade (X10.15). | VER-02 |
| R-065 | See X10.18. | RH-10 |
| R-004 | Has only the white-box T-209; add black-box T-609. | TS-07(P), TS-23 |
| R-014 | The second layer (T-901) does not detect `--legacy-peer-deps` masking; add npm-ls problem-set parity. | TS-07(P) |

### X10.26 — Register mechanics: ★ legend and Status column
low · U · Sources: DQ-21, DQ-02, DQ-09 (corroborated by TS-07)
- **Fact:** ★ is undefined. 16 of the 46 SILENT rows have no ★: R-014, R-038–R-040, R-042, R-046, R-048, R-049, R-051–R-053, R-055, R-058, R-059, R-065, R-067. There is no Status column.
- **Change:**
  - ★ = "fault-injection verified" (45 C1), shown in a Detector column.
  - Add a Status column in STATUS.
  - Sort-order exception: new IDs are appended.

### X10.27 — Smaller new risks
low–medium · Sources: RM-19, TCD-03(P), design-system-V1, HC-08, HC-12, HC-15, TCD-21, RP-07
- **Fact:**
  - MobX writes outside actions render separately on React 17 and are batched on React 18 (Low). Tests assert settled states.
  - The Docker layer split breaks icons (X20.9).
  - `.gitignore` `build` drops the vendored `bin/build` (X60.2).
  - The runtime `BUILD_TARGET` env (X40.27).
  - Public source maps (X30.21).
  - The Cloudflare edge is outside every test (X40.34).
  - Test devDeps change the prod tree (X40.5).
- **Change:** add rows that point to the named entries.

---

### 20-change-sites.md

### X20.1 — NEW ops pre-step and wave W0b: six Next-proofing changes, each verified neutral on 10.2.3
critical · C/U · Sources: nextjs-late-12, nextjs-late-01, -03, -04, -05, -06, NE-01, NE-03, NE-04, HC-22, HC-24, HC-21, EM-03/04/06(U)
- **Fact.** Each change below was verified on today's Next 10.2.3 to produce identical output (CSS md5, nav steps, title bytes, client chunk):
  1. **Gateway data rule.** `kube/{prod,stage}/httproute.yaml`: PathPrefix `/search/_next/data` → URLRewrite `ReplacePrefixMatch: /_next/data`. Longest prefix wins per the Gateway API spec; the real controller's behaviour is UNCONFIRMED, so apply it to stage first. Mirror the rule in the e2e proxy. Keep the client patch and the app rewrite. This is an ops PR. It must be live and soaked before any 12.x prod deploy.
  2. **Template-literal titles** at the 3 sites plus `modules/title`, with `?? ''`.
  3. **`legacyBehavior` on the 5 Links.** 12.3 defaults to legacy and 10 ignores the prop; the DOM is identical on 10–16.
  4. **Robust CSS-modules patch** with a zero-match throw. This replaces `next.config.js:45-77`.
  5. **Sentry alias.** `'@sentry/node': isServer ? '@sentry/node' : '@sentry/browser'` at `next.config.js:97`.
  6. **`eslint: { ignoreDuringBuilds: true }`.** Remove it at Next 16.

  `beforeFiles` (NE-01, EM-03) fixes 12.3 only. It is rejected, with HC-21 option D.
- **Change.**
  - Add rows CS-OPS-1 and CS-W0b-1..5.
  - Ship one PR per change. Each is gated by T-002, T-003, T-602, T-702 and T-801 showing 0 diff.
  - Move CS-N13-1/2 into W0b.
  - Correct CS-N12-3 and R-002 (see X10.1).

### X20.2 — W4 corrected sequence (re-tag the CS IDs per step)
high · C/U · Sources: NE-14, NE-02, NE-06, NE-07, NE-19, NE-23, VER-04, VER-24, VER-03(P), EM-02(U), EM-05(U)
- **Fact.**
  - **11.1.4 cannot build the real app.** It fails with `HookWebpackError: Maximum call stack size exceeded` in webpack-sources (`RawSource`/`CachedSource.streamChunks`), triggered by the 5.4 MB `data/.formap.json`.
    - It fails on Node 18, 20 and 24. It builds on Node 22.x and with a warm cache, so it looks flaky. Docker builds are cold.
    - It also fails without source maps and with `--stack-size`.
    - 12.1.6 and 12.3.7 build even with an 18 MB formap.
  - **`config.node={fs:'empty'}` fails webpack 5 schema validation.** `resolve.fallback.fs=false` builds.
  - **`future.webpack5` is refused by 11 and warned about by 12.**
  - **The OpenSSL flag is still needed at 10.2.3+wp5 and 11.1.4.** 12.1.6 and 12.3.7 build without it.
- **Change.** Replace the 50 W4 row and the 20 tags with this sequence:
  - **W4.0 prerequisites.**
    - T-604, T-702, T-004 (P0), T-003, T-801.
    - A forced-500 fixture.
    - Decisions: OD-03, OD-37 (minifier), OD-38 (`_error`), OD-05.
  - **(a)** CS-N12-1 data-loader.
  - **(b)** 10.2.3 + `future.webpack5` + `resolve.fallback.fs=false`. Keep the OpenSSL flag. Result: 0 HTML and 0 CSS diffs on the real app.
  - **(c)** `next@12.1.6`:
    - delete the `future` key;
    - `disableStaticImages` (CS-N11-3);
    - drop the OpenSSL flag;
    - regenerate the lock with npm ≥10 (musl entries, NE-11 caveat);
    - apply the minifier and `_error` decisions;
    - react-ga4 3.0.1.
  - **(d)** 12.3.7. Requires the gateway rule live.
  - **(e)** Node 24.
  - Each step goes to prod individually (X50.3). Add a **cold** build check (`rm -rf .next`) to every wave exit.

### X20.3 — CS-N12-3 rewrite: client patch unchanged
high · C · Sources: NE-20, HC-23, nextjs-late-16, http-contract resolved
- **Fact.** `getDataHref` exists in 10.2.3 through 16.4.2. The signatures:
  - `(href, asPath, ssg, locale)` in 10 and 11;
  - an object `{href, skipInterpolation, asPath, locale}` from 12.3, called twice per navigation.

  The patched hrefs are identical, and the patch applies on all 8 builds. The failure is on the server side.
- **Change.** "Client patch unchanged and verified; the server-side data route is handled by CS-OPS-1. Run T-604/T-702 with and without the gateway rule." Keep T-110.

### X20.4 — CS-N11-5 / CS-NODE-2: the OpenSSL flag stays until the first Next 12 (12.1.6)
high · C/U · Sources: NE-06, VER-04, EM-05(U), DQ-12(U)
- **Fact.**
  - At 10.2.3+wp5 and at 11.1.4 the build fails with `ERR_OSSL_EVP_UNSUPPORTED` (BulkUpdateDecorator md4) on Node 18, 22 and 24.
  - The runtime `next start` never needs the flag.
  - next-images hashes stay identical (loader-utils WASM md4).
- **Change.** Move the flag removal to W4(c), proven by T-901 on Node 18 without the flag. Delete the duplicates CS-NODE-1/2 and CS-N16-1 in favour of CS-N12-6 and CS-N11-5. Fix the README §3 and findings/02 §6.1 errata.

### X20.5 — CS-N12-6 / CS-NODE-1 → `node:24-alpine` by digest (see X02.4)
high · C · Sources: VER-06, NE-12(P), nextjs-late-10

### X20.6 — CS-LR-2: CSP hosts for LogRocket 12
high · C/P · Sources: VER-02, RH-04(P)
- **Change.**
  - In the same PR as the logrocket 12 bump, add `*.logr-in.com` to the LOGROCKET source set used by script-src, script-src-elem, worker, img, connect, media and child.
  - Alternative: set `ingestServer`/`sdkServer` to the old hosts. Note that `sdkServer` loads `/logger.min.js` instead of `/logger-1.min.js`.
  - The CSP header change needs an explicit parity delta (OD-28).
  - Verify recording on staging (T-904).

### X20.7 — CS-N13: env warning and Link deprecation
low · C/U · Sources: nextjs-late-23, EM-20(U), nextjs-late-11
- **Fact.**
  - Next 13.5 prints `"env.SENTRY_DSN" is missing, expected string` when an env value is undefined. Docker sets `""`, so only local and test builds show it.
  - `legacyBehavior` has been deprecated since 15.3 (dev `errorOnce`).
  - Next 16 + React 18 is deprecated and will be removed in 17.
  - next-images makes Next 16 warn about `serverRuntimeConfig`.
- **Change.**
  - Allow-list the env and Link warnings in T-901 and the T-701 dev runs.
  - Do not change `env.config.js` unless T-116 proves the result identical.
  - Phase 7 migrates the 5 Links off `legacyBehavior` and drops next-images.
  - New OD: track whether Next 17 keeps webpack (UNCONFIRMED).

### X20.8 — W1 lint/format change sites
high · C/P · Sources: TCD-06, TCD-07, TCD-14, TCD-15, TCD-17, TCD-18, TCD-05, RM-15(P), DT-23, DT-24
- **Change.**
  - **CS-LINT-1.** Generate the ESLint 10 flat config from `findings/baselines/eslint-resolved-config.jsx.json`.
    - Fix the 2 rules that fail to load.
    - Register import-x under the key `import` (38 existing disable directives).
    - Keep `reportUnusedDisableDirectives: 'error'`.
    - Replicate the `data/**` ignore explicitly. Today `--ignore-path .gitignore` hides `data/data-loader.js`, so the baseline lists 156 of 157 files.
  - **CS-LINT-2.**
    - Use **bulk suppressions** (`eslint-suppressions.json`) instead of inline disables, so source stays byte-identical. Verified exit codes: baseline 0, new violation 1, line shift 0, fixed violation 2 (prune).
    - react-hooks: `rules-of-hooks: 'error'` only, `exhaustive-deps: 'off'`. Never extend `recommended`: 7.1.1 includes React Compiler rules whose fixes change behaviour.
    - Capture the new lint baseline on unchanged code; the new tools do not reproduce the 13 findings exactly.
  - **CS-STY-1.** stylelint 17 with the ported rules (X02.2) and a ratchet script keyed on (path, rule, count).
  - **CS-PRET-1.** One format-only commit (8 files).
  - **CS-HUS-1.**
    - Hook = `npx lint-staged`.
    - lint-staged runs ESLint (no `--fix`) and `prettier --write` for JS/JSON/MD.
    - It runs stylelint (no `--fix`) and `prettier --check` for CSS.
  - **CS-W0-6.** Set `HUSKY=0`.
  - **CS-BAB-3** (2 `export x from` rewrites) moves to W0.

### X20.9 — CS-W0 Docker/npm change sites
high · C/P/U · Sources: TCD-03(P), TCD-11, TCD-19(P), VER-17, VER-18, VER-16, VER-27, RP-04, EM-12(U), DS-02 caveat
- **Fact.**
  - **The design postinstall** walks up from node_modules to find the consumer's `design.config.js`. If that file is not yet copied, it writes `iconsPublicPath: '/icons.svg'`, so every icon 404s with no error. This also happens with `--ignore-scripts` or a cached node_modules.
  - **The lock is in sync.** `npm ci --dry-run` passes both with and without `--legacy-peer-deps`. In strict mode the only ERESOLVE is logrocket-react@6.0.3 (peer react ≥18).
  - **Strict mode changes the tree.** It auto-adds webpack 5.112, jquery 4.0.0 and eslint-plugin-react-hooks 4.6.2 (+50 packages, 1760 → 1808) and bumps browserslist 4.27 → 4.29.4.
  - **The user-level `.npmrc` masks T-008.** It has `legacy-peer-deps=true` locally.
  - **`|| npm install`** is not needed for drift. With a directory-form vendored package it would silently create a symlink.
- **Change.**
  - `COPY package.json package-lock.json design.config.js ./` before `npm ci`.
  - Forbid `--ignore-scripts` and node_modules caching. CI and the image assert that `lib/config.js` contains `/static/search/icons.svg`.
  - Add a `.dockerignore`, the BuildKit secret for `NPM_TOKEN` (it persists in a layer today, S-3), and a base-image digest.
  - Replace the fallback with an explicit retry chain: `npm ci || (sleep 10 && npm ci) || (sleep 30 && npm ci)`. The roadmap report's for-loop returns rc=0 on total failure (verified).
  - Add a project `.npmrc`. Run T-008 with `npm_config_userconfig=/dev/null --no-legacy-peer-deps`.
  - Keep `--legacy-peer-deps` until the strict-tree diff has been reviewed. Remove next-images, file-loader, url-loader and the CSS-only slick-carousel peers rather than letting them auto-install.
  - CS-W0-1 (exact design pin) moves into the phase-2 harness PR. The full Dockerfile sketch is in tooling-ci-deploy.md §5.

### X20.10 — CS-SEN: Sentry change sites (see X02.7, X10.3, X10.4, X10.16)
high · C · Sources: VER-12, RH-02, RH-03, NE-04
- **Change.**
  - W0b: the `isServer` alias.
  - W2: 7.120.4.
  - End state: `@sentry/nextjs` 11 with the keep-behaviour options and CSP for the ingest host.

### X20.11 — CS-N11-4 source maps: set `productionBrowserSourceMaps: true`
medium · C · Sources: TCD-23, NE-18, HC-12
- **Fact.**
  - The baseline serves public client maps through `/static/search/_next/static/**`: 27 `.js.map` + 8 `.css.map`, 6.6 MB, with sourcesContent. There are also 14 server maps.
  - Removing `@zeit/next-source-maps` without the flag silently turns those URLs from 200 into 404.
  - With the flag, 12.3.7 emits 23 JS maps. CSS maps under the flag are UNCONFIRMED.
  - Server maps disappear, which has no runtime effect.
  - The plugin is not the cause of the 11.1.4 overflow. Its 0.0.4 release does not exist.
- **Change.** Resolve the [VERIFY] as "maps: yes". Set the flag unconditionally unless the owner says public maps are unintended (S-9). Add `.map` to the T-601 matrix.

### X20.12 — CS-R18/R19 corrections
medium · P/C · Sources: RM-03(P), UI-21, RM-11(P), RM-02, DT-09, RM-17, VER-33, DQ-25(U)
- **Change.**
  - **(a) CS-R18-2 (Q-050) is wrong.**
    - On React 19, `suppressHydrationWarning` leaves the server-formatted date text visible.
    - The date node lives inside the vendored `MetadataList.Item` (design `search-result.jsx:177-183`).
    - Fix: the first render replicates the **server** computation, and the local value is applied after mount. Use one hook at the top of `Results` and of `CardDropdown`, never inside `.map`.
    - Needed only if live API dates carry `Z`, an offset, or are date-only. Zone-less ISO strings parse as local time on both sides, give no mismatch, and stay PRESERVE/WATCH.
    - First read the live format from the recorded fixtures.
  - **(b) CS-R18-3 (Q-051).** A search-side mounted gate around `<CookiesPopup/>` in `main/index.jsx` is an alternative to editing the vendored `cookies.js`. 60 §1 allows the vendored edit too.
  - **(c) CS-R19-1 (automatic JSX runtime) triggers the defaultProps loss.**
    - First do CS-R19-2/3: move the Histoslider and MathMarkdown defaults into the components. This is neutral.
    - Then switch the runtime in its own PR, gated by T-404 under both runtimes and by T-801.
    - Phase 6.1 needs the automatic runtime for TSX files without `import React` (DT-09).
  - **(d) CS-R19-5.** The Tippy `element.ref` warning is dev-only, so its allow-list entry goes in the Jest console allow-list.
  - **(e) CS-R18-5.** It references `@testing-library/react-hooks`, which is never installed. Add `@testing-library/dom` 10.4.2 at W6.
  - **(f)** Land the ESCALATES fixes before the React 18 bump, on React 17, as wave W5.5 (X50.5).

### X20.13 — NEW: Next's built-in `_error` page changes
medium · C · Sources: NE-08, RH-09
- **Fact.**
  - There is no `pages/_error`, and the custom `App.getInitialProps` never calls the page's gIP.
  - 10.2.3 renders the title `: An unexpected error has occurred`.
  - 11 and 12 render `Application error: a client-side exception has occurred (see the browser console…)`.
  - 12 adds an inline dark-mode style.
  - The Next 16 `_error` changes font, spacing and adds `prefers-color-scheme: dark`.
  - Any uncaught SSR exception shows this page (X30.3).
- **Change.**
  - Add a quirk row and a forced-500 fixture in T-601.
  - Add V-rows for the 500 page in light and dark.
  - New OD-38: vendor Next 10's `_error` as `pages/_error.jsx` (D1) or accept the change.

### X20.14 — CS-N15/N16 details
medium · C · Sources: nextjs-late-21, HC-16, nextjs-late-22, nextjs-late-16 (resolved)
- **Fact.**
  - From 15, `routes-manifest` changes:
    - rewrites become `{beforeFiles, afterFiles, fallback}`;
    - Next injects `/static/search/_next/:path+ → /_next/:path+`;
    - the key count goes from 8 to 14.
  - The CSP value in `headers` is frozen at build time from `NODE_ENV`.
  - `--webpack` is required: a 16 build with a webpack config and no turbopack config errors.
- **Change.** T-010 compares normalised (source, destination, headers) tuples, whitelists the injected rewrite, and asserts that the manifest CSP equals T-116's string. Use exact pins (X02.15).

### X20.15 — Record a "checked N/A" matrix for the v13–v16 guides
low · C · Sources: nextjs-late-22
- **Change.**
  - Add a compact table per guide, marked "N/A (checked 2026-10-19)". Items: AMP, runtime config, images defaults, `next lint`, middleware→proxy, `@next/font`, `next export`, `target`, async request APIs, `swcMinify`, fonts, sass-loader, devIndicators, dynamicIO/ppr.
  - Add rows for the undocumented changes that do apply (X10.1, X10.2, X10.7, X10.3, X10.8).

### X20.16 — CS-N12-4 lock regeneration (see X10.19)
medium · P · Sources: NE-11(P), VER-26
- **Change.** Regenerate with npm ≥10 on any OS. Assert the musl and gnu entries in T-008. Include the 12.1.6 patcher caveat.

### X20.17 — CS-N11-7 and CS-N11-1: verified
low · C · Sources: NE-24, NE-19
- **Fact.**
  - The named JSON import from `i18n-iso-countries` only warns ("Compiled with warnings") and its value is unchanged.
  - `path-browserify` is provided.
  - On 12.3, client `path.resolve` returns a relative path. This is harmless.
  - `setImmediate` is unaffected.
- **Change.** Mark both as verified with no change. Allow-list the warning in G3/G5.

### X20.18 — CS-N12-1 log and timeout semantics (see X10.20)
low · C · Sources: NE-17

### X20.19 — Phase-6 build change sites (pointer to 70)
high · C · Sources: DT-09, DT-10
- **Fact.**
  - Next 16 uses only the user's presets when `babel.config.js` defines them. As a result:
    - `import type` fails;
    - TSX without `import React` hits `React is not defined`;
    - antd CJS through `transform-runtime` throws `genStyleHooks is not a function`.
  - It passes with `sourceType:'unambiguous'`, `preset-react {runtime:'automatic'}` and `preset-typescript {onlyRemoveTypeImports:true}`.
  - The 10 webpack aliases (`next.config.js:86-100`) must become tsconfig `paths`. The `config` alias points to a non-existent `config.js`.
- **Change.** Add CS-BAB-6..8 and CS-TS-1 rows, scheduled in 70 (6.1). Do a spike build with antd imported before committing to "Babel until 6.7".

### X20.20 — Env and asset conventions
low · P · Sources: DT-26(P), DT-27(P)
- **Change.**
  - Keep `env.config.js` and literal `process.env.X` reads. The dashboard's `env.ts` pattern (import-time throw, `import.meta.env`) does not apply.
  - When next-images is removed (phase 7 / OD-10), decide between an `asset/resource` rule that keeps string URLs and a `.src` codemod. Verify with T-601 HTML.

### X20.21 — CS-W0: `npm ls` problems and dead deps
low · C · Sources: VER-18, EM-12(U)
- **Fact.** `npm ls --all` shows 0 extraneous packages and 7 problems:
  - react and react-dom invalid against the logrocket-react peer;
  - missing peers: webpack ×3, jquery, eslint-plugin-react-hooks.
- **Change.** Correct findings/01 §0. Remove the `|| npm install` fallback only once T-901 is green on linux/arm64.

### X20.22 — Hygiene
low · U · Sources: DQ-12, DQ-24, DQ-25
- **Fact.**
  - W9 is used 22 times but never defined.
  - CS-R18-6 and CS-NODE-3/4 are never scheduled.
  - The webpack5 flag has no CS ID.
  - `test/utils/render.js` does not exist yet.
  - Line refs are valid only for tree `a825839`.
- **Change.**
  - Define W9 as phase 6.7, or fold it into 70.
  - Schedule CS-R18-6 and CS-NODE-3/4, or mark them "not scheduled".
  - Add CS-N11-0 for the flag.
  - Mark future files "(new)".
  - Add an Anchor column.

### X20.23 — Missing change site: persist `BUILD_TARGET` / runtime ENV
medium · C · Sources: HC-22, HC-08
- **Change.** Add CS-NODE-5: the image must keep `ENV BUILD_TARGET=azure NODE_ENV=production`. See X40.27.

### X20.24 — Scroll note for CS-N13-1
low · C · Sources: nextjs-late-18
- **Change.** "Do not start passing `shallow` to Pagination, or add `scroll={false}` with proof." From 13 a shallow Link scrolls to the top. `router.push` is unchanged.

---

### 30-quirks-register.md

### X30.1 — S-4 is an executing stored XSS
critical · C/U · Sources: HC-09 (violates M3 if fixed inside the track without an owner override), UI-17, EM-01(U)
- **Fact.**
  - A title or abstract containing `</script><script>…` breaks out of the JSON-LD. Sites: `modules/meta/index.jsx:131-141` and `pages/data-providers/index.jsx:88-93`. `JSON.stringify` does not escape `<`.
  - The injected script **runs** in the prod build: `window.__PWN === 1`, 3 alert dialogs, 0 CSP violations. `script-src-elem` has `'unsafe-inline'` (S-6).
  - It also corrupts `document.head`.
  - The payload source is harvested repository metadata. The upgrade does not make it worse.
- **Evidence.** `exp/http-contract/out/base/w1004.body`; ui-flows `harness/e21.js`; empirical browser eval `{xssRan:1}`.
- **Change.**
  - Reword S-4 to "executable XSS".
  - Pin the current behaviour in T-602 with a sandboxed fixture kept out of any shared browser profile.
  - Owner decision OQ-1 (OD-36): a separate security PR outside D1. Escaping `<` as `<` gives no visible change. Do it before the phase-2 baselines if approved.

### X30.2 — Q-001 is wrong: a works 410 returns HTTP 500
high · C · Sources: BL-02, HC-03
- **Fact.**
  - `pages/works/[id].jsx:89-96` puts `error.data` (the parsed JSON object, or a Blob) into `serverError.message`.
  - `templates/error/404.jsx:15` then renders an object, React error #31 fires, and the response is 500 with no Cache-Control.
  - Both a JSON 410 and a text 410 give 500. An outputs 410 is a string, so it renders a 200.
  - The real API 410 body shape is UNCONFIRMED.
- **Change.**
  - Correct Q-001 and findings/02 §4.1.
  - Add fixtures W-410-json and W-410-text to T-502/T-601, pinning 500 plus the default Next error page.
  - Record a real 410 body once (needs an API key).

### X30.3 — NEW: SSR 500 triggers missing from the register
high · C/P/U · Sources: HC-04, HC-05(P), UI-04, BL-03, EM-07(U)
- **Fact.**
  - **(a)** Works with `publishedDate: ''` and a numeric `yearPublished` (`pages/works/[id].jsx:70-72`) call `formatCitationDate(2001)`, and `date.split` throws a TypeError (`modules/meta/index.jsx:21-25`).
    - Real live works hit this: 6948813, 19211324, 340052118. The empirical probe saw 4 of 10 results for `q=climate`.
    - Prevalence across the corpus is UNCONFIRMED.
  - **(b)** Works with `dataProviders: []` throw at `templates/output/index.jsx:213` (`dataProvider.logo`) and `meta/index.jsx:99` (`.name`).
  - **(c)** An output with no download link and `sourceFulltextUrls: null` throws on `.length`. If the key is absent it throws on `url.match` (`card-dropdown.jsx:13-19,80`).
  - **(d)** `/data-providers/?q=100%25` throws URIError (Q-028).
  - Client-navigation data JSON stays 200 while the direct URL returns 500.
  - Outputs with a string year emit `citation_publication_date="2001/NaN/undefined"`, and JSON-LD `datePublished` is the string `"2001"`.
  - A real date prints as `2024/1/01`: the month is de-padded and the day is not.
- **Change.**
  - Add Q-069/Q-070/Q-073 as PRESERVE.
  - Add fixtures W-emptydate (6948813 shape), W-nodp, O-yearstring and O-nofulltext to T-502/T-601/T-602, including the 500-page state.
  - Inform the owner that a share of `/works/*` returns 500 today (SEO). It is a possible ESCALATES candidate (OQ list).

### X30.4 — NEW: post-hydration blank pages (SSR HTML intact, `#__next` empty)
high · C/U · Sources: UI-05, BL-03, EM-17(U), RM-23
- **Fact.** ErrorBoundary has no fallback. Five reproduced triggers:
  - **(a)** A work whose output has `doi: null` throws in the effect at `templates/output/index.jsx:65-71` (crash at :68).
  - **(b)** A work DOI plus ≥4 distinct output DOIs makes ExpandableList's hook count change: React #310.
  - **(c)** A provider without `location` throws `Invalid LatLng` (`map.jsx:24-30`).
  - **(d)** Similar results with `dataProviders: []` throw at `similar-works.jsx:53`.
  - **(e)** Opening the year facet with an empty or out-of-range aggregation throws at `filters/year/index.jsx:40`.
  - Happy-path fixtures must avoid these shapes. For example, a "works with outputs" fixture needs DOIs on all outputs.
  - Q-047, Q-058 and Q-064 each cover part of this.
- **Change.** Add Q-074 and T-730: assert the page is blank, the pageerror signature, and that the SSR HTML is intact.

### X30.5 — NEW: head corrupted after hydration (see X10.8)
high · C/P · Sources: UI-01, nextjs-late-V1, RH-16
- **Change.** Add a Q row (PRESERVE) with the residue pinned per fixture. Owner OD on Next 15+ behaviour.

### X30.6 — NEW: hydration-structural quirks (ESCALATES candidates at React 18; OD-09 sign-off)
high · C/P · Sources: RM-06, UI-06, UI-07, nextjs-late-13(P), RM-07, RM-05(P)
- **Fact.**
  - **(a) Nested `<a>` inside `<a>`.** FullTextThumbnail passes `tag='a'` into the design Card (`templates/output/index.jsx:225`, `thumbnail-card.jsx:41-45`) when `fulltextStatus !== 'disabled'`. The HTML parser hoists the inner anchors: 0 anchors inside with no JS, 2–6 after hydration.
  - **(b) `/display/:id`.**
    - The gateway rewrites the URL to `/outputs`, but the client `asPath` stays `/display/…`.
    - The server-only breadcrumb tail ("› Research output from X", `templates/output/index.jsx:81-82,123-137`) is deleted silently by React 17. React 18/19 report #425/#423/#418 and re-render the root on every `/display` load.
    - `/display/ID` with no trailing slash returns 308 to `/outputs/ID/`.
    - Whether the API "display" links use `/display/` is UNCONFIRMED.
  - **(c) "Search results" back-link.** It is built from the SSR-re-encoded `asPath` (`?q%3Dclimate&page=2`), so it is broken even on the happy path. React does not patch attributes.
  - **(d) `Intl.DisplayNames` region text.** Server (ICU 74 / CLDR 44) and Chrome 152 differ on 4 of 280 codes: FK, HK, MO, PS. Browsers without `DisplayNames` get the raw code.
  - **(e) Q-051 consent popup.** It mismatches only when the cookie is absent, which is every first visit and every crawler. On React 18 that means:
    - a root re-render;
    - one Sentry `GlobalHandlers` event per first-visit page view, if a DSN is set;
    - the `LogRocket.init` and ClaimCard render-phase fetches running again (incremental, not new).
  - `_app.jsx:101`, cited in R-010, does not mismatch.
- **Change.**
  - Add Q-072 (nested anchors), Q-075 (`/display` breadcrumb), Q-076 (back-link href) and Q-0xx (`Intl` region).
  - Extend the Q-051 text.
  - Minimal fix pattern: the server-equivalent value on the first render, the client value after mount.
  - Pin these with T-728 (X40.7) on React 17 before any fix.

### X30.7 — The consent cookie is keyed on `essential_cookies_allowed`
high · C/U · Sources: UI-02, EM-09(U)
- **Fact.**
  - The popup shows when `!useCookie('essential_cookies_allowed')` (design `cookies.jsx:11-13`).
  - "Essential only" sets only the essential cookie. "I agree" sets both.
  - Cookie attributes: value `'true'`, path `/`, Max-Age 1 year, no Domain, Secure, SameSite or HttpOnly.
  - Consent given after mount applies from the next load.
  - The findings/07 recipe (set the analytics cookie) is wrong.
  - Accepting analytics with `GA_TRACKING_CODE` unset unmounts the whole page: ReactGA throws in the effect at `hooks/use-analytics.js:24`.
- **Change.**
  - Correct the shared fixture: set essential, plus analytics only for GA tests.
  - Rewrite T-416/T-719. Add J28/T-740.
  - The test build keeps a GA code set.

### X30.8 — NEW: the GA `search` hit is a no-op with a permanent warning
high · P · Sources: UI-03(P), EM-19(U)
- **Fact.**
  - `send({hitType:'search'})` sends nothing in react-ga4 2.1.0 and in 3.0.1.
  - It logs `Send command doesn't exist: search` on every load and every `routeChangeComplete`, with or without consent.
  - With consent, only `gtag('config')` produces a page_view, on hard load. Client navigations send nothing.
  - GA4 enhanced measurement could still emit history-change page views. That is a property setting and is UNCONFIRMED.
- **Change.** Add a Q row (PRESERVE). Re-specify T-719/T-305 (X40.16).

### X30.9 — NEW: in the claim flow, an aborted call's error sticks
high · C · Sources: BL-01
- **Fact.**
  - The abort fires inside call #2, so #2's `reset()` runs first. Then #1's rejection sets `error=AbortError`, and `finally` sets `isLoading=false` while #2 is still in flight.
  - Message precedence is error > created, which hides #2's success (`store/claim.js:35-52`, `generate-form-message.jsx:14-75`).
  - This happens whenever the probe takes longer than 500 ms. Reproduced in Chrome.
  - findings/06 "last wins" is wrong.
- **Change.**
  - Add as PRESERVE.
  - T-205 overlapping-retrieve case, plus a Playwright delayed-stub variant.
  - Note: a latest-wins SWR mutation port would silently fix this, which would violate M3.

### X30.10 — NEW: `checkLogo` sends GETs to `{API_URL}null` and `{API_URL}undefined`
high · C · Sources: BL-04
- **Fact.**
  - Members with a null or undefined logo trigger `fetchLogo(null|undefined)`, which sends an authorised GET to `…/internalnull` or `…/internalundefined` (`utils/data-providers-transform.js:25-34`).
  - Three `repo_id: null` members exist.
  - The data uses `billing_type` while the code tests `billingType`, so "starting" members are never excluded.
- **Change.** Extend Q-024. Add these to the T-502/T-504 handlers and request-log assertions. With `onUnhandledRequest: 'error'` they would otherwise fail unexpectedly.

### X30.11 — NEW: filter quirks
medium · C · Sources: BL-13, BL-14
- **Fact.**
  - Clear-all sends 2 identical aggregation POSTs: `reset()` sends one, and the route-change effect at `modules/filters/index.jsx:17-24` sends the other.
  - A refined query that contains the previous `q` keeps stale facet buckets, merged in with count 0.
- **Change.** Register both as PRESERVE. T-201/T-202/T-702 assert 2 POSTs for clear-all, 1 for toggle or new q, and 0 for page or sort changes. T-403 uses two distinct aggregate responses.

### X30.12 — NEW: `/data-providers` ignores its own `q` in the title and header
medium · C · Sources: BL-15, UI-12
- **Fact.**
  - The page destructures `params.query`, but the schema key is `q` (`pages/data-providers/index.jsx:36`).
  - So the title is always "Data providers search" and the header input is empty, while the results are filtered.
  - Header blur submits only below 500 px.
  - findings/07 J12 is wrong.
- **Change.** Add as PRESERVE. Pin in T-602, T-714 and T-722.

### X30.13 — NEW: other functional quirks
medium · C · Sources: UI-12, UI-14
- **Fact.**
  - CSV: reopening highlights "Current page" but sends the previous limit.
  - Report: "Repository manager" is highlighted but role is null.
  - Provider page: the first search is swallowed.
  - Works page: an empty "View on" anchor renders when there is no arXiv/PubMed link.
  - Takedown "got it" never soft-refreshes, because of the `asPath` trailing slash (`report-success-modal.jsx:29-30`).
  - Claim card: SSR always renders "Not a member yet". After hydration it flips by accounts, not billing. Requests: 1 SSR GET plus 2 browser GETs when accounts exist, 1 when none.
  - ClaimModal and SignInModal are unreachable.
- **Change.** Add Q-077..Q-082 and Q-084. Tests T-409, T-713, T-735, T-714, T-722. A 5-row accounts × billing table for V36/J25.

### X30.14 — NEW: modal layering and pointer-events traps
medium · C · Sources: UI-11
- **Fact.**
  - The header (z-index 10000) sits above the modal overlay (1030). The header stays interactive, and clicking the backdrop over the logo navigates to `https://core.ac.uk/`.
  - Esc closes a modal only when focus is inside it.
  - `hideManually` modals (CSV, the 3 report modals, success) have no X and ignore Esc and backdrop clicks.
  - `body` overflow ends as `unset`.
  - `pointer-events: none` is set on: the last-page Next button, the active page, disabled facets, the active sort item, and disabled provider arrows. Keyboard and forced clicks still fire.
- **Change.** Add Q-083/Q-085 and extend Q-045. Tests T-733/T-736. Screenshots include the header unmasked.

### X30.15 — NEW: SearchResult hooks inside `.map` and per-card logo fetch E22
medium · C · Sources: DS-10, BL-16, UI-24
- **Fact.**
  - Design SearchResult `getLogoLink()` calls `useState` and `useEffect` once per data provider inside `dataProviders.map`, under `useLogo` (`src search-result.jsx:84-110,140-143`).
  - Each provider triggers a client GET to `https://api.core.ac.uk/data-providers/{id}/logo`: hard-coded prod host, no credentials, no dedupe.
  - Callers: `templates/search/results.jsx:100` and `similar-works.jsx:71-72`.
  - This call is missing from the 06 catalogue.
- **Change.**
  - Add to Q-047 and R-033 as PRESERVE.
  - Add E22 to the endpoint catalogue.
  - T-417 adds an MSW handler and per-provider count. T-702 includes E22 in its baseline.

### X30.16 — Singleton client store persists across navigations
low · P · Sources: BL-26(P)
- **Fact.**
  - `report.error` shows on `/outputs/update/` if the user navigates away while the error is set.
  - `activeLimit` and `Filters.initialData` also persist.
  - Found by code reading only.
- **Change.** Add a Q row and an SPA-hop test (T-206/T-713). Phase 6 keeps a client singleton and a per-request server store.

### X30.17 — `t` parameter injection and repeated `t`
low · C · Sources: BL-17
- **Fact.**
  - `?t=a%26b%3Dc%20d` reaches upstream as `?t=a&b=c+d`.
  - `?t=x&t=y` throws on `t.split` and returns a 200 soft-404 with zero upstream calls.
- **Change.** Extend Q-016. Add both inputs to T-501/T-502/T-504 with the exact upstream URL.

### X30.18 — Q-053 rewrite: exact meta-tag set per page type
medium · C/U · Sources: HC-06, EM-08(U)
- **Fact.**
  - **Works:** `citation_title`, `citation_author`, `citation_publication_date`, `DC.creator`, `DC.title`, `DCTERMS.abstract`, plus JSON-LD.
  - **Outputs:** all of the above plus `DC.identifier` (oai) and `DC.subject`.
  - **Absent everywhere:** `citation_pdf_url`, `DC.format`, `DC.issued`, canonical, robots, OG and Twitter tags.
  - `description` appears only on `/data-providers/`. There is no `<html lang>`.
  - JSON-LD `author.name` is an object, and `datePublished` is the raw value.
  - robots.txt, sitemap, manifest and favicon.ico are not served by this app; the favicons are absolute core.ac.uk URLs. Which service answers them is UNCONFIRMED.
- **Change.** Replace Q-053 with a per-type table. T-602 keeps one expected set per page type.

### X30.19 — Corrections to existing quirk rows
medium · C/U · Sources: RH-02, BL-08, RM-23, EM-17(U), NE-04, UI-16, RM-20
- **Change.**
  - **Q-009:** see X10.4.
  - **Q-022:** verified on Node 18.20.8, 20.19, 22.18, 22.23.3, 24.x and 26.12.
  - **Q-062:** the location is `templates/output/index.jsx:65-71` (state at :51). `metadata.jsx:50` only renders.
  - **Q-065:** fixed in W0b.
  - **Q-005:** `/error-card/`, `/`, `/404` and healthz are not reachable through the gateway. Routed prefixes are only `/search`, `/works`, `/outputs`, `/data-providers`, `/static/search` and `/display`. Unknown paths under a routed prefix get the "Uh-oh" 404. `/outputs/update` wins over `/outputs/[id]`.
  - **Q-052:** this is dev-only and not D1a-severe. Reclassify it as a change site with proof that prod output is identical. Allow a local bypass for the hydration inventory.

### X30.20 — Ops quirks to record (PRESERVE)
medium · C/P · Sources: TCD-01, TCD-24(P), TS-19
- **Fact.**
  - A same-SHA nightly rebuild never rolls out. With `IfNotPresent`, a mixed fleet is possible.
  - Staging has no Sentry init: there is no DSN at build time.
  - The legacy DSN host `o318858.ingest.sentry.io` is not matched by the CSP entry `sentry.io`, so prod browser events are probably blocked. The prod DSN is UNCONFIRMED.
- **Change.** Add ops Q rows. See X40.16 for the test DSN.

### X30.21 — Security notes to add (S-#)
medium · C/P · Sources: HC-12, HC-19, HC-20, NE-16(P), HC-07
- **Fact.**
  - **S-9: public source maps** (X20.11). Are they intended?
  - **Image optimizer:** reachable at `/static/search/_next/image/` (200 for a local SVG, 400 for remote).
  - **CSP specifics:**
    - `script-src` lacks `'unsafe-eval'`, so eval is blocked and the `'unsafe-eval'` token in `script-src-elem` does nothing;
    - Turbopack adds one inline script of 361 B per page;
    - trailing-slash 308s lose the CSP header from 13.5;
    - every 308 carries an undocumented `Refresh: 0;url=…` header.
- **Change.** Add S-9 and S-10 and extend S-5/S-6. T-603 pins the count of executable inline scripts and that CSP is present on every response class.

### X30.22 — `/display` and `/static/search` edge cases through the gateway
medium · C · Sources: HC-11
- **Fact.**
  - `/display/<id>` with no slash returns 308 to `/outputs/<id>/`.
  - `/display/` returns 404.
  - `/static/search` returns 200 with an empty app shell.
  - `/searchx/` and `/robots.txt` return the other service's 404, because PathPrefix matching is segment-wise.
- **Change.** Add as PRESERVE and pin in T-601/T-723 (X40.26).

### X30.23 — Small quirks
low · C · Sources: UI-18, UI-10
- **Fact.**
  - MathMarkdown renders KaTeX only. `**the abstract**` stays literal.
  - Horizontal overflow: document width 534 at 501 px and 346 at 320 px (header and action row stretched by 11 pagination items).
- **Change.** Drop the markdown fixture cases. Wait for `document.fonts.ready` before screenshots. Pin the overflow as baseline.

### X30.24 — Q-050 classification depends on the live date format
medium · C · Sources: UI-21, RM-03(P)
- **Fact.** Zone-less ISO dates render the same text in UTC, Los Angeles and Tokyo. Date-only, `Z` or offset values differ.
- **Change.** Sample the live format once. If it is zone-less, downgrade Q-050 to WATCH.

### X30.25 — Numbering and IDs
low · U · Sources: DQ-11, DQ-25
- **Change.** Q numbers are not monotonic by section (Q-050..052 sit after Q-068); add a note. Rename U1–U4 to Q-048.U1–U4.

---

### 40-test-strategy.md (+ NEW 41-test-inventory.md, 42-baselines-and-ci.md)

#### Harness and versions

### X40.1 — Jest harness: config and transforms that fail on the baseline stack
critical · C/P · Sources: TS-02, TS-10, TS-09, VER-08, VER-09, VER-32(P), VER-33, TS-28(P), NE-21, nextjs-late-20, BL-11, TS-11(P)
- **Fact:**
  - **jest.config sketch.** A top-level `transform` placed next to `projects` is ignored by inline projects. Result: `SyntaxError: Unexpected token '.'` on `*.module.css` (Jest 29.7.0 repro).
  - **Version pins.** See X02.6.
  - **ESM-only packages** that need an allow-list or a `jest.mock` factory:
    - msw 3
    - react-ga4 3
    - d3-array 3, d3-scale 4, d3-format 3
    - react-markdown 10, rehype-raw 7
    - postcss-preset-env 11, postcss-custom-media 12
    - lint-staged 17, yargs 18
    - cosmiconfig 10 is **not** ESM-only; it is CJS.
  - **next/jest is unusable here.** It:
    - always uses the SWC transformer and ignores `babel.config.js`, so legacy decorators and `export x from` fail to compile;
    - maps `.module.css` to an identity proxy **before** custom mappers, which hides R-001;
    - adds `.module.css` to `transformIgnorePatterns`;
    - replaces image imports with a fileMock that returns an object.
  - **RouterContext path per Next version:**
    | Next | Path |
    |---|---|
    | 10.2.3 | `next/dist/next-server/lib/router-context` |
    | 11.1.4, 12.3.7 | `next/dist/shared/lib/router-context` |
    | 13.5–16.4 | `next/dist/shared/lib/router-context.shared-runtime` |
  - **axios in jsdom** uses the XHR adapter (TS-28's contrary claim is refuted).
- **Change:**
  - Put `transform` inside each project.
  - Add a per-project smoke test that imports a real `*.module.css` and checks both kebab and camel keys.
  - Keep a maintained allow-list with its own self-test.
  - Use babel-jest only; never next/jest in this track. If next/jest is adopted later, an async wrapper must delete its mappers and ignore patterns, and a self-test must assert `styles.unknownKey === undefined`.
  - `test/utils/render.js` resolves RouterContext through a per-version path map.

### X40.2 — Tests under `pages/` break `next build`
high · C/V+ · Sources: TCD-04, roadmap-process-V1
- **Fact:** `pages/__tests__/smoke.test.js` → `ReferenceError: describe is not defined` at "Collecting page data" (Next 10.2.3). `next.config.js` sets no `pageExtensions`, so every `.js/.jsx` file under `pages/` is a route.
- **Change:**
  - Layer F moves to `test/pages/**`.
  - CI fails if any `*.test.*` file exists under `pages/`.
  - T-004 asserts that `pages-manifest` lists only the known routes.
  - Do not change `pageExtensions` (D1).

### X40.3 — `.gitignore` silently ignores planned test directories
high · C · Sources: TCD-05
- **Fact:** `.gitignore:7` `build` matches `test/build/`. `:16` `data/*` matches `data/__tests__/`, and the negations on `:14-15` come before it, so they have no effect.
- **Change:**
  - Use `test/static/` and `test/unit/data/`.
  - Do not edit `.gitignore` in W1.
  - CI fails if `git ls-files --others --ignored --exclude-standard` lists anything under `test/` or `e2e/`.

#### Artefact under test

### X40.4 — The tested build is not the shipped image
high · C/P/U · Sources: TS-04, TCD-10, UI-22(P), BL-19, TS-16, RP-31, TCD-11, DQ-06(U)
- **Fact:**
  - **Missing copy steps.** `build:test` (40 §2.5) skips the Dockerfile post-build copies (`Dockerfile:24-27`): `public/design/icons.svg→public/icons.svg` and `public/static/images/*→public/images/`. Both targets are gitignored, so behind the proxy every icon 404s.
  - **Live data in the golden image.** The golden image is built with the prod Dockerfile. Its `npm run build` runs the live data-loader against the hard-coded prod URLs (`data-loader.js:59-63`). Online it gets fresh data; offline it crashes. It is never the frozen snapshot. The same applies to T-901 and to the W0 "build identical" gate.
  - **NODE_OPTIONS replaced.** 40 overwrites `NODE_OPTIONS`, but k8s sets `--max-old-space-size=1024` and `UV_THREADPOOL_SIZE=32`.
  - **G6 contradiction.** G6 "nightly G2–G4 on the fresh build" contradicts the frozen-data baselines (40 §7.4).
  - **Single-image promotion is impossible.** `APP_ENV` is baked into the client bundle (`env.config.js`), so one image cannot be promoted from stage to prod.
- **Change:** 42 specifies one recipe, the Dockerfile with `ARG BUILD_SCRIPT=build|build:test`. If a separate `Dockerfile.test` is used instead, a CI diff check keeps it aligned. The recipe:
  - copy the frozen data snapshot in before `docker build`; the loader is skipped or stubbed in test builds;
  - add a `.dockerignore`;
  - run Playwright only against the image, with the prod runtime env plus the stub;
  - append to `NODE_OPTIONS`, never replace it;
  - define the compose topology: app, gateway proxy, SSR stub, Playwright runner;
  - define two artefacts:
    - a **parity image** (frozen data) for the 0-px, SEO and network gates;
    - a **release image** built once per commit; the nightly run executes only data-independent black-box tests against it.

### X40.5 — Test devDependencies change the production install
high · C · Sources: TCD-09, RP-07, TS-27
- **Fact:**
  - `Dockerfile:19` runs `npm ci --include=dev`, so test tools are installed on Node 18 in the prod image. Playwright engines ≥20 and axe ≥22.12 only warn. msw's postinstall runs.
  - A lock-only simulation of the 40 §2.7 packages changed 2 runtime entries: `@babel/helper-validator-identifier` 7.27.1→7.29.7 and `hasown` 2.0.2→2.0.4.
  - The Next 10 server externalises node_modules, so runtime behaviour can change without any `.next/static` hash changing.
- **Change:** an "inert" proof in 42 requires all of:
  - two identical builds of the unchanged tree first (reproducibility is [VERIFY]);
  - `npm ls --omit=dev --all` identical;
  - `.next/static` **and** `.next/server` identical, with the build ID normalised;
  - R-054's hoisted packages resolving identically;
  - `scripts/lock-immutable.mjs`: every pre-existing lock entry keeps its version, resolved and integrity;
  - drift pinned through `overrides`;
  - Playwright and axe moved to `e2e/package.json` with their own lock;
  - the image size delta recorded.

#### SSR mocking and the network contract

### X40.6 — The SSR mock must be wire-level and use prod's Internal_API path
high · C/P/U · Sources: TS-03, BL-10(P), BL-31, BL-08, EM-22(U)
- **Fact:**
  - **Wire vs app headers.** In-process MSW records the headers the app sets. Its Host shows the `api.core.ac.uk` override, but undici actually sends the service host. User-Agent `node` and `Accept-Encoding: gzip, deflate` are invisible to it.
  - **Internal_API missing by default.** The default harness never sets `Internal_API`/`Internal_API_HOST`, which prod sets (`kube/prod/deployment.yaml`). Only T-607 (P1) does.
  - **What already works.** T-104 and T-607 already assert the wire Host. The gap is the §1 "Network (server)" row, plus UA, Accept-Encoding and GET Content-Type.
  - **Preload feasibility.** A plain `--require` fetch wrapper and msw ≤2.11.1 both intercept SSR under `next start` on Node 18. Next 13.5–16 render in-process, so the preload is inherited.
  - **Working prototypes exist:** `exp/business-logic/mock/mock.js` (wire recorder), `preload-fetch.js`, the CSP-strip proxy trick, and the empirical `tools/fetchlog.js`.
- **Change:**
  - The primary SSR mock becomes a real HTTP stub process. It records method, URL, headers and body at socket level, with an allow-list for normalisation.
  - Every run sets `Internal_API=http://stub` and `Internal_API_HOST=api.core.ac.uk`, as prod does.
  - MSW is used for Jest only.
  - T-104 never runs with MSW active.
  - Run the baseline once with egress denied, to discover any other hosts.
  - Promote the prototypes into `test/`.

### X40.7 — Hydration detection is blind on React 17; add positive detectors
high · C/P · Sources: TS-06, RM-04, UI-23, RM-05(P), nextjs-late-13(P), RM-14(P)
- **Fact:**
  - **Prod is silent.** React 17 production has 0 "did not match" strings; only the dev build has them.
  - **Dev never SSRs.** `NextApp` returns null on the server in dev (`_app.jsx:139-155`). T-701's "React 17 allow-list" is therefore dead text.
  - **Silent structural repairs.** React 17 prod silently inserts the consent popup and deletes the `/display` breadcrumb tail.
  - **Where React 18+ reports.** Through `reportError` → window `error` events (#418/#423/#425), not `console.error`.
  - **Existing coverage of `/display`.** T-723 covers `/display` via the proxy but asserts no hydration result.
- **Change:**
  - **(a) Phase-2 React-17 dev inventory.** Bypass the dev wrapper (uncommitted change or test flag). Cover routes × fixtures × TZ (UTC, America/Los_Angeles, Asia/Tokyo) × cookie {absent, present}. Every hit becomes a Q row.
  - **(b) P0 T-728.** Per route, diff the no-JS DOM against the hydrated DOM (text and attributes), plus a MutationObserver during hydration. The pinned diff is the allow-list T-701 uses on React 18/19.
  - **(c) T-701 channels.** Listen to `pageerror`, `console.error` and window `error`.
  - **(d)** Run `html-validate` on the T-602 snapshots.
  - **(e)** Run `/display/:id/` through the proxy in T-701 and T-723.
  - **(f) Cookie matrix.** Run T-701, T-702 and the request logs with the cookie absent and present. Assert Sentry ingest, `/account` and LogRocket counts equal the baseline in both.
  - Run the detectors on WebKit and Firefox too.

### X40.8 — T-708/J6 is red on the baseline
critical · C/P · Sources: UI-01, nextjs-late-07(P), nextjs-late-V1, RH-16
- **Change:**
  - Split J6:
    - T-602 = the raw SSR head;
    - **T-729** = the post-hydration head.
  - T-729 is pinned **per fixture** on the real app with the real Meta. Fixtures vary author and subject counts.
  - For 15+, also pin the head after client navigation and keep a per-Next-version expected diff.
  - Delete "none removed".

### X40.9 — T-602 must check raw `<title>` bytes
high · C/P · Sources: RM-01, HC-02, RH-01, HC-10(P)
- **Change:**
  - Parse the HTTP body with a DOM parser, JS off. Never strip comments inside `<title>`.
  - Fix the normalisation list:
    - `data-n-head` never occurs;
    - `data-reactroot` appears only from Next 12;
    - `next-head-count` (Next 10–14) and `data-next-head` (15+) are framework-owned;
    - the charset/viewport swap at 12.
  - Compare app-owned tags (title, citation, DC, description, JSON-LD, favicons) in order.

### X40.10 — HTTP parity contract: turn it into data plus a signed deltas ledger
high · C/P/U · Sources: HC-07, NE-13, nextjs-late-08(P), nextjs-early-V1, HC-18, HC-16, EM-16(U), TCD-22(P), TS-24(P)
- **Fact:** measured framework drift from Next 10.2.3 to 16.4.2:
  - **Cache-Control.**
    - It is added on 404, 500, the gSSP 308 and gIP-only pages (`/`, `/error-card/`, `/outputs/update/`) from 12.3.
    - The change is non-monotonic across 12.3, 13.5, 14.2 and 15.5. Example: the 308 has none on 10.2.3 or 14.2.35, but `private, no-cache, no-store, max-age=0, must-revalidate` on 12.3, 13.5 and 15.5.
    - gSSP pages already send it on 10.2.3.
  - **Headers and responses.**
    - ETag and Content-Length are lost with React 18 on 12.3.7 (chunked).
    - The ETag format changes from 13.
    - Trailing-slash 308s lose CSP from 13.5.
    - `_next/data` gains a charset and `x-nextjs-matched-path` at 15.
    - The 308 body changes from `''` to the target path.
    - `Refresh: 0;url=` appears on every 308.
  - **Markup and assets.**
    - Scripts change from async to defer at 12.3.
    - CSS-module hash suffixes change at 12.3 and 13.
    - Media names change from 32-hex to 8-hex at 12.
  - **Observed baseline and stg values:**
    | Route class | Cache-Control |
    |---|---|
    | HTML, `_next/data` (gSSP) | `private, no-cache, no-store, max-age=0, must-revalidate` |
    | chunks | `public, max-age=31536000, immutable` |
    | `icons.svg` | `public, max-age=14400` (may be a Cloudflare TTL) |
    | `.map` | 200, immutable |

    `x-powered-by: Next.js` is present. 40 §9.5 does allow an owner decision, but no format exists for recording one.
- **Change:**
  - `e2e/http/contract.baseline.json` plus a deltas file with fields `{wave, route, header, from, to, reason, signedOffBy}`. Default is deny. The deltas are seeded from the http-contract report matrix and signed by the owner (OD-28).
  - **T-603** compares header *values* per route class at the origin container and through the proxy. Route classes: HTML, `_next/data`, `public/`, `_next/static`, `.map`, `icons.svg`, 404, 500, healthz.
  - Add `test/baseline/ACCEPTED-DIFFS.yml` with fields (test id, key, old, new, OD/Q ref, wave, approver). Baselines are never edited, and any diff not in the ledger fails.
  - **T-010** compares normalised (source, destination, headers) tuples.

### X40.11 — Class census replaces T-605; fix T-003 hash stripping
high · P · Sources: TS-05(P), RH-11(P)
- **Fact:**
  - **Undefined classes omit the attribute.** There are 251 `className={styles.x}` sites. When `styles.x` is undefined, React omits `class` entirely, so neither `class=""` nor `class="undefined"` appears.
  - **The helper only shows the all-missing case.** The design classNames helper yields `""` only when every class is missing (53 sites).
  - **Jest cannot see a patch no-op**, because the Jest CSS transform always emits camelCase keys.
  - **Class-name hashes are not stable.** md5 on 10 and 12, sha1 on 13+, and vendoring path moves change the hash input.
  - **T-003 hash stripping merges unrelated selectors**, because most module files are named `styles.module.css`. Files containing each token: container 6, header 5, label 4, title 3, action-button 3, card 2, pagination 2.
- **Change:**
  - New census compares (DOM path, ordered class tokens), normalised to `[name]_[local]`.
  - Run it on SSR output and on post-interaction DOM, including client-only modal states such as the claim-success `<image href>`.
  - Key T-003 by source file plus local class.
  - The R-001 mutant must be killed without relying on T-801.

#### Visual determinism and coverage

### X40.12 — Pixel determinism
high · C/U · Sources: TCD-12, TS-12, DQ-19(U), UI-18
- **Fact:**
  - The design font stack (`type.css:3-11`: roboto, arial, Noto Sans, sans-serif) has no `@font-face`, so the container's fontconfig decides the pixels.
  - Prod and the runners are arm64 (`ubuntu-24.04-arm`), and MCR publishes per-arch tags. Yet 40 builds both architectures and names only `v<X.Y.Z>-noble`.
  - The proof of "3 identical runs" comes from one host on one day.
- **Change:**
  - **Image.** arm64 only. Derive an image from Playwright 1.64.1 noble-arm64, pinned by digest, with pinned fonts (fonts-roboto, noto). Record `fc-match` output in `env.json`.
  - **Stability proof.** 10 runs over 2 days on 2 hosts, one of them a Mac. Shuffle the order and use workers 1 and 4. All runs must be identical.
  - **Flakes.** `retries: 0`. A flaky test counts as a failure. Budget: fewer than 1 per 100 runs.
  - **Snapshots.** `toHaveScreenshot` with `animations: 'disabled'` and `caret: 'hide'`. Wait for `document.fonts.ready` (KaTeX).
  - **Canaries.** A nightly golden canary. GATE-S runs golden vs candidate as an A/B comparison in one job. Run a cross-arch determinism experiment.

### X40.13 — Randomness and clock
high · P · Sources: TS-13(P), TS-30
- **Fact:**
  - **Featured-member random.** `pickFeaturedMember` calls `Math.random` after `reqId` does (`pages/search/index.jsx:49`). With a seeded PRNG, the chosen member therefore depends on call count, test order and library versions.
  - **Masks conflict.** 07 §5 masks the member card; 40 says the mask list is empty.
  - **Server clock.** It feeds only `MAX_YEAR` (`use-year-filter-controller.js:6`, computed at module load) and a loader timestamp.
  - **`page.clock.install()`** does not freeze time. The claim that it does is dropped.
- **Change:**
  - Page tests use a `/members` fixture with exactly one eligible member. Multi-member selection is tested in Jest T-113.
  - 40 overrides 07 §5: no masks, and the tolerances are the ones in 40.
  - Use `setFixedTime` for visuals.
  - Freezing the server Date is optional (low value).

### X40.14 — Viewports, states and catalogue gaps
high · C/P · Sources: TS-14, UI-10, TS-15, RH-11(P), UI-09(P), UI-19(P), UI-25(P), RH-09
- **Fact:**
  - **Breakpoints in shipped CSS.** 768 (min and max), 780 and 876 (unused documentation CSS), 93rem/1488 (with min 768), 48rem, 85rem/1360, 80rem/1280, 35rem/560, 33rem/528, 22.5rem/360, 950, 767 and 1200. JS uses siblingCount 500/501.
  - **Widths T-801 misses.** It uses 1440/768/767/375, so nothing ≥1489 or ≤360 is ever rendered.
  - **Measured overflow:** 534 px at 501, 346 px at 320.
  - **States not covered:**
    - no hover, focus-visible or active captures;
    - no visuals after client navigation;
    - the advanced-search panel;
    - header menus and the hamburger;
    - the collapsed header search (magnifier on `/works` and `/outputs`);
    - the scrolled sticky header with the fixed filters bar;
    - pre-hydration snapshots;
    - the 500 page in light and dark;
    - blank-page states;
    - the CSV and report modals at 767, which depend on fieldset `@media (--screen-until-desktop)`.
  - The suggestions dropdown is already V14.
- **Change:**
  - **Viewports.** Full pixel matrix at 1920, 1440, 768, 767 and 375. Width sweep (1280, 1024, 600, 561/560, 501, 500, 360, 320) on two light shells, plus a geometry census (`getBoundingClientRect`, display and visibility per element) at each band width.
  - **T-805 computed-style census.** Fixed property list. CDP `CSS.forcePseudoState` for hover, focus, focus-visible and active on interactive elements.
  - **T-806 ARIA snapshots** (`toMatchAriaSnapshot`).
  - **Catalogue.** Adopt V21–V39 and J18–J32 from ui-flows.md. One canonical V list.
  - **Tiers.** P0/P1/P2 tiering controls per-PR cost only. Every gate runs all tiers.

### X40.15 — Journeys and selectors
high · C · Sources: UI-13, UI-08, UI-11
- **Fact:**
  - **Wrong IDs in 07 §8.3.** The real IDs are:
    - cards: `work-search-output-N`, `work-similar-output-N`;
    - `#metadata-authors-title`;
    - `#doi` only after hydration; the `author` and `doi` IDs repeat;
    - `#data-provider-url` is the wrapper and `-control` is the input;
    - the header input is `#select-app-bar-search`;
    - `about-title` appears twice.
  - **Full-page navigations.** Result titles link to the absolute `https://core.ac.uk/works/…/?t=&search=<raw>`. Author links are relative and go through a 308.
  - **T-702 is self-contradictory.** It expects "open a work, Back, 1 document request, marker survives", but opening a work is a full navigation.
  - **Pointer-events.** The Next button cannot be clicked with the mouse.
- **Change:**
  - Fix the IDs in ERRATA. Prefer role and label selectors. Put duplicate IDs in the axe baseline.
  - Fixture `links[].url` uses the gateway host.
  - J5 asserts the href shape and that the navigation is full.
  - T-702 records the navigation type.
  - Use keyboard or force clicks, with the reason noted.

#### Third parties, analytics, Sentry

### X40.16 — GA, LogRocket and Sentry assertions
high · C/P/U · Sources: TS-20, UI-03(P), EM-09(U), TS-19, TCD-24(P)
- **Fact:**
  - **GA.** §2.5 blocks GA and GTM, so T-719's "collect hits" can never fire.
  - **LogRocket.** The prod build's LogRocket init hits the real project.
  - **Sentry.** The test DSN `https://k@sentry.io/1` exactly matches the CSP entry `sentry.io`, which masks R-026.
- **Change:**
  - **GA.** Serve a pinned `gtag.js` through `route.fulfill`, or spy on `dataLayer`/`gtag` arguments with an init script. Expected: exactly one config hit on hard load with consent, zero on client navigation. The warning is pinned in the console allow-list (T-741).
  - **Third parties.** Abort every non-gateway host: logrocket, lgrckt-in, logr-in, google*, sentry, cloudflareinsights, openstreetmap. Route api.core.ac.uk and doi.org to fixtures.
  - **Sentry.** Use a DSN with the prod host shape, `https://public@o0.ingest.sentry.io/0`, routed to a counting stub. Pin whatever CSP outcome results.
  - Keep `GA_TRACKING_CODE` set in test builds.

#### Staging, soak, canary

### X40.17 — Staging soak and canary are not prod-equivalent and not measurable
high · C/P/V+ · Sources: TS-17(P), TS-18, RP-17(P), RH-06, test-strategy-V1, roadmap-process-V2, BL-09, BL-20
- **Fact:**
  - **Capacity.**
    | | Replicas | CPU | Memory limit |
    |---|---|---|---|
    | Stage | 1, no HPA | 1200m/1500m | 1Gi |
    | Prod | HPA 4–15 | 300m/600m | 768Mi |
  - **Stage never exercises the internalised API path.**
    - Stage builds with `APP_ENV=staging`, so `API_URL=api-stg.core.ac.uk` and is never internalised (`internalize.js:24`).
    - Only the hard-coded loader URLs take the Internal_API path, and only on a cache miss.
    - So T-902's "Host seen by the internal API" and R-016 cannot be observed before prod.
  - **Stage's Internal_API points at the PROD service** (`core-frontend` namespace). Any prod-config or replay soak in stage therefore loads prod backends.
  - **Traffic and thresholds.** Stage traffic is about zero, and T-902 has no thresholds.
  - **No canary exists.** There is one Deployment (RollingUpdate maxSurge 2) and a single backendRef.
  - **Mixed versions during rollout** 404 on `_next/data/<buildId>`.
  - **Upstream failures** render 200 pages and are not logged.
- **Change:**
  - **Soak.** Use an in-namespace stub, or a low-rate synthetic replay (≤2 rps of about 200 sampled URLs) with ops sign-off. Use prod-equal limits.
  - **Thresholds.**
    - 0 restarts and 0 OOMKills;
    - 5xx ≤ baseline;
    - p95 ≤ 1.10×;
    - RSS ≤ 1.10× and <700Mi.
  - **T-903.** Rename it "prod rollout watch 48 h" (thresholds in 45 C6). The alternative is for ops to add a weighted canary: a second Deployment plus HTTPRoute weights, ≥24 h, ≥100k requests, auto-rollback. Verify every telemetry pipeline first.
  - **Residual gap.** The in-cluster Host path is verified only in prod. Add a prod-only check on the first rollout of W4(e) and of phase-6 axios: ops log of Host and Authorization, plus a 5xx/Sentry watch, with rollback on breach.

#### Additional black-box oracles

### X40.18 — Compare `__NEXT_DATA__`, `_next/data` and server output
medium · P/C · Sources: TS-22(P), RH-07, nextjs-late-19
- **Change:**
  - **T-608a.** Deep-equal the normalised `__NEXT_DATA__.props` per route, and the normalised `_next/data` JSON for client navigations.
  - **Server stdout/stderr census.** Only unconditional lines (console.time) print in prod. Allow-list the uncaughtException logs Next adds from 13.5/16.
  - **Stub-side counts.** Count server-side Sentry events at the stub; expected 0.

### X40.19 — Crash-semantics test (T-608b)
medium · C · Sources: TS-21, RH-02
- **Change:**
  - A test-only preload triggers an async throw. With a prod-shaped DSN, assert exit 1 within about 3 s.
  - Without a DSN, the process survives.
  - On `unhandledRejection`, the process survives and 1 event is sent.
  - Re-run after every Sentry or Next bump.

### X40.20 — Concurrency and isolation test (T-609)
medium · C · Sources: TS-23
- **Change:**
  - Fire 200 interleaved parallel SSR requests (q=A/q=B, works 1001/1002) with randomised stub latency.
  - Each HTML body and each `__NEXT_DATA__` must contain only its own request's data.
  - Run every wave and every phase-6 PR. This is the black-box detector for R-004.

### X40.21 — Fixtures
medium · C/U · Sources: EM-15(U), BL-03, BL-02, UI-21, RP-28, UI-08
- **Fact:**
  - **API key required.**
    - Anonymous access allows 10 requests per window.
    - A 429 locks for 10 minutes.
    - A bad Bearer token returns 401.
  - **Shapes differ by type:**
    - `work.yearPublished` is a number; `output.yearPublished` is a string;
    - some `dataProviders[]` entries have no id;
    - some search items lack `links`.
  - **The live API returns 500** for some endpoints.
- **Change:**
  - Record fixtures once, with a real key, into the frozen snapshot.
  - **Derive** edge cases from real objects.
  - Add a shape-variance family: null/undefined for every dereferenced field (`outputs[].doi`, `sourceFulltextUrls`, `dataProviders`, `links`, `location`).
  - Record the live 410 body and the publishedDate format.
  - Apply the public-repo policy (OD-24/25).

### X40.22 — Per-action request contract and T-702 normalisations
medium · C/P · Sources: BL-13, UI-14, RM-14(P), BL-28(P), UI-20(P), BL-16, BL-04
- **Fact:** per-action request counts on the baseline:
  | Action | Requests |
  |---|---|
  | clear-all | 2 × E2 |
  | toggle a facet or new q | 1 |
  | page or sort change | 0 |
  | `/data-providers/[id]` `/account` | 1 SSR un-awaited + 2 or 1 browser; +1 per re-render (modal open) |
  | E22 | per card and per provider |
  | `checkLogo` | `null`/`undefined` URLs |
  - **Run-to-run variance.** OPTIONS preflights vary with Chromium's 5 s cache. Under axios, resourceType changes from `fetch` to `xhr`.
  - **SSR outbound.** Only doi.org and API_URL. Loader calls happen only when the `data/*.json` cache is missing; the committed state has the cache. Keep stubs as a safeguard.
- **Change:**
  - Encode the counts above in T-702 and T-412.
  - Normalise OPTIONS and resourceType.
  - Assert method, URL, body and headers.

### X40.23 — Tighten T-604/T-702 and add a version-skew case
low · P · Sources: HC-17(P), nextjs-late-02 (refuted; residue)
- **Change:**
  - T-604 requires `content-type: application/json` and `JSON.parse(body).pageProps`. Also cover:
    - the no-params `__N_REDIRECT` JSON;
    - data-providers `{notFound: true}`;
    - a stale buildId returning 404, plus the hard-navigation fallback (verified on 10.2.3, 14.2, 15.5 and 16.4).
  - T-702 asserts the `/search/_next/data/` prefix and 0 pageerrors.

### X40.24 — Sprite, assets and media
medium · C/P/U · Sources: DS-07, EM-13(U), DS-17(P), DS-09, NE-10
- **Fact:** the prod Docker sprite (`NODE_ENV=production`) has **48** symbols. A local build has 49, including `file-check`. Both contain the duplicates office-building, account and open-in-new. T-005 and R-022 say 49.
- **Change:**
  - T-005 takes the expected set from the golden image and records a byte hash.
  - T-801 setup asserts the sprite returns 200 `image/svg+xml` and that at least one `<use>` has a non-zero `getBBox()`.
  - G4: the `.next/static/media` name set equals the baseline: 60 KaTeX fonts, slick eot/woff/ttf/svg, ajax-loader.gif.
  - T-005 pins 9 file URLs and 5 data URIs.

### X40.25 — Budgets
medium · C/U · Sources: HC-13, EM-14(U), NE-25
- **Fact:** baseline response sizes:
  | Route | Raw | Gzip |
  |---|---|---|
  | `/data-providers/` | 7,104,305 B | 1,003,968 B |
  | its `_next/data` JSON | 7.0 MB | |
  | `/search/` | ~66 KB | |
  | `/works/1/` | ~67 KB | |

  - **Why `/data-providers/` is so large.** The formap JSON in `__NEXT_DATA__` is 6.96 MB.
  - **RSS (U).** Idle 95 MB, 296 MB after one SSR page, about 530 MB after `/data-providers/`. The k8s limit is 768Mi.
  - **Shared first-load JS.** 1.26 MB on 10.2.3, 1.24 MB on 10.2.3+wp5 and 12.1.6, 1.27 MB on 12.3.7. The chunk graph changes, so per-chunk baselines cannot carry over.
- **Change:**
  - T-611: per-route raw and gzip byte budgets, ±5%.
  - RSS after the P0 route sweep stays within +10%.
  - T-007 budgets per route (±10% gzip first-load) instead of per chunk name.

### X40.26 — Proxy replica generated from the gateway YAML
medium · C · Sources: TS-26, HC-14, UI-16, HC-11
- **Fact:**
  - **Matching semantics.** Gateway API PathPrefix matches path elements and the longest prefix wins. 40 writes `/search*` globs, which is wrong. The YAML also sets ReplacePrefixMatch and 35 s/30 s timeouts.
  - **Deploys.** `kubectl apply` of `httproute.yaml` runs on every push and every nightly. The prod and stage files differ only in namespace and hostname.
- **Change:**
  - Generate the proxy rules from both YAML files in test setup, and assert they differ only in those fields.
  - Add a conformance table: `/searchx`, `/static/search`, `/display`, `/display/1/`, `//works/1`, `%2F`, a unicode q, `a+b`, a long URL, `/_next/...`.
  - Run the main proxy gateway-faithful. Use a second allow-all proxy for local-only pages: `/error-card/`, `/`, healthz.
  - Roll YAML changes to stage first.
  - The gateway controller is [VERIFY].

### X40.27 — Runtime env contract and operational checks
medium · C/P · Sources: HC-08, TCD-25, RH-17, TCD-33(P)
- **Fact:** `next.config.js` is evaluated again at `next start`.
  - `env.config.js` throws if `API_KEY` is missing.
  - `assetPrefix` comes from `BUILD_TARGET`. If it is unset, assets are emitted under `/_next/static/*`, which the gateway does not route: the page is unstyled and has no JS. Verified on 10.2.3–16.4.
  - Today only the image `ENV` supplies these values; the kube manifests do not.
  - Ops (TCD-33): prod `--max-old-space-size=1024` exceeds the 768Mi limit (OOMKill before GC); healthz does not exercise SSR and is not publicly routed (308 on stg); SIGTERM behaviour per Next major is UNCONFIRMED.
- **Change:**
  - Document the required env: `API_KEY`, `BUILD_TARGET`, `NODE_ENV`, `APP_ENV`. Optional: `Internal_API*`.
  - T-901 asserts the image env. It runs with `--memory 768m`, the exact deployment env, and a build context from `git archive`.
  - Negative control: starting without `BUILD_TARGET` must fail T-721.
  - The `HOSTNAME` requirement for standalone mode is [VERIFY] (OD-19).
  - T-902: 0 5xx during a stage rollout under load for each Next major; re-tune memory only with T-905 data.

### X40.28 — Protocol for changing the harness mid-track (§2.8)
medium · C · Sources: TS-08, nextjs-late-23
- **Fact:**
  - **RTL 16 query changes.** RTL 16 needs `@testing-library/dom` ^10; dom 9 and 10 changed ByRole options and roles.
  - **dom 10 with RTL 12.** Events are not act-wrapped, so `configure({eventWrapper, asyncWrapper})` must be set.
  - **React 18.3 dev warnings.** Using defaultProps on Histoslider and MathMarkdown triggers a warning, which turns the console gate red at W6.
  - **Router mock gaps.** The mock lacks `prefetch`, and the RouterContext path moves 3 times.
- **Change:**
  - Harness PRs touch only `test/**` and config, one per PR. Each must give identical results against the golden commit.
  - Use dom 10 queries from day one.
  - Add a generated router-mock contract test.
  - Version the console allow-lists per React/Next version; each entry cites an R- or Q- ID.

### X40.29 — Test rules for StrictMode, isolation and settled states
medium · C · Sources: RM-12, RM-22, RM-19
- **Fact:** `reactStrictMode: null` maps to false (`next@16.4.2 config-shared.js:130`, `define-env.js:149`). Under StrictMode, FiltersBar fires `fetchFilters` twice and the second call takes the merge branch.
- **Change:**
  - Gating tests are never wrapped in StrictMode. Remove T-301's StrictMode case.
  - T-209 runs in the node project with `jest.isolateModules`, in its own file. `isServer` is computed at module load, and `enableStaticRendering` is process-global.
  - Call `clearTimers()` in `afterEach` from W3 (mobx-react-lite 4).
  - Tests assert settled states (`waitFor`), never render counts.

### X40.30 — Harness page T-802 must use a separate build (resolves OD-30)
medium · C/P · Sources: RP-30, TS-25(P)
- **Fact:** Next 10 sets `commons minChunks = totalPages` (`webpack-config.js:45`). Adding a harness page therefore changes chunking, so a T-801 run on the same build does not represent prod.
- **Change:**
  - `build:harness` copies the page into `pages/` only for that build, or the harness lives in a separate `e2e/harness/` app.
  - T-004 asserts the page is absent from the prod `pages-manifest`.

### X40.31 — Phase-2 lint gate and baseline paths
medium · C/U · Sources: TCD-13, DQ-22(U), RP-33
- **Fact:**
  - Test files turn today's ESLint red: there is no jest or playwright override.
  - `lint:json` would scan the fixtures.
  - The baseline JSON files embed sandbox paths: 156 and 28 entries starting `<sandbox-root>/search`.
  - Baselines reproduce on Node 18 and 24 after path normalisation: 13 ESLint and 16 stylelint findings.
- **Change:**
  - Add overrides for `test/**` and `e2e/**`.
  - Add `.prettierignore` and both `--ignore-path` flags.
  - `scripts/lint-parity.mjs` normalises paths to repo-relative and compares (path, rule, count).
  - Fixture recorders emit Prettier-clean JSON.

### X40.32 — CI workflow structure (spec goes in 42)
medium · P/C · Sources: TCD-27(P), TCD-26, TCD-20, TCD-34, TCD-02, TCD-31(P)
- **Change:** workflows:
  - **`ci.yml`.** Triggers: pull_request on main/stage, merge_group, workflow_call, workflow_dispatch. Runs on `ubuntu-24.04-arm` with `permissions: contents: read, packages: read`. Jobs:
    - **lint** on Node 24;
    - **unit** on the app Node, with `TZ=UTC`;
    - **image** — one recipe; T-002..T-010 run on the `.next` extracted from the image; assert `lib/config.js`; run lock-immutable;
    - **e2e** — docker compose, Playwright via a digest-pinned arm64 image; only this job fetches LFS;
    - **gate** — the only required check, `CI / gate`.
  - **Deploy workflows** call `ci`. The prod job has `if: github.ref == 'refs/heads/main'`. Concurrency groups `aks-prod`/`aks-stage` with cancel-in-progress false. The stage schedule checks out `stage`.
  - **Extra workflows:** `baseline-capture`, `golden-canary`, `gate-s`.
  - **Repo settings:**
    - `dependabot.yml`: github-actions weekly, npm limit 0 during the track;
    - setup-node with `registry-url`, scope `@oacore` and `NODE_AUTH_TOKEN`;
    - fork and dependabot PRs get no secrets, so secret availability is a prerequisite for the image job;
    - pin third-party actions by SHA;
    - no `paths-ignore` on required workflows.
  - **Acceptance.** Accept this only after a prototype `ci.yml` has run green on a branch. The image build takes about 78–81 s.

### X40.33 — Baseline storage on a public repo
medium · P · Sources: TCD-28(P), RP-28
- **Fact:**
  - **LFS quota.** On a Free org: 10 GiB storage and 10 GiB/month bandwidth, and Actions downloads count against it.
  - **Public data.** The repo is public, so any committed PNGs and fixtures are public too.
  - **Unknowns.** The org plan and the real PNG volume are UNCONFIRMED.
- **Change:** in OD-24/25, either only the e2e job fetches LFS, or baselines are stored as an OCI artifact (ORAS) in private GHCR next to the golden image digest. Fixtures go through PII scrubbing and a licensing check.

### X40.34 — Live smoke T-907 and the edge checklist
medium · C · Sources: RP-31, TCD-21, HC-15
- **Fact:** `curl` to core.ac.uk returns 403 `cf-mitigated: challenge` for both curl and Chrome User-Agent headers. stg returns 200.
- **Change:**
  - After every stage and prod deploy, run a read-only smoke from **inside the cluster**:
    - status codes for the route matrix;
    - citation/JSON-LD presence and order on 5 fixed works;
    - `_next/data` client navigation;
    - 0 pageerrors;
    - 3 sentinel computed styles;
    - GA collect.
  - Add a manual edge-contract checklist to T-904, compared before and after each wave: headers on `/works/<id>/`, `_next/data` and `/static/search/**`, including `cf-cache-status`.

### X40.35 — Detector inventory: the "two layers" claim is false
medium · P/U · Sources: TS-07(P), TS-29(P), DQ-21(U)
- **Fact:**
  - **R-004** has only Jest T-209.
  - **R-014's** second layer (T-901) does not detect masking.
  - **R-018/R-019** are covered by Playwright only, because the router mock is static.
  - **T-203 and T-209** use MobX APIs, so they get rewritten through the driver contract, not re-run.
  - **The traceability snippet** counts mentions, not detections.
  - **Phase-6-only P0 tests** stay P0, since they characterise the unchanged app.
- **Change:** 41 gets these per-risk columns: black-box detector, white-box detector, mutant killed by. Restate the rule as "each C/H risk has ≥1 black-box detector, proven by its mutant".

### X40.36 — Consistency fixes and making 41 authoritative
medium · C/U · Sources: TS-30, DQ-10(U), DQ-13(U)
- **Fact:**
  - **Wave↔test mismatches (40 §4 vs 50 §4).** 35 test/wave pairs in 40 are missing from 50, and 10 pairs contradict, e.g. T-205/206/207/210 W3 vs phase 6, T-003/004/005 W0 vs W4+.
  - **Risk↔test links.** 13 links in 10 are not mirrored in 40, and 38 links in 40 are not mirrored in 10.
  - **Non-normative sources.** 28 tests take their case lists from the non-normative findings.
  - **Factual slips.**
    - 40 §2.2 cites R-010 wrongly.
    - MAX_YEAR is at :6, not :4.
    - T-004 is not tagged W2.
    - The Wave column is undefined for P0 tests.
    - The container tag has no arch or digest.
    - Stale counts: 59 vs 66 module-css importers; 428 vs 430 style reads.
- **Change:**
  - Make 41 authoritative for both Wave and Risks.
  - Generate the 10 "Tests" column and the 50 lists, or delete them. Delete 40 §5.
  - Lift the 28 case tables into 41.
  - Define the Wave column as "waves where a failure is expected; all P0 tests run every wave".
  - Pin the container as tag + arch + digest.
  - `tools/check-docs.py` fails CI-1 on drift.

### X40.37 — Data-loader tests (T-117)
medium · C · Sources: BL-18
- **Change:** add these cases: empty array (exit 0, files `[]`), 500 (exit 1, partial write), HTML (exit 1), hang (with a test timeout). Assert exit codes and file contents on Node 18.

### X40.38 — Phase-6/7 tests to add
medium · P/V+ · Sources: DT-25(P), dashboard-target-V-01, dashboard-target-V-02, DT-05, DT-11, BL-24(P), DT-04(P)
- **Fact:** the plan already has T-502, T-602, T-209, T-701 and T-702.
- **Change:** add:
  - antd cascade probes: `getComputedStyle` per restyled component, plus layer rules;
  - an old-vs-new transport differential on **raw request bytes** (headers including Content-Type, Accept, UA and Host; body bytes) and on error deep-equality, for T-101, T-102, T-104 and T-205;
  - a tsconfig strict-ratchet gate;
  - a zustand client-singleton hydration test: hard load and client navigation on `/data-providers`;
  - 0 post-hydration requests for SWR-backed data;
  - SSR citations present;
  - a selector-stability render-count check (internal only).

### X40.39 — W5 vendoring gate
→ X55.4

### X40.40 — Audit gate
→ X02.17

---

### NEW 45-confidence-model.md (M7)

### X45.1 — Define and measure "≥95% confidence"
critical · P/C/V+/U · Sources: TS-01(P), test-strategy-V2, RP-06, RM-13(P), DQ-02(U), DQ-21(U)
- **Fact:** "95%" appears only as prose (README:13, 10:10, 40:172, 90:30). There is no metric, fault injection, mutation score, coverage target, flake budget, corpus or threshold. The traceability check proves only that a test ID is *listed*.
- **Change:** create 45 with these criteria. Thresholds are proposals; the owner ratifies them in OD-35.
  - **C1 Detector efficacy.**
    - `test/faults/R-###.patch` holds ≥1 scripted fault per C/H risk and per SILENT risk that can be **reproduced on the baseline**. Example faults:
      - delete the camelCase hack → T-002/T-801;
      - drop `useInterceptNextDataHref` → T-702;
      - reorder `citation_*` → T-602;
      - module-singleton server store → T-209/T-609;
      - send the Host override → T-607;
      - axios default Accept → T-101;
      - bump design → T-008.
    - Risks that exist only with the upgraded dependency (R-010, R-014, R-017, R-027, R-045, …) are tested against the real candidate instead.
    - Gate: 100% detected. With 59/59 faults detected, recall ≥95% at one-sided 95% confidence (0.95 = 0.05^(1/59)). Otherwise use the exact binomial lower bound ≥0.95.
    - A fault caught only by T-801 is flagged "single-layer".
    - Publish the kill matrix per wave.
  - **C2 Mutation score.**
    - StrykerJS on `api/ utils/ store/ hooks/ lib/ data/ templates/**/{utils,hooks}`.
    - Thresholds:
      - ≥80% overall;
      - ≥90% on `api/index.js`, `api/internalize.js`, `utils/filters-transform.js`, `store/filters.js`, `hooks/use-sync-url-params-with-store`.
    - Measured at the end of phase 2 and never allowed to drop.
    - [VERIFY] Stryker 10 needs Node ≥22, and its parser uses Babel 8 stage-3 decorators while the app uses legacy decorators. Spike `mutator.plugins` first.
  - **C3 Coverage.**
    - Merge V8 coverage from Jest, Playwright `page.coverage` and `NODE_V8_COVERAGE` on `next start`.
    - ≥90% of app statements.
    - 100% of the wave's CS files are executed by at least one black-box test.
    - 100% of routes, V, J, E and PINNED Q items are touched.
    - ≥95% of all R/Q/V/J/E items overall.
  - **C4 Differential parity.**
    - Corpus: N ≥1,000 real URLs (≥2,000 at GATE-S), stratified from 30 days of gateway or Cloudflare logs. API responses are recorded once through the SSR stub.
    - The golden and candidate images run side by side.
    - Compared: status, allow-listed headers, normalised SSR HTML, class census, `__NEXT_DATA__`, `_next/data`, console and pageerror, request trace. Screenshots on a 10% subsample.
    - Gate: 0 unexplained diffs.
    - **Statistic:** 0 diffs in N gives a defect rate ≤3/N at 95% (rule of three). This holds only for diffs the oracle can observe on recorded data, so it is always reported together with the C1 kill rate. Staging and canary cover real-data variety.
  - **C5 Reliability.**
    - 20 consecutive green CI runs on the unchanged app.
    - Baselines byte-identical across 3 captures.
    - `retries: 0`, 0 quarantined tests, flake budget <1 per 100 runs.
  - **C6 Runtime.** Prod watch for 48 h per step, compared against the same weekdays of the previous 4 weeks:
    - Sentry error events per 1,000 page views ≤ the 4-week P95 daily rate;
    - SSR 5xx ≤ baseline P95;
    - 0 restarts and 0 OOMKills;
    - p95 latency of `/search` and `/works/*` ≤ 1.10×;
    - GA page_view/session ratio within ±5%.

    Non-inferiority: over ≥14 days after GATE-S and after GATE-A, a one-sided test at α = 0.05 that the post-change Sentry error rate ≤ 1.05 × the rate in the 28 days before phase 2. Report the session rule-of-three bound; traffic N is UNCONFIRMED, check GA.
  - **C7 React layer (G-R1..8).**
    - Zero hydration errors on every channel, across routes × fixtures × 3 TZ × cookie absent/present × 3 engines.
    - The SSR-vs-DOM text diff is empty except for approved nodes.
    - Raw title and SEO are byte-equal.
    - Request counts (API, `/account`, Sentry, GA, LogRocket) equal the baseline in both cookie states.
    - The Jest console gate is green.
    - The T-203 table is unchanged.
    - T-404 is green under both JSX runtimes.
    - 0 new Sentry issue types in the soak.
  - **C8 Hygiene and review.**
    - 0 open VF items and 0 due ODs.
    - Every PR links its IDs.
    - A second reviewer signs each gate.
  - **Sign-off statement:** "As of <date>, C1–C8 pass for <step>; fault recall X/Y; mutation Z%; corpus 0/<N> diffs (detectable classes); prod non-inferior at 95%."

---

### 50-roadmap.md

### X50.1 — The deploy pipeline makes waves, soak and rollback impossible as written
critical · C/P · Sources: RP-01, RP-02(P), RP-03, TCD-01 (violates M3 if the nightly is made to roll out), TCD-02, RH-05, TCD-26, TCD-31(P)
- **Fact:**
  - **The stage cron overwrites any wave on stage.** `aks_stage_deploy.yml` (`0 4 * * *`) runs only on the default branch, `main`: all 90 recent schedule runs used head_branch=main. So it deploys `main` over any wave being soaked on stage.
  - **Every push to `main` deploys prod.** There is no PR trigger and no paths filter, so a docs-only merge also redeploys.
  - **Prod is dispatchable from any branch, and other workflow controls are missing.**
    - `workflow_dispatch` accepts any ref: prod was deployed from `Validate-page` on 2026-10-01 (run 36846249476).
    - Both environments share `azure`.
    - There is no `concurrency` (5 prod runs in 63 minutes).
  - **The prod nightly never rolls out, and it reverts undo.**
    - It rebuilds the same SHA under the same mutable tag `sha7-prod`. The pod template is unchanged, so no rollout happens ("Wait for rollout" 0 s, vs 105 s on push).
    - With `IfNotPresent`, a mixed fleet is possible.
    - `kubectl rollout undo` is reverted by the next nightly apply.
  - **There is no rollback by digest.**
  - **Schedules are unreliable.**
    - Start times observed between 06:00 and 10:00 UTC.
    - No scheduled run at all from 2026-10-02 to 10-12.
    - Schedules are disabled after 60 days of repo inactivity.
    - 13 scheduled failures in the last 100 runs.
  - **Precedent.** The legacy master workflow had an `ALLOWED_PROD_BRANCH` freeze.
- **Change:** an ops PR in phase 2 under OD-29:
  - The stage schedule checks out `ref: stage`, or the stage cron is disabled during soaks.
  - The prod job gets `if: github.ref == 'refs/heads/main'`.
  - Add concurrency groups.
  - push and dispatch deploy immutable refs (`<repo>@sha256` from buildx metadata), and digests are recorded per step.
  - The nightly cron stays build-only, as it is today, until the owner decides. Making it roll out would introduce daily fresh data, which is a D1 change.
  - The gate criterion "two clean nightly cycles" is replaced, because schedules run only on the default branch.
  - Rollback is per X01.2.

### X50.2 — Change control during the track (see X00.6, OD-31)
critical · C · Sources: RP-04
- **Change:**
  - Phase-2 entry requires OD-31 to be DECIDED.
  - The exact design pin (CS-W0-1) moves into the phase-2 harness PR, before any baseline is captured.

### X50.3 — Ship each lettered step to prod individually; serialise W1
high · C · Sources: RP-16, RP-29
- **Fact:**
  - **Steps are bundled.** "Prod after (d)" for W4, "Prod after (d)" for W6 and "Prod after (c)" for W7 each bundle 3–5 framework steps into one prod deploy. This loses attribution for prod-only SILENT effects (Scholar, GA, latency).
  - **W1 cannot run "in parallel with W2/W3".**
    - There is one stage environment and one deploy path.
    - The Prettier reformat collides with W2/W3 edits to `_app.jsx`, `sentry.js` and `store/*`.
    - lint-staged 16/17, ESLint 10 and stylelint 17 cannot run on Node 18 (solved by tooling Node 24, X02.5).
- **Change:**
  - Every lettered step follows the X01.2 runbook through to prod.
  - The order is W1 → W2 → W3, serialised.
  - Record that W1 is allowed early because it removes the private @oacore configs and has no runtime effect.
  - The final dashboard-style config arrives in phase 6.2.

### X50.4 — Phase-2 order and entry/exit
high · C/P/U · Sources: RP-22, RP-27(P), DQ-06(U), DQ-20(U), TCD-11, RP §10
- **Fact:** README:197-205 and 50:57 capture baselines (2.3) before writing the P0 tests (2.4) and record fixtures last (2.7). But 40 §6 creates baselines by running those tests in record mode, and the tests need the fixtures.
- **Change:**
  - New order:
    - 2.1 harness + inertness proof (X40.5);
    - 2.2 fixtures recorded and scrubbed (API key, public-repo policy);
    - 2.3 tests written and green on the unchanged app;
    - 2.4 golden image built in CI from a clean `origin/main@cc0e228` checkout (arm64, private GHCR/ACR, digests recorded);
    - 2.5 baselines captured from the golden image 3×;
    - 2.6 CI gates required (screenshot of the settings);
    - 2.7 P1 tests.
  - Entry: OD-24, 25, 28, 29, 31, 32 and 35 DECIDED. OD-09 is needed before W6. Design pinned exactly. Baseline = an `origin/main` SHA.
  - Optional phase-2 spike: the P0 suite on `node:24-alpine` with Next 10 (see §6 conflicts).

### X50.5 — New and changed waves
high · C/P · Sources: nextjs-late-12, HC-24, RP-14, DS-02(P), RM-11(P), VER-15, VER-10, DQ-12(U), EM-02(U)
- **Change:**
  - **Ops pre-step:** gateway data rule, stage cron ref, digest deploys, prod branch guard.
  - **W0b:** six neutral Next-proofing PRs (X20.1).
  - **W0.5:** the exact 5.0.74 design tarball as a `file:` dependency (X60.2).
  - **W4:** the corrected sequence (X20.2).
  - **W5:** the vendoring layout per OD-21 (X60.2).
  - **W5.5:** ESCALATES fixes on React 17, each pinned first by T-728 and gated at 0 px.
  - **W8:** mandatory.
  - **W9:** defined as phase 6.7, Babel→SWC, mandatory.
  - **L1 latest sweep:** before GATE-A, with Node 26 if it has been LTS ≥1 month and is green.
  - **L2:** after phase 7.

### X50.6 — Security column per prod step (see X10.9)
high · C/P · Sources: VER-05(P), nextjs-late-15
- **Change:** list the open GHSAs for each prod stop. Minimise dwell on 12.3.7 and 14.2.35. The first prod Next 15 is ≥15.5.24, i.e. 15.5.28.

### X50.7 — Entry criteria and the W5 D0 contradiction
medium · C · Sources: RP-15, RP §7
- **Fact:**
  - **W4 entry is undefined.** It says "W2, W3 green".
  - **W5 D0 contradicts 40 §6.** It captures T-417/T-418/T-802 baselines on `@oacore/design` after W4 (Next 12), which 40 §6 forbids. A W4 regression would be baked into the new baseline.
  - **T-802's tag contradicts the P0 definition.** It is marked "P0 (before W5)".
- **Change:**
  - D0 re-runs against the phase-2 golden baselines and must be identical / 0 px. A failure there is a W4 regression.
  - Rewrite every entry and exit as binary, with records (X01.3; replacement table in roadmap-process.md §10).

### X50.8 — Effort and calendar
medium · P/?/U · Sources: RP-19(P), DQ-16(U), DT-29(?), DT-30(P)
- **Fact:**
  - **Current total.** 15–25 + 36–60 + 15–25 + 25–40 = 91–150 person-days, with no calendar time.
  - **Bottom-up estimates** (unverifiable without a spike):
    | Phase | Bottom-up | Current |
    |---|---|---|
    | Phase 2 | 40–63 d | — |
    | Phase 6 | 43–70 d | 15–25 d |
    | Phase 7 | 54–85 d (+8–12 for global CSS) | 25–40 d |
  - **Elapsed time.** About 22 serial deploy units × (24 h soak + 48 h watch) ≥ 66 elapsed days.
- **Change:**
  - Run a 5-day phase-2 calibration spike: the harness, 1 test per layer, and 1 green CI run.
  - Show person-days and calendar time side by side, with a buffer line for VERIFY failures.
  - Re-estimate phases 6 and 7 after their spikes (X70.13, X80.2).

### X50.9 — Dependabot during the track (OD-32)
medium · P · Sources: RP-24(P), TCD-20
- **Fact:**
  - There are 18 dependabot branches, and `main` has no `dependabot.yml`.
  - The open PRs target `main.old` or `master`; the newest is from 2026-04-08.
  - Whether security updates are enabled is UNCONFIRMED; it needs a look at the repo settings.
- **Change:** label dependabot PRs `upgrade-hold` and fold them into the next wave. Never merge one standalone. Add `dependabot.yml` with npm limit 0.

### X50.10 — Branch protection vs ops direct pushes
medium · C · Sources: RP-25
- **Fact:**
  - **Direct ops pushes.** Ops push to `main` without PRs: 9b26dc9, d219cca, 044351c, 0f8f4c0, e849311.
  - **Manual stage merges.** `stage` is merged by hand: 6e0a370.
  - **Unknowns.** The `azure` environment rules are UNCONFIRMED.
- **Change:** OD-29 names the ops owner and agrees a `kube/`-only PR path, with path-filtered checks that skip e2e. Record a settings screenshot.

### X50.11 — Re-resolve versions at each wave start
medium · C · Sources: VER-29 (→ X02.0)

### X50.12 — Phase 1 exit record
low · U · Sources: DQ-26 (→ X01.4)

### X50.13 — Phase 6/7 rows become pointers; phase 7 precondition = GATE-A signed
critical · C · Sources: RP-05, DQ-03(U)

### X50.14 — OD-03 is needed by W4, not W6
high · C · Sources: NE-01, nextjs-late-01

### X50.15 — Calendar effects of nightly scheduling (see X50.1)
low · P · Sources: TCD-31(P)

---

### NEW 55-gates.md (M5)

### X55.1 — GATE-A, the pre-antd gate: binary
critical · C/P/U · Sources: RP-05, DQ-01(U), UI-26 (violates M2 with "owner-approved exception"; adjusted), RM-13(P), DQ §7
- **Change:** GATE-A passes only if ALL of the following hold at one recorded commit `A`, with evidence in `records/gate-A.md`.
  1. **Versions.**
     - `npm outdated` lists only ACCEPTED M1 ledger items.
     - `npm ci` succeeds with strict peers.
     - `npm ls --all` exits 0.
     - `npm audit --omit=dev --audit-level=high` is 0, or every finding is accepted.
  2. **Suite.**
     - 100% of P0+P1 tests DONE. P2 tests are DONE or waived by the owner.
     - 3 consecutive green runs at `A`.
     - `retries: 0` and 0 skipped tests.
  3. **Parity** against the approved baseline chain:
     - T-801/T-802 at 0 px over the full matrix and all viewports;
     - T-6xx identical;
     - network logs identical;
     - T-701 shows no new events in 3 TZ × cookie states;
     - T-803 shows no new axe violations;
     - lint parity;
     - C4 corpus has 0 unexplained diffs.
  4. **Detectors.** C1 and C2 re-run against the **new phase-6 implementation**.
  5. **Risks.**
     - The traceability check reports 0 GAP.
     - Every C/H risk is MITIGATED or CLOSED.
     - Every PINNED test is green.
     - Every ESCALATES item is FIXED and signed off.
  6. **Production.**
     - The digest for `A` has run ≥14 days in prod.
     - The C6 non-inferiority test passes.
     - No rollback in the last 14 days.
  7. **antd readiness.**
     - The swap harness supports `IMPL=design|antd`. Behaviour contracts (roles, names, keyboard, focus return) for all units pass on `design` before any antd import.
     - A 0-px feasibility spike covers the 5 hardest units: Select/autocomplete + advanced search, Modal + focus lock, TextField/Form, Header, Histoslider.
     - Every V/J/Q item maps to a named antd equivalent, or to an owned unit.
     - **Exceptions** are allowed only for non-visual, non-behavioural items, and only with owner signature. Pixel or behaviour differences are never exceptions (M2).
  8. **Operations.**
     - The owner has set the performance budget.
     - A rollback to the last pre-antd digest has been rehearsed on staging.
     - 0 open VF items. All due ODs DECIDED.
  9. **Residual gaps** (40 §3.2) are listed and accepted by name. Sign-off by Implementer, Reviewer, Ops and Owner.

### X55.2 — GATE-S, the end of the version track
high · C/P · Sources: RP-05, VER-30(P), UI-25(P)
- **Change:**
  - GATE-S uses the same template minus the phase-6 items. It replaces "Prod stable for 1 week".
  - It includes the final Playwright bump and a baseline re-capture from the golden image under the harness protocol.
  - It runs all test tiers.

### X55.3 — GATE-F, the end of phase 7
high · C · Sources: RP-05
- **Change:** the same template, plus all of:
  - `rg -n "@oacore/design|from 'design" --glob '!docs/**'` returns 0 hits;
  - `design/` is absent;
  - every unit maps to antd or to owned source;
  - the L2 sweep is done.

### X55.4 — W5 vendoring gate, deterministic
high · P/V+ · Sources: DS-12(P), DS-11(P), design-system-V1
- **Change:**
  - **G1 — install shape.** The vendored package is not a symlink. For the dir form, `git ls-files <vendor dir> | wc -l` equals 466, the tarball file count.
  - **G2 — compiler untouched.** The emitted module source equals the file. No core-js injection.
  - **G3 — CSS bytes.** CSS SHA-256 per `<link>`, in order, with sourcemap comments stripped. Compared against the build immediately before.
  - **G4 — assets.** The media name set and the prod sprite bytes are unchanged.
  - **G5 — whole build.** `.next` equality with the buildId normalised. This applies **only** once a determinism proof exists: two identical builds of the unchanged app.
  - **G6 — SSR HTML.** Full SSR HTML equality on every T-601 route.
  - **G7 — existing tests.** T-801, T-802, T-417, T-418, T-416 and T-701 pass.
  - The lockfile diff touches only the design entry.

### X55.5 — Prod-watch thresholds per step
→ X45.1 C6

---

### 60-design-copy-plan.md → rename to 60-design-ownership.md (M4)

### X60.1 — Vendoring into the app tree re-transpiles the design code and breaks its exports
critical · C · Sources: DS-01, RP-13
- **Fact:** the claim in 60 §2 ("JS semantics identical by construction") is false.
  - Next 10.2.3 and 12.3.4 run babel-loader on every file outside `node_modules`. They add the CJS transform only when a file contains `module.exports`, and 0 of 114 compiled design files do.
  - `useBuiltIns: 'usage'` injects 8 `import "core-js/..."` lines into `button.js`.
  - Webpack 4 and 5 then treat the file as an ES module and drop its exports. The bundled `default` comes out undefined.
  - The server bundles these files instead of requiring them.
  - babel-jest transforms them too.
  - A Babel `ignore` for the vendored directory restores the export to a function (tested).
- **Evidence:** `exp/design-system/babel-probe.js`, `wp4/`; `next-12.3.4 dist/build/babel/loader/get-config.js:91`; `webpack-config.js:114` (include `[dir]`, exclude `/node_modules/`).
- **Change:** correct the §2 row. If the app-tree layout (A) is kept, add all of:
  - `babel.config.js` `ignore: ['./design']`, or an override with no presets and no plugins;
  - Jest `transformIgnorePatterns`;
  - TS and coverage excludes;
  - gate G2;
  - a server-render context-identity test;
  - a re-verification under SWC/Turbopack at 6.7.

### X60.2 — Vendoring options: add C (local package installed as a copy)
high · P/V+/C · Sources: DS-02(P), RP-14, DS-03(P), design-system-V1, TCD-03(P)
- **Fact:**
  - **Option C** means committing the exact 5.0.74 package and installing it as a dependency:
    - form (i): `vendor/oacore-design-5.0.74.tgz` as a `file:` dependency;
    - form (ii): an unpacked directory installed as a copy.
  - **What C keeps unchanged:**
    - lock integrity (`sha512-kwYolSk…`);
    - all 101 import sites (no codemod, no alias, no Jest/ESLint mapping, no half-vendored context identity);
    - the node_modules CSS rule and the server externals;
    - the postinstall step (it ran in the verifier's test and built the 48-symbol sprite).
  - **What C removes:** the floating `latest` tag and the design registry dependency.
  - **The directory form defaults to a symlink.** Then DS-01 applies again.
    - `--install-links` makes a real copy (466 files, identical to the tarball).
    - `Dockerfile:18` overwrites `.npmrc`, and `.npmrc` is gitignored. So the flag must be passed on the CLI as `npm ci --install-links`.
    - A plain `npm ci` on that lock fails. The `|| npm install` fallback would then silently create a symlink.
  - **`.gitignore:7` `build` silently untracks the vendored `bin/build/**`** (6 files). This affects both form (ii) and layout A. Local builds pass; a fresh CI or Docker checkout fails at `node bin build`. The tgz form is immune.
  - **An installed copy is not live.** Any edit at W6/W7 needs a reinstall.
  - **The GitHub Packages token** can only be removed after W1 drops the other `@oacore/*` devDeps.
  - **Option A/B source:** compiled output is the only byte-provable source. Running src through search's PostCSS matches 15 of 34 files, but that count is inflated by normaliser artefacts. The real differences are:
    - `:global(.sr-only)` in `helpers.css`, but only if it is imported as a plain global;
    - a footer `calc`;
    - static fallbacks for modal and search-result;
    - class naming under Next's `getLocalIdent`.
- **Change (OD-21):**
  - **W0.5:** the tgz form, right after phase 2, gated by T-008 integrity.
  - **W5:** lift the React peer cap. Either use (ii) with `--install-links` plus guards G1 and git-count, plus a `.gitignore` negation, or use (A) with the X60.1 fixes.
  - **Readable ownership** happens later, in 7.1 (X60.3).

### X60.3 — There is no ownership step; "thrown away in phase 7" is false for most of the code
high · P/C/U · Sources: DS-05(P), RP-12, DQ-05(U), roadmap-process §3
- **Fact:**
  - **Most of the code has no antd equivalent.** About 61% of closure LOC is custom; counting the Select composite (895 LOC), about 74%. The custom units:
    - Header / search-bar / advanced-search / AppBar / Logo
    - DesignProvider, Footer
    - SearchResult, Histoslider, MathMarkdown, MetadataList, ExpandableList
    - LoadingBar, Fieldset
    - the Icon sprite CLI
    - the classNames util, cookie logic
    - the foundation tokens, reset and global element CSS. Search's own CSS reads `--primary` 32 times and `--page-padding-x` 12 times.
  - **Already planned to stay local:** 04 §7 already keeps SearchResult and Histoslider local.
- **Change:** add §7 "Ownership".
  - **O1:** freeze the generated artefacts (X60.6), after GATE-S or in place of W8.
  - **7.1:** happens before any antd replacement. Each non-antd unit is ported from `src@bbc35a0` to readable TSX and plain CSS under `components/`. Each port gets characterization tests for the preserved quirks (X60.9), T-417, and T-802 at 0 px. The global CSS closure moves to `styles/global/`.
  - Units that antd replaces skip source ownership: they go straight from compiled to antd.
  - **7.F:** delete `design/` once `rg` finds 0 imports. Add a CI guard against re-introduction. Remove the GitHub Packages token (S-3).
  - Add the per-unit mapping table: antd restyle / antd composite / owned.

### X60.4 — Provenance and licence
medium · C/U · Sources: DS-04, DS-18, DQ-05(U)
- **Fact:**
  - **The installed package equals the npm 5.0.74 tarball** (shasum e6a401d7 = lock), except the postinstall-written `lib/config.js`.
  - **Non-lib files** equal `git archive bbc35a0`.
  - **`lib/` rebuilds 220/220 byte-identical** from `src@bbc35a0`, so src is an exact reference for ownership rewrites.
  - **The design repo's working `lib/` is stale in 4 files.** 04 says 3; `global/elements/footer/footer.css` was missed.
  - **Licence conflict.** `LICENSE` is MIT ("2015 The Open University"), but `package.json` says `UNLICENSED`.
  - **Third-party licences:**
    - sanitize.css: CC0
    - @mdi/svg: Apache-2.0 (the committed sprite contains its path data)
    - katex: MIT (font notice UNCONFIRMED)
    - d3: BSD-3-Clause
- **Change:**
  - `PROVENANCE.md`: tarball integrity, `bbc35a0`, the uncommitted rename `github.svg→githubF.svg`, the `lib/config.js` values.
  - `CHANGES.md`: allowed deviations, each linked to its PR.
  - `verify-design-verbatim` script in CI.
  - "Copy from the package, never from the design working tree."
  - `THIRD_PARTY_NOTICES`.
  - The owner confirms the MIT-vs-UNLICENSED intent.

### X60.5 — Vendored dependencies: M1 exceptions table
medium · C/P · Sources: DS-06, VER-20 (violates M1 without the table), RM-16
- **Fact:** see X02.16 for the blockers.
- **Change:** add a per-package table: installed | latest | blocker | gate | closing step.
  - **Bump now:** react-focus-lock 2.13.7; @babel/runtime 7.29.10 (latest in major); katex 0.16.47 (latest in major).
  - **Accept:** the d3-color high advisory.
  - **Keep pruned:** react-markdown@5. Its function-component `defaultProps` (`transformLinkUri` link sanitising) would be lost at any `jsx()` call site on React 19. Also keep react-slick pruned.
  - **Unmaintained:** @tippyjs/react 4.2.6 is the latest release but unmaintained. It is replaced in phase 7.
  - **Remove via O1/7.1:** svgo, yargs, cosmiconfig, deepmerge, svgstore, @mdi/svg, sanitize.css, tippy, slick.
  - **Otherwise:** bump each remaining dependency in its own pixel-gated PR.

### X60.6 — Freeze the search-processed design CSS as owned pure CSS (O1)
medium · C · Sources: DS-08
- **Fact:**
  - **Search's PostCSS output** for the 53 design CSS files reproduces outside Next and matches Next's output (53/53, dev build).
  - **The output is already standard CSS.** It contains no `@custom-media`, no `(--x)` media queries, no `@extend`, no nesting and no `:global(`. The only leftover is `color-mod` in `button.css` (Q-066).
  - **What freezing it allows:** commit that output, plus the 48-symbol prod sprite, the config constant and inlined sanitize.css 12.0.1 (CC0). Then remove:
    - 6 build deps: svgo, yargs, cosmiconfig, deepmerge, svgstore, @mdi/svg;
    - the postinstall;
    - `Dockerfile:25` cp;
    - `.gitignore:9-12`;
    - `package.json:76` `design build icons`.

    It also removes the pnpm blocker noted in OD-06, and it unblocks "pure CSS" (X70.2).
- **Change:**
  - Add step O1.
  - The G3 byte gate must use the **prod (minified)** output.
  - Re-running PostCSS over already-processed CSS is untested.
  - Fix 04 §6.3: compare against the processed output, not the raw lib CSS.

### X60.7 — Fonts and media pulled in by the design CSS
medium · C · Sources: DS-09
- **Fact:**
  - **`katex.min.css`** brings 60 KaTeX fonts.
  - **`slick-theme.css`** brings slick eot/woff/ttf/svg and `ajax-loader.gif`.
  - **Both arrive via css-loader `url()`.**
  - **Fragile katex import.** `math-markdown.css:1` imports katex without `~` and works only through css-loader's relative-then-module fallback, which is a Turbopack risk.
  - **04 §3.1 is wrong.** It says there is no `@font-face`.
- **Change:** add an "Assets" row to the inventory. Gate G4 covers these assets. Flag the import for W9/Turbopack.

### X60.8 — The D2 barrel rewrite is heavier than needed
medium · P · Sources: DS-13(P)
- **Fact:**
  - 110 of 114 lib modules are evaluated.
  - Only react-slick@0.28.1 caps React; react-markdown 5 accepts >=16.
  - Barrel requires: 13 sites in 12 files.
  - Under option C, D2 does not apply.
- **Change:**
  - Use the minimal fix: delete the carousel getter and require (2 spots in `lib/elements/index.js`), or bump react-slick to 0.31.0 (never rendered).
  - Drop never-required deps from the vendored `package.json`: d3-format, body-scroll-lock, babel-plugin-add-react-displayname.
  - T-004 is required.

### X60.9 — Behaviours the verbatim copy must preserve (assertion list)
high · C/P · Sources: UI-24, UI-19(P), DS-10
- **Fact:** each item below is verified in design src:
  - Select spreads `searchBarProps` after the computed `changeOnBlur` (`search-bar.jsx:131-137`).
  - Header menus have a body-click handler.
  - The AdvancedSearch panel has a global `ul` reset.
  - Modal:
    - z-index 1030, below the header's 10000;
    - focus-lock `returnFocus`;
    - body overflow ends `unset`;
    - Esc only works when focus is inside;
    - the aria-label is duplicated.
  - Cookies are keyed on the essential cookie.
  - Card passes `tag` through, which produces the nested anchors.
  - ExpandableList hook order can trigger React #310.
  - SearchResult has hooks inside `.map` and fetches logos.
  - Fieldset highlights `items[0]` without an `onClick`.
  - Popover uses Tippy's focus trigger.
  - `fieldset.css:44` `@media (--screen-until-desktop)` is the only lib CSS that relies on the host's custom-media, which resolves it to `(max-width: 767px)`. This is already covered by R-009 and T-003(a). The new item is a V38 screenshot of the CSV and report modals at 767 px.
- **Change:**
  - Turn the list into T-417 and T-802 assertions, run first against `@oacore/design` and then against the copy.
  - Forbid any cleanup during the verbatim step.

### X60.10 — core-ui is not usable; record OD-34 ("no dependency")
medium · P/C · Sources: DS-14(P), DT-16, DT-17
- **Fact:**
  - **Unreleased HEAD has more than the release.** core-ui HEAD `0e9cfa5` (2026-09-24) exports Header (advanced-search presets), Footer, Link, Carousel and Cookies. The published 2.0.21 (and the dashboard's 2.0.20) export none of these.
  - **Peers don't fit.** antd ^5.27.6, react ^19.1.1, icons ^5.6.1. Engines: node ≥24.14, pnpm ≥10. npm would ERESOLVE; the dashboard's pnpm only warns.
  - **No KaTeX.** core-ui's Markdown is react-markdown + rehype-raw.
  - **Not pixel copies.** Its components are restyles.
  - **Stale note.** 04 §7 "Footer: none in core-ui" is outdated.
- **Change:** OD-34: search does not depend on core-ui; it is used as a reference only. Fix 04 §7 and the phase-7 risk text in 50 §5.

### X60.11 — antd theme tokens come from design foundation, not the dashboard
medium · C · Sources: DT-20
- **Fact:** `--primary #b75400` matches. The dashboard and core-ui `antdTheme` values (Input controlHeight 44, Card radii, Tabs colours) are dashboard-specific.
- **Change:** build search's `ConfigProvider` theme from `design/foundation/*.css`. Keep a token table in 60 or 80, and verify each component at 0 px.

### X60.12 — W5 lockfile scope (see X55.4)
low · P · Sources: DS-11(P)

### X60.13 — findings/04 errata (→ ERRATA)
low · C · Sources: DS-16

### X60.14 — Sprite depends on NODE_ENV (→ X40.24, X60.6)
high · C · Sources: DS-07, EM-13(U)

### X60.15 — Postinstall needs root `design.config.js` (→ X20.9)
medium · P · Sources: TCD-03(P)

### X60.16 — Q-051 edit location (→ X20.12b)
low · P · Sources: RM-11(P)

### X60.17 — Rename D0–D6 steps to DV0–DV6 (→ XRD.6)
low · U · Sources: DQ-11

### X60.18 — Edit policy
low · U · Sources: DQ-05
- **Change:** no edits before W5 exits. After that, edits go only through CS rows with tests, and never change logic or UI (D1).

---

### NEW 70-phase6.md (target conventions, behaviour contract, sub-waves) (M6)

### X70.1 — Phase 6 has no conventions spec
high (critical in source; downgraded because 50 §5 is deliberately an outline) · P/C/U · Sources: DT-01(P), RP-20, BL-27(P), BL-29, TCD-32, HC-26, DQ-03(U), DQ-28(U)
- **Fact:**
  - **The dashboard is not a template for search.** It is a client-only Vite SPA with no tests. Its conventions fail, or silently change behaviour, in a Next pages-router SSR app.
  - **The contract is scattered.** The per-action request contract, the SSR/client split, the error-to-UI map and the defaults diff are spread across 06, R-028/R-029 and T-702.
- **Change:** one doc, 70, containing:
  - **§1 Adopt/Adapt/Reject table**, from the dashboard-target report §6 and tooling-ci-deploy report §3:
    - **Adopt:** husky 9, lint-staged, ESLint 10 flat + typescript-eslint + react-hooks, globals.
    - **Reject:** react-refresh, `tsc -b`, pnpm, the dashboard Dockerfile and nginx, react-router, Vite, RHF, the `stores/` layout.
  - **§2 Behaviour contract**, from the business-logic report §6: endpoint contract, per-action request contract, store table, defaults diff. This is the oracle for T-702, T-5xx and the wire recorder.
  - **§3 Sub-waves 6.0–6.10** with entry, ordered steps, tests, binary exit, rollback and effort (roadmap-process report §6). Each sub-wave follows the X01.2 runbook.
  - **§4 Exit = GATE-A.**
  - The HTTP contract file and deltas ledger (X40.10) remain the acceptance gate for every phase-6/7 change touching routing, head or data fetching. The dashboard's nginx `try_files` SPA (always 200, no CSP/308/404 semantics) is not an equivalent target (HC-26).

  Do not create a separate 35 doc (M8).

### X70.2 — Define "pure CSS" for the pages router (OD-33)
high (critical in DT-02) · C/P/U · Sources: DT-02, RP-11(P), RH-12, DS-08, DQ-28(U)
- **Fact:**
  - **Next forbids component-level global CSS.** Next 16.4.2 (webpack and Turbopack) rejects first-party global CSS imported anywhere except `pages/_app`: "Global CSS cannot be imported from files other than your Custom <App>".
  - **The dashboard's CSS shape:**
    - 38 global `.css` files, 117 import lines;
    - 0 CSS Modules;
    - 12,545 lines;
    - 396 `.ant-*` occurrences in 25 files (113 distinct classes);
    - 55 `!important`;
    - 128 `@media`.
  - **Search cannot convert to globals directly.** It has 26 module files, and about 30 local class names repeat across them, so a global conversion needs renames and changes the cascade.
  - **PostCSS cannot be dropped yet.** The vendored design CSS still needs it: `forms/styles.css` uses `@extend` and `fieldset.css` uses custom-media. Search's own CSS has no `@extend`.
- **Change:** OD-33 recommendation P1:
  - **Definition.** "Pure CSS" = standard CSS syntax only (no preprocessor syntax, no PostCSS plugins). CSS Modules are kept for component CSS. Globals and antd overrides are imported from `_app` only.
  - **Order:**
    1. X60.6 O1: freeze the processed design CSS.
    2. Expand search's 6 custom-media uses to literal queries.
    3. Codemod the 221 camelCase reads in 50 files and drop the `next.config.js:45-77` hack.
    4. Remove the PostCSS plugins.
  - **Gates:** T-003 declaration sequence identical; T-801 at 0 px.
  - **Alternatives:** P2 = global CSS at the end of phase 7, with an order proof and a collision check. P3 = keep as is, accepted deviation.

### X70.3 — zustand: SSR and hydration spec
high · P/V+ · Sources: DT-03(P), dashboard-target-V-01, DT-15(P), BL-24(P), BL-25(P), RP-20
- **Change:**
  - **6.0 store-driver contract first.** Re-express T-2xx (including T-203's observable effects) and T-209/T-210 against a driver interface. Implement the MobX driver. Freeze the T-702/T-607 logs at the GATE-S commit.
  - **Store creation.**
    - Use a vanilla `createStore` factory: a new store per SSR request, and a module singleton on the client (as `store/index.jsx:12-21`).
    - Seed it with `pageProps.initialState` in `_app`, so the server and client creation states match. Alternatively, use `useSyncExternalStore(api.subscribe, api.getState, api.getState)`.
    - Keep extend-once via `setState` (Q-048).
  - **Store behaviour.**
    - Selectors that return collections use `useShallow`.
    - No `persist`. devtools disabled in prod.
    - Immutable updates that replicate in-place mutation visibility (R-030).
    - Computeds become selectors.
    - `@invalidatePreviousRequests` becomes a function wrapper.
    - Port the un-annotated fields deliberately: `Claim.duplicated` is non-observable, and the 409 message appears only because `isLoading` flips (T-205 assertion).
  - **Rollout.**
    - One PR per store: claim → report → similarWorks → dataProviders → search → filters → root.
    - Then remove mobx, mlr and the decorator and class-properties Babel plugins (CS-BAB-1..5).
    - zustand needs React ≥18, which holds after W7.

### X70.4 — axios transport spec (6.3)
high · P/V+/C · Sources: DT-04(P), DT-14(P), dashboard-target-V-02, BL-05, BL-06, BL-07, BL-21, BL-22(P), BL-23(P), RH-08, VER-31, RP-20
- **Change:** one instance, used on both server and browser:
  - **Adapter:** `adapter: 'fetch'`. This keeps Q-022 (Host dropped) and Blob responses.
  - **Response handling:** `responseType` and transforms reproduce the JSON regex at `api/index.js:93`, plus Blob for non-JSON responses (Q-017).
  - **String bodies:** per-request `Content-Type: false`, which keeps `text/plain;charset=UTF-8` (Q-018 `'null'` body, Q-019).
  - **Headers:**
    - `Accept` overridden to today's value;
    - no default headers, `baseURL`, `timeout` (the dashboard uses 900000) or `params`;
    - the same `Authorization`/`Accept` on every host (S-2).
  - **Query strings:** keep the `URLSearchParams` path, including `?t=undefined`.
  - **Errors:** `validateStatus` maps to the `api/errors.js` classes and reproduces today's plain, serialisable error: `{name, response:{}, data, type, status, headers:{}}`, with message `Request for <url> failed on <s>`. An `AxiosError` must never reach props.
  - **Other settings:**
    - `withCredentials: true`;
    - the UA and Accept-Encoding decision belongs to OD-20;
    - keep-alive is moot on Node ≥20;
    - pass `signal` through;
    - `LogRocket.captureException` fires once;
    - data-loader stays on its CS-N12-1 implementation.
  - **Do not reuse the dashboard's `config/axios.ts` or `config/swr.ts`.** They set:
    - JSON Content-Type;
    - `x-custom-dashboard-header`;
    - `withCredentials`;
    - a 15-minute timeout;
    - `Cache-Control`/`Pragma: no-cache`.

    These would change preflights and CDN caching. Credentials on the E21/E22 logo GETs might also be rejected silently; the CORS behaviour is UNCONFIRMED.
  - **Rollout:** adapter first, with dual-run tests against both implementations in one CI job (X40.38).

### X70.5 — SWR scope (6.4)
high · C/P · Sources: DT-13, DT-11, DT-12, BL-12(P), RP-20, DT-29(?)
- **Change:**
  - **Default:** axios + zustand actions, with the same abort/latest-wins behaviour via `signal`. This covers the event-driven flows: filters POST (abort previous), report, claim, CSV, search.
  - **Where SWR is used:** only where a test proves identical network and render sequence. SimilarWorks is the only read-on-mount flow.
  - **Config:** search's own `SWRConfig`:
    - `revalidateIfStale`, `revalidateOnFocus` and `revalidateOnReconnect` all false;
    - `shouldRetryOnError: false` / `errorRetryCount: 0`;
    - `dedupingInterval: 0`;
    - `keepPreviousData: false`;
    - `fallback` from the gSSP props;
    - a per-key `AbortController` if needed.
  - **Gate:** each PR shows a T-702 diff of 0, or a recorded OD (request-count parity policy, OD-43).
  - **Open question:** whether this narrow SWR usage satisfies M6 is an owner question (OQ-12).

### X70.6 — TypeScript infrastructure (6.1) and conversion (6.6)
high · C · Sources: DT-10, DT-09, DT-06, TCD-16(P), RP-10, RP-20, roadmap-process §3
- **Fact:**
  - **Next 16 forces some tsconfig values:** `jsx: react-jsx`, `module`/`moduleResolution`, `resolveJsonModule`, `esModuleInterop`, `isolatedModules`.
  - **The dashboard's root config checks nothing.** It is a references-only tsconfig `{files:[], references}`, Next bails out of setup, and `tsc --project` checks no files.
  - **`noUnusedLocals`** conflicts with the `import React` lines kept under the classic runtime.
- **Change:**
  - **tsconfig.json** is flat:
    - `allowJs`, `checkJs: false`, `strict: false`, `noEmit`;
    - `paths` = the 9 live aliases (the `config` alias is dead);
    - `isolatedModules` or `verbatimModuleSyntax`;
    - ambient `*.css` declarations;
    - `next-env.d.ts` committed;
    - no `.ts` import extensions.
  - **tsconfig.strict.json** is a ratchet whose `include` grows folder by folder. CI runs both configs.
  - **babel.config.js additions:** see X20.19.
  - **TS version:** see X02.10.
  - **Order:**
    1. TS infra, with build-output identity proved.
    2. New axios, swr and zustand modules written directly in TS.
    3. zustand ported in JS before any file is renamed (because of the decorators).
    4. Mechanical conversion of the rest (6.6), with a compiled-output identity check per PR.

### X70.7 — Phase-6 ESLint config
medium · C · Sources: DT-24, DT-07, TCD-32
- **Fact:**
  - **The dashboard config lints TS only.** It has one `**/*.{ts,tsx}` block and uses the deprecated `tseslint.config`.
  - **No lint command in Next 16.**
- **Change:**
  - Use `defineConfig` from `eslint/config`.
  - Separate JS/JSX and TS blocks (typescript-eslint recommended), plus `@next/eslint-plugin-next`.
  - Script `eslint .`. `tsc` runs in CI.
  - ESLint 10 is already in place from W1 (see §6 conflict 1).

### X70.8 — Sentry end state: @sentry/nextjs 11 (see X02.7)
medium · P · Sources: DT-28(P)

### X70.9 — Babel → SWC (6.7, mandatory per X02.9)
medium · C · Sources: RP-20, VER-10
- **Fact:** SWC drops `useBuiltIns` and the displayName plugin.
- **Change:**
  - Grep for `displayName` / `.name` reads.
  - Compare core-js usage (T-724 browsers).
  - Jest stays on babel-jest, or moves to next/jest only with the X40.1 wrapper.

### X70.10 — Env and asset conventions (→ X20.20)
low · P · Sources: DT-26(P), DT-27(P)

### X70.11 — Library versions (→ X02.18)
medium · C · Sources: DT-08

### X70.12 — The org guide is not the routing or layout target
medium · C/U · Sources: DT-21, DQ-28(U)
- **Fact:** `core-fe-architecture` commit `d010de4` (2025-08-04) is titled "Migrate application from Next.js to React". It prescribes React Router, React Hook Form, `stores/` and "Pure CSS". `dashboard-next` is a single-commit Next 15 scaffold.
- **Change:**
  - Mark OD-02 "DECIDED-pending-owner" with this evidence.
  - Record react-router and Vite as N/A.
  - Do not adopt RHF (conflicts with D3, antd Form) or `stores/`.
  - Add a target-layout mapping OD: feature folders vs the pages router.

### X70.13 — Phase-6 effort and split
medium · ? · Sources: DT-29 (unverifiable), RP-20
- **Fact:** proposals: roadmap-process 6.0–6.10, 43–70 person-days; dashboard-target 6a–6e.
- **Change:** [VERIFY] with a one-week spike: Babel/TS scaffold + one transport + one store. Then re-estimate.

### X70.14 — Un-annotated MobX fields
low · P · Sources: BL-25(P) (already covered by findings/03 and T-203; keep only the T-205 409 assertion)

### X70.15 — findings/08 errata (→ ERRATA)
medium · C · Sources: DT-12, DT-17, DT-18

---

### NEW 80-phase7-antd.md (M6)

### X80.1 — antd SSR on the pages router
high · C · Sources: VER-21, DT-05, DT-19, RH-13, DS-15, RP-21
- **Fact:**
  - **No `_document` today.** Search has no `pages/_document`.
  - **nextjs-registry is not an option.** `@ant-design/nextjs-registry` 1.3.0 is App Router only.
  - **Pages Router needs `_document`.** Style extraction there uses `createCache` + `StyleProvider` + `extractStyle` in `_document`. This works on 16.4.2 with React 19.3.1, with no console errors.
  - **CSS order:** see X10.12.
  - **CSP:** `style-src` already allows `'unsafe-inline'`.
  - **Unconfirmed:** the cssVar `useId` key across SSR and client.
- **Change:** step 7.0.
  - Add a `_document` that reproduces Next's default Document **without `lang`** (Q-054, D1).
  - Pin `@ant-design/cssinjs` to antd's range (^2.1.2) as a single copy.
  - Use `<StyleProvider layer>` in `_document` `enhanceApp` and in `_app`. Overrides stay unlayered.
  - Owner amendments **before 7.0**:
    - (a) T-602 normalises away the antd `<style>` block;
    - (b) the DOM of replaced units may change, but roles, names, focus order and keyboard behaviour may not.
  - Add first-paint / no-JS capture to T-801, plus cascade probes and a hydration check.
  - Static extraction (`@ant-design/static-style-extract` 2.1.0) is the option if "pure CSS" requires it.

### X80.2 — Override surface and feasibility spike
high · P/C · Sources: DT-30(P), DT-08, RP-21
- **Fact:**
  - **The dashboard's CSS volume does not predict search's cost.** Search + design CSS is 2,414 + 4,216 lines over 83 JSX files.
  - **The phase-7 estimate has no basis.** The 25–40 d figure is UNCONFIRMED.
  - **DOM changes between antd minors.**
- **Change:**
  - 7.0 includes a time-boxed 5-day spike: Modal + Select (or Button + Modal) at 0 px against T-802.
  - If 0 px is not reachable, the owner decides before work continues.
  - Pin antd exactly.
  - Every component needs its own sign-off.

### X80.3 — Global element CSS collisions
high · C · Sources: DS-15, RP-21
- **Fact:**
  - **Design global rules restyle antd's DOM.** Rules for `button`/`[type=button]`, `label`, `input`/`select`/`textarea` and `ul` (advanced-search) apply to antd components too.
  - **Search's own raw elements.** It has 1 raw `<button>` and 9 raw `ul`/`input`/`select`/`label` sites.
- **Change:** 7.1 makes the owned global CSS a stable layer. Each global rule is retired in order, with a 0-px proof for that rule.

### X80.4 — Unit mapping, order and acceptance
medium · P · Sources: UI-26 (violates M2 with "or owner exception"; adjusted), RP-21, DQ §9
- **Change:**
  - **Mapping:** take the 23 units from 04 §7.
  - **Order, leaf first:** Spin → Button → Link → Card → Popover → Modal → Form/Input → Select → Header search bar. Owned composite units are re-pointed last.
  - **Behaviour equivalence must cover:**
    - z-index against the 10000 header;
    - focus return;
    - Esc semantics;
    - hover + focus triggers;
    - the collapsed header search;
    - first-change swallow;
    - hook-order quirks;
    - the SSR "Not a member yet" first paint.
  - **Per-PR acceptance:**
    - T-802 `IMPL=antd` at 0 px against golden screenshots;
    - behaviour contracts;
    - T-803;
    - T-801;
    - T-701;
    - T-702;
    - the bundle budget.
  - **Exceptions:** only for non-visual, non-behavioural items, with owner signature.

### X80.5 — Icons and theming
medium · C · Sources: DT-17, DT-20
- **Fact:** the dashboard calls the static `message.*` API 40 times and `notification.*` 2 times. The static API ignores `ConfigProvider`.
- **Change:**
  - Use `@ant-design/icons` 6.3.4 together with antd 6.
  - Use `App.useApp()` / `message.useMessage()`.
  - Theme tokens per X60.11.

### X80.6 — antd browser floor
low · C · Sources: DT-31
- **Fact:** antd supports "last 2 versions" of evergreen browsers. Search's `.browserslistrc` targets "last 3 versions".
- **Change:** accept this explicitly in the phase-7 entry criteria (OD-16).

### X80.7 — Forms
low · U · Sources: DQ §9
- **Change:**
  - Use antd `Form` (D3) for claim, report and add-provider.
  - Keep every message text unchanged.

### X80.8 — Retirement (7.F)
medium · C · Sources: nextjs-late-11, RP-21
- **Change:** in 7.F:
  - Delete `design/` and its CSS import.
  - Delete design's dependencies.
  - Migrate the 5 `legacyBehavior` Links.
  - Remove next-images and `@mdi/svg`.
  - Add a CI guard.
  - Run the L2 sweep.
  - If OD-33 = P2, convert to global CSS here.

---

### 90-open-decisions.md

### X90.1 — Replace the index with a triage table
medium · P/U · Sources: RP-27(P), DQ-20(U)
- **Fact:**
  - **Truly blocking before phase 2:** only OD-24, OD-25 and OD-28. OD-29 is needed for phase-2 exit.
  - **Not "answered by the M-requirements":** OD-01, 04, 15 and 30 are recommendations that still need owner confirmation.
  - **OD-09** already reads "provisionally phase 2, final before W6".
  - **Timing mismatches:**
    - OD-13 is indexed under phase 6, but its status says it is needed by W3.
    - 50 §3 names OD-01/04/09 as entry criteria, while README names nine.
    - OD-05 (Node) matters for the golden image too.
  - **Missing blockers:** change control, dependabot, and the M7 metric.
- **Change:**
  - One index table generated from the Status lines. Columns: proposed answer | basis | owner needed? | blocks phase 2?
  - Mark resolvable ODs as "PROPOSED-DECIDED" so the owner can confirm each with one word.

### X90.2 — Changes to existing ODs
high · mixed · Sources as listed

| OD | Change | Sources |
|---|---|---|
| OD-03 | Option B (gateway rule) becomes mandatory and is a W4 prerequisite (ops pre-step). C (namespace `/static/search`) is the fallback. D (beforeFiles) is rejected because it only fixes 12.3. The owner signs, since it changes the network contract slightly. | HC-21, HC-01(P), nextjs-late-01, NE-01 |
| OD-05 | Node 24 at W4(e), Node 26 later. Delete the Node 20 option. Remove "accept ICU diffs" (there are none). | VER-06, NE-12(P), RP-08, VER-25 |
| OD-07 | TS 6.0.3, plus the committed tsc-7 alias step. | VER-11, DT-06, RP-10 |
| OD-11 | Superseded by OD-33. | RP-11 |
| OD-12 | Babel stays through GATE-S. SWC at 6.7 is mandatory (M1). Record the Babel-8 evidence here. | VER-10, RM-09 |
| OD-13 | mobx 6.16.1, mlr 4.1.1. Removing MobX at 6.5 is the reach-latest step; add a fallback for that step. | VER-13, RM-08(P) |
| OD-14 | W2: 7.120.4. End state: @sentry/nextjs 11.8 with keep-behaviour options. Owner chooses nextjs vs react. | VER-12, DT-28(P), RH-02 |
| OD-15 | q3: ESLint 10 now. Parity yes. Keep the console statements (D1). Keep Prettier and stylelint. | VER-01, TCD-06, DT-07 |
| OD-16 | Keep `.browserslistrc` for CSS/Babel. Explicitly accept the Next and antd JS floor after a GA share check. Pin caniuse-lite, plus an unpin step. | nextjs-late-09, RH-10(P), DT-31 |
| OD-17 | Vendor 0.0.24 verbatim (or ORCID after T-114). Fix the numbers. | VER-14 |
| OD-19 | No standalone build. Document the runtime env contract. | HC-08, TCD-25 |
| OD-20 | Add: (5) a third candidate for string-body Content-Type (x-www-form-urlencoded); (6) a UA/Accept-Encoding policy; (7) keep-alive (moot). Close README:181 (the Node-18 question). Keep "[VERIFY with ops]" on which Host the in-cluster API expects. | BL-07, BL-08(C corrected), BL-30(P) |
| OD-21 | Add option C. Compiled source for W5; ownership in 7.1. | DS-02(P), DS-03(P), RP-12 |
| OD-22 | StrictMode off, confirmed (`reactStrictMode` null → false). | RM-12, react-mobx resolved |
| OD-24 / OD-25 | The repo is public: PII, metadata licensing, LFS quota. | RP-28, TCD-28(P) |
| OD-26 | Yes, within the corrected W4 sequence. | NE-14 |
| OD-27 | Add C: upgrade and pin the old output. For i18n, vendor the data. Move react-ga4 to W4(c). | RP-32, VER-19, VER-03(P) |
| OD-28 | Approve the contract plus the deltas-ledger mechanism, plus the phase-7 amendments up front. | HC-07, TS-24(P) |
| OD-29 | Add: stage cron ref, deploy by digest, prod branch guard, concurrency, ops `kube/` path, and the nightly decision. | RP-01, RP-03, RP-25, TCD-01, TCD-02 |
| OD-30 | Two test builds (X40.30). | RP-30, TS-25(P) |

### X90.3 — New ODs (numbering starts at OD-31; OD-28..30 already exist, so BL-30's proposed numbers collide)
high · mixed · Sources: RP-27, BL-30(P), DQ-18(U), plus those listed below

| New OD | Question | Recommendation | Sources |
|---|---|---|---|
| OD-31 | Change control during the track | Freeze, or use the re-baseline protocol (X00.6) | RP-04 |
| OD-32 | Dependabot during the track | Hold and fold into waves; npm limit 0 | RP-24(P), TCD-20 |
| OD-33 | Meaning of "pure CSS" | P1 (X70.2) | RP-11(P), DT-02, RH-12 |
| OD-34 | core-ui in phase 7 | No dependency | DS-14(P), DT-16, RP-21 |
| OD-35 | M7 thresholds | 45 C1–C8 values | TS-01(P), RP-06 |
| OD-36 | S-4 XSS security fix outside D1 | Separate PR before baselines | HC-09, UI-17, EM-01(U) |
| OD-37 | CSS minifier output at Next ≥11 | B (accept only if 0 px), with A as fallback | NE-05 |
| OD-38 | Next default `_error` page | Vendor Next 10's `_error` (D1) | NE-08, RH-09 |
| OD-39 | Framework header and head deltas per wave (Cache-Control, ETag, CSP on 308, head-manager 15+) | Signed deltas ledger | HC-07, nextjs-late-07/08, X10.8 |
| OD-40 | Hydration-structural ESCALATES list (nested anchors, `/display`, Intl region, Q-050/051) | Fix on React 17 at W5.5 (extends OD-09) | RM-06, UI-06, RM-07, RM-11(P) |
| OD-41 | Block `/static/search/_next/image` at the gateway | Yes (behaviour-neutral, security) | nextjs-late-15, VER-05(P) |
| OD-42 | Public source maps intended? | Owner decides | HC-12, TCD-23 |
| OD-43 | Request-count parity policy, phase 6 (clear-all double, E18 per render, E22 per card) | Keep exactly | BL-12(P), BL-30(P) |
| OD-44 | Error-object adapter vs changing callers | Adapter | BL-05, BL-30(P) |
| OD-45 | CORS/credentials policy for E21/E22 | Keep a plain no-credentials fetch | BL-16, BL-23(P) |
| OD-46 | Infrastructure | Private GHCR + ACR mirror; arm64; integration branch per step | TCD-11, TS-12, DQ-18(U) |
| OD-47 | Stage soak target (stub vs prod API) and canary route (ops) | Stub + low-rate replay; rollout watch unless ops add weights | test-strategy-V1, TS-18, RP-17(P) |
| OD-48 | TS strictness and conversion scope; target layout mapping; Next 17 webpack tracking | — | DT-10, DT-21, nextjs-late-11, DQ-18(U) |

**OD-46 detail.** It covers:
- the golden-image registry;
- the baseline CPU architecture;
- the branch flow.

---

### NEW findings/ERRATA.md (findings stay frozen evidence; add a banner in findings/README.md)

### XFE.1 — Errata to record
medium · C/P/U · Sources as listed

| File | Erratum | Sources |
|---|---|---|
| 01 | §0: `npm ls` shows 0 extraneous and 7 problems (not about 638/215). `@zeit/next-source-maps` 0.0.4 exists only as a canary. Stale "latest" values (cssnano 9.0.4→9.9.0, mobx 6.15→6.16.1, plugin-transform-runtime 8.0.1→8.0.6, …; 12 rows). bibtex accounts for 450 lock entries, not 557. W0–W8 here mean FW0–FW8. | VER-18, VER-29, VER-14, DQ-11 |
| 02 | §4.1: works 410 = HTTP 500. §6.1: the OpenSSL flag stays until Next 12. The `_next/data` rewrite breaks from 12.2 and at 15/16. Errata #2: `/search/` returns 308 + `Refresh`. | HC-03, NE-06, NE-01, http-contract resolved |
| 03 | §5.2 "StrictMode on" is wrong. The R-012 mechanism is `jsx()` on React 19. The R-039 trigger. The batching analysis misses writes outside actions. | RM-12, RM-02, RM-18, RM-19 |
| 04 | §0: 53+7 CSS files (not 106); the stale lib differs in 4 files, not 3. §3.1: fonts and media exist. §6.3: compare against processed output. §7: core-ui HEAD has Footer/Header; mapping caveats. | DS-16, DS-09, DS-14(P), DT-16 |
| 05 | §5.1: the layer-split advice breaks icons. :256: the nightly does not redeploy. S2: crash semantics. §5.4(3): the public-host smoke is blocked by Cloudflare. | TCD-03(P), RP-03, RH-02, TCD-21 |
| 06 | §5.1: claim "last wins" is false, and axios string bodies become x-www-form-urlencoded. §2.4: error-object shape. §6: `responseType: 'blob'` returns a String in Node. E22 is missing. Catalogue Q-024 `null`/`undefined` requests. | BL-01, BL-07, BL-05, BL-06, BL-16, BL-04 |
| 07 | J12 title. Consent recipe. Selector IDs (§8.3). J5 landing is a full navigation. J6/T-708 "none removed". F15 MathMarkdown. §5 tolerances and masks are superseded by 40. §7.1 date fallback. §1.1 route table (gateway reachability). §8.1 `APP_ENV=local` conflict. | BL-15, UI-12, UI-02, UI-13, UI-08, UI-01, UI-18, TS-30, HC-05(P), UI-16, UI-22(P) |
| 08 | zustand is used in 22 files, not 40. SWR config is only half-described. Icons split (5.6.1 + 6.1.0). Husky v8 shim. Direct `fetch` in 2 files. `tseslint.config` is deprecated. | DT-12, DT-17, DT-18 |
| baselines | The lint JSON files contain sandbox absolute paths; normalise them. | TCD-13, DQ-22(U), RP-33 |

---

## 2. Resolved [VERIFY] items

These are settled by evidence from 2026-10-19. Tick them in README §8, 20 and 40. Then delete them from the checklist.

| # | Item (where it was asked) | Answer | Evidence (dims) |
|---|---|---|---|
| 1 | Does native fetch drop a `Host` override on Node 18? (README:181, Q-022, OD-20(1)) | **Yes.** Native fetch drops it on Node 18.20.8, 20.19, 22.18, 22.23.3, 24.x and 26.12, for both object and Headers forms, and inside the real Next 10.2.3 server. node-fetch 2.6.1 and the axios http adapter send it. The axios fetch adapter drops it. Other outbound headers: UA `node`, `accept-encoding: gzip, deflate`. Still open: which Host the in-cluster API expects (ops). | versions hostfetch.js; business-logic host-test.js; test-strategy, risk-hunter, http-contract, empirical, docs-quality |
| 2 | Which fetch does the Next 10 server use on Node 18? | Native undici. `node-polyfill-fetch` installs node-fetch only when `global.fetch` is missing. Next 11/12 keep the same guard. | test-strategy, risk-hunter, nextjs-early |
| 3 | Does Next 12.3 run on Node 22/24? (CS-N12-6) | **Yes.** It builds, starts and serves on 18.20.8, 22.18, 22.23.3, 24.18 and 24.22, and the CSS hack and data route work. 12.3–16.4 all build on Node 24. 12.3.7 **fails on Node 26.12** (`SlowBuffer`). Alpine arm64 is still open. | versions, nextjs-early, nextjs-late |
| 4 | When can `--openssl-legacy-provider` be removed? (CS-N11-5) | First at Next 12.1.6. It is still needed at 10.2.3+wp5 and at 11.1.4 on Node 18/22/24. Runtime never needs it. md4 works with the flag on Node 18/22/24. | versions, nextjs-early, tooling |
| 5 | next/jest and a custom Babel config (40 §2.2) | next/jest always uses SWC and ignores `babel.config.js`; this is overridable only via `transform`. It maps `.module.css` to an identity proxy before custom mappers, and its fileMock returns an object. Use babel-jest. | versions, nextjs-early, nextjs-late, test-strategy |
| 6 | RouterContext path per Next version | 10.2.3: `next/dist/next-server/lib/router-context`. 11.1.4 and 12.3.7: `…/shared/lib/router-context`. 13.5–16.4: `…/shared/lib/router-context.shared-runtime`. | versions, nextjs-*, test-strategy |
| 7 | i18n-iso-countries 7 deep import (R-031) | Works: there is no exports map. 9 visible names change. | versions, empirical |
| 8 | react-ga4 3 hit shape (OD-27) | The source diff is types only, and `send('search')` is a no-op in both versions. It is ESM-only, so it needs webpack 5 / Next ≥11.1.4. | versions, empirical, ui-flows |
| 9 | Does `npm ci` work today? (CS-W0-4) | **Yes** with `--legacy-peer-deps`, on npm 10.8.2 / 11.16 (macOS): 1760 packages, tree identical. In strict mode it fails only on logrocket-react. linux/arm64-musl is still open. The user-level `.npmrc` sets `legacy-peer-deps=true`, which masks the problem. | versions, tooling, empirical |
| 10 | Can the nightly build pull a different `@oacore/design`? | **No.** The lock pins 5.0.74 (= latest). `npm ci` and `npm install` keep the locked version. Only `npm update` or a missing lock floats it. | versions |
| 11 | Real `npm audit` (README §8) | 146 findings (39 critical / 35 high / 61 moderate / 11 low); 132 in prod deps. next@10.2.3 matches 16 advisories. Without bibtex: 94 / 6 critical. Final stack, prod deps: 0. | versions |
| 12 | Versions to pin for test tools (40 §2.7) | jest-fixed-jsdom 0.0.11; Jest 30.5.2; jest-dom 6.9.1 (7.0.1 needs Node ≥22); RTL 12.1.5 → 16.3.3 + dom 10.4.2; user-event 14.6.8; msw 2.15.0 (Jest, with allow-list) or ≤2.11.1 (Node-18 preload); msw 3.0.3 (Node ≥22.12, ESM); @playwright/test 1.64.1 + image `v1.64.1-noble(-arm64)`; @axe-core/playwright 4.14.0 (Node ≥22.12). | versions, tooling, test-strategy, roadmap, docs-quality |
| 13 | Is LogRocket 12 safe to import on the server? (R-062) | Yes. The real issue is the CSP host change. | versions |
| 14 | Docker base tags | node 18/20/22/24/26-alpine and lts-alpine (= 24) exist, multi-arch. node:18-alpine was last pushed 2025-03-27. The MCR Playwright `v1.64.1-noble`, `-arm64` and `-amd64` tags exist. | versions, tooling |
| 15 | `npm ls --all` on the real tree | 0 extraneous, 7 problems (see X20.21). 39 deprecated lock entries. | versions |
| 16 | Does the final stack resolve with strict peers? | **Yes** with TypeScript 6.0.3. With 7.0.2 it fails ERESOLVE on typescript-eslint. | versions |
| 17 | Does the webpack-5 process polyfill have `.on`? (R-006, CS-N11-6) | Yes, as a noop, on 10+wp5, 11.1.4, 12.3.7 and 13–16. | nextjs-early, nextjs-late, risk-hunter, empirical |
| 18 | Browser `path` / `fs` fallback (CS-N11-1) | path-browserify is provided. `fs` needs `resolve.fallback.fs=false`, because `config.node` fails schema validation. | nextjs-early, nextjs-late, empirical |
| 19 | Does the baseline emit public source maps? (CS-N11-4) | **Yes.** 27 JS + 8 CSS maps with sourcesContent, plus 14 server maps. `productionBrowserSourceMaps` gives 23 JS maps on 12.3.7. CSS maps under the flag are still open. | nextjs-early, tooling, http-contract, empirical |
| 20 | node-fetch hoisting (R-017) | 2.6.7 at 11.1.4. Gone at 12.x, where data-loader fails with "Cannot find module". | nextjs-early |
| 21 | css-loader `~` imports (CS-PCSS-6) | They work on 11.1.4, 12.1.6, 12.3.7 and 13.5.11. 14–16 are still open. | nextjs-early, empirical |
| 22 | Is CSS-module camelCase still applied, and can the class map be extracted? | Yes through 12.3.7 (both keys, client and SSR). The class map can be read from the client-chunk object literal on 10–16. The **hash formula changes**: md5 on 10/12, sha1 on 13+. This corrects the TS claim that it is "stable". | nextjs-early, nextjs-late, test-strategy verdicts |
| 23 | Does Next 12 use SWC when `babel.config.js` exists? | The SWC transform is disabled, but the bindings still load for page analysis, which can trigger lockfile patching. | nextjs-early |
| 24 | Latest versions and peers on 2026-10-19 | next 16.4.2 (15.5.28 / 14.2.35 / 13.5.11 / 12.3.7); react 19.3.1; eslint 10.13.0; stylelint 17.16.0; prettier 3.9.10; husky 9.1.7; lint-staged 17.6.0; typescript 7.0.2 (6.0.3 usable); typescript-eslint 8.72.0 (peer <6.1.0); @sentry/* 11.8.0; logrocket 12.4.0; mobx 7.0.6 (6.16.1); mlr 5.1.0 (4.1.1); antd 6.6.6; icons 6.3.4; cssinjs 2.1.2; axios 1.20.0; swr 2.5.1; zustand 5.0.15; @babel/core 8.0.7; postcss 8.5.31; preset-env 11.6.1; cssnano 9.9.0; custom-media 12.0.3; i18n-iso-countries 7.14.0; react-ga4 3.0.1; jest 30.5.2; msw 3.0.3; @playwright/test 1.64.1; leaflet 1.9.4. | all |
| 25 | React 18/19 support per Next version | Next 15 supports React 18 officially. Next 16 allows React 18 but deprecates it (removal in 17). | nextjs-late |
| 26 | Turbopack opt-out | `next build --webpack` / `next dev --webpack`. Without the flag the build errors, because a webpack config exists. | nextjs-late |
| 27 | getDataHref and the client patch (CS-N12-3) | Exists on 10–16. From 12.3 it takes an object parameter. The patch applies on all 8 builds. The failure is on the server side (X10.1). | nextjs-late, http-contract, risk-hunter, nextjs-early |
| 28 | next-images URLs | Identical on 10.2.3–16.4.2. 9 file URLs and 5 data URIs. | nextjs-late, nextjs-early |
| 29 | `/search/` status (errata #2) | 308 → `/` on every version, plus a `Refresh: 0;url=/` header. Cache-Control is added from 12.3. | nextjs-late, http-contract, business-logic |
| 30 | `scroll-behavior: smooth`, and does `router.push` scroll? | None anywhere: the only rule is sanitize reduce-motion `auto`. Non-shallow push scrolls to top; shallow push does not. | nextjs-late, ui-flows, empirical |
| 31 | `reactStrictMode` default (OD-22) | `null` → false in the pages router on 13–16. | nextjs-late, react-mobx |
| 32 | Does React 19 drop defaultProps? | Only for `jsx()`-created elements. `createElement` (classic runtime) still applies them. | react-mobx |
| 33 | How Next ≥12.3 hydrates | `hydrateRoot`. Recoverable errors go to `reportError`. Route renders are wrapped in `startTransition`. | react-mobx |
| 34 | Legacy React APIs in the design lib and deps | None, apart from `createPortal`. react-markdown@5 has function defaultProps (pruned). Tippy's `children.ref` warning is dev-only. | react-mobx |
| 35 | mobx-react-lite 4 on React 17 | Supported via the `use-sync-external-store` shim. | react-mobx |
| 36 | Location of the Q-062 DOI effect | `templates/output/index.jsx:65-71` (state at :51). It crashes at :68 when `doi` is null. `metadata.jsx:50` only renders. | react-mobx, ui-flows, empirical |
| 37 | design `lib/global` and the CSS closure (60 D1) | `lib/global` is unreferenced. 53 lib CSS files plus 7 external ones are reachable. The compiled lib JS has no `.css` requires. `math-markdown.css` imports katex CSS (without `~`). | design-system, empirical, roadmap (EM-18) |
| 38 | design `bin/` dependencies (60 D5) | yargs, cosmiconfig, deepmerge, svgstore, svgo 1.x (+ @mdi/svg). Only `NODE_ENV` is read. `ICONS_PUBLIC_PATH` is unused. | design-system, empirical |
| 39 | Peer caps on React | Only `@oacore/design` (react ^17) and react-slick 0.28.1. react-slick 0.31.0 allows ^19. With design and logrocket-react removed, there is no ERESOLVE. | design-system, empirical |
| 40 | OD-21: compiled vs src | Compiled output is the only byte-provable source (X60.2). | design-system |
| 41 | Installed design == 5.0.74 == `bbc35a0` | Yes, except `lib/config.js`. `lib/` rebuilds 220/220 from src. 5.0.74 is the latest. | design-system |
| 42 | `--screen-until-desktop` / color-mod / @extend | Resolves to `(max-width: 767px)`. color-mod is left as is (Q-066). Leftover `@extend` produces empty rules. | design-system |
| 43 | Sprite symbol count (T-005, R-022) | 48 in the prod Docker build, 49 in dev. | design-system, empirical |
| 44 | Does an MSW `--require` preload intercept SSR under `next start`? (40 §2.5) | Yes on Node 18 + Next 10, with msw ≤2.11.1/2.10.5. A plain fetch wrapper also works. On Next 13.5–16, `next start` renders in-process, so the preload is inherited. MSW cannot see wire headers. | business-logic, test-strategy, empirical |
| 45 | Q-026 data-loader exit semantics | Confirmed (X10.20). | business-logic, empirical |
| 46 | Q-004 / Q-019 / Q-027 / Q-002 / Q-065 / Q-016 spot checks | All confirmed. Q-019 is `text/plain;charset=UTF-8` with a preflight. Q-027 count: 1 SSR GET + 2 browser GETs with accounts, 1 without; +1 per re-render. | business-logic, empirical |
| 47 | Meta-tag presence; does `citation_publication_date` fall back to year? | See X30.18. A number gives 500 on works. A string gives `YYYY/NaN/undefined` on outputs. | ui-flows, http-contract, empirical |
| 48 | Does `</script>` break the JSON-LD? | Yes, and the injected script executes (X30.1). | ui-flows, http-contract, empirical |
| 49 | LinkedData with no data provider | HTTP 500 (X30.3). | ui-flows, http-contract, empirical |
| 50 | Does provider sort reset the offset? | No. The offset is kept and `page:1` is pushed. | ui-flows, empirical |
| 51 | Disabled filter items | `pointer-events:none` blocks the mouse. The handler is unguarded, so keyboard and forced clicks fire. Keyboard behaviour at runtime is still open. | ui-flows, empirical |
| 52 | Result title click | Full navigation to the absolute core.ac.uk URL. | ui-flows, empirical |
| 53 | Default CSV choice | "Current page" (the Fieldset effect highlights `items[0]`). Esc and backdrop do nothing. | ui-flows, empirical |
| 54 | Similar works with empty providers; map with no location | Both blank the page. | ui-flows, empirical |
| 55 | ClaimModal reachable? | No, and SignInModal is unused. | ui-flows, empirical |
| 56 | Cookie attributes (T-416) | Value `true`, path `/`, 1 year, no Domain / Secure / SameSite / HttpOnly. | ui-flows, empirical |
| 57 | Prettier 3 reformat size (CS-PRET-1) | 8 files, formatting only. | tooling |
| 58 | Are the lint baselines reproducible? | Yes: 13 + 16, identical on Node 18 and 24 after path normalisation. | tooling, docs-quality |
| 59 | Branches and triggers | Default branch is `main`. Push to `main` → prod. Push to `stage` → stage. **Both crons build `main`.** Dispatch accepts any ref. | tooling, roadmap |
| 60 | Sentry DSN host vs CSP | The legacy DSN host `o318858.ingest.sentry.io` is not matched by `sentry.io`. The stg bundle has no Sentry init. | tooling |
| 61 | Node release status | 18 and 20 EOL; 22 maintenance until 2027-04-30; 24 LTS; 26 LTS from 2026-10-28. | tooling, versions |
| 62 | React 17 production hydration warnings | None; they exist only in the dev build. | test-strategy |
| 63 | ICU drift (R-042) | None across Node 18–26 on macOS full-ICU builds. Alpine is still open. | versions, test-strategy, docs-quality |
| 64 | react-router / Vite | N/A for search. | dashboard-target |
| 65 | Global CSS in components (pages router) | Build error on both webpack and Turbopack. | dashboard-target |
| 66 | core-ui under antd 6 | Runs in the dashboard only because pnpm tolerates the unmet peers. Under npm it would fail with ERESOLVE. Visual correctness is still open. | dashboard-target |
| 67 | `@ant-design/nextjs-registry` | App Router only. The pages-router `_document` recipe works on 16.4.2 + React 19.3.1. | dashboard-target, versions |
| 68 | Do phase-2 test devDeps leave the runtime tree unchanged? | **No.** 2 runtime lock entries drift. | roadmap |
| 69 | Which commit do the stage nightly / prod nightly builds deploy? | Stage builds `main`. Prod rebuilds the same SHA and **does not roll out**. | roadmap, tooling |
| 70 | Query parsing, Next 10 vs 16 | Identical for 21 edge inputs. Only a `__proto__` key is dropped on 16. | risk-hunter |
| 71 | Link `legacyBehavior` in Next 16 | Supported but deprecated (since 15.3, dev `errorOnce`). | risk-hunter, nextjs-late |
| 72 | Next 16 CSS chunking in the pages router | Skips `pages/` chunks, so no reordering. | risk-hunter |
| 73 | Props validation in prod (R-045) | Dev / build-time SSG only, in both 10 and 16. | risk-hunter |
| 74 | Rewrite and header patterns on Next 16 | Compile and match as before. | risk-hunter |
| 75 | Static 404 with a custom App gIP | Unchanged: not prerendered. | risk-hunter |
| 76 | robots / sitemap / favicons / manifest | Not served by this app. Favicons are absolute core.ac.uk URLs. Which service serves them is still open. | http-contract |
| 77 | gSSP redirect+props, notFound+props on 11–16 | Accepted (308 / 404). | http-contract, nextjs-* |
| 78 | `/api/healthz/` status | 200, and `/api/healthz` → 308, on all versions. Not gateway-routed. | http-contract, tooling |
| 79 | gzip / HEAD / POST across versions | Identical, except that ETag and Content-Length are lost with React 18 on 12.3.7. | http-contract |
| 80 | Can test tools run on Node 18? | Mostly no (X02.5). A tooling-Node split is required. | empirical, versions, tooling |

---

## 3. Still-open [VERIFY] items (become VF-## in STATUS)

| Item | What settles it |
|---|---|
| Does the real gateway controller apply longest-prefix + `ReplacePrefixMatch` for `/search/_next/data`? | An ops PR on stage, then a curl through stage (X20.1) |
| Which Host does the in-cluster API expect? (OD-20) | Ops log on the API service, or a prod-only check at W4(e) (X40.17) |
| Live API shapes: 410 body; `publishedDate` format; how common empty date / numeric year, `doi: null`, missing `location` are; whether `links.display` uses `/display/` | One recorded sample with an API key (X40.21) |
| Is the prod `SENTRY_DSN` set, and what is its host? Prod CSP outcome | Ops secret check plus a browser on prod (X30.20) |
| linux/arm64-musl `npm ci`; alpine ICU; Next 12.3–16 runtime on alpine arm64; 12.1.6 lockfile patcher | T-901 in Docker on arm64 (Docker daemon was off) |
| T-801 pixel effect of the CSS-minifier change (X10.5); feasibility of option A | A W4(c) run |
| msw 2.11.2 on Node 18 (disputed); msw 3 under Jest 30 on Node 24 | A 10-minute lab on both versions |
| Stryker 10 with legacy decorators / Babel 7 | A phase-2 spike (45 C2) |
| Next build reproducibility (two identical builds) for G5 and the inertness proof | Build the unchanged tree twice and diff |
| Cross-arch / cross-host pixel determinism; fonts in the Playwright image | The stability-proof run (X40.12) |
| Local `next dev` / `build` on Node 24 with Next 10 | One local run with the OpenSSL flag |
| `@ant-design/cssinjs` cssVar `useId` key across SSR and client; core-ui visual correctness | The 7.0 spike |
| CORS on credentialed E21/E22 logo GETs; GA4 enhanced-measurement history page views | Real API CORS config; GA property settings |
| Cloudflare edge additions and caching; who serves robots/sitemap | The ops / edge checklist (X40.34) |
| Next 17 webpack support | Track the release notes (new OD-48) |
| Dependabot security updates enabled? ACR tag immutability? `azure` environment rules? NPM_TOKEN scope? GHCR/ACR access from CI? Org plan (LFS)? | Repo / org settings with ops |
| Effort multipliers (phase 2 / 6 / 7) | Calibration spikes (X50.8, X70.13, X80.2) |
| Traffic volume for the session rule-of-three | GA data |
| bibtex-parse-js licence for vendoring | Read the package licence |
| css-loader `~` imports on Next 14–16 | A W6/W7 build |
| Standalone `HOSTNAME`; SIGTERM handling per Next major | Only if OD-19 changes; a rollout test (T-902) |
| logrocket 11.0.0 endpoints | Not needed (the target is 12.4.0) |
| Keyboard behaviour on disabled filters at runtime | Playwright on the baseline |
| Nested anchors causing a React 18 hydration error on the **real** app (shown on a 13.5 replica) | The T-701 run at W6(a) |

---

## 4. Requirement-compliance adjustments (recommendations flagged `violates`, now made compliant)

| Source | Violates | Adjusted recommendation |
|---|---|---|
| VER-08, VER-09, TCD-29 (msw pins) | M1 | Record msw 3 as an M1 exception with a closing step (re-test under Jest 30 on Node 24 or Jest ESM mode at 6.0). Replace the Node-18 msw preload with a real HTTP stub, so no Node-18 msw pin is needed. |
| VER-10 (Babel 7) | M1 | Babel removal (CS-BAB-1..5 + SWC at 6.7) becomes **mandatory**. Babel 7.29.x is an exception until then. |
| VER-11, TCD-16, RP-10, RH-14 (TS 6.0.3) | M1 | A committed step at 6.1 runs `tsc` 7 via the alias. Plain TS 7 follows once typescript-eslint supports it. Re-checked at each gate. |
| VER-14 (bibtex ORCID swap) | M3 | Vendor 0.0.24 verbatim. Swap to ORCID only after T-114 pins the thrown type and the owner accepts. |
| VER-20, DS-06, RM-16 (frozen design deps) | M1 | A per-package exceptions table with closing steps (most close at 7.1 ownership or 7.F). |
| DT-07 (stay on ESLint 9) | M1 (EOL) | Rejected. ESLint 10 at W1 on tooling Node 24 (conflict C-1). |
| TCD-01 (immutable refs for all deploys) | M3/D1 | Digests for push and dispatch only. The nightly stays build-only until the owner decides, because a rollout would bring daily fresh data. |
| RH-01 (title template) | M3 | Use `${data.title ?? ''} - CORE` so null/undefined output is unchanged. |
| RH-10 (pin caniuse-lite) | M1 | Pin for the track, with an explicit unpin step at the L1 sweep. |
| HC-09, EM-01 (escape `<` in JSON-LD) | M3 | Only as an owner-approved separate security PR (OD-36). Otherwise preserve and pin. |
| HC-25 ("keep Node 22") | M1 | Node 24 at W4(e), then Node 26. |
| nextjs-late-15 (block `/_next/image` at the gateway) | M3/D1 | Owner OD-41 required. |
| UI-26 (antd "owner-approved exception") | M2 | Exceptions only for non-visual, non-behavioural items. Never for pixel or behaviour differences. |
| NE-05 option A (restore cssnano-simple 2.0.0) | M1 | If chosen, it is an exception with a removal step. Default is option B: accept only at 0 px. |
| UI-25 (tiering) | M5 | Tiers are for per-PR cost only. Every gate runs all tiers. |
| BL-01 (latest-wins SWR mutation would "fix" the claim race) | M3 | Preserve the race. Do not port the flow to SWR mutation without a parity proof. |
| TS-01 CM-1 ("100% of C/H mutants") | — (infeasible) | Scoped to baseline-reproducible risks. Upgrade-only risks are tested against the real candidate. |
| test-strategy-V2 (rule of three as "the 95% statement") | M7 | Always reported with the detection-power term (C1 kill rate) and the fixture caveat. |
| DQ-15, OD-05 ("accept ICU diffs") | M2 | No diffs exist. Drop the exception. |
| RM-08 (mobx 6) | M1 | MobX removal at 6.5 closes the gap. Fallback: a mobx 7 step if phase 6 slips. |
| TCD-19 (retry loop) | correctness | The loop in the report exits 0 on total failure. Use an explicit chain. |

---

## 5. Conflicts between dimensions (with recommended resolution)

| # | Conflict | Resolution and reasoning |
|---|---|---|
| C-1 | **ESLint target.** VER-01/TCD-06: 10.13 at W1 with the typescript-eslint parser. DT-07: ESLint 9 + @babel/eslint-parser until Babel exits. RP-29/DT-22: lint-staged 15 on Node 18. | **ESLint 10 at W1 on tooling Node 24.** ESLint 9 is EOL and deprecated, and @babel/eslint-parser 7 crashes on 10, so DT-07's path keeps an EOL tool for the whole track. typescript-eslint parses every file except 2, which move to W0. Plugin peers are capped at ^9 but load. Rules that crash on 10 are replaced (import-x, @eslint-react) or dropped with a parity note. The tooling-Node split removes the Node-18 constraint. |
| C-2 | **When runtime Node 24 lands.** versions, nextjs-*, tooling: W4(e) after 12.3.7. RP-08: a phase-2 experiment, then a Node-only wave right after W0. The tooling table says "22 at W4, 24 after S". | **Node 24 at W4(e)** (verified on 12.3.7–16.4.2). RP-08's spike is optional. Next 10 on a Node 24 runtime is unverified beyond md4. The tooling split already unblocks the tools. ICU shows no diff, so moving early gains little. Node 26 comes later (12.3.7 breaks on 26). |
| C-3 | **Data-route fix.** NE-01/EM-03: `beforeFiles`. nextjs-late-01/HC-01/HC-21: gateway rule. | **Gateway rule (OD-03 B), mandatory before 12.x prod.** `beforeFiles` fixes 12.3 only; 15/16 still return HTML. The gateway rule is neutral on 10.2.3. Fallback: C (namespace). |
| C-4 | **Next 11 hop.** NE-02: 12.1.6 as the intermediate. EM-02: go straight to 12.3.7, or 11.1 with `webpack5:false`. | **10.2.3+wp5 → 12.1.6 → 12.3.7.** 12.1.6 is verified on the real app. It still has the pre-12.2 router, so the afterFiles rule works before the gateway change. It is the first version that builds without the OpenSSL flag. `webpack5:false` on 11 adds a webpack-4 hop that gives no attribution. |
| C-5 | **Q-050 fix.** RM-03: UTC-first render. RM-03 verifier: replicate the server computation. UI-21: there may be no mismatch at all. | Sample the live format first. If zone-less: WATCH. Otherwise the first render replicates the server computation. |
| C-6 | **msw version.** VER-09: 2.11.2 OK. TS-02: 2.11.2 fails. BL-11: ≤2.10.5. TCD: 2.15.0 for the Node-18 preload. | The SSR mock is a real HTTP stub, so no msw runs in the Node-18 process. Jest uses 2.15.0 with the allow-list. If a preload is kept: 2.11.1. 2.11.2 is [VERIFY]. |
| C-7 | **TypeScript.** TCD/RP/RH: 6.0.3 with re-checks. DT-06: alias strategy with tsc 7. RP verifier vs DT on whether `useTypeScriptCli` defaults on. | Both together: 6.0.3 API now, plus the alias tsc-7 step at 6.1 (needed for M1). `useTypeScriptCli` defaults to true (`config-shared.js:263`); Next's error says "set back to true". |
| C-8 | **tsconfig `jsx`.** RP §6: `preserve`. DT-10: Next forces `react-jsx`. | Follow Next (it forces the value). |
| C-9 | **Automatic JSX runtime.** RM-02: drop or defer CS-R19-1. DT-09: needed for TSX and antd. | CS-R19-2/3 (move defaults) first. Then switch the runtime in its own PR at 6.1, gated by T-404 under both runtimes plus T-801. |
| C-10 | **SWR scope.** RP 6.4: filters, aggregations, similar works, provider lists. DT-13/BL-12: only similar works fits. | DT-13. Request-log parity is the rule, and only read-on-mount flows can meet it. The owner confirms this satisfies M6 (OQ-12). |
| C-11 | **Vendoring layout.** Plan: app tree (A) + Babel ignore. DS-02: package copy (C). RP-14: tgz W0.5 + inline W5. design-system-V1: the `.gitignore` trap. | tgz at W0.5 (zero code-path change). At W5, prefer (ii), the directory copy with `--install-links` + guards + `.gitignore` negation: 101 imports unchanged and externals kept. (A) is acceptable only with the X60.1 fixes. Owner decides via OD-21. |
| C-12 | **Pure-CSS sequencing.** RP-11: drop PostCSS at 6.9. Its verifier: impossible while design CSS needs it. DS-08: freeze the processed CSS. DT-02: keep modules. | DS-08 O1 first, then P1 (standard syntax, modules kept, plugins removed). |
| C-13 | **bibtex.** VER-14: OD-17 → B. RP triage: keep (A) per D1. | Vendor 0.0.24 verbatim. Behaviour is identical (D1/M3) and the 450-entry tree is gone (audit gate). |
| C-14 | **Interim prod stops.** VER-05: W4/W6 stops stage-only, or skip to 15.5.28. RP-16: every step to prod. | Every step to prod, for attribution. Short dwell. Gateway image block (OD-41). These stops are not a regression vs 10.2.3, which is exposed to a superset. |
| C-15 | **Nightly cron.** RP-03/TCD-01: digests. TCD-01 verifier: a nightly rollout would change behaviour. | Digests for push and dispatch. The nightly stays build-only until the owner decides. |
| C-16 | **Stage soak.** TS-17: prod-config soak in stage. TS-V1: that hits the prod API. RP-17: replay ≤2 rps. RP-17 verifier: stage SSR hits api-stg. | In-namespace stub or low-rate replay, with ops sign-off. The in-cluster Host path is checked only in prod (X40.17). |
| C-17 | **Gate names and content.** RP: S/A/F. DQ: GATE-S/ANTD/DONE. TS: CM-1..7. | Names GATE-S / GATE-A / GATE-F. Criteria merged in 55. Measures in 45, C1–C8. |
| C-18 | **Confidence thresholds.** DQ: 59/59 faults, 300 cases + 5,000 replay. RP: 46 SILENT at 100%, mutation ≥80%, 14-day non-inferiority. TS: C/H at 100% + M ≥90%, N ≥1,000/2,000, coverage ≥90%. | Merged in X45.1: 100% of baseline-reproducible C/H and SILENT; N ≥1,000 (≥2,000 at GATE-S); mutation ≥80% (≥90% core); coverage ≥90%; 14-day non-inferiority at ×1.05. The owner ratifies (OQ-3). |
| C-19 | **Phase-6 doc home.** BL-27: NEW 35. DT-01: NEW 70 conventions. DQ: 70-phase6. | One doc, 70, with sections: conventions, behaviour contract, sub-waves (M8). |
| C-20 | **Timing of the title fix and Sentry fix.** RH-01: W6. NE-04: W4(b). nextjs-late-12: W0. | W0b. Both are verified neutral on 10.2.3. |
| C-21 | **CSS-hack fix.** EM-06: `typeof reg.test` guard. nextjs-late-04: recursive robust patch. | Robust patch. It is verified identical on 10/12 and works on 13–16, with a zero-match assert. |
| C-22 | **`react-hooks/exhaustive-deps`.** RM-15: off. Dashboard: warn. | Off for the whole track (lint parity, D1). At 6.2, at most `warn`, never auto-fixed. |
| C-23 | **P0 phase-6-only tests.** TS-29: demote. Its verifier: keep. | Keep them P0: they characterise first. |
| C-24 | **Bundled Babel version in Next 16.** 7.27.0 (VER-10) vs 7.26.3 (RM-09). | Immaterial: both are 7.x. |
| C-25 | **OD numbering.** BL-30 proposes OD-28..30, which already exist. RP: 31–35. DQ: 31–40. | A single new series, OD-31..OD-48 (X90.3). |
| C-26 | **LogRocket.** VER-02: silent. RH-04 verifier: LOUD in tests. | Both are true: silent in prod, caught by T-720/T-719 if they run. Fix with CS-LR-2. |
| C-27 | **Effort.** RP: phase 6 43–70 d, phase 7 54–85 d. DT-29: 6a–6e split. | Unverifiable. Calibration spikes settle it. |

---

## 6. Owner questions (only what truly needs the owner)

| ID | Question | Recommendation |
|---|---|---|
| **OQ-1** | S-4 is an executing XSS (X30.1). Do you approve a separate, behaviour-neutral security PR that escapes `<` in JSON-LD, outside D1, before the phase-2 baselines (OD-36)? | Yes |
| **OQ-2** | Change control during the track (OD-31): (A) freeze product changes on `main` until GATE-S, or (B) the re-baseline protocol? | — |
| **OQ-3** | M7 thresholds (OD-35): fault recall 100% (baseline-reproducible C/H + SILENT); mutation ≥80% (≥90% on core files); differential corpus N ≥1,000 (≥2,000 at GATE-S); merged coverage ≥90%; 48 h prod watch per step; 14-day non-inferiority at ×1.05 for GATE-S/A. Ratify or change. | Ratify |
| **OQ-4** | Pipeline and ops (OD-29, with ops). See the list below. | — |
| **OQ-5** | The repo is public. Where do baseline PNGs and fixtures live, and what PII/licence scrubbing applies (OD-24/25)? | Private GHCR OCI artifact, or e2e-only LFS |
| **OQ-6** | Runtime Node 24 at W4(e), then Node 26 (OD-05)? | Yes |
| **OQ-7** | Sentry end state: `@sentry/nextjs` 11 (keeps server errors) vs `@sentry/react` (drops them). Should today's exit-on-uncaught-exception (with DSN) be preserved (OD-14)? | nextjs; preserve |
| **OQ-8** | ESCALATES sign-off (OD-09/OD-40): fix on React 17 at W5.5 the hydration-structural quirks (nested anchors, `/display` breadcrumb and back-link, `Intl` region, Q-050/051, Q-052 as dev-only change)? Should the works SSR-500 cases (X30.3) and the blank pages (X30.4) stay PRESERVE or become ESCALATES? | — |
| **OQ-9** | Framework deltas no code can preserve, per wave (OD-28/39): Cache-Control/ETag/CSP-on-308/Refresh header changes; the head-manager change at 15 (Meta tags survive hydration, X10.8); CSS minifier output at ≥11 (OD-37: accept only at 0 px); Next `_error` page (OD-38: vendor Next 10's?); the JS browser floor (OD-16). Sign the deltas ledger? | — |
| **OQ-10** | Meaning of "pure CSS" (OD-33)? | P1: standard CSS, modules kept, PostCSS plugins removed after O1 |
| **OQ-11** | TypeScript exception (OD-07): 6.0.3 for tooling now, tsc 7 via alias at 6.1, plain 7 when typescript-eslint supports it? | Yes |
| **OQ-12** | Does "adopt swr" (M6) mean "use SWR only where request-log parity is proven" (today: similar works only)? | Yes |
| **OQ-13** | Libraries with visible-output or audit impact. | i18n: vendor data. bibtex: vendor verbatim. |
| **OQ-14** | Design vendoring (OD-21): tgz at W0.5, directory copy (or app tree) at W5, readable ownership in 7.1. Licence: the design `LICENSE` says MIT but `package.json` says UNLICENSED. Which is intended? | — |
| **OQ-15** | Confirm that search will not depend on `@oacore/core-ui` (OD-34). | Confirm |
| **OQ-16** | Security hygiene: block `/static/search/_next/image` at the gateway (OD-41)? Are public source maps intended (OD-42)? | — |
| **OQ-17** | Dependabot policy during the track (OD-32)? | Hold and fold |
| **OQ-18** | Close the stale PRs #389 (Node 24/React 19 on master) and #410 (Next 15.5.14 on main.old) with a link to the plan? | Yes |

**OQ-4 items:**
- the stage cron builds `stage`;
- the prod job is guarded to `main`;
- deploys go by digest;
- the nightly cron stays build-only, or rolls out;
- a weighted canary route, or a 48 h rollout watch;
- the stage soak runs against a stub, or against the prod API at a low rate;
- the gateway `_next/data` rule ships before W4.

**OQ-13 items:**
- i18n-iso-countries: vendor the 6.8.0 data (no text change), or accept 9 changed country names?
- bibtex: vendor 0.0.24 verbatim, or use the ORCID fork?

---

## 7. Surviving critical/high items (top list, after verification)

1. **X10.1** — The `/search/_next/data` rewrite returns 404 on Next 12.2–12.3 (every client navigation becomes a hard reload) and HTML on 15/16 (blank page). Gateway rule required before 12.x prod.
2. **X50.1** — Stage cron deploys `main` over waves. Push to `main` = prod. Prod can be dispatched from any branch. Nightly never rolls out. No rollback by digest.
3. **X00.6/X50.2** — No change control on an active `main` (32 commits since July). Baselines would go red on any product PR.
4. **X00.4/X55.1** — No pre-antd gate (M5). The binary GATE-A is defined.
5. **X45.1** — "≥95%" is not measured (M7). C1–C8 model defined.
6. **X10.14/X60.1** — Vendoring the compiled design into the app tree is re-transpiled by Babel, so exports are lost.
7. **X30.1** — S-4 JSON-LD breakout is an executing stored XSS under the prod CSP. Needs an owner decision.
8. **X40.8/X10.8** — T-708 is red on the baseline: the post-hydration head is already corrupted. Next 15 changes it again.
9. **X10.2** — Multi-child `<title>`: literal `<!-- -->` (13+/R18) or empty (15/16/R19) in SSR. Template-literal fix with `?? ''` in W0b.
10. **X20.2** — W4 not executable: 11.1.4 cannot build the real app. Corrected sequence 10.2.3+wp5 → 12.1.6 → 12.3.7 → Node 24.
11. **X10.3** — From webpack 5 the server runs `@sentry/browser`, so server errors are lost. `isServer` fix in W0b.
12. **X10.6** — `next build` lints on 11–15 and fails on 7 existing errors. `ignoreDuringBuilds` in W0b.
13. **X10.7** — The CSS camelCase hack throws on 13+. Robust patch in W0b.
14. **X10.5** — CSS minifier output drifts from Next 11 (13 rules). OD-37.
15. **X10.4** — Crash semantics: Sentry 5/7 exit 1 on an uncaught exception; Sentry 11 stops exiting. Q-009/R-055 are wrong.
16. **X10.9** — Interim prod stops carry critical Next advisories. Security column; gateway image block.
17. **X10.10/X70.4** — axios changes Host, Blob (citations silently emptied), string-body Content-Type, params, errors (secret leak into `__NEXT_DATA__`). Transport spec.
18. **X10.11/X70.3** — zustand 5 SSR uses the initial state; a naive port gives a 500 or #418. Store spec.
19. **X70.2** — "Pure CSS" as the dashboard does it is a Next pages-router build error. OD-33 P1 after O1.
20. **X60.3** — No ownership end state (M4). About 61–74% of the design closure has no antd equivalent.
21. **X02.1/X02.4/X02.9/X02.10** — M1 targets: ESLint 10 now (9 is EOL); Node 24 then 26; Babel removal mandatory; TypeScript 6.0.3 plus a tsc-7 step.
22. **X02.5/X02.6/X40.1** — Tooling Node vs runtime Node. Test pins break on the baseline (msw, jest-dom, jest.config).
23. **X40.4/X40.5** — The tested artefact is not the shipped image. Test devDeps change the prod tree.
24. **X40.2/X40.3** — Tests in `pages/` break the build. `.gitignore` swallows `test/build` and `data/__tests__`.
25. **X40.6/X40.7** — The SSR mock is not wire-level. Hydration detectors are blind on React 17. Add T-728.
26. **X40.10** — The HTTP parity contract cannot be satisfied as written. Contract-as-data plus a signed deltas ledger.
27. **X40.17** — Stage is not prod-equivalent: the internalised path never runs on stage, stage's Internal_API points at the PROD API, and there is no canary.
28. **X30.2/X30.3/X30.4** — Works 410 → 500; empty-date and no-provider pages → 500; five blank-page crashes. Register as PRESERVE quirks with fixtures.
29. **X30.6/X30.7/X30.8/X30.9/X30.10** — Hydration-structural quirks; the consent cookie key is wrong in the plan; the GA `search` hit is a no-op; claim race; `checkLogo` null requests.
30. **X01.2** — The wave mechanics contradict deploy-on-merge. Corrected runbook.
31. **X60.2** — Vendoring option C plus the `.gitignore` `build` trap and the install-links / Dockerfile `.npmrc` traps.
32. **X20.9** — The design postinstall needs a root `design.config.js` before `npm ci`, or every icon 404s.
33. **X10.12/X80.1** — antd SSR CSS order (needs a layer) and a new `_document` without `lang`.
34. **X10.13/X70.5** — SWR defaults change request counts. Only similar-works fits.

---

## 8. Proposed doc structure (merges the docs-quality proposal with what the other dimensions need)

**Principles:**
- One owner file per topic.
- Mutable state lives only in `STATUS.md`.
- Derived tables are generated by `tools/check-docs.py` (prototype: `exp/docs-quality/check-docs.py`) and checked in CI-1.
- `findings/` is frozen evidence with an ERRATA file.
- Each file stays readable in one pass (about 10k tokens), and total volume stays near today's ~200 KB (M8).

| File | Owns | Status | Fed by (this file) |
|---|---|---|---|
| `README.md` (≤8 KB) | What and why; M1–M9 → D-map; rules in 10 lines; doc map; reading order per task (orient / do step N / write tests / triage); ID table; glossary; repos table | trim | XRD.* |
| `STATUS.md` | **Only mutable file:** current phase/step; branches and PRs; baseline (`origin/main@cc0e228`, tree `a825839`); golden digests and registry; per-ID status tables (R, Q, T, OD, VF); VF-## register (§3); session log | NEW | §3, X00.8 |
| `00-decisions.md` | D1–D5, plus D1 extended to phases 6/7, D4b ownership, D4c design freeze, D6 latest + ledger, D7 gates, D8 confidence, change control, security-exception slot, docs rule; rewritten phase list. Owner-only. | extend | X00.* |
| `01-playbook.md` | Session start/end; prerequisites (two Nodes, `NPM_TOKEN`, `API_KEY`, Docker); branches and PR/commit rules; **the per-step runbook** (X01.2) and rollback-by-digest; single DoD; records template; stop conditions; doc change control; repo-root pointer stub | NEW | X01.* |
| `02-version-matrix.md` (M1) | Package × installed × latest@date × peers/engines × target per wave × final × blocker × closing step × status; tooling-Node vs runtime-Node table; M1 exceptions ledger; regenerated each wave from `exp/versions` scripts | NEW | X02.* |
| `10-risk-register.md` | Risks with Detector (★ = fault-injection verified) and Status columns; new rows from X10 | edit | X10.* |
| `20-change-sites.md` | CS rows for the ops pre-step, W0, W0b, W0.5, W1–W8 (re-tagged W4 sequence), with Anchor column; N/A matrix per Next guide; pointers to 70/80 for phases 6/7 | edit | X20.* |
| `30-quirks-register.md` | Quirks with Status; new Q-069..Q-090 (from ui-flows report) and the X30 rows; security notes S-1..S-10 | edit | X30.* |
| `40-test-strategy.md` (~25 KB) | Parity contract (with the framework-delta mechanism); harness architecture (HTTP SSR stub, proxy generated from YAML, Dockerfile.test, compose topology); layers; determinism; triage; harness-change protocol | split + rewrite | X40.1–X40.36 |
| `41-test-inventory.md` | T-### tables, authoritative for Wave and Risks; per-risk black-box / white-box / mutant columns; case tables lifted from findings; new T-6xx/T-7xx/T-8xx | NEW (split) | X40.*, ui-flows V21–V39 / J18–J32 |
| `42-baselines-and-ci.md` | Phase-2 order; golden-image spec (arm64, digest, private registry, clean origin checkout); inertness proof; CI workflow structure (CI-1..CI-8); baseline storage; accepted-diff ledger and HTTP deltas ledger formats | NEW (split) | X40.4/5/12/31/32/33, X50.4 |
| `45-confidence-model.md` (M7) | C1–C8 definitions, thresholds (owner-ratified), scripts, sign-off statement | NEW | X45.1 |
| `50-roadmap.md` | Phases 2–5 and their steps (ops pre-step, W0, W0b, W0.5, W1→W2→W3 serial, W4 a–e, W5, W5.5, W6, W7, W8 mandatory, L1); entry/exit per step (binary); security column; effort and calendar view; pointers to 55/70/80 | rewrite | X50.* |
| `55-gates.md` (M5) | GATE-S, GATE-A (pre-antd), GATE-F; W5 vendoring gate G1–G7; evidence list; sign-off template | NEW | X55.* |
| `60-design-ownership.md` (M4) | Provenance; vendoring options (tgz W0.5, W5 layout); guards; preserved-behaviour list; M1 exceptions for design deps; O1 freeze of processed CSS and sprite; 7.1 ownership plan per unit; assets; licence; end state | rename + extend | X60.* |
| `70-phase6.md` (M6) | Adopt/Adapt/Reject conventions; behaviour contract (endpoints, per-action requests, store table, defaults diff); sub-waves 6.0 driver contract → 6.1 TS infra → 6.2 lint → 6.3 axios → 6.4 swr → 6.5 zustand → 6.6 TS conversion → 6.7 SWC → 6.8 Sentry 11 → 6.9 pure CSS → 6.10 L1 → GATE-A; per-step tests, exit, rollback, effort | NEW | X70.* |
| `80-phase7-antd.md` (M6) | Owner amendments before 7.0; 7.0 antd infrastructure + `_document` + 0-px spike; 7.1 ownership + owned global CSS; 7.2 one unit per PR leaf-first; 7.F removal + L2 → GATE-F; theme tokens; icons 6; forms; acceptance | NEW | X80.* |
| `90-open-decisions.md` | Generated index (answer, basis, owner-needed, blocks-phase-2); OD-01..30 amended; OD-31..48 new | extend | X90.* |
| `findings/` | Frozen evidence + `findings/README.md` banner (non-normative, FW labels) + `findings/ERRATA.md` | keep + 2 files | XFE.1 |
| `records/` | `records/<step>.md` and `records/gate-{S,A,F}.md` (template in 01) | NEW (on first use) | X01.3 |
| `tools/check-docs.py` | ID resolution, anchors, counts, wave/risk/test consistency, generated tables | NEW | X40.36 |

**Reading order per task:**
- **Orient:** README → STATUS → 00.
- **Do step N:** 01 runbook → the 50 row → 20 CS rows → 41 T rows → 55 if it is a gate.
- **Write tests:** 40 → 41 → 42.
- **Phase 6/7:** 70/80 → 45 → 55.
- **Triage:** 40 §triage → 30 → 10.

---

## Appendix A — Refuted findings and refuted sub-claims

**Refuted findings:**
- **nextjs-late-02** ("T-702/T-604 can pass on 15/16 while the page is blank"). Refuted: 40 §2.6 fails every journey on pageerror/console.error, and the 15.5 crash logs a TypeError. T-702 also diffs the API request log, and T-604 requires "200 JSON with pageProps". All that remains is an optional content-type assertion (folded into X40.23).
- **nextjs-late-17** ("R-013 is SILENT nested `<a>`, not LOUD-browser"). Refuted: a 13.5.11 build without `legacyBehavior` emits nested anchors **and** #418/#423 page errors in production. R-013's LOUD-browser rating is correct.

**Refuted or corrected sub-claims inside surviving findings:**
- **TS-05 / test-strategy resolved item.** The claim "class names byte-stable from Next 10 to 16" is false: 10/12 use md5 and 13+ use sha1.
- **TS-28.** The claim "axios uses the http adapter under jest-fixed-jsdom" is false: jsdom defines `XMLHttpRequest`, so the XHR adapter is used.
- **TS-13.** The claim "`page.clock.install()` stalls timers" is false: install does not freeze time.
- **TS-11.** The claim "jest-dom 6.x resolves to 6.10.0" is false: 6.10.0 is deprecated and npm resolves `^6` to 6.9.1.
- **TS-17.** The claim "the Internal_API path is never exercised on stage" is overstated: the loader calls do use it, on a cache miss.
- **TS-24.** The claim "the rule contradicts OD-05" is overstated: §9.5 already allows an owner decision. The real gap is the missing ledger format.
- **RP-17.** The claim "stage SSR calls the prod API" is wrong for the main SSR calls, which go to api-stg. The prod service is reached only via the loader's cache-miss path. A prod-config image in stage **would** hit prod (test-strategy-V1).
- **UI-20.** The claim "three loader calls per SSR request with a 3 s wait" is false in the committed state: the cache files are present.
- **UI-03.** The claim "react-ga4 3 may change send semantics" is false: the code branch is identical.
- **UI-09.** The claim "suggestions dropdown missing" is false: it is already V14.
- **UI-19.** Mostly covered already by R-009 and T-003(a). Only the modal-at-767 screenshot is new.
- **HC-05.** The claim "numeric `datePublished` on outputs" is false: it is the string `"2001"`.
- **HC-10.** `data-n-head`/`data-reactroot` never occur in the 10.2.3 baseline (`data-reactroot` appears from 12).
- **HC-01, HC-21.** The claim "OD-03 A is wrong, W4(d) reaches prod broken" is overstated: OD-03 already switches to B when T-702 fails. The finding is to promote B to a scheduled prerequisite.
- **NE-16.** The claim "the image optimizer is reachable" was replica-only in that dimension. It was confirmed on the real baseline by HC-20.
- **nextjs-late-08.** The claim "13.5–14.2 same Cache-Control" is false: the drift is non-monotonic.
- **nextjs-late-14.** The claim "hard build failure from 14+" is false: only 14.x lacks the WASM fallback.
- **TCD-19.** The claim "the `|| npm install` fallback absorbs transient registry errors" is unsupported. The report's own retry loop is also buggy.
- **TCD-31.** A gate based on "scheduled runs of the branch under test" is impossible: schedules run only on the default branch.
- **DS-03.** The "15/34 identical" count is inflated by normaliser artefacts.
- **DS-05.** The claim "about 75% of closure LOC has no antd equivalent" is high: it is about 61%, or 74% if Select is counted.
- **DS-13.** "11 files" should be 12 files (13 sites).
- **DS-17.** Severity is low: T-418 already catches a dead sprite.
- **RM-11.** The D4/W5-dependency argument is weak: 60 §1 allows the vendored edit.
- **RM-15.** CS-LINT-2 already enables only rules-of-hooks.
- **DT-03.** The claim "silent empty HTML" is more likely an SSR 500.
- **BL-10.** The claim "no wire-level Host test" is false: T-104 and T-607 already assert it.
- **BL-12.** The claim "SWR cannot reproduce counts" is overstated: SWR can be configured. The real point is that per-render effects are not SWR use cases.
- **BL-22.** The keep-alive gate is moot (Node ≥20 before phase 6).
- **BL-25.** Already covered by findings/03 and T-203.
- **BL-30.** The proposed IDs OD-28..30 collide with existing ODs.
- **RH-04.** The claim "silent" is overstated in tests (LOUD via T-720).
- **RH-11.** The per-class counts were overstated (see X40.11).
- **RH-10.** The claim "no recording of browserslist" is false: 40 §6 step 3 records it. The gap is the pin and the guard.
- **VER-07.** The literal claim "docs bind all tools to Node 18" is false. The conflation of tooling and runtime Node is real.
- **VER-32.** The claim "cosmiconfig 10 is ESM-only" is false.
- **RP-27.** The claim "OD-01/04/15/30 are answered by the M-requirements" is false: they still need owner confirmation.
- **RP-24.** The claim "security updates are enabled" is UNCONFIRMED.
- **DQ-* and EM-*.** No adversarial pass ran on these. None contradicts a confirmed finding, except EM-03's beforeFiles fix, which is superseded (C-3).

---

## Appendix B — Source-ID → consolidated-entry map

- **versions:**
  - VER-01 X02.1 · VER-02 X10.15/X20.6 · VER-03 X02.11 · VER-04 X20.4 · VER-05 X10.9 · VER-06 X02.4
  - VER-07 X02.5 · VER-08 X02.6/X40.1 · VER-09 X02.6 · VER-10 X02.9 · VER-11 X02.10 · VER-12 X02.7
  - VER-13 X02.8 · VER-14 X02.13 · VER-15 X02.14 · VER-16 X10.25/X20.9 · VER-17 X20.9/X10.18 · VER-18 X20.21/XFE
  - VER-19 X02.12 · VER-20 X02.16/X60.5 · VER-21 X02.18/X80.1 · VER-22 XRD.3 · VER-23 X02.17 · VER-24 X02.15
  - VER-25 X10.25 · VER-26 X10.19 · VER-27 X10.25 · VER-28 XRD.4 · VER-29 X02.0 · VER-30 X02.6/X55.2
  - VER-31 X10.10 · VER-32 X40.1 · VER-33 X02.6
- **nextjs-early:**
  - NE-01 X10.1/X20.1 · NE-02 X20.2 · NE-03 X10.6 · NE-04 X10.3 · NE-05 X10.5 · NE-06 X20.4
  - NE-07 X20.2 · NE-08 X20.13 · NE-09 X10.25 · NE-10 X10.25/X40.24 · NE-11 X10.19 · NE-12 X02.4
  - NE-13 X40.10 · NE-14 X20.2 · NE-15 X10.7 · NE-16 X10.9 · NE-17 X10.20 · NE-18 X20.11
  - NE-19 X20.17 · NE-20 X20.3 · NE-21 X40.1 · NE-22 X10.25 · NE-23 X02.15 · NE-24 X20.17
  - NE-25 X40.25 · nextjs-early-V1 X40.10
- **nextjs-late:**
  - 01 X10.1 · 02 refuted (X40.23) · 03 X10.2 · 04 X10.7 · 05 X10.3 · 06 X10.6
  - 07 X10.8/X40.8 · 08 X40.10 · 09 X10.17 · 10 X02.4 · 11 X20.7/X80.8 · 12 X20.1
  - 13 X30.6/X40.7 · 14 X10.19 · 15 X10.9 · 16 X10.25/X20.3 · 17 refuted · 18 X10.25/X20.24
  - 19 X10.4/X40.18 · 20 X40.1 · 21 X02.15 · 22 X20.15 · 23 X20.7/X40.28 · V1 X10.8/X40.8
- **react-mobx:**
  - RM-01 X10.2 · RM-02 X10.25/X20.12 · RM-03 X20.12/X30.24 · RM-04 X40.7 · RM-05 X30.6/X40.7 · RM-06 X30.6
  - RM-07 X30.6 · RM-08 X02.8 · RM-09 X02.9 · RM-10 X10.21 · RM-11 X20.12/X50.5 · RM-12 X40.29
  - RM-13 X45.1 · RM-14 X40.22 · RM-15 X20.8 · RM-16 X60.5 · RM-17 X10.25 · RM-18 X10.25
  - RM-19 X40.29 · RM-20 X30.19 · RM-21 X10.22 · RM-22 X40.29 · RM-23 X30.19
- **design-system:**
  - DS-01 X10.14/X60.1 · DS-02 X60.2 · DS-03 X60.2 · DS-04 X60.4 · DS-05 X60.3 · DS-06 X60.5/X02.16
  - DS-07 X40.24 · DS-08 X60.6 · DS-09 X60.7 · DS-10 X30.15 · DS-11 X55.4/X10.18 · DS-12 X55.4
  - DS-13 X60.8 · DS-14 X60.10 · DS-15 X80.3 · DS-16 XFE · DS-17 X40.24 · DS-18 X60.4
  - design-system-V1 X60.2
- **business-logic:**
  - BL-01 X30.9 · BL-02 X30.2 · BL-03 X30.3/X30.4 · BL-04 X30.10 · BL-05 X10.10/X70.4 · BL-06 X10.10
  - BL-07 X10.10 · BL-08 X10.10/§2 · BL-09 X40.17 · BL-10 X40.6 · BL-11 X02.6 · BL-12 X10.13/X70.5
  - BL-13 X30.11 · BL-14 X30.11 · BL-15 X30.12 · BL-16 X30.15 · BL-17 X30.17 · BL-18 X10.20/X40.37
  - BL-19 X40.4 · BL-20 X10.24 · BL-21 X10.10 · BL-22 X10.10 · BL-23 X70.4 · BL-24 X10.11
  - BL-25 X70.14 · BL-26 X30.16 · BL-27 X70.1 · BL-28 X40.22 · BL-29 X70.1 · BL-30 X90.3
  - BL-31 X40.6
- **ui-flows:**
  - UI-01 X40.8 · UI-02 X30.7 · UI-03 X30.8 · UI-04 X30.3 · UI-05 X30.4 · UI-06 X30.6
  - UI-07 X30.6 · UI-08 X40.15 · UI-09 X40.14 · UI-10 X40.14/X30.23 · UI-11 X30.14 · UI-12 X30.13
  - UI-13 X40.15 · UI-14 X30.13 · UI-15 XRD.4 · UI-16 X30.19/X40.26 · UI-17 X30.1 · UI-18 X30.23
  - UI-19 X60.9 · UI-20 X40.22 · UI-21 X30.24 · UI-22 X40.4 · UI-23 X40.7 · UI-24 X60.9
  - UI-25 X40.14 · UI-26 X55.1/X80.4
- **tooling-ci-deploy:**
  - TCD-01 X50.1 · TCD-02 X50.1 · TCD-03 X20.9 · TCD-04 X40.2 · TCD-05 X40.3 · TCD-06 X02.1
  - TCD-07 X02.2 · TCD-08 X02.5 · TCD-09 X40.5 · TCD-10 X40.4 · TCD-11 X20.9/XRD.2 · TCD-12 X40.12
  - TCD-13 X40.31 · TCD-14 X20.8 · TCD-15 X20.8 · TCD-16 X02.10 · TCD-17 X02.3 · TCD-18 X02.3
  - TCD-19 X20.9 · TCD-20 X40.32 · TCD-21 X40.34 · TCD-22 X40.10 · TCD-23 X20.11 · TCD-24 X30.20
  - TCD-25 X40.27 · TCD-26 X50.1 · TCD-27 X40.32 · TCD-28 X40.33 · TCD-29 X02.6 · TCD-30 XRD.2
  - TCD-31 X50.1 · TCD-32 X70.1 · TCD-33 X40.27 · TCD-34 X40.32
- **test-strategy:**
  - TS-01 X45.1 · TS-02 X40.1 · TS-03 X40.6 · TS-04 X40.4 · TS-05 X40.11 · TS-06 X40.7
  - TS-07 X40.35 · TS-08 X40.28 · TS-09 X40.1 · TS-10 X40.1 · TS-11 X02.6 · TS-12 X40.12
  - TS-13 X40.13 · TS-14 X40.14 · TS-15 X40.14 · TS-16 X40.4 · TS-17 X40.17 · TS-18 X40.17
  - TS-19 X40.16 · TS-20 X40.16 · TS-21 X40.19 · TS-22 X40.18 · TS-23 X40.20 · TS-24 X40.10
  - TS-25 X40.30 · TS-26 X40.26 · TS-27 X40.5 · TS-28 X40.1 · TS-29 X40.35 · TS-30 X40.36
  - V1 X40.17 · V2 X45.1
- **dashboard-target:**
  - DT-01 X70.1 · DT-02 X70.2 · DT-03 X10.11/X70.3 · DT-04 X10.10/X70.4 · DT-05 X10.12/X80.1 · DT-06 X02.10
  - DT-07 X02.1 · DT-08 X02.18 · DT-09 X20.19 · DT-10 X70.6 · DT-11 X10.13 · DT-12 X10.13/XFE
  - DT-13 X70.5 · DT-14 X70.4 · DT-15 X70.3 · DT-16 X60.10 · DT-17 X80.5 · DT-18 XFE
  - DT-19 X80.1 · DT-20 X60.11 · DT-21 X70.12 · DT-22 X02.5 · DT-23 X02.3 · DT-24 X70.7
  - DT-25 X40.38 · DT-26 X20.20 · DT-27 X20.20 · DT-28 X02.7 · DT-29 X70.13 · DT-30 X80.2
  - DT-31 X10.17/X80.6 · V-01 X10.11 · V-02 X10.10
- **roadmap-process:**
  - RP-01 X50.1 · RP-02 X01.2 · RP-03 X50.1 · RP-04 X00.6 · RP-05 X00.4/X55.1 · RP-06 X00.5/X45.1
  - RP-07 X40.5 · RP-08 X02.4 · RP-09 X02.0 · RP-10 X02.10 · RP-11 X70.2 · RP-12 X60.3
  - RP-13 X60.1 · RP-14 X60.2 · RP-15 X50.7 · RP-16 X50.3 · RP-17 X40.17 · RP-18 X01.3
  - RP-19 X50.8 · RP-20 X70.1 · RP-21 X80.1 · RP-22 X50.4 · RP-23 XRD.2 · RP-24 X50.9
  - RP-25 X50.10 · RP-26 X00.1/X00.2 · RP-27 X90.1 · RP-28 X40.33 · RP-29 X50.3 · RP-30 X40.30
  - RP-31 X40.34 · RP-32 X02.12 · RP-33 XRD.1 · V1 X40.2 · V2 X40.17
- **risk-hunter:**
  - RH-01 X10.2 · RH-02 X10.4 · RH-03 X10.16 · RH-04 X10.15 · RH-05 X50.1 · RH-06 X40.17
  - RH-07 X40.18 · RH-08 X10.10 · RH-09 X20.13 · RH-10 X10.18 · RH-11 X40.11 · RH-12 X70.2
  - RH-13 X80.1 · RH-14 X02.10 · RH-15 X10.23 · RH-16 X10.8 · RH-17 X40.27
- **http-contract:**
  - HC-01 X10.1 · HC-02 X10.2 · HC-03 X30.2 · HC-04 X30.3 · HC-05 X30.3 · HC-06 X30.18
  - HC-07 X40.10 · HC-08 X40.27 · HC-09 X30.1 · HC-10 X40.9 · HC-11 X30.22 · HC-12 X20.11
  - HC-13 X40.25 · HC-14 X40.26 · HC-15 X40.34 · HC-16 X20.14 · HC-17 X40.23 · HC-18 X40.10
  - HC-19 X30.21 · HC-20 X10.9 · HC-21 X90.2 · HC-22 X20.1/X20.23 · HC-23 X20.3 · HC-24 X50.5
  - HC-25 X02.15 · HC-26 X70.1
- **docs-quality:**
  - DQ-01 X00.4 · DQ-02 X45.1 · DQ-03 X70.1 · DQ-04 X02.0 · DQ-05 X60.3 · DQ-06 X50.4
  - DQ-07 XRD.2 · DQ-08 X01.1 · DQ-09 X10.26 · DQ-10 X40.36 · DQ-11 XRD.6 · DQ-12 X20.22
  - DQ-13 X40.36 · DQ-14 XRD.5 · DQ-15 X10.25 · DQ-16 X01.1 · DQ-17 XRD.3 · DQ-18 X90.3
  - DQ-19 X40.12 · DQ-20 X90.1 · DQ-21 X10.26 · DQ-22 XRD.1 · DQ-23 XRD.6 · DQ-24 X01.4
  - DQ-25 X20.22 · DQ-26 X01.4 · DQ-27 XRD.5 · DQ-28 X70.2
- **empirical:**
  - EM-01 X30.1 · EM-02 X20.2 · EM-03 X10.1 · EM-04 X10.6 · EM-05 X20.4 · EM-06 X10.7
  - EM-07 X30.3 · EM-08 X30.18 · EM-09 X40.16 · EM-10 X02.5 · EM-11 X02.12 · EM-12 X20.9
  - EM-13 X40.24 · EM-14 X40.25 · EM-15 X40.21 · EM-16 X40.10 · EM-17 X30.4 · EM-18 §2 (#37–39)
  - EM-19 X02.11 · EM-20 X20.7 · EM-21 XRD.4 · EM-22 X40.6
