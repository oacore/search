// P1-06 states and locators. T-805's three-engine census runs on the 41 §2.5 engine subset (V1, V2, V8, V9,
// V11, V13, V14, V18, V24, V37, V38 at 1440 and 375), one sub-state each (two for V11: the Cite and the first
// Report modal). Each `act` brings a settled page to the state with the user's own input (real clicks and
// keys) and ends on a web-first assertion of the reached state. Roles, labels and text first; a CSS-module
// class only through its stem (the hash suffix is per build).
import { slow as expect } from './page.mjs'

export const ENGINE_WIDTHS = [1440, 375]
export const MOBILE_MAX = 767

// ---------- locators ----------
export const headerSearch = (page) =>
  page.getByRole('combobox', { name: /from papers around the world$/ })
export const providersSearch = (page) =>
  page.getByRole('combobox', { name: 'Search data providers' })
export const howToSearch = (page) => page.getByText('How to search?')
// below 768 px "How to search?" is hidden; the focused input shows an info button instead (P0-17-4)
export const infoButton = (page) =>
  page.locator('[class*="select-info-append-button"]')
export const advancedPanel = (page) =>
  page.getByText('To refine your searches you can use:')
export const filtersToggle = (page) =>
  page.getByRole('button', { name: 'Filters', exact: true })
export const filtersBar = (page) => page.locator('ul[class*="styles_bar__"]')
// a facet pill: its list item in the bar (the pill head and, while open, its facet box), found by its
// label text (findings/07 §2.2)
export const pill = (page, label) =>
  filtersBar(page)
    .getByRole('listitem')
    .filter({ has: page.getByText(label, { exact: true }) })
export const pillHead = (page, label) =>
  filtersBar(page).getByText(label, { exact: true }).first()
export const openFacetBoxes = (page) => page.locator('[class*="filter-box__"]')
export const downloadButton = (page) =>
  page.locator('[class*="action-button__"]').nth(0)
export const copyButton = (page) =>
  page.locator('[class*="action-button__"]').nth(1)
export const sortBox = (page) => page.locator('[class*="sort-box__"]')
export const sortMenu = (page) => page.locator('[class*="sort-box-menu__"]')
export const memberCard = (page) => page.locator('[class*="member-info__"]')
export const promoImage = (page) => page.locator('[class*="sidebar-image__"]')
export const pagination = (page) => page.locator('ul[class*="pagination__"]')
export const cookieText = (page) =>
  page.getByText('We use cookies to improve our website.')

// pagination labels: '(prev)', page numbers or first/last, '…', '(next)'
export const pagerLabels = (page) =>
  pagination(page)
    .locator(':scope > li')
    .evaluateAll((lis) =>
      lis.map((li, i, all) => {
        const t = li.textContent.trim()
        if (t) return t
        if (i === 0) return '(prev)'
        if (i === all.length - 1) return '(next)'
        return '(icon)'
      })
    )

// ---------- T-805 c1 states ----------
// path, cookie state, the action from the settled page, and whether the state has a modal or popup that the
// pointer must not rest on
export const ENGINE_STATES = [
  { id: 'V1', path: '/search/?q=climate' },
  {
    id: 'V2-field',
    path: '/search/?q=climate',
    act: async (page, w) => {
      if (w <= MOBILE_MAX) {
        await filtersToggle(page).click()
        await expect(pillHead(page, 'field')).toBeVisible()
      }
      await pillHead(page, 'field').click()
      await expect(openFacetBoxes(page)).toHaveCount(1)
      await expect(pill(page, 'field').getByRole('list')).toBeVisible()
    },
  },
  { id: 'V8', path: '/works/1001/' },
  { id: 'V9', path: '/outputs/2001/' },
  {
    id: 'V11-cite',
    path: '/works/1001/',
    act: async (page) => {
      await page.getByRole('button', { name: 'Cite' }).click()
      await expect(
        page.getByRole('heading', { name: 'Citation' })
      ).toBeVisible()
    },
  },
  {
    id: 'V11-report',
    path: '/outputs/2001/',
    act: async (page) => {
      await page.getByRole('button', { name: 'Report', exact: true }).click()
      await expect(
        page.getByRole('dialog', { name: 'Problem-type-modal' })
      ).toBeVisible()
    },
  },
  { id: 'V13', path: '/outputs/update/' },
  { id: 'V14', path: '/data-providers/' },
  {
    id: 'V18',
    path: '/outputs/update/',
    cookieState: 'absent',
    act: async (page) => {
      await expect(cookieText(page)).toBeVisible()
    },
  },
  {
    id: 'V24',
    path: '/search/?q=climate',
    act: async (page, w) => {
      const mobile = w <= MOBILE_MAX
      await headerSearch(page).click()
      if (mobile) await expect(infoButton(page)).toBeVisible()
      else await expect(howToSearch(page)).toBeVisible()
      await (mobile ? infoButton(page) : howToSearch(page)).click()
      await expect(advancedPanel(page)).toBeVisible()
      await expect(
        page.getByRole('button', { name: 'search by doi' })
      ).toBeVisible()
    },
  },
  {
    id: 'V37-load-more',
    path: '/data-providers/',
    act: async (page) => {
      const more = page.getByRole('button', { name: 'Load more' })
      await more.click()
      await expect(page.getByText(/^Showing \d/).first()).toHaveText(
        'Showing 1-20 of 15,672'
      )
      await page.evaluate(() =>
        window.scrollTo({ top: 0, left: 0, behavior: 'instant' })
      )
      await page.waitForFunction(() => window.scrollY === 0)
    },
  },
  {
    id: 'V38-csv',
    path: '/search/?q=climate',
    act: async (page) => {
      await downloadButton(page).click()
      await expect(
        page.getByRole('dialog', { name: 'Download results in cvs modal' })
      ).toBeVisible()
    },
  },
]
