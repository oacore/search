# Dashboard reference conventions (target architecture)

Source audited: `../dashboard` (read-only, 2026-10-19). Git HEAD `48e3466`.
Env files: key names only, values intentionally omitted.

## 0. Summary

- React 19 + Vite 7 + TypeScript 5.9 SPA, react-router-dom 7 (data router), SWR + axios for server state, zustand 5 for client state, antd 6 plus the `@oacore/core-ui` package for UI, plain co-located CSS files.
- Quality gates: `tsc -b` (inside `build`), ESLint flat config, husky + lint-staged on pre-commit.
- **No test runner and no test files.** No vitest, jest, playwright, cypress, testing-library or msw.
- **react-hook-form is not used.** It is not in package.json, the lockfile or `src/`. Forms use antd `Form.useForm`.
- **Prettier is not configured.** No prettier config, no devDependency, no lockfile entry. A stray `prettier@2.8.8` exists in `node_modules` only.

## 1. Versions, package manager, scripts

Package manager: pnpm, lockfile `pnpm-lock.yaml` (`lockfileVersion: '9.0'`, pnpm 9 format). No `packageManager` field. No committed `.npmrc` (only `.npmrc.dist` template). Node `>=24` (`engines`, Dockerfile `node:24-alpine`, CI `node-version: 24`).

Installed versions (from `node_modules`, range in package.json in brackets):

| Package | Installed | Range |
|---|---|---|
| react / react-dom | 19.2.4 | ^19.2.4 |
| react-router-dom | 7.13.1 | ^7.13.1 |
| antd | 6.3.2 | ^6.3.1 |
| @ant-design/icons | 5.6.1 | ^5.5.1 |
| @oacore/core-ui | 2.0.20 | ^2.0.20 |
| axios | 1.13.6 | ^1.13.6 |
| swr | 2.4.1 | ^2.4.1 |
| zustand | 5.0.11 | ^5.0.11 |
| @sentry/react | 10.49.0 | ^10.49.0 |
| recharts | 3.8.0 | ^3.7.0 |
| dayjs | 1.11.19 | ^1.11.19 |
| typescript | 5.9.3 | ~5.9.3 |
| vite / @vitejs/plugin-react | 7.3.1 / 5.1.4 | ^7.3.1 / ^5.1.4 |
| eslint / typescript-eslint | 10.0.3 / 8.57.0 | ^10.0.2 / ^8.56.1 |
| eslint-plugin-react-hooks / -react-refresh | 7.0.1 / 0.5.2 | ^7.0.1 / ^0.5.2 |
| husky / lint-staged | 9.1.7 / 16.3.3 | ^9.1.7 / ^16.3.1 |

Other runtime deps: `@octokit/rest`, `@sentry/react`, `classnames`, `dayjs`, `front-matter`, `html-to-image`, `js-cookie`, `js-yaml`, `jspdf` 4, `react-markdown` 10, `rehype-raw` 7, `react-is`.
Other devDeps: `@sentry/cli` 3, `@sentry/vite-plugin` 5, `@types/*`, `@eslint/js` 10, `globals` 17, `eslint-formatter-compact` 9.

`package.json` (name is `dashboard-test-structure`, which is misleading):

```json
"engines": { "node": ">=24" },
"scripts": {
  "dev": "vite --mode development",
  "build": "tsc -b && vite build --mode production",
  "build:staging": "tsc -b && vite build --mode staging",
  "lint": "eslint . --format compact",
  "prepare": "husky",
```

Other scripts: `dev:local`, `dev:staging`, `build:dev`, `build:production`, `preview`, `docker:build` (`sh scripts/docker-build.sh`), `build:core-ui`, `sentry:*`. No `test`, `typecheck`, `format` script.

`pnpm-workspace.yaml` and the pnpm section of `package.json`:

```yaml
packages:
  - '.'
ignoredBuiltDependencies:
  - esbuild
```
```json
"pnpm": { "onlyBuiltDependencies": ["@oacore/core-ui", "@sentry/cli"] }
```

`@oacore/*` packages come from GitHub Packages (`@oacore:registry=https://npm.pkg.github.com`). Dockerfile writes `.npmrc` from `NPM_TOKEN`, installs, then deletes it. A local install needs the token.

## 2. Project structure, naming, path aliases

```
src/
  main.tsx            entry: imports instrument, core-ui styles, Sentry error hooks, ConfigProvider
  App.tsx             SWRConfig + RouterProvider
  instrument.ts       Sentry.init (imported first in main.tsx)
  assets/{icons,img}/ SVG files (imported as URLs)
  components/
    Layout/           DashboardLayout.tsx, menuItems.ts, styles.css
    common/           shared wrappers: CrDatePicker, CrDrawer, CrTable, CrSider, RepositorySelect, ...
  config/             axios.ts, auth401Handler.ts, env.ts, swr.ts, theme.ts, types.ts
  features/<Name>/    43 feature folders: <Name>.tsx, components/, hooks/, store/, texts/, types/, utils/, styles.css
  guards/             ProtectedRoute.tsx, MetadataRestrictedRoute.tsx, RootRedirect.tsx
  hooks/              cross-feature hooks (useUser.ts, useDataProviders.ts, useSWR.ts, ...)
  pages/              one thin wrapper per route + index.ts barrel
  routes/index.tsx    createBrowserRouter definition
  services/           auth.service.ts
  store/              authStore.ts, dataProviderStore.ts (global stores)
  styles/             App.css, theme.css, index.css (empty)
  types/ utils/
```

Naming observed:
- Components and pages: PascalCase files and exports (`OverviewFeature` in `features/Overview/Overview.tsx`, `OverviewPage` in `pages/Overview.tsx`).
- Hooks: `useXxx.ts`, camelCase, usually one hook per file.
- Stores: `xxxStore.ts` exporting `useXxxStore`.
- Feature folder names are inconsistent: PascalCase (`Doi`), kebab (`Rrs-policy`), lowercase (`indexing`). Also a typo file `Orcid/Orcide.tsx`.
- Imports mix `.ts`/`.tsx` extensions with extensionless paths.

Path aliases (`tsconfig.app.json` `paths`, mirrored in `vite.config.ts` `resolve.alias`):

```json
"paths": {
  "@/*": ["src/*"],
  "@components/*": ["src/components/*"],
  "@features/*": ["src/features/*"],
  "@hooks/*": ["src/hooks/*"],
  "@services/*": ["src/services/*"],
  "@stores/*": ["src/stores/*"],
  "@styles/*": ["src/styles/*"],
  "@types/*": ["src/types/*"],
  "@utils/*": ["src/utils/*"],
  "@config/*": ["src/config/*"],
  "@routes/*": ["src/routes/*"]
}
```

Caveats: `@stores` points to `src/stores`, which does not exist (the folder is `src/store`), and nothing uses it. Vite also aliases `react` and `react-dom` to `node_modules` paths, which is unusual and should be checked after upgrades.

## 3. TypeScript

`tsconfig.json` is only project references (`files: []`) to `tsconfig.app.json` (src) and `tsconfig.node.json` (vite.config.ts). Strictness is high:

```json
"target": "ES2022", "strict": true, "noUnusedLocals": true, "noUnusedParameters": true,
"erasableSyntaxOnly": true, "noFallthroughCasesInSwitch": true,
"noUncheckedSideEffectImports": true, "verbatimModuleSyntax": true,
"allowImportingTsExtensions": true, "moduleResolution": "bundler", "noEmit": true,
```

`tsconfig.node.json` uses the same flags with `ES2023`. Type checking only happens via `tsc -b` in `build`. No `lint` type-aware rules. `: any` appears 8 times, mostly in `config/swr.ts`, which has `/* eslint-disable */` at the top.

## 4. Lint, formatting, git hooks

`eslint.config.js` (flat config, TypeScript files only):

```js
export default tseslint.config([
  globalIgnores(['dist', '.next']),
  { files: ['**/*.{ts,tsx}'],
    extends: [js.configs.recommended, tseslint.configs.recommended, reactRefresh.configs.vite],
    plugins: { 'react-hooks': reactHooks },
    rules: {
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
      'preserve-caught-error': 'off',
      'no-duplicate-imports': ['error', { allowSeparateTypeImports: true }],
    },
    languageOptions: { ecmaVersion: 2020, globals: globals.browser } },
]);
```

- Lint uses `eslint . --format compact`. There is no `.eslintrc*`, no `.prettierrc`, no `.editorconfig`.
- `eslint-disable` appears in 3 files: `config/swr.ts` (whole file), `features/NotificationGuide/hooks/useNotificationGuide.ts`, `features/indexing/hooks/useIssuesPages.ts`.
- Husky 9: `.husky/pre-commit` runs `npx lint-staged`. `package.json` `lint-staged`: `"*.{js,jsx,ts,tsx}": ["eslint --fix --format compact"]`. No commit-msg hook. The `prepare` script runs `husky`. Dockerfile sets `HUSKY=0`.
- No CI step runs lint or type checks on PRs (see section 10).

`.cursor/rules/rule.mdc` asks for SCSS, `class:` syntax and `handle` event names. The codebase is plain CSS and does not follow that rule.

## 5. Routing, layouts, guards

`react-router-dom` v7 is imported in 21 files. There are no direct `react-router` imports. The router is wrapped for Sentry:

```ts
const createAppRouter = wrapCreateBrowserRouterV7(createBrowserRouter);
export const router = createAppRouter([
  { path: '/login', element: <LoginPage /> },
  { path: '/', element: <ProtectedRoute><RootRedirect /></ProtectedRoute> },
  { path: '/data-providers/:dataProviderId',
    element: (<ProtectedRoute><RestrictedRoute><DashboardLayout /></RestrictedRoute></ProtectedRoute>),
    children: [{ index: true, element: <Navigate to="overview" replace /> }, /* ...tabs */] },
```

Public routes: `/login`, `/reset`, `/reset/:token`, `/invitation`. Protected tree: `/data-providers/:dataProviderId/*`, with about 25 child tabs (overview, indexing, validator, deduplication, fresh-finds, content, ...). Settings has nested children.

Guards (`src/guards/`):
- `ProtectedRoute`: calls `checkAuth()` from the auth store on mount, shows a spinner while loading, and redirects to `/login?continue=...&reason=logout_unexpectedly` when not authenticated.
- `RestrictedRoute` (`MetadataRestrictedRoute.tsx`): loads data-provider sync, statistics and harvesting status, then disables tabs listed in `DISABLED_TABS_WHEN_NO_METADATA` (`components/Layout/menuItems.ts`).
- `RootRedirect`: sends the user to their first data provider's default path.

Layout: `components/Layout/DashboardLayout.tsx` with `menuItems.ts` (menu entries with regex `test` and `path`).

Known issue: the `usrn` child route is declared twice in `routes/index.tsx`.

## 6. Data fetching

### axios (`src/config/axios.ts`)

```ts
export const API = axios.create({
  baseURL: env.IDP_URL,
  headers: { "Content-Type": "application/json", 'x-custom-dashboard-header': 'true' },
  timeout: 900000, // 15 minutes in milliseconds
  withCredentials: true,
});
```

- Exports a single `API` instance and an `http` object with typed `get/post/put/patch/delete<T>` wrappers returning `AxiosResponse<T>`.
- Request interceptor is a no-op (`// TODO test key`).
- Response interceptor: on 401 for `/internal/` URLs (not `login_check` or `/logout`), it clears auth cookies and calls `handleUnauthorized()`. `config/auth401Handler.ts` holds the callback registry, which avoids a circular import. `main.tsx` registers the handler: clear session, then `window.location.href = '/login?reason=logout_unexpectedly'`.
- Cookie helper `cookieManager` (js-cookie) with auth cookie names; auth is cookie-based.
- Direct `axios` imports outside `config/`: `services/auth.service.ts`, `hooks/useRequestResetToken.ts`, `hooks/useRegisterFromInvitation.ts`, 2 features, and `ChangePassword`.

### SWR (`src/config/swr.ts`, `src/App.tsx`)

Global config is provided in `App.tsx` via `<SWRConfig value={swrConfig}>`. Hooks opt into `swrDefaultConfig` (revalidation off, `errorRetryCount: 1`):

```ts
export const swrDefaultConfig: SWRConfiguration = {
  revalidateOnFocus: false,
  revalidateOnReconnect: false,
  dedupingInterval: 0,
  shouldRetryOnError: true,
  errorRetryCount: 1,
};
```

- Global `fetcher(url, withCredentials, options)` wraps `http.get` and sets no-cache headers. `postRequestFetcher`, `patchRequest`, `putRequest`, `deleteRequest` are the mutation helpers.
- Keys are plain URL strings, with `createSWRKey(endpoint, params)` for query strings. Keys are not arrays.
- `useSWR` appears in 43 files. `swr/mutation` (`useSWRMutation`) is used in 4 files. `createMutationHelpers(mutate)` provides create/update/delete with rollback and `captureHandledError`.

Hook pattern (`src/hooks/useUser.ts`):

```ts
const { data, error, isLoading, mutate } = useSWR<User>(
  key,
  () => getCurrentUser(),
  { ...swrDefaultConfig, onSuccess: (userData) => setUser(userData) },
);
```

Mutation pattern (`features/indexing/hooks/useHarvestingRequest.ts`):

```ts
const { data, error, isMutating, trigger, reset } = useSWRMutation(
  'harvesting/request',
  async (_key: string, { arg }: { arg: { dataProviderId: number; message: string } }) => {
    const url = `/internal/data-providers/${arg.dataProviderId}/harvesting/request`;
    return (await postRequestFetcher(url, { message: arg.message }, true)) as HarvestingRequestResponse;
  }
);
```

### zustand

- 40 files import from `zustand`. 19 files use `zustand/middleware`, which is mostly `devtools`. Only `store/authStore.ts` and `features/Fair/store/fairCertificationStore.ts` use `persist`.
- Feature stores live in `features/<Name>/store/`. Global stores live in `src/store/`.
- Pattern (`features/Doi/store/doiStore.ts`):

```ts
export const useDoiStore = create<DoiStore>()(
  devtools(
    (set) => ({
      searchTerm: '',
      setSearchTerm: (searchTerm) => set({ searchTerm }),
      resetOnPageEnter: () => set({ searchTerm: '' }),
    }),
    { name: 'doi-store' }
  )
);
```

- Interfaces are split into `State`, `Actions`, and `type Store = State & Actions`.
- `authStore` persists under the key `auth-storage` with `partialize`, which keeps user data in localStorage even though the comment says the session lives in cookies.

## 7. UI: antd, core-ui, CSS

Theme wiring (`src/main.tsx`), merging the core-ui theme with the local theme:

```ts
const mergedTheme = {
  ...coreTheme,
  token: { ...coreTheme?.token, ...localTheme?.token },
  components: { ...coreTheme?.components, ...localTheme?.components },
} as ThemeConfig;
// <ConfigProvider theme={mergedTheme}><App /></ConfigProvider>
```

- `coreTheme` is `antdTheme` from `@oacore/core-ui`. `localTheme` is `src/config/theme.ts`, which sets brand tokens (`colorPrimary #B75400`, `colorSuccess #8BC34A`, `colorError #C62828`, `borderRadius 2`, `fontSize 14`, `controlHeight 32`) and component overrides.
- `src/styles/theme.css` defines `:root` custom properties (`--color-primary`, `--color-text-secondary`, `--color-bg-layout`, `--danger`, `--gray-600`, ...). Usage counts: `var(--color-text-secondary` 99, `var(--color-primary` 84.
- `import '@oacore/core-ui/styles'` loads core-ui CSS globally. `vite-env.d.ts` declares that module.

`@oacore/core-ui` (2.0.20) is imported in 89 places. Names seen: `CrPaper`, `CrStatsCard`, `antdTheme`. Local `components/common/Cr*` components wrap antd for reuse.

CSS approach:
- Plain `.css` files, co-located per feature or component (`features/Overview/styles.css`), imported directly: `import './styles.css';`. 38 CSS files in total.
- 0 CSS modules, 0 SCSS.
- Global kebab-case class names (`overview-card`, `overview-card-error-message`, `header-wrapper-title`). BEM-like `fair-certificate__frame` appears occasionally.
- Inline `style={{ ... }}` appears about 30 times, including `ProtectedRoute` and `RootRedirect`.
- Icons: `@ant-design/icons` (`LoadingOutlined`) and SVG imports as URLs (`import placeholder from '@/assets/icons/chartPlaceholder.svg'`).

Dependency mismatch: `@oacore/core-ui@2.0.20` declares peer `antd: ^5.27.6` and `engines: { node: '>=24.14.0', pnpm: '>=10' }`. The dashboard resolves `antd@6.3.2` and uses pnpm 9 in Docker and CI. Both need checking before upgrades.

## 8. Forms, env, error reporting

Forms: `antd` `Form.useForm` only, in 4 files (`OrganisationCard.tsx`, `OaiMapping.tsx`, `FreshFindsSettings.tsx`, `ChangePassword.tsx`). No react-hook-form, zod or yup. Other forms use controlled state.

Env:
- Committed: `.env.development`, `.env.production`, `.env.staging`. `.env` and `.env.local` are gitignored. `.example.env` documents the Docker build args.
- Keys: `VITE_APP_NAME`, `VITE_APP_API_BASE_URL`, `VITE_API_URL`, `VITE_IDP_URL`, `VITE_SENTRY_DSN`, `VITE_GA_TRACKING_CODE`. `VITE_GITHUB_TOKEN` is declared in types only.
- `vite-env.d.ts` declares `ImportMetaEnv`. Access is centralized in `src/config/env.ts`, which validates required keys:

```ts
export const env: EnvConfig = {
  API_URL: import.meta.env.VITE_API_URL ?? '',
  IDP_URL: import.meta.env.VITE_IDP_URL ?? '',
  SENTRY_DSN: import.meta.env.VITE_SENTRY_DSN ?? '',
  // ...
};
validate(env); // throws if API_URL or IDP_URL is empty
```

Sentry:
- `src/instrument.ts` runs `Sentry.init` only when `VITE_SENTRY_DSN` is set. It uses `reactRouterV7BrowserTracingIntegration` and `replayIntegration`, with `tracesSampleRate` 0.2 in prod and `replaysOnErrorSampleRate` 1.0.
- `main.tsx` passes `Sentry.reactErrorHandler()` to `createRoot` when a DSN is set.
- `utils/captureHandledError.ts` reports caught errors manually (try/catch).
- `@sentry/vite-plugin` uploads sourcemaps only when `SENTRY_AUTH_TOKEN` is set.

## 9. Testing

None. Evidence:
- No `*.test.*`, `*.spec.*`, `__tests__`, `vitest.config*`, `jest.config*`, `playwright.config*` or `cypress*` anywhere outside node_modules.
- No test runner or testing library in package.json or pnpm-lock.yaml.
- No `test` script.

Actual gates: `tsc -b` during build, ESLint on pre-commit and via `npm run lint`, and the Sentry runtime.

## 10. Docker, nginx, CI

Dockerfile (multi-stage):

```dockerfile
FROM node:24-alpine AS builder
# ...
RUN set -eux; \
    printf '%s\n' '@oacore:registry=https://npm.pkg.github.com' "//npm.pkg.github.com/:_authToken=${TOKEN}" > .npmrc; \
    corepack enable; corepack prepare pnpm@9 --activate; \
    NODE_ENV=development pnpm install --frozen-lockfile; rm -f .npmrc
COPY . .
RUN case "$APP_ENV" in staging) pnpm run build:staging ;; development) pnpm run build:dev ;; *) pnpm run build ;; esac

FROM nginx:1.27-alpine AS runtime
COPY nginx/default.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /app/dist /usr/share/nginx/html
EXPOSE 8080
```

- `nginx/default.conf`: listens on 8080, `try_files $uri $uri/ /index.html` (SPA fallback). No caching or security headers.
- `scripts/docker-build.sh` sources `.env` and passes build args.
- `.dockerignore` excludes node_modules, dist, .git, .github, *.md, and env files except what is copied.

CI (`.github/workflows/`):
- `aks_deploy_prod.yml` (push to `main`) and `aks_deploy_stage.yml` (push to `stage`, plus `repository_dispatch`).
- Job 1: builds an arm64 image with `docker buildx`, pushes to ACR `corecontainers`, syncs a Kubernetes secret, applies `kube/<env>/service.yaml` and `httproute.yaml`, runs `envsubst` on `deployment.yaml`, then waits for rollout.
- Job 2 (prod only in the audited file): installs with pnpm/action-setup `version: 9` and Node 24, runs `pnpm run build:${APP_ENV}` again, then creates a Sentry release with sourcemaps.
- No PR workflow. Lint, type check and build are not gated before merge.

`kube/prod` and `kube/stage` each contain `deployment.yaml`, `service.yaml` and `httproute.yaml`.

## Upgrade-relevant notes

1. Peer mismatch: core-ui wants antd `^5.27.6`, the dashboard uses antd 6.3.2. Verify core-ui compatibility before any antd change.
2. pnpm version: core-ui engines require pnpm `>=10`, while Dockerfile and CI pin pnpm 9. Lockfile v9 is readable by pnpm 10.
3. No tests means upgrades are validated only by `tsc -b`, ESLint and manual checks. Any baseline smoke test has to be added first.
4. `node_modules` contains `prettier@2.8.8` without a lockfile entry, so it is stale and not a real dependency.
5. `.cursor/rules/rule.mdc` describes SCSS and conventions the code does not follow.
6. Duplicate `usrn` route, `@stores` alias to a missing folder, and `eslint-disable` in `config/swr.ts`.
7. `authStore` persists user data to localStorage under `auth-storage`.
