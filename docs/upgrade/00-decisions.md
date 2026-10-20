# Binding decisions (D1–D17) and phase order

Purpose: binding rules for every plan, test, PR and review. Read after README and STATUS, and when a task seems to break a rule. Owns: D1–D17, phase order, change log. Options, rationale and change proposals (as ODs): [90](90-open-decisions.md). Bare numbers (02, 55) are files `NN-*.md`.
**Edits: owner only.** D1–D15 binding; D16 WITHDRAWN (2026-10-20, §4); D17 PROVISIONAL (§4), tracked in STATUS §2.

## 1. Owner requirements M1–M9 (verbatim; 2026-10-19, source: owner in chat)

| M | Requirement | D |
|---|---|---|
| M1 | End state = LATEST stable versions of all libraries (as verified on the registry 2026-10-19); anything below latest needs a justification + the later step that reaches latest. | D6 |
| M2 | Every critical point covered by tests: Jest (+RTL) for unit/store/hook/component/integration; Playwright for E2E / SSR HTML / visual / a11y. UI unchanged (pixel-level). | D7 |
| M3 | Existing bugs stay as they are (characterization tests; D1/D1a). | D8 |
| M4 | Used @oacore/design components are copied into the repo to stabilise the upgrade; design repo is deprecated, so search eventually OWNS every design component/asset it uses. | D9 |
| M5 | CRITICAL: before the antd rewrite starts, prove ABSOLUTELY NOTHING is broken — a rigorous, binary, measurable gate. | D10 |
| M6 | After stability adopt the dashboard libraries: axios, swr, zustand, antd, pure CSS, TypeScript, ESLint, Prettier, Husky (+lint-staged) — then rewrite all UI on antd. Logic identical; NO code/functionality improvements. | D11 |
| M7 | ≥95% confidence of stability, with a stated way to measure it. | D12 |
| M8 | Comprehensive but NOT bloated; a future session with zero context must understand exactly what to do next, without confusion. | D13 |
| M9 | Planning only. | D14 |

## 2. Owner decisions D1–D5 (text unchanged)

### D1 — Behaviour preservation: no bug fixing
Existing bugs, quirks and odd behaviour are NOT fixed during the upgrade. After
tests → dependency upgrades → fixes for upgrade breakage, the app must behave
EXACTLY as it does today, quirks included (e.g. error pages returning HTTP 200,
the /data-providers Back-button behaviour, missing meta tags).
- Tests are characterization tests: they pin CURRENT behaviour, not intended behaviour.
- Known bugs are recorded in a "known quirks — preserve" register, never fixed in this track.
- A fix needed only to keep current behaviour working after an upgrade is allowed. Changing behaviour is not.

Implementation: [30](30-quirks-register.md), 41. Applies unchanged to phases 6–7 (D11).

### D1a — Exception: bugs that become severe after an upgrade
Some bugs are harmless on today's versions but turn severe on newer ones (crash,
infinite loop/refetch, full client re-render from hydration mismatch, data loss,
security issue, broken SEO/indexing). Those MAY be fixed, under these rules:
- Each one is listed in the quirks register as **ESCALATES** (vs **PRESERVE**),
  naming the version that makes it severe and how it would show up.
- The fix is minimal and scoped only to removing the escalation; the visible
  behaviour stays as close to today's as possible.
- A characterization test pins today's user-visible behaviour first; the fix must
  keep that test green (or the test change is explicitly documented and justified).
- Fixed in its own commit/PR, separate from version bumps, so it can be reviewed
  and reverted on its own.
Default for every bug is PRESERVE; ESCALATES needs a stated reason.

Implementation: ESCALATES table in 30; approvals OD-09, OD-40; PRs labelled `escalates`; step W5.5 in [50](50-roadmap.md).

### D2 — Test framework: Jest
Unit, store, hook, component and integration tests use Jest (+ React Testing Library).
Browser-level checks (E2E journeys, SSR HTML / SEO meta snapshots, visual
regression, axe accessibility) use **Playwright** (decided 2026-10-19).

Implementation: 40 harness, 41 tests.

### D3 — No react-hook-form
The dashboard doesn't use react-hook-form. Forms follow the dashboard's pattern
(antd `Form` / `Form.useForm`) when the antd rewrite phase comes.

Implementation: [80](80-phase7-antd.md) §4.

### D4 — Design system
`@oacore/design` is not upgraded. Used components are later copied into search
verbatim (no logic or UI/UX changes), then the dependency is removed.

Implementation: [60](60-design-ownership.md); end state D9.

### D4a — Design copy is a stabilisation step, and may move earlier
Copying the design components is an intermediate step, not the end state. It
exists so that tests → upgrade → fix → stabilise can succeed. Where the upgrade
requires it (e.g. @oacore/design caps react/react-dom at ^17), the verbatim copy
may happen before or as part of the upgrade phases rather than after them.
Exit criterion for the whole upgrade track: the app is stable after the upgrade,
both functionally AND visually (exact pixel-level match to today's baseline).
Only then do the antd and functional-library phases start.

Implementation: W0.5, W5 (50); exit criterion = GATE-S ([55](55-gates-and-confidence.md)).

### D5 — Final UI: antd restyled to match exactly
In the antd phase, copied design components are replaced by antd components
restyled so they look and behave exactly like the current ones. Visual-regression
baselines captured now are the acceptance reference for that phase too.

Implementation: 80; 0 px against the golden baselines (42).

## 3. Rules for D6–D14

| D | Rule |
|---|---|
| D6 | Latest = the 2026-10-19 registry version in [02](02-version-matrix.md) or newer; pinned exactly at each step start, re-checked at each gate. Exceptions are rows in 02 (blocker evidence, closing step). The dashboard sets libraries, not versions. |
| D7 | Unchanged UI = 0 px against the approved baseline chain at every declared viewport; any other diff needs a signed AD row (D15). Every critical risk has a named test in 41. |
| D8 | Fix no bug unless D1a applies (existing defects, security notes included, stay: D16 WITHDRAWN). Every bug is pinned by a test (30); a pinned test changes only via a signed AD row or a D1a fix PR. |
| D9 | Verbatim copy: W0.5 tarball, then W5 directory package. At GATE-F no `@oacore/design` and no compiled vendor code remain: each used design unit (DU-01..DU-24 in 60) is an antd component restyled to match (D5) or readable search-owned source. [60, 80] |
| D10 | Three gates, binary criteria in 55: GATE-S, GATE-A, GATE-F. Phase 6 starts after GATE-S, phase 7 after GATE-A. **No antd code merges to `main` before GATE-A is signed by the Owner; spikes live on unmerged branches only.** |
| D11 | Phase 6 = the M6 libraries except antd, plus typescript-eslint and Sentry latest; pure CSS per OD-33. W1 only bumps existing ESLint, Prettier, husky. Phase 7 = antd + ownership of units antd does not replace. D1/D1a apply unchanged to both (logic identical, no improvements). Not adopted: react-router, Vite, React Hook Form, pnpm, dashboard Dockerfile/nginx. [70, 80] |
| D12 | ≥95% confidence = C1–C8 all pass at each gate; no partial credit. Details and thresholds: 55 (thresholds OD-35, DECIDED 2026-10-20). |
| D13 | One source of truth per topic (README doc map). Mutable state only in README §Status and STATUS. IDs append-only: never renumbered or reused; removed = WITHDRAWN + reason. Unconfirmed facts are `VF-##` in STATUS. Docs change via 01 §9. |
| D14 | No app code changes in the documentation track. App changes start at step 2.0, only as PRs per 01. |

## 4. Rules D15–D17

D15: DECIDED (2026-10-20, owner confirmed the recommended default; OQ-2). D16: WITHDRAWN (2026-10-20, owner in chat; §6). D17: PROVISIONAL (no owner question covered it; confirmed in STATUS §2).

| D | Rule | Basis |
|---|---|---|
| D15 | Re-baseline protocol, not a freeze: a product PR to `main` lands alone; before/after captures on the current stack; diff limited to declared regions; AD row; owner signs; result = next link of the approved baseline chain. See 42 §9. | OD-31, R-089 |
| D16 | **WITHDRAWN (2026-10-20, owner in chat):** existing production defects are not this track's concern unless they directly affect the plan; every existing issue is still present after the upgrades (D1), S-4 included (preserved and pinned, OD-36). Was: behaviour-neutral security fixes outside D1 as `security` PRs, first CS-SEC-1 (S-4). | OD-36 |
| D17 | Design freeze: `@oacore/design` stays at 5.0.74 from step 2.1 (CS-W0-1 exact pin, then W0.5 tarball, then W5 directory package). Header and footer content changes go through D15. | `review:00 X00.3`; no OD |

## 5. Phase order

| Phase | What | Ends at |
|---|---|---|
| 1, 1b | Documentation; independent review | DONE 2026-10-19; 1b owner approval pending |
| 2 | Safety net and baselines, steps 2.0–2.8 ([50](50-roadmap.md) §3) | `records/phase-2.md` |
| 3+4 | Version track W0 … W8 (50 §4), per step: bump → fix → green pre-merge suite → prod → 48 h watch (01 §4, OD-01). Phase 5 (design copy) = steps W0.5, W5 | GATE-S |
| 6 | Dashboard libraries, 6.0–6.10 ([70](70-phase6.md)) | GATE-A |
| 7 | antd and ownership: 7.0, 7.1, `7.2.<DU>`, 7.F (80) | GATE-F |

## 6. Change log

- 2026-10-19, owner: D1–D5 set; M1–M9 recorded as D6–D14.
- 2026-10-20, plan rewrite (owner approval pending): D15–D17 added with recommended defaults (no owner answer yet); phase order rewritten (old list: no gates, react-router in phase 6, no TypeScript, pure CSS or lint tooling); D1–D5 unchanged.
- 2026-10-20, owner (in chat): OQ-1..OQ-18 DECIDED (owner confirmed the recommended defaults); D15 (OQ-2) and D16 (OQ-1) DECIDED; D17 stays PROVISIONAL (no owner question covered it). Recorded with the docs PR, which the owner approves by merging.
- 2026-10-20, owner (in chat), track scope: existing production defects are not this track's concern unless they directly affect the plan; D1 and D1a unchanged; D16 WITHDRAWN, S-4 preserved (OD-36). Today's deploy process stays (OD-29 WITHDRAWN: a merge to `main` deploys prod, stage as today); the `_next/data` rule is an in-repo PR (OD-03); baselines and fixtures are committed, no new infrastructure (OD-24, OD-25, OD-46); the unused image optimizer stays as today, no gateway block or off-switch (OD-41); 48 h prod watch with existing monitoring, no stage soak or traffic split (OD-47); the owner alone signs (OD-39, D10). Recorded with the docs PR.
