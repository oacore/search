// T-801 c1 (41 I; R-001, R-007, R-008, R-009, R-012, R-022, R-023, R-043, R-049, R-059, R-074, R-086, R-087), the
// P1 states of package P1-07: V21 header menus (1920, 1440, 768), V22 hamburger alone and with Filters open (767,
// 375), V25 suggestions (1440, 375), V27 works and outputs pages scrolled to scrollY 900 (1440, 375), V29
// tooltips (1440), V30 /display/<id>/ hydrated (1440), V31 the 500 page (1440, 375; dark subset), V33 facet box
// variants (1440, 375), V34 horizontal overflow (501, 320; Q-088), V35 provider output-error texts (1440; Q-044),
// V37 data providers: clusters, Load more, add form (1440, 375; engine subset), V39 KaTeX, long title, 30
// authors (1440, 375; Q-097).
//
// Every shot is pixel-exact against this machine's host baseline (owner notes §1: exact RGBA, a `diff-pixels`
// annotation, no mask, no tolerance), taken after the clock is fixed, the page is settled (hydrated, nothing in
// flight, no route change, two polls 500 ms apart), visualReady has passed (reduced motion, fonts, loaders gone,
// tiles, sprite 200 and a <use> with a non-zero box, images complete) and the pointer is parked at the
// bottom-right pixel of the viewport (no hover), except the hover states of V29 where the pointer is the state.
// The header is in every shot, never masked. A full-page shot is taken from the top; V27 and the V29 states that
// sit below the fold are viewport shots at the scroll position of the state (a full-page capture cannot show a
// sticky or fixed element where a user sees it). The cookie popup is hidden by `essential_cookies_allowed` (V18
// is P0-18's). The member card of the results page is the one-member fixture (provider 86 only).
//
// Baselines: `npm run e2e:record -- --run <id> --project visual e2e/visual/t801-p1-states.spec.mjs` on the
// golden build (host baseline, macOS arm64, until B0 is captured in CI; 42 §9). Titles:
// `T-801 c1 @P1 [@engines] V<n> <state> <width> chromium`. A state of the engine subset (V37 at 1440 and 375)
// carries `@engines`: webkit and firefox run it in the runner container only (not in this run, I-23), each
// with its own baseline.
//
// Not captured, by the row's own wording: V33 "year box with 0 buckets" (an empty year aggregation makes the
// year box throw and blanks the page, Q-074e: V32, pinned by T-730), V37 "duplicate with a non-JSON message"
// (blanks the page, Q-038: T-413, T-714).
import {
  test,
  expect,
  open,
  setFixedTime,
  stubControl,
  settleAfter,
  loadLazyImages,
  capture,
  shots,
  viewportOf,
  engines,
  TEST_TIMEOUT,
  MENU_LABELS,
  menuButton,
  hamburger,
  consoleTexts,
  expectGuard,
  CONSOLE_409,
  CONSOLE_500,
  CONSOLE_500_PAGE,
} from '../lib/P1-07/page.mjs'
import {
  headerSearch,
  filtersToggle,
  pill,
  pillHead,
  openFacetBoxes,
  activePills,
  downloadButton,
  copyButton,
} from '../lib/P0-17/locators.mjs'
import { darkEqualsLight } from '../lib/P0-17/dark.mjs'

test.use({ cookieState: 'essential' })
test.describe.configure({ timeout: TEST_TIMEOUT })

const MOBILE_MAX = 767
const CLIMATE = '/search/?q=climate'
const TWO_FILTERS_Q =
  'climate AND documentType:"thesis" AND publisher:"Oregon State University"'
const TWO_FILTERS = `/search/?q=${encodeURIComponent(TWO_FILTERS_Q)}`
// one year bucket: the recorded answers of the year-range journey (T-705)
const ONE_YEAR = `/search/?q=${encodeURIComponent(
  'climate AND (yearPublished>=1952 AND yearPublished<=1952)'
)}`
// the climate page with an aggregation whose language box has values (derived fixture, req-P1-07)
const LANGUAGES = '/search/?q=v33lang'

const slug = (label) => label.toLowerCase().replace(/\s+/g, '-')
const label = (v, w) => `${v} ${w} chromium`

// the results page, settled: hydrated, the header search bar, the filters loaded (six pills), nothing in flight
const openResults = async (page, path) => {
  await setFixedTime(page)
  const r = await open(page, path, { bar: true, filters: true })
  await expect(page.locator('[class*="bar-item-wrapper__"]')).toHaveCount(6)
  return r
}

// ---------- V21: header menus open (1920, 1440, 768) ----------
// each menu of the design Header, one at a time, on a page with the header search bar (/search) and on one
// without (/outputs/update/, no API call)

const V21_PAGES = [
  ['search', CLIMATE],
  ['update', '/outputs/update/'],
]

for (const [id, path] of V21_PAGES)
  for (const w of [1920, 1440, 768])
    test.describe(`V21 ${id} ${w}`, () => {
      test.use({ viewport: viewportOf(w) })
      test(`T-801 c1 @P1 ${label(`V21 header menus ${id}`, w)}`, async ({
        page,
      }) => {
        if (id === 'search') await openResults(page, path)
        else {
          await setFixedTime(page)
          await open(page, path)
        }
        await expect(hamburger(page)).toBeHidden()
        const s = shots(page)
        for (const menu of MENU_LABELS) {
          await menuButton(page, menu).click()
          await expect(menuButton(page, menu)).toHaveAttribute(
            'aria-expanded',
            'true'
          )
          await s.take(`V21-${id}-${slug(menu)}-${w}.png`)
        }
        s.done()
      })
    })

// ---------- V22: hamburger alone, and with Filters open (767, 375) ----------
// below 768 px the three menus sit behind the hamburger. At 375 px with the Filters bar open the nav overlays it.

for (const w of [767, 375])
  test.describe(`V22 ${w}`, () => {
    test.use({ viewport: viewportOf(w) })

    test(`T-801 c1 @P1 ${label(
      'V22 hamburger alone /outputs/update/',
      w
    )}`, async ({ page }) => {
      await setFixedTime(page)
      await open(page, '/outputs/update/')
      await expect(hamburger(page)).toBeVisible()
      const s = shots(page)
      await hamburger(page).click()
      await expect(hamburger(page)).toHaveAttribute('aria-expanded', 'true')
      await s.take(`V22-update-hamburger-${w}.png`)
      // a menu opened inside the expanded nav
      await menuButton(page, 'Services').click()
      await expect(menuButton(page, 'Services')).toHaveAttribute(
        'aria-expanded',
        'true'
      )
      await s.take(`V22-update-hamburger-services-${w}.png`)
      s.done()
    })

    test(`T-801 c1 @P1 ${label(
      'V22 hamburger and Filters /search',
      w
    )}`, async ({ page }) => {
      await openResults(page, CLIMATE)
      const s = shots(page)
      await hamburger(page).click()
      await expect(hamburger(page)).toHaveAttribute('aria-expanded', 'true')
      await s.take(`V22-search-hamburger-${w}.png`)
      await hamburger(page).click()
      await expect(hamburger(page)).toHaveAttribute('aria-expanded', 'false')
      // the Filters bar open, then the hamburger on top of it
      await filtersToggle(page).click()
      await expect(pillHead(page, 'field')).toBeVisible()
      await s.take(`V22-search-filters-${w}.png`)
      await hamburger(page).click()
      await expect(hamburger(page)).toHaveAttribute('aria-expanded', 'true')
      await s.take(`V22-search-filters-hamburger-${w}.png`)
      s.done()
    })
  })

// ---------- V25: suggestions list of the data providers search (1440, 375) ----------
// "univ" matches more than ten providers: the list shows the first ten (max 10 items); ArrowDown highlights an
// option and writes it into the input (the label overlays the input: Q-083)

for (const w of [1440, 375])
  test.describe(`V25 ${w}`, () => {
    test.use({ viewport: viewportOf(w) })
    test(`T-801 c1 @P1 ${label('V25 suggestions', w)}`, async ({ page }) => {
      await setFixedTime(page)
      const { tracker } = await open(page, '/data-providers/', {
        bar: /^Search data providers$/,
      })
      await page.locator('label[for="select-app-bar-search"]').click()
      await page.keyboard.type('univ')
      await expect(page.getByRole('option')).toHaveCount(10)
      await settleAfter(page, tracker)
      const s = shots(page)
      await s.take(`V25-list-${w}.png`)
      await page.keyboard.press('ArrowDown')
      await page.keyboard.press('ArrowDown')
      await expect(page.getByRole('option', { selected: true })).toHaveCount(1)
      await settleAfter(page, tracker)
      await s.take(`V25-arrow-${w}.png`)
      s.done()
    })
  })

// ---------- V27: works and outputs pages scrolled to scrollY 900 (1440, 375) ----------
// a viewport capture: the sticky header over the content

const V27_PAGES = [
  ['works', '/works/1001/'],
  ['outputs', '/outputs/2001/'],
]

for (const [id, path] of V27_PAGES)
  for (const w of [1440, 375])
    test.describe(`V27 ${id} ${w}`, () => {
      test.use({ viewport: viewportOf(w) })
      test(`T-801 c1 @P1 ${label(`V27 ${id} scrolled`, w)}`, async ({
        page,
      }) => {
        await setFixedTime(page)
        await open(page, path)
        await loadLazyImages(page)
        await page.evaluate(() => window.scrollTo(0, 900))
        await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(900)
        await capture(page, `V27-${id}-${w}.png`, { fullPage: false })
      })
    })

// ---------- V29: tooltips (1440) ----------
// Tippy popovers of the design Popover (`[data-tippy-root]`): hover and focus on the results header buttons,
// hover on the disabled "Download from data provider" (placement right), and, on the works page, the full OAI
// identifier that the version card's own tooltip shows over the shortened one.

const TIP = '[data-tippy-root]'
const NO_FULLTEXT = "We don't have a full text link from this data provider"

// the element in the middle of the viewport, then the pointer on it
async function hoverAt(page, locator) {
  await locator.evaluate((el) => el.scrollIntoView({ block: 'center' }))
  await locator.hover()
}

test.describe('V29 1440', () => {
  test.use({ viewport: viewportOf(1440) })

  test(`T-801 c1 @P1 ${label('V29 tooltips /search', 1440)}`, async ({
    page,
  }) => {
    await openResults(page, CLIMATE)
    await loadLazyImages(page)
    const tip = page.locator(TIP)
    const s = shots(page)
    await downloadButton(page).hover()
    await expect(tip).toHaveCount(1)
    await expect(tip).toHaveText('Download results in CSV')
    await s.take('V29-csv-hover-1440.png', { pointer: 'keep' })
    await copyButton(page).hover()
    await expect(tip).toHaveCount(1)
    await expect(tip).toHaveText('Copy url')
    await s.take('V29-copy-hover-1440.png', { pointer: 'keep' })
    // keyboard focus: the pointer leaves, the tooltip goes, focus brings it back
    await page.mouse.move(1439, 899)
    await expect(tip).toHaveCount(0)
    await copyButton(page).focus()
    await expect(tip).toHaveCount(1)
    await expect(tip).toHaveText('Copy url')
    await s.take('V29-copy-focus-1440.png', { pointer: 'keep' })
    s.done()
  })

  for (const [id, path] of V27_PAGES)
    test(`T-801 c1 @P1 ${label(`V29 tooltips /${id}`, 1440)}`, async ({
      page,
    }) => {
      await setFixedTime(page)
      await open(page, path)
      await loadLazyImages(page)
      const tip = page.locator(TIP)
      const s = shots(page)
      // the disabled button: placement right
      await hoverAt(page, page.locator('[class*="disabled-button"]').first())
      await expect(tip).toHaveCount(1)
      await expect(tip).toHaveText(NO_FULLTEXT)
      await s.take(`V29-${id}-no-fulltext-1440.png`, {
        fullPage: false,
        pointer: 'keep',
      })
      // the OAI identifier of a version card (works only: the output page prints it whole, without a tooltip):
      // the card's own tooltip with the full text over the shortened one
      if (id === 'works') {
        await page.mouse.move(1439, 899)
        await expect(tip).toHaveCount(0)
        const oai = page.locator('a[class*="card-dropdown_ellipsis__"]').first()
        await hoverAt(page, oai)
        const full = await oai.getAttribute('href')
        const box = page.locator('[class*="card-dropdown_tooltip__"]')
        await expect(box).toHaveCount(1)
        expect(full.endsWith(await box.innerText())).toBe(true)
        await s.take(`V29-${id}-oai-1440.png`, {
          fullPage: false,
          pointer: 'keep',
        })
      } else
        await expect(
          page.locator('a[class*="card-dropdown_ellipsis__"]')
        ).toHaveText('oai:oro.open.ac.uk:90496')
      s.done()
    })
})

// ---------- V30: /display/<id>/ hydrated (1440) ----------
// the gateway serves /display/2001/ from /outputs/2001; once hydrated, the navigation trail loses its tail
// (the server render has "Search results > Research output from ...", Q-075) and its link is the Q-046 href

test.describe('V30 1440', () => {
  test.use({ viewport: viewportOf(1440) })
  test(`T-801 c1 @P1 ${label('V30 display hydrated', 1440)}`, async ({
    page,
  }) => {
    await setFixedTime(page)
    await open(page, '/display/2001/')
    const trail = page.locator('[class*="navigation-trail"]')
    await expect(trail.locator('a')).toHaveCount(1)
    await expect(trail).toHaveText('Search results')
    await capture(page, 'V30-display-1440.png')
  })
})

// ---------- V31: the 500 page (1440, 375; dark subset) ----------
// Next's _error inside the layout, triggered by work 6948813 (empty publishedDate, Q-073 a: the server render
// throws). The document and the error page each log one console error (declared and asserted).

const FIVE_HUNDRED = '/works/6948813/'
const open500 = async (page, guardLog) => {
  expectGuard('console')
  await setFixedTime(page)
  const { response } = await open(page, FIVE_HUNDRED)
  expect(response.status()).toBe(500)
  await expect(
    page.getByText('An unexpected error has occurred.')
  ).toBeVisible()
  expect(consoleTexts(guardLog)).toEqual([CONSOLE_500, CONSOLE_500_PAGE])
}

for (const w of [1440, 375])
  test.describe(`V31 ${w}`, () => {
    test.use({ viewport: viewportOf(w) })

    test(`T-801 c1 @P1 ${label('V31 500 page', w)}`, async ({
      page,
      guardLog,
    }) => {
      await open500(page, guardLog)
      await capture(page, `V31-500-${w}.png`)
    })

    test.describe('dark', () => {
      test.use({ colorScheme: 'dark' })
      // no dark mode exists (V20): the capture under prefers-color-scheme: dark is the light baseline at 0 px
      test(`T-801 c1 @P1 ${label('V31 500 page dark', w)}`, async ({
        page,
        guardLog,
      }) => {
        await open500(page, guardLog)
        await darkEqualsLight(page, `V31-500-${w}.png`)
      })
    })
  })

// ---------- V33: facet box variants (1440, 375) ----------
// field (wide, scrolls), year (many buckets: Histoslider), type, author (long names), language (the recorded
// answer has none: an empty box), publisher; the boxes of a search with two filters applied (checked values);
// the year box with one bucket (no Histoslider); the language box with values, one code without a name
// (data/languages.json). Below 768 px the Filters bar sits behind the "Filters" button and the facet boxes are
// absolute and full width.

const FACETS = ['field', 'year', 'type', 'author', 'language', 'publisher']

// open one facet box (the click outside the previous box closed it) and wait for its list
async function openFacet(page, facet) {
  await pillHead(page, facet).click()
  await expect(openFacetBoxes(page)).toHaveCount(1)
  await expect(openFacetBoxes(page)).toBeVisible()
}

for (const w of [1440, 375])
  test.describe(`V33 ${w}`, () => {
    test.use({ viewport: viewportOf(w) })
    const mobile = w <= MOBILE_MAX

    test(`T-801 c1 @P1 ${label('V33 facet boxes', w)}`, async ({ page }) => {
      await openResults(page, CLIMATE)
      if (mobile) await filtersToggle(page).click()
      const s = shots(page)
      for (const facet of FACETS) {
        await openFacet(page, facet)
        await s.take(`V33-${facet}-${w}.png`)
      }
      s.done()
    })

    test(`T-801 c1 @P1 ${label(
      'V33 facet boxes with selected values',
      w
    )}`, async ({ page }) => {
      await openResults(page, TWO_FILTERS)
      await expect(activePills(page)).toHaveCount(2)
      if (mobile) await filtersToggle(page).click()
      const s = shots(page)
      for (const facet of ['type', 'publisher']) {
        await openFacet(page, facet)
        // the checked value is the first item of the box
        await expect(
          pill(page, facet).locator('input[type="radio"]:checked')
        ).toHaveCount(1)
        await s.take(`V33-selected-${facet}-${w}.png`)
      }
      s.done()
    })

    test(`T-801 c1 @P1 ${label('V33 year box with one bucket', w)}`, async ({
      page,
    }) => {
      await openResults(page, ONE_YEAR)
      if (mobile) await filtersToggle(page).click()
      await openFacet(page, 'year')
      await capture(page, `V33-year-one-bucket-${w}.png`)
    })

    test(`T-801 c1 @P1 ${label('V33 language box with codes', w)}`, async ({
      page,
    }) => {
      await openResults(page, LANGUAGES)
      if (mobile) await filtersToggle(page).click()
      await openFacet(page, 'language')
      // three names from data/languages.json and the raw code "und"
      const box = openFacetBoxes(page)
      await expect(box.getByText('English')).toBeVisible()
      await expect(box.getByText('und', { exact: true })).toBeVisible()
      await capture(page, `V33-language-codes-${w}.png`)
    })
  })

// ---------- V34: horizontal overflow of /search (501, 320; Q-088) ----------
// the page is wider than the viewport: 534 px at 501, 346 px at 320 (the fixed filters bar under the sticky
// header, the pagination with siblingCount 2); baseline quirks, never "fixed"

for (const [w, scrollWidth] of [
  [501, 534],
  [320, 346],
])
  test.describe(`V34 ${w}`, () => {
    test.use({ viewport: viewportOf(w) })
    test(`T-801 c1 @P1 ${label('V34 overflow', w)}`, async ({ page }) => {
      await openResults(page, CLIMATE)
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth)
      ).toBe(scrollWidth)
      await capture(page, `V34-${w}.png`)
    })
  })

// ---------- V35: provider output-error texts (1440; Q-044, Q-080..Q-082) ----------
// provider 86. (a) the outputs call (E13) fails on the server: the page renders with an empty total, the
// placeholder "Search over undefined research outputs in <name>", the error text and the pager "Showing 71-80 of
// a lot of" (offset 70, total undefined); (b) the last page of a provider with 95 outputs: the pager does not
// clamp its upper bound ("Showing 91-100 of 95"); (c) an offset that is not a number: "Showing a lot of-a lot
// of of 95".

const E13_ERROR_RULE = {
  method: 'GET',
  urlRegex:
    '^https://api\\.core\\.ac\\.uk/v3/data-providers/86/outputs\\?q=&offset=70&limit=10&sort=recency$',
  fail: {
    status: 500,
    body: '{"message":"Internal Server Error"}',
    contentType: 'application/json',
  },
}

test.describe('V35 1440', () => {
  test.use({ viewport: viewportOf(1440) })

  test(`T-801 c1 @P1 ${label('V35 outputs error', 1440)}`, async ({
    page,
    p2Env,
  }) => {
    const rule = await stubControl(p2Env, 'POST', '/rules', E13_ERROR_RULE)
    try {
      await setFixedTime(page)
      await open(page, '/data-providers/86/?offset=70')
      await expect(
        page.getByText(
          'An error occured. Try to reload the page in a bit or contact us.'
        )
      ).toBeVisible()
      // the total is empty, the placeholder names "undefined"
      await expect(page.getByText(/^\s*research outputs found$/)).toBeVisible()
      await expect(
        page.getByPlaceholder(/^Search over undefined research outputs in /)
      ).toBeVisible()
      await expect(page.getByText('Showing 71-80 of a lot of')).toBeVisible()
      await capture(page, 'V35-error-1440.png')
    } finally {
      await stubControl(
        p2Env,
        'DELETE',
        `/rules?id=${encodeURIComponent(rule.id)}`
      )
    }
  })

  test(`T-801 c1 @P1 ${label('V35 offset past the total', 1440)}`, async ({
    page,
  }) => {
    await setFixedTime(page)
    await open(page, '/data-providers/86/?offset=90')
    await expect(page.getByText('Showing 91-100 of 95')).toBeVisible()
    await capture(page, 'V35-offset-past-total-1440.png')
  })

  test(`T-801 c1 @P1 ${label('V35 offset not a number', 1440)}`, async ({
    page,
  }) => {
    await setFixedTime(page)
    await open(page, '/data-providers/86/?offset=abc')
    await expect(
      page.getByText('Showing a lot of-a lot of of 95')
    ).toBeVisible()
    await capture(page, 'V35-offset-abc-1440.png')
  })
})

// ---------- V37: data providers: clusters, Load more, popup, add form (1440, 375; engine subset) ----------
// the list with the Leaflet map of marker clusters (the stub tiles are one fixed 256 px PNG); "Load more"
// (size 10 -> 20, the scroll position is kept); a marker popup (its link has target _blank); the add form under
// zero results (?q=zzzzqqq) with the states of E16 (the typed URL selects the answer: the fixtures
// e16-claim-form): the invalid text, progress (the answer held back), success, duplicate (409 with a JSON
// message), error (500); and the form under a list of results (?action=ADD).

const E16 = 'https://api.core.ac.uk/internal/data-providers'

for (const w of [1440, 375])
  test.describe(`V37 ${w}`, () => {
    test.use({ viewport: viewportOf(w) })

    const openList = async (page, path = '/data-providers/') => {
      await setFixedTime(page)
      return open(page, path, { bar: /^Search data providers$/ })
    }

    test(`T-801 c1 @P1${engines(w)} ${label('V37 clusters', w)}`, async ({
      page,
    }) => {
      await openList(page)
      await expect(page.locator('.marker-cluster').first()).toBeVisible()
      await capture(page, `V37-clusters-${w}.png`)
    })

    test(`T-801 c1 @P1${engines(w)} ${label('V37 Load more', w)}`, async ({
      page,
    }) => {
      const { tracker } = await openList(page)
      await page.getByRole('button', { name: 'Load more' }).click()
      await expect(page).toHaveURL(/size=20/)
      await settleAfter(page, tracker)
      await expect(page.getByText('Showing 1-20 of 15,672')).toBeVisible()
      await capture(page, `V37-load-more-${w}.png`)
    })

    test(`T-801 c1 @P1${engines(w)} ${label('V37 marker popup', w)}`, async ({
      page,
    }) => {
      await openList(page)
      // a single provider marker (the clusters carry their count)
      const marker = page
        .locator('.leaflet-marker-icon:not(.marker-cluster)')
        .first()
      await marker.click()
      const popup = page.locator('.leaflet-popup')
      await expect(popup).toBeVisible()
      await expect(popup.getByRole('link')).toHaveAttribute('target', '_blank')
      await capture(page, `V37-popup-${w}.png`)
    })

    test(`T-801 c1 @P1${engines(w)} ${label(
      'V37 add form states',
      w
    )}`, async ({ page, guardLog }) => {
      // the 409 and the 500 answers each make the browser log a failed resource (declared and asserted below)
      expectGuard('console')
      // the held answer of the "progress" state: E16 of created.example.org waits until released
      let release
      const held = new Promise((resolve) => {
        release = resolve
      })
      let seen = 0
      await page.route(
        (u) => u.href === E16,
        async (route) => {
          if (
            route.request().method() === 'POST' &&
            route.request().postData() ===
              '{"uri":"https://created.example.org/"}'
          ) {
            seen += 1
            await held
          }
          await route.fallback()
        }
      )
      try {
        const { tracker } = await openList(page, '/data-providers/?q=zzzzqqq')
        await expect(
          page.getByText('Suggest a new data provider')
        ).toBeVisible()
        const field = page.getByLabel('Data provider URL')
        const s = shots(page)
        await s.take(`V37-form-empty-${w}.png`)
        // text that is not a URL: no request, the helper text stays. The debounced effect (500 ms) asks the
        // input to report its validity: the browser focuses it and shows its own validation bubble ("Please
        // enter a URL."), a piece of browser UI that comes and goes by itself. The call is awaited (a spy
        // that keeps the native behaviour), then the input is blurred, which dismisses the bubble, so the shot
        // is the page state after the report, never a frame of the bubble.
        await page.evaluate(() => {
          const native = HTMLInputElement.prototype.reportValidity
          window.__p107reports = 0
          HTMLInputElement.prototype.reportValidity = function reportValidity(
            ...args
          ) {
            window.__p107reports += 1
            return native.apply(this, args)
          }
        })
        await field.fill('not a url')
        await expect
          .poll(() => page.evaluate(() => window.__p107reports), {
            timeout: 60000,
          })
          .toBe(1)
        await page.evaluate(() => document.activeElement.blur())
        await settleAfter(page, tracker)
        await s.take(`V37-form-invalid-${w}.png`)
        // progress: the debounced retrieve (500 ms) sent the POST, its answer is held
        await field.fill('https://created.example.org/')
        await expect.poll(() => seen, { timeout: 60000 }).toBe(1)
        await s.take(`V37-form-progress-${w}.png`, { loaders: false })
        release()
        await expect(
          page.getByText(
            'We found Example Repository under the entered address'
          )
        ).toBeVisible()
        await settleAfter(page, tracker)
        await s.take(`V37-form-success-${w}.png`)
        // duplicate: 409 with a JSON message naming the existing provider
        await field.fill('https://duplicate.example.org/')
        await expect(
          page.getByText('is our data provider already.')
        ).toBeVisible()
        await settleAfter(page, tracker)
        await s.take(`V37-form-duplicate-${w}.png`)
        // error: 500
        await field.fill('https://broken.example.org/')
        await expect(
          page.getByText(
            'We cannot detect a repository or a journal at this address.'
          )
        ).toBeVisible()
        await settleAfter(page, tracker)
        await s.take(`V37-form-error-${w}.png`)
        expect(consoleTexts(guardLog)).toEqual([CONSOLE_409, CONSOLE_500])
        s.done()
      } finally {
        release()
      }
    })

    test(`T-801 c1 @P1${engines(w)} ${label(
      'V37 add form under results',
      w
    )}`, async ({ page }) => {
      await openList(page, '/data-providers/?action=ADD')
      await expect(page.getByText('Suggest a new data provider')).toBeVisible()
      await expect(page.locator('.marker-cluster').first()).toBeVisible()
      await capture(page, `V37-form-with-results-${w}.png`)
    })
  })

// ---------- V39: KaTeX, long title, 30 authors (1440, 375; Q-097) ----------
// work 1005: a 300-character title with $x^2$ (KaTeX) and a literal **x** (MathMarkdown renders KaTeX only, so
// the asterisks stay); work 1003: 30 authors, collapsed ("+28 more") and expanded

for (const w of [1440, 375])
  test.describe(`V39 ${w}`, () => {
    test.use({ viewport: viewportOf(w) })

    test(`T-801 c1 @P1 ${label(
      'V39 KaTeX and long title work 1005',
      w
    )}`, async ({ page }) => {
      await setFixedTime(page)
      await open(page, '/works/1005/')
      const h1 = page.locator('h1')
      await expect(h1.locator('.katex').first()).toBeVisible()
      // Q-097: the literal ** stays in the text
      await expect(h1).toContainText('a literal **x**')
      await capture(page, `V39-works-1005-${w}.png`)
    })

    test(`T-801 c1 @P1 ${label('V39 30 authors work 1003', w)}`, async ({
      page,
    }) => {
      const { tracker } = await (async () => {
        await setFixedTime(page)
        return open(page, '/works/1003/')
      })()
      const more = page.getByRole('button', { name: '+28 more' })
      await expect(more).toBeVisible()
      const s = shots(page)
      await s.take(`V39-works-1003-collapsed-${w}.png`)
      await more.click()
      await expect(more).toBeHidden()
      await settleAfter(page, tracker)
      await s.take(`V39-works-1003-expanded-${w}.png`)
      s.done()
    })
  })
