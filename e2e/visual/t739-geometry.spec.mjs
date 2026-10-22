// T-739 (41 H/I; R-001, R-008, R-023, R-086; Q-088): geometry sweep of the two light shells of 41 §2.5,
// /outputs/update/ (header, footer, static content, no API) and /search/?q=climate (header search, filters,
// pagination), at the sweep widths 1280, 1024, 600, 561, 560, 501, 500, 360, 320 (height 900; 41 gives no
// height for the sweep).
//   c1  per element (<html>, <body> and every element below it: the #__next tree and the portals), its
//       getBoundingClientRect, display and visibility, plus the document's client and scroll size = B0. Each
//       width is a fresh load at that viewport (the search page reads the window width at hydration:
//       `siblingCount = width > 500 ? 2 : 0`, templates/search/index.jsx:133).
//   c2  the horizontal overflow pinned by Q-088 (X30.23, review:ui-flows UI-10): /search/?q=climate is 534 px
//       wide at 501 px and 346 px at 320 px, with no overflow at 500 and 375; /outputs/update/ has none at 501
//       and is 362 px wide at 360 and 320 (issue P1-06-3); the elements that reach past the viewport = B0.
// Pages are settled (fonts, every image loaded, quiet network, scroll position 0; 40 §5), on the fixed clock,
// cookie state `essential` (the consent popup would cover the bottom of the page).
import { test, expect } from '../fixtures/guard.mjs'
import {
  TEST_TIMEOUT,
  openAt,
  quiet,
  fontsAndImages,
  rel,
} from '../lib/P1-06/page.mjs'
import {
  installHelpers,
  geometryCensus,
  overflowCensus,
} from '../lib/P1-06/census.mjs'
import { expectJsonBaseline, explainLines } from '../lib/P1-06/baseline.mjs'

test.use({ cookieState: 'essential' })

const SWEEP = [1280, 1024, 600, 561, 560, 501, 500, 360, 320]
const SHELLS = [
  { id: 'update', path: '/outputs/update/' },
  { id: 'search', path: '/search/?q=climate' },
]

async function load(page, path, width) {
  await page.addInitScript(installHelpers)
  const { tracker } = await openAt(page, path, width, { height: 900 })
  await fontsAndImages(page)
  await quiet(page, tracker)
}

test.describe('T-739 geometry sweep', () => {
  test.describe.configure({ timeout: TEST_TIMEOUT })

  for (const shell of SHELLS)
    for (const w of SWEEP)
      test(`T-739 c1 @P1 ${shell.id} ${w}: getBoundingClientRect, display, visibility per element = B0`, async ({
        page,
        p2Env,
      }) => {
        await load(page, shell.path, w)
        const census = await page.evaluate(geometryCensus)
        expect(census.scroll).toEqual({ x: 0, y: 0 })
        expect(census.viewport).toEqual({ width: w, height: 900 })
        await expectJsonBaseline(
          `t739-c1-${shell.id}-${w}`,
          { shell: shell.id, url: rel(p2Env, page.url()), ...census },
          { explain: explainLines('elements') }
        )
      })

  // Q-088: document width of /search/?q=climate at the overflow widths and their neighbours (the numbers of
  // 30 Q-088); /outputs/update/ at the same widths: no overflow at 501, 362 px at 360 and 320 (an image of
  // the page's fourth section keeps its width; not in 30: issue P1-06-3, pinned as it is, D1)
  const WIDTHS = [
    [
      'search',
      '/search/?q=climate',
      { 501: 534, 500: 500, 375: 375, 320: 346 },
    ],
    ['update', '/outputs/update/', { 501: 501, 360: 362, 320: 362 }],
  ]
  for (const [id, path, table] of WIDTHS)
    for (const [w, docWidth] of Object.entries(table).map(([a, b]) => [
      Number(a),
      b,
    ]))
      test(`T-739 c2 @P1 ${id} ${w}: document width ${docWidth}${
        id === 'search' ? ' (Q-088 overflow at 501 and 320)' : ''
      }, overflowing elements = B0`, async ({ page, p2Env }) => {
        await load(page, path, w)
        const o = await page.evaluate(overflowCensus)
        expect(o.clientWidth).toBe(w)
        expect(o.scrollWidth).toBe(docWidth)
        if (docWidth === w) expect(o.elements).toEqual([])
        else expect(o.elements.length).toBeGreaterThan(0)
        await expectJsonBaseline(
          `t739-c2-${id}-${w}`,
          { url: rel(p2Env, page.url()), ...o },
          { explain: explainLines('elements') }
        )
      })
})
