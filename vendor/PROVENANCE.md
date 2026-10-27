# Vendored design package: provenance

`vendor/oacore-design-5.0.74.tgz` is the published `@oacore/design@5.0.74` tarball, byte for byte. `package.json` installs it as `"@oacore/design": "file:vendor/oacore-design-5.0.74.tgz"` (CS-DSN-1, step W0.5; `docs/upgrade/60-design-ownership.md` §4 layout C and §5). The file is never edited (60 §7: zero edits at W0.5 and DV1); the directory copy of W5 (CS-DSN-2) is extracted from it.

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

## How to verify

```sh
shasum -a 1 vendor/oacore-design-5.0.74.tgz                                       # e6a401d7…
echo "sha512-$(openssl dgst -sha512 -binary vendor/oacore-design-5.0.74.tgz | base64)"  # = the lock integrity
node scripts/verify-design-verbatim.mjs                                           # installed copy vs the tarball (T-016 c3)
```

Every `npm ci` checks the file against the lock integrity and refuses another file.

## Caveats

- The source is this tarball, never a checkout of the design repository. The design working tree differs from it: `lib/` is stale in 4 files (`config.js`, `elements/footer/footer.js`, `elements/footer/footer.css`, `global/elements/footer/footer.css`), and `assets/github.svg` → `assets/githubF.svg` is a staged rename.
- The package's `postinstall` (`node bin build`) finds search's `design.config.js` by walking up from the install directory, writes `lib/config.js` and builds the icon sprite. The installed copy therefore differs from the tarball in that one file, with the values `publicPath: "/static/search"` and `iconsPublicPath: "/static/search/icons.svg"`. Without `design.config.js` in the install context every icon 404s silently; the install must run scripts (no `--ignore-scripts`).
- A `file:` tarball installs as a copy, not a symlink (466 files under `node_modules/@oacore/design`). A `file:` directory, from W5, needs `--install-links` for the same shape.

## Licence

The tarball's `LICENSE` is MIT, "Copyright (c) 2015 The Open University"; the package's `package.json` and its lock entry say `UNLICENSED`. OD-21 (decided 2026-10-20): MIT applies and `LICENSE` stays verbatim inside the tarball. The repository is public, so vendoring the tarball redistributes the package under that licence; `THIRD_PARTY_NOTICES.md` follows at W5.
