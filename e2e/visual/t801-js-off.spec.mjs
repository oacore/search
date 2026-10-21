// T-801 c4 (41 I, V28): the pre-hydration page, JavaScript off, on the five page types (search R2, work R3,
// output R4, provider R7, providers directory R6) at 1440 and 375. What crawlers and slow clients see: an
// empty filters bar, no header search, the "Not a member yet" claim card, hoisted nested anchors. Pixel-exact
// against this machine's host baseline (owner notes §1), no masks. The context is the guard's JS-off context
// (same routing and cookie state as the other tiers); nothing runs, so there is no clock to fix.
import { test, expect } from '../lib/P0-18/harness-gaps.mjs'
import {
  TWO,
  visitStatic,
  prepareStatic,
  shots,
  TEST_TIMEOUT,
} from '../lib/P0-18/capture.mjs'

test.use({ cookieState: 'essential' })
test.setTimeout(TEST_TIMEOUT)

const PAGES = [
  ['search', '/search/?q=climate'],
  ['works', '/works/1001/'],
  ['outputs', '/outputs/2001/'],
  ['provider', '/data-providers/86/'],
  ['dps', '/data-providers/'],
]

test.describe('V28 JS off', () => {
  for (const [id, url] of PAGES)
    for (const w of TWO)
      test(`T-801 c4 @P0 V28 JS off ${id} ${url} ${w}`, async ({
        jsOffContext,
      }) => {
        const page = await jsOffContext.newPage()
        const t = await visitStatic(page, url, w)
        await prepareStatic(page, t)
        // scripting is off: the client never ran, so Next's router does not exist
        expect(await page.evaluate(() => typeof window.next)).toBe('undefined')
        const s = shots(page)
        await s.take(`V28-${id}-${w}`)
        s.done()
      })
})
