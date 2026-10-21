// Capture readiness for pixel tests (40 §5): reduced motion, fonts loaded, loaders gone, lazy images loaded,
// map tiles loaded, the sprite served (200 image/svg+xml) and a <use> rendered with a non-zero box.
// Screenshot options (animations disabled, caret hidden) are applied by pixel-exact.mjs.
import { expect } from '@playwright/test'

export const LOADER_SELECTORS = [
  '[class*="loading-bar-"]',
  '[class*="styles-spinner-"]',
  '[class*="loading-block"]',
  '[class*="loading-box"]',
]

export async function spriteCheck(page) {
  const res = await page.request.get('/static/search/icons.svg')
  const type = res.headers()['content-type'] || ''
  return {
    status: res.status(),
    contentType: type,
    ok: res.status() === 200 && type.startsWith('image/svg+xml'),
  }
}

export async function useBox(page) {
  return page.evaluate(() => {
    const uses = [...document.querySelectorAll('svg use')]
    const boxes = uses.map((u) => {
      const b = u.getBBox()
      return {
        href: u.getAttribute('href') || u.getAttribute('xlink:href'),
        width: b.width,
        height: b.height,
      }
    })
    return {
      count: uses.length,
      nonZero: boxes.filter((b) => b.width > 0 && b.height > 0).length,
      first: boxes[0] || null,
    }
  })
}

// An <img loading="lazy"> far below the fold stays incomplete until the page is scrolled near it, so "every
// image complete" would never hold (a provider page at 375 px has a thumbnail 4,000 px down). Bring each
// unloaded lazy image into view once, wait for it to load or fail (bounded), and put the scroll position
// back where it was.
export async function loadLazyImages(page) {
  const pending = await page.evaluate(
    () =>
      [...document.images].filter((i) => i.loading === 'lazy' && !i.complete)
        .length
  )
  if (!pending) return 0
  await page.evaluate(async () => {
    const { scrollX, scrollY } = window
    for (const img of [...document.images]) {
      if (img.loading !== 'lazy' || img.complete) continue
      img.scrollIntoView({ block: 'center' })
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
    window.scrollTo(scrollX, scrollY)
  })
  return pending
}

// loaders: false skips "no loader is present" for a state whose subject is a loader; lazy: false skips
// loadLazyImages
export async function visualReady(
  page,
  { requireUse = true, tiles = true, loaders = true, lazy = true } = {}
) {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.waitForLoadState('load')
  await page.evaluate(() =>
    document.fonts.ready.then(() => document.fonts.status)
  )
  if (loaders)
    for (const sel of LOADER_SELECTORS)
      await expect(page.locator(sel)).toHaveCount(0)
  if (lazy) await loadLazyImages(page)
  if (tiles)
    await page.waitForFunction(() =>
      [...document.images]
        .filter((i) => /tile\.openstreetmap\.org/.test(i.currentSrc || i.src))
        .every((i) => i.complete && i.naturalWidth > 0)
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
  // images settled
  await page.waitForFunction(() =>
    [...document.images].every((i) => i.complete)
  )
  return { sprite, use: await useBox(page) }
}
