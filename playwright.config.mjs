// Playwright configuration of the parity harness (40 §2, §5; 42 §3). @playwright/test lives only in
// e2e/package.json (42 §5 item 3), so it is loaded through a require anchored there (I-18).
// The run comes from $ARTIFACT_DIR/runs/$E2E_RUN/env.json (written by scripts/e2e-stack.mjs up); reports and
// outputs go under that run directory. Projects: chromium (G, H tiers), visual (I tier), wire (serial, the
// tests that read the SSR stub's wire log), webkit and firefox (runner container only), ops (prod-only
// clauses; only with P2_OPS=1), record (golden captures; only with RECORD=1).
import { createRequire } from 'node:module'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  RETRIES,
  FORBID_ONLY,
  WORKERS,
  TIMEZONE_ID,
  LOCALE,
} from './e2e/fixtures/constants.mjs'

const ROOT = path.dirname(fileURLToPath(import.meta.url))
const require = createRequire(path.join(ROOT, 'e2e', 'package.json'))
const { defineConfig, devices } = require('@playwright/test')

const ARTIFACT_DIR = path.resolve(
  process.env.ARTIFACT_DIR || path.join(ROOT, '..', 'search-upgrade-artifacts')
)
const RUN = process.env.E2E_RUN || 'default'
const RUN_DIR = path.join(ARTIFACT_DIR, 'runs', RUN)
const env = (() => {
  try {
    return JSON.parse(fs.readFileSync(path.join(RUN_DIR, 'env.json'), 'utf8'))
  } catch {
    return null
  }
})()
const IN_RUNNER = process.env.P2_IN_RUNNER === '1'
const baseURL = IN_RUNNER
  ? 'http://proxy:8080'
  : env
  ? env.baseURL
  : process.env.E2E_PORT_BASE
  ? `http://127.0.0.1:${Number(process.env.E2E_PORT_BASE)}`
  : undefined

const BROWSER_TIERS = ['http', 'journeys', 'a11y'].map(
  (d) => `**/${d}/**/*.spec.mjs`
)
const shared = { timezoneId: TIMEZONE_ID, locale: LOCALE }

const projects = [
  {
    name: 'chromium',
    testMatch: BROWSER_TIERS,
    grepInvert: /@wire\b/,
    use: { ...devices['Desktop Chrome'], ...shared },
  },
  {
    name: 'wire',
    testMatch: BROWSER_TIERS,
    grep: /@wire\b/,
    fullyParallel: false,
    workers: 1,
    use: { ...devices['Desktop Chrome'], ...shared },
  },
  {
    name: 'visual',
    testMatch: ['**/visual/**/*.spec.mjs'],
    use: { ...devices['Desktop Chrome'], ...shared, reducedMotion: 'reduce' },
  },
]
if (IN_RUNNER)
  projects.push(
    {
      name: 'webkit',
      testMatch: [...BROWSER_TIERS, '**/visual/**/*.spec.mjs'],
      grep: /@engines\b/,
      use: { ...devices['Desktop Safari'], ...shared },
    },
    {
      name: 'firefox',
      testMatch: [...BROWSER_TIERS, '**/visual/**/*.spec.mjs'],
      grep: /@engines\b/,
      use: { ...devices['Desktop Firefox'], ...shared },
    }
  )
if (process.env.P2_OPS === '1')
  projects.push({
    name: 'ops',
    testMatch: ['**/ops/**/*.spec.mjs'],
    use: { ...shared },
  })
if (process.env.RECORD === '1')
  projects.push({
    name: 'record',
    testMatch: ['**/{http,journeys,visual}/**/*.spec.mjs'],
    use: { ...devices['Desktop Chrome'], ...shared, reducedMotion: 'reduce' },
  })

export default defineConfig({
  testDir: path.join(ROOT, 'e2e'),
  testMatch: '**/*.spec.mjs',
  testIgnore: ['**/node_modules/**'],
  retries: RETRIES,
  forbidOnly: FORBID_ONLY,
  workers: WORKERS,
  fullyParallel: true,
  timeout: 60000,
  expect: { timeout: 10000 },
  outputDir: path.join(RUN_DIR, 'test-results'),
  // host-mode captures are provisional (owner notes §1): the platform suffix keeps them apart from the
  // runner's linux captures in the committed snapshot folders
  snapshotPathTemplate:
    '{testDir}/{testFileDir}/{testFileName}-snapshots/{arg}{-projectName}{-platform}{ext}',
  reporter: [
    ['list'],
    ['json', { outputFile: path.join(RUN_DIR, 'report.json') }],
  ],
  use: {
    baseURL,
    ...shared,
    trace: 'retain-on-failure',
    screenshot: 'off',
    video: 'off',
    serviceWorkers: 'block',
  },
  projects,
  metadata: {
    run: RUN,
    mode: env ? env.mode : null,
    evidence: env ? env.evidence : null,
    build: env ? env.build || env.image : null,
  },
})
