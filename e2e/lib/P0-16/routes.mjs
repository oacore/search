// P0-16 route tables. `ROUTES` = the T-601 routes that answer with an HTML page and run the app's scripts
// (41 T-601 c1, c2, c4: gateway-faithful proxy incl. /display/<id>/; the local-only pages through the allow-all
// proxy, Q-005), as listed by the T-601 table of 2026-10-20 (e2e/lib/P0-09/routes.mjs; package-private helpers
// are copied, not imported across packages, manifest §4.3; the same copy exists in P0-12), plus the two error
// pages that load the app's scripts and styles too: the unknown path under a routed prefix (404 page, Q-005)
// and the SSR 500 page (Q-001, Q-098). `fixture` is informative (the recorded scenario that answers the SSR
// calls of the page).
// `MODALS` = the client-only states of T-605 c1 (findings/07 §2.1, §2.2, §2.6, §2.8, §2.11, §2.16): each `act`
// ends on a web-first assertion of the opened state.
import { expect } from '../../fixtures/guard.mjs'

export const SEARCH_ID = 'fafad9968b7cd268c5fd64342bf88a26' // searchId of the recorded climate page 1

const r = (id, path, fixture, origin = 'gateway', extra = {}) => ({
  id,
  path,
  fixture,
  origin,
  ...extra,
})

export const ROUTES = [
  r('search-climate', '/search/?q=climate', 'search-climate'),
  r(
    'search-climate-p2-all-params',
    `/search/?q=climate&page=2&limit=10&sort=recent&t=${SEARCH_ID}`,
    'req-P0-09'
  ),
  r('search-zzzzqqq', '/search/?q=zzzzqqq', 'search-zzzzqqq'),
  r('search-status500', '/search/?q=__status500', 'magic:__status500'),
  r('works-1001', '/works/1001/', 'works-1001'),
  r('works-1001-t', `/works/1001/?t=${SEARCH_ID}-1001`, 'req-P0-09'),
  r('works-4040', '/works/4040/', 'works-4040'),
  r('works-5000', '/works/5000/', 'works-5000'),
  r('outputs-2001', '/outputs/2001/', 'outputs-2001'),
  r('outputs-2001-oai', '/outputs/2001/?source=oai', 'outputs-2001'),
  r('outputs-4100', '/outputs/4100/', 'outputs-4100'),
  r('outputs-4040', '/outputs/4040/', 'outputs-4040'),
  r('outputs-5000', '/outputs/5000/', 'outputs-5000'),
  r('display-2001', '/display/2001/', 'outputs-2001'),
  r('display-2001-oai', '/display/2001/?source=oai', 'outputs-2001'),
  r('outputs-update', '/outputs/update/', '-'),
  r('data-providers', '/data-providers/', '-'),
  r(
    'data-providers-add',
    '/data-providers/?q=aberystwyth&size=10&action=ADD&dataProviderUrl=https%3A%2F%2Fcreated.example.org%2F',
    '-'
  ),
  r('provider-86', '/data-providers/86/', 'provider-86'),
  r(
    'provider-86-query',
    `/data-providers/86/?q=&offset=0&limit=10&sort=recency&t=${SEARCH_ID}-86`,
    'req-P0-09'
  ),
  r('static-search', '/static/search', '-'),
  r('static-search-slash', '/static/search/', '-'),
  r('search-x-page0', '/search/?q=x&page=0', 'search-x-page0'),
  r('search-x-page-abc', '/search/?q=x&page=abc', 'members'),
  r('search-x-page1001', '/search/?q=x&page=1001', 'members'),
  r('works-1001-t-odd', '/works/1001/?t=a%26b%3Dc%20d', 'req-P0-09'),
  r('works-1001-t-repeated', '/works/1001/?t=a&t=b', '-'),
  r('local-index', '/', '-', 'allow'),
  r('local-error-card', '/error-card/', '-', 'allow'),
  // error pages that still run the app's scripts and styles
  r('search-foo-404', '/search/foo/', '-', 'gateway', { status: 404 }),
  r('works-4100-500', '/works/4100/', 'works-4100', 'gateway', { status: 500 }),
]

export const MODALS = [
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
