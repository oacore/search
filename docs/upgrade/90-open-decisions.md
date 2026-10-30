# Open decisions (OD-01..OD-49)

Purpose: every question that needs an owner answer, with options, the default the plan runs under, and what waits for a signature. Read it when a step or doc cites an OD, before a step whose "Needed by" is reached, and when the owner answers. Owns: OD-01..OD-49 (status, answer, options, basis). Binding text: [00](00-decisions.md) (owner edits only). Confirmation checklist: [STATUS](STATUS.md) §2.

Status lines: `OPEN (default: X)`: no owner answer, the plan runs under X. `DECIDED (YYYY-MM-DD): X`: the owner confirmed; binding policy is also added to 00 by the owner. On 2026-10-20 the owner confirmed the recommended defaults for owner questions OQ-1..OQ-18 (every OD whose Basis cites an OQ is `DECIDED (2026-10-20, owner confirmed the recommended defaults): X`) and later that day, in chat, set the track's scope (00 §6): OD-03, OD-24/OD-25, OD-36, OD-39, OD-41, OD-46, OD-47 re-decided (`owner in chat`), OD-29 WITHDRAWN. Only the owner signs; no item waits for anyone else. No OD is PROVISIONAL. `SUPERSEDED (by OD-nn)`, `WITHDRAWN (reason)`: the ID is kept.

**Amended by D18–D20 (owner, 2026-10-22; [00](00-decisions.md) §4b).** The status lines below keep their text; where an answer conflicts with these decisions, the decision wins: OD-01 (per-step deploy loop) → five local jumps and one deploy at the end (50 §4.0); OD-03 (B, the gateway rule CS-OPS-1) → D, the app-side `beforeFiles` rewrite CS-N12-9 in jump 2, re-checked by the jump-4 spike on 15.5 and 16, with CS-OPS-1 kept as an owner option at deploy time (20 §Deploy-time items); OD-32 (CS-OPS-6) → no Dependabot file, Dependabot PRs are not merged during the track; OD-35 (thresholds) → the lean criteria of 55 §0; OD-46 (one pinned Playwright image on a CI runner) → host Chromium and the B0-local host baselines; OD-47 (48 h prod watch per step, C6-CI pre-merge) → one 48 h watch after the final deploy, C6-CI WITHDRAWN.

1. **Execution proceeds under the default** of every OPEN OD and the answer of every DECIDED one. A step stops only if a needed OD has no default or a signature-required item is unsigned ([01](01-playbook.md) §8).
2. **Signature required** (waits for the owner's real signature): D1a fixes (OD-09, OD-40), the `kube/` PR CS-OPS-1 (OD-03), gate sign-off ([55](55-gates-and-confidence.md)). *Blocks* = the first PR, AD row or record that needs it; `record` = the signed record of the *Needed by* step (01 §7).
3. **At a gate**, every OD whose *Needed by* is at or before the gate's last step must be DECIDED (55 C8): change the status line to `DECIDED (date): X` and fill STATUS §2 "Confirmed".
4. **A changed answer** keeps the old text as `was:`; redo the 20 rows of steps that already ran under the old default.
5. Basis: `X…` = review:00 entry (`findings/review-2026-10-19/00-verified-findings.md`), `§2 #n` = its resolved-item row n, `OQ-n` = owner question n. OQ-18 (close stale PRs #389, #410) has no OD: STATUS §5.
6. **Thresholds** (55, OD-35, OD-47, OD-49) change only before their first measurement on a candidate (a step or gate result); a measurement-method change is a threshold change: allowed only before the first measurement of the current gate interval, with Owner `SIGNED:`, never after a failed measurement on a candidate. Pre-registered rules (55: the C6-prod calibration at 2.0–2.8, the C6-CI calibration at 2.8, the C1 sealed batch) are not changes. After it, only a numeric resource budget (size, RSS, CPU, first-load JS, latency) may be loosened, and only when a framework probe (42 §8) attributes the excess to a version bump, with Owner `SIGNED:`, re-measurement of every step since the previous gate and old and new values printed in the gate statement (55 §8). Never for C1, C1-Q, C2, C4, C5, C7, pixels, behaviour or status codes.

## 1. Index

|ID|Title|Status|Answer / default|Basis|Needed by|Blocks|
|---|---|---|---|---|---|---|
|OD-01|Per-step loop, phases 3/4|OPEN|A: bump, fix, prod per step|X90.1|W0|record|
|OD-02|Next vs Vite + react-router|OPEN|A: stay on Next|D11, X70.12|6.0|record|
|OD-03|`_next/data` prefix|DECIDED|B: in-repo gateway rule (CS-OPS-1)|X10.1, OQ-4|2.0|CS-OPS-1 PR; prod by 2.4|
|OD-04|React-17 peer cap|DECIDED|A: vendor before React 18|D4a, OQ-14|W0.5|W0.5 PR|
|OD-05|Node baseline|DECIDED|24 at W4e, 26 at 6.10|X02.4, OQ-6|W4e|record|
|OD-06|npm vs pnpm|OPEN|npm|R-022, D11|W5|record|
|OD-07|TypeScript path|DECIDED|6.0.3; tsc 7 alias at 6.1|X02.10, OQ-11|W1|record|
|OD-08|data-loader failures|OPEN|A: keep fail-fast|X10.20|W4a|AD rows|
|OD-09|ESCALATES approval|DECIDED|Q-050/051/052 + proven|OQ-8|W5.5|each CS-ESC PR|
|OD-10|webpack vs Turbopack|OPEN|`--webpack`|R-036|W7c|record|
|OD-11|CSS-module access|SUPERSEDED|by OD-33|X90.2|-|-|
|OD-12|Babel vs SWC|OPEN|Babel 7.29 to GATE-S; SWC 6.7|X02.9|W2e|record|
|OD-13|MobX endpoint|OPEN|6.16.1 + 4.1.1; out at 6.5|X02.8|W3|record|
|OD-14|Sentry target|DECIDED|7.120.4; nextjs 11 at 6.8|X02.7, OQ-7|W2a|record|
|OD-15|Lint policy|OPEN|parity; ESLint 10 at W1|X02.1|W1|record|
|OD-16|Browser support|DECIDED|keep list; floor via AD rows|X10.17, OQ-9|2.1|W4d AD rows|
|OD-17|bibtex-parse-js|DECIDED|vendor 0.0.24 verbatim|X02.13, OQ-13|W0|record|
|OD-18|Dead dependencies|OPEN|remove at W0|X20.21|W0|record|
|OD-19|Standalone output|OPEN|no; document env|R-082|2.1|record|
|OD-20|axios HTTP semantics|OPEN|keep today's (fetch adapter)|X70.4|6.3|record|
|OD-21|Design vendoring layout|DECIDED|C: tgz, dir copy, owned|X60.2, OQ-14|W0.5|W0.5 PR|
|OD-22|`reactStrictMode`|OPEN|off|§2 #31|W6a|record|
|OD-23|SEO fixes|OPEN|after GATE-F|Q-053|GATE-F|record|
|OD-24|Baseline storage|DECIDED|committed in the repo|X40.33, OQ-5|2.2|2.2 PR|
|OD-25|Fixture recording|DECIDED|once, scrubbed|X40.21, OQ-5|2.2|2.2 PR|
|OD-26|`future.webpack5` step|OPEN|yes (W4b)|X20.2|W4b|record|
|OD-27|Text/analytics libs|DECIDED|vendor i18n 6.8 data; ga4 W4c|X02.11-12, OQ-13|W0|record|
|OD-28|Parity contract, ledger|DECIDED|approve; (c) open|X90.2, OQ-9|2.1|2.8; (c) 7.0|
|OD-29|CI and deploy gating|WITHDRAWN|today's deploy process|X50.1, OQ-4|-|-|
|OD-30|Harness build|OPEN|separate build|X40.30|2.1|record|
|OD-31|Change control|DECIDED|B: re-baseline (D15)|X00.6, OQ-2|2.4|each AD row|
|OD-32|Dependabot|DECIDED|hold and fold|X50.9, OQ-17|2.0|CS-OPS-6 PR|
|OD-33|"Pure CSS" meaning|DECIDED|P1|X70.2, OQ-10|6.9|record|
|OD-34|core-ui in phase 7|DECIDED|no dependency|X60.10, OQ-15|7.0|record|
|OD-35|M7 thresholds|DECIDED|as in 55|X45.1, OQ-3|2.7|2.8|
|OD-36|S-4 fix outside D1|DECIDED|S-4 preserved, no fix|X30.1, OQ-1|-|-|
|OD-37|CSS minifier output|DECIDED|A: `cssnano-simple` 2.0.0 minimizer to 6.9 (2026-10-29; was B)|X10.5, OQ-9|W4c|02 §4 row; AD rows|
|OD-38|Next `_error` page|OPEN|vendor Next 10's|X20.13|W0b|record|
|OD-39|Framework-delta ledger|DECIDED|owner signs per step|X40.10, OQ-9|W2b|AD rows|
|OD-40|Hydration ESCALATES|DECIDED|prove first (W5.5)|X30.6, OQ-8|W5.5|each CS-ESC PR|
|OD-41|Block `_next/image`|DECIDED|no change: endpoint as today, no block|X10.9, OQ-16|W4c|record|
|OD-42|Public source maps|DECIDED|stay as today|X20.11, OQ-16|W4c|record|
|OD-43|Request counts, SWR|DECIDED|exact; SWR on log parity|X10.13, OQ-12|6.4|record|
|OD-44|Error-object handling|OPEN|adapter|X70.4|6.3|record|
|OD-45|E21/E22 credentials|OPEN|plain fetch|X70.4|6.3|record|
|OD-46|Infrastructure|DECIDED|none new; arm64|X90.3, OQ-4/5|2.4|2.4 record|
|OD-47|Soak and watch|DECIDED|48 h prod watch; no stage soak, no split|X40.17, OQ-4|W0|W0 record|
|OD-48|TS scope and layout|OPEN|ratchet; all files|X70.6, X70.12|6.1|record|
|OD-49|JS budget|OPEN|B0 +10% cumulative|X55.1|W4b|W4b record|

Phase 2: OD-24, OD-25 and OD-28 gate 2.1-2.2 (X90.1). OD-03 and OD-32 are needed at 2.0; CS-OPS-1 must be in prod before 2.4 (G, 42 §4). None waits for an answer, only for its signature.

## 2. Entries

### OD-01 Per-step loop for phases 3/4
**OPEN (default: A, per-step loop + GATE-S).** Phase order: "3 upgrade versions, 4 fix breakage". A: each step bumps, fixes, goes green, then prod alone (stage optional); GATE-S ends the track. B: literal, bump everything then fix: nothing deployable for weeks, no attribution or rollback. Runbook: 01 §4.

### OD-02 Next vs Vite + react-router
**OPEN (default: A, stay on the Next pages router; react-router and Vite are N/A per D11).** `/works/:id` and `/outputs/:id` carry `citation_*` and JSON-LD in the initial HTML and gSSP returns real 308/404 (R-005). B: Vite SPA + react-router (loses SEO and status codes unless SSR is re-added; a rewrite). C: hybrid per path prefix (two stacks).

### OD-03 `_next/data` prefix
**DECIDED (2026-10-20, owner in chat; same answer as OQ-4, owner-only): B, the gateway rule CS-OPS-1 (`PathPrefix /search/_next/data` → `ReplacePrefixMatch /_next/data`) in `kube/{prod,stage}/httproute.yaml`, app rewrite and client patch kept. It is not an external dependency: the file lives in this repo and the existing deploy workflow applies it (`aks_deploy.yml:88`), so it ships as a normal PR at 2.0, merged to `main` (= prod) before 2.4 (G, 42 §4) and so before W4d (OC-15).** Why it exists: prod clients fetch page data from `/search/_next/data/…` (`pages/_app.jsx:70-98`, `useInterceptNextDataHref`; the patch works on all 8 builds) and the app's own rewrite (`next.config.js:15-21`) maps it to `/_next/data/…`. From Next 12.2 that rewrite stops matching: a 404 on 12.2-12.3, so every client navigation silently becomes a full page reload, and HTML on 15/16, so the page goes blank (R-068). Real-gateway check: VF-01 (20 §2.0). App-only alternatives (no `kube/` change; owner decision only): D, a `beforeFiles` rewrite, works on 12.3; C, data under the `/static/search` namespace (client patch, `utils/helpers.js:4-25`). An app-only fix for 15/16 is unproven [VERIFY: a spike before W7a builds 15.5.28 without CS-OPS-1 and runs T-604/T-702 through the proxy; green = viable]; if the owner picks one, a docs PR adds its CS row (01 §9). A (client patch alone) is withdrawn; letters kept for citations.

### OD-04 React-17 peer cap
**DECIDED (2026-10-20, owner confirmed the recommended defaults): A, vendor the design (W0.5 tarball, W5 directory package) before React 18 (OQ-14).** `@oacore/design@5.0.74` peers `react ^17.0.1` and pulls react-slick (peer ≤17) (R-014). `--legacy-peer-deps` itself stays until 7.F for non-design peers (02 §1 rule 6); T-008 fails on any peer problem outside the 02 §4 allow-list. B: keep it with overrides or `--legacy-peer-deps` through 18/19 (masks every peer conflict; Q-051 unfixable without patch-package). C: patch-package the peer range (worst of both).

### OD-05 Node baseline
**DECIDED (2026-10-20, owner confirmed the recommended defaults): runtime Node 24 at W4e (`node:24-alpine` by digest, CS-N12-6), Node 26 at 6.10 (CS-NODE-6) if LTS for ≥1 month and green; tooling Node 24; no ICU exception (OQ-6).** Node 18/20 are EOL, 22 is maintenance only, 26 is LTS from 2026-10-28. Next 12.3.7-16.4.2 build and serve on 24; 12.3.7 fails on 26 (§2 #3). The golden image and baselines stay on today's Node 18 (42 §4). B: stop at 22 (maintenance only, another M1 exception). C: 26 at once (12.3.7 fails on it).

### OD-06 npm vs pnpm
**OPEN (default: npm for the whole track).** pnpm breaks the design postinstall that writes into `node_modules` and the absolute-path stylelint config (R-022); D11 does not adopt it. Revisit after GATE-F, own PR, with T-008 and T-901.

### OD-07 TypeScript path
**DECIDED (2026-10-20, owner confirmed the recommended defaults): TypeScript 6.0.3 exact from W1 (API for the typescript-eslint parser); CI `tsc` 7 via the alias `@typescript/native` = `npm:typescript@7.0.2` at step 6.1 (CS-TS-3); plain 7.x when typescript-eslint's peers allow it, checked at step 6.10 and the 7.F L2 sweep (02 §3.6); still blocked at 7.F → this OD becomes DECIDED with the blocker (OQ-11).** TS 7 is the native compiler with no `require('typescript')` API; typescript-eslint 8.72.0 peers TS `<6.1.0`, so a strict install with TS 7.0.2 fails ERESOLVE (§2 #16). B: stay on 6.0.3 with no committed step (violates M1). C: 7.0.2 plus `--legacy-peer-deps` (masks conflicts, R-014).

### OD-08 data-loader failures
**OPEN (default: A, preserve fail-fast; accept the build-log text and the undici 300 s timeout from CS-N12-1 as AD rows; no node-fetch pin).** `data/data-loader.js` exits 1 when the API is down (Q-026): no validation, no timeout; an outage blocks deploys (R-017). B: declare `node-fetch`, undeclared today and no longer hoisted by Next 12 (§2 #20). C: fall back to the committed cache (behaviour change; only after GATE-F).

### OD-09 ESCALATES approval rule
**DECIDED (2026-10-20, owner confirmed the recommended defaults): the approved ESCALATES list is Q-050, Q-051, Q-052 plus any hydration-structural quirk that a pre-fix test proves to crash or mismatch on React 18/19 (OD-40); works SSR-500 cases (Q-073, Q-001) and blank-page crashes (Q-074) stay PRESERVE; each fix is its own `escalates` PR needing the owner's signature (OQ-8).** Fixes CS-R18-2/3/4 in [20](20-change-sites.md); lifecycle [30](30-quirks-register.md) §1; procedure [50](50-roadmap.md) §4. B: approve every candidate unproven. C: approve none (React 18 re-renders the root on first-visit loads: Q-050, Q-051).

### OD-10 webpack vs Turbopack
**OPEN (default: `--webpack` through the track (CS-N16-2); revisit after 6.9 and 7.F).** Turbopack ignores `webpack()` and has no CSS-modules camelCase option; leaving webpack needs OD-33 P1 done and next-images gone (R-036, R-001).

### OD-11 CSS-module class access
**SUPERSEDED (by OD-33).** Its options (keep the patch, codemod 221 reads, rename 177 classes, defer) are covered by P1-P3.

### OD-12 Babel vs SWC
**OPEN (default: Babel 7.29.x exact through GATE-S (CS-BAB-9, W2e); SWC at 6.7 is mandatory for M1).** Babel 8 is unusable: `@babel/core` 8.0.7 is ESM-only (Node ^22.18 or ≥24.11); decorators 8 without `version` break MobX and `invalidatePreviousRequests` (X02.9). B: keep Babel 7 permanently (violates M1).

### OD-13 MobX endpoint
**OPEN (default: mobx 6.16.1 + mobx-react-lite 4.1.1 at W3, removed at 6.5; fallback CS-MOBX-3).** mobx 7 drops legacy decorators (26 in `store/filters.js`). Fallback if phase 6 slips: after W7, CS-BAB-1, then mobx 7 + mlr 5.

### OD-14 Sentry target
**DECIDED (2026-10-20, owner confirmed the recommended defaults): `@sentry/*` 7.120.4 exact at W2a (CS-SEN-1); end state `@sentry/nextjs` 11 at 6.8 (CS-SEN-2) keeping today's exit-on-uncaught behaviour (CS-SEN-2 options) (OQ-7).** 7.120.4 is the last 7.x and fixes GHSA-593m-55hh-j8gv. B: `@sentry/react` like the dashboard (client only, loses server errors). C: stay on 7.x (violates M1). R-055, R-076; T-608.

### OD-15 Lint policy
**OPEN (default: (1) gate on parity, not lint-zero: the 13 ESLint + 16 stylelint findings stay; (2) keep console statements (D1); (3) ESLint 10 at W1 on tooling Node 24; (4) `react-hooks/rules-of-hooks` only, via bulk suppressions at existing violations, `exhaustive-deps` off for the track and at most `warn` at 6.2; (5) keep Prettier and stylelint).** ESLint 9 is EOL (X02.1). No `--fix` in hooks during the track; Prettier `--write` only.

### OD-16 Browser support
**DECIDED (2026-10-20, owner confirmed the recommended defaults): keep `.browserslistrc` (`last 3 versions, not ie > 0, not op_mini > 0`) for CSS/Babel output; accept the JS floor that Next 12.3/15/16 and antd impose as AD rows after a GA browser-share check (VF-25); pin caniuse-lite and browserslist (CS-W0-10, 2.1), unpin at 6.10 (CS-W0-11) (OQ-9).** The Next runtime raises the floor whatever the list says (R-077). B: raise the list (changes CSS and JS output). C: refuse any floor change (blocks Next ≥12.3).

### OD-17 bibtex-parse-js
**DECIDED (2026-10-20, owner confirmed the recommended defaults): vendor the 11 KB `bibtexParse.js` 0.0.24 verbatim (CS-BIB-1, W0) with a Babel pass-through proof; the ORCID fork only after T-114 and the owner (OQ-13).** 0.0.24 is latest; removing the dependency drops 450 lock entries (1,760 → 1,310). `@orcid/bibtex-parse-js` 0.0.25 throws `TypeError` objects where 0.0.24 throws strings, and `templates/output/citation.jsx:67` has no try/catch. Licence: VF-19.

### OD-18 Dead dependencies
**OPEN (default: remove at W0 (CS-W0-2)).** `filesize`, `logrocket-react`, `throttle-debounce` (search's own entry) have 0 imports (`git grep`). Keep `cssnano` until W8.

### OD-19 Standalone output
**OPEN (default: no `output: 'standalone'`; document the runtime env contract).** It changes the CMD and file layout. `next start` re-reads `next.config.js`, so a missing `BUILD_TARGET` serves assets from unrouted `/_next/static` (R-082, CS-NODE-5). If changed: VF-21.

### OD-20 axios HTTP semantics
**OPEN (default: keep today's wire behaviour via the axios fetch adapter, each item pinned by T-122).** (1) Host to the in-cluster API: native fetch drops it (Q-022, §2 #1) and so does the adapter; the Host the API expects is VF-02. (2) `Authorization` and credentials to every host (S-2): keep. (3) Claim POST `text/plain;charset=UTF-8` (Q-019): keep. (4) `?t=undefined` (Q-016): keep. (5) String bodies: axios would default to `application/x-www-form-urlencoded`, a third candidate; keep today's `text/plain`. (6) UA `node`, `accept-encoding: gzip, deflate`: same as today. (7) Keep-alive: moot with the fetch adapter. Changes: post-GATE-F. Spec: [70](70-phase6.md).

### OD-21 Design vendoring layout
**DECIDED (2026-10-20, owner confirmed the recommended defaults): C, tarball `vendor/oacore-design-5.0.74.tgz` at W0.5 (CS-DSN-1), directory copy installed as a copy at W5 (CS-DSN-2), readable search-owned source at 7.1; licence MIT (the design `LICENSE`), though its `package.json` says UNLICENSED; end state 14 units owned, 8 antd, 2 composite (60 §3), confirmed although M6 says "rewrite all UI on antd"; a unit the owner later moves to antd becomes its own 7.2 step under rule 4 (OQ-14).** A: compiled `lib/` in the app tree (Babel re-transpiles it and drops exports: CS-BAB-8, R-075). B: copy `src/` (does not reproduce the compiled output). Detail: [60](60-design-ownership.md).

### OD-22 `reactStrictMode`
**OPEN (default: off).** `next.config.js` does not set it; null means false in the pages router (§2 #31). Turning it on doubles dev effects (Q-058). Gating tests do not wrap in `<StrictMode>` (40 §7).

### OD-23 SEO fixes
**OPEN (default: after GATE-F, separate track, each baseline change approved here).** Q-053 (meta reads the wrong fields), Q-001 (works 410 returns HTTP 500), Q-054 (`lang`).

### OD-24 / OD-25 Baseline storage; fixture recording
**DECIDED (2026-10-20, owner in chat; was: private GHCR OCI artefacts via ORAS or e2e-only LFS, OQ-5): OD-24 Playwright baseline screenshots, build-derived baselines, recorded API fixtures and the C4 corpus are committed in this repo next to the tests (Playwright's default `<spec>-snapshots/` folders; pages and fixtures are public CORE data, scrubbed first; corpus URLs come from user traffic, so only their sanitised form, 42 §7); no registry artefacts, no ORAS; Git LFS only past the 42 §7 size threshold; OD-25 fixtures recorded once, manually, with a read-only API key, PII scrubbed and licence checked, never mutating POSTs (OQ-5).** The repo is public, so nothing unscrubbed goes in (40 §6). OD-25 alternative: synthetic fixtures only (weaker C1/C4, RG-1). Detail 42 §7, 40 §6.

### OD-26 `future.webpack5` step
**OPEN (default: yes, as W4b).** It isolates webpack 4 → 5 (R-001, R-006, R-035) from the Next 12 changes at the cost of one more deploy; the OpenSSL flag stays until 12.1.6.

### OD-27 Text and analytics libraries
**DECIDED (2026-10-20, owner confirmed the recommended defaults): vendor the 250-name `en` map of `i18n-iso-countries` 6.8.0 as owned data and drop the dependency (CS-I18N-1, W0): no text change; `react-ga4` → 3.0.1 at W4c (CS-GA-1) (OQ-13).** 7.14.0 changes 9 names (R-031). `react-ga4` 3 is ESM-only (builds from Next 11.1.4). i18n options: B 7.14.0 plus an override map; C accept the 9 changes (D1 waiver).

### OD-28 Parity contract and ledger
**DECIDED (2026-10-20, owner confirmed the recommended defaults): approve (a) the parity contract (40 §1, console output is behaviour) and (b) the accepted-diff ledger (42 §8); (c) phase-7 amendments stay OPEN (default: approve; needed by 7.0): T-602 and T-729 ignore antd `<style>` elements; inside replaced units (root plus portals) wrappers, nesting, class tokens, `style` and unread `data-*` may change; behavioural attributes (40 §1), roles, names, focus order and keyboard may not (80 §0) (OQ-9).**

### OD-29 CI and deploy gating
**WITHDRAWN (2026-10-20, owner in chat: not related to the upgrade).** The plan uses today's deploy process unchanged: a merge to `main` deploys prod (`aks_deploy.yml`), stage works as today, the nightly stays as it is. Rollback = revert the merge and let the existing workflow redeploy, or re-run the deploy workflow on the previous commit (01 §5). R-088 stays documented, mitigated by the merge rule: a step PR merges only after the full pre-merge suite is green, in working hours, and prod is watched 48 h with the existing monitoring (01 §4). No gate depends on a stage soak or on deploy by digest. Was: DECIDED (OQ-4): stage cron on `stage` (CS-OPS-2), prod only from `main` with `paths-ignore` and concurrency (CS-OPS-3), deploy by digest (CS-OPS-4), nightly build-only, deploy workflows calling `ci` (CI-6); all WITHDRAWN.

### OD-30 Harness build
**OPEN (default: a separate harness build, `build:harness` copying the page into `pages/` for that build only, or an `e2e/harness/` app).** Next 10 sets `commons minChunks = totalPages`, so an extra page changes chunking; T-004 asserts the page is absent from the prod `pages-manifest`.

### OD-31 Change control
**DECIDED (2026-10-20, owner confirmed the recommended defaults): B, the re-baseline protocol (D15), not a freeze; data refreshes (only `data/.formap.json`, `.members.json`, `.statistics.json`) are logged, not re-baselined, because parity images use the frozen snapshot (01 §2) (OQ-2).** A: freeze `main` for product changes until GATE-S. B: a product PR lands alone, before/after captures on the current stack, diff limited to declared regions, AD row, owner signs (42 §9). `main` took 32 commits after 2026-07-01 (R-089).

### OD-32 Dependabot
**DECIDED (2026-10-20, owner confirmed the recommended defaults): hold and fold; `.github/dependabot.yml` with github-actions weekly and npm `open-pull-requests-limit: 0` (CS-OPS-6); PRs labelled `upgrade-hold` are folded into the next step, never merged alone (OQ-17).** 18 Dependabot branches exist and `main` has no config; whether security updates are on is VF-16. B: merge between steps (unplanned product changes).

### OD-33 Meaning of "pure CSS"
**DECIDED (2026-10-20, owner confirmed the recommended defaults): P1, standard CSS syntax only (no preprocessor syntax, no PostCSS plugins), CSS Modules kept; plugins removed at 6.9 after the DV7 design-CSS freeze (OQ-10).** Next forbids component-level global CSS and ~30 local class names repeat across the 26 module files (R-086). P2: global CSS at the end of phase 7 (+8-12 pd). P3: keep as is (accepted deviation from M6).

### OD-34 core-ui in phase 7
**DECIDED (2026-10-20, owner confirmed the recommended defaults): no dependency on `@oacore/core-ui`; reference only (OQ-15).** It runs in the dashboard only because pnpm tolerates unmet peers; under npm it fails ERESOLVE, and its visual correctness is VF-12 (§2 #66). B: depend on it. C: copy components.

### OD-35 M7 thresholds
**DECIDED (2026-10-20, owner confirmed the recommended defaults): the thresholds in [55](55-gates-and-confidence.md): C1 fault catalogue 100% killed, and per gate a sealed batch of ≥59 new faults with recall lower bound ≥0.95; C2 mutation ≥80% (≥90% on core files); C3 coverage ≥90%; C4 corpus N ≥2,000 at GATE-S and ≥1,000 at GATE-A and GATE-F, 0 unexplained diffs; C6 48 h prod watch per step and 14-day non-inferiority at ×1.05, printed only since OD-47 withdrew the split (was: gating in split mode) (OQ-3).** The plan adds, under the same default: C1 fault validity and C1-Q quirk-clause faults (validity, freshness, exempt list signed at 2.8), C4 positive controls, the GATE-x.6 looks (≤2 per gate), the C6-prod calibration (2.0–2.8), the C6-CI rows and calibration (2.8), C1-Q `none` marks, C1 build faults, the C4 positive-control list, the C6-NI day-level bootstrap, power, size check and comparators (printed), the C6-prod breach tests with stated H0, cumulative caps (55); the docs PR merge approves these values, after which rule 6 applies. Each statistic is one-sided 95%, jointly ≥85%; B (stricter, joint 95%): α = 0.05/3 each, i.e. C1 N_f ≥80, C4 bound ≈4.1/N, C6-NI α 0.0167.

### OD-36 S-4 fix outside D1
**DECIDED (2026-10-20, owner in chat): S-4 is preserved like any quirk and stays pinned by T-602 (fixture 1004, sandboxed browser) and T-113; no fix in this track; D16 and CS-SEC-1 WITHDRAWN.** Existing production defects are not this track's concern unless they directly affect the plan (00 §6). Was: DECIDED (OQ-1): a `security` PR, CS-SEC-1, escaping `<` in JSON-LD before the 2.5 baselines (D16); now option B. A fix belongs to a later, separate track (like OD-23).

### OD-37 CSS minifier output
**DECIDED (2026-10-29, owner in the live work session, after the W4c stop: "I accept option (a) for all five W4c decisions: (1) OD-37 A, cssnano-simple 2.0.0 as the CSS minimizer, closed at 6.9; …"): A, restore the 10.2.3 output with a custom minimizer on `cssnano-simple` 2.0.0, an M1 exception (02 §3.3, §4) closed at step 6.9 (70 §3.8); CS-N12-10. Was (2026-10-20, owner confirmed the recommended defaults): B, accept the Next ≥11 minifier output only if T-801 is 0 px on all three engines (41 §2.5), diff categories logged as AD rows; A the fallback (OQ-9).** 13 rules differ from 10.2.3 (R-043); pixel effect VF-06: on 12.1.6 T-801 was not 0 px (the `h2`/`h4` line-heights, W4c 2026-10-29), so B did not hold; a probe showed A feasible. Under A a byte-level T-003 difference the A build still shows is proposed as an AD row as usual.

### OD-38 Next `_error` page
**OPEN (default: A, vendor Next 10's `_error` as `pages/_error.jsx` (CS-N11-9); ledger rows only for deltas code cannot preserve).** No `pages/_error` exists, so any uncaught SSR exception shows Next's built-in page, whose text and style change from Next 11 and again at 16 (Q-098, R-085). B: accept the change per Next version as AD rows (OD-39).

### OD-39 Framework-delta ledger
**DECIDED (2026-10-20, owner confirmed the recommended defaults; the owner alone signs, owner in chat 2026-10-20): sign the framework-delta ledger per step; each delta is reviewed and pinned as an AD row with `ref: OD-39`: Cache-Control on 404/500/308, ETag/Content-Length, CSP on 308, `Refresh`, `_next/data` charset, head manager at 15 (OQ-9).** Ledger: `test/baseline/ACCEPTED-DIFFS.yml` (42 §8); R-071, R-083. Edge-visible rows (T-904) are owner-signed like the rest.

### OD-40 Hydration-structural ESCALATES
**DECIDED (2026-10-20, owner confirmed the recommended defaults): candidates Q-072, Q-075, Q-093 (with approved Q-050, Q-051) become fixes only after a pre-fix test proves a crash or mismatch on React 18/19 on the W5.5 spike branch; then the owner signs the fix PR (CS-ESC-1..3); unproven ones return to PRESERVE (OQ-8).** VF-23 settles Q-072 on the real app. Proven fixes land on React 17 (OC-19). B: fix all three unproven. C: none.

### OD-41 Block `_next/image`
**DECIDED (2026-10-20, owner in chat: keep this part the old way, stability first; was: block `/static/search/_next/image` at the gateway, CS-OPS-5, OQ-16): no change. No gateway block (CS-OPS-5 WITHDRAWN) and no off-switch (CS-IMG-1 WITHDRAWN): images and the optimizer endpoint stay exactly as today on every version (next-images and static files, CS-N11-3); interim prod stops stay short.** The app does not use `next/image` (no `next/image` import in `pages`, `modules`, `templates`, `main`, `utils`, `lib`, `hooks`, `store`, `api`), so the built-in optimizer serves no page. GHSA-2xp9-vwfh-vxw4 (critical image-optimizer RCE) affects Next ≥10.0.0 <15.5.24 and 16.0.0 to <16.3.3: 10.2.3 has it today, so the interim stops up to W7a keep today's exposure, not more (R-072, S-5, S-10). T-612 keeps the path routed to the app; a status change that a Next bump alone causes (framework probe, 42 §8) is recorded by an owner-signed `delta` AD row, never restored or blocked by app code. B: switch the endpoint off in `next.config.js` from W4c (`loader: 'custom'` on 12.1.6, `unoptimized: true` from 12.3.7; per version the path answers 4xx and T-801 is 0 px): a behaviour change, own owner-signed PR under a new CS ID.

### OD-42 Public source maps
**DECIDED (2026-10-20, owner confirmed the recommended defaults): public source maps stay as today: `productionBrowserSourceMaps: true` (CS-N11-4) (OQ-16).** `/static/search/_next/static/**` serves 27 JS + 8 CSS client maps with `sourcesContent` (S-9); dropping the `@zeit/next-source-maps` wrapper without the flag would turn those 200s into 404s. B: disable maps (behaviour change; owner decides after GATE-F). CSS maps under the flag: VF-24.

### OD-43 Request counts and SWR
**DECIDED (2026-10-20, owner confirmed the recommended defaults): phase-6 request counts stay exactly as today (clear-all double POST Q-092, E18 per render, E22 per card, E8 on every mount); SWR only where T-702/T-712 request-log parity is proven, today SimilarWorks only (CS-SWR-2); if Q-055 mount-only parity fails, zero SWR flows and the owner decides how to read M6 (OQ-12).** SWR changes request counts by default (R-029).

### OD-44 Error-object handling
**OPEN (default: an error adapter; callers unchanged).** Under axios, `error.data` is gone, `error.message` lacks the URL, and a serialised `AxiosError` leaks `Authorization` into `__NEXT_DATA__` (R-028). The adapter maps to today's `api/errors.js` shape and message `Request for <url> failed on <s>`. B: change the callers (a code change; D1).

### OD-45 E21/E22 credentials
**OPEN (default: E21/E22 stay a plain no-credentials `fetch`; CORS check VF-13).** Dashboard defaults (`withCredentials: true`, extra headers) would force preflights, and a CORS rejection is swallowed by the logo `catch`, so logos would vanish silently. B: axios with `withCredentials: false`, proven equal by T-122.

### OD-46 Infrastructure
**DECIDED (2026-10-20, owner in chat; was: golden image and baseline artefacts in private GHCR, OQ-4, OQ-5): no new infrastructure. Baselines and fixtures are committed (OD-24, 42 §7); the golden image is rebuilt from G when needed, or pushed to the registry the existing deploy already uses (ACR `corecontainers`) if rebuilds are not reproducible (42 §4, VF-09); pixel baselines are captured and compared inside one pinned Playwright Docker image on the CI runner `ubuntu-24.04-arm` (linux/arm64, the deploy runner's and AKS's architecture; 42 §3); one integration branch per step (`upgrade/<step>-<slug>`, 01 §2).** C: also amd64 baselines (cross-arch pixels, VF-10).

### OD-47 Soak and watch
**DECIDED (2026-10-20, owner in chat; was: a 24 h stage soak against a stub plus low-rate prod reads and a split amendment OPEN, OQ-4): a 48 h prod watch after each prod step with the team's existing monitoring (Sentry, LogRocket, GA4, gateway and Cloudflare logs, existing dashboards; 55 C6-prod); no stage soak in any gate: its runtime checks run pre-merge on the CI runner (C6-CI, 55); a stage deploy is optional best effort; traffic split and weighted canary WITHDRAWN, so C6-NI is printed only (55 C6-NI).** Stage never exercises the in-cluster API path (RG-6) and is not prod-equivalent (RG-8); C6-CI runs at prod limits, and the prod-only paths are covered by C6-prod and the W4e/6.3 log check (01 §4 step 8). Thresholds: 55 C6.

### OD-48 TypeScript scope and layout
**OPEN (default: (a) strict ratchet folder by folder: `tsconfig.strict.json` `include` never shrinks (T-017); (b) convert every app file in 6.6, `any` allowed; (c) no folder moves (D1); the org guide's layout is not adopted).** Next 17 tracking is VF-15.

### OD-49 JS performance budget
**OPEN (default: per-route first-load JS gzip ≤ B0 +10%, cumulative, at every step and gate from W4b (T-007), plus the T-611 size and RSS budgets).** Measured from B0 so per-step tolerances cannot add up; a step over the cap stops before merge (01 §8); the cap moves only under rule 6, recorded as `was:`. T-611 peak RSS B0: 785 MiB (`was: 650`; AD-151, owner `SIGNED:` 2026-10-31, jump 2 batch round 3; the limit B0 + 10 % moves from 715 to 863.5 MiB, because the runtime bump to Node 24.18.1 causes the excess; T-611's two heap budgets and its method stay; the old and new values go in the GATE-S statement, [records/jump-2.md](records/jump-2.md) section 14). GATE-A confirms it (55).

## 3. Answered by evidence

Defaults resting on `review:00 §2` rows: OD-02 #64-65; OD-03 #27; OD-05 #3, #4, #61, #63; OD-07 #16; OD-08 #20, #45; OD-10 #26; OD-17/OD-27 #7, #8; OD-20 #1, #2; OD-21 #40, #41; OD-22 #31; OD-34 #66; OD-42 #19. If a row is disproved, reopen the OD (rule 4).
