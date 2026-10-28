# Vendored design package: provenance

`vendor/oacore-design-5.0.74.tgz` is the published `@oacore/design@5.0.74` tarball, byte for byte (CS-DSN-1, step W0.5). `vendor/oacore-design/` is that tarball extracted, file for file; since W5 `package.json` installs the directory as `"@oacore/design": "file:vendor/oacore-design"` (CS-DSN-2; `docs/upgrade/60-design-ownership.md` §4 layout C and §5). The tarball is never edited and stays as the byte-exact reference until the design is removed (CS-DSN-7); the directory changes only by the edits listed in `vendor/CHANGES.md` (60 §7: zero edits at W0.5 and DV1).

## Tarball

| Field | Value |
|---|---|
| Package | `@oacore/design` 5.0.74, published to GitHub Packages (`npm.pkg.github.com`); dist-tag `latest` = 5.0.74, peers `react` and `react-dom` `^17.0.1` (checked 2026-10-27) |
| File | `vendor/oacore-design-5.0.74.tgz`, 300,657 bytes, 466 entries (files only) |
| sha1 | `e6a401d74defeb09d828b10374ff35107a9324c4` (the published `shasum`; the last element of the lock's former `resolved` URL `https://npm.pkg.github.com/download/@oacore/design/5.0.74/e6a401d74defeb09d828b10374ff35107a9324c4`) |
| sha512 | `sha512-kwYolSk+PrJtJzSkhyUz/YGJKDbPcf6UpALedXnhWhNeJL/xB8PDvgGjHYq+xOZi2V7SIB9h0tueAAgR6IagrQ==` (the `integrity` of the lock entry `node_modules/@oacore/design`, unchanged by the switch to the `file:` spec) |
| sha256 | `412030794ba95ae356455069add2f29ce42b6c3405d11480cf5d2991d89461af` |
| Source | design repository `https://github.com/oacore/design` at commit `bbc35a0`: every file outside `lib/` equals `git archive bbc35a0`, and `lib/` (220 files) rebuilds byte-identical from the shipped `src/` at `bbc35a0` (verified 2026-10-19) |
| Fetched | 2026-10-27, Node 18.20.8 and npm 10.8.2: `npm pack @oacore/design@5.0.74 --offline --ignore-scripts --pack-destination <dir>`, served from the npm cache that earlier installs had filled from GitHub Packages (nothing downloaded); the result equals the cache entry of the lock integrity byte for byte |

## Directory package (W5)

| Field | Value |
|---|---|
| Directory | `vendor/oacore-design/`, 466 files (= the tarball's entries; `git ls-files vendor/oacore-design \| wc -l`), 4 of them executable (`bin/index.js`, `bin/build/index.js`, `bin/build/icons/index.js`, `bin/build/config/index.js`) |
| Made | 2026-10-28: `mkdir vendor/oacore-design && tar -xzf vendor/oacore-design-5.0.74.tgz -C vendor/oacore-design --strip-components=1`. `.gitignore` re-includes `vendor/oacore-design/bin/build/`: its `build` pattern would leave those 6 files untracked and a fresh checkout would fail at `node bin build` |
| Content | equal to the tarball file for file (sha256): `node scripts/verify-design-verbatim.mjs --target vendor/oacore-design` reports 0 differences |
| Lock | `npm install --install-links --package-lock-only --legacy-peer-deps --ignore-scripts ./vendor/oacore-design` (Node 18.20.8, npm 10.8.2). The lock entry has `resolved` `file:vendor/oacore-design` and no integrity: npm does not check a directory's content, `scripts/verify-design-verbatim.mjs` (T-016) does, against the sha512 above |
| Install | `npm ci --include=dev --legacy-peer-deps --install-links`: npm packs the directory and installs a copy under `node_modules/@oacore/design` (466 files, not a symlink), byte-identical to the W0.5 install from the tarball; the postinstall writes `lib/config.js` there as before. Without `--install-links`, `npm ci` stops (EUSAGE) and `npm install` would link the directory (a symlink: the app's Babel would then compile the design, R-075) |

## How to verify

```sh
shasum -a 1 vendor/oacore-design-5.0.74.tgz                                       # e6a401d7…
echo "sha512-$(openssl dgst -sha512 -binary vendor/oacore-design-5.0.74.tgz | base64)"  # = the lock integrity
node scripts/verify-design-verbatim.mjs                                           # installed copy vs the tarball (T-016 c3)
node scripts/verify-design-verbatim.mjs --target vendor/oacore-design             # the directory vs the tarball
```

The verifier takes the tarball from the npm cache (nothing is downloaded) or from `--tarball vendor/oacore-design-5.0.74.tgz`, and checks it against the sha1 and sha512 above before comparing.

## Caveats

- The source is this tarball, never a checkout of the design repository. The design working tree differs from it: `lib/` is stale in 4 files (`config.js`, `elements/footer/footer.js`, `elements/footer/footer.css`, `global/elements/footer/footer.css`), and `assets/github.svg` → `assets/githubF.svg` is a staged rename.
- The package's `postinstall` (`node bin build`) finds search's `design.config.js` by walking up from the install directory, writes `lib/config.js` and builds the icon sprite. The installed copy therefore differs from the tarball in that one file, with the values `publicPath: "/static/search"` and `iconsPublicPath: "/static/search/icons.svg"`. Without `design.config.js` in the install context every icon 404s silently; the install must run scripts (no `--ignore-scripts`).
- A `file:` tarball installs as a copy, not a symlink (466 files under `node_modules/@oacore/design`). The `file:` directory of W5 needs `--install-links` for the same shape, on every install (the image's install too: `docs/upgrade/20-change-sites.md` §Deploy-time items).
- The directory holds the package's own tool configs (`.eslintrc.yml`, `bin/.eslintrc.yml`, `stylelint.config.js`, `prettier.config.js`, `.lintstagedrc`, `.huskyrc`, `babel.config.js`, `postcss.config.js`, `.github/workflows/`). Search's tools never use them: ESLint ignores `vendor/**`, Prettier and stylelint read `.prettierignore` and `.stylelintignore`, the pre-commit hook runs `lint-staged --config package.json`, Jest leaves `vendor/oacore-design/` out of its module map, and the app's builds read only the root configs. GitHub reads workflows only from the repository's own `.github/`.

## Licence

The tarball's `LICENSE` is MIT, "Copyright (c) 2015 The Open University"; the package's `package.json` and its lock entry say `UNLICENSED`. OD-21 (decided 2026-10-20): MIT applies and `LICENSE` stays verbatim inside the tarball and the directory (`vendor/oacore-design/LICENSE`). The repository is public, so vendoring redistributes the package under that licence; `THIRD_PARTY_NOTICES.md` lists it.
