// T-007 (41 A; R-048, R-064; OD-49): per-route first-load JavaScript, gzip,
// from the build manifests of the build's .next (read through the Next 10
// adapter of test/static/adapters, read-only). A route's first load = the
// unique .js files of `/_app` plus the route in build-manifest.json (the
// definition behind Next 10's "First Load JS" column), each gzipped at level 9
// and summed. Never one number per chunk: the chunk graph changes between
// Next versions, the per-route sum is what a visitor downloads.
//
// Budget (OD-49): every route stays within B0 + 10 %, cumulative, measured from
// B0 and never from the previous step, so per-step tolerances cannot add up.
// B0 below = the golden build of the local B0 link (42 §6 item 2, G25-2: the
// raw build is not committed, its values are recorded here). The cap moves only
// under 90 §0 rule 6 (owner SIGNED:, recorded as `was:`), by editing B0.
//
// When test/baseline/build/ exists (the golden `.next` as `next/`, 42 §7) the
// reader must reproduce the B0 table on it before it reads a candidate (40 §8
// rule 7). T007_PRINT=1 prints the measured table (to record a new chain link).
const fs = require('fs')
const path = require('path')
const zlib = require('zlib')

const { buildDirs, openBuild, byCodePoint } = require('./adapters')
const { baselineBuild } = require('./adapters/reference')

const BUDGET_PERCENT = 10

const B0 = {
  link: 'B0-local',
  from: {
    commit: '689fec94a2a194dcf90b40d3a02dd81cac112e75',
    key: '1fb7e5b548c5ae8c',
    variant: 'default',
    mode: 'host',
    node: 'v18.20.8',
    buildId: 'fSewvhR0z-w12QYCnFd3s',
  },
  // route -> {files: unique .js files of /_app + the route, gzip: bytes}
  routes: {
    '/': { files: 12, gzip: 1256819 },
    '/404': { files: 12, gzip: 1257568 },
    '/_app': { files: 11, gzip: 1256585 },
    '/_error': { files: 12, gzip: 1260103 },
    '/data-providers': { files: 13, gzip: 1271154 },
    '/data-providers/[id]': { files: 13, gzip: 1273039 },
    '/error-card': { files: 12, gzip: 1257469 },
    '/outputs/[id]': { files: 15, gzip: 1278418 },
    '/outputs/update': { files: 12, gzip: 1261408 },
    '/search': { files: 12, gzip: 1269483 },
    '/works/[id]': { files: 15, gzip: 1278434 },
  },
}

const sum = (xs) => xs.reduce((a, b) => a + b, 0)

// integer arithmetic: actual <= b0 * 1.10
const withinBudget = (actual, b0, percent = BUDGET_PERCENT) =>
  actual * 100 <= b0 * (100 + percent)

function measure(build) {
  const sizes = new Map()
  const gzipOf = (rel) => {
    if (!sizes.has(rel)) {
      const buf = fs.readFileSync(path.join(build.dir, rel))
      sizes.set(rel, zlib.gzipSync(buf, { level: 9 }).length)
    }
    return sizes.get(rel)
  }
  const routes = {}
  for (const page of Object.keys(build.buildManifest().pages).sort(
    byCodePoint
  )) {
    const files = build.pageFiles(page).filter((f) => f.endsWith('.js'))
    routes[page] = { files: files.length, gzip: sum(files.map(gzipOf)) }
  }
  return { routes, filesOf: (page) => build.pageFiles(page), gzipOf }
}

describe('T-007 @P1 bundle budget (first-load JS gzip per route)', () => {
  let build
  let measured

  beforeAll(() => {
    build = openBuild(buildDirs('T-007'))
    measured = measure(build)
    if (process.env.T007_PRINT === '1') {
      // eslint-disable-next-line no-console
      console.log(JSON.stringify(measured.routes, null, 2))
    }
    const golden = baselineBuild()
    if (golden) {
      const reproduced = measure(openBuild(golden)).routes
      if (JSON.stringify(reproduced) !== JSON.stringify(B0.routes)) {
        throw new Error(
          'T-007: the reader does not reproduce the B0 table on test/baseline/build/ (40 §8 rule 7)'
        )
      }
    }
  })

  test('T-007 @P1 every route stays within B0 +10 % first-load JS gzip (OD-49, cumulative from B0)', () => {
    const violations = Object.keys(B0.routes)
      .filter((route) => measured.routes[route])
      .filter(
        (route) =>
          !withinBudget(measured.routes[route].gzip, B0.routes[route].gzip)
      )
      .map((route) => ({
        route,
        b0: B0.routes[route].gzip,
        cap: Math.floor((B0.routes[route].gzip * (100 + BUDGET_PERCENT)) / 100),
        actual: measured.routes[route].gzip,
      }))
    expect(violations).toEqual([])
  })

  test('T-007 @P1 the measured routes are the B0 routes (a new route has no budget: it needs an owner decision)', () => {
    expect(Object.keys(measured.routes).sort(byCodePoint)).toEqual(
      Object.keys(B0.routes).sort(byCodePoint)
    )
  })

  test('T-007 @P1 the measure is a per-route sum over the build-manifest files: /_app files are in every route, sizes are positive', () => {
    const appFiles = measured.filesOf('/_app').filter((f) => f.endsWith('.js'))
    expect(appFiles.length).toBeGreaterThan(0)
    Object.keys(measured.routes).forEach((route) => {
      const files = measured.filesOf(route).filter((f) => f.endsWith('.js'))
      // unique files, shared ones counted once
      expect(new Set(files).size).toBe(files.length)
      appFiles.forEach((f) => expect(files).toContain(f))
      expect(measured.routes[route].files).toBe(files.length)
      expect(measured.routes[route].gzip).toBe(sum(files.map(measured.gzipOf)))
      expect(measured.routes[route].gzip).toBeGreaterThanOrEqual(
        measured.routes['/_app'].gzip
      )
      files.forEach((f) => expect(measured.gzipOf(f)).toBeGreaterThan(0))
    })
  })

  test('T-007 @P1 the budget arithmetic: the cap is B0 +10 % exactly, one byte over fails', () => {
    expect(withinBudget(1100, 1000)).toBe(true)
    expect(withinBudget(1101, 1000)).toBe(false)
    expect(withinBudget(0, 1000)).toBe(true)
    // a real B0 value: 1,256,819 -> cap 1,382,500.9
    expect(withinBudget(1382500, 1256819)).toBe(true)
    expect(withinBudget(1382501, 1256819)).toBe(false)
  })

  test('T-007 @P1 the B0 table carries its provenance (golden build of the B0-local link)', () => {
    expect(B0.link).toBe('B0-local')
    expect(B0.from.commit).toMatch(/^[0-9a-f]{40}$/)
    expect(B0.from.key).toMatch(/^[0-9a-f]{16}$/)
    Object.values(B0.routes).forEach((entry) => {
      expect(entry.gzip).toBeGreaterThan(0)
      expect(entry.files).toBeGreaterThan(0)
    })
  })
})
