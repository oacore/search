// T-611 (41 G; R-048): size budgets, through the gateway-faithful proxy (the allow-all listener for the two
// local-only pages). c1 raw and gzip body bytes of every route of the table below, each within +-5 % of its
// B0 value (the table is the record of the golden build, B0-local, 2026-10-21; the plan's reference pair for
// `/data-providers/` is 7,104,305 B raw and 1,003,968 B gzip, 41 T-611), identity and gzip requests made with
// exactly that `Accept-Encoding` on a socket of their own. c2 memory after the sweep (R-048: `/data-providers/`
// is 7.1 MB raw, RSS ~530 MB after it): the app of a sub-stack of its own serves the sweep (every route of the
// table, three rounds, one request at a time) and the test reads (a) the peak RSS of the `next start` process
// sampled with `ps` during and after the sweep and (b) the heap the process retains after two forced
// collections (a preload mounted into the sub-stack, signalled with SIGUSR2; nothing of the app is touched),
// each <= B0 + 10 % (and the committed heap after the collections).
// Local mode only (owner notes: no Docker): the plan reads `docker stats`; here the process is the container's
// stand-in, so the limit of 768 MiB (R-048) is not enforced (DEFERRED with the compose topology, I-23). RSS on
// macOS is not a stable figure (the memory compressor moves resident pages out: five identical sweeps gave a
// peak between 319 and 555 MiB), so B0 for (a) is the upper envelope of N identical sweeps: 650 of the golden
// build on Node 18, 785 of the jump-check build on Node 24.18.1 since AD-151 (see MEMORY_B0), while (b) is stable
// to 0.1 % and is the tight +10 % check.
import fs from 'node:fs'
import http from 'node:http'
import path from 'node:path'
import zlib from 'node:zlib'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { test, expect } from '../fixtures/guard.mjs'
import { up, down, appLog } from '../lib/P0-11/substack.mjs'

const run = promisify(execFile)

// plan reference (41 T-611)
const PLAN = { path: '/data-providers/', raw: 7104305, gzip: 1003968 }
const TOLERANCE = 0.05
const MEMORY_TOLERANCE = 0.1

// B0-local record of the golden build (G 689fec9, build 1fb7e5b548c5ae8c). via: gateway (baseURL) or allow (the
// allow-all listener: `/` and `/error-card/` are not routed by the gateway, Q-005). Every answer is 200.
const BUDGET = [
  ['search-climate', '/search/?q=climate', 'gateway', 241514, 55570],
  ['search-zzzzqqq', '/search/?q=zzzzqqq', 'gateway', 55041, 13934],
  ['search-status500', '/search/?q=__status500', 'gateway', 54741, 13711],
  ['works-1001', '/works/1001/', 'gateway', 87851, 19509],
  ['works-1002', '/works/1002/', 'gateway', 68030, 17607],
  ['works-1003', '/works/1003/', 'gateway', 100969, 22009],
  ['works-1004', '/works/1004/', 'gateway', 83143, 19098],
  ['works-1005', '/works/1005/', 'gateway', 89956, 19969],
  ['works-4040', '/works/4040/', 'gateway', 52488, 13059],
  ['outputs-2001', '/outputs/2001/', 'gateway', 73916, 19434],
  ['outputs-2002', '/outputs/2002/', 'gateway', 52436, 13024],
  ['outputs-2003', '/outputs/2003/', 'gateway', 65100, 17178],
  ['outputs-2004', '/outputs/2004/', 'gateway', 73188, 19297],
  ['outputs-update', '/outputs/update/', 'gateway', 56854, 14491],
  ['providers', '/data-providers/', 'gateway', 7104305, 1003966],
  [
    'providers-q-aberystwyth',
    '/data-providers/?q=aberystwyth',
    'gateway',
    7096316,
    1003549,
  ],
  ['provider-86', '/data-providers/86/', 'gateway', 157998, 37213],
  ['provider-4835', '/data-providers/4835/', 'gateway', 431414, 200196],
  ['provider-8', '/data-providers/8/', 'gateway', 158412, 43919],
  ['provider-3354', '/data-providers/3354/', 'gateway', 60953, 15488],
  ['static-search', '/static/search/', 'gateway', 53954, 13415],
  ['root', '/', 'allow', 53954, 13415],
  ['error-card', '/error-card/', 'allow', 54624, 13656],
].map(([id, route, via, raw, gzip]) => ({ id, route, via, raw, gzip }))

// B0 of the memory figures (MiB), recorded 2026-10-21 from 15 identical sweeps of the golden build on a loaded
// host (load average 40-90): the peak RSS was 650 on Node 18, the upper envelope (320-647, median 500: the memory
// compressor and the garbage collector's timing spread single sweeps over +-25 %); the heap retained after the
// collections is stable (132.2-132.9) and the committed heap varies less (169.5-179.3, so its B0 is the envelope).
// The peak RSS is 785 since AD-151: the same formula, on another build and a quieter machine, the upper envelope
// of 32 sweeps (T-611 c2 alone, a fresh stack each) of the jump-check build e9c353c5d1f87f02 on Node 24.18.1,
// 2026-10-30: 604.1-784.2, median 641.3, 1-minute load 3-7, 784.2 rounded up; the limit moves from 715 to 863.5
const MEMORY_B0 = {
  peakRssMiB: 785, // AD-151
  heapUsedAfterGcMiB: 132.9,
  heapTotalMiB: 180,
}
const SWEEP_ROUNDS = 3

const within = (actual, reference, tolerance) =>
  Math.abs(actual - reference) <= reference * tolerance

// one request on a socket of its own with exactly the Accept-Encoding named; the body is not decoded
function fetchBytes(origin, target, encoding) {
  const u = new URL(origin)
  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        host: u.hostname,
        port: u.port,
        path: target,
        method: 'GET',
        headers: { 'Accept-Encoding': encoding },
        agent: false,
      },
      (res) => {
        const chunks = []
        res.on('data', (c) => chunks.push(c))
        res.on('end', () =>
          resolve({
            status: res.statusCode,
            encoding: res.headers['content-encoding'] || null,
            body: Buffer.concat(chunks),
          })
        )
        res.on('error', reject)
      }
    )
    req.setTimeout(120000, () =>
      req.destroy(new Error(`timeout after 120 s: ${target}`))
    )
    req.on('error', reject)
    req.end()
  })
}

const originOf = (env, row) =>
  row.via === 'allow' ? env.allowURL : env.baseURL

// the preload of c2: on SIGUSR2 collect twice and write one JSON line with the process memory to stderr (the
// app log). `--expose-gc` is not accepted in NODE_OPTIONS, so the collector is taken from a vm context.
const PRELOAD = `const v8 = require('v8')
const vm = require('vm')
v8.setFlagsFromString('--expose-gc')
const gc = vm.runInNewContext('gc')
process.on('SIGUSR2', () => {
  gc()
  gc()
  process.stderr.write(JSON.stringify({ p108: 'mem', pid: process.pid, memory: process.memoryUsage() }) + '\\n')
})
`

test.describe('T-611 @P1 size budgets', () => {
  // the sweep loads one app hard and a sub-stack starts: run in order, one worker
  test.describe.configure({ mode: 'default', timeout: 300000 })

  test('T-611 c1 @P1 raw + gzip body bytes per route within +-5 % of B0 (/data-providers/ 7,104,305 / 1,003,968 B)', async ({
    p2Env,
  }) => {
    const deviations = []
    const measured = []
    for (const row of BUDGET) {
      const origin = originOf(p2Env, row)
      const identity = await fetchBytes(origin, row.route, 'identity')
      const gzip = await fetchBytes(origin, row.route, 'gzip')
      const m = {
        id: row.id,
        statuses: [identity.status, gzip.status],
        encodings: [identity.encoding, gzip.encoding],
        raw: identity.body.length,
        gzip: gzip.body.length,
      }
      measured.push(m)
      // the answers are what the table was recorded from: 200, identity uncompressed, gzip compressed, and the
      // compressed bytes decode to the identity bytes (the sizes describe one document)
      if (m.statuses.join() !== '200,200')
        deviations.push(`${row.id}: statuses ${m.statuses.join()}`)
      if (m.encodings.join() !== ',gzip')
        deviations.push(`${row.id}: content-encoding ${m.encodings.join()}`)
      if (
        gzip.encoding === 'gzip' &&
        !zlib.gunzipSync(gzip.body).equals(identity.body)
      )
        deviations.push(
          `${row.id}: the gzip body does not decode to the raw body`
        )
      if (!within(m.raw, row.raw, TOLERANCE))
        deviations.push(`${row.id}: raw ${m.raw} B vs B0 ${row.raw} B`)
      if (!within(m.gzip, row.gzip, TOLERANCE))
        deviations.push(`${row.id}: gzip ${m.gzip} B vs B0 ${row.gzip} B`)
    }
    test.info().annotations.push({
      type: 'measured',
      description: JSON.stringify(measured),
    })

    // the plan's reference pair: the table's row and the measured pair
    const plan = BUDGET.find((r) => r.route === PLAN.path)
    expect(within(plan.raw, PLAN.raw, 0.001), 'table row vs 41 raw').toBe(true)
    expect(within(plan.gzip, PLAN.gzip, 0.001), 'table row vs 41 gzip').toBe(
      true
    )
    const ref = measured.find((m) => m.id === plan.id)
    expect(within(ref.raw, PLAN.raw, TOLERANCE), 'raw vs 41').toBe(true)
    expect(within(ref.gzip, PLAN.gzip, TOLERANCE), 'gzip vs 41').toBe(true)
    expect(deviations).toEqual([])
    // the heaviest route is the one R-048 names: the budget is only meaningful if it is still 7 MB
    expect(ref.raw).toBeGreaterThan(5 * 1024 * 1024)
  })

  test('T-611 c2 @P1 RSS after the sweep: peak RSS and the heap retained after a forced collection <= B0 + 10 %', async ({
    p2Env,
  }) => {
    test.setTimeout(480000)
    if (p2Env.mode !== 'host')
      throw new Error(
        `T-611 c2 reads the app process (ps, SIGUSR2): local (host) mode only, got ${p2Env.mode}; the docker figure is docker stats of the app container (DEFERRED, no Docker in this run)`
      )
    const preload = path.join(p2Env.runDir, 'p1-08-mem-preload.cjs')
    fs.writeFileSync(preload, PRELOAD)
    const id = `${p2Env.run}-t611-rss`
    const env = await up(id, {
      build: p2Env.build.key,
      preload,
      target: '/p108/mem.cjs',
    })
    let peakKiB = 0
    let stop = false
    let sampler = Promise.resolve()
    const statuses = []
    let memory = null
    try {
      const rss = async () => {
        const { stdout } = await run('ps', [
          '-o',
          'rss=',
          '-p',
          String(env.pids.app),
        ])
        return Number(stdout.trim())
      }
      sampler = (async () => {
        while (!stop) {
          try {
            peakKiB = Math.max(peakKiB, await rss())
          } catch {
            // the process is gone: the sweep assertions below fail on the statuses
          }
          await new Promise((r) => setTimeout(r, 200))
        }
      })()
      // the sweep: every route of the table, three rounds, one request at a time (identity and gzip alternate)
      for (let round = 0; round < SWEEP_ROUNDS; round++)
        for (const row of BUDGET) {
          const origin = originOf(env, row)
          const r = await fetchBytes(
            origin,
            row.route,
            (round + BUDGET.indexOf(row)) % 2 ? 'gzip' : 'identity'
          )
          statuses.push(r.status)
        }
      peakKiB = Math.max(peakKiB, await rss())
      // the retained heap: two collections in the app process, then its figures
      process.kill(env.pids.app, 'SIGUSR2')
      await expect
        .poll(
          () => {
            try {
              const line = fs
                .readFileSync(appLog(env), 'utf8')
                .split('\n')
                .find((l) => l.startsWith('{"p108":'))
              return line ? JSON.parse(line).memory : null
            } catch {
              return null
            }
          },
          { timeout: 60000 }
        )
        .not.toBeNull()
      memory = JSON.parse(
        fs
          .readFileSync(appLog(env), 'utf8')
          .split('\n')
          .find((l) => l.startsWith('{"p108":'))
      ).memory
    } finally {
      stop = true
      await sampler
      await down(id)
    }
    const MiB = 1024 * 1024
    const figures = {
      sweepRequests: statuses.length,
      peakRssMiB: Number((peakKiB / 1024).toFixed(1)),
      heapUsedAfterGcMiB: Number((memory.heapUsed / MiB).toFixed(1)),
      heapTotalMiB: Number((memory.heapTotal / MiB).toFixed(1)),
      externalMiB: Number((memory.external / MiB).toFixed(1)),
    }
    test.info().annotations.push({
      type: 'measured',
      description: JSON.stringify(figures),
    })
    expect(statuses).toHaveLength(SWEEP_ROUNDS * BUDGET.length)
    expect([...new Set(statuses)]).toEqual([200])
    // the process was measured while it served the sweep (a sampler that never saw the app would pass 0 <= B0)
    expect(figures.peakRssMiB).toBeGreaterThan(200)
    expect(figures.heapUsedAfterGcMiB).toBeGreaterThan(50)
    expect(figures.peakRssMiB).toBeLessThanOrEqual(
      MEMORY_B0.peakRssMiB * (1 + MEMORY_TOLERANCE)
    )
    expect(figures.heapUsedAfterGcMiB).toBeLessThanOrEqual(
      MEMORY_B0.heapUsedAfterGcMiB * (1 + MEMORY_TOLERANCE)
    )
    expect(figures.heapTotalMiB).toBeLessThanOrEqual(
      MEMORY_B0.heapTotalMiB * (1 + MEMORY_TOLERANCE)
    )
  })
})
