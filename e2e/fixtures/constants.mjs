// Harness constants of the Playwright tiers (40 §1, §5; pinned by T-012 c5). Built-ins only, so T-012 can
// read them on any Node. CLI: node e2e/fixtures/constants.mjs --json
import path from 'node:path'
import { fileURLToPath } from 'node:url'

export const RETRIES = 0
export const FORBID_ONLY = true
export const WORKERS = 4
export const TIMEZONE_ID = 'UTC'
export const LOCALE = 'en-GB'
export const FIXED_TIME = '2026-01-15T12:00:00Z'
export const COOKIE_STATES = ['absent', 'essential', 'essential+analytics']
// port offsets from E2E_PORT_BASE = 21000 + 20 x slot (manifest §5.4)
export const PORT_BASE = 21000
export const PORT_STRIDE = 20
export const PORT_OFFSETS = {
  gateway: 0,
  allow: 1,
  app: 2,
  stubHttp: 3,
  stubHttps: 4,
  stubControl: 5,
}

if (
  fileURLToPath(import.meta.url) === path.resolve(process.argv[1] || '') &&
  process.argv.includes('--json')
) {
  console.log(
    JSON.stringify({
      RETRIES,
      FORBID_ONLY,
      WORKERS,
      TIMEZONE_ID,
      LOCALE,
      FIXED_TIME,
      COOKIE_STATES,
      PORT_BASE,
      PORT_STRIDE,
      PORT_OFFSETS,
    })
  )
}
