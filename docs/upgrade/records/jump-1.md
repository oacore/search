# Record jump 1: tooling, leaf libraries, design copy (lean mode)

Record jump 1 | **Jump 1 DONE**: the two full ci-local runs on `87a39d4` gave 2,710 passed, 1 failed (T-610 c3), 28 did not run each time (the 28 `@wire` tests passed separately); after the owner signed AD-048/AD-049, T-610 c3 and the `@wire` project are green on the same build, so the gate of ci-local reads green with no runtime change, and a third full ci-local on `855c09b` was green in every job, 2,739 passed, 0 failed (§1, §6) | 2026-10-27..2026-10-28

- **Rules in force:** D18 (lean target), D19 (scope), D20 (no CI) ([00](../00-decisions.md) §4b); the lean protocol ([01](../01-playbook.md) §10); gates [55](../55-gates-and-confidence.md) §0. The owner approved jump 1 as planned on 2026-10-27 ([50](../50-roadmap.md) §4.0 row 1, W1 included), with the installs of its package versions from npm. From W1 on, the owner batched every new accepted difference for one signature at the end of the jump.
- **Where it ran:** one workstation (macOS arm64). Runtime Node 18.20.8 for the app builds, Jest and `next start`; tooling Node 24 for lint, the docs check, the harness and the Playwright runner; npm 10.8.2; `retries: 0`. Lean builds (01 §10 item 3): the repository's `node_modules` synced once per change group (`HUSKY=0 npm ci --include=dev --legacy-peer-deps`, from W5 with `--install-links`), every build tree a `cp -Rc` clone of it plus the app build step. At most 4 build trees (the owner allowed 4) except two brief moments with 5 (W0.5, W5b; §4, test-integrity item 9), at most 2 builds at once, at least 100 GB free throughout.
- **Not done anywhere:** nothing was pushed, merged into `main` or `master`, tagged on origin or deployed. `git diff f5cfc20 -- .github kube Dockerfile .dockerignore` is empty. Every commit was made with `HUSKY=0`; `core.hooksPath` stayed unset.
- **Branch (local):** `upgrade/jump1-tooling-leaf-design`, from `upgrade/p2-28-exit` (`92b1f41`). The jump check ran on the tip `87a39d4`. After it came this record (`f3922ed`, docs only), the owner-signed rows AD-048/AD-049 (`ef2218b`: the ledger, the baseline manifest and STATUS only), the final docs merge (`855c09b`), the close-review fixes (`3fcd58d`: test tooling and docs) and the polish (test tooling, three test titles and docs); none of them changes the runtime tree, so the build key stays `e343464ce23af57f`. Every step and fix group was a sub-branch `upgrade/jump1-tooling-leaf-design--<slug>`, merged with `--no-ff` and deleted (§2).
- **Evidence:** every figure below comes from the step's evidence files and logs, kept with the work-session state outside the repository; the full-suite summaries are `$ARTIFACT_DIR/ci-local/20261028T155431Z.json` (round 1) and `$ARTIFACT_DIR/ci-local/20261028T164642Z.json` (round 2); the re-runs after AD-048/AD-049 are `$ARTIFACT_DIR/runs/jcl1`, `jcl2` (T-610) and `jcl3` (`@wire`); the third full ci-local, run by the close review on `855c09b`, is `$ARTIFACT_DIR/ci-local/20261028T180016Z.json`.
- **Sign-offs (01 §7):** Implementer: _. Reviewer: the two jump-1 reviews (runtime behaviour; test integrity, scope and hygiene; §4), no named person. Owner: pending; the owner signs this record.

## 1. Jump check (55 §0)

`CI_LOCAL_KEEP_GOING=1 HUSKY=0 bash scripts/ci-local.sh` ran twice on the tip `87a39d4`, each time as one call with all six jobs. The second run (1,348 s) gave the same result as the first (1,343 s).

| Job | Result (round 2) |
|---|---|
| lint (17 s) | success. Lint parity: ESLint 18 findings (= the frozen W1 baseline), stylelint 12.<br>Docs check ERROR 0, WARN 21.<br>Ledger (offline structural checks) pass.<br>Fixture scrub check pass. |
| unit (227 s) | success. Jest `node` + `dom`: 1,099/1,099 tests, 59 suites, 1 snapshot. |
| image (58 s) | success. Harness self-tests 25/25.<br>Browser targets = the committed copy.<br>Layer A on build `e343464ce23af57f` with its twin `-ci-b`: 19 suites, 94/94, T-014 (a) included.<br>T-008 on the installed tree green; T-901 11/11; T-721 negative control 3/3. |
| e2e (1,027 s) | **failure.** chromium 960 passed, 1 failed (T-610 c3), 28 did not run (the `@wire` tests depend on the `chromium` project).<br>visual (all but T-802) 392 passed; CS-OPS-1 overlay (T-604, T-702) 26 passed; T-802 on the harness variant 73 passed. T-728 c4 green. |
| ops (19 s) | success. Jest ops 18/18; T-907 c2 7/7; T-907 c1 + c3 rehearsal 2/2. |
| gate | **failure** (e2e). |

- **Totals, each run:** 2,710 tests passed, 1 failed, 28 did not run: unit 1,099; harness 25; static 94; T-901 11; T-721 3; chromium 960; visual 392; CS-OPS-1 26; T-802 73; Jest ops 18; T-907 9. The 28 `@wire` tests passed separately, with `--no-deps --project wire` on the same build (28/28): 2,738 passed with them, outside ci-local.
- **The one red, T-610 c3** (`e2e/http/t610-props-output.spec.mjs:227`, the app's stdout/stderr census equals its baseline). Two lines differ in the `URIError: URI malformed` stack of `DataProviders.search` (sweep `providers-q-100pct`): `at i.It` became `at i.Kt` and `at i.O` became `at i.g`, both frames in `node_modules/mobx/dist/mobx.cjs.production.min.js`. The message, the app frames, the file names and the line count are unchanged.
  - **Not a flake:** re-run once on a fresh stack in each round, with the identical two-line diff.
  - **Not a regression:** in the two production bundles (6.13.7 from the local npm cache, 6.16.1 from the install), `It` and `Kt` are the same method, `ComputedValue.computeValue_`, and `O` and `g` are the same method, `ObservableObjectAdministration.getObservablePropValue_`. The minifier renamed them in the mobx 6.13.7 → 6.16.1 bump (CS-MOBX-1, W3). The T-203 reactivity table has been identical since W3.
  - **Why it surfaced late:** the diff first appears in the W3 run (the T-610 c3 diff grows from 6 to 8 lines there), but W3 to the owner-decision run compared reds by their first error line only, and the first line was AD-037's. It was found when the AD batch made AD-037's lines pass.
  - **Status:** accepted. The owner signed AD-048 and AD-049 on 2026-10-28 ("I sign AD-048 and AD-049 as proposed (T-610 c3: the mobx 6.16.1 minified frame names i.It -> i.Kt and i.O -> i.g)."); they accept exactly the two lines (§6), merged as `ef2218b`.
- **After AD-048/AD-049** (same build `e343464ce23af57f`, no install, no new build; a fresh stack per run):
  - `npm run e2e -- --run <id> --project chromium -g 'T-610'`, twice: 4/4 each. c1, c2 and c4 passed as before. c3 passed, annotated `AD-037 x6`, `AD-048 x1`, `AD-049 x1` (the e2e baseline hook applies the rows to the masked baseline; the file stays as recorded).
  - `npm run e2e -- --run <id> --no-deps --project wire`: 28/28, the tests the red chromium test had skipped inside ci-local.
  - `node scripts/ad-ledger.mjs --base master --offline` pass (47 rows); the ad-ledger unit tests and T-417 123/123; the B0-local manifest refreshed (the ledger line), `shasum -a 256 -c` 1301 OK.
  - Every reader of the ledger filters by test id, and both rows name T-610 only, so no other test can change.
  - **Third full ci-local** (run by the close review on `855c09b`, the same build and trees, `$ARTIFACT_DIR/ci-local/20261028T180016Z.json`): every job rc 0, gate rc 0; unit 1,099, harness 25, static 94, T-901 11, T-721 3, chromium + wire 989 in one call, visual 392, CS-OPS-1 26, T-802 73, ops 18 + 9: 2,739 passed, 0 failed.
- **Builds:** default `e343464ce23af57f`, harness `58be17d382789177`, nodsn `b74a178bb03118b4` and the twin `e343464ce23af57f-ci-b`. The first three were built at `a5b1c21`; nothing in the runtime tree changed after it. No `npm ci`, no `--allow-incomplete`. The Phase-2 tree `2dcca855347eb615` was deleted at the jump check. 103 GB free.
- **T-728 c4 dev inventory**, re-recorded at `87a39d4` before each run: 396 loads, 35 warning signatures (15 hydration), 0 unmapped. The first round-2 attempt had two `page.goto` timeouts while `next dev` compiled one page three times at once; it was not used, and the second attempt was clean.
- **Verdict (55 §0): green, "Jump 1 DONE".** Both ci-local runs: lint, unit, image and ops `success`; e2e red on one deterministic test, T-610 c3, re-run once and red again. 55 §0 lets a signed AD row accept such a red (D1). AD-048/AD-049 are signed and applied, T-610 c3 and the `@wire` project are green on the same build, and the runtime tree did not change. So the gate of ci-local reads green with no runtime change; the third full ci-local on `855c09b` is green in every job.

## 2. Merges on the jump branch

| Merge | Content |
|---|---|
| `65f54c1` | W0 (CS-W0-2, CS-W0-3, CS-W0-5, CS-BAB-3, CS-BIB-1, CS-I18N-1, CS-W0-12) |
| `a09d2a3` | W0b (CS-W0b-1..-4, CS-N13-1, CS-N13-2) |
| `fb0cacd` | W0.5 (CS-DSN-1) |
| `18ebb46`, `f3844bf` | W1 (CS-LINT-1..-4, CS-STY-1, CS-PRET-1, CS-HUS-1, CS-HUS-2, CS-NRA-1), then its deploy-time record |
| `75f2385` | the owner-signed rows AD-001..AD-009, the T-610 frame normaliser and the local signature form |
| `7f74b18` | W2a (CS-SEN-1, CS-SEN-3) |
| `fb85c92` | W2b (CS-LR-1, CS-LR-2, CS-LR-3) |
| `d7ebfb0` | W2c (CS-CORE-1) |
| `5bbacf1` | W2d (CS-PCSS-1) |
| `6d2134c` | W2e (CS-BAB-9, CS-BAB-10, 02) |
| `0847db6` | W3 (CS-MOBX-1, CS-MOBX-2) |
| `865a4ff` | W5a (CS-DSN-2) |
| `768c6b9` | W5b (CS-DSN-3, CS-DSN-4, CS-DSN-5) |
| `ef58bf7` | the review fixes (§4) |
| `e8902fd` | W2 owner decisions (02, CS-CORE-1, CS-SEN-4) (§5) |
| `87a39d4` | the AD batch AD-010..AD-047 (§6) = the jump-check tip |
| `f3922ed` | this record (docs only) |
| `ef2218b` | the owner-signed rows AD-048, AD-049 (§6): the ledger, the B0-local manifest, STATUS §2 |
| `3fcd58d` | the close-review fixes (§4): the ledger checker per listed key, the known answers of the e2e baseline hook, 42 §8, W5.md and README §8 (no runtime change) |
| `Merge the jump 1 polish (jump 1)` of `upgrade/jump1-tooling-leaf-design--polish` | the close-review LOW findings (§4): the ledger key guard for a bare `(.*)`, three test titles, the docs (no runtime change) |

## 3. Steps

### 3.0 Versions, old → new (02 §5 step 6)

| Row (02) | Old (`upgrade/p2-28-exit`) | New (jump tip) | Step, CS |
|---|---|---|---|
| filesize, logrocket-react | 6.4.0, 6.0.3 | removed | W0, CS-W0-2 |
| throttle-debounce | root `^3.0.1` (3.0.1) | root entry removed; 3.0.1 stays as the design's dependency | W0, CS-W0-2 |
| bibtex-parse-js | 0.0.24 | vendored `vendor/bibtex-parse-js/` | W0, CS-BIB-1 |
| i18n-iso-countries | 6.8.0 | vendored `en` map `vendor/i18n-iso-countries/en.json` | W0, CS-I18N-1 |
| @mdi/svg, @babel/runtime | undeclared | declared 5.9.55, 7.27.3 → 7.29.10 | W0 CS-W0-3; W2e CS-BAB-9 |
| @oacore/design 5.0.74 | registry spec | `file:vendor/oacore-design-5.0.74.tgz` → `file:vendor/oacore-design` (vendored manifest edits CS-DSN-3..5) | W0.5 CS-DSN-1; W5 CS-DSN-2..5 |
| eslint (+ @eslint/js, globals) | 7.32.0 | 10.13.0 (10.0.1, 17.13.0) | W1, CS-LINT-1 |
| typescript-eslint, typescript | - | 8.72.1, 6.0.3 | W1, CS-LINT-1 |
| eslint-plugin-import | 2.x | eslint-plugin-import-x 4.17.1 | W1, CS-LINT-1 |
| eslint-plugin-react, jsx-a11y, react-hooks | `^7.21.5` (7.37.5), `^6.4.1` (6.10.2), - | 7.37.5, 6.10.2 (installed versions unchanged, now exact), 7.1.1 exact | W1, CS-LINT-1, CS-LINT-2 |
| babel-eslint, eslint-plugin-prettier, @oacore/eslint-config-react, @oacore/prettier-config, @oacore/stylelint-config-base | 10.1.0, 3.4.1, 1.0.6 ×3 | removed | W1, CS-LINT-1, CS-PRET-1, CS-STY-1 |
| prettier | 2.8.8 | 3.9.10 | W1, CS-PRET-1 |
| stylelint, stylelint-order, stylelint-config-css-modules, stylelint-prettier | 13.13.1, 4.1.0, 2.3.0, 1.2.0 | 17.16.0, 8.1.2, 4.6.0, 5.0.3 | W1, CS-STY-1 |
| husky, lint-staged | 4.3.8, - | 9.1.7, 17.6.0 | W1, CS-HUS-1 |
| npm-run-all | 4.1.5 | npm-run-all2 9.0.4 | W1, CS-NRA-1 |
| @sentry/browser, @sentry/node | 5.30.0 | 7.120.4 (client copies compiled to ES2015, CS-SEN-4) | W2a, CS-SEN-1, CS-SEN-3, CS-SEN-4 |
| logrocket | 10.0.0 | 12.4.0 | W2b, CS-LR-1 |
| core-js | 3.42.0 | 3.51.0 at W2c, **held at 3.46.0** by the owner | W2c, CS-CORE-1 |
| postcss (dev) | 8.4.14 | 8.5.32 | W2d, CS-PCSS-1 |
| @babel/core, preset-env, preset-react, plugin-transform-runtime, plugin-proposal-decorators, plugin-proposal-export-default-from | 7.27.1..7.28.5 | 7.29.7 | W2e, CS-BAB-9 |
| @babel/plugin-proposal-class-properties | 7.18.6 | replaced by @babel/plugin-transform-class-properties 7.29.7 | W2e, CS-BAB-9 |
| `@babel/*`, `@jridgewell/*` override pins (17) | the 7.27/7.28 releases (@jridgewell 0.3.8, 0.3.25) | the 7.29 releases (0.3.13, 0.3.31) | W2e, CS-BAB-10 |
| core-js-compat; babel-plugin-polyfill-corejs3, -corejs2, -regenerator | 3.46.0; 0.11.1, 0.4.14, 0.6.5 | 3.51.0; 0.14.2, 0.4.17, 0.6.8 (lock only) | W2e, CS-BAB-9 |
| react-focus-lock | 2.13.6 | 2.13.7 (lock only) | W2e, 02 |
| katex | 0.16.22 | 0.16.47 at W2e, **held at 0.16.22** by the owner | W2e, 02 |
| mobx, mobx-react-lite | 6.13.7, 3.4.3 | 6.16.1, 4.1.1 (+ use-sync-external-store 1.7.0) | W3, CS-MOBX-1, CS-MOBX-2 |
| react-slick, enquire.js, json2mq, resize-observer-polyfill, string-convert, body-scroll-lock | 0.28.1, 2.1.6, 0.2.0, 1.5.1, 0.2.1, 3.1.5 | removed | W5b, CS-DSN-4, CS-DSN-5 |

Lock: 2,411 → 1,819 `packages` entries; production entries 1,255 → 744; entries from GitHub Packages 5 → 0 (`packages` entries; a `grep -c` of the lock counts 10, because lockfile v2 names each twice). Tooling Node: `.nvmrc` 24 and `devEngines` (CS-W0-5); the runtime Node stays 18.20.8 until jump 2.

### 3.1 W0: hygiene (`65f54c1`, 2026-10-27)

- **Applied:** CS-W0-2, CS-W0-3, CS-W0-5 (`.nvmrc`, `devEngines`; its Dockerfile part is the Node base image item), CS-BAB-3, CS-BIB-1 (with its R-075 Babel `ignore`), CS-I18N-1, and the new row CS-W0-12 (vendored files out of ESLint), written into 20 before the code.
- **Exit facts:**
  - `.next` vs the 2.8 build: 183 files, 172 identical. The others are the three server pages that use the vendored files, the client chunk with `bibtexParse` and the data-providers chunk with the `en` map, and `_buildManifest.js`, which names them. Module level: the bibtex module body is identical under a new id; the JSON module holds the same 250 countries.
  - T-108, T-114, T-410, T-602, T-801 green. T-008's strict problem set shrinks 9 → 7, exactly `invalid:react` and `invalid:react-dom` (the logrocket-react peer).
  - CS-BIB-1 sha256 = the npm file's (T-114 c4); CS-I18N-1 deep-equal to 6.8.0 (new T-108 c5). Without the Babel `ignore` the build fails (R-075), so the fallback is needed.
  - VF-19 settled: MIT (STATUS §4).
- **Tests:** unit 1,098/1,098. Static 83/90; red: T-001 c1 ×2, T-008 c1, T-013 c1..c4, all by design: AD-001..AD-005. Lint parity differs only by the two W0 keys.
- **Not done:** T-008 on linux/arm64 alpine (no Docker; DEFERRED).

### 3.2 W0b: Next-proofing rows (`a09d2a3`, 2026-10-27)

- **Applied:** CS-W0b-1 (titles as one template string), CS-W0b-2 (the css-loader rule visitor that fails on no match), CS-W0b-3 (the Sentry alias keyed on `isServer`, which also fixes Q-065's alias), CS-W0b-4 (`eslint.ignoreDuringBuilds`), CS-N13-1, CS-N13-2 (`legacyBehavior`, a no-op on 10.2.3). No version change.
- **Deferred:** CS-N11-9 to W4c. A faithful copy of the 10.2.3 `_error` renders the same markup (12 of 12 prop cases), but the build renumbers chunk ids and compiles `_error` with the root `@babel/runtime` helpers, so it is not neutral on 10.2.3.
- **Exit facts:** each change built on its own. CS-W0b-2, -3, -4: 183/183 files identical. CS-W0b-1: 170/183 (the title expression and minifier names in three page chunks). CS-N13: 174/183. SSR probe over 44 routes: status, Location, Content-Type and body equal; null-title probe 4/4.
- **Tests:** unit 1,097/1,098 (T-505 c2: AD-006). Static: W0's set. Chromium + wire 914 passed, 3 failed, 1 did not run: T-608 c2 (no nodsn build yet), T-728 c4 (inventory not re-recorded yet) and T-610 c3 (server-bundle line numbers: AD-007/AD-008, then the line:column normaliser). CS-OPS-1 overlay 26/26; T-801 309/309.

### 3.3 W0.5: design tarball (`fb0cacd`, 2026-10-27)

- **Applied:** CS-DSN-1. `vendor/oacore-design-5.0.74.tgz` is the published tarball (sha1 `e6a401d7…`, the lock's sha512 integrity, 466 entries; `vendor/PROVENANCE.md`); spec `file:vendor/oacore-design-5.0.74.tgz`. The lock changes only the root spec and the design's `resolved`.
- **Exit facts (VG-1..VG-7 vs the W0b build):** not a symlink, 466 files; T-016 7/7 (110 emitted design modules equal their files); stylesheets of 44 routes equal (76 links); media, the 48-symbol sprite and `public/` equal; `.next` 183/183 identical (VG-5; T-014 (a) green); raw SSR 44/44 equal; T-801 309/309, T-802 73/73, T-417 98/98, T-418, T-416, T-701 270/270.
- **Tests:** unit 1,097/1,098 (T-505 c2). Static 82/90; new red T-008 c4 (the pinned registry spec: AD-009).
- **Deploy-time item:** "Design tarball" (§9).

### 3.4 W1: lint, format, hooks on tooling Node 24 (`18ebb46`, `f3844bf`, 2026-10-28)

- **Applied:** CS-LINT-1 (flat `eslint.config.js` generated from the resolved rules), CS-LINT-2 (rules-of-hooks with its 5 existing findings as bulk suppressions), CS-LINT-3, CS-LINT-4, CS-STY-1 (with a findings ratchet), CS-PRET-1 (one format-only commit `2871579`, 9 files, in `.git-blame-ignore-revs`), CS-HUS-1, CS-NRA-1, and the new row CS-HUS-2 (`.prettierignore` = `vendor/`), written into 20 before the code.
- **Exit facts:**
  - T-001 new-tool baseline captured on unchanged application code (`0dc1b31`) and frozen in `test/baseline/t001-lint-w1.json`: ESLint 18 findings, 5 bulk suppressions, stylelint 16 (12 after the format-only commit), 9 unformatted files, 38 inline directives, harness scope 0.
  - Config parity per file over all 271 linted files: the effective ESLint 10 rules equal ESLint 7's except `prettier/prettier` (off), `import/no-cycle` without `disableScc`, the default-filled options, and 7 options pinned to keep the ESLint 7 behaviour; stylelint 17 = stylelint 13's 77 enabled rules minus the 15 removed ones.
  - `.next` vs the W0.5 build: 183 files, 164 identical; every difference is a Prettier-touched module (source maps, one quote style in `console.log('GA')`, content-hash renames). Formatting-only proof: the Babel and postcss ASTs of the 9 files are equal before and after `2871579`.
  - T-801 309/309 at 0 px, twice. The lint scripts keep their exit codes.
  - Lock 1,959 → 1,826 entries; production tree: 0 version, `resolved` or integrity changes; GitHub Packages entries 4 → 0. Strict `npm ls` problems 7 → 6.
- **Tests:** unit 1,097/1,098 (T-505 c2, signed but applied on the AD-rows branch). Static 87/93; red: T-008 c1 (floors: AD-010/AD-011), T-008 c4 (AD-009), T-013 (reference, AD-005). Harness 25/25. The patched JSON writers: 258/258 e2e tests and byte-identical output on 687 committed JSON files.
- **Deploy-time items:** "Husky in the image" (checked) and "Registry token" (§9).

### 3.5 W2a: Sentry 7 (`7f74b18`, 2026-10-28)

- **Applied:** CS-SEN-1 and the new row CS-SEN-3 (options and named imports), written into 20 before the code. Lock: only the Sentry subtree changes.
- **Exit facts:**
  - T-608 crash semantics kept: exit code 1, 15-16 ms after the throw; an unhandled rejection is survived; a build without a DSN survives and sends nothing. What the SDK changes: one envelope event per crash where 5.30 sent two store events (7.x refuses a second capture of the same Error object), `handled: false`, new listener names (AD-014..AD-017).
  - GHSA-593m-55hh-j8gv: 0 hits in `npm audit`.
  - Network: the same DSN host, `/store/` → `/envelope/`; no session or client-report envelope; 0 of 6,158 SSR requests carry `sentry-trace` or `baggage` (T-607).
  - Client `_app` chunk 31,974 → 34,387 B gzip with the named imports (a whole-SDK `require` gave 79,769 B plus a 37,650 B replay chunk); T-007 green.
  - Found: the client JS syntax floor rises from ES2015 to ES2018 (object spread in `@sentry/core` and `@sentry/utils` 7; T-015 red, PROPOSED AD-019). Settled by the owner's decision with CS-SEN-4 (§5).
- **Tests:** unit 1,095/1,099 (T-120 ×4: AD-012/AD-013). Static 83/93 (T-004 c1 AD-018, T-015 ×4 AD-019, the T-008 c1 floor, T-013 before the merge). Chromium + wire 897 passed, 20 failed, 28 did not run; wire alone 26/2; every red is a Sentry URL or listener key (AD-014..AD-027). T-728 c4 inventory re-recorded: 2 unmapped lines (AD-027).

### 3.6 W2b: LogRocket 12 (`fb85c92`, 2026-10-28)

- **Applied:** CS-LR-1 and CS-LR-2 in one commit (R-026: `*.logr-in.com` added to the 7 directives of `csp.config.js` that list LogRocket), and the new row CS-LR-3, written into 20 before the code.
- **Exit facts:**
  - T-116: the policy differs exactly by ` *.logr-in.com` in 7 directives (AD-028).
  - T-720: 0 CSP violations on a LogRocket host; over the whole chromium run 917 guard logs, none naming a LogRocket host.
  - SDK calibration: 1,208 recorder-script requests, all to `https://cdn.logr-in.com/logger-1.min.js` and aborted by the harness, 1,208 SDK warnings with unchanged text, 0 ingest requests.
  - CS-LR-3: logrocket 12.4.0 (171,061 B) passes Next 10's 160,000 B `lib` split size and would get its own 61 KB chunk; kept in the shared chunk, `.next` vs W2a is 180/183 identical (only the SDK module of the shared chunk, and `500.html`). Server bundles identical.
- **Tests:** unit 1,091/1,099 (+T-116 c2 ×4). Static 83/93 (+T-010 c1/c2: AD-029). Chromium + wire 778 passed, 139 failed, 28 did not run; the new reds are all the pinned LogRocket host: T-720 ×91 (AD-031), T-729 ×13 (AD-034), T-719 c4/c5 ×6 (AD-032), T-702 ×8 (AD-033), T-603 c1 (AD-030), and the quoted directive of the Sentry console lines (AD-035).

### 3.7 W2c: core-js (`d7ebfb0`, 2026-10-28)

- **Applied:** CS-CORE-1, core-js 3.42.0 → 3.51.0 (held at 3.46.0 later, §5).
- **Exit facts:** client chunk diff = core-js module bodies only. 183 files, 174 identical; 4 shared chunks renamed by their content hash with the same ids. Of their 328 modules, 175 are identical, 34 core-js bodies changed, 104 differ only in the minifier's local names. The injected polyfill set is 70 = 70 (T-004 c6 green); the T-015 syntax ladder is unchanged.
- **Tests:** unit, static and the chromium + wire run (945 tests) have the W2b status test by test. T-728 c4 re-recorded.

### 3.8 W2d: postcss (`5bbacf1`, 2026-10-28)

- **Applied:** CS-PCSS-1, postcss 8.4.14 → 8.5.32 (the 02 pin 8.5.31 was superseded, 02 §5 rule 3). The shared production copy `nanoid` stays 3.3.11 (3.3.20 nested under postcss).
- **Exit facts:** T-003 c1 and c2 green against the B0 reference (8 CSS files, 1,510 keyed rules, 5,006 declarations). `.next` 183/183 identical (default and nodsn). The `postcss.config.js` chain over 187 CSS sources gives byte-identical output on both versions. `npm audit` no longer lists the root copy; Next's own 8.2.13 and cssnano 4's 7.0.39 copies remain (W4c, CS-PCSS-4).
- **Tests:** unit and static as at W2c. The e2e sweeps were not re-run (the served files are byte-identical); T-728 c4 inventory and spec 89/90 (c4: AD-027).

### 3.9 W2e: Babel 7.29, react-focus-lock, katex (`6d2134c`, 2026-10-28)

- **Applied:** CS-BAB-9, the new row CS-BAB-10 (the `overrides` pins), written into 20 before the code, and the two lock-only rows of 02 §3.7. `debug` 4.4.1 and `hasown` 2.0.2 stay in the production tree, with the newer copies nested under the Babel tools.
- **Exit facts:**
  - `.next` vs W2d: 183 files, 148 identical. The differences are the `@babel/runtime` helper modules (8 added, 2 changed) and the regenerator output of every module with an `async` function (27 of 149 app sources), plus two modules of Next's own router that the app's Babel compiles, and the KaTeX and react-focus-lock library code. So "Babel helpers only" holds for the helpers and the regenerator, not literally.
  - The injected `core-js/modules/*` set is unchanged (T-004 c6); the syntax floor is unchanged.
  - The class-properties swap: 149 of 149 sources compile to the same code.
  - KaTeX 0.16.47: built CSS changed in the KaTeX rules (T-003 c1, PROPOSED AD-036); T-801 309/309 at 0 px. Settled by the owner's hold (§5).
- **Tests:** unit as at W2d. Static 80/93 (+T-003 c1). Chromium + wire 776 passed, 141 failed, 28 did not run: T-608 c2 (no nodsn build yet, green once built) and T-610 c3 (the renderPage frame lost its `_callee$` name: AD-037). Visual T-801 309/309. T-728 c4 re-recorded.

### 3.10 W3: mobx (`0847db6`, 2026-10-28)

- **Applied:** CS-MOBX-1, CS-MOBX-2. The lock adds the production package `use-sync-external-store` 1.7.0. `clearTimers()` was not added: both Jest environments have the native `FinalizationRegistry`, so it is a no-op (verify only, as the row allows).
- **Exit facts:** T-203 reactivity table identical, one `autorun` run per write; T-211 6/6; store tests 39/39. `.next` vs W2e: 178/183 identical (the mobx chunk, the shared chunk with mobx-react-lite and the shim, `500.html`); server bundles identical.
- **Tests:** unit and static with 0 status differences vs W2e. Chromium + wire 777 passed, 140 failed, 28 did not run: 1 difference, T-608 c2 now green. Visual 309/309. T-728 c4 re-recorded. T-610 c3's diff grew here by the two mobx frame names (§1), which the step's first-error comparison did not show; accepted by AD-048/AD-049 at the end of the jump (§6).

### 3.11 W5a: design as an in-repo directory package, first group (`865a4ff`, 2026-10-28)

- **Applied:** CS-DSN-2 (60 §5 DV0, DV1, DV4, DV5): `vendor/oacore-design/` is the tarball extracted (466 tracked files); spec `file:vendor/oacore-design`, installed with `--install-links` as a copy.
- **Exit facts:** DV0 on the W3 tip: T-417 98/98, T-418 3/3, T-802 73/73. VG-1..VG-7 vs the W3 build: not a symlink; T-016 c1, c2, c4; stylesheets 44/44 routes; media, sprite, `public/` equal; `.next` 183/183 identical (T-014 (a) green); SSR 44/44; T-801 309/309 (900 captures at 0 px), T-802 73/73.
- **Tests:** unit 1,068/1,099 (+T-417 c1 ×23: AD-038). Static after the merge 75/93 (AD-039..AD-045: the directory entry has no integrity, npm needs `--install-links`, and the source scans read the vendored package). Chromium + wire equal to W3 test by test. T-728 c4 re-recorded.
- **Deploy-time item:** "Design install flag", `--install-links` in the image (§9).

### 3.12 W5b: design, second group (`768c6b9`, 2026-10-28)

- **Applied:** CS-DSN-3 (peer ranges), CS-DSN-4 (the unrendered Carousel and `react-slick` out), CS-DSN-5 (three unused dependencies out); one commit, one `vendor/CHANGES.md` row and one build each. DV6; VF-27 settled (KaTeX code MIT, fonts SIL OFL 1.1). Detailed record: [W5.md](W5.md).
- **Exit facts:** VG-5 per group: 183/183, 177/183 (the shared design chunk loses exactly 20 modules), 183/183. VG-1..VG-7 vs W5a pass. DV6 (a): the strict `npm ci` stops with EUSAGE until 7.F; its strict problem set is T-008 c2's 6. DV6 (b): no lock entry from GitHub Packages; a credential-less install succeeds.
- **Tests:** unit and the chromium + wire run equal to W5a test by test. Static after the merge 72/93 (+T-016 c2, c3, c4: AD-046, AD-047). T-801 309/309, T-802 73/73. T-728 c4 re-recorded.

## 4. The two reviews and how each finding was settled

Both reviews read the range `upgrade/p2-28-exit..768c6b9` (W0 to W5b) and changed nothing.

**Runtime behaviour.** Every changed app file maps to a CS row; the format-only commit changes no semantics (ASTs and compiled output compared); no register quirk was fixed (Q-009, Q-044, Q-059, Q-080, Q-037, Q-101, Q-103, Q-085, Q-068, S-4, S-6, S-7 checked).

| Finding | Settled |
|---|---|
| H1: katex 0.16.47 changes the pixels of `\not`, `\widehat`, `align`/`aligned`/`gathered`, `\overbrace`/`\underbrace` (the fixtures hold 4 formulas, so T-801 does not see it) | Owner decision: hold katex 0.16.22 (`8e35c78`, `6a9125b`; §5). A KaTeX probe of 283 constructs, including those cases, renders byte-identically on the install, the Phase-2 build and the new build. AD-036 not needed. The math render fixture the review asks for is still open, with the later revisit (§11). |
| H2: Sentry 7 raises the client JS floor to ES2018 (KaiOS 2.5 loses all client JS) | Owner decision: compile `@sentry/*` for the client, new row CS-SEN-4 (`7c54469`, `36f4ac5`, `6b73772`, `a5b1c21`, `f94c487`; §5). T-015 green at ES2015; AD-019 not needed. |
| H3: T-733, T-738, T-804, T-806 (41 Wave W5) have no test file | Written in the review fixes: `4f347fa` T-733 (4 tests), `c94492a` T-738 (6), `7a4e0c4` T-804 (12), `be9f633` T-806 (28). Green twice on the W5a build and on the tip, once on the merged tip and once on the Phase-2 exit build: modal layering, sticky layers, Tab order, modal focus and the ARIA trees did not change over the jump. |
| M1: core-js 3.51.0 replaces the global `JSON.stringify` on the Node 18 server and in browsers without `JSON.rawJSON` (same output, about 2x slower) | Owner decision: hold core-js at the newest release with the native `JSON.stringify`, 3.46.0 (`b630dae`, `2d0ec3f`; §5). |
| L1: LogRocket recording on the new hosts is never exercised locally | Kept as a deploy check: CS-LR-1's prod-recording check and T-904 c3 after the final deploy (§11). |
| L2: CS-PRET-1 says 8 files, the commit formats 9; Q-065 does not mention CS-W0b-3 | Fixed: `f48e22b` (02, 20), `ad26458` (30). |
| Low, no row: Sentry 7 event payload contexts (ops only); core-js `es.array.includes` detection | Recorded, no change (event payload only; the browser events stay CSP-blocked, Q-096). |

**Test integrity, scope and hygiene.** Integrity holds: every test, baseline and harness change in the range is covered by an owner-signed AD row, a CS row or a plan-prescribed oracle change; no skip, only, retry or timeout added; scope, versions and wording clean.

| Finding | Settled |
|---|---|
| 1 HIGH: T-733, T-738, T-804, T-806 not written | Written (runtime H3 above). |
| 2 MEDIUM: no drafted test-side patch for AD-012..AD-037 | Drafted and applied in the AD batch after the owner signed (`87a39d4`, §6). Each row's `from`/`to` re-checked against the tip; the full run shows 139 chromium tests and T-727 ×2 failed → passed and no test passed → failed. |
| 3 MEDIUM: the local signature form has no owner confirmation | Confirmed by the owner on 2026-10-28 (§6); recorded in STATUS §2 and 42 §8 (`7b95bde`). |
| 4 MEDIUM: T-013 is green by construction at each merge | `scripts/prod-tree-report.mjs` with `scripts/prod-tree-rows.json` (`1e70639`) and 01 §10 item 7 (`9a6ab8b`): the whole-jump view (§7). |
| 5 MEDIUM: 17 fault patches fail plain `git apply --check`, 8 never named | Named exactly (§10); the refresh is due at the midpoint heavy check (55 §0). |
| 6 LOW: two loosened T-001 assertions | Restored to exact values: findings 30 = 18 + 12, refusal exit codes 2 and 3 (`490a6be`). |
| 7 LOW: an inert nested `.github/workflows` inside the vendored design | Not changed (no fix was asked for): it is part of the verbatim copy (60 §1), and nothing in this repository runs it. |
| 8 LOW: 02 and 20 say 8 files for the format-only commit | Fixed (`f48e22b`). |
| 9 LOW: four default merge subjects; the 4-tree budget exceeded briefly at W0.5 and W5b | Recorded; history is not rewritten. The close review found eight more non-merge subjects without the `(<CS-ID or AD-ID>)` suffix, three of them with no ID at all: `274f700` "Record the owner-signed rows AD-001 to AD-005 in the ledger", `f2ecad0` "Apply the AD-003/AD-004 floors and the AD-005 reference in T-008 and T-013", `9c35e23` "Record the owner-signed rows AD-006 to AD-009 in the ledger", `c369372` "Record the owner confirmations of AD-001 to AD-009 and the T-610 frame normaliser", `845728b` "Accept the local signature form of D20 in the ledger checker" (no ID), `782b6d8` "Refresh the ledger checksums in the B0-local manifest" (no ID), `dd5831c` "Withdraw AD-001 and AD-002, superseded by the frozen W1 T-001 baseline", `06f7044` "Refresh the B0-local manifest for the ledger and the W1 baseline files" (no ID); recorded, not rewritten. |
| 10 LOW: the image cannot install the jump tip until the Dockerfile has `--install-links` | Deploy-time item "Design install flag" (§9). |

**Close review (after `855c09b`).** Three reviewers read the jump tip and changed nothing; the three MEDIUM findings were fixed afterwards with no runtime change (the build key stays `e343464ce23af57f`).

| Finding | Settled |
|---|---|
| A composite key gets around the one-row-per-(test, key) guard of `scripts/ad-ledger.mjs`: two rows in force could list one T-603 key with different `to`, and the matcher accepts either | `362e233`: the checker applies the per-key rules to each key a composite key lists, the one row per (test, key) and the `kind: delta` prohibitions; two rows may list one baseline file only when neither row's `from` overlaps the other row's `from` or `to` (42 §8, `b3e5c87`). The committed ledger passes unchanged (AD-037, AD-048 and AD-049 replace literals that do not overlap). Known answers CI-1 c10b and c11; the new cases fail against the old checker. |
| The e2e baseline hook (AD-032, AD-033, AD-034, AD-037, AD-048, AD-049) has no committed known answers or negative controls | `f2fdfd6`: its rules move unchanged to `e2e/lib/P0-10/ledger-rows.mjs`; `test/unit/harness/e2e-ledger-rows.test.js` (5 tests) checks the rows of a file, the replacement at every occurrence with its count, the quote and backslash refusal and the negative controls (missing, withdrawn, other-test and other-file rows, an extra difference, an old name left); six mutations of the module all fail it. On build `e343464ce23af57f` the hook users (T-602, T-605, T-610, T-702, T-719, T-729) gave 134/134 on a fresh stack and T-604 with T-702 on the CS-OPS-1 overlay 26/26, equal test by test, ledger annotations included, to the runs before the change (T-610 c3 now passes with AD-048 and AD-049). Jest 1105/1105, `test:harness` 25/25, lint parity and the ledger check pass. |
| `records/W5.md` still called its rows PROPOSED and unsigned; README §8 did not list it among the pending signatures | `375dbb9`: the W5 status line and accepted-differences paragraph (signed 2026-10-28, applied in `87a39d4`); README §8. |

Not changed (the owner's call): the 42 §8 key-rule extensions (composite keys, the `(.*)` group, the e2e baseline hook, the per-key rule above) carry no owner signature as an acceptance change, and AD-048/AD-049 keep the label part of their keys (a change is a withdraw and re-add). Settled on 2026-10-29: the owner signed the extensions as one acceptance change and kept the labels (§11 decision 3).

**The close review's 15 LOW findings**, settled in the polish (no runtime change; the build key stays `e343464ce23af57f`):

| Finding | Settled |
|---|---|
| `scripts/ad-ledger.mjs` `hasGlob` dropped a `(.*)` anywhere in a key, so `(.*)` alone or `x.json(.*)` passed the no-glob guard | Only a route parameter group `:<name>(.*)` is literal text now; CI-1 c13 refuses `(.*)`, `x.json(.*)` and three more, and still allows `header:/:path(.*)` (42 §8). The committed ledger passes unchanged. |
| The T-120 c1, c2 and T-016 c3 titles described the behaviour before AD-012, AD-013 and AD-046 | The text after the clause id names what the assertions check; no assertion changed. |
| Docs: the headline counts of the two ci-local runs; STATUS §4 rows of W0 to W1 still "owner decision open"; the §5 visual build; §3.0 (GitHub Packages entries, the override pins, the two eslint plugins); `core-js-compat` "3.46.0 in the lock" in 02, 20 and STATUS; the build-tree count; 20 CS-HUS-2 (`lint:json` gained `--ignore-path .prettierignore` at W5); the CS-PCSS-1 and CS-BAB-9 line anchors (tree `a825839` again, §8); eight commit subjects without the ID suffix (item 9 above) | Corrected as measured. |
| Open items missing from §11 (the T-904 c3 checklist text, J1-W05-3, J1-W0-4, the dev-only stack-frame count) and the T-603 case-key gap that the close fixes found | Added to §11. |
| AD-035 names one test for three; the W1 T-001 baseline has no signed tool link | Owner decisions (§11). |

## 5. Owner decisions of 2026-10-28

The owner's words: "Keep everything identical: hold katex 0.16.22, hold core-js at the newest release with native JSON.stringify, compile @sentry/* for the client (no AD-019). I sign the rest of AD-012..AD-047 (AD-036 drops) and confirm the local signature form 'SIGNED: owner, <date> (<note>)'."

Applied in three change groups, merged as `e8902fd` "Merge W2 (02, CS-CORE-1, CS-SEN-4)" (the subject moves T-013's AD-005 reference to it):

- **(a) katex 0.16.22** (`8e35c78`, `6a9125b`): both lock entries byte-equal to those before the W2e bump; 02 §3.7 records the hold. T-003 c1 and c2 green against the B0 reference again; T-005 green. The 283-construct probe: 0 differ against the Phase-2 build; the 0.16.47 control differs on 212.
- **(b) core-js 3.46.0** (`b630dae`, `2d0ec3f`): from the registry tarballs, 3.47.0 is the first release whose `es.json.stringify` is forced when `JSON.rawJSON` is missing. On Node 18.20.8, after the 52 `core-js/modules/*` the server bundles require, `JSON.stringify` stays native and the replaced builtins equal 3.42.0's. Client: core-js module bodies only; the injected set is the 70 modules of the Phase-2 build (T-004 c6 green); the T-015 ladder is unchanged. 02 and CS-CORE-1 record the hold.
- **(c) CS-SEN-4** (row first `7c54469`, then `36f4ac5`, `6b73772`, `a5b1c21`, `f94c487`): `next.config.js` runs `node_modules/@sentry` of the client compilation through `babel-syntax-loader.js` with preset-env, the `.browserslistrc` targets and `useBuiltIns: false`; `@babel/core` is required only in the client branch, so `next start` loads no Babel. Server bundles identical. T-015 green at `FLOORS['10.2.3']` = ES2015, no AD row. `.next` diff: `pages/_app` (+map) and `500.html`, every changed module under `@sentry`. The `_app` chunk grows 34,373 → 40,540 B gzip (+6,167 B on every route's first load; 179,804 B raw); T-007 within budget. In `next dev` only, the first Babel run raises `Error.stackTraceLimit` from 10 to 50, so the dev overlay requests 17 instead of 14 stack frames per load of one route (no test pins the count).
- **Tests after the merge** (build `e343464ce23af57f`): unit 1,068/1,099, every status as at W5b; static T-003 and T-015 green again, every other red unchanged; chromium + wire 821 passed, 140 failed, 28 did not run, equal to W5b plus the 44 review-fix tests; visual 315 passed on build `9ccdd7af7701f88a` (`36f4ac5`; its `.next` is identical to `e343464ce23af57f`, 183/183), every `diff-pixels` annotation 0 except the informational T-801 c3 `header-colours 225`, as before (the value of the W5b and Phase-2 runs); T-013 4/4 against `e8902fd`.

## 6. Accepted-difference rows (42 §8)

`test/baseline/ACCEPTED-DIFFS.yml` at the jump tip: 47 rows, 40 in force (all kind `product`, ref OD-31), 7 withdrawn. `node scripts/ad-ledger.mjs --base master --offline`: pass. After the owner decisions after jump 1 (§11, 2026-10-29): 49 rows, 42 in force, 7 withdrawn (AD-050, AD-051 added); pass.

**Local signature form, confirmed by the owner on 2026-10-28:** `SIGNED: owner, <YYYY-MM-DD> (<note>)` (D20; `scripts/ad-ledger.mjs` checks the form only: the exact prefix, a real date not in the future, a non-empty note; it never looks anything up). The owner's words: "... confirm the local signature form 'SIGNED: owner, <date> (<note>)'." The GitHub comment form stays for a later CI. Recorded in STATUS §2 and 42 §8.

| Rows | Test, key | Step | Signature (`signedOffBy`) and the owner's words | State |
|---|---|---|---|---|
| AD-001, AD-002 | T-001, `import/prefer-default-export` in the two `hooks/index.js` | W0 | `SIGNED: owner, 2026-10-27 (approved in the work session)`: "I sign AD-001 to AD-005 as proposed in the W0 step: the two T-001 lint counts, the two T-008 floors lowered to >1900, and T-013's reference moving to each dependency merge." | withdrawn 2026-10-28 (the frozen W1 T-001 baseline holds them) |
| AD-003, AD-004 | T-008 c1, the two install floors > 1900 | W0 | as above | withdrawn 2026-10-28 (superseded by AD-010, AD-011) |
| AD-005 | T-013, the reference moves to each dependency step's merge | W0 | as above | in force |
| AD-006 | T-505 c2, one-string title | W0b | `SIGNED: owner, 2026-10-27 (approved in the work session)`: "I sign AD-006 to AD-009 as proposed (T-505 title string, T-610 line numbers, T-008 c4 design spec), and I approve T-610 ignoring line:column numbers in stack frames (function and file names still checked)." | in force |
| AD-007, AD-008 | T-610 c3, server-bundle line numbers | W0, W0b | as above | withdrawn 2026-10-27 (superseded by the frame normaliser) |
| AD-009 | T-008 c4, the tarball spec | W0.5 | as above | withdrawn 2026-10-28 (superseded by AD-040) |
| AD-010, AD-011 | T-008 c1, the two install floors > 1700 | W1 | `SIGNED: owner, 2026-10-28 (approved in the work session)`: "I sign AD-010 and AD-011 as proposed in the W1 step (T-008 c1 floors > 1700)." | in force |
| AD-012, AD-013 | T-120, `utils/sentry.js` exports and `Sentry.init` options | W2a | `SIGNED: owner, 2026-10-28 (approved in the work session)`: the owner's words of §5 | in force |
| AD-014..AD-017 | T-608 c1/c3, listener names and Sentry events after the throw and the rejection | W2a | as above | in force |
| AD-018 | T-004 c1, `client:sentry-packages` | W2a | as above | in force |
| AD-020..AD-027 | the Sentry envelope URL: T-602 c5, T-719 c3, T-720 control, T-716 c3, T-727, T-712 c2, T-730, the T-728 c4 map | W2a | as above | in force |
| AD-028..AD-035 | the LogRocket host and policy: T-116 c2, T-010, T-603 (one composite row of 26 route@via keys), T-720 sweep, T-719 c4/c5, T-702 (8 snapshots), T-729 (13 baselines), the quoted `connect-src` directive (T-716, T-727, T-730) | W2b | as above | in force |
| AD-037 | T-610 c3, the unnamed renderPage frame of the Babel 7.29 regenerator output | W2e | as above | in force |
| AD-038..AD-047 | the vendored design directory: T-417 c1 identity, T-016 c3 and its file sets, T-008 c1/c2/c4 (spec, `--install-links`), T-001 c1 (`lint:css`, hook, directive scope), T-002 and T-418 source scope, T-016 c2/c4 108 modules | W5 | as above | in force |
| AD-048, AD-049 | T-610 c3, the two minified mobx 6.16.1 frame names in the `URIError: URI malformed` stack of `DataProviders.search`: `i.It` -> `i.Kt` (`ComputedValue.computeValue_`), `i.O` -> `i.g` (`ObservableObjectAdministration.getObservablePropValue_`) | W3 (found by the AD batch) | `SIGNED: owner, 2026-10-28 (approved in the work session)`: "I sign AD-048 and AD-049 as proposed (T-610 c3: the mobx 6.16.1 minified frame names i.It -> i.Kt and i.O -> i.g)." | in force |
| AD-050, AD-051 | T-727 (AD-050) and T-730 (AD-051), the quoted `connect-src` directive: AD-035's exact key, `from` and `to` (owner decision 1 after jump 1, §11); no assertion change | W2b | `SIGNED: owner, 2026-10-29 (approved in the work session)`: the owner's words of §11 | in force |

- **Not added:** AD-019 (T-015 floor) and AD-036 (T-003 c1 KaTeX rules), not needed after the owner's decision; their ids stay unused (comments in the ledger).
- **Acceptance change (40 §8 rule 8):** the T-610 c3 stack-frame line:column normaliser, approved by the owner on 2026-10-27 (the words of AD-006..AD-009 above); `SIGNED:` in 40 §1. The 42 §8 key-rule extensions (composite keys (`d8040bf`, AD-030); a Next route source's `(.*)` read as literal text, only right after a route parameter name since `b6058ff` (`78e1342`, `b6058ff`, AD-029); the rows of a recorded e2e baseline applied at comparison (`b13fe11`, with its rules and known answers in `f2fdfd6`; AD-032..AD-034, AD-037, AD-048, AD-049); the per-key rule with its baseline-file exception (`362e233`, its wording in 42 §8 corrected by `7a72eb1`)), signed by the owner as one acceptance change on 2026-10-29 (§11 decision 3; `SIGNED:` in 42 §8, STATUS §2); AD-048/AD-049 keep their label parts; the C1 re-run is due at the midpoint heavy check (§10).
- **Ledger tooling changed with the rows:** the local signature form (`845728b`); a Next route source's `(.*)` read as literal text in a key (`78e1342`, for AD-029); composite keys in the T-603 match (`d8040bf`, AD-030); the rows of a recorded e2e baseline applied at comparison, files never edited (`b13fe11`, AD-032..AD-034, AD-037). Each has its own known-answer tests.
- **AD-048, AD-049** (found by the AD batch, signed after the jump check, applied in `ef2218b`): key `t610-stdout-census.json, mobx frame It` / `… mobx frame O`; from `    at i.It (<build>/node_modules/mobx/dist/mobx.cjs.production.min.js:<line>:<col>)` / `    at i.O (…)`; to `    at i.Kt (…)` / `    at i.g (…)`; reason CS-MOBX-1 (W3). The key names the baseline file for the e2e baseline hook; its second part keeps one row per (test, key) beside AD-037. No tooling change was needed. The other option the owner had, masking the function names of `node_modules/**/*.min.js` frames in the T-610 normaliser, was not taken.

## 7. Whole-jump production tree report

`node scripts/prod-tree-report.mjs --jump jump-1` at the jump tip (exit 0; `--self-test` 5/5). It compares the production `name@version` set of the lock with `upgrade/p2-28-exit` and maps every change to a row of `scripts/prod-tree-rows.json`:

```
production tree upgrade/p2-28-exit -> working tree: 1024 -> 580 name@version, 466 removed, 22 added
  root @babel/runtime: - -> 7.29.10  CS-W0-3 (declared, W0), CS-BAB-9 (7.29.10, W2e)
  root @mdi/svg: - -> 5.9.55  CS-W0-3 (declared at the installed version, W0)
  root @oacore/stylelint-config-base: 1.0.6 -> -  CS-STY-1 (W1)
  root @sentry/browser: 5.30.0 -> 7.120.4  CS-SEN-1 (W2a)
  root @sentry/node: 5.30.0 -> 7.120.4  CS-SEN-1 (W2a)
  root bibtex-parse-js: 0.0.24 -> -  CS-BIB-1 (vendored, W0)
  root core-js: 3.42.0 -> 3.46.0  CS-CORE-1 (W2c; held at 3.46.0 by the owner)
  root filesize: 6.4.0 -> -  CS-W0-2 (W0)
  root i18n-iso-countries: 6.8.0 -> -  CS-I18N-1 (vendored map, W0)
  root logrocket: 10.0.0 -> 12.4.0  CS-LR-1 (W2b)
  root logrocket-react: 6.0.3 -> -  CS-W0-2 (W0)
  root mobx: 6.13.7 -> 6.16.1  CS-MOBX-1 (W3)
  root mobx-react-lite: 3.4.3 -> 4.1.1  CS-MOBX-2 (W3)
  root throttle-debounce: 3.0.1 -> -  CS-W0-2 (W0; the design keeps 3.0.1)
  removed @babel/code-frame@7.27.1 (reached from @oacore/design): CS-BAB-10 (the override pins moved to the 7.29 releases, W2e; consumer: parse-json in the design's cosmiconfig, error paths only)
  removed @babel/helper-validator-identifier@7.27.1 (reached from @oacore/design, next): CS-BAB-10 (W2e; consumers: @babel/code-frame, Next's dev overlay)
  removed @babel/runtime@7.27.3 (reached from @oacore/design): CS-BAB-9 (the root pin, W2e; the design's dependency resolves to it)
  removed body-scroll-lock@3.1.5 (reached from @oacore/design): CS-DSN-5 (W5b)
  removed enquire.js@2.1.6 (reached from @oacore/design): CS-DSN-4 (react-slick's dependency, W5b)
  removed json2mq@0.2.0 (reached from @oacore/design): CS-DSN-4 (react-slick's dependency, W5b)
  removed lodash.debounce@4.0.8 (reached from @oacore/design, bibtex-parse-js): CS-DSN-4 (react-slick's other dependency; stays dev-only for @babel/helper-define-polyfill-provider, W5b)
  removed react-focus-lock@2.13.6 (reached from @oacore/design): 02 §3.7 react-focus-lock (lock only, W2e ea406b0)
  removed react-slick@0.28.1 (reached from @oacore/design): CS-DSN-4 (W5b)
  removed resize-observer-polyfill@1.5.1 (reached from @oacore/design): CS-DSN-4 (react-slick's dependency, W5b)
  removed string-convert@0.2.1 (reached from @oacore/design): CS-DSN-4 (json2mq's dependency, W5b)
  added @babel/code-frame@7.29.7 (reached from @oacore/design): CS-BAB-10 (W2e)
  added @babel/helper-validator-identifier@7.29.7 (reached from @oacore/design, next): CS-BAB-10 (W2e)
  added @babel/runtime@7.29.10 (reached from @babel/runtime, @oacore/design): CS-BAB-9 (W2e)
  added react-focus-lock@2.13.7 (reached from @oacore/design): 02 §3.7 react-focus-lock (lock only, W2e ea406b0)
ok: every change maps to a row
```

The other removed and added items are the trees that came or went with a root row (bibtex-parse-js and its tree, i18n-iso-countries, the W0 removals, the stylelint config subtree, the Sentry 5 and 7 subtrees, `use-sync-external-store` with mobx-react-lite), explained by those rows. katex is not in the report: it is back at its base version 0.16.22.

## 8. Change-site rows added in jump 1

Each new row went into 20 before its code (01 §9): CS-W0-12 (W0), CS-HUS-2 (W1), CS-SEN-3 (W2a), CS-LR-3 (W2b), CS-BAB-10 (W2e), CS-SEN-4 (owner decision). Rows whose text was corrected to the measured result: CS-PCSS-1 (8.5.32), CS-BAB-9 (proof), CS-MOBX-1/-2 (split, `clearTimers()` verify only), CS-DSN-2 (the folder argument of the lock command, J1-W5a-1), CS-PRET-1 (9 files). The `path:line` anchors stay on tree `a825839` (20, Where): CS-PCSS-1 (`package.json:63`), CS-BAB-9 (`package.json:44-51`, `@babel/runtime` new), CS-SEN-4 (`next.config.js:37-44`) and CS-LR-3 (`next.config.js:37-43`) had been written with jump-tree lines (the jump tree has `webpack(config` at line 39, tree `a825839` at 37) and were set back after the close review.

## 9. Deploy-time items added to 20

Recorded in [20](../20-change-sites.md) §Deploy-time items, never applied (D19):

| Item | Added | Needed for the final deploy? |
|---|---|---|
| Design install flag (CS-DSN-2) | W5a | **Needed:** `--install-links` on both commands of `Dockerfile:19` (or `ENV npm_config_install_links=true` before it). Without it `npm ci` stops with EUSAGE and the `\|\| npm install` fallback links the directory instead (a symlink, R-075) and rewrites the lock. A repository `.npmrc` does not work as the recipe stands. |
| Design tarball (CS-DSN-1) | W0.5 | Not needed: `COPY . .` copies `vendor/` before `npm ci`. |
| Husky in the image (CS-W0-6) | W1 (checked) | Not needed: husky 9's `prepare` exits 0 with `HUSKY=0` and without `.git`. |
| Registry token (DV6 (b)) | W1, W5b | Can go with the final deploy (the owner's choice): the lock has no GitHub Packages entry since W1. |

Checked, no new item: the Node base image item already carries CS-W0-5's Dockerfile part (Node 24, jump 2). CS-SEN-4 needs nothing in the image: the single stage copies the whole repository (so `babel-syntax-loader.js` is there) and installs devDependencies (so `@babel/core` and `@babel/preset-env` are there for `npm run build`).

## 10. Fault patches to refresh at the midpoint heavy check

The heavy checks are not due at jump 1 (they run at the midpoint, the end of jump 3, and at GATE-S; 55 §0). 17 of the 72 non-design patches in `test/faults/` fail plain `git apply --check` at the jump tip; all 17 pass `git apply --3way --check` (checked again at `87a39d4`). The heavy check (55 §0 (a)) refreshes each for the same risk and detectors:

| Patch | File(s) | Context moved by |
|---|---|---|
| R-001-a, R-001-b, R-020-a, R-021-a, R-068-a | `next.config.js` | CS-W0b-2, CS-W0b-3, CS-W0b-4, CS-LR-3, CS-SEN-4 |
| R-032-a | `next.config.js`, the lock | as above, and the lock changes of every step |
| R-013-a, R-013-b | `templates/data-provider/pagination.jsx`, `templates/data-providers/result-card.jsx` | CS-N13-1, CS-N13-2 |
| R-069-a | `pages/outputs/[id].jsx`, `pages/works/[id].jsx` | CS-W0b-1 |
| R-026-a | `csp.config.js` | CS-LR-2 (refresh: drop `*.logrocket.com` from the new host set) |
| R-015-a, R-065-a, R-084-a, R-084-b | `package.json`, the lock | W0..W5 (R-084-a was stale before jump 1) |
| R-015-b | the lock | a lock-drift fault that moves core-js 3.42.0 → 3.51.0; the lock now holds 3.46.0, so the refresh drifts a runtime dependency to a version the lock does not hold |
| R-075-a, R-075-b | `package.json` | the design spec is `file:vendor/oacore-design` (CS-DSN-2); R-015-a also patches that line |

Also due there: the C1 re-run that 40 §8 rule 8 asks after the T-610 normaliser and after the 42 §8 key-rule extensions the owner signed as one acceptance change on 2026-10-29 (§11 decision 3: composite keys, the `(.*)` after a route parameter name, the e2e baseline hook, the per-key rule with its baseline-file exception); the C1-Q part is WITHDRAWN in lean mode. `node scripts/run-faults.mjs --validate-only` builds one app tree per fault, so it is not a cheap patch check (about a minute and a gigabyte each).

## 11. Open items

1. **T-610 c3: settled** (2026-10-28). The owner signed AD-048 and AD-049 as proposed ("I sign AD-048 and AD-049 as proposed (T-610 c3: the mobx 6.16.1 minified frame names i.It -> i.Kt and i.O -> i.g)."). They were applied in `ef2218b`. T-610 4/4 twice and `@wire` 28/28 ran on build `e343464ce23af57f` (§1). Nothing is left open here.
2. **Signatures:** the owner signs this record, [W5.md](W5.md) and [phase-2.md](phase-2.md) (owner decision 5 below).
3. **Owner holds to revisit at a later jump:** katex 0.16.23 and later (a pixel AD row, and the math render fixture with `\not`, `\widehat`, aligned/gathered and over/underbrace that 7.2.DU-20 needs as a baseline); core-js 3.47.0 and later (an AD row for the polyfilled `JSON.stringify`; a Node ≥ 21 runtime removes the server part, the browsers keep it).
4. **Re-checks in jump 2:** CS-SEN-4 and CS-LR-3 at W4a (webpack 5; for CS-SEN-4 also its dev-only stack-frame count: in `next dev` the first Babel run raises `Error.stackTraceLimit` from 10 to 50, so the dev overlay requests 17 instead of 14 stack frames per load of one route, and the `/__nextjs_original-stack-frame` count of the T-728 inventory went 126 → 153; no test pins it, §5 (c)), CS-SEN-4 again at every Sentry move (6.8); CS-N11-9 at W4c (with a lint exclusion for the copied page; R-069 applies to its title from W6c).
5. **Fault patches:** the 17 of §10 and the C1 re-run at the midpoint (end of jump 3).
6. **02 §4 has no row** for the two test-tooling strict problems `invalid:@types/react` and `invalid:picomatch` (T-008 pins them apart; J1-W5b-3, Phase-2 open item 3).
7. **`npm audit` still names postcss** through Next's own 8.2.13 and cssnano 4's 7.0.39 copies (W4c, CS-PCSS-4).
8. **After the final deploy (DEFERRED):** the LogRocket recording check (CS-LR-1, T-904 c3), one Sentry test event per DSN on the envelope endpoint (VF-04), T-008's alpine half, T-901's container half, VF-05 (no Docker); the WebKit and Firefox legs (T-724) stay DEFERRED (no browser downloads approved). The T-904 c3 checklist (`test/ops/t904-checklist.json`) still says the policy does not list the logr-in.com hosts, which was true before W2b only: `csp.config.js` lists them since CS-LR-2 (J1-W2b-5). Rewording it is a test-text change (owner decision 4 below); the check itself is unchanged.
9. **Harness notes:** the `wire` project depends on `chromium`, so one red chromium test skips the 28 `@wire` tests in a single call; the T-728 c4 dev inventory flakes under load or machine sleep (`page.goto` timeouts), so it runs alone; `test/setup/jsdom-gaps.js` still names react-slick in a comment (J1-W5b-5); AD-035 names one test for three (one T-id per row; owner decision 1 below); `test/faults/kill-summary.json` keeps the T-016 c3 title of the Phase-2 fault run (a run record; `run-faults` replaces only the entries of the faults it runs, so the title stays until fault R-025-a runs again).
10. **Baselines:** the T-804 c1, T-738 and T-806 baselines are host baselines (darwin), recorded on the W5a build; whether the W1 lint baseline is a B-chain link (42 §9) is the owner's call (the manifest lists it under B0-local; owner decision 2 below).
11. **T-016 c3 verifier reference (harness, J1-W05-3):** `scripts/verify-design-verbatim.mjs` takes the 5.0.74 tarball only from the npm cache, although `vendor/oacore-design-5.0.74.tgz` is in the repository, so on a machine without that cache entry it exits 2. A fallback to the vendored tarball, still checked against the published integrity and sha1 of 60 §1, would remove the dependency.
12. **`scripts/lock-immutable.mjs --json` (harness, J1-W0-4):** it calls `console.log` and then `process.exit`, so on a pipe its JSON can be cut and T-013 reports a parse error instead of its violations (diagnostics only; the verdict is red either way). Setting `process.exitCode` instead would fix it.
13. **Ledger checker, T-603 keys (test tooling, older than the jump):** a T-603 case key `<route>@<via>.<case>/<header>` and the case-free key `<route>@<via>/<header>` of the same header are different strings, so two rows in force with different `to` both pass `checkRows`, and `applyLedger` accepts either (plain keys too). Found by the close fixes; a later test-tooling step closes it.

**Owner decisions after jump 1** (each with its options; the recommended option is (a)):

1. **AD-035, one row for three tests.** The quoted `connect-src` directive changed for T-716 c3, T-727 and T-730, and the owner's signed proposal named all three, but the row has `test: T-716`, so a reader filtering by test id finds no row for T-727 or T-730. (a) Sign two more rows, for T-727 and T-730, with AD-035's exact key, `from` and `to` (append-only, no assertion change; the comments beside the two constants then name the new ids). (b) Accept the one-row form as it is.
2. **The W1 T-001 lint baseline** (`test/baseline/t001-lint-w1.json`, frozen on unchanged code: the findings of the withdrawn AD-001/AD-002 and 6 new typescript-eslint findings, camelcase ×3 and no-use-before-define ×3). 42 §9 has the owner sign a tool re-capture link. (a) Sign it as a tool link of the B chain (STATUS §1: kind tool, same reference, new baselines). (b) Keep it under B0-local as recorded, with 41 T-001's planned new-tool baseline as its authority.
3. **The ledger key-rule extensions as an acceptance change (40 §8 rule 8).** None carries an owner signature as an acceptance change: composite keys (`d8040bf`, AD-030); a Next route source's `(.*)` read as literal text (`78e1342`, AD-029; only after a parameter name since the polish); the rows of a recorded e2e baseline applied at comparison (`b13fe11`, AD-032..AD-034, AD-037, AD-048, AD-049; its rules in `e2e/lib/P0-10/ledger-rows.mjs` since `f2fdfd6`); and the close fixes' per-key rule with its baseline-file exception (`362e233`: one row per (test, key) for each key a composite key lists; two rows may list one `<name>.json` key only when their literals do not overlap). AD-048/AD-049 keep the label part of their keys (`… mobx frame It`, `… mobx frame O`). (a) Sign the extensions as one acceptance change (a STATUS §2 row; their C1 re-run is due at the midpoint heavy check, §10) and keep the AD-048/AD-049 labels. (b) The same, plus plain keys for AD-048/AD-049 (`t610-stdout-census.json`, withdraw both and re-add them with the same `from`/`to`). This is not possible as the checker stands: its whole-key guard refuses a second T-610 row whose whole key equals AD-037's `t610-stdout-census.json`, ahead of the baseline-file exception. It needs one more guard change (the exception applied to equal whole keys), which is itself part of the acceptance change. (c) Refuse them: the rows that rely on them (AD-029, AD-030, AD-032..AD-034, AD-037, AD-048, AD-049) then accept nothing, their tests go red, and jump 1 reopens.
4. **The T-904 c3 checklist text** (item 8). (a) Reword the expect line to say that the policy lists the logr-in.com hosts since W2b (CS-LR-2, R-026); a test-text change, the check is unchanged. (b) Keep the text as it is.
5. **Signatures** (item 2): [phase-2.md](phase-2.md), [W5.md](W5.md) and this record. (a) Sign the three as they stand, with decisions 1 to 4 beside them. (b) Return any of them with changes.

## 12. Next

Jump 2 ([50](../50-roadmap.md) §4.0 row 2: W4a–W4e and CS-N12-9): webpack 5, Next 12.1.6 then 12.3.7, the runtime Node 24 for the local builds and Jest, and the app-side `_next/data` fix instead of the gateway rule. **Awaiting the owner's go-ahead.** It starts on a branch `upgrade/jump2-<slug>` from the jump-1 tip (01 §10).
