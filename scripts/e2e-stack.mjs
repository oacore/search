#!/usr/bin/env node
// e2e-stack.mjs - per-run test stacks with private ports (manifest §5.4, 42 §3). Several packages run e2e at
// the same time, so nothing uses a fixed port: each run takes a slot (atomic mkdir under
// $ARTIFACT_DIR/slots/), E2E_PORT_BASE = 21000 + 20 x slot, offsets +0 gateway-faithful proxy, +1 allow-all
// proxy, +2 app origin, +3 stub HTTP, +4 stub HTTPS, +5 stub control. A supervisor process owns the stack;
// a slot whose supervisor is gone is reclaimed. The app is never built here (scripts/build-parity.mjs).
//
//   up      --run <id> [--mode host] [--ref HEAD] [--variant default|nodsn|harness] [--overlay cs-ops-1]
//           [--build <key of $ARTIFACT_DIR/images.json>]
//           [--app-env K=V]... (K= unsets K) [--mount <file>:<path>]...
//   down    --run <id>
//   status  [--run <id>]
//   gc
//   test    --run <id> [--visual] [--record [--provisional]] [playwright args...]
//
// `--mode docker` refuses (Docker is out of scope, owner rule of 2026-10-22).
// host mode (never evidence, manifest §5.3): next start of the host build on the runtime Node (24.18.1 from
// W4e, runtimeNode() of scripts/build-parity.mjs; 18.20.8 before), the SSR stub and
// e2e/proxy/node-proxy.mjs as host processes; other outbound hosts reach the stub via test/ssr/host-redirect.cjs.
import fs from 'node:fs'
import net from 'node:net'
import path from 'node:path'
import http from 'node:http'
import { spawn, spawnSync, execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import {
  PORT_BASE,
  PORT_STRIDE,
  PORT_OFFSETS,
} from '../e2e/fixtures/constants.mjs'
import { ARTIFACT_DIR, REPO, findBuild, runtimeNode } from './build-parity.mjs'

const SELF = fileURLToPath(import.meta.url)
const SLOTS = path.join(ARTIFACT_DIR, 'slots')
const RUNS = path.join(ARTIFACT_DIR, 'runs')
const MAX_SLOTS = 40
const runDir = (id) => path.join(RUNS, id)
const envFile = (id) => path.join(runDir(id), 'env.json')

const alive = (pid) => {
  if (!pid) return false
  try {
    process.kill(pid, 0)
    return true
  } catch (e) {
    return e.code === 'EPERM'
  }
}
const readJson = (f, d = null) => {
  try {
    return JSON.parse(fs.readFileSync(f, 'utf8'))
  } catch {
    return d
  }
}
const writeJson = (f, obj) => {
  fs.mkdirSync(path.dirname(f), { recursive: true })
  const tmp = `${f}.${process.pid}.tmp`
  fs.writeFileSync(tmp, `${JSON.stringify(obj, null, 1)}\n`)
  fs.renameSync(tmp, f)
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const portFree = (port) =>
  new Promise((resolve) => {
    const s = net.createServer()
    s.once('error', () => resolve(false))
    s.listen(port, '127.0.0.1', () => s.close(() => resolve(true)))
  })
const portsFor = (slot) => {
  const base = PORT_BASE + PORT_STRIDE * slot
  return {
    base,
    ...Object.fromEntries(
      Object.entries(PORT_OFFSETS).map(([k, v]) => [k, base + v])
    ),
  }
}
const validId = (id) => {
  if (!id || !/^[A-Za-z0-9][A-Za-z0-9._-]{0,62}$/.test(id))
    throw new Error(`invalid --run id "${id}" (letters, digits, . _ -)`)
  return id
}

// ---------- slots ----------
function slotOf(run) {
  if (!fs.existsSync(SLOTS)) return null
  for (const s of fs.readdirSync(SLOTS)) {
    const o = readJson(path.join(SLOTS, s, 'owner.json'))
    if (o && o.run === run) return { slot: Number(s), owner: o }
  }
  return null
}

function reclaimIfStale(slotDir) {
  const o = readJson(path.join(slotDir, 'owner.json'))
  const age = (() => {
    try {
      return Date.now() - fs.statSync(slotDir).mtimeMs
    } catch {
      return 0
    }
  })()
  if (o && (alive(o.pid) || (o.pending && age < 60000))) return false
  if (!o && age < 10000) return false
  if (o) killChildren(o)
  fs.rmSync(slotDir, { recursive: true, force: true })
  return true
}

async function allocate(run) {
  fs.mkdirSync(SLOTS, { recursive: true })
  for (let slot = 0; slot < MAX_SLOTS; slot++) {
    const dir = path.join(SLOTS, String(slot))
    try {
      fs.mkdirSync(dir)
    } catch {
      if (!reclaimIfStale(dir)) continue
      try {
        fs.mkdirSync(dir)
      } catch {
        continue
      }
    }
    writeJson(path.join(dir, 'owner.json'), {
      run,
      pid: process.pid,
      pending: true,
      created: new Date().toISOString(),
    })
    const ports = portsFor(slot)
    const free = await Promise.all(
      Object.values(PORT_OFFSETS).map((o) => portFree(ports.base + o))
    )
    if (free.every(Boolean)) return { slot, ports, dir }
    fs.rmSync(dir, { recursive: true, force: true })
  }
  throw new Error(`no free port slot (${MAX_SLOTS} slots)`)
}

function killChildren(owner) {
  for (const pid of owner.children || []) {
    if (!alive(pid)) continue
    try {
      process.kill(-pid, 'SIGTERM')
    } catch {
      try {
        process.kill(pid, 'SIGTERM')
      } catch {
        // gone
      }
    }
  }
}

// ---------- helpers ----------
const httpGet = (url, timeout = 2000) =>
  new Promise((resolve) => {
    const req = http.get(url, { timeout }, (res) => {
      res.resume()
      res.on('end', () => resolve(res.statusCode))
    })
    req.on('timeout', () => req.destroy())
    req.on('error', () => resolve(0))
  })
async function waitFor(fn, ms, what) {
  const until = Date.now() + ms
  while (Date.now() < until) {
    if (await fn()) return
    await sleep(250)
  }
  throw new Error(`timed out waiting for ${what}`)
}

const parseList = (argv, name) =>
  argv.flatMap((a, i) => (a === name ? [argv[i + 1]] : []))

// prod runtime env (42 §2, kube/prod/deployment.yaml:41-53) for the app process; image ENV for host mode
function appEnv({ ports, run, build, variant, extra, mounts, mode }) {
  const image = {
    SENTRY_DSN: build.buildEnv ? build.buildEnv.SENTRY_DSN : '',
    GA_TRACKING_CODE: build.buildEnv ? build.buildEnv.GA_TRACKING_CODE : '',
    API_KEY: 'test-key',
    ICONS_PUBLIC_PATH: '',
    BUILD_TARGET: 'azure',
    APP_ENV: 'production',
    NODE_ENV: 'production',
  }
  const testFlags =
    mode === 'host'
      ? [`--require ${path.join(REPO, 'test', 'ssr', 'host-redirect.cjs')}`]
      : []
  const env = {
    ...image,
    API_KEY: 'test-key',
    NODE_OPTIONS: ['--max-old-space-size=1024', ...testFlags].join(' '),
    UV_THREADPOOL_SIZE: '32',
    Internal_API:
      mode === 'host' ? `http://127.0.0.1:${ports.stubHttp}` : 'http://stub',
    Internal_API_HOST: 'api.core.ac.uk',
    NODE_EXTRA_CA_CERTS:
      mode === 'host' ? path.join(runDir(run), 'ca.pem') : '/certs/ca.pem',
    P2_STUB_HTTP: `http://127.0.0.1:${ports.stubHttp}`,
  }
  for (const kv of extra) {
    const i = kv.indexOf('=')
    const k = kv.slice(0, i)
    const v = kv.slice(i + 1)
    if (k === 'NODE_OPTIONS' && v)
      env.NODE_OPTIONS = `${env.NODE_OPTIONS} ${v}` // appended, never replaced
    else if (v === '') delete env[k]
    else env[k] = v
  }
  // host mode has no container paths: a mounted file is used from where it is
  if (mode === 'host')
    for (const m of mounts) {
      const [file, target] = m.split(':')
      for (const k of Object.keys(env))
        env[k] = env[k].split(target).join(path.resolve(file))
    }
  return env
}

// ---------- supervise (host) ----------
async function superviseHost(opts) {
  const { run, slot, ports } = opts
  const dir = runDir(run)
  const owner = {
    run,
    pid: process.pid,
    mode: 'host',
    children: [],
    created: new Date().toISOString(),
  }
  const slotDir = path.join(SLOTS, String(slot))
  const saveOwner = () => writeJson(path.join(slotDir, 'owner.json'), owner)
  saveOwner()
  const state = {
    run,
    mode: 'host',
    status: 'starting',
    slot,
    portBase: ports.base,
    ports,
    evidence: false,
  }
  const save = () => writeJson(envFile(run), state)
  save()
  const children = []
  let stopping = false
  const stop = async (code = 0) => {
    if (stopping) return
    stopping = true
    for (const c of children) if (c.exitCode === null) c.kill('SIGTERM')
    const until = Date.now() + 10000
    while (children.some((c) => c.exitCode === null) && Date.now() < until)
      await sleep(100)
    for (const c of children) if (c.exitCode === null) c.kill('SIGKILL')
    state.status = state.status === 'failed' ? 'failed' : 'stopped'
    state.stoppedAt = new Date().toISOString()
    save()
    fs.rmSync(slotDir, { recursive: true, force: true })
    process.exit(code)
  }
  process.on('SIGTERM', () => stop(0))
  process.on('SIGINT', () => stop(0))
  const start = (name, cmd, args, options) => {
    const log = fs.openSync(path.join(dir, `${name}.log`), 'a')
    const c = spawn(cmd, args, {
      ...options,
      stdio: ['ignore', log, log],
      detached: true,
    })
    children.push(c)
    owner.children.push(c.pid)
    saveOwner()
    c.on('exit', (code, signal) => {
      writeJson(path.join(dir, `${name}-exit.json`), {
        code,
        signal,
        at: new Date().toISOString(),
        uptimeMs: Date.now() - c.startedAt,
      })
      if (!stopping && name !== 'app') {
        state.status = 'failed'
        state.error = `${name} exited (${code ?? signal})`
        save()
        stop(1)
      }
    })
    c.startedAt = Date.now()
    return c
  }
  try {
    // --build <key> picks a recorded build (the fault runner's faulted trees); else the ref's own build
    const build = opts.buildKey
      ? readJson(path.join(ARTIFACT_DIR, 'images.json'), { builds: {} }).builds[
          opts.buildKey
        ] || null
      : findBuild({ ref: opts.ref, variant: opts.variant, mode: 'host' })
    if (!build)
      throw new Error(
        `no host build for ${opts.ref} variant ${
          opts.variant
        }: run \`npm run build:parity -- --mode host${
          opts.variant !== 'default' ? ` --variant ${opts.variant}` : ''
        }\` first`
      )
    state.build = {
      key: build.key,
      commit: build.commit,
      buildId: build.buildId,
      variant: build.variant,
      dir: build.dir,
      node: build.node,
      evidence: false,
    }
    // proxy route table (+ overlay)
    const gen = spawnSync(
      process.execPath,
      [
        path.join(REPO, 'e2e', 'proxy', 'generate.mjs'),
        '--out',
        path.join(dir, 'proxy'),
        '--app',
        `127.0.0.1:${ports.app}`,
        '--listen-gateway',
        String(ports.gateway),
        '--listen-allow',
        String(ports.allow),
        ...(opts.overlay ? ['--overlay', opts.overlay] : []),
      ],
      { encoding: 'utf8' }
    )
    if (gen.status !== 0)
      throw new Error(`proxy generator failed: ${gen.stderr}`)
    const table = readJson(path.join(dir, 'proxy', 'routes.json'))
    state.proxy = {
      overlay: opts.overlay || null,
      routeTableSha256: table.sha256,
      impl: 'node',
    }
    // stub
    start(
      'stub',
      process.execPath,
      [
        path.join(REPO, 'test', 'ssr', 'stub.mjs'),
        '--run-dir',
        dir,
        '--host',
        '127.0.0.1',
        '--http-port',
        String(ports.stubHttp),
        '--https-port',
        String(ports.stubHttps),
        '--control-port',
        String(ports.stubControl),
        '--link-origin',
        `http://127.0.0.1:${ports.gateway}`,
      ],
      { cwd: REPO }
    )
    await waitFor(
      async () =>
        (await httpGet(`http://127.0.0.1:${ports.stubControl}/health`)) === 200,
      15000,
      'stub'
    )
    // app: next start of the host build on the runtime Node
    const env = appEnv({
      ports,
      run,
      build,
      variant: opts.variant,
      extra: opts.appEnv,
      mounts: opts.mounts,
      mode: 'host',
    })
    state.appEnv = env
    save()
    const bin = runtimeNode()
    start(
      'app',
      bin,
      [
        path.join(build.dir, 'node_modules', 'next', 'dist', 'bin', 'next'),
        'start',
        '-p',
        String(ports.app),
        '-H',
        '127.0.0.1',
      ],
      {
        cwd: build.dir,
        env: {
          PATH: `${path.dirname(bin)}:/usr/bin:/bin`,
          HOME: process.env.HOME,
          TZ: 'UTC',
          ...env,
        },
      }
    )
    // proxy
    start(
      'proxy',
      process.execPath,
      [
        path.join(REPO, 'e2e', 'proxy', 'node-proxy.mjs'),
        '--table',
        path.join(dir, 'proxy', 'routes.json'),
        '--app',
        `http://127.0.0.1:${ports.app}`,
        '--gateway-port',
        String(ports.gateway),
        '--allow-port',
        String(ports.allow),
        '--log',
        path.join(dir, 'proxy-access.log'),
      ],
      { cwd: REPO }
    )
    if (!opts.noHealthWait)
      await waitFor(
        async () =>
          (await httpGet(`http://127.0.0.1:${ports.app}/api/healthz/`)) === 200,
        90000,
        'app /api/healthz/'
      )
    await waitFor(
      async () =>
        (await httpGet(`http://127.0.0.1:${ports.gateway}/search/`, 30000)) > 0,
      30000,
      'gateway proxy'
    )
    Object.assign(state, {
      status: 'ready',
      readyAt: new Date().toISOString(),
      baseURL: `http://127.0.0.1:${ports.gateway}`,
      allowURL: `http://127.0.0.1:${ports.allow}`,
      appURL: `http://127.0.0.1:${ports.app}`,
      stubURL: `http://127.0.0.1:${ports.stubHttp}`,
      controlURL: `http://127.0.0.1:${ports.stubControl}`,
      runDir: dir,
      pids: {
        supervisor: process.pid,
        ...Object.fromEntries(
          children.map((c, i) => [['stub', 'app', 'proxy'][i], c.pid])
        ),
      },
    })
    save()
  } catch (e) {
    state.status = 'failed'
    state.error = e.message
    save()
    await stop(1)
  }
  setInterval(() => {}, 1 << 30)
}

// ---------- commands ----------
async function up(argv, opt) {
  const run = validId(opt('--run'))
  if (slotOf(run)) {
    const o = slotOf(run).owner
    if (alive(o.pid))
      throw new Error(
        `run ${run} is already up (supervisor ${o.pid}); \`npm run e2e:down -- --run ${run}\` first`
      )
  }
  const mode = opt('--mode', process.env.E2E_MODE || 'host')
  // Docker is out of scope (owner rule of 2026-10-22): the docker path refuses whatever the environment says
  if (mode === 'docker')
    throw new Error(
      'docker mode is disabled: the stacks are host stacks only (Docker is out of scope)'
    )
  const { slot, ports } = await allocate(run)
  const dir = runDir(run)
  fs.rmSync(dir, { recursive: true, force: true })
  fs.mkdirSync(dir, { recursive: true })
  const args = [
    'supervise',
    '--run',
    run,
    '--slot',
    String(slot),
    '--mode',
    mode,
    '--ref',
    opt('--ref', 'HEAD'),
    '--variant',
    opt('--variant', 'default'),
  ]
  if (opt('--overlay')) args.push('--overlay', opt('--overlay'))
  if (opt('--build')) args.push('--build', opt('--build'))
  for (const v of parseList(argv, '--app-env')) args.push('--app-env', v)
  for (const v of parseList(argv, '--mount')) args.push('--mount', v)
  if (argv.includes('--no-health-wait')) args.push('--no-health-wait')
  const log = fs.openSync(path.join(dir, 'supervisor.log'), 'a')
  const child = spawn(process.execPath, [SELF, ...args], {
    detached: true,
    stdio: ['ignore', log, log],
    env: { ...process.env, ARTIFACT_DIR },
  })
  child.unref()
  const until = Date.now() + 240000
  while (Date.now() < until) {
    const s = readJson(envFile(run))
    if (s && s.status === 'ready') {
      console.log(
        `run ${run} ready (${s.mode}${
          s.evidence ? '' : ', local mode: host processes'
        }): base ${s.baseURL}, allow-all ${s.allowURL}, app ${
          s.appURL
        }, control ${s.controlURL}; E2E_PORT_BASE=${s.portBase}; env ${envFile(
          run
        )}`
      )
      return 0
    }
    if (s && (s.status === 'failed' || s.status === 'stopped')) {
      console.error(`run ${run} failed: ${s.error}`)
      return 1
    }
    if (!alive(child.pid) && !(s && s.status === 'ready')) {
      await sleep(500)
      const s2 = readJson(envFile(run))
      console.error(
        `run ${run} supervisor exited: ${s2 ? s2.error : 'see supervisor.log'}`
      )
      return 1
    }
    await sleep(300)
  }
  console.error(`run ${run}: not ready after 240 s; see ${dir}`)
  return 1
}

async function down(argv, opt) {
  const run = validId(opt('--run'))
  const s = slotOf(run)
  if (!s) {
    console.log(`run ${run}: not up`)
    return 0
  }
  if (alive(s.owner.pid)) process.kill(s.owner.pid, 'SIGTERM')
  const until = Date.now() + 30000
  while (Date.now() < until && fs.existsSync(path.join(SLOTS, String(s.slot))))
    await sleep(200)
  if (fs.existsSync(path.join(SLOTS, String(s.slot)))) {
    killChildren(s.owner)
    if (alive(s.owner.pid)) process.kill(s.owner.pid, 'SIGKILL')
    fs.rmSync(path.join(SLOTS, String(s.slot)), {
      recursive: true,
      force: true,
    })
  }
  console.log(`run ${run}: down`)
  return 0
}

function status(argv, opt) {
  const rows = []
  if (fs.existsSync(SLOTS))
    for (const s of fs.readdirSync(SLOTS).sort((a, b) => a - b)) {
      const o = readJson(path.join(SLOTS, s, 'owner.json')) || {}
      if (opt('--run') && o.run !== opt('--run')) continue
      const e = readJson(envFile(o.run)) || {}
      rows.push({
        slot: Number(s),
        run: o.run,
        mode: o.mode,
        supervisor: o.pid,
        alive: alive(o.pid),
        status: e.status,
        portBase: PORT_BASE + PORT_STRIDE * Number(s),
        baseURL: e.baseURL,
      })
    }
  console.log(JSON.stringify(rows, null, 1))
  return 0
}

function gc() {
  let n = 0
  if (fs.existsSync(SLOTS))
    for (const s of fs.readdirSync(SLOTS))
      if (reclaimIfStale(path.join(SLOTS, s))) n++
  console.log(`gc: reclaimed ${n}`)
  return 0
}

async function test(argv, opt) {
  const run = validId(opt('--run'))
  const s = readJson(envFile(run))
  if (!s || s.status !== 'ready') {
    console.error(
      `run ${run} is not up: \`npm run e2e:up -- --run ${run}\` first (it needs an existing build: npm run build:parity)`
    )
    return 1
  }
  const record = argv.includes('--record')
  if (record) {
    let golden = null
    try {
      golden = execFileSync(
        'git',
        ['-C', REPO, 'rev-parse', 'p2-local/golden^{commit}'],
        { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }
      ).trim()
    } catch {
      golden = null
    }
    const commit = (s.build || s.image || {}).commit
    if (commit !== golden && !argv.includes('--provisional')) {
      console.error(
        `e2e:record runs on the golden build only (p2-local/golden = ${
          golden || 'absent'
        }, this run = ${commit}); pass --provisional for a provisional 2.3 capture`
      )
      return 1
    }
  }
  const skip = new Set(['--run', '--mode'])
  const pw = []
  for (let i = 0; i < argv.length; i++) {
    if (skip.has(argv[i])) {
      i++
      continue
    }
    if (['--visual', '--record', '--provisional'].includes(argv[i])) continue
    pw.push(argv[i])
  }
  if (argv.includes('--visual') && !pw.includes('--project'))
    pw.push('--project', 'visual')
  // record mode writes the baselines of the projects that compare them (visual, chromium), never of a
  // separate project whose snapshot names would differ
  if (record) pw.push('--update-snapshots')
  const env = {
    ...process.env,
    ARTIFACT_DIR,
    E2E_RUN: run,
    ...(record
      ? {
          RECORD: '1',
          ...(argv.includes('--provisional')
            ? { RECORD_PROVISIONAL: '1' }
            : {}),
        }
      : {}),
  }
  const cli = path.join(
    REPO,
    'e2e',
    'node_modules',
    '@playwright',
    'test',
    'cli.js'
  )
  const r = spawnSync(
    process.execPath,
    [cli, 'test', '--config', path.join(REPO, 'playwright.config.mjs'), ...pw],
    { stdio: 'inherit', cwd: REPO, env }
  )
  return r.status ?? 1
}

async function main(argv) {
  const cmd = argv[0]
  const rest = argv.slice(1)
  const opt = (n, d) => {
    const i = rest.indexOf(n)
    return i >= 0 ? rest[i + 1] : d
  }
  if (cmd === 'supervise') {
    const opts = {
      run: opt('--run'),
      slot: Number(opt('--slot')),
      ports: portsFor(Number(opt('--slot'))),
      ref: opt('--ref', 'HEAD'),
      variant: opt('--variant', 'default'),
      overlay: opt('--overlay', null),
      buildKey: opt('--build', null),
      appEnv: parseList(rest, '--app-env'),
      mounts: parseList(rest, '--mount'),
      noHealthWait: rest.includes('--no-health-wait'),
    }
    if (opt('--mode', 'host') !== 'host')
      throw new Error(
        'docker mode is disabled: the stacks are host stacks only (Docker is out of scope)'
      )
    return superviseHost(opts)
  }
  const cmds = { up, down, status, gc, test }
  if (!cmds[cmd]) {
    console.error(
      'usage: e2e-stack.mjs up|down|status|gc|test --run <id> ... (see header)'
    )
    return 2
  }
  return cmds[cmd](rest, opt)
}

main(process.argv.slice(2)).then(
  (code) => {
    if (typeof code === 'number') process.exit(code)
  },
  (e) => {
    console.error(e.message)
    process.exit(1)
  }
)
