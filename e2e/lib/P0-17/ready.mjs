// P0-17 helpers of the search-state visuals (T-801 c1): settled states (40 §5: web-first waits, expect.poll,
// no sleeps), visual readiness before every shot, a neutral pointer, lazy images, and the capture step.
//
// A search page is settled when it is hydrated, no request of the page is in flight, no Next.js route change
// is running, and that holds on two consecutive polls at least 500 ms apart (the effects that fire requests
// after a render, e.g. the filters' aggregation call and the member logos, start within that window). A shot
// is taken only on a settled page. Waits are generous: the machine runs several stacks, builds and suites at
// once, and a starved renderer needs tens of seconds for one step.
import { expect } from './harness-gaps.mjs'
import {
  LOADER_SELECTORS,
  spriteCheck,
  useBox,
  visualReady,
} from '../../fixtures/visual-ready.mjs'
import { expectPixelExact } from '../../fixtures/pixel-exact.mjs'

export const NAV_TIMEOUT = 90000

// ---------- settled state ----------

// the page's React root is hydrated: Next's hydration measure (pages router), or the root container that
// legacy ReactDOM.hydrate (React 17, synchronous) leaves on #__next
export const waitHydrated = (page) =>
  page.waitForFunction(
    () => {
      const el = document.getElementById('__next')
      if (!el) return false
      return (
        performance.getEntriesByName('Next.js-hydration').length > 0 ||
        '_reactRootContainer' in el ||
        Object.keys(el).some((k) => k.startsWith('__reactContainer$'))
      )
    },
    null,
    { timeout: NAV_TIMEOUT }
  )

// in-flight tracking of one page (requests issued by the page, incl. aborted third-party ones)
export function trackPage(page) {
  const state = { inflight: new Set(), started: 0 }
  page.on('request', (r) => {
    state.inflight.add(r)
    state.started += 1
  })
  const done = (r) => state.inflight.delete(r)
  page.on('requestfinished', done)
  page.on('requestfailed', done)
  return state
}

// router events of the hydrated app (window.next.router is the client router of Next 10): `routing` is 1 from a
// routeChangeStart until the next routeChangeComplete or routeChangeError
export async function watchRouter(page) {
  await page.waitForFunction(
    () => Boolean(window.next && window.next.router),
    null,
    { timeout: NAV_TIMEOUT }
  )
  await page.evaluate(() => {
    if (window.__p17router) return
    const w = { routing: 0 }
    window.__p17router = w
    const ev = window.next.router.events
    ev.on('routeChangeStart', () => {
      w.routing = 1
    })
    ev.on('routeChangeComplete', () => {
      w.routing = 0
    })
    ev.on('routeChangeError', () => {
      w.routing = 0
    })
  })
}

// settled: hydrated, nothing in flight, no route change, document height unchanged, on two polls 500 ms apart
export async function settle(page, tracker, { timeout = NAV_TIMEOUT } = {}) {
  let last = null
  let routing = null
  try {
    await waitHydrated(page)
    await expect
      .poll(
        async () => {
          const probe = await page
            .evaluate(() => ({
              routing: window.__p17router ? window.__p17router.routing : 0,
              height: document.documentElement.scrollHeight,
            }))
            .catch(() => ({ routing: -1, height: -1 }))
          routing = probe.routing
          const sig = `${tracker.inflight.size}|${routing}|${tracker.started}|${
            probe.height
          }|${page.url()}`
          const stable =
            sig === last && tracker.inflight.size === 0 && routing === 0
          last = sig
          return stable
        },
        { timeout, intervals: [500] }
      )
      .toBe(true)
  } catch (e) {
    e.message += `\nsettle: url ${page.url()}, routing ${routing}, in flight: ${
      [...tracker.inflight]
        .map((r) => `${r.method()} ${r.url().slice(0, 160)}`)
        .join(' | ') || 'none'
    }`
    throw e
  }
}

// let the tasks that the last render queued run: React 17 flushes passive effects (the filters' aggregation
// call starts in one) from a scheduler task after the commit. Two frames and a zero timer pass after
// everything queued before; bounded, so a stalled frame clock never hangs a test.
export const flushTasks = (page) =>
  page.evaluate(
    () =>
      new Promise((resolve) => {
        const give = setTimeout(resolve, 3000)
        const frame = (n) =>
          requestAnimationFrame(() =>
            setTimeout(() => {
              if (n > 1) return frame(n - 1)
              clearTimeout(give)
              return resolve()
            }, 0)
          )
        frame(2)
      })
  )

// ---------- one page of a state ----------

// a hard load of `path` (the clock is fixed by the caller before), settled. `bar`: the page has the header
// search bar once hydrated (search; data providers, with the label of its input as a RegExp); `filters`: the search page's filters bar fetches its
// aggregation after hydration and is waited for.
export async function open(
  page,
  path,
  { bar = false, filters = false, settled = true } = {}
) {
  const tracker = trackPage(page)
  const response = await page.goto(path)
  await waitHydrated(page)
  await watchRouter(page)
  if (!settled) return { tracker, response }
  if (bar)
    await expect(
      page.getByRole('combobox', {
        name: bar instanceof RegExp ? bar : /from papers around the world$/,
      })
    ).toBeVisible()
  if (filters) {
    await expect(page.getByText('publisher', { exact: true })).toBeAttached()
    await expect(page.locator('[class*="loading-block"]')).toHaveCount(0)
  }
  await settle(page, tracker)
  await flushTasks(page)
  await settle(page, tracker)
  return { tracker, response }
}

// ---------- shots ----------

// the mouse stays where the last click left it, and :hover styles and tooltips follow it; before a shot it
// moves to the bottom-right pixel of the viewport: page background in every state of this package (the top-left
// corner is the header logo link, which has a hover style), so the shot never depends on where the last click
// was. The same point in every engine (a coordinate outside the viewport is not portable).
export async function pointerAway(page) {
  const { width, height } = page.viewportSize()
  await page.mouse.move(width - 1, height - 1)
}

// images below the fold are loading="lazy" and stay unloaded (complete === false) until scrolled near: bring
// each into view once, wait for it, and go back to the top (visualReady waits for every image)
export async function loadLazyImages(page) {
  const count = await page.evaluate(
    () =>
      [...document.images].filter((i) => i.loading === 'lazy' && !i.complete)
        .length
  )
  if (!count) return
  await page.evaluate(async () => {
    for (const img of [...document.images]) {
      if (img.loading !== 'lazy' || img.complete) continue
      img.scrollIntoView({ block: 'center' })
      await new Promise((resolve) => {
        const t = setTimeout(resolve, 20000)
        const done = () => {
          clearTimeout(t)
          resolve()
        }
        if (img.complete) done()
        else {
          img.addEventListener('load', done, { once: true })
          img.addEventListener('error', done, { once: true })
        }
      })
    }
    window.scrollTo(0, 0)
  })
}

// visual readiness (40 §5) of V7, whose subject is a loader: every check of visualReady except "every loader is
// gone"
async function readyChecks(page, { load, loaders }) {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  if (load) await page.waitForLoadState('load')
  await page.evaluate(() =>
    document.fonts.ready.then(() => document.fonts.status)
  )
  if (loaders)
    for (const sel of LOADER_SELECTORS)
      await expect(page.locator(sel)).toHaveCount(0)
  const sprite = await spriteCheck(page)
  expect(sprite, 'sprite /static/search/icons.svg').toMatchObject({
    status: 200,
    ok: true,
  })
  await expect
    .poll(async () => (await useBox(page)).nonZero, {
      message: 'a <use> with a non-zero getBBox()',
    })
    .toBeGreaterThan(0)
  await page.waitForFunction(() =>
    [...document.images].every((i) => i.complete)
  )
}

// answer the page's own scripts (/_next/static/**.js, preloads included) with an empty script: the server
// markup stays unhydrated with JavaScript enabled, and the load event still fires (a held-back script would
// keep it from firing, and the images that CSS requests would then race the capture)
export async function emptyAppScripts(page) {
  await page.route(
    (u) => /\/_next\/static\/.+\.js$/.test(u.pathname),
    (route) =>
      route.fulfill({
        status: 200,
        headers: { 'content-type': 'application/javascript' },
        body: '',
      })
  )
}

// readiness, a neutral pointer, then one pixel-exact full-page (or viewport) capture named `<state>-<width>`
export async function capture(
  page,
  name,
  { fullPage = true, mode = 'ready' } = {}
) {
  if (mode === 'ready') await loadLazyImages(page)
  await pointerAway(page)
  // the sprite probe is one request through the proxy: a reset on a reused upstream socket (502, harness
  // issue P0-10-3) is asked again; a sprite that keeps failing still fails visualReady below
  await expect
    .poll(async () => (await spriteCheck(page)).status, {
      message: 'sprite /static/search/icons.svg',
      timeout: 30000,
    })
    .toBe(200)
  if (mode === 'loading')
    await readyChecks(page, { load: true, loaders: false })
  else if (mode === 'pre')
    await readyChecks(page, { load: false, loaders: true })
  else await visualReady(page)
  return expectPixelExact(page, name, { fullPage })
}
