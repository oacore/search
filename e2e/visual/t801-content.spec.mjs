// T-801 c1 (41 I) for the content states: V8 works, V9 outputs / display / OAI box, V10 output variants, V11
// modals, V12 similar works loading and error, V13 /outputs/update/, V14 /data-providers/, V15 a provider page,
// V16 404 / error-card / Uh-oh, V18 cookie popup, V36 claim rows 1-5 SSR vs final; the dark subset of V8, V14,
// V16 (equal to the light baseline, V20). Pixel-exact against this machine's host baseline (owner notes §1),
// no masks, fixed clock, cookie state `essential` unless the state is the cookie popup. Titles tagged @engines
// are the WebKit/Firefox subset (41 §2.5), which only the runner container executes.
// V28 (JS off) is in t801-js-off.spec.mjs.
import fs from 'node:fs'
import { test, expect } from '../lib/P0-18/harness-gaps.mjs'
import {
  M,
  TWO,
  engines,
  visit,
  visitStatic,
  prepare,
  prepareStatic,
  afterAction,
  shots,
  expectLightBaseline,
  expectGuard,
  consoleTexts,
  TEST_TIMEOUT,
} from '../lib/P0-18/capture.mjs'

test.use({ cookieState: 'essential' })
test.setTimeout(TEST_TIMEOUT)

const API = 'https://api.core.ac.uk'
// the picks of the fixtures package (test/fixtures/scenarios.json): the /data-providers/?q= term whose results
// include a TR provider (R-031) and the providers of the claim rows (41 §2.6)
const PICKS = JSON.parse(
  fs.readFileSync(
    new URL('../../test/fixtures/scenarios.json', import.meta.url),
    'utf8'
  )
).picks
const NOT_FOUND_LOG =
  'Failed to load resource: the server responded with a status of 404 (Not Found)'
// the modals of the report chain (the design Modal renders its aria-label on two nested elements)
const modalOf = (page, label) => page.locator(`[aria-label="${label}"]`).first()

// ---------- V8: /works/<id>/ ----------

test.describe('V8 works', () => {
  const viewOnButton = (page) =>
    page.locator('a:not([href])', { hasText: /^\s*View\s+on\s*$/ })

  for (const w of M)
    test(`T-801 c1 @P0${engines(w)} V8 works 1001 full ${w}`, async ({
      page,
    }) => {
      const t = await visit(page, '/works/1001/', w)
      await prepare(page, t)
      // the recorded work holds arxivId and pubmedId as null: no "View on" button (Q-081 needs absent keys)
      await expect(viewOnButton(page)).toHaveCount(0)
      const s = shots(page)
      await s.take(`V8-works-1001-${w}`)
      s.done()
    })

  // Q-081: a work whose arxivId and pubmedId keys are absent renders the empty "View on" button
  for (const w of M)
    test(`T-801 c1 @P0 V8 works 1801 empty View on ${w}`, async ({ page }) => {
      const t = await visit(page, '/works/1801/', w)
      await prepare(page, t)
      await expect(viewOnButton(page)).toHaveCount(1)
      const s = shots(page)
      await s.take(`V8-works-1801-${w}`)
      s.done()
    })

  // the many-authors variant: work 1003 (30 authors)
  for (const w of TWO)
    test(`T-801 c1 @P0 V8 works 1003 many authors ${w}`, async ({ page }) => {
      const t = await visit(page, '/works/1003/', w)
      await prepare(page, t)
      const s = shots(page)
      await s.take(`V8-works-1003-${w}`)
      s.done()
    })
})

// ---------- V9: /outputs/<id>/, /display/<id>/, ?source=oai ----------

test.describe('V9 outputs', () => {
  // the OAI box is the one OAI landing-page modal of the app (V11 lists it too): captured here
  const states = [
    ['outputs', '/outputs/2001/', ''],
    ['display', '/display/2001/', ''],
    ['oai', '/outputs/2001/?source=oai', ' (the V11 OAI modal)'],
  ]
  for (const [id, url, note] of states)
    for (const w of M)
      test(`T-801 c1 @P0${engines(w)} V9 ${id}${note} 2001 ${w}`, async ({
        page,
      }) => {
        const t = await visit(page, url, w)
        await prepare(page, t)
        if (id === 'oai')
          await expect(
            page.getByRole('heading', { name: 'Repository landing page' })
          ).toBeVisible()
        const s = shots(page)
        await s.take(`V9-${id}-2001-${w}`)
        s.done()
      })
})

// ---------- V10: output variants ----------

test.describe('V10 output variants', () => {
  const variants = [
    {
      id: 'disabled',
      url: '/outputs/2003/',
      note: 'fulltextStatus "disabled"',
    },
    { id: 'noreader', url: '/outputs/2004/', note: 'no reader link' },
    {
      id: 'noabstract',
      url: '/outputs/2201/',
      note: 'no abstract',
      check: async (page) =>
        expect(page.getByText('Abstract is not available.')).toBeVisible(),
    },
    {
      id: 'nodoi',
      url: '/outputs/2202/',
      note: 'no DOI, so no Cite button',
      check: async (page) =>
        expect(page.getByRole('button', { name: 'Cite' })).toHaveCount(0),
    },
    {
      id: 'mathlong',
      url: '/outputs/2203/',
      note: 'math and a literal ** in a 300-character title (Q-097)',
      check: async (page) => {
        const h1 = page.locator('h1').filter({ hasText: 'Long title with' })
        await expect(h1.locator('.katex').first()).toBeVisible()
        await expect(h1).toContainText('a literal **x**')
      },
    },
  ]
  for (const v of variants)
    for (const w of M)
      test(`T-801 c1 @P0 V10 output ${v.id} (${v.note}) ${w}`, async ({
        page,
      }) => {
        const t = await visit(page, v.url, w)
        await prepare(page, t)
        if (v.check) await v.check(page)
        const s = shots(page)
        await s.take(`V10-${v.id}-${w}`)
        s.done()
      })
})

// ---------- V11: Cite and Report modals (the OAI box is V9 `oai`) ----------

test.describe('V11 modals', () => {
  const reportButton = (page) =>
    page.getByRole('button', { name: 'Report', exact: true })

  for (const w of M) {
    test(`T-801 c1 @P0${engines(w)} V11 Cite modal ${w}`, async ({ page }) => {
      const t = await visit(page, '/outputs/2001/', w)
      await prepare(page, t)
      await page.getByRole('button', { name: 'Cite' }).click()
      await expect(
        page.getByRole('heading', { name: 'Citation' })
      ).toBeVisible()
      await afterAction(page, t)
      const s = shots(page)
      await s.take(`V11-cite-${w}`)
      s.done()
    })

    // the report chain as an author: type, type with an option, form, form with a role, success
    test(`T-801 c1 @P0${engines(w)} V11 Report modals author ${w}`, async ({
      page,
    }) => {
      const t = await visit(page, '/outputs/2001/', w)
      await prepare(page, t)
      const s = shots(page)
      await reportButton(page).click()
      const type = modalOf(page, 'Problem-type-modal')
      await expect(type).toBeVisible()
      await afterAction(page, t)
      await s.take(`V11-report-type-${w}`)
      await type.getByText('The document should not be published').click()
      await afterAction(page, t)
      await s.take(`V11-report-type-selected-${w}`)
      await type.getByRole('button', { name: 'Continue' }).click()
      const form = modalOf(page, 'Problem-form-modal')
      await expect(form).toBeVisible()
      await afterAction(page, t)
      await s.take(`V11-report-form-${w}`)
      await form.getByText('Author', { exact: true }).click()
      await expect(form.locator('textarea')).toBeVisible()
      await afterAction(page, t)
      await s.take(`V11-report-form-author-${w}`)
      await form.getByPlaceholder('e.g. John Doe').fill('Test Reporter')
      await form
        .getByPlaceholder('e.g. john.doe@ac.ck.uk')
        .fill('reporter@localhost')
      await form.locator('textarea').fill('report-ok')
      await form.getByRole('button', { name: 'Submit' }).click()
      const success = modalOf(page, 'Success-type-modal')
      await expect(success.getByText('Thank you!')).toBeVisible()
      await afterAction(page, t)
      await s.take(`V11-report-success-author-${w}`)
      s.done()
    })

    // the success modal of a repository manager (the dashboard sentence)
    test(`T-801 c1 @P0${engines(
      w
    )} V11 Report success repository manager ${w}`, async ({ page }) => {
      const t = await visit(page, '/outputs/2001/', w)
      await prepare(page, t)
      await reportButton(page).click()
      const type = modalOf(page, 'Problem-type-modal')
      await type.getByText('The document should not be published').click()
      await type.getByRole('button', { name: 'Continue' }).click()
      const form = modalOf(page, 'Problem-form-modal')
      await form.getByText('Repository manager', { exact: true }).click()
      await form.getByPlaceholder('e.g. John Doe').fill('Test Reporter')
      await form
        .getByPlaceholder('e.g. john.doe@ac.ck.uk')
        .fill('reporter@localhost')
      await form.locator('textarea').fill('report-ok')
      await form.getByRole('button', { name: 'Submit' }).click()
      const success = modalOf(page, 'Success-type-modal')
      await expect(success.getByText('Thank you!')).toBeVisible()
      await expect(success).toContainText('manages')
      await afterAction(page, t)
      const s = shots(page)
      await s.take(`V11-report-success-manager-${w}`)
      s.done()
    })
  }
})

// ---------- V12: similar works loading and error ----------

test.describe('V12 similar works', () => {
  const isRecommend = (r) => r.url().startsWith(`${API}/v3/recommend`)
  // the browser's E8 answer is held until `release()` (OPTIONS preflights pass)
  const holdRecommend = async (page) => {
    let release
    const gate = new Promise((resolve) => {
      release = resolve
    })
    await page.route(
      (u) => u.href.startsWith(`${API}/v3/recommend`),
      async (route) => {
        if (route.request().method() !== 'POST') return route.fallback()
        await gate
        return route.fallback()
      }
    )
    return release
  }

  const pages = [
    ['works', '/works/1001/', '/works/1007/'],
    ['outputs', '/outputs/2001/', '/outputs/2006/'],
  ]
  for (const [kind, loadingUrl, errorUrl] of pages)
    for (const w of M) {
      test(`T-801 c1 @P0 V12 similar ${kind} loading ${w}`, async ({
        page,
      }) => {
        const release = await holdRecommend(page)
        const t = await visit(page, loadingUrl, w)
        await prepare(page, t, { loaders: false, ignore: isRecommend })
        await expect(
          page.getByText('Loading suggested articles...')
        ).toBeVisible()
        const s = shots(page)
        await s.take(`V12-${kind}-loading-${w}`)
        s.done()
        release()
        await expect(
          page.getByText('Loading suggested articles...')
        ).toHaveCount(0)
      })

      test(`T-801 c1 @P0 V12 similar ${kind} error ${w}`, async ({
        page,
        guardLog,
      }) => {
        // the live recommender answers 404: Chromium logs the failed fetch (one console error)
        expectGuard('console')
        const t = await visit(page, errorUrl, w)
        await prepare(page, t)
        await expect(
          page.getByText(
            'Sorry, we are unable to process this request at the moment'
          )
        ).toBeVisible()
        expect(consoleTexts(guardLog)).toEqual([NOT_FOUND_LOG])
        const s = shots(page)
        await s.take(`V12-${kind}-error-${w}`)
        s.done()
      })
    }
})

// ---------- V13: /outputs/update/ ----------

test.describe('V13 outputs update', () => {
  const urlField = (page) =>
    page.getByPlaceholder('e.g. https://core.ac.uk/display/1')
  for (const w of M) {
    test(`T-801 c1 @P0${engines(w)} V13 update default ${w}`, async ({
      page,
    }) => {
      const t = await visit(page, '/outputs/update/', w)
      await prepare(page, t)
      const s = shots(page)
      await s.take(`V13-update-${w}`)
      s.done()
    })

    // a works link is refused with the error text
    test(`T-801 c1 @P0${engines(w)} V13 update error message ${w}`, async ({
      page,
    }) => {
      const t = await visit(page, '/outputs/update/', w)
      await prepare(page, t)
      await urlField(page).fill('https://core.ac.uk/works/1')
      await page.getByRole('button', { name: 'Submit' }).click()
      await expect(page.getByText('are not accepted')).toBeVisible()
      await afterAction(page, t)
      const s = shots(page)
      await s.take(`V13-update-error-${w}`)
      s.done()
    })

    // an outputs link fetches the output and opens the first modal of the report chain
    test(`T-801 c1 @P0${engines(w)} V13 update modal step 1 ${w}`, async ({
      page,
    }) => {
      const t = await visit(page, '/outputs/update/', w)
      await prepare(page, t)
      await urlField(page).fill('https://core.ac.uk/outputs/2001')
      await page.getByRole('button', { name: 'Submit' }).click()
      await expect(modalOf(page, 'Problem-type-modal')).toBeVisible()
      await afterAction(page, t)
      const s = shots(page)
      await s.take(`V13-update-modal-${w}`)
      s.done()
    })
  }
})

// ---------- V14: /data-providers/ ----------

test.describe('V14 data providers', () => {
  // the term of picks.dataProvidersQueries.withTrProvider: its results show the country name "Turkey" (R-031)
  const TR_TERM = PICKS.dataProvidersQueries.withTrProvider.q
  for (const w of M) {
    test(`T-801 c1 @P0${engines(w)} V14 providers default ${w}`, async ({
      page,
    }) => {
      const t = await visit(page, '/data-providers/', w)
      await prepare(page, t)
      const s = shots(page)
      await s.take(`V14-dps-default-${w}`)
      s.done()
    })

    // no result: the message and the add-provider form
    test(`T-801 c1 @P0${engines(
      w
    )} V14 providers no results and form ${w}`, async ({ page }) => {
      const t = await visit(page, '/data-providers/?q=zzzzqqq', w)
      await prepare(page, t)
      await expect(page.getByText('Is there a mistake?')).toBeVisible()
      await expect(page.getByText('Suggest a new data provider')).toBeVisible()
      const s = shots(page)
      await s.take(`V14-dps-none-${w}`)
      s.done()
    })

    // the suggestions list of the header search (the label overlays the input: Q-083)
    test(`T-801 c1 @P0${engines(w)} V14 providers suggestions ${w}`, async ({
      page,
    }) => {
      const t = await visit(page, '/data-providers/', w)
      await prepare(page, t)
      await page.locator('label[for="select-app-bar-search"]').click()
      await page.keyboard.type('birk')
      await expect(
        page.getByText('Birkbeck Institutional Research Online')
      ).toBeVisible()
      await afterAction(page, t)
      const s = shots(page)
      await s.take(`V14-dps-suggestions-${w}`)
      s.done()
    })

    // R-031: results that show the country name of a TR provider
    test(`T-801 c1 @P0${engines(
      w
    )} V14 providers q with a TR provider ${w}`, async ({ page }) => {
      const t = await visit(page, `/data-providers/?q=${TR_TERM}`, w)
      await prepare(page, t)
      await expect(page.getByText('Turkey').first()).toBeVisible()
      const s = shots(page)
      await s.take(`V14-dps-tr-${w}`)
      s.done()
    })
  }
})

// ---------- V15: /data-providers/<id>/ ----------

test.describe('V15 provider page', () => {
  for (const w of M)
    test(`T-801 c1 @P0 V15 provider 86 ${w}`, async ({ page }) => {
      const t = await visit(page, '/data-providers/86/', w)
      await prepare(page, t)
      const s = shots(page)
      await s.take(`V15-provider-86-${w}`)
      s.done()
    })
})

// ---------- V16: 404, /error-card/, "Uh-oh" with and without a referer ----------

const V16_STATES = [
  { id: '404', url: '/works/', status: 404 },
  { id: 'uhoh-works-4040', url: '/works/4040/', status: 200 },
  {
    id: 'uhoh-works-4040-referer',
    url: '/works/4040/',
    status: 200,
    referer: true,
  },
  { id: 'uhoh-outputs-4100', url: '/outputs/4100/', status: 200 },
  // not routed by the gateway (Q-005): the allow-all listener serves it
  { id: 'error-card', url: '/error-card/', status: 200, allow: true },
]

test.describe('V16 error states', () => {
  for (const st of V16_STATES)
    for (const w of M)
      test(`T-801 c1 @P0 V16 ${st.id} ${w}`, async ({
        page,
        p2Env,
        guardLog,
      }) => {
        // the 404 document itself is a failed resource for Chromium: one console error
        if (st.status === 404) expectGuard('console')
        const target = st.allow ? new URL(st.url, p2Env.allowURL).href : st.url
        const referer = st.referer
          ? `${p2Env.baseURL}/search/?q=climate`
          : undefined
        const t = await visit(page, target, w, { status: st.status, referer })
        await prepare(page, t)
        if (st.id.startsWith('uhoh') || st.id === '404') {
          await expect(
            page.getByRole('heading', { name: 'Uh-oh' })
          ).toBeVisible()
          await expect(page.getByRole('link', { name: 'Go back' })).toHaveCount(
            st.referer ? 1 : 0
          )
        } else
          await expect(
            page.getByText('This page is not available now.')
          ).toBeVisible()
        if (st.status === 404)
          expect(consoleTexts(guardLog)).toEqual([NOT_FOUND_LOG])
        const s = shots(page)
        await s.take(`V16-${st.id}-${w}`)
        s.done()
      })
})

// ---------- V18: the cookie popup (first visit; hidden only by essential_cookies_allowed) ----------

test.describe('V18 cookie popup', () => {
  test.use({ cookieState: 'absent' })
  for (const w of [...M, 950])
    test(`T-801 c1 @P0${engines(w)} V18 cookie popup ${w}`, async ({
      page,
    }) => {
      const t = await visit(page, '/outputs/update/', w)
      await prepare(page, t)
      await expect(
        page.getByText('We use cookies to improve our website.')
      ).toBeVisible()
      const s = shots(page)
      await s.take(`V18-cookie-${w}`)
      s.done()
    })
})

// ---------- V36: claim rows 1-5 of 41 §2.6, server-rendered page against the settled page ----------
// ClaimCard asks the accounts of the provider (E18) from its render; the server never has the answer, so the
// SSR page always says "Not a member yet". Rows 2, 3 and 5 reuse a provider whose recorded answer differs from
// the row: the browser's answer is replaced by a page route (the server's is not read by the page).

const NOT_MEMBER = 'Not a member yet'
const CLAIM = PICKS.claimRows
const ROWS = {
  '1': { id: CLAIM['1'].id, answer: null, final: 'sustaining member' },
  '2': {
    id: CLAIM['2'].id,
    answer: { status: 200, body: '[]' },
    final: NOT_MEMBER,
  },
  '3': {
    id: CLAIM['3'].id,
    answer: { status: 200, body: '[]' },
    final: NOT_MEMBER,
  },
  '4': { id: CLAIM['4'].id, answer: null, final: NOT_MEMBER },
  '5a': {
    id: CLAIM['5'].id,
    answer: { status: 500, body: '{"message":"Internal Server Error"}' },
    final: NOT_MEMBER,
    log: 'Failed to load resource: the server responded with a status of 500 (Internal Server Error)',
  },
  '5b': {
    id: CLAIM['5'].id,
    answer: { status: 401, body: '{"message":"Unauthorized"}' },
    final: NOT_MEMBER,
    log: 'Failed to load resource: the server responded with a status of 401 (Unauthorized)',
  },
}

const badgeOf = (page) =>
  page.evaluate(() => {
    const badge = document.querySelector(
      'h5 a[href="https://core.ac.uk/membership"]'
    )
    return badge && badge.textContent.replace(/\s+/g, ' ').trim()
  })

test.describe('V36 claim rows', () => {
  for (const key of Object.keys(ROWS))
    for (const w of TWO)
      test(`T-801 c1 @P0 V36 claim row ${key} (provider ${ROWS[key].id}) SSR and final ${w}`, async ({
        page,
        guardLog,
        jsOffContext,
      }) => {
        const row = ROWS[key]
        if (row.log) expectGuard('console')
        const s = shots(page)
        // the server-rendered page: JavaScript off, so nothing past the server's HTML
        const ssrPage = await jsOffContext.newPage()
        const ts = await visitStatic(ssrPage, `/data-providers/${row.id}/`, w)
        await prepareStatic(ssrPage, ts)
        expect(await badgeOf(ssrPage)).toBe(NOT_MEMBER)
        const ssr = shots(ssrPage)
        await ssr.take(`V36-ssr-${row.id}-${w}`)
        await ssrPage.close()
        // the settled page: E18 answers as the row says
        if (row.answer) {
          const url = `${API}/internal/data-providers/${row.id}/account`
          await page.route(
            (u) => u.href === url,
            async (route) => {
              const origin = (await route.request().allHeaders()).origin
              await route.fulfill({
                status: row.answer.status,
                contentType: 'application/json',
                headers: {
                  'access-control-allow-origin': origin,
                  'access-control-allow-credentials': 'true',
                },
                body: row.answer.body,
              })
            }
          )
        }
        const t = await visit(page, `/data-providers/${row.id}/`, w)
        await prepare(page, t)
        await expect.poll(() => badgeOf(page)).toBe(row.final)
        await afterAction(page, t)
        await s.take(`V36-row${key}-final-${w}`)
        if (row.log) expect(consoleTexts(guardLog)).toEqual([row.log])
        ssr.done()
        s.done()
      })
})

// ---------- dark (V20): the capture under prefers-color-scheme: dark is the light baseline at 0 px ----------

test.describe('dark', () => {
  test.use({ colorScheme: 'dark' })
  const isDark = (page) =>
    page.evaluate(() => matchMedia('(prefers-color-scheme: dark)').matches)

  for (const w of TWO) {
    test(`T-801 c1 @P0 dark V8 works 1001 ${w}`, async ({ page }) => {
      const t = await visit(page, '/works/1001/', w)
      await prepare(page, t)
      expect(await isDark(page)).toBe(true)
      await expectLightBaseline(page, `V8-works-1001-${w}`)
    })

    test(`T-801 c1 @P0 dark V14 providers default ${w}`, async ({ page }) => {
      const t = await visit(page, '/data-providers/', w)
      await prepare(page, t)
      expect(await isDark(page)).toBe(true)
      await expectLightBaseline(page, `V14-dps-default-${w}`)
    })

    for (const id of ['404', 'uhoh-works-4040'])
      test(`T-801 c1 @P0 dark V16 ${id} ${w}`, async ({ page, guardLog }) => {
        if (id === '404') expectGuard('console')
        const url = id === '404' ? '/works/' : '/works/4040/'
        const t = await visit(page, url, w, {
          status: id === '404' ? 404 : 200,
        })
        await prepare(page, t)
        expect(await isDark(page)).toBe(true)
        if (id === '404')
          expect(consoleTexts(guardLog)).toEqual([NOT_FOUND_LOG])
        await expectLightBaseline(page, `V16-${id}-${w}`)
      })
  }
})
