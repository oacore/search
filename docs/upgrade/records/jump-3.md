# Record jump 3: React 18.3.1, Next 13.5.11 then 14.2.35 (lean mode)

Record jump 3 | **Jump 3 DONE.** The one call of the jump check on the tip `094f3bc` (`CI_LOCAL_KEEP_GOING=1 bash scripts/ci-local.sh`, 2026-11-13 16:22 to 16:51 +0400, `$ARTIFACT_DIR/ci-local/20261113T122225Z.json`) gave 2,749 passed and 1 failed: lint, image, e2e and ops success, unit red on T-104 c2 only, the gate red through unit only (§1.3). T-104 c2 is the named standing red: Jest runs on Node 24, the Dockerfile still says `FROM node:18`, and it turns green with the Node base image of the final deploy (§9.4). The first call, on `b04bef8` (05:09 to 05:33 +0400), stopped on T-014 (a) alone (§1.1); the owner chose option (a) ("Go with option a", 05:44) and signed the T-014 round ("Sign T14 (a)", 16:11); its three commits are merged as `094f3bc` (§1.2), and T-014 (a) is green in the second call. W5.5, W6a, W6c and W6d are DONE on Chromium (§3), and the midpoint heavy checks passed (§8). The owner signed this record with the jump's last batch on 2026-11-13 ("Sign all (a)", §5; Sign-offs below), and the batch's docs commit wrote this status line; jump 4 awaits the owner's go-ahead (§9.6, §10) | 2026-10-31..2026-11-13

- **Rules in force:** D1, D18 (lean target), D19 (scope), D20 (no CI) ([00](../00-decisions.md) §4b); the lean protocol ([01](../01-playbook.md) §10); gates [55](../55-gates-and-confidence.md) §0; the harness-change protocol ([40](../40-test-strategy.md) §8); the ledger and the chain links ([42](../42-baselines-and-ci.md) §8, §9); [30](../30-quirks-register.md) §1. The owner's go-ahead of 2026-10-31 22:16 +0400, "Start jump 3", covers [50](../50-roadmap.md) §4.0 row 3: W5.5, W6a, W6c and W6d in that order, then the jump check and the midpoint heavy checks. A reading recorded beside it in notes.md, as not the owner's words, took the go-ahead to cover the installs of each step's package versions from npm (`HUSKY=0`, `--legacy-peer-deps --install-links`, Node 24.18.1) and to carry the rules of jump 2; the signed midpoint batch relies on it (MID-A (a) names the non-step versions it puts into the fault trees as past the go-ahead, which covers the step versions only). The rules of jump 2 so carried: the owner's throttle (one build and one Playwright run at a time, never both, Jest only when neither runs), at most 4 build trees, at least 25 GB free, and the batching rule (a new accepted difference PROPOSED and signed by the owner in a round). ESCALATES fixes were not batched to the jump's end (OD-09, OD-40): W5.5 stopped once for its own round. Each of W6a, W6c and W6d had a second round for its rows before its merge (W6A-K (a), W6C-G (a), W6D-G (a)); the midpoint had its own round, D10 a short round, and the jump check the T-014 round (§6).
- **Where it ran:** one workstation (macOS arm64). Runtime Node 24.18.1 (npm 11.16.0) for every build, `next start`, `next dev` and Jest; Chromium of `@playwright/test` 1.64.1, every page through the gateway-faithful proxy, `retries: 0`, 4 workers. W6a, W6c and W6d each ran in a worktree of its own, the W5.5 spike in two; the repository's `node_modules` was synced once after each version merge (01 §10 item 3). Lean builds, at most 4 build trees (exceeded once, for 70 minutes, at W5.5: [W5.5.md](W5.5.md), section 10). The lowest free space the step records give is 78 GB (W6d, [W6d.md](W6d.md)); 99 GiB at the second call.
- **Not done anywhere:** nothing was pushed, merged into `main` or `master`, tagged on origin or deployed. `git diff f5cfc20 -- .github kube Dockerfile .dockerignore` is empty. No Docker was used (T-901 in host mode only); prod and stage were never contacted. Every commit and merge ran with `HUSKY=0`, except two of W5.5 that ran no hook ([W5.5.md](W5.5.md), section 10); `core.hooksPath` stayed unset; the user's 78 stashes are untouched.
- **Branch (local):** `upgrade/jump3-react18-next14`, from the jump-2 tip `455a381`. Every step, fix group and docs change was a short branch `upgrade/jump3-react18-next14--<slug>`, merged with `--no-ff` and deleted, or a commit on the branch itself (§2). The spike branches `upgrade/w55-spike` (`9a016a7`) and `upgrade/w55-spike-fixed` (`b96a1c5`) are never merged (50 §4.2) and stay. From `455a381` to `094f3bc`: 144 commits, 112 of them non-merge; 44 on the first-parent line (§2, which adds the record merge, the merge of its review fixes and the merge of the jump's last batch).
- **Evidence:** every figure below comes from the steps' evidence files and logs, kept with the work-session state outside the repository (`$ARTIFACT_DIR` = its `p2/artifacts`), with a durable copy of the work-session state under `.p2-work/` (git-ignored, local; the work-session folder's `p2/` inside it). The step log is `.p2-work/jump3/state.md`, the issues `.p2-work/jump3/issues.md`, the owner's words and the work session's decisions `.p2-work/jump3/notes.md`, the rounds `.p2-work/jump3/owner-batch-*.md` and `.p2-work/jump3/owner-round-t014.md`, the proposals `.p2-work/jump3/proposed-ad.md`. The two calls of the jump check: `$ARTIFACT_DIR/ci-local/20261113T010950Z.json` (head `b04bef8`, sha256 `61e143fc81c6a69dcf6e2d45e1d69656fe405c6305153c68a596a45aabd6bc7e`) and `$ARTIFACT_DIR/ci-local/20261113T122225Z.json` (head `094f3bc`, sha256 `59a4074335d2c12af7770d105f32ef50937d26b33e21b408d8d8cd9eb4d67457`), each with its six job logs, copied in the durable copy under `p2/j3-mid/close/jumpcheck/logs/ci-local/` and `p2/j3-mid/t014/jumpcheck/logs/ci-local/`.
  - **Lost on 2026-11-03:** macOS cleared the work-session folder during the weekly pause of W5.5; the Playwright run folders under `$ARTIFACT_DIR/runs/` made until then and every build tree went with it ([W5.5.md](W5.5.md), Evidence). Builds rebuild by key.
  - **Lost on 2026-11-12:** macOS emptied the work-session folder again during the weekly pause of the midpoint (2026-11-07 to 2026-11-12): every file under its `p2/` was gone, the tip's build tree `48f7a7c8d9eafeae` among them (its folders stood, 0 bytes). The durable copy held every role folder, the drafts, the kill-summary draft, the corpus dump and the lost build's file list, and the folder was restored from it. A new tip build was past the midpoint batch's weekly-pause clause, so it came back to the owner: "Yes, rebuild" (2026-11-12 04:31 +0400), then, after the comparison, "Accept and continue" (18:43; §5, §8.5). The rebuilt tree is the tip's build for the rest of the jump and was never rebuilt, replaced or written after it.
- **Sign-offs (01 §7):** Implementer: _. Reviewer: the pre-sign checks of each batch and round of the jump and the three end-state reviews of this record (§4), no named person. Owner: SIGNED 2026-11-13 (in the work session, the jump's last batch `.p2-work/jump3/owner-batch-jump3-last.md`, LB-1 (a): this record as it stands at `e40edbc`). Owner's words (§5): "Sign all (a)"; the time: 2026-11-13 20:12 +0400 (16:12 UTC, the same date). The owner's signatures of the rounds of jump 3 and their words are in §5; of them only the last batch's names this record's text. Written after the second call, on 2026-11-13, in the docs commit that carries the T-014 round's section (g) step 6 texts, and corrected the same day after its end-state reviews in a docs commit of its own (§2, §4). Written after the owner's signature, in the docs commit of the last batch's section (d) step 2 (§2), which applies the text that step lists: the status line, this line, the §5 and §6 rows of the last batch and §2's row of its merge, §9.6 item 1 settled item by item, items 2 to 4 with LB-7 (a) and LB-8 (a), item 6 with LB-4 (a), the trees (LB-10 (a), LB-11 (a)), §10, and LB-5 (a)'s four lines (the Evidence line, §2's `adf29b2` row, §4's midpoint row, §5's closing paragraph); beyond that list, because each had become untrue, and for the owner to read at the go-ahead of jump 4: the Branch line's note on §2, the last two sentences of §9.1, and in §9.6 item 2 the sentence on the two `stryker.config.mjs` comment lines (LB-9 (a)); outside this record, the open items in the evidence of STATUS §4's row Jump 3, the words "this row's texts" with C11 (a) and C13 (a) in STATUS §4's midpoint status cell, and the sentence on the owner's signature in README §8's jump 3 paragraph; and, under the owner's decision on J3-LAST-1, the stop before this commit ("A", 2026-11-13 20:34 +0400, 16:34 UTC; §5), LB-3 (a)'s clause in 41's row T-014 with its one `;` before "since jump 2" written as `,`, every other word as signed (with the `;`, 41 §0's clause rule reads T-014 as two Cases clauses that its tests do not name), and §5's row of that decision.

## 1. Jump check (55 §0)

### 1.1 The call on `b04bef8`, stopped on T-014 (a)

`CI_LOCAL_KEEP_GOING=1 bash scripts/ci-local.sh` ran once on `b04bef8`, all six jobs, 2026-11-13 05:09:50 to 05:33:45 +0400, under heavy.lock (section (d) step 14 of the midpoint batch). `CI_LOCAL_KEEP_GOING=1` is the script's documented switch that lists every red step of a job, the form of jump 2's jump checks; each job stays red. The tip's build `48f7a7c8d9eafeae` (buildId `R7G5wsJrek1t1SLBzDQXO`) was reused as it stands; its twin `48f7a7c8d9eafeae-ci-b` (`jMSJ_LWQU7BEgtnjza5Qp`), the harness build `ccc53f513f12dc8d` (`Qwy4YAZJLMHRRawZgJuNB`) and the no-DSN build `3898df7d0ecb64cc` (`WShlw1vzOWBI-b7cDrjcE`) were made for it with the midpoint's lean builder, one at a time (4 trees).

| Job | Result |
|---|---|
| lint | success: T-001; docs check ERROR 0, WARN 20, INFO 102; ledger `--offline` (base `master`) 0 violations; fixture scrub and `test/baseline/SHA256SUMS` |
| unit | **failure:** 1,104 of 1,105 (59 of 60 suites): T-104 c2 only (Expected "18", Received "24", `test/unit/api/t104-wire-headers.test.js:160`); no SIGSEGV |
| image | **failure:** `test:harness` 25 of 25; the browser targets equal; layer A 93 of 94, T-014 (a) the only red; T-008 `--tree` green; T-901 host 11 of 11; the T-721 negative control 3 of 3 |
| e2e | success: chromium + wire 994 of 994 (the 28 `@wire` tests in the call), visual 392 of 392, the CS-OPS-1 overlay stack 26 of 26, T-802 on the harness build 73 of 73 |
| ops | success: Jest ops 18 of 18 (4 suites), T-907 c2 7 of 7, c1 and c3 rehearsal 2 of 2 |
| gate | **failure** (unit, image) |

In all 2,748 passed and 2 failed. T-014 (a) compared 220 files of the tip's build and its twin, which sits in another folder: 217 identical, none on one side only, 3 differ, and red again on its re-run alone (05:34, the image job's command shape), so not a flake.

- `static/chunks/pages/_app-567f1dd739948905.js.map`: one `sources` entry holds each build's absolute root; equal with the two roots replaced. The midpoint batch had named this cause (MID-A (a) part 3).
- `server/pages/api/healthz.js.map`: two `sources` entries differ only by webpack's duplicate-name suffix (`helpers.js?c16d` against `?63f4`, `route-kind.js?b887` against `?a2b1`), the first 4 hex of the xxhash64 of the module identifier, which holds the build folder (recomputed with the installed Next 14.2.35 webpack). Not named by the batch or the D10 round.
- `server/functions-config-manifest.json`: the same JSON, two keys of `functions` (`/outputs/[id]`, `/data-providers/[id]`) in another order; in Next 14.2.35 each key is set inside a page's concurrent static check (read, not measured). Not named by the batch or the round.

With `--root-a`/`--root-b` alone (the committed script, measured) 218 were identical and the last two files still differed. So it came back to the owner before this record (J3-MID-C14-JUMPCHECK-1) with four options: (a) one acceptance change in three parts, recommended; (b) the twin built in the tip build's own folder with the manifest part only; (c) T-014 (a) recorded red for jump 3 and fixed at the start of jump 4; (d) the roots only, which does not pass. Nothing was committed or adjusted to pass before the owner's answer; §1.2 gives the rule the change was then made under.

### 1.2 The T-014 round and its three commits

**The rule the change was made under**, as the signed round states it (J3-T014-18, J3-T014-V1-12): under 55 §0 a test that is red again on its re-run is a regression, never fixed by changing the test (D1). This red was read instead under 40 §9 rule 1 (b): a determinism defect of the comparison, not of the app, since the two builds are of one tree and every difference found is in bytes that depend on the build folder or in the order of one manifest's keys. Such a defect is fixed under 40 §8, here with its rule 8, since the change accepts more; option (a) as put to the owner named that rule. No app file, build key or baseline moved.

The owner chose (a) ("Go with option a", 2026-11-13 05:44 +0400, §5). The round `.p2-work/jump3/owner-round-t014.md` drafted the three parts as patches against `b04bef8`, measured them on the jump check pair, ran their negative controls and rule 7's proof; three lenses checked it before the signature (§4). The owner signed it ("Sign T14 (a)", 16:11; the round 641 lines, sha256 `5bb70e1daa1d600fbf597b7aea679ef164bc90c47c19a55cb5be4719f50b99b8`). Its section (g), steps 1 to 4, on the short branch `upgrade/jump3-react18-next14--t014` from `b04bef8`:

| Commit | Part | `next-diff.mjs` on the pair, as the test calls it |
|---|---|---|
| `a461469` "Pass each build's root to next-diff in T-014 (a) (T-014, T14)" | 1: T-014 (a) passes each build's root, read from `appDir` of `.next/required-server-files.json`, else the folder that holds `.next` | 218 of 220 identical |
| `6be9481` "Compare server/functions-config-manifest.json with sorted function keys in next-diff (T-014, T14)" | 2: that manifest compared as JSON with the keys of `functions` sorted, the form decision 8 (a) of jump 2 gave `server/pages-manifest.json` | 219 of 220 |
| `d6e74eb` "Set apart webpack's duplicate-name suffix in the source maps of two build folders in next-diff (T-014, T14)" | 3, the narrow form (a): only when the two roots differ, only a `?` plus 4 lower-case hex right after a file name with an extension at the end of a `sources` entry, each suffix replaced by the order of its first use in that map, only in a map written as `JSON.stringify` writes it; the suffix's value is not checked | 220 of 220, exit 0 |

Each committed file and message equals the signed drafts byte for byte (the round's section (h)); no attribution line. On `d6e74eb`: T-014 (a) in Jest with the image job's environment on the pair green, 1 of 1; `npm run lint:parity` OK; `shasum -a 256 -c test/baseline/SHA256SUMS` 1,306 of 1,306; the three build keys unchanged (`48f7a7c8d9eafeae`, `ccc53f513f12dc8d`, `3898df7d0ecb64cc`: `test/` and `scripts/` are outside the runtime tree); the guard diff empty; the wording check of the messages and the 91 added lines clean. Merged with `--no-ff` as `094f3bc` "Merge the T-014 (a) comparison change (T-014, T14)" and the branch deleted; `b04bef8..094f3bc` changes `scripts/next-diff.mjs` and `test/static/t014-build-determinism.test.js` only (91 insertions, 4 deletions).

**Rule 7's proof, as the round's section (d) gives it** (40 §8 rule 7; it departs from the form of the STATUS §1 row of the T-014 (a) sorts, since no old build pair and no golden build stands, and on Next 14.2.35 no pair in two folders has the old comparison right on every file; the owner's signature covers the departure, item 5 of the round; STATUS §1, row Rule 7 proof of the T14 normalisers):

- **R1, the row's form on the jump check pair less the three files** (`--exclude`): the old script (`b04bef8`), part 2 and part 3 in forms (a) and (b), each without and with the roots, print 8 byte-identical outputs: 217 identical, none differ, sha256 `3c8d85b979403a2f42c3c7e652257ccd69a1a37456b7888983c5d6c72cc0429e`. T-014 (a) passes no `--exclude`, so R1 has no Jest run.
- **R2, inertness on identical input:** each of the four trees against a byte copy of its own `.next` gives 8 byte-identical outputs per tree: `48f7a7c8d9eafeae` 220 of 220 (`e345f8842666f18f163c97b6e7226f84c4605414bc936eca5557a70e3547d862`), its twin 220 of 220 (`84315a4d4a20e0f0eb6d7631ca5e6ea983a2f886a6a1283cbf55ca44065b48eb`), `ccc53f513f12dc8d` 225 of 225 (`c226f95051c380a6e3fad76eab816925a902a41156030cffb78ff626cf2f513f`), `3898df7d0ecb64cc` 220 of 220 (`bcb32610efec67b2e730da202e03e7250a709f01152a00835d4aa183808ae1a5`); T-014 (a) in Jest on these four pairs, with the old files and with part 2's, (a)'s and (b)'s, green 16 of 16.
- **R3, beyond the row's form:** on the five pairs of different variants among the four trees, files go from "differ" to "identical" only for the three causes (the `_app` map on 2 pairs, the healthz map on 5, the functions manifest on 2), none the other way, and the only-A and only-B lists are unchanged.
- **Not covered:** a pair of an older Next or the golden build (none stands); a docker pair (D19); a twin pair in another folder where the old comparison was right on every file (none can exist on 14.2.35). The C1 re-run is due at GATE-S's faults run (§9.1).

### 1.3 The call on `094f3bc`

The one call again (the round's section (g) step 5), on the merge `094f3bc`, under heavy.lock and `nohup caffeinate -i`, 2026-11-13 16:22:24 to 16:51:24 +0400, exit 1 through unit. Every build step found its tree, so nothing was built: the four trees of §1.1, the tip's 232 `.next` files equal to the list the owner accepted on 2026-11-12 before and after the call (sha256 of the list `14a514b4b66f4da11831b38455d81e405bd222f36975b92de320e58c3d55a8a4`).

| Job | Result |
|---|---|
| lint (20 s) | success: T-001 OK (ESLint 18 = baseline 18, stylelint 12, Prettier 0 of 307, directives 36); docs check ERROR 0, WARN 20, INFO 102; ledger `--offline` (base `master`) 427 rows, 380 in force, pass; fixture scrub 240 files, 0 problems |
| unit (220 s) | **failure:** 1,104 of 1,105 (59 of 60 suites): T-104 c2 only (Expected "18", Received "24", `test/unit/api/t104-wire-headers.test.js:160`); no SIGSEGV |
| image (71 s) | success: `test:harness` 25 of 25; the browser targets equal; layer A 94 of 94 in 19 suites, T-014 (a) green; T-008 `--tree` green; T-901 host 11 of 11; the T-721 negative control 3 of 3 |
| e2e (1,407 s) | success: chromium + wire 994 of 994 (28 `@wire`; T-603 c1, T-608 c2 on the no-DSN tree, T-611 c1 and c2, T-728 c4 on the dev inventory among them; no flaky, no retry, none skipped or not run), visual 392 of 392, the CS-OPS-1 overlay stack 26 of 26, T-802 on the harness build 73 of 73 |
| ops (21 s) | success: Jest ops 18 of 18 (4 suites), T-907 c2 7 of 7, c1 and c3 rehearsal 2 of 2 |
| gate | **failure** (unit only) |

- **Totals:** 2,749 passed, 1 failed, none did not run: unit 1,104 + 1; harness 25; static 94; T-901 11; T-721 3; chromium + wire 994; visual 392; CS-OPS-1 26; T-802 73; Jest ops 18; T-907 9. Against the call on `b04bef8` (2,748 and 2) the one test more is T-014 (a); every other count is equal, and the 1,508 Playwright titles that passed are the same set in both calls. Jump 2's last call gave 2,749 and 1 as well.
- **The one red, T-104 c2:** Jest runs on Node major 24, the Dockerfile says `FROM node:18`. It is the gate of the Node base image (jump 2 batch decision 5 (c)) and turns green with the final deploy (§9.4). No re-run was needed: it is the red the round names.
- **After the call:** the four trees' `.next` hashes equal before and after; `e2e:status` []; the checkout clean at `094f3bc`; the keys, `images.json` (`2f1d5327...`) and the dev inventory (`6eda8a28...`) unchanged. The four trees stand for the jump's last batch (§9.6).

## 2. Merges on the jump branch

`git log --first-parent 455a381..094f3bc` of `upgrade/jump3-react18-next14`, oldest first (merges with `--no-ff` of a short branch, deleted after; the others are commits on the branch itself):

| Commit | Content |
|---|---|
| `6509183` | W5.5: the signature and its change-site rows (CS-ESC-4, CS-R18-7) |
| `74985a4` | W5.5: the rows that name the hydration flag and the sidebar files (W55-K, W55-L) |
| `c1e15cf`, `805d104`, `b45781d`, `8775a2a`, `372314e`, `1174313`, `5a46e5d`, `0956562` | W5.5: the eight fixes on React 17 in the batch's order: CS-R18-4, CS-R18-3, CS-ESC-3, CS-ESC-2, CS-R18-2, CS-ESC-1, CS-ESC-4, CS-R18-7 |
| `a6f22a8` | W5.5: AD-153..AD-158, their constants and the dev inventory without the patch |
| `c87e87f` | W5.5: the re-baselines as chain link B3-local and the V28 rows (AD-159..AD-162) |
| `037a3d6` | W5.5: the record, its statuses and README §8 |
| `ef632d0` | W6a: React 18.3.1 and RTL 16.3.3, the pin sets, the allow-list, the tools, the settle fix, CS-R18-3 and CS-R18-8, the record |
| `52118d3` | W6a: AD-163..AD-173, their constants, titles and comments |
| `1199a48` | W6a: the re-captures, the T-417 re-record and the outputs-2003 B0 as chain link B4-local |
| `71c08e6` | W6a: the run on the jump tip, W6a as done |
| `5672b0e` | W6a: the record corrections, its STATUS rows, README §8, the popup timings |
| `dee5873` | W6c: Next 13.5.11, CS-N13-7 and CS-N13-8, the pin sets, the syntax floor, the tools, the record |
| `80a230c`, `f347be4`, `9c2ee2f`, `bc68ab0` | W6c: the four harness commits of W6C-J (T-601 c5, T-016 c2) |
| `3256c75` | W6c: AD-174..AD-203, the withdrawals, their constants, comments and literals |
| `65b916e` | W6c: the Next 13.5 lines of the T-904 edge checklist |
| `cc63b21`, `3be0bb0` | W6c: the row CS-N13-9 and the server code kept unminified |
| `a076eb8` | W6c: the re-captures as chain link B5-local |
| `cf138d7` | W6c: the run on the jump tip, W6c as done |
| `901cf1f` | W6d: Next 14.2.35, CS-N14-2 and CS-N14-3, the pin sets, the syntax floor, the tools, the test wording, the record |
| `71c8c3e` | W6d: AD-204..AD-237, the withdrawals, their constants, comments and literals |
| `dd8f927` | W6d: the Next 14.2 lines of the T-904 edge checklist |
| `724235a` | W6d: the re-captures as chain link B6-local |
| `fdad893` | W6d: the run on the jump tip, W6d as done |
| `adf29b2` | midpoint: twelve refreshed fault patches, the corpus wire window and the golden-build recipe (the work session's merge of 2026-11-06 10:35, confirmed by MID-P (a)) |
| `cf67567` | midpoint: the jump-3 section of the production tree map (§9.2) |
| `020028c` | midpoint: the Stryker entries of jump 2's R2-8 (a) (MID-F (a)) |
| `9eb2306` | midpoint: the fault and corpus tooling (MID-A, MID-B, MID-C, MID-E, MID-J) |
| `c0b11dd` | midpoint: the corpus's key and value change and the midpoint round's STATUS row (docs) |
| `4b9407f` | midpoint: the faults run's kill summary (MID-E (a), J3-MID-F6-FAULTS-1) |
| `2988524` | midpoint: AD-238..AD-438 (the midpoint rows and the D10 round's three) |
| `dafd9bb` | midpoint: the edge header lines of the T-904 checklist (AD-244, AD-429, AD-430) |
| `b04bef8` | midpoint: the follow-up and the owner's decisions since its signature (docs) = the tip of the first call |
| `094f3bc` | the T-014 (a) comparison change (T14; §1.2) = the tip of the second call |
| Merge of `upgrade/jump3-react18-next14--record` | this record, the T-014 round's STATUS rows, README §8, STATUS §1, §4, §5, §6, 02 §3 and the Next advisories row of 20 (docs only) |
| Merge of `upgrade/jump3-react18-next14--record-fixes` | the fixes of this record's three end-state reviews (§4), with STATUS §5's jump 3 row, a STATUS §6 log row and README §8 action 2 (docs only) |
| Merge of `upgrade/jump3-react18-next14--last-batch` | the jump's last batch, signed by the owner 2026-11-13 (§5): this record's status line, Sign-offs and the texts of the batch's section (d) step 2; STATUS §1, §2, §4, §5 and §6, README §8, and the plan texts of LB-3 (a) (its one `;` written as `,` under the owner's decision on J3-LAST-1, §5) and LB-6 (a) in 30, 40, 41 and STATUS §1 (docs only) |

## 3. Steps

### 3.0 Versions, old → new (02 §5 step 6)

| Row (02) | Old (jump-2 tip `455a381`) | New (jump tip) | Step, CS |
|---|---|---|---|
| react, react-dom | `^17.0.1` (17.0.2) | **18.3.1** exact | W6a CS-R18-1 |
| next | 12.3.7 exact | 13.5.11 exact at W6c, then **14.2.35** exact | W6c CS-N13-5; W6d CS-N14-1 |
| @testing-library/react | 12.1.5 | **16.3.3** exact (only in `test/utils/render.js`) | W6a CS-R18-5 |
| runtime Node | 24.18.1 | 24.18.1 (unchanged; the image stays `node:18-alpine` until the deploy-time item) | - |

Inside the lock (from `react-dom` and `next`): `scheduler` 0.20.2 → 0.23.2; Next's `@next/swc-*` binaries 13 at 12.3.4 → 9 at 13.5.9 → 9 at 14.2.33 (none a WASM build); `postcss` 8.4.14 → 8.4.31; `styled-jsx` 5.0.7 → 5.1.1; `@swc/helpers` 0.4.11 → 0.5.2 → 0.5.5, with `@swc/counter` 0.1.3 new; `busboy` 1.6.0, `streamsearch` 1.1.0 and `client-only` 0.0.1 new; `watchpack` 2.4.0 and `glob-to-regexp` 0.4.1 came at W6c and went at W6d; `graceful-fs` 4.2.11 moved from the development into the production tree (§9.2); Next's nested `use-sync-external-store` 1.2.0 gone. Lock: `lockfileVersion` 2 kept, 1,630 → 1,609 `packages` entries. Production tree: 400 → 400 `name@version`, 22 removed, 22 added (§9.2). W5.5 changed no version on the jump branch: React 18.3.1 ran only on the two spike branches.

### 3.1 W5.5: the React 18 spike and the ESCALATES fixes on React 17 (2026-10-31..2026-11-03)

DONE on Chromium by the owner's reading W55-J (a). The spike proved all six ESCALATES candidates (Q-052 in `next dev` only), found a second nested-anchor site and a React 18 regression of the navigation crash recovery, and rejected Q-008 (it stays PRESERVE); eight fixes on React 17 (CS-R18-2, -3, -4, -7, CS-ESC-1..4), AD-153..AD-162 and link B3-local. Record: [W5.5.md](W5.5.md).

### 3.2 W6a: React 18.3.1 on Next 12.3.7, RTL 16.3.3 (2026-11-03..2026-11-04)

DONE on Chromium; react and react-dom 17.0.2 → 18.3.1, `@testing-library/react` 12.1.5 → 16.3.3 (CS-R18-1, CS-R18-5); two app changes that keep today's behaviour (CS-R18-3, CS-R18-8); AD-163..AD-173, link B4-local; one visitor difference accepted as a React 18 fact (J3-W6A-INV-1, W6A-M (a)). Record: [W6a.md](W6a.md).

### 3.3 W6c: Next 13.5.11 on React 18.3.1 (2026-11-04..2026-11-05)

DONE on Chromium; next 12.3.7 → 13.5.11 (CS-N13-5, CS-N13-6); three app lines (CS-N13-7, CS-N13-8, CS-N13-9 `serverMinification: false`); AD-174..AD-203 with 18 rows withdrawn, link B5-local; VF-21 closed for the deployed form. Record: [W6c.md](W6c.md).

### 3.4 W6d: Next 14.2.35 on React 18.3.1 (2026-11-05..2026-11-06)

DONE on Chromium; next 13.5.11 → 14.2.35 (CS-N14-1); two app lines (CS-N14-2, the old-browser `include` entry; CS-N14-3, the `headers()` entry for `/outputs/update/`); AD-204..AD-237 with 14 rows withdrawn, link B6-local; VF-20 closed for 14.2.35; three deploy-time rows (W6D-H (a)). Record: [W6d.md](W6d.md).

## 4. Reviews and pre-sign checks, and how each was settled

Jump 3 had no separate end-of-step review like jump 2's; each batch and round had its pre-sign check before it went to the owner. Each check read the round against the evidence and the plan in lenses; a fixer then re-checked every finding against the files, fixed the confirmed ones in the round's text (its "Changed after the pre-sign check" list) and filed them in `.p2-work/jump3/issues.md`. Nothing was signed before the fixer's pass.

| Round | Checks | Findings and how settled |
|---|---|---|
| W5.5 (`owner-batch-esc.md`) | two lenses, one on the evidence, then the text fix (2026-11-01 05:12 +0400) | every finding re-checked; the confirmed ones fixed, two new decisions W55-K and W55-L; the details refuted are named in J3-W55-PS-3. [W5.5.md](W5.5.md) Sign-offs and §10 |
| W6a and W6a rows | two lenses (plan, evidence) and the text fix for each (2026-11-03 18:35 and 2026-11-04 03:34 +0400) | 26 findings, all hold; then 22 (J3-W6A-V2E-1..12, J3-W6A-V2P-1..8), every one confirmed, one detail refuted, W6A-T added. [W6a.md](W6a.md) Sign-offs and §8 |
| W6c and W6c rows | first round: three lenses and a text fix, then a second check of two lenses (2026-11-04 17:35, 18:08); second round: three checks (2026-11-05 07:17, 07:50, 08:42) | 25 and 15 findings (J3-W6C-EV-*, J3-W6C-RC-*); then 25, 17 and 10 (J3-W6C-V2-*, -V3-*, -V4-*), none refuted. [W6c.md](W6c.md) Sign-offs and §8 |
| W6d and W6d rows | first round: three lenses and a text fix, then two checks of two lenses (2026-11-05 16:31, 17:06, 17:46); second round: the same (22:06, 22:44, 23:19) | 30, 10 and 14 findings, all confirmed; then 35 (24 distinct, 23 fixed, 1 refuted), 11 (10 distinct) and 9 (7 distinct). [W6d.md](W6d.md) Sign-offs and §8 |
| midpoint (`owner-batch-midpoint.md`) | three checks (2026-11-06 15:33, 16:16, 17:12 +0400), and the work session's decision of 15:36 applied between the second and the third (16:32) | 39 findings of three lenses, 27 distinct, all confirmed (J3-MID-V1-1..27); 13 of two lenses, 11 distinct, all confirmed (J3-MID-V2-1..13); 12 of two lenses, 10 distinct, all confirmed, two narrowed (J3-MID-V3-1..12). The decision of 15:36 relettered MID-M: the five exact rows became (a), the mask (b) |
| D10 round (`owner-batch-midpoint-d10.md`) | two lenses (evidence, owner) and the fixer (2026-11-13 00:02 +0400) | 11 findings, all confirmed, none refuted (J3-MID-N-V1-1..11); the options and the recommendation unchanged, block `d10` byte-unchanged |
| T-014 round (`owner-round-t014.md`) | three lenses, on the owner's reading, on over-acceptance and on the rules (2026-11-13 06:33 to 06:38 +0400), then the fixer (07:00) | J3-T014-6..21, all hold, none refuted; fixed as J3-T014-V1-1..16: a third answer (c) offered, part 3 (a)'s pattern narrowed to a file name with an extension, the controls grown to 44 (P2-10..P2-13, P3-17..P3-20), rule 7's departure named and put in the signature (item 5), 42 §5 item 1 and the 41 row T-014 left for the last batch |
| This record (at `ab24d63`) | three end-state reviews, read-only: rules and records; the ledger, baselines and tests; the items carried to this record (2026-11-13 17:20 to 17:45 +0400), then the fixer | 14 findings (J3-REC-6..19), none in the ledger lens, each re-checked and all confirmed, none refuted. Fixed in this record (Rules in force, the first-parent count, §1.1, §1.2, §5, §8.4, §9.6 items 1, 4, 6 and 7), in STATUS §5's jump 3 row and §6 (one log row) and in README §8 action 2; the record role's two times in the work-session log corrected. For the owner in the last batch (§9.6 item 1): the 200 ledger lines of the history check (item 6), one word the docs use for the work session's role (J3-REC-18) and W5.5's four plan-doc texts (J3-REC-6) |

The checks after a signature are each step's own: for T14, every committed file and message against the signed drafts, the lint, rule 7 and Jest checks on the third commit, and the call on the merge (§1.2, §1.3); none differed from the round.

## 5. Owner decisions

Each with the owner's words verbatim, as `.p2-work/jump3/notes.md` records them (local time, +0400), and what the words cover as read with their round. The rows of STATUS §2 give the same for each but the go-ahead, which STATUS §6 records in jump 3's first log row (as for jump 2's); R-015-a's "go ahead with (b)" is in the midpoint batch's row.

| Date and time | Owner's words | What they cover |
|---|---|---|
| 2026-10-31 22:16 | "Start jump 3" | the go-ahead: 50 §4.0 row 3, W5.5, W6a, W6c, W6d in that order, the jump check and the heavy checks at its end (the installs of each step's versions from npm and the rules of jump 2 are the reading recorded beside it, below) |
| 2026-11-01 09:28 | "Sign W55-A to L (a)" | the batch W5.5: W55-A to W55-L with option (a), the rows of its section (b), the CS rows and corrections of its section (d) step 1, the record text of its step 6 as far as it reports these decisions; not W6a's pin sets |
| 2026-11-03 21:55 | "Sign all (a)" | the batch W6a: W6A-A to W6A-L with option (a) (the pin sets, the allow-list, the tool changes, the settle fix, CS-R18-3 and CS-R18-8, a second round for the W6a rows); no ledger row |
| 2026-11-04 11:35 | "Sign all (a)" | the batch W6a rows: W6A-M to W6A-T with option (a), AD-163..AD-173, the declared rows of B4-local, AD-153 withdrawn; not the B4-local SHA-256 sets |
| 2026-11-05 02:21 (2026-11-04 22:21 UTC) | "Sign all (a)" | the batch W6c: every recommendation of W6C-A to W6C-I, W6C-F read as "a and i"; no ledger row |
| 2026-11-05 11:12 | "Sign all (a)" | the batch W6c rows: every recommendation of W6C-J to W6C-T, AD-174..AD-203, the withdrawals, B5-local's declared rows, CS-N13-9; not B5-local's SHA-256 sets |
| 2026-11-05 17:55 | "Sign all (a)" | the batch W6d: W6D-A to W6D-H, each option (a), among them CS-N14-2 and W6D-H's three deploy-time rows (confirmed in the jump's last batch); no ledger row |
| 2026-11-06 05:25 | "Sign all (a)" | the batch W6d rows: W6D-I to W6D-Q, each option (a), CS-N14-3, AD-204..AD-237, the withdrawals, B6-local's declared rows; not B6-local's SHA-256 sets, the W6d record's text, W6D-H's rows of 20 |
| 2026-11-06 20:23 | "Sign all (a)" | the batch midpoint: MID-A to MID-Q, each option (a), with the owner's words each names past a signed rule (the go-ahead's install scope for MID-A; 55 C1 Freshness for MID-B, MID-C, MID-D; 55 §0's harness-fix clause for MID-H; 90 rule 6 and 30 §1 rule 3 for MID-J), AD-238..AD-435; not MID-N's own round, the jump check, this record and the last batch |
| 2026-11-07 01:25 (2026-11-06 21:25 UTC) | "go ahead with (b)" | option (b) of J3-MID-F3-FAULTTOOLS-1: R-015-a committed as refreshed and recorded invalid by the faults run, R-015 resting on R-015-b |
| 2026-11-09 04:18 (00:18 UTC) | "Record now, fix in jump 4" | option (c) of J3-MID-F6-FAULTS-1: the kill summary committed as the run stands; the eight extra invalid faults added to MID-D's list; R-007, R-025 and R-040 named beside R-016; their refresh at the start of jump 4 (§8.1) |
| 2026-11-12 04:31 | "Yes, rebuild" | the work-session folder restored; the tip `c0b11dd` built again under its key; its `.next` compared with the lost build's list, equal but for the allowance or a stop (§8.5) |
| 2026-11-12 18:43 | "Accept and continue" | option (a) of J3-MID-R1-REBUILD-1: the rebuilt `48f7a7c8d9eafeae` is the tip's build, four build-time files named, no further rebuild (§8.5) |
| 2026-11-12 22:16 | "Re-run it written" | option (a) of J3-MID-R3-CONTROLS-1: MID-G item 7 run once more with 900 MiB written with non-zero bytes (§8.2) |
| 2026-11-13 00:12 (2026-11-12 20:12 UTC) | "Sign MID-N1 (a)" | the D10 round: its correction, AD-436..AD-438 with the 198 rows, the T-904 c5 commit, the corpus repeat, steps 13 and 14 (§8.6); the date hold on step 11's Jest `node` run until 04:00 |
| 2026-11-13 05:44 (01:44 UTC) | "Go with option a" | option (a) of J3-MID-C14-JUMPCHECK-1: one acceptance change to T-014 (a) in up to three test-tooling commits, its controls and rule 7's proof, its C1 re-run at GATE-S's faults run, the drafts back in a short round first, then the one call again on the four trees (§1.2) |
| 2026-11-13 16:11 (12:11 UTC) | "Sign T14 (a)" | the T-014 round: the texts of the three commits, part 3's form (a), what follows for the other callers of `scripts/next-diff.mjs`, the order of section (g), rule 7's proof as section (d) gives it (§1.2, §9.1) |
| 2026-11-13 20:12 (16:12 UTC) | "Sign all (a)" | the jump's last batch, read as its "How to answer" says: LB-1 (a) to LB-11 (a), with LB-2 (a) for each of C1 to C14 and for four older STATUS §1 phrases: this record signed as it stands at `e40edbc`; the fourteen confirmations; the 41 row T-014 (LB-3); the history check before a push on exactly the 200 signed ledger lines, and jump 4's ledger reasons (LB-4); four lines of this record (LB-5); four plan texts (LB-6); GATE-S's golden build asked at GATE-S (LB-7); the fault runner's summary step and the two Stryker comment lines in jump 4 (LB-8, LB-9); the three jump check trees deleted and the tip's build kept (LB-10, LB-11); its section (d) steps 1 to 6 (§9.6 item 1) |
| 2026-11-13 20:34 (16:34 UTC) | "A" | option (a) of J3-LAST-1, the last batch's stop before its docs commit: LB-3 (a)'s clause in 41's row T-014 written with its one `;` before "since jump 2" as `,`, every other word as signed, so that T-014 stays one Cases clause and its tests are unchanged; then the batch's section (d) as signed (Sign-offs) |

The work session's decisions are recorded in notes.md as not the owner's words. The first, of 2026-10-31, read the go-ahead as covering the installs of each step's package versions from npm and as carrying the rules of jump 2 (Rules in force above); no signature confirms it as such, and the signed midpoint batch relies on it (MID-A (a)). Those the owner's later signatures confirmed: 2026-11-04 00:25 and 02:05 (by W6A-N (a) and W6A-M (a)), 2026-11-04 12:31 and 13:04 (by W6C-C (a)), 2026-11-06 10:35 (by MID-P (a)), 2026-11-06 15:36 (the midpoint batch was signed as it applied it) and 2026-11-12 23:17 (its question went into the D10 round, which the owner signed).

## 6. Batches and rounds

| Round | Signed | What it left open ("not covered") | Where that was settled |
|---|---|---|---|
| W5.5 `owner-batch-esc.md` | 2026-11-01 | W6a's pin sets | W6A-A (a) |
| W6a `owner-batch-w6a.md` | 2026-11-03 | the PROPOSED-W6a rows | the W6a rows round |
| W6a rows `owner-batch-w6a-rows.md` (`c201c9680be7...`) | 2026-11-04 | the B4-local SHA-256 sets; a result of step 1a that differs | W6C-C (a) (C1); none differed |
| W6c `owner-batch-w6c.md` (`5593753ceec7...`) | 2026-11-05 | the PROPOSED-W6c rows, the T-601 c5 and T-016 c2 forms, the server-minification line, the T-904 c5 text | the W6c rows round |
| W6c rows `owner-batch-w6c-rows.md` (`944562a5f412...`) | 2026-11-05 | B5-local's SHA-256 sets, P-6's set, the rows and link commits' sets | W6D-C (a) (C1, C2) |
| W6d `owner-batch-w6d.md` (`fea5839afe37...`) | 2026-11-05 | the PROPOSED-W6d rows, -8's form and W6D-F's choice, -10's B6-local sets, the W6d record's text | the W6d rows round; the record's text and the sets: **the jump's last batch** |
| W6d rows `owner-batch-w6d-rows.md` (`e5b6ab4b5c32...`) | 2026-11-06 | B6-local's SHA-256 sets and the rows and link commits' sets, the W6d record's text, W6D-H's rows of 20 and the corrected CS-N12-14 row | **the jump's last batch** |
| midpoint `owner-batch-midpoint.md` (`974938eca058...`) | 2026-11-06 | MID-N's own round (D10), the jump check, this record and its last batch | the D10 round; §1; this record; **the last batch** |
| D10 `owner-batch-midpoint-d10.md` (`bed326425b56...`) | 2026-11-13 | the jump check's result, this record and the last batch; a lost tip or golden build | §1 (the jump check came back once, J3-MID-C14-JUMPCHECK-1); this record; **the last batch**; no build was lost |
| T-014 `owner-round-t014.md` (`5bb70e1daa1d...`) | 2026-11-13 | MID-A (a) part 3 and any change to `scripts/run-faults.mjs`; the docs texts of its step 6, this record and the last batch, with 42 §5 item 1 and the 41 row T-014; the GATE-S forms of MID-G item 1 and of its controls | step 6's texts: this record's commit (STATUS §1, §2); the rest: **the last batch** and GATE-S (§9.6) |
| the jump's last batch `owner-batch-jump3-last.md` (`021d2d3656a7...`; pre-sign checked by two lenses and the fixer, J3-REC-28..42) | 2026-11-13 | any result of its section (d) that differs from it, a check that does not pass, a history-scan line outside LB-4's 200; the text its docs commit writes beyond its list; jump 4 and its go-ahead, with the texts of LB-8 (a) and LB-9 (a); GATE-S's install of G's lock and MID-A (a) part 3's commit beyond MID-A (a)'s words; the push, the docs PR and the deploy | the text beyond the list: this record's Sign-offs line, for the owner at jump 4's go-ahead; the rest: jump 4, GATE-S and the owner (§9.6, §10) |

The owner's other decisions of the jump (J3-MID-F3-FAULTTOOLS-1, J3-MID-F6-FAULTS-1, the lost build, J3-MID-R1-REBUILD-1, J3-MID-R3-CONTROLS-1, J3-MID-C14-JUMPCHECK-1) were put in the live work session as one question with options and a recommendation each (§5).

## 7. Accepted-difference rows (42 §8)

`test/baseline/ACCEPTED-DIFFS.yml` at the jump tip: **427 rows, 380 in force** (all `kind: product`, ref OD-31), 47 withdrawn, next id AD-439 (at the jump-2 tip: 141 rows, 127 in force, 14 withdrawn). `node scripts/ad-ledger.mjs --offline --base 455a381`: pass, 0 violations. Filed in jump 3: 286 rows, AD-153..AD-438, every one with the signature of its round:

| Rows | Round | `signedOffBy` (`date`) |
|---|---|---|
| AD-153..AD-162 (10) | W5.5 | `SIGNED: owner, 2026-11-01 (jump 3 batch W5.5, approved in the work session)` (`2026-11-01`) |
| AD-163..AD-173 (11) | W6a rows | `SIGNED: owner, 2026-11-04 (jump 3 batch W6a rows, approved in the work session)` (`2026-11-04`) |
| AD-174..AD-203 (30) | W6c rows | `SIGNED: owner, 2026-11-05 (jump 3 batch W6c rows, approved in the work session)` (`2026-11-05`) |
| AD-204..AD-237 (34) | W6d rows | `SIGNED: owner, 2026-11-06 (jump 3 batch W6d rows, approved in the work session)` (`2026-11-06`) |
| AD-238..AD-435 (198) | midpoint | `SIGNED: owner, 2026-11-06 (jump 3 batch midpoint, approved in the work session)` (`2026-11-06`) |
| AD-436..AD-438 (3) | D10 round | `SIGNED: owner, 2026-11-13 (jump 3 batch midpoint D10 round, approved in the work session)` (`2026-11-13`) |

**Withdrawn in jump 3: 33**, each `withdrawn:` line ending with its round's date: AD-153 (2026-11-04, with -5 of B4-local, W6A-S (a)); AD-030, AD-062..AD-073, AD-104 and AD-163..AD-166 (18, 2026-11-05, W6C-K, W6C-M, W6C-T; AD-030 filed again without its two 308-slash keys as AD-203); AD-120, AD-175 and AD-186..AD-197 (14, 2026-11-06, W6D-I, W6D-K). Of the 286 rows filed, 268 are in force. The 201 corpus-keyed rows AD-238..AD-438 hold this tip's renders: at GATE-S's corpus run they are filed again or withdrawn (the midpoint batch's "For information"). The chain links of the jump are B3-local (W5.5), B4-local (W6a), B5-local (W6c) and B6-local (W6d), each in STATUS §1.

## 8. The midpoint heavy checks (55 §0)

Run on the jump tip from 2026-11-06 to 2026-11-13 under the midpoint batch (MID-A to MID-Q), its D10 round and the owner's decisions of §5. STATUS §4, row Jump 3, the midpoint heavy checks, holds the same results.

### 8.1 (a) The faults run and its kill summary

`npm run faults -- --lean --ref-build 48f7a7c8d9eafeae --ref-build-harness ccc53f513f12dc8d` at `c0b11dd`, 2026-11-07 02:39:37 to 05:36:39 +0400, under heavy.lock (at most 4 trees, free space never below 92 GiB): 75 ran, 63 valid, 63 killed on real reds as MID-E (a) reads a kill, **0 valid survivors, N_f 63 of 59**. The same run is the C1 re-run of the acceptance changes on its head (MID-J (a)'s, jump 3's, those of [jump-2.md](jump-2.md), section 13 and jump 1's), with no new survivor. The kill summary is committed in its MID-E (a) form (`4b9407f`, `test/faults/kill-summary.json`).

**MID-D's list of the 12 invalid faults, with their reasons:**
- the four the batch expected: R-084-b, stale (its target `next/node_modules/node-fetch` is gone since Next 12; `git apply --3way` conflicts); R-016-a (the build cannot resolve node-fetch, gone since Next 12); R-075-a (the build fails loudly while collecting page data, as at phase 2); R-015-a (the design at its moving tag's version from the registry requires react-slick, which the vendored design dropped, CS-DSN-4, CS-DSN-5; the owner's "go ahead with (b)");
- the eight of "Record now, fix in jump 4": R-007-a and R-007-b (the patched `next.config.js` fails Next 14.2.35's build, "r.test.test is not a function"); R-040-a (the patch wraps the server externals as (context, request, callback), Next 14.2.35 calls them as ({context, request}, callback), "reading 'issuerLayer'"); R-002-b (its `.expect` does not hold: the count-0 request check sees 1 request to `/search/_next/data/`; read, not measured: the doubled slash's 308 since Next 12, AD-106); R-025-a (its `.expect` does not hold: with the fault use-window-size moves into `chunks/pages/_app-*.js`, which the check's "outside chunks/pages/" refuses; both sides measured); R-032-b (its `.expect` does not hold: the tip's main and polyfills chunks carry `core-js/blob/v3` without the fault); R-068-b (its `.expect` does not hold: the data URL with maxRedirects 0 does not answer 200 HTML; read, not measured); R-022-a (its `.expect` does not hold: its `design.config.js` change is read only by the design postinstall, which the lean clone does not run; no detector red).

**Risks without a valid fault at the midpoint: R-007, R-016, R-025 and R-040** (43 of 47 risks keep one). R-016's mechanism, node-fetch's Host override, left the tree with Next 12; its fault is written at 6.3 (CS-AX-1; MID-D (a)). The refresh of the other three and of the eight faults (patch redrafts for R-007-a, R-007-b and R-040-a; check changes for R-002-b, R-025-a, R-032-b and R-068-b; R-022-a's runner part or its record) comes at the start of jump 4, against Next 15, before the next faults run (GATE-S).

### 8.2 The negative controls left for the midpoint (MID-G (a))

Each run once on the tip `4b9407f` and its build `48f7a7c8d9eafeae` (2026-11-12), all ten red as their records say:

1. T-014 (a)'s sorts (`a766c0e`, `a59d854`): 8 of 8 changes flagged (a file removed, added or renamed in an `.nft.json` list, a page removed, added or changed in `server/pages-manifest.json`, a whole file removed or added).
2. T-728 c4's map rule `next12-dev-hmr-websocket` (`568da69`): 7 of 7 unmapped dev console lines flagged.
3. The T-741 routeChange helper (`6d5085d`): a cancelled event of the target route fails it.
4. T-004 c6's key `client:core-js:all-scripts` (`11eeca5`): an uncovered polyfill key flagged.
5. The T-412 allow-list entry (`f38987c`): each of five unlisted console lines fails T-412.
6. The wire capture's quiet period (`190f17e`): a wire request added or removed turns T-607 c2 red, and a Sentry record or a stub problem turns T-610 c4 red.
7. AD-151 (`6383c79`), **in the written form**: with 900 MiB written with non-zero bytes in front of the c2 preload, T-611 c2 is red at its peak RSS assertion (1695.9 MiB against 863.5), under the owner's "Re-run it written". The jump 2 review's zero-filled form no longer fails (808.8 MiB against 863.5): on Node 24.18.1 on this workstation pages never written are not resident, so the RSS that T-611 c2 samples does not count them (zero-filled 41.8 MiB, written 942.0 MiB, checked apart).
8. AD-152 (`d449003`): retained JS objects turn T-611 c2 red at its heapTotal assertion (236.1 MiB against 218.9), its other two figures under their limits.
9. Jump 1's T-610 frame normaliser and 42 §8 key-rule extensions: their known answers 31 of 31 and one control each.
10. The corpus wire window (`c55f1ee`): a stub answer injected on a provider page that moves its late account request gives an unexplained `<url>/ssr-wire` diff.

The forms of the controls are in the controls step's words (J3-MID-R3-CONTROLS-2, -4), for the jump's last batch.

### 8.3 MID-H's reading and MID-I's figure

- **The flake class "Jest worker SIGSEGV" (MID-H (a)):** jump 3's two cases (t102 at W5.5, t403 at W6c; 2 of 42 full node + dom runs before the midpoint) are one crash inside Node 24.18.1's garbage collector in a Jest worker on arm64 macOS (EXC_BAD_ACCESS in `ClearStaleLeftTrimmedPointerVisitor::VisitRootPointers` during a full mark-compact collection; the two macOS crash reports equal frame for frame, with no app, test or native add-on frame), each suite green on its re-run. There is no harness cause to fix: by the owner's words past 55 §0's harness-fix clause, a suite that fails with exactly "A jest worker process (pid=...) was terminated by another process: signal=SIGSEGV" is re-run once and recorded as this class with its macOS crash report, with no harness change. Neither jump check call had it.
- **Coverage (MID-I (a)), printed, not gating (55 §0 (c)):** the midpoint's figure is **89.06 %** of app statements (8359 of 9386), by 55 C3's fallback to Jest and Chromium, against phase 2's 88.79 % (7933 of 8935). `npm run coverage` printed 90.78 % and "pass >= 90%: true", but its attribution check found 0 app modules in the 22 server and 17 client bundles (webpack 5's module ids as the cause: read from the code, not measured), so that figure is not the midpoint's. GATE-S reads coverage the same way unless MID-I (b)'s harness change lands before it.

### 8.4 (b) The corpus run and its repeat

- **The first A/B run** (2026-11-06, `midcorpus-ab`, the golden build `1fb7e5b548c5ae8c` made by `832ff4e`'s recipe, G `689fec9`, against `11923a46ba5d19c2`): 77 URLs rendered twice, 0 unsettled, 24 screenshot comparisons at 0 px; 433 diffs, 0 explained, exit 1, as W6D-Q (a) expected (no AD row had a corpus key). Every diff was matched to a signed row or change, named as W6D-Q (a)'s expected exception (H7, the empty shell) or as a finding (H4, D9, D10); the owner's midpoint round settled them with MID-J (a)'s key and value form (40 §8 rule 8, past 90 rule 6 and 30 §1 rule 3 read widely), the 198 rows and the D10 round's three.
- **The repeat** (section (d) step 12, 2026-11-13 04:13 to 04:44 +0400, `npm run corpus -- --golden p2-local/golden --candidate 48f7a7c8d9eafeae`, `midclose-repeat-ab`, the golden build made again by the same recipe, buildId `7gwzWK-9yKyJkd0R3i-Dg`): 77 URLs rendered twice, 0 unsettled, 24 screenshot comparisons at 0 px; **433 diffs, 433 explained, 0 unexplained, PASS**; each of the 201 rows AD-238..AD-438 used exactly as often as it lists keys (AD-436 once, AD-437 once, AD-438 three times), no committed row AD-001..AD-237 used. Report `$ARTIFACT_DIR/corpus/runs/midclose-repeat-ab/report.json` (sha256 `9f32ab5c02c378416cfe2af7175e30b084b6abf2755e14fe121cbf1571d9f5ac`). The golden build was deleted after it with its `images.json` record.
- **The one `--inject` control of MID-J (a)'s tooling** (a stats 500 on `/data-providers/3354/`) turned that candidate page into the notFound 404, whose headers on 14.2.35 equal the provider page's, so it gave no T-603 diff: it showed the hashed form with `firstDiff` (T-728, T-605, T-702) and the per-URL keys of T-601, T-610, T-607 and T-801, none explained, but not a per-URL header key. That key form is shown only by the corpus self-test and by the dump comparison (its 86 T-603 diffs); the batch asked for one control, so no second was run (J3-MID-F4-CORPUSTOOLS-3).
- **55 C4's per-row URL counts** (the repeat role's `logs/per-row-url-counts.tsv`, one line per row: id, test, keys listed, diffs explained, URLs; sha256 `e8719e028f7b3568a072b3d68aca44acb71668d59743532fa9f319f72e8a7bf3`, in the work-session state and its durable copy): 201 rows, 433 diffs, 332 row-URL pairs; 177 rows hold one URL. By test:

| Test | Rows | Diffs | URLs |
|---|---|---|---|
| T-728 | 120 | 237 | 155 |
| T-603 | 16 | 86 | 85 |
| T-602 | 28 | 54 | 54 |
| T-605 | 22 | 22 | 22 |
| T-702 | 6 | 18 | 6 |
| T-701 | 2 | 9 | 3 |
| T-607 | 5 | 5 | 5 |
| T-601 | 1 | 1 | 1 |
| T-610 | 1 | 1 | 1 |

  The widest rows: AD-239 (T-603, 55 URLs), AD-335 (T-728, 27 diffs on 9 URLs), AD-254 (T-602, 24), AD-314 (T-728, 18 diffs on 6 URLs), AD-242 (T-603, 9), AD-334 (T-728, 8), AD-313 (T-728, 5). D10's rows: one URL each.

### 8.5 The rebuilt tip build

The tip's build `48f7a7c8d9eafeae` (MID-F (a)'s alias of `11923a46ba5d19c2`, the W6d build) was lost in the weekly pause (Evidence above). Under "Yes, rebuild" the tip `c0b11dd` was built again under the same key with the lean builder (2026-11-12 04:41 to 04:42 +0400, buildId `R7G5wsJrek1t1SLBzDQXO`, Node 24.18.1, `images.json` record `5c9317ee...`). Of the lost build's 232 `.next` files, 218 are equal, 10 differ within the allowance of "Yes, rebuild" (the buildId's 3 files, 6 per-build manifests, the `_app` map's build-folder path) and **4 differ outside it, the build-time files the owner accepted** ("Accept and continue"):

- `server/pages/api/healthz.js.map`: two duplicate-name suffixes derived from the build folder's path; swapped back, the lost hash is reproduced;
- `next-server.js.nft.json` and `next-minimal-server.js.nft.json`: Next's own server trace, whose file order is not reproducible;
- `trace`: the build's timings.

The first count of 11 within the allowance was corrected to 10 (J3-MID-R1-REBUILD-4). MID-G's controls, MID-N's capture, the corpus repeat and both calls of the jump check ran on this tree, never rebuilt after it.

### 8.6 D10 (MID-N1 (a)) and Q-008's shadow note

- **D10, as the signed D10 round gives it:** the 404 page answered for `/search/_next/data/b/works/1001.json?id=1001`, a `_next/data` address of another build opened as a page, carries the search page's header class `styles_header` (Q-008) on the tip and not on today's site, server-rendered and after hydration, because Next 14.2.35 renders that 404 with the request's own path as `asPath` where Next 10.2.3 used the rewrite's target (read in Next's sources). Measured on the golden build and the tip's build: the header keeps the app bar's drop shadow on both (the same computed `box-shadow`), and the screenshots at 1440, 768 and 375 and with JavaScript off at 1440 are 0 px apart (26 comparisons). So D10 is markup only, one more class on that answer's header element, and a visitor sees no difference. The midpoint batch's read effect ("the header without its shadow") was wrong; the signed batch and its STATUS §2 row stay as committed, and the D10 round's row states the measured effect. AD-436 (T-605), AD-437 (T-728 SSR body) and AD-438 (T-728 hydrated, three time zones in one key).
- **Q-008's `styles.header` removes no shadow** (D1: an existing behaviour stays; J3-MID-R4-GOLDENMIDN-5, J3-MID-R5-NBATCH-1): in each build's `_app` stylesheet its `box-shadow: none` comes before the design's app bar rule, of equal specificity, so the later rule wins on both builds. Measured on the two 404 answers; on the search pages, which carry the class on purpose, measured by T-805 c1's committed baseline of `/search/?q=climate` (the app bar elevation in B0-local and in its re-captures on 12.3.7 and 13.5, green on the W6d build) and by the corpus run's screenshots of `/search/?q=fingerprint` (0 px); for other pages read from the stylesheet. Nothing in the track changes it.

## 9. The T14 change, the production tree and what goes on

### 9.1 What T-014 (a) now normalises (T14 (a))

T-014 (a) compares two builds of one tree byte for byte, as before, with the buildId normalised and jump 2's two sorts (`*.nft.json` file lists, `server/pages-manifest.json` keys). Since `094f3bc` it also:

1. passes each build's root (`--root-a`, `--root-b`), so a build's own root written into its own output compares equal;
2. compares `server/functions-config-manifest.json` as JSON with the keys of `functions` sorted, which also leaves out its whitespace, escape forms, a repeated key and the order of integer-like keys inside a value;
3. sets webpack's duplicate-name suffix apart in the maps of two builds in two folders, in form (a) of §1.2, the suffix's value not checked.

It still compares every JS, CSS and other file byte for byte, and every map's mappings, `sourcesContent` and the rest of each `sources` entry, the functions manifest's values and every other JSON file as before. **Its controls** (the round's section (c), on clones of the pair): 44, run through `next-diff.mjs` and through T-014 (a) in Jest, the two ways agreeing in 88 of 88 cases; of the 43 that change a copy, 36 are red with (a) and 7 show what it accepts (P2-10..P2-13, the JSON forms; P3-18..P3-20, another 4-hex value in place of a suffix); the pair as built is green. The other callers: `scripts/baseline-capture.sh` (VF-09, no roots) changes with part 2; `scripts/merge-coverage.mjs` and `scripts/baseline-stability.sh` run T-014 (a) itself. **Its C1 re-run is due at GATE-S's faults run**: the faults run with no new survivor, and the round's controls on that tip, where MID-G item 1's control also clones `required-server-files.json` (with T14 its recorded form, without that file, turns red, J3-T014-1). Those GATE-S forms were confirmed by the owner in the jump's last batch (C12 (a); J3-T014-17). The 41 row T-014 names what T-014 (a) now normalises since the last batch's docs commit; 42 §5 item 1 stays, true of the 2.1 proof made before any sort (LB-3 (a), its one `;` written as `,` under the owner's decision on J3-LAST-1, §5; J3-T014-16).

### 9.2 Whole-jump production tree report

`node scripts/prod-tree-report.mjs --jump jump-3` at the jump tip: **exit 0** (`--self-test` 5/5; the output byte-equal to the prodtree step's of 2026-11-06, sha256 `682e204d4a7691e23fd1c9199077f036896d1e999bff06a2e1093b2a5bfd3574`). It compares the production `name@version` set of the lock with the jump-2 tip `455a381` and maps every change to a row of the `jump-3` section of `scripts/prod-tree-rows.json` (`cf67567`):

```
production tree 455a381 -> working tree: 400 -> 400 name@version, 22 removed, 22 added
  root next: 12.3.7 -> 14.2.35  CS-N13-5 (13.5.11, W6c), CS-N14-1 (14.2.35, W6d)
  root react: 17.0.2 -> 18.3.1  CS-R18-1 (W6a)
  root react-dom: 17.0.2 -> 18.3.1  CS-R18-1 (W6a)
ok: every change maps to a row
```

Removed: Next 12.3.7's tree (`next` and `@next/env` 12.3.7, the 13 `@next/swc-*` 12.3.4 binaries, `@swc/helpers` 0.4.11, `postcss` 8.4.14, `styled-jsx` 5.0.7, `use-sync-external-store` 1.2.0) and react, react-dom 17.0.2 with `scheduler` 0.20.2. Added: `next` and `@next/env` 14.2.35, 9 `@next/swc-*` 14.2.33 binaries, `@swc/helpers` 0.5.5, `@swc/counter` 0.1.3, `busboy` 1.6.0, `streamsearch` 1.1.0, `client-only` 0.0.1, **`graceful-fs` 4.2.11**, `postcss` 8.4.31, `styled-jsx` 5.1.1, react, react-dom 18.3.1 and `scheduler` 0.23.2. 0 unmapped, 0 stale.

**`graceful-fs` 4.2.11 (MID-O (a)):** the one added item whose row is the `next` root and not a line of 02 §3.1's text. It was a development package at `455a381` and became a production package at W6c ([W6c.md](W6c.md), section 3: `watchpack` requires it); at W6d `next` requires it itself. 02 §3.1's W6c sentence names it since `b04bef8` ("and moves `graceful-fs` 4.2.11, a development package before, into the production tree (`watchpack` requires it)"). The report is the net view against `455a381`: `watchpack`, `glob-to-regexp`, `@swc/helpers` 0.5.2 and the nine 13.5.9 binaries came and went inside the jump and are not in the 22 + 22.

### 9.3 Change-site rows added in jump 3

Each new row went into 20 before its code (01 §9): CS-ESC-4 and CS-R18-7 (W5.5, `15a3e2a`), CS-R18-8 (W6a, `0aed930`), CS-N13-7 and CS-N13-8 (W6c, `3c13d60`), CS-N13-9 (W6c, `cc63b21`), CS-N14-2 (W6d, `97cff1d`), CS-N14-3 (W6d, `f26c90a`). Rows of the plan applied: CS-R18-2, -3, -4 and CS-ESC-1 to CS-ESC-3 (W5.5), CS-R18-1 and CS-R18-5 (W6a), CS-N13-5 and CS-N13-6 (W6c), CS-N14-1 (W6d); CS-R18-6, CS-N13-3 and CS-N13-4 verified only. Rows extended with the measured result: CS-R18-2 and CS-ESC-1..3 (W55-K, W55-L, `f83aa96`), CS-R18-3 (W6A-G), CS-N13-3, CS-N12-14 and CS-N14-2 (the W6d record, `1ce5cbc`).

### 9.4 Deploy-time items (20) and edge notes

Recorded in [20](../20-change-sites.md) §Deploy-time items, never applied (D19):

- **Node base image (CS-N12-6), needed:** while the image is `node:18-alpine`, **T-104 c2 stays red until the deploy**, the gate of that item (jump 2 batch decision 5 (c)); it is the only red of the jump check and turns green with `FROM node:24.18.1-alpine` (or `node:24-alpine` by digest).
- **Found in jump 3 (W6D-H (a), the W6d record), confirmed in the jump's last batch:** the Next 14 SWC binary in the image (Next 14 has no WASM fallback; only if a Next 14 tree is deployed); the tree size of a Next 14 tree (only if one is deployed); the SIGTERM drain of Next 14.2 and later against the preStop sleep and the grace period (for any deploy of Next 14 or later, the final deploy included). Corrected: the experimental notice in the start log (CS-N12-14, CS-N13-9). The Next advisories at the deploy: `npm audit` lists 25 advisories for next 14.2.35, 3 critical, none new ([W6d.md](W6d.md), section 3.2; R-072), added to its row of 20 with this record.
- **Edge notes, T-904 item c5** (`test/ops/t904-checklist.json`): 5 lines at the jump-2 tip, 13 at the jump tip: 5 added at W6c (`65b916e`, AD-174..AD-178), 2 at W6d (`dd8f927`, AD-227, AD-235), and at the midpoint one new line and two lines extended (`dafd9bb`: Next's own 404s with `private,`, AD-430; the empty shell keyed for the corpus, AD-429; `/works//1`'s 308 without Cache-Control, AD-244). Together they name the Cache-Control and CSP differences of Next 13.5 and 14.2 an edge sees: the 404 and 500 pages, the empty shell and the error card, `/outputs/update/` (CS-N14-3), the 304 answers, the trailing-slash 308s, Next's own 404s and `/works//1`. The lines measured on 14.2.35 are read again at W7a and W7c. Checked at the final deploy with VF-01 part 2 and the rest of T-904.

### 9.5 Deferred prod-only checks

As in [jump-2.md](jump-2.md), section 12, DEFERRED to the owner's final deploy (D19, D20): VF-02; VF-01 part 2; the T-904 edge checklist with the lines of §9.4; T-907 on prod; the T-901 container half and VF-05 (the musl image, with Next 14's SWC musl binary); the T-008 alpine half; T-908 against the live logo hosts; the live-loader halves of T-009 and T-014 (b); the WebKit and Firefox legs of every step (T-701, T-728, C7 (1), T-801, T-724) and the engine at the T-015 floor. The drain under Kubernetes (W6D-H's row) is checked with the deploy.

### 9.6 Open items

1. **The jump's last batch**, signed by the owner 2026-11-13 ("Sign all (a)", 20:12 +0400; `.p2-work/jump3/owner-batch-jump3-last.md`, 452 lines, sha256 `021d2d3656a7c37b0032c87a9c5ef47cf23809a642d478bf2ee93541435f1c70`; §5, §6), each item with option (a):
   - this record's text, signed as it stands at `e40edbc` (LB-1 (a)), with the texts §9.7 lists; the texts its commit wrote outside it (STATUS §4's midpoint status cell and its row Jump 3, the jump 3 pointer in 02 §3, the Rows cell and the 14.2.35 sentence of 20's row Next advisories at the deploy, STATUS §1's rule 7 row of the T14 normalisers and the two STATUS §2 rows of 2026-11-13, whose words "(in the work session)" stay, since the answer names no other channel; J3-REC-3, J3-REC-24) confirmed as written (C13), and the texts its review fixes wrote (§4; J3-REC-20) confirmed as written (C14);
   - the W6d record's text (C3), B6-local's two SHA-256 sets (C1), P-6's set and the W6d rows, link and midpoint rows commits' sets with their places in STATUS §1 (C2), the texts the W6d record wrote into 20 (W6D-H's rows, the corrected CS-N12-14 row, CS-N14-2's cells and CS-N13-3's verify line; C4), the W6d runs' texts in their own words (C5) and the moving figures in the two-figure form (C6) ([W6d.md](W6d.md), section 9 item 1), each confirmed as written;
   - the texts the midpoint's steps wrote in their own words, each confirmed as written: the forms of MID-G's ten controls (J3-MID-R3-CONTROLS-2, -4; C7), MID-O's two texts (C8), the fault tooling's texts (J3-MID-F3-FAULTTOOLS-7, -8, -9, J3-MID-R2-KILLSUM-1 and the messages of MID-F (a)'s commits; C9), the corpus tooling's texts (J3-MID-F4-CORPUSTOOLS-1, -6, J3-MID-C12-REPEAT-2; C10) and the midpoint close's texts (J3-MID-C11-ROWS-1; the reading of step 11's Jest `node` run as CI-1 26 of 26, T-104 c2 the named standing red, J3-MID-C11-ROWS-3; J3-MID-C13-DOCS-2; J3-MID-C14-JUMPCHECK-3; C11); the forms of J3-MID-c1-3 were not asked again, MID-Q (a) Q4 of the signed midpoint batch having confirmed them;
   - the GATE-S forms of MID-G item 1 and of T14's controls (J3-T014-1, -17): confirmed (C12), so T14's C1 re-run at GATE-S's faults run takes them without another round (item 4);
   - four older phrases of STATUS §1, "confirmation in the next owner round", for items the owner confirmed on 2026-11-05: recorded as confirmed 2026-11-05 (W6C-C C4 (a), W6D-C C2 (a); J3-REC-36);
   - 42 §5 item 1 and the 41 row T-014 (J3-T014-16): the 41 row's clause (a) names what T-014 (a) normalises today; 42 §5 item 1 stays, true of the 2.1 proof (LB-3 (a), its one `;` written as `,` under the owner's decision on J3-LAST-1, §5; §9.1);
   - the 200 ledger lines of the history check: accepted for the push as an exact list, and jump 4's ledger reasons cite the work-session state without its folder's name (LB-4 (a), item 6);
   - one word the docs used since W6c for the work session's role (J3-REC-18): reworded in this record's four lines; `STATUS.md:83` and `records/W6c.md:250` keep it as their signed rounds left them (LB-5 (a));
   - W5.5's plan-doc texts ([W5.5.md](W5.5.md), section 11 item 5; J3-W55-DF-3, -DF-4; J3-REC-6) and the fifth that J3-W55-REC-3 names (J3-REC-23): 30 §2's summary, 40 §4 item 1's sentence, 41's T-716 clause 2 with the Q-100 clause after it, and STATUS §1's row Branches corrected; CS-R18-4's Where kept at tree `a825839`'s lines, as 20's Rules define it (LB-6 (a));
   - GATE-S's golden build: asked at GATE-S, before it is made (LB-7 (a), item 4);
   - the fault runner's summary step that keeps a stale fault's old record (J3-MID-F6-FAULTS-2): fixed at the start of jump 4, before the next faults run (LB-8 (a), item 2);
   - the two Node 18 comment lines of `stryker.config.mjs` (J3-MID-F2-STRYKER-1): reworded in jump 4's first commit that changes the runtime tree anyway (LB-9 (a), item 2);
   - the three trees made for the jump check (`48f7a7c8d9eafeae-ci-b`, `ccc53f513f12dc8d`, `3898df7d0ecb64cc`): deleted after the batch's docs commit, each with its `images.json` record (LB-10 (a); the batch's section (d) step 4);
   - the tip's build `48f7a7c8d9eafeae` (buildId `R7G5wsJrek1t1SLBzDQXO`): kept as jump 4's Next 14.2.35 reference; W7a's first round says how long it stays, at the latest it goes with W7a's record, and if macOS loses it before then, jump 4 builds the jump 3 tip again under its key when it needs the reference, without a stop (LB-11 (a)).
2. **At the start of jump 4:** the refresh of the eight extra invalid faults (R-007-a, R-007-b, R-040-a redrafted; R-002-b, R-025-a, R-032-b, R-068-b's checks; R-022-a's runner part or its record), against Next 15, before the next faults run (§8.1); in the same round, the fault runner's summary step: one test-tooling commit by which a fault without `finished` gets that run's record, shown by a negative control in which the old step keeps the stale record (LB-8 (a)); MID-A (a) part 3's proof again (item 3). R-016's fault at 6.3 (CS-AX-1). With jump 4's first commit that changes the runtime tree (the spike's or W7a's): the two comment lines of `stryker.config.mjs` reworded, drafted in that step's round (LB-9 (a)).
3. **MID-A (a) part 3** (T-014 (a) with its two folders in the lean fault runner, for R-075) stays uncommitted, and `scripts/run-faults.mjs` unchanged in jump 3 (its summary step: item 2, LB-8 (a)). Its first proof failed on 2026-11-07 on the three files T14 now sets apart, so it may hold at the next faults run (read from the saved output, not measured; the clone is gone); the proof is made again at the start of jump 4 (item 2).
4. **At GATE-S:** T14's C1 re-run at its faults run (§9.1), in the forms the owner confirmed (C12 (a)); the corpus rows AD-238..AD-438 filed again or withdrawn at its corpus run (§7); that corpus run needs a golden build again, a third install of G's lock past the two W6D-P (a)'s words cover (the midpoint's corpus run and its repeat, both used), so the owner's words for it are asked at GATE-S, in its own round, before it is made (LB-7 (a); the D10 round's "not covered", J3-MID-C12-REPEAT-2; J3-REC-7); coverage read as MID-I (a) reads it (§8.3); the SIGSEGV class recorded as MID-H (a) says.
5. **At the final deploy:** T-104 c2 turns green with the Node base image; the deploy-time items and deferred checks of §9.4 and §9.5.
6. **Commit subjects and the history check:** three subjects of the range carry no `(<ids>)` suffix, `6a2cc72`, `1933255` and `f92f6cd` "Reflow the comment of the hydration hook" (W5.5's fix branches, 2026-11-01); recorded, history is not rewritten. No commit message of `455a381..094f3bc` names a tool, a vendor or an absolute path. The diffs are not clean: the wording-rule history check that comes before a push (README §8 action 2, STATUS §5), `node tools/check-docs.mjs docs/upgrade --repo . --scan-history 455a381..HEAD`, exits 1 with **ERROR 200**, every one `forbidden-text` "working-directory name" in a diff and none in a message. They are 200 `reason:` lines of signed ledger rows in `test/baseline/ACCEPTED-DIFFS.yml`, 18 added by `f660983` (the W6d rows) and 182 by `7049b86` (the midpoint rows), each citing an evidence file in the durable copy of the work-session state under `.p2-work/` by that folder's name: repo-relative, not absolute, and `docs:check` does not scan `test/baseline/`, so no earlier run flagged them; jump 2's ledger had none. The ledger is append-only, the rows are signed byte for byte and history is not rewritten, so nothing is changed here. By LB-4 (a) of the last batch the owner accepted exactly these 200 lines for the push check: it counts as passed when its ERROR lines, with the `:<line>` after `history@<commit>` removed (that number shifts with every new commit) and sorted by byte, have the sha256 `ee8e84e328a77d0aedf91eb9f80e357a3455f7d45902d92fd1a6389da012762c`, and any other line stops the push. From jump 4 on, a ledger reason cites its evidence as "the work-session state, `<path inside it>`", without the folder's name, and each rows step runs the history scan on its own range before its commit and needs ERROR 0 (J3-REC-2, J3-REC-14, J3-REC-21).
7. **Known moves for W7a:** [W6d.md](W6d.md), section 9 item 3 (the `_app` chunk name, TC-1's banner, T-016 c2's comparator, P-1's letter `i` in the 14.2 T-741 pin set, which is whatever the minifier gives that class and can move with any change of `api/errors.js` or its chunk (J3-W6D-9), CS-N14-2's entry, `serverMinification`, the T-904 c5 lines); the four build-time files of §8.5 differ between two builds of one commit in two folders. T14's part 3 (a) sets a suffix apart only where its form looks (§1.2), so a suffix that depends on the build folder anywhere else (after a bare `/`, or in a new form on a later Next) turns T-014 (a) red on that Next (in a run of jump 4's steps or at its jump check), and that stop comes back to the owner: the cost of (a) the signed T-014 round names (J3-REC-13).

### 9.7 Texts the signed rounds route to the jump's record

- MID-O (a): `graceful-fs` 4.2.11 named in this §9 (§9.2); its 02 §3.1 clause is in `b04bef8`.
- MID-D (a): the list of invalid faults and the risks without a valid fault, said plainly (§8.1); with "Record now, fix in jump 4" the eight and R-007, R-025, R-040.
- MID-H (a): no harness fix for the SIGSEGV class (§8.3).
- MID-J (a): the corpus's key and value change made in spite of 90 rule 6 (a change of how C4 is measured after the failed midpoint measurement), for this round, and past 30 §1 rule 3 read widely for AD-238, AD-248, AD-280 and the other `/works//1` rows, by the owner's words; MID-M (a)'s rows add no method change of their own (§8.4).
- MID-G (a): the ten controls, item 7 in the written form (§8.2).
- MID-I (a): 89.06 %, the tool's 90.78 % not the figure (§8.3).
- "Accept and continue": the four build-time files with the rebuild (§8.5).
- The D10 round: D10's measured effect, and Q-008's `styles.header` that removes no shadow (§8.6).
- 55 C4's per-row URL counts (J3-MID-C12-REPEAT-1; §8.4).
- The T-014 round: rule 7's proof as its section (d) gives it (§1.2) and its C1 re-run at GATE-S's faults run (§9.1).

## 10. Next

Jump 3 is DONE: the owner signed the jump's last batch on 2026-11-13 (§5, §9.6 item 1). **Jump 4** ([50](../50-roadmap.md) §4.0 row 4: W7a, W7b, W7c, Next 15.5 and 16 with React 19, a spike first) is **awaiting the owner's go-ahead**; signing the last batch does not start it. It starts on a branch `upgrade/jump4-<slug>` from the jump-3 tip, with the fault refreshes and the fault runner's summary step of §9.6 item 2 first; the tip's build `48f7a7c8d9eafeae` stands as its Next 14.2.35 reference (LB-11 (a)).
