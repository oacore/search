# 42 - Baselines, artefacts and CI

**Purpose.** What is built and compared, and how CI makes and guards it. **Read it** for harness (2.1-2.6), baseline or workflow work. **Owns:** artefacts, Docker recipe, runtime env, compose, G, golden image, inertness and stability proofs, storage, ledger formats, chain B0..Bn, CI-1..CI-8. `TCD-##` = review:tooling-ci-deploy.

## 1. Artefacts

| Artefact | `data/`; `BUILD_SCRIPT` | Use |
|---|---|---|
| Parity image (any commit) | frozen `test/fixtures/data-snapshot/` (= `data/` at G); `build:test` | all CI tiers; 0-px, SEO, header, network gates; A/B; C1, C4. Never deployed |
| Golden image (G, §4) | same | B0 (§9), canary, C4 reference; rebuilt from G when needed (§4), never deployed |
| Release image (deploy workflows; per env and commit) | live loader (`package.json:76`); `build` | stage, prod (today's workflows); the same recipe in CI for T-009, T-014 (b) and the live A/B. Never for parity gates |

`APP_ENV` is inlined in the client bundle (`env.config.js:1,25-27`): no stage-to-prod promotion. Parity and release images differ only in `data/` and build args (R-091); T-014 case (b) proves it on every step head (01 §4 step 3a).

## 2. Single Docker recipe

One `Dockerfile` (a `Dockerfile.test` would need a CI-1 equality diff). Changed lines after 2.1 (CS-W0-7/8/9, 20):

```dockerfile
# syntax=docker/dockerfile:1
ARG NODE_VERSION=18
FROM node:${NODE_VERSION}-alpine@sha256:<index digest, STATUS §1 Base images>
# :2-16 unchanged, ARG NPM_TOKEN removed
COPY package.json package-lock.json design.config.js ./
RUN --mount=type=secret,id=npm_token printf '@oacore:registry=https://npm.pkg.github.com/\n//npm.pkg.github.com/:_authToken=%s\n' \
    "$(cat /run/secrets/npm_token)" > .npmrc && { npm ci --include=dev --legacy-peer-deps || npm install --include=dev --legacy-peer-deps; }; \
    rc=$?; rm -f .npmrc; exit $rc
COPY . .
ARG BUILD_SCRIPT=build
# :21-29 unchanged; :24 runs `npm run ${BUILD_SCRIPT}`
```

- **Base image digest:** the `Digest:` line of `docker buildx imagetools inspect node:<v>-alpine`, recorded in STATUS §1 at 2.1 (18), W4e (24), 6.10 (26).
- **W0** (CS-W0-4): install becomes `{ npm ci <flags> --fetch-retries=5 || { sleep 10 && npm ci <flags>; } || { sleep 30 && npm ci <flags>; }; }` (non-zero if all fail; no `for` loop, TCD-19).
- **W0.5, W5** (CS-DSN-1/-2, 60 §5): `COPY vendor/ ./vendor/` before `npm ci`; from W5 `npm ci --install-links`.
- `package.json`: `"build:test": "node ./node_modules/.bin/design build icons && next build"`.
- `.dockerignore`: `.git .next node_modules .env* .npmrc docs test e2e scripts tools kube .github *.md public/design public/icons public/icons.svg`.
- `scripts/build-image.sh <parity|release> <ref> <tag>` (new): `git archive <ref>` into an empty dir; parity adds `cp -a <ctx>/test/fixtures/data-snapshot/. <ctx>/data/` (from 2.2; at 2.1 the tracked `data/.{formap,members,statistics}.json` of `<ref>` stay) and args `BUILD_SCRIPT=build:test APP_ENV=production API_KEY=test-key` + GA/DSN test values (40 §2); `NODE_VERSION` per 02; `docker buildx build --platform linux/arm64 --secret id=npm_token,env=NPM_TOKEN --metadata-file out/<tag>.json`, plus `--build-arg NPM_TOKEN=$NPM_TOKEN` when `git show <ref>:Dockerfile` declares `ARG NPM_TOKEN` (every ref before CS-W0-8, incl. `<base'>`; such images are never pushed); prints the digest. Release builds stay inline (`aks_deploy.yml:51-60`).

**Runtime env contract** (CS-NODE-5, R-082; `next start` re-reads `next.config.js`, TCD-25): image ENV `BUILD_TARGET=azure`, `NODE_ENV=production`, `APP_ENV` (`Dockerfile:10-15,21-22`; no `BUILD_TARGET` = assets under unrouted `/_next/static`, `utils/helpers.js:1-2`); k8s secret keys incl. `API_KEY` (absent = start throws, `env.config.js:19-22,34`); `NODE_OPTIONS=--max-old-space-size=1024` (overrides the image value) and `UV_THREADPOOL_SIZE=32` (`kube/prod/deployment.yaml:41-44`); `Internal_API`, `Internal_API_HOST` (`:50-53`, read in `api/internalize.js:17-18`). Harnesses set exactly this, appending test flags to `NODE_OPTIONS`. T-901 asserts the image ENV; T-721 without `BUILD_TARGET` must fail (negative control).

## 3. Compose topology (`e2e/compose.yml`)

| Service | Image | Role |
|---|---|---|
| `app` | `${APP_IMAGE}` by digest | §2 env: `API_KEY=test-key`, `Internal_API=http://stub`, `Internal_API_HOST=api.core.ac.uk`, `NODE_EXTRA_CA_CERTS`; `BUILD_TARGET`, `NODE_ENV`, `APP_ENV` only from the image; `mem_limit: 768m`; egress-denied network, resolver `dns`; healthcheck `/api/healthz/` |
| `stub` | Node by digest, `test/ssr/stub.mjs` (40 §2.2) | SSR stub :80, other hosts :443 (test CA); records at the socket |
| `dns` | dnsmasq by digest | `address=/#/<stub>`, `log-queries` (40 §2.2) |
| `proxy` | nginx by digest | from `e2e/proxy/generate.mjs` (T-612): `:8080` gateway-faithful, `:8081` allow-all (40 §2.3); to `app:8080` |
| `runner` | built in the job from `e2e/runner/Dockerfile` (40 §5) | profile `test`, `ipc: host`, base URL `http://proxy:8080` |

`APP_IMAGE=<repo>@sha256:<d> docker compose -f e2e/compose.yml up -d --wait app stub dns proxy`; tiers: 40 §10. A/B = two projects (`-p ref`, `-p cand`); profile `live` (GATE-x.6 live A/B) drops `stub` and `dns` and allows egress to the API host only. **One pinned Playwright image:** the runner is `e2e/runner/Dockerfile` (the Playwright base by digest plus pinned font packages, 40 §5), built in each job and never pushed; a change to that file is a tool change (§9). Every pixel capture and compare runs in it on `ubuntu-24.04-arm` (linux/arm64, the architecture of the deploy runner and of AKS); no other host's pixels count (the §6 item 5 Mac runs only measure VF-10).

## 4. Golden commit G and golden image (2.4)

**G** = the first merge commit on `main` after the 2.0-2.3 PRs whose `git diff --name-only <base> G` touches only `test/ e2e/ docs/ scripts/ tools/ .github/`, `kube/` (CS-OPS-1 must be in G, so the T-612 proxy has final routing), `Dockerfile`, `.dockerignore`, `package*.json`, Jest/lint configs; tag `upgrade-golden` = G on origin (owner). `<base>` = `cc0e228` (tree `a825839`) or the last product merge before 2.4 (STATUS §1); later product changes need D15. G passes §5 and all P0.

**Golden image** = `build-image.sh parity G B0` in `baseline-capture.yml` (mode `golden`). Not stored (OD-46): a job that needs it rebuilds it from `upgrade-golden`; if VF-09 shows two builds of one tree differ, it is instead pushed once to the registry the existing deploy already uses (`corecontainers.azurecr.io/search-reference`) and pulled by digest. A build is accepted when T-901, T-006 green; image `npm ls --omit=dev --all --json` = the `<base>` record (T-013; catches an `npm install` fallback); no token in `docker history`; from B0 on, every tier green against the committed B0 (0 px, snapshots identical). STATUS §1: G, the first build's digest, Node, build date.

## 5. Inertness proof (2.1)

All must hold (R-084). Reference **`<base'>`** = `<base>` + CS-W0-9 only (the first 2.1 PR; SHA in STATUS §1): `<base>` has no `build:test` or `ARG BUILD_SCRIPT`, and its `npm run build` runs the live loader (`package.json:76`).
1. T-014 on `<base'>`: two parity builds identical (`.next/static` + `.next/server`, buildId normalised). If not: record the nondeterministic files, exclude them in item 2; VF-09 stays open (VG-5 off, 55).
2. Parity builds of `<base'>` and the 2.1 tree: identical the same way; image size delta recorded.
3. T-013: `scripts/lock-immutable.mjs` (old lock entries keep `version`, `resolved`, `integrity`); `npm ls --omit=dev --all` identical; drift pinned by `overrides`; Playwright and axe only in `e2e/package.json`.
4. R-054 packages (`node-fetch`, `@mdi/svg`, `@babel/runtime`, `yargs`): same `require.resolve` path and version in both images.

## 6. Capture and stability proof (2.5)

Needs the golden image (§4) and the committed fixtures (2.2).
1. `baseline-capture.yml` mode `golden`: record mode (40 §10) of T-6xx, T-7xx, T-8xx 3x into `out/c1..c3`; `diff -r out/c1 out/c2 && diff -r out/c1 out/c3` exits 0. A difference is a determinism bug (40 §5), never a mask.
2. From the image `.next` (`docker cp`): inputs of T-003, T-004, T-005, T-007, T-010; T-001 lint baseline.
3. `test/baseline/env.json`: image `process.versions`; runner `fc-match` per family of the design font stack; `npx browserslist`; `npm ls --all --json`; digests; tool versions; date. Record image size and RSS (idle, after the P0 sweep).
4. PR `baseline/B0` commits the captures and the §7 files (empty ledger); owner signs; STATUS §1 chain = B0.
5. **Stability proof** (review:00 X40.12, VF-10): 10 compare runs of all tiers vs B0, `retries: 0`, over 2 days; 7 on `ubuntu-24.04-arm`, 3 on a dev Mac (Docker Desktop arm64); half `--workers=1`, half `--workers=4`; file order permuted by a recorded seed [VERIFY: Playwright keeps CLI file order, else vary `--shard`; VF-10]. Exact comparator (40 §1). Pass = 10/10 green, every `diff-pixels` annotation 0; each run recorded. Only the Mac differs: pixel tiers run on CI only (VF-10 answer). CI unstable: not done.

## 7. Storage (OD-24, OD-25, OD-46)

Why baselines are stored at all: the "UI unchanged" check (D7; T-801/T-802, 40 §1) compares every wave's build with screenshots and outputs of today's app; once the code has moved, those captures are the only record of today. Everything the checks compare with is committed in this repo next to the tests; no registry artefacts, no new infrastructure (OD-24, OD-46, decided 2026-10-20).
- **Committed:** screenshots in Playwright's default snapshot folders next to each spec (`e2e/**/<spec>-snapshots/`); build-derived baselines `test/baseline/build/` (`.gitignore` gains `!test/baseline/build/`, 2.1); `test/baseline/{manifest.json,SHA256SUMS,env.json,ACCEPTED-DIFFS.yml}`; `e2e/http/contract.baseline.json`; `test/fixtures/data-snapshot/`; recorded fixtures (2.2) and the C4 corpus (sanitised URL list and recorded responses, 2.5), each only after the 40 §6 PII scrub and licence check (public CORE data; never a key or token; the PR names the checker); signals exports `test/signals/<tag>.json` (aggregates and hashed group keys, 55 C6-NI).
- **Corpus URLs** come from user traffic logs, so only a sanitised form is committed: path and ids kept; query structure kept (parameter names, operators, field prefixes, quotes, encoding, token count and script); each free-text term replaced by a word drawn (recorded seed) from the work titles in the committed 2.2 fixtures, unless that exact query string came from ≥10 distinct clients in the window (counted on the raw extract); no IP, user-agent, referrer, cookie or timestamp field. Sanitising runs before recording, so the recorded responses belong to the committed URLs. The scrub report (rules, terms replaced and kept, a grep of the committed files for IP, email and token patterns = 0) is named in the corpus PR; the owner signs it.
- **Not in the repo:** the sealed C1 batch until its gate run (55 C1 (b)); the golden image (§4); unscrubbed recordings and the raw log extracts (`$ARTIFACT_DIR`, 40 §2).
- `manifest.json` = `{link, fixtures, baselines, corpus}` SHA-256 sets per chain link; `sha256sum -c test/baseline/SHA256SUMS` runs before every compare. A new link is a new commit; nothing is rewritten or deleted.
- **Size:** plain git while every file is <50 MB and the committed test data stay <500 MB; past either, the owner moves the largest folders to Git LFS (objects public too) in one PR [VERIFY: size after 2.5; estimated 60-100 MB, review:00 X40.33].

## 8. Ledger formats

**`e2e/http/contract.baseline.json`** (T-603 record mode; routes in 41): `{link, reference, routes:[{id, class, via: origin|proxy, method, request-headers, url, expect}]}`; cases per route class: GET, HEAD, conditional GET with the returned `ETag` (`If-None-Match`), `Accept-Encoding: br, gzip`; `expect`: status and every response header (lower-case name → ordered values), exact; `date` ignored; `etag` and `content-length` presence only; an added or removed header is a diff; a change is an owner-signed AD row. Classes: HTML (gSSP, gIP-only), `_next/data`, `public/`, `_next/static`, `.map`, `icons.svg`, 308, 404, 500, healthz (review:00 X40.10).

**`test/baseline/ACCEPTED-DIFFS.yml`**, the single ledger (OD-39 framework deltas, OD-37 minifier, CSP/log text, D15). `kind`: `delta` (framework/library output) or `product` (D15); `key`: route/header, selector, file+class or `V##@viewport`; `from`: the chain-head value; IDs never reused:

```yaml
- id: AD-###
  kind: delta
  test: T-603
  key: 404@origin/cache-control
  from: <absent>
  to: private, no-cache, no-store, max-age=0, must-revalidate
  reason: Next 12.3 adds Cache-Control on 404 (review:http-contract HC-06)
  ref: [OD-39, R-083]
  step: W4d
  repro: <CI URL of the framework-probe run showing the same diff>
  signedOffBy: <name>, <URL of the SIGNED: comment>
  date: <YYYY-MM-DD>
```

Default deny: a diff passes only if a row matches `test`, `key`, `from`, `to` exactly; keys are exact literals (no globs), one row per (test, key). Append-only; the only edit allowed adds `withdrawn: <reason, date>`. `signedOffBy` = `<name>, <comment URL>`; `scripts/ad-ledger.mjs` (CI-1) checks each through the GitHub API (`gh api repos/oacore/search/issues/comments/<id>`): the comment exists, its author is the owner (login in STATUS §1 People), its body starts with `SIGNED:` and names the AD id; else CI fails. A `kind: delta` row also needs `repro:`: a CI run of the **framework probe** showing the same (test, key, from, to). Probe = `origin/main` at the step's branch point plus only the step's dependency-bump commits (`package.json`, lock), built as a parity image; if that does not build, a minimal pages-router app `test/framework-probe/` (harness file, 40 §8) at the old and new versions. A diff that appears only with a CS row applied is that row's change, never `kind: delta` (fix it, or D15 or an OD). CI rejects a delta row without `repro:`. `kind: delta` never covers T-801/T-802 (0 px, D7), a status code (sole exception: T-612's `/static/search/_next/image` row, OD-41) or a `Location` (30 §1 rule 3). Unused rows go in the step record; every gate record lists the rows in force with counts per kind (55 §8). Baseline files are never edited.

## 9. Baseline chain, re-capture, re-baseline

STATUS §1 lists B0..Bn: {n, kind golden/tool/product, reference, baselines SHA-256 set, runner Dockerfile hash, tool versions, commit, PR, date, signer}. Candidates are compared with the chain head, ledger applied. Links after B0 are added only as below, by a PR touching only `test/baseline/*`, the snapshot folders, the contract file, tool pins and STATUS §1; owner signs; never while a step is between its runbook step 3 and the end of its watch ([01](01-playbook.md) §4).

**Tool re-capture** (Playwright, browser, runner, fonts; incl. the GATE-S Playwright bump):
1. Harness PR; `baseline-capture.yml` mode `recapture` captures the chain-head reference 3x byte-identical.
2. New tool on the current `main` parity image vs the new captures: green. Red: drop the tool, or triage as a last-step regression (40 §9).
3. Only then test candidates on it. Link: same reference, new baselines.

**Product re-baseline** (D15, OD-31, R-089); the PR lands alone, never inside a step:
1. Mode `rebaseline`: parity images of `before` = `main` head and `after` = `refs/pull/<n>/merge`, 3 captures each.
2. `before` vs chain head: no diff (else stop).
3. `after` vs `before`: diffs only in the regions/keys declared in the PR; one `kind: product` row each, `ref: [OD-31]`.
4. Owner signs; merge. Link: reference = `after`; golden never rebuilt.

## 10. CI (CS-NODE-4, 2.6)

`ubuntu-24.04-arm`; actions pinned by SHA; no path filters on required workflows (skipped required checks hang, TCD-27).

| Workflow (new) | Created | Trigger | Does |
|---|---|---|---|
| `ci.yml` | prototype 2.1, full 2.6 | `pull_request` (`main`, `stage`, `upgrade/**`), `merge_group`, `workflow_call`, dispatch | jobs below; `contents: read` |
| `baseline-capture.yml` | 2.4 | dispatch, `mode` | §4, §6, §9; write `contents`, `pull-requests`; opens the link PR with the captures |
| `golden-canary.yml` | 2.5 | nightly, dispatch | e2e tiers on the chain-head reference; red = environment drift (40 §9); head checks need a success < 48 h old (TCD-31) |
| `gate-s.yml` | 2.5 | dispatch: candidate, N, `live` | A/B in one job (same runner, diffed through the ledger) + C4 replay, 3 clean runs; refuses equal digests; positive controls from `test/faults/controls.json` (55 C4); `live`: the GATE-x.6 A/B on release-recipe builds; at gates and the 55 C4 steps |
| `soak.yml` | 2.5 | dispatch: ref | C6-CI (55): reference, candidate and golden parity images at prod limits, interleaved corpus replay through the stub; every deployable step from W0, 2.8 calibration, the gate C6-CI run (55 GATE-x.6) |
| `faults.yml` | 2.7 | dispatch: ref, `sealed` (gate) | C1: per `test/faults/{R,Q}-###*.patch` (or, with `sealed`, the gate's sealed batch from the Reviewer's branch `faults/sealed-<gate>`, once, checked against the committed SHA-256 list; its build faults must turn their detectors red) (`git apply --3way`, stale patch fails; design-path Q patches in a derived image) an image + all tiers; validity incl. `.expect` (55 C1, C1-Q); kill matrix, single-layer flag if only T-801 is red |
| `mutation.yml` | 2.7 | dispatch | C2: StrykerJS on tooling Node, file set and threshold per 55; at 2.7, steps touching the set, gates |

| `ci.yml` job | CI | Node | Steps |
|---|---|---|---|
| `lint` | CI-1, CI-8 | tooling 24 | `npm ci`; `scripts/lint-parity.mjs` (T-001); docs check (40 §10); `scripts/ad-ledger.mjs` (signatures, §8); CI-8: `npm audit --omit=dev --audit-level=high --json` into `scripts/audit-gate.mjs` (allow-list `d3-color`, 02), `continue-on-error: ${{ vars.AUDIT_BLOCKING != 'true' }}`; owner sets it `true` when W7a (first Next >= 15.5.24) is in prod |
| `unit` | CI-2 | step runtime (02) | Jest on the committed fixtures, `TZ=UTC` (40 §10); coverage (C3) |
| `image` | CI-3, CI-5 | - | `build-image.sh parity HEAD ci`; `docker save` to artifact; T-002..T-018 (41) on the image `.next`; CI-5 = T-901 (`--memory 768m`, §2 env) + T-721 negative control |
| `e2e` | CI-4 | - | `docker load` (image ID = `image` output); runner built (§3); §3 compose; tiers G-I (41); report, traces |
| `gate` | CI-7 | - | `needs` all four, `if: always()`; fails unless all are `success` |

- **CI-6** WITHDRAWN (2026-10-20, with OD-29): the deploy workflows stay as today (no `needs: ci`, no nightly change). T-009 and T-014 (b) run on a release-recipe build of every step head instead (01 §4 step 3a); deployed data are checked on prod by T-907 (provider count).
- **CI-7** (owner): `main` requires a PR and one check, `CI / gate` (job `gate`, workflow `CI`); `stage` stays as today; screenshot in `records/phase-2.md`.
- `setup-node`: `registry-url: https://npm.pkg.github.com`, `scope: '@oacore'`, `NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}` (also a Dependabot secret). Forks get no secrets: re-push to `oacore/search` [VERIFY: `NPM_TOKEN` scope repo vs `azure` env: VF-16].
- Head check (01 §4 step 3): `<B>` contains `origin/main`; checked SHA = its head. Counted: the `pull_request` run (it tests `refs/pull/<n>/merge`, whose tree equals the checked SHA's while `origin/main` is an ancestor of `<B>`) and its re-runs (`gh run rerun`, same commit), and `gh workflow run ci.yml --ref <B>` dispatches; the last 3 runs or attempts at the checked SHA are `success` (`gh run list --workflow ci.yml --commit <checked SHA>`, `gh run view <id> --attempt <n>`).
