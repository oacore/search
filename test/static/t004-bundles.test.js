// T-004 (41 A; R-032, R-040, R-044, R-091; Q-065; S-1): the bundles of the
// parity build's .next, read by the Next 10 adapter through the emitted source
// maps (client static/**/*.js, server server/**/*.js). Module identity =
// mapped source path; externals = the server maps' `external "x"` sources.
// Reference and diff rules: test/static/adapters/reference.js.
const {
  buildDirs,
  openBuild,
  packageRoots,
  externals,
  literalSites,
} = require('./adapters')
const { reference, diffEntries, summary } = require('./adapters/reference')

// the parity recipe's API_KEY placeholder (42 §2; test/setup/env-clock.js)
const API_KEY_PLACEHOLDER = /(["'`])test-key\1/g
const READ_FILE_SYNC = /\breadFileSync\b/g

// the routes of today's pages/ tree (findings/02 §4.1) plus Next's own
const KNOWN_ROUTES = [
  '/',
  '/404',
  '/_app',
  '/_document',
  '/_error',
  '/api/healthz',
  '/data-providers',
  '/data-providers/[id]',
  '/error-card',
  '/outputs/[id]',
  '/outputs/update',
  '/search',
  '/works/[id]',
]

const list = (xs) => xs.join(',')
// CS-TS-4 (6.6) moved these modules from .js to .ts (git mv, type
// annotations only): their sites are counted under the reference's names
const MOVED = {
  'lib/loader.ts': 'lib/loader.js',
  'api/index.ts': 'api/index.js',
}
const sitesOf = (build, scripts, needle) =>
  Object.fromEntries(
    Object.entries(literalSites(build, scripts, needle)).map(([k, n]) => [
      MOVED[k] || k,
      n,
    ])
  )

function derive(build) {
  const client = build.clientScripts()
  const server = build.serverScripts()
  const clientRoots = packageRoots(build, client)
  const serverRoots = packageRoots(build, server)
  const serverExternals = externals(build, server)
  const entries = {}
  for (const name of ['react', 'react-dom', '@sentry/browser', '@sentry/node'])
    entries[`client:roots:${name}`] = list(clientRoots[name] || [])
  entries['client:sentry-packages'] = list(
    Object.keys(clientRoots).filter((n) => n.startsWith('@sentry/'))
  )
  entries['client:externals'] = list(externals(build, client))
  entries['server:sentry-externals'] = list(
    serverExternals.filter((n) => n.startsWith('@sentry/'))
  )
  entries['server:sentry-bundled'] = list(
    Object.keys(serverRoots).filter((n) => n.startsWith('@sentry/'))
  )
  entries['client:readFileSync'] = JSON.stringify(
    sitesOf(build, client, READ_FILE_SYNC)
  )
  entries['server:readFileSync'] = JSON.stringify(
    sitesOf(build, server, READ_FILE_SYNC)
  )
  entries['client:api-key-placeholder'] = JSON.stringify(
    sitesOf(build, client, API_KEY_PLACEHOLDER)
  )
  entries['pages-manifest'] = list(Object.keys(build.pagesManifest()).sort())
  return { entries }
}

const pick = (entries, prefix) =>
  Object.fromEntries(
    Object.entries(entries).filter(([k]) => prefix.some((p) => k.startsWith(p)))
  )

describe('T-004 @P0 bundles', () => {
  let build
  let actual
  let ref
  const compare = (prefixes) => {
    const { uncovered } = diffEntries(
      'T-004',
      pick(ref.entries, prefixes),
      pick(actual.entries, prefixes)
    )
    expect(summary(uncovered)).toEqual({ count: 0, first: [] })
  }
  beforeAll(() => {
    build = openBuild(buildDirs('T-004'))
    actual = derive(build)
    ref = reference('T-004', 't004-bundles', derive, actual, build).value
  })

  test('T-004 c1 @P0 client: one react and one react-dom copy, @sentry/browser bundled', () => {
    const a = actual.entries
    expect(a['client:roots:react']).toBe('node_modules/react')
    expect(a['client:roots:react-dom']).toBe('node_modules/react-dom')
    expect(a['client:roots:@sentry/browser']).toBe(
      'node_modules/@sentry/browser'
    )
    // the alias of next.config.js:97 sends @sentry/node to the browser SDK
    expect(a['client:roots:@sentry/node']).toBe('')
    compare(['client:roots:', 'client:sentry-packages', 'client:externals'])
  })

  test('T-004 c2 @P0 server: only @sentry/node, external (Q-065: Next 10 externalises it before the alias)', () => {
    const a = actual.entries
    // every server module that loads Sentry requires the external
    // @sentry/node; no @sentry/* module is bundled (the only `@sentry/browser`
    // text in the server output is the comment of utils/sentry.js:1)
    expect(a['server:sentry-externals']).toBe('@sentry/node')
    expect(a['server:sentry-bundled']).toBe('')
    compare(['server:sentry-'])
  })

  test('T-004 c3 @P0 no new readFileSync of lib/loader.js in the bundles', () => {
    const a = actual.entries
    // today the client keeps the one call of lib/loader.js readCache (fs is
    // the empty module there: Q-011)
    expect(JSON.parse(a['client:readFileSync'])).toEqual({ 'lib/loader.js': 1 })
    expect(JSON.parse(a['server:readFileSync'])).toEqual({
      'lib/loader.js': 1,
      'node_modules/next/dist/compiled/gzip-size/index.js': 1,
    }) // AD-198
    compare(['client:readFileSync', 'server:readFileSync'])
  })

  test('T-004 c4 @P0 the API_KEY placeholder is inlined into the client bundle (S-1)', () => {
    const a = actual.entries
    expect(JSON.parse(a['client:api-key-placeholder'])).toEqual({
      'api/index.js': 1,
    })
    compare(['client:api-key-placeholder'])
  })

  test('T-004 c5 @P0 pages-manifest = the known routes', () => {
    expect(actual.entries['pages-manifest']).toBe(list(KNOWN_ROUTES))
    compare(['pages-manifest'])
  })
})
