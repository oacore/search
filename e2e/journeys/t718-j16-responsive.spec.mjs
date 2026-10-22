// T-718 (41 H, J16; R-008): responsive navigation. findings/07 §3 J16 at 375x812 with the 41 §2.4 correction
// "+ 501/320, 767/768" (review:ui-flows §4.1):
//   - /search/?q=climate at 375: the filters bar is hidden behind a full-width "Filters" button that opens it;
//     the member card and the promo image of the sidebar are hidden; the pagination is compact
//     (`siblingCount = width > 500 ? 2 : 0`, templates/search/index.jsx:133); the header search still works
//     (a new term replaces the results);
//   - /works/1001/ at 375: the sidebar renders below the main column (`display: contents` below 768 px,
//     modules/search-layout and templates/output styles); the header stays usable: the hamburger opens the
//     menu and the collapsed search icon opens the input (submitting it from a works page is the Q-100
//     crash, pinned by T-716);
//   - the 767/768 boundary (`--screen-until-desktop` = max-width 767px, main/media-queries.css:1): mobile
//     layout at 767, desktop at 768 on both pages; the works page at 768 is wider than the viewport (the
//     sidebar column keeps its width, document width 824; issue P1-06-1);
//   - the 501/320 overflow of Q-088 (X30.23): /search/?q=climate is 534 px wide at 501 (pagination with 11
//     items) and 346 px at 320 (the header wraps), with no overflow at 500 (7 items) and 375.
// The media rules of these layouts are R-008's subject (postcss-custom-media `importFrom`): if they stop
// matching, the 375 / 767 layouts are the desktop ones and these tests fail.
import { test, expect } from '../fixtures/guard.mjs'
import {
  TEST_TIMEOUT,
  NAV_TIMEOUT,
  slow,
  openAt,
  quiet,
  fontsAndImages,
  appQuiet,
  rel,
} from '../lib/P1-06/page.mjs'
import {
  headerSearch,
  filtersToggle,
  filtersBar,
  pillHead,
  memberCard,
  promoImage,
  pagerLabels,
} from '../lib/P1-06/states.mjs'
import { answer } from '../lib/P1-06/fixtures.mjs'

// a consent is given so that the bottom-fixed consent popup (T-719, T-740) never covers the page
test.use({ cookieState: 'essential' })

const PILLS = ['field', 'year', 'type', 'author', 'language', 'publisher']
const COMPACT = ['(prev)', '1', '2', '3', '…', 'last', '(next)']
const WIDE = [
  '(prev)',
  '1',
  '2',
  '3',
  '4',
  '5',
  '6',
  '7',
  '…',
  'last',
  '(next)',
]

const displayOf = (locator) =>
  locator.evaluate((el) => getComputedStyle(el).display)
const box = (locator) =>
  locator.evaluate((el) => {
    const r = el.getBoundingClientRect()
    return { x: r.x, y: r.y, width: r.width, height: r.height }
  })
const docWidth = (page) =>
  page.evaluate(() => ({
    client: document.documentElement.clientWidth,
    scroll: document.documentElement.scrollWidth,
  }))

async function openSearch(page, width, height) {
  const { tracker } = await openAt(page, '/search/?q=climate', width, {
    height,
  })
  await fontsAndImages(page)
  await quiet(page, tracker)
  await slow(page.getByText(/research outputs found$/)).toBeVisible()
  return tracker
}

async function openWork(page, width, height) {
  const { tracker } = await openAt(page, '/works/1001/', width, { height })
  await fontsAndImages(page)
  await quiet(page, tracker)
  return tracker
}

// the main column and the sidebar of a works page, and the boxes of the sidebar's children (the sidebar
// itself has no box once it is `display: contents`)
const workColumns = (page) =>
  page.evaluate(() => {
    const main = document.querySelector('[class*="container-main__"]')
    const side = document.querySelector('[class*="container-sidebar__"]')
    const b = (el) => {
      const r = el.getBoundingClientRect()
      return { x: r.x, y: r.y, width: r.width, height: r.height }
    }
    return {
      sidebarDisplay: getComputedStyle(side).display,
      main: b(main),
      sidebarChildren: [...side.children].map(b),
    }
  })

test.describe('T-718 J16 responsive', () => {
  test.describe.configure({ timeout: TEST_TIMEOUT })

  test('T-718 @P1 J16 375x812 /search/?q=climate: filters behind "Filters", member card and promo hidden, compact pagination', async ({
    page,
  }) => {
    await openSearch(page, 375, 812)
    const toggle = filtersToggle(page)
    await expect(toggle).toBeVisible()
    expect(await box(toggle)).toMatchObject({ x: 0, width: 375 })
    expect(await displayOf(filtersBar(page))).toBe('none')
    for (const label of PILLS) await expect(pillHead(page, label)).toBeHidden()
    // the sidebar's member card and promo image are hidden below 768 px
    expect(await displayOf(memberCard(page))).toBe('none')
    expect(await displayOf(promoImage(page))).toBe('none')
    expect(await pagerLabels(page)).toEqual(COMPACT)
    expect(await docWidth(page)).toEqual({ client: 375, scroll: 375 })

    // "Filters" opens the bar with its six pills; a second click closes it
    await toggle.click()
    expect(await displayOf(filtersBar(page))).toBe('flex')
    for (const label of PILLS) await expect(pillHead(page, label)).toBeVisible()
    await toggle.click()
    expect(await displayOf(filtersBar(page))).toBe('none')
    await expect(pillHead(page, 'field')).toBeHidden()
  })

  test('T-718 @P1 J16 375x812 /search/?q=climate: the header search stays usable (a new term replaces the results)', async ({
    page,
    p2Env,
    resolver,
  }) => {
    const tracker = await openSearch(page, 375, 812)
    const input = headerSearch(page)
    await expect(input).toBeVisible()
    await expect(input).toHaveValue('climate')
    const state = answer(resolver, { q: 'machine learning' })
    await appQuiet(p2Env)
    await input.fill('machine learning')
    await input.press('Enter')
    await slow(page).toHaveURL(
      `${p2Env.baseURL}/search/?q=machine+learning&page=1`,
      { timeout: NAV_TIMEOUT }
    )
    await slow(page.getByText(state.hits)).toBeVisible()
    await quiet(page, tracker)
    await expect(input).toHaveValue('machine learning')
    // the layout is still the mobile one
    await expect(filtersToggle(page)).toBeVisible()
    expect(await displayOf(memberCard(page))).toBe('none')
    expect(await pagerLabels(page)).toEqual(COMPACT)
    expect(rel(p2Env, page.url())).toBe('/search/?q=machine+learning&page=1')
  })

  test('T-718 @P1 J16 375x812 /works/1001/: sidebar below the main column, hamburger menu and search icon usable', async ({
    page,
  }) => {
    await openWork(page, 375, 812)
    const cols = await workColumns(page)
    expect(cols.sidebarDisplay).toBe('contents')
    expect(cols.main).toMatchObject({ x: 0, width: 375 })
    expect(cols.sidebarChildren.length).toBe(2)
    const mainBottom = cols.main.y + cols.main.height
    for (const child of cols.sidebarChildren) {
      expect(child).toMatchObject({ x: 0, width: 375 })
      expect(child.y).toBeGreaterThanOrEqual(mainBottom)
    }
    expect(await docWidth(page)).toEqual({ client: 375, scroll: 375 })

    // header: the menu sits behind the hamburger and opens with it
    const banner = page.getByRole('banner').first()
    const toggle = banner.getByRole('button', { name: 'Toggle navigation' })
    await expect(toggle).toBeVisible()
    await expect(toggle).toHaveAttribute('aria-expanded', 'false')
    for (const name of ['Services', 'Support us', 'About'])
      await expect(banner.getByRole('button', { name })).toBeHidden()
    await toggle.click()
    for (const name of ['Services', 'Support us', 'About'])
      await expect(banner.getByRole('button', { name })).toBeVisible()
    await toggle.click()
    await expect(banner.getByRole('button', { name: 'Services' })).toBeHidden()

    // the collapsed search: the icon opens the input
    const icon = banner.getByRole('button', { name: 'Search icon' })
    await expect(icon).toBeVisible()
    await expect(headerSearch(page)).toHaveCount(0)
    await icon.click()
    await expect(headerSearch(page)).toBeVisible()
  })

  test('T-718 @P1 J16 767/768 /search/?q=climate: mobile layout at 767, desktop layout at 768', async ({
    page,
  }) => {
    await openSearch(page, 767, 900)
    await expect(filtersToggle(page)).toBeVisible()
    expect(await displayOf(filtersBar(page))).toBe('none')
    expect(await displayOf(memberCard(page))).toBe('none')
    expect(await displayOf(promoImage(page))).toBe('none')
    expect(await pagerLabels(page)).toEqual(WIDE)
    expect(await docWidth(page)).toEqual({ client: 767, scroll: 767 })

    await openSearch(page, 768, 1024)
    await expect(filtersToggle(page)).toBeHidden()
    expect(await displayOf(filtersBar(page))).toBe('flex')
    for (const label of PILLS) await expect(pillHead(page, label)).toBeVisible()
    await expect(memberCard(page)).toBeVisible()
    await expect(promoImage(page)).toBeVisible()
    // the sidebar is a column right of the results
    const card = await box(memberCard(page))
    const count = await box(page.getByText(/research outputs found$/))
    expect(card.x).toBeGreaterThan(count.x + count.width)
    expect(await pagerLabels(page)).toEqual(WIDE)
    expect(await docWidth(page)).toEqual({ client: 768, scroll: 768 })
  })

  test('T-718 @P1 J16 767/768 /works/1001/: stacked at 767, two columns at 768 (document 824 px wide, P1-06-1)', async ({
    page,
  }) => {
    await openWork(page, 767, 900)
    const narrow = await workColumns(page)
    expect(narrow.sidebarDisplay).toBe('contents')
    expect(narrow.main).toMatchObject({ x: 0, width: 767 })
    for (const child of narrow.sidebarChildren) {
      expect(child).toMatchObject({ x: 0, width: 767 })
      expect(child.y).toBeGreaterThanOrEqual(narrow.main.y + narrow.main.height)
    }
    expect(await docWidth(page)).toEqual({ client: 767, scroll: 767 })

    await openWork(page, 768, 1024)
    const wide = await workColumns(page)
    expect(wide.sidebarDisplay).toBe('block')
    expect(wide.main.x).toBe(0)
    expect(wide.main.width).toBeLessThan(768 / 2 + 100)
    for (const child of wide.sidebarChildren)
      expect(child.x).toBeGreaterThan(wide.main.x + wide.main.width)
    // today the sidebar column overflows the viewport by 56 px at 768 (pinned as it is, D1)
    expect(await docWidth(page)).toEqual({ client: 768, scroll: 824 })
  })

  test('T-718 @P1 J16 501/500/375/320 /search/?q=climate: 534 px at 501 and 346 px at 320 (Q-088), no overflow at 500 and 375', async ({
    page,
  }) => {
    const cases = [
      [501, { client: 501, scroll: 534 }, WIDE],
      [500, { client: 500, scroll: 500 }, COMPACT],
      [375, { client: 375, scroll: 375 }, COMPACT],
      [320, { client: 320, scroll: 346 }, COMPACT],
    ]
    const seen = []
    for (const [w, width, labels] of cases) {
      await openSearch(page, w, 900)
      seen.push([w, await docWidth(page), await pagerLabels(page)])
      // the mobile layout at every one of these widths
      await expect(filtersToggle(page)).toBeVisible()
      expect(await displayOf(memberCard(page))).toBe('none')
    }
    expect(seen).toEqual(cases)
    // at 320 the header wraps: the "Filters" button starts below a second header row
    expect((await box(filtersToggle(page))).y).toBeGreaterThan(51)
  })
})
