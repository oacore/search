// T-801 c1 (41 I; R-001, R-007, R-008, R-009, R-012, R-022, R-023, R-043, R-049, R-059, R-074, R-086, R-087), the
// search states of package P0-17: V1-V7 at the M widths (41 §2.5: 1920x1080, 1440x900, 768x1024, 767x900,
// 375x812), V23 and V26 at 1440 and 375, V24 at 1920, 1440, 767 and 375, V38 at 767 and 375, the dark subset of
// V1 at 1440 and 375 and the engine subset V1, V2, V24, V38 at 1440 and 375 (41 §2.3, §2.5; V38 at 1440 exists
// only as an engine state).
//
// Every shot is a full page (V26: the viewport at scrollY 900, because a full-page capture cannot show a
// sticky or fixed element), pixel-exact (e2e/fixtures/pixel-exact.mjs: exact RGBA, a `diff-pixels` annotation,
// no mask, no tolerance), taken after the clock is fixed (page.clock.setFixedTime), the state is settled (the
// page is hydrated, nothing is in flight, the filters are loaded), visualReady has passed (reduced motion,
// fonts, loaders gone, sprite 200 and a <use> with a non-zero box, images complete) and the pointer is
// parked at the bottom-right pixel of the viewport (no hover). The header is in every capture, never masked. The member card of the
// results page is the one-member fixture (`/internal/members`: provider 86 only). The cookie popup is hidden
// by `essential_cookies_allowed` (V18 is P0-18). Captures are recorded with
// `npm run e2e:record -- --run <id> --provisional --project visual -g 'T-801 c1 @P0'`: host baselines on
// this machine until B0 (owner notes §1); the file names carry the project and the platform.
//
// Titles: `T-801 c1 @P0 [@engines] V<n> <width> <engine>`. A state of the engine subset carries `@engines`: the
// harness runs it in the chromium (visual), webkit and firefox projects (playwright.config.mjs), each with
// its own baseline, so its engine token is `chromium+webkit+firefox`; the other states run in the visual
// project only (`chromium`). WebKit and Firefox run only in the runner container (DEFERRED here, I-23).
// V1-pre is V1 before hydration (the app scripts answered with an empty script, JavaScript enabled); V28
// (JavaScript off) is P0-18's. The dark subset compares the dark capture with the light V1 baseline (0 px, V20).
import { setFixedTime } from '../fixtures/guard.mjs'
import { test, expect } from '../lib/P0-17/harness-gaps.mjs'
import { open, settle, capture, emptyAppScripts } from '../lib/P0-17/ready.mjs'
import {
  headerSearch,
  headerSearchIcon,
  howToSearch,
  advancedPanel,
  filtersToggle,
  activePills,
  infoButton,
  pill,
  pillHead,
  openFacetBoxes,
  clearAll,
  downloadButton,
  copyButton,
  sortBox,
  sortMenu,
  csvTitle,
  csvOption,
  csvCancel,
  toast,
} from '../lib/P0-17/locators.mjs'
import { darkEqualsLight } from '../lib/P0-17/dark.mjs'

test.use({ cookieState: 'essential' })
// a hard load plus the settle wait can take minutes on a heavily loaded machine (40 §5: timeouts, never retries)
test.describe.configure({ timeout: 600000 })

// the M widths (41 §2.5)
const M = [
  [1920, 1080],
  [1440, 900],
  [768, 1024],
  [767, 900],
  [375, 812],
]
const HEIGHT = Object.fromEntries([...M, [1440, 900]])
const MOBILE_MAX = 767
const ENGINE_WIDTHS = [1440, 375]
const ENGINE_STATES = new Set(['V1', 'V1-pre', 'V2', 'V24', 'V38'])
const isEngines = (v, w) => ENGINE_STATES.has(v) && ENGINE_WIDTHS.includes(w)
const label = (v, w) =>
  isEngines(v, w)
    ? `@engines ${v} ${w} chromium+webkit+firefox`
    : `${v} ${w} chromium`

const CLIMATE = '/search/?q=climate'
const TWO_FILTERS_Q =
  'climate AND documentType:"thesis" AND publisher:"Oregon State University"'
const TWO_FILTERS = `/search/?q=${encodeURIComponent(TWO_FILTERS_Q)}`
const PAGE_5 = '/search/?q=climate&page=5'
// the page-1000 notice needs a 200 answer for offset 9990: the derived fixture is keyed by the string limit
// (the recorded 400 of `page=1000` stays untouched, P0-08-4)
const PAGE_1000 = '/search/?q=climate&page=1000&limit=10'
const ZERO = '/search/?q=zzzzqqq'
const ERROR_CARD_SEARCH = '/search/?q=__status500'
const AGGREGATE = 'https://api.core.ac.uk/v3/search/works/aggregate'

const viewportOf = (w) => ({ width: w, height: HEIGHT[w] })

// the results page, settled: hydrated, the header search bar, the filters loaded (six pills), nothing in flight
const openResults = async (page, path) => {
  await setFixedTime(page)
  const r = await open(page, path, { bar: true, filters: true })
  // six pills (below 768 px the bar is hidden behind the "Filters" button, so they are counted in the DOM)
  await expect(page.locator('[class*="bar-item-wrapper__"]')).toHaveCount(6)
  return r
}

for (const [w] of M) {
  test.describe(`${w}x${HEIGHT[w]}`, () => {
    test.use({ viewport: viewportOf(w) })
    const mobile = w <= MOBILE_MAX

    // ---------- V1: /search/?q=climate, default ----------

    test(`T-801 c1 @P0 ${label('V1-pre', w)}`, async ({ page }) => {
      await setFixedTime(page)
      await emptyAppScripts(page)
      await page.goto(CLIMATE)
      // the server markup before hydration: no app script ran, so no header search bar (Header.useSearchBar
      // configures it in an effect), an empty filters list, the results and the pagination
      expect(
        await page.evaluate(() => Boolean(window.next && window.next.router))
      ).toBe(false)
      await expect(headerSearch(page)).toHaveCount(0)
      await expect(page.getByText('publisher', { exact: true })).toHaveCount(0)
      await expect(
        page.getByText('1,956,781 research outputs found')
      ).toBeAttached()
      await capture(page, `V1-pre-${w}.png`)
    })

    test(`T-801 c1 @P0 ${label('V1', w)}`, async ({ page }) => {
      await openResults(page, CLIMATE)
      // the one-member fixture: one membership card, no mask
      await expect(
        page.getByText('CORE membership', { exact: true })
      ).toHaveCount(1)
      await expect(page.getByText('Open University (ORO)')).toBeAttached()
      await capture(page, `V1-${w}.png`)
    })

    // ---------- V2: filters open (<=767) / one facet open: field, year, type ----------

    test(`T-801 c1 @P0 ${label('V2', w)}`, async ({ page }) => {
      await openResults(page, CLIMATE)
      if (mobile) {
        await filtersToggle(page).click()
        await expect(pillHead(page, 'field')).toBeVisible()
        await capture(page, `V2-filters-${w}.png`)
      }
      for (const facet of ['field', 'year', 'type']) {
        await pillHead(page, facet).click()
        // the click outside the previous box closed it: one box is open
        await expect(openFacetBoxes(page)).toHaveCount(1)
        await expect(pill(page, facet).getByRole('list')).toBeVisible()
        await capture(page, `V2-${facet}-${w}.png`)
      }
    })

    // ---------- V3: two filters and "Clear all filters" ----------

    test(`T-801 c1 @P0 ${label('V3', w)}`, async ({ page }) => {
      await openResults(page, TWO_FILTERS)
      // `type` and `publisher` carry the highlight class, the clear button is in the bar
      await expect(activePills(page)).toHaveCount(2)
      await expect(clearAll(page)).toBeAttached()
      if (mobile) {
        await capture(page, `V3-${w}.png`)
        await filtersToggle(page).click()
        await expect(clearAll(page)).toBeVisible()
        await capture(page, `V3-filters-${w}.png`)
      } else {
        await expect(clearAll(page)).toBeVisible()
        await capture(page, `V3-${w}.png`)
      }
    })

    // ---------- V4: sort open, CSV modal (+ reopen after Top 100, Q-077), copy toast ----------

    test(`T-801 c1 @P0 ${label('V4', w)}`, async ({ page, context }) => {
      await context.grantPermissions(['clipboard-read', 'clipboard-write'])
      await openResults(page, CLIMATE)

      // sort menu open
      await sortBox(page).click()
      await expect(sortMenu(page)).toBeVisible()
      await capture(page, `V4-sort-${w}.png`)
      await sortBox(page).click()
      await expect(sortMenu(page)).toHaveCount(0)

      // CSV modal: no radio chosen, "Current page" highlighted
      await downloadButton(page).click()
      await expect(csvTitle(page)).toBeVisible()
      await capture(page, `V4-csv-${w}.png`)

      // Top 100 chosen
      await csvOption(page, 'Top 100 results').click()
      await capture(page, `V4-csv-top100-${w}.png`)

      // Cancel, reopen: "Current page" is highlighted again, the store keeps the last choice (Q-077)
      await csvCancel(page).click()
      await expect(csvTitle(page)).toHaveCount(0)
      await downloadButton(page).click()
      await expect(csvTitle(page)).toBeVisible()
      await capture(page, `V4-csv-reopen-${w}.png`)
      await csvCancel(page).click()
      await expect(csvTitle(page)).toHaveCount(0)

      // copy toast: "Link copied" disappears after 2.5 s of the page clock. The clock is installed after the
      // load and paused, so the toast stays for the capture (timers created from now on only run with
      // page.clock.runFor)
      await page.clock.install({ time: new Date('2026-01-15T12:00:00Z') })
      await page.clock.pauseAt(new Date('2026-01-15T12:00:01Z'))
      await copyButton(page).click()
      await expect(toast(page)).toBeVisible()
      await capture(page, `V4-toast-${w}.png`)
    })

    // ---------- V5: page=5 (first/last labels, dots), the page-1000 notice ----------

    test(`T-801 c1 @P0 ${label('V5', w)}`, async ({ page }) => {
      await openResults(page, PAGE_5)
      await capture(page, `V5-page5-${w}.png`)
    })

    test(`T-801 c1 @P0 ${label('V5-notice', w)}`, async ({ page }) => {
      await openResults(page, PAGE_1000)
      await expect(
        page.getByText('Our search interface allows you to see only the first')
      ).toBeVisible()
      await capture(page, `V5-page1000-notice-${w}.png`)
    })

    // ---------- V6: 0 results, ErrorCard ----------

    test(`T-801 c1 @P0 ${label('V6', w)}`, async ({ page }) => {
      await setFixedTime(page)
      await open(page, ZERO, { bar: true })
      await expect(
        page.getByRole('heading', {
          name: 'Sorry, we couldn’t find any results for “zzzzqqq”.',
        })
      ).toBeVisible()
      await capture(page, `V6-zero-results-${w}.png`)
    })

    test(`T-801 c1 @P0 ${label('V6-errorcard', w)}`, async ({ page }) => {
      await setFixedTime(page)
      await open(page, ERROR_CARD_SEARCH)
      await expect(
        page.getByText('This page is not available now.')
      ).toBeVisible()
      await capture(page, `V6-error-card-${w}.png`)
    })

    // ---------- V7: filters loading (the aggregation answer held back) ----------

    test(`T-801 c1 @P0 ${label('V7', w)}`, async ({ page }) => {
      await setFixedTime(page)
      let release
      const held = new Promise((resolve) => {
        release = resolve
      })
      let hits = 0
      await page.route(AGGREGATE, async (route) => {
        hits += 1
        await held
        await route.fallback()
      })
      try {
        const { tracker } = await open(page, CLIMATE, { settled: false })
        await expect.poll(() => hits).toBe(1)
        await expect(page.locator('[class*="loading-block"]')).toHaveCount(1)
        await expect(
          page.getByText('Publisher', { exact: true })
        ).toBeAttached()
        if (mobile) await filtersToggle(page).click()
        await expect(headerSearch(page)).toBeVisible()
        await capture(page, `V7-loading-${w}.png`, { mode: 'loading' })
        // an open facet shows its own "Loading" box with a spinner
        await page.getByText('Field', { exact: true }).click()
        await expect(page.getByText('Loading', { exact: true })).toBeVisible()
        await capture(page, `V7-loading-box-${w}.png`, { mode: 'loading' })
        release()
        await settle(page, tracker)
      } finally {
        release()
      }
    })
  })
}

// ---------- V23: header search per route (1440, 375) ----------
// input visible on /search and /data-providers/; a collapsed magnifier icon that opens the input on works and
// outputs pages; none on /outputs/update/, a provider page, the 404 page, the 500 page and /error-card/ (the
// gateway does not route it, Q-005: it is loaded through the allow-all proxy)
const CONSOLE_404 =
  'Failed to load resource: the server responded with a status of 404 (Not Found)'
const CONSOLE_500 =
  'Failed to load resource: the server responded with a status of 500 (Internal Server Error)'

for (const w of [1440, 375]) {
  test.describe(`V23 ${w}x${HEIGHT[w]}`, () => {
    test.use({ viewport: viewportOf(w) })

    test(`T-801 c1 @P0 ${label('V23-input', w)}`, async ({ page }) => {
      await openResults(page, CLIMATE)
      await expect(headerSearch(page)).toBeVisible()
      await capture(page, `V23-search-${w}.png`)
      await open(page, '/data-providers/', { bar: /^Search data providers$/ })
      await expect(
        page.getByRole('combobox', { name: 'Search data providers' })
      ).toBeVisible()
      await capture(page, `V23-data-providers-${w}.png`)
    })

    test(`T-801 c1 @P0 ${label('V23-collapsed', w)}`, async ({
      page,
      p17Doi,
    }) => {
      await setFixedTime(page)
      for (const [id, path] of [
        ['works', '/works/1001/'],
        ['outputs', '/outputs/2001/'],
      ]) {
        await open(page, path)
        await expect(headerSearchIcon(page)).toBeVisible()
        await expect(headerSearch(page)).toHaveCount(0)
        await capture(page, `V23-${id}-${w}.png`)
        // the icon opens the input
        await headerSearchIcon(page).click()
        await expect(headerSearch(page)).toBeVisible()
        await capture(page, `V23-${id}-open-${w}.png`)
      }
    })

    test(`T-801 c1 @P0 ${label('V23-none', w)}`, async ({
      page,
      p2Env,
      guardLog,
      p17Doi,
    }) => {
      // the 404 and the 500 document each log Chromium's "Failed to load resource" line for the page itself
      // (the 500 page also logs the status object of Next's error page): declared and asserted below
      test
        .info()
        .annotations.push({ type: 'guard-expect', description: 'console' })
      await setFixedTime(page)
      const routes = [
        ['update', '/outputs/update/', 200],
        ['provider', '/data-providers/86/', 200],
        ['404', '/works/', 404],
        ['500', '/works/6948813/', 500],
        ['error-card', new URL('/error-card/', p2Env.allowURL).href, 200],
      ]
      for (const [id, path, status] of routes) {
        const { response } = await open(page, path)
        expect(response.status(), `${id} status`).toBe(status)
        await expect(headerSearch(page)).toHaveCount(0)
        await expect(headerSearchIcon(page)).toHaveCount(0)
        await capture(page, `V23-${id}-${w}.png`)
      }
      expect(guardLog.consoleErrors.map((e) => e.text.split('\n')[0])).toEqual([
        CONSOLE_404,
        CONSOLE_500,
        '{name: Internal Server Error., message: 500 - Internal Server Error., statusCode: 500}',
        'A client-side exception has occurred, see here for more info: https://nextjs.org/docs/messages/client-side-exception-occurred', // AD-116
      ])
    })
  })
}

// ---------- V24: advanced-search panel (1920, 1440, 767, 375) ----------

for (const w of [1920, 1440, 767, 375]) {
  test.describe(`V24 ${w}x${HEIGHT[w]}`, () => {
    test.use({ viewport: viewportOf(w) })
    test(`T-801 c1 @P0 ${label('V24', w)}`, async ({ page }) => {
      const mobile = w <= MOBILE_MAX
      await openResults(page, CLIMATE)
      // the focused input: below 768 px the info button appears (the "How to search?" text is hidden there)
      await headerSearch(page).click()
      if (mobile) await expect(infoButton(page)).toBeVisible()
      else await expect(howToSearch(page)).toBeVisible()
      await capture(page, `V24-focus-${w}.png`)
      // the panel
      await (mobile ? infoButton(page) : howToSearch(page)).click()
      await expect(advancedPanel(page)).toBeVisible()
      await expect(
        page.getByRole('button', { name: 'search by doi' })
      ).toBeVisible()
      await capture(page, `V24-${w}.png`)
    })
  })
}

// ---------- V26: /search scrolled, sticky header + fixed filters bar (1440, 375) ----------
// a viewport capture at scrollY 900: a full-page capture cannot show sticky or fixed behaviour

for (const w of [1440, 375]) {
  test.describe(`V26 ${w}x${HEIGHT[w]}`, () => {
    test.use({ viewport: viewportOf(w) })
    test(`T-801 c1 @P0 ${label('V26', w)}`, async ({ page }) => {
      await openResults(page, CLIMATE)
      await page.evaluate(() => window.scrollTo(0, 900))
      await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(900)
      await capture(page, `V26-${w}.png`, { fullPage: false })
    })
  })
}

// ---------- V38: fieldset of the CSV modal (767, 375; engines 1440, 375) ----------
// the only used design CSS that depends on search's @custom-media (`@media (--screen-until-desktop)` in
// lib/elements/fieldset/fieldset.css is resolved by search's PostCSS to max-width 767)

for (const w of [1440, 767, 375]) {
  test.describe(`V38 ${w}x${HEIGHT[w]}`, () => {
    test.use({ viewport: viewportOf(w) })
    test(`T-801 c1 @P0 ${label('V38', w)}`, async ({ page }) => {
      await openResults(page, CLIMATE)
      await downloadButton(page).click()
      await expect(csvTitle(page)).toBeVisible()
      await csvOption(page, 'All the results').click()
      await capture(page, `V38-${w}.png`)
    })
  })
}

// ---------- dark subset: V1 at 1440 and 375 with colorScheme dark ----------
// No dark mode exists (V20): the page rendered for a dark colour scheme equals the light capture at 0 px. The
// dark shot is compared with the light baseline of V1 (`V1-<w>.png`, same file) and with the light rendering
// of the same page state (emulateMedia light), which is the reference while baselines are being recorded.

for (const w of [1440, 375]) {
  test.describe(`dark ${w}x${HEIGHT[w]}`, () => {
    test.use({ viewport: viewportOf(w), colorScheme: 'dark' })
    test(`T-801 c1 @P0 V1-dark ${w} chromium`, async ({ page }) => {
      await openResults(page, CLIMATE)
      await darkEqualsLight(page, `V1-${w}.png`)
    })
  })
}
