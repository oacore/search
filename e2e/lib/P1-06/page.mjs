// P1-06 page helpers (T-718, T-724, T-739, T-805): open a page at a viewport, wait until it is settled (40 §5
// "settled states only": web-first waits and polls, no sleeps), and bring it to a neutral capture state.
//
// A page is settled when it is hydrated, no request of the page is in flight, no Next.js route change runs,
// the document height and the URL are unchanged, and all of that holds on two polls at least 500 ms apart (the
// effects that start requests after a render, such as the filters' aggregation call and the member logos,
// start within that window). Waits are generous: the machine runs several stacks, builds and suites at once
// and a starved renderer needs tens of seconds for one step (at a 1-minute load average above 100, a page
// load whose requests had all ended took more than 150 s to fire its load event; 40 §5: timeouts, never
// retries).
import { expect, setFixedTime } from '../../fixtures/guard.mjs'

export const NAV_TIMEOUT = 300000
export const ACTION_TIMEOUT = 120000
export const EXPECT_TIMEOUT = 90000
export const TEST_TIMEOUT = 900000

export const slow = expect.configure({ timeout: EXPECT_TIMEOUT })

// heights of the 41 §2.5 widths; the sweep widths (T-739) have no height in 41 and use 900 (the height of the
// 1440 and 767 entries of M)
const HEIGHTS = { 1920: 1080, 1440: 900, 768: 1024, 767: 900, 375: 812 }
export const sizeOf = (width) => ({ width, height: HEIGHTS[width] || 900 })

// the page's React root is hydrated (Next's hydration measure, or the container legacy ReactDOM.hydrate
// leaves on #__next)
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
    { timeout: NAV_TIMEOUT, polling: 250 }
  )

// requests the page issued and that have not ended (aborted third-party requests end as failed)
export function track(page) {
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

// router events of the hydrated app (window.next.router is the client router of Next 10), once per document
export async function watchRouter(page) {
  await page.waitForFunction(
    () => Boolean(window.next && window.next.router),
    null,
    { timeout: NAV_TIMEOUT, polling: 250 }
  )
  await page.evaluate(() => {
    if (window.__p106router) return
    const w = { routing: 0 }
    window.__p106router = w
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

export async function quiet(
  page,
  tracker,
  { timeout = NAV_TIMEOUT, ignore = () => false } = {}
) {
  let last = null
  let probe = null
  try {
    await expect
      .poll(
        async () => {
          probe = await page
            .evaluate(() => ({
              routing: window.__p106router ? window.__p106router.routing : 0,
              height: document.documentElement.scrollHeight,
            }))
            .catch(() => ({ routing: -1, height: -1 }))
          const open = [...tracker.inflight].filter((r) => !ignore(r)).length
          const sig = `${open}|${tracker.started}|${probe.routing}|${
            probe.height
          }|${page.url()}`
          const stable = sig === last && open === 0 && probe.routing === 0
          last = sig
          return stable
        },
        { timeout, intervals: [500] }
      )
      .toBe(true)
  } catch (e) {
    e.message += `\nquiet: url ${page.url()}, ${JSON.stringify(
      probe
    )}, in flight: ${
      [...tracker.inflight]
        .filter((r) => !ignore(r))
        .map((r) => `${r.method()} ${r.url().slice(0, 160)}`)
        .join(' | ') || 'none'
    }`
    throw e
  }
}

// a hard load of `path` at `width` (height per sizeOf), with the fixed clock (the year filter's upper bound
// is computed from Date at module load), hydrated and quiet
export async function openAt(
  page,
  path,
  width,
  { status = 200, height, hydrate = true, settled = true } = {}
) {
  page.setDefaultTimeout(ACTION_TIMEOUT)
  page.setDefaultNavigationTimeout(NAV_TIMEOUT)
  await page.setViewportSize(height ? { width, height } : sizeOf(width))
  await setFixedTime(page)
  const tracker = track(page)
  const response = await page.goto(path)
  expect(response.status(), `GET ${path}`).toBe(status)
  if (hydrate) {
    await waitHydrated(page)
    await watchRouter(page)
  }
  if (settled) await quiet(page, tracker)
  return { tracker, response }
}

// The app is one Node process: a server render of the 7 MB /data-providers page keeps its event loop busy for
// seconds, and Next 10's route loader gives a client navigation 3.8 s to fetch the target route's assets
// before it falls back to a document load. A step that pins a client navigation first waits until the app
// answers three health probes in a row within a second each. (The probe goes to the app itself.)
export async function appQuiet(p2Env) {
  let fast = 0
  await expect
    .poll(
      async () => {
        const t0 = Date.now()
        const res = await fetch(`${p2Env.appURL}/api/healthz/`).catch(
          () => null
        )
        fast = res && res.ok && Date.now() - t0 < 1000 ? fast + 1 : 0
        return fast >= 3
      },
      { timeout: NAV_TIMEOUT, intervals: [250] }
    )
    .toBe(true)
}

// scroll through the page once so that every image with loading=lazy starts loading, wait for all images,
// return to the top (geometry and computed values of an image depend on its natural size)
export async function loadImages(page) {
  await page.evaluate(async () => {
    const lazy = [...document.images].filter(
      (i) => i.loading === 'lazy' && !i.complete
    )
    for (const img of lazy) {
      img.scrollIntoView({ block: 'center', behavior: 'instant' })
      await new Promise((resolve) => {
        const timer = setTimeout(resolve, 20000)
        const done = () => {
          clearTimeout(timer)
          resolve()
        }
        if (img.complete) done()
        else {
          img.addEventListener('load', done, { once: true })
          img.addEventListener('error', done, { once: true })
        }
      })
    }
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' })
  })
  await page.waitForFunction(
    () =>
      [...document.images].every((i) => i.complete) &&
      window.scrollY === 0 &&
      window.scrollX === 0,
    null,
    { timeout: NAV_TIMEOUT, polling: 250 }
  )
}

// fonts loaded and every tile or image complete
export async function fontsAndImages(page) {
  await page.evaluate(() => document.fonts.ready.then(() => true))
  await loadImages(page)
}

// The pointer after a click rests on the clicked element, and :hover follows it. Before a census it moves to
// the first of a fixed list of viewport points whose element (and its ancestors) is neither interactive nor
// a pointer target, so the state never depends on where the last click was. The same rule in every engine.
export async function neutralPointer(page) {
  const point = await page.evaluate(() => {
    const W = window.innerWidth
    const H = window.innerHeight
    const candidates = [
      [W - 1, H - 1],
      [1, H - 1],
      [W - 1, Math.floor(H / 2)],
      [1, Math.floor(H / 2)],
      [Math.floor(W / 2), H - 1],
      [W - 1, Math.floor(H / 4)],
      [1, Math.floor(H / 4)],
    ]
    const INTERACTIVE = [
      'a',
      'button',
      'input',
      'select',
      'textarea',
      'label',
      'summary',
      '[tabindex]',
      ...[
        'button',
        'link',
        'checkbox',
        'radio',
        'option',
        'menuitem',
        'tab',
        'switch',
        'combobox',
        'textbox',
        'slider',
      ].map((r) => `[role="${r}"]`),
    ].join(', ')
    const neutral = ([x, y]) => {
      let el = document.elementFromPoint(x, y)
      if (!el) return false
      if (el.closest(INTERACTIVE)) return false
      for (; el; el = el.parentElement)
        if (getComputedStyle(el).cursor === 'pointer') return false
      return true
    }
    return candidates.find(neutral) || candidates[0]
  })
  await page.mouse.move(point[0], point[1])
  return point
}

export const rel = (p2Env, url) =>
  url.startsWith(p2Env.baseURL) ? url.slice(p2Env.baseURL.length) : url

export const stackOrigins = (p2Env) =>
  [p2Env.baseURL, p2Env.allowURL, p2Env.appURL]
    .filter(Boolean)
    .map((u) => new URL(u).origin)
