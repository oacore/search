// P0-10 helper for T-610 c3/c4: a short-lived stack of its own (scripts/e2e-stack.mjs up/down through the harness
// CLI: own port slot, the already-built app of the package's run, never a build), so that the app's stdout/stderr
// and the stub's Sentry records belong to one serial sweep only. The package's stack serves the parallel tests
// and its app log interleaves their output; this one serves only the test that started it and is stopped by it.
import fs from 'node:fs'
import path from 'node:path'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { fileURLToPath } from 'node:url'
import { expect } from '../../fixtures/guard.mjs'

const run = promisify(execFile)
const REPO = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
  '..',
  '..'
)
const STACK = path.join(REPO, 'scripts', 'e2e-stack.mjs')
const ARTIFACT_DIR = path.resolve(
  process.env.ARTIFACT_DIR || path.join(REPO, '..', 'search-upgrade-artifacts')
)
const envFile = (id) => path.join(ARTIFACT_DIR, 'runs', id, 'env.json')
const readEnv = (id) => {
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

export const appLogOf = (env) => path.join(env.runDir, 'app.log')

// the run id of a sub-stack: the parent run plus a suffix (one per test, so parallel tests never share one)
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

// starts the sub-stack from the parent run's build and returns its env.json; `up` recreates the run directory,
// so the app log starts with this start's output
export async function up(id, parent) {
  if (parent.mode !== 'host')
    throw new Error(
      `T-610 reads the app's stdout/stderr from the run's app.log: local (host) mode only, got ${parent.mode}`
    )
  await down(id)
  try {
    await cli(['up', '--run', id, '--build', parent.build.key])
  } catch (e) {
    const env = readEnv(id) || {}
    throw new Error(
      `e2e-stack up ${id} failed: ${env.error || e.stderr || e.message}`
    )
  }
  const env = readEnv(id)
  if (!env || env.status !== 'ready')
    throw new Error(`sub-stack ${id} is not ready`)
  return { env, offset: 0 }
}

// the bytes appended to a file since `from`
export function readFrom(file, from) {
  const size = fs.existsSync(file) ? fs.statSync(file).size : 0
  if (size <= from) return { text: '', to: size }
  const fd = fs.openSync(file, 'r')
  try {
    const buf = Buffer.alloc(size - from)
    fs.readSync(fd, buf, 0, buf.length, from)
    return { text: buf.toString('utf8'), to: size }
  } finally {
    fs.closeSync(fd)
  }
}
