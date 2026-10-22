// P1-07 helpers of the P1 visual states (T-801 c1: V21, V22, V25, V27, V29-V31, V33-V35, V37, V39) and the axe
// baseline (T-803). Built on the settled-state helpers and the stand-ins of P0-17 (hydrated, nothing in flight,
// no route change, on two polls 500 ms apart; waits are generous: 40 §5 timeouts, never retries) and on the
// shared pixel tools (e2e/fixtures/pixel-exact.mjs, visual-ready.mjs).
import { test, expect } from '../P0-17/harness-gaps.mjs'
import {
  open,
  settle,
  flushTasks,
  loadLazyImages,
  pointerAway,
} from '../P0-17/ready.mjs'
import { expectPixelExact } from '../../fixtures/pixel-exact.mjs'
import { spriteCheck, visualReady } from '../../fixtures/visual-ready.mjs'

export { test, expect, open, settle, flushTasks, loadLazyImages, pointerAway }
export { setFixedTime, stubControl } from '../../fixtures/guard.mjs'

// a hard load plus the settle wait can take minutes on a heavily loaded machine (40 §5)
export const TEST_TIMEOUT = 600000

// 41 §2.5 widths with the heights of the M set; 501 and 320 are the V34 widths
const HEIGHTS = {
  1920: 1080,
  1440: 900,
  768: 1024,
  767: 900,
  501: 900,
  375: 812,
  320: 812,
}
export const viewportOf = (w) => ({ width: w, height: HEIGHTS[w] })

// the engine subset of the P1 states (41 §2.5): V37 at 1440 and 375, run by webkit and firefox in the runner
export const engines = (w) => (w === 1440 || w === 375 ? ' @engines' : '')

// ---------- settled state after an interaction ----------

// the page is quiet again after a click or a keystroke: the effects the render queued have run and nothing the
// page asked for is in flight
export async function settleAfter(page, tracker) {
  await settle(page, tracker)
  await flushTasks(page)
  await settle(page, tracker)
}

async function toTop(page) {
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }))
  await page.waitForFunction(() => window.scrollY === 0, null, {
    polling: 100,
  })
}

// ---------- captures ----------

// One pixel-exact capture named `<state>-<width>.png` (exact RGBA, a `diff-pixels` annotation, no mask, no
// tolerance). fullPage: the page from the top (the sticky header and the fixed filters bar sit where a user
// starts); a viewport capture (fullPage false) is taken where the page is scrolled to. pointer 'away' parks the
// mouse at the bottom-right pixel of the viewport (no hover style, no tooltip); 'keep' leaves it where the
// state put it (a hover state). Lazy images are loaded first when the capture is from the top. loaders false:
// the state's subject is a loader (visualReady's "no loader is present" check is skipped).
export async function capture(
  page,
  name,
  { fullPage = true, pointer = 'away', loaders = true } = {}
) {
  if (fullPage) {
    await toTop(page)
    await loadLazyImages(page)
  }
  if (pointer === 'away') await pointerAway(page)
  // the sprite probe is one request through the proxy: a reset on a reused upstream socket (502, harness issue
  // P0-10-3) is asked again; a sprite that keeps failing still fails visualReady below
  await expect
    .poll(async () => (await spriteCheck(page)).status, {
      message: 'sprite /static/search/icons.svg',
      timeout: 30000,
    })
    .toBe(200)
  await visualReady(page, { lazy: fullPage, loaders })
  return expectPixelExact(page, name, { fullPage })
}

// captures that do not stop the test at the first difference: every state of a test is captured and the test
// fails at the end naming each one
export function shots(page) {
  const failures = []
  return {
    async take(name, options) {
      try {
        await capture(page, name, options)
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

// ---------- locators ----------

// the three header menus of the design Header (Services, Support us, About) and the hamburger below 768 px
export const MENU_LABELS = ['Services', 'Support us', 'About']
export const menuButton = (page, label) =>
  page.getByRole('button', { name: label, exact: true })
export const hamburger = (page) =>
  page.getByRole('button', { name: 'Toggle navigation' })

// ---------- console views of the guard log ----------

export const consoleTexts = (guardLog) =>
  guardLog.consoleErrors.map((e) => e.text.split('\n')[0])

export const CONSOLE_409 =
  'Failed to load resource: the server responded with a status of 409 (Conflict)'
export const CONSOLE_500 =
  'Failed to load resource: the server responded with a status of 500 (Internal Server Error)'
export const CONSOLE_500_PAGE =
  '{name: Internal Server Error., message: 500 - Internal Server Error., statusCode: 500}'

// declare an expected guard violation (the test asserts on guardLog itself)
export const expectGuard = (kind) =>
  test.info().annotations.push({ type: 'guard-expect', description: kind })
