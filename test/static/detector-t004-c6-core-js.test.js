// T-004 c6 (41 A; R-032): the usage-based built-ins of babel.config.js
// (`useBuiltIns: 'usage'`, `corejs: 3`) in the client bundles. Per route, the
// core-js polyfill modules (`node_modules/core-js/modules/<name>.js`) bundled
// in the scripts the route loads first (build-manifest `pages[route]`, which
// holds `_app`'s files too), plus the set over every client script, against
// the reference (./adapters/reference.js: the recorded golden-build values, or
// test/baseline/build/ from B0; a diff passes only as an AD row of
// test/baseline/ACCEPTED-DIFFS.yml). A compiler change that stops adding them
// (preset-env options, a loader that no longer reads babel.config.js, SWC) or
// changes the set (targets, core-js version) is red here, while every engine
// the local suite runs (Chromium) has the built-ins natively and stays green.
// Module identity = the mapped source path of the emitted source maps (the
// Next 10 adapter, ./adapters/next10.js).
const {
  buildDirs,
  openBuild,
  packageRoots,
  byCodePoint,
} = require('./adapters')
const { reference, diffEntries, summary } = require('./adapters/reference')

const SLUG = 'detector-t004-c6-core-js'
const POLYFILL = /^node_modules\/core-js\/modules\/(.+)\.js$/

// core-js polyfill module names of the given scripts, sorted
const polyfillsOf = (build, scripts) => {
  const names = new Set()
  for (const s of scripts) {
    for (const raw of (s.map && s.map.sources) || []) {
      const m = POLYFILL.exec(build.normaliseSource(raw).path || '')
      if (m) names.add(m[1])
    }
  }
  return [...names].sort(byCodePoint)
}

// the JavaScript files a route loads first, as client scripts
const routeScripts = (build, byRel, page) =>
  build
    .pageFiles(page)
    .filter((f) => f.endsWith('.js'))
    .map((f) => byRel.get(f) || { rel: f, missing: true })

function derive(build) {
  const client = build.clientScripts()
  const byRel = new Map(client.map((s) => [s.rel, s]))
  const entries = {
    'client:roots:core-js': (packageRoots(build, client)['core-js'] || []).join(
      ','
    ),
    'client:scripts-without-map': String(client.filter((s) => !s.map).length),
    // the whole-bundle key, `client:core-js:*` before jump 2 (renamed in the
    // owner's batch round 1: the ledger refuses a glob key, AD-062)
    'client:core-js:all-scripts': polyfillsOf(build, client).join(','),
  }
  for (const page of build.pages()) {
    entries[`client:core-js:${page}`] = polyfillsOf(
      build,
      routeScripts(build, byRel, page)
    ).join(',')
  }
  return { entries }
}

const split = (value) => (value ? value.split(',') : [])

describe('T-004 @P0 bundles: client polyfills', () => {
  let build
  let actual
  let ref
  beforeAll(() => {
    build = openBuild(buildDirs('T-004'))
    actual = derive(build)
    ref = reference('T-004', SLUG, derive, actual, build).value
  })

  test('T-004 c6 @P0 per route, the core-js polyfill modules of its first-loaded scripts = reference (R-032 usage built-ins)', () => {
    const a = actual.entries
    // every route file is an emitted client script with its source map
    const byRel = new Map(build.clientScripts().map((s) => [s.rel, s]))
    const missing = build
      .pages()
      .flatMap((p) => routeScripts(build, byRel, p))
      .filter((s) => s.missing || !s.map)
      .map((s) => s.rel)
    expect(missing).toEqual([])
    // the census against the reference (a diff passes only as an AD row)
    const { uncovered } = diffEntries('T-004', ref.entries, a)
    expect(summary(uncovered)).toEqual({ count: 0, first: [] })
    expect(a['client:scripts-without-map']).toBe('1') // AD-074
    // one core-js copy, bundled
    expect(a['client:roots:core-js']).toBe('node_modules/core-js')
    // the set of every route is non-empty, inside the whole-bundle set, and
    // holds the `_app` set (each route loads `_app`'s files)
    const all = new Set(split(a['client:core-js:all-scripts']))
    const app = split(a['client:core-js:/_app'])
    expect(app.length).toBeGreaterThan(0)
    for (const page of build.pages()) {
      const own = split(a[`client:core-js:${page}`])
      expect([page, own.length > 0]).toEqual([page, true])
      expect([page, own.filter((n) => !all.has(n))]).toEqual([page, []])
      expect([page, app.filter((n) => !own.includes(n))]).toEqual([page, []])
    }
  })

  test('T-004 c6 @P0 the census sees a bundle whose polyfills were dropped (negative control)', () => {
    // the measured build with every core-js module removed from its source
    // maps (what `useBuiltIns: false` emits): every route differs from the
    // reference
    const stripped = {
      ...build,
      clientScripts: () =>
        build.clientScripts().map((s) => ({
          ...s,
          map: s.map && {
            ...s.map,
            sources: s.map.sources.filter(
              (raw) => !POLYFILL.test(build.normaliseSource(raw).path || '')
            ),
          },
        })),
    }
    const dropped = derive(stripped).entries
    const { uncovered } = diffEntries('T-004', ref.entries, dropped)
    const keys = uncovered.map((d) => d.key)
    expect(keys).toEqual(
      expect.arrayContaining([
        'client:core-js:all-scripts',
        ...build.pages().map((p) => `client:core-js:${p}`),
      ])
    )
    expect(dropped['client:core-js:/search']).toBe('')
  })
})
