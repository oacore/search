# Vendored design package: edits

`vendor/oacore-design/` is `@oacore/design` 5.0.74 verbatim (`vendor/PROVENANCE.md`). An edit is allowed only as listed in `docs/upgrade/60-design-ownership.md` §7, each with its own change-site row, a test that is red or pinned beforehand, and one row here in the same change. Code edits touch `lib/**` only (the code that runs); the later port to search's own components replays every such row onto `src/`. The manifest edits of 60 §7 (peer ranges, dependencies) touch the package's `package.json`.

`scripts/verify-design-verbatim.mjs` (T-016) passes only when the files of `vendor/oacore-design/` that differ from the published tarball are exactly the files in the first column (relative to the package).

| File | Change | CS/Q | PR | Test |
|---|---|---|---|---|
| `package.json` | `peerDependencies`: `react` and `react-dom` `^17.0.1` → `^17.0.1 \|\| ^18.0.0 \|\| ^19.0.0` | CS-DSN-3 | W5 part 2 (local) | T-016 c3 (pinned: no difference before), T-008 c2 (strict `npm ls` problem set) |
| `lib/elements/index.js` | The `Carousel` getter (`Object.defineProperty(exports, "Carousel", …)`, 6 lines) and `var _carousel = _interopRequireDefault(require("./carousel"))` deleted; `react-slick` dropped from the `package.json` dependencies. `lib/elements/carousel/**` and its CSS stay (the CSS is imported by `lib/elements/index.css`); `Carousel: true` in `_exportNames` stays | CS-DSN-4 | W5 part 2 (local) | T-016 c2 (pinned: 110 emitted design modules), T-016 c3, T-004 (no react-slick in either bundle) |
| `package.json` | `dependencies`: `babel-plugin-add-react-displayname` (0.0.5), `body-scroll-lock` (^3.1.5) and `d3-format` (^1.2.0) removed; `lib/**` and `bin/**` require none of them (the package's own `babel.config.js` names the plugin for its source build, which search never runs; search's `package.json` keeps the plugin and `d3-scale` keeps `d3-format`) | CS-DSN-5 | W5 part 2 (local) | T-016 c3, T-013 (lock scope) |
