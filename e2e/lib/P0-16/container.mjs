// P0-16 helpers of T-901 (41 J, CI-5): the container contract. Pure readers of the deployment manifests and
// the recipe, a request generator, and thin adapters for the two ways a stack exists: `host` (local mode, the
// app is a `next start` process of a parity build: the only mode run in this run) and `docker` (a container of
// the parity image: written for CI, DEFERRED here, never run locally).
import fs from 'node:fs'
import http from 'node:http'
import path from 'node:path'
import crypto from 'node:crypto'
import { execFile, execFileSync } from 'node:child_process'
import { promisify } from 'node:util'
import YAML from 'yaml'
import { REPO, ARTIFACT_DIR } from './substack.mjs'

const exec = promisify(execFile)
export { REPO, ARTIFACT_DIR }

export const read = (rel) => fs.readFileSync(path.join(REPO, rel), 'utf8')

// ---------- the deployment (kube/prod/deployment.yaml) ----------
const QUANTITY = {
  Ki: 1024,
  Mi: 1024 ** 2,
  Gi: 1024 ** 3,
  K: 1e3,
  M: 1e6,
  G: 1e9,
}
export function bytesOf(quantity) {
  const m = String(quantity).match(/^(\d+(?:\.\d+)?)(Ki|Mi|Gi|K|M|G|k|m|g)?$/)
  if (!m) throw new Error(`unreadable quantity ${quantity}`)
  // Docker's `768m` and Kubernetes' `768Mi` are both 768 x 2^20 bytes
  const unit =
    { m: 1024 ** 2, g: 1024 ** 3, k: 1024 }[m[2]] || QUANTITY[m[2]] || 1
  return Math.round(Number(m[1]) * unit)
}

export function prodDeployment() {
  const doc = YAML.parse(read('kube/prod/deployment.yaml'))
  const pod = doc.spec.template.spec
  const c = pod.containers[0]
  const sleep = (c.lifecycle.preStop.exec.command
    .join(' ')
    .match(/sleep (\d+)/) || [])[1]
  return {
    name: c.name,
    graceSeconds: pod.terminationGracePeriodSeconds,
    preStopSeconds: Number(sleep),
    env: Object.fromEntries((c.env || []).map((e) => [e.name, e.value])),
    secrets: (c.envFrom || []).map((e) => e.secretRef && e.secretRef.name),
    limits: c.resources.limits,
    requests: c.resources.requests,
    port: c.ports[0].containerPort,
    startup: c.startupProbe,
    readiness: c.readinessProbe,
    liveness: c.livenessProbe,
  }
}

export function composeApp() {
  // the file interpolates ${VARS}: only the fixed keys are read
  const doc = YAML.parse(read('e2e/compose.yml').replace(/\$\{[^}]*\}/g, 'X'))
  return doc.services.app
}

// ---------- the recipe (Dockerfile) ----------
// ARG defaults and ENV lines: { args: {NAME: default}, env: {NAME: value or $ARG} }
export function dockerfileEnv(text = read('Dockerfile')) {
  const joined = text.replace(/\\\n\s*/g, ' ')
  const args = {}
  const env = {}
  for (const line of joined.split('\n')) {
    let m = line.match(/^ARG\s+(\w+)(?:=(\S*))?\s*$/)
    if (m) args[m[1]] = m[2] === undefined ? null : m[2]
    m = line.match(/^ENV\s+(.*)$/)
    if (m)
      for (const pair of m[1].match(/(\w+)=("[^"]*"|\S+)/g) || []) {
        const [k, ...v] = pair.split('=')
        env[k] = v.join('=').replace(/^"|"$/g, '')
      }
  }
  return { args, env }
}

export const dockerfiles = (commit) =>
  execFileSync('git', ['-C', REPO, 'ls-tree', '--name-only', commit], {
    encoding: 'utf8',
  })
    .split('\n')
    .filter((f) => /^Dockerfile/.test(f))

export const gitShow = (commit, file) =>
  execFileSync('git', ['-C', REPO, 'show', `${commit}:${file}`], {
    maxBuffer: 1 << 28,
  })
export const sha256 = (buf) =>
  crypto.createHash('sha256').update(buf).digest('hex')

// ---------- the app log of a stack ----------
export const readLog = (file) => {
  try {
    return fs.readFileSync(file, 'utf8')
  } catch {
    return ''
  }
}
// the preload's JSON lines (e2e/lib/P0-16/preload-server.cjs)
export const preloadEvents = (env) =>
  readLog(path.join(env.runDir, 'app.log'))
    .split('\n')
    .filter((l) => l.startsWith('{"p016":"T-901"'))
    .map((l) => JSON.parse(l))

// ---------- 20 requests per second ----------
// One request per tick through `origin`, each on its own connection (a rolling update sees new connections and
// the proxy's own pool, not one reused socket). The records say when each started and ended and how.
export function startLoad({ origin, path: urlPath, rps = 20 }) {
  const records = []
  const t0 = Date.now()
  const fire = () => {
    const rec = { start: Date.now() - t0, end: null, status: null, error: null }
    records.push(rec)
    const done = (status, error) => {
      if (rec.end !== null) return
      rec.end = Date.now() - t0
      rec.status = status
      rec.error = error || null
    }
    const req = http.get(
      `${origin}${urlPath}`,
      { headers: { connection: 'close' } },
      (res) => {
        res.on('data', () => {})
        res.on('end', () => done(res.statusCode))
        res.on('error', (e) => done(null, e.code || e.message))
      }
    )
    req.setTimeout(30000, () => req.destroy(new Error('timeout')))
    req.on('error', (e) => done(null, e.code || e.message))
  }
  const timer = setInterval(fire, 1000 / rps)
  return {
    records,
    t0,
    now: () => Date.now() - t0,
    stop: () => clearInterval(timer),
    // every request has ended (or the time is up)
    settled: async (timeoutMs = 40000) => {
      const until = Date.now() + timeoutMs
      while (records.some((r) => r.end === null) && Date.now() < until)
        await new Promise((r) => setTimeout(r, 50))
      return records.every((r) => r.end !== null)
    },
  }
}

// ---------- the two kinds of stack ----------
// host: the app is a `next start` process of a parity build (scripts/e2e-stack.mjs, local mode; the only mode
// run in this run). docker: a container of the parity image in the compose topology (CI; written against the
// compose recipe and the CLI, DEFERRED here: P2_DOCKER_MODE=enabled and a Docker daemon are needed).
const docker = (args) => exec('docker', args, { maxBuffer: 1 << 26 })

export async function dockerImageInfo(imageId) {
  const [inspect] = JSON.parse(
    (await docker(['image', 'inspect', imageId])).stdout
  )
  const history = (
    await docker([
      'history',
      '--no-trunc',
      '--format',
      '{{.CreatedBy}}',
      imageId,
    ])
  ).stdout
  return {
    size: inspect.Size,
    env: Object.fromEntries(
      inspect.Config.Env.map((e) => e.split(/=(.*)/s).slice(0, 2))
    ),
    labels: inspect.Config.Labels || {},
    history,
  }
}

// sha256 of a file of the image (/app is the WORKDIR): `npm install` after a failed `npm ci` rewrites the lock
export async function dockerFileSha(imageId, file) {
  const r = await docker([
    'run',
    '--rm',
    '--entrypoint',
    'sha256sum',
    imageId,
    file,
  ])
  return r.stdout.trim().split(/\s+/)[0]
}

async function dockerApp(env) {
  const { stdout } = await docker([
    'ps',
    '-aq',
    '--filter',
    `label=org.search.p2.run=${env.run}`,
    '--filter',
    'label=com.docker.compose.service=app',
  ])
  return stdout.trim().split('\n')[0]
}

// the app's stdout and stderr
export async function appLogText(env) {
  if (env.mode === 'docker') {
    const r = await docker(['logs', await dockerApp(env)])
    return `${r.stdout}\n${r.stderr}`
  }
  return readLog(path.join(env.runDir, 'app.log'))
}

export async function preloadEventsOf(env) {
  return (await appLogText(env))
    .split('\n')
    .filter((l) => l.startsWith('{"p016":"T-901"'))
    .map((l) => JSON.parse(l))
}

export async function signalApp(env, signal) {
  if (env.mode === 'docker') {
    await docker(['kill', '--signal', signal, await dockerApp(env)])
    return
  }
  process.kill(env.pids.app, signal)
}

// { code, signal, at (ms epoch) } once the app has exited, else null
export async function appExitOf(env) {
  if (env.mode === 'docker') {
    const id = await dockerApp(env)
    const { stdout } = await docker([
      'inspect',
      '-f',
      '{{.State.Status}} {{.State.ExitCode}} {{.State.FinishedAt}} {{.State.OOMKilled}}',
      id,
    ])
    const [status, code, finished, oom] = stdout.trim().split(' ')
    return status === 'exited'
      ? {
          code: Number(code),
          signal: null,
          at: Date.parse(finished),
          oom: oom === 'true',
        }
      : null
  }
  try {
    const e = JSON.parse(
      fs.readFileSync(path.join(env.runDir, 'app-exit.json'), 'utf8')
    )
    return { code: e.code, signal: e.signal, at: Date.parse(e.at) }
  } catch {
    return null
  }
}

// a short-lived stack of the package's build (host: scripts/e2e-stack.mjs; docker: the same CLI in docker mode)
export async function startStack(
  runId,
  parent,
  { appEnv = [], mounts = [] } = {}
) {
  const stack = path.join(REPO, 'scripts', 'e2e-stack.mjs')
  const env = { ...process.env, ARTIFACT_DIR }
  const run = (args) =>
    exec(process.execPath, [stack, ...args], {
      cwd: REPO,
      env,
      timeout: 300000,
      maxBuffer: 1 << 24,
    })
  await run(['down', '--run', runId]).catch(() => null)
  const args = ['up', '--run', runId]
  if (parent.mode === 'docker') args.push('--mode', 'docker')
  else args.push('--build', parent.build.key)
  for (const kv of appEnv) args.push('--app-env', kv)
  for (const m of mounts) args.push('--mount', m)
  try {
    await run(args)
  } catch (e) {
    throw new Error(`e2e-stack up ${runId} failed: ${e.stderr || e.message}`)
  }
  const file = path.join(ARTIFACT_DIR, 'runs', runId, 'env.json')
  const state = JSON.parse(fs.readFileSync(file, 'utf8'))
  if (state.status !== 'ready')
    throw new Error(`stack ${runId} is not ready: ${state.error}`)
  return state
}

export async function stopStack(runId) {
  const stack = path.join(REPO, 'scripts', 'e2e-stack.mjs')
  await exec(process.execPath, [stack, 'down', '--run', runId], {
    cwd: REPO,
    env: { ...process.env, ARTIFACT_DIR },
    timeout: 120000,
  }).catch(() => null)
}

// du -sk of a path, in KiB
export function sizeKb(dir) {
  return Number(
    execFileSync('du', ['-sk', dir], { encoding: 'utf8' }).split(/\s/)[0]
  )
}
