// T-721 (41 H; R-007, R-021, R-082): no image, icon, CSS or JS response >= 400 on any route or modal.
//   c1  every T-601 HTML route (29 routes incl. /display/<id>/ through the gateway-faithful proxy, the two
//       local-only pages through the allow-all proxy, plus the 404 and 500 pages), hard-loaded to the settled
//       hydrated page, and every client-only modal/panel of T-605 c1 (CSV, Cite, Report type + form, claim
//       form, OAI route, advanced-search help, facet field), and a client navigation chain that fetches the
//       lazy page chunks: the census of e2e/lib/P0-16/assets.mjs (resource type AND file extension, so the
//       icon sprite and the router's own CSS/JS fetches count) has no response >= 400, no failed request
//       and no stack asset outside the `/static/search/` prefix (BUILD_TARGET=azure, utils/helpers.js:1-2);
//       every asset URL the SSR HTML refers to answers < 400 too. The census is not vacuous: CSS, scripts and
//       the sprite were requested.
//   c2  negative control (R-082): a stack started without BUILD_TARGET (`next start` re-reads next.config.js,
//       42 §2) serves its CSS and JS under the unrouted `/_next/static/`; the SAME verdict function that is
//       empty in c1 must then fail, the page stays unhydrated, and the package's own stack passes it.
// Harness stand-ins (e2e/lib/P0-16/harness-gaps.mjs) answer only core.ac.uk thumbnails/placeholders, the
// allow-all proxy's /static/search/** and the doi.org citation requests; none touches an asset of the app.
import { test as base, expect } from '../fixtures/guard.mjs'
import { createResolver } from '../../test/fixtures/resolve.mjs'
import { p016Fixtures } from '../lib/P0-16/fixtures.mjs'
import {
  THUMBNAIL_PATH,
  assetReport,
  htmlAssetUrls,
  kindOf,
  violations,
  watchAssets,
} from '../lib/P0-16/assets.mjs'
import {
  guardedContext,
  newGuardLog,
  routeChange,
  settle,
  stackOriginsOf,
  trackPage,
  urlOf,
} from '../lib/P0-16/page.mjs'
import { coverSsrGaps, probeBrowserGaps } from '../lib/P0-16/harness-gaps.mjs'
import { MODALS, ROUTES } from '../lib/P0-16/routes.mjs'
import { down, subId, up } from '../lib/P0-16/substack.mjs'

const test = base.extend(p016Fixtures)
// a hard load plus the settle wait can take tens of seconds on a loaded machine (40 §5: timeouts, never retries)
test.describe.configure({ timeout: 180000 })

// Console lines of today's app that the guard has no allow-list entry for, none of them an asset failure. A
// route that has them declares the guard's console check expected and asserts that every console.error is one
// of its pins (and that there is at least one): the KaTeX parse failure design MathMarkdown logs for the `\sb2`
// in a title of the recorded climate page 2 (issue P0-12-7), and Chromium's line for the 404/500 document
// itself plus Next's initial error object on the 500 page (issue P0-09-6).
const KATEX = /^couldn`t convert string /
const DOC_404 =
  /^Failed to load resource: the server responded with a status of 404 \(Not Found\)$/
const DOC_500 =
  /^Failed to load resource: the server responded with a status of 500 \(Internal Server Error\)$/
const ERR_500 =
  /^\{name: Internal Server Error\., message: 500 - Internal Server Error\., statusCode: 500\}$/
const CONSOLE_PINS = {
  'search-climate-p2-all-params': [KATEX],
  'search-foo-404': [DOC_404],
  'works-4200-500': [DOC_500, ERR_500],
}

const signature = (rec) => () => `${rec.responses.length}:${rec.failed.length}`

// fail fast: the initial assets are all answered once the load event fired, so a broken stack (no hydration
// ever) reports its 404s now instead of after the hydration timeout
async function expectLoadedAssets(page, rec, p2Env) {
  await page.waitForLoadState('load')
  expect(violations(assetReport(rec, stackOriginsOf(p2Env)))).toEqual([])
}

// the asset census of a settled page, with the minimum a real page must show (the check is not vacuous)
function expectCensus(rep, { scripts = true, sprite = true } = {}) {
  const info = test.info()
  info.annotations.push({
    type: 'asset-census',
    description: JSON.stringify({
      total: rep.total,
      stack: rep.stack,
      byKind: rep.byKind,
      thumbnails: rep.thumbnails.length,
    }),
  })
  expect(violations(rep)).toEqual([])
  expect(rep.stack).toBeGreaterThanOrEqual(5)
  expect(rep.byKind.css || 0).toBeGreaterThanOrEqual(1)
  if (scripts) expect(rep.byKind.js || 0).toBeGreaterThanOrEqual(3)
  if (sprite) expect(rep.byKind.icon || 0).toBeGreaterThanOrEqual(1)
}

// every asset URL the raw SSR HTML refers to (stack origins only), fetched without redirects: all < 400. The
// allow-all proxy forwards /static/search/** raw (harness gap P0-12-2), so those are asked of the gateway.
async function expectHtmlAssets(request, p2Env, html, pageUrl) {
  const origins = stackOriginsOf(p2Env)
  const allow = new URL(p2Env.allowURL).origin
  const gateway = new URL(p2Env.baseURL).origin
  // result thumbnails are core.ac.uk links the resolver rewrites to the stack origin (I-39): not assets of the
  // search app, answered in the browser by the stand-in and counted by the census there
  const urls = htmlAssetUrls(html, pageUrl, origins).filter(
    (u) => !THUMBNAIL_PATH.test(new URL(u).pathname)
  )
  expect(urls.length).toBeGreaterThanOrEqual(3)
  const bad = []
  for (const u of urls) {
    const asked = new URL(u)
    if (asked.origin === allow && asked.pathname.startsWith('/static/search/'))
      asked.href = u.replace(allow, gateway)
    const res = await request.get(asked.href, { maxRedirects: 0 })
    if (res.status() >= 400) bad.push(`${res.status()} ${u}`)
  }
  expect(bad).toEqual([])
  return urls.length
}

test.describe('T-721 c1 routes', () => {
  for (const route of ROUTES)
    test(`T-721 c1 @P0 route ${route.id}: no image, icon, CSS or JS response >= 400`, async ({
      page,
      request,
      p2Env,
      guardLog,
    }) => {
      const pinned = CONSOLE_PINS[route.id]
      if (pinned)
        test
          .info()
          .annotations.push({ type: 'guard-expect', description: 'console' })
      const rec = watchAssets(page)
      const tracker = trackPage(page)
      const response = await page.goto(urlOf(p2Env, route))
      expect(response.status()).toBe(route.status || 200)
      const html = await response.text()
      await expectLoadedAssets(page, rec, p2Env)
      await settle(page, tracker, signature(rec))
      const rep = assetReport(rec, stackOriginsOf(p2Env))
      expectCensus(rep)
      if (pinned) {
        expect(guardLog.consoleErrors.length).toBeGreaterThan(0)
        expect(
          guardLog.consoleErrors
            .map((e) => e.text.split('\n')[0])
            .filter((t) => !pinned.some((re) => re.test(t)))
        ).toEqual([]) // AD-112, AD-228 (keyed works-4100-500; the route is works-4200-500 since the owner fix 978c6e4)
      }
      const refs = await expectHtmlAssets(request, p2Env, html, page.url())
      test
        .info()
        .annotations.push({ type: 'html-asset-refs', description: `${refs}` })
    })
})

test.describe('T-721 c1 modals', () => {
  for (const modal of MODALS)
    test(`T-721 c1 @P0 modal ${modal.id}: no image, icon, CSS or JS response >= 400 once opened`, async ({
      page,
      p2Env,
    }) => {
      const rec = watchAssets(page)
      const tracker = trackPage(page)
      await page.goto(`${p2Env.baseURL}${modal.path}`)
      await expectLoadedAssets(page, rec, p2Env)
      await settle(page, tracker, signature(rec))
      const before = rec.responses.length
      await modal.act(page)
      await settle(page, tracker, signature(rec))
      const rep = assetReport(rec, stackOriginsOf(p2Env))
      test.info().annotations.push({
        type: 'assets-after-open',
        description: `${rec.responses.length - before} new`,
      })
      expectCensus(rep)
    })
})

test.describe('T-721 c1 client navigation', () => {
  // the lazy page chunks and their CSS are fetched on a route change (Next 10 route loader): search ->
  // /outputs/update/ (no gSSP, Q-011) -> provider 86, the chain that stays clear of the crashing pairs (Q-047)
  test('T-721 c1 @P0 client navigation chain: the lazy page chunks and styles answer < 400', async ({
    page,
    p2Env,
  }) => {
    const rec = watchAssets(page)
    const tracker = trackPage(page)
    await page.goto(`${p2Env.baseURL}/search/?q=climate`)
    await expectLoadedAssets(page, rec, p2Env)
    await settle(page, tracker, signature(rec))
    const first = rec.responses.length
    await routeChange(page, tracker, signature(rec), '/outputs/update/')
    const second = rec.responses.length
    await routeChange(page, tracker, signature(rec), '/data-providers/86/')
    const rep = assetReport(rec, stackOriginsOf(p2Env))
    // each route change fetched its own chunks (and the page of a route change is not the hard-loaded one)
    expect(second).toBeGreaterThan(first)
    expect(rec.responses.length).toBeGreaterThan(second)
    expect(
      rep.urls.filter((u) => /\/chunks\/pages\//.test(u)).length
    ).toBeGreaterThanOrEqual(3)
    expectCensus(rep)
  })
})

test.describe('T-721 c2 negative control', () => {
  // a stack of its own without BUILD_TARGET; the package's stack is the positive control
  test('T-721 c2 @P0 a stack started without BUILD_TARGET fails the asset check (R-082)', async ({
    page,
    browser,
    p2Env,
  }) => {
    test.setTimeout(420000)

    // positive control: the package's own stack passes the verdict on the same page
    const okRec = watchAssets(page)
    const okTracker = trackPage(page)
    await page.goto(`${p2Env.baseURL}/works/1001/`)
    await settle(page, okTracker, signature(okRec))
    const okRep = assetReport(okRec, stackOriginsOf(p2Env))
    expect(violations(okRep)).toEqual([])
    expect(p2Env.appEnv.BUILD_TARGET).toBe('azure')

    const id = subId(p2Env, 't721-nobt')
    const sub = await up(id, p2Env, ['BUILD_TARGET='])
    try {
      // the control really runs without BUILD_TARGET (the image ENV the harness sets is removed)
      expect(sub.appEnv.BUILD_TARGET).toBeUndefined()
      expect(sub.build.key).toBe(p2Env.build.key)
      const subResolver = createResolver({ linkOrigin: sub.baseURL })
      const gaps = await probeBrowserGaps(sub)
      const cleanupSsr = await coverSsrGaps(sub, subResolver)
      const log = newGuardLog()
      const ctx = await guardedContext(browser, {
        env: sub,
        resolver: subResolver,
        log,
        gaps,
      })
      try {
        const results = {}
        for (const path of [
          '/search/?q=climate',
          '/works/1001/',
          '/outputs/update/',
          '/data-providers/86/',
        ]) {
          const p = await ctx.newPage()
          const rec = watchAssets(p)
          const tracker = trackPage(p)
          const response = await p.goto(`${sub.baseURL}${path}`)
          // the document itself is served (SSR works without the asset prefix)
          expect(response.status()).toBe(200)
          await settle(p, tracker, signature(rec), { hydrate: false })
          const rep = assetReport(rec, stackOriginsOf(sub))
          results[path] = {
            violations: violations(rep).length,
            bad: rep.bad.length,
          }
          // the verdict that is empty in c1 fails: CSS and JS answer 404 under the unrouted /_next/static/
          expect(violations(rep).length, path).toBeGreaterThan(0)
          expect(rep.bad.length, path).toBeGreaterThan(0)
          expect(
            rep.bad.every(
              (a) =>
                a.status === 404 &&
                ['css', 'js'].includes(a.kind) &&
                new URL(a.url).pathname.startsWith('/_next/static/')
            ),
            `${path}: ${JSON.stringify(rep.bad.map((a) => a.url))}`
          ).toBe(true)
          expect(rep.bad.some((a) => a.kind === 'css')).toBe(true)
          expect(rep.bad.some((a) => a.kind === 'js')).toBe(true)
          // the same 404s are what the guard of every other test counts (guard.mjs badResponses)
          expect(log.badResponses.length).toBeGreaterThan(0)
          // the symptom of R-082: unstyled and without JS, so the page never hydrates
          expect(
            await p.evaluate(
              () => performance.getEntriesByName('Next.js-hydration').length
            )
          ).toBe(0)
          expect(
            await p.evaluate(
              () =>
                getComputedStyle(document.querySelector('header#header'))
                  .position
            )
          ).toBe('static')
          await p.close()
        }
        test.info().annotations.push({
          type: 'negative-control',
          description: JSON.stringify(results),
        })
      } finally {
        await ctx.close()
        await cleanupSsr()
      }
    } finally {
      await down(id)
    }
  })
})

test.describe('T-721 c2 detector self-check', () => {
  // what the census must see that the guard (resource types image, stylesheet, script, font) cannot, and what
  // it must not call an asset; synthetic records, no stack traffic
  test('T-721 c2 @P0 the census counts a sprite 404, a router CSS/JS fetch 404, an [object Object] image and a stack asset outside the prefix', () => {
    const origin = 'http://stack.test'
    const origins = new Set([origin])
    const mk = (path, status, resourceType) => ({
      url: `${origin}${path}`,
      status,
      resourceType,
      kind: kindOf(`${origin}${path}`, resourceType),
    })
    const census = (responses, failed = []) =>
      assetReport(
        { responses: responses.filter((r) => r.kind), failed },
        origins
      )

    // clean: a 200 and a 304 under the prefix, a result thumbnail, and non-assets (a data route 404, a document)
    const clean = census([
      mk('/static/search/_next/static/css/a.css', 200, 'stylesheet'),
      mk('/static/search/_next/static/chunks/b.js', 304, 'script'),
      mk('/static/search/icons.svg', 200, 'other'),
      mk('/image/1/large', 200, 'image'),
      mk('/search/_next/data/id/works/1.json', 404, 'fetch'),
      mk('/works/1001/', 200, 'document'),
    ])
    expect(violations(clean)).toEqual([])
    expect(clean.byKind).toEqual({ css: 1, js: 1, icon: 1, image: 1 })
    expect(clean.thumbnails.length).toBe(1)

    const bad = (responses, failed) => violations(census(responses, failed))
    // the sprite has resource type `other`: invisible to the guard, counted here
    expect(
      bad([mk('/static/search/icons.svg', 404, 'other')]).join()
    ).toContain('404 icon')
    // the route loader fetches page CSS/JS with `fetch`
    expect(
      bad([mk('/static/search/_next/static/css/p.css', 404, 'fetch')]).join()
    ).toContain('404 css')
    expect(
      bad([mk('/static/search/_next/static/chunks/p.js', 500, 'fetch')]).join()
    ).toContain('500 js')
    // R-007: `src="[object Object]"` is requested relative to the page
    expect(
      bad([mk('/works/%5Bobject%20Object%5D', 404, 'image')]).join()
    ).toContain('404 image')
    // R-021/R-082: 200 but outside the asset prefix is a violation too
    expect(
      bad([mk('/_next/static/chunks/c.js', 200, 'script')]).join()
    ).toContain('outside /static/search/')
    // a stack asset that failed at the network level; a third party the guard aborted is not counted
    expect(
      bad(
        [],
        [
          {
            url: `${origin}/static/search/x.css`,
            kind: 'css',
            error: 'net::ERR_FAILED',
          },
        ]
      ).length
    ).toBe(1)
    expect(
      bad(
        [],
        [{ url: 'https://cdn.example.org/x.js', kind: 'js', error: 'blocked' }]
      )
    ).toEqual([])
  })

  test('T-721 c2 @P0 the SSR HTML scan finds link, script, image, srcset and use references of the stack only', () => {
    const origin = 'http://stack.test'
    const html = `<html><head>
      <link rel="icon" href="https://core.ac.uk/favicon/favicon-64px.png"/>
      <link rel="preload" href="/static/search/_next/static/css/a.css" as="style"/>
      <link rel="stylesheet" href="/static/search/_next/static/css/a.css" data-n-g=""/>
      <link rel="preload" href="/static/search/_next/static/chunks/m.js" as="script"/>
      <link rel="canonical" href="/works/1/"/>
      <script src="/static/search/_next/static/chunks/m.js" defer=""></script>
      <script id="__NEXT_DATA__" type="application/json">{}</script>
      </head><body>
      <img src="/static/search/static/images/oai.svg" srcset="/static/search/a.png 1x, /static/search/b.png 2x"/>
      <svg><use href="/static/search/icons.svg#download"></use></svg>
      <a href="/works/2/">a work</a>
      <img src="[object Object]"/>
      </body></html>`
    const urls = htmlAssetUrls(html, `${origin}/works/1/`, new Set([origin]))
    expect(urls.map((u) => u.replace(origin, ''))).toEqual([
      '/static/search/_next/static/chunks/m.js',
      '/static/search/_next/static/css/a.css',
      '/static/search/a.png',
      '/static/search/b.png',
      '/static/search/icons.svg',
      '/static/search/static/images/oai.svg',
      // R-007: the relative `src="[object Object]"` resolves against the page URL
      '/works/1/[object%20Object]',
    ])
  })
})
