# STATUS - mutable ledger

**Purpose.** With README §Status, the only file edited during execution (D13): baselines, digests, owner confirmations, VF register, statuses, branches/PRs, log.
**Read** after README at work-session start; **update** at work-session end ([01](01-playbook.md) §4 step 11 and 01 §9).

## 1. Baseline and artefacts

|Item|Value|
|---|---|
|People|Owner: _; Reviewer (second engineer): _ (name and GitHub login each, used by the 42 §8 signature check); channel: _ (owner fills before 2.0)|
|Baseline|`<base>` = `origin/main@cc0e228`, tree `a825839` (moves only per 01 §2 before B0); `<base'>` (42 §5) = `09eb636` (2.1, the merge of CS-W0-9; local); work-session start check: 01 §2. `f5cfc20`: same tree, on no remote (review:00 XRD.2)|
|Branches|default `main`, also `stage`; legacy `master`, `main.old`; local `origin/HEAD` stale (fix: 01 §2). Phase 2 (local only, never pushed): `upgrade/p2-21-harness` … `upgrade/p2-27-p1-faults`, exit branch `upgrade/p2-28-exit` (§5)|
|Stage|`origin/stage` = `6e0a370`, tree = `9b26dc9`'s, 2 commits behind `main` (#454, #455), 10 stage-only commits with a net-zero tree (checked 2026-10-20); stage is optional (01 §4 step 5): a step merged into it pulls in #454/#455|
|Base images|deploy-time items (D19, 2026-10-22; 20 §Deploy-time items), not recorded in the track. `node:18-alpine` index digest: not set (2.1); `node:24-alpine` (W4e), `node:26-alpine` (6.10): not set (command 42 §2)|
|Activity|32 commits on `origin/main` after 2026-07-01, 6 authors (R-089)|
|Docs branch|`docs/upgrade-plan`, local only. Landing 1(a)–(e) done 2026-10-20 (README §8 action 1): doc set placed in `docs/upgrade/`, `60-design-copy-plan.md` removed, `tools/check-docs.mjs` added, `findings/` scrubbed, `findings/review-2026-10-19/parts/` deleted, checker ERROR 0, and the plan committed on the branch as one commit replacing the two draft commits. Next: 1(f), by the owner (rebase onto `origin/main`, push, open the PR). Tag `upgrade-baseline`: not created; set on origin at `cc0e228` after the docs PR (01 §2)|
|Golden|G = `689fec9` (2.4, local tag `p2-local/golden`; the tag `upgrade-golden` on origin: DEFERRED, owner); first golden build = host parity build `1fb7e5b548c5ae8c` of G (Node 18.20.8, 2026-10-21; the image digest is WITHDRAWN with Docker, D19); baseline, fixture and corpus SHA-256 sets committed in `test/baseline/manifest.json`, `test/baseline/SHA256SUMS`, `test/fixtures/SHA256SUMS` (42 §7); C4 draw seeds: not set (the real corpus is DEFERRED, VF-26); the `t805-exclusions.json` sha256 (40 §1): ab40bbc6b81165505f904b8aec2870885cef3ea33d6584f1e0f819a782a224a9 (2.7, captured on the host baseline, macOS arm64); approved baseline chain B0..Bn: B0-local (2.5, provisional host baseline, macOS arm64; owner signature pending); formats [42](42-baselines-and-ci.md) §4, §7, §9|
|Signals|WITHDRAWN in the lean track (2026-10-22, D18; 55 §0). Was: signals exports `test/signals/<tag>.json` and their SHA-256 (55 C6-NI, 42 §7): `2.0`, `W0`, `S`, `A`, `F`: not set (2.0 exit, W0 merge, end of each gate window)|

## 2. Owner confirmations

OQ-1..OQ-18 are DECIDED (2026-10-20, owner confirmed the recommended defaults), and the owner's scope decisions of the same day are applied (00 §6): rows with a *Confirmed* date are DECIDED; no item waits for anyone but the owner; rows without one (D17, OPEN ODs, Phase 1b approval) run under their default until confirmed. Texts: [90](90-open-decisions.md), [00](00-decisions.md) (90 "needed by" wins); OQ texts: `findings/review-2026-10-19/00-verified-findings.md` (owner-question table). *From* = first step needing the default. *Sign* = where the real signature is required: `=` (the *From* step) or a step ID = owner signs that step's record (01 §7), PR = the PR, GATE-x = 55 record. *Confirmed*: `YYYY-MM-DD name`.

|Item|Default|From|Sign|Confirmed|
|---|---|---|---|---|
|Phase 1b approval|pending|docs PR|PR merge||
|D18, D19, D20|lean target, scope rule, no CI (00 §4b)|2.8|=|2026-10-22 owner (in chat)|
|AD-001..AD-009 (`test/baseline/ACCEPTED-DIFFS.yml`)|the rows as proposed in the jump 1 steps W0, W0b, W0.5; AD-007, AD-008 withdrawn, superseded by the T-610 frame normaliser; AD-001, AD-002 withdrawn 2026-10-28, superseded by the frozen W1 T-001 baseline (`test/baseline/t001-lint-w1.json`)|W0|`signedOffBy` `SIGNED: owner, 2026-10-27 (approved in the work session)`|2026-10-27 owner (in chat)|
|T-610 c3 frame normaliser (40 §1, §8 rule 8)|line:column numbers of stack frames in the stdout/stderr census masked on both sides; function and file names compared|W0|`SIGNED:` in 40 §1|2026-10-27 owner (in chat)|
|OQ-18|owner closes #389, #410 (§5)|-|owner|2026-10-20 owner (OQ-18); closing pending|
|D15 / OD-31|re-baseline protocol, no freeze; data refreshes logged only (01 §2)|2.4|each AD row|2026-10-20 owner (OQ-2)|
|D16 / OD-36|D16 WITHDRAWN; S-4 preserved, pinned by T-602 and T-113; no fix in this track|-|-|2026-10-20 owner (in chat)|
|D17|design frozen at 5.0.74 from 2.1|2.1|=||
|OD-03|B: in-repo gateway rule CS-OPS-1 (normal PR, existing deploy applies it); app-only alternatives C, D (owner)|2.0|PR, prod before 2.4|2026-10-20 owner (OQ-4; in chat)|
|OD-04 + OD-21|vendor design: tgz W0.5, directory W5; licence MIT assumed; end state 14 owned, 8 antd, 2 composite (60 §3); `--legacy-peer-deps` to 7.F (02 §1 rule 6)|W0.5|PR|2026-10-20 owner (OQ-14)|
|OD-05|runtime Node 24 at W4e, 26 at 6.10|W4e|=|2026-10-20 owner (OQ-6)|
|OD-07|TS 6.0.3 from W1; tsc 7 via alias at 6.1|W1|=|2026-10-20 owner (OQ-11)|
|OD-48|strict ratchet, every file, `any` allowed|6.1|=||
|OD-09 + OD-40|ESCALATES: Q-050/051/052 + proven quirks only|W5.5|PR per fix|2026-10-20 owner (OQ-8)|
|OD-14|Sentry 7.120.4 W2a, `@sentry/nextjs` 11 at 6.8; exit-on-uncaught kept|W2a|=|2026-10-20 owner (OQ-7)|
|OD-16|keep `.browserslistrc`; JS floor via ledger (VF-25)|2.1|W4d|2026-10-20 owner (OQ-9)|
|OD-17 + OD-27|vendor bibtex-parse-js 0.0.24, i18n-iso-countries 6.8.0 `en`; react-ga4 3.0.1 at W4c|W0|=|2026-10-20 owner (OQ-13)|
|OD-24 + OD-25|baselines, fixtures, corpus committed next to the tests; PII scrubbed, corpus queries sanitised (42 §7); LFS only past 42 §7 size|2.2|PR|2026-10-20 owner (OQ-5; in chat)|
|OD-28|approve parity contract + AD ledger; (c) phase-7 items|2.1|2.8; (c) 7.0|2026-10-20 owner (OQ-9); (c) open|
|OD-29|WITHDRAWN: today's deploy process unchanged; rollback by revert or re-run (01 §5)|-|-|2026-10-20 owner (in chat)|
|OD-32|CS-OPS-6: Dependabot hold-and-fold, npm limit 0|2.0|PR|2026-10-20 owner (OQ-17)|
|OD-33|P1: standard CSS, Modules kept|6.9|=|2026-10-20 owner (OQ-10)|
|OD-34|no `@oacore/core-ui` dependency|7.0|=|2026-10-20 owner (OQ-15)|
|OD-35|M7 thresholds as in 55 (each statistic 95%, jointly ≥85%; B: α/3 each; C6-NI printed only); 2.8: C1-Q exempt list and `none` marks, C6-prod and C6-CI calibration re-sets|2.7|2.8|2026-10-20 owner (OQ-3)|
|OD-37|B: minifier output accepted only at 0 px|W4c|AD rows|2026-10-20 owner (OQ-9)|
|OD-39|owner signs the framework-delta ledger per step|W2b|AD rows|2026-10-20 owner (OQ-9; in chat)|
|OD-41|no change: optimizer endpoint as today; no gateway block, no off-switch (CS-OPS-5, CS-IMG-1 WITHDRAWN)|W4c|=|2026-10-20 owner (OQ-16; in chat)|
|OD-42|public source maps stay|W4c|=|2026-10-20 owner (OQ-16)|
|OD-43|request counts exact; SWR only with log parity|6.4|=|2026-10-20 owner (OQ-12)|
|OD-46|no new infrastructure: golden rebuilt from G (or ACR), one pinned Playwright image on `ubuntu-24.04-arm`|2.4|=|2026-10-20 owner (OQ-4, OQ-5; in chat)|
|OD-47|48 h prod watch with existing monitoring; C6-CI pre-merge; no stage soak; split WITHDRAWN|W0|=|2026-10-20 owner (OQ-4; in chat)|
|OD-01 + OD-18|A: per-step loop + GATE-S; remove dead deps|W0|=||
|OD-02|A: stay on Next|6.0|=||
|OD-06|npm|W5|=||
|OD-08|fail-fast kept, log text as AD row|W4a|AD rows||
|OD-10|`--webpack`|W7c|=||
|OD-12|Babel 7.29.x; SWC at 6.7|W2e|=||
|OD-13|mobx 6.16.1 at W3; removal 6.5|W3|=||
|OD-15|ESLint 10 at W1; parity gate|W1|=||
|OD-19 + OD-30|no standalone output; separate harness build|2.1|=||
|OD-20 + OD-44 + OD-45|axios: today's semantics, error-object adapter; E21/E22 plain fetch|6.3|=||
|OD-22|StrictMode off|W6a|=||
|OD-23|SEO fixes after GATE-F|GATE-F|=||
|OD-26|`future.webpack5` step|W4b|=||
|OD-38|vendor Next 10 `_error`|W0b|=||
|OD-49|JS budget B0 +10% cumulative|W4b|=||

## 3. VF register

Settles it: `owner:` = the owner (or whoever the owner names), else the implementer. Closing: §4 row `VF-## | CLOSED | date | answer (evidence)`; unlisted = OPEN.

|ID|Open item|Settles it|Needed by|
|---|---|---|---|
|VF-01|Real gateway applies longest-prefix + `ReplacePrefixMatch` on `/search/_next/data` (CS-OPS-1)|(1) existing rewrite evidence and the route status where existing read access shows it, at 2.0; (2) the W4d prod `_next/data` probe right after rollout (20 §2.0)|2.0, W4d|
|VF-02|Host the in-cluster API expects (OD-20)|owner: API log, or prod-only check at first W4e/6.3 rollout|W4e|
|VF-03|Live API: 410 body; `publishedDate` format; prevalence of empty date/numeric year, `doi:null` (one live ID for C6-prod row 8), missing location; `links.display` uses `/display/`? Q-053 meta keys|the 2.2 sample with an API key, re-settled on the C4 corpus responses at 2.5 (format counts over ≥2,000 works and outputs)|2.2, 2.5|
|VF-04|Read access to the Sentry and LogRocket projects; prod `SENTRY_DSN` set? host? prod CSP outcome for browser events; C6-prod row 7 N, M|owner: access; secret check + browser on prod|2.0 (read access), 2.5 (DSN, CSP, N, M)|
|VF-05|linux/arm64-musl `npm ci`; alpine ICU; Next 12.3-16 on alpine arm64; 12.1.6 lockfile patcher|T-901 in Docker on arm64|2.1, W4c|
|VF-06|T-801 pixel effect of the minifier change; feasibility of OD-37 A|W4c run|W4c|
|VF-07|msw 2.15.0 in Jest on Node 18 (2.11.2 disputed); msw 3 under Jest 30 on Node 24|10-minute lab|2.1, 6.0|
|VF-08|Stryker 10 with legacy decorators / Babel 7|2.1 spike|2.7 (settled at 2.7: staging copy without `babel.config.js`, parser plugins `decorators-legacy`, `jsx`, `exportDefaultFrom`; 02 §3.5)|
|VF-09|Next build reproducibility (two identical builds)|T-014|2.1|
|VF-10|Cross-arch/host pixel determinism; fonts in the Playwright image|stability proof (2.5)|2.5|
|VF-11|Local `next dev`/`build` on Node 24 with Next 10 (OpenSSL flag)|one local run|2.1|
|VF-12|`@ant-design/cssinjs` cssVar useId key SSR vs client; core-ui visual correctness|7.0 spike|7.0|
|VF-13|CORS on credentialed E21/E22; GA4 enhanced-measurement history page views|owner: API CORS config; GA property settings|6.3, 2.3|
|VF-14|Prod probe path: outside requests to `core.ac.uk` get a Cloudflare challenge (403, `cf-mitigated: challenge`, 2026-10-20), so probes need access the team already has (an allow-listed IP, read-only cluster access) or a real browser (01 §4 step 8); edge additions/caching; who serves robots/sitemap/favicons|owner: which existing access; edge checklist (T-904)|2.0 (probe path), W4d (edge)|
|VF-15|Next 17 keeps webpack?|release notes|6.10|
|VF-16|Dependabot security updates? `NPM_TOKEN` scope (repo vs `azure` env)? which existing monitoring gives restarts, RSS, CPU and HPA replicas (55 C6-prod; a missing source is recorded `unavailable` and substituted per 55 GATE-x.6); read access to gateway/Cloudflare logs, the Sentry project, the GA4 property, the LogRocket project and Search Console (55 C6, GATE-x.6)|owner: repo/org settings, existing accounts|2.0|
|VF-17|Effort multipliers phases 2/6/7|calibration spikes (2.1, 6.0, 7.0)|each phase start|
|VF-18|Prod traffic volume (sessions, page views) for C6 statistics; GA4 export for the C6-NI pre-window|owner: GA data|2.0|
|VF-19|bibtex-parse-js licence|read the package licence|W0|
|VF-20|css-loader `~` imports on Next 14-16|W6d, W7a-c builds|W6d|
|VF-21|Standalone HOSTNAME; SIGTERM per Next major|owner: only if OD-19 changes; T-903 rollout|W6c|
|VF-22|Keyboard behaviour on disabled filters at runtime|Playwright on baseline|2.3|
|VF-23|Nested anchors cause a React 18 hydration error on the real app|W5.5 spike branch (T-701/T-728 on React 18)|W5.5|
|VF-24|CSS source maps under `productionBrowserSourceMaps`|W4c build|W4c|
|VF-25|GA browser-version share at/below the Next 12.3 / 15 / 16 floors|owner: GA data|W4d|
|VF-26|30 days of gateway or Cloudflare access logs for the C4 corpus and the C6 baselines (5xx, requests); an API key whose quota covers the corpus recording (55 C4) and the GATE-x.6 live A/B (≥8,000 requests plus re-requests), stored as an Actions secret|owner|2.0|
|VF-27|KaTeX font licence notices|`node_modules/katex/LICENSE` + font files|W5|

## 4. Status ledger

Non-default statuses only; unlisted: risk OPEN, quirk UNPINNED (30 §E rows: CANDIDATE), test TODO, CS TODO, step NOT STARTED, VF OPEN. Update rows in place, never delete. C1 seeded faults (55): `R-### | FAULT-VERIFIED | date | test/faults/R-###*.patch`.

|ID|Status|Date|Evidence|
|---|---|---|---|
|Phase 1|DONE|2026-10-19|`findings/01-08`|
|Phase 1b review|DONE; approval pending|2026-10-19|`findings/review-2026-10-19/`|
|Plan rewrite|DONE|2026-10-20|`docs/upgrade/`|
|Landing 1(a)–(e)|DONE (1(f), the push and the PR, is the owner's next action)|2026-10-20|doc set in `docs/upgrade/`, `60-design-copy-plan.md` removed, `tools/check-docs.mjs` added, `findings/` scrubbed, `parts/` deleted, checker ERROR 0, commit on `docs/upgrade-plan`|
|D16, OD-29, CS-SEC-1, CS-OPS-2..5, CS-IMG-1, CI-6, steps 2.0a/2.0b|WITHDRAWN|2026-10-20|owner scope decisions (00 §6); 20 §Withdrawn, 42 §10, 90|
|D18, D19, D20|DECIDED|2026-10-22|owner in chat; 00 §4b; D10, D12, D14, phase order AMENDED|
|Step 2.0; step 2.6; CS-OPS-1, CS-OPS-6, CS-NODE-4, CI-7|WITHDRAWN|2026-10-22|D19, D20; 20 §Deploy-time items, 42 §10|
|Steps 2.1, 2.2, 2.3, 2.4, 2.5, 2.7|DONE (local, lean)|2026-10-20..2026-10-27|`records/phase-2.md`, sections 2.1–2.7|
|Step 2.8, Phase 2|DONE in lean mode, with open items; owner signature pending|2026-10-27|`records/phase-2.md`, section 2.8 (final local run on `26a4c03` green, every job)|
|CS-W0-1, CS-W0-10, CS-W0-9 (`build:test` script)|DONE|2026-10-20|`records/phase-2.md`, section 2.1; the Dockerfile parts of CS-W0-7/-8/-9 reverted (D19)|
|P0 rows; P1 rows whose Wave starts in W0–W4e|DONE, except the DEFERRED halves the record lists|2026-10-27|`records/phase-2.md` (final local run)|
|R fault patches (74 valid of 75)|FAULT-VERIFIED|2026-10-27|`test/faults/kill-summary.json`; `test/faults/R-###*.patch`|
|Closed in Phase 2: VF-07, VF-08, VF-09, VF-22|CLOSED|2026-10-20..2026-10-22|VF-07: msw 2.15.0 works in Jest on Node 18 through the ESM resolver `test/esm-resolver.js` (exception row for 02 §3.5 still to write); VF-08: Stryker 10 on a staged copy without `babel.config.js` (02 §3.5); VF-09: two host parity builds of G identical; VF-22: a disabled filter value has no pointer and no keyboard path, facet values have no keyboard path (`records/phase-2.md`, sections 2.1–2.4)|
|Closed in jump 1: VF-19|CLOSED|2026-10-27|VF-19: MIT, the `LICENSE` file of bibtex-parse-js 0.0.24 (copyright 2013 ORCID, Inc. and 2010 Henrik Muehe; `package.json` `"license": "MIT"`); the vendored copy keeps it as `vendor/bibtex-parse-js/LICENSE`, which meets the notice condition (CS-BIB-1). The i18n-iso-countries 6.8.0 `LICENSE` (MIT) is kept beside its vendored map|
|CS-W0-2, CS-W0-3, CS-W0-5 (`.nvmrc`, `devEngines`), CS-BAB-3, CS-BIB-1 (with its R-075 Babel `ignore`), CS-I18N-1, CS-W0-12|DONE (local, jump 1 step W0)|2026-10-27|branch `upgrade/jump1-tooling-leaf-design`; `.next` equals the 2.8 build except the chunks holding the vendored modules (and the build manifest naming them); T-108, T-114, T-410, T-602, T-709, T-801 green; T-008 strict problem set 9 → 7 (only the two logrocket-react peer problems gone). Red by design, owner decision open: T-001 (CS-BAB-3 adds two `import/prefer-default-export` findings), T-008 c1 (tree-size floors), T-013 (prod tree vs `<base'>`). CS-W0-4, CS-W0-6 and the Dockerfile part of CS-W0-5: deploy-time items (20)|
|CS-W0b-1, CS-W0b-2, CS-W0b-3, CS-W0b-4, CS-N13-1, CS-N13-2|DONE (local, jump 1 step W0b)|2026-10-27|branch `upgrade/jump1-tooling-leaf-design`; each change built on its own: CS-W0b-2, CS-W0b-3 and CS-W0b-4 leave `.next/static` and `.next/server` identical (183 of 183 files; CSS md5 equal; one css-loader patched per compiler; the server `_app` still requires `@sentry/node`; `required-server-files.json` gains only `eslint.ignoreDuringBuilds`); CS-W0b-1 and CS-N13-1/-2 change only the chunks of the pages they edit (minifier renames, the title expression, `legacyBehavior: true` ×5). SSR answers of 44 routes equal the W0 build after the 40 §1 normalisations (status, `Location`, body); a null or missing work/output title still renders `<title> - CORE</title>`. T-002, T-003, T-004, T-406, T-407, T-602, T-702 (also with CS-OPS-1), T-801 green. T-505 c2 red by design (it pins the two-element title children; AD row proposed, owner decision open). T-610 c3 red since W0: server-bundle line numbers in two pinned stack traces (W0: CS-BIB-1, CS-I18N-1; W0b: CS-N13-2), AD rows proposed|
|CS-DSN-1|DONE (local, jump 1 step W0.5)|2026-10-27|branch `upgrade/jump1-tooling-leaf-design`; `vendor/oacore-design-5.0.74.tgz` is the published tarball (sha1 `e6a401d7…`, the lock's sha512 integrity, 466 entries; `vendor/PROVENANCE.md`); spec `file:vendor/oacore-design-5.0.74.tgz`; the lock changes only the root spec and the design entry's `resolved`, integrity unchanged; the installed package equals the previous install file for file. VG-1..VG-7 against the W0b build: not a symlink, 466 files; T-016 green (110 emitted modules equal their files, no `core-js` import added, verifier differs only in `lib/config.js`); stylesheet bytes of every route equal (76 links); media names and the 48-symbol prod sprite equal; `.next/static` and `.next/server` identical (183 of 183, buildId normalised; T-014 (a) green on two builds of the step tree); SSR answers of the 32 T-601 routes (44 routes in all) equal; T-801, T-802, T-417, T-418, T-416, T-701 green; T-005, T-006 unchanged. Red by design, owner decision open: T-008 c4 (pins the `5.0.74` spec and the GitHub Packages `resolved`; AD row proposed). T-013 adds one entry (the design `resolved`), within the reference move of the W0 AD row. The `COPY vendor/` line and the registry token: deploy-time items (20)|
|CS-N11-9|DEFERRED to W4c (not neutral on 10.2.3; 20 row: here only if neutral)|2026-10-27|a copy of the 10.2.3 page as `pages/_error.jsx` renders the same markup as the built-in (12 of 12 prop cases, `getInitialProps` equal), but the build differs beyond the page entry: webpack chunk ids renumber in `main`, `_app` and six page chunks, two shared chunks are renamed, and the page is compiled with the app's `@babel/runtime` 7.27.3 helpers (client `_error` chunk 9,402 → 12,208 bytes). The copy also needs a lint exclusion (10 ESLint 7 findings), a CS row at W4c|
|CS-LINT-1, CS-LINT-2, CS-LINT-3, CS-LINT-4, CS-STY-1, CS-PRET-1, CS-HUS-1, CS-HUS-2, CS-NRA-1|DONE (local, jump 1 step W1)|2026-10-28|branch `upgrade/jump1-tooling-leaf-design`; ESLint 10.13.0 with a flat `eslint.config.js` holding the 245 enabled rules of the ESLint 7 resolved config (`findings/baselines/eslint-resolved-config.*.json`; `prettier/prettier` left out), typescript-eslint 8.72.1 parser, TypeScript 6.0.3, eslint-plugin-import-x under the key `import`; seven ESLint 10 default changes pinned to the ESLint 7 behaviour, JSX text skipped as babel-eslint did; no rule dropped (react/jsx-filename-extension, the one enabled rule that calls a removed context method, runs through a context shim, no `@eslint-react`). The effective rules equal ESLint 7's for every file group (application, `*.config.js`, `jest.config.js`, harness) except those pins; the same files are linted (272: 157 application, 115 harness). rules-of-hooks with its 5 findings as bulk suppressions (exit 0 at baseline, 1 on a new violation, 0 on a line shift, 2 when one is fixed, 0 after `--prune-suppressions`); `lint:js` = `eslint .`, exit 1 as before. stylelint 17.16.0 with 62 of the 77 enabled stylelint 13 rules (14 removed spacing rules and function-calc-no-invalid gone; value-keyword-case keeps the stylelint 13 camelCase SVG keywords): the same 16 findings as stylelint 13; ratchet `test/baseline/stylelint-ratchet.json` (16, 12 after the format-only commit). Prettier 3.9.10 with the five organisation options inlined; one format-only commit (9 files; Babel and postcss ASTs equal, hex case only in CSS; in `.git-blame-ignore-revs`). husky 9.1.7 and lint-staged 17.6.0 (`prepare: husky`, `.husky/pre-commit`): in a scratch clone a lint error or unformatted CSS blocks the commit, a staged vendored file stays byte-identical (`.prettierignore`), `HUSKY=0` skips the hook, `prepare` exits 0 without `.git`; the hooks of the main checkout were not installed (sync with `HUSKY=0`). npm-run-all2 9.0.4: `npm run lint` runs the four `lint:*` scripts, exit codes as before (json 0, js 1, css 2, parity 0). T-001 rewritten on the new-tool baseline taken on unchanged code and frozen (`test/baseline/t001-lint-w1.json`: 18 ESLint, 16 stylelint findings, 9 unformatted files) and green, also from the static project on Node 18 (the script re-runs itself on the tooling Node). `.next` equals the W0.5 build except the Prettier-touched modules: the source maps of the chunks and server pages holding them, the server `_app.js` (`console.log('GA')` quotes), and the `_app` and `outputs/update` chunks and two CSS files renamed by their content hash, byte-identical after the names. T-801 (309), T-401, T-002, T-003, T-739, T-805 green. The harness JSON writers now call the Prettier CLI (Prettier 3 has no sync API): the same output as the Prettier 2 API for all 687 committed JSON files. The lock-only installs had raised the production copies of ajv, debug and nanoid; the lock keeps them at their versions (newer copies nested under the tools that need them). Red by design: T-008 c1 (tree-size floors; AD rows proposed), T-013 until its reference moves to the W1 merge (AD-005). The husky check of the image: deploy-time item (20)|
|CS-SEN-1, CS-SEN-3|DONE (local, jump 1 step W2a); test-side differences PROPOSED for the owner's end-of-jump signature|2026-10-28|branch `upgrade/jump1-tooling-leaf-design`; `@sentry/browser` and `@sentry/node` 5.30.0 -> 7.120.4 exact (`v7` dist-tag; the lock changes only the Sentry subtree: 7 entries removed, 8 added, 5 changed; production tree otherwise unchanged); `utils/sentry.js` keeps what the app sends (no session or client-report envelopes, no `sentry-trace`/`baggage` on server requests: 0 of 6158 SSR requests at the wire, T-607 green; Dedupe, Undici, Context, Modules left out) and imports the three SDK functions by name, so the client `_app` chunk is 34.4 KB gzip (5.30: 32.0 KB; a whole-SDK `require` gave 79.8 KB plus a 37.7 KB replay chunk); `.next` equals the W1 build except the `_app` client chunk, the server `_app` page and `500.html` (178 of 183 files); GHSA-593m-55hh-j8gv absent from `npm audit` (no Sentry advisory). Kept SDK changes: events go to `/api/0/envelope/` on the DSN host (the CSP blocks the browser report as before: one attempt, one violation, 0 at the stub), the server handlers mark their events `handled: false`, and Sentry 7 drops the second capture of the same error object (T-608: one event where 5.30 sent two); exit 1 after the flush and survival unchanged. JS syntax floor of the client chunks es2015 -> es2018 (object spread in `@sentry/core` 7, T-015)|
|CS-LR-1, CS-LR-2, CS-LR-3|DONE (local, jump 1 step W2b); test-side differences PROPOSED for the owner's end-of-jump signature|2026-10-28|branch `upgrade/jump1-tooling-leaf-design`; `logrocket` 10.0.0 -> 12.4.0 exact (`latest` dist-tag; the lock changes only the `logrocket` entry) and `*.logr-in.com` appended to the LogRocket host set of `csp.config.js` in the same commit (R-026): the 7 directives that list the set carry it, the old hosts stay (S-6). 12.4.0 loads `https://cdn.logr-in.com/logger-1.min.js` (10.0.0: `https://cdn.lgrckt-in.com/logger-1.min.js`); over the whole chromium run 0 CSP violations on a LogRocket host (917 tests), 1208 script requests, each aborted by the harness after the CSP check and each with the one SDK warning, 0 ingest requests. CS-LR-3 keeps the SDK (171,061 B, over the 160,000 B `lib` split-chunk size of Next 10) in the shared client chunk: `.next` equals the W2a build except that chunk (34 of 35 modules identical, only the SDK module) and `500.html`, which names it (180 of 183 files); without it a 61 KB chunk of its own and renumbered chunk ids. T-601 c5, T-606, T-607, T-728 c1/c3, T-741, T-007 green; JS syntax floor unchanged at the W2a value (T-015). Pinned LogRocket URL and policy text: T-116 c2, T-010 c1/c2, T-603 c1, T-702 c2/c9, T-719 c4/c5, T-720, T-729 c1/c2 (AD rows); the quoted `connect-src` directive of the Sentry console lines in T-716 c3, T-727, T-730 gains the host|
|CS-CORE-1|DONE (local, jump 1 step W2c); no test-side difference|2026-10-28|branch `upgrade/jump1-tooling-leaf-design`; `core-js` (a caret range, locked 3.42.0) -> 3.51.0 exact (`latest` dist-tag; the lock changes only the `core-js` entry, 1827 entries before and after); no code or Babel change. `@babel/preset-env` injects the same 70 `core-js/modules/*` polyfills (the list comes from `core-js-compat` 3.46.0, untouched), so `.next` equals the W2b build except 4 shared client chunks that hold core-js (same chunk ids and names, new content hashes) and `500.html`, which names them (174 of 183 files identical, server bundles identical): of the 328 distinct webpack modules in those chunks 175 are identical, 34 core-js module bodies changed, 90 more core-js modules and 14 Next-internal ones differ only in terser's local variable names, 5 core-js internals leave and 10 enter (3 and 8 distinct files), and nothing else changes; the four chunks grow by 6,085 bytes (2,678 gzip). JS syntax floor unchanged (es-check ladder over the 29 client files: es2015-es2017 fail only `_app`, es2018 none, as at W2b). Over the chromium and wire run the 945 tests have the same status as at W2b (778 passed, 139 failed, 28 did not run), failing on the same first assertions|

## 5. Open branches and PRs

|Ref|Action|
|---|---|
|`upgrade/p2-21-harness` … `upgrade/p2-27-p1-faults`, `upgrade/p2-28-exit`|Phase 2, local only, never pushed (D20). Tip `upgrade/p2-28-exit`; the jump-1 branch starts from it (01 §10). Pushing (after the wording-rule history check) is the owner's call|
|`docs/upgrade-plan`|landing 1(a)–(e) done 2026-10-20 (committed). Next 1(f), owner: rebase onto `origin/main`, push, open the PR to `main` (README §8 action 1). Its merge redeploys prod with an unchanged runtime tree (R-088, `aks_deploy.yml:3-5`): merge in working hours|
|PR #389 (`master`, Node 24 / React 19), #410 (`main.old`, Next 15.5.14)|stale (review:00 XRD.2, not re-checked); OQ-18: owner closes both|

## 6. Work-session log

|Date|Step|What was done|origin/main|By|
|---|---|---|---|---|
|2026-10-19|1|Audit (findings 01-08) + first docs|`cc0e228`|plan team|
|2026-10-19|1b|Adversarial review|`cc0e228`|reviewers|
|2026-10-20|rewrite|Docs rewritten with the recommended defaults for OQ-1..18|`cc0e228`|plan team|
|2026-10-20|rewrite|OQ-1..OQ-18 DECIDED (owner confirmed the recommended defaults): OQ-mapped ODs, D15, D16 DECIDED (90, 00, §2); review fixes (2.0 split into 2.0a/2.0b, gate statistics, pins)|`cc0e228`|plan team|
|2026-10-20|1(a)–(e)|Landing: doc set placed in `docs/upgrade/`, `60-design-copy-plan.md` removed, `tools/check-docs.mjs` added, `findings/` scrubbed, `parts/` deleted, checker ERROR 0, plan committed on `docs/upgrade-plan`; next 1(f) (owner)|`cc0e228`|plan team|
|2026-10-20|rewrite|Owner scope decisions applied (00 §6): S-4 preserved (D16, CS-SEC-1 WITHDRAWN); today's deploy process kept (OD-29, CS-OPS-2..4, CI-6, 2.0a/2.0b WITHDRAWN; one step 2.0); `_next/data` rule as an in-repo PR (OD-03); baselines and fixtures committed, no new infrastructure (OD-24/25, OD-46); image optimizer as today (OD-41, CS-OPS-5 and CS-IMG-1 WITHDRAWN); stage soak replaced by pre-merge C6-CI, split withdrawn (OD-47); owner-only sign-off|`cc0e228`|plan team|
|2026-10-20..2026-10-22|2.1–2.7|Phase 2 locally: harness, fixtures, P0 tests, golden commit and host builds, B0-local baselines, P1 tests, breakage catalogue; owner decisions D18–D20 (2026-10-22): lean target, scope rule, no CI; DevOps and CI changes reverted|`cc0e228` (not re-fetched; local only)|implementer|
|2026-10-27|2.7, 2.8|Review fixes, dependency sync of the repository's `node_modules` with the lock, final local full-suite run green on `26a4c03`; exit record `records/phase-2.md`, plan docs updated to D18–D20; next: jump 1, awaiting the owner's go-ahead|`cc0e228` (not re-fetched; local only)|implementer|
