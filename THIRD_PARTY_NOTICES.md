# Third-party notices

The repository redistributes the third-party code below in `vendor/`, and one page in `pages/`. Each copy keeps its own licence file, verbatim; the page carries its licence in its header.

| Component | Version | Where | Licence | Licence file |
|---|---|---|---|---|
| `@oacore/design` | 5.0.74 | `vendor/oacore-design/` (directory package), `vendor/oacore-design-5.0.74.tgz` (published tarball) | MIT, Copyright (c) 2015 The Open University. Its `package.json` says `UNLICENSED`; the shipped MIT `LICENSE` applies (decision OD-21, `docs/upgrade/60-design-ownership.md` §2) | `vendor/oacore-design/LICENSE` |
| `bibtex-parse-js` | 0.0.24 | `vendor/bibtex-parse-js/bibtexParse.js` | MIT, Copyright (c) 2013 ORCID, Inc. | `vendor/bibtex-parse-js/LICENSE` |
| `i18n-iso-countries` | 6.8.0 (English names only) | `vendor/i18n-iso-countries/en.json` | MIT, Copyright (c) 2016 widdix GmbH | `vendor/i18n-iso-countries/LICENSE` |
| `next` (the built-in error page only) | 10.2.3 | `pages/_error.jsx` (the source of `dist/pages/_error.js`, from its published source map; the types removed, `Head` from `next/head`) | MIT, Copyright (c) 2021 Vercel, Inc. | the header comment of the page (the package's `license.md`, verbatim) |

Packages the design depends on are installed from npm and are not part of the repository. These ship files that the design's CSS and code bring into the built app:

| Package | Version | Licence |
|---|---|---|
| `katex` | 0.16.22 | Code: MIT, Copyright (c) 2013-2020 Khan Academy and other contributors (`node_modules/katex/LICENSE`). Fonts (`dist/fonts/`, 20 families as `.ttf`, `.woff` and `.woff2`, all 60 copied into the build by the design CSS): SIL Open Font License 1.1, Copyright (c) 2009-2010 Design Science, Inc. and (c) 2014-2018 Khan Academy, Reserved Font Names `KaTeX_AMS`, `KaTeX_Caligraphic`, `KaTeX_Fraktur`, `KaTeX_Main`, `KaTeX_Math`, `KaTeX_SansSerif`, `KaTeX_Script`, `KaTeX_Size1` to `KaTeX_Size4` and `KaTeX_Typewriter`; the copyright and licence notice is in each font file's name table (records 0, 13 and 14, licence URL http://scripts.sil.org/OFL), which the font licence accepts as the notice for a copy shipped unchanged |
| `d3-array` | 1.2.4 | BSD-3-Clause, Copyright 2010-2016 Mike Bostock |
| `d3-scale` | 1.0.7 | BSD-3-Clause, Copyright 2010-2015 Mike Bostock |
