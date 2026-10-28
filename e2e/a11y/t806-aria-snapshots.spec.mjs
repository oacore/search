// T-806 (41 I; `toMatchAriaSnapshot` per page and state; R-075, R-087; Q-054): the ARIA tree of every page and
// state of the T-803 set (findings/07 §6: R2 results default, facet open, sort open, CSV modal, mobile Filters;
// R2 empty, error and the error card page; R3/R4 full, Cite, each Report step, OAI modal; R5 full and error; R6
// full, suggestions, no results with the form states; R7 full and the provider search focused; R8/R9 the 404 and
// "Uh-oh" pages; global: the header menu, the hamburger, the cookie popup, the 500 page), as the app renders it
// today, a11y debt included (Q-054). Claim modals of R7 are unreachable (Q-061), so there is no state for them.
// The snapshot is Playwright's own `locator('body').ariaSnapshot()` (the tree `toMatchAriaSnapshot` matches
// against), with the stack origins written as `http://<stack>` (the port depends on the run's slot). The gate is
// identity (55 GATE-x.3: T-806 identical): the text must equal the baseline exactly, because the matcher's
// template matching would accept extra children and its generated templates turn numbers into regular
// expressions. One `<state>.aria.yml` per state in e2e/a11y/t806-aria-snapshots.spec.mjs-snapshots/, written in
// record mode (`npm run e2e:record -- --run <id> --provisional --project chromium
// e2e/a11y/t806-aria-snapshots.spec.mjs`, host baseline) and compared otherwise; a missing baseline fails.
// Reduced motion is on, so the cookie popup fade and the tooltips are at rest when the tree is read.
import fs from 'node:fs'
import path from 'node:path'
import {
  test,
  expect,
  open,
  setFixedTime,
  settleAfter,
  hamburger,
  menuButton,
  consoleTexts,
  expectGuard,
  CONSOLE_409,
  CONSOLE_500,
  CONSOLE_500_PAGE,
} from '../lib/P1-07/page.mjs'
import {
  filtersToggle,
  pillHead,
  openFacetBoxes,
  downloadButton,
  sortBox,
  sortMenu,
  csvTitle,
} from '../lib/P0-17/locators.mjs'
import { recordMode } from '../lib/P1-06/baseline.mjs'

test.use({
  cookieState: 'essential',
  reducedMotion: 'reduce',
  actionTimeout: 60000,
})
test.describe.configure({ timeout: 600000 })

const DESKTOP = { width: 1440, height: 900 }
const MOBILE = { width: 375, height: 812 }
const CLIMATE = '/search/?q=climate'
const NOT_FOUND =
  'Failed to load resource: the server responded with a status of 404 (Not Found)'

// the ARIA tree of the page as it is, with a header line naming the state, then written (record mode) or
// compared with the state's baseline, exactly
async function check(page, id, route, viewport) {
  const tree = (await page.locator('body').ariaSnapshot()).replace(
    /http:\/\/(127\.0\.0\.1|localhost):\d+/g,
    'http://<stack>'
  )
  const text = `# ${id} ${route} ${viewport.width}x${viewport.height}\n${tree}\n`
  const info = test.info()
  const file = info.snapshotPath(`${id}.aria.yml`)
  if (recordMode(info)) {
    fs.mkdirSync(path.dirname(file), { recursive: true })
    fs.writeFileSync(file, text)
    info.annotations.push({
      type: 'baseline',
      description: `recorded ${path.basename(file)}`,
    })
    return
  }
  expect(
    fs.existsSync(file),
    `baseline ${path.relative(
      process.cwd(),
      file
    )} (record it with npm run e2e:record)`
  ).toBe(true)
  expect(text).toBe(fs.readFileSync(file, 'utf8'))
}

// a search page, settled: hydrated, the header search bar, the filters loaded (six pills)
const openResults = async (page, route) => {
  await setFixedTime(page)
  const r = await open(page, route, { bar: true, filters: true })
  await expect(page.locator('[class*="bar-item-wrapper__"]')).toHaveCount(6)
  return r
}

// ---------- c1: R2 results ----------

test.describe('T-806 R2 desktop', () => {
  test.use({ viewport: DESKTOP })

  test('T-806 @P1 ARIA R2 results default', async ({ page }) => {
    await openResults(page, CLIMATE)
    await check(page, 'r2-results', CLIMATE, DESKTOP)
  })

  test('T-806 @P1 ARIA R2 facet open', async ({ page }) => {
    await openResults(page, CLIMATE)
    await pillHead(page, 'field').click()
    await expect(openFacetBoxes(page)).toHaveCount(1)
    await check(page, 'r2-facet-open', CLIMATE, DESKTOP)
  })

  test('T-806 @P1 ARIA R2 sort menu open', async ({ page }) => {
    await openResults(page, CLIMATE)
    await sortBox(page).click()
    await expect(sortMenu(page)).toBeVisible()
    await check(page, 'r2-sort-open', CLIMATE, DESKTOP)
  })

  test('T-806 @P1 ARIA R2 CSV modal open', async ({ page }) => {
    await openResults(page, CLIMATE)
    await downloadButton(page).click()
    await expect(csvTitle(page)).toBeVisible()
    await check(page, 'r2-csv-modal', CLIMATE, DESKTOP)
  })

  test('T-806 @P1 ARIA R2 empty results', async ({ page }) => {
    await setFixedTime(page)
    await open(page, '/search/?q=zzzzqqq', { bar: true })
    await expect(
      page.getByRole('heading', {
        name: 'Sorry, we couldn’t find any results for “zzzzqqq”.',
      })
    ).toBeVisible()
    await check(page, 'r2-empty', '/search/?q=zzzzqqq', DESKTOP)
  })

  test('T-806 @P1 ARIA R2 error (the search ErrorCard)', async ({ page }) => {
    await setFixedTime(page)
    await open(page, '/search/?q=__status500')
    await expect(
      page.getByText('This page is not available now.')
    ).toBeVisible()
    await check(page, 'r2-error', '/search/?q=__status500', DESKTOP)
  })

  test('T-806 @P1 ARIA R2 error card page', async ({ page, p2Env }) => {
    // not routed by the gateway (Q-005): the allow-all listener serves it
    await setFixedTime(page)
    await open(page, new URL('/error-card/', p2Env.allowURL).href)
    await expect(
      page.getByText('This page is not available now.')
    ).toBeVisible()
    await check(page, 'r2-error-card', '/error-card/', DESKTOP)
  })
})

test.describe('T-806 R2 mobile', () => {
  test.use({ viewport: MOBILE })
  test('T-806 @P1 ARIA R2 mobile Filters open', async ({ page }) => {
    await openResults(page, CLIMATE)
    await filtersToggle(page).click()
    await expect(pillHead(page, 'field')).toBeVisible()
    await check(page, 'r2-filters-mobile', CLIMATE, MOBILE)
  })
})

// ---------- c1: R3, R4 works and outputs ----------

const modalOf = (page, name) => page.locator(`[aria-label="${name}"]`).first()

test.describe('T-806 R3 R4 desktop', () => {
  test.use({ viewport: DESKTOP })

  test('T-806 @P1 ARIA R3 works full', async ({ page }) => {
    await setFixedTime(page)
    await open(page, '/works/1001/')
    await check(page, 'r3-works', '/works/1001/', DESKTOP)
  })

  test('T-806 @P1 ARIA R3 works with 30 authors', async ({ page }) => {
    await setFixedTime(page)
    await open(page, '/works/1003/')
    await check(page, 'r3-works-many-authors', '/works/1003/', DESKTOP)
  })

  test('T-806 @P1 ARIA R4 output full', async ({ page }) => {
    await setFixedTime(page)
    await open(page, '/outputs/2001/')
    await check(page, 'r4-output', '/outputs/2001/', DESKTOP)
  })

  test('T-806 @P1 ARIA R4 Cite modal open', async ({ page }) => {
    await setFixedTime(page)
    await open(page, '/outputs/2001/')
    await page.getByRole('button', { name: 'Cite' }).click()
    await expect(page.getByRole('heading', { name: 'Citation' })).toBeVisible()
    await check(page, 'r4-cite-modal', '/outputs/2001/', DESKTOP)
  })

  test('T-806 @P1 ARIA R4 Report modals, each step', async ({ page }) => {
    await setFixedTime(page)
    await open(page, '/outputs/2001/')
    await page.getByRole('button', { name: 'Report', exact: true }).click()
    const type = modalOf(page, 'Problem-type-modal')
    await expect(type).toBeVisible()
    await check(page, 'r4-report-type', '/outputs/2001/', DESKTOP)
    await type.getByText('The document should not be published').click()
    await type.getByRole('button', { name: 'Continue' }).click()
    const form = modalOf(page, 'Problem-form-modal')
    await expect(form).toBeVisible()
    await form.getByText('Author', { exact: true }).click()
    await expect(form.locator('textarea')).toBeVisible()
    await check(page, 'r4-report-form', '/outputs/2001/', DESKTOP)
    await form.getByPlaceholder('e.g. John Doe').fill('Test Reporter')
    await form
      .getByPlaceholder('e.g. john.doe@ac.ck.uk')
      .fill('reporter@localhost')
    await form.locator('textarea').fill('report-ok')
    await form.getByRole('button', { name: 'Submit' }).click()
    await expect(
      modalOf(page, 'Success-type-modal').getByText('Thank you!')
    ).toBeVisible()
    await check(page, 'r4-report-success', '/outputs/2001/', DESKTOP)
  })

  test('T-806 @P1 ARIA R4 OAI modal', async ({ page }) => {
    await setFixedTime(page)
    await open(page, '/outputs/2001/?source=oai')
    await expect(
      page.getByRole('heading', { name: 'Repository landing page' })
    ).toBeVisible()
    await check(page, 'r4-oai-modal', '/outputs/2001/?source=oai', DESKTOP)
  })
})

// ---------- c1: R5 takedown request ----------

test.describe('T-806 R5 desktop', () => {
  test.use({ viewport: DESKTOP })

  test('T-806 @P1 ARIA R5 takedown request full', async ({ page }) => {
    await setFixedTime(page)
    await open(page, '/outputs/update/')
    await expect(page.getByText('Article Takedown Request')).toBeVisible()
    await check(page, 'r5-update', '/outputs/update/', DESKTOP)
  })

  test('T-806 @P1 ARIA R5 takedown request error state', async ({ page }) => {
    await setFixedTime(page)
    await open(page, '/outputs/update/')
    await page
      .getByPlaceholder('e.g. https://core.ac.uk/display/1')
      .fill('https://core.ac.uk/works/1')
    await page.getByRole('button', { name: 'Submit' }).click()
    await expect(page.getByText('are not accepted')).toBeVisible()
    await check(page, 'r5-update-error', '/outputs/update/', DESKTOP)
  })
})

// ---------- c1: R6 data providers ----------

const SEARCH_PROVIDERS = /^Search data providers$/

test.describe('T-806 R6 desktop', () => {
  test.use({ viewport: DESKTOP })

  test('T-806 @P1 ARIA R6 data providers full', async ({ page }) => {
    await setFixedTime(page)
    await open(page, '/data-providers/', { bar: SEARCH_PROVIDERS })
    await check(page, 'r6-providers', '/data-providers/', DESKTOP)
  })

  test('T-806 @P1 ARIA R6 suggestions open', async ({ page }) => {
    await setFixedTime(page)
    const { tracker } = await open(page, '/data-providers/', {
      bar: SEARCH_PROVIDERS,
    })
    await page.locator('label[for="select-app-bar-search"]').click()
    await page.keyboard.type('univ')
    await expect(page.getByRole('option')).toHaveCount(10)
    await settleAfter(page, tracker)
    await check(page, 'r6-suggestions', '/data-providers/', DESKTOP)
  })

  test('T-806 @P1 ARIA R6 no results and the add form', async ({ page }) => {
    await setFixedTime(page)
    await open(page, '/data-providers/?q=zzzzqqq', { bar: SEARCH_PROVIDERS })
    await expect(page.getByText('Suggest a new data provider')).toBeVisible()
    await check(page, 'r6-no-results', '/data-providers/?q=zzzzqqq', DESKTOP)
  })

  test('T-806 @P1 ARIA R6 add form states', async ({ page, guardLog }) => {
    // the 409 and the 500 answers each make the browser log a failed resource (declared and asserted below)
    expectGuard('console')
    await setFixedTime(page)
    const route = '/data-providers/?q=zzzzqqq'
    const { tracker } = await open(page, route, { bar: SEARCH_PROVIDERS })
    const field = page.getByLabel('Data provider URL')
    await field.fill('https://created.example.org/')
    await expect(
      page.getByText('We found Example Repository under the entered address')
    ).toBeVisible()
    await settleAfter(page, tracker)
    await check(page, 'r6-form-success', route, DESKTOP)
    await field.fill('https://duplicate.example.org/')
    await expect(page.getByText('is our data provider already.')).toBeVisible()
    await settleAfter(page, tracker)
    await check(page, 'r6-form-duplicate', route, DESKTOP)
    await field.fill('https://broken.example.org/')
    await expect(
      page.getByText(
        'We cannot detect a repository or a journal at this address.'
      )
    ).toBeVisible()
    await settleAfter(page, tracker)
    await check(page, 'r6-form-error', route, DESKTOP)
    expect(consoleTexts(guardLog)).toEqual([CONSOLE_409, CONSOLE_500])
  })
})

// ---------- c1: R7 provider page ----------

test.describe('T-806 R7 desktop', () => {
  test.use({ viewport: DESKTOP })

  test('T-806 @P1 ARIA R7 provider page full', async ({ page }) => {
    await setFixedTime(page)
    await open(page, '/data-providers/86/')
    await check(page, 'r7-provider', '/data-providers/86/', DESKTOP)
  })

  test('T-806 @P1 ARIA R7 provider search focused', async ({ page }) => {
    await setFixedTime(page)
    await open(page, '/data-providers/86/')
    // the label overlays the input (Q-083): the click goes through the label
    await page
      .locator('label[for="select-data-providers-outputs-select"]')
      .click()
    await expect(
      page.getByPlaceholder(/^Search over .* research outputs in /)
    ).toBeFocused()
    await check(
      page,
      'r7-provider-search-focused',
      '/data-providers/86/',
      DESKTOP
    )
  })
})

// ---------- c1: R8, R9 error pages ----------

test.describe('T-806 R8 R9 desktop', () => {
  test.use({ viewport: DESKTOP })

  test('T-806 @P1 ARIA R8 the 404 page', async ({ page, guardLog }) => {
    // the 404 document is a failed resource for Chromium: one console error
    expectGuard('console')
    await setFixedTime(page)
    const { response } = await open(page, '/works/')
    expect(response.status()).toBe(404)
    await expect(page.getByRole('heading', { name: 'Uh-oh' })).toBeVisible()
    expect(consoleTexts(guardLog)).toEqual([NOT_FOUND])
    await check(page, 'r8-not-found', '/works/', DESKTOP)
  })

  test('T-806 @P1 ARIA R9 the Uh-oh page of a missing work', async ({
    page,
  }) => {
    await setFixedTime(page)
    await open(page, '/works/4040/')
    await expect(page.getByRole('heading', { name: 'Uh-oh' })).toBeVisible()
    await check(page, 'r9-uh-oh', '/works/4040/', DESKTOP)
  })
})

// ---------- c1: global: header, cookie popup, 500 page ----------

test.describe('T-806 global desktop', () => {
  test.use({ viewport: DESKTOP })

  test('T-806 @P1 ARIA global header menu open', async ({ page }) => {
    await setFixedTime(page)
    await open(page, '/outputs/update/')
    await menuButton(page, 'Services').click()
    await expect(menuButton(page, 'Services')).toHaveAttribute(
      'aria-expanded',
      'true'
    )
    await check(page, 'g-header-menu', '/outputs/update/', DESKTOP)
  })

  test('T-806 @P1 ARIA global 500 page', async ({ page, guardLog }) => {
    expectGuard('console')
    await setFixedTime(page)
    const { response } = await open(page, '/works/6948813/')
    expect(response.status()).toBe(500)
    await expect(
      page.getByText('An unexpected error has occurred.')
    ).toBeVisible()
    expect(consoleTexts(guardLog)).toEqual([CONSOLE_500, CONSOLE_500_PAGE])
    await check(page, 'g-500', '/works/6948813/', DESKTOP)
  })

  test.describe('first visit', () => {
    test.use({ cookieState: 'absent' })
    test('T-806 @P1 ARIA global cookie popup', async ({ page }) => {
      await setFixedTime(page)
      await open(page, '/outputs/update/')
      await expect(
        page.getByText('We use cookies to improve our website.')
      ).toBeVisible()
      await check(page, 'g-cookie-popup', '/outputs/update/', DESKTOP)
    })
  })
})

test.describe('T-806 global mobile', () => {
  test.use({ viewport: MOBILE })
  test('T-806 @P1 ARIA global hamburger open', async ({ page }) => {
    await setFixedTime(page)
    await open(page, '/outputs/update/')
    await hamburger(page).click()
    await expect(hamburger(page)).toHaveAttribute('aria-expanded', 'true')
    await check(page, 'g-hamburger', '/outputs/update/', MOBILE)
  })
})
