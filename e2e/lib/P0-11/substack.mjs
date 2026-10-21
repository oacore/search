// P0-11 helpers for T-608: a short-lived stack of its own per crash case, started and stopped through the
// harness CLI (scripts/e2e-stack.mjs up/down: own port slot, the already-built app, never a build), with the
// preload mounted into the app (`--mount <file>:<path>`, NODE_OPTIONS appended through `--app-env`). The app
// of such a stack is expected to exit (c1), so it never serves another test; the package's own stack is
// untouched. One sub-stack at a time (the T-608 tests run serially).
import fs from 'node:fs'
import path from 'node:path'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { REPO, ARTIFACT_DIR, readJson, images } from './files.mjs'
import { rawRequest } from './http.mjs'

const run = promisify(execFile)
const STACK = path.join(REPO, 'scripts', 'e2e-stack.mjs')
export const TEST_DSN = 'https://public@o0.ingest.sentry.io/0'

const cli = (args) =>
  run(process.execPath, [STACK, ...args], {
    cwd: REPO,
    env: { ...process.env, ARTIFACT_DIR },
    timeout: 300000,
    maxBuffer: 1 << 24,
  })

export async function down(id) {
  await cli(['down', '--run', id]).catch(() => null)
}

export async function up(id, { build, preload, target = '/p011/preload.cjs' }) {
  await down(id)
  const args = [
    'up',
    '--run',
    id,
    '--build',
    build,
    '--mount',
    `${preload}:${target}`,
    '--app-env',
    `NODE_OPTIONS=--require=${target}`,
  ]
  try {
    await cli(args)
  } catch (e) {
    const env = readJson(path.join(ARTIFACT_DIR, 'runs', id, 'env.json'), {})
    throw new Error(
      `e2e-stack up ${id} failed: ${env.error || e.stderr || e.message}`
    )
  }
  const env = readJson(path.join(ARTIFACT_DIR, 'runs', id, 'env.json'))
  if (env.mode !== 'host')
    throw new Error(
      `T-608 drives the app process by signal: local (host) mode only, got ${env.mode}`
    )
  return env
}

export const appLog = (env) => path.join(env.runDir, 'app.log')
export const appExit = (env) =>
  readJson(path.join(env.runDir, 'app-exit.json'), null)

// the preload's JSON lines in the app log
export function preloadLines(env) {
  let text = ''
  try {
    text = fs.readFileSync(appLog(env), 'utf8')
  } catch {
    return []
  }
  return text
    .split('\n')
    .filter((l) => l.startsWith('{"p011":'))
    .map((l) => JSON.parse(l))
}

export const trigger = (env) => process.kill(env.pids.app, 'SIGUSR2')

export const healthz = (env) =>
  rawRequest(env.appURL, '/api/healthz/', { timeoutMs: 5000 }).then(
    (r) => r.status,
    () => 0
  )

// builds: the run's own (the prod-shaped test DSN) and the no-DSN variant of the same tree (I-07)
export function buildRecord(key) {
  const b = images()[key]
  if (!b) throw new Error(`no build ${key} in images.json`)
  return b
}
export async function nodsnBuild(mainKey) {
  if (process.env.T608_NODSN_BUILD) return process.env.T608_NODSN_BUILD
  const main = buildRecord(mainKey)
  const usable = Object.values(images()).filter(
    (b) =>
      b.variant === 'nodsn' &&
      b.mode === 'host' &&
      b.buildEnv &&
      b.buildEnv.SENTRY_DSN === '' &&
      fs.existsSync(path.join(b.dir, '.next', 'BUILD_ID'))
  )
  const same =
    usable.find((b) => b.runtimeTree === main.runtimeTree) ||
    usable.find((b) => b.commit === main.commit)
  if (same) return same.key
  const { findBuild } = await import(
    path.join(REPO, 'scripts', 'build-parity.mjs')
  )
  const head = findBuild({ variant: 'nodsn', mode: 'host' })
  if (head) return head.key
  throw new Error(
    `no nodsn host build for the tree of ${mainKey} or HEAD (I-07): the harness owner runs \`npm run build:parity -- --variant nodsn\``
  )
}
