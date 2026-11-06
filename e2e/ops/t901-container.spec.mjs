// T-901 (41 J, ops project; CI-5; R-014, R-015, R-017, R-027, R-035, R-036, R-060, R-061, R-063, R-066, R-082,
// R-091): the container contract of the parity image. `bash test/ops/t901.sh <image>` brings the stack of an
// image up in docker mode and runs this file against it. DEFERRED: docker mode always refuses (Docker is out of scope):
// there is no image and no Docker (owner notes §1). What this run does is the host-mode counterpart: the same nine
// clauses against the `next start` process of the parity build of the package's stack, with the clauses that
// only a container can answer (the image history, `--memory 768m`, the image size) answered by their host
// equivalents and said so in the annotations. Nothing here is evidence for the image (manifest §5.3).
//
//   c1  the tree is `git archive` of a commit, installed by `npm ci` only, built from the single Dockerfile
//   c2  the image ENV: BUILD_TARGET=azure, NODE_ENV=production, APP_ENV (the Dockerfile's ARG defaults and
//       ENV lines, the build's values, what the page data shows; no credential in the ENV). The recipe is
//       today's: the registry token is an ARG without a default (R-066); moving it to a build secret (CS-W0-8)
//       is a deploy-time item for the owner, so the ARG is pinned as it is
//   c3  the prod deployment env of kube/prod/deployment.yaml reaches the app (NODE_OPTIONS heap flag,
//       UV_THREADPOOL_SIZE, Internal_API_HOST, the secret); the memory limit is 768Mi (`--memory 768m` of a
//       container); the V8 heap limit the flag produced is observed in a running app
//   c4  /api/healthz/ and the six routes of the probe list answer through the proxy
//   c5  the size is recorded (and positive)
//   c6  no "patching" and no "wasm" line in the install, build or app log (matters from Next 12)
//   c7  SIGTERM under 20 requests per second: (a) the prod sequence (traffic drained by the preStop sleep, then
//       SIGTERM): nothing is lost, the app exits 0 inside terminationGracePeriodSeconds minus the preStop sleep;
//       (b) SIGTERM with requests in flight: Next 10.2.3's bin/next answers the signal with process.exit(0), so
//       the requests in flight when the app goes away are cut (the proxy reports 502; issue P0-16-3), as on
//       12.3.7 and 13.5. From Next 14.2 next start answers them, then exits, as 41 says (VF-21); the test
//       asserts it (AD-234). The comparison of the exit time with B0 starts when B0 exists
//   c8  time to ready (process start to the first /api/healthz/) is recorded; bound: the startup probe budget
//   c9  keepAliveTimeout, headersTimeout (and requestTimeout, timeout) are recorded: the runtime Node 24's defaults
// Records go to $ARTIFACT_DIR/t901/ (and T901_RECORD); test/baseline/t901.json, when it exists (B0, 2.5), is the
// reference of the comparisons in c7 and c8.
import fs from 'node:fs'
import path from 'node:path'
import { test as base, expect, stubControl } from '../fixtures/guard.mjs'
import { p016Fixtures } from '../lib/P0-16/fixtures.mjs'
import {
  ARTIFACT_DIR,
  REPO,
  appExitOf,
  appLogText,
  bytesOf,
  dockerFileSha,
  dockerImageInfo,
  dockerfileEnv,
  dockerfiles,
  gitShow,
  preloadEventsOf,
  prodDeployment,
  read,
  readLog,
  sha256,
  signalApp,
  sizeKb,
  startLoad,
  startStack,
  stopStack,
} from '../lib/P0-16/container.mjs'

// the SSR citation requests to doi.org of the works and outputs pages (harness gap I-40, see harness-gaps.mjs)
const test = base.extend(p016Fixtures)
// a start of the stack takes tens of seconds on a loaded machine (40 §5: timeouts, never retries)
test.describe.configure({ timeout: 300000 })

const RECORD = { at: new Date().toISOString() }
const baseline = (() => {
  try {
    return JSON.parse(read('test/baseline/t901.json'))
  } catch {
    return null
  }
})()
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const note = (type, description) =>
  test.info().annotations.push({ type, description: String(description) })

// the tests run in several workers, each with its own RECORD: the file is the merge of what they measured
const writeRecord = (file) => {
  let merged = {}
  try {
    merged = JSON.parse(fs.readFileSync(file, 'utf8'))
  } catch {
    // first writer
  }
  const tmp = `${file}.${process.pid}.tmp`
  fs.writeFileSync(
    tmp,
    `${JSON.stringify({ ...merged, ...RECORD }, null, 1)}\n`
  )
  fs.renameSync(tmp, file)
}
test.afterAll(() => {
  const dir = path.join(ARTIFACT_DIR, 't901')
  fs.mkdirSync(dir, { recursive: true })
  writeRecord(path.join(dir, `record-${process.env.E2E_RUN || 'default'}.json`))
  if (process.env.T901_RECORD) writeRecord(process.env.T901_RECORD)
})

const search = '/search/?q=climate'

// ---------------------------------------------------------------------------------------------------------
// the package's own stack
// ---------------------------------------------------------------------------------------------------------
test.describe('T-901 container contract', () => {
  test('T-901 c1 @P0 the tree is git archive of a commit, installed by npm ci only, from the one Dockerfile', async ({
    p2Env,
  }) => {
    if (p2Env.mode === 'docker') {
      const info = await dockerImageInfo(p2Env.image.imageId)
      const commit = info.labels['org.search.p2.commit']
      expect(commit).toMatch(/^[0-9a-f]{40}$/)
      expect(dockerfiles(commit)).toEqual(['Dockerfile'])
      // a token in the history would make the image credential-bearing (CS-W0-8, R-066)
      expect(info.history).not.toMatch(/_authToken|NPM_TOKEN/)
      expect(info.labels['p2-credential-bearing']).toBeUndefined()
      // `npm ci` only: the history shows the fallback line of today's recipe either way, a rewritten lock
      // shows that it ran
      expect(
        await dockerFileSha(p2Env.image.imageId, 'package-lock.json')
      ).toBe(sha256(gitShow(commit, 'package-lock.json')))
      return
    }
    const b = p2Env.build
    const rec = JSON.parse(
      fs.readFileSync(path.join(b.dir, 'build.json'), 'utf8')
    )
    expect(rec.mode).toBe('host')
    expect(rec.commit).toBe(b.commit)
    // `npm ci`: the lock is byte-identical to its commit's after the install (an `npm install` fallback rewrites it)
    expect(rec.install).toBe('ci')
    for (const f of [
      'package.json',
      'package-lock.json',
      'Dockerfile',
      'next.config.js',
      'design.config.js',
    ])
      expect(sha256(fs.readFileSync(path.join(b.dir, f))), f).toBe(
        sha256(gitShow(b.commit, f))
      )
    // git archive: no repository metadata, none of what .dockerignore leaves out of the image
    expect(fs.existsSync(path.join(b.dir, '.git'))).toBe(false)
    for (const d of ['test', 'e2e', 'scripts', 'docs', 'kube', '.github'])
      expect(fs.existsSync(path.join(b.dir, d)), d).toBe(false)
    // the single recipe (42 §2): one Dockerfile, no `Dockerfile.test`
    expect(dockerfiles(b.commit)).toEqual(['Dockerfile'])
    note(
      'recipe',
      'host build: git archive + npm ci + build:test; the Dockerfile is not run (Docker out of scope)'
    )
  })

  test('T-901 c2 @P0 the image ENV: BUILD_TARGET=azure, NODE_ENV=production, APP_ENV', async ({
    p2Env,
    request,
  }) => {
    const recipe = dockerfileEnv()
    // the recipe: the ARG defaults and the ENV lines that carry them into the image
    expect(recipe.args.BUILD_TARGET).toBe('azure')
    expect(recipe.args.NODE_ENV).toBe('production')
    expect(recipe.env.BUILD_TARGET).toBe('$BUILD_TARGET')
    expect(recipe.env.NODE_ENV).toBe('$NODE_ENV')
    expect(recipe.env.APP_ENV).toBe('$APP_ENV')
    // today's recipe: every build ARG and its default, the registry token among them (an ARG without a
    // default, written to .npmrc for the install and removed after it: R-066); a build secret instead
    // (CS-W0-8) is a deploy-time item for the owner
    expect(recipe.args).toEqual({
      BUILD_TARGET: 'azure',
      SENTRY_DSN: null,
      NODE_ENV: 'production',
      APP_ENV: 'development',
      NPM_TOKEN: null,
      GA_TRACKING_CODE: null,
      API_KEY: null,
      ICONS_PUBLIC_PATH: null,
    })
    // the token never reaches an ENV line: no credential in the image ENV
    expect(
      Object.keys(recipe.env).filter((k) => /TOKEN|PASSWORD|SECRET/i.test(k))
    ).toEqual([])

    if (p2Env.mode === 'docker') {
      const info = await dockerImageInfo(p2Env.image.imageId)
      expect(info.env.BUILD_TARGET).toBe('azure')
      expect(info.env.NODE_ENV).toBe('production')
      expect(info.env.APP_ENV).toBe('production') // the parity build arg (42 §2)
      expect(
        Object.keys(info.env).filter((k) => /TOKEN|PASSWORD|SECRET/i.test(k))
      ).toEqual([])
    } else {
      const rec = JSON.parse(
        fs.readFileSync(path.join(p2Env.build.dir, 'build.json'), 'utf8')
      )
      expect(rec.buildEnv.BUILD_TARGET).toBe('azure')
      expect(rec.buildEnv.NODE_ENV).toBe('production')
      expect(rec.buildEnv.APP_ENV).toBe('production')
      // what the running app has
      expect(p2Env.appEnv.BUILD_TARGET).toBe('azure')
      expect(p2Env.appEnv.NODE_ENV).toBe('production')
      expect(p2Env.appEnv.APP_ENV).toBe('production')
    }
    // the effect (R-082): the app's assets live under the routed prefix
    const html = await (await request.get(`${p2Env.baseURL}${search}`)).text()
    const data = JSON.parse(
      html.match(
        /<script id="__NEXT_DATA__" type="application\/json">(.*?)<\/script>/s
      )[1]
    )
    expect(data.assetPrefix).toBe('/static/search')
    expect(html).toContain('/static/search/_next/static/')
    expect(html).not.toMatch(/(?:src|href)="\/_next\/static\//)
  })

  test('T-901 c3 @P0 the prod deployment env reaches the app and the memory limit is 768 MiB', async ({
    p2Env,
  }) => {
    const dep = prodDeployment()
    expect(dep.env).toEqual({
      NODE_OPTIONS: '--max-old-space-size=1024',
      UV_THREADPOOL_SIZE: '32',
      Internal_API: 'http://core-frontend-api.core-frontend.svc.cluster.local',
      Internal_API_HOST: 'api.core.ac.uk',
    })
    expect(dep.secrets).toEqual(['core-frontend-search-secrets'])
    expect(dep.limits).toEqual({ cpu: '600m', memory: '768Mi' })
    expect(dep.port).toBe(8080)
    // `--memory 768m` of a container = the deployment's limit
    expect(bytesOf(dep.limits.memory)).toBe(bytesOf('768m'))

    // the stack runs the deployment's values (the stub replaces the in-cluster service; the test flags are
    // appended to NODE_OPTIONS, never replace it)
    const env = p2Env.appEnv
    expect(env.NODE_OPTIONS.startsWith(dep.env.NODE_OPTIONS)).toBe(true)
    expect(env.UV_THREADPOOL_SIZE).toBe(dep.env.UV_THREADPOOL_SIZE)
    expect(env.Internal_API_HOST).toBe(dep.env.Internal_API_HOST)
    expect(env.Internal_API).toBeTruthy()
    expect(env.API_KEY).toBeTruthy() // from the secret: absent = the app does not start (env.config.js:19-22)

    note(
      'memory',
      'host mode: the 768m cgroup limit is a container property (DEFERRED); the heap flag is checked below'
    )
  })

  test('T-901 c4 @P0 healthz and the six routes of the probe list answer through the proxy', async ({
    p2Env,
    request,
  }) => {
    // the probe path is in-cluster only (Q-005): the allow-all listener
    const health = await request.get(`${p2Env.allowURL}/api/healthz/`)
    expect(health.status()).toBe(200)
    expect(health.headers()['content-type']).toMatch(/application\/json/)
    expect(await health.json()).toEqual({ status: 'ok' })
    expect((await request.get(`${p2Env.baseURL}/api/healthz/`)).status()).toBe(
      404
    )

    const routes = [
      ['/search/?q=climate', '1,956,781 research outputs found'],
      ['/works/1001/', 'name="citation_title"'],
      ['/outputs/2001/', 'name="citation_title"'],
      ['/display/2001/', 'name="citation_title"'],
      ['/data-providers/', '<title>Data providers search</title>'],
      ['/data-providers/86/', 'Open Research Online (The Open University)'],
    ]
    for (const [route, marker] of routes) {
      const res = await request.get(`${p2Env.baseURL}${route}`)
      expect(res.status(), route).toBe(200)
      const text = (await res.text()).split('<!-- -->').join('')
      expect(text, route).toContain(marker)
    }
  })

  test('T-901 c5 @P0 the size is recorded', async ({ p2Env }) => {
    if (p2Env.mode === 'docker') {
      const info = await dockerImageInfo(p2Env.image.imageId)
      RECORD.imageBytes = info.size
      expect(RECORD.imageBytes).toBeGreaterThan(50 * 1024 * 1024)
    } else {
      const dir = p2Env.build.dir
      RECORD.sizeKb = {
        total: sizeKb(dir),
        node_modules: sizeKb(path.join(dir, 'node_modules')),
        next: sizeKb(path.join(dir, '.next')),
        public: sizeKb(path.join(dir, 'public')),
      }
      // the three parts account for most of the tree and are not empty
      for (const k of ['node_modules', 'next', 'public'])
        expect(RECORD.sizeKb[k]).toBeGreaterThan(0)
      expect(RECORD.sizeKb.total).toBeGreaterThan(RECORD.sizeKb.node_modules)
      note('size', JSON.stringify(RECORD.sizeKb))
    }
  })

  test('T-901 c6 @P0 no patching and no wasm line in the install, build or app log', async ({
    p2Env,
  }) => {
    const logs = {
      app: await appLogText(p2Env),
    }
    if (p2Env.mode === 'host')
      for (const f of ['install.log', 'build.log'])
        logs[f] = readLog(path.join(p2Env.build.dir, f))
    // the logs are not empty: the check reads something
    expect(logs.app.length).toBeGreaterThan(0)
    if (p2Env.mode === 'host')
      expect(logs['build.log']).toMatch(
        /Compiled|compiled|Creating an optimized/i
      )
    const hits = Object.entries(logs).flatMap(([name, text]) =>
      text
        .split('\n')
        .filter((l) => /patching|wasm/i.test(l))
        .map((l) => `${name}: ${l.slice(0, 160)}`)
    )
    expect(hits).toEqual([])
  })
})

// ---------------------------------------------------------------------------------------------------------
// stacks of their own: the app is observed from its first byte and finally stopped
// ---------------------------------------------------------------------------------------------------------
test.describe('T-901 process contract', () => {
  test.describe.configure({ mode: 'serial' })
  const preload = path.join(REPO, 'e2e', 'lib', 'P0-16', 'preload-server.cjs')
  const stackArgs = {
    appEnv: ['NODE_OPTIONS=--require=/p016/preload-server.cjs'],
    mounts: [`${preload}:/p016/preload-server.cjs`],
  }
  let a // the prod sequence, also the stack of c3 (heap), c8 and c9
  let b // SIGTERM with requests in flight
  let events

  test.beforeAll(async ({ p2Env }) => {
    a = await startStack(`${p2Env.run}-t901a`, p2Env, stackArgs)
    events = await preloadEventsOf(a)
  })
  test.afterAll(async () => {
    if (a) await stopStack(a.run)
    if (b) await stopStack(b.run)
  })

  const eventOf = (name) => events.find((e) => e.event === name)

  test('T-901 c3 @P0 the heap flag of the deployment limits the V8 heap (observed in a running app)', async () => {
    const listening = eventOf('listening')
    expect(listening, 'the preload saw the server listen').toBeDefined()
    const MiB = 1024 * 1024
    // --max-old-space-size=1024 plus the young generation; without the flag Node picks a quarter of the RAM
    expect(listening.heapLimit).toBeGreaterThanOrEqual(1024 * MiB)
    expect(listening.heapLimit).toBeLessThanOrEqual(1536 * MiB)
    RECORD.heapLimitMiB = Math.round(listening.heapLimit / MiB)
    // 768Mi container limit vs a 1024 MiB old space: the OOM-kill territory is the container's, not V8's
    expect(bytesOf(prodDeployment().limits.memory)).toBeLessThan(
      listening.heapLimit
    )
  })

  test('T-901 c8 @P0 the time to ready is recorded and inside the startup probe budget', async () => {
    const listening = eventOf('listening')
    const first = eventOf('first-healthz')
    expect(first, 'the first /api/healthz/ request').toBeDefined()
    const dep = prodDeployment()
    const budgetMs =
      dep.startup.failureThreshold * dep.startup.periodSeconds * 1000
    RECORD.readyMs = first.uptimeMs
    RECORD.listenMs = listening.uptimeMs
    expect(first.uptimeMs).toBeGreaterThanOrEqual(listening.uptimeMs)
    expect(first.uptimeMs).toBeLessThan(budgetMs)
    if (baseline && baseline.readyMs) {
      expect(first.uptimeMs).toBeLessThanOrEqual(1.1 * baseline.readyMs)
      note('b0', `readyMs ${first.uptimeMs} vs B0 ${baseline.readyMs}`)
    } else note('b0', `no B0 yet: readyMs ${first.uptimeMs} recorded`)
  })

  test('T-901 c9 @P0 keepAliveTimeout and headersTimeout are recorded: Node 24 defaults', async ({
    request,
  }) => {
    const l = eventOf('listening')
    RECORD.timeouts = {
      node: l.node,
      keepAliveTimeout: l.keepAliveTimeout,
      headersTimeout: l.headersTimeout,
      requestTimeout: l.requestTimeout,
      timeout: l.timeout,
    }
    // `next start` sets none of them (10.2.3 to 12.3.7); the values are the runtime Node's own (24.18.1)
    expect(l.node).toMatch(/^v24\./)
    expect(l.keepAliveTimeout).toBe(5000)
    expect(l.headersTimeout).toBe(60000)
    expect(l.requestTimeout).toBe(300000)
    expect(l.timeout).toBe(0)
    // on the wire: the app tells a keep-alive client how long it keeps the socket (the proxy upstream pool)
    const res = await request.get(`${a.appURL}/api/healthz/`)
    expect(res.headers()['keep-alive']).toBe('timeout=5')
    note('timeouts', JSON.stringify(RECORD.timeouts))
  })

  test('T-901 c7 @P0 SIGTERM after the traffic drained (the prod sequence): nothing lost, exit 0 inside the grace period', async () => {
    const dep = prodDeployment()
    const load = startLoad({ origin: a.baseURL, path: search, rps: 20 })
    await sleep(3000)
    load.stop()
    expect(await load.settled()).toBe(true)
    RECORD.sequence = { sent: load.records.length }
    // 20 per second for 3 s on a loaded machine: well over half of the nominal 60 went out
    expect(load.records.length).toBeGreaterThanOrEqual(30)
    expect(load.records.filter((r) => r.status !== 200)).toEqual([])

    // the preStop sleep (10 s in the deployment) takes the pod out of the endpoints before SIGTERM; scaled down
    await sleep(1000)
    const sentAt = Date.now()
    await signalApp(a, 'SIGTERM')
    await expect.poll(() => appExitOf(a), { timeout: 30000 }).not.toBeNull()
    const exit = await appExitOf(a)
    const exitMs = exit.at - sentAt
    RECORD.sequence.exitMs = exitMs
    expect(exit.code).toBe(0)
    expect(exit.signal).toBeNull()
    // < terminationGracePeriodSeconds, which also holds the preStop sleep
    expect(exitMs).toBeLessThan((dep.graceSeconds - dep.preStopSeconds) * 1000)
    if (baseline && baseline.exitMs) {
      expect(exitMs).toBeLessThanOrEqual(
        Math.max(1.1 * baseline.exitMs, baseline.exitMs + 1000)
      )
      note('b0', `exitMs ${exitMs} vs B0 ${baseline.exitMs}`)
    } else note('b0', `no B0 yet: exitMs ${exitMs} recorded`)
    // nothing listens afterwards: the proxy reports the upstream as unreachable
    const after = await fetch(`${a.baseURL}${search}`).then(
      (r) => r.status,
      () => 0
    )
    expect(after).toBe(502)
  })

  test('T-901 c7 @P0 SIGTERM with requests in flight: next start answers them, then exits (41: they complete; P0-16-3)', async ({
    p2Env,
  }) => {
    b = await startStack(`${p2Env.run}-t901b`, p2Env, stackArgs)
    // every SSR of the search page waits 1.5 s for the API: at 20 rps about thirty are in flight
    const rule = await stubControl(b, 'POST', '/rules', {
      urlPrefix: 'https://api.core.ac.uk/v3/search/works',
      latencyMs: 1500,
      fail: {
        status: 200,
        body: '{"totalHits":0,"results":[]}',
        contentType: 'application/json',
      },
    })
    expect(rule.id).toBeTruthy()

    const load = startLoad({ origin: b.baseURL, path: search, rps: 20 })
    await sleep(4000)
    const sentAt = Date.now()
    await signalApp(b, 'SIGTERM')
    await sleep(2500) // the traffic goes on after the signal
    load.stop()
    expect(await load.settled()).toBe(true)
    await expect.poll(() => appExitOf(b), { timeout: 30000 }).not.toBeNull()
    const exit = await appExitOf(b)

    // times relative to the first request; the instants between the signal and the exit are ambiguous (a
    // response may still go out before the event loop reaches the signal), the rest is not
    const signalAt = sentAt - load.t0
    const exitAt = exit.at - load.t0
    const before = load.records.filter((r) => r.end <= signalAt)
    const lost = load.records.filter(
      (r) => r.start < signalAt && r.end > exitAt
    )
    const after = load.records.filter((r) => r.start >= exitAt)
    RECORD.raw = {
      sent: load.records.length,
      completedBefore: before.length,
      inFlightAtExit: lost.length,
      startedAfterExit: after.length,
      exitMs: exit.at - sentAt,
    }
    note('raw', JSON.stringify(RECORD.raw))
    // Next 10's bin/next answers SIGTERM with process.exit(0); how soon the event loop reaches the handler
    // depends on the queue behind it (seconds under a saturated machine), so only the budget is asserted
    expect(exit.code).toBe(0)
    expect(exit.at - sentAt).toBeLessThan(
      (prodDeployment().graceSeconds - prodDeployment().preStopSeconds) * 1000
    )
    // AD-234: Next 14.2's next start answers SIGTERM with server.close(): it takes no new connection and exits
    // once the requests it serves are answered, so none is in flight at the exit
    expect(lost).toEqual([])
    // the stub holds each request for 1.5 s: some were in the app at the signal, and each was answered
    const drained = load.records.filter(
      (r) => r.start < signalAt && r.end > signalAt && r.end <= exitAt
    )
    expect(drained.length).toBeGreaterThanOrEqual(5)
    expect(drained.filter((r) => r.status !== 200)).toEqual([])
    // the traffic that was served before the signal was served
    expect(before.filter((r) => r.status !== 200)).toEqual([])
    // the traffic after the exit meets a closed port
    expect(after.filter((r) => r.status !== 502)).toEqual([])
    await stubControl(b, 'DELETE', `/rules?id=${rule.id}`)
  })
})
