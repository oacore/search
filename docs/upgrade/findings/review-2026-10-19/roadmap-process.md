# Adversarial review: process (00, 50, 90, README) — key `roadmap-process`

Reviewer scope: 00-decisions.md, 50-roadmap.md, 90-open-decisions.md, README.md, judged against owner requirements M1–M9. Cross-checked against the repo at `f5cfc20` (tree-identical to `origin/main` `cc0e228`), the GitHub workflows and kube manifests, the dashboard/design/core-ui repos, the npm registry (queried 2026-10-19) and official docs.
Nothing in any repo was modified. Scratch experiments: `<scratch>/exp/roadmap-process/`.

---

## 0. Verdict (short)

The plan is a good technical inventory, but **it cannot be executed as written, and its two most important gates are missing or unmeasurable.**

1. **The deploy pipeline makes the wave procedure impossible.**
   - Merging to `main` deploys prod straight away.
   - The stage nightly cron builds **`main`**, not `stage`, because GitHub runs scheduled workflows only on the default branch. Any wave being soaked on stage is overwritten at 04:00 UTC.
   - The prod nightly rebuild re-pushes the same mutable tag and does not roll out.
   - So "soak 24 h incl. nightly rebuild → canary → prod", "one PR per CS-group" and "prod after step (d)" cannot all be true.
   - Details: RP-01, RP-02, RP-03, RP-16.
2. **The M5 gate (before antd) does not exist, and M7 (95 %) is never defined.**
   - Gate S sits *before* phase 6. Phase 7 starts on "Phase 6 done".
   - "~95 %" appears only as a slogan.
   - Details: RP-05, RP-06.
3. **There is no change control for a 4–8-month track on an active repo.**
   - `main` has had 32 commits since 2026-07-01 from 8 authors.
   - `@oacore/design` published 5.0.70→5.0.74 in two days (header/footer content).
   - The rule "baselines are never re-captured from an upgraded app" leaves no legal way to absorb product changes (RP-04).
4. **M1 (latest everywhere) is violated in about 20 places with no reach-latest step.** The worst cases:
   - Node 22 is already in maintenance and reaches EOL on 2027-04-30, about when gate S would land.
   - TypeScript "latest" (7.0.2) cannot be used with typescript-eslint.
   - Details: RP-08, RP-09, RP-10.
5. **M4 (design ownership) and M6 ("pure CSS", TypeScript, the full dashboard library list) are missing from 00-decisions and the roadmap.**
   - The compiled-ES5 vendoring is described as "thrown away in phase 7", but about half the used design units have no antd equivalent and would stay as unowned compiled code forever (RP-11, RP-12, RP-25).
   - "Pure CSS" as the dashboard does it (co-located global `.css`) is **forbidden** by the Next pages router (RP-11).
6. **The W5 vendoring is not "identical by construction".** Files moved out of `node_modules` are re-transpiled by search's Babel and bundled into the server instead of being externalised (RP-13).
7. **Phase 2 is not "no runtime change".**
   - devDependencies are installed into the prod image.
   - The server `require`s `node_modules` at runtime.
   - A lockfile simulation adding the phase-2 test packages changes two runtime-tree entries (RP-07).
8. **The effort estimates are about 1.5–2.5× too low, and calendar time is ignored** (RP-19).

Phases 6 and 7 are drafted in full in §6 below. The OD triage is in §8, the 00 amendments in §9, and the exact replacement wording in §10.

---

## 1. Evidence base (commands run, read-only)

| What | Command / source | Result |
|---|---|---|
| Remote default branch | `git remote show origin`; `git ls-remote --symref origin HEAD`; `curl api.github.com/repos/oacore/search` | `HEAD branch: main`, `default_branch: main`, `visibility: public`. The local `refs/remotes/origin/HEAD -> origin/master` is **stale**, so tooling in this session reported "Main branch: master". |
| Baseline commit | `git rev-parse f5cfc20^{tree} cc0e228^{tree}` | Identical trees (`a825839…`). `f5cfc20` exists **only locally**: `git rev-list --left-right --count main...origin/main` = `27 0`. |
| Stage vs main | `git diff --stat origin/main origin/stage` | Stage lacks #455. Data JSON differs. kube is identical. Stage is moved by "merge main into stage" commits made by ops. |
| Workflows | `.github/workflows/aks_deploy.yml:3-7`, `aks_stage_deploy.yml:3-7` | prod: `push: [main]` + cron `0 3 * * *`. stage: `push: [stage]` + cron `0 4 * * *`. Neither has a `pull_request` trigger. Tag `=$(sha7)-prod/-stg` (`aks_deploy.yml:38-40`). |
| Scheduled-workflow semantics | <https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows> (schedule) | "Scheduled workflows will only run on the default branch." `GITHUB_SHA` = "Last commit on default branch". Also: "In a public repository, scheduled workflows are automatically disabled when no repository activity has occurred in 60 days." |
| k8s rollout | `kube/prod/deployment.yaml` (`image: ${IMAGE}`, `imagePullPolicy: IfNotPresent`, `RollingUpdate maxSurge 2`, `revisionHistoryLimit: 5`); `kube/prod/hpa.yaml` (`minReplicas: 4`); <https://kubernetes.io/docs/concepts/workloads/controllers/deployment/#updating-a-deployment> | A rollout happens only when `.spec.template` changes. Re-applying the same tag string is a no-op. |
| Stage env | `kube/stage/deployment.yaml:9` `replicas: 1`; `:49-52` `Internal_API=http://core-frontend-api.core-frontend.svc…` (the **prod** namespace) | Stage SSR hits the prod in-cluster API. |
| Dependabot | `git branch -r \| grep dependabot`; GitHub open PRs | 18 dependabot branches, the latest dated 2026-04-08. No `.github/dependabot.yml`, so repo-level security updates are on. Open PR #389 "Update package.json: Node v24, React v19" (base `master`). #410 "Bump next 10.2.3→15.5.14" (base `main.old`). |
| Design churn | `git -C design log`; `git show 5ccfbae -- package-lock.json` | design 5.0.70→5.0.74 on 2026-09-10/11 ("fix link", "remove item", "spacing", "add logo update"). Search bumped 5.0.58→5.0.71 (#449) and →5.0.74 (#451) the same day. |
| Next 10 babel/externals | `node_modules/next/dist/build/webpack-config.js:114` (babel `include:[dir…]`, `exclude: /node_modules/`), `:83` (server: `node_modules/*.js` → `commonjs` external), `:45` (`commons` `minChunks: totalPages`) | See RP-13, RP-07, RP-32 |
| devDeps in prod image | `Dockerfile:19` `npm ci --include=dev` | Test devDependencies ship to prod |
| Lock simulation | copied `package.json`/`package-lock.json` to scratch; `npm install --package-lock-only --ignore-scripts --legacy-peer-deps -D jest@29.7.0 babel-jest@29.7.0 jest-environment-jsdom@29.7.0 @testing-library/react@12.1.5 @testing-library/jest-dom@6 msw@2 @playwright/test@1.56.1`; diffed the non-dev entries (`exp/roadmap-process/scripts/lockdiff.py`) | **2 runtime (non-dev) entries changed:** `node_modules/@babel/helper-validator-identifier 7.27.1→7.29.7`, `node_modules/hasown 2.0.2→2.0.4` |
| Registry (2026-10-19) | `npm view <pkg> version engines peerDependencies` | Table in §11 |
| Node schedule | <https://raw.githubusercontent.com/nodejs/Release/main/schedule.json> | v18 EOL 2025-04-30. v22 maintenance 2025-10-21, EOL 2027-04-30. v24 maintenance 2026-10-20, EOL 2028-04-30. v26 LTS 2026-10-28, EOL 2029-04-30. |
| Next global CSS rule | <https://nextjs.org/docs/messages/css-global> | "Global CSS cannot be used in files other than your custom `_app.js` file". Import from `node_modules` is allowed anywhere (<https://nextjs.org/docs/pages/getting-started/css>). |
| antd SSR on pages router | <https://ant.design/docs/react/use-with-next> | Needs `@ant-design/cssinjs` `createCache`/`StyleProvider`/`extractStyle` in `pages/_document`. Without it antd components have no first-screen styles. Search has **no** `pages/_document.jsx` (`ls pages`). |
| Dashboard CSS | `find dashboard/src -name "*.module.css"` = 0; `*.css` = 38; `className="kebab-case"` + `classnames`; `ConfigProvider theme` (`src/main.tsx:52`) | "Pure CSS" = co-located global plain CSS with no PostCSS config |
| core-ui | `core-ui/package.json` peers `antd ^5.27.6`, `@ant-design/icons ^5.6.1`, `react ^19.1.1`. The dashboard installs it with antd 6.3.2 (`pnpm-lock.yaml:2940`) | Peer mismatch with antd 6 latest |

---

## 2. Findings (detailed)

Severity: C = critical, H = high, M = medium, L = low.

### RP-01 (C) The staging soak cannot work: the stage nightly cron deploys `main` over the wave
- **Evidence:**
  - `aks_stage_deploy.yml:3-7` runs on `push: [stage]` and cron `'0 4 * * *'`.
  - GitHub docs say scheduled workflows "will only run on the default branch", with `GITHUB_SHA` = the last commit on the default branch.
  - The default branch is `main` (GitHub API).
  - So at 04:00 UTC every night, `actions/checkout@v4` checks out **main** and deploys it into the `core-frontend-stage` namespace.
- **Impact on the plan:**
  - Wave step 6, "T-902 soak 24 h (incl. a nightly rebuild)", either:
    - tests the wave for less than 24 h and then silently tests the *pre-wave* app on `main`, or
    - if the wave is already on `main`, it is already in prod. Soak-before-prod is impossible.
  - Gate S, "Two clean nightly cycles on staging", has the same problem.
  - This is a SILENT process failure: every dashboard looks green because it is looking at the old app.
- **Fix (ops, phase 2, part of OD-29):**
  - In `aks_stage_deploy.yml`, check out `ref: stage` for scheduled runs, e.g. `with: { ref: ${{ github.event_name == 'schedule' && 'stage' || github.sha }} }`, and compute the tag from the checked-out SHA, not from `github.sha`.
  - Or remove the stage cron while a soak is in progress.
  - Add a T-902 precondition: `kubectl get deploy -n core-frontend-stage -o jsonpath='{..image}'` equals the wave digest at the start **and at the end** of the soak.

### RP-02 (C) The wave mechanics contradict deploy-on-merge
- **Evidence:**
  - `aks_deploy.yml:3-6`: every push to `main` builds and deploys prod. There is no PR check.
  - 50 §4 wave shape says "1. Branch from main. 2. One PR per CS-group … 5. Deploy to stage … 8. Prod canary".
  - W4 says "Each step individually deployed to stage. Prod after (d)". W6 says "Prod after (d)". W7 says "Prod after (c)".
- **The contradiction:**
  - If the CS-group PRs merge to `main`, **each merge is a prod deploy**, before any stage soak.
  - If they do not merge to `main`, the plan never says where they merge or how a wave reaches `stage`.
- **Fix (exact flow; also in §4):**
  - One **integration branch per deployable step**, `upgrade/<wave><step>-<slug>` (e.g. `upgrade/W4c-next-11`). CS-group PRs target it. Required checks are G1–G5.
  - When the step is complete: open the PR `upgrade/W4c-… → main` but do **not** merge it.
  - `git checkout stage && git merge --no-ff upgrade/W4c-…` and push. This follows the existing ops convention ("merge main into stage").
  - Soak per RP-01/RP-17.
  - Merge the PR into `main`. That is the prod deploy.
  - Prod watch. Then `git checkout stage && git merge main` to re-align.
  - "Never combine two waves" becomes "never have two integration branches on stage at once".

### RP-03 (H) Nightly prod "rebuild" does not roll out; tags are mutable; rollback-by-digest does not exist
- **Evidence:**
  - Tag = `sha7-prod` (`aks_deploy.yml:38-40`). The nightly run on the same SHA pushes a **new image under the same tag**.
  - `envsubst` produces an identical pod template, so k8s does not roll out (k8s docs: a rollout is triggered "if and only if" `.spec.template` changes).
  - `imagePullPolicy: IfNotPresent` (`kube/prod/deployment.yaml`): pods later scheduled onto a node without that tag cached pull the *new* digest. Pods on other nodes keep the old one. The result is a mixed fleet of builds with different live-data snapshots, and possibly different dependency trees while the `npm ci || npm install` fallback exists.
  - 50 §4 rollback says "the previous image digest stays deployable", and T-903 says "Roll out by image digest". But the workflow deploys **by tag**, and tags are overwritten nightly.
  - Findings 05:256 ("nightly cron rebuilds main and redeploys") is factually wrong about "redeploys".
- **Fix:**
  - Add to OD-29/G6: deploy `IMAGE=<repo>@sha256:<digest>`, taken from `docker buildx build --metadata-file`.
  - Record the digest per wave in the README log. Rollback = re-apply the previous recorded digest.
  - Have the owner decide whether the nightly cron should force a rollout (for example a pod-template annotation with the build date). Today's behaviour is "data refresh only reaches new pods". Keep it unless decided otherwise, but document it as quirk Q-ops.

### RP-04 (C) There is no change control or re-baseline protocol for product changes during the track
- **Evidence:**
  - `git log origin/main --since=2026-07-01 | wc -l` = 32. Authors since 2026-04-01: Andrew 16, beso 15, ekachxaidze98 19, fropa 21, Valerii/vbudko 14, others.
  - The design repo shipped 5 versions on 2026-09-10/11, and search adopted them (#449, #451).
  - 40 §6 says "Baselines are **never** re-captured from an upgraded app". 40 §9.5 says baselines change only via golden re-capture "or an explicitly documented owner decision".
  - The README log has no freeze policy.
- **Impact:**
  - Any feature or content PR merged to `main` during W0–W7, such as a footer link, a banner (#452) or a data-provider validator (#455), makes T-801/T-6xx/T-7xx red with no prescribed way forward.
  - People will then update baselines by hand. That is exactly the silent-drift failure the suite exists to prevent.
- **Fix (owner decision, a new OD, phase-2 blocker). Choose one:**
  - **A.** A feature freeze on `main` from phase 2 to gate S (only hotfixes, each treated as a mini-wave).
  - **B.** A re-baseline protocol, documented in 40 §6. A product PR:
    1. lands alone, never inside a wave;
    2. has its baseline delta produced by building the **current** stack *without* and *with* the PR and capturing both. The diff must be limited to the regions and keys declared in the PR;
    3. records the new baseline set in a `test/baseline/LEDGER.md` row (PR, regions, approver);
    4. the golden image is **re-built from that pre-upgrade commit only if** the product change lands before W4. Otherwise the ledger chain is the reference;
    5. is signed off by the owner.
  - **Plus:** freeze the design version now. CS-W0-1 must move to phase 2 or earlier: pin `"@oacore/design": "5.0.74"` in the same PR as the harness. Header/footer content changes are then made in search (after vendoring) under protocol B.

### RP-05 (C) The M5 pre-antd gate is missing
- **Evidence:**
  - 50 §1 diagram: "S Stabilisation gate (D4a exit)", then Phase 6, then Phase 7.
  - 50 §5, phase 7 precondition: "Phase 6 done."
  - 00 D4a: "Only then do the antd **and functional-library** phases start".
  - Nothing gates the end of phase 6, where every store, the HTTP layer, the TypeScript conversion and possibly the Babel→SWC switch have changed.
- **Fix:** add **Gate A (pre-antd)** with binary criteria, evidence artefacts and sign-off. The full definition is in §5.2. Make it a decision in 00 (D7).

### RP-06 (H) M7 "≥95 % confidence" is not defined or measured anywhere
- **Evidence:** `grep -n "95" docs/upgrade/*.md` gives README:13 ("~95 % confidence"), 40:172 ("how the ~95 % confidence target is built up", a qualitative table), 90:30 and 10:10. There is no metric, threshold or computation.
- **Fix:** define the confidence measure as three binary sub-gates, all required (§5.4):
  1. catalogue coverage;
  2. a detector-efficacy (seeded-fault) score of 100 % on ★ SILENT risks, plus a mutation score on the logic modules;
  3. production non-inferiority at 95 % statistical confidence over at least 14 days.

### RP-07 (H) Phase 2 is not "no runtime change"; the inertness proof is too weak
- **Evidence:**
  - `Dockerfile:19` runs `npm ci --include=dev`, so every devDependency is in the prod image.
  - Next 10 server externals: `webpack-config.js:83` makes any `node_modules/*.js` a runtime `require` from the server. errata #3 confirms `.next/server/pages/_app.js` contains `module.exports = require("@sentry/node")`.
  - The lock simulation adding the 40 §2.7 packages changed 2 non-dev hoisted entries (`@babel/helper-validator-identifier`, `hasown`).
  - Every phase-2 merge to `main` deploys prod (RP-02).
  - 40 §6.1 checks only `.next/static` hashes.
- **Fix (exact wording for 40 §6 step 1 and 50 §3):** "Inert = all of:
  - (a) `npm ls --omit=dev --all --json` identical before/after (versions **and** paths);
  - (b) `.next/static/**` and `.next/server/**` byte-identical after normalising the build ID;
  - (c) `T-901` passes on the new image;
  - (d) if (a) fails, add `overrides` that pin the changed runtime entries back.

  Every phase-2 PR merged to main is a prod deploy and follows the wave runbook (§4), without the soak."

### RP-08 (H, M1) The Node target is obsolete before the track ends
- **Evidence:** the Node release schedule (§1).
  - Node 18 is **EOL since 2025-04-30**, and prod runs it today.
  - The plan's track target, Node 22, has been in **maintenance since 2025-10-21** and reaches **EOL on 2027-04-30**.
  - The plan's own estimate is phase 2 (15–25 d) plus W0–S (36–60 d) = 51–85 person-days. Realistically (RP-19) gate S lands in Q2 2027, at the same time as Node 22 EOL.
  - Node 24 (the dashboard's version) enters maintenance on 2026-10-20 (EOL 2028-04-30). Node 26 becomes Active LTS on 2026-10-28.
- **Constraints** (registry): Next 16.4.2 `node >=20.9`; `@sentry/node@11` `>=20.19 <22 || >=22.12`; ESLint 10 `^20.19 || ^22.13 || >=24`; stylelint 17 `>=20.19`; lint-staged 17 `>=22.22.1`; msw 3 `>=22.12`; `@playwright/test@1.64.1` `>=20`.
- **Fix:**
  - Re-decide OD-05: track target **Node 24**, end-state **Node 26** after it has been LTS for at least 1 month and T-901/T-108 are green.
  - Add a **phase-2 experiment**: build the golden image a second time `FROM node:24-alpine` (keeping `--openssl-legacy-provider`) and run the P0 suite. If it is 100 % green and 0 px, schedule a **Node-only wave right after W0**. That isolates the ICU change (R-042) and unlocks the latest dev tooling for every later wave.
  - Otherwise keep the Node switch at W4e, with target 24.

### RP-09 (H, M1) About 20 targets are below latest with no reach-latest step
Registry versions are on 2026-10-19. "Plan target" is from 20/50/60.

| Package | Plan target | Latest | Blocker the plan cites | Reach-latest step in the plan? |
|---|---|---|---|---|
| node | 22 | 24 LTS / 26 LTS on 10-28 | — | no (OD-05 "after S") |
| @sentry/browser+node | 7.119.1 | 11.8.0 (10.76.2 is the last major supporting Node ≥18) | API change | no ("decide B vs C in phase 6") |
| eslint | 9 | 10.13.0 | react/import/jsx-a11y peers stop at ^9 (`npm view eslint-plugin-react peerDependencies` → `^9.7`) | vague ("10 later") |
| stylelint | 16 | 17.16.0 | Node ≥20.19 | no |
| lint-staged | unspecified | 17.6.0 (Node ≥22.22.1) | — | no |
| mobx / mobx-react-lite | 6.15 / 4.1 | 6.16.1 (7.0.6) / 5.1.0 | mlr 5 peers `mobx ^7`, `react ^18\|\|^19` | removal in phase 6 (acceptable if it is stated as the reach-latest path) |
| msw | 2.x | 3.0.3 (Node ≥22.12) | Node | no |
| jest / RTL | 29.7 / 12.1.5→16 | 30.5.2 / 16.3.3 | — | partial |
| @playwright/test | pinned for the whole track | 1.64.1 | re-capture | no |
| i18n-iso-countries | 6.8 | 7.14.0 | visible text (R-031) | no (OD-27 says keep) |
| react-ga4 | 2.1 | 3.0.1 | hit shape | no |
| postcss-preset-env / custom-media / cssnano | 7 / 8 / 4 | 11.6.1 / 12.0.3 / 9.9.0 | pixel risk; W8 "or skipped" | no |
| @babel/core etc. | 7 | 8.0.7 | — | no (SWC is optional, W9) |
| typescript | not in track | 7.0.2 (see RP-10) | — | — |
| vendored design deps (60 D5) | "currently installed" | katex 0.16.22→0.19.0, d3-scale 1.0.7→4.0.2, d3-array 1.2.4→3.2.4, react-cookie 4.1.1→8.1.2, throttle-debounce 3→5.0.2, svgo 1.3.2→4.1.0, yargs 16→18.2, cosmiconfig 7→10.0.1, @mdi/svg 5.9.55→7.4.47, sanitize.css 12→13, slick-carousel 1.8.1→2.0.0 | verbatim copy | **no step at all**. After W5 these become direct dependencies of search. |

**Fix:**
- Add an **"M1 exceptions ledger"** table to README §3 with these columns: package, current, track target, latest (date checked), blocker with evidence, the step that reaches latest (wave ID), and the date to re-check.
- Add two explicit waves:
  - **L1 "latest sweep"**, right before Gate A, for everything still below latest;
  - **L2**, after phase 7, for the leftovers whose blocker was the design code.
- Anything that stays below latest needs an owner `ACCEPTED` entry with an OD reference.

### RP-10 (H, M1/M6) TypeScript "latest" (7.0.2) is unusable with the toolchain
- **Evidence:**
  - `npm view typescript dist-tags` gives `latest: 7.0.2` (released 2026-07-08); `6.0.3` was released 2026-04-16.
  - `npm view typescript@7.0.2 exports`: `"."` maps to `./lib/version.cjs`. Only `./unstable/*` APIs exist; there is no classic compiler API.
  - `npm view typescript-eslint@8.71.2 peerDependencies`: `typescript ">=4.8.4 <6.1.0"`.
  - Next's build-time type check uses the `typescript` package API. Whether it works with TS 7 is UNCONFIRMED.
  - The dashboard is on `~5.9.3`.
- **Fix:** record a decision: TypeScript **6.0.3** (the latest with the JS API) with this justification, plus a re-check rule ("move to 7.x when typescript-eslint's peer range includes it and `next build` type-check passes"). The "TypeScript" adoption from M6 is missing from 00 entirely (RP-25).

### RP-11 (H, M6) "Pure CSS" is absent, and the Next pages router forbids the dashboard's version of it
- **Evidence:**
  - M6 lists "pure CSS".
  - The dashboard has 0 `*.module.css` and 38 co-located global `*.css`, and no PostCSS config (§1).
  - Search has 26 `*.module.css` (camelCase hack `next.config.js:45-77`) and PostCSS with custom-media, extend-rule, preset-env `stage:0` and cssnano.
  - Next docs (<https://nextjs.org/docs/messages/css-global>): "Global CSS cannot be used in files other than your custom `_app.js` file".
  - 00 does not mention CSS. 90 OD-11 lists only CSS-module options and never names the M6 target.
- **Impact:** co-located plain CSS imports in components are a **build error** in the pages router. Converting every module to global CSS imported in `_app` changes:
  - cascade order: every rule loads on every page, and the order becomes `_app` import order instead of per-chunk order;
  - per-page CSS payload;
  - class-name collisions: 177 dashed classes, which are no longer scoped.
- **Fix (a new OD, needed by phase 6; options):**
  - **P1 (recommended).** "Pure CSS" = standard CSS syntax: no PostCSS plugins, so `@custom-media` becomes literal media queries, `@extend` becomes expanded declarations, and preset-env stage-0 features become standard. CSS Modules stay (Next built-in). The camelCase hack is removed by codemod (OD-11 B: `styles.fooBar` → `styles['foo-bar']`, 221 reads in 50 files).
    - Gate: T-003 normalised declaration set identical and T-801 0 px. It does **not** require global scope.
    - Place it in phase 6 (6.9). This also unblocks Turbopack.
  - **P2.** The dashboard-literal version: global kebab-case CSS imported from `pages/_app.jsx`, with BEM-prefixed class names to avoid collisions. Do it only **after** antd (phase 7 last sub-wave), when most component CSS is gone. It needs a CSS-order proof (T-003 sequence-sensitive) and T-801.
  - **P3.** Keep CSS Modules plus PostCSS (the owner accepts the deviation from the dashboard).

### RP-12 (H, M4) Design ownership is not planned; the compiled ES5 would become permanent for non-antd units
- **Evidence:**
  - 60 §2 calls the compiled vendoring the "code thrown away in phase 7".
  - 60 §3 inventory: units with **no antd equivalent**:
    - Icon plus the sprite CLI (`bin/`, 49 symbols);
    - Logo / DataProviderLogo;
    - Histoslider (d3);
    - MathMarkdown (katex);
    - LoadingBar, Fieldset, ExpandableList, MetadataList;
    - the SearchResult composite;
    - Footer / Header (with search bar);
    - Cookies popup / Provider / `useCookie`;
    - the `classNames` utility with `.use/.from` shapes;
    - the global CSS closure (reboot, sanitize, foundation, helpers, and the unused-component CSS that styles bare elements, 60 §5.2).
  - M4: "search must own its implementation of every design component/asset it uses".
- **Impact:** after phase 7, about 12 of the ~23 units would still be minified, Babel-compiled ES5 CJS with inlined hash maps. That is unmaintainable, and it is ownership in name only.
- **Fix:** add sub-wave **7.1 "Ownership"**, before the antd replacements:
  - re-implement each non-antd unit as readable source in `components/` (or `ui/`), ported from `design/src` at commit `bbc35a0` (tag 5.0.74) with the classic JSX runtime / TSX;
  - move the global CSS closure into owned `styles/global/*.css`.
  - Gate per unit: T-417 identical, T-802 0 px, T-801 0 px.
  - Add a decision D4b to 00: "Ownership end state: no `design/` compiled directory, no `@oacore/design`, and every used unit is either an antd component restyled (D5) or owned source in search".
- **OD-21 needs re-framing:** compiled for W5 stabilisation (fine), with ownership happening in phase 7.

### RP-13 (H) W5 vendoring is not "identical by construction": Babel re-transpiles it and server externals change
- **Evidence:**
  - Next 10 `webpack-config.js:114`: babel-loader `include:[dir, …]`, `exclude: p => /node_modules/.test(p)`. So `design/**` (inside the project dir) **is** processed by `babel.config.js`, which uses preset-env `useBuiltIns:'usage', corejs:3`, `@babel/plugin-transform-runtime` and `add-react-displayname` (`babel.config.js:4-26`). Today `node_modules/@oacore/design/lib` is excluded.
  - `webpack-config.js:83`: on the server, `node_modules/*.js` is externalised (`commonjs <request>`). After the move, the design JS is **bundled** into `.next/server`.
  - Babel's default `sourceType:"module"` plus injected `import` helpers or polyfills in a CJS file (`"use strict"; exports["default"] = …`, see `lib/elements/button/button.js`) is the classic mixed ESM/CJS hazard (e.g. `exports is not defined`). The exact failure mode is UNCONFIRMED.
  - Jest's `babel-jest` transforms it too, because default `transformIgnorePatterns` only skips `node_modules`.
  - 60 §2 claims "JS semantics: Identical (the same compiled output)".
- **Fix:**
  - In 60 D3, add: `babel.config.js` `ignore: ['./design']` (or `overrides: [{ test: './design', sourceType: 'script', presets: [], plugins: [] }]`), and the Jest equivalent.
  - T-004 must assert that the vendored modules are emitted unchanged (no core-js injections).
  - Add a T-4xx server-render check for context identity, since the server now bundles the code instead of requiring it.
  - Alternative ordering: RP-14.

### RP-14 (M, ordering) Vendor in two steps; the tarball step can happen very early
- **Proposal:**
  - **W0.5 "design tarball":** commit the exact published tarball `vendor/oacore-design-5.0.74.tgz`. Its integrity must equal the lock entry `sha512-kwYolSk+PrJtJzSkhyUz/YGJKDbPcf6UpALedXnhWhNeJL/xB8PDvgGjHYq+xOZi2V7SIB9h0tueAAgR6IagrQ==` (`package-lock.json:2363-2367`). Set `"@oacore/design": "file:vendor/oacore-design-5.0.74.tgz"`.
  - **W5 "inline"** as in 60, with the RP-13 Babel exclusion.
- **Why the tarball step reduces risk:**
  - It freezes design at the baseline. This beats CS-W0-1 alone, because the GitHub Packages registry and the "latest" tag disappear for design.
  - Code paths stay byte-identical: still inside `node_modules`, so Babel exclusion, server externals, postinstall (`lib/config.js` generation) and the css-loader path are all unchanged.
  - It removes `NPM_TOKEN` for design. The token is still needed for `@oacore/*` configs until W1, and `@oacore/stylelint-config-base` sits in `dependencies`, `package.json:19`.
  - It makes the RP-04 freeze enforceable.
- **Why it does not replace W5:** the peer cap `react ^17.0.1` remains, so React 18 still needs W5 or `overrides`.
- **CSS pipeline risk:** none. The CSS is still imported from `node_modules` through the same `_app` import (`pages/_app.jsx:18`).
- **Recommendation:**
  - Do W0.5 immediately after phase 2.
  - Keep the inline/ownership work at W5, after W4 and before W6, because inlining before W4 would put the vendored code through webpack 4 *and* webpack 5 and double the verification.
- **On moving full vendoring "right after phase 2":** not recommended. The Babel/externals change (RP-13) would land on the oldest toolchain and then be re-verified through Next 11/12. Benefit is low, because W0.5 already freezes it.

### RP-15 (M, contradiction) W5 D0 re-captures baselines on an upgraded app
- **Evidence:**
  - 50 W5 Entry says "T-417, T-418, T-802 baselines captured **on `@oacore/design`**" (after W4, i.e. on Next 12).
  - 60 D0 says "Before touching anything, capture on @oacore/design … Snapshots committed".
  - 40 §6 last line says "Baselines are **never** re-captured from an upgraded app".
  - 40 T-802 is P0 "(before W5)".
- **Fix:** D0 = "re-run T-417/T-418/T-802 against the **phase-2 golden baselines**; they must be identical/0 px (this proves W0–W4 did not change design rendering). Never re-capture." If D0 fails, the regression belongs to W4 and goes through §9 triage.

### RP-16 (H) Several framework steps are combined into one prod deploy, so attribution is lost
- **Evidence:** 50 §4: W4 "Prod after (d)" bundles (b) webpack5, (c) Next 11.1 and (d) Next 12.3. W6 "Prod after (d)" bundles React 18 + Next 13.5 + 14.2. W7 "Prod after (c)" bundles Next 15 + React 19 + Next 16. This contradicts "Never combine two waves in one deploy" and the 95 % goal (SILENT prod-only effects such as Scholar indexing and GA hit shape cannot be attributed).
- **Fix:** every lettered step is a deployable unit that goes to prod on its own (each is green by construction), with a prod watch window (§5.1). This costs calendar time (RP-19), not person-days.

### RP-17 (M) The soak and canary are not measurable as defined
- **Evidence:**
  - Stage runs `replicas: 1` (`kube/stage/deployment.yaml:9`) on `stg.core.ac.uk` with almost no real traffic, so the T-902 metrics (Sentry rate, GA hits, p95) are near zero.
  - T-902 says "compared with the previous week" with no thresholds.
  - T-903 "Prod canary … observe 1 h" is actually a full `RollingUpdate` of all ≥4 pods (`hpa.yaml minReplicas 4`). No weighted route exists (`kube/prod/httproute.yaml` has a single `backendRefs`).
  - Stage SSR calls the **prod** in-cluster API (`kube/stage/deployment.yaml:49-52`), so synthetic load on stage loads production.
- **Fix:**
  - (a) T-902 = synthetic replay of a fixed URL list (200 URLs sampled from prod logs: search queries, works, outputs, data providers) at ≤2 rps for 24 h. Ops must approve the rate, because it hits the prod API. Thresholds: 0 pod restarts, 0 OOM, SSR 5xx = 0, p95 ≤ baseline ×1.10, RSS ≤ 700 Mi.
  - (b) Rename T-903 to "prod rollout watch". Optionally add a real canary: a second Deployment `core-frontend-search-canary` and HTTPRoute `backendRefs` weights 90/10 (ops change; Gateway API supports `weight`).
  - (c) Define the prod-watch thresholds (§5.1).

### RP-18 (M) Exit criteria and sign-off are not binary; artefacts are unnamed
- **Examples:**
  - W2 exit: "Sentry test event and GA hits verified on staging".
  - S: "Prod stable for 1 week".
  - Phase 2: "CI gates required on main and stage" (who sets branch protection?).
  - W4 entry: "W2, W3 green" (merged? in prod?).
  - Wave step 7: "T-904 items".
  - Sign-off appears only in OD-09.
- **Fix:**
  - Every wave/step produces `docs/upgrade/records/<step>.md` with these fields:
    - commit SHA(s) and integration PR;
    - image digests (stage, prod);
    - CI run URLs for G1–G5 (3 consecutive green runs);
    - T-801/T-802 diff report (0 px);
    - T-6xx/T-702 diff (empty);
    - soak metrics table vs thresholds;
    - prod-watch metrics table;
    - T-904 checklist with screenshots;
    - risks moved to MITIGATED/CLOSED;
    - sign-off lines: **Implementer**, **Reviewer** (a second engineer), **Ops** (rollout/rollback; the kube history shows beso tsiklauri / Andrew; confirm), **Owner** (accepts).
  - Replacement wording is in §10.

### RP-19 (M) Effort is underestimated and calendar time is missing
- **Phase 2: 15–25 d** for 114 test IDs (61 P0, 46 P1, 7 P2; `grep -cE "^\| T-[0-9]{3} \|"` = 114). Several IDs are matrices: T-801 is V1–V20 × 4 viewports, and there are 17 journeys. The harness has 8 open [VERIFY] items (MSW preload under `next start`, RouterContext, T-002 extraction, the harness approach…).
  - Bottom-up: harness and proxy 5–8, fixtures recorder and scrub 2–3, unit/store/hook (~45 IDs) 8–12, component (~25) 6–9, HTTP/SSR 3–5, journeys (17) 9–14, visual/axe stabilisation 4–7, golden image, CI and ops 3–5. **Total 40–63 d.**
  - Recommendation: a **5-day calibration spike** (harness + 1 test per layer, one green CI run), then re-estimate.
- **W0–S: 36–60 d.** Plausible for engineering, but there are about 22 serial deploy units after RP-16. Each needs at least a 24 h soak plus a 48 h prod watch, which adds **≥ 66 calendar days** of mostly waiting.
- **Phase 6: 15–25 d** is about 2.5× too low. §6 bottom-up gives 40–62 d.
- **Phase 7: 25–40 d.** §6 bottom-up gives 60–95 d. 0-px parity of antd internals (focus ring, wave effect, rc-dialog/rc-select DOM) is the cost driver, and the owned re-implementation of the non-antd units (RP-12) is not counted at all.
- **Add:** a calendar view (person-days vs elapsed) and a buffer line for [VERIFY] failures.

### RP-20 (H) Phases 6 and 7 are not executable (only outlined in 50 §5)
- See §6 for the complete plan. Concrete gaps in the outline:
  - **T-203** (reactivity contract) is MobX-specific (`isObservableProp`/`isComputedProp`). The T-2xx store tests call MobX class methods directly, so they **cannot be "re-run against zustand"**. A characterization suite rewritten for the new implementation no longer characterises the old behaviour (M3).
  - The **axios** defaults are not called out:
    - the default `Accept: application/json, text/plain, */*` differs from today's `Accept` (pinned by T-101/T-607);
    - the adapter choice matters: use `adapter: 'fetch'` so Node uses undici like today, which preserves Q-022 (Host ignored) and Blob handling;
    - `paramsSerializer` must reproduce URLSearchParams (arrays → `a%2Cb`, `undefined` → `'undefined'`, Q-016);
    - XSRF: same-origin only by default (axios README), and the API is cross-origin. Assert it anyway.
  - **swr:**
    - it does not abort superseded requests, while `invalidatePreviousRequests` does (`utils/invalidatePreviousRequests.js`). The T-702 network log will differ unless the fetcher wires an AbortController per key;
    - it revalidates on mount by default, so with gSSP `fallback` that is an extra request.
  - **zustand:** the plan says "never the dashboard's module singleton", but the **client must stay a singleton**. `store/index.jsx:12-21` keeps one client store across navigations (Q-010/Q-038 persistence). Only the server must be per-request.
  - **SWC (W9):** loses `useBuiltIns:'usage'` core-js injection and `add-react-displayname`. Grep for `.displayName`/`type.name` reads in search code before the switch (UNCONFIRMED whether any exist).
  - **antd SSR:** there is no `pages/_document.jsx` today. The cssinjs extraction needs one, and that changes SSR HTML (`<style>` tags). The parity contract (40 §1) has no allowed normalisation for that, so an owner-approved contract amendment is needed.
  - **Design global CSS** styles bare `button`/`[type=…]` (60 §3 Button) and `ul` (Q-068). Antd buttons will inherit these rules while design CSS is loaded, and change look again when it is removed. So global-CSS ownership (7.1) must come before the antd replacements, and the final removal must be re-verified.
  - **`@oacore/core-ui`** peers `antd ^5.27.6` / `react ^19.1.1`. Using it (for example `CrHeader`) conflicts with antd 6 latest and with M4 ("own"). This needs an OD.

### RP-21 (M) The README "next concrete step" order is inverted: baselines are captured before the tests exist
- **Evidence:**
  - README §8 steps 5→6: "Capture the baselines (40 §6 steps 1–12)", then "Write all 61 P0 tests".
  - 50 §3 work order: 2.3 capture baselines, 2.4 write P0 tests, 2.7 record fixtures (last).
  - But 40 §6 steps 6–9 produce baselines **by running** T-601…T-604, T-801/802, T-803/804 and every T-7xx "in record mode", and those tests need the fixtures from §2.4.
- **Fix:** the order is 2.1 harness and inertness proof → 2.2 fixtures recorded and scrubbed → 2.3 write tests (record mode) → 2.4 golden image → 2.5 capture baselines by running the tests from the golden image, 3× identical → 2.6 CI gates → 2.7 P1 tests.

### RP-22 (M, git) Baseline SHA and branch hygiene
- `f5cfc20` is local-only (27 local merge commits not on origin; tree = `cc0e228`). The README tags "currently `f5cfc20`", which a fresh clone cannot resolve.
- The `docs/upgrade-plan` branch sits on top of those 27 commits, so a PR would carry them.
- The local `origin/HEAD` points to `master` (stale), which makes tools suggest `master` as the PR base. `master` (last commit 2026-02-04) and `main.old` are legacy branches with stale open PRs (#389 Node 24 / React 19, #410 Next 15.5.14, 17 dependabot PRs).
- **Fix:** add to README §8:
  - "PR base = `main`. Run `git remote set-head origin --auto`.
  - Rebase the docs branch: `git rebase --onto origin/main f5cfc20 docs/upgrade-plan`.
  - Baseline commit = `cc0e228` (or whatever `origin/main` SHA phase 2 starts from).
  - Ignore `master`/`main.old`; close #389/#410 with a link to this plan (owner)."
  - The existing branch convention is `CORE-<ticket>-<slug>`. Use `upgrade/<step>-<slug>`, plus the Jira key if team policy requires it (UNCONFIRMED).

### RP-23 (M) Dependabot security PRs will bypass the waves
- **Evidence:**
  - 18 `dependabot/npm_and_yarn/*` branches, the latest 2026-04-08. There is no `dependabot.yml`, so this is the repo-level security-updates setting.
  - Earlier PRs targeted `main.old`. New ones will target the default `main`.
  - Merging one equals a prod deploy (RP-02) and changes the lock (R-015).
- **Fix:** owner/ops decide: during the track, label dependabot PRs `upgrade-hold` and fold their bumps into the next wave's CS list (never merge them standalone), or temporarily disable security-update PRs. Record this in 50 §4.

### RP-24 (M) Branch protection and required checks conflict with how ops work today
- **Evidence:** ops commit directly to `main` and `stage` (`9b26dc9`, `d219cca`, `044351c`, `0f8f4c0`, `e849311` have no PR numbers; "merge main into stage" `6e0a370`). G7 makes G1–G5 required on `main` and `stage`.
- **Impact:** without ops agreement, either G7 is not applied, which silently removes the gate, or ops are blocked.
- **Fix:** OD-29 must name the ops owner and agree on the kube/ change path (a PR with a paths filter, so kube-only changes skip G4). The protection rules of `environment: azure` (required reviewers?) are UNCONFIRMED. Check them in repo settings.

### RP-25 (M) 00-decisions does not encode M1, M4-ownership, M5, M6 (full), M7 or M8
See §9 for the amendment text. Notable points:
- the phase-6 list names react-router, which is **not** in M6;
- TypeScript, pure CSS, ESLint/Prettier/Husky and antd-as-library are missing;
- D1 covers "the upgrade" but must explicitly extend to phases 6–7 ("logic identical, no improvements").

### RP-26 (M) The OD blocker list is wrong; most ODs are resolvable now
See §8. Of the 9 "phase-2" ODs:
- **Truly owner-only and blocking phase 2:** OD-24, OD-25, OD-28. OD-29 is needed for phase-2 *exit*.
- **Resolvable now from evidence:** OD-01, OD-04, OD-15, OD-30.
- **Not phase-2:** OD-09 (needed before W6).
- **New phase-2 blockers:**
  - OD-31 change control (RP-04);
  - OD-32 stage cron and deploy-by-digest (RP-01/03, could be folded into OD-29);
  - OD-33 dependabot (RP-23);
  - OD-34 public-repo data policy (RP-27).

### RP-27 (M) The repo is public, which affects OD-24/OD-25 and the golden image
- **Evidence:** `curl api.github.com/repos/oacore/search` → `"visibility": "public"`.
  - OD-24 recommends committing baselines (PNG via LFS) and OD-25 commits recorded prod fixtures. Both become **public**: PII scrub, licensing of metadata and LFS bandwidth quotas all apply.
  - The golden image "kept for the life of the project" is built with `--build-arg NPM_TOKEN`, which stays in layer history (S-3, `Dockerfile:6,18`).
  - The 60-day inactivity rule disables crons in public repos (§1).
- **Fix:**
  - OD-24/25 options must state "public".
  - Build the golden image with `RUN --mount=type=secret,id=npm` or a token that is revoked after the build.
  - Push it only to the private ACR.

### RP-28 (M) "W1 in parallel with W2/W3" is infeasible, and W1 on Node 18 forces below-latest tooling
- **Evidence:**
  - There is one stage environment (`replicas: 1`) and one deploy path, so two waves cannot soak at once (RP-01/02).
  - W1's Prettier full reformat (CS-PRET-1) touches files that W2/W3 also edit (`utils/sentry.js`, `pages/_app.jsx`, `store/*`).
  - W1 on Node 18 cannot take ESLint 10 (`^20.19`), stylelint 17 (`>=20.19`), lint-staged 16/17 (`>=20.17` / `>=22.22.1`).
- **Fix:**
  - Serialize W1 → W2 → W3.
  - Pin lint-staged to `15.5.2` (Node 18) in W1, or move W1 after the Node wave (RP-08).
  - M6 says ESLint/Prettier/Husky come "after stability". Record why W1 may come early: it removes the private `@oacore/*-config` deps and has no runtime effect. Note the final dashboard-style config (ESLint 10 + typescript-eslint + react-hooks) as step 6.2.

### RP-29 (M) The T-802 harness page changes chunking, so T-801 on the same build does not represent prod
- **Evidence:** Next 10 `webpack-config.js:45`: `commons: { name: 'commons', minChunks: totalPages }`. Adding `/__design-harness` to the test build changes `totalPages` and therefore the commons chunk, the CSS chunk grouping and possibly the CSS order.
- **Fix (resolves OD-30):** two test builds:
  - `build:test`: no harness, used for T-6xx/T-7xx/T-801;
  - `build:harness`: the harness page is copied into `pages/` by the script only for that build, used for T-802.
- A prod build never contains the file. Prove it with T-004 (`/__design-harness` absent from the `pages-manifest`).

### RP-30 (M) The tested artefact is not the shipped artefact; there is no automated live smoke
- **Evidence:** the test build uses frozen data and test secrets (40 §2.5). The prod image is built separately with live data-loader output and `APP_ENV=production`, and stage is built again with `APP_ENV=staging` (findings 05:275 notes this). Only T-901 (curl) and T-904 (manual) touch real images.
- **Fix:** add **T-907 "live read-only smoke"**: Playwright run against `stg.core.ac.uk` after each stage deploy and against `core.ac.uk` after prod. It checks structure, not content:
  - status codes of the route matrix;
  - presence and order of `citation_*`/JSON-LD keys on 5 fixed works;
  - `_next/data` client navigation (R-002);
  - no `pageerror`;
  - CSS applied (computed style of 3 sentinel elements);
  - GA `collect` fired.

  Its results are required in the wave record.

### RP-31 (L, M8) Paths and fresh-session clarity
- The home-directory mount paths cited for the dashboard and design repos (`mnt/dashboard`, `mnt/design`) do not exist (listing the home-directory `mnt` directory → no such directory). The real paths are `../{dashboard,design,core-ui}`. Define a path table once in the README.
- `findings/baselines/eslint-baseline.json` has absolute sandbox paths (`<sandbox-root>/search/api/claim.js`). T-001 must normalise to repo-relative paths, or every finding counts as "new". The same applies to `stylelint-baseline.json` (28 occurrences).
- README §8 mixes a ~30-item verification checklist with the next steps. A fresh session needs one ordered **runbook** for "next session". Move the checklist into a `VERIFY` table with owner/status columns.

### RP-32 (L) OD-27 frames an M1-vs-M2 conflict as "keep old"
- `i18n-iso-countries@7` changes visible country names (R-031). `react-ga4@3` may change the hit shape. M1 wants latest; M2/M3 want identical UI.
- D1 already allows "a fix needed only to keep current behaviour working after an upgrade". The option missing from OD-27 is: upgrade, then pin the old names through a local override map (generated from the v6 `en.json` diff) and pin the GA hit shape through T-719.
- This is the owner's call, but the option must be listed.

---

## 3. Ordering analysis (direct answers to the brief)

| Question | Answer (with evidence) |
|---|---|
| Design vendoring earlier (right after phase 2)? | **Split it.** W0.5 = tarball vendoring right after phase 2 (freezes design, removes the floating tag and registry, zero code-path change; RP-14). W5 inline stays between W4 and W6. Moving the inline earlier would push the RP-13 Babel/externals change through webpack 4 *and* webpack 5 for no benefit. **CSS pipeline:** the tarball step is neutral (same `node_modules` import). The inline step is neutral for CSS (global import from `_app` is allowed, and the compiled JS has no CSS imports: `grep -rl '\.css"' node_modules/@oacore/design/lib | grep '\.js$'` → no output) but **not** neutral for JS (RP-13). |
| Node earlier? | Run a phase-2 experiment of Next 10 on `node:24-alpine`. If green, a Node-only wave right after W0.5. Node 18 has been EOL for 18 months, and staying on it blocks the latest tooling (RP-08, RP-28). |
| TypeScript before or after zustand/swr/axios? | **TS infrastructure first (6.1)**: tsconfig `allowJs`, `@babel/preset-typescript` with `onlyRemoveTypeImports: true` (so side-effect imports are never elided), a `typecheck` CI job, and build-output identity proven. Then write the new axios/swr/zustand modules **directly in TS** (no write-JS-then-convert churn). Then mechanically convert the rest (6.6). Do not convert MobX stores to TS (they are deleted in 6.5). |
| Where does "pure CSS" belong? | It depends on the RP-11 OD. P1 (standard syntax, modules kept): phase 6 (6.9), after TS and before Gate A. P2 (global CSS like the dashboard): the last sub-wave of phase 7, after antd has removed most component CSS. |
| antd incremental per component? | **Yes**, one unit per PR, behind the 0-px harness. Prerequisites: (1) 7.0 infra (`_document` + cssinjs + ConfigProvider tokens) proven 0 px with no component replaced; (2) 7.1 global-CSS ownership, so the bare-element rules (`button`, `ul`) form a stable owned layer while antd components arrive. Order: leaf first (Spin → Button → Link → Card → Popover → Modal → Form/Input → Select → Header search bar). Composite owned units are re-pointed last. |
| Design OWNERSHIP vs antd? | 7.1, **before** antd replacements, for non-antd units and the global CSS. Units that antd replaces skip source ownership (they go compiled → antd). Final step 7.F deletes `design/`. |
| Is M5 defined rigorously? | No (RP-05). Gate A is defined in §5.2. |

---

## 4. Corrected wave runbook (replaces 50 §4 "Every wave has the same shape")

**Preconditions, once, in phase 2 (OD-29/OD-32):**
- The stage cron checks out `stage` (RP-01).
- Deploys use digests (RP-03).
- `ci.yml` exists with G1–G5.
- Branch protection on `main` and `stage` with G1–G5 required, and the ops path agreed (RP-24).

**Per deployable step `<S>` (each lettered step of W0…W8, phase-6/7 sub-waves):**
1. `git fetch origin && git switch -c upgrade/<S>-<slug> origin/main`.
2. One PR per CS-group into `upgrade/<S>-<slug>`. Each bump is its own commit. ESCALATES fixes go in their own PRs (D1a) with sign-off recorded in 30. Each PR: G1–G5 green.
3. When the step is complete: 3 consecutive green G1–G5 runs on the branch head (flake = 0).
4. Open the PR `upgrade/<S>-<slug> → main`. **Do not merge yet.**
5. Stage: `git switch stage && git pull && git merge --no-ff upgrade/<S>-<slug> && git push`. The workflow deploys. Record the digest. Run T-907 on stage.
6. Soak 24 h with the T-902 synthetic replay (RP-17). At the start and the end, verify the stage pods run the recorded digest.
7. T-904 manual items for this step (only where the step touches GA, Sentry, LogRocket, SEO or design).
8. Merge the PR into `main` (merge commit, no squash, so per-bump commits stay revertable). The prod workflow deploys. Record the digest.
9. Prod watch **48 h** (§5.1 thresholds) plus T-907 on prod.
10. Re-align stage: `git switch stage && git merge origin/main && git push`.
11. Write `docs/upgrade/records/<S>.md` (RP-18). Update README §8. Set the step status to `DONE`.

**Rollback:**
- During 9: ops re-apply the previous recorded digest (`envsubst` with `IMAGE=<repo>@<prev-digest>`), then `git revert -m 1 <merge-sha>` on `main`. The revert deploy must produce the same `npm ls --omit=dev` tree as the previous digest.
- During 6: `git switch stage && git reset --hard origin/main && git push --force-with-lease`. Owner/ops approval is needed, because it rewrites stage. Alternatively merge a revert.
- Owner of the rollback: ops (needs `az aks get-credentials --admin`).

**Never:**
- two steps on stage at once;
- merging to `main` before step 6 has passed;
- updating a baseline outside the RP-04 protocol.

---

## 5. Gates and the confidence measure

### 5.1 Prod watch thresholds (used by every step)
Measure over the 48 h after rollout completes (excluding the rollout window, during which chunk 404s from mixed pods are expected today). Compare against the same weekdays of the previous 4 weeks:
- Sentry error events per 1,000 page views ≤ the 4-week P95 of the daily rate;
- SSR 5xx count ≤ the baseline P95;
- pod restarts = 0 and OOMKilled = 0;
- p95 latency of `/search`, `/works/*` ≤ baseline ×1.10;
- GA page_view/session ratio within ±5 %;
- T-907 green on prod.

Any breach → rollback first, investigate afterwards.

### 5.2 Gate A: pre-antd stability gate (M5), binary
Entry: phase 6 sub-waves 6.1–6.10 are `DONE` in prod.
All of these must be true at one commit `A` (recorded):
1. **Versions (M1):** `npm outdated --json` lists only packages in the M1 exceptions ledger, each `ACCEPTED` with an OD. `npm ci` without `--legacy-peer-deps` succeeds (T-008). `npm ls --all` exits 0. `npm audit --omit=dev --audit-level=high` = 0, or each advisory is listed and accepted.
2. **Suite:** 100 % of P0+P1 tests `DONE`. 3 consecutive green CI runs at `A`. Quarantined/skipped tests = 0. P2 tests either `DONE` or waived by owner in 90.
3. **Parity (vs the approved baseline chain, RP-04):**
   - T-801/T-802 0 px over the full matrix (all viewports);
   - T-6xx snapshots identical;
   - T-702/T-607 network logs identical;
   - T-701 zero new console/pageerror/CSP events in UTC, America/Los_Angeles and Asia/Tokyo;
   - T-803 no new axe violations;
   - T-001 lint parity (new tools).
4. **Risks/quirks:**
   - The 10↔40 traceability script prints 0 `GAP`.
   - Every C/H risk is `MITIGATED` or `CLOSED`. None is `OPEN`.
   - Every Q-### PINNED test is green.
   - Every ESCALATES is `FIXED` with sign-off.
5. **Detector efficacy (M7-2):** the seeded-fault catalogue (§5.4) shows 100 % detection, run at `A`.
6. **Production (M7-3):** the `A` digest has run in prod for ≥14 consecutive days. The non-inferiority test passes (§5.4). No rollback in the last 14 days.
7. **Docs:** README §8 updated. Every risk status final. The records exist for every step.
8. **Sign-off:** `docs/upgrade/records/gate-A.md` signed by Implementer, Reviewer, Ops and Owner.

Gate S (end of the version track) uses the same template with criteria 1–8, except that phase-6 items are N/A.
Gate F (end of phase 7) uses the same template plus:
- `rg -n "@oacore/design|from 'design" --glob '!docs/**'` → 0 hits;
- the `design/` directory is absent;
- every used unit maps to antd or to owned source (60 §3 checklist).

### 5.3 What "absolutely nothing broken" means operationally
It means only the union of criteria 2–6. Anything not covered by a test or a metric is, by definition, not proven. The gate record must list the **known residual gaps** from 40 §3.2 and the owner must accept them by name.

### 5.4 M7: measuring "≥95 % confidence" (proposed definition)
All three must hold:
1. **Coverage (M7-1).** Automated and green:
   - 100 % of C/H risks;
   - 100 % of catalogued journeys J1–J17, visual states V1–V20, endpoints E1–E21 and PINNED quirks;
   - ≥95 % of all R/Q/V/J/E items overall (weighted equally).

   Computed by a script over 10/30/40 and findings/06/07 IDs. The result is printed in the gate record.
2. **Detector efficacy (M7-2).**
   - (a) A **seeded-fault catalogue** with at least one fault per ★ SILENT risk (46). Each fault is applied on a throwaway branch and must turn its named detector red. Examples:

     | Fault | Detector that must go red |
     |---|---|
     | Delete the camelCase hack `next.config.js:45-77` | T-002 and T-801 |
     | Remove `useInterceptNextDataHref` (`pages/_app.jsx:70-80`) | T-702 |
     | Reorder `citation_*` in `modules/meta/index.jsx` | T-602 |
     | Make the server store a module singleton (`store/index.jsx:16`) | T-209 |
     | Send `Internal_API_HOST` as Host | T-607 |
     | Add axios's default `Accept` | T-101 |
     | Bump `@oacore/design` | T-008 |

     Detection must be 100 %.
   - (b) Mutation score (StrykerJS + jest runner; version to pin [VERIFY]) on `api/`, `store/`, `utils/`, `data/`, `hooks/`: ≥80 % killed, measured on the baseline and never lower afterwards.
3. **Production non-inferiority (M7-3).** Over ≥14 days after Gate S and after Gate A: a one-sided test at α = 0.05 that the post-change Sentry error rate per 1,000 page views ≤ pre-change rate × 1.05.
   - The pre-change rate comes from the 28 days before phase 2.
   - In addition, with zero regression reports in N prod sessions, the 95 % upper bound on the per-session regression probability is 3/N (rule of three). With N ≥ 30,000 sessions (UNCONFIRMED traffic; check GA) the bound is ≤0.01 %.

"≥95 % confidence" is then a precise, auditable statement: every catalogued behaviour is pinned (1), the pins are proven to fire (2), and production is statistically non-inferior at 95 % confidence (3).

---

## 6. Phases 6 and 7: complete executable plan

General rules (both phases):
- D1/M6: logic identical, no improvements.
- Every sub-wave follows the §4 runbook.
- No baseline changes, except approved parity-contract amendments listed below.
- Effort is in person-days. Calendar time = effort + about 3 days per deployable unit.

### Phase 6: dashboard functional libraries and tooling (entry: Gate S signed)

| Sub-wave | Scope / ordered steps | Entry | Required tests (beyond the full suite) | Exit (binary) | Rollback | Effort |
|---|---|---|---|---|---|---|
| **6.0 Contract decoupling** (no runtime change) | 1. Add a `test/drivers/store-driver.js` interface (actions/selectors per store: claim, report, similarWorks, dataProviders, search, filters, root). 2. Re-express T-2xx (incl. T-203's *observable effects*: which UI updates after which action) and T-209/T-210 against the driver. Implement the MobX driver. 3. Freeze the T-702/T-607 logs at the S commit as the phase-6 reference. | Gate S | All T-2xx pass through the MobX driver with identical results to their direct versions | Driver suite green, 3 runs. Old direct tests kept until 6.5 done. | n/a (tests only) | 4–6 |
| **6.1 TypeScript infrastructure** | `typescript@6.0.3` (RP-10). `tsconfig.json` (`allowJs`, `checkJs:false`, `noEmit`, `jsx: preserve`, `paths` = aliases in `next.config.js:86-100`). Commit `next-env.d.ts`. Add `@babel/preset-typescript` `{onlyRemoveTypeImports:true}` to `babel.config.js`. `typecheck` script + CI job G8. | 6.0 | T-003, T-004 | `.next/static` + `.next/server` byte-identical (build ID normalised) vs pre-6.1. `tsc` exit 0. | revert PR | 2–3 |
| **6.2 Lint parity with dashboard** | ESLint 10 flat config: `@eslint/js` + `typescript-eslint` + `eslint-plugin-react-hooks` (rules as dashboard `eslint.config.js`), Next-specific ignores. Drop react/import/jsx-a11y plugins (peer ≤ ^9) **or** keep ESLint 9 with an M1 exception (OD). Prettier latest. husky 9 + lint-staged latest (Node ≥22.22.1, `.nvmrc`). | 6.1, Node ≥22.22 | T-001 (new baseline captured on unchanged code) | No runtime diff (as 6.1). Hooks active. | revert | 2–3 |
| **6.3 axios** | New `api/client.ts`: an axios instance with `adapter: 'fetch'`. Override `headers.common.Accept` to today's value. `paramsSerializer` reproducing URLSearchParams + `?t=undefined`. `transformResponse` replicating the JSON regex (`api/index.js:93`) and Blob for non-JSON (Q-017). `validateStatus` + mapping to the `api/errors.js` classes (`status/data/type/headers`, message text). String body → `text/plain;charset=UTF-8` (Q-019). `withCredentials: true` (credentials include). Same `Authorization`/`Accept` on every host (S-2). Host behaviour per Q-022. `signal` passthrough. `LogRocket.captureException` once. Keep `api/index.js`'s exported signature. `data/data-loader.js` stays on its CS-N12-1 implementation (build-time script; owner may opt in). | 6.2 | T-101, T-102, T-103, T-104, T-115, T-117, T-5xx, T-607, T-702, T-205 | Request/response logs byte-identical (headers incl. `Accept`, `Content-Type`, no `X-XSRF-TOKEN`). Error objects deep-equal. | revert, redeploy previous digest | 4–6 |
| **6.4 swr** | `SWRConfig` global: `revalidateOnFocus:false, revalidateOnReconnect:false, revalidateIfStale:false, shouldRetryOnError:false, dedupingInterval:0`. Per hook `revalidateOnMount` matches today. `keepPreviousData` matches Q-010/Q-038. The fetcher holds an AbortController per key to replicate `invalidatePreviousRequests` (latest-wins **and** abort). Flows: filters aggregations, similar works, data-provider client lists, report/claim stay mutations. gSSP data passed via `fallback`; no SWR fetching on the server. | 6.3 | T-201, T-207, T-712, T-702, T-722, T-715 | Network logs identical, **including aborted requests**. Loading states identical (T-4xx DOM). | revert | 4–6 |
| **6.5 zustand** | `zustand@5` vanilla `createStore` per SSR request + **module singleton on the client** (as `store/index.jsx:12-21`). Context provider, `useStore(selector)`. `extend` once (Q-048). Immutable updates replicating in-place mutation visibility (R-030). Computeds → selectors. Replace `@invalidatePreviousRequests` with a function wrapper. One PR per store: claim → report → similarWorks → dataProviders → search → filters → root. Then remove mobx, mobx-react-lite and the decorator/class-properties Babel plugins (CS-BAB-1…5). | 6.4 | Driver suite (6.0) with the zustand driver, T-209, T-210, T-403, T-408, all journeys | Driver results identical MobX vs zustand for every case. No `mobx` in `npm ls`. | revert per store PR | 8–12 |
| **6.6 TS conversion** | Mechanical `.js→.ts`, `.jsx→.tsx` per directory (utils, api, hooks, lib, data, modules, templates, pages, main). Types only (`any` allowed). No statement edits. | 6.5 | Per PR: compiled output identity script (Babel output of the TS file with types stripped == output of the original JS) + full suite | `find . -name "*.js*" -not -path "./node_modules/*"` lists only config files. Build identical modulo module paths. | revert | 8–12 |
| **6.7 Babel → SWC** (optional, OD-12) | Remove `babel.config.js`. SWC targets from `.browserslistrc`. Jest → `next/jest`. Grep `displayName`/`.name` reads. Polyfills: compare core-js usage (T-724 browsers). | 6.6 | T-003, T-004, T-007, T-724, full suite | 0 px, network identical. Bundle within ±10 %. | revert | 2–4 |
| **6.8 Sentry latest** | `@sentry/nextjs@11` (peer `next ^16`). Config replicating today: same DSN, `tracesSampleRate:0`, no replay, `process.on` semantics (Q-009), CSP unchanged. Or `@sentry/react@11` if the owner accepts losing server errors (OD-14). | 6.7 or 6.6 | T-120, T-415, T-004, T-904 Sentry | Test events arrive (stage). No new browser requests except the Sentry ingest. | revert | 2–3 |
| **6.9 Pure CSS (P1 variant)** | Expand `@custom-media`, `@extend`, preset-env features into standard CSS. Codemod camelCase reads (221/50 files) and drop the `next.config.js:45-77` hack. Remove the PostCSS plugins. | 6.8 | T-002 (new form), T-003 normalised declaration **sequence** identical, T-801 | 0 px. No PostCSS plugins in `postcss.config.js` (or the file deleted). | revert | 3–5 |
| **6.10 Latest sweep L1** | Everything still below latest per the ledger: Node 26 (if LTS ≥1 month and green), Playwright/Jest/msw (golden re-capture protocol §7.5), stylelint 17, postcss, cssnano (if still used) | 6.9 | T-901, T-108 (new ICU set), full suite | Ledger contains only `ACCEPTED` items | revert | 3–5 |
| **Gate A** | §5.2 | 6.10 | everything | §5.2 | — | 3–5 |
| **Total** | | | | | | **43–70** |

Not in phase 6:
- react-router (N/A, OD-02; not in M6).
- Docker standalone (OD-19).
- pnpm (OD-06): M6 does not list it.

### Phase 7: antd rewrite, restyled to match exactly (entry: Gate A signed)

Parity-contract amendments needing owner approval **before 7.0**:
- (a) SSR HTML may contain antd cssinjs `<style data-…>` blocks; normalise by removing them from T-602 comparisons.
- (b) DOM structure may differ for replaced units. Roles, accessible names, focus order and keyboard behaviour may not (60 §6).

| Sub-wave | Scope / ordered steps | Required tests | Exit (binary) | Effort |
|---|---|---|---|---|
| **7.0 antd infrastructure + feasibility spike** | `antd@6.x` latest, `@ant-design/cssinjs` at antd's own range (`^2.1.2`, `npm ls` single copy). New `pages/_document.jsx` reproducing Next's default Document + `createCache`/`StyleProvider`/`extractStyle`. `ConfigProvider` with a token map derived from `design/foundation/*.css` (colours, font, radius, spacing) as a table in 60. No component replaced. **Spike:** Modal and Select in the T-802 harness reaching 0 px, time-boxed to 5 d, with the result recorded. If 0 px is not reachable, owner OD before continuing. | T-602 (with amendment a), T-801, T-701 (no hydration warnings), T-004 | 0 px everywhere with antd mounted. Spike report. | 6–9 |
| **7.1 Ownership (M4)** | Port each non-antd unit from `design/src` @ `bbc35a0` to readable source under `components/` (TSX, classic or automatic runtime chosen once): Icon + sprite builder (replace the design `bin/` with an owned script; latest `svgstore`/`svgo` only if T-005 stays identical), Logo/DataProviderLogo, Histoslider (d3 kept at installed versions unless T-705/T-802 prove identical with latest), MathMarkdown (katex: same rule), LoadingBar, Fieldset, ExpandableList, MetadataList, SearchResult, Footer, Header + search bar + DesignProvider (same commit, context identity), Cookies popup/provider/`useCookie` (cookie names unchanged, T-416), `classNames` both shapes. Move the global CSS closure (reboot, sanitize, foundation, helpers, bare-element rules) into owned `styles/global/`. | T-417 per unit, T-802, T-801, T-416, T-418, T-005, T-705 | Per unit 0 px + identical DOM snapshot. `design/` imports only from units that antd will replace. | 12–18 |
| **7.2 antd replacements, one unit per PR, leaf first** | ProgressSpinner→`Spin`; Button→`Button` (25 files); Link→`Typography.Link`/anchor; Card→`Card`; Popover (tippy)→`Popover`; Modal→`Modal` (Esc, backdrop, focus return, scroll lock: T-804); TextField/Form→`Form`/`Input` with `Form.useForm` (D3); Select (+advanced search)→`Select`. After each, re-point the owned composites that use it. | Per unit: T-802 0 px vs the golden harness screenshots, T-801, behaviour equivalents (T-704, T-709, T-711, T-713–T-715, T-719, T-804), T-701, T-702, T-803 | Unit removed from `design/` barrels. 0 px. Behaviour identical. | 30–48 (about 8 units × 3–6) |
| **7.F Removal + final sweep L2** | Delete `design/`, its CSS import and its dependencies (react-focus-lock, @tippyjs/react, react-slick leftovers, slick-carousel CSS once owned rules replace it). Latest versions for the remaining ex-design dependencies. If OD (RP-11) = P2: convert CSS Modules to global CSS here. | Full suite, T-008, T-005 | Gate F (§5.2 + removal criteria) | 6–10 (+8–12 if P2) |
| **Total** | | | | **54–85** (+8–12) |

Phase-7 OD needed: whether `@oacore/core-ui` may be used (peer `antd ^5.27.6`, `react ^19.1.1`; core-ui has a restyled `CrHeader`). Recommendation: **no**. Owned components only (M4). Core-ui's header/footer styles differ ("header/footer style rewrite", `core-ui` `0e9cfa5`), so they could never be 0 px against today's baseline.

---

## 7. Phase/wave-by-wave executability check (50)

| Step | Entry | Ordered steps | Binary exit | Tests | Rollback | Sign-off | Artefacts | Verdict |
|---|---|---|---|---|---|---|---|---|
| Phase 2 | partly (wrong ODs) | **inverted** (RP-21) | partly ("CI gates required" depends on ops) | yes | "revert" | none | golden digests | fix per RP-07/RP-21/RP-26 |
| W0 | yes | CS list | yes (T-003/T-004 identical) | yes | generic | none | none | add W0.5 tarball (RP-14). CS-W0-1 moves to phase 2 (RP-04). |
| W1 | "W0" | CS list | partly | T-001/T-801 | generic | none | none | serialize; lint-staged pin (RP-28) |
| W2 | "W0" | CS list | **not binary** ("verified on staging") | yes | generic | none | none | split Sentry/LR/GA/core-js/postcss into steps; thresholds |
| W3 | "W0" | CS list | partly ("reactivity contract identical") | yes | generic | none | none | OK after runbook |
| W4 | "W2, W3 green" (undefined) | a–e | "each step to stage; prod after (d)" (**infeasible**, RP-01/16) | yes | generic | none | none | each step to prod |
| W5 | contradiction (RP-15) | 60 D0–D6 | yes | yes | generic | none | none | RP-13 Babel exclusion; D0 = re-run |
| W6 | "W5" | a–d | "zero hydration errors" (binary) | yes | generic | OD-09 only | none | each step to prod |
| W7 | "W6" | a–c | "Prod after (c)" | yes | generic | none | none | each step to prod |
| W8 | "W5" | CS list | "0 px or skipped" | yes | generic | none | none | M1: skipping needs an ACCEPTED ledger entry |
| S | "W7" | "fix-only" | "Prod stable for 1 week" (**not binary**) | yes | — | none | none | use §5.2 template |

---

## 8. Open decisions: triage

"Resolvable" means the evidence or the owner's M-requirements already answer it. The owner should still confirm by changing the status line. **P2-blocker** = blocks phase-2 entry.

| OD | Proposed answer | Basis | Needs owner? | P2-blocker? |
|---|---|---|---|---|
| OD-01 per-wave loop | A | D4a wording "tests → upgrade → fix → stabilise"; M5/M7 attribution | confirm only | no (roadmap shape, not phase-2 work) |
| OD-02 stay on Next | A; react-router N/A | M6 does not list react-router. SEO meta and 308/404 need SSR (R-005). | confirm | no |
| OD-03 `_next/data` hack | A + prepare B | D1 | ops for B | no |
| OD-04 React-17 cap | A (W5), plus W0.5 tarball | M4 | confirm | no |
| OD-05 Node | **Re-scope:** Node 24 track, Node 26 end-state; phase-2 experiment Node 24 on Next 10 | RP-08 dates | **yes** | no (baseline = Node 18 regardless) |
| OD-06 npm vs pnpm | npm | not in M6; R-022 | no | no |
| OD-07 TS timing | Phase 6.1 infra → TS-first new modules → 6.6 conversion; TS 6.0.3 | RP-10 | **yes** (version exception) | no |
| OD-08 data-loader | A (preserve) | D1 | no | no |
| OD-09 ESCALATES | owner sign-off | D1a requires it | **yes** | **no** (needed before W6) |
| OD-10 webpack at Next 16 | `--webpack` until 6.9 removes the hack, then re-evaluate | R-001 | no | no |
| OD-11 CSS-module access | superseded by the new "pure CSS" OD (RP-11) | M6 | **yes** | no |
| OD-12 Babel vs SWC | Babel through Gate S; SWC at 6.7 | decorators gone at 6.5 | no | no |
| OD-13 MobX | 6.x latest (6.16.1) + mlr 4.1.x; removal in 6.5 is the reach-latest path | M1 ledger | no | no |
| OD-14 Sentry | W2 → 7.120.4 (latest 7.x; or 10.76.2 if the v8+ API change is acceptable on Node 18); 6.8 → `@sentry/nextjs@11` | registry | **yes** (nextjs vs react) | no |
| OD-15 lint | 1 parity yes; 2 keep consoles (D1); 3 ESLint 10 at 6.2; 4 yes; 5 keep Prettier (M6) and stylelint | D1, M6 | no | no |
| OD-16 browserslist | unchanged | D1 | no | no |
| OD-17 bibtex | A (keep) | D1 / "no improvements" | no | no |
| OD-18 dead deps | yes | no behaviour change | no | no |
| OD-19 standalone | no | not in M6 | no | no |
| OD-20 axios HTTP semantics | keep everything identical (incl. Host ignored, Q-022) via `adapter:'fetch'` | D1 + M6 "logic identical" | ops confirms which Host the in-cluster API expects | no |
| OD-21 vendoring source | compiled for W5 + ownership in 7.1 (RP-12) | M4 | **yes** | no |
| OD-22 strict mode | off | D1 | no | no |
| OD-23 SEO fixes | after Gate F, separate track | D1 | yes (later) | no |
| OD-24 baseline storage | must consider the **public** repo (RP-27) | — | **yes** | **yes** |
| OD-25 prod fixtures | must consider the **public** repo | — | **yes** | **yes** |
| OD-26 `future.webpack5` | yes | attribution | no | no |
| OD-27 text/analytics libs | add option "upgrade + pin old output" (RP-32) | M1 vs M2 | **yes** | no |
| OD-28 parity contract | approve; add the phase-7 amendments up front | — | **yes** | **yes** |
| OD-29 CI/deploy gating | approve; **add** stage-cron ref, deploy-by-digest, the ops path for kube changes (RP-01/03/24) | — | **yes** (+ ops) | **yes** for phase-2 exit |
| OD-30 harness | two test builds (RP-29) | `webpack-config.js:45` | no | no |
| **NEW OD-31** change control | freeze or re-baseline protocol (RP-04) | activity numbers | **yes** | **yes** |
| **NEW OD-32** dependabot during track | hold/fold (RP-23) | branches | **yes** | **yes** |
| **NEW OD-33** "pure CSS" meaning | P1/P2/P3 (RP-11) | Next docs | **yes** | no (phase 6) |
| **NEW OD-34** core-ui in phase 7 | no (RP-20) | peers | **yes** | no |
| **NEW OD-35** M7 metric | §5.4 thresholds (mutation %, non-inferiority margin) | — | **yes** | **yes** (it shapes phase-2 test work) |

---

## 9. Required amendments to 00-decisions.md (owner edits; proposed text)

- **D6 — Latest versions (M1).** "At every gate (S, A, F) every dependency is at the latest stable version on the npm registry on the gate date, except entries in the M1 exceptions ledger (README §3). Each exception gives the blocker with evidence and the step that reaches latest. Versions are re-checked with `npm view` at the start of every wave."
- **D1 extension.** "D1/D1a apply unchanged to phases 6 and 7: logic and behaviour identical, no improvements, quirks preserved. Phase 6/7 changes only the implementation."
- **D4b — Ownership (M4).** "End state (Gate F): no `@oacore/design` and no compiled vendor code. Every used design component, utility, icon and global CSS rule is either an antd component restyled to match (D5) or readable source owned by search. The design repo is deprecated and receives no changes for search."
- **D4c — Design freeze.** "From phase 2, `@oacore/design` stays at 5.0.74 (exact pin, then the vendored tarball). Header/footer content changes are made in search under the re-baseline protocol."
- **D7 — Gates (M5).** "Three gates: S (end of version track), A (before antd, after phase 6), F (end of phase 7), with the binary criteria in 50 §Gates. No antd work starts before Gate A is signed by Owner and Ops."
- **D8 — Confidence (M7).** "≥95 % confidence = the three measures in 40 §Confidence (coverage, detector efficacy, production non-inferiority at 95 %), all of which must pass at Gates S, A and F."
- **Phase order (replace the last block):** "6 = TypeScript (6.0.3, see ledger), axios, swr, zustand, ESLint 10 + typescript-eslint, Prettier, husky + lint-staged, pure CSS (per OD-33), Sentry latest. react-router: not applicable (OD-02). 7 = antd (with ownership of non-antd units)."
- **Change control (per OD-31).**
- **Docs rule (M8).** "README §8 holds exactly one ordered next-session runbook. Facts marked [VERIFY] carry an owner and a status."

---

## 10. Exact wording replacements (vague → executable)

| Location | Current | Replace with |
|---|---|---|
| 50 §3 Entry | "Owner answers OD-01, OD-04, OD-09 (at least provisionally)." | "OD-24, OD-25, OD-28, OD-29, OD-31, OD-32, OD-35 are `DECIDED` in 90. Design pinned to exact `5.0.74` (CS-W0-1, moved here). Baseline commit = an `origin/main` SHA (record it)." |
| 50 §3 Work | "2.3 Capture baselines … 2.4 Write all P0 … 2.7 Record fixtures" | Order per RP-21 |
| 50 §3 Exit | "CI gates required on `main` and `stage`" | "Branch protection on `main` and `stage` lists G1–G5 as required checks (screenshot of settings in `records/phase-2.md`). The stage cron builds `stage`. Deploys use digests." |
| 50 §4 step 1–9 | the generic shape | §4 runbook of this report |
| 50 §4 Rollback | "the previous image digest stays deployable … or re-run the deploy workflow on the previous commit" | "Re-apply the previous **recorded** digest (`IMAGE=<repo>@sha256:…`). Never rebuild for a rollback." |
| 50 W2 Exit | "Sentry test event and GA hits verified on staging (T-904)" | "T-904 items 1–3 ticked with screenshots in `records/W2x.md`. T-907 green on stage and prod. Prod watch thresholds §5.1 met for 48 h." |
| 50 W4 Exit | "Each step individually deployed to stage. Prod after (d)." | "Each of (a)–(e) goes to prod individually via the runbook." |
| 50 W5 Entry | "T-417, T-418, T-802 baselines captured on `@oacore/design`" | "T-417/T-418/T-802 re-run against the phase-2 golden baselines: identical / 0 px." |
| 50 S Exit | "Prod stable for 1 week" | "Gate S criteria (50 §Gates) all true, signed record `records/gate-S.md`." |
| 50 §5 Phase 7 precondition | "Phase 6 done." | "Gate A signed." |
| 50 §6 | "W1 can run in parallel with W2 and W3." | "No two steps are on stage or merging at the same time. Only test-writing runs in parallel." |
| README §8 step 3 | "Create a branch `upgrade/phase-2-safety-net` from `main`." | "`git fetch origin && git switch -c upgrade/phase-2-safety-net origin/main` (PR base `main`; local `origin/HEAD` may point to `master`: run `git remote set-head origin --auto`)." |
| 40 §6 step 1 | "identical `.next/static` file hashes" | RP-07 wording |
| 40 T-902 | "compared with the previous week" | RP-17 thresholds + synthetic replay |
| 40 T-903 | "Prod canary … observe 1 h" | "Prod rollout watch 48 h, §5.1 thresholds (no canary exists unless OD-29 adds a weighted route)" |

---

## 11. Registry snapshot used (2026-10-19, `npm view <pkg> version`)

next 16.4.2 (engines `>=20.9.0`); react/react-dom 19.3.1; antd 6.6.6 (peers react ≥18; deps `@ant-design/cssinjs ^2.1.2`, `@ant-design/icons ^6.3.4`); @ant-design/icons 6.3.4; @ant-design/nextjs-registry 1.3.0; zustand 5.0.15 (peer react ≥18); swr 2.5.1; axios 1.20.0; typescript 7.0.2 (6.0.3 previous); typescript-eslint 8.71.2 (peer TS `<6.1.0`); eslint 10.13.0; @eslint/js 10.0.1; eslint-plugin-react 7.37.5 (peer eslint ≤ ^9.7); eslint-plugin-import 2.32.0 (≤ ^9); eslint-plugin-jsx-a11y 6.10.2 (≤ ^9); eslint-plugin-react-hooks 7.1.1 (^10 ok); prettier 3.9.10; husky 9.1.7; lint-staged 17.6.0 (Node ≥22.22.1; 16.4.0 ≥20.17; 15.5.2 for Node 18); stylelint 17.16.0 (16.26.1 last 16); mobx 7.0.6 (6.16.1 last 6); mobx-react-lite 5.1.0 (4.1.1 last 4); @sentry/* 11.8.0 (10.76.2 last Node-18-compatible; 7.120.4 last 7.x); logrocket 12.4.0; react-ga4 3.0.1; jest 30.5.2; @testing-library/react 16.3.3 (12.1.5 peer react <18); @playwright/test 1.64.1 (Node ≥20); msw 3.0.3 (Node ≥22.12; 2.15.0 last 2.x, Node ≥18); jest-fixed-jsdom 0.0.11; postcss 8.5.31; postcss-preset-env 11.6.1; postcss-custom-media 12.0.3; cssnano 9.9.0; @babel/core 8.0.7; i18n-iso-countries 7.14.0; leaflet 1.9.4; core-js 3.51.0; react-router 8.5.0 / react-router-dom 7.18.4; classnames 2.5.1; dayjs 1.11.23; katex 0.19.0; d3-scale 4.0.2; d3-array 3.2.4; react-cookie 8.1.2; throttle-debounce 5.0.2; svgo 4.1.0; yargs 18.2.0; cosmiconfig 10.0.1; @mdi/svg 7.4.47; sanitize.css 13.0.0; slick-carousel 2.0.0; @tippyjs/react 4.2.6; react-focus-lock 2.13.7; npm-run-all2 9.0.3.

## 12. UNCONFIRMED (needs a run or the owner)
- The exact failure mode of re-transpiling the compiled design CJS with search's Babel (RP-13). The mechanism (babel-loader include/exclude, server externals) is confirmed from Next 10 source.
- Whether Next 16's build type-check works with TypeScript 7.
- Next 10.2.3 runtime behaviour on Node 24 (proposed phase-2 experiment).
- Prod traffic volume for the rule-of-three bound (GA).
- `environment: azure` protection rules, and the ops owner names (inferred from commit authors of `kube/`).
- StrykerJS version and compatibility with the Jest 29/Babel setup.
- Whether search code reads `displayName`/`Function.name` (before the SWC switch).
