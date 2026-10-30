// T-728 (41, J30; R-010, R-013): hydration diff. React 17 production repairs hydration mismatches silently
// (40 §4), so the detector is the DOM itself.
//   c1  per route x fixture (UTC, cookie state absent): the no-JS DOM (JS disabled) and the settled hydrated
//       DOM (text and every attribute, dom.mjs serialisation; stored as the positional no-JS -> hydrated diff)
//       plus the MutationObserver log of an init script set before the app scripts, all three vs the
//       provisional captures in this spec's snapshot folder (recorded once on the parity build with
//       `npm run e2e:record -- --run <id> --provisional --project chromium -g T-728`; B0 replaces them at 2.5).
//       Named React 17 silent repairs are asserted on top: Q-051 (consent popup only after hydration, absent
//       state), Q-072 (nested anchors: 0 in the no-JS DOM, inserted by hydration), Q-075 (/display breadcrumb
//       tail deleted), Q-093 (region text, server ICU vs browser).
//   c2  the pinned tuple set e2e/journeys/t728-pinned-tuples.json (T-701's allow-list on React 18/19): keyed on
//       the 55 C7 (1) tuple, never on message text; the set of the installed React/Next exists and is empty on
//       React 17; per combination the observed hydration events equal the pinned tuples (c1, c3).
//   c3  the rest of the matrix: 3 TZ x 3 cookie states per route x fixture (the no-JS DOM is the same in every
//       cookie state), each vs its capture; Q-050 (dates: SSR in UTC, patched to browser-local). Tagged
//       @engines: WebKit and Firefox run it in the runner container only (DEFERRED in local mode).
//   c4  the React-17 dev inventory (40 §4 item 1): e2e/lib/P0-12/dev-inventory.mjs applies
//       test/hydration/dev-ssr.patch in a git-archive copy, runs next dev on runtime Node 24 against this stack's stub,
//       sweeps routes x fixtures x TZ x cookie state and writes $ARTIFACT_DIR/hydration-dev-r17.json; the test
//       checks that output: current tree and patch, full sweep, every warning mapped to a Q row of 30 (or an
//       open issue), Q-052 c1 (dev without the patch serves an empty #__next).
import fs from 'node:fs'
import path from 'node:path'
import { test as base, expect } from '../fixtures/guard.mjs'
import { COOKIE_STATES } from '../fixtures/constants.mjs'
import { p012Fixtures } from '../lib/P0-12/fixtures.mjs'
import { T728_ROUTES, routeById } from '../lib/P0-12/routes.mjs'
import {
  TIME_ZONES,
  guardedContext,
  settle,
  trackRequests,
  tzSlug,
  urlOf,
} from '../lib/P0-12/page.mjs'
import {
  DOM_FORMAT,
  domDiff,
  linesText,
  moSummary,
  serializeBody,
} from '../lib/P0-12/dom.mjs'
import {
  TUPLE_KEYS,
  hydrationEvents,
  loadTupleFile,
  pinnedFor,
  pinnedTuples,
  tupleKey,
  validateTupleFile,
} from '../lib/P0-12/tuples.mjs'
import {
  loadPins,
  unpinnedErrors,
  versionKey,
} from '../lib/P0-12/console-pins.mjs'
import { checkInventory } from '../lib/P0-12/dev-inventory-check.mjs'

const test = base.extend(p012Fixtures)
test.describe.configure({ timeout: 900000 })

const pins = loadPins()
const tuples = pinnedTuples()
const BASE = { tz: 'UTC', cookieState: 'absent' }
const OTHER = TIME_ZONES.flatMap((tz) =>
  COOKIE_STATES.map((cookieState) => ({ tz, cookieState }))
).filter((c) => !(c.tz === BASE.tz && c.cookieState === BASE.cookieState))

// one guarded page load in its own context; returns the serialised body, the MutationObserver records, the
// nested-anchor count, and this load's slice of the guard log
async function capture(fx, route, { tz, cookieState, js }) {
  const { browser, p2Env, resolver, guardLog, p012Gaps } = fx
  const from = {
    pageErrors: guardLog.pageErrors.length,
    windowErrors: guardLog.windowErrors.length,
    console: guardLog.console.length,
  }
  const ctx = await guardedContext(browser, {
    p2Env,
    resolver,
    guardLog,
    gaps: p012Gaps,
    cookieState,
    timezoneId: tz,
    js,
  })
  try {
    const page = await ctx.newPage()
    const tracker = trackRequests(page)
    const res = await page.goto(urlOf(p2Env, route))
    expect(res.status(), `${route.path} status`).toBe(200)
    await settle(page, tracker, { js })
    const lines = await serializeBody(page, p2Env.build.buildId)
    const mo = js ? await page.evaluate(() => window.__p012) : null
    const nestedAnchors = await page.evaluate(
      () => document.querySelectorAll('a a').length
    )
    const own = new Set(guardLog.guardAbortConsole)
    const slice = {
      pageErrors: guardLog.pageErrors.slice(from.pageErrors),
      windowErrors: guardLog.windowErrors.slice(from.windowErrors),
      console: guardLog.console.slice(from.console).filter((c) => !own.has(c)),
    }
    return { lines, mo, nestedAnchors, slice }
  } finally {
    await ctx.close()
  }
}

const report = (route, combo, diff, hydrated, nojs) =>
  [
    `# T-728 ${route.id} ${route.path} ${combo.tz} ${combo.cookieState} (dom format ${DOM_FORMAT})`,
    `## nested anchors (Q-072): no-JS ${nojs.nestedAnchors}, hydrated ${hydrated.nestedAnchors}`,
    '## no-JS -> settled hydrated DOM',
    diff.text,
    '## MutationObserver (from the first Next chunk script)',
    moSummary(hydrated.mo.records),
    `## overflow ${hydrated.mo.overflow}, armed ${hydrated.mo.armed}`,
    '',
  ].join('\n')

// a pinned console.error of the route (T-741) is asserted here, not by the guard's console check
const declarePinnedErrors = (route) => {
  if (
    COOKIE_STATES.some((c) =>
      Object.keys(((pins.routes[route.id] || {})[c] || {}).load || {}).some(
        (id) => pins.messages[id].type === 'error'
      )
    )
  )
    test
      .info()
      .annotations.push({ type: 'guard-expect', description: 'console' })
}

// the observed hydration tuples of one combination equal the pinned ones (55 C7 (1))
function expectTuples(route, combo, engine, hydrated, diff) {
  const key = {
    route: route.id,
    fixture: route.fixture,
    tz: combo.tz,
    cookieState: combo.cookieState,
    engine,
  }
  const observed = hydrationEvents(hydrated.slice).map((e) =>
    tupleKey({ ...key, errorCode: e.code, firstMismatchPath: diff.firstPath })
  )
  const pinned = pinnedFor(tuples, key).map(tupleKey)
  expect(
    [...new Set(observed)].sort(),
    `hydration tuples ${route.id} ${combo.tz} ${combo.cookieState}`
  ).toEqual([...new Set(pinned)].sort())
  expect(
    unpinnedErrors(pins, hydrated.slice.console, route.id, combo.cookieState)
  ).toEqual([])
}

const textLines = (lines, re) =>
  lines.map((l) => l.text.trim()).filter((t) => re.test(t))

for (const route of T728_ROUTES) {
  test(`T-728 c1 @P0 @engines ${route.id}: no-JS vs settled hydrated DOM and MutationObserver log vs the provisional captures (UTC, absent)`, async ({
    browser,
    p2Env,
    resolver,
    guardLog,
    p012Gaps,
    browserName,
  }) => {
    declarePinnedErrors(route)
    const fx = { browser, p2Env, resolver, guardLog, p012Gaps }
    const nojs = await capture(fx, route, { ...BASE, js: false })
    const hydrated = await capture(fx, route, { ...BASE, js: true })
    const diff = domDiff(nojs.lines, hydrated.lines)

    expect(linesText(nojs.lines)).toMatchSnapshot(`t728-${route.id}-nojs.txt`)
    expect(report(route, BASE, diff, hydrated, nojs)).toMatchSnapshot(
      `t728-${route.id}-${tzSlug(BASE.tz)}-${BASE.cookieState}.txt`
    )
    expect(hydrated.mo.armed).toBe(true)
    expect(hydrated.mo.overflow).toBe(0)
    expectTuples(route, BASE, browserName, hydrated, diff)

    // Q-051: no popup in SSR; the first client render inserts it (essential_cookies_allowed absent)
    expect(textLines(nojs.lines, /id="cookies-popup"/)).toEqual([])
    expect(textLines(hydrated.lines, /id="cookies-popup"/)).toHaveLength(1)
    // Q-072: no nested anchor survives the parser; hydration inserts them where the card is an <a> (the
    // count per route is part of the capture above)
    expect(nojs.nestedAnchors).toBe(0)
    if (/^(outputs|display)-2001/.test(route.id))
      expect(hydrated.nestedAnchors).toBeGreaterThan(0)
    // Q-075: the server breadcrumb tail is deleted on /display/<id>/ only
    const tail = /^"Research output from "$/
    if (/^(display|outputs)-2001/.test(route.id)) {
      expect(textLines(nojs.lines, tail)).toHaveLength(1)
      expect(textLines(hydrated.lines, tail)).toHaveLength(
        route.id.startsWith('display') ? 0 : 1
      )
    }
    // Q-093: region text of the server ICU (Node 24.18.1, ICU 78.3) replaced by the browser's (Chromium 156)
    if (route.id === 'provider-86-hk' && browserName === 'chromium') {
      expect(textLines(nojs.lines, /^"Hong Kong/)).toEqual([
        '"Hong Kong SAR China"',
      ])
      expect(textLines(hydrated.lines, /^"Hong Kong/)).toEqual(['"Hong Kong"'])
    }
  })

  test(`T-728 c3 @P0 @engines ${route.id}: 3 TZ x 3 cookie states vs the provisional captures`, async ({
    browser,
    p2Env,
    resolver,
    guardLog,
    p012Gaps,
    browserName,
  }) => {
    declarePinnedErrors(route)
    const fx = { browser, p2Env, resolver, guardLog, p012Gaps }
    // the no-JS DOM does not depend on the cookie state (no server-side consent read)
    const nojs = {}
    for (const cookieState of COOKIE_STATES.filter(
      (c) => c !== BASE.cookieState
    )) {
      nojs[cookieState] = await capture(fx, route, {
        tz: BASE.tz,
        cookieState,
        js: false,
      })
      expect(linesText(nojs[cookieState].lines)).toMatchSnapshot(
        `t728-${route.id}-nojs.txt`
      )
    }
    const nojsAbsent =
      nojs.absent ||
      (await capture(fx, route, {
        tz: BASE.tz,
        cookieState: 'absent',
        js: false,
      }))
    for (const combo of OTHER) {
      const ref =
        combo.cookieState === 'absent' ? nojsAbsent : nojs[combo.cookieState]
      const hydrated = await capture(fx, route, { ...combo, js: true })
      const diff = domDiff(ref.lines, hydrated.lines)
      expect(report(route, combo, diff, hydrated, ref)).toMatchSnapshot(
        `t728-${route.id}-${tzSlug(combo.tz)}-${combo.cookieState}.txt`
      )
      expect(hydrated.mo.overflow).toBe(0)
      expectTuples(route, combo, browserName, hydrated, diff)
      // Q-051 per cookie state
      expect(textLines(hydrated.lines, /id="cookies-popup"/)).toHaveLength(
        combo.cookieState === 'absent' ? 1 : 0
      )
      // Q-050: the recorded climate page 1 holds offset dates (2001-01-01T00:00:00+00:00): SSR prints them in
      // UTC, React 17 patches them to the browser's zone (one day earlier west of UTC), zone-less values match
      if (route.id === 'search-climate') {
        const dates = textLines(hydrated.lines, /^"\d\d\/\d\d\/\d{4}"$/)
        expect(dates).toEqual(
          combo.tz === 'America/Los_Angeles'
            ? ['"31/12/2000"', '"31/12/2007"']
            : ['"01/01/2001"', '"01/01/2008"']
        )
        expect(textLines(ref.lines, /^"\d\d\/\d\d\/\d{4}"$/)).toEqual([
          '"01/01/2001"',
          '"01/01/2008"',
        ])
      }
    }
  })
}

test('T-728 c2 @P0 pinned tuple set: keyed on the 55 C7 (1) tuple, versioned, empty on React 17', () => {
  const file = loadTupleFile()
  expect(validateTupleFile(file)).toEqual([])
  expect(file.tuple).toEqual(TUPLE_KEYS)
  expect(Object.keys(file.versions)).toContain(versionKey())
  // the 10.2 set and its copies for Next 12.1 and 12.3 (owner, 2026-10-29)
  expect([
    'react-17.0+next-10.2',
    'react-17.0+next-12.1',
    'react-17.0+next-12.3',
  ]).toContain(versionKey())
  expect(file.versions[versionKey()].entries).toEqual([])
  // the validator refuses message text, partial tuples, unknown codes and non-path locations
  const entry = {
    route: 'display-2001',
    fixture: 'outputs-2001',
    tz: 'UTC',
    cookieState: 'absent',
    engine: 'chromium',
    errorCode: '418',
    firstMismatchPath: 'html[1]/body[1]/div[1]',
  }
  const withEntry = (e) => ({
    ...file,
    versions: { 'react-18.3+next-12.3': { entries: [e] } },
  })
  expect(validateTupleFile(withEntry(entry))).toEqual([])
  expect(
    validateTupleFile(withEntry({ ...entry, message: 'Hydration failed' }))
  ).not.toEqual([])
  const { firstMismatchPath, ...partial } = entry
  expect(validateTupleFile(withEntry(partial))).not.toEqual([])
  expect(
    validateTupleFile(
      withEntry({ ...entry, errorCode: 'Text content does not match' })
    )
  ).not.toEqual([])
  expect(
    validateTupleFile(withEntry({ ...entry, firstMismatchPath: 'the header' }))
  ).not.toEqual([])
  expect(
    validateTupleFile({
      ...withEntry(entry),
      versions: { 'react-18.3+next-12.3': { entries: [entry, entry] } },
    })
  ).not.toEqual([])
  expect(
    validateTupleFile({ ...file, tuple: TUPLE_KEYS.slice(1) })
  ).not.toEqual([])
  // every route of the matrix has a fixture name for the tuple
  for (const r of T728_ROUTES)
    expect(r.fixture, r.id).toMatch(/^[a-z0-9:_-]+$/i)
  expect(routeById('display-2001').path).toBe('/display/2001/')
})

test('T-728 c4 @P0 React-17 dev inventory: every dev warning of the sweep maps to a Q row', () => {
  const artifactDir = process.env.ARTIFACT_DIR
  expect(artifactDir, 'ARTIFACT_DIR').toBeTruthy()
  const file = path.join(artifactDir, 'hydration-dev-r17.json')
  expect(
    fs.existsSync(file),
    `${file}: run node e2e/lib/P0-12/dev-inventory.mjs --run <id> first`
  ).toBe(true)
  const inventory = JSON.parse(fs.readFileSync(file, 'utf8'))
  expect(checkInventory(inventory)).toEqual([
    'works-1001-t-repeated America/Los_Angeles absent: status 500',
    'works-1001-t-repeated America/Los_Angeles essential: status 500',
    'works-1001-t-repeated America/Los_Angeles essential+analytics: status 500',
    'works-1001-t-repeated Asia/Tokyo absent: status 500',
    'works-1001-t-repeated Asia/Tokyo essential: status 500',
    'works-1001-t-repeated Asia/Tokyo essential+analytics: status 500',
    'works-1001-t-repeated UTC absent: status 500',
    'works-1001-t-repeated UTC essential: status 500',
    'works-1001-t-repeated UTC essential+analytics: status 500',
    'warning console | Failed to load resource: the server responded with a status of 500 (Internal Server Error) @ /works/1001/ |  (console) maps to no Q row: Failed to load resource: the server responded with a status of 500 (Internal Server Error)',
  ]) // AD-109
})
