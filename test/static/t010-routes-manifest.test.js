// T-010 (41 A; R-002, R-020, R-021, R-068): the routes-manifest of the parity
// build as normalised (source, destination, headers) tuples (review:00
// X40.10, review:http-contract HC-14): rewrites (source -> destination, in
// order, and the phase of each when the manifest has phases), headers (source
// -> ordered [key, value]) and redirects (source -> status destination), never
// the regexes, the buildId-bearing data routes or the manifest shape. The CSP
// value is the string T-116 pins: csp.config.js
// evaluated with the build's NODE_ENV=production. Reference and diff rules:
// test/static/adapters/reference.js.
const fs = require('fs')
const path = require('path')

const { ROOT, buildDirs, openBuild } = require('./adapters')
const { REWRITE_PHASES } = require('./adapters/next10')
const {
  reference,
  diffEntries,
  summary,
  ABSENT,
} = require('./adapters/reference')

// the one rewrite Next injects itself from 15 when assetPrefix is a path
// (review:http-contract HC-14): whitelisted as an addition from Next 15 only
const INJECTED_FROM_15 = {
  key: 'rewrite:/static/search/_next/:path+',
  to: '/_next/:path+',
  fromMajor: 15,
}

// The rewrites of the manifest in the order Next applies them. An array (Next
// applies all of them after the pages) gives the entries it always gave. The
// {beforeFiles, afterFiles, fallback} form (CS-N12-9) gives the same entries
// for its rewrites in phase order, plus `phases:rewrites`, which names each
// phase with its sources, so a rewrite that moves to another phase is a diff.
function rewriteList(manifest) {
  const { rewrites } = manifest
  if (Array.isArray(rewrites)) return { list: rewrites, phases: null }
  if (
    rewrites !== null &&
    typeof rewrites === 'object' &&
    Object.keys(rewrites).length === REWRITE_PHASES.length &&
    REWRITE_PHASES.every((p) => Array.isArray(rewrites[p]))
  ) {
    return {
      list: REWRITE_PHASES.flatMap((p) => rewrites[p]),
      phases: REWRITE_PHASES.map(
        (p) => `${p}: ${rewrites[p].map((r) => r.source).join(' , ')}`
      ).join(' | '),
    }
  }
  throw new Error(
    'routes-manifest rewrites is neither an array nor {beforeFiles, afterFiles, fallback}: another Next layout, needs its reader (40 §8 rule 7)'
  )
}

function tuples(manifest) {
  const rewrites = rewriteList(manifest)
  const entries = {}
  const order = { rewrites: [], headers: [], redirects: [] }
  for (const r of rewrites.list) {
    entries[`rewrite:${r.source}`] = r.destination
    order.rewrites.push(r.source)
  }
  for (const h of manifest.headers || []) {
    entries[`header:${h.source}`] = JSON.stringify(
      h.headers.map(({ key, value }) => [key, value])
    )
    order.headers.push(h.source)
  }
  for (const r of manifest.redirects || []) {
    entries[`redirect:${r.source}`] = `${
      r.statusCode || (r.permanent ? 308 : 307)
    } ${r.destination}${r.internal ? ' internal' : ''}`
    order.redirects.push(r.source)
  }
  for (const [k, v] of Object.entries(order))
    entries[`order:${k}`] = v.join(' , ')
  if (rewrites.phases !== null) entries['phases:rewrites'] = rewrites.phases
  return entries
}

const derive = (build) => ({ entries: tuples(build.routesManifest()) })

function nextMajor(appRoot) {
  const pkg = [appRoot, ROOT]
    .map((d) => path.join(d, 'node_modules', 'next', 'package.json'))
    .find((f) => fs.existsSync(f))
  return Number(JSON.parse(fs.readFileSync(pkg, 'utf8')).version.split('.')[0])
}

// default-deny diff plus the T-010 c2 whitelist: the injected rewrite may be
// added (and appended to the rewrite order) on Next >= 15 and nowhere else
function diffRoutes(ref, act, major) {
  const { uncovered } = diffEntries('T-010', ref, act)
  const injected = (d) =>
    major >= INJECTED_FROM_15.fromMajor &&
    d.key === INJECTED_FROM_15.key &&
    d.from === ABSENT &&
    d.to === INJECTED_FROM_15.to
  const injectedOrder = (d) =>
    major >= INJECTED_FROM_15.fromMajor &&
    d.key === 'order:rewrites' &&
    act[INJECTED_FROM_15.key] === INJECTED_FROM_15.to &&
    d.to
      .split(' , ')
      .filter((s) => `rewrite:${s}` !== INJECTED_FROM_15.key)
      .join(' , ') === d.from
  return uncovered.filter((d) => !injected(d) && !injectedOrder(d))
}

describe('T-010 @P0 routes manifest', () => {
  let build
  let actual
  let ref
  let csp
  beforeAll(() => {
    const dirs = buildDirs('T-010')
    build = openBuild(dirs)
    actual = derive(build)
    ref = reference(
      'T-010',
      't010-routes-manifest',
      derive,
      actual,
      build
    ).value
    // the T-116 string: csp.config.js with the build-time NODE_ENV of the
    // parity build (production)
    const env = process.env.NODE_ENV
    process.env.NODE_ENV = 'production'
    try {
      jest.isolateModules(() => {
        csp = require(path.join(ROOT, 'csp.config.js'))
      })
    } finally {
      process.env.NODE_ENV = env
    }
  })

  test('T-010 c1 @P0 (source, destination, headers) tuples = reference: prod data rewrite, /static rewrite, CSP = the T-116 string', () => {
    const a = actual.entries
    // from Next 15 the assetPrefix rewrite Next injects comes first (c2)
    expect(a['order:rewrites']).toBe(
      `${
        nextMajor(build.appRoot) >= INJECTED_FROM_15.fromMajor
          ? '/static/search/_next/:path+ , '
          : ''
      }/search/_next/data/:path* , /static/:path*`
    )
    expect(a['rewrite:/search/_next/data/:path*']).toBe('/_next/data/:path*')
    expect(a['rewrite:/static/:path*']).toBe('/:path*')
    expect(a['order:headers']).toBe('/:path(.*) , /outputs/update/') // AD-237
    expect(JSON.parse(a['header:/:path(.*)'])).toEqual([
      ['Content-Security-Policy', csp],
    ])
    expect(csp).toMatch(
      /^default-src 'self' \*\.core\.ac\.uk core\.ac\.uk;script-src 'self' /
    )
    expect(csp).not.toMatch(/localhost|api-dev\.core\.ac\.uk/)
    // trailingSlash: true -> Next's two internal 308 redirects
    expect(Object.values(a).filter((v) => / internal$/.test(v))).toHaveLength(2)
    expect(
      a['redirect:/:notfile((?!\\.well-known(?:/.*)?)(?:[^/]+/)*[^/\\.]+)']
    ).toBe('308 /:notfile/ internal')
    expect(diffRoutes(ref.entries, a, nextMajor(build.appRoot))).toEqual([])
  })

  test('T-010 c2 @P0 the rewrite Next injects from 15 is whitelisted (only that one, only from 15); present from W7a', () => {
    const major = nextMajor(build.appRoot)
    expect(major).toBe(15) // W7a (AD-060, AD-184, AD-207 before)
    expect(actual.entries[INJECTED_FROM_15.key]).toBe(INJECTED_FROM_15.to)
    // the comparator: the injected rewrite passes from 15 only; any other
    // added, removed or changed tuple fails
    const base = ref.entries
    const withInjected = {
      ...base,
      [INJECTED_FROM_15.key]: INJECTED_FROM_15.to,
      'order:rewrites': `/static/search/_next/:path+ , ${base['order:rewrites']}`,
    }
    expect(diffRoutes(base, withInjected, 15)).toEqual([])
    expect(diffRoutes(base, withInjected, 16)).toEqual([])
    expect(
      diffRoutes(base, withInjected, 10)
        .map((d) => d.key)
        .sort()
    ).toEqual(['order:rewrites', INJECTED_FROM_15.key])
    const other = { ...base, 'rewrite:/other/:path*': '/:path*' }
    expect(diffRoutes(base, other, 15).map((d) => d.key)).toEqual([
      'rewrite:/other/:path*',
    ])
    const changed = {
      ...withInjected,
      [INJECTED_FROM_15.key]: '/elsewhere/:path+',
    }
    expect(
      diffRoutes(base, changed, 15)
        .map((d) => d.key)
        .sort()
    ).toEqual(['order:rewrites', INJECTED_FROM_15.key])
    const dropped = { ...base }
    delete dropped['rewrite:/search/_next/data/:path*']
    expect(diffRoutes(base, dropped, 15).map((d) => d.key)).toEqual([
      'rewrite:/search/_next/data/:path*',
    ])
    expect(summary(diffRoutes(base, actual.entries, major))).toEqual({
      count: 0,
      first: [],
    })
  })
})
