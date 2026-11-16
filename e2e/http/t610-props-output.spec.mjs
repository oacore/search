// T-610 (41 G; R-003, R-028, R-040, R-073): props and server output, through the gateway-faithful proxy.
// c1 `__NEXT_DATA__.props` of every getServerSideProps 200-route deep-equals the `_next/data` JSON the client
//    router requests for it (the /search data rewrite), and page, query, props = baseline (40 §1 "Server data";
//    buildId and the other Next-owned keys are not compared);
// c2 no `svc.cluster.local` (nor the Internal_API origin of this stack), `Bearer ` or stack frame in the HTML and
//    the `_next/data` JSON of any route, incl. the 404/500 answers and a page whose upstream error is serialised;
// c3 the app's stdout/stderr line census over a serial sweep = baseline, on a sub-stack of its own (the package
//    stack's log interleaves the parallel tests); console.time labels and durations normalised (40 §1), the Next
//    13.5/16 listener allow-list is empty on Next 10; the line:column numbers of stack frames are masked on both
//    sides, function and file names compared (owner SIGNED: 2026-10-27, 40 §8 rule 8; it supersedes AD-007, AD-008);
// c4 0 server Sentry events at the counting stub (the SSR stub answers the test DSN host o0.ingest.sentry.io and
//    records each request) over the same sweep.
import {
  test,
  expect,
  stubControl,
  withWireCapture,
} from '../fixtures/guard.mjs'
import {
  ROUTES_200,
  ROUTES_ALL,
  E13_FAILURE,
  urlOf,
  fetchRaw,
  dataPathOf,
} from '../lib/P0-10/pages.mjs'
import { nextDataOf } from '../lib/P0-10/dom.mjs'
import {
  canonicalJson,
  sha256,
  replaceStack,
  stackOrigins,
  normaliseLogLine,
  maskFrameNumbers,
  serverOutputFindings,
  STACK_FRAME,
  NEXT_LISTENER_ALLOW,
  NORMALISATIONS,
} from '../lib/P0-10/normalise.mjs'
import { expectBaseline } from '../lib/P0-10/baseline.mjs'
import { serveDoiFixtures } from '../lib/P0-10/harness-gaps.mjs'
import * as sub from '../lib/P0-10/substack.mjs'

// status of every route of the sweep (T-601 owns the matrix; here it proves the sweep reached each answer class)
const STATUS = {
  'search-empty': 308,
  'provider-999999999': 404,
  'unknown-under-search': 404,
  'works-4100': 500,
  'works-4101': 500,
  'works-4102': 500,
  'works-4200': 500,
  'works-6948813': 500,
  'outputs-2102': 500,
  'outputs-2103': 500,
  'providers-q-100pct': 500,
}
const statusOf = (route) => STATUS[route.id] || 200
const INLINE_PROPS_MAX = 20000

// props as the baseline keeps them: the canonical JSON with the run's stack origins replaced; inline when small,
// else its sha256, size and a key outline (the provider map pages carry ~7 MB)
const outline = (v, depth) => {
  if (Array.isArray(v)) return `array(${v.length})`
  if (v && typeof v === 'object')
    return depth === 0
      ? 'object'
      : Object.fromEntries(
          Object.keys(v)
            .sort()
            .map((k) => [k, outline(v[k], depth - 1)])
        )
  return v === null ? 'null' : typeof v
}
function propsEntry(props, origins) {
  const text = replaceStack(canonicalJson(props), origins)
  const bytes = Buffer.byteLength(text)
  return bytes <= INLINE_PROPS_MAX
    ? { bytes, props: JSON.parse(text) }
    : { bytes, sha256: sha256(text), outline: outline(JSON.parse(text), 3) }
}

async function withE13Failure(env, fn) {
  const rule = await stubControl(env, 'POST', '/rules', E13_FAILURE.rule)
  try {
    return await fn()
  } finally {
    await stubControl(env, 'DELETE', `/rules?id=${encodeURIComponent(rule.id)}`)
  }
}

// one serial sweep of every route (HTML, then the _next/data JSON of the getServerSideProps routes); onEach runs
// after each answer
async function sweep(request, env, buildId, onEach = async () => {}) {
  const out = []
  for (const route of ROUTES_ALL) {
    const raw = await fetchRaw(request, urlOf(env, route))
    out.push({ route, kind: 'html', raw })
    await onEach(route, 'html', raw)
    if (route.gssp) {
      const data = await fetchRaw(
        request,
        `${env.baseURL}${dataPathOf(route, buildId)}`
      )
      out.push({ route, kind: 'data', raw: data })
      await onEach(route, 'data', data)
    }
  }
  return out
}

test.describe('T-610 @P0 props and server output', () => {
  // E9 citations from the recorded fixtures while the stub does not list doi.org (I-40, P0-10-1)
  let restoreDoi = async () => {}
  test.beforeEach(async ({ p2Env, resolver }) => {
    restoreDoi = await serveDoiFixtures(p2Env, resolver)
  })
  test.afterEach(async () => restoreDoi())

  test('T-610 c1 @P0 __NEXT_DATA__.props deep-equal the _next/data JSON of the client navigation; page, query, props = baseline', async ({
    request,
    p2Env,
  }) => {
    test.setTimeout(300000)
    const origins = stackOrigins(p2Env)
    const routes = [...ROUTES_200.filter((r) => r.gssp), E13_FAILURE]
    const entries = []
    await withE13Failure(p2Env, async () => {
      for (const route of routes) {
        const raw = await fetchRaw(request, urlOf(p2Env, route))
        expect(raw.status, `${route.id} status`).toBe(200)
        const nd = nextDataOf(raw.text)
        expect(nd && nd.gssp, `${route.id} getServerSideProps page`).toBe(true)
        const data = await fetchRaw(
          request,
          `${p2Env.baseURL}${dataPathOf(route, nd.buildId)}`
        )
        expect(
          [data.status, data.headers['content-type']],
          `${route.id} _next/data answer`
        ).toEqual([200, 'application/json; charset=utf-8'])
        const json = JSON.parse(data.text)
        // deep-equal (key order free): canonical JSON first, the structural diff only on a difference
        if (canonicalJson(json) !== canonicalJson(nd.props))
          expect(json, `${route.id} _next/data = __NEXT_DATA__.props`).toEqual(
            nd.props
          )
        entries.push({
          id: route.id,
          path: route.path,
          data: dataPathOf(route, '<buildId>'),
          page: nd.page,
          query: nd.query,
          ...propsEntry(nd.props, origins),
        })
      }
    })
    // the E13 failure is in the props as the serialised error (T-504 c5): no request header, no URL
    const e13 = entries.find((e) => e.id === E13_FAILURE.id)
    expect(e13.props.pageProps.data.outputs.error).toEqual({
      name: 'InternalServerError',
      response: {},
      data: { message: 'Internal Server Error' },
      type: 'application/json',
      status: 500,
      headers: {},
    })
    expectBaseline(
      't610-next-data',
      entries,
      '__NEXT_DATA__ page, query, props = baseline'
    )
  })

  test('T-610 c2 @P0 no svc.cluster.local, Bearer or stack trace in the HTML and _next/data of any route (404, 500, serialised upstream error)', async ({
    request,
    p2Env,
  }) => {
    test.setTimeout(300000)
    // the in-cluster service of prod is the stub here (Internal_API, 40 §2.2)
    const opts = {
      internalOrigins: [
        ...new Set(
          [p2Env.appEnv && p2Env.appEnv.Internal_API, p2Env.stubURL]
            .filter(Boolean)
            .map((u) => new URL(u).origin)
        ),
      ],
      buildDir: p2Env.build && p2Env.build.dir,
    }
    // the detectors find what they look for (known-positive samples, as the app logs them)
    expect(
      STACK_FRAME.test(
        'Error: x\\n    at O (/app/node_modules/react/cjs/react.production.min.js:17:207)'
      )
    ).toBe(true)
    expect(
      serverOutputFindings(
        `{"u":"http://core-frontend-api.core-frontend.svc.cluster.local/v3","h":"Bearer test-key","o":"${opts.internalOrigins[0]}/v3"}`,
        opts
      ).map((f) => f.kind)
    ).toEqual([
      'svc.cluster.local',
      ...opts.internalOrigins.map(() => 'Internal_API origin'),
      'Bearer ',
    ])
    expect(
      STACK_FRAME.test('the risks look more serious at lower levels')
    ).toBe(false)

    const found = []
    const statuses = {}
    await withE13Failure(p2Env, () =>
      sweep(request, p2Env, p2Env.build.buildId, async (route, kind, raw) => {
        if (kind === 'html') statuses[route.id] = raw.status
        else expect(raw.status, `${route.id} _next/data status`).toBe(200)
        for (const f of serverOutputFindings(raw.text, opts))
          found.push({ route: route.id, kind, ...f })
      })
    )
    expect(statuses).toEqual(
      Object.fromEntries(ROUTES_ALL.map((r) => [r.id, statusOf(r)]))
    )
    expect(found).toEqual([])
  })

  test('T-610 c3 @P0 app stdout/stderr line census over a serial sweep = baseline (console.time normalised; no Next 13.5/16 listener lines on Next 10)', async ({
    request,
    p2Env,
    resolver,
  }) => {
    test.setTimeout(300000)
    expect(NORMALISATIONS.serverOutput).toHaveLength(5)
    expect(NEXT_LISTENER_ALLOW).toEqual([])
    // masking frames changes only the trailing line:column of a frame line
    expect(
      [
        '    at formatCitationDate (<build>/.next/server/pages/works/[id].js:2626:34)',
        '    at <build>/.next/server/pages/data-providers.js:10021:31',
        '    at decodeURI (<anonymous>)',
        'fetchWorks:<reqId>: <duration>',
        'Error: at 12:34',
      ].map(maskFrameNumbers)
    ).toEqual([
      '    at formatCitationDate (<build>/.next/server/pages/works/[id].js:<line>:<col>)',
      '    at <build>/.next/server/pages/data-providers.js:<line>:<col>',
      '    at decodeURI (<anonymous>)',
      'fetchWorks:<reqId>: <duration>',
      'Error: at 12:34',
    ])
    const id = sub.subId(p2Env, 't610-c3')
    const { env, offset } = await sub.up(id, p2Env)
    const census = { startup: [], sweep: [], after: [] }
    try {
      const restore = await serveDoiFixtures(env, resolver)
      const log = sub.appLogOf(env)
      const origins = stackOrigins(env)
      const lines = (text) =>
        text
          .split('\n')
          .filter((l) => l !== '')
          .map((l) => normaliseLogLine(l, { buildDir: env.build.dir, origins }))
      // the startup output is complete once the app answers (the CLI waits for /api/healthz/)
      let at = offset
      let r = sub.readFrom(log, at)
      census.startup = lines(r.text)
      at = r.to
      await withE13Failure(env, () =>
        sweep(request, env, env.build.buildId, async (route, kind, raw) => {
          expect(raw.status, `${route.id} ${kind}`).toBe(
            kind === 'html' ? statusOf(route) : 200
          )
          r = sub.readFrom(log, at)
          at = r.to
          census.sweep.push({ id: route.id, kind, lines: lines(r.text) })
        })
      )
      await restore()
      const problems = await stubControl(env, 'GET', '/problems')
      expect(problems, 'the sweep ran on fixtures only').toEqual([])
      await sub.down(id)
      census.after = lines(sub.readFrom(log, at).text)
    } finally {
      await sub.down(id)
    }
    const all = [
      ...census.startup,
      ...census.sweep.flatMap((s) => s.lines),
      ...census.after,
    ]
    // Next 13.5 / 16 print their own uncaughtException/unhandledRejection listener lines; Next 10 prints none
    expect(
      all.filter(
        (l) =>
          /uncaughtException|unhandledRejection/.test(l) &&
          !NEXT_LISTENER_ALLOW.some((re) => re.test(l))
      )
    ).toEqual([])
    // compared on the masked form: the run's frames are masked, and masking the baseline changes nothing, it holds
    // only masked frames since its re-capture (9024f15)
    const masked = (c) => ({
      startup: c.startup.map(maskFrameNumbers),
      sweep: c.sweep.map((s) => ({
        ...s,
        lines: s.lines.map(maskFrameNumbers),
      })),
      after: c.after.map(maskFrameNumbers),
    })
    expectBaseline(
      't610-stdout-census',
      census,
      'app stdout/stderr census = baseline',
      masked
    )
  })

  test('T-610 c4 @P0 0 server Sentry events at the counting stub over the sweep (404, 500, upstream error)', async ({
    request,
    p2Env,
  }) => {
    test.setTimeout(300000)
    // the parity build inlines the test DSN (42 §2), so the server SDK is initialised and would send to the stub
    expect(p2Env.build.variant).toBe('default')
    expect(p2Env.appEnv.SENTRY_DSN).toBe('https://public@o0.ingest.sentry.io/0')
    const { records, problems } = await withWireCapture(p2Env, () =>
      withE13Failure(p2Env, () => sweep(request, p2Env, p2Env.build.buildId))
    )
    const sentry = records.filter((r) =>
      /(^|\.)sentry\.io$/.test(new URL(r.url).hostname)
    )
    // the window holds the sweep's own upstream calls (e.g. E4 of work 4100, E13 of the failure state)
    const urls = records.map((r) => r.url)
    expect(urls).toContain('https://api.core.ac.uk/v3/works/4100?t=undefined')
    expect(
      urls.some((u) => new RegExp(E13_FAILURE.rule.urlRegex).test(u))
    ).toBe(true)
    expect(problems.filter((p) => p.kind !== 'conflicting fixtures')).toEqual(
      []
    )
    expect(sentry).toEqual([])
  })
})
