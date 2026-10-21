// T-605 (41 G; R-001, R-007, R-021, R-079): class census of the T-601 200-routes. c1: per element of the SSR
// DOM (raw HTTP body, inert parse), the settled hydrated DOM and the post-interaction DOM incl. the
// client-only modals and the cookie popup (Q-051): (DOM path, ordered class tokens, and type, form, disabled,
// href, target, rel of every button, a, input, form; image URLs alongside) with the CSS-module hash
// normalised to [name]_[local] (40 §1) = baseline; c2: no attribute value is "[object Object]" (an undefined
// styles.x omits the attribute, an image import object would not). Pages served through the allow-all proxy
// and work 1004 (S-4) are censused in their SSR DOM only (pages.mjs `hydrate: false`).
import { test, expect } from '../fixtures/guard.mjs'
import { ROUTES_200, urlOf, fetchRaw } from '../lib/P0-10/pages.mjs'
import { parsedCensus, liveCensus } from '../lib/P0-10/dom.mjs'
import { censusLines, stackOrigins } from '../lib/P0-10/normalise.mjs'
import { expectBaseline } from '../lib/P0-10/baseline.mjs'
import { trackPage, settle } from '../lib/P0-10/settle.mjs'
import {
  serveDoiFixtures,
  serveBrowserGaps,
} from '../lib/P0-10/harness-gaps.mjs'

const JS_ROUTES = ROUTES_200.filter((r) => r.hydrate !== false)

// client-only states reached by interaction (findings/07 §2.6, §2.8, §2.11, §2.16, §2.2, §2.1); each `act`
// ends on a web-first assertion of the opened state
const INTERACTIONS = [
  {
    id: 'search-climate-download-modal',
    path: '/search/?q=climate',
    act: async (page) => {
      // the icon button has no accessible name (templates/search/index.jsx:84-91): located by its icon
      await page.locator('button:has(use[href$="#download"])').click()
      await expect(
        page.getByRole('dialog', { name: 'Download results in cvs modal' })
      ).toBeVisible()
    },
  },
  {
    id: 'search-climate-facet-field',
    path: '/search/?q=climate',
    act: async (page) => {
      // facet pills are div role=presentation (findings/07 §2.2)
      await page
        .getByRole('presentation')
        .filter({ hasText: /^field$/ })
        .click()
      await expect(page.getByPlaceholder('Search').first()).toBeVisible()
    },
  },
  {
    id: 'search-climate-advanced-search',
    path: '/search/?q=climate',
    act: async (page) => {
      await page.getByText('How to search?').click()
      await expect(
        page.getByText('To refine your searches you can use:')
      ).toBeVisible()
    },
  },
  {
    id: 'works-1001-cite-modal',
    path: '/works/1001/',
    act: async (page) => {
      await page.getByRole('button', { name: 'Cite' }).click()
      await expect(
        page.getByRole('heading', { name: 'Citation' })
      ).toBeVisible()
    },
  },
  {
    id: 'outputs-2001-report-type-modal',
    path: '/outputs/2001/',
    act: async (page) => {
      await page.getByRole('button', { name: 'Report', exact: true }).click()
      await expect(
        page.getByRole('dialog', { name: 'Problem-type-modal' })
      ).toBeVisible()
    },
  },
  {
    id: 'outputs-2001-report-form-modal',
    path: '/outputs/2001/',
    act: async (page) => {
      await page.getByRole('button', { name: 'Report', exact: true }).click()
      const type = page.getByRole('dialog', { name: 'Problem-type-modal' })
      await type.getByText('The document should not be published').click()
      await type.getByRole('button', { name: 'Continue' }).click()
      const form = page.getByRole('dialog', { name: 'Problem-form-modal' })
      await expect(form).toBeVisible()
      await form.getByText('Author', { exact: true }).click()
      await expect(form.getByLabel('Email')).toBeVisible()
    },
  },
  {
    id: 'provider-86-claim-edit-modal',
    path: '/data-providers/86/',
    act: async (page) => {
      await page.getByRole('button', { name: 'Create account' }).click()
      await expect(
        page
          .getByRole('dialog')
          .filter({ has: page.locator('#gain-access-modal-title') })
      ).toBeVisible()
    },
  },
]

// settled live census of a page (rows and "[object Object]" findings)
async function loadSettled(page, url) {
  const tracker = trackPage(page)
  await page.goto(url)
  const census = await settle(page, tracker, () => liveCensus(page))
  return { tracker, census }
}

async function interact(page, p2Env, it) {
  const { tracker } = await loadSettled(page, `${p2Env.baseURL}${it.path}`)
  await it.act(page)
  return settle(page, tracker, () => liveCensus(page))
}

const lines = (census, p2Env) =>
  censusLines(census.rows, {
    origins: stackOrigins(p2Env),
    buildId: p2Env.build ? p2Env.build.buildId : null,
  })

test.describe('T-605 @P0 class census', () => {
  // a settled state can take a minute when the parallel packages' stacks load the CPUs (settle.mjs)
  test.describe.configure({ timeout: 240000 })
  // E9 citations from the recorded fixtures while the stub does not list doi.org (I-40, P0-10-1)
  let restoreDoi = async () => {}
  test.beforeEach(async ({ p2Env, resolver, context, request }) => {
    restoreDoi = await serveDoiFixtures(p2Env, resolver)
    await serveBrowserGaps(context, { request, env: p2Env, resolver })
  })
  test.afterEach(async () => restoreDoi())

  test('T-605 c1 @P0 SSR DOM of the 200-routes: (DOM path, class tokens, behaviour attributes) normalised = baseline', async ({
    page,
    request,
    p2Env,
  }) => {
    for (const route of ROUTES_200) {
      const raw = await fetchRaw(request, urlOf(p2Env, route))
      expect(raw.status, route.id).toBe(200)
      const c = await parsedCensus(page, raw.text)
      expect(c.rows.length, `${route.id} census rows`).toBeGreaterThan(0)
      expectBaseline(
        `t605-ssr-${route.id}`,
        lines(c, p2Env),
        `${route.id} SSR class census = baseline`
      )
    }
  })

  for (const route of JS_ROUTES)
    test(`T-605 c1 @P0 hydrated DOM ${route.id} (cookie popup client-only, Q-051) = baseline`, async ({
      page,
      p2Env,
    }) => {
      const { census } = await loadSettled(page, urlOf(p2Env, route))
      expectBaseline(
        `t605-hydrated-${route.id}`,
        lines(census, p2Env),
        `${route.id} hydrated class census = baseline`
      )
    })

  for (const it of INTERACTIONS)
    test(`T-605 c1 @P0 post-interaction DOM ${it.id} = baseline`, async ({
      page,
      p2Env,
    }) => {
      const census = await interact(page, p2Env, it)
      expectBaseline(
        `t605-interaction-${it.id}`,
        lines(census, p2Env),
        `${it.id} class census = baseline`
      )
    })

  test('T-605 c2 @P0 0 "[object Object]" attribute values in the raw HTML and SSR DOM of the 200-routes', async ({
    page,
    request,
    p2Env,
  }) => {
    const found = []
    for (const route of ROUTES_200) {
      const raw = await fetchRaw(request, urlOf(p2Env, route))
      expect(raw.text.includes('[object Object]'), `${route.id} raw HTML`).toBe(
        false
      )
      const c = await parsedCensus(page, raw.text)
      found.push(...c.objectObject.map((o) => ({ route: route.id, ...o })))
    }
    expect(found).toEqual([])
  })

  for (const route of JS_ROUTES)
    test(`T-605 c2 @P0 0 "[object Object]" attribute values in the hydrated DOM ${route.id}`, async ({
      page,
      p2Env,
    }) => {
      const { census } = await loadSettled(page, urlOf(p2Env, route))
      expect(census.rows.length).toBeGreaterThan(0)
      expect(census.objectObject).toEqual([])
    })

  for (const it of INTERACTIONS)
    test(`T-605 c2 @P0 0 "[object Object]" attribute values after ${it.id}`, async ({
      page,
      p2Env,
    }) => {
      const census = await interact(page, p2Env, it)
      expect(census.objectObject).toEqual([])
    })
})
