# 01 - Playbook: how work is executed

**Purpose.** How a step is executed safely, from prerequisites to rollback.
**Read it** before the first command of a work session and at each step start. Elsewhere: thresholds 55 C6, tests 41, test commands 40 §10 and 42, step content 50 and 20. **Owns:** prerequisites, git and PR rules, the runbook (branch, pre-merge checks, prod merge, watch), rollback, the DoD, records, stop conditions, doc change control, the lean work-session protocol (§10).

**Lean mode (D18–D20, 2026-10-22; [00](00-decisions.md) §4b).** During the version track nothing is pushed, merged to `main`, tagged on origin or deployed, and no CI, Docker or DevOps file is touched. Each jump (50 §4.0) runs the local loop of §10. §2–§6 apply only to the single final deploy by the owner after GATE-S; their CI, Docker, stage and per-step watch parts are WITHDRAWN where marked.

## 1. Prerequisites

| Need | Value |
|---|---|
| Tooling Node | 24 (`.nvmrc`, created by CS-W0-5; absent today): lint, format, hooks, Playwright, docs checker ([02](02-version-matrix.md)). |
| Runtime Node | Per [02](02-version-matrix.md): 18 to W4d, 24 from W4e, 26 at 6.10. Set by Dockerfile `ARG NODE_VERSION` (CS-W0-5; today `FROM node:18-alpine`, Dockerfile:1). Used by `next build`, ICU-pinned Jest and images: run them with `nvm exec <runtime Node> ...`. |
| `NPM_TOKEN` | GitHub Packages read: `cp .npmrc.dist .npmrc`, replace `{GITHUB_TOKEN}` with a personal access token that has `read:packages` (`.npmrc` is gitignored). Needed until DV6 ([60](60-design-ownership.md)) removes the last `@oacore/*` package. |
| `API_KEY` | Real CORE key only to record fixtures (2.2) or build on the live API; test images use `test-key`. Never commit or log it: the repo is public. |
| Access, tools | AMENDED (2026-10-22, D19, D20): the track needs no Docker and no `gh` (local only, §10); the owner's final deploy uses today's access. Was: Docker daemon (linux/arm64); `gh` logged in; `jq`. No cluster write access: the existing deploy workflows build, push and apply every image and `kube/` manifest, rollbacks included (§5). Read-only cluster access, where the team already has it, helps the prod probes (VF-14); no step needs it. Names and channel: [STATUS](STATUS.md) §1 People. |
| Strict install | `npm_config_userconfig=/dev/null npm ci --no-legacy-peer-deps` (a user-level `.npmrc` with `legacy-peer-deps=true` hides peer errors). It fails today with ERESOLVE (logrocket-react) and after W0 with EUSAGE (peers missing from the lock), until 7.F; problem set and closing steps: 02 §1 rule 6. Installs keep `--legacy-peer-deps` until then; T-008 fails on any strict-mode `npm ls --all` problem outside the 02 §4 allow-list. From W5 every install adds `--install-links` (60 §8). |

## 2. Git and work-session start

- **Lean (D20):** during the track the start check is §10 (local branches only); the `origin/main` check below runs once, before the owner's final deploy.
- **Start:** read [README](README.md), [STATUS](STATUS.md), the step's docs; `nvm use 24`; `git fetch origin && git log --first-parent --format='%h %s' <head>..origin/main` (`<head>` = the `origin/main` SHA in the last STATUS §6 row; first work session `cc0e228`, tree `a825839`, same as local-only `f5cfc20`). Classify every commit `<c>` by its subject (GitHub writes `Merge pull request #n from oacore/<branch>`) and `git diff --name-only <c>^1 <c>`:
  - **track merge**: branch `upgrade/*` (table below; its PR title carries the step ID, §3): nothing to do;
  - **docs/test merge**: branch `docs/*`, or every path outside the runtime tree `<PI>` (§4: `docs/`, `test/`, `e2e/`, `scripts/`, `tools/`, `*.md`): log it in STATUS §6, no D15, `<base>` unchanged (covers the docs PR and every status PR, §9);
  - **data refresh**: touches only `data/.formap.json`, `data/.members.json`, `data/.statistics.json` (e.g. #444, #454; parity images use the frozen snapshot, 42 §1): log it in STATUS §6, no D15 (OD-31);
  - **infra change**: touches only `kube/` or `.github/workflows/`: log it; the next CI run re-checks T-612 and T-901; inside a watch window tell the owner (OC-21);
  - **product change**: anything else. Before B0 (steps 2.0–2.3): record the new `<base>` SHA in STATUS §1 (42 §4), re-run the 20 Anchors (§9), tell the owner. From 2.4: stop, D15 (OD-31) first.
- **Gate window hold** (55 GATE-x.6): from the gate commit's prod rollout to the gate record's signature, nothing merges to `main` (every merge redeploys prod, R-088): data refreshes, infra changes, D15 product PRs and docs PRs wait; the owner posts `SIGNED:` for the hold at window start (STATUS §6 log row). An urgent change merges with the owner's `SIGNED:`, is logged and restarts the window at its merge commit, which becomes the gate commit (CI re-runs there; GATE-x.1 Tr unchanged). Any other merge found by the start check also restarts the window.
- **One-time** (README §8 actions 1–2): land the docs branch; `git remote set-head origin --auto` (`origin/HEAD` points at stale `master`); owner: tag `upgrade-baseline` = `cc0e228` on origin.
- PR base is `main`; `master` and `main.old` are legacy. The deploy process stays as today (OD-29 WITHDRAWN): every merge to `main` deploys prod, docs-only ones too (R-088), so merges happen in working hours, docs PRs are batched and merge outside a step's watch. Never commit or push to `main` directly: it changes only by PR merge. `stage` is used as today, optionally (§4 steps 5 and 10).

| Work | Branch |
|---|---|
| Phase 2 | `upgrade/p2-<topic>`, topic starts with the step: `upgrade/p2-20-gateway` (2.0, sub-PRs `<B>--<cs-group>`), `upgrade/p2-21-harness` |
| Step branch `<B>` (W, 6.x, 7.x) | `upgrade/<step>-<slug>`, step lower-case without dots: `upgrade/w4c-next-12-1-6`, `upgrade/w05-design-tgz`, `upgrade/63-axios` |
| ESCALATES fix / docs | `upgrade/esc-q0nn` (PR base: the step branch) / `docs/<topic>` |

## 3. PRs and commits

- **Title** `[<step>][<CS-ID>] <summary>`, e.g. `[W4c][CS-N12-7] Bump next (per 02)`; one CS group per PR. **Body:** Step; IDs; Why (D1: no behaviour change); Evidence (CI URL, reports); DoD §6 boxes; Rollback; Signature.
- **Commits:** one bump per commit, subject `<verb> <what> (<CS-ID>)`, exact pins (`--save-exact`, versions per [02](02-version-matrix.md)), lockfile in the same commit. No code site (02 §5 sweep, lock-only bump): CS-ID `02`, e.g. `[W2e][02] Bump katex`. Merge commits only, never squash (per-bump commits stay revertable). A second engineer reviews every PR.
- **Own PRs, never mixed with bumps:** ESCALATES fixes (label `escalates`; D1a, OD-09, OD-40) and `kube/` changes (label `infra`; CS-OPS-1). Each needs the owner's **signature**: the owner's own approving PR comment starting `SIGNED:`, copied into the record. Bot approvals never count.
- Baseline artefacts (screenshots, `e2e/http/contract.baseline.json`; storage per [42](42-baselines-and-ci.md) §7) change only in re-capture or re-baseline PRs (42 §9, D15); `test/baseline/ACCEPTED-DIFFS.yml` only gains signed AD rows. Dependabot PRs: label `upgrade-hold`, never merged alone, folded into the next step's CS list (OD-32).

## 4. Per-step runbook

**AMENDED (2026-10-22, D18–D20):** no step of the version track runs this runbook. Steps 1–7 (push, PRs, CI head checks, step checks on CI, stage) are WITHDRAWN for the jumps, whose loop is §10; steps 8–11 run once, for the owner's final deploy after GATE-S, with the 55 §0 watch and smoke check. The text below is the original runbook. A step is **deployable** if it changes the runtime tree `<PI>` = `-- . ':!docs' ':!test' ':!e2e' ':!scripts' ':!tools' ':!*.md'` (git pathspec; paths outside it never reach the image, `.dockerignore`, 42 §2): W, 6.x and 7.x steps, 2.0, 2.1. The deploy process is today's (OD-29 WITHDRAWN): a merge to `main` deploys prod through `aks_deploy.yml` (R-088), so the merge is the release. It happens only after the full pre-merge suite (steps 3–3a) is green on the checked SHA, in working hours, one deployable step at a time (OC-21), and the 48 h watch follows. Other PRs (`test/`, `e2e/`, `docs/`, CI workflows): green `CI / gate`, one review, merge commit, in working hours outside a step's watch (their merge redeploys an unchanged runtime tree). 2.0 and 2.1 run this runbook with the §6 bootstrap rules.

1. **Branch.** `git fetch origin && git switch -c <B> origin/main && git push -u origin <B>`. Check the entry rows in 50; in the first PR re-resolve versions (02 §5) and re-anchor the 20 CS rows (§9).
2. **CS PRs** from `<B>--<cs-group>` (`gh pr create --base <B>`), each meeting DoD §6 PR level. Run the step's tests first (rows in 41, commands in 40 §10).
3. **Head check.** `git fetch origin && git switch <B> && git pull --ff-only && git merge --no-edit origin/main && git push` (merge commit, §3); open the step PR as a draft (`gh pr create --draft --base main --head <B>`). The **checked SHA** = `git rev-parse <B>` after that push: steps 3–3a run on it, every dispatch with `--ref <B>` / `-f ref=<B>`; any later push to `<B>` = redo from step 3. 3 consecutive green `CI / gate` runs at the checked SHA ([42](42-baselines-and-ci.md) §10 head check); a red run is triaged per [40](40-test-strategy.md) §9 before any re-run counts. From 2.5 also a `golden-canary.yml` success <48 h old (42 §10).
3a. **Step checks** (W0 onwards; 55 §1 step column), on the checked SHA: `gh workflow run faults.yml -f ref=<B>` (R patches of the risks biting in the step; Q clause patches the diff touches, by `git apply --numstat`), `mutation.yml` if the step touches the C2 files, C3(b) from the head's coverage, `soak.yml` (C6-CI, 55 C6; every deployable step), and at the steps 55 §1 lists for C4 `gh workflow run gate-s.yml -f candidate=<head parity digest> -f N=500`; a release-recipe build of the head passes T-009 and T-014 (b) (DEFERRED to the owner's deploy: the Docker recipe script of the first plan was removed, D19); in a gate sweep (W8, 6.10, 7.F) also `npm run outdated-at -- <Tr>` lists only 02 §4 rows (02 §5 step 5). A survivor, an unexplained diff or a C6-CI breach is a stop (§8).
4. **Review.** The Reviewer approves the step PR with the step's 41 rows, DoD §6 boxes and the step-check URLs in its body; it stays a draft until step 8.
5. **Stage (optional, best effort; no gate waits on it).** As today: `git switch stage && git pull --ff-only && git merge --no-ff --no-edit <B> && git push` (`aks_stage_deploy.yml`, `core-frontend-stage`; its 04:00 UTC cron redeploys `main` there, R-088); then T-907 on stage. A stage finding is triaged like a red test (40 §9).
6. **No stage soak** (WITHDRAWN 2026-10-20, OD-47): its runtime checks are the pre-merge C6-CI run of step 3a.
7. **T-904** items that [41](41-test-inventory.md) lists for this step, with evidence: on stage if step 5 ran, else on prod right after step 8.
8. **Merge to prod** (working hours; someone who can run §5 is available through the watch). First record the current prod merge SHA and its 'AKS prod' run ID: the rollback target (§5). Before merging: `git fetch origin && test "$(git rev-parse origin/<B>)" = <checked SHA> && git fetch origin pull/<n>/merge && git diff --quiet <checked SHA> FETCH_HEAD <PI>` (FETCH_HEAD = the PR merge result); non-zero = `<B>` moved, or `main` moved inside `<PI>`: stop, redo from step 3. Then `gh pr ready <n> && gh pr merge <n> --merge`; `aks_deploy.yml` builds, pushes `<sha7>-prod`, applies `kube/prod/` and waits for the rollout. Re-check `git fetch origin && git diff --quiet <checked SHA> "$(gh pr view <n> --json mergeCommit -q .mergeCommit.oid)" <PI>`; record the merge SHA, the deploy run URL and its green 'Wait for rollout'.
   **Prod probes:** `core.ac.uk` answers outside requests with a Cloudflare challenge (403, `cf-mitigated: challenge`, checked 2026-10-20), so T-907 and the §6 probes run over the probe path VF-14 settles (the team's existing access, or a real browser).
   **First rollout of W4e and 6.3 only:** stage cannot exercise the in-cluster API path (`api/internalize.js:24` never rewrites the staging host; RG-6), so 10 min of API access-log lines (Host, Authorization present and scheme) from before the merge and from the first new pods are compared (VF-02; the owner arranges the log access). Any difference: rollback first ([VERIFY: log fields; owner]).
9. **Watch 48 h** from rollout end (T-903; thresholds 55 C6-prod; the team's existing monitoring: Sentry, LogRocket, GA4, gateway and Cloudflare logs, existing dashboards); T-907 on prod. Breach: rollback first (§5).
10. **Stage (optional, as today):** if step 5 ran, re-align it: `git switch stage && git pull --ff-only && git merge --no-edit origin/main && git push`.
11. **Record** (§7); update README §Status and the STATUS ledger.

**Never:** two deployable steps in flight (OC-21); any merge to `main` from step 8 until the watch ends, except a rollback revert; in a gate window, any merge (§2 gate window hold); a deployable merge before steps 3–3a pass or outside working hours; edit baselines outside 42 §9.

## 5. Rollback

Who: the Implementer or the owner, with GitHub access only; no cluster write access is needed (OD-29: today's process).

- **Prod, default:** `git revert -m 1 <merge-sha>` on `main` via a PR (`CI / gate` green, as every PR); its merge runs `aks_deploy.yml`, which rebuilds the reverted tree and applies its `kube/prod/` manifests. Its tree must equal the rollback target's outside `<PI>` (`git diff --quiet <prev-main-sha> HEAD <PI>`) and its `npm ls --omit=dev` the target's.
- **Prod, faster while the revert PR runs CI:** re-run the rollback target's 'AKS prod' run (`gh run rerun <run-id>`; GitHub allows re-runs for 30 days): it rebuilds that commit under its old tag and rolls it out. Nodes that still cache that tag may serve the old build beside the rebuilt one, so their `_next/data/<buildId>/` requests 404 and fall back to full loads (Q-095, T-604) until the revert lands. The revert PR must merge before the 03:00 UTC nightly (`aks_deploy.yml:7`), which redeploys `main`'s head.
- Rebuilt, not re-applied: as in every deploy today, the image is rebuilt from the commit (old lock via `npm ci`, pinned base image from CS-W0-8, data fetched at build, R-091). GATE-x.8 proves the rollback target still builds and runs.
- **Stage:** as today (push the wanted commit to `stage`), best effort.
- Not `kubectl rollout undo`: it returns to a mutable tag and the next deploy re-applies git's manifest.
- Then record it, mark the step `ROLLED BACK` in STATUS, stop (§8).

## 6. Definition of Done

The only DoD; exit rows in 50 add to it, never weaken it. **Lean (D18):** a jump is done when the 55 §0 jump check passes on its tip and `records/jump-<n>.md` is written; the PR, CI, cold-image, C6 and watch boxes below apply only to the final deploy. The 2.0 bootstrap's `docker buildx build` is WITHDRAWN (D19).

**PR level:** `CI / gate` green on the head; IDs linked; only the named CS rows changed, Anchors re-checked; no baseline artefacts; no behaviour change (D1), a changed expectation justified in the PR (output diffs as AD rows); reviewer approved; signature where required.

**Step level** (deployable steps): all P0 and every P1 row due by the step ([41](41-test-inventory.md): due from the first step in its Wave) green; 0 px (T-801/T-802 `diff-pixels` annotations, 40 §1); no unexplained SSR, network or header diff ([40](40-test-strategy.md) §1), every accepted diff an AD row with `signedOffBy`; cold build (`rm -rf .next`, clean-checkout image) passes; C6-CI and watch without a 55 C6 breach; T-907 green on prod (stage: when used); T-904 done; the 55 §1 step column (§4 step 3a: C1, C1-Q, C2 if touched, C3(b), C4 N ≥500 where listed), each result URL in the record; 50 exit rows true; record written; STATUS updated. A step that ends at a gate also meets 55 and writes `records/gate-{S,A,F}.md`.

**Phase-2 bootstrap** (2.0–2.5, until `CI / gate` is required at 2.6; [50](50-roadmap.md) §3). PR level: a second-engineer review, the CS row's 20 Proof where one exists, and for 2.0 a release-recipe build of the head (`docker buildx build --platform linux/arm64 .` with the workflow's build args), for 2.1–2.5 the prototype `ci.yml` (2.1) green; `CI / gate` replaces it at 2.6. Runbook steps 3–3a: at 2.0 the release-recipe build only; at 2.1 the prototype `ci.yml` green on the head; the canary clause from 2.5; C6-CI from W0 (its harness exists from 2.5). Step level for 2.0 and 2.1, in place of T-801, T-802, T-901, T-904 and T-907 (written in 2.3): the **probe list**, HTTP status of `/search/?q=climate`, `/works/<id>/`, `/outputs/<id>/`, `/data-providers/`, `/data-providers/86/` on prod (§4 step 8 probe path) equal to the pre-deploy values, plus C6-prod rows 2–3, and rows 4, 5, 7 and 9 where their sources exist, as calibration watches (55 C6-prod) (row 2 baseline = gateway log of the 8 baseline days, VF-26; where unavailable, the probe list stands alone and the gap is logged in the record); 2.1 also T-006 and T-011..T-014 and the inertness proof (42 §5), which stand in for C6-CI.

**Non-deployable steps** (2.2–2.8): the tests due by the step green ([41](41-test-inventory.md)), the step's 50 exit row true, record written, STATUS updated; cold build only if the step touches the `Dockerfile`; T-801/T-802 0 px from 2.5 (B0 exists); C6-CI, watch, T-907 and T-904 apply only to deployable steps (§4). Their merges still redeploy an unchanged runtime tree (R-088): working hours, outside a step's watch. The 2.8 record also carries the C1–C6 items of its 50 row.

## 7. Records

`docs/upgrade/records/<step>.md`; phase 2: one `phase-2.md`, a section per step 2.0 to 2.8; the version track: one `jump-<n>.md` per jump and `gate-S.md`. Gates use the [55](55-gates-and-confidence.md) template. **Lean record (D18–D20):** branch and tip, the CS rows applied, the one local full-suite run (summary file, counts per job, re-runs and their result), heavy-check results where due, AD rows added, deploy-time items found (20), open items; the CI, deploy and watch lines of the template below apply only to the final deploy.

```
Record <step> | DONE / ROLLED BACK | start..end
Branch + PR URL | checked SHA (= `<B>` head) | merge SHA on main | CS-ID -> PR -> commits
CI: 3 green `CI / gate` URLs | prod deploy run URL, image tag | rollback target: previous merge SHA, its run ID
Parity: 0-px report; SSR/network/header diffs (none or AD-###)
55 §1 step column: C1 R killed/run, C1-Q clauses killed/triggered | C2 | C3(b) | C4 N, diffs, AD rows | C5 flakes
C6-CI and watch tables: metric | threshold | measured | pass (55 C6)
T-907 URLs | T-904 item -> evidence | Host/Authorization log (W4e, 6.3)
AD rows added | incidents | status changes (R, Q, T, CS, VF, OD)
Sign-offs (name, date): Implementer, Reviewer, Owner
```

## 8. Stop conditions

Stop = take no further runbook step, log the reason in STATUS §6, ask the owner (decisions, signatures, deploys). Stop when:

- a diff is not in the AD ledger, or a VG check (55) fails;
- a C1 or C1-Q survivor, or a C4 diff that no AD row explains (§4 step 3a);
- a C6-CI or watch threshold is breached (watch: rollback first, §5);
- an entry row in 50 is false, a needed VF is open, or a needed OD is unusable by default; a gate's pre-window export (55 C6-NI) is absent;
- a "signature required" item is unsigned;
- an Anchor's match count differs from its row (20 Rules), or `pageLoader.getDataHref` is missing on the bumped Next (CS-N12-3: OD-03, do not improvise);
- two deployable steps would be in flight (OC-21).

## 9. Doc change control and work-session end

- IDs are append-only: retire as WITHDRAWN plus reason, never renumber or reuse; a new ID takes its family's next free number, registered in the owner doc in the same PR.
- [00](00-decisions.md) is edited only by the owner. To change policy, add an OD with a default in [90](90-open-decisions.md).
- Statuses live only in STATUS and README §Status (ODs: 90). The Implementer flips risk, quirk, test, CS and step statuses in the PR that proves them, the Reviewer checks; ODs and signatures are the Owner's. Unconfirmed facts get a VF-## in STATUS §3.
- `path:line` citations hold for tree `a825839`. At each step start run `git grep -n "<Anchor>"` per CS row; fix rows in the step's first PR.
- **Lean (D20):** the work-session end below is a local commit on the step branch, not a PR; nothing is pushed.
- **Work-session end:** README §Status, STATUS ledger, VF register and log row updated in a `docs/status-<date>` PR (log row: the `origin/main` SHA when the row was written); `node tools/check-docs.mjs docs/upgrade --repo .` reports ERROR 0. Its merge redeploys prod with an unchanged runtime tree (R-088), so it merges in working hours outside a step's watch (steps 8–9); until it merges, the live STATUS is that branch's: `git show origin/docs/status-<date>:docs/upgrade/STATUS.md`. The next work session classifies that PR as a docs/test merge (§2).

## 10. Lean work-session protocol (D18–D20, 2026-10-22)

The loop for every jump of the version track (50 §4.0) and for any later Phase-2 style work.

1. **Scope (D19).** Change only app dependencies and app code at listed change sites (20, 60), local tests and test tooling. Never touch `.github/`, `kube/`, `Dockerfile`, `.dockerignore`, deploy workflows, CI or registries; a change an upgrade truly needs there goes into 20 §Deploy-time items for the owner. Before handing work back: `git diff f5cfc20 -- .github kube Dockerfile .dockerignore` is empty. Existing bugs stay (D1): a test red on the unchanged app is a wrong test; fix the test, never the app; never weaken a test (no deleted assertion, skip, only or retry).
2. **Git, local only (D20).** Step branch per jump `upgrade/jump<n>-<slug>` from the previous jump's tip (jump 1 from the Phase-2 exit branch `upgrade/p2-28-exit`); CS groups on `<B>--<cs-group>`, merged into `<B>` with `--no-ff`; one bump per commit, subject `<verb> <what> (<CS-ID>)`, exact pins per 02. Nothing is pushed, merged into `main` or `master`, or tagged on origin; stashes, hard resets and cleans are not used. Commit messages, docs, code comments and test titles stay neutral (the owner's wording rule); docs use repo-relative paths.
3. **Lean builds.** When a jump changes `package.json` or the lock, bring the repository's `node_modules` in sync once (`npm ci --include=dev --legacy-peer-deps` on the runtime Node, no stack running; from W5 with `--install-links`, CS-DSN-2), as done on 2026-10-27 ([records/phase-2.md](records/phase-2.md)). Every build tree is then a `cp -Rc` clone of the repository tree that reuses that `node_modules`, followed only by the app build step (`npm run build:test` and the image copies; `node scripts/build-parity.mjs --alias-of <key>` where only test or tooling paths changed). Never `npm ci` per build tree; a tree whose `node_modules` misses a lock entry is not used (T-008 c2 catches it). Jest-only work needs no build.
4. **Disk and machine budget.** Check `df -g /` before every build: keep at least 25 GB free; at most 3 build trees (the one-call full run needs 4: use its staged form, 42 §10, unless the owner allows 4); at most 2 builds and 4 Playwright runs at the same time. Delete a tree you made once its result is recorded (`rm -rf "${dir:?}"`, never a tree another run still needs); never touch the user's npm cache. Stop every stack you start (`npm run e2e:down -- --run <id>`); `npm run e2e:status` lists none at the end.
5. **Pacing.** Split long work into short, idempotent sub-steps whose state is on disk (branches, build records, run summaries): a re-run detects what exists and continues. Pace long runs against the work session's usage window: pause at a sub-step boundary at about 85%, resume after the reset. On a network or registry error, wait and retry with backoff; the suite itself is offline.
6. **Run.** One `bash scripts/ci-local.sh` on the jump's tip (55 §0 jump check); a failing test re-run once. After any commit that touches the runtime tree (`package.json`, the lock, a root config): re-key the builds and re-record the T-728 c4 dev inventory (`node e2e/lib/P0-12/dev-inventory.mjs --run <id>`) before the next full run.
7. **End.** Write `records/jump-<n>.md` (§7 lean record); update README §8 and STATUS in a local commit on the step branch; `node tools/check-docs.mjs docs/upgrade --repo .` reports ERROR 0.
