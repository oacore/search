// T-720 (41; R-026; Q-096): `securitypolicyviolation` = 0 over the journeys. The guard records every violation
// (document listener, e2e/fixtures/guard.mjs) and fails any test that has one; this spec owns the sweep:
//   - every page of the route table (e2e/lib/P0-15/routes.mjs) hard-loaded in the first-visit state (popup
//     shown) and in the fully consented state (GA loaded), with the document's CSP header present and the
//     LogRocket script request aborted by the guard AFTER the CSP check (so a policy that lost a host shows as
//     a violation or as a missing request, 40 §2.4);
//   - client navigations between pages;
//   - the in-page states of the journeys: advanced-search panel, facets and sort, a facet checkbox, pagination
//     and the sort choice (client navigations with the browser's own API calls), header menus, CSV download
//     modal, cite modals, the report chain, the takedown form, the claim chain up to its success modal, map
//     popups, the add-provider form with its answer.
// Not swept: the pages that fail on the client (the Q-074 blank pages, T-716's crashing navigations). A client
// error reports to Sentry, whose test-DSN host o0.ingest.sentry.io the CSP `connect-src ... sentry.io` does not
// cover, so it is exactly one violation (Q-096, R-026); the control at the end asserts that and proves the
// guard sees violations.
import { test, expect } from '../lib/P0-15/fixtures.mjs'
import { trackPage, settle } from '../lib/P0-15/settle.mjs'
import {
  SENTRY_STORE,
  census,
  hardLoad,
  loaded,
  routeChange,
} from '../lib/P0-15/analytics.mjs'
import { expectNoViolation } from '../lib/P0-15/sweep.mjs'
import {
  EXTRA_ROUTES,
  KATEX_ERROR,
  KATEX_ROUTE,
  SWEEP_ROUTES,
  urlOf,
} from '../lib/P0-15/routes.mjs'

// a hard load plus the settle wait can take tens of seconds on a loaded machine (40 §5: timeouts, never retries)
test.describe.configure({ timeout: 240000 })

const STATES = ['absent', 'essential+analytics']

for (const cookieState of STATES)
  test.describe(`route sweep, cookie state ${cookieState}`, () => {
    test.use({ cookieState })
    const consented = cookieState === 'essential+analytics'

    for (const route of consented
      ? [...SWEEP_ROUTES, ...EXTRA_ROUTES]
      : SWEEP_ROUTES)
      test(`T-720 @P0 ${route.id} ${cookieState}: no securitypolicyviolation on ${route.path}`, async ({
        page,
        p2Env,
        guardLog,
      }) => {
        if (route.id === KATEX_ROUTE)
          // the design MathMarkdown prints console.error for KaTeX-rejected math on this page (T-741 pin
          // katex-convert, Q-097): declared here, every error must be that message
          test
            .info()
            .annotations.push({ type: 'guard-expect', description: 'console' })
        const tracker = trackPage(page)
        const res = await page.goto(urlOf(p2Env, route))
        expect(res.status()).toBe(200)
        // the policy is on the document, so zero violations is not vacuous
        const policy = res.headers()['content-security-policy']
        expect(policy).toContain("default-src 'self'")
        expect(policy).toContain('connect-src')
        await loaded(page, tracker)
        expectNoViolation(guardLog, { consented })
        if (route.id === KATEX_ROUTE)
          expect(
            guardLog.consoleErrors.filter((e) => !KATEX_ERROR.test(e.text))
          ).toEqual([])
      })
  })

for (const cookieState of STATES)
  test.describe(`client navigation, cookie state ${cookieState}`, () => {
    test.use({ cookieState })

    test(`T-720 @P0 ${cookieState}: no securitypolicyviolation over client navigations search -> update -> provider -> directory`, async ({
      page,
      guardLog,
    }) => {
      const tracker = trackPage(page)
      await hardLoad(page, tracker, '/search/?q=climate')
      for (const target of [
        '/outputs/update/',
        '/data-providers/86/',
        '/outputs/update/',
        '/data-providers/?q=birkbeck',
      ]) {
        await routeChange(page, tracker, target)
        expect(guardLog.csp).toEqual([])
      }
      expectNoViolation(guardLog, { consented: cookieState !== 'absent' })
    })
  })

// ---------- in-page states of the journeys (fully consented state: no popup in the way, every third party on)
const DISMISSED = { consented: true }

test.describe('in-page states, cookie state essential+analytics', () => {
  test.use({ cookieState: 'essential+analytics' })

  test('T-720 @P0 J18 search: the advanced-search panel opens and a "search by" shortcut closes it', async ({
    page,
    guardLog,
  }) => {
    const tracker = trackPage(page)
    await hardLoad(page, tracker, '/search/?q=climate')
    const panelText = page.getByText('To refine your searches you can use:')
    await page.getByText('How to search?').click()
    await expect(panelText).toBeVisible()
    await page.getByRole('button', { name: 'search by doi' }).click()
    await expect(panelText).toBeHidden()
    expectNoViolation(guardLog, DISMISSED)
  })

  test('T-720 @P0 J3 search: the facet dropdowns and the sort menu open', async ({
    page,
    guardLog,
  }) => {
    const tracker = trackPage(page)
    await hardLoad(page, tracker, '/search/?q=climate')
    const bar = page.getByRole('main').getByRole('list').first()
    for (const [facet, option] of [
      ['field', 'info:eu-repo/semantics/article'],
      ['year', 'Since 2018'],
      ['type', 'thesis'],
      ['author', 'CGIAR Research Program on Climate Change'],
    ]) {
      await bar.getByRole('listitem').filter({ hasText: facet }).first().click()
      await expect(
        page.getByText(option, { exact: false }).first()
      ).toBeVisible()
    }
    // the outside click closes the facet boxes; the sort menu lists its two options
    await page.getByText('research outputs found').click()
    await page.getByText('Sort by').first().click()
    const menu = page.locator('ul[class*="sort-box-menu"] li')
    await expect(menu).toHaveText(['recent', 'relevance'])
    expectNoViolation(guardLog, DISMISSED)
  })

  test('T-720 @P0 J19 search: the three header menus open one after the other', async ({
    page,
    guardLog,
  }) => {
    const tracker = trackPage(page)
    await hardLoad(page, tracker, '/search/?q=climate')
    const nav = page.getByRole('navigation').first()
    for (const [name, href] of [
      ['Services', '/services/api'],
      ['Support us', '/membership'],
      ['About', '/about#team'],
    ]) {
      await nav.getByRole('button', { name }).click()
      await expect(nav.getByRole('button', { name })).toHaveAttribute(
        'aria-expanded',
        'true'
      )
      await expect(page.locator(`header a[href="${href}"]`)).toBeVisible()
    }
    expectNoViolation(guardLog, DISMISSED)
  })

  test('T-720 @P0 J16 search at 375 px: the navigation toggle opens the menu', async ({
    page,
    guardLog,
  }) => {
    await page.setViewportSize({ width: 375, height: 812 })
    const tracker = trackPage(page)
    await hardLoad(page, tracker, '/search/?q=climate')
    const toggle = page.getByRole('button', { name: 'Toggle navigation' })
    await toggle.click()
    await expect(toggle).toHaveAttribute('aria-expanded', 'true')
    expectNoViolation(guardLog, DISMISSED)
  })

  test('T-720 @P0 J9 search: the CSV download modal opens, the tooltip shows and the download runs from a blob', async ({
    page,
    guardLog,
  }) => {
    const tracker = trackPage(page)
    await hardLoad(page, tracker, '/search/?q=climate')
    const button = page.locator('button:has(use[href$="#download"])').first()
    await button.hover()
    await expect(
      page.getByText('Download results in CSV').first()
    ).toBeVisible()
    await button.click()
    const modal = page.getByRole('dialog', {
      name: 'Download results in cvs modal',
    })
    await expect(modal).toBeVisible()
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      modal.getByRole('button', { name: /^download$/i }).click(),
    ])
    expect(download.suggestedFilename()).toBe('results.csv')
    await settle(page, tracker)
    expectNoViolation(guardLog, DISMISSED)
  })

  for (const [id, route] of [
    ['works 1001', '/works/1001/'],
    ['outputs 2001', '/outputs/2001/'],
  ])
    test(`T-720 @P0 J7 ${id}: the cite modal opens`, async ({
      page,
      guardLog,
    }) => {
      const tracker = trackPage(page)
      await hardLoad(page, tracker, route)
      await page.getByRole('button', { name: 'Cite' }).click()
      await expect(
        page.getByRole('heading', { name: 'Citation' })
      ).toBeVisible()
      expectNoViolation(guardLog, DISMISSED)
    })

  test('T-720 @P0 J11 outputs 2001: the report chain runs from the type modal to the success modal', async ({
    page,
    guardLog,
  }) => {
    const tracker = trackPage(page)
    await hardLoad(page, tracker, '/outputs/2001/')
    await page.getByRole('button', { name: 'Report', exact: true }).click()
    const typeModal = page.getByRole('dialog', { name: 'Problem-type-modal' })
    await expect(typeModal).toBeVisible()
    await typeModal.getByText('The document should not be published').click()
    await typeModal.getByRole('button', { name: 'Continue' }).click()
    const form = page.getByRole('dialog', { name: 'Problem-form-modal' })
    await form.getByText('Author', { exact: true }).click()
    await form.getByLabel('Name').fill('Test Reporter')
    await form.getByLabel('Email').fill('reporter@localhost')
    await form.getByLabel('Comment').fill('report-ok')
    await form.getByRole('button', { name: 'Submit' }).click()
    await expect(
      page.getByRole('dialog', { name: 'Success-type-modal' })
    ).toBeVisible()
    await settle(page, tracker)
    expectNoViolation(guardLog, DISMISSED)
  })

  test('T-720 @P0 J15 outputs/update: the takedown form submits into the report chain', async ({
    page,
    guardLog,
  }) => {
    const tracker = trackPage(page)
    await hardLoad(page, tracker, '/outputs/update/')
    await page
      .getByRole('textbox')
      .last()
      .fill('https://core.ac.uk/outputs/2001')
    await page.getByRole('button', { name: 'SUBMIT', exact: true }).click()
    const typeModal = page.getByRole('dialog', { name: 'Problem-type-modal' })
    await expect(typeModal).toBeVisible()
    await settle(page, tracker)
    expectNoViolation(guardLog, DISMISSED)
  })

  for (const [id, route, marker] of [
    ['outputs 2001', '/outputs/2001/', true],
    ['directory', '/data-providers/', true],
    ['provider 86', '/data-providers/86/', false],
  ])
    test(`T-720 @P0 J32 ${id}: the map loads its tiles${
      marker ? ', a marker popup opens' : ''
    } and zooms`, async ({ page, guardLog }) => {
      const tracker = trackPage(page)
      await hardLoad(page, tracker, route)
      await expect(page.locator('.leaflet-container')).toBeVisible()
      await expect(page.locator('.leaflet-tile-loaded').first()).toBeVisible()
      if (marker) {
        // by keyboard: on the output page the full-text card overlaps the marker, so a pointer click lands on it
        const marker = page.getByRole('button', { name: 'Marker' }).first()
        await marker.focus()
        await page.keyboard.press('Enter')
        await expect(page.locator('.leaflet-popup')).toBeVisible()
      }
      await page.getByRole('button', { name: 'Zoom in' }).click()
      await settle(page, tracker)
      expectNoViolation(guardLog, DISMISSED)
    })

  test('T-720 @P0 J25 provider 86: the claim chain runs from "Create account" to the success modal and closes', async ({
    page,
    guardLog,
  }) => {
    const tracker = trackPage(page)
    await hardLoad(page, tracker, '/data-providers/86/')
    await page.getByRole('button', { name: 'Create account' }).click()
    const modal = page.getByRole('dialog', {
      name: 'Create Repository Dashboard Account',
    })
    await expect(modal).toBeVisible()
    expectNoViolation(guardLog, DISMISSED)
    // the typed values select the recorded answer of the claim call (hand fixture e17-claim, "claim-ok" 201)
    await modal.getByLabel('Name').fill('Test Claimant')
    await modal.getByLabel('Email').fill('claimant@localhost')
    await modal.locator('#contactRationale-control').fill('claim-ok')
    await modal.getByRole('button', { name: 'Continue' }).click()
    const success = page.getByRole('dialog', { name: 'Claim success modal' })
    await expect(success).toBeVisible()
    await settle(page, tracker)
    await success.locator('button', { hasText: /^Close$/ }).click()
    await expect(success).toHaveCount(0)
    await settle(page, tracker)
    expectNoViolation(guardLog, DISMISSED)
  })

  test('T-720 @P0 J27 directory: the add-provider form shows the answer for the typed address and clears on Finish', async ({
    page,
    guardLog,
  }) => {
    const tracker = trackPage(page)
    await hardLoad(
      page,
      tracker,
      '/data-providers/?q=aberystwyth&size=10&action=ADD&dataProviderUrl=https%3A%2F%2Fcreated.example.org%2F'
    )
    await expect(page.getByText('Suggest a new data provider')).toBeVisible()
    // the debounced call answers 201 (hand fixture e16-claim-form): the form says what was found
    await expect(
      page.getByText('We found Example Repository under the entered address')
    ).toBeVisible()
    const finish = page.getByRole('button', { name: 'Finish' })
    await expect(finish).toBeEnabled()
    await settle(page, tracker)
    expectNoViolation(guardLog, DISMISSED)
    await finish.click()
    await expect(page.getByLabel('Data provider URL')).toHaveValue('')
    await settle(page, tracker)
    expectNoViolation(guardLog, DISMISSED)
  })

  test('T-720 @P0 J2 search: a facet checkbox is applied as a client navigation with the browser filters call', async ({
    page,
    guardLog,
  }) => {
    const tracker = trackPage(page)
    await hardLoad(page, tracker, '/search/?q=climate')
    const bar = page.getByRole('main').getByRole('list').first()
    const pill = bar.getByRole('listitem').filter({ hasText: 'type' }).first()
    await pill.click()
    await page
      .getByRole('listitem')
      .filter({ hasText: 'type' })
      .first()
      .getByText('thesis', { exact: true })
      .click()
    await expect(page).toHaveURL(/documentType%3A%22thesis%22/)
    await settle(page, tracker)
    await expect(page.getByText('Clear all filters')).toBeVisible()
    expectNoViolation(guardLog, DISMISSED)
  })

  test('T-720 @P0 J4 search: page 2 and the sort choice are client navigations', async ({
    page,
    guardLog,
  }) => {
    const tracker = trackPage(page)
    await hardLoad(page, tracker, '/search/?q=climate')
    await page.getByRole('button', { name: '2', exact: true }).click()
    await expect(page).toHaveURL(/page=2/)
    await settle(page, tracker)
    await page.getByText('Sort by').first().click()
    await page.getByText('recent', { exact: true }).click()
    await expect(page).toHaveURL(/sort=recent/)
    await settle(page, tracker)
    expectNoViolation(guardLog, DISMISSED)
  })
})

test.describe('in-page states, cookie state absent', () => {
  test('T-720 @P0 J28 first visit: the popup choice "I agree" loads no extra host and raises no violation', async ({
    page,
    guardLog,
  }) => {
    const tracker = trackPage(page)
    await hardLoad(page, tracker, '/search/?q=climate')
    await expect(page.locator('#cookies-popup')).toBeVisible()
    await page.getByRole('button', { name: 'I agree' }).click()
    await expect(page.locator('#cookies-popup')).toHaveCount(0)
    await settle(page, tracker)
    expectNoViolation(guardLog, { consented: false })
    // the reload runs with the consent: GA loads, still no violation
    await page.reload()
    await loaded(page, tracker)
    expect(guardLog.csp).toEqual([])
    expect(census(guardLog).gtag).toHaveLength(1)
  })
})

// ---------- control: the guard sees a violation (Q-096)
test('T-720 @P0 control: a client error reports to the test-DSN Sentry host, which the CSP blocks: exactly one connect-src violation and no request at the stub (Q-096)', async ({
  page,
  guardLog,
}) => {
  test
    .info()
    .annotations.push(
      { type: 'guard-expect', description: 'console' },
      { type: 'guard-expect', description: 'csp' }
    )
  // Q-074 (a): the output page with doi null hydrates into an error
  await page.goto('/works/7401/')
  await expect
    .poll(() => guardLog.csp.length, { timeout: 60000 })
    .toBeGreaterThan(0)
  await expect.poll(() => guardLog.consoleErrors.length).toBe(3)
  expect(guardLog.csp.map((v) => [v.effectiveDirective, v.blockedURI])).toEqual(
    [['connect-src', SENTRY_STORE]]
  )
  expect(guardLog.sentry).toEqual([])
  expect(census(guardLog).sentry).toEqual([])
})
