# STATUS - mutable ledger

**Purpose.** With README §Status, the only file edited during execution (D13): baselines, digests, owner confirmations, VF register, statuses, branches/PRs, log.
**Read** after README at work-session start; **update** at work-session end ([01](01-playbook.md) §4 step 11 and 01 §9).

## 1. Baseline and artefacts

|Item|Value|
|---|---|
|People|Owner: _; Reviewer (second engineer): _ (name and GitHub login each, used by the 42 §8 signature check); channel: _ (owner fills before 2.0)|
|Baseline|`<base>` = `origin/main@cc0e228`, tree `a825839` (moves only per 01 §2 before B0); `<base'>` (42 §5): not set (2.1); work-session start check: 01 §2. `f5cfc20`: same tree, on no remote (review:00 XRD.2)|
|Branches|default `main`, also `stage`; legacy `master`, `main.old`; local `origin/HEAD` stale (fix: 01 §2)|
|Stage|`origin/stage` = `6e0a370`, tree = `9b26dc9`'s, 2 commits behind `main` (#454, #455), 10 stage-only commits with a net-zero tree (checked 2026-10-20); stage is optional (01 §4 step 5): a step merged into it pulls in #454/#455|
|Base images|`node:18-alpine` index digest: not set (2.1); `node:24-alpine` (W4e), `node:26-alpine` (6.10): not set (command 42 §2)|
|Activity|32 commits on `origin/main` after 2026-07-01, 6 authors (R-089)|
|Docs branch|`docs/upgrade-plan`, local only. Landing 1(a)–(e) done 2026-10-20 (README §8 action 1): doc set placed in `docs/upgrade/`, `60-design-copy-plan.md` removed, `tools/check-docs.mjs` added, `findings/` scrubbed, `findings/review-2026-10-19/parts/` deleted, checker ERROR 0, and the plan committed on the branch as one commit replacing the two draft commits. Next: 1(f), by the owner (rebase onto `origin/main`, push, open the PR). Tag `upgrade-baseline`: not created; set on origin at `cc0e228` after the docs PR (01 §2)|
|Golden|G (tag `upgrade-golden`), first golden build digest, baseline/fixture/corpus SHA-256 sets (committed, 42 §7), and the C4 draw seeds (55 C4): not set (2.4, 2.4, 2.5/2.2, 2.5); the `t805-exclusions.json` sha256 (40 §1): ab40bbc6b81165505f904b8aec2870885cef3ea33d6584f1e0f819a782a224a9 (2.7, captured on the host baseline, macOS arm64); approved baseline chain B0..Bn: empty; formats [42](42-baselines-and-ci.md) §4, §7, §9|
|Signals|Signals exports `test/signals/<tag>.json` and their SHA-256 (55 C6-NI, 42 §7): `2.0`, `W0`, `S`, `A`, `F`: not set (2.0 exit, W0 merge, end of each gate window)|

## 2. Owner confirmations

OQ-1..OQ-18 are DECIDED (2026-10-20, owner confirmed the recommended defaults), and the owner's scope decisions of the same day are applied (00 §6): rows with a *Confirmed* date are DECIDED; no item waits for anyone but the owner; rows without one (D17, OPEN ODs, Phase 1b approval) run under their default until confirmed. Texts: [90](90-open-decisions.md), [00](00-decisions.md) (90 "needed by" wins); OQ texts: `findings/review-2026-10-19/00-verified-findings.md` (owner-question table). *From* = first step needing the default. *Sign* = where the real signature is required: `=` (the *From* step) or a step ID = owner signs that step's record (01 §7), PR = the PR, GATE-x = 55 record. *Confirmed*: `YYYY-MM-DD name`.

|Item|Default|From|Sign|Confirmed|
|---|---|---|---|---|
|Phase 1b approval|pending|docs PR|PR merge||
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

## 5. Open branches and PRs

|Ref|Action|
|---|---|
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
