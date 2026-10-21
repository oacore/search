#!/usr/bin/env node
// soak.mjs - `npm run soak`: the pre-merge runtime check C6-CI (55 C6, T-902; replaces the stage soak, OD-47).
// Three arms (reference, candidate, golden) of parity builds, each its own stack (scripts/e2e-stack.mjs, own port
// slot) whose SSR stub serves the recorded C4 corpus (corpus answers + the fixtures), replay the corpus URLs
// through the gateway-faithful proxy at a fixed rate in alternating blocks on one machine (default 10 rps, 30-minute
// blocks, 3 blocks per arm = 90 min per arm, interleaved R C G R C G ...), one arm loaded at a time.
//
//   npm run soak -- --reference <ref|build key> --candidate <ref|build key> --golden <ref|build key>
//                   [--corpus pilot] [--rps 10] [--block-min 30] [--blocks 3] [--seed <n>] [--id <run id>]
//                   [--no-t907] [--smoke]
//   --smoke = 1-minute blocks, 1 block per arm, 5 rps (the 2.5 tool self-test on the pilot list)
//
// Rows (55 C6-CI): 1 app restarts / exits (the stack's app-exit record; OOM kills are container events: docker
// mode) = 0; 2 5xx at the proxy <= reference; 3 p95 latency per routed prefix <= 1.10 x reference and <= 1.10 x
// golden; 4 max RSS <= 1.10 x reference (and the 2.8 record: not set) and < 700 MiB, RSS slope per 10,000
// requests (linear fit) <= max(reference, 2.8 record) + the 2.8 calibrated tolerance (not set: printed); 5 upstream
// calls (SSR stub records of each URL, one serial probe pass per arm before its first block) identical per URL;
// 6 T-907 c2 against the arm's stack at start and end green; 7 CPU-seconds per replayed request (the app
// process) <= 1.10 x reference and <= 1.10 x golden.
// Local mode (owner notes §1): host processes, so the prod limits (mem_limit 768m, CPU 600m) are not enforced
// (no container); RSS and CPU are measured on the `next start` process (ps). The tolerances' calibration (3 runs
// of the golden image in all three arms) is at 2.8: DEFERRED. Output: $ARTIFACT_DIR/soak/<id>/report.json.
import fs from 'node:fs'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import {
  REPO,
  ARTIFACT_DIR,
  corpusDir,
  readJson,
  writeJson,
  opts,
  rng,
  shuffle,
  seedOf,
  byCodePoint,
  gateway,
  buildReplayRoot,
  stackUp,
  stackDown,
  control,
  buildRecord,
} from './corpus-lib.mjs'

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const MiB = 1024

const psOf = (pid) => {
  const r = spawnSync('ps', ['-o', 'rss=,time=', '-p', String(pid)], {
    encoding: 'utf8',
  })
  const m = /^\s*(\d+)\s+(?:(\d+)-)?(?:(\d+):)?(\d+):(\d+(?:\.\d+)?)\s*$/.exec(
    r.stdout || ''
  )
  if (!m) return null
  const [, rss, d, h, mi, s] = m
  return {
    rssKiB: Number(rss),
    cpuS:
      Number(d || 0) * 86400 +
      Number(h || 0) * 3600 +
      Number(mi) * 60 +
      Number(s),
  }
}
const quantile = (xs, q) => {
  if (!xs.length) return null
  const a = xs.slice().sort((x, y) => x - y)
  const h = (a.length - 1) * q
  const lo = Math.floor(h)
  return a[lo] + (h - lo) * (a[Math.ceil(h)] - a[lo])
}
function slope(points) {
  // least squares of rss (KiB) on requests; per 10,000 requests
  if (points.length < 3) return null
  const n = points.length
  const mx = points.reduce((a, p) => a + p.x, 0) / n
  const my = points.reduce((a, p) => a + p.y, 0) / n
  let sxy = 0
  let sxx = 0
  for (const p of points) {
    sxy += (p.x - mx) * (p.y - my)
    sxx += (p.x - mx) ** 2
  }
  return sxx ? (sxy / sxx) * 10000 : null
}

async function probeUpstream(arm, urls) {
  const sets = {}
  for (const u of urls) {
    const mark = await control(arm.env, 'POST', '/mark', {})
    try {
      const r = await fetch(`${arm.env.baseURL}${u.url}`, {
        redirect: 'manual',
        signal: AbortSignal.timeout(120000),
      })
      await r.arrayBuffer()
    } catch {
      // a failing URL keeps its (possibly empty) set
    }
    const win = await control(arm.env, 'GET', `/collect?since=${mark.seq}`)
    sets[u.url] = win.records
      .map((r) => `${r.method} ${r.url} ${r.bodySha256.slice(0, 12)}`)
      .sort(byCodePoint)
  }
  return sets
}

async function block(arm, order, { rps, ms, stratum }) {
  const started = Date.now()
  const results = []
  const inflight = new Set()
  const samples = []
  let i = 0
  const sampler = setInterval(() => {
    const p = psOf(arm.env.pids.app)
    if (p) samples.push({ t: Date.now(), requests: arm.requests, ...p })
  }, 5000)
  const p0 = psOf(arm.env.pids.app)
  if (p0) samples.push({ t: Date.now(), requests: arm.requests, ...p0 })
  const interval = 1000 / rps
  let next = Date.now()
  while (Date.now() - started < ms) {
    const u = order[i % order.length]
    i++
    if (inflight.size < 100) {
      const t0 = performance.now()
      const pr = fetch(`${arm.env.baseURL}${u.url}`, {
        redirect: 'manual',
        signal: AbortSignal.timeout(60000),
      })
        .then(async (r) => {
          await r.arrayBuffer()
          return r.status
        })
        .catch(() => 0)
        .then((status) => {
          results.push({
            url: u.url,
            stratum: stratum(u.url),
            status,
            ms: performance.now() - t0,
          })
          arm.requests++
          inflight.delete(pr)
        })
      inflight.add(pr)
    }
    next += interval
    const wait = next - Date.now()
    if (wait > 0) await sleep(wait)
  }
  await Promise.all([...inflight])
  clearInterval(sampler)
  const p1 = psOf(arm.env.pids.app)
  if (p1) samples.push({ t: Date.now(), requests: arm.requests, ...p1 })
  return { results, samples, cpuS: p0 && p1 ? p1.cpuS - p0.cpuS : null }
}

function t907(arm, tag) {
  const r = spawnSync(
    process.execPath,
    [
      'scripts/e2e-stack.mjs',
      'test',
      '--run',
      arm.run,
      'e2e/ops/t907-smoke.spec.mjs',
      '--project',
      'ops',
      '-g',
      'T-907 c2',
      '--reporter',
      'line',
    ],
    {
      cwd: REPO,
      encoding: 'utf8',
      env: { ...process.env, ARTIFACT_DIR, P2_OPS: '1' },
    }
  )
  const m = /(\d+) passed/.exec(r.stdout || '')
  return { tag, rc: r.status, passed: m ? Number(m[1]) : 0 }
}

async function main() {
  const o = opts(process.argv.slice(2))
  const smoke = o.has('--smoke')
  const rps = Number(o.get('--rps', smoke ? 5 : 10))
  const blockMin = Number(o.get('--block-min', smoke ? 1 : 30))
  const blocks = Number(o.get('--blocks', smoke ? 1 : 3))
  const name = o.get('--corpus', 'pilot')
  const find = (spec) =>
    /^[0-9a-f]{16}(-[a-z0-9-]+)?$/.test(spec)
      ? buildRecord({ key: spec })
      : buildRecord({ ref: spec })
  const specs = {
    reference: o.get('--reference'),
    candidate: o.get('--candidate'),
    golden: o.get('--golden', 'p2-local/golden'),
  }
  for (const [k, v] of Object.entries(specs))
    if (!v) throw new Error(`--${k} <ref|build key>`)
  const id = o.get(
    '--id',
    `soak-${new Date().toISOString().replace(/[-:]/g, '').slice(0, 15)}`
  )
  const out = path.join(ARTIFACT_DIR, 'soak', id)
  fs.mkdirSync(out, { recursive: true })
  const list = readJson(path.join(corpusDir(name), 'urls.json'))
  const urls = list.urls
  const seed = Number(o.get('--seed', seedOf(`${name}-soak`)))
  const order = shuffle(
    urls.slice().sort((a, b) => byCodePoint(a.url, b.url)),
    rng(seed)
  )
  const gw = await gateway()
  const replay = buildReplayRoot(name, { base: 'fixtures' })
  const arms = []
  for (const [role, spec] of Object.entries(specs)) {
    const b = await find(spec)
    if (!b) throw new Error(`no build for --${role} ${spec}`)
    arms.push({ role, spec, build: b, run: `${id}-${role[0]}`, requests: 0 })
  }
  const report = {
    schema: 1,
    id,
    corpus: name,
    smoke,
    rps,
    blockMin,
    blocksPerArm: blocks,
    seed,
    limits:
      'prod limits (mem_limit 768m, CPU 600m) not enforced in local mode (host processes; docker mode only); RSS and CPU measured on the next start process',
    arms: {},
    rows: {},
    startedAt: new Date().toISOString(),
  }
  try {
    for (const arm of arms) {
      stackDown(arm.run)
      arm.env = stackUp(arm.run, {
        build: arm.build,
        sandbox: name,
      })
      arm.data = {
        results: [],
        samples: [],
        cpuS: 0,
        t907: [],
        blocks: [],
      }
    }
    // T-907 c2 runs on the fixture answers (prefer fixtures), the probe pass and the blocks on the corpus answers
    const useRoot = async (prefer) => {
      buildReplayRoot(name, { base: 'fixtures', prefer })
      for (const arm of arms) await control(arm.env, 'POST', '/reload', {})
    }
    if (!o.has('--no-t907')) {
      await useRoot('fixtures')
      for (const arm of arms) arm.data.t907.push(t907(arm, 'start'))
      await useRoot('corpus')
    }
    for (const arm of arms) arm.data.upstream = await probeUpstream(arm, urls)
    for (let b = 0; b < blocks; b++)
      for (const arm of arms) {
        const r = await block(arm, order, {
          rps,
          ms: blockMin * 60000,
          stratum: (u) => gw.stratum(u),
        })
        arm.data.results.push(...r.results)
        arm.data.samples.push(...r.samples)
        arm.data.cpuS += r.cpuS || 0
        arm.data.blocks.push({
          block: b + 1,
          requests: r.results.length,
          cpuS: r.cpuS,
        })
        console.log(
          `block ${b + 1}/${blocks} ${arm.role}: ${
            r.results.length
          } requests, ${
            r.results.filter((x) => x.status >= 500 || x.status === 0).length
          } 5xx/errors, cpu ${r.cpuS && r.cpuS.toFixed(1)} s`
        )
      }
    if (!o.has('--no-t907')) {
      await useRoot('fixtures')
      for (const arm of arms) arm.data.t907.push(t907(arm, 'end'))
    }
  } finally {
    for (const arm of arms) {
      arm.exit = fs.existsSync(
        path.join(ARTIFACT_DIR, 'runs', arm.run, 'app-exit.json')
      )
        ? readJson(path.join(ARTIFACT_DIR, 'runs', arm.run, 'app-exit.json'))
        : null
      stackDown(arm.run)
    }
  }
  // ---------- rows ----------
  const stats = {}
  for (const arm of arms) {
    const d = arm.data
    const byPrefix = {}
    for (const r of d.results)
      (byPrefix[r.stratum] = byPrefix[r.stratum] || []).push(r.ms)
    const rssMax = Math.max(...d.samples.map((s) => s.rssKiB))
    stats[arm.role] = {
      build: arm.build.key,
      requests: d.results.length,
      exit: arm.exit,
      n5xx: d.results.filter((r) => r.status >= 500).length,
      errors: d.results.filter((r) => r.status === 0).length,
      p95: Object.fromEntries(
        Object.entries(byPrefix)
          .sort()
          .map(([k, v]) => [k, Number(quantile(v, 0.95).toFixed(1))])
      ),
      rssMaxMiB: Number((rssMax / MiB).toFixed(1)),
      rssSlopeKiBPer10k: (() => {
        const s = slope(d.samples.map((x) => ({ x: x.requests, y: x.rssKiB })))
        return s == null ? null : Number(s.toFixed(1))
      })(),
      cpuPerRequestMs: d.results.length
        ? Number(((d.cpuS / d.results.length) * 1000).toFixed(3))
        : null,
      t907: d.t907,
      blocks: d.blocks,
    }
    report.arms[arm.role] = stats[arm.role]
    writeJson(path.join(out, `${arm.role}-samples.json`), d.samples)
  }
  const R = stats.reference
  const C = stats.candidate
  const G = stats.golden
  const le = (a, b, f = 1.1) => a == null || b == null || a <= f * b
  const prefixes = Object.keys(C.p95)
  report.rows = {
    1: {
      what: 'app restarts / exits (OOM kills: docker mode)',
      pass: !C.exit && !R.exit && !G.exit,
      candidate: C.exit,
      reference: R.exit,
    },
    2: {
      what: '5xx at the proxy <= reference',
      pass: C.n5xx <= R.n5xx,
      candidate: C.n5xx,
      reference: R.n5xx,
    },
    3: {
      what: 'p95 latency per routed prefix <= 1.10 x reference and <= 1.10 x golden',
      pass: prefixes.every(
        (p) => le(C.p95[p], R.p95[p]) && le(C.p95[p], G.p95[p])
      ),
      candidate: C.p95,
      reference: R.p95,
      golden: G.p95,
    },
    4: {
      what: 'max RSS <= 1.10 x reference and < 700 MiB; slope <= max(reference, 2.8 record) + tolerance (2.8: not set)',
      pass: le(C.rssMaxMiB, R.rssMaxMiB) && C.rssMaxMiB < 700,
      candidate: { rssMaxMiB: C.rssMaxMiB, slope: C.rssSlopeKiBPer10k },
      reference: { rssMaxMiB: R.rssMaxMiB, slope: R.rssSlopeKiBPer10k },
      record28: null,
      slopeTolerance: null,
    },
    5: {
      what: 'upstream calls per URL identical (serial probe pass, SSR stub records)',
      pass: Object.keys(arms[1].data.upstream).every(
        (u) =>
          JSON.stringify(arms[1].data.upstream[u]) ===
          JSON.stringify(arms[0].data.upstream[u])
      ),
      differing: Object.keys(arms[1].data.upstream).filter(
        (u) =>
          JSON.stringify(arms[1].data.upstream[u]) !==
          JSON.stringify(arms[0].data.upstream[u])
      ),
    },
    6: {
      what: 'T-907 c2 against the stack at start and end',
      pass: o.has('--no-t907')
        ? null
        : arms.every((a) => a.data.t907.every((t) => t.rc === 0)),
      runs: Object.fromEntries(arms.map((a) => [a.role, a.data.t907])),
    },
    7: {
      what: 'CPU-seconds per replayed request <= 1.10 x reference and <= 1.10 x golden',
      pass:
        le(C.cpuPerRequestMs, R.cpuPerRequestMs) &&
        le(C.cpuPerRequestMs, G.cpuPerRequestMs),
      candidate: C.cpuPerRequestMs,
      reference: R.cpuPerRequestMs,
      golden: G.cpuPerRequestMs,
    },
  }
  report.endedAt = new Date().toISOString()
  report.breaches = Object.entries(report.rows)
    .filter(([, r]) => r.pass === false)
    .map(([k]) => Number(k))
  report.pass = report.breaches.length === 0
  writeJson(path.join(out, 'report.json'), report)
  console.log(
    `soak ${id}: ${Object.entries(stats)
      .map(
        ([k, s]) =>
          `${k} ${s.requests} req, max RSS ${s.rssMaxMiB} MiB, ${s.cpuPerRequestMs} ms CPU/req`
      )
      .join('; ')}; breaches ${JSON.stringify(report.breaches)} -> ${
      report.pass ? 'PASS' : 'FAIL'
    }; ${path.join(out, 'report.json')}`
  )
  process.exit(report.pass ? 0 : 1)
}

if (fileURLToPath(import.meta.url) === path.resolve(process.argv[1] || ''))
  main().catch((e) => {
    console.error(process.env.P2_DEBUG ? e.stack : e.message)
    process.exit(1)
  })
