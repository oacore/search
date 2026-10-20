#!/usr/bin/env bash
# T-901 (41 J): container contract of the parity image (`npm run test:image -- <image>`; 40 §10, CI-5).
# Step 2.1 stub: the nine clauses are written by P0-16 at 2.3 (image ENV, prod env + 768m, healthz and six
# routes via the proxy, size, no patching/wasm log, SIGTERM under 20 rps, time-to-ready, keepAlive and
# headers timeouts). Docker mode only; in local mode (no Docker) T-901 is DEFERRED.
set -euo pipefail
image="${1:-}"
if [ -z "$image" ]; then
  echo "usage: npm run test:image -- <image id or repo@sha256:digest>" >&2
  exit 2
fi
echo "T-901: clauses not written yet (P0-16 completes this script at 2.3); image ${image}" >&2
exit 3
