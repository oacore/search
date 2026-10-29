#!/usr/bin/env node
// merge-coverage.mjs - C3 coverage (55 C3; 40 §10 `npm run coverage` = `node scripts/merge-coverage.mjs`, on the
// tooling Node 24). Merged V8 coverage of the app from three sources:
//   jest     Jest's V8 coverage of the `node` and `dom` projects (runtime Node 24.18.1 from W4e, TZ=UTC, as
//            test:unit runs)
//   browser  Chromium `page.coverage` of every page the Playwright tiers open (chromium, wire, visual projects)
//   server   NODE_V8_COVERAGE of `next start` (the app process of the e2e stack, on the build of --ref)
// Browser and server coverage are of webpack bundles; they are mapped to the app sources through the build's
// own source maps (`@zeit/next-source-maps` emits `.next/**/*.js.map`; sourcesContent = the app files).
//
// Usage:
//   node scripts/merge-coverage.mjs [all] [options]     collect, merge and items (default)
//   node scripts/merge-coverage.mjs collect [options]   run Jest and the e2e tiers with coverage on
//   node scripts/merge-coverage.mjs merge [options]     merge the collected data: (a), the attribution check, (b)
//   node scripts/merge-coverage.mjs items [options]     (c) and (d) from the test reports and the docs data
// Options:
//   --out <dir>        output (default $ARTIFACT_DIR/coverage/<short sha of --ref>)
//   --ref <ref>        the commit whose build is served and whose app files are counted (default p2-local/golden)
//   --run <id>         e2e stack id (default P1-09-cov); the harness picks the slot and ports (e2e-stack.mjs)
//   --skip-jest, --skip-e2e, --skip-visual, --with-static   parts of `collect`
//   --only <group>     e2e groups to run: chromium, wire, visual (repeatable; default all)
//   --append           keep the browser, server and e2e data already in --out (re-runs add to them)
//   --pw "<args>"      extra Playwright arguments for every e2e invocation (e.g. a -g filter)
//   --report <file>    extra test report (Jest --json or Playwright JSON) for `items`; repeatable
//   --kill-matrix <f>  55 C1 kill matrix (default $ARTIFACT_DIR/faults/kill-matrix.json, if present)
//   --due <step>       the gate or step whose due tests count for (c) and (d) (default 2.7; 41 §0)
//   --step <id>        restrict (b) to the CS rows of one step (e.g. W0, W4c, 6.3; default: every CS row)
//
// Statements: the istanbul statements V8 coverage yields (v8-to-istanbul, the converter Jest uses): one per
// source line of the trimmed file; a line counts as run unless a never-run V8 range covers it whole. The same
// converter maps the bundles, so the three sources count the same statements and are merged per line.
// App = api data hooks lib main modules pages store templates utils, *.js/*.jsx (*.ts/*.tsx from 6.6), at --ref.
//
// Outputs in --out: summary.json (all numbers), summary.txt, per-file.json, jest/, browser/, server/, e2e/,
// items.json. Pass lines: C3 (a) >= 90% of app statements; the attribution check >= 99% of executed app-module
// bundle statements mapped to app sources (else (a) without the server part, 55 C3); (b) every CS-row file run
// by >= 1 black-box test; (c), (d) as 55 C3. This tool measures and prints; the gate record judges.
//
// Attribution check: the hashed webpack module ids of the build (HashedModuleIdsPlugin: base64 md4 of
// `./<path>`, 4+ characters) identify the module functions of each app file in every bundle independently of
// the source maps; each executed statement inside them (bundle AST) is looked up in the map: attributed when the
// mapping at its start (else the first mapping inside it) names an original source: an app file (`app`) or a
// package concatenated into the app module (`other`, e.g. mobx-react-lite; listed per source). Reported
// separately for server and client bundles. The pass line is the strict ratio (attributed / executed). Units
// without any position are listed; those that are Babel output (helpers, temporaries, wrappers: by name in the
// server bundles, by shape in the minified client ones) are counted as `helper` and a second ratio without
// them is printed for the record (never used for the pass line).
//
// Items: an E item is covered by the T rows whose Cases name it and by a T row its own 41 §2.1 row names.
//
// Needs: the e2e stack (scripts/e2e-stack.mjs) and a host build of --ref (scripts/build-parity.mjs); never builds.

import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { spawnSync, execFileSync } from 'node:child_process'
import { createRequire } from 'node:module'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { ARTIFACT_DIR, REPO, findBuild, runtimeNode } from './build-parity.mjs'

const requireRoot = createRequire(path.join(REPO, 'package.json'))
export const APP_DIRS = [
  'api',
  'data',
  'hooks',
  'lib',
  'main',
  'modules',
  'pages',
  'store',
  'templates',
  'utils',
]
const CODE_EXT = /\.(js|jsx|ts|tsx|mjs|cjs)$/
export const isApp = (rel) =>
  CODE_EXT.test(rel) && APP_DIRS.includes(rel.split('/')[0])

// ---------- small helpers ----------
const readJson = (f, d = null) => {
  try {
    return JSON.parse(fs.readFileSync(f, 'utf8'))
  } catch {
    return d
  }
}
const writeJson = (f, v) => {
  fs.mkdirSync(path.dirname(f), { recursive: true })
  fs.writeFileSync(f, `${JSON.stringify(v, null, 1)}\n`)
}
const sha256 = (s) => crypto.createHash('sha256').update(s).digest('hex')
const pct = (n, d) => (d ? Math.round((10000 * n) / d) / 100 : null)
const git = (...a) =>
  execFileSync('git', ['-C', REPO, ...a], {
    encoding: 'utf8',
    maxBuffer: 512 * 1024 * 1024,
  })

// ---------- intervals (V8 block coverage) ----------
// innermost-range semantics of V8 block coverage -> sorted, disjoint [start, end) runs with count > 0
export function executedIntervals(functions, length) {
  const ranges = []
  for (const f of functions) for (const r of f.ranges) ranges.push(r)
  ranges.sort(
    (a, b) => a.startOffset - b.startOffset || b.endOffset - a.endOffset
  )
  const segs = []
  const stack = []
  let cursor = 0
  const emit = (end, count) => {
    if (end > cursor) {
      segs.push([cursor, end, count])
      cursor = end
    }
  }
  for (const r0 of ranges) {
    const r = { ...r0 }
    while (stack.length && stack[stack.length - 1].endOffset <= r.startOffset) {
      const top = stack.pop()
      emit(top.endOffset, top.count)
    }
    if (stack.length) {
      const parent = stack[stack.length - 1]
      if (r.endOffset > parent.endOffset) r.endOffset = parent.endOffset
      emit(r.startOffset, parent.count)
    } else cursor = Math.max(cursor, r.startOffset)
    stack.push(r)
  }
  while (stack.length) {
    const top = stack.pop()
    emit(top.endOffset, top.count)
  }
  const out = []
  for (const [s, e, c] of segs) {
    if (c <= 0 || e > length + 1) continue
    if (out.length && out[out.length - 1][1] >= s)
      out[out.length - 1][1] = Math.max(out[out.length - 1][1], e)
    else out.push([s, e])
  }
  return out
}
export function unionIntervals(a, b) {
  const all = [...a, ...b].sort((x, y) => x[0] - y[0])
  const out = []
  for (const [s, e] of all) {
    if (out.length && out[out.length - 1][1] >= s)
      out[out.length - 1][1] = Math.max(out[out.length - 1][1], e)
    else out.push([s, e])
  }
  return out
}
const complement = (ints, length) => {
  const out = []
  let c = 0
  for (const [s, e] of ints) {
    if (s > c) out.push([c, s])
    c = Math.max(c, e)
  }
  if (c < length) out.push([c, length])
  return out
}
const inIntervals = (ints, x) => {
  let lo = 0
  let hi = ints.length - 1
  while (lo <= hi) {
    const m = (lo + hi) >> 1
    if (x < ints[m][0]) hi = m - 1
    else if (x >= ints[m][1]) lo = m + 1
    else return true
  }
  return false
}

// ---------- md4 (webpack 4 HashedModuleIdsPlugin) ----------
export function md4(input) {
  const msg = Buffer.from(input, 'utf8')
  const ml = msg.length
  const padLen = (((ml + 8) >> 6) + 1) << 6
  const buf = new Uint8Array(padLen)
  buf.set(msg)
  buf[ml] = 0x80
  const dv = new DataView(buf.buffer)
  const bits = ml * 8
  dv.setUint32(padLen - 8, bits >>> 0, true)
  dv.setUint32(padLen - 4, Math.floor(bits / 2 ** 32), true)
  const rotl = (x, n) => (x << n) | (x >>> (32 - n))
  const F = (x, y, z) => (x & y) | (~x & z)
  const G = (x, y, z) => (x & y) | (x & z) | (y & z)
  const H = (x, y, z) => x ^ y ^ z
  const R = [
    [
      F,
      0,
      [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15],
      [3, 7, 11, 19],
    ],
    [
      G,
      0x5a827999,
      [0, 4, 8, 12, 1, 5, 9, 13, 2, 6, 10, 14, 3, 7, 11, 15],
      [3, 5, 9, 13],
    ],
    [
      H,
      0x6ed9eba1,
      [0, 8, 4, 12, 2, 10, 6, 14, 1, 9, 5, 13, 3, 11, 7, 15],
      [3, 9, 11, 15],
    ],
  ]
  let h = [0x67452301, 0xefcdab89, 0x98badcfe, 0x10325476]
  for (let off = 0; off < padLen; off += 64) {
    const X = Array.from({ length: 16 }, (_, i) =>
      dv.getUint32(off + i * 4, true)
    )
    let v = h.slice()
    for (const [fn, k, idx, sh] of R)
      for (let i = 0; i < 16; i++) {
        const [a, b, c, d] = v
        v = [d, rotl((a + fn(b, c, d) + X[idx[i]] + k) | 0, sh[i % 4]), b, c]
      }
    h = h.map((x, i) => (x + v[i]) | 0)
  }
  const out = Buffer.alloc(16)
  h.forEach((x, i) => out.writeUInt32LE(x >>> 0, i * 4))
  return out
}
export const webpackHashedId = (rel, length = 4) =>
  md4(`./${rel}`).toString('base64').slice(0, length)

// ---------- source maps ----------
const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'
const B64V = Object.fromEntries([...B64].map((c, i) => [c, i]))
// mappings -> per generated line: [[genCol, srcIdx, origLine, origCol] | [genCol]] sorted by genCol
export function decodeMappings(mappings) {
  const lines = []
  let src = 0
  let ol = 0
  let oc = 0
  for (const lineStr of mappings.split(';')) {
    const segs = []
    let gc = 0
    if (lineStr) {
      for (const segStr of lineStr.split(',')) {
        if (!segStr) continue
        const vals = []
        let v = 0
        let shift = 0
        for (const ch of segStr) {
          const d = B64V[ch]
          v += (d & 31) << shift
          if (d & 32) shift += 5
          else {
            vals.push(v & 1 ? -(v >>> 1) : v >>> 1)
            v = 0
            shift = 0
          }
        }
        gc += vals[0]
        if (vals.length >= 4) {
          src += vals[1]
          ol += vals[2]
          oc += vals[3]
          segs.push([gc, src, ol, oc])
        } else segs.push([gc])
      }
    }
    segs.sort((a, b) => a[0] - b[0])
    lines.push(segs)
  }
  return lines
}
const segmentAt = (lines, line0, col) => {
  const segs = lines[line0]
  if (!segs || !segs.length) return null
  let lo = 0
  let hi = segs.length - 1
  let hit = -1
  while (lo <= hi) {
    const m = (lo + hi) >> 1
    if (segs[m][0] <= col) {
      hit = m
      lo = m + 1
    } else hi = m - 1
  }
  return hit < 0 ? null : segs[hit]
}
// `webpack:///./api/index.js` (server), `webpack://_N_E/./api/index.js` (client) -> `api/index.js`; others
// (externals, the webpack runtime, Next's own sources) -> null
export const sourceRel = (s) => {
  const m = /^webpack:\/\/[^/]*\/\.\/(.+?)(?:\?.*)?$/.exec(s)
  return m ? m[1] : null
}

// ---------- lines (the statements v8-to-istanbul counts) ----------
export const sourceLines = (text) => (text || '').trimEnd().split(/(?<=\r?\n)/u)
const isCodeLine = (l, inBlock) => {
  const t = l.trim()
  if (inBlock.v) {
    if (t.includes('*/')) inBlock.v = false
    return false
  }
  if (t === '' || t.startsWith('//')) return false
  if (t.startsWith('/*')) {
    if (!t.includes('*/')) inBlock.v = true
    return false
  }
  return true
}
export const codeLineMask = (text) => {
  const st = { v: false }
  return sourceLines(text).map((l) => isCodeLine(l, st))
}

// ---------- app files at --ref ----------
// app files plus the root *.config.js files next start loads (for (b))
function appFilesAt(ref) {
  const names = git('ls-tree', '-r', '--name-only', ref)
    .split('\n')
    .filter(Boolean)
    .filter((p) => isApp(p) || (!p.includes('/') && /\.config\.js$/.test(p)))
  const out = new Map()
  for (const rel of names) {
    const text = execFileSync('git', ['-C', REPO, 'show', `${ref}:${rel}`], {
      encoding: 'utf8',
      maxBuffer: 64 * 1024 * 1024,
    })
    out.set(rel, text)
  }
  return out
}

// ---------- preloads (generated into --out, never into the checkout) ----------
const BROWSER_PRELOAD = (
  core
) => `// generated by scripts/merge-coverage.mjs: Chromium JS coverage of every page (55 C3)
'use strict'
const fs = require('fs')
const path = require('path')
const crypto = require('crypto')
const DIR = process.env.P2_BROWSER_COVERAGE_DIR
if (DIR && /[\\\\/](?:playwright|@playwright[\\\\/]test)[\\\\/]/.test(process.argv[1] || '')) {
  ${executedIntervals.toString()}
  ${unionIntervals.toString()}
  const state = new Map()
  const file = path.join(DIR, 'browser-' + process.pid + '.json')
  fs.mkdirSync(path.join(DIR, 'src'), { recursive: true })
  const flush = () => {
    const out = {}
    for (const [url, v] of state) out[url] = v
    fs.writeFileSync(file + '.tmp', JSON.stringify(out))
    fs.renameSync(file + '.tmp', file)
  }
  const absorb = (entries) => {
    for (const e of entries) {
      if (!/\\/_next\\/static\\//.test(e.url) || typeof e.source !== 'string') continue
      const url = e.url.replace(/^[a-z]+:\\/\\/[^/]+/, '').replace(/[?#].*$/, '')
      const sha = crypto.createHash('sha256').update(e.source).digest('hex')
      const src = path.join(DIR, 'src', sha + '.js')
      if (!fs.existsSync(src)) fs.writeFileSync(src, e.source)
      const ex = executedIntervals(e.functions, e.source.length)
      const key = url + '#' + sha
      const prev = state.get(key)
      state.set(key, { url, sha, length: e.source.length, executed: prev ? unionIntervals(prev.executed, ex) : ex, pages: (prev ? prev.pages : 0) + 1 })
    }
  }
  const starting = new WeakMap()
  const start = (page) => {
    if (!starting.has(page))
      starting.set(page, page.coverage.startJSCoverage({ resetOnNavigation: false, reportAnonymousScripts: false }).catch(() => null))
    return starting.get(page)
  }
  const stop = async (page) => {
    if (!starting.has(page)) return
    const p = starting.get(page)
    starting.delete(page)
    await p
    // a crashed or hung page must not hold up the test's teardown
    const timeout = new Promise((resolve) => setTimeout(() => resolve(null), 15000).unref())
    try {
      const entries = await Promise.race([page.coverage.stopJSCoverage(), timeout])
      if (entries) absorb(entries)
    } catch (e) {}
  }
  let pw = null
  try { pw = require(${JSON.stringify(core)}) } catch (e) { pw = null }
  if (pw) {
    const done = new WeakSet()
    const wrap = (proto, name, fn) => {
      const orig = proto[name]
      if (typeof orig !== 'function') return
      proto[name] = function (...a) { return fn.call(this, orig, a) }
    }
    const patchPage = (page) => {
      const proto = Object.getPrototypeOf(page)
      if (done.has(proto)) return
      done.add(proto)
      wrap(proto, 'close', async function (orig, a) { await stop(this); return orig.apply(this, a) })
    }
    const patchContext = (ctx) => {
      ctx.on('page', (p) => { patchPage(p); start(p) })
      const proto = Object.getPrototypeOf(ctx)
      if (done.has(proto)) return
      done.add(proto)
      wrap(proto, 'newPage', async function (orig, a) { const page = await orig.apply(this, a); patchPage(page); await start(page); return page })
      wrap(proto, 'close', async function (orig, a) { for (const p of this.pages()) await stop(p); flush(); return orig.apply(this, a) })
    }
    const patchBrowser = (b) => {
      const proto = Object.getPrototypeOf(b)
      if (done.has(proto)) return
      done.add(proto)
      wrap(proto, 'newContext', async function (orig, a) { const ctx = await orig.apply(this, a); patchContext(ctx); return ctx })
    }
    wrap(Object.getPrototypeOf(pw.chromium), 'launch', async function (orig, a) { const b = await orig.apply(this, a); patchBrowser(b); return b })
    process.on('exit', flush)
  }
}
`
// the app process: write the NODE_V8_COVERAGE profile when the stack stops it (SIGTERM would end the process
// without writing it)
const SERVER_PRELOAD = `// generated by scripts/merge-coverage.mjs: NODE_V8_COVERAGE profile of next start on SIGTERM (55 C3)
'use strict'
const v8 = require('v8')
process.once('SIGTERM', () => {
  try { v8.takeCoverage(); v8.stopCoverage() } catch (e) {}
  process.exit(0)
})
`

// ---------- collect ----------
function run(cmd, args, opts = {}) {
  console.error(`$ ${[cmd, ...args].join(' ')}`)
  const r = spawnSync(cmd, args, { stdio: 'inherit', cwd: REPO, ...opts })
  return r.status ?? 1
}

// the e2e tiers, one Playwright invocation each: chromium; wire with `--no-deps` (the project depends on chromium,
// so one red chromium test would leave every wire test unrun); visual without T-802 (it runs on the harness
// variant build: another build, another stack, not part of this measurement)
const E2E_GROUPS = {
  chromium: ['--project', 'chromium'],
  wire: ['--no-deps', '--project', 'wire'],
  visual: ['--project', 'visual', '--grep-invert', 'T-802'],
}

function collect(o) {
  const log = { startedAt: new Date().toISOString(), steps: [] }
  fs.mkdirSync(o.out, { recursive: true })
  if (!o.skipJest) {
    const dir = path.join(o.out, 'jest')
    fs.rmSync(dir, { recursive: true, force: true })
    fs.mkdirSync(dir, { recursive: true })
    const code = run(
      runtimeNode(),
      [
        path.join(REPO, 'node_modules', 'jest', 'bin', 'jest.js'),
        '--selectProjects',
        'node',
        'dom',
        '--coverage',
        '--coverageProvider=v8',
        '--coverageReporters=json',
        `--coverageDirectory=${dir}`,
        `--collectCoverageFrom={${APP_DIRS.join(',')}}/**/*.{js,jsx,ts,tsx}`,
        '--json',
        `--outputFile=${path.join(dir, 'report.json')}`,
      ],
      { env: { ...process.env, TZ: 'UTC' } }
    )
    log.steps.push({ part: 'jest', exit: code })
    if (o.withStatic && o.build) {
      // T-014 (a) compares two builds of one tree: the build of --ref and its rebuild (`<key>-vf09`, VF-09)
      const twin = `${o.build.dir}-vf09`
      const scode = run(
        runtimeNode(),
        [
          path.join(REPO, 'node_modules', 'jest', 'bin', 'jest.js'),
          '--selectProjects',
          'static',
          '--json',
          `--outputFile=${path.join(dir, 'report-static.json')}`,
        ],
        {
          env: {
            ...process.env,
            TZ: 'UTC',
            NEXT_DIR: path.join(o.build.dir, '.next'),
            APP_ROOT: o.build.dir,
            NEXT_DIR_A: path.join(o.build.dir, '.next'),
            ...(fs.existsSync(path.join(twin, '.next', 'BUILD_ID'))
              ? { NEXT_DIR_B: path.join(twin, '.next') }
              : {}),
          },
        }
      )
      log.steps.push({ part: 'static', exit: scode })
    }
  }
  if (!o.skipE2e) {
    const pre = path.join(o.out, 'preload')
    fs.mkdirSync(pre, { recursive: true })
    const core = createRequire(path.join(REPO, 'e2e', 'package.json')).resolve(
      'playwright-core'
    )
    fs.writeFileSync(path.join(pre, 'browser.cjs'), BROWSER_PRELOAD(core))
    fs.writeFileSync(path.join(pre, 'server.cjs'), SERVER_PRELOAD)
    // --append keeps the data of an earlier collect into the same --out (e.g. a re-run of tests that were red)
    if (!o.append)
      for (const d of ['browser', 'server', 'e2e'])
        fs.rmSync(path.join(o.out, d), { recursive: true, force: true })
    const serverRaw = path.join(o.out, 'server', 'raw')
    const browserRaw = path.join(o.out, 'browser', 'raw')
    fs.mkdirSync(serverRaw, { recursive: true })
    fs.mkdirSync(browserRaw, { recursive: true })
    fs.mkdirSync(path.join(o.out, 'e2e'), { recursive: true })
    const stack = path.join(REPO, 'scripts', 'e2e-stack.mjs')
    const up = run(process.execPath, [
      stack,
      'up',
      '--run',
      o.run,
      '--ref',
      o.ref,
      '--app-env',
      `NODE_V8_COVERAGE=${serverRaw}`,
      '--app-env',
      `NODE_OPTIONS=--require=${path.join(pre, 'server.cjs')}`,
    ])
    log.steps.push({ part: 'e2e:up', exit: up })
    try {
      if (up !== 0) throw new Error(`e2e:up failed (${up})`)
      const env = {
        ...process.env,
        NODE_OPTIONS: [
          process.env.NODE_OPTIONS || '',
          `--require ${path.join(pre, 'browser.cjs')}`,
        ]
          .join(' ')
          .trim(),
        P2_BROWSER_COVERAGE_DIR: browserRaw,
      }
      const groups = Object.keys(E2E_GROUPS).filter(
        (g) =>
          (!o.only.length || o.only.includes(g)) &&
          !(g === 'visual' && o.skipVisual)
      )
      for (const g of groups) {
        const report = path.join(ARTIFACT_DIR, 'runs', o.run, 'report.json')
        fs.rmSync(report, { force: true })
        const code = run(
          process.execPath,
          [stack, 'test', '--run', o.run, ...o.pw, ...E2E_GROUPS[g]],
          { env }
        )
        let n = 1
        while (fs.existsSync(path.join(o.out, 'e2e', `report-${g}-${n}.json`)))
          n++
        if (fs.existsSync(report))
          fs.copyFileSync(
            report,
            path.join(o.out, 'e2e', `report-${g}-${n}.json`)
          )
        log.steps.push({ part: `e2e ${E2E_GROUPS[g].join(' ')}`, exit: code })
      }
    } finally {
      log.steps.push({
        part: 'e2e:down',
        exit: run(process.execPath, [stack, 'down', '--run', o.run]),
      })
    }
  }
  log.endedAt = new Date().toISOString()
  const logFile = path.join(o.out, 'collect.json')
  const prev = o.append ? readJson(logFile, null) : null
  writeJson(
    logFile,
    prev ? { ...prev, appended: [...(prev.appended || []), log] } : log
  )
  return log
}

// ---------- merge ----------
function loadV8() {
  try {
    return requireRoot('v8-to-istanbul')
  } catch {
    throw new Error(
      'v8-to-istanbul not found in node_modules (it ships with Jest): run npm ci'
    )
  }
}

// a bundle's executed intervals -> per app file, per line: 1 run / 0 not run (v8-to-istanbul semantics)
async function bundleLines(v8toIstanbul, bundlePath, source, map, executed) {
  // a bundle whose map names no app source adds nothing (e.g. the empty `*_CSS` chunks: `sources: []`, which
  // v8-to-istanbul would resolve against the bundle's own path)
  if (!map.sources.some((s) => isApp(sourceRel(s) || ''))) return new Map()
  const appIdx = new Map()
  const sources = map.sources.map((s, i) => {
    const rel = sourceRel(s)
    if (rel) appIdx.set(i, rel)
    return rel
      ? pathToFileURL(path.join(REPO, rel)).href
      : `file:///__other__/${i}`
  })
  const sourcesContent = map.sources.map((s, i) =>
    appIdx.has(i) ? (map.sourcesContent || [])[i] || '' : ''
  )
  const sm = { ...map, sources, sourcesContent, sourceRoot: '' }
  const keep = new Set([...appIdx.values()].map((r) => path.join(REPO, r)))
  const exclude = (p) => {
    const f = p.startsWith('file://') ? fileURLToPath(p) : p
    return !keep.has(f)
  }
  const conv = v8toIstanbul(
    bundlePath,
    0,
    { source, sourceMap: { sourcemap: sm } },
    exclude
  )
  await conv.load()
  const ranges = [{ startOffset: 0, endOffset: source.length, count: 1 }]
  for (const [s, e] of complement(executed, source.length))
    ranges.push({ startOffset: s, endOffset: e, count: 0 })
  conv.applyCoverage([
    { functionName: '(merged)', isBlockCoverage: true, ranges },
  ])
  const ist = conv.toIstanbul()
  const out = new Map()
  for (const [abs, fc] of Object.entries(ist)) {
    const rel = path.relative(REPO, abs).split(path.sep).join('/')
    const n = Object.keys(fc.statementMap).length
    const lines = new Uint8Array(n)
    for (const [k, loc] of Object.entries(fc.statementMap))
      lines[loc.start.line - 1] = fc.s[k] > 0 ? 1 : 0
    out.set(rel, lines)
  }
  return out
}

async function directLines(v8toIstanbul, file, source, executed) {
  const conv = v8toIstanbul(file, 0, { source })
  await conv.load()
  const ranges = [{ startOffset: 0, endOffset: source.length, count: 1 }]
  for (const [s, e] of complement(executed, source.length))
    ranges.push({ startOffset: s, endOffset: e, count: 0 })
  conv.applyCoverage([
    { functionName: '(merged)', isBlockCoverage: true, ranges },
  ])
  const fc = Object.values(conv.toIstanbul())[0]
  const lines = new Uint8Array(Object.keys(fc.statementMap).length)
  for (const [k, loc] of Object.entries(fc.statementMap))
    lines[loc.start.line - 1] = fc.s[k] > 0 ? 1 : 0
  return lines
}

function readServerRaw(dir, buildDir) {
  const scripts = new Map() // abs path -> executed
  if (!fs.existsSync(dir)) return scripts
  for (const f of fs.readdirSync(dir).filter((x) => x.endsWith('.json'))) {
    const d = readJson(path.join(dir, f))
    if (!d || !d.result) continue
    for (const s of d.result) {
      if (!s.url.startsWith('file://')) continue
      const abs = fileURLToPath(s.url)
      if (!abs.startsWith(buildDir + path.sep)) continue
      const rel = path.relative(buildDir, abs).split(path.sep).join('/')
      if (
        rel.startsWith('node_modules/') &&
        !rel.startsWith('node_modules/@oacore/design/')
      )
        continue
      let text
      try {
        text = fs.readFileSync(abs, 'utf8')
      } catch {
        continue
      }
      const ex = executedIntervals(s.functions, text.length)
      scripts.set(rel, unionIntervals(scripts.get(rel) || [], ex))
    }
  }
  return scripts
}

export function readBrowserRaw(dir) {
  const scripts = new Map() // url#sha -> {url, sha, length, executed}
  if (!fs.existsSync(dir)) return scripts
  for (const f of fs
    .readdirSync(dir)
    .filter((x) => /^browser-\d+\.json$/.test(x))) {
    const d = readJson(path.join(dir, f), {})
    for (const [k, v] of Object.entries(d)) {
      const prev = scripts.get(k)
      scripts.set(k, {
        ...v,
        executed: prev ? unionIntervals(prev.executed, v.executed) : v.executed,
        pages: (prev ? prev.pages : 0) + v.pages,
      })
    }
  }
  return scripts
}

// executed statements inside app module functions, and whether the map attributes each to an app source
// webpack's module glue (import bindings, export getters, interop helpers) is generated code with no source
// position: a call of the module's require parameter (`__webpack_require__(..)`, `n.d(..)`, `n.n(..)`, `n.r(..)`)
// with everything inside it (the export getters), a call that wraps one (`_interopRequireDefault(n(..))`), an
// assignment to the module's exports parameter (`__webpack_exports__["a"] = ..`), Babel's `_excluded` key lists
// (object rest), and the `(function(module) {..}).call(this, n(..))` wrapper of a module that reads `module`
// (its body is app code and is counted). Units: a declarator of a variable declaration, an expression of a comma
// sequence (minified code joins statements), else a statement.
const isReqCall = (node, ctx) => {
  if (!node || node.type !== 'CallExpression') return false
  const c = node.callee
  return (
    (c.type === 'Identifier' && c.name === ctx.req) ||
    (c.type === 'MemberExpression' &&
      c.object.type === 'Identifier' &&
      c.object.name === ctx.req)
  )
}
const isGlue = (node, ctx) => {
  if (!node) return false
  if (node.type === 'CallExpression')
    return isReqCall(node, ctx) || node.arguments.some((a) => isReqCall(a, ctx))
  if (node.type === 'SequenceExpression')
    return node.expressions.every((x) => isGlue(x, ctx))
  if (node.type === 'AssignmentExpression')
    return (
      node.left.type === 'MemberExpression' &&
      node.left.object.type === 'Identifier' &&
      node.left.object.name === ctx.exp
    )
  return false
}
// `(function (module) { .. }).call(this, n("..."))`: the function body
const moduleWrapperBody = (node, ctx) =>
  node &&
  node.type === 'CallExpression' &&
  node.callee.type === 'MemberExpression' &&
  node.callee.object.type === 'FunctionExpression' &&
  node.arguments.some((a) => isReqCall(a, ctx))
    ? node.callee.object.body
    : null
const unitsOf = (stmt, ctx) => {
  if (stmt.type === 'VariableDeclaration')
    return stmt.declarations.map((d) => ({
      node: d,
      glue:
        isGlue(d.init, ctx) ||
        (d.id.type === 'Identifier' && /^_excluded\d*$/.test(d.id.name)),
    }))
  if (stmt.type === 'ExpressionStatement') {
    const e = stmt.expression
    if (e.type === 'SequenceExpression')
      return e.expressions.map((x) => ({
        node: x,
        glue: isGlue(x, ctx),
        wrapper: moduleWrapperBody(x, ctx),
      }))
    return [
      { node: stmt, glue: isGlue(e, ctx), wrapper: moduleWrapperBody(e, ctx) },
    ]
  }
  return [{ node: stmt, glue: false }]
}

// code Babel synthesises for app code (no original position): class and decorator temporaries, object-rest key
// lists, the inlined objectSpread/createSuper/callSuper helpers, the asyncToGenerator wrappers and the
// constructor of a derived class that declares none. Unminified (server) bundles keep the helper names; minified
// (client) bundles are matched by the shape of the unit's code (BABEL_SHAPES). Only units without a source
// position are classified, so a match never moves an attributed unit; the class is printed, never gating.
const BABEL_HELPER =
  /(^|_)(class|descriptor\d*|excluded\d*|temp\d*|this\d+|ownKeys|objectSpread\d*|createSuper|callSuper|isNativeReflectConstruct|babelHelper)$/
const ID = '[\\w$]+'
export const BABEL_SHAPES = [
  // object-rest key list: _excluded = ["a", "b"]
  new RegExp(`^${ID}\\s*=\\s*\\[(?:"[^"\\\\]*"(?:,\\s*"[^"\\\\]*")*)?\\]$`),
  // ownKeys(object, enumerableOnly)
  new RegExp(
    `^function ${ID}\\(${ID},\\s*${ID}\\)\\s*\\{\\s*var ${ID}\\s*=\\s*Object\\.keys\\(${ID}\\);\\s*if\\s*\\(Object\\.getOwnPropertySymbols\\)`
  ),
  // _objectSpread2(target)
  new RegExp(
    `^function ${ID}\\(${ID}\\)\\s*\\{\\s*for\\s*\\(var ${ID}\\s*=\\s*1;\\s*${ID}\\s*<\\s*arguments\\.length;\\s*${ID}\\+\\+\\)\\s*\\{\\s*var ${ID}\\s*=\\s*null\\s*!=\\s*arguments\\[${ID}\\]\\s*\\?\\s*arguments\\[${ID}\\]\\s*:\\s*\\{\\}`
  ),
  // _createSuper / _callSuper / _isNativeReflectConstruct
  /^function [\w$]+\([\w$,\s]*\)\s*\{[^]*?(?:"undefined"\s*===\s*typeof Reflect|typeof Reflect\s*===\s*"undefined")\s*\|\|\s*!Reflect\.construct/,
  // the constructor Babel writes for a derived class without one
  new RegExp(
    `^function (${ID})\\(\\)\\s*\\{\\s*(?:return\\s+)?${ID}\\(\\)\\(this,\\s*\\1\\)[,;]\\s*(?:return\\s+)?${ID}\\(this,\\s*\\1,\\s*arguments\\);?\\s*\\}$`
  ),
  // the end of a class expression wrapper: `return _inherits(C, Super), _createClass(C)`
  new RegExp(
    `^return\\s+${ID}\\(\\)\\(${ID},\\s*${ID}\\),\\s*${ID}\\(\\)\\(${ID}\\);?$`
  ),
  // the class helpers as statements (unminified): `inherits_default()(C, Super);`, `return createClass_default()(C);`
  /^(?:return\s+)?(?:inherits|createClass|classCallCheck)_default\(\)\([\w$,\s]*\);?$/,
  // asyncToGenerator wrappers: `return _f.apply(this, arguments)`, `return function (a) { return f.apply(..) }`
  new RegExp(
    `^return\\s+(?:function\\s*\\([\\w$,\\s]*\\)\\s*\\{\\s*return\\s+)?${ID}\\.apply\\(this,\\s*arguments\\);?(?:\\s*\\})?;?$`
  ),
]
const isBabelHelper = (node, stack, text) => {
  if (stack.some((n) => BABEL_HELPER.test(n))) return true
  if (
    node.type === 'VariableDeclarator' &&
    node.id.type === 'Identifier' &&
    (BABEL_HELPER.test(node.id.name) || node.init === null)
  )
    // a declarator without a value and without a position: the decorator temporaries (`var _class, _descriptor`)
    return true
  if (
    node.type === 'FunctionDeclaration' &&
    !!node.id &&
    BABEL_HELPER.test(node.id.name)
  )
    return true
  return BABEL_SHAPES.some((re) => re.test(text))
}

const firstMappedInside = (lines, loc) => {
  for (
    let l = loc.start.line - 1;
    l <= loc.end.line - 1 && l < lines.length;
    l++
  )
    for (const seg of lines[l] || []) {
      if (l === loc.start.line - 1 && seg[0] < loc.start.column) continue
      if (l === loc.end.line - 1 && seg[0] >= loc.end.column) break
      if (seg.length >= 4) return seg
    }
  return null
}

// executed statement units inside the app modules of a bundle, and where the source map puts each
export function attribution({ source, map, executed, appIds, maxMisses = 20 }) {
  const babelParser = requireRoot('@babel/parser')
  const ast = babelParser.parse(source, {
    sourceType: 'script',
    allowReturnOutsideFunction: true,
    errorRecovery: true,
  })
  const lines = decodeMappings(map.mappings)
  const res = {
    executed: 0,
    app: 0,
    other: 0,
    unmapped: 0,
    helper: 0,
    glue: 0,
    modules: 0,
    misses: [],
    otherSources: {},
  }
  const stack = [] // enclosing function names (Babel helpers are recognised by name in unminified bundles)
  // counts the units of a statement; returns the subtrees to walk next (glue subtrees are skipped)
  const count = (node, ctx) => {
    const next = []
    for (const u of unitsOf(node, ctx)) {
      if (u.wrapper) {
        res.glue++
        next.push(u.wrapper)
        continue
      }
      if (u.glue) {
        if (inIntervals(executed, u.node.start)) res.glue++
        continue
      }
      next.push(u.node)
      if (!inIntervals(executed, u.node.start)) continue
      res.executed++
      // the mapping at the unit's start, else the first mapping inside the unit that names a source
      let seg = segmentAt(
        lines,
        u.node.loc.start.line - 1,
        u.node.loc.start.column
      )
      if (!seg || seg.length < 4) seg = firstMappedInside(lines, u.node.loc)
      const rel = seg ? sourceRel(map.sources[seg[1]]) : null
      if (rel && isApp(rel)) res.app++
      else if (seg) {
        res.other++
        const name = map.sources[seg[1]]
        res.otherSources[name] = (res.otherSources[name] || 0) + 1
      } else {
        res.unmapped++
        if (
          isBabelHelper(
            u.node,
            stack,
            source.slice(u.node.start, u.node.end).trim()
          )
        )
          res.helper++
        else if (res.misses.length < maxMisses)
          res.misses.push({
            line: u.node.loc.start.line,
            column: u.node.loc.start.column,
            type: u.node.type,
            text: source.slice(
              u.node.start,
              Math.min(u.node.end, u.node.start + 60)
            ),
          })
      }
    }
    return next
  }
  const children = (node, visit) => {
    for (const key of Object.keys(node)) {
      if (
        key === 'loc' ||
        key === 'leadingComments' ||
        key === 'trailingComments' ||
        key === 'innerComments'
      )
        continue
      const v = node[key]
      if (Array.isArray(v)) for (const c of v) visit(c)
      else if (v && typeof v.type === 'string') visit(v)
    }
  }
  const walk = (node, ctx) => {
    if (!node || typeof node.type !== 'string') return
    if (ctx && node.type === 'FunctionDeclaration') {
      // a helper recognised by its shape (minified): no source position anywhere inside it
      const shape =
        BABEL_SHAPES.some((re) =>
          re.test(source.slice(node.start, node.end).trim())
        ) && !firstMappedInside(lines, node.loc)
      stack.push(shape ? '_babelHelper' : node.id ? node.id.name : '')
      for (const n of count(node, ctx)) children(n, (c) => walk(c, ctx))
      stack.pop()
      return
    }
    if (ctx) {
      if (
        /(Statement|Declaration)$/.test(node.type) &&
        node.type !== 'BlockStatement'
      ) {
        for (const n of count(node, ctx)) {
          if (
            n === node ||
            n.type === 'VariableDeclarator' ||
            node.type !== 'ExpressionStatement'
          )
            children(n, (c) => walk(c, ctx))
          else walk(n, ctx)
        }
        return
      }
      children(node, (c) => walk(c, ctx))
      return
    }
    children(node, (c) => {
      if (
        c &&
        c.type === 'ObjectProperty' &&
        (c.value.type === 'FunctionExpression' ||
          c.value.type === 'ArrowFunctionExpression')
      ) {
        const k = c.key
        const id =
          k.type === 'StringLiteral'
            ? k.value
            : k.type === 'Identifier'
            ? k.name
            : k.type === 'NumericLiteral'
            ? String(k.value)
            : null
        if (id !== null && appIds.has(id)) {
          res.modules++
          const [, e, r] = c.value.params
          walk(c.value.body, {
            req: r && r.name,
            exp: e && e.name,
            file: appIds.get(id),
          })
          return
        }
      }
      walk(c, null)
    })
  }
  walk(ast.program, null)
  return res
}

export function appModuleIds(rels, bundlesText) {
  // shortest prefix (from 4) that is not shared with another app path; a prefix shared with a non-app module
  // cannot be told apart and is reported
  const ids = new Map()
  const full = rels.map((r) => [r, md4(`./${r}`).toString('base64')])
  for (const [r, h] of full) {
    let len = 4
    while (
      full.some(([r2, h2]) => r2 !== r && h2.slice(0, len) === h.slice(0, len))
    )
      len++
    ids.set(h.slice(0, len), r)
  }
  return ids
}

async function merge(o) {
  const v8toIstanbul = loadV8()
  const build = o.build
  if (!build)
    throw new Error(`no host build of ${o.ref}: run npm run build:parity first`)
  const files = appFilesAt(o.ref)
  const appRels = [...files.keys()].filter(isApp)
  // the working tree must hold the same app files (Jest ran on it)
  const drift = appRels.filter((r) => {
    try {
      return fs.readFileSync(path.join(REPO, r), 'utf8') !== files.get(r)
    } catch {
      return true
    }
  })
  const per = new Map() // rel -> {n, code, jest, browser, server}
  const entry = (rel) => {
    if (!per.has(rel)) {
      const text = files.get(rel)
      per.set(rel, {
        n: text === undefined ? null : sourceLines(text).length,
        code: text === undefined ? null : codeLineMask(text),
        jest: null,
        browser: null,
        server: null,
      })
    }
    return per.get(rel)
  }
  const orInto = (e, key, lines) => {
    if (e.n === null) e.n = lines.length
    if (lines.length !== e.n) {
      e.mismatch = (e.mismatch || []).concat(
        `${key}: ${lines.length} lines vs ${e.n}`
      )
      return
    }
    if (!e[key]) e[key] = new Uint8Array(e.n)
    for (let i = 0; i < e.n; i++) if (lines[i]) e[key][i] = 1
  }
  for (const r of appRels) entry(r)

  // jest
  const jestFinal = readJson(
    path.join(o.out, 'jest', 'coverage-final.json'),
    null
  )
  if (jestFinal)
    for (const [abs, fc] of Object.entries(jestFinal)) {
      const rel = path.relative(REPO, abs).split(path.sep).join('/')
      if (!isApp(rel)) continue
      const n = Object.keys(fc.statementMap).length
      const lines = new Uint8Array(n)
      for (const [k, loc] of Object.entries(fc.statementMap))
        if (fc.s[k] > 0) lines[loc.start.line - 1] = 1
      orInto(entry(rel), 'jest', lines)
    }

  const next = path.join(build.dir, '.next')
  const mapOf = (abs) => readJson(`${abs}.map`, null)
  const appIds = appModuleIds(appRels)
  const attr = {
    server: {
      bundles: 0,
      executed: 0,
      app: 0,
      other: 0,
      unmapped: 0,
      helper: 0,
      glue: 0,
      modules: 0,
      files: [],
    },
    client: {
      bundles: 0,
      executed: 0,
      app: 0,
      other: 0,
      unmapped: 0,
      helper: 0,
      glue: 0,
      modules: 0,
      files: [],
    },
  }
  const addAttr = (kind, rel, a) => {
    const t = attr[kind]
    t.bundles++
    for (const k of [
      'executed',
      'app',
      'other',
      'unmapped',
      'helper',
      'glue',
      'modules',
    ])
      t[k] += a[k]
    t.otherSources = t.otherSources || {}
    for (const [src, n] of Object.entries(a.otherSources || {}))
      t.otherSources[src] = (t.otherSources[src] || 0) + n
    if (a.executed) t.files.push({ bundle: rel, ...a })
  }
  const blackboxExtra = new Map() // non-app files run by black-box tests (root configs, design): rel -> lines

  // browser
  const browser = readBrowserRaw(path.join(o.out, 'browser', 'raw'))
  const byFile = new Map()
  for (const v of browser.values()) {
    const rel = v.url.replace(/^.*?\/_next\//, '')
    const abs = path.join(next, rel)
    if (!fs.existsSync(abs)) continue
    const text = fs.readFileSync(abs, 'utf8')
    if (sha256(text) !== v.sha) continue // another build's chunk
    const prev = byFile.get(abs)
    byFile.set(abs, {
      text,
      executed: prev ? unionIntervals(prev.executed, v.executed) : v.executed,
    })
  }
  for (const [abs, { text, executed }] of byFile) {
    const map = mapOf(abs)
    if (!map) continue
    const lines = await bundleLines(v8toIstanbul, abs, text, map, executed)
    for (const [rel, l] of lines)
      if (isApp(rel)) orInto(entry(rel), 'browser', l)
    addAttr(
      'client',
      path.relative(next, abs),
      attribution({ source: text, map, executed, appIds })
    )
  }

  // server
  const server = readServerRaw(path.join(o.out, 'server', 'raw'), build.dir)
  for (const [rel, executed] of server) {
    const abs = path.join(build.dir, rel)
    const text = fs.readFileSync(abs, 'utf8')
    if (rel.startsWith('.next/')) {
      const map = mapOf(abs)
      if (!map) continue
      const lines = await bundleLines(v8toIstanbul, abs, text, map, executed)
      for (const [r, l] of lines) if (isApp(r)) orInto(entry(r), 'server', l)
      addAttr(
        'server',
        rel,
        attribution({ source: text, map, executed, appIds })
      )
    } else {
      // a file next start loads as it is (next.config.js and what it requires, design runtime files)
      const lines = await directLines(v8toIstanbul, abs, text, executed)
      if (isApp(rel)) orInto(entry(rel), 'server', lines)
      else blackboxExtra.set(rel, lines)
    }
  }

  // (a)
  const total = { n: 0, code: 0 }
  const counts = {
    all: 0,
    jest: 0,
    browser: 0,
    server: 0,
    blackbox: 0,
    fallback: 0,
  }
  const codeCounts = { all: 0, fallback: 0 }
  const perFile = []
  for (const rel of appRels.sort()) {
    const e = per.get(rel)
    const n = e.n || 0
    total.n += n
    const f = { file: rel, statements: n }
    const run = (keys) => {
      let c = 0
      let cc = 0
      for (let i = 0; i < n; i++)
        if (keys.some((k) => e[k] && e[k][i])) {
          c++
          if (e.code[i]) cc++
        }
      return [c, cc]
    }
    for (const [name, keys] of Object.entries({
      jest: ['jest'],
      browser: ['browser'],
      server: ['server'],
      blackbox: ['browser', 'server'],
      fallback: ['jest', 'browser'],
      all: ['jest', 'browser', 'server'],
    })) {
      const [c, cc] = run(keys)
      counts[name] += c
      f[name] = c
      if (name === 'all') codeCounts.all += cc
      if (name === 'fallback') codeCounts.fallback += cc
    }
    const code = e.code.filter(Boolean).length
    total.code += code
    f.codeLines = code
    if (e.mismatch) f.mismatch = e.mismatch
    perFile.push(f)
  }
  // strict (the 55 C3 rule): units the map attributes to an original source / executed units of app modules;
  // also printed: the app share, and the ratio without the recognised Babel helper units
  const ratio = (t) => ({
    ...t,
    attributedPct: pct(t.app + t.other, t.executed),
    appPct: pct(t.app, t.executed),
    withoutHelpersPct: pct(t.app + t.other, t.executed - t.helper),
    pass: t.executed > 0 ? (t.app + t.other) / t.executed >= 0.99 : null,
    files: t.files,
  })
  const attribution99 = {
    server: ratio(attr.server),
    client: ratio(attr.client),
  }
  const serverCounts = attribution99.server.pass !== false
  const a = {
    statements: total.n,
    run: serverCounts ? counts.all : counts.fallback,
    pct: pct(serverCounts ? counts.all : counts.fallback, total.n),
    pass: total.n
      ? (serverCounts ? counts.all : counts.fallback) / total.n >= 0.9
      : null,
    usesServer: serverCounts,
    bySource: Object.fromEntries(
      Object.entries(counts).map(([k, v]) => [
        k,
        { run: v, pct: pct(v, total.n) },
      ])
    ),
    codeLinesInfo: {
      note: 'informational: the same, over lines that are neither blank nor comment-only',
      lines: total.code,
      all: pct(codeCounts.all, total.code),
      fallback: pct(codeCounts.fallback, total.code),
    },
  }

  // (b): every CS row's files, run by >= 1 black-box test (browser or server)
  const b = csRows(o.step).map((row) => ({
    ...row,
    files: row.files.map((f) => {
      if (f.new) return { ...f, status: 'n/a (new file)' }
      const e = per.get(f.path)
      const extra = blackboxExtra.get(f.path)
      if (e && (e.browser || e.server)) {
        const any = [...Array(e.n).keys()].some(
          (i) => (e.browser && e.browser[i]) || (e.server && e.server[i])
        )
        return { ...f, status: any ? 'run' : 'not run' }
      }
      if (extra)
        return { ...f, status: extra.some(Boolean) ? 'run' : 'not run' }
      if (!CODE_EXT.test(f.path))
        return { ...f, status: 'n/a (not executable)' }
      return { ...f, status: 'not run' }
    }),
  }))
  const bFiles = b.flatMap((r) => r.files)
  const bSummary = {
    rows: b.length,
    files: bFiles.length,
    run: bFiles.filter((f) => f.status === 'run').length,
    notRun: [
      ...new Set(
        bFiles.filter((f) => f.status === 'not run').map((f) => f.path)
      ),
    ].sort(),
    notExecutable: bFiles.filter((f) => f.status.startsWith('n/a')).length,
  }
  const summary = {
    tool: 'scripts/merge-coverage.mjs',
    ref: o.ref,
    commit: git('rev-parse', `${o.ref}^{commit}`).trim(),
    build: { key: build.key, dir: build.dir, buildId: build.buildId },
    measuredAt: new Date().toISOString(),
    sources: {
      jest: !!jestFinal,
      browserScripts: byFile.size,
      serverScripts: server.size,
    },
    workingTreeDrift: drift,
    a,
    attribution: attribution99,
    b: { summary: bSummary, rows: b },
  }
  writeJson(path.join(o.out, 'summary.json'), summary)
  writeJson(path.join(o.out, 'per-file.json'), perFile)
  const txt = [
    `C3 merged coverage of ${o.ref} (${summary.commit.slice(0, 7)}), build ${
      build.key
    }`,
    `(a) app statements ${a.statements}: run ${a.run} = ${a.pct}% (${
      a.usesServer ? 'jest + browser + server' : 'fallback: jest + browser'
    }); pass >= 90%: ${a.pass}`,
    `    by source: ${Object.entries(a.bySource)
      .map(([k, v]) => `${k} ${v.pct}%`)
      .join(', ')}`,
    `    informational, code lines only: ${a.codeLinesInfo.all}% (fallback ${a.codeLinesInfo.fallback}%) of ${a.codeLinesInfo.lines}`,
    ...['server', 'client'].map((k) => {
      const t = attribution99[k]
      return `attribution ${k} (>= 99%): ${t.attributedPct}% of ${t.executed} executed app-module statement units mapped (app ${t.app}, other sources ${t.other}, unmapped ${t.unmapped} of which Babel helpers ${t.helper}; without those ${t.withoutHelpersPct}%; webpack glue left out ${t.glue}; ${t.bundles} bundles, ${t.modules} app modules); pass: ${t.pass}`
    }),
    `(b) CS rows ${bSummary.rows}, files ${bSummary.files}: run ${
      bSummary.run
    }, not executable ${bSummary.notExecutable}, not run: ${
      bSummary.notRun.join(', ') || 'none'
    }`,
    drift.length
      ? `WARNING working tree differs from ${o.ref} in: ${drift.join(', ')}`
      : `working tree app files = ${o.ref}`,
    '',
    'file | statements | all | jest | browser | server',
    ...perFile.map(
      (f) =>
        `${f.file} | ${f.statements} | ${f.all} | ${f.jest} | ${f.browser} | ${f.server}`
    ),
  ].join('\n')
  fs.writeFileSync(path.join(o.out, 'summary.txt'), `${txt}\n`)
  console.log(txt.split('\n').slice(0, 8).join('\n'))
  return summary
}

// ---------- docs data ----------
const DOCS = path.join(REPO, 'docs', 'upgrade')
// 55 C1-Q exempt quirks (scripts/run-faults.mjs EXEMPT)
const EXEMPT_QUIRKS = ['Q-095', 'Q-096']
const readDoc = (f) => fs.readFileSync(path.join(DOCS, f), 'utf8')
const tableRows = (text) =>
  text
    .split('\n')
    .filter((l) => /^\|/.test(l) && !/^\|\s*-/.test(l))
    .map((l) =>
      l
        .replace(/^\|/, '')
        .replace(/\|\s*$/, '')
        .split(/(?<!\\)\|/)
        .map((c) => c.trim())
    )

// CS IDs in a text: `CS-W0-1`, `CS-ZU-1..7`, `CS-W0-1/-7/-4`
export function csIdsIn(text) {
  const out = []
  for (const m of (text || '').matchAll(
    /CS-([A-Z0-9]+)-(\d+)((?:\/-\d+)*)(?:\.\.(\d+))?/g
  )) {
    const n = Number(m[2])
    out.push(`CS-${m[1]}-${n}`)
    for (const x of (m[3] || '').match(/\d+/g) || [])
      out.push(`CS-${m[1]}-${x}`)
    if (m[4])
      for (let i = n + 1; i <= Number(m[4]); i++) out.push(`CS-${m[1]}-${i}`)
  }
  return out
}
// the CS IDs a step changes: its 20 section(s), its row in 50 §3, 70 §4.1, 60 §5 (When) and 80
export function stepCsIds(step) {
  const ids = new Set()
  for (const f of [
    '50-roadmap.md',
    '60-design-ownership.md',
    '70-phase6.md',
    '80-phase7-antd.md',
  ])
    for (const c of tableRows(readDoc(f))) {
      const first = (c[0] || '').split(/\s+/)[0]
      const when = (c[1] || '').split(/\s+/)[0]
      if (first === step || when === step)
        for (const id of csIdsIn(c.join(' | '))) ids.add(id)
    }
  let inStep = false
  for (const line of readDoc('20-change-sites.md').split('\n')) {
    const h = /^##\s+(.*)$/.exec(line)
    if (h) inStep = waveSteps(h[1].split(' — ')[0]).includes(step)
    if (inStep && /^\|\s*CS-/.test(line))
      for (const id of csIdsIn(line.split('|')[1])) ids.add(id)
  }
  return ids
}
// CS rows of 20, 60, 70, 80 with the files of their Where cell (2nd column)
export function csRows(step) {
  const wanted = step ? stepCsIds(step) : null
  const workflows = new Set(
    fs.existsSync(path.join(REPO, '.github', 'workflows'))
      ? fs.readdirSync(path.join(REPO, '.github', 'workflows'))
      : []
  )
  const out = []
  for (const f of [
    '20-change-sites.md',
    '60-design-ownership.md',
    '70-phase6.md',
    '80-phase7-antd.md',
  ]) {
    let section = ''
    for (const line of readDoc(f).split('\n')) {
      const h = /^#{2,3}\s+(.*)$/.exec(line)
      if (h) section = h[1]
      if (!/^\|\s*CS-/.test(line)) continue
      const cells = line
        .replace(/^\|/, '')
        .replace(/\|\s*$/, '')
        .split(/(?<!\\)\|/)
        .map((c) => c.trim())
      const ids = csIdsIn(cells[0])
      if (wanted && !ids.some((id) => wanted.has(id))) continue
      const files = []
      const unresolved = []
      let prevDir = ''
      const exists = (rel) => fs.existsSync(path.join(REPO, rel))
      for (const m of (cells[1] || '').matchAll(/`([^`]+)`/g)) {
        const isNew =
          /\(new\)/.test(m[1]) ||
          /^\s*\(new\)/.test((cells[1] || '').slice(m.index + m[0].length))
        for (let tok of m[1].split(/;\s*|,\s+/)) {
          tok = tok
            .trim()
            .replace(/\s*\(new\)$/, '')
            .replace(/:[\d,\-–]+$/, '')
          for (const p of expandBraces(tok)) {
            let rel = p.replace(
              /^vendor\/oacore-design\//,
              'node_modules/@oacore/design/'
            )
            if (!/^[\w@.][\w@./-]*$/.test(rel)) continue
            if (!rel.includes('/') && workflows.has(rel))
              rel = `.github/workflows/${rel}`
            // a bare name continues the directory of the path before it (`store/claim.js`, `report.js`)
            if (
              !rel.includes('/') &&
              !exists(rel) &&
              prevDir &&
              exists(`${prevDir}/${rel}`)
            )
              rel = `${prevDir}/${rel}`
            if (exists(rel)) {
              files.push({ path: rel, new: false })
              if (rel.includes('/')) prevDir = path.posix.dirname(rel)
            } else if (
              (isNew && /[./]/.test(rel)) ||
              /^[\w@./-]+\.(js|jsx|ts|tsx|json|yml|yaml|css)$/.test(rel)
            )
              files.push({
                path: rel,
                new: true,
              })
            // absent at this tree: a file the row creates
            else unresolved.push(rel)
          }
        }
      }
      if (unresolved.length) files.unresolved = unresolved
      out.push({
        doc: f,
        section,
        ids,
        files,
        ...(files.unresolved ? { unresolved: files.unresolved } : {}),
      })
    }
  }
  return out
}
function expandBraces(s) {
  const m = /\{([^{}]+)\}/.exec(s)
  if (!m) return [s]
  return m[1]
    .split(',')
    .flatMap((x) =>
      expandBraces(s.slice(0, m.index) + x + s.slice(m.index + m[0].length))
    )
}

// 50 §3 order (6.x: 70 §4.1, 7.x: 80)
export const STEP_ORDER = [
  '2.0',
  '2.1',
  '2.2',
  '2.3',
  '2.4',
  '2.5',
  '2.6',
  '2.7',
  '2.8',
  'W0',
  'W0b',
  'W0.5',
  'W1',
  'W2a',
  'W2b',
  'W2c',
  'W2d',
  'W2e',
  'W3',
  'W4a',
  'W4b',
  'W4c',
  'W4d',
  'W4e',
  'W5',
  'W5.5',
  'W6a',
  'W6c',
  'W6d',
  'W7a',
  'W7b',
  'W7c',
  'W8',
  'GATE-S',
  '6.0',
  '6.1',
  '6.2',
  '6.3',
  '6.4',
  '6.5',
  '6.6',
  '6.7',
  '6.8',
  '6.9',
  '6.10',
  'GATE-A',
  '7.0',
  '7.1',
  '7.2',
  '7.F',
  'GATE-F',
]
const ord = (s) => {
  const i = STEP_ORDER.indexOf(s)
  return i < 0 ? null : i
}
function waveSteps(cell) {
  const out = []
  for (const part of cell.split(/,\s*/)) {
    const t = part.trim().replace(/\s*\(.*\)$/, '')
    const r = /^(\S+?)\s*[–-]\s*(\S+)$/.exec(t)
    if (r && ord(r[1]) !== null && ord(r[2]) !== null) {
      for (let i = ord(r[1]); i <= ord(r[2]); i++) out.push(STEP_ORDER[i])
    } else if (t === '6.x') out.push('6.0')
    else if (t === '7.x') out.push('7.0')
    else if (ord(t) !== null) out.push(t)
    else if (/^all$|^every/.test(t)) out.push('all')
  }
  return out
}
// T rows of 41 with the step they are due from (41 §0)
export function testRows() {
  const rows = {}
  for (const c of tableRows(readDoc('41-test-inventory.md'))) {
    if (!/^T-\d{3}$/.test(c[0]) || c.length < 6) continue
    const p = c[1]
    const wave = waveSteps(c[5])
    let due = null
    const at = /@(\S+)/.exec(p)
    if (/^P0/.test(p)) due = at ? at[1] : '2.3'
    else if (/^P1/.test(p)) {
      if (at) due = at[1]
      else {
        const firsts = wave
          .filter((w) => w !== 'all')
          .map(ord)
          .filter((x) => x !== null)
        const first = wave.includes('all')
          ? ord('W0')
          : firsts.length
          ? Math.min(...firsts)
          : null
        due =
          first !== null && first <= ord('W4e')
            ? '2.7'
            : first !== null
            ? STEP_ORDER[first]
            : '2.7'
      }
    }
    rows[c[0]] = {
      id: c[0],
      p,
      target: c[2],
      cases: c[3],
      risks: c[4],
      wave: c[5],
      due,
    }
  }
  return rows
}

// ---------- test reports ----------
export function readReports(files) {
  const tests = []
  for (const f of files) {
    const d = readJson(f, null)
    if (!d) continue
    if (Array.isArray(d.testResults)) {
      // Jest --json
      for (const s of d.testResults)
        for (const t of s.assertionResults || [])
          tests.push({
            title: t.fullName || t.title,
            status: t.status === 'passed' ? 'passed' : t.status,
            file: path.relative(REPO, s.name),
            source: path.basename(f),
          })
    } else if (Array.isArray(d.suites)) {
      const walk = (suite, titles) => {
        for (const sp of suite.specs || [])
          for (const t of sp.tests || []) {
            const results = t.results || []
            const last = results[results.length - 1]
            const ok =
              t.status === 'expected' &&
              results.length === 1 &&
              last &&
              last.status === 'passed'
            tests.push({
              title: [...titles, sp.title].join(' > '),
              status: ok
                ? 'passed'
                : t.status === 'skipped'
                ? 'skipped'
                : 'failed',
              project: t.projectName,
              file: sp.file,
              source: path.basename(f),
            })
          }
        for (const c of suite.suites || []) walk(c, [...titles, c.title])
      }
      for (const s of d.suites) walk(s, [])
    }
  }
  for (const t of tests) {
    // the describe block names the row without a clause (`T-601 @P0 ... > T-601 c1 @P0 ...`): the first
    // T id that carries a clause wins, else the first T id
    const all = [...t.title.matchAll(/\bT-(\d{3})(?:\s+c(\d+))?/g)]
    const m = all.find((x) => x[2]) || all[0]
    t.tid = m ? `T-${m[1]}` : null
    t.clause = m && m[2] ? Number(m[2]) : null
    t.items = [
      ...new Set(t.title.match(/\b(?:[VJE]\d{1,2}|Q-\d{3}|R-\d{3})\b/g) || []),
    ]
  }
  return tests
}

// ---------- items: (c), (d) ----------
function items(o) {
  const rows = testRows()
  const dueAt = ord(o.due)
  // 41 §0: the only test of an E item or of a J item whose catalogue row is P0 or P1, and the only pin of a Q
  // clause, are P1@2.7 (never later); filled below from the catalogues
  const only27 = new Set()
  const dueOf = (tid) => {
    const d = rows[tid] && rows[tid].due
    if (
      only27.has(tid) &&
      (d === null || ord(d) === null || ord(d) > ord('2.7'))
    )
      return '2.7'
    return d
  }
  const isDue = (tid) =>
    !!rows[tid] &&
    !!dueOf(tid) &&
    ord(dueOf(tid)) !== null &&
    ord(dueOf(tid)) <= dueAt
  const reports = [
    path.join(o.out, 'jest', 'report.json'),
    path.join(o.out, 'jest', 'report-static.json'),
    ...(fs.existsSync(path.join(o.out, 'e2e'))
      ? fs
          .readdirSync(path.join(o.out, 'e2e'))
          .filter((f) => f.endsWith('.json'))
          .map((f) => path.join(o.out, 'e2e', f))
      : []),
    ...o.reports,
  ].filter((f) => fs.existsSync(f))
  const tests = readReports(reports)
  const greenT = new Map() // tid -> Set(clause|0)
  for (const t of tests)
    if (t.status === 'passed' && t.tid) {
      if (!greenT.has(t.tid)) greenT.set(t.tid, new Set())
      greenT.get(t.tid).add(t.clause || 0)
    }
  const ran = new Set(tests.map((t) => t.tid).filter(Boolean))
  const failedT = new Set(
    tests
      .filter((t) => t.status !== 'passed' && t.status !== 'skipped' && t.tid)
      .map((t) => t.tid)
  )
  const greenNamed = (item) =>
    tests.some(
      (t) =>
        t.status === 'passed' && t.items.includes(item) && t.tid && isDue(t.tid)
    )
  const anyGreen = (tids) => tids.some((x) => isDue(x) && greenT.has(x))
  const tidsIn = (s) => [...new Set((s || '').match(/T-\d{3}/g) || [])]

  // catalogues of 41 §2
  const t41 = readDoc('41-test-inventory.md')
  const section = (title) => {
    const i = t41.indexOf(title)
    const j = t41.indexOf('\n### ', i + 1)
    const k = t41.indexOf('\n## ', i + 1)
    const end = Math.min(...[j, k].filter((x) => x > 0))
    return t41.slice(i, end)
  }
  const casesMention = (item) =>
    Object.values(rows)
      .filter((r) => new RegExp(`\\b${item}\\b`).test(r.cases))
      .map((r) => r.id)
  // E rows: the tests whose Cases name the endpoint, plus a test the row itself names (E20 Handling: `T-117`)
  const E = tableRows(section('### 2.1 Endpoints'))
    .filter((c) => /^E\d+$/.test(c[0]))
    .map((c) => ({ id: c[0], t: tidsIn(c.slice(1).join(' | ')) }))
  const eCovering = (e) => [...new Set([...casesMention(e.id), ...e.t])]
  // V rows: the Corrections cell may name the covering tests (`T-730`) or a split (`Split into V21–V25`)
  const V = tableRows(section('### 2.3 Visual states'))
    .filter((c) => /^V\d+$/.test(c[0]))
    .map((c) => {
      const split = /Split into V(\d+)\s*[–-]\s*V(\d+)/.exec(c[4] || '')
      return {
        id: c[0],
        p: c[2],
        t: tidsIn(c[4]),
        split: split
          ? Array.from(
              { length: Number(split[2]) - Number(split[1]) + 1 },
              (_, i) => `V${Number(split[1]) + i}`
            )
          : null,
      }
    })
  const J = tableRows(section('### 2.4 Journeys'))
    .filter((c) => /^J\d+$/.test(c[0]))
    .map((c) => ({ id: c[0], p: c[2], t: tidsIn(c[3]) }))
  const R = []
  for (const c of tableRows(section('## 3. Risk'))) {
    const ids = c[0].match(/R-\d{3}/g)
    if (!ids || c.length < 5) continue
    for (const id of ids) R.push({ id, t: [...tidsIn(c[2]), ...tidsIn(c[3])] })
  }
  // 30 quirk clauses (docs:check --cases-out)
  const casesFile = path.join(o.out, 'cases.json')
  spawnSync(
    process.execPath,
    [
      path.join(REPO, 'tools', 'check-docs.mjs'),
      'docs/upgrade',
      '--cases-out',
      casesFile,
    ],
    { cwd: REPO, encoding: 'utf8' }
  )
  const cases = readJson(casesFile, {})
  const Q = Object.entries(cases).filter(([k]) => /^Q-\d{3}$/.test(k))
  for (const j of J)
    if (/^P[01]/.test(j.p) && j.t.length === 1) only27.add(j.t[0])
  for (const e of E) {
    const t = eCovering(e)
    if (t.length === 1) only27.add(t[0])
  }
  for (const [, q] of Q) {
    const t = tidsIn(q.pinnedBy)
    if (t.length === 1) only27.add(t[0])
  }
  const qClauses = readJson(
    path.join(REPO, 'test', 'faults', 'Q-clauses.json'),
    null
  )
  const killMatrix = readJson(o.killMatrix, null)
  const status = readDoc('STATUS.md')
  const pinned = new Set(
    [...status.matchAll(/^\|(Q-\d{3})[^|]*\|\s*PINNED/gm)].map((m) => m[1])
  )

  const itemRow = (id, covering, extra = {}) => {
    const dueCovering = covering.filter(isDue)
    const green = anyGreen(dueCovering) || greenNamed(id)
    return {
      id,
      covering,
      due: dueCovering.length > 0 || greenNamed(id),
      green,
      ...extra,
    }
  }
  // V: a green test that names the state (the T-801 captures are titled by V id), or a green test of another
  // T row whose Cases name it
  const vBase = V.filter((v) => !['V19', 'V20'].includes(v.id)).map((v) => {
    const others = [
      ...new Set([...v.t, ...casesMention(v.id)].filter((t) => t !== 'T-801')),
    ]
    const row = itemRow(v.id, others, { p: v.p })
    row.covering = ['T-801 (by title)', ...others]
    row.due = row.due || isDue('T-801')
    return row
  })
  // a split state is covered when every state it was split into is
  const vRows = vBase.map((row) => {
    const v = V.find((x) => x.id === row.id)
    if (!v.split) return row
    const parts = vBase.filter((r) => v.split.includes(r.id))
    return {
      ...row,
      covering: [`split: ${v.split.join(', ')}`],
      green: parts.length === v.split.length && parts.every((r) => r.green),
    }
  })
  const jRows = J.map((j) => itemRow(j.id, j.t, { p: j.p }))
  const eRows = E.map((e) => itemRow(e.id, eCovering(e)))
  const rRows = R.map((r) => itemRow(r.id, r.t))
  // T-601 routes: one test per Cases clause, each asserting its whole route list
  const t601Clauses = cases['T-601'] ? cases['T-601'].clauses.length : 0
  const routeRows = Array.from({ length: t601Clauses }, (_, i) => ({
    id: `T-601 c${i + 1}`,
    due: isDue('T-601'),
    green: !!(greenT.get('T-601') && greenT.get('T-601').has(i + 1)),
  }))
  const qRows = []
  for (const [qid, q] of Q) {
    const tids = tidsIn(q.pinnedBy)
    const n = (q.clauses || []).length || 1
    for (let k = 1; k <= n; k++) {
      const key = `${qid}-c${k}`
      const mark =
        qClauses &&
        qClauses.quirks &&
        qClauses.quirks[qid] &&
        qClauses.quirks[qid].clauses[`c${k}`]
      const none = !!(mark && mark.status === 'none')
      let covering = tids
      let basis = 'pinned by (kill matrix has no run of this clause)'
      const fault = killMatrix && killMatrix.faults && killMatrix.faults[key]
      if (EXEMPT_QUIRKS.includes(qid)) basis = 'exempt: its pinned by'
      // a kill run of the clause's patch (a `--validate-only` record has no red list; an invalid patch's red
      // list proves nothing): its Pinned-by tests that went red
      else if (fault && fault.finished && Array.isArray(fault.red)) {
        if (fault.valid) {
          const red = new Set(
            fault.red.map((x) => ((x.test || '').match(/T-\d{3}/) || [])[0])
          )
          covering = tids.filter((t) => red.has(t))
          basis = 'kill matrix'
        } else basis = 'pinned by (the kill run of this clause is not valid)'
      }
      qRows.push({
        id: key,
        quirk: qid,
        pinnedStatus: pinned.has(qid),
        none: !!none,
        covering,
        basis,
        due: covering.some(isDue),
        green: anyGreen(covering),
      })
    }
  }
  const cSet = [
    ...routeRows.map((r) => ({ kind: 'T-601 route clause', ...r })),
    ...vRows.filter((r) => r.due).map((r) => ({ kind: 'V', ...r })),
    ...jRows.filter((r) => r.due).map((r) => ({ kind: 'J', ...r })),
    ...eRows.filter((r) => r.due).map((r) => ({ kind: 'E', ...r })),
    ...qRows
      .filter((r) => r.pinnedStatus && r.due && !r.none)
      .map((r) => ({ kind: 'Q (PINNED)', ...r })),
  ]
  const c = {
    items: cSet.length,
    green: cSet.filter((x) => x.green).length,
    pass: cSet.every((x) => x.green),
    notTouched: cSet.filter((x) => !x.green).map((x) => x.id),
    excludedNotDue: [...vRows, ...jRows, ...eRows]
      .filter((r) => !r.due)
      .map((r) => r.id),
    pinnedQuirksInStatus: pinned.size,
  }
  const dItems = [...rRows, ...vRows, ...jRows, ...eRows]
  const dGreen = dItems.filter((x) => x.green)
  const qNonNone = qRows.filter((x) => !x.none)
  const d = {
    rvje: {
      items: dItems.length,
      green: dGreen.length,
      pct: pct(dGreen.length, dItems.length),
      pass: dItems.length ? dGreen.length / dItems.length >= 0.95 : null,
      without: dItems.filter((x) => !x.green).map((x) => x.id),
    },
    q: {
      clauses: qNonNone.length,
      green: qNonNone.filter((x) => x.green).length,
      pct: pct(qNonNone.filter((x) => x.green).length, qNonNone.length),
      pass: qNonNone.every((x) => x.green),
      without: qNonNone.filter((x) => !x.green).map((x) => x.id),
      basis: Object.fromEntries(
        [...new Set(qNonNone.map((x) => x.basis))].map((b) => [
          b,
          qNonNone.filter((x) => x.basis === b).length,
        ])
      ),
      killMatrix: killMatrix ? path.relative(REPO, o.killMatrix) : 'absent',
      noneMarks: qClauses
        ? 'test/faults/Q-clauses.json'
        : 'absent (no clause marked none)',
    },
  }
  const out = {
    due: o.due,
    reports: reports.map((f) => path.relative(o.out, f)),
    tests: {
      total: tests.length,
      passed: tests.filter((t) => t.status === 'passed').length,
      failed: tests.filter((t) => t.status === 'failed').length,
      skipped: tests.filter((t) => t.status === 'skipped').length,
      tids: ran.size,
      tidsWithFailures: [...failedT].sort(),
    },
    dueTestsNotRun: Object.values(rows)
      .filter((r) => isDue(r.id) && !ran.has(r.id))
      .map((r) => r.id),
    c,
    d,
    rows: {
      routes: routeRows,
      V: vRows,
      J: jRows,
      E: eRows,
      R: rRows,
      Q: qRows,
    },
  }
  writeJson(path.join(o.out, 'items.json'), out)
  console.log(
    [
      `tests ${out.tests.total} (passed ${out.tests.passed}, failed ${out.tests.failed}, skipped ${out.tests.skipped}); due T rows not in the reports: ${out.dueTestsNotRun.length}`,
      `(c) ${c.green}/${c.items} touched by a green test (pass: ${
        c.pass
      }); not touched: ${
        c.notTouched.join(', ') || 'none'
      }; PINNED quirks in STATUS: ${c.pinnedQuirksInStatus}`,
      `(d) R/V/J/E ${d.rvje.green}/${d.rvje.items} = ${
        d.rvje.pct
      }% (pass >= 95%: ${d.rvje.pass}); Q clauses ${d.q.green}/${
        d.q.clauses
      } = ${d.q.pct}% (pass 100%: ${d.q.pass}; basis ${JSON.stringify(
        d.q.basis
      )})`,
    ].join('\n')
  )
  return out
}

// ---------- main ----------
async function main(argv) {
  const cmd = ['collect', 'merge', 'items', 'all'].includes(argv[0])
    ? argv[0]
    : 'all'
  const opt = (n, d) => {
    const i = argv.indexOf(n)
    return i >= 0 ? argv[i + 1] : d
  }
  const list = (n) => argv.flatMap((a, i) => (a === n ? [argv[i + 1]] : []))
  const ref = opt('--ref', 'p2-local/golden')
  let commit
  try {
    commit = git('rev-parse', `${ref}^{commit}`).trim()
  } catch {
    console.error(`unknown ref ${ref}`)
    return 2
  }
  const o = {
    ref,
    out: path.resolve(
      opt('--out', path.join(ARTIFACT_DIR, 'coverage', commit.slice(0, 7)))
    ),
    run: opt('--run', 'P1-09-cov'),
    skipJest: argv.includes('--skip-jest'),
    skipE2e: argv.includes('--skip-e2e'),
    skipVisual: argv.includes('--skip-visual'),
    only: list('--only'),
    append: argv.includes('--append'),
    withStatic: argv.includes('--with-static'),
    pw: (opt('--pw', '') || '').split(/\s+/).filter(Boolean),
    reports: list('--report').map((f) => path.resolve(f)),
    killMatrix: path.resolve(
      opt(
        '--kill-matrix',
        path.join(ARTIFACT_DIR, 'faults', 'kill-matrix.json')
      )
    ),
    due: opt('--due', '2.7'),
    step: opt('--step', null),
    build: findBuild({ ref, variant: 'default', mode: 'host' }),
  }
  if (ord(o.due) === null) {
    console.error(`--due ${o.due}: not a step of 50 §3`)
    return 2
  }
  if (cmd === 'collect' || cmd === 'all') collect(o)
  if (cmd === 'merge' || cmd === 'all') await merge(o)
  if (cmd === 'items' || cmd === 'all') items(o)
  return 0
}

if (fileURLToPath(import.meta.url) === path.resolve(process.argv[1] || ''))
  main(process.argv.slice(2)).then(
    (code) => {
      process.exitCode = code
    },
    (e) => {
      console.error(e.stack || e.message)
      process.exitCode = 1
    }
  )
