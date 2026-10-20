// Capture readiness for pixel tests (40 §5): reduced motion, fonts loaded, loaders gone, map tiles
// loaded, the sprite served (200 image/svg+xml) and a <use> rendered with a non-zero box.
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

export async function visualReady(
  page,
  { requireUse = true, tiles = true } = {}
) {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.waitForLoadState('load')
  await page.evaluate(() =>
    document.fonts.ready.then(() => document.fonts.status)
  )
  for (const sel of LOADER_SELECTORS)
    await expect(page.locator(sel)).toHaveCount(0)
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
