#!/usr/bin/env node
// T-728 c4 / 40 §4 item 1: the React-17 development hydration inventory. React 17 production repairs
// hydration mismatches silently and `next dev` never server-renders (pages/_app.jsx NextApp wrapper, Q-052),
// so this tool:
//   1. copies HEAD with `git archive` into $ARTIFACT_DIR/dev-inventory/tree (never a worktree; the repository
//      is never touched), with node_modules and public/ cloned from the run's parity build (the Dockerfile
//      copies of public/ included);
//   2. starts `next dev` on Node 18.20.8 (no --openssl-legacy-provider from Next 12, CS-N11-5) and the
//      prod runtime env of the run, SSR traffic sent to the run's stub (test/ssr/host-redirect.cjs), and checks
//      Q-052 c1: without the patch the dev server answers an empty #__next;
//   3. applies test/hydration/dev-ssr.patch (NextApp = App) with `git apply` in the copy, restarts next dev,
//      puts a gateway-faithful proxy in front of it (e2e/proxy/node-proxy.mjs, the run's route table), and
//      sweeps routes x fixtures x TZ x cookie state (e2e/lib/P0-12/routes.mjs T728_ROUTES) in Chromium with the
//      journey guard's routing (fixture resolver for browser calls);
//   4. records every development warning (console warning/error) per load, maps each to a Q row of 30 with
//      e2e/lib/P0-12/dev-inventory-map.mjs, and writes $ARTIFACT_DIR/hydration-dev-r17.json.
// Ports: the run's slot range (E2E_PORT_BASE + 10..12), never fixed ones. Every process it starts is stopped
// before it exits.
//
// Usage: node e2e/lib/P0-12/dev-inventory.mjs --run <e2e run id> [--out <file>] [--concurrency 3] [--keep]
//        [--only <route id,...>] (a partial sweep is written but fails T-728 c4)
import fs from 'node:fs'
import path from 'node:path'
import net from 'node:net'
import http from 'node:http'
import { spawn, execFileSync } from 'node:child_process'
import { createRequire } from 'node:module'
import {
  REPO,
  appTreeHash,
  patchHash,
  PATCH,
  HYDRATION_WARNING,
  mapWarning,
  INVENTORY_SCHEMA,
} from './dev-inventory-check.mjs'
import { T728_ROUTES } from './routes.mjs'
import { TIME_ZONES, ssrNextMarkup } from './page.mjs'
import { moInitScript } from './dom.mjs'
import {
  coverBrowserGaps,
  coverSsrGaps,
  probeBrowserGaps,
} from './harness-gaps.mjs'

const require = createRequire(path.join(REPO, 'e2e', 'package.json'))
const { chromium } = require('@playwright/test')

const argv = process.argv.slice(2)
const opt = (n, d) => {
  const i = argv.indexOf(n)
  return i >= 0 ? argv[i + 1] : d
}
const RUN = opt('--run')
if (!RUN) {
  console.error(
    'usage: dev-inventory.mjs --run <e2e run id> [--out file] [--concurrency n] [--keep] [--only ids]'
  )
  process.exit(2)
}
const { guardContext } = await import('../../fixtures/guard.mjs')
const { COOKIE_STATES, LOCALE } = await import('../../fixtures/constants.mjs')
const { createResolver } = await import('../../../test/fixtures/resolve.mjs')
const { node18 } = await import('../../../scripts/build-parity.mjs')

const ARTIFACT_DIR = process.env.ARTIFACT_DIR
if (!ARTIFACT_DIR) throw new Error('ARTIFACT_DIR is not set')
const OUT = opt('--out', path.join(ARTIFACT_DIR, 'hydration-dev-r17.json'))
const WORK = path.join(ARTIFACT_DIR, 'dev-inventory')
const TREE = path.join(WORK, 'tree')
const CONCURRENCY = Number(opt('--concurrency', 3))
const ONLY = opt('--only', null)
const env = JSON.parse(
  fs.readFileSync(path.join(ARTIFACT_DIR, 'runs', RUN, 'env.json'), 'utf8')
)
if (env.status !== 'ready') throw new Error(`run ${RUN} is not up`)

const children = []
const stopAll = async () => {
  for (const c of children.splice(0))
    if (c.exitCode == null && c.signalCode == null) {
      c.kill('SIGTERM')
      await new Promise((r) => {
        const t = setTimeout(() => {
          try {
            c.kill('SIGKILL')
          } catch {
            // already gone
          }
          r()
        }, 5000)
        c.once('exit', () => {
          clearTimeout(t)
          r()
        })
      })
    }
}
// a late failure inside a closed context (a route callback still in flight) must not end the sweep with the
// dev server and proxy left running
const lateErrors = []
process.on('unhandledRejection', (e) => {
  lateErrors.push(String((e && e.message) || e).split('\n')[0])
})
for (const sig of ['SIGINT', 'SIGTERM'])
  process.on(sig, async () => {
    await stopAll()
    process.exit(130)
  })

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const portFree = (port) =>
  new Promise((resolve) => {
    const s = net.createServer()
    s.once('error', () => resolve(false))
    s.listen(port, '127.0.0.1', () => s.close(() => resolve(true)))
  })
const get = (url, timeoutMs = 120000) =>
  new Promise((resolve) => {
    const req = http.get(url, (res) => {
      let b = ''
      res.setEncoding('utf8')
      res.on('data', (d) => (b += d))
      res.on('end', () => resolve({ status: res.statusCode, body: b }))
    })
    req.setTimeout(timeoutMs, () => req.destroy(new Error('timeout')))
    req.on('error', () => resolve({ status: 0, body: '' }))
  })
async function waitFor(fn, ms, what) {
  const until = Date.now() + ms
  for (;;) {
    if (await fn()) return
    if (Date.now() > until) throw new Error(`timed out waiting for ${what}`)
    await sleep(1000)
  }
}

const PORTS = {
  dev: env.portBase + 10,
  gateway: env.portBase + 11,
  allow: env.portBase + 12,
}
for (const p of Object.values(PORTS))
  if (!(await portFree(p)))
    throw new Error(`port ${p} of slot ${env.slot} is busy`)
const devEnv = {
  ...env,
  baseURL: `http://127.0.0.1:${PORTS.gateway}`,
  allowURL: `http://127.0.0.1:${PORTS.allow}`,
  appURL: `http://127.0.0.1:${PORTS.dev}`,
}

// ---------- 1. the copy ----------
fs.rmSync(WORK, { recursive: true, force: true })
fs.mkdirSync(TREE, { recursive: true })
const head = execFileSync('git', ['-C', REPO, 'rev-parse', 'HEAD'], {
  encoding: 'utf8',
}).trim()
const tar = execFileSync(
  'git',
  ['-C', REPO, 'archive', '--format=tar', 'HEAD'],
  { maxBuffer: 1024 * 1024 * 1024 }
)
execFileSync('tar', ['-x', '-C', TREE], {
  input: tar,
  maxBuffer: 1024 * 1024 * 1024,
})
// node_modules and the built public/ files of the parity build (APFS clones; the build dir is read only)
execFileSync('cp', [
  '-cR',
  path.join(env.build.dir, 'node_modules'),
  path.join(TREE, 'node_modules'),
])
execFileSync('cp', [
  '-cR',
  `${path.join(env.build.dir, 'public')}/.`,
  path.join(TREE, 'public'),
])
const versions = {
  next: JSON.parse(
    fs.readFileSync(
      path.join(TREE, 'node_modules', 'next', 'package.json'),
      'utf8'
    )
  ).version,
  react: JSON.parse(
    fs.readFileSync(
      path.join(TREE, 'node_modules', 'react', 'package.json'),
      'utf8'
    )
  ).version,
}

// ---------- dev server and proxy ----------
const NODE18 = node18()
const nodeOptions = `--max-old-space-size=4096 --require ${path.join(
  REPO,
  'test',
  'ssr',
  'host-redirect.cjs'
)}`
const serverEnv = () => {
  const e = { ...env.appEnv }
  delete e.NODE_ENV // next dev sets development
  return {
    PATH: `${path.dirname(NODE18)}:/usr/bin:/bin`,
    HOME: process.env.HOME,
    TZ: 'UTC',
    ...e,
    NODE_OPTIONS: nodeOptions,
    NEXT_TELEMETRY_DISABLED: '1',
  }
}
const logFile = path.join(WORK, 'next-dev.log')
async function startDev(label) {
  const out = fs.openSync(logFile, 'a')
  fs.writeSync(out, `\n===== ${label} ${new Date().toISOString()}\n`)
  const c = spawn(
    NODE18,
    [
      path.join(TREE, 'node_modules', 'next', 'dist', 'bin', 'next'),
      'dev',
      '-p',
      String(PORTS.dev),
      '-H',
      '127.0.0.1',
    ],
    {
      cwd: TREE,
      env: serverEnv(),
      stdio: ['ignore', out, out],
    }
  )
  children.push(c)
  await waitFor(
    async () =>
      (await get(`${devEnv.appURL}/api/healthz/`, 300000)).status === 200,
    300000,
    'next dev /api/healthz/'
  )
  return c
}
async function stopChild(c) {
  const i = children.indexOf(c)
  if (i >= 0) children.splice(i, 1)
  if (c.exitCode != null || c.signalCode != null) return
  c.kill('SIGTERM')
  await new Promise((r) => c.once('exit', r))
}
// the run's route table, with a 300 s backend timeout: next dev compiles a page on its first request (and
// again after on-demand disposal), which can outlast the gateway's 30 s on a loaded machine
async function startProxy() {
  const table = JSON.parse(
    fs.readFileSync(path.join(env.runDir, 'proxy', 'routes.json'), 'utf8')
  )
  for (const e of table.entries) {
    e.backendRequestTimeout = 300
    e.requestTimeout = 305
  }
  const tableFile = path.join(WORK, 'routes.dev.json')
  fs.writeFileSync(tableFile, JSON.stringify(table, null, 1))
  // on Node 18: its default connection pool does not keep upstream sockets (no keep-alive race, P0-10-3)
  const c = spawn(
    NODE18,
    [
      path.join(REPO, 'e2e', 'proxy', 'node-proxy.mjs'),
      '--table',
      tableFile,
      '--app',
      devEnv.appURL,
      '--gateway-port',
      String(PORTS.gateway),
      '--allow-port',
      String(PORTS.allow),
      '--log',
      path.join(WORK, 'proxy-access.log'),
    ],
    { cwd: REPO, stdio: ['ignore', 'ignore', 'inherit'] }
  )
  children.push(c)
  await waitFor(
    async () => (await get(`${devEnv.baseURL}/search/`, 60000)).status > 0,
    60000,
    'dev gateway proxy'
  )
}

const urlOf = (route) =>
  `${route.origin === 'allow' ? devEnv.allowURL : devEnv.baseURL}${route.path}`
const routes = ONLY
  ? T728_ROUTES.filter((r) => ONLY.split(',').includes(r.id))
  : T728_ROUTES
const resolver = createResolver({ linkOrigin: devEnv.baseURL })
const cleanupSsr = await coverSsrGaps(env, resolver)

let result
let browserVersion = null
try {
  // ---------- 2. Q-052 c1: unpatched dev SSR ----------
  let dev = await startDev('unpatched')
  await startProxy()
  const unpatched = []
  for (const id of [
    'search-climate',
    'works-1001',
    'outputs-2001',
    'provider-86',
  ]) {
    const route = T728_ROUTES.find((r) => r.id === id)
    const res = await get(urlOf(route), 310000)
    const markup = ssrNextMarkup(res.body)
    unpatched.push({
      route: id,
      status: res.status,
      ssrNextLength: markup == null ? -1 : markup.length,
    })
  }
  await stopChild(dev)

  // ---------- 3. patched dev SSR + sweep ----------
  execFileSync('git', ['apply', '--whitespace=nowarn', PATCH], { cwd: TREE })
  dev = await startDev('patched (test/hydration/dev-ssr.patch)')
  const gaps = await probeBrowserGaps(devEnv)
  const browser = await chromium.launch()
  browserVersion = `chromium ${browser.version()}`
  const loads = []
  const jobs = []
  for (const route of routes)
    for (const tz of TIME_ZONES)
      for (const cookieState of COOKIE_STATES)
        jobs.push({ route, tz, cookieState })
  // compile every page once before the sweep (first dev requests compile on demand)
  for (const route of routes) await get(urlOf(route), 310000)

  const loadOnce = async ({ route, tz, cookieState }) => {
    const log = {
      requests: [],
      console: [],
      consoleErrors: [],
      pageErrors: [],
      windowErrors: [],
      csp: [],
      badResponses: [],
      unexpected: [],
      unmatched: [],
      aborted: {},
      sentry: [],
      corsAdded: [],
      guardAbortConsole: [],
      preflights: 0,
      screenshots: 0,
      ssrProblems: [],
    }
    const ctx = await browser.newContext({
      baseURL: devEnv.baseURL,
      timezoneId: tz,
      locale: LOCALE,
    })
    await guardContext(ctx, {
      env: devEnv,
      resolver,
      log,
      cookieState,
      baseURL: devEnv.baseURL,
    })
    await coverBrowserGaps(ctx, { p2Env: devEnv, resolver, gaps })
    await ctx.addInitScript(moInitScript)
    // React 17 development warnings are printf-style (console.error('Warning: ...%s', ...args)); format them
    // in the page so the recorded text is the message a developer reads (the browser console of next dev)
    await ctx.addInitScript(() => {
      for (const k of ['error', 'warn']) {
        const orig = console[k]
        console[k] = function formatted(...a) {
          if (typeof a[0] === 'string' && /%[sdifoOc]/.test(a[0])) {
            let i = 1
            const s = a[0].replace(/%[sdifoOc]/g, (m) =>
              i < a.length ? (m === '%c' ? (i++, '') : String(a[i++])) : m
            )
            return orig.apply(this, [s, ...a.slice(i)])
          }
          return orig.apply(this, a)
        }
      }
    })
    const page = await ctx.newPage()
    const inflight = new Set()
    const longLived = (r) => /\/_next\/webpack-hmr/.test(r.url())
    page.on('request', (r) => !longLived(r) && inflight.add(r))
    page.on('requestfinished', (r) => inflight.delete(r))
    page.on('requestfailed', (r) => inflight.delete(r))
    const entry = { route: route.id, fixture: route.fixture, tz, cookieState }
    try {
      const res = await page.goto(urlOf(route), { timeout: 180000 })
      entry.status = res.status()
      const html = await res.text()
      const markup = ssrNextMarkup(html)
      entry.ssrNextLength = markup == null ? -1 : markup.length
      // what Next rendered (an error page answers with page /_error and the error in __NEXT_DATA__)
      const nd =
        /<script id="__NEXT_DATA__" type="application\/json">([\s\S]*?)<\/script>/.exec(
          html
        )
      if (nd) {
        const data = JSON.parse(nd[1])
        entry.page = data.page
        if (data.err)
          entry.nextDataErr = `${data.err.name}: ${
            String(data.err.message).split('\n')[0]
          }`
      }
      await page
        .waitForFunction(
          () => performance.getEntriesByName('Next.js-hydration').length > 0,
          null,
          { timeout: 120000 }
        )
        .then(
          () => (entry.hydrated = true),
          () => (entry.hydrated = false)
        )
      const until = Date.now() + 120000
      for (;;) {
        // the development client may reload the page itself (Next's error overlay after a props error): the
        // reload is counted and the wait goes on in the new document
        const quiet = await page
          .evaluate(
            () =>
              performance.now() -
              (window.__p012 ? window.__p012.lastMutationAt : 0)
          )
          .catch(async (e) => {
            if (!/Execution context was destroyed/.test(String(e.message)))
              throw e
            entry.reloads = (entry.reloads || 0) + 1
            await page.waitForLoadState('load')
            return 0
          })
        if (inflight.size === 0 && quiet >= 1000) break
        if (Date.now() > until) {
          entry.settleTimeout = true
          break
        }
        await sleep(200)
      }
    } catch (e) {
      entry.error = String(e.message).split('\n')[0]
    }
    const own = new Set(log.guardAbortConsole)
    // harness artefact: SSR links point at the stack's own proxy (the stub's resolver rewrites core.ac.uk
    // links to it, 40 §2.4), which is another origin than the dev proxy, so the dev CSP blocks those images
    const stackImage = new RegExp(
      `^Loading the image '${env.baseURL.replace(/[.]/g, '\\.')}/image/`
    )
    entry.harnessArtefacts = 0
    entry.warnings = log.console
      .filter(
        (c) => !own.has(c) && (c.type === 'warning' || c.type === 'error')
      )
      .filter((c) => {
        if (stackImage.test(String(c.text))) {
          entry.harnessArtefacts += 1
          return false
        }
        return true
      })
      .map((c) => {
        const text = String(c.text)
        const first = text.split('\n')[0]
        // React 17 development component stack: "    at Name (webpack-internal:///...)" / "    in Name"
        const components = [
          ...text.matchAll(/\n\s+(?:at|in) ([A-Za-z_$][\w$.]*)/g),
        ]
          .map((m) => m[1])
          .slice(0, 12)
          .join(' < ')
        const kind = HYDRATION_WARNING.test(first)
          ? 'hydration'
          : /^Warning: /.test(first)
          ? 'react'
          : /^\[MobX\]/.test(first)
          ? 'mobx'
          : 'console'
        const w = { type: c.type, kind, text: first, components }
        // the resource of a browser "Failed to load resource" line (path only: the origin is a port slot)
        if (
          /^Failed to load resource: /.test(first) &&
          c.location &&
          c.location.url
        )
          try {
            w.resource = new URL(c.location.url).pathname
          } catch {
            w.resource = String(c.location.url)
          }
        return w
      })
    entry.pageErrors = log.pageErrors.map(
      (e) => String(e.message).split('\n')[0]
    )
    entry.badResponses = log.badResponses
      .slice(0, 5)
      .map((b) => `${b.status} ${b.url}`)
    await ctx.close()
    return entry
  }
  // a load the dev gateway proxy answers 502 (its upstream socket reset under machine load, P0-12-9) says
  // nothing about the app: it is loaded again, at most twice, and the attempts are recorded
  const runJob = async (job) => {
    const attempts = []
    for (;;) {
      const entry = await loadOnce(job)
      if (entry.status !== 502 || attempts.length >= 2) {
        if (attempts.length) entry.attempts = [...attempts, entry.status]
        loads.push(entry)
        return
      }
      attempts.push(entry.status)
    }
  }
  let next = 0
  await Promise.all(
    Array.from({ length: CONCURRENCY }, async () => {
      while (next < jobs.length) {
        const job = jobs[next++]
        await runJob(job)
      }
    })
  )
  await browser.close()

  // ---------- 4. aggregate and map ----------
  const sig = (w) =>
    `${w.kind} | ${w.text.replace(/\s+/g, ' ').slice(0, 300)}${
      w.resource ? ` @ ${w.resource}` : ''
    } | ${w.components.split(' < ').slice(0, 4).join(' < ')}`
  // one aggregate per (signature, rule): a rule scoped to routes is decided per load
  const byKey = new Map()
  for (const l of loads)
    for (const w of l.warnings) {
      const { rule } = mapWarning({ ...w, route: l.route })
      const k = `${sig(w)} | ${rule}`
      if (!byKey.has(k))
        byKey.set(k, {
          signature: sig(w),
          kind: w.kind,
          type: w.type,
          text: w.text,
          components: w.components,
          ...(w.resource ? { resource: w.resource } : {}),
          route: l.route,
          count: 0,
          loads: [],
        })
      const agg = byKey.get(k)
      agg.count += 1
      agg.loads.push(`${l.route} ${l.tz} ${l.cookieState}`)
    }
  const warnings = [...byKey.values()]
    .sort((a, b) => (a.signature < b.signature ? -1 : 1))
    .map((w) => ({ ...w, ...mapWarning(w) }))
  loads.sort((a, b) =>
    `${a.route}|${a.tz}|${a.cookieState}` <
    `${b.route}|${b.tz}|${b.cookieState}`
      ? -1
      : 1
  )
  result = {
    schema: INVENTORY_SCHEMA,
    generatedAt: new Date().toISOString(),
    tool: 'e2e/lib/P0-12/dev-inventory.mjs',
    source: {
      commit: head,
      appTree: appTreeHash(),
      patch: 'test/hydration/dev-ssr.patch',
      patchSha256: patchHash(),
      copy: 'git archive HEAD (no worktree)',
    },
    runtime: {
      node: execFileSync(NODE18, ['--version'], { encoding: 'utf8' }).trim(),
      nodeOptions,
      next: versions.next,
      react: versions.react,
      browser: browserVersion,
      parityBuild: env.build.key,
      stackRun: RUN,
    },
    matrix: {
      routes: routes.map((r) => r.id),
      tz: TIME_ZONES,
      cookieStates: COOKIE_STATES,
    },
    q052: { unpatched },
    lateErrors,
    summary: {
      loads: loads.length,
      warnings: warnings.length,
      hydrationWarnings: warnings.filter((w) => w.kind === 'hydration').length,
      mapped: warnings.filter((w) => w.q).length,
      issues: warnings
        .filter((w) => !w.q && w.issue)
        .map((w) => `${w.issue}: ${w.signature}`),
      unmapped: warnings
        .filter((w) => !w.q && !w.issue)
        .map((w) => w.signature),
    },
    warnings,
    loads,
  }
} finally {
  await stopAll()
  await cleanupSsr()
  if (!argv.includes('--keep'))
    fs.rmSync(TREE, { recursive: true, force: true })
}
fs.mkdirSync(path.dirname(OUT), { recursive: true })
fs.writeFileSync(OUT, `${JSON.stringify(result, null, 1)}\n`)
console.log(
  `hydration-dev-r17: ${result.summary.loads} loads, ${result.summary.warnings} warning signatures (${result.summary.hydrationWarnings} hydration), ${result.summary.unmapped.length} unmapped -> ${OUT}`
)
