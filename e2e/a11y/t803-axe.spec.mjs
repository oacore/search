// T-803 (41 I; Q-054, Q-089): the axe baseline of the states of findings/07 §6. The app is not clean today, so
// the gate is the violation SET: one JSON document per state (rule id, impact, node targets with the CSS-module
// hashes stripped) in e2e/a11y/t803-axe.spec.mjs-snapshots/, written in record mode (`npm run e2e:record --
// --project chromium e2e/a11y/t803-axe.spec.mjs`, golden build, host baseline) and compared otherwise; a new or
// a vanished violation fails (zero violations is not the gate).
//   c1 the states of 07 §6 (R2 results default, facet open, sort open, CSV modal, mobile Filters; R2 empty and
//      error; R3/R4 full, Cite, each Report step, OAI modal; R5 full and error; R6 full, suggestions, no results
//      with the form states; R7 full and the provider search focused; R8/R9 the 404 and "Uh-oh" pages; global: the
//      header menu, the hamburger, the cookie popup, the 500 page). Claim modals of R7 are unreachable (Q-061:
//      ClaimModal is never activated), so there is no state for them;
//   c2 the JSON includes Q-089, the duplicate DOM ids: a second run of the page enables the three duplicate-id
//      rules (axe reports the ids that ARIA refers to as results to review, not as violations), and the JSON
//      lists each duplicated id with its count (`about-title` twice on every page, `author` N times on works
//      and outputs, `data-provider-webpage-title` N times on /data-providers/);
//   c3 the comparison: a violation that is new or that vanished fails (known answers), and the baseline holds
//      exactly the states above.
// Q-054 is what the baselines record: no `<html lang>`, `div role="presentation"` pills, toasts without
// `aria-live`. Reduced motion is on, so the cookie popup fade and the tooltips are at rest when axe reads them.
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
} from '../lib/P1-07/page.mjs'
import {
  RECORD,
  runAxe,
  summarise,
  baselinePath,
  writeBaseline,
  readBaseline,
  baselineFiles,
  diffViolations,
  identical,
  describeDiff,
  normaliseTarget,
} from '../lib/P1-07/axe.mjs'
import {
  filtersToggle,
  pillHead,
  openFacetBoxes,
  downloadButton,
  sortBox,
  sortMenu,
  csvTitle,
} from '../lib/P0-17/locators.mjs'
import path from 'node:path'

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

// the state ids of this file; c3 checks the baseline folder against them
const STATES = [
  'r2-results',
  'r2-facet-open',
  'r2-sort-open',
  'r2-csv-modal',
  'r2-filters-mobile',
  'r2-empty',
  'r2-error',
  'r2-error-card',
  'r3-works',
  'r3-works-many-authors',
  'r4-output',
  'r4-cite-modal',
  'r4-report-type',
  'r4-report-form',
  'r4-report-success',
  'r4-oai-modal',
  'r5-update',
  'r5-update-error',
  'r6-providers',
  'r6-suggestions',
  'r6-no-results',
  'r6-form-success',
  'r6-form-duplicate',
  'r6-form-error',
  'r7-provider',
  'r7-provider-search-focused',
  'r8-not-found',
  'r9-uh-oh',
  'g-header-menu',
  'g-hamburger',
  'g-cookie-popup',
  'g-500',
]

// run axe on the page as it is, then write (record mode) or compare the state's baseline
async function check(page, id, route, viewport) {
  const results = await runAxe(page)
  const summary = summarise(results, {
    id,
    route,
    viewport: `${viewport.width}x${viewport.height}`,
  })
  const file = baselinePath(id)
  test.info().annotations.push({
    type: 'axe',
    description: `${id}: ${
      summary.violations.length
    } rules, ${summary.violations.reduce(
      (n, v) => n + v.nodes.length,
      0
    )} nodes, ${summary.duplicateIds.length} duplicated ids`,
  })
  if (RECORD) {
    writeBaseline(file, summary)
    return summary
  }
  const baseline = readBaseline(file)
  expect(
    baseline,
    `baseline ${path.relative(
      process.cwd(),
      file
    )} (record it with npm run e2e:record)`
  ).not.toBeNull()
  const d = diffViolations(baseline, summary)
  expect(identical(d), describeDiff(id, d)).toBe(true)
  // everything else in the document: route, viewport, tool version, tag set
  expect(summary).toEqual(baseline)
  return summary
}

// a search page, settled: hydrated, the header search bar, the filters loaded (six pills)
const openResults = async (page, route) => {
  await setFixedTime(page)
  const r = await open(page, route, { bar: true, filters: true })
  await expect(page.locator('[class*="bar-item-wrapper__"]')).toHaveCount(6)
  return r
}

// ---------- c1: R2 results ----------

test.describe('T-803 R2 desktop', () => {
  test.use({ viewport: DESKTOP })

  test('T-803 c1 @P1 axe R2 results default', async ({ page }) => {
    await openResults(page, CLIMATE)
    await check(page, 'r2-results', CLIMATE, DESKTOP)
  })

  test('T-803 c1 @P1 axe R2 facet open', async ({ page }) => {
    await openResults(page, CLIMATE)
    await pillHead(page, 'field').click()
    await expect(openFacetBoxes(page)).toHaveCount(1)
    await check(page, 'r2-facet-open', CLIMATE, DESKTOP)
  })

  test('T-803 c1 @P1 axe R2 sort menu open', async ({ page }) => {
    await openResults(page, CLIMATE)
    await sortBox(page).click()
    await expect(sortMenu(page)).toBeVisible()
    await check(page, 'r2-sort-open', CLIMATE, DESKTOP)
  })

  test('T-803 c1 @P1 axe R2 CSV modal open', async ({ page }) => {
    await openResults(page, CLIMATE)
    await downloadButton(page).click()
    await expect(csvTitle(page)).toBeVisible()
    await check(page, 'r2-csv-modal', CLIMATE, DESKTOP)
  })

  test('T-803 c1 @P1 axe R2 empty results', async ({ page }) => {
    await setFixedTime(page)
    await open(page, '/search/?q=zzzzqqq', { bar: true })
    await expect(
      page.getByRole('heading', {
        name: 'Sorry, we couldn’t find any results for “zzzzqqq”.',
      })
    ).toBeVisible()
    await check(page, 'r2-empty', '/search/?q=zzzzqqq', DESKTOP)
  })

  test('T-803 c1 @P1 axe R2 error (the search ErrorCard)', async ({ page }) => {
    await setFixedTime(page)
    await open(page, '/search/?q=__status500')
    await expect(
      page.getByText('This page is not available now.')
    ).toBeVisible()
    await check(page, 'r2-error', '/search/?q=__status500', DESKTOP)
  })

  test('T-803 c1 @P1 axe R2 error card page', async ({ page, p2Env }) => {
    // not routed by the gateway (Q-005): the allow-all listener serves it
    await setFixedTime(page)
    await open(page, new URL('/error-card/', p2Env.allowURL).href)
    await expect(
      page.getByText('This page is not available now.')
    ).toBeVisible()
    await check(page, 'r2-error-card', '/error-card/', DESKTOP)
  })
})

test.describe('T-803 R2 mobile', () => {
  test.use({ viewport: MOBILE })
  test('T-803 c1 @P1 axe R2 mobile Filters open', async ({ page }) => {
    await openResults(page, CLIMATE)
    await filtersToggle(page).click()
    await expect(pillHead(page, 'field')).toBeVisible()
    await check(page, 'r2-filters-mobile', CLIMATE, MOBILE)
  })
})

// ---------- c1: R3, R4 works and outputs ----------

const modalOf = (page, name) => page.locator(`[aria-label="${name}"]`).first()

test.describe('T-803 R3 R4 desktop', () => {
  test.use({ viewport: DESKTOP })

  test('T-803 c1 @P1 axe R3 works full', async ({ page }) => {
    await setFixedTime(page)
    await open(page, '/works/1001/')
    await check(page, 'r3-works', '/works/1001/', DESKTOP)
  })

  test('T-803 c1 @P1 axe R3 works with 30 authors', async ({ page }) => {
    await setFixedTime(page)
    await open(page, '/works/1003/')
    await check(page, 'r3-works-many-authors', '/works/1003/', DESKTOP)
  })

  test('T-803 c1 @P1 axe R4 output full', async ({ page }) => {
    await setFixedTime(page)
    await open(page, '/outputs/2001/')
    await check(page, 'r4-output', '/outputs/2001/', DESKTOP)
  })

  test('T-803 c1 @P1 axe R4 Cite modal open', async ({ page }) => {
    await setFixedTime(page)
    await open(page, '/outputs/2001/')
    await page.getByRole('button', { name: 'Cite' }).click()
    await expect(page.getByRole('heading', { name: 'Citation' })).toBeVisible()
    await check(page, 'r4-cite-modal', '/outputs/2001/', DESKTOP)
  })

  test('T-803 c1 @P1 axe R4 Report modals, each step', async ({ page }) => {
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

  test('T-803 c1 @P1 axe R4 OAI modal', async ({ page }) => {
    await setFixedTime(page)
    await open(page, '/outputs/2001/?source=oai')
    await expect(
      page.getByRole('heading', { name: 'Repository landing page' })
    ).toBeVisible()
    await check(page, 'r4-oai-modal', '/outputs/2001/?source=oai', DESKTOP)
  })
})

// ---------- c1: R5 takedown request ----------

test.describe('T-803 R5 desktop', () => {
  test.use({ viewport: DESKTOP })

  test('T-803 c1 @P1 axe R5 takedown request full', async ({ page }) => {
    await setFixedTime(page)
    await open(page, '/outputs/update/')
    await expect(page.getByText('Article Takedown Request')).toBeVisible()
    await check(page, 'r5-update', '/outputs/update/', DESKTOP)
  })

  test('T-803 c1 @P1 axe R5 takedown request error state', async ({ page }) => {
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

test.describe('T-803 R6 desktop', () => {
  test.use({ viewport: DESKTOP })

  test('T-803 c1 @P1 axe R6 data providers full', async ({ page }) => {
    await setFixedTime(page)
    await open(page, '/data-providers/', { bar: SEARCH_PROVIDERS })
    await check(page, 'r6-providers', '/data-providers/', DESKTOP)
  })

  test('T-803 c1 @P1 axe R6 suggestions open', async ({ page }) => {
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

  test('T-803 c1 @P1 axe R6 no results and the add form', async ({ page }) => {
    await setFixedTime(page)
    await open(page, '/data-providers/?q=zzzzqqq', { bar: SEARCH_PROVIDERS })
    await expect(page.getByText('Suggest a new data provider')).toBeVisible()
    await check(page, 'r6-no-results', '/data-providers/?q=zzzzqqq', DESKTOP)
  })

  test('T-803 c1 @P1 axe R6 add form states', async ({ page, guardLog }) => {
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

test.describe('T-803 R7 desktop', () => {
  test.use({ viewport: DESKTOP })

  test('T-803 c1 @P1 axe R7 provider page full', async ({ page }) => {
    await setFixedTime(page)
    await open(page, '/data-providers/86/')
    await check(page, 'r7-provider', '/data-providers/86/', DESKTOP)
  })

  test('T-803 c1 @P1 axe R7 provider search focused', async ({ page }) => {
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

test.describe('T-803 R8 R9 desktop', () => {
  test.use({ viewport: DESKTOP })

  test('T-803 c1 @P1 axe R8 the 404 page', async ({ page, guardLog }) => {
    // the 404 document is a failed resource for Chromium: one console error
    expectGuard('console')
    await setFixedTime(page)
    const { response } = await open(page, '/works/')
    expect(response.status()).toBe(404)
    await expect(page.getByRole('heading', { name: 'Uh-oh' })).toBeVisible()
    expect(consoleTexts(guardLog)).toEqual([NOT_FOUND])
    await check(page, 'r8-not-found', '/works/', DESKTOP)
  })

  test('T-803 c1 @P1 axe R9 the Uh-oh page of a missing work', async ({
    page,
  }) => {
    await setFixedTime(page)
    await open(page, '/works/4040/')
    await expect(page.getByRole('heading', { name: 'Uh-oh' })).toBeVisible()
    await check(page, 'r9-uh-oh', '/works/4040/', DESKTOP)
  })
})

// ---------- c1: global: header, cookie popup, 500 page ----------

test.describe('T-803 global desktop', () => {
  test.use({ viewport: DESKTOP })

  test('T-803 c1 @P1 axe global header menu open', async ({ page }) => {
    await setFixedTime(page)
    await open(page, '/outputs/update/')
    await menuButton(page, 'Services').click()
    await expect(menuButton(page, 'Services')).toHaveAttribute(
      'aria-expanded',
      'true'
    )
    await check(page, 'g-header-menu', '/outputs/update/', DESKTOP)
  })

  test('T-803 c1 @P1 axe global 500 page', async ({ page, guardLog }) => {
    expectGuard('console')
    await setFixedTime(page)
    // W-nodp; W-emptydate (6948813) renders with 200 since the owner fix 978c6e4
    const { response } = await open(page, '/works/4200/')
    expect(response.status()).toBe(500)
    await expect(
      page.getByText('An unexpected error has occurred.')
    ).toBeVisible()
    expect(consoleTexts(guardLog)).toEqual([CONSOLE_500]) // AD-114, AD-230
    await check(page, 'g-500', '/works/4200/', DESKTOP)
  })

  test.describe('first visit', () => {
    test.use({ cookieState: 'absent' })
    test('T-803 c1 @P1 axe global cookie popup', async ({ page }) => {
      await setFixedTime(page)
      await open(page, '/outputs/update/')
      await expect(
        page.getByText('We use cookies to improve our website.')
      ).toBeVisible()
      await check(page, 'g-cookie-popup', '/outputs/update/', DESKTOP)
    })
  })
})

test.describe('T-803 global mobile', () => {
  test.use({ viewport: MOBILE })
  test('T-803 c1 @P1 axe global hamburger open', async ({ page }) => {
    await setFixedTime(page)
    await open(page, '/outputs/update/')
    await hamburger(page).click()
    await expect(hamburger(page)).toHaveAttribute('aria-expanded', 'true')
    await check(page, 'g-hamburger', '/outputs/update/', MOBILE)
  })
})

// ---------- c2: Q-089, duplicate DOM ids in the JSON ----------
// The duplicates of each page, read from the DOM, and the same ids in the axe JSON: the `duplicate-id` rule
// lists each duplicated id once (the node is the first element that carries it). Compare mode also reads the
// baseline document of the state.

const DUPLICATES = [
  {
    id: 'r3-works-many-authors',
    route: '/works/1003/',
    ids: { 'about-title': 2, 'author': 30, 'doi': 2 },
  },
  {
    id: 'r4-output',
    route: '/outputs/2001/',
    ids: { 'about-title': 2, 'author': 4, 'full-text-thumbnail-2001-body': 2 },
  },
  {
    id: 'r6-providers',
    route: '/data-providers/',
    ids: { 'about-title': 2, 'data-provider-webpage-title': 10 },
    bar: SEARCH_PROVIDERS,
  },
  { id: 'r5-update', route: '/outputs/update/', ids: { 'about-title': 2 } },
]

const duplicateIds = (page) =>
  page.evaluate(() => {
    const count = {}
    for (const el of document.querySelectorAll('[id]'))
      count[el.id] = (count[el.id] || 0) + 1
    return Object.fromEntries(
      Object.entries(count)
        .filter(([, n]) => n > 1)
        .sort(([a], [b]) => a.localeCompare(b))
    )
  })

test.describe('T-803 c2 desktop', () => {
  test.use({ viewport: DESKTOP })

  for (const d of DUPLICATES)
    test(`T-803 c2 @P1 Q-089 duplicate ids of ${d.id} are in the JSON`, async ({
      page,
    }) => {
      await setFixedTime(page)
      await open(page, d.route, d.bar ? { bar: d.bar } : {})
      expect(await duplicateIds(page)).toEqual(d.ids)
      const summary = summarise(await runAxe(page), {
        id: d.id,
        route: d.route,
        viewport: '1440x900',
      })
      // every duplicated id of the DOM is in the JSON with its count, whichever rule or outcome reports it
      const listed = (s) =>
        Object.fromEntries(s.duplicateIds.map((e) => [e.id, e.count]))
      expect(listed(summary)).toEqual(d.ids)
      for (const e of summary.duplicateIds)
        expect(e.target.length, `${e.id} has a target`).toBeGreaterThan(0)
      if (RECORD) return
      // the committed baseline document of the state lists the same duplicated ids
      const baseline = readBaseline(baselinePath(d.id))
      expect(baseline, `baseline of ${d.id}`).not.toBeNull()
      expect(baseline.duplicateIds).toEqual(summary.duplicateIds)
    })
})

// ---------- c3: the comparison ----------

const synth = (violations, duplicateIds = []) => ({ violations, duplicateIds })
const dupEntry = (id, count, rule = 'duplicate-id-aria') => ({
  rule,
  outcome: 'incomplete',
  id,
  count,
  target: [`#${id}`],
})
const violation = (id, targets, impact = 'serious') => ({
  id,
  impact,
  nodes: targets.map((t) => ({ target: [t] })),
})

test.describe('T-803 c3', () => {
  test('T-803 c3 @P1 a new or a vanished violation fails (known answers)', async () => {
    const base = synth([
      violation('label', ['#a', '#b']),
      violation('duplicate-id', ['#about-title'], 'minor'),
    ])
    // identical: passes
    expect(identical(diffViolations(base, structuredClone(base)))).toBe(true)
    // a new rule
    let d = diffViolations(
      base,
      synth([...base.violations, violation('region', ['body'])])
    )
    expect(d.added).toEqual(['region | body'])
    expect(identical(d)).toBe(false)
    // a new node of a known rule
    d = diffViolations(
      base,
      synth([violation('label', ['#a', '#b', '#c']), base.violations[1]])
    )
    expect(d.added).toEqual(['label | #c'])
    // a vanished node and a vanished rule
    d = diffViolations(base, synth([violation('label', ['#a'])]))
    expect(d.vanished).toEqual(['duplicate-id | #about-title', 'label | #b'])
    expect(d.added).toEqual([])
    // a node that is listed twice counts twice (a duplicate id found one more time)
    d = diffViolations(
      synth([violation('label', ['#a'])]),
      synth([violation('label', ['#a', '#a'])])
    )
    expect(d.added).toEqual(['label | #a'])
    // an impact that changed
    d = diffViolations(
      base,
      synth([violation('label', ['#a', '#b'], 'critical'), base.violations[1]])
    )
    expect(d.impact).toEqual(['label: serious -> critical'])
    expect(identical(d)).toBe(false)
    // a duplicated id is part of the set: one more occurrence, a new id and a vanished id all differ
    const dupBase = synth(
      [],
      [dupEntry('about-title', 2), dupEntry('author', 6)]
    )
    expect(identical(diffViolations(dupBase, structuredClone(dupBase)))).toBe(
      true
    )
    d = diffViolations(
      dupBase,
      synth([], [dupEntry('about-title', 2), dupEntry('author', 7)])
    )
    expect(d.added).toEqual([
      'duplicate-id-aria incomplete | #author x7 | #author',
    ])
    expect(d.vanished).toEqual([
      'duplicate-id-aria incomplete | #author x6 | #author',
    ])
    d = diffViolations(dupBase, synth([], [dupEntry('about-title', 2)]))
    expect(d.vanished).toEqual([
      'duplicate-id-aria incomplete | #author x6 | #author',
    ])
    expect(d.added).toEqual([])
    // the class hash is not part of a target
    expect(normaliseTarget('.styles_item__2bRFx > .button-button-3fr3r')).toBe(
      '.styles_item > .button-button'
    )
    expect(normaliseTarget('.leaflet-container')).toBe('.leaflet-container')
    // the attribute selectors of one compound selector are in a fixed order
    expect(normaliseTarget('.a[role="button"][aria-haspopup="true"]')).toBe(
      normaliseTarget('.a[aria-haspopup="true"][role="button"]')
    )
  })

  test('T-803 c3 @P1 the baseline folder holds every state of c1 and no other', async () => {
    if (RECORD) return
    const dir = path.dirname(baselinePath('x'))
    const have = baselineFiles(dir).map(([id]) => id)
    expect(have).toEqual([...STATES].sort((a, b) => a.localeCompare(b)))
    // every document has the shape the comparison reads
    for (const [id, file] of baselineFiles(dir)) {
      const doc = readBaseline(file)
      expect(doc.state, file).toBe(id)
      expect(Array.isArray(doc.violations), file).toBe(true)
      for (const v of doc.violations) {
        expect(typeof v.id).toBe('string')
        expect(v.nodes.length).toBeGreaterThan(0)
      }
    }
  })
})
