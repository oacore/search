// prettier-sync.mjs - Prettier formatting for the harness writers that need it synchronously (40 §7 rule 7:
// committed JSON is written in the repository's Prettier format, so `npm run lint:json` stays clean and a
// re-capture is byte-identical). Prettier 3 (W1, CS-PRET-1) has no synchronous API: `format` returns a promise and
// `resolveConfig.sync` is gone. This runs the installed Prettier CLI on the text with --stdin-filepath, so the
// repository config (prettier.config.js) resolves for that path as before, and (as with the API) no ignore file
// applies.

import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const BIN = path.join(ROOT, 'node_modules', 'prettier', 'bin', 'prettier.cjs')

// the text formatted as Prettier formats `filepath` with `parser`
export function formatSync(text, filepath, parser = 'json') {
  const r = spawnSync(
    process.execPath,
    [
      BIN,
      '--stdin-filepath',
      path.resolve(ROOT, filepath),
      '--parser',
      parser,
      '--ignore-path',
      '/dev/null',
    ],
    { cwd: ROOT, input: text, encoding: 'utf8', maxBuffer: 1 << 28 }
  )
  if (r.error) throw new Error(`prettier: ${r.error.message}`)
  if (r.status !== 0)
    throw new Error(
      `prettier exited with ${r.status}: ${String(r.stderr).slice(0, 400)}`
    )
  return r.stdout
}

// a JSON value as the committed file `filepath` holds it
export const formatJsonSync = (value, filepath) =>
  formatSync(JSON.stringify(value), filepath, 'json')
