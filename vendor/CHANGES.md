# Vendored design package: edits

`vendor/oacore-design/` is `@oacore/design` 5.0.74 verbatim (`vendor/PROVENANCE.md`). An edit is allowed only as listed in `docs/upgrade/60-design-ownership.md` §7, each with its own change-site row, a test that is red or pinned beforehand, and one row here in the same change. Edits touch `lib/**` only (the code that runs); the later port to search's own components replays every row onto `src/`.

`scripts/verify-design-verbatim.mjs` (T-016) passes only when the files of `vendor/oacore-design/` that differ from the published tarball are exactly the files in the first column (relative to the package).

| File | Change | CS/Q | PR | Test |
|---|---|---|---|---|

No rows yet: zero edits at W0.5 and W5 part 1 (DV1).
