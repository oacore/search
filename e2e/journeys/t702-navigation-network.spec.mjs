// T-702 (41 H, R-002, R-028, R-029, R-055, R-068): navigation network log. The browser column of the 41 §2.2
// per-action contract, the navigation type of every step (one document, client navigations on
// /search/_next/data/), the history log and the window events, and every other §2.2 action row, each from a
// hard load. Explicit assertions pin the §2.2 counts and the quirks (Q-011, Q-019, Q-055, Q-092); the full
// normalised per-action logs are record-mode outputs next to this spec (provisional at 2.3, B0 from 2.5).
// Fixtures: scenarios search-climate, search-csv, works-1001, outputs-2001/2004, provider-86, logos,
// e19-client-nav, e10-report, e16-claim-form, req-P0-09 (test/fixtures/requests/P0-09.json).
import crypto from 'node:crypto'
import { test, expect } from '../lib/P0-09/fixtures.mjs'
import { historyLog } from '../fixtures/guard.mjs'
import {
  netLog,
  normalise,
  count,
  isE2,
  isNextData,
  isDocument,
  stableJson,
} from '../lib/P0-09/netlog.mjs'
import {
  trackPage,
  watchRouter,
  settle,
  NAV_TIMEOUT,
} from '../lib/P0-09/settle.mjs'
import {
  runSearchJourney,
  openSearch,
  URLS,
} from '../lib/P0-09/search-journey.mjs'

const E2_BASE =
  '{"aggregations":["fieldsOfStudy","yearPublished","documentType","authors","language","publisher"],"q":"climate"}'
const E2_FACET =
  '{"aggregations":["fieldsOfStudy","yearPublished","documentType","authors","language","publisher"],"q":"climate AND documentType:\\"thesis\\""}'
const E2_REFINED =
  '{"aggregations":["fieldsOfStudy","yearPublished","documentType","authors","language","publisher"],"q":"climate change"}'
const API = 'https://api.core.ac.uk'

const buildIdOf = (page) => page.evaluate(() => window.__NEXT_DATA__.buildId)
const ctx = async (page, p2Env) => ({
  baseURL: p2Env.baseURL,
  buildId: await buildIdOf(page),
})
const apiOnly = (list) => list.filter((e) => e.kind === 'api')
// documents, _next/data and API requests (third-party hosts are only counted)
const appOnly = (list) => list.filter((e) => e.kind !== 'third-party')
const e2Bodies = (list) => list.filter(isE2).map((e) => e.bodyText)

// a hard load followed by a settle; returns the log and helpers for one c9 action
async function hardLoad(page, p2Env, path) {
  const log = netLog(page, p2Env)
  const tracker = trackPage(page)
  const res = await page.goto(path)
  await settle(page, tracker)
  await watchRouter(page)
  return { log, tracker, status: res.status() }
}

test.describe('T-702 @P0 navigation network log', () => {
  // several page loads or ~70 sequential requests per test; the machine runs other stacks in parallel
  test.describe.configure({ timeout: 300000 })

  test('T-702 c1 @P0 from /search/?q=climate: page, sort, toggle, Clear all, Back, Forward', async ({
    page,
    p2Env,
  }) => {
    const { actions } = await runSearchJourney(page, p2Env)
    expect(
      actions.map((a) => [a.name, a.url.slice(p2Env.baseURL.length)])
    ).toEqual(
      ['load', 'page', 'sort', 'toggle', 'clear', 'back', 'forward'].map(
        (n) => [n, URLS[n]]
      )
    )
  })

  for (const cookieState of ['absent', 'essential', 'essential+analytics'])
    test.describe(`cookies ${cookieState}`, () => {
      test.use({ cookieState })
      test(`T-702 c2 @P0 log = §2.2 (cookie state ${cookieState})`, async ({
        page,
        p2Env,
      }) => {
        const { actions } = await runSearchJourney(page, p2Env)
        const by = Object.fromEntries(actions.map((a) => [a.name, a.entries]))
        // 41 §2.2 browser column: load E2 x1; page or sort E2 x0; filter E2 x1; Clear all E2 x2 identical
        // (Q-092); Back and Forward change q, so the filters fetch once more each
        expect(
          Object.fromEntries(
            actions.map((a) => [
              a.name,
              {
                documents: count(a.entries, isDocument),
                nextData: count(a.entries, isNextData),
                e2: e2Bodies(a.entries),
              },
            ])
          )
        ).toEqual({
          load: { documents: 1, nextData: 0, e2: [E2_BASE] },
          page: { documents: 0, nextData: 1, e2: [] },
          sort: { documents: 0, nextData: 1, e2: [] },
          toggle: { documents: 0, nextData: 1, e2: [E2_FACET] },
          clear: { documents: 0, nextData: 1, e2: [E2_BASE, E2_BASE] },
          back: { documents: 0, nextData: 1, e2: [E2_FACET] },
          forward: { documents: 0, nextData: 1, e2: [E2_BASE] },
        })
        // E2 carries the app headers of api/index.js (JSON body, bearer key placeholder)
        for (const e of by.load.filter(isE2))
          expect(e.headers).toEqual({
            'accept': 'application/json',
            'authorization': 'Bearer test-key',
            'content-type': 'application/json',
          })
        const c = await ctx(page, p2Env)
        const snapshot = actions.map((a) => ({
          action: a.name,
          ...normalise(a.entries, c),
        }))
        expect(stableJson(snapshot)).toMatchSnapshot(
          `t702-c2-search-log-${cookieState.replace('+', '-')}.json`
        )
      })
    })

  test('T-702 c3 @P0 1 document', async ({ page, p2Env }) => {
    const { log } = await runSearchJourney(page, p2Env)
    expect(
      log.entries.filter(isDocument).map((e) => [e.method, e.url, e.status])
    ).toEqual([['GET', `${p2Env.baseURL}/search/?q=climate`, 200]])
  })

  test('T-702 c4 @P0 client navs hit /search/_next/data/ 200', async ({
    page,
    p2Env,
  }) => {
    const { actions } = await runSearchJourney(page, p2Env)
    const buildId = await buildIdOf(page)
    const prefix = `${p2Env.baseURL}/search/_next/data/${buildId}/search.json?`
    const navs = actions
      .slice(1)
      .map((a) => [
        a.name,
        a.entries
          .filter(isNextData)
          .map((e) => [e.method, e.url.startsWith(prefix), e.status]),
      ])
    expect(navs).toEqual(
      ['page', 'sort', 'toggle', 'clear', 'back', 'forward'].map((n) => [
        n,
        [['GET', true, 200]],
      ])
    )
    // the query of each data request is the query of the page it loads
    expect(
      actions
        .slice(1)
        .map((a) =>
          new URL(a.entries.filter(isNextData)[0].url).searchParams.toString()
        )
    ).toEqual(
      actions.slice(1).map((a) => new URL(a.url).searchParams.toString())
    )
    // never the unprefixed /_next/data (R-002, R-068)
    expect(
      actions
        .flatMap((a) => a.entries)
        .filter((e) => e.url.startsWith(`${p2Env.baseURL}/_next/data/`))
    ).toEqual([])
  })

  test('T-702 c5 @P0 window.__marker survives', async ({ page, p2Env }) => {
    await runSearchJourney(page, p2Env, {
      onLoaded: () =>
        page.evaluate(() => {
          window.__marker = 'T-702'
        }),
    })
    expect(await page.evaluate(() => window.__marker)).toBe('T-702')
  })

  test('T-702 c6 @P0 result click = full nav', async ({ page, p2Env }) => {
    const { log } = await openSearch(page, p2Env)
    await page.evaluate(() => {
      window.__marker = 'T-702'
    })
    const m = log.mark()
    const target = `${p2Env.baseURL}/works/19211324/?t=fafad9968b7cd268c5fd64342bf88a26-19211324&search=q=climate`
    const link = page.locator('#__next a[href*="/works/19211324/"]').first()
    await expect(link).toHaveAttribute('href', target)
    const [res] = await Promise.all([
      page.waitForResponse((r) => r.url() === target),
      link.click(),
    ])
    await expect(page).toHaveURL(target, { timeout: NAV_TIMEOUT })
    const tracker = trackPage(page)
    await settle(page, tracker)
    expect(res.request().isNavigationRequest()).toBe(true)
    expect(
      appOnly(log.since(m)).map((e) => [e.kind, e.method, e.url, e.status])
    ).toEqual([['document', 'GET', target, 200]])
    expect(await page.evaluate(() => window.__marker)).toBeUndefined()
    // the target answers the recorded live 404 (req-P0-09): the soft 404 page (Q-001)
    await expect(
      page.getByText('The page you were looking for could not be found')
    ).toBeVisible()
  })

  test('T-702 c7 @P0 0 pageerrors; history log and scroll after Back and Forward', async ({
    page,
    p2Env,
    guardLog,
  }) => {
    const { actions } = await runSearchJourney(page, p2Env)
    expect(guardLog.pageErrors).toEqual([])
    const origin = p2Env.baseURL
    const hist = (await historyLog(page)).map((h) => ({
      ...h,
      url: h.url && h.url.split(origin).join('<origin>'),
    }))
    // Next 10: replaceState on load and after each popstate, pushState per client navigation; state keys
    // __N, as, idx, options, url; scroll restoration left to the browser ('auto')
    expect(hist.map((h) => [h.method, h.url])).toEqual([
      ['replaceState', `<origin>${URLS.load}`],
      ['pushState', `<origin>${URLS.page}`],
      ['pushState', `<origin>${URLS.sort}`],
      ['pushState', `<origin>${URLS.toggle}`],
      ['pushState', `<origin>${URLS.clear}`],
      ['popstate', `<origin>${URLS.back}`],
      ['replaceState', `<origin>${URLS.back}`],
      ['popstate', `<origin>${URLS.forward}`],
      ['replaceState', `<origin>${URLS.forward}`],
    ])
    for (const h of hist.filter((x) => x.method !== 'popstate'))
      expect(h.stateKeys).toEqual(['__N', 'as', 'idx', 'options', 'url'])
    const backForward = actions
      .filter((a) => a.name === 'back' || a.name === 'forward')
      .map((a) => ({
        action: a.name,
        scrollY: a.scrollY,
        scrollRestoration: a.scrollRestoration,
      }))
    // the snapshot keeps each entry's state keys as one comma-joined string (a JSON file without arrays of
    // primitives is already in the layout `npm run lint:json` checks)
    const histView = hist.map((h) => ({
      ...h,
      ...(Array.isArray(h.stateKeys)
        ? { stateKeys: h.stateKeys.join(',') }
        : {}),
    }))
    expect(stableJson({ history: histView, backForward })).toMatchSnapshot(
      't702-c7-history.json'
    )
  })

  test('T-702 c8 @P0 window events after settle: request log, DOM and URL', async ({
    page,
    p2Env,
    context,
  }) => {
    const { log, tracker } = await openSearch(page, p2Env)
    const dom = () =>
      page.evaluate(() => document.getElementById('__next').innerHTML)
    const before = { dom: await dom(), url: page.url() }
    const m = log.mark()
    const steps = []
    const record = async (name) => {
      await settle(page, tracker)
      steps.push({
        event: name,
        url: page.url().split(p2Env.baseURL).join('<origin>'),
        domUnchanged: (await dom()) === before.dom,
      })
    }
    // visibilitychange hidden -> visible (SWR revalidates on focus/visibility, 70 §3.4)
    for (const state of ['hidden', 'visible']) {
      await page.evaluate((s) => {
        Object.defineProperty(document, 'visibilityState', {
          configurable: true,
          get: () => s,
        })
        Object.defineProperty(document, 'hidden', {
          configurable: true,
          get: () => s === 'hidden',
        })
        document.dispatchEvent(new Event('visibilitychange'))
      }, state)
      await record(`visibilitychange ${state}`)
    }
    for (const name of ['blur', 'focus']) {
      await page.evaluate((n) => window.dispatchEvent(new Event(n)), name)
      await record(`window ${name}`)
    }
    for (const offline of [true, false]) {
      await context.setOffline(offline)
      await record(offline ? 'offline' : 'online')
    }
    const after = log.since(m)
    // today nothing revalidates: no request, the DOM and the URL stay
    expect(after.map((e) => [e.method, e.url])).toEqual([])
    expect(page.url()).toBe(before.url)
    expect(steps.every((s) => s.domUnchanged)).toBe(true)
    expect(
      stableJson({ steps, requests: normalise(after, await ctx(page, p2Env)) })
    ).toMatchSnapshot('t702-c8-window-events.json')
  })

  test.describe('c9 other §2.2 action rows, each from a hard load', () => {
    test('T-702 c9 @P0 load /works/1001/: E8 x1 (resultType work), logos', async ({
      page,
      p2Env,
    }) => {
      const { log } = await hardLoad(page, p2Env, '/works/1001/')
      const api = apiOnly(log.entries)
      expect(
        api
          .filter((e) => e.url === `${API}/v3/recommend`)
          .map((e) => [e.method, e.bodyText, e.headers['content-type']])
      ).toEqual([
        [
          'POST',
          '{"identifier":"core:1001","limit":5,"resultType":"work"}',
          'application/json',
        ],
      ])
      expect(count(log.entries, isDocument)).toBe(1)
      expect(
        stableJson(normalise(log.entries, await ctx(page, p2Env)))
      ).toMatchSnapshot('t702-c9-works-load.json')
    })

    test('T-702 c9 @P0 load /outputs/2001/: E8 x1, logos', async ({
      page,
      p2Env,
    }) => {
      const { log } = await hardLoad(page, p2Env, '/outputs/2001/')
      expect(
        apiOnly(log.entries)
          .filter((e) => e.url === `${API}/v3/recommend`)
          .map((e) => [e.method, e.bodyText])
      ).toEqual([['POST', '{"identifier":"core:2001","limit":5}']])
      expect(
        stableJson(normalise(log.entries, await ctx(page, p2Env)))
      ).toMatchSnapshot('t702-c9-outputs-load.json')
    })

    test('T-702 c9 @P0 client nav output A -> B: _next/data x1, E8 x0 (Q-055)', async ({
      page,
      p2Env,
    }) => {
      const { log, tracker } = await hardLoad(page, p2Env, '/outputs/2001/')
      const m = log.mark()
      await page.evaluate(() => window.next.router.push('/outputs/2004/'))
      await expect(page).toHaveURL(`${p2Env.baseURL}/outputs/2004/`, {
        timeout: NAV_TIMEOUT,
      })
      await settle(page, tracker)
      const nav = log.since(m)
      const buildId = await buildIdOf(page)
      expect(
        appOnly(nav).map((e) => [e.kind, e.method, e.url, e.status])
      ).toEqual([
        [
          'next-data',
          'GET',
          `${p2Env.baseURL}/search/_next/data/${buildId}/outputs/2004.json?id=2004`,
          200,
        ],
      ])
      expect(count(nav, (e) => e.url === `${API}/v3/recommend`)).toBe(0)
      expect(
        stableJson(normalise(nav, await ctx(page, p2Env)))
      ).toMatchSnapshot('t702-c9-output-a-to-b.json')
    })

    test('T-702 c9 @P0 load /data-providers/86/: E18 x2 with accounts', async ({
      page,
      p2Env,
    }) => {
      const { log } = await hardLoad(page, p2Env, '/data-providers/86/')
      expect(
        apiOnly(log.entries)
          .filter((e) => e.url.endsWith('/account'))
          .map((e) => [e.method, e.url, e.status])
      ).toEqual([
        ['GET', `${API}/internal/data-providers/86/account`, 200],
        ['GET', `${API}/internal/data-providers/86/account`, 200],
      ])
      expect(
        stableJson(normalise(log.entries, await ctx(page, p2Env)))
      ).toMatchSnapshot('t702-c9-provider-load.json')
    })

    test('T-702 c9 @P0 type a URL on /data-providers/: E16 per settled value, string body text/plain (Q-019)', async ({
      page,
      p2Env,
    }) => {
      const { log, tracker } = await hardLoad(
        page,
        p2Env,
        '/data-providers/?action=ADD'
      )
      const m = log.mark()
      const field = page.getByLabel('Data provider URL')
      // two settled values, each typed key by key (one change per character, 500 ms debounce): the created
      // provider of the e16-claim-form fixtures, typed again after clearing the field. A 409 answer is not
      // used here: Chromium logs every 4xx resource as console.error, which the journey guard rejects.
      const value = 'https://created.example.org/'
      const settledValues = [value, value]
      for (const v of settledValues) {
        await field.fill('')
        const posted = page.waitForResponse(
          (r) =>
            r.url() === `${API}/internal/data-providers` &&
            r.request().method() === 'POST'
        )
        await field.pressSequentially(v)
        await posted
        await settle(page, tracker)
        await expect(
          page.getByText(
            'We found Example Repository under the entered address'
          )
        ).toBeVisible()
      }
      const e16 = log
        .since(m)
        .filter((e) => e.url === `${API}/internal/data-providers`)
      // one E16 per settled value (not per keystroke); the body is the JSON text of the value, sent as a
      // string, so fetch labels it text/plain (Q-019)
      expect(
        e16.map((e) => [
          e.method,
          e.bodyText,
          e.bodySha256,
          e.headers['content-type'],
          e.status,
        ])
      ).toEqual(
        settledValues.map((v) => [
          'POST',
          `{"uri":"${v}"}`,
          crypto.createHash('sha256').update(`{"uri":"${v}"}`).digest('hex'),
          'text/plain;charset=UTF-8',
          201,
        ])
      )
      // a string body never gets the JSON Content-Type of api/index.js (R-028)
      expect(
        e16.every(
          (e) =>
            !('content-type' in e.headers) ||
            e.headers['content-type'] === 'text/plain;charset=UTF-8'
        )
      ).toBe(true)
      expect(
        stableJson(normalise(log.since(m), await ctx(page, p2Env)))
      ).toMatchSnapshot('t702-c9-type-url.json')
    })

    test('T-702 c9 @P0 report URL and submit on /outputs/update/: E6 x1 then E10 x1', async ({
      page,
      p2Env,
    }) => {
      const { log, tracker } = await hardLoad(page, p2Env, '/outputs/update/')
      expect(apiOnly(log.entries)).toEqual([])
      const m1 = log.mark()
      await page
        .getByRole('textbox')
        .last()
        .fill('https://core.ac.uk/outputs/2001')
      await page.getByRole('button', { name: 'SUBMIT', exact: true }).click()
      const typeModal = page.getByRole('dialog', { name: 'Problem-type-modal' })
      await expect(typeModal).toBeVisible({ timeout: NAV_TIMEOUT })
      await settle(page, tracker)
      const reportUrl = log.since(m1)
      await typeModal.getByText('The document should not be published').click()
      await typeModal.getByRole('button', { name: 'Continue' }).click()
      const form = page.getByRole('dialog', { name: 'Problem-form-modal' })
      await form.getByText('Author', { exact: true }).click()
      await form.getByLabel('Name').fill('Test Reporter')
      await form.getByLabel('Email').fill('reporter@localhost')
      await form.getByLabel('Comment').fill('report-ok')
      const m2 = log.mark()
      await form.getByRole('button', { name: 'Submit' }).click()
      await expect(
        page.getByRole('dialog', { name: 'Success-type-modal' })
      ).toBeVisible({ timeout: NAV_TIMEOUT })
      await settle(page, tracker)
      const submit = log.since(m2)
      expect(
        apiOnly(reportUrl).map((e) => [e.method, e.url, e.status])
      ).toEqual([['GET', `${API}/v3/outputs/2001`, 200]])
      expect(
        apiOnly(submit).map((e) => [
          e.method,
          e.url,
          e.bodyText,
          e.headers['content-type'],
          e.status,
        ])
      ).toEqual([
        [
          'POST',
          `${API}/internal/outputs/update`,
          '{"outputId":2001,"name":"Test Reporter","email":"reporter@localhost","message":"report-ok","updateOption":"takeDownFullText","role":"author"}',
          'application/json',
          201,
        ],
      ])
      const c = await ctx(page, p2Env)
      expect(
        stableJson({
          reportUrl: normalise(reportUrl, c),
          submit: normalise(submit, c),
        })
      ).toMatchSnapshot('t702-c9-report.json')
    })

    test('T-702 c9 @P0 client nav to /outputs/update/ by window.next.router.push: E19 x3 from the browser (Q-011)', async ({
      page,
      p2Env,
    }) => {
      const { log, tracker } = await hardLoad(page, p2Env, '/search/?q=climate')
      const m = log.mark()
      await page.evaluate(() => window.next.router.push('/outputs/update/'))
      await expect(page).toHaveURL(`${p2Env.baseURL}/outputs/update/`, {
        timeout: NAV_TIMEOUT,
      })
      await expect(page.getByText('Article Takedown Request')).toBeVisible({
        timeout: NAV_TIMEOUT,
      })
      await settle(page, tracker)
      const nav = log.since(m)
      expect(
        appOnly(nav).map((e) => [
          e.kind,
          e.method,
          e.url,
          e.headers.authorization || null,
          e.status,
        ])
      ).toEqual([
        ['api', 'GET', `${API}/internal/statistics`, null, 200],
        ['api', 'GET', `${API}/internal/repositories/formap`, null, 200],
        ['api', 'GET', `${API}/internal/members`, null, 200],
      ])
      expect(
        stableJson(normalise(nav, await ctx(page, p2Env)))
      ).toMatchSnapshot('t702-c9-push-outputs-update.json')
    })

    test('T-702 c9 @P0 new q from the header search: _next/data x1, E2 x1 (Q-092)', async ({
      page,
      p2Env,
    }) => {
      const { log, tracker } = await hardLoad(page, p2Env, '/search/?q=climate')
      const m = log.mark()
      const box = page.getByRole('combobox', {
        name: /from papers around the world/,
      })
      await box.fill('climate change')
      await box.press('Enter')
      await expect(page).toHaveURL(
        `${p2Env.baseURL}/search/?q=climate+change&page=1`,
        { timeout: NAV_TIMEOUT }
      )
      await settle(page, tracker)
      const nav = log.since(m)
      expect([count(nav, isNextData), e2Bodies(nav)]).toEqual([1, [E2_REFINED]])
      expect(
        stableJson(normalise(nav, await ctx(page, p2Env)))
      ).toMatchSnapshot('t702-c9-new-q.json')
    })

    test('T-702 c9 @P0 CSV download: E3 x1', async ({ page, p2Env }) => {
      const { log, tracker } = await hardLoad(page, p2Env, '/search/?q=climate')
      await page.locator('button:has(use[href$="#download"])').first().click()
      const modal = page.getByRole('dialog', {
        name: 'Download results in cvs modal',
      })
      await expect(modal).toBeVisible({ timeout: NAV_TIMEOUT })
      const m = log.mark()
      const [download] = await Promise.all([
        page.waitForEvent('download'),
        modal.getByRole('button', { name: /^download$/i }).click(),
      ])
      await settle(page, tracker)
      expect(download.suggestedFilename()).toBe('results.csv')
      const e3 = apiOnly(log.since(m))
      expect(
        e3.map((e) => [
          e.method,
          e.url,
          e.bodyText,
          e.headers['content-type'],
          e.status,
        ])
      ).toEqual([
        [
          'POST',
          `${API}/v3/search/works`,
          '{"q":"climate","accept":"text/csv","limit":10}',
          'application/json',
          200,
        ],
      ])
      expect(
        stableJson(normalise(log.since(m), await ctx(page, p2Env)))
      ).toMatchSnapshot('t702-c9-csv.json')
    })

    test('T-702 c9 @P0 load /data-providers/: no API request', async ({
      page,
      p2Env,
    }) => {
      const { log, status } = await hardLoad(page, p2Env, '/data-providers/')
      expect(status).toBe(200)
      expect(apiOnly(log.entries)).toEqual([])
      expect(
        stableJson(normalise(log.entries, await ctx(page, p2Env)))
      ).toMatchSnapshot('t702-c9-data-providers-load.json')
    })

    test('T-702 c9 @P0 load /error-card/ (allow-all proxy): no API request', async ({
      page,
      p2Env,
    }) => {
      // the gateway does not route /error-card/ (Q-005), so the page is loaded through the allow-all proxy;
      // that proxy forwards /static/search/** raw (the app answers 404 there), so the page's asset requests
      // take the gateway's /static/search route, as they would on any host that serves the page
      const allow = new URL(p2Env.allowURL).origin
      const gateway = new URL(p2Env.baseURL).origin
      await page.route(
        (u) => u.origin === allow && u.pathname.startsWith('/static/search/'),
        (route) =>
          route.continue({ url: route.request().url().replace(allow, gateway) })
      )
      const { log, status } = await hardLoad(
        page,
        p2Env,
        `${p2Env.allowURL}/error-card/`
      )
      expect(status).toBe(200)
      await expect(
        page.getByText('This page is not available now')
      ).toBeVisible()
      expect(apiOnly(log.entries)).toEqual([])
      expect(
        appOnly(log.entries).map((e) => [e.kind, e.method, e.url, e.status])
      ).toEqual([['document', 'GET', `${p2Env.allowURL}/error-card/`, 200]])
      expect(
        stableJson(
          normalise(log.entries, {
            baseURL: p2Env.allowURL,
            buildId: await buildIdOf(page),
          })
        )
      ).toMatchSnapshot('t702-c9-error-card-load.json')
    })
  })
})
