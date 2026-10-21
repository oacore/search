// T-701 (41; R-006, R-010, R-013, R-032, R-044, R-047, R-056, R-057): console/hydration gate. Every T-601
// 200-route (incl. /display/<id>/ through the gateway-faithful proxy and the local-only pages through the
// allow-all proxy) x 3 time zones x 3 cookie states, hard load to the settled hydrated page: no `pageerror`,
// no console.error and no window `error` outside the T-728 pinned tuple set (55 C7 (1); empty on React 17)
// and the T-741 pins of that route and cookie state. Corroboration: React 17 production prints no hydration
// warning text ("did not match", ...) although the pages carry the React 17 silent repairs (Q-050 dates,
// Q-051 consent popup, Q-072 nested anchors, Q-075 /display breadcrumb); and production SSR renders the
// page (Q-052 c2: the non-production NextApp wrapper of pages/_app.jsx is inert in the parity build).
// A route whose T-741 pins hold a console.error declares the guard's console check expected and asserts the
// same thing itself, exactly (the pins are T-701's allow-list, 41 T-701).
import { test as base, expect } from '../fixtures/guard.mjs'
import { COOKIE_STATES } from '../fixtures/constants.mjs'
import { p012Fixtures } from '../lib/P0-12/fixtures.mjs'
import { T601_200 } from '../lib/P0-12/routes.mjs'
import {
  TIME_ZONES,
  firstLine,
  pageConsole,
  settle,
  ssrNextMarkup,
  trackRequests,
  urlOf,
} from '../lib/P0-12/page.mjs'
import { classify, loadPins, pinnedErrors } from '../lib/P0-12/console-pins.mjs'
import { codeOf, pinnedTuples } from '../lib/P0-12/tuples.mjs'

const test = base.extend(p012Fixtures)
// a hard load plus the settle wait can take minutes on a heavily loaded machine (40 §5: timeouts, never retries)
test.describe.configure({ timeout: 300000 })
const pins = loadPins()
const tuples = pinnedTuples()

const HYDRATION_WARNING =
  /did not match|Expected server HTML to contain|Did not expect server HTML to contain|Hydration failed|There was an error while hydrating/

for (const timezoneId of TIME_ZONES)
  for (const cookieState of COOKIE_STATES)
    test.describe(`${timezoneId} ${cookieState}`, () => {
      test.use({ timezoneId, cookieState })
      for (const route of T601_200)
        test(`T-701 @P0 @engines ${route.id} ${timezoneId} ${cookieState}: no pageerror, console.error or window error outside the pinned tuples and the T-741 pins`, async ({
          page,
          p2Env,
          guardLog,
          browserName,
        }) => {
          const allowed = pinnedErrors(pins, route.id, cookieState, 'load')
          if (Object.keys(allowed).length)
            test.info().annotations.push({
              type: 'guard-expect',
              description: 'console',
            })

          const tracker = trackRequests(page)
          const res = await page.goto(urlOf(p2Env, route))
          expect(res.status()).toBe(200)
          // Q-052 c2: production SSR renders the page
          const ssr = ssrNextMarkup(await res.text())
          expect(ssr && ssr.length).toBeGreaterThan(1000)
          await settle(page, tracker)

          const combo = {
            route: route.id,
            fixture: route.fixture,
            tz: timezoneId,
            cookieState,
            engine: browserName,
          }
          const pinnedCodes = new Set(
            tuples
              .filter((t) =>
                ['route', 'fixture', 'tz', 'cookieState', 'engine'].every(
                  (k) => t[k] === combo[k]
                )
              )
              .map((t) => String(t.errorCode))
          )
          const isPinnedHydration = (message) => {
            const code = codeOf(message)
            return code != null && pinnedCodes.has(code)
          }

          const outside = []
          for (const e of guardLog.pageErrors)
            if (!isPinnedHydration(e.message))
              outside.push(`pageerror: ${firstLine(e.message)}`)
          for (const e of guardLog.windowErrors)
            if (!isPinnedHydration(e.message))
              outside.push(`window error: ${firstLine(e.message)}`)
          const budget = { ...allowed }
          for (const c of pageConsole(guardLog)) {
            if (c.type !== 'error' || isPinnedHydration(c.text)) continue
            const id = classify(pins, c)
            if (id && budget[id] > 0) budget[id] -= 1
            else outside.push(`console.error: ${firstLine(c.text)}`)
          }
          expect(outside).toEqual([])

          // corroboration: no hydration warning text in any console channel (React 17 production)
          expect(
            guardLog.console
              .filter((c) => HYDRATION_WARNING.test(c.text))
              .map((c) => `${c.type}: ${firstLine(c.text)}`)
          ).toEqual([])
        })
    })
