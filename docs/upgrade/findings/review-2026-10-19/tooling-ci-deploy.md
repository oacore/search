# Review: tooling, build, CI/CD, Docker, Kubernetes/gateway, env/config, lint baselines (key `tooling-ci-deploy`)

Reviewer scope: `findings/05`, `20` (W0, LINT, PRET, STY, HUS, NRA, PCSS, NODE), `40` §2.5/§6/§7/§8, `50`, `90`, Dockerfile, `.github/**`, `kube/**`, configs, lint baselines. Date 2026-10-19. Nothing inside the search/dashboard/design/core-ui repos was modified (`git status` clean at the end). All experiments live under `<scratch>/exp/tooling-ci-deploy/` (section 9).

Notation: CONFIRMED = reproduced here with a command or API response. UNCONFIRMED = could not be checked. "Siblings" = the other reviewers' reports in this folder; where they already raise the same point I say so and add only new evidence.

---

## 0. Verdict

The docs are mostly right on what exists in the repo (Dockerfile, probes, gateway rules, lint counts all reproduce). They are wrong or unexecutable in these places, all verified:

1. **Deploy mechanics.** The nightly cron does not roll anything out for an unchanged SHA (step "Wait for rollout" = 0 s on every nightly vs 105 s on pushes). The stage cron deploys `main` over any wave branch. Prod can be dispatched from any branch (a `Validate-page` branch run went to prod on 2026-10-01). The S gate ("two clean nightly cycles", "24 h soak incl. nightly rebuild") cannot be executed as written. (TCD-01, TCD-02)
2. **The plan's own recommendations create silent prod failures**: the Docker layer split in 05 §5.1 makes the design package's `postinstall` generate `iconsPublicPath=/icons.svg`, which the gateway does not route (proved); test files planned under `pages/` break `next build` (proved); test directories planned at `test/build/` and `data/__tests__/` are git-ignored (proved). (TCD-03, 04, 05)
3. **Tool targets are stale against today's registry**: ESLint 9.39.5 is already deprecated ("no longer supported"), latest is 10.13.0; stylelint latest is 17.16.0; lint-staged 17 needs Node >=22.22.1; TypeScript latest 7.0.2 has no classic JS API and typescript-eslint does not accept it. `@babel/eslint-parser@7` crashes on ESLint 10 (proved) so the W1 design (ESLint 9 + Babel parser) is a dead end; a working ESLint 10 setup exists (typescript-eslint parser, 155/157 files parse, 2 trivial exceptions). (TCD-06..08, 16)
4. **The CI plan (G1-G7) is feasible** on GitHub-hosted `ubuntu-24.04-arm` (free and 4 vCPU/16 GB for public repos), but needs the structure in section 6: one build recipe (the Dockerfile) shared by build/e2e/deploy, a single aggregator required check, arm64-only pixel baselines, Playwright in a digest-pinned container started with `docker run` (not as a job container), and the golden image stored in a private registry the PR jobs can pull. (TCD-10..12, 27)
5. A rigorous, measurable lint gate exists without lint-zero: ESLint's built-in **bulk suppressions** (verified exit codes) for JS, a small ratchet script for stylelint. (TCD-14)

Measured baselines worth recording: lint 13/16 reproduces byte-identical on Node 18 and 24; production `next build` takes 19 s locally and the whole CI Docker build+push takes ~80 s (median 2.2 min per workflow run), so a full image build on every PR is cheap.

---

## 1. Claims ledger (doc claim -> verdict)

| Doc claim | Verdict | Evidence |
|---|---|---|
| 05 §0.1 `npm run lint` fails: ESLint 13, stylelint 16, prettier-json clean | CONFIRMED, identical | Re-ran ESLint 7.32 / stylelint 13.13 / prettier 2.8.8 from the repo's `node_modules` on Node 18.20.8 and 24.18.1 writing JSON to scratch. After path normalisation (baseline has `<sandbox-root>/search/` prefixes) the (file, rule, line) sets equal the committed baselines. Exits: eslint 1, stylelint 2, prettier-json 0 |
| 05 §0.2 husky is a no-op, no PR trigger | CONFIRMED for `main`. Note: a PR-check workflow existed until 2025-04-16 (`git log --diff-filter=D -- .github`) and still exists on stale `master` | `origin/master:.github/workflows/pull-request-check.yml` (Node 12) |
| 05 §5.2 nightly "rebuilds main and redeploys" | **PARTLY WRONG**: builds+pushes, does not roll out | TCD-01 |
| 05 §5.2 cron 03:00 prod / 04:00 stage | Nominal only. Observed start 06-10 UTC recently (GitHub delays); 12-day gap 2026-10-02..12 with no scheduled run | API: runs list |
| 05 §5.1 `NPM_TOKEN` in image history | CONFIRMED and worse: the `.npmrc` written at `Dockerfile:18` is committed into that layer; the `rm` at `:20` only whiteouts it | layer semantics; `docker history` also shows the build arg |
| 05 §5.1 "single stage, no `.dockerignore`" | CONFIRMED | `ls -a` |
| 05 §5.3 probes `/api/healthz/`, port 8080, gateway rules | CONFIRMED live on `stg.core.ac.uk`: `/search/_next/data/<buildId>/search.json?q=climate` = 200 JSON; root `/_next/data/...` = 404; `/static/search/_next/static/chunks/framework.*.js` = 200 `public, max-age=31536000, immutable` | curl, TCD-22 |
| 05 §5.4(3) post-deploy `curl -f https://core.ac.uk/...` | **UNRELIABLE for prod**: Cloudflare managed challenge (`HTTP/2 403`, `cf-mitigated: challenge`) for non-browser clients; `stg.core.ac.uk` returns 200 | TCD-21 |
| 05 §2.4 Prettier 3 diff "unmeasured" | **MEASURED**: 8 files, trivial | TCD-17 |
| 05 §3/20 CS-N11-4 "[VERIFY] does the build emit `.map`" | **YES** | TCD-23 |
| 20 CS-W0-4 "[VERIFY] does `npm ci` succeed today" | lock and package.json are in sync; `npm ci --dry-run` passes on npm 10.8.2/Node 18 with and without `--legacy-peer-deps`; download itself untested | TCD-19 |
| 20 CS-LINT-1 ESLint 9 + `@babel/eslint-parser` | **WRONG TARGET** | TCD-06 |
| 20 CS-STY-1 stylelint 16 + `stylelint-config-standard` | wrong target; config-standard@40 peers stylelint ^17 only | TCD-07 |
| 20 CS-W0-5 `.nvmrc` = Docker Node | **UNEXECUTABLE** with latest tools | TCD-08 |
| 40 §8 G3 `build:test` artifact feeds G4 | **DIVERGES from prod build** | TCD-10 |
| 40 §2.1/2.2 tests in `pages/__tests__`, `test/build/`, `data/__tests__/` | **BROKEN** (build failure / git-ignored) | TCD-04, 05 |
| README "origin/HEAD -> master" (task text) | local `origin/HEAD` is a stale cache; GitHub default branch is `main` | `git ls-remote --symref origin HEAD` = `refs/heads/main`; API `default_branch: main` |
| 05 stylelint error list "`templates/output/styles.module.css:150,167,174,177`" | mislabelled: those four are in `templates/search/styles.module.css` (baseline JSON) | baseline |

---

## 2. Findings

Severity: critical = plan cannot work / silent prod impact; high = would fail or silently regress during execution; medium = gap; low = hygiene.

### TCD-01 (critical, process-gap) Nightly "rebuild + redeploy" is a build canary, not a rollout; tags are mutable
- **Evidence.** `aks_deploy.yml:38-41` tag = `<sha7>-prod`; `kube/prod/deployment.yaml:38-39` `image: ${IMAGE}`, `imagePullPolicy: IfNotPresent`. Job steps via API: nightly run 39222460000 (2026-10-19, sha `cc0e228`): "Docker build and push 190 s", "Deploy to AKS 1 s", **"Wait for rollout 0 s"**; nightly 38380308924 (2026-10-13): also 0 s. Push runs 36847641957 and 36841171272 (2026-10-01): 105 s and 106 s. All 7 nightly runs 10-13..10-19 are on `cc0e228`.
- **Mechanism.** The same SHA yields the same image string, so `kubectl apply --server-side` changes nothing, no new ReplicaSet. A new image is pushed under the same tag; pods on nodes that already cached it keep the old one (IfNotPresent); HPA scale-ups on fresh nodes pull the new one. So the fleet can be heterogeneous.
- **Impact on the plan.** README §1 and 05 §5.2 ("rebuilt nightly", "this is how data gets refreshed") are wrong about the deploy. 40 §3.3 / 50 §4 step 6 / gate S ("24 h soak incl. a nightly rebuild", "two clean nightly cycles on staging") cannot observe a changed pod. G6's premise ("a data refresh could ship a regression silently") is not how it fails; it fails via new nodes. 50 §4 rollback "re-run the deploy workflow on the previous commit" rebuilds from source (not the same artifact); "previous image digest" is not what the workflow deploys (it deploys by tag).
- **Do not "fix" blindly.** Making nightly roll out would make the statistics/members cache refresh visible nightly: a behaviour change (D1).
- **Recommendation.** Record as a PRESERVE ops quirk in 30. Deploy immutable references (`<sha7>-prod-<run_id>` tag, or `image@sha256:<digest>` from `build-push-action` output). Redefine the nightly gate as "build health canary" and the soak as "pinned digest for 24 h + synthetic load". Owner decides separately whether nightly should ever roll out. (Siblings roadmap-process RP-02 and test-strategy F-16 say the same; this adds the step-timing proof.)
- docs: `README.md` §1, `30-quirks-register.md` (new), `40-test-strategy.md` §3.3/§8 G6, `50-roadmap.md` §4/gate S, `findings/05` (errata)

### TCD-02 (critical, process-gap) Stage cron overwrites wave branches; prod can be deployed from any branch
- **Evidence.** `aks_stage_deploy.yml:3-8` triggers: push `stage`, cron, dispatch. Scheduled workflows run only on the default branch's last commit ([GitHub docs, `schedule`](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows)). API: 83 stage schedule runs, all `head_branch=main`; 9 stage `workflow_dispatch` runs on branches `CORE-5662-baner`, `CORE-dummy-test-api`, `CORE-update-footer-v`. **Prod**: run 36846249476 `workflow_dispatch` with `head_branch=Validate-page` succeeded (2026-10-01 09:59), 13 min before a `main` push redeployed. Neither workflow has an `if:` ref guard; both use environment `azure`. The legacy `origin/master:.github/workflows/prod-stg-deploy.yml` had `ALLOWED_PROD_BRANCH` freeze logic (precedent).
- **Impact.** A wave deployed to stage via push to `stage` or dispatch is replaced by `main` at the next cron (within ~24 h). The soak in 50 §4 cannot cover a full day. A wave PR can be dispatched to prod by mistake; G7 branch protection does not stop `workflow_dispatch`.
- **Recommendation (ops PR, phase 2).** Stage workflow: `actions/checkout` with `ref: ${{ github.event_name == 'schedule' && 'stage' || github.ref }}`. Prod workflow: job-level `if: github.ref == 'refs/heads/main'`. Add `concurrency` (TCD-26). Optional later: separate environments `azure-prod`/`azure-stage` (needs a new Entra federated credential per environment subject: UNCONFIRMED who owns that).
- docs: `50-roadmap.md` §4, `40-test-strategy.md` §8 G6/G7, `90-open-decisions.md` OD-29, `README.md` §8 (branch policy)

### TCD-03 (high, missing-risk) The Docker layer-split recommended in 05 §5.1 silently breaks every icon
- **Evidence.** `node_modules/@oacore/design/package.json:94` `"postinstall": "node bin build"` regenerates `lib/config.js`. `bin/config.js:74-84` finds the consumer's `design.config.js` by walking up from the CLI's own directory. Experiment (copy of the installed package in scratch, `NODE_PATH` to the repo modules):
  - no `design.config.js` at the project root -> `publicPath: "/"`, `iconsPublicPath: "/icons.svg"`;
  - with root `design.config.js` -> `publicPath: "/static/search"`, `iconsPublicPath: "/static/search/icons.svg"`.
  The pristine tarball (`npm pack @oacore/design@5.0.74`) ships `lib/config.js` with `'/'` and `'/icons.svg'`. The gateway only forwards `/search /works /outputs /data-providers /static/search /display` (`kube/prod/httproute.yaml`), so `/icons.svg` is a 404 at core.ac.uk: icons vanish with no build error.
- 05 §5.1 recommends "Split `COPY package*.json` -> install -> `COPY .`". Following it literally triggers case A. Same hazard: `npm ci --ignore-scripts` (05:222 calls it "fine for CI"), a restored `node_modules` cache, pnpm (OD-06 mentions only part of it).
- **Recommendation.** CS-W0 new row: any layered Dockerfile must `COPY package.json package-lock.json design.config.js ./` before `npm ci`. Forbid `--ignore-scripts` and node_modules caching in CI (use only the npm download cache). Add a static test: after install `grep '"/static/search/icons.svg"' node_modules/@oacore/design/lib/config.js` in CI and inside the image (T-005 only checks rendered sprites). W5 must vendor the generated file (60 point 8 already says so).
- docs: `20-change-sites.md` (new CS-W0-7), `40-test-strategy.md` T-005/T-008, `findings/05` §5.1 (errata)

### TCD-04 (high, missing-risk) Tests under `pages/` break `next build` (and would otherwise become public routes)
- **Evidence.** Experiment on a copy of HEAD with the real `node_modules` (Node 18.20.8, Next 10.2.3): adding `pages/__tests__/smoke.test.js` makes `next build` die at "Collecting page data": `ReferenceError: describe is not defined`. Removing it: build succeeds in 18.8 s. 40 §2.1 row F lists `pages/__tests__/`; §2.2 `testMatch` includes `pages`; layer E globs `pages/**/*.test.jsx`.
- **Recommendation.** All tests for pages live in `test/pages/**` (outside `pages/`), including API route tests. Add a CI check "no `*.test.*` under `pages/`".
- docs: `40-test-strategy.md` §2.1, §2.2, §4

### TCD-05 (high, missing-risk) `.gitignore` swallows planned test directories and hides `data/data-loader.js` from the linters
- **Evidence.** `git check-ignore --no-index -v`: `test/build/x.js` <- `.gitignore:7 build`; `data/__tests__/x.test.js` <- `.gitignore:16 data/*`. The negations `!data/.gitkeep` and `!data/languages.json` are on lines 14-15, **before** `data/*`, so they do nothing (those files are tracked only because they were force-added). Because lint scripts use `--ignore-path .gitignore`, ESLint lints 156 of 157 tracked JS files: `data/data-loader.js` is skipped (baseline file list vs `git ls-files`).
- **Impact.** New tests in those dirs are silently not committed (`git add -A` skips ignored paths); CI then runs fewer tests than the author did. A flat-config `ignores` that "replicates .gitignore" must keep `data/**` ignored, otherwise `data-loader.js` produces new findings and breaks lint parity.
- **Recommendation.** Use `test/static/` and `test/unit/data/`. Do not edit `.gitignore` during W1. Add a CI step: `git ls-files --others --ignored --exclude-standard -- test e2e | grep . && exit 1`.
- docs: `40-test-strategy.md` §2.1, §2.2, `20-change-sites.md` CS-LINT-3

### TCD-06 (high, version-target) ESLint: target 10.13.0, not 9; the Babel parser path is a dead end; a working path exists
- **Evidence (all run in scratch).**
  - `npm view eslint@9.39.5 deprecated` -> "This version is no longer supported". Latest `eslint` = 10.13.0 (`engines ^20.19 || ^22.13 || >=24`).
  - ESLint 10.13.0 + `@babel/eslint-parser@7.29.9` (peer `eslint ^7.5 || ^8 || ^9`): **every file** fails with `TypeError: scopeManager.addGlobals is not a function`. `@babel/eslint-parser@8.0.7` needs `@babel/core ^8` and Node `^22.18 || >=24.11`; a straight port parsed with 90 fatal errors (UNCONFIRMED whether solvable with parser options).
  - ESLint 10.13.0 + `typescript-eslint@8.71.2` parser (+ `typescript@5.9.3`): **every app file parses except two** (159 files were linted, including 2 scratch config files), including `store/filters.js` with 26 MobX decorators and all JSX. The only parse errors are the two `export X from` files (`templates/output/hooks/index.js:1`, `templates/data-providers/hooks/index.js:1`).
  - Plugin peers exclude ESLint 10: `eslint-plugin-react@7.37.5` (^9.7, last release 2025-04-03), `eslint-plugin-jsx-a11y@6.10.2` (^9), `eslint-plugin-import@2.32.0` (^9). `eslint-plugin-import-x@4.17.1` and `eslint-plugin-react-hooks@7.1.1` support 10. Runtime: of 245 enabled baseline rules, 243 load on ESLint 10; `react/jsx-filename-extension` throws `context.getFilename is not a function`; `import/no-cycle` option `disableScc` is unknown to import-x. A full run over all 161 files completed with no other plugin crash.
- **Recommendation.** W1 = ESLint 10.13 flat config, parser `typescript-eslint` (also the end-state parser for phase 6), plugins `import-x` registered under the key `import`, `jsx-a11y`, `react` (disable `jsx-filename-extension`; evaluate `@eslint-react/eslint-plugin@5.28.2`, peers `*`), `react-hooks@7.1.1` with only `rules-of-hooks`. Move CS-BAB-3 (the two `export X from` rewrites, behaviour-neutral under Babel) into W0 so lint needs no exception (or add those two files to a lint `ignores` with a comment). Update OD-15 question 3: "ESLint 10 now". Keep `@babel/eslint-parser` out.
- docs: `20-change-sites.md` CS-LINT-1/CS-BAB-3, `90-open-decisions.md` OD-15 Q3/OD-05 text, `50-roadmap.md` W1, `README.md` §3 table, `10-risk-register.md` R-060 (wave)

### TCD-07 (high, version-target) stylelint: target 17.16.0; port rules explicitly, do not adopt `stylelint-config-standard` wholesale
- **Evidence.** Latest `stylelint` 17.16.0 (`>=20.19.0`). `stylelint-config-standard@40.0.0` peers `stylelint ^17.0.0` only (the 16-compatible one is @39). Port test: of the 77 enabled rules in `stylelint-resolved-config.json`, 61 are valid on stylelint 17 (16 removed stylistic rules such as `at-rule-name-space-after`, `declaration-bang-space-*`); running them on the 28 CSS files gives `order/properties-order` 7, `selector-class-pattern` 4, `prettier/prettier` 4, `shorthand-property-no-redundant-values` 1 (= the 16 baseline findings) plus 1 new (`value-keyword-case`). `stylelint-config-standard@40` + css-modules instead yields 34 findings (including `alpha-value-notation`, `color-function-notation` whose `--fix` rewrites colour syntax).
- **Recommendation.** CS-STY-1 target 17.16.0 with `stylelint-order@8.1.2`, `stylelint-config-css-modules@4.6.0`, `stylelint-prettier@5.0.3` and the 61 explicit rules (generated from the baseline JSON). Never run `--fix` (R-049; also changes bytes of the CSS the T-003 snapshot hashes). New baseline = 17 findings, frozen as a ratchet (TCD-14).
- docs: `20-change-sites.md` CS-STY-1, `findings/05` §2.4

### TCD-08 (high, version-target) Node floors of the latest tooling vs `.nvmrc`/`engines`/CI plan
- **Evidence (`npm view <pkg> engines.node`, 2026-10-19).** eslint 10.13.0 `^20.19||^22.13||>=24`; stylelint 17.16.0 `>=20.19`; lint-staged 17.6.0 `>=22.22.1` (16.4.0 `>=20.17`; dashboard uses ^16.3.1); npm-run-all2 9.0.3 `^22.22.2||^24.15||>=26` (8.0.4 `^20.5||>=22`); `@playwright/test` 1.64.1 `>=20`; `@axe-core/playwright` 4.14.0 `>=22.12`; msw 3.0.3 `>=22.12`; `@babel/eslint-parser` 8.0.7 `^22.18||>=24.11`. nodejs.org: v18 EOL (last 18.20.8), v20 EOL (Mar 2026), v22 LTS, v24 LTS, v26 Current.
- **Conflict.** CS-W0-5 sets `.nvmrc` = Docker Node (18) and 40 §2.2 uses "Node = the wave's Node" for G1/G2; `npm run lint` and the pre-commit hook then cannot run on the app's Node during W0-W4. CS-NRA-1 says `npm-run-all2` "drop-in" without a version: v9 would force Node >=22.22.2 for every `npm run lint`.
- **Recommendation.** Separate concerns: app runtime Node (Dockerfile `ARG NODE_VERSION`, 18 -> 22/24) vs tooling Node (`.nvmrc` = 24 for dev and for lint/unit/e2e runner jobs). Declare tooling floor with `devEngines` (npm >=10.9) and keep `engines` for runtime. Pin `lint-staged@17.6.0` only if the floor is 22.22.1 (document), else 16.4.0 with an M1 note. Replace `run-p` by plain npm scripts or `npm-run-all2@9` on Node 24 only. Webpack 4 still builds on Node 24 locally with `--openssl-legacy-provider` (md4 verified on 18/22/24) but baselines must come from the Docker/CI Node 18 image.
- docs: `20-change-sites.md` CS-W0-5, CS-NRA-1, CS-HUS-1, `40-test-strategy.md` §2.2/§2.7, `50-roadmap.md` W1

### TCD-09 (high, process-gap) Adding Jest/Playwright/axe/msw to the root `package.json` changes what the production Docker build installs
- **Evidence.** `Dockerfile:19` installs all devDependencies (`--include=dev`) because `next build` needs babel/postcss tooling that is declared as devDependencies. Added test tools bring `engines` above the Node 18 image (Playwright >=20, axe >=22.12; npm only warns), msw 2.14.x has a `postinstall` (`node -e "import('./config/scripts/postinstall.js')..."`), and every added package enters the one lockfile. 40 §6.1's proof ("`.next/static` hashes identical") is indirect.
- **Recommendation.** Put Playwright + axe in `e2e/package.json` with its own lock (never installed by the Dockerfile). Jest/RTL/MSW may stay in root. Replace/extend the proof with a mechanical **lock immutability check**: every key present in the baseline `package-lock.json` `packages` keeps identical `version`, `resolved`, `integrity` (script `scripts/lock-immutable.mjs`, run in CI). This catches hoisting changes that hash comparison could miss.
- docs: `40-test-strategy.md` §2.7/§6.1, `20-change-sites.md` (new CS-P2 rows), `10-risk-register.md` R-015/R-054 detectors

### TCD-10 (high, process-gap) G3 -> G4 tests a different artifact than production builds
- **Evidence.** 40 §2.5: `build:test` = `design build icons && next build`; 40 §8 G4 "needs G3 artifact". Production does more: `Dockerfile:24-27` runs `npm run build && cp public/design/icons.svg public/icons.svg && mkdir -p public/images && cp -r public/static/images/* public/images/` and the postinstall `lib/config.js` (TCD-03). In the proxy of 40 §2.5 (everything outside the gateway prefixes is a 404) the sprite at `/static/search/icons.svg` -> `/icons.svg` would 404 unless `public/icons.svg` exists, so screenshots would be captured without icons, or the baseline would be recorded on an artifact that differs from prod. 40 §6.2 builds the golden image from "the production Dockerfile" but its `npm run build` runs `data/data-loader.js` against the live prod API (`package.json:76`), contradicting the frozen snapshot of §7.4.
- **Recommendation.** One build recipe = the Dockerfile, parameterised: `ARG BUILD_SCRIPT=build` (test: `build:test`), data snapshot placed into `data/` before `docker build` (and `.dockerignore` keeping `test/`, `e2e/`, `docs/` out of the image). G3/G5 merge into one job "image"; static checks T-002..T-010 read `.next` from the image (`docker create` + `docker cp`); e2e starts that image.
- docs: `40-test-strategy.md` §2.5/§6.2/§8, `20-change-sites.md` (new CS rows for Dockerfile args)

### TCD-11 (high, process-gap) Golden baseline image: build hygiene, source commit, storage and CI access
- **Evidence and gaps.**
  - No `.dockerignore`; `COPY . .` (`Dockerfile:17`) copies a developer's `.npmrc`/`.env`, a stale `.next` (05 §5.1 measured 489 MB), macOS `node_modules`, `.git`, `.idea`, and (after phase 2) `test/` and `e2e/__baselines__/*.png`. A golden image built on a laptop is not reproducible and can embed tokens. `NPM_TOKEN` is a build ARG and the written `.npmrc` stays in layer 18.
  - Base `node:18-alpine` floats; `apk`/Docker Hub drift. CS-NODE-1 only pins for Node 22.
  - **Source commit.** `f5cfc20` is a local-only merge commit (local `main` is 27 tree-identical merge commits ahead of `origin/main`; `git diff --stat cc0e228 f5cfc20` is empty). The commit prod actually builds is `cc0e228`. Tag `upgrade-baseline` on `cc0e228`, not on `f5cfc20`.
  - **Storage/access.** "pushed as `search:baseline-<sha>-<arch>`" has no registry. The image contains the private `@oacore/design` sources (`node_modules/@oacore/design/src`), so not a public registry. PR jobs authenticate to Azure by OIDC with a subject tied to the `azure` environment (`environment: azure`, `id-token: write`), so pulling from ACR in a PR job needs a new federated credential (UNCONFIRMED); GHCR private with `packages: read` works with `GITHUB_TOKEN`.
- **Recommendation.** First phase-2 PR (inert): `.dockerignore`, BuildKit secret for the token, base image by digest. Build the golden image in CI (`workflow_dispatch`) from a clean checkout of `cc0e228`, push to GHCR (private) and mirror to ACR, record digests in README, never rely on rebuilding it. arm64 only (TCD-12).
- docs: `40-test-strategy.md` §6.2, `README.md` §8, `50-roadmap.md` §3, `20-change-sites.md` CS-W0

### TCD-12 (high, missing-risk) Pixel determinism: architecture, fonts, runner, proof
(Corroborated by test-strategy F-12; new evidence below.)
- **Fonts.** `node_modules/@oacore/design/lib/foundation/type.css:3-11`: `roboto, -apple-system, blinkmacsystemfont, "Segoe UI", "Helvetica Neue", arial, "Noto Sans", sans-serif`. There is no `@font-face` for it and `main/head.jsx` links no web font, so text is rendered with whatever the container's fontconfig resolves. The baseline therefore depends on the exact font set of the Playwright image, not on any real user's font.
- **Architecture.** Prod is arm64 (`--platform linux/arm64` on `ubuntu-24.04-arm`). 40 §6.2 plans amd64 **and** arm64 golden images; amd64 on the arm runner needs QEMU (webpack 4 + 1760 packages: slow/flaky), and doubles baselines for no prod benefit. Playwright's own docs say screenshots must be compared in the environment where the baselines were created, because rendering depends on OS, browser version, settings and hardware ([docs](https://playwright.dev/docs/test-snapshots)). MCR publishes `v1.64.1-noble`, `-noble-arm64`, `-noble-amd64` (tags list + manifest: two platforms).
- **Runner.** GitHub-hosted `ubuntu-24.04-arm`: public repos = 4 CPU, 16 GB, free and unlimited ([docs](https://docs.github.com/en/actions/reference/runners/github-hosted-runners)).
- **Recommendation.** Fix linux/arm64 everywhere, pin the Playwright image by digest in a derived image that adds a pinned font set, and record `fc-match` for each family of the stack (`roboto`, `arial`, `"Noto Sans"`, `sans-serif`) into `test/baseline/env.json`. Before freezing, run a **determinism soak**: capture on CI 10 times across several days and on one dev Mac (Docker Desktop arm64); all byte-identical or move all captures to CI only (`baseline-capture.yml`, workflow_dispatch, artifact -> PR). Add a nightly **golden canary** (section 6) that runs the suite against the golden image and must stay green: it separates environment drift from regressions (triage step 40 §9.1 automated). For gate S use an **A/B job**: golden and candidate containers run side by side in the same job, same Playwright container, and the diff is computed directly between the two PNG sets, removing committed-baseline drift.
- docs: `40-test-strategy.md` §2.5/§6.2/§7.5/§8, `README.md` glossary

### TCD-13 (medium, process-gap) Phase-2 test files make today's linters red; `lint:json` will choke on fixtures; baseline JSON uses sandbox paths
- **Evidence.** `.eslintrc.yml` has no jest/playwright env or `import/no-extraneous-dependencies` override, so `describe`/`expect` etc. are `no-undef` and test imports are flagged in the first test PR, turning G1 ("no new findings") red before any real regression. `lint:json` = `prettier --ignore-path .gitignore --check '**/*.json'` (`package.json:78`) would scan hundreds of fixture/baseline JSON files (`test/fixtures/api/**`, `e2e/__baselines__/**`, `npm ls --all --json` output); with an explicit `--ignore-path` Prettier does not read `.prettierignore`. The committed ESLint/stylelint baselines contain `<sandbox-root>/search/...` absolute paths, so a naive diff always fails.
- **Recommendation.** Phase-2 PR 1 adds `overrides` for `test/**`, `e2e/**` to `.eslintrc.yml`, a `.prettierignore` plus `--ignore-path .prettierignore --ignore-path .gitignore`, and `scripts/lint-parity.mjs` that normalises paths and compares (relative path, rule, count) to the frozen baselines. Fixture recorders must emit Prettier-clean JSON.
- docs: `40-test-strategy.md` §8 G1, §2.4, `20-change-sites.md` CS-LINT-3

### TCD-14 (medium, process-gap) How the lint gate works while lint is red (verified design)
- **ESLint (W1 on).** Use ESLint's built-in bulk suppressions ([docs](https://eslint.org/docs/latest/use/suppressions)): `eslint . --suppress-all` writes `eslint-suppressions.json` (per file, per rule, **counts**, no line numbers). Verified on ESLint 10.13 in scratch: baseline run exit 0; a new violation -> exit 1; shifting lines of a suppressed violation -> exit 0; fixing a suppressed violation -> exit 2 ("suppressions left that do not occur anymore", resolve with `--prune-suppressions`). Only rules at `error` are suppressed; unused-disable-directive reports stay (they are warnings). Renames/moves (W5 vendoring) need `--prune-suppressions` + re-suppress in the same PR.
- **Why not inline disables (CS-LINT-2 as written).** The five `// eslint-disable-next-line react-hooks/rules-of-hooks` comments edit source files; the suppression file keeps app code byte-identical. Record the Q-047 mapping (which suppression is which quirk) in `30-quirks-register.md` instead of in code. (For CSS, comments survive `cssnano discardComments:false` into the shipped CSS: do not use `stylelint-disable` comments.)
- **stylelint.** No built-in equivalent: `scripts/stylelint-ratchet.mjs` runs `stylelint -f json`, normalises paths, compares multiset (rel path, rule, count) to `test/baseline/stylelint-ratchet.json` (17 findings after TCD-07), exit 1 on any increase, exit 2 on stale entries.
- **Prettier** has no baseline: make it clean once in the format-only commit (8 files, TCD-17) and gate with `prettier --check`.
- **Phase 2 (old tools).** Gate = `lint-parity.mjs` against the committed baselines, which reproduce exactly on Node 18 and 24 (section 1).
- **Parity is not 1:1 across tool generations**: a faithful port of the 245 rules to ESLint 10 + typescript-eslint reports, outside noise from missing deps in scratch, `no-console` 5, `no-unused-vars` 5 (baseline 1), `camelcase` 3, `no-use-before-define` 3, `max-len` 2, `no-irregular-whitespace` 2, `import/no-named-as-default` 1, `class-methods-use-this` 1. So 50 W1's "capture the new baseline from the new tools on unchanged code, then freeze" is correct, and 05 §2.4's "same 13 errors or fewer" is not achievable.
- docs: `40-test-strategy.md` T-001/§8 G1, `20-change-sites.md` CS-LINT-2/4, `90-open-decisions.md` OD-15

### TCD-15 (medium, missing-change-site) Existing 38 inline `eslint-disable` comments constrain the rule set and plugin names
- **Evidence.** `grep` finds 38 `eslint-disable*` comments naming `consistent-return` (6), `camelcase` (5), `no-nested-ternary` (3), `class-methods-use-this` (2), `react/no-danger` (2), `prefer-const` (2), `import/prefer-default-export`, `import/no-mutable-exports`, `jsx-a11y/*` (3), `max-len`, `no-console` (6) etc. With only `@eslint/js` recommended + the ~20 custom `@oacore` rules from 05 §2.2, 13+ of them become "Unused eslint-disable directive" (27 warnings in my run), and registering import-x under the key `import-x` would make `import/...` directives "rule not found".
- **Recommendation.** Generate the flat config's `rules` from `findings/baselines/eslint-resolved-config.jsx.json` (script, 243/245 load; fix the two exceptions), register import-x as `import`, keep `linterOptions.reportUnusedDisableDirectives: 'error'`. Dropping airbnb strictness is then an explicit later decision, not a side effect of W1.
- docs: `20-change-sites.md` CS-LINT-1

### TCD-16 (medium, version-target) TypeScript: latest is 7.0.2 but unusable with typescript-eslint; target 6.0.3 for the TS phase
- **Evidence.** `npm view typescript@7.0.2`: `bin: tsc`, `exports["."] = ./lib/version.cjs` plus `unstable/*` entries; no classic compiler API (`typescript@6.0.3` still has `main: ./lib/typescript.js`). `typescript-eslint@8.71.2` peer `typescript >=4.8.4 <6.1.0`. Dashboard uses `~5.9.3`. Whether Next 16.4.2's type-check works with TS 7 is UNCONFIRMED.
- **Recommendation.** For phase 6 (OD-07) and the W1 parser dependency, pin `typescript@6.0.3` with an explicit M1 justification and a recurring "re-check TS 7 + typescript-eslint" item. Do not copy the dashboard `tsconfig.app.json` as is: Next requires `jsx: "preserve"`, `isolatedModules`, `incremental`, plugin `next`, `allowJs` + `checkJs:false` for incremental conversion, `paths`/`baseUrl` for the webpack aliases, an ambient `declare module '*.css'` because `noUncheckedSideEffectImports` flags CSS side-effect imports, and no `include: ["src"]` (search has no `src/`).
- docs: `90-open-decisions.md` OD-07, `README.md` §3 table, `50-roadmap.md` §5 phase 6

### TCD-17 (medium, version-target) Prettier: the dashboard has none; measured Prettier 3 diff = 8 files
- **Evidence.** `grep prettier` finds no dependency or config in `dashboard`, `@dashboard/dashboard-next`, `core-ui`. So "match the dashboard" gives no Prettier config; search keeps its own (`@oacore/prettier-config` contents: `trailingComma:'es5', semi:false, singleQuote:true, endOfLine:'lf', quoteProps:'consistent'`). Prettier 3.9.10 `--check` (inline config) over the same globs: `babel.config.js`, `hooks/use-analytics.js` (`console.log("GA")` quotes), `templates/output/index.jsx`, `templates/output/styles.module.css`, `templates/output/update/styles.module.css`, **plus three new**: `templates/output/similar-works.jsx`, `templates/search/results.jsx` (nested-ternary indentation) and `modules/dropdown/styles.module.css` (hex colour case `#9E9E9E` -> `#9e9e9e`). No semantic change; resolves "unmeasured" in CS-PRET-1.
- **Recommendation.** Prettier 3.9.10, `prettier.config.js` as a plain object, one format-only commit (8 files) in `.git-blame-ignore-revs`, drop `eslint-plugin-prettier`. The CSS hex-case change alters source bytes of CSS. The built CSS is probably unaffected because cssnano's `colormin` normalises colours (UNCONFIRMED): T-003 must prove it, otherwise it needs a colour-case normalisation.
- docs: `20-change-sites.md` CS-PRET-1, `findings/05` §2.4

### TCD-18 (medium, version-target) husky 9 / lint-staged details
- husky latest is 9.1.7 (`>=18`). The dashboard hook (`.husky/pre-commit`) still contains the deprecated `. "$(dirname -- "$0")/_/husky.sh"` line; write only `npx lint-staged`. husky 9 sets `core.hooksPath=.husky/_`, so the husky-4 stubs in maintainers' `.git/hooks` become inert automatically (no cleanup needed; 05 §4.1 says "noisy"). `prepare: husky` fails under `npm ci --omit=dev` (husky not installed): use `husky || true` if a future multi-stage image omits dev deps; `ENV HUSKY=0` anyway (CS-W0-6, correct and sufficient).
- lint-staged config: JS/JSX -> `eslint` (no `--fix`; the dashboard uses `--fix`, but search's D1 caution + bulk suppressions argue for report-only) and `prettier --write`; CSS -> `stylelint` (no `--fix`) and `prettier --check`; JSON/MD/YAML -> `prettier --write`.
- docs: `20-change-sites.md` CS-HUS-1

### TCD-19 (medium, factual-error) `npm ci || npm install` is a retry, not only a drift hider; CS-W0-4 must keep a retry
- **Evidence.** Lock and `package.json` are in sync (root `packages[""]` deps equal, lockfileVersion 2). `npm ci --dry-run --ignore-scripts --include=dev` on npm 10.8.2/Node 18.20.8 in a scratch copy succeeds with and without `--legacy-peer-deps` ("added 1760 packages"). Since `npm ci` does not re-solve peers when the lock is complete, `--legacy-peer-deps` is irrelevant for `npm ci` today (needed only when regenerating the lock). In each workflow's last 100 runs, 6 prod and 7 stage scheduled runs failed (Jul-Aug 2026); for the 6 prod ones the jobs API shows **no failed step** (stage steps not inspected), i.e. infrastructure/transient. That is consistent with transient registry errors, which the fallback would otherwise absorb (UNCONFIRMED cause; job logs need auth).
- **Recommendation.** Replace the `||` with explicit retries (`--fetch-retries=5 --fetch-retry-mintimeout=2000 --fetch-retry-maxtimeout=60000` and a shell loop around the whole `npm ci`), then remove the fallback. Add to T-008: after any lock regeneration assert the lock contains `@next/swc-linux-arm64-musl` and `@next/swc-linux-x64-musl` entries (today's lock has none: Next 10 has no SWC; only `fsevents` is platform-specific).
- docs: `20-change-sites.md` CS-W0-4, CS-N12-4, `README.md` §8 checklist

### TCD-20 (medium, process-gap) Secrets and registry access for PR CI (public repo)
- **Evidence.** `@oacore/*` (5 lock entries) resolve from `npm.pkg.github.com` (`package-lock.json`); the design package is private. GitHub: secrets are not passed to workflows from forks ([docs](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows)); Dependabot-triggered runs read a separate Dependabot secret store. `origin` has 15 stale `dependabot/npm_and_yarn/*` branches from 2026 (including `next-15.5.14`); main has no `dependabot.yml` (only stale `master` does). Whether `NPM_TOKEN` is a repo or environment secret is UNCONFIRMED; an environment-scoped secret is invisible to CI jobs without `environment:`. Whether `GITHUB_TOKEN` can read `@oacore/design` (package access settings) is UNCONFIRMED.
- **Impact.** "Required" `npm ci` fails on fork and Dependabot PRs; Dependabot PRs touching `package.json` would conflict with the frozen lock during the track.
- **Recommendation.** CI uses `actions/setup-node` (`registry-url: https://npm.pkg.github.com`, `scope: '@oacore'`, `NODE_AUTH_TOKEN`). Make secret availability an explicit ops prerequisite of G3. Add `.github/dependabot.yml` on `main`: `github-actions` weekly, `npm` with `open-pull-requests-limit: 0` for the duration of the track (security alerts handled manually).
- docs: `40-test-strategy.md` §8, `90-open-decisions.md` OD-29, `10-risk-register.md` R-066

### TCD-21 (medium, missing-risk) Smoke tests against the public hostname are blocked by Cloudflare on prod
- **Evidence.** `curl -A curl/8.7.1 https://core.ac.uk/search/?q=climate` -> `HTTP/2 403`, `cf-mitigated: challenge` (both UA strings tried); `https://stg.core.ac.uk/search/?q=climate` -> 200 with `x-powered-by: Next.js`. (No bypass attempted.)
- **Impact.** 05 §5.4(3) "`curl -f https://core.ac.uk/...` after rollout" and any Playwright-on-prod run from GitHub IPs may fail with a challenge page; stg may start challenging too.
- **Recommendation.** Post-deploy smoke from inside the cluster: `kubectl run` a curl pod (or `kubectl port-forward svc/core-frontend-search`) hitting `http://core-frontend-search.<ns>.svc.cluster.local/api/healthz/` and the route matrix paths (the pod serves `/search/`, `/works/<id>/` directly; Host irrelevant). Agree a Cloudflare skip rule with ops only if public-host checks are required.
- docs: `findings/05` §5.4, `40-test-strategy.md` T-902/T-903

### TCD-22 (medium, weak-test) T-601 pins only the presence of `Cache-Control`/`ETag`; real values are known and cheap to pin
- **Evidence (stg through Cloudflare, 2026-10-19).** HTML (`/search/?q=climate`): `cache-control: private, no-cache, no-store, max-age=0, must-revalidate`, `x-powered-by: Next.js`, `cf-cache-status: DYNAMIC`, CSP header equal to `csp.config.js`. `_next/data/<buildId>/search.json?q=...`: `application/json`, same `private, no-cache...`. JS chunk: `public, max-age=31536000, immutable`, weak ETag, `cf-cache-status: MISS`. `icons.svg`: `public, max-age=14400` (likely Cloudflare browser-TTL override; origin value UNCONFIRMED). `framework.<hash>.js.map`: 200, `immutable`. HTML embeds `"assetPrefix":"/static/search"` and chunk URLs `/static/search/_next/static/...`.
- **Recommendation.** T-601 asserts exact `Cache-Control` values and header names per route class, and CF-independent origin values from the container (not only through the proxy). A change in Cache-Control on `_next/static` or on `public/` files alters CDN cost/behaviour silently.
- docs: `40-test-strategy.md` §1 HTTP row, T-601/T-603

### TCD-23 (medium, resolved-verify) Source maps: client `.map` files ARE emitted and publicly served; CS-N11-4 must set `productionBrowserSourceMaps`
- **Evidence.** Local production build (Node 18, Next 10.2.3, scratch copy): `.next/static` contains 35 `.map` files (29 `.js`), `.next/server` 14. Staging: chunk ends with `//# sourceMappingURL=framework.0347137a97aa24ce7f01.js.map` and the map returns 200 (`cache-control: public, max-age=31536000, immutable`). Mechanism: `@zeit/next-source-maps` sets `config.devtool='source-map'` when `!dev` (`node_modules/@zeit/next-source-maps/index.js`, installed 0.0.3). No upload to Sentry exists anywhere (`next.config.js:79-84` TODO).
- **Impact.** Removing the wrapper without `productionBrowserSourceMaps: true` silently stops serving maps (a public HTTP change: `.map` URLs 200 -> 404). Any future Sentry upload step with "delete maps after upload" changes it as well.
- **Recommendation.** CS-N11-4: unconditional `productionBrowserSourceMaps: true`; add `.map` URLs to the T-601 route matrix. In phase 6, `SENTRY_AUTH_TOKEN` as a BuildKit secret (dashboard puts it in an ENV, which leaks into image metadata; do not copy that).
- docs: `20-change-sites.md` CS-N11-4, `40-test-strategy.md` T-601, `README.md` §8 checklist

### TCD-24 (medium, missing-quirk) Sentry is not initialised on staging; probable CSP block of browser events in prod
- **Evidence.** The staging bundle (15 JS files downloaded and grepped) contains the Sentry SDK but no `init({dsn...})` and no `...ingest.sentry.io...` string: `process.env.SENTRY_DSN` was empty at build (`utils/sentry.js:6` guard folded away). Prod DSN is UNCONFIRMED (prod blocks curl). Git history shows the DSN of the previous Container Apps deployment: `https://c075d5369bec4df9adc56815e5d07412@o318858.ingest.sentry.io/5340405` (`origin/master:.github/workflows/prod-stg-deploy.yml:35`). `csp.config.js:52` has `connect-src ... sentry.io` without wildcard, which does not match `o318858.ingest.sentry.io`. If prod uses that DSN, browser Sentry events are already CSP-blocked.
- **Impact.** The W2 checklist item "Sentry test event arrives on staging" (T-904) cannot pass at baseline on stage; the test DSN `https://k@sentry.io/1` in 40 §2.5 matches the CSP and hides a possible baseline defect.
- **Recommendation.** Add to 30 as PRESERVE (do not fix). Test builds use a DSN with the real host shape (`https://k@o318858.ingest.sentry.io/1`) so the baseline captures the true CSP outcome. T-904 wording: "on prod-like config with DSN set". Siblings test-strategy line 305-319 raised the host mismatch as UNCONFIRMED; the git-history DSN and the stg result are new evidence.
- docs: `30-quirks-register.md`, `40-test-strategy.md` §2.5, `20-change-sites.md` CS-SEN-1

### TCD-25 (medium, missing-risk) `next.config.js` is evaluated again by `next start` inside the pod
- **Evidence.** `env.config.js:19-22,34` throws `API_KEY is not configured.` at require time (verified: `env -u API_KEY node -e "require('./next.config.js')"` throws). `next.config.js:6,11-13` also derives `assetPrefix` from `process.env.BUILD_TARGET` and `rewriteDataPath()` from `NODE_ENV` (verified: with `BUILD_TARGET=azure` `assetPrefix="/static/search"`; without it `""`). In the pod these come from image `ENV` (`Dockerfile:10-15,21-22`), not from `kube/*/deployment.yaml` (which sets only `NODE_OPTIONS`, `UV_THREADPOOL_SIZE`, `Internal_API*`, and the secret with `API_KEY` etc.). `env: envConfig` inlines API_URL/API_KEY/SENTRY_DSN/GA_TRACKING_CODE/BUILD_TARGET at build only.
- **Impact.** The plan treats `API_KEY`/`GA_TRACKING_CODE` in the runtime secret as redundant (05 §5.3) and OD-19 (multi-stage/standalone) as a pure file-layout change. A runtime without `API_KEY`/`BUILD_TARGET` crashes or renders wrong asset URLs. The Playwright `next start` (40 §2.5 lists only build-time env) needs the same runtime env. For `output: 'standalone'` Kubernetes injects `HOSTNAME=<pod name>`, overriding a Dockerfile `ENV HOSTNAME=0.0.0.0`: set it in the Deployment env.
- **Recommendation.** Add a "runtime env contract" table to 40 §2.5 and OD-19: required at `next start`: `API_KEY`, `BUILD_TARGET`, `NODE_ENV`, `APP_ENV` (+ `Internal_API*` optional, runtime-only, read in `api/internalize.js:17-18`). T-004/T-008 add "container starts and serves `/search/` with only the K8s-declared env".
- docs: `40-test-strategy.md` §2.5, `90-open-decisions.md` OD-19, `findings/05` §5.3

### TCD-26 (medium, process-gap) Deploy workflows have no concurrency control
- **Evidence.** No `concurrency:` in either workflow. 2026-10-01: five prod runs within 63 minutes (push 09:12, schedule 09:41, dispatch 09:48, dispatch `Validate-page` 09:59, push 10:12). Overlapping `kubectl apply --server-side --force-conflicts` runs can leave the last-finishing build (not the last-triggered) deployed.
- **Recommendation.** `concurrency: { group: aks-prod, cancel-in-progress: false }` (and `aks-stage`).
- docs: `40-test-strategy.md` §8 G6

### TCD-27 (high, process-gap) G1-G7 validation and the exact workflow structure
Verdicts: G1 feasible with TCD-13/14; G2 feasible (fix TCD-04/05); G3+G5 must be one job (TCD-10); G4 feasible on `ubuntu-24.04-arm` with `docker run` of the Playwright container; G6 must follow TCD-01/02; G7 must require one aggregator check. Full structure in section 6. Key points: the simplest working topology starts Playwright with `docker run --network host --ipc=host` on the host runner (a `container:` job would need the Docker socket or Docker-in-Docker to start the app/proxy containers, and `services:` need an already pushed image); avoid `paths-ignore` on required workflows (a skipped workflow leaves the check pending forever) and use an always-run aggregator job; reusable `ci.yml` via `workflow_call` for deploy workflows needs `secrets: inherit` and runs with the caller's ref; image build ~80 s makes a full image build per PR affordable; gha cache limit 10 GB/repo (never store the golden image in it).
- docs: `40-test-strategy.md` §8, `50-roadmap.md` §3 (phase 2 item 2.5), `90-open-decisions.md` OD-29

### TCD-28 (medium, process-gap) Baseline PNG storage (OD-24): LFS bandwidth
- **Evidence.** GitHub Free org: 10 GiB storage + 10 GiB/month bandwidth, and Actions downloads count ([docs](https://docs.github.com/en/billing/concepts/product-billing/git-lfs)). A 4-viewport matrix of ~30 states is on the order of 60-100 MB; every job that checks out with `lfs: true` consumes it (UNCONFIRMED total).
- **Recommendation.** Only the `e2e` job fetches LFS (`git lfs pull --include=e2e/__baselines__`), other jobs `lfs: false`; or store baselines as an OCI artifact (ORAS) next to the golden image in GHCR, referenced by digest in the repo. Decide in OD-24 with the numbers.
- docs: `90-open-decisions.md` OD-24, `40-test-strategy.md` §6.12

### TCD-29 (medium, version-target) Test tooling below latest without an M1 justification
- Jest 29.7.0 chosen; latest 30.5.2 (`^18.14||^20||^22||>=24`) works on Node 18: no stated blocker ("Jest 30 can come later"). `jest-fixed-jsdom@0.0.11` peers `jest-environment-jsdom >=28` (fine for 30). msw 2.x is correct while the SSR preload runs inside the Node 18 app process (msw 3 needs >=22.12; msw 2.15.0 `>=18`); this ties the SSR-stub design to the app's Node: prefer a standalone mock HTTP server for the primary design (the doc's fallback) so the same harness serves Node 18..24 and msw can move to 3 after W4. RTL 12.1.5 is forced by React 17 (peer `<18`), moving to 16.3.3 at W6 (justified). `@playwright/test` pin: 1.64.1 + `mcr.microsoft.com/playwright:v1.64.1-noble-arm64@sha256:<digest>`.
- **Recommendation.** Jest 30 from the start unless a concrete blocker is found in phase 2; add a justification column to 40 §2.7 for every below-latest entry with the step that reaches latest.
- docs: `40-test-strategy.md` §2.7

### TCD-30 (low, process-gap) Branch and baseline-commit hygiene
- GitHub default branch is `main` (API + `git ls-remote --symref origin HEAD`); the local `origin/HEAD -> master` is a stale cache; `master` is a legacy branch (Azure Container Apps workflows, 204 commits behind `main`) whose cron never fires (schedules run on the default branch). Local `main` (f5cfc20) is 27 tree-identical merge commits ahead of `origin/main` (cc0e228); this docs branch is built on it, so a PR would carry those merges.
- **Recommendation.** Phase-2 first step: `git fetch`, branch from `origin/main`, tag `upgrade-baseline` on `cc0e228`, rebase or cherry-pick the docs commit. State "default branch = `main`" in README §8.
- docs: `README.md` §8, `50-roadmap.md` §4 step 1

### TCD-31 (low, clarity) Nightly schedule facts to record
- Nominal 03:00/04:00 UTC; observed starts 06:00-10:00 UTC in the last two weeks (GitHub delays); no scheduled runs 2026-10-02..12 (cause UNCONFIRMED; GitHub also disables schedules after 60 days without repo activity in public repos). 13 scheduled failures across the two workflows (6 prod + 7 stage in their last 100 runs; the 6 prod ones show no failed step). Gate S's "two clean nightly cycles" needs an explicit monitor: "last 2 scheduled runs on the branch under test succeeded within the last 48 h".
- docs: `50-roadmap.md` gate S, `findings/05` §5.2

### TCD-32 (low, phase6-7-plan) What "match the dashboard" can and cannot mean
Dashboard facts (read-only): Vite 7 SPA, pnpm 9 via corepack, `node:24-alpine` build + `nginx:1.27-alpine` static runtime, ESLint 10 flat config only for `**/*.{ts,tsx}` (`@eslint/js`, `typescript-eslint`, `react-hooks` with `rules-of-hooks` error and `exhaustive-deps` warn, `react-refresh`, `no-duplicate-imports`), `lint-staged ^16.3.1` running `eslint --fix` only, husky 9.1.7 with the deprecated sourcing line, `ENV NPM_TOKEN`/`SENTRY_AUTH_TOKEN` in the image, a `.dockerignore`, **no Prettier, no stylelint, no tests, no CI lint**.
- Adopt: husky 9 + lint-staged, ESLint 10 flat + `typescript-eslint` + `react-hooks`, `globals`, `globalIgnores`, strict-TS ideas in phase 6. Do not adopt: `react-refresh` (Vite), `tsc -b && vite build`, pnpm, the Dockerfile/nginx runtime, `ENV` secrets, the TS-only `files` glob. Prettier and stylelint are search-owned (OD-15 Q5 is right).
- docs: `README.md` §3, `findings/08`, `90-open-decisions.md` OD-15/OD-06

### TCD-33 (low, missing-change-site) Operational details for later waves
- Prod memory: heap flag 1024 MB > container limit 768 Mi (`kube/prod/deployment.yaml:41-42,93-94`): OOMKill before GC pressure; keep as baseline, re-tune only with T-905 data. Runtime `NODE_OPTIONS` overrides the image's `--openssl-legacy-provider` (verified md4 needs the flag at build only).
- `/api/healthz/` is not routed by the public gateway (`/api/healthz/` -> 308 elsewhere on stg); probes use the pod port, so keep pod-level paths unchanged. A green probe does not exercise SSR (acknowledged in 05) : the deep smoke must be the in-cluster check of TCD-21.
- Next shutdown behaviour on SIGTERM differs across majors; with `preStop sleep 10` and `terminationGracePeriodSeconds: 60` verify zero 5xx during a rollout on stage under load (UNCONFIRMED per version).
- docs: `40-test-strategy.md` T-902/T-905

### TCD-34 (low, process-gap) GitHub Actions hardening for a public repo with Azure OIDC
Actions are pinned to major tags only (`checkout@v4`, `azure/login@v2`, `setup-buildx@v3`); new third-party actions (paths-filter, create-pull-request) should be pinned by commit SHA, with `dependabot` `github-actions` updates; per-workflow `permissions: contents: read` plus `packages: read` for CI; OIDC jobs only for deploys. The historic reusable workflows lived in `oacore/devops-workflows` (`build-docker-image.yml`, used by the deleted `reusable_test.yml`): check with ops whether to reuse them instead of new files.
- docs: `40-test-strategy.md` §8, `90-open-decisions.md` OD-29

---

## 3. Target dev tooling (what search adopts, when)

Versions from `npm view` on 2026-10-19.

| Tool | Target | Node floor | When | Notes / justification |
|---|---|---|---|---|
| ESLint | **10.13.0** flat `eslint.config.mjs`, `linterOptions.reportUnusedDisableDirectives:'error'` | ^20.19/^22.13/>=24 | W1 | parser `typescript-eslint@8.71.2`; `@eslint/js@10.0.1`; `globals@17.13.0`; bulk suppressions |
| eslint plugins | `eslint-plugin-import-x@4.17.1` (key `import`), `eslint-plugin-jsx-a11y@6.10.2`, `eslint-plugin-react@7.37.5` (or `@eslint-react/eslint-plugin@5.28.2`), `eslint-plugin-react-hooks@7.1.1` (only `rules-of-hooks`) | - | W1 | react/jsx-a11y/import peers exclude 10: M1 note "latest releases, peer range stale, verified loading except 2 rules" |
| typescript (parser dep, phase 6 compiler) | **6.0.3** | >=16.20 | W1 (parser) / phase 6 | TS 7.0.2 latest: no classic JS API, typescript-eslint peer `<6.1.0`. Re-check each quarter |
| Prettier | **3.9.10**, own `prettier.config.js` object | >=14 | W1, one format-only commit | dashboard has none |
| stylelint | **17.16.0** + `stylelint-order@8.1.2`, `stylelint-config-css-modules@4.6.0`, `stylelint-prettier@5.0.3` | >=20.19 | W1 | 61 explicit rules, not config-standard |
| husky | **9.1.7**; hook = `npx lint-staged` | >=18 | W1 (after CS-W0-6 `HUSKY=0`) | |
| lint-staged | **17.6.0** (or 16.4.0 with M1 note) | >=22.22.1 (16: >=20.17) | W1 | |
| script runner | npm scripts / `npm-run-all2@9.0.3` | >=22.22.2 | W1 | do not install on Node 18 |
| Jest / RTL | **30.5.2** / 12.1.5 -> 16.3.3 (W6) | >=18.14 | phase 2 | |
| MSW | 2.15.0 until the SSR preload leaves the Node 18 process, then 3.x | >=18 / >=22.12 | phase 2 / after W4 | |
| Playwright + axe | **1.64.1** image `v1.64.1-noble-arm64@sha256`, `@axe-core/playwright@4.14.0` in `e2e/` | >=20 / >=22.12 | phase 2 | |
| Node (app runtime) | 18 -> 22 (W4) -> 24 after S | - | per 50 | Node 22 LTS ends Apr 2027; 24 is LTS now |
| Node (tooling) | **24** (`.nvmrc`) | - | phase 2 | separate from `ARG NODE_VERSION` |
| TypeScript adoption, `tsc --noEmit`, strict | phase 6 | - | OD-07 | tsconfig differs from dashboard (TCD-16) |
| pure CSS | phase 7 | - | - | stylelint stays until CSS Modules are gone |

---

## 4. CI workflow structure (G1-G7), exact

Files (keep the two deploy file names so run history and workflow ids stay stable):

```
.github/workflows/ci.yml              # CI: pull_request(main,stage) + merge_group + workflow_call + workflow_dispatch
.github/workflows/aks_deploy.yml      # prod: push main, schedule, workflow_dispatch -> jobs: ci -> build-and-deploy
.github/workflows/aks_stage_deploy.yml# stage: push stage, schedule(ref: stage), workflow_dispatch(any ref)
.github/workflows/baseline-capture.yml# workflow_dispatch only: build golden from tag, capture baselines 3x, upload artifact
.github/workflows/golden-canary.yml   # nightly + dispatch: run the whole e2e suite against the golden digest (must be green)
.github/workflows/gate-s.yml          # workflow_dispatch: A/B golden vs candidate in one job + 3 consecutive clean runs
.github/dependabot.yml                # github-actions weekly; npm limit 0 during the track
```

`ci.yml` jobs (all `runs-on: ubuntu-24.04-arm`, `permissions: contents: read, packages: read`, `concurrency` per PR with cancel-in-progress):

| Job | Needs | What | Notes |
|---|---|---|---|
| `changes` | - | path filter (docs-only?) | pin action by SHA |
| `lint` (G1) | - | `setup-node` Node from `.nvmrc` (24), registry-url GitHub Packages + scope `@oacore`, `npm ci` (scripts ON), `npm run lint` = ESLint (suppressions) + stylelint ratchet + `prettier --check` (phase 2: `lint-parity.mjs` on old tools) | Node 24 even while the app is on 18 |
| `unit` (G2) | - | Jest node+dom projects with `TZ=UTC`, `NODE_VERSION` = the wave's app Node (ICU snapshots) | `fail-fast` per project |
| `image` (G3+G5) | - | `docker/build-push-action` `load: true`, `secrets: npm_token=...`, build-args from 40 §2.5, `ARG BUILD_SCRIPT=build:test`, data snapshot copied into `data/` first, `cache-from/to: type=gha`; static checks T-002..T-010 on `.next` extracted from the image; assert `lib/config.js` icons path; `lock-immutable` check | one recipe for prod and test |
| `e2e` (G4) | `image` | `docker compose up` (candidate image + gateway-equivalent proxy + stubs), then `docker run --rm --network host --ipc=host -v $PWD:/w -w /w mcr.microsoft.com/playwright:v<pin>-noble-arm64@sha256:<digest> npx playwright test`; upload report/traces; LFS fetched only here | Playwright container is **not** the job container |
| `gate` (G7) | all | `if: always()`; fails on any `failure`/`cancelled`; treats `skipped` as success only when `changes` says docs-only | the **only** required check: `CI / gate` |

Deploy workflows: `jobs.ci` = `uses: ./.github/workflows/ci.yml` with `secrets: inherit`; `build-and-deploy` `needs: ci`, prod job `if: github.ref == 'refs/heads/main'`, `concurrency: aks-prod`, immutable image reference (TCD-01), post-deploy in-cluster smoke (TCD-21). Stage: schedule checks out `stage` (TCD-02).

Required checks on `main` and `stage`: `CI / gate`. Branch rules: require PR; no `paths-ignore` on `ci.yml`.

Prerequisites to confirm with ops (UNCONFIRMED): `NPM_TOKEN` scope (repo vs environment), GHCR private package settings, Entra federated credential subjects if environments are split, Cloudflare behaviour for CI egress.

---

## 5. Docker changes that are behaviour-neutral and belong in phase 2 (before baselines)

```dockerfile
# syntax=docker/dockerfile:1
FROM node:18-alpine@sha256:<pinned digest>
ARG BUILD_TARGET=azure
... (ARGs/ENVs unchanged, plus ENV HUSKY=0)
WORKDIR /app
# design.config.js must exist when @oacore/design's postinstall runs (TCD-03)
COPY package.json package-lock.json design.config.js ./
RUN --mount=type=secret,id=npm_token --mount=type=cache,target=/root/.npm \
    printf '@oacore:registry=https://npm.pkg.github.com/\n//npm.pkg.github.com/:_authToken=%s\n' "$(cat /run/secrets/npm_token)" > .npmrc \
 && for i in 1 2 3; do npm ci --include=dev --legacy-peer-deps --fetch-retries=5 && break || sleep 10; done; rc=$?; rm -f .npmrc; exit $rc
COPY . .
ARG BUILD_SCRIPT=build
ENV NODE_ENV=$NODE_ENV APP_ENV=$APP_ENV NODE_OPTIONS="--openssl-legacy-provider"
RUN npm run ${BUILD_SCRIPT} && cp public/design/icons.svg public/icons.svg && mkdir -p public/images && cp -r public/static/images/* public/images/
EXPOSE 8080
CMD ["node_modules/next/dist/bin/next", "start", "-p", "8080"]
```
Plus `.dockerignore` (`.git`, `.next`, `node_modules`, `.idea`, other local tool-config directories, `.env*`, `.npmrc`, `docs`, `test`, `e2e`, `*.md`, `kube`, `.github`). Verify by T-008/T-901: `.next/static` file set identical to the pre-change build, `lib/config.js` unchanged, image `ENV` unchanged. The runtime secret still gets `API_KEY` etc. until a separate ops decision removes `NPM_TOKEN` from `kube` secret sync (no runtime use of it).

---

## 6. Resolved [VERIFY] items (README §8 and 20)

| Item | Answer | Evidence |
|---|---|---|
| Does the baseline production build emit client `.map`? (CS-N11-4) | Yes (35 maps in `.next/static`; stg serves them) | TCD-23 |
| Does `npm ci --legacy-peer-deps` (no fallback) succeed today? (CS-W0-4) | Lock-level yes (dry-run Node 18 / npm 10.8.2, with and without the flag); download untested | TCD-19 |
| Prettier 3 reformat size (CS-PRET-1) | 8 files, trivial | TCD-17 |
| Latest versions (tooling) | in section 3 | `npm view` |
| Lint baselines reproducible? | Yes, identical on Node 18.20.8 and 24.18.1 | section 1 |
| Default branch / which branch deploys where | `main` is default; push `main` -> prod, push `stage` -> stage, both crons build `main`; dispatch any ref | API, ls-remote |
| Playwright version and image | 1.64.1, `v1.64.1-noble`(+`-arm64`/`-amd64`), Node >=20 | MCR tags, manifest |
| `jest-fixed-jsdom` / `msw` pins | 0.0.11 / 2.15.0 (Node>=18) | `npm view` |
| Existing Sentry DSN host | `o318858.ingest.sentry.io` in legacy workflow; stg has none | TCD-24 |
| Is webpack 4 usable on newer Node for local dev? | md4 works with the flag on 18/22/24; full build verified only on Node 18 | crypto test; scratch build |
| CI build duration baseline | Docker build+push ~78-81 s (190 s cold); local `next build` 19 s | API steps; scratch build |

Still UNCONFIRMED: prod Sentry DSN and CSP outcome; `NPM_TOKEN`/GitHub Packages access for PR jobs; ACR/OIDC for PR jobs; Cloudflare behaviour for CI egress; cross-host pixel determinism (needs the soak); Next 16 + TS 7; behaviour of every `react/*` rule on ESLint 10 beyond the one load error; what the cause of the 10-day nightly gap was; `docker run … node -v` inside the Playwright image.

---

## 7. Experiment log (scratch: `<scratch>/exp/tooling-ci-deploy/`)

- `poc/` = `git archive HEAD` of search; `lintpoc` (ESLint 10 + babel-parser 7), `lintpoc9` (ESLint 9.39.5), `lintpoc10b` (ESLint 10 + Babel 8 parser), `lintpoc10t` (ESLint 10 + typescript-eslint 8.71.2, TS 5.9.3), `stylepoc` (stylelint 17.16.0 stack), `cidry` (npm ci dry-run), `design-pack` (pristine @oacore/design tarball), `layer` (design postinstall with/without root `design.config.js`), `nextpoc` (symlinked repo node_modules; scratch `next build` with and without `pages/__tests__/smoke.test.js`), `stgjs` (staging chunks), `eslint*.json` outputs.
- ESLint 10 + babel parser 7: 156/157 `TypeError: scopeManager.addGlobals is not a function`. typescript-eslint parser: 2 fatal (`export X from`). Rule port: 243/245 load. Bulk suppressions: exit 0 / 1 / 0 / 2 as in TCD-14.
- Prettier 3.9.10 `--check`: 8 files (list in TCD-17). stylelint 17: 61/77 rules valid; findings 17; config-standard 34.
- GitHub API (unauthenticated, public repo): default branch, workflows, 100 most recent runs per deploy workflow, job step durations for runs 39222460000, 38380308924, 36847641957, 36841171272; failed runs list (13 scheduled failures without failed step). `git ls-remote --symref origin HEAD`.
- curl to `stg.core.ac.uk` and `core.ac.uk` (read-only, no bypass attempted).
- Registry: `npm view` for 40+ packages (engines, peerDependencies, dist-tags, deprecated).
- Docs fetched: GitHub runners reference, events/schedule, Git LFS billing, ESLint suppressions, Playwright snapshots, Node.js previous releases, Next `env` option.
