// P0-16 helper for the T-721 negative control (R-082): a short-lived stack of its own, started and stopped
// through the harness CLI (scripts/e2e-stack.mjs up/down: own port slot, the already-built app of the
// package's run, never a build), with the app env the control needs (`--app-env BUILD_TARGET=` unsets the
// image ENV the harness sets for the app, so `next start` re-reads next.config.js without it, 42 §2).
// The package's own stack is untouched; one sub-stack at a time.
import fs from 'node:fs'
import path from 'node:path'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { fileURLToPath } from 'node:url'
import { expect } from '../../fixtures/guard.mjs'

const run = promisify(execFile)
export const REPO = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
  '..',
  '..'
)
const STACK = path.join(REPO, 'scripts', 'e2e-stack.mjs')
export const ARTIFACT_DIR = path.resolve(
  process.env.ARTIFACT_DIR || path.join(REPO, '..', 'search-upgrade-artifacts')
)
const envFile = (id) => path.join(ARTIFACT_DIR, 'runs', id, 'env.json')
export const readEnv = (id) => {
  try {
    return JSON.parse(fs.readFileSync(envFile(id), 'utf8'))
  } catch {
    return null
  }
}

const cli = (args) =>
  run(process.execPath, [STACK, ...args], {
    cwd: REPO,
    env: { ...process.env, ARTIFACT_DIR },
    timeout: 300000,
    maxBuffer: 1 << 24,
  })

// the run id of a sub-stack: the parent run plus a suffix
export const subId = (parent, suffix) => `${parent.run}-${suffix}`

export async function down(id) {
  await cli(['down', '--run', id]).catch(() => null)
  // the supervisor stops its children before it records `stopped`
  await expect
    .poll(() => (readEnv(id) || { status: 'stopped' }).status, {
      timeout: 30000,
    })
    .not.toBe('ready')
}

// starts the sub-stack from the parent run's build with `appEnv` (K=V entries; K= unsets K) and `mounts`
// (`<file>:<path inside the app>` entries, host mode uses the file where it is) and returns its env.json
export async function up(id, parent, appEnv = [], mounts = []) {
  if (parent.mode !== 'host')
    throw new Error(
      `the P0-16 controls start host stacks of their own: local (host) mode only, got ${parent.mode}`
    )
  await down(id)
  const args = ['up', '--run', id, '--build', parent.build.key]
  for (const kv of appEnv) args.push('--app-env', kv)
  for (const m of mounts) args.push('--mount', m)
  try {
    await cli(args)
  } catch (e) {
    const env = readEnv(id) || {}
    throw new Error(
      `e2e-stack up ${id} failed: ${env.error || e.stderr || e.message}`
    )
  }
  const env = readEnv(id)
  if (!env || env.status !== 'ready')
    throw new Error(`sub-stack ${id} is not ready`)
  return env
}
