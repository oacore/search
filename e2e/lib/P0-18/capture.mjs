// P0-18: capture helpers of the content-state visuals (T-801 c1 V8-V16, V18, V36; c4 V28; 40 §1, §5).
// Same capture rules as the other visual packages: exact RGBA comparison (e2e/fixtures/pixel-exact.mjs), no
// masks, no tolerances, the fixed clock, reduced motion, fonts loaded, sprite served, a <use> with a box. A page
// is captured once it is hydrated, nothing is in flight on two polls at least 500 ms apart, every lazily loaded
// image has loaded (a full-page capture of a long page at 375 px leaves the images below Chromium's
// lazy-loading margin empty otherwise: the page is scrolled through once and back to the top) and the layout
// height has stopped changing. Waits are generous (40 §5: timeouts, never retries): the machine runs several
// stacks, builds and suites at once.
import fs from 'node:fs'
import path from 'node:path'
import { test, expect } from './harness-gaps.mjs'
import { setFixedTime } from '../../fixtures/guard.mjs'
import {
  visualReady,
  spriteCheck,
  useBox,
} from '../../fixtures/visual-ready.mjs'
import {
  expectPixelExact,
  SCREENSHOT_OPTIONS,
} from '../../fixtures/pixel-exact.mjs'
import { comparePngs } from '../../fixtures/pixel-compare.mjs'

export const NAV_TIMEOUT = 90000
export const TEST_TIMEOUT = 360000

// 41 §2.5: M = 1920x1080, 1440x900, 768x1024, 767x900, 375x812; 950 is V18's special width
const HEIGHTS = {
  1920: 1080,
  1440: 900,
  950: 900,
  768: 1024,
  767: 900,
  375: 812,
}
export const M = [1920, 1440, 768, 767, 375]
export const TWO = [1440, 375]
export const sizeOf = (w) => ({ width: w, height: HEIGHTS[w] })
// the engine subset (41 §2.5): WebKit and Firefox run the tests tagged @engines (playwright.config.mjs)
export const engines = (w) => (w === 1440 || w === 375 ? ' @engines' : '')

// ---------- readiness ----------

// the page's React root is hydrated (Next's hydration measure, or the root container of ReactDOM.hydrate)
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

// in-flight tracking of one page (requests issued by the page, incl. aborted third-party ones)
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

// a click scrolls its target into view; the captures are taken at the top of the page (the sticky header is in
// the shot where a user starts, and the fixed modal layer sits in the first viewport)
async function toTop(page) {
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }))
  await page.waitForFunction(() => window.scrollY === 0, null, {
    timeout: NAV_TIMEOUT,
    polling: 100,
  })
}

// scroll through the page once so every lazily loaded image starts loading, wait until all of them are done,
// return to the top
async function loadLazyImages(page) {
  await page.evaluate(async () => {
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
    const step = Math.max(200, Math.floor(window.innerHeight / 2))
    for (let y = 0; y < document.documentElement.scrollHeight; y += step) {
      window.scrollTo({ top: y, behavior: 'instant' })
      await sleep(40)
    }
    window.scrollTo({
      top: document.documentElement.scrollHeight,
      behavior: 'instant',
    })
    await sleep(40)
    window.scrollTo({ top: 0, behavior: 'instant' })
  })
  await page.waitForFunction(
    () => [...document.images].every((i) => i.complete),
    null,
    { timeout: NAV_TIMEOUT, polling: 250 }
  )
  await page.waitForFunction(() => window.scrollY === 0, null, {
    timeout: NAV_TIMEOUT,
    polling: 100,
  })
}

// nothing in flight (requests `ignore` matches excepted), no layout change, the same url, on two polls at
// least 500 ms apart
export async function quiet(
  page,
  tracker,
  { timeout = NAV_TIMEOUT, ignore = () => false } = {}
) {
  let last = null
  try {
    await expect
      .poll(
        async () => {
          const height = await page
            .evaluate(() => document.documentElement.scrollHeight)
            .catch(() => -1)
          const open = [...tracker.inflight].filter((r) => !ignore(r)).length
          const sig = `${open}|${tracker.started}|${height}|${page.url()}`
          const stable = sig === last && open === 0
          last = sig
          return stable
        },
        { timeout, intervals: [500] }
      )
      .toBe(true)
  } catch (e) {
    e.message += `\nquiet: in flight: ${
      [...tracker.inflight]
        .filter((r) => !ignore(r))
        .map((r) => `${r.method()} ${r.url().slice(0, 160)}`)
        .join(' | ') || 'none'
    }`
    throw e
  }
}

// the readiness of visualReady without its loader wait: for the one state that is a loader (V12)
async function readyWithLoaders(page, { requireUse }) {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.waitForLoadState('load')
  await page.evaluate(() =>
    document.fonts.ready.then(() => document.fonts.status)
  )
  const sprite = await spriteCheck(page)
  expect(sprite, 'sprite /static/search/icons.svg').toMatchObject({
    status: 200,
    ok: true,
  })
  if (requireUse)
    await expect
      .poll(async () => (await useBox(page)).nonZero, {
        message: 'a <use> with a non-zero getBBox()',
      })
      .toBeGreaterThan(0)
  await page.waitForFunction(
    () => [...document.images].every((i) => i.complete),
    null,
    { timeout: NAV_TIMEOUT, polling: 250 }
  )
}

// open a page at a width; returns the page tracker
export async function visit(
  page,
  url,
  width,
  { status = 200, referer, hydrate = true } = {}
) {
  page.setDefaultTimeout(NAV_TIMEOUT)
  page.setDefaultNavigationTimeout(NAV_TIMEOUT)
  await page.setViewportSize(sizeOf(width))
  await setFixedTime(page)
  const tracker = track(page)
  const response = await page.goto(url, {
    timeout: NAV_TIMEOUT,
    ...(referer ? { referer } : {}),
  })
  expect(response.status(), `GET ${url}`).toBe(status)
  if (hydrate) await waitHydrated(page)
  return tracker
}

// open a page of a JavaScript-off context at a width (V28, V36 SSR): no hydration, no fixed clock (no script runs)
export async function visitStatic(page, url, width, { status = 200 } = {}) {
  page.setDefaultTimeout(NAV_TIMEOUT)
  page.setDefaultNavigationTimeout(NAV_TIMEOUT)
  await page.setViewportSize(sizeOf(width))
  const tracker = track(page)
  const response = await page.goto(url, { timeout: NAV_TIMEOUT })
  expect(response.status(), `GET ${url}`).toBe(status)
  return tracker
}

// the server-rendered page is ready for pixels: loaded, quiet, fonts, sprite, a <use> with a box, images done
// (images load eagerly when scripting is off, so nothing is scrolled)
export async function prepareStatic(page, tracker) {
  await page.waitForLoadState('load')
  await quiet(page, tracker)
  await visualReady(page, { requireUse: true, tiles: true })
  await quiet(page, tracker)
}

// bring the page to the state of the capture: images loaded, quiet, ready for pixels
export async function prepare(
  page,
  tracker,
  { requireUse = true, tiles = true, loaders = true, ignore, lazy = true } = {}
) {
  await quiet(page, tracker, { ignore })
  if (lazy) {
    await loadLazyImages(page)
    await quiet(page, tracker, { ignore })
  }
  if (loaders) await visualReady(page, { requireUse, tiles })
  else await readyWithLoaders(page, { requireUse })
}

// after an interaction on a prepared page (a modal opened, a menu, a typed value): the page is quiet again and
// everything it loaded for the new state is done. The page is not scrolled (a scroll could close a popup).
export async function afterAction(
  page,
  tracker,
  { requireUse = true, tiles = true, loaders = true, ignore } = {}
) {
  await toTop(page)
  // the pointer rests in the corner: a hover style under the pointer is not part of the state
  await page.mouse.move(0, 0)
  await quiet(page, tracker, { ignore })
  if (loaders) await visualReady(page, { requireUse, tiles })
  else await readyWithLoaders(page, { requireUse })
  await quiet(page, tracker, { ignore })
}

// ---------- captures ----------

// pixel-exact captures that do not stop the test at the first difference: every state of a test is captured,
// the test fails at the end naming each one
export function shots(page) {
  const failures = []
  return {
    async take(name, { fullPage = true } = {}) {
      expect(
        await page.evaluate(() => window.scrollY),
        `${name}: the page is captured at the top`
      ).toBe(0)
      try {
        await expectPixelExact(page, name, { fullPage })
      } catch (e) {
        if (!/^pixel-exact:/.test(String(e.message))) throw e
        failures.push(e.message)
      }
    },
    done() {
      expect(failures, 'pixel-exact differences').toEqual([])
    },
  }
}

// dark scheme (41 §2.5): there is no dark mode (V20), so the capture under `prefers-color-scheme: dark` is the
// light baseline at 0 px. Compared to the baseline of the light test (the same file name), never recorded.
export async function expectLightBaseline(
  page,
  name,
  { fullPage = true } = {}
) {
  const info = test.info()
  const file = name.endsWith('.png') ? name : `${name}.png`
  const actual = await page.screenshot({ ...SCREENSHOT_OPTIONS, fullPage })
  if (process.env.RECORD === '1' || info.config.updateSnapshots === 'all') {
    info.annotations.push({
      type: 'diff-pixels',
      description: `dark capture of ${file}: not recorded, compared against the light baseline in compare mode`,
    })
    return { recorded: false }
  }
  const snapshot = info.snapshotPath(file)
  if (!fs.existsSync(snapshot)) {
    info.annotations.push({
      type: 'diff-pixels',
      description: `missing light baseline ${file}`,
    })
    throw new Error(
      `pixel-exact: no light baseline ${path.relative(
        process.cwd(),
        snapshot
      )} for the dark capture (record the light test first)`
    )
  }
  const res = comparePngs(fs.readFileSync(snapshot), actual)
  info.annotations.push({
    type: 'diff-pixels',
    description: `${res.diffPixels} ${file} (dark vs the light baseline)`,
  })
  if (!res.sameSize || res.diffPixels !== 0) {
    await info.attach(`${file}-dark-actual`, {
      body: actual,
      contentType: 'image/png',
    })
    if (res.diffPng)
      await info.attach(`${file}-dark-diff`, {
        body: res.diffPng,
        contentType: 'image/png',
      })
    throw new Error(
      `pixel-exact: ${file}: dark capture ${
        res.sameSize
          ? `${res.diffPixels} differing pixels`
          : `size ${res.width} x ${res.height}`
      } from the light baseline`
    )
  }
  return { diffPixels: 0 }
}

// the page's own console error texts, for the two states that log a resource error (works 1007 / outputs 2006)
export const consoleTexts = (guardLog) =>
  guardLog.consoleErrors.map((e) => e.text.split('\n')[0])

// declare an expected guard violation (negative control: the test asserts on guardLog itself)
export const expectGuard = (kind) =>
  test.info().annotations.push({ type: 'guard-expect', description: kind })
