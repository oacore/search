# 42 - Baselines, artefacts and CI

**Purpose.** What is built and compared, and how CI makes and guards it. **Read it** for harness (2.1-2.6), baseline or workflow work. **Owns:** artefacts, Docker recipe, runtime env, compose, G, golden image, inertness and stability proofs, storage, ledger formats, chain B0..Bn, CI-1..CI-8, the local full-suite run (§10). `TCD-##` = review:tooling-ci-deploy.

**Lean mode (D18–D20, 2026-10-22; [00](00-decisions.md) §4b).** Every artefact is built and compared on one workstation: a "parity image" is a host parity build (§2), the compose topology is replaced by host stacks (§3), the golden image by host builds of G (§4), the CI workflows by `bash scripts/ci-local.sh` (§10). The `Dockerfile` stays as at `f5cfc20`; its changed lines below are deploy-time items only ([20](20-change-sites.md) §Deploy-time items). Where a sentence below needs Docker, a registry, GitHub or a CI runner, it is WITHDRAWN (D19, D20) or DEFERRED as marked.

## 1. Artefacts

| Artefact | `data/`; `BUILD_SCRIPT` | Use |
|---|---|---|
| Parity image (any commit) | frozen `test/fixtures/data-snapshot/` (= `data/` at G); `build:test` | all CI tiers; 0-px, SEO, header, network gates; A/B; C1, C4. Never deployed |
| Golden image (G, §4) | same | B0 (§9), canary, C4 reference; rebuilt from G when needed (§4), never deployed |
| Release image (deploy workflows; per env and commit) | live loader (`package.json:76`); `build` | stage, prod (today's workflows); the same recipe in CI for T-009, T-014 (b) and the live A/B. Never for parity gates |

`APP_ENV` is inlined in the client bundle (`env.config.js:1,25-27`): no stage-to-prod promotion. Parity and release images differ only in `data/` and build args (R-091); T-014 case (b) proves it on every step head (01 §4 step 3a).

## 2. Single Docker recipe

**Deploy-time items, not applied (D19, 2026-10-22):** the `Dockerfile` keeps its `f5cfc20` content (`git diff f5cfc20 -- Dockerfile` empty); the lines below were the first plan's design and are kept for the owner (20 §Deploy-time items). The tests build on the host (last bullet).

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
- **Parity build (local mode):** `node scripts/build-parity.mjs [--ref <ref>] [--variant harness|nodsn]`: `git archive <ref>` into an empty directory, the frozen `test/fixtures/data-snapshot/` copied into `data/`, the installed `node_modules` reused (01 §10), `npm run build:test` with `APP_ENV=production API_KEY=test-key` and the GA and DSN test values (40 §2), then the copies of `Dockerfile:24-27`; the build key covers the runtime tree, the snapshot, the variant and the install (`--key-only` prints it), records in `$ARTIFACT_DIR/images.json`. The Docker image script of the first plan was removed (D19). Release builds stay as today (`aks_deploy.yml:51-60`).

**Runtime env contract** (CS-NODE-5, R-082; `next start` re-reads `next.config.js`, TCD-25): image ENV `BUILD_TARGET=azure`, `NODE_ENV=production`, `APP_ENV` (`Dockerfile:10-15,21-22`; no `BUILD_TARGET` = assets under unrouted `/_next/static`, `utils/helpers.js:1-2`); k8s secret keys incl. `API_KEY` (absent = start throws, `env.config.js:19-22,34`); `NODE_OPTIONS=--max-old-space-size=1024` (overrides the image value) and `UV_THREADPOOL_SIZE=32` (`kube/prod/deployment.yaml:41-44`); `Internal_API`, `Internal_API_HOST` (`:50-53`, read in `api/internalize.js:17-18`). Harnesses set exactly this, appending test flags to `NODE_OPTIONS`. T-901 asserts the image ENV; T-721 without `BUILD_TARGET` must fail (negative control).

## 3. Stack topology (local mode; the compose topology WITHDRAWN 2026-10-22, D19)

The compose file and the runner image of the first plan were removed (D19: no Docker). A test stack is a set of host processes started by `npm run e2e:up -- --run <id> [--build <key>] [--variant harness|nodsn] [--overlay cs-ops-1]` and stopped by `npm run e2e:down -- --run <id>` (`scripts/e2e-stack.mjs`), on per-run ports `21000 + 20 × slot`:

| Port | Process | Role |
|---|---|---|
| +0 | gateway-faithful proxy (Node implementation of the route table that `e2e/proxy/generate.mjs` builds from `kube/{prod,stage}/httproute.yaml`, T-612) | Playwright `baseURL` |
| +1 | allow-all listener of the same proxy | `/`, `/error-card/`, `/api/healthz/` (Q-005) |
| +2 | `next start` of the build tree on the runtime Node | §2 env: `API_KEY=test-key`, `Internal_API` = the stub, `Internal_API_HOST=api.core.ac.uk`; `BUILD_TARGET`, `NODE_ENV`, `APP_ENV` from the build; other outbound hosts redirected to the stub (`test/ssr/host-redirect.cjs`) |
| +3, +4 | SSR stub (`test/ssr/stub.mjs`, 40 §2.2) | answers from the fixture resolver, records at the socket |
| +5 | stub control | rules, marks, records (40 §2.2) |

Playwright runs host Chromium. A/B = two stacks on two slots. The prod limits (`mem_limit: 768m`, the CPU limit) cannot be applied on the host (C6-CI WITHDRAWN, 55 §0). Pixels: every capture and compare runs on the workstation that recorded B0-local (macOS arm64); a capture on another machine is a tool re-capture (§9).

## 4. Golden commit G and golden image (2.4)

**G** = the first merge commit on `main` after the 2.0-2.3 PRs whose `git diff --name-only <base> G` touches only `test/ e2e/ docs/ scripts/ tools/ .github/`, `kube/` (CS-OPS-1 must be in G, so the T-612 proxy has final routing), `Dockerfile`, `.dockerignore`, `package*.json`, Jest/lint configs; tag `upgrade-golden` = G on origin (owner). `<base>` = `cc0e228` (tree `a825839`) or the last product merge before 2.4 (STATUS §1); later product changes need D15. G passes §5 and all P0.

**Lean (D19, 2026-10-22):** G = `689fec9` (local tag `p2-local/golden`; the owner's `upgrade-golden` on origin is DEFERRED, nothing is pushed); the golden image is replaced by host parity builds of G (default, harness variant, variant without a Sentry DSN; `bash scripts/baseline-capture.sh golden --steps build,accept`), accepted by T-006, T-013, T-901 in host mode and a credential scan of the build trees; VF-09: two builds of G identical. The image digest, `docker history` and the registry copy are WITHDRAWN. Was: **Golden image** = the Docker parity image of G B0 built by the baseline-capture workflow (mode `golden`). Not stored (OD-46): a job that needs it rebuilds it from `upgrade-golden`; if VF-09 shows two builds of one tree differ, it is instead pushed once to the registry the existing deploy already uses (`corecontainers.azurecr.io/search-reference`) and pulled by digest. A build is accepted when T-901, T-006 green; image `npm ls --omit=dev --all --json` = the `<base>` record (T-013; catches an `npm install` fallback); no token in `docker history`; from B0 on, every tier green against the committed B0 (0 px, snapshots identical). STATUS §1: G, the first build's digest, Node, build date.

## 5. Inertness proof (2.1)

All must hold (R-084). Reference **`<base'>`** = `<base>` + CS-W0-9 only (the first 2.1 PR; SHA in STATUS §1): `<base>` has no `build:test` or `ARG BUILD_SCRIPT`, and its `npm run build` runs the live loader (`package.json:76`).
1. T-014 on `<base'>`: two parity builds identical (`.next/static` + `.next/server`, buildId normalised). If not: record the nondeterministic files, exclude them in item 2; VF-09 stays open (VG-5 off, 55).
2. Parity builds of `<base'>` and the 2.1 tree: identical the same way; image size delta recorded.
3. T-013: `scripts/lock-immutable.mjs` (old lock entries keep `version`, `resolved`, `integrity`); `npm ls --omit=dev --all` identical; drift pinned by `overrides`; Playwright and axe only in `e2e/package.json`.
4. R-054 packages (`node-fetch`, `@mdi/svg`, `@babel/runtime`, `yargs`): same `require.resolve` path and version in both images.

## 6. Capture and stability proof (2.5)

**Lean (2026-10-22):** done locally with `bash scripts/baseline-capture.sh golden` (items 1–2, from the host build's `.next`) and `scripts/baseline-stability.sh` (item 5, local share 4/4 green); the 7 runs on a CI runner are WITHDRAWN (D20). Results: [records/phase-2.md](records/phase-2.md), section 2.5.

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
  signedOffBy: 'SIGNED: owner, <YYYY-MM-DD> (<note>)'   # D20 local form; later CI: <name>, <URL of the SIGNED: comment>
  date: <YYYY-MM-DD>
```

Default deny: a diff passes only if a row matches `test`, `key`, `from`, `to` exactly; keys are exact literals (no globs), one row per (test, key). The wildcard group `(.*)` of a Next route source in a key (T-010 `header:/:path(.*)`) is literal text, not a glob, only right after a route parameter name (`:<name>(.*)`); a `(.*)` without one is refused (CI-1 c13). A composite key lists several exact keys, separated by `, `, for one `from`/`to` pair; the hooks that read keys take it: T-603 (`<route>@<via>/<header>`, `e2e/lib/P0-11/contract.mjs`) and the recorded e2e baselines (`e2e/lib/P0-10/baseline.mjs`, with the rules in `e2e/lib/P0-10/ledger-rows.mjs` and their known answers in `test/unit/harness/e2e-ledger-rows.test.js`: a row of the running test whose key names the baseline file, `<name>.json` as the spec names it, replaces its literal `from` by its `to`, at every occurrence, in the recorded baseline at comparison, after the test's normalisers, and the run annotates the row with the number of replacements; any other difference still fails). The checker applies the per-key rules to each key a composite key lists: one row per (test, key) and the `kind: delta` prohibitions. Two rows in force of one test whose whole keys are equal are always refused (one row per (test, key)). Two rows in force of one test whose composite keys differ may both list the same baseline file key only when neither row's `from` overlaps the other row's `from` or `to` (one holds the other, or an end of one is the start of the other), so no replacement hides or creates the text another row replaces; any other key that two rows in force list is a second row for that key (CI-1 c10b). These extensions of the key rule (the composite keys, the `(.*)` after a route parameter name, the e2e baseline hook and the per-key rule with its baseline-file exception) are one acceptance change (40 §8 rule 8): the owner signed it on 2026-10-29 (STATUS §2), with the label parts of the AD-048/AD-049 keys kept; its C1 re-run is due at the midpoint heavy check ([records/jump-1.md](records/jump-1.md), section 10). A row the tests implement as an expected value or constant names its AD id in a comment beside it. Append-only; the only edit allowed adds `withdrawn: <reason, date>`. `signedOffBy` takes the local form (D20, 2026-10-27: the track uses no GitHub, so no comment exists) `SIGNED: owner, <YYYY-MM-DD> (<note>)`: that exact prefix, a real date that is not in the future and a non-empty note; it is the owner's confirmation in the work session, recorded in STATUS §2, and `scripts/ad-ledger.mjs` (CI-1) checks the form and looks nothing up. The owner confirmed this form on 2026-10-28 (STATUS §2), in the owner's words: "I sign the rest of AD-012..AD-047 (AD-036 drops) and confirm the local signature form 'SIGNED: owner, <date> (<note>)'". Kept as the alternative for a later CI: `<name>, <comment URL>`, which the checker looks up through the GitHub API (`gh api repos/oacore/search/issues/comments/<id>`): the comment exists, its author is the owner (login in STATUS §1 People), its body starts with `SIGNED:` and names the AD id; else CI fails. A `kind: delta` row also needs `repro:`: a CI run of the **framework probe** showing the same (test, key, from, to). Probe = `origin/main` at the step's branch point plus only the step's dependency-bump commits (`package.json`, lock), built as a parity image; if that does not build, a minimal pages-router app `test/framework-probe/` (harness file, 40 §8) at the old and new versions. A diff that appears only with a CS row applied is that row's change, never `kind: delta` (fix it, or D15 or an OD). CI rejects a delta row without `repro:`. `kind: delta` never covers T-801/T-802 (0 px, D7), a status code (sole exception: T-612's `/static/search/_next/image` row, OD-41) or a `Location` (30 §1 rule 3). Unused rows go in the step record; every gate record lists the rows in force with counts per kind (55 §8). Baseline files are never edited.

## 9. Baseline chain, re-capture, re-baseline

STATUS §1 lists B0..Bn: {n, kind golden/tool/product, reference, baselines SHA-256 set, runner Dockerfile hash, tool versions, commit, PR, date, signer}. Candidates are compared with the chain head, ledger applied. Links after B0 are added only as below, by a PR touching only `test/baseline/*`, the snapshot folders, the contract file, tool pins and STATUS §1; owner signs; never while a step is between its runbook step 3 and the end of its watch ([01](01-playbook.md) §4).

Lean (D20): the capture modes below run locally with `bash scripts/baseline-capture.sh recapture|rebaseline` on host stacks; there is no workflow.

**Tool re-capture** (Playwright, browser, runner, fonts; incl. the GATE-S Playwright bump):
1. Harness PR; `baseline-capture.yml` mode `recapture` captures the chain-head reference 3x byte-identical.
2. New tool on the current `main` parity image vs the new captures: green. Red: drop the tool, or triage as a last-step regression (40 §9).
3. Only then test candidates on it. Link: same reference, new baselines.

**Product re-baseline** (D15, OD-31, R-089); the PR lands alone, never inside a step:
1. Mode `rebaseline`: parity images of `before` = `main` head and `after` = `refs/pull/<n>/merge`, 3 captures each.
2. `before` vs chain head: no diff (else stop).
3. `after` vs `before`: diffs only in the regions/keys declared in the PR; one `kind: product` row each, `ref: [OD-31]`.
4. Owner signs; merge. Link: reference = `after`; golden never rebuilt.

## 10. Local full-suite run (D20, 2026-10-22; was: CI, CS-NODE-4, 2.6)

The suite runs on a workstation with `ARTIFACT_DIR=<dir> bash scripts/ci-local.sh [lint|unit|image|e2e|ops|gate ...]` (default: all six jobs). It runs offline, reads no workflow file, uses no Docker and builds nothing: the builds it names are made beforehand with the lean recipe (01 §10) and only reused; a missing build fails its step and prints the key (`node scripts/build-parity.mjs --key-only [--variant v]`). It writes `$ARTIFACT_DIR/ci-local/<timestamp>.json` plus one log per job and exits non-zero when a job fails. The CI-n IDs keep their meaning as these jobs (D20). The workflow tables that stood here (`ci.yml`, `baseline-capture.yml`, `golden-canary.yml`, `gate-s.yml`, `soak.yml`, `faults.yml`, `mutation.yml`) are WITHDRAWN (2026-10-22, D20): the Phase-2 workflow files were removed and none is added in the track; their scripts run locally (40 §10).

| Job | CI | Node | Steps |
|---|---|---|---|
| `lint` | CI-1, CI-8 | tooling 24 | lint parity (T-001, `scripts/lint-parity.mjs`); docs check (40 §10); `scripts/ad-ledger.mjs --offline` (the ledger's structural checks, including the local signature form of §8; the signature lookups through the GitHub API are not made locally, base ref `CI_LOCAL_LEDGER_BASE`, default `master`); the fixture scrub check (`npm run fixtures:scrub-check`: no secret or contact data in the committed fixtures, `test/fixtures/SHA256SUMS`; 40 §6). CI-8, the dependency audit gate (`npm audit --omit=dev --audit-level=high` into `scripts/audit-gate.mjs`, allow-list `d3-color`, 02), runs only with `CI_LOCAL_AUDIT=1`: off by default and the only step that contacts the registry; reported only unless `AUDIT_BLOCKING=true`, which the owner sets from jump 4 (the first Next ≥15.5.24) |
| `unit` | CI-2 | runtime (18.20.8; 24 from jump 2) | Jest `node` + `dom`, `TZ=UTC`, V8 coverage into `$ARTIFACT_DIR/coverage/jest` (C3) |
| `image` | CI-3, CI-5 | runtime and 24 | on the parity build of HEAD, its twin (`--suffix ci-b`, T-014 (a)) and the harness variant: `test:harness` (T-012, T-612 YAML, SSR stub), the browser targets against the committed copy (CS-W0-10), layer A (the whole `static` project) on the build's `.next`, T-008 on its installed tree (`test/ops/t008.sh --tree`), T-901 in host mode, the T-721 negative control |
| `e2e` | CI-4 | 24, app on runtime | tiers G–I on host stacks of the parity build: `chromium` + `wire` in one invocation (`wire` after `chromium` through Playwright `dependencies`, never beside it), `visual` (all but T-802) in its own invocation, the CS-OPS-1 overlay stack (T-604, T-702; a test-only proxy rule), the harness-variant stack (T-802); the variant without a Sentry DSN must exist (T-608 c2 starts its own stack on it) |
| `ops` | - | runtime and 24 | Jest `ops` project (T-902, T-903, T-904, T-908), then T-907 c2 and the c1/c3 rehearsal (Playwright `ops` project) on a stack of the parity build |
| `gate` | - | - | all five jobs `success` in the same call; evaluated only when lint, unit, image, e2e and ops all ran in that call |

- **Build trees.** One call needs four build trees of HEAD at once: the parity build, its twin (`--suffix ci-b`, image only), the harness variant and the variant without a Sentry DSN. Under the track's limit of three trees (01 §10) run it staged: `bash scripts/ci-local.sh lint unit image` with the twin present, then remove the twin, make the variant without a Sentry DSN and run `bash scripts/ci-local.sh e2e ops`; the gate is read from the two summaries. The Phase-2 exit run (one call, four trees, owner allowance of 2026-10-27): [records/phase-2.md](records/phase-2.md), section 2.8.
- `CI_LOCAL_KEEP_GOING=1` runs the steps after a red one too (diagnosis; the job stays red); by default a job stops at its first red step.
- **CI-6** WITHDRAWN (2026-10-20, with OD-29). **CI-7** (the required check `CI / gate` on `main`) WITHDRAWN (2026-10-22, D20): the `gate` job of the local run is the gate. The head check of 01 §4 step 3 (3 consecutive green runs) is WITHDRAWN (D18): one green run per jump (55 §0). T-009 and T-014 (b) on a release-recipe build: DEFERRED to the owner's deploy (they need a build with the live data-loader).
