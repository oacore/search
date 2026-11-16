// T-741 (41; R-041, R-056, R-057): console pins. c1: per T-601 200-route and cookie state, the browser
// console of one hard load and of one client route change equals the pinned counts per message (the Q-071
// warning `Send command doesn't exist: search` on every load and route change, the other review:ui-flows
// §8.6 baseline messages), plus the interaction messages (takedown submit, Cite modal, accepted claim,
// aggregation failure); an unknown message fails. c2: the pins are one set per React/Next version and the
// installed versions have one; the guard's console allow-list of this React version allows nothing T-741
// does not pin. c3: every pinned message cites existing R/Q rows. Pins: e2e/lib/P0-12/t741-console-pins.json.
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { test as base, expect } from '../fixtures/guard.mjs'
import { COOKIE_STATES } from '../fixtures/constants.mjs'
import { p012Fixtures } from '../lib/P0-12/fixtures.mjs'
import { T601_200, changeTargetOf, routeById } from '../lib/P0-12/routes.mjs'
import {
  pageConsole,
  routeChange,
  settle,
  trackRequests,
  urlOf,
} from '../lib/P0-12/page.mjs'
import {
  census,
  installedVersions,
  loadPins,
  loadPinsFile,
  registerIds,
  versionKey,
} from '../lib/P0-12/console-pins.mjs'

const test = base.extend(p012Fixtures)
// a hard load plus the settle wait can take minutes on a heavily loaded machine (40 §5: timeouts, never retries)
test.describe.configure({ timeout: 300000 })
const pins = loadPins()
const HERE = path.dirname(fileURLToPath(import.meta.url))

// a pinned console.error on a route is asserted here, not by the guard's console check
const declareErrors = (counts) => {
  if (Object.keys(counts).some((id) => pins.messages[id].type === 'error'))
    test
      .info()
      .annotations.push({ type: 'guard-expect', description: 'console' })
}

const expectCensus = (observed, pinned, label) => {
  expect(observed.unknown, `${label}: messages without a pin`).toEqual([])
  expect(observed.counts, `${label}: counts per pinned message`).toEqual(
    pinned || {}
  )
}

for (const cookieState of COOKIE_STATES)
  test.describe(`cookie state ${cookieState}`, () => {
    test.use({ cookieState })
    for (const route of T601_200)
      test(`T-741 c1 @P0 ${
        route.id
      } ${cookieState}: console of the load and of a route change to ${changeTargetOf(
        route
      )} equals the pins`, async ({ page, p2Env, guardLog }) => {
        const row = (pins.routes[route.id] || {})[cookieState]
        expect(row, `pins for ${route.id} ${cookieState}`).toBeTruthy()
        declareErrors({ ...row.load, ...row.change })
        const tracker = trackRequests(page)
        const res = await page.goto(urlOf(p2Env, route))
        expect(res.status()).toBe(200)
        await settle(page, tracker)
        const cut = guardLog.console.length
        const load = census(
          pins,
          pageConsole(guardLog).filter((c) => guardLog.console.indexOf(c) < cut)
        )
        await routeChange(page, tracker, changeTargetOf(route))
        const change = census(pins, pageConsole(guardLog, cut))
        expectCensus(load, row.load, 'load')
        expectCensus(change, row.change, 'route change')
        expect(guardLog.pageErrors).toEqual([])
        expect(guardLog.windowErrors).toEqual([])
      })
  })

test.describe('interactions', () => {
  test('T-741 c1 @P0 takedown submit with a works link logs the parsed id (undefined)', async ({
    page,
    guardLog,
  }) => {
    const pinned = pins.interactions['takedown-works-link']
    const route = routeById(pinned.route)
    const tracker = trackRequests(page)
    await page.goto(route.path)
    await settle(page, tracker)
    const cut = guardLog.console.length
    await page.getByLabel('CORE URL').fill(pinned.input)
    await page.getByRole('button', { name: 'SUBMIT' }).click()
    await expect(
      page.getByText('are not accepted.', { exact: false })
    ).toBeVisible({ timeout: 60000 })
    await settle(page, tracker, { hydration: false })
    const observed = census(pins, pageConsole(guardLog, cut))
    expectCensus(observed, pinned.counts, 'submit')
    expect(
      pageConsole(guardLog, cut)
        .filter((c) => c.type === 'log')
        .map((c) => c.text)
    ).toEqual(pinned.logTexts)
  })

  test('T-741 c1 @P0 opening the Cite modal logs nothing (no BibTeX entry with the recorded E9 answers)', async ({
    page,
    guardLog,
  }) => {
    const pinned = pins.interactions['cite-modal-open']
    const route = routeById(pinned.route)
    const tracker = trackRequests(page)
    await page.goto(route.path)
    await settle(page, tracker)
    const cut = guardLog.console.length
    await page.getByRole('button', { name: 'Cite' }).click()
    const heading = page.getByRole('heading', { name: 'Citation' })
    const modal = page.getByRole('dialog').filter({ has: heading })
    await expect(heading).toBeVisible({ timeout: 60000 })
    await expect(modal).toHaveCount(1)
    await settle(page, tracker, { hydration: false })
    // the copy icon (and its `Copying to clipboard` log) lives in a parsed BibTeX entry (issue P0-12-15)
    await expect(modal.locator('[id^="cite-"]')).toHaveCount(
      pinned.bibtexEntries
    )
    expectCensus(
      census(pins, pageConsole(guardLog, cut)),
      pinned.counts,
      'cite modal'
    )
  })

  test('T-741 c1 @P0 an accepted claim logs the claim answer', async ({
    page,
    guardLog,
  }) => {
    const pinned = pins.interactions['claim-success']
    const route = routeById(pinned.route)
    const tracker = trackRequests(page)
    await page.goto(route.path)
    await settle(page, tracker)
    const cut = guardLog.console.length
    await page.getByRole('button', { name: 'Create account' }).click()
    const modal = page.getByRole('dialog', {
      name: 'Create Repository Dashboard Account',
    })
    await expect(modal).toBeVisible({ timeout: 60000 })
    await modal.getByLabel('Name').fill(pinned.input.name)
    await modal.getByLabel('Email').fill(pinned.input.email)
    await modal
      .locator('#contactRationale-control')
      .fill(pinned.input.rationale)
    await modal.getByRole('button', { name: 'Continue' }).click()
    await expect(
      page.getByRole('dialog', { name: 'Claim success modal' })
    ).toBeVisible({ timeout: 60000 })
    await settle(page, tracker, { hydration: false })
    expectCensus(
      census(pins, pageConsole(guardLog, cut)),
      pinned.counts,
      'claim'
    )
    expect(
      pageConsole(guardLog, cut)
        .filter((c) => c.type === 'log')
        .map((c) => c.text)
    ).toEqual(pinned.logTexts)
  })

  test('T-741 c1 @P0 failing aggregation request logs the fetchFilters error', async ({
    page,
    guardLog,
  }) => {
    const pinned = pins.interactions['aggregation-500']
    declareErrors(pinned.counts)
    const route = routeById(pinned.route)
    let failed = 0
    await page.route(pinned.failUrl, (r) => {
      // preflights stay with the guard (answered 204, 40 §2.4)
      if (r.request().method() === 'OPTIONS') return r.fallback()
      failed += 1
      return r.fulfill({
        status: 500,
        headers: {
          'content-type': 'application/json',
          'access-control-allow-origin': new URL(page.url()).origin,
          'access-control-allow-credentials': 'true',
        },
        body: '{"message":"Internal Server Error"}',
      })
    })
    const tracker = trackRequests(page)
    await page.goto(route.path)
    await settle(page, tracker)
    expect(failed).toBe(pinned.failedRequests)
    const observed = census(pins, pageConsole(guardLog))
    expectCensus(observed, pinned.counts, 'load with a failing aggregation')
  })
})

test('T-741 c2 @P0 pins are versioned per React/Next and the installed versions have a set', () => {
  const file = loadPinsFile()
  expect(file.schema).toBe(1)
  const keys = Object.keys(file.versions)
  for (const k of keys) expect(k).toMatch(/^react-\d+\.\d+\+next-\d+\.\d+$/)
  const v = installedVersions()
  // the 10.2 set and its copies for Next 12.1 and 12.3 (owner, 2026-10-29) and the React 18.3 set on Next 12.3 (owner, 2026-11-03) and its set for Next 13.5 (owner, 2026-11-05) and its set for Next 14.2 (owner, 2026-11-05)
  expect(['17.0', '18.3']).toContain(v.react)
  expect(['10.2', '12.1', '12.3', '13.5', '14.2', '15.5']).toContain(v.next)
  expect(keys).toContain(versionKey(v))
  // the guard's allow-list of this React version (e2e/console-allow/react-<major.minor>.json) allows only
  // console.error messages that T-741 pins
  const allow = JSON.parse(
    fs.readFileSync(
      path.join(HERE, '..', 'console-allow', `react-${v.react}.json`),
      'utf8'
    )
  )
  expect(allow.react).toBe(v.react)
  const pinnedErrorTexts = pins.messageList.filter((m) => m.type === 'error')
  for (const entry of allow.entries) {
    const re = new RegExp(entry.pattern)
    const covered = pinnedErrorTexts.some((m) =>
      m.text ? re.test(m.text) : m.pattern === entry.pattern
    )
    expect(
      covered,
      `allow-list entry ${entry.pattern} is pinned by T-741`
    ).toBe(true)
  }
  // every route and interaction refers to catalogue messages only
  for (const [routeId, states] of Object.entries(pins.routes)) {
    expect(T601_200.map((r) => r.id)).toContain(routeId)
    expect(Object.keys(states).sort()).toEqual([...COOKIE_STATES].sort())
    for (const phases of Object.values(states))
      for (const counts of [phases.load, phases.change])
        for (const id of Object.keys(counts))
          expect(Object.keys(pins.messages)).toContain(id)
  }
  expect(Object.keys(pins.routes).sort()).toEqual(
    T601_200.map((r) => r.id).sort()
  )
  for (const [name, it] of Object.entries(pins.interactions)) {
    expect(
      T601_200.map((r) => r.id),
      name
    ).toContain(it.route)
    for (const id of Object.keys(it.counts))
      expect(Object.keys(pins.messages), name).toContain(id)
  }
})

test('T-741 c3 @P0 every pinned message cites existing R/Q rows', () => {
  const ids = registerIds()
  for (const [key, set] of Object.entries(loadPinsFile().versions))
    for (const [id, m] of Object.entries(set.messages)) {
      const label = `${key} ${id}`
      expect(Array.isArray(m.cites) && m.cites.length > 0, label).toBe(true)
      expect(
        m.cites.some((c) => /^(R|Q)-\d{3}$/.test(c)),
        `${label} cites an R or Q row`
      ).toBe(true)
      for (const c of m.cites)
        expect(ids.has(c), `${label}: ${c} exists`).toBe(true)
      expect(['log', 'warning', 'error', 'info', 'debug']).toContain(m.type)
      expect(
        Boolean(m.text) !== Boolean(m.pattern),
        `${label}: text or pattern`
      ).toBe(true)
    }
})
