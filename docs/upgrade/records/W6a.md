# Record W6a: React 18.3.1 on Next 12.3.7 and React Testing Library 16.3.3 (lean mode)

Record W6a | **W6a landing on Chromium** (WebKit and Firefox DEFERRED, as in jumps 1 and 2): `react` and `react-dom` 18.3.1 on Next 12.3.7 with React Testing Library 16.3.3, on the branch `upgrade/jump3-react18-next14--w6a`, 13 commits over the jump tip `037a3d6` (§3). The tuple set recorded on Chromium is empty (55 C7 (1), §1). The owner signed two rounds: the pin sets, the tool changes and two app changes on 2026-11-03 (§3), and the W6a rows on 2026-11-04 (§4). On the W6a tip `477b0f2` the reds were exactly the tests of those rows and the reds the batch names apart from them, T-013 c1..c3 until the merge, T-104 c2 and T-014 (a) (§5), and every value of the rows that the run did not reach held on the same build before the merge (§6). The merge, the rows, link B4-local and the run on the jump tip follow (§10); W6a is DONE when that run is green except T-104 c2 and T-014 (a) | 2026-11-03..2026-11-04

- **Rules in force:** D1, D18 (lean target), D19 (scope), D20 (no CI) ([00](../00-decisions.md) §4b); the lean protocol ([01](../01-playbook.md) §10); gates [55](../55-gates-and-confidence.md) §0 and C7 (1); the harness-change protocol ([40](../40-test-strategy.md) §8); the ledger and the chain links ([42](../42-baselines-and-ci.md) §8, §9); [30](../30-quirks-register.md) §1 rules 3 and 4; the jump 2 note of 2026-10-30 00:49 on proven visitor differences (`.p2-work/jump2/notes.md`). The owner's go-ahead for jump 3 (2026-10-31, "Start jump 3") carries the rules of jump 2, the throttle among them (one app build and one Playwright run at a time, never both, Jest only when neither runs). W6A-K (a) put a second owner round for the W6a rows before the merge, an exception to the batching rule of jump 3 for W6a's rows only.
- **Where it ran:** one workstation (macOS arm64). Runtime Node 24.18.1 (npm 11.16.0) for every build, `next start`, `next dev` and Jest; Chromium of `@playwright/test` 1.64.1, every page through the gateway-faithful proxy, `retries: 0`, 4 workers. React 18.3.1 only in the W6a worktrees, whose `node_modules` are `cp -Rc` clones checked against the W6a lock (root 1560 installed entries, 0 differing fields; react and react-dom 18.3.1, scheduler 0.23.2, `@testing-library/react` 16.3.3, next 12.3.7); the repository's own checkout stayed on the jump branch with React 17.0.2, and the second round's section (d) step 4 brings it in sync once after the merge (01 §10 item 3). Lean builds, at most 4 build trees at a time; free space 100 to 103 GB.
- **Not done anywhere:** nothing was pushed, merged into `main` or `master`, tagged on origin or deployed; no Docker; prod and stage were never contacted. `git diff f5cfc20 -- .github kube Dockerfile .dockerignore` is empty. Every commit was made with `HUSKY=0`; `core.hooksPath` stayed unset; the user's 78 stashes are untouched. No `suppressHydrationWarning`. The bump's measurement edits of T-734 c2 and T-804 c2 (`measurement-only.diff`) replaced assertions with annotations; they were never proposed and never committed.
- **Branches (local):** `upgrade/jump3-react18-next14--w6a` from the jump tip `037a3d6`, worked in a worktree of its own; the bump's scratch worktree was removed once its copies were checked against the measured diffs (J3-W6A-DOC-4). The branch merges into `upgrade/jump3-react18-next14` with `--no-ff` after this record (the second round's step 3) and is deleted with its worktree in step 4.
- **Evidence:** every figure below comes from the run's evidence files and logs, kept with the work-session state outside the repository (`<scratch>` = the work-session folder, `$ARTIFACT_DIR` = `<scratch>/p2/artifacts`, `BUMP` = `<scratch>/p2/j3-w6a/bump`): each step's folder under `<scratch>/p2/j3-w6a/` (`bump`, `docs`, `sets`, `settle`, `app`, `app-g`, `inventory`, `run`, `batch2`, `verify2`, `merge/measure`, `merge/docs`), with a durable copy without traces under `.p2-work/` (git-ignored). The batches `.p2-work/jump3/owner-batch-w6a.md` (the first round) and `.p2-work/jump3/owner-batch-w6a-rows.md` (the second round; its section (b) wins over the proposals), the proposals `.p2-work/jump3/proposed-ad.md`, the step log `.p2-work/jump3/state.md`, the issues `.p2-work/jump3/issues.md` (J3-W6A-*), the signatures `.p2-work/jump3/notes.md`.
- **Sign-offs (01 §7):** Implementer: _. Reviewer: the pre-sign check of each batch (two checks, one of them on the evidence, then the batch text fix; done 2026-11-03 18:35 and 2026-11-04 03:34 +0400), no named person. Owner: SIGNED the batch W6a on 2026-11-03 21:55 +0400 (17:55 UTC, the same date), in the live work session, in answer to the question "Do you sign W6A-A to W6A-L with option (a)?"; owner's words: "Sign all (a)". SIGNED the batch W6a rows on 2026-11-04 11:35 +0400 (07:35 UTC, the same date), in the live work session, in answer to the question "Do you sign W6A-M to W6A-T with option (a)?"; owner's words: "Sign all (a)". Read with each batch as it stands after its pre-sign check, they sign W6A-A to W6A-L and W6A-M to W6A-T, each with option (a), the ledger rows AD-163..AD-173 with `signedOffBy: 'SIGNED: owner, 2026-11-04 (jump 3 batch W6a rows, approved in the work session)'` and `date: '2026-11-04'`, the declared rows -5, -6, -12 and -15 of link B4-local, AD-153's withdrawal with -5, and this record's content as the second batch's section (d) step 2 lists it; not the B4-local SHA-256 sets, which are shown to the owner after capture and confirmed in the next owner round. This record was written after the second signature, on 2026-11-04; §8 names its text beyond those lists.

## 1. The tuple set recorded on Chromium (55 C7 (1))

`e2e/journeys/t728-pinned-tuples.json`, key `react-18.3+next-12.3` (`427de78`, W6A-A (a), P-3): `"entries": []`, recorded "2026-11-03, W6a (React 18.3 on Next 12.3): empty on Chromium, as the W5.5 fixed spike measured and T-701 shows (0 hydration events in 270 tests); WebKit and Firefox DEFERRED, as in jumps 1 and 2; owner signature 2026-11-03 (STATUS section 2): a hydration tuple on React 18 is red, and none is added without a signature". This is the set 55 C7 (1) compares later steps with, minus entries that signed ESCALATES fixes remove: empty. C7 (1) is defined over Chromium, WebKit and Firefox; the WebKit and Firefox legs stay DEFERRED (browser downloads not approved), and their first recording comes back to the owner.

On the W6a tip (`477b0f2`, build `42b166d4ce80c734`): T-701 270 of 270 (0 hydration events), T-728 c2 green; T-728 c1 and c3 stop only at their first snapshot, the no-JS capture that row -6 re-captures (§5), and with row -6's files in a scratch root they pass 88 of 88, nested anchors 0 after hydration included (§6). No tuple was added.

## 2. The React 17 reference (W6A-L (a))

W6a's React 17 reference is `1cdbab06d8637b8c`: the lean default build of the runtime tree of `0956562`, which the jump tip `037a3d6` keeps (React 17.0.2 with the eight signed W5.5 fixes, Next 12.3.7, Node 24.18.1, buildId `AgTqmC6RPSsKFIQDFmYBc`). Its app code is the W6a tree's but for React, React Testing Library and W6a's two app changes (§3.3). Every React 17 comparison of W6a uses it: the bump's, rule 2 of the settle fix, the browser check of the first round's step 9 and the T-611 figures of §4.4 (the guard of CS-R18-8 on React 17 ran on its own scratch build of the jump tip plus the guard, against the same run on `1cdbab06d8637b8c`). No W6a step compares against `e9c353c5d1f87f02`, the jump-2 tip on React 17; it is deleted with its build record by the second round's step 8, now that this record names `1cdbab06d8637b8c`.

## 3. The first round: what React 18 changed, and the decisions as signed

### 3.1 The bump

`6e66c03` CS-R18-1: `react` and `react-dom` 18.3.1 exact (the lock changes react, react-dom and scheduler 0.23.2, as on the W5.5 spike). `a37ff44` CS-R18-5: `@testing-library/react` 16.3.3, `test/utils/render.js` without the `dom.configure` shim and with `act` from React Testing Library (the lock drops the nested `@testing-library/dom` 8 tree and `@types/react-dom`). CS-R18-6 is verify-only: 0 lines. Its build `d89b1a33ce9c72d5` (deleted at the first round's step 7) was measured with the pin sets and tool changes as uncommitted copies: with only the copies that round asked to sign, `chromium` 872 of 966; `wire` 28 of 28 (run alone with `--no-deps`), `visual` 392 of 392, T-802 72 of 73, Jest node + dom 1,092 of 1,105, static 90 of 94. Every red was re-run once with the same result; none is a flake.

### 3.2 The differences (the first batch's section (a)) and where each ended

| Red on React 18 (bump, `d89b1a33ce9c72d5`) | Cause, in short | Taken by | At W6a's landing |
|---|---|---|---|
| T-701 x9, T-741 c1 x3 (search-climate-p2-all-params) | the KaTeX line `` couldn`t convert string \sb2 `` 3 times per load, not 2 (Q-101; the extra render not traced) | P-2 (W6A-A) | green (T-701 270 of 270, T-741 96 of 96) |
| T-741 c2, T-728 c2 (by reading the code) | the version anchors list React 17 keys only | P-4 (W6A-A) | green |
| Jest dom, all 32 suites | no `test/console-allow/react-18.3.json` | P-5 (W6A-B) | loads; no unexpected console line |
| Jest T-417 c1 and c3 x46 | RTL 16 registers `beforeAll` at require: "Hooks cannot be defined inside tests" | TC-1 (W6A-C) | 43 green, 3 left to row -12 |
| Jest T-001 c2, T-412 c3 x2 | `react/no-deprecated` on `ReactDOM.hydrate` and `unmountComponentAtNode` | TC-2 (W6A-C) | green; T-412 32 of 32 |
| T-728 c4 | the shared inventory was the jump tip's ("another app tree"); the checker named React 17.0.2, and React 18's inventory had three unmapped MathMarkdown `defaultProps` dev signatures | TC-3, TC-4 (W6A-C, Q-104), the inventory recorded again on the W6a tip | green |
| T-802 c2 `du-04-tag-a` at 1440 px | 0 px, but the harness Card `tag="a"` around an anchor raises #418 x2 and #423 at hydration, and Sentry's reports hit the CSP | TC-5 (W6A-D) | 73 of 73 |
| The W55-G popup (a probe) | `CookiesAfterMount`'s passive effect runs after paint: 62-68 ms after the hydration commit, against 0 on React 17 | W6A-G at CS-R18-3 | 0 ms in 5 of 5 loads; moves the browser `_app` name (W6A-N) |
| T-734 c2 row 1 | one more `/account` request at the second claim submit with the same e-mail (6 against 5, 7 against 6 after Close) | W6A-H, new row CS-R18-8 | green with today's counts 2, 3, 4, 5, 6 |
| T-804 c2 the dialogs | closing the Report form or the success modal puts the focus back on Report; today `<body>` | W6A-I (a) accept | AD-171 (§4) |
| T-603 c1 | the HTML of the five HTML classes is streamed: no ETag, no Content-Length, a chunked GET, no conditional rows | W6A-J (a), reading (i) of 30 §1 rule 3 | AD-163..AD-166 (§4) |
| T-728 c1 and c3 x88 | ` data-reactroot=""` gone from the 44 no-JS captures; in 207 reports the empty text nodes and React 17's MutationObserver records gone; the settled DOM the same | row -6 | link B4-local (§4) |
| T-610 c3 | stacks name React 18's server renderer; 7 of the 8 pages that answer 500 log their SSR error block twice | row -5 | link B4-local (§4) |
| T-707 | the same KaTeX count, held as a constant | row -7 | AD-167 (§4) |
| Jest T-410 c4 x2 | the development build renders a thrown component once more, so the thrown string is reported twice | row -8 | AD-168 (§4) |
| Jest T-401 c2 x2 | Q-047's hook order: one development warning, "Expected static flag was missing" | row -9 | AD-169 (§4) |
| Jest T-417 c1 row 8 | under `hydrateRoot` the design Card's nested anchors are a hydration error, then a client render | row -10 | AD-170 (§4) |
| Jest T-417 c2 and c3 Select, Header, Popover x6, c4 overlay popover | the census differs from the React 17 references | the browser check (first round, step 9), then row -12 | J3-W6A-INV-1 (§4.2); link B4-local |
| Jest static T-013 c1..c3 | the step's own lock change on the unmerged branch | by design | green at the `Merge W6a (...)` commit |
| T-104 c2, T-014 (a) | as on the jump tip | none | as on the jump tip |

Found by the W6a steps after the bump: T-604 c4 and T-016 c4, red by the browser `_app` file name that W6A-G moves (rows -13 and -14, AD-172 and AD-173), and T-611 c1, outputs-2003's gzip size at the lower edge of its band from build to build (row -15).

### 3.3 The decisions W6A-A to W6A-L and their commits

| Decision | Option (a) as signed | Commit |
|---|---|---|
| W6A-A | the pin sets P-1 to P-4 and P-6: `e2e/console-allow/react-18.3.json` (no entry), the key `react-18.3+next-12.3` of `e2e/lib/P0-12/t741-console-pins.json` (the React 17 set but for `katex-convert` 2 -> 3 on three cookie states of search-climate-p2-all-params) and of `e2e/journeys/t728-pinned-tuples.json` (§1), the T-741 c2 and T-728 c2 anchors, `test/baseline/SHA256SUMS` and `manifest.json` with the B3-local `provisional` text (E4 (a)); 42 §9 lean form, no new chain link | `427de78` |
| W6A-B | the Jest dom allow-list `test/console-allow/react-18.3.json`, two entries (MathMarkdown, Histoslider; refs Q-104, R-012, OD-39); React 17's server `useLayoutEffect` entry dropped; an acceptance change | `92b36e0` |
| W6A-C | TC-1 `fresh.js` stubs `beforeAll`; TC-2 `hydrateRoot` and `root.unmount()` in the T-412, T-415 and T-417 tests; TC-3 the inventory's React checked against the installed one; TC-4 the map rule `q104-design-defaultprops` (MathMarkdown only; an acceptance change), with the row Q-104 in 30 | `03c6f2b`, `81fea92`, `edf0fab`, `ce70afe`; Q-104 in `0aed930` |
| W6A-D | TC-5: on React 18.3 and `du-04-tag-a` only, T-802 expects exactly page errors 3, window errors 3, `console.error` 6 and CSP 3, each channel checked on its own; pixels still 0 px; an acceptance change | `461c0fc` |
| W6A-E | E1 link B3-local and its SHA-256 sets confirmed; E2 row -10 of W5.5 read with the SSR comment separators ignored; E3 the tile-fade wait as an option of the shared `settle` that only T-728 passes, rule 2 shown on the jump tip (`chromium` + `wire` 994 of 994; T-728 c1/c3 record mode 440 of 440 byte-identical to B3-local; T-743's 5 record-mode files equal to those of the unchanged harness); E4 the `provisional` text passed by P-6 | `a743b3e` (E3); E4 in `427de78` |
| W6A-F | the W5.5 record's text beyond the signed lists confirmed, with the lost-evidence lines of [jump-1.md](jump-1.md) and [jump-2.md](jump-2.md) and the slips J3-W55-RW-1 and J3-W55-MR-1 | none |
| W6A-G | the popup flag set by a layout effect in the browser at CS-R18-3 (a change to the signed W55-G fix) | `477b0f2` (§8 item 1) |
| W6A-H | the new row CS-R18-8 and its same-value guard in `templates/data-provider/claim/claim-card.jsx` | `8ea18a3` |
| W6A-I | the focus after the Report dialogs accepted, filed with the W6a rows | AD-171 (§4) |
| W6A-J | the streamed HTML accepted, with reading (i) of 30 §1 rule 3: the rule keeps the status of a plain request (the T-601 and T-731 cells, which stay); the lost conditional 304 is one of the OD-39 streaming deltas | AD-163..AD-166 (§4) |
| W6A-K | a second W6a round for the W6a rows before the merge | §4 |
| W6A-L | `1cdbab06d8637b8c` as W6a's React 17 reference, `e9c353c5d1f87f02` deleted after this record | §2 |

Docs: Q-104, the extension of CS-R18-3 and the new row CS-R18-8 (`0aed930`, with the first round's STATUS §2 row). The dev inventory was recorded again on `477b0f2`, after the two app commits (01 §10 item 6): 396 loads, 24 signatures (1 hydration), the jump tip's 21 with the KaTeX count 18 -> 27 plus 3 MathMarkdown signatures mapped to Q-104; `checkInventory` gives exactly AD-109's list; sha256 `f7eeda70905668f5d15d1fbc471c7cffcc58cf7ea3208c81934077bfbb8fa0a3`. Until the merge it went into the shared `$ARTIFACT_DIR/hydration-dev-r17.json` only for a run of the W6a tip, each swap checked by sha256; the second round's step 4 makes it the shared file and keeps the jump tip's copy (`e0a93480530e...`) aside.

## 4. The second round: the W6a rows and decisions

### 4.1 The decisions W6A-M to W6A-T, each with option (a)

| Decision | Option (a) as signed |
|---|---|
| W6A-M | the Select difference on a data provider page (J3-W6A-INV-1) accepted as a React 18 fact, Q-079 unchanged, no app change; row -12 filed for Select, Header and Popover, its Select part naming the visitor effect in the words of §4.2 |
| W6A-N | W6A-G kept; the browser `_app` name it moves, `_app-aa42575a9a303064.js` -> `_app-c69132bc37b63907.js`, filed as AD-172 (T-604 c4) and AD-173 (T-016 c4) |
| W6A-O | rows -1, -2, -3, -7, -8, -9 and -11 as the batch writes them: AD-163..AD-165, AD-167..AD-169, AD-171 |
| W6A-P | row -4 in its row form, AD-166, applied by the T-603 hook: the first ledger row on the hook's `:row` entry, passing 10 contract rows by their absence |
| W6A-Q | row -10 kept as a React 18 fact, AD-170, as W6A-D (a) keeps the same design behaviour in T-802's `du-04-tag-a` |
| W6A-R | outputs-2003's B0 in T-611 c1 re-stated from the build that lands, raw and gzip: `65100, 17178` -> `62026, 16321` (row -15, in its own commit, as `0009cd1` did in B2-local) |
| W6A-S | chain link B4-local as declared (§4.4): -5, -6 and -12 in one link commit with AD-153's withdrawal, -15 in its own commit right after it |
| W6A-T | the values the first round's step 10 did not reach measured on the W6a tip before the merge (the second round's step 1a, §6) |

### 4.2 The visitor difference of W6A-M (J3-W6A-INV-1)

Found by the browser check of the first round's step 9 (Chromium, `42b166d4ce80c734` against `1cdbab06d8637b8c`, 8 of 8 loads each way). The words of row -12, which this record and STATUS §1 carry with W6A-M (a):

"On a data provider page, after a query is typed into the outputs search, a double click on the field's floating Search label no longer runs the search: React 17 counts that double click as two changes of the field, React 18 as one, and Q-079 swallows the first change. The field loses focus and the typed query stays; the search runs once the visitor clicks back into the field and leaves it, or presses Enter in it."

A double click on the box itself, a double click on an empty field's label, Enter, Tab and a click elsewhere show no difference. By reading `templates/data-provider/search.jsx:12-19`, it happens only when that double click is the field's first change since the page loaded. The rest of -12 has no difference a visitor can meet: the Header (DU-09) census difference, the label double click, has no counterpart a visitor can reach, and its double clicks and blur paths at 375 px are the same on both builds (J3-W6A-INV-8); the Popovers the pages render (the search page's two and the output page's dropdown, DU-11) give the same final state, focus, address, requests and captures, with `data-placement` about 3 ms later in the first frame on React 18, which no stylesheet reads (J3-W6A-INV-4); the copy tooltip of `modules/copyable-input/index.jsx:50` is rendered by no page (J3-W6A-INV-3).

### 4.3 Ledger rows AD-163..AD-173 (42 §8)

`kind: product`, `step: W6a`, `ref` with OD-31 (and OD-39 for the React 18 deltas), each with `signedOffBy: 'SIGNED: owner, 2026-11-04 (jump 3 batch W6a rows, approved in the work session)'` and `date: '2026-11-04'`. Filed by the second round's step 5, on a short branch from the merged tip, with their constants at the sites.

| Row | Test, key | From -> to | Applied |
|---|---|---|---|
| AD-163 (-1) | T-603, `etag` of the five HTML classes, origin and proxy | `<present>` -> `<absent>` (30 diffs) | by the T-603 ledger hook |
| AD-164 (-2) | T-603, `content-length`, the same classes | `<present>` -> `<absent>` (20 diffs) | by the hook |
| AD-165 (-3) | T-603, `transfer-encoding` of the plain GET | `<absent>` -> `chunked` (10 diffs) | by the hook |
| AD-166 (-4) | T-603, the 10 conditional rows (`:row`), each a 304 today: html-gssp, html-gip, 404-page, 404-notfound and the works SSR 500 page | `present` -> `<absent>` | by the hook |
| AD-167 (-7) | T-707, `expectKatexOnly` perLoad (`e2e/journeys/t707-j5-work-back.spec.mjs:192`) | `2` -> `3` | constant, with the comment at `:191` |
| AD-168 (-8) | T-410 c4, uncaught window errors per thrown render (`test/unit/templates/output/t410-cite-modal.test.jsx:443`, `:473`) | `[thrown]` -> `[thrown, thrown]` | constants |
| AD-169 (-9) | T-401 c2, `console.error` of the queryError -> data re-render (`test/pages/search/t401-search-page.test.jsx:330`, `:383`) | not called -> called once with "Warning: Internal React error: Expected static flag was missing. Please notify the React team.%s" | constants, with the titles at `:317` and `:369` |
| AD-170 (-10) | T-417 c1 row 8 (`test/unit/design/t417-design-contract.test.jsx:612-658`, line 643) | React 17 hydration puts the hoisted anchors back with development warnings only -> React 18 `hydrateRoot` reports a hydration error and renders the card on the client; inner anchors 2 and box children 1 as today; the 7 logged lines exactly | constant, with the title at `:612` and the comment at `:642` |
| AD-171 (-11) | T-804 c2, the focus after closing the Report form and the success modal (`e2e/journeys/t804-keyboard-smoke.spec.mjs:319`, `:338`) | `body` -> `Report` | constants, with the title at `:277` and the comments at `:310`, `:321` |
| AD-172 (-13) | T-604 c4, the `_app` chunk name in the stale-buildId console frame (`e2e/http/t604-next-data.spec.mjs:312`) | `_app-aa42575a9a303064.js` -> `_app-c69132bc37b63907.js` | constant, the AD id added to the comment (AD-137, AD-154) |
| AD-173 (-14) | T-016 c4, the `_app` chunk name of the two cookie require edges (`test/static/detector-t016-c4-design-requires.test.js:198-199`) | `_app-aa42575a9a303064.js:13456` -> `_app-c69132bc37b63907.js:13456` | constants, the AD id added to the comment (AD-138, AD-155) |

AD-172 and AD-173 have keys of their own, because AD-154 and AD-155 stay in force as the record of W5.5 (one row in force per test and key). In memory the committed 151 rows plus these 11 give 0 violations in `scripts/ad-ledger.mjs`, and AD-163..AD-166 cover all 70 T-603 diffs of the first round's step 10.

### 4.4 Declared rows of link B4-local (42 §9, lean form)

Not ledger rows: the ledger cannot apply them. Link B4-local: n 4, kind product, reference the merged tip's build `42b166d4ce80c734` (the record commit and the merge change no runtime file). `before`, already shown at W6a: `1cdbab06d8637b8c` against the chain head B3-local, no diff (the settle fix's rule 2 run). Filed by the second round's step 6, with the captures W6A-S names per group (3 byte-identical captures on host stacks for -5 and -6, 3 byte-identical `RECORD=1` runs for -12; none for -15, whose values are read from the build) and STATUS §1 rows; the SHA-256 sets are shown to the owner after capture.

| Row | Test, file | Declared content |
|---|---|---|
| -5 | T-610 c3, `e2e/http/t610-props-output.spec.mjs-snapshots/t610-stdout-census-chromium-darwin.json` | One SSR error block per 500 page, with `react-dom-server.node.production.min.js` frames, becomes two identical blocks on 7 pages (works-4100, works-4101, works-4102, works-4200, outputs-2102, outputs-2103, providers-q-100pct), 11 -> 22 lines each, with `react-dom-server.browser.production.min.js` frames; works-6948813 keeps one block of 11 lines with `react-dom-server-legacy.browser.production.min.js` frames; everything else byte-identical; 0 server Sentry events. The file must equal the bump's capture (sha256 `825dc47c7c23bb2b6e6327533fb0448444af1177c7ff213b0fa5068f0cc7fd8c`). It names `chunks/937.js` itself, so AD-153 applies 0 times and is withdrawn in the same commit, as jump 2 withdrew AD-037, AD-048 and AD-049 with its T-610 re-capture |
| -6 | T-728 c1 and c3, 251 of the 440 files of `e2e/journeys/t728-hydration-diff.spec.mjs-snapshots/` | The 44 no-JS captures lose exactly ` data-reactroot=""`. 207 of the 396 reports change: the hydrated-side empty text lines go (1350 lines), and 198 reports differ in the MutationObserver section (React 17's hydration-time `@class` 4644 and `+[#text]` 783 records gone, `@src` 657 and `@class` 81 new, 27 list-item records change count). The settled DOM is the same, nested anchors 0. Set sha256 `58890dbaf25ff1a03d735d4a32fc2666bd6647687ea991f16a081738faa71f6f`; the other 189 files stay byte-identical to B3-local |
| -12 | T-417, `test/unit/design/lib/P0-07/reference/Select.json`, `Header.json`, `Popover.json` | 53 differences against the React 17 references: Select 21 (the label double click of 7 states: the `m` record, `f` `<absent>` -> the input, and in `pure-no-blur-change` `c` `["onChange({\"value\":\"Opt\"})"]` -> `<absent>`), Header 5 (the label double click of `search-bar-shown-advanced`: `m`, `c` `["onQueryChanged(\"\")"]` -> `<absent>`, `f`, `v`), Popover 27 (`m` lists only: 26 differences in 20 interaction keys of 3 states, and the overlay `open`); the other 20 references byte-identical; a re-record with `RECORD=1` (the Jest `dom` project). Its Select part names the visitor effect of §4.2 |
| -15 | T-611 c1, the BUDGET row of `e2e/http/t611-size-budgets.spec.mjs:50` | `['outputs-2003', '/outputs/2003/', 'gateway', 65100, 17178]` -> `['outputs-2003', '/outputs/2003/', 'gateway', 62026, 16321]`, the values of `42b166d4ce80c734`; the gzip band becomes 15504.95 to 17137.05 B, the raw band 58924.7 to 65127.3 B. React 18 writes no ` data-reactroot=""`, so every page is 18 raw bytes smaller; W6a's own change from the jump tip (`1cdbab06d8637b8c`: 62044 B, 16331 B) is -18 B raw and about -10 B gzip, and the rest of the distance from B0 is the smaller page shell since Next 12. In its own commit, as `0009cd1`; no OD-49 `was:` line, as `0009cd1` had none |

## 5. The W6a run on the W6a tip (the first round's step 10)

`477b0f2`, build `42b166d4ce80c734` (lean, buildId `4OV3YGtTZZSlpYCvlSdlV`), 2026-11-04 02:03 to 02:31 +0400, every build and run under the throttle, one at a time; the W6a dev inventory swapped into the shared path for each Playwright session and the jump tip's put back, each swap checked by sha256 (`<scratch>/p2/j3-w6a/run/`). Exactly the expected reds, and no other, so no re-run was needed:

- `chromium` + `wire` in one invocation: 873 passed, 93 red, the 28 `@wire` tests not run (they wait on `chromium`). The 93 are the 92 W6a reds (T-603 c1, T-610 c3, T-707, T-728 c1 x44 and c3 x44, T-804 c2) and T-604 c4. T-728 c4, T-734 c2 row 1, T-608 c2 (on the no-DSN build `da97a710171fd44c`) and T-611 c1 are green. `wire` again with `--no-deps`: 28 of 28. `visual` without T-802: 392 of 392 (T-801 0 px, T-805 c3). T-802 on the harness build `5a967ad7753a9430`: 73 of 73, `du-04-tag-a` 0 px with its four declared channels.
- The values of the reds: T-603 c1 the 70 diffs of rows -1 to -4; T-610 c3 "Expected -66, Received +143", annotation "AD-153 x6", its text equal to the bump's; T-707 `lib/P0-14/j5.mjs:82` Expected length 4, Received length 6; T-728 c1 and c3 red at their no-JS snapshot, each failure text equal to the bump's once code frames are dropped; T-804 c2 `:319` Expected "body", Received "Report"; T-604 c4 red by the chunk name alone.
- Jest node + dom: 1,092 of 1,105, 13 red: T-104 c2 (as on the tip), T-401 c2 x2, T-410 c4 x2, T-417 c1 row 8, and -12's 7 (T-417 c2 and c3 Select, Header, Popover, c4 overlay popover); no unexpected console output in the dom gate. Static: 89 of 94, red T-013 c1..c3 (until the merge), T-014 (a) (as on the tip) and T-016 c4 (the chunk name alone; its negative control green).
- The harness and no-DSN builds were made, used and deleted with their build records, one at a time; at most 4 build trees.

## 6. The values step 10 did not reach (the second round's step 1a, W6A-T (a))

On `42b166d4ce80c734` from the W6a worktree, 2026-11-04 11:39 to 11:52 +0400, after the second signature and before any commit, with the constants of AD-167 to AD-171 as uncommitted copies in the form the batch writes them, taken out afterwards (`<scratch>/p2/j3-w6a/merge/measure/`). **Every value held as the batch writes it.**

- One host stack, two Playwright invocations one after the other. Normal mode, T-707 and T-804 c2: 6 of 6. T-707 J5 runs to its end: the KaTeX count 3 x 2 at `:192`, then its hashed snapshot `t707-j5-history-and-requests-chromium-darwin.json` at `:233`, equal to the committed file. T-804 c2 "the dialogs" runs to its end: "Report" at `:319` and `:338`, `<body>` after the backdrop click, then the CSV dialog.
- Record mode of T-728 c1 and c3 into a scratch root: 88 of 88, 440 files written. The 251 files of row -6 are byte-identical to the bump's capture, set sha256 `58890dbaf25ff1a03d735d4a32fc2666bd6647687ea991f16a081738faa71f6f`; the other 189 are byte-identical to the committed B3-local files. The reports of the `absent` cookie state still record the popup as the bump's did (`t728-search-climate-UTC-absent`, sha256 `011714c7c2e098358d9e568c8defd3e6c6d51b130d01b70c98d96fd4d73fcc8d`), so W6A-G changes no T-728 capture.
- Jest `dom` (`TZ=UTC`): 502 tests, 495 passed, 7 red. T-410 c4 x2 (all three cases of `:473` included), T-401 c2 x2 and T-417 c1 row 8 (its unmount and client render at `:644`-`:657` included) are green; the 7 reds are -12's, with step 10's failure texts; the other 490 results equal step 10's.

The capture is kept for the second round's step 6.

## 7. Names that stay (J3-W6A-13)

The title of T-728 c2 ("pinned tuple set: ... empty on React 17"), the title of T-728 c4 ("React-17 dev inventory: every dev warning of the sweep maps to a Q row") and the file name `$ARTIFACT_DIR/hydration-dev-r17.json` stay as they are (W6A-A (a)). From W6a on they hold React 18's set (the key `react-18.3+next-12.3` of §1, empty) and React 18's inventory (§3.3, recorded on `477b0f2` with React 18.3.1).

## 8. Text beyond the signed lists, for the owner to read

The signatures cover the decisions, the rows and the record content of the second batch's section (d) step 2. Written beyond those lists, each to keep a record true:

1. **W6A-G's commit:** `477b0f2` was made by a decision of the work session (`.p2-work/jump3/notes.md`, 2026-11-04 00:25), not by an owner signature on the two reds it causes (T-604 c4, T-016 c4; J3-W6A-APP-1, J3-W6A-APPG-1). The owner signed those since, with W6A-N (a).
2. **Wrong text of an earlier commit, corrected here:** `0aed930` said of CS-R18-3 "One line at this site" and listed T-417 as green in its W6a Proof, and said "one line" of CS-R18-8 (J3-W6A-APP-6, J3-W6A-APP-7, J3-W6A-V2P-6). This record's commit states them exactly in 20: CS-R18-3 is three code lines (the import, a module constant, the call) and a comment; T-417 keeps its 8 known W6a reds, the same tests with and without the change, until AD-170 and row -12 land; CS-R18-8 is 8 insertions and 2 deletions in one file. It also brings Q-051's cell in 30 to the proven result (J3-W6A-DOC-1, J3-W6A-APPG-4).
3. **A reading made in step 1a:** the batch gives the values of AD-169 and AD-170, not the assertion code; step 1a asserted one `console.error` call with that first argument, and the 7 lines as an exact list (J3-W6A-M1a-2).
4. **Slips, recorded:** two progress notes of the step log were first written with a time not read from the clock, and corrected within a minute (J3-W6A-15, J3-W6A-APP-5), as was this record step's own start note (J3-W6A-M2-1); a scratch spec ran inside one whole `chromium` run of W6A-H's proof and made 4 neighbouring tests red, all green on the clean re-run, and no commit depended on that run (J3-W6A-APP-4).
5. **Written by this record step:** the STATUS §2 row of the second round and the W6a status line in STATUS §4; README §8.

## 9. Open items

1. **For the owner, in the next round** (the recommendation first): the SHA-256 sets of link B4-local, shown after capture; two file-header comments that state a value AD-167 and AD-171 move and that no site note of the batch rewrites, `e2e/journeys/t707-j5-work-back.spec.mjs:16` and `e2e/journeys/t804-keyboard-smoke.spec.mjs:18-19` (J3-W6A-M1a-1): (a) the rows are filed with the site notes only and the two sentences come to that round, (b) they are rewritten with the rows; recommendation (a).
2. **The midpoint heavy check** (the end of jump 3, 55 §0): the C1 re-runs of the acceptance changes W6A-B's two entries, TC-4's rule and TC-5 (a), each with its negative control (40 §8 rule 8), beside W5.5's -14 ([W5.5.md](W5.5.md), section 9).
3. **Known moves:** the browser `_app` name moves with every change of that file, so W6c and W6d move AD-172 and AD-173 again (J3-W6A-APP-1), and T-707's failure text prints it unpinned (J3-W6A-RUN-2). After -15 the T-611 c1 rows nearest their lower edge on `42b166d4ce80c734` are works-1002 (gzip +17.35 B) and static-search and root (+31.75 B).
4. **Wording:** the comment `test/pages/_app/t415-app-shell.test.jsx:370` still names React 17; the assertion under it holds on React 18 (J3-W6A-SETS-6). Q-027 stays WATCH: the extra `/account` request was bounded, and CS-R18-8 removes it.
5. **WebKit and Firefox** stay DEFERRED for T-701, T-728 and C7 (1).

## 10. Next

The second round's section (d), steps 3 to 8: the merge of `upgrade/jump3-react18-next14--w6a` into `upgrade/jump3-react18-next14` with `--no-ff` (T-013's reference); the repository's `node_modules` brought in sync once and the W6a inventory made the shared file; AD-163..AD-173 with their constants; link B4-local (-5, -6, -12 with AD-153's withdrawal, then -15); the run on the jump tip (`chromium` + `wire`, `visual`, T-802, T-608 c2, Jest `node`, `dom`, `static`), green except T-104 c2 and T-014 (a), whose result this record gains with W6a's status DONE; then `e9c353c5d1f87f02` deleted. Then **W6c** (Next 13.5.11) in its own run from a green tip, W6d, and the jump check with the heavy checks of the midpoint.
