// T-738 (41 I; V26, V27 at scrollY 900 (Q-088); R-023, R-087): the sticky and fixed layers of the scrolled
// pages, as the app renders them today. V26 is /search/?q=climate (the design's sticky header, z-index 10000,
// over the app's fixed filters bar, z-index 11: Q-088), V27 the works and outputs pages (the sticky header over
// the content), each at 1440x900 and 375x812. T-801 holds their pixels; this test holds the layers themselves:
//   - every element whose computed position is `fixed` or `sticky` and that renders (tag, id, hash-free class
//     stems, position, top, z-index, getBoundingClientRect rounded to 1/100 px), at scrollY 0 and at scrollY 900;
//   - which layer is on top at each layer's vertical middle and 5 px below the lowest layer, at x = 5, the middle
//     and the right edge - 5 (the innermost listed layer that holds the hit element, else `content`);
//   - the same at scrollY 900 with the header expanded (the Services menu open at 1440, the hamburger nav at 375):
//     what the open header covers (the filters bar on V26, the content on V27).
// One JSON baseline per state and width, recorded with `npm run e2e:record -- --run <id> --provisional
// --project visual e2e/visual/t738-sticky-layers.spec.mjs` (host baseline) and compared deep-equal otherwise
// (e2e/lib/P1-06/baseline.mjs). Cookie state `essential` (the consent popup is the only other fixed layer).
import {
  test,
  expect,
  open,
  setFixedTime,
  loadLazyImages,
  viewportOf,
} from '../lib/P1-07/page.mjs'
import { expectJsonBaseline } from '../lib/P1-06/baseline.mjs'

test.use({ cookieState: 'essential' })
test.describe.configure({ timeout: 600000 })

const STATES = [
  ['V26', 'search', '/search/?q=climate', { bar: true, filters: true }],
  ['V27', 'works', '/works/1001/', {}],
  ['V27', 'outputs', '/outputs/2001/', {}],
]

// the header's own transitions (the nav and the lists, `transition: .15s`) have ended
const settled = (page) =>
  page.evaluate(() =>
    Promise.all(
      document
        .getAnimations()
        .filter((a) => a.effect.getTiming().iterations !== Infinity)
        .map((a) => a.finished.catch(() => null))
    ).then(() => null)
  )

// `open`: the element the expanded header shows ('menu': the Services list, 'nav': the nav of the hamburger,
// found as T-726 finds them, e2e/lib/P1-05/header.mjs); its box and what is on
// top at its vertical middle, 5 px inside its left edge, at its centre and 5 px inside its right edge
const layers = (page, open = null) =>
  page.evaluate((openKey) => {
    const round = (v) => Math.round(v * 100) / 100
    const stem = (c) => c.replace(/(-|__)[\w-]{5}$/, '')
    const renders = (el) =>
      el.getClientRects().length > 0 &&
      getComputedStyle(el).visibility !== 'hidden'
    const list = [...document.querySelectorAll('body *')].filter((el) => {
      const p = getComputedStyle(el).position
      return (p === 'fixed' || p === 'sticky') && renders(el)
    })
    const name = (el) =>
      [
        `${el.tagName.toLowerCase()}${el.id ? `#${el.id}` : ''}`,
        ...[...el.classList].map(stem),
      ].join('.')
    // the innermost listed layer that holds the element (document order: inner layers come later)
    const layerOf = (e) => {
      let found = 'content'
      for (const l of list) if (e && l.contains(e)) found = name(l)
      return e ? found : null
    }
    const w = window.innerWidth
    const xs = [5, Math.round(w / 2), w - 5]
    const hitRow = (y) =>
      xs.map((x) => layerOf(document.elementFromPoint(x, y)))
    const boxes = list.map((el) => el.getBoundingClientRect())
    const lowest = Math.max(0, ...boxes.map((b) => b.bottom))
    return {
      scrollY: window.scrollY,
      layers: list.map((el, i) => {
        const cs = getComputedStyle(el)
        const b = boxes[i]
        return {
          name: name(el),
          position: cs.position,
          top: cs.top,
          zIndex: cs.zIndex,
          box: [b.x, b.y, b.width, b.height].map(round),
        }
      }),
      hits: {
        ...Object.fromEntries(
          list.map((el, i) => [
            `middle of ${name(el)}`,
            hitRow(boxes[i].y + boxes[i].height / 2),
          ])
        ),
        'below the layers': hitRow(lowest + 5),
      },
      ...(openKey
        ? (() => {
            const header = document.querySelector('header#header')
            const toggle = header.querySelector('button[aria-controls]')
            const el =
              openKey === 'menu'
                ? document
                    .getElementById('services-title')
                    .parentElement.querySelector(':scope > ul')
                : document.getElementById(toggle.getAttribute('aria-controls'))
            const b = el.getBoundingClientRect()
            const y = b.y + b.height / 2
            return {
              open: {
                name: name(el),
                box: [b.x, b.y, b.width, b.height].map(round),
                hits: [b.x + 5, b.x + b.width / 2, b.right - 5].map((x) =>
                  layerOf(document.elementFromPoint(x, y))
                ),
              },
            }
          })()
        : {}),
    }
  }, open)

for (const [v, id, path, opts] of STATES)
  for (const w of [1440, 375])
    test.describe(`T-738 ${v} ${id} ${w}`, () => {
      test.use({ viewport: viewportOf(w) })

      test(`T-738 @P1 ${v} ${id} ${w}: the sticky and fixed layers at scrollY 0 and 900 and the layer on top (Q-088) = B0`, async ({
        page,
      }) => {
        await setFixedTime(page)
        await open(page, path, opts)
        await loadLazyImages(page)
        await page.evaluate(() =>
          window.scrollTo({ top: 0, behavior: 'instant' })
        )
        await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0)
        const top = await layers(page)
        await page.evaluate(() =>
          window.scrollTo({ top: 900, behavior: 'instant' })
        )
        await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(900)
        const scrolled = await layers(page)
        // the header is in both views, never masked
        expect(scrolled.layers.map((l) => l.name)).toContainEqual(
          expect.stringMatching(/^header#header\./)
        )
        // the header expanded over what scrolls below it
        const toggle =
          w === 1440
            ? page.getByRole('button', { name: 'Services', exact: true })
            : page.getByRole('button', { name: 'Toggle navigation' })
        await toggle.click()
        await expect(toggle).toHaveAttribute('aria-expanded', 'true')
        await settled(page)
        // (the view records scrollY: at 375 the expanded nav takes room in the sticky header and the
        // browser's scroll anchoring moves the page)
        const expanded = await layers(page, w === 1440 ? 'menu' : 'nav')
        await expectJsonBaseline(`t738-${v}-${id}-${w}`, {
          state: `${v} ${path}`,
          viewport: viewportOf(w),
          views: [top, scrolled, { header: 'expanded', ...expanded }],
        })
      })
    })
