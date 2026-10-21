// T-907 (41 J, ops project; R-003, R-068, R-088): the in-cluster smoke list that runs after every deploy.
//   c1  the list against a deployed base URL (`P2_OPS_BASE`: stage, or prod over the probe path of VF-14), with
//       real third parties and no fixtures. DEFERRED: needs the deployment and the probe path (owner); never run
//       against prod here. Data-dependent values are checked by rule, record ids come from the probe list
//       (`P2_PROBE_WORK`, `P2_PROBE_OUTPUT`, `P2_PROBE_PROVIDER`, `P2_PROBE_WORKS`).
//   c2  the same checks against the compose-equivalent app of the harness (`--run`; C6-CI rows 6): T-601
//       statuses, citation/JSON-LD order on 5 works, `_next/data` navigation, 0 pageerrors, 3 sentinel styles, GA
//       collect, and `/data-providers/` shows at least 90 % of the snapshot's providers.
//   c3  the prod telemetry liveness probe (55 C6-prod row 8): a live `doi: null` output
//       (`P2_PROBE_DOI_NULL`, a path from VF-03) loaded in a real browser attempts a Sentry or LogRocket event;
//       the arrival within 10 minutes is read from the team's monitoring (VF-04), the test records the attempt
//       and its time. DEFERRED with c1.
// Run (Node 24, from the repo root):
//   c2   P2_OPS=1 npm run e2e -- --run <id> e2e/ops/t907-smoke.spec.mjs --project ops -g 'T-907 c2'
//   c1/c3 rehearsal on the harness stack (the guarded context; tests the code, is no evidence for a deployment):
//        P2_OPS=1 P2_OPS_REHEARSE=1 npm run e2e -- --run <id> e2e/ops/t907-smoke.spec.mjs --project ops -g 'T-907 c[13]'
//   c1/c3 on a deployment (no stack; the probe ids are the VF-03 / 01 §4 step 8 probe list):
//        cd e2e && P2_OPS=1 E2E_RUN=ops-<name> P2_OPS_BASE=https://<host> P2_PROBE_WORK=<id> P2_PROBE_OUTPUT=<id> \
//          P2_PROBE_WORKS=<id>,<id> P2_PROBE_DOI_NULL=/outputs/<id>/ npx playwright test -c ../playwright.config.mjs \
//          ops/t907-smoke.spec.mjs --project ops -g 'T-907 c[13]'
import { test as base, expect } from '../fixtures/guard.mjs'
import { LOCALE, TIMEZONE_ID } from '../fixtures/constants.mjs'
import { p016Fixtures } from '../lib/P0-16/fixtures.mjs'
import {
  FIXED_ROWS,
  LOCAL_ROWS,
  SENTINELS,
  STATUS_ROWS,
  checkStatuses,
  headSignature,
  headTags,
  isGaCollect,
  isTelemetryHost,
  liveRows,
  orderViolations,
  providerCount,
  sentinelValue,
  snapshotProviders,
} from '../lib/P0-16/smoke.mjs'
import { routeChange, settle, trackPage } from '../lib/P0-16/page.mjs'

// a hard load plus the settle wait can take tens of seconds on a loaded machine (40 §5: timeouts, never retries)
base.describe.configure({ timeout: 300000 })

const stack = { test: base.extend(p016Fixtures) }
const REHEARSE = process.env.P2_OPS_REHEARSE === '1'
const LIVE_BASE = process.env.P2_OPS_BASE
// c1/c3 on a deployment: no stack, no fixtures, a plain browser context with the real third parties
const live = {
  test: REHEARSE
    ? stack.test
    : base.extend({
        p2Env: [
          async ({}, use) => {
            await use({
              baseURL: LIVE_BASE,
              appURL: LIVE_BASE,
              controlURL: 'http://127.0.0.1:9',
            })
          },
          { scope: 'worker' },
        ],
        context: async ({ browser }, use) => {
          const context = await browser.newContext({
            baseURL: LIVE_BASE,
            timezoneId: TIMEZONE_ID,
            locale: LOCALE,
          })
          await use(context)
          await context.close()
        },
      }),
}

const LD =
  'ld+json[@context,@graph|BreadcrumbList{@type,itemListElement}|ScholarlyArticle{@type,@id,headline,abstract,name,author,datePublished,isAccessibleForFree,provider,image,publisher}]'
// the five recorded works of the harness: the order of citation_*, DC.* and the JSON-LD today (R-003), and a
// hash of every tag's value in that order
const FIVE_WORKS = {
  1001: {
    sequence: `citation_title citation_author*6 citation_publication_date DC.creator*6 DC.title DCTERMS.abstract ${LD}`,
    values: 'b26e350240c7',
  },
  1002: {
    sequence: `citation_title citation_author DC.creator DC.title DCTERMS.abstract ${LD}`,
    values: 'c451b83776c7',
  },
  1003: {
    sequence: `citation_title citation_author*30 citation_publication_date DC.creator*30 DC.title DCTERMS.abstract ${LD}`,
    values: '61b54f93943a',
  },
  1005: {
    sequence: `citation_title citation_author*6 citation_publication_date DC.creator*6 DC.title DCTERMS.abstract ${LD}`,
    values: 'c238e58a1715',
  },
  1007: {
    sequence: `citation_title citation_author*6 citation_publication_date DC.creator*6 DC.title DCTERMS.abstract ${LD}`,
    values: '6ef5fe6dc5cb',
  },
}

const minProviders = () => Math.ceil(0.9 * snapshotProviders())

// the client navigation of the smoke list (R-068): search -> /outputs/update/ (no gSSP) -> a provider page,
// which asks for its page data through the gateway prefix. The document is never reloaded.
async function navigate(page, origin, provider) {
  const tracker = trackPage(page)
  const data = []
  page.on('response', (r) => {
    if (/\/_next\/data\//.test(r.url()))
      data.push({
        url: r.url(),
        status: r.status(),
        type: r.headers()['content-type'] || '',
      })
  })
  await page.goto(`${origin}/search/?q=climate`)
  await settle(page, tracker, () => page.url())
  const buildId = await page.evaluate(() => window.__NEXT_DATA__.buildId)
  const origin0 = await page.evaluate(() => {
    window.__t907 = performance.timeOrigin
    return window.__t907
  })
  await routeChange(page, tracker, () => page.url(), '/outputs/update/')
  await routeChange(
    page,
    tracker,
    () => page.url(),
    `/data-providers/${provider}/`
  )
  return {
    buildId,
    data,
    reloaded: (await page.evaluate(() => window.__t907)) !== origin0,
    path: new URL(page.url()).pathname,
  }
}

function expectNavigation(nav, provider) {
  expect(nav.reloaded, 'the document was reloaded').toBe(false)
  expect(nav.path).toBe(`/data-providers/${provider}/`)
  const wanted = nav.data.filter((d) => {
    const u = new URL(d.url)
    return (
      u.pathname ===
        `/search/_next/data/${nav.buildId}/data-providers/${provider}.json` &&
      u.search === `?id=${provider}`
    )
  })
  expect(wanted.map((d) => d.status)).toEqual([200])
  expect(wanted[0].type).toMatch(/application\/json/)
}

// ---------------------------------------------------------------------------------------------------------
// c2: the compose-equivalent app
// ---------------------------------------------------------------------------------------------------------
stack.test.describe('T-907 c2 compose app', () => {
  stack.test(
    'T-907 c2 @P0 T-601 statuses: the routed table through the gateway, the local-only pages through the allow-all proxy',
    async ({ request, p2Env }) => {
      expect(await checkStatuses(request, p2Env.baseURL, STATUS_ROWS)).toEqual(
        []
      )
      expect(await checkStatuses(request, p2Env.allowURL, LOCAL_ROWS)).toEqual(
        []
      )
    }
  )

  stack.test(
    'T-907 c2 @P0 citation, DC and JSON-LD order on 5 works',
    async ({ request, p2Env }) => {
      const got = {}
      for (const id of Object.keys(FIVE_WORKS)) {
        const res = await request.get(`${p2Env.baseURL}/works/${id}/`)
        expect(res.status()).toBe(200)
        const html = await res.text()
        got[id] = headSignature(html)
        // the rule that the live profile applies holds on the same answers
        expect(orderViolations(html), `work ${id}`).toEqual([])
      }
      expect(got).toEqual(FIVE_WORKS)
    }
  )

  stack.test(
    'T-907 c2 @P0 _next/data navigation without a reload',
    async ({ page, p2Env, guardLog }) => {
      const nav = await navigate(page, p2Env.baseURL, 86)
      expectNavigation(nav, 86)
      expect(guardLog.pageErrors).toEqual([])
    }
  )

  stack.test(
    'T-907 c2 @P0 0 pageerrors and 3 sentinel styles on a search page and a work page',
    async ({ page, p2Env, guardLog }) => {
      const tracker = trackPage(page)
      const seen = {}
      for (const [kind, path] of [
        ['search', '/search/?q=climate'],
        ['work', '/works/1001/'],
      ]) {
        await page.goto(`${p2Env.baseURL}${path}`)
        await settle(page, tracker, () => page.url())
        for (const s of SENTINELS.filter((x) => x.page === kind))
          seen[s.id] = await sentinelValue(page, s)
      }
      expect(seen).toEqual(
        Object.fromEntries(SENTINELS.map((s) => [s.id, s.value]))
      )
      expect(guardLog.pageErrors).toEqual([])
      expect(guardLog.windowErrors).toEqual([])
    }
  )

  stack.test.describe('GA', () => {
    stack.test.use({ cookieState: 'essential+analytics' })
    stack.test(
      'T-907 c2 @P0 GA collect: the tag is requested once and configured with the build ID',
      async ({ page, p2Env, guardLog }) => {
        const tracker = trackPage(page)
        await page.goto(`${p2Env.baseURL}/search/?q=climate`)
        await settle(page, tracker, () => page.url())
        const gtag = guardLog.requests.filter((r) =>
          /^https:\/\/www\.googletagmanager\.com\/gtag\/js/.test(r.url)
        )
        expect(gtag.map((r) => r.url)).toEqual([
          `https://www.googletagmanager.com/gtag/js?id=${p2Env.appEnv.GA_TRACKING_CODE}`,
        ])
        const layer = await page.evaluate(() =>
          Array.from(window.dataLayer || [], (e) =>
            e && typeof e === 'object' && e.length !== undefined
              ? Array.from(e)
              : e
          )
        )
        expect(layer.filter((e) => e[0] === 'config').map((e) => e[1])).toEqual(
          [p2Env.appEnv.GA_TRACKING_CODE]
        )
        expect(p2Env.appEnv.GA_TRACKING_CODE).toMatch(/^G-/)
      }
    )
  })

  stack.test(
    'T-907 c2 @P0 /data-providers/ lists at least 90 % of the snapshot providers',
    async ({ request, p2Env }) => {
      const res = await request.get(`${p2Env.baseURL}/data-providers/`)
      expect(res.status()).toBe(200)
      const html = await res.text()
      const shown = providerCount(html)
      expect(shown).not.toBeNull()
      expect(shown).toBeGreaterThanOrEqual(minProviders())
      // the introduction and the page data agree
      const data = JSON.parse(
        html.match(
          /<script id="__NEXT_DATA__" type="application\/json">(.*?)<\/script>/s
        )[1]
      )
      expect(data.props.pageProps.initialState.dataProviders.data.length).toBe(
        shown
      )
      stack.test.info().annotations.push({
        type: 'providers',
        description: `${shown} of ${snapshotProviders()}`,
      })
    }
  )

  stack.test(
    'T-907 c2 @P0 the checks can fail: a wrong status, a reordered head, a missing style, a short provider list',
    async () => {
      // statuses: a request stand-in that answers 200 where a 308 is listed, and 301 with another Location
      const answer = (status, location) => ({
        get: async () => ({
          status: () => status,
          headers: () => (location ? { location } : {}),
        }),
      })
      expect(
        await checkStatuses(answer(200), 'http://x', [
          ['/search', 308, '/search/'],
        ])
      ).toEqual(['/search: 200, want 308'])
      expect(
        await checkStatuses(answer(308, '/other/'), 'http://x', [
          ['/search', 308, '/search/'],
        ])
      ).toEqual(['/search: Location /other/, want /search/'])
      expect(
        await checkStatuses(answer(308, '/search/'), 'http://x', [
          ['/search', 308, '/search/'],
        ])
      ).toEqual([])

      // head order: swapping two tags changes the signature and breaks the rule
      const meta = (n, c) => `<meta name="${n}" content="${c}"/>`
      const ld =
        '<script type="application/ld+json">{"@context":"x","@graph":[{"@type":"A","k":1}]}</script>'
      const page = (...tags) =>
        `<html><head>${tags.join('')}</head><body></body></html>`
      const ok = page(
        meta('citation_title', 't'),
        meta('citation_author', 'a'),
        meta('citation_author', 'b'),
        meta('DC.title', 't'),
        ld
      )
      const swapped = page(
        meta('citation_author', 'a'),
        meta('citation_title', 't'),
        meta('citation_author', 'b'),
        meta('DC.title', 't'),
        ld
      )
      expect(orderViolations(ok)).toEqual([])
      expect(orderViolations(swapped)).toEqual([
        'citation_title comes after citation_author',
      ])
      expect(headSignature(ok).sequence).toBe(
        'citation_title citation_author*2 DC.title ld+json[@context,@graph|A{@type,k}]'
      )
      expect(headSignature(swapped)).not.toEqual(headSignature(ok))
      expect(orderViolations(page(meta('citation_title', 't')))).toContain(
        'no JSON-LD block'
      )
      expect(orderViolations(page(ld, meta('citation_title', 't')))).toContain(
        'the last tag is citation_title, not the JSON-LD'
      )
      expect(
        headTags(page(meta('viewport', 'x'), meta('next-head-count', '9')))
      ).toEqual([])

      // providers: the sentence of the directory, with and without a thousands separator
      expect(
        providerCount('<p>15672 repositories and journals around the world')
      ).toBe(15672)
      expect(
        providerCount(
          'over <!-- -->15,672<!-- --> <!-- -->repositories and journals around the world.'
        )
      ).toBe(15672)
      expect(providerCount('<p>no count here</p>')).toBeNull()
      // telemetry and GA hosts the live profile looks for
      expect(isTelemetryHost('o1.ingest.sentry.io')).toBe(true)
      expect(isTelemetryHost('r.lgrckt-in.com')).toBe(true)
      expect(isTelemetryHost('www.example.org')).toBe(false)
      expect(
        isGaCollect('https://www.google-analytics.com/g/collect?v=2&tid=G-X')
      ).toBe(true)
      expect(
        isGaCollect('https://region1.google-analytics.com/g/collect?v=2')
      ).toBe(true)
      expect(
        isGaCollect('https://www.googletagmanager.com/gtag/js?id=G-X')
      ).toBe(false)
      // the rows a deployment is asked are a subset of the T-601 table, without the paths another service
      // answers on a public host
      expect(FIXED_ROWS.length).toBeGreaterThan(10)
      for (const row of FIXED_ROWS) expect(STATUS_ROWS).toContain(row)
      expect(FIXED_ROWS.map(([p]) => p)).not.toContain('/robots.txt')
      expect(FIXED_ROWS.map(([p]) => p)).not.toContain('/api/healthz/')
      expect(liveRows({ work: 1, output: 2, provider: 3 })).toHaveLength(10)
    }
  )
})

// ---------------------------------------------------------------------------------------------------------
// c1 / c3: a deployment (or, with P2_OPS_REHEARSE=1, the harness stack as a rehearsal of the code)
// ---------------------------------------------------------------------------------------------------------
const need = (name) => {
  const v = process.env[name]
  if (!v)
    throw new Error(
      `${name} is not set: T-907 c1/c3 run against a deployment, see the header of e2e/ops/t907-smoke.spec.mjs`
    )
  return v
}
const targetOf = (p2Env) => {
  if (REHEARSE)
    return {
      origin: p2Env.baseURL,
      work: process.env.P2_PROBE_WORK || '1001',
      output: process.env.P2_PROBE_OUTPUT || '2001',
      provider: process.env.P2_PROBE_PROVIDER || '86',
      works: (process.env.P2_PROBE_WORKS || '1001,1002,1003,1005,1007').split(
        ','
      ),
      doiNull: process.env.P2_PROBE_DOI_NULL || '/works/7401/',
    }
  return {
    origin: need('P2_OPS_BASE').replace(/\/$/, ''),
    work: need('P2_PROBE_WORK'),
    output: need('P2_PROBE_OUTPUT'),
    provider: process.env.P2_PROBE_PROVIDER || '86',
    works: need('P2_PROBE_WORKS').split(','),
    doiNull: process.env.P2_PROBE_DOI_NULL,
  }
}

live.test.describe('T-907 c1 deployment', () => {
  live.test(
    'T-907 c1 @P0 the smoke list on a deployed base URL',
    async ({ page, context, request, p2Env }) => {
      const t = targetOf(p2Env)
      const errors = []
      page.on('pageerror', (e) => errors.push(e.message))

      await live.test.step(
        'T-601 statuses (fixed rows and the probe list)',
        async () => {
          const rows = [...FIXED_ROWS, ...liveRows(t)]
          expect(await checkStatuses(request, t.origin, rows)).toEqual([])
        }
      )

      await live.test.step(
        'citation, DC and JSON-LD order on the probe works',
        async () => {
          expect(t.works.length).toBeGreaterThanOrEqual(1)
          for (const id of t.works) {
            const res = await request.get(`${t.origin}/works/${id}/`)
            expect(res.status(), `work ${id}`).toBe(200)
            expect(orderViolations(await res.text()), `work ${id}`).toEqual([])
          }
        }
      )

      await live.test.step(
        '_next/data navigation without a reload',
        async () => {
          const nav = await navigate(page, t.origin, t.provider)
          expectNavigation(nav, t.provider)
        }
      )

      await live.test.step('3 sentinel styles', async () => {
        const tracker = trackPage(page)
        const seen = {}
        for (const [kind, path] of [
          ['search', '/search/?q=climate'],
          ['work', `/works/${t.work}/`],
        ]) {
          await page.goto(`${t.origin}${path}`)
          await settle(page, tracker, () => page.url())
          for (const s of SENTINELS.filter((x) => x.page === kind))
            seen[s.id] = await sentinelValue(page, s)
        }
        expect(seen).toEqual(
          Object.fromEntries(SENTINELS.map((s) => [s.id, s.value]))
        )
      })

      await live.test.step('GA collect with the analytics cookie', async () => {
        await context.addCookies(
          ['essential_cookies_allowed', 'analytics_cookies_allowed'].map(
            (name) => ({ name, value: 'true', url: t.origin })
          )
        )
        const requests = []
        page.on('request', (r) => requests.push(r.url()))
        await page.goto(`${t.origin}/search/?q=climate`)
        if (REHEARSE) {
          // the harness answers the tag with an empty script: the collect request cannot exist, the tag request
          // and the config call are the visible half (as in c2)
          await expect
            .poll(
              () =>
                requests.filter((u) =>
                  /googletagmanager\.com\/gtag\/js/.test(u)
                ).length
            )
            .toBe(1)
          return
        }
        await expect
          .poll(() => requests.filter(isGaCollect).length, { timeout: 30000 })
          .toBeGreaterThan(0)
        expect(requests.find(isGaCollect)).toMatch(/[?&]tid=G-/)
      })

      await live.test.step(
        '/data-providers/ lists at least 90 % of the snapshot providers',
        async () => {
          const res = await request.get(`${t.origin}/data-providers/`)
          expect(res.status()).toBe(200)
          expect(providerCount(await res.text())).toBeGreaterThanOrEqual(
            minProviders()
          )
        }
      )

      expect(errors).toEqual([])
    }
  )
})

live.test.describe('T-907 c3 telemetry probe', () => {
  live.test(
    'T-907 c3 @P0 the telemetry liveness probe attempts a Sentry or LogRocket event',
    async ({ page, context, p2Env }, testInfo) => {
      const t = targetOf(p2Env)
      // the page crashes while it hydrates (Q-074a): the console error and the blocked report are the subject
      testInfo.annotations.push(
        { type: 'guard-expect', description: 'console' },
        { type: 'guard-expect', description: 'csp' }
      )
      const path = t.doiNull
      if (!path)
        throw new Error(
          'P2_PROBE_DOI_NULL (a live doi:null output path, VF-03) is not set'
        )
      await context.addCookies(
        ['essential_cookies_allowed', 'analytics_cookies_allowed'].map(
          (name) => ({ name, value: 'true', url: t.origin })
        )
      )
      const attempts = []
      const csp = []
      page.on('request', (r) => {
        const host = new URL(r.url()).hostname
        if (isTelemetryHost(host))
          attempts.push({
            at: new Date().toISOString(),
            method: r.method(),
            host,
          })
      })
      await page.exposeFunction('__t907Csp', (e) => csp.push(e))
      await page.addInitScript(() => {
        document.addEventListener('securitypolicyviolation', (e) =>
          window.__t907Csp({
            directive: e.effectiveDirective,
            blocked: new URL(e.blockedURI, location.href).hostname,
          })
        )
      })
      const startedAt = new Date().toISOString()
      await page.goto(`${t.origin}${path}`)
      // the hydration of this page crashes (Q-074a); the reports leave the page after that
      await expect
        .poll(
          () =>
            attempts.length +
            csp.filter((c) => isTelemetryHost(c.blocked)).length,
          {
            timeout: 30000,
          }
        )
        .toBeGreaterThan(0)
      await testInfo.attach('telemetry-probe', {
        contentType: 'application/json',
        body: JSON.stringify(
          {
            path,
            startedAt,
            attempts,
            blockedByCsp: csp.filter((c) => isTelemetryHost(c.blocked)),
            confirm:
              'look for the event in Sentry or LogRocket within 10 minutes (VF-04)',
          },
          null,
          1
        ),
      })
    }
  )
})
