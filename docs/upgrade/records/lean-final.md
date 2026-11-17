# Lean track: final summary

Summary for the owner of the lean track, from the jump 3 tip `3c934e9` (React 18, Next 14) to the tip of `upgrade/jump5-deps-latest` (2026-11-16). It covers jump 4 (W7a, W7b, W7c), jump 5 (groups W81 to W84) and the stabilise step (W9). It follows `.p2-work/LEAN-PLAN.md`: no sign-off rounds, decisions made during the work and noted in the commit messages. Nothing was pushed or deployed, and no Docker was used. `git diff 3c934e9 -- .github kube .dockerignore` is empty; the Dockerfile changed once, on 2026-11-17, at the owner's request (§7).

## 1. Final versions

| Package | At `3c934e9` | Now |
|---|---|---|
| `next` | 14.2.35 | 16.4.6, built with `--webpack` |
| `react`, `react-dom` | 18.3.1 | 19.3.1 |
| `mobx`, `mobx-react-lite` | 6.16.1, 4.1.1 | 7.1.7, 5.1.3 |
| `@sentry/browser`, `@sentry/node` | 7.120.4 | 11.12.0 |
| `postcss` | 8.5.32 | 8.5.33 |
| `postcss-preset-env`, `postcss-custom-media` | 7.8.3, 8.0.2 | 11.6.2, 12.0.3 |
| `cssnano`, `cssnano-simple` | 4.1.11, 2.0.0 | 9.9.0, 2.0.0 (held) |
| `eslint`, `typescript-eslint` | 10.13.0, 8.72.1 | 10.15.0, 8.72.2 |
| `stylelint` | 17.16.0 | 18.0.0 |
| `jest`, `babel-jest` | 30.5.2 | 30.5.2 |
| `@playwright/test` (`e2e/`) | 1.64.1 | 1.64.1 |
| `typescript` | 6.0.3 | 6.0.3 (7 held) |
| `@babel/core`, `@babel/preset-env` | 7.29.7 | 7.29.13, 7.29.14 (Babel 8 held) |
| `msw` | 2.15.0 | 2.15.0 (3 held) |
| `prettier` | 3.9.10 | 3.10.1 |

Old versions are read from the `3c934e9` lock, new ones with `npm ls` on the tip. `package.json` asks for Node `>=24.15.0`; every build and test ran on Node 24.18.1.

## 2. Packages held, and why

- **Babel 8:** Next 16.4.6 runs `babel.config.js` inside its own bundled Babel 7.27 core, which cannot run Babel 8 plugins.
- **typescript 7:** `typescript-eslint` 8.72 needs typescript below 6.1, and typescript 7 has no compiler API.
- **msw 3:** it intercepts at the socket. Network errors then come from another realm, and fake-timer tests hang (T-501, T-504; 20 unit reds).
- **cssnano-simple 3:** 3.0.2 moves the shared heading line-heights after the h2 and h4 rules, so h2 and h4 render with other line-heights. That is a visible change.

## 3. App-code changes, by change site

From `git log 3c934e9..HEAD --no-merges` outside `e2e`, `test` and `docs`:

| Commit | Change site | What changed |
|---|---|---|
| `a911220` | CS-N15-1, LB-9 | `next` 15.5.29 (W7a); two Stryker comments reworded |
| `4b192dd` | LB-8 | `scripts/run-faults.mjs` writes a stale fault's own run record into the kill summary (tool) |
| `789a4ca` | CS-N15-3 | `pages/_app.jsx`: page data asked for under `/static/search/_next/data`. From Next 15.4 the app answers `/search/_next/data` with the page's HTML. |
| `2d36ffc`, `93d4005` | CS-R19-2, CS-R19-3 | Histoslider and MathMarkdown defaults moved inside the components (`defaultProps` is gone in React 19); listed in `vendor/CHANGES.md` |
| `702b674` | CS-R19-6 | React 19.2.9 (W7b) |
| `227c264` | CS-R19-7 | Design Select keeps typed characters on React 19 (`vendor/oacore-design`) |
| `aeeb041` | CS-R19-8 | Focus returns to Report after the report form closes on React 19 (design modal portal) |
| `89d6561` | CS-N16-2, CS-N16-5, CS-N16-6 | Next 16.4.6; `next build --webpack` and `next dev --webpack`; the `eslint` key that Next 16 rejects is removed from `next.config.js` |
| `152978f` | CS-N16-6 | next-images' empty `serverRuntimeConfig` key dropped (Next 16 warns about it) |
| `a1994f1` | W81 | Minor and patch bumps, React 19.3.1 |
| `7c11868`, `ca2b77f` | W82 | Babel 7 patches; msw back to 2.15.0 |
| `546a168`, `e40499f`, `c7e81a6`, `5f617cc`, `3b1d372`, `0e3fc2d` | W83 | CSS tool chain bumps; cssnano-simple held at 2.0.0; `postcss.config.js` keeps the bare `[focus-within]` fallback (so the thumbnail card's hidden title and focus shadow do not change); one rule removed from `stylelint.config.js` that stylelint 18 dropped; lock hoisting; `scripts/lint-parity.mjs` |
| `7388a24` | W84 | mobx 7, Sentry 11, `@mdi/svg` 7.4.47. `utils/sentry.js` keeps the Sentry 7 set of integrations, keeps sessions off, and exits after an uncaught exception as Sentry 7 did. |
| `1d9d705` | W84 | `store/filters.js` declares its MobX annotations in `makeObservable` (MobX 7 drops legacy decorators) |
| `4d20e43` | T-014 (a) | `scripts/next-diff.mjs` ignores Next 16's folder-dependent entry-loader source-map names and random preview keys (tool) |
| `cd58065` | RC-2 | `pages/_app.jsx`: the page data prefix follows the build's `assetPrefix`. An azure build uses `/static/search`; a build without `BUILD_TARGET=azure` uses Next's own `/_next/data`. |
| `5df3f43` | RC-1 | `next.config.js`: `next/dist/lib/route-pattern-normalizer.js` is compiled for the client, as CS-N14-2 did for `constants.js`, so the main chunk is ES2015 again (KaiOS 2.5 and other browsers in `.browserslistrc`) |
| `75a88ea` | SENTRY-REQDATA-1 | `utils/sentry.js`: server events no longer carry the request block, the client IP, the request transaction name or the response context, as on Sentry 7 (`RequestData` dropped, `Http` without request sessions, a `beforeSend` that removes the transaction name and response context). Left over: Sentry 11 sets level `error` explicitly and scopes breadcrumbs to each request. |

## 4. Existing behaviours that changed because the framework changed them

These are not fixes made in the app. They come with Next 15 and stay.

- **Q-069 (head after hydration):** up to Next 14, hydration corrupted the head. Some Meta tags (`DC.title`, `DCTERMS.abstract`, `DC.identifier`, `DC.subject`, the JSON-LD) vanished, and after a client navigation the SEO meta tags of the first page stayed. From Next 15, `next/head` manages every `<Head>` tag (`data-next-head`). The head after hydration equals the SSR head, and the meta tags follow a client navigation. T-729 checks both cases.
- **Q-016 (back link with a repeated `t`):** for a query such as `?t=a%26b%3Dc%20d`, the Next 15 server writes the back link's space as `+` and the client writes it as `%20`. Both decode to the same query. Production keeps the server's value and prints nothing; `next dev` shows a hydration warning, which is mapped as a dev-only row (`q016-t-odd-href-hydration`).

## 5. Final test totals (stabilise step)

Final tree build: `b76966cffc0f917f` at `75a88ea` (twin `b76966cffc0f917f-b` for T-014, no-DSN build `f78199f23ad39c19`). The harness build is `3d68630fb8d47956`.

| Tier | Result |
|---|---|
| Jest unit | 1107 passed, 1 failed (T-104 c2, §6) |
| Jest static | 94 of 94 (T-014 and T-015 included) |
| Jest harness | T-012 25 passed; proxy self-test 156 of 156; stub self-check 18 of 18 |
| Jest ops (no Docker) | 18 of 18 in 4 suites |
| Playwright chromium | 966 of 966 |
| Playwright wire (`--no-deps`) | 28 of 28 |
| Visual T-801 (default stack) | 309 of 309 |
| Visual T-802 (harness build) | 73 of 73 |
| CS-OPS-1 overlay (T-604, T-702) | 26 of 26 |
| Ops T-907 c2 | 7 of 7 |
| Ops T-907 c1/c3 rehearsal | 2 of 2 |
| Lint | eslint 18 findings and stylelint 12 (both the same as before); lint:json 3 warnings in `test/fixtures/data-snapshot`, unchanged since `3c934e9`; lint:parity OK |

Jest unit and static, Playwright chromium and wire ran on `75a88ea`, after a new dev inventory (T-728) on that tree. The other tiers ran on the tree before SENTRY-REQDATA-1, which changes only server-side Sentry events. T-801, T-802 and the T-907 rehearsal ran on the tree before RC-1 and RC-2. Those two fixes change no rendered UI.

Not run: WebKit and Firefox (these projects exist only inside the runner container), `e2e/ops/t901-container` and `test/ops/t901.sh`. All of them need Docker.

## 6. Open items

- **T-104 c2: closed on 2026-11-17.** The owner asked for the Dockerfile change after the track: `Dockerfile:1` is now `FROM node:24.18.1-alpine`, the Node version every build and test of the track ran on. See §7.
- **Build warnings (information).** The client build prints two "Attempted import error" warnings for `onUncaughtExceptionIntegration` and `httpIntegration`, because the client bundle swaps `@sentry/node` for `@sentry/browser`. Both are used only under `!process.browser`, so the client never calls them. The build still succeeds.

## 7. Before the deploy (owner)

- **Dockerfile: done on 2026-11-17, at the owner's request.** Three changes:
  - `FROM node:24.18.1-alpine` (was `node:18-alpine`). This closes T-104 c2.
  - `npm ci` and its `npm install` fallback both add `--install-links`. The vendored design package needs it: without the flag `npm ci` stops, and the fallback would link the folder and rewrite the lock.
  - `ENV NODE_OPTIONS="--openssl-legacy-provider"` is removed. Only Next 10 with webpack needed it, and the track's builds ran without it from Next 12 on.

  `--include=dev` stays, because `cssnano-simple` is a devDependency the build needs. The image steps were rehearsed on the host, since no Docker is used: on a clean export and Node 24.18.1, `npm ci` with the new flags exited 0 without the fallback and left the lock unchanged, and the design package was installed as a real folder. The build (`build:test`, without the flag) and `next start` worked, serving `/icons.svg`, `/images/...` and the pages. The real image build is still unproven: it is alpine, while the host is macOS.
- **Memory on Node 24 (check at the deploy, `kube/` not changed).** In the track's measurements a Node 24 process peaked at 604 to 784 MiB in the 69-request sweep, while `kube/prod/deployment.yaml` has a 768Mi limit, a 512Mi request and `--max-old-space-size=1024`. Watch RSS and OOMKilled restarts in the first 48 h. If restarts show up, raise the limit or add `--max-semi-space-size=16` to `NODE_OPTIONS` (details: `docs/upgrade/20-change-sites.md`, "Memory on Node 24").
- **Gateway:** page data now goes through the existing `/static/search` rule (`/static/search/_next/data/...` is stripped to `/_next/data/...`). Prod and stage must keep building with `BUILD_TARGET=azure`. No gateway edit is needed. During jump 4, some page-data requests on today's prod reached another build and answered 404 (`.p2-work/jump4/notes.md`). That happens with the old path too.
- **Mention sweep before the push:** the last row of `.p2-work/LEAN-PLAN.md`'s order. Check the branch's commit messages and `docs/` for mentions of the tools used in the work, and strip any you find. A scan of `3c934e9..HEAD` and of `docs/`, `scripts/`, `test/` and `e2e/` on 2026-11-16 found none. The sweep is still the owner's last step.
- Push and deploy only after the items above.
