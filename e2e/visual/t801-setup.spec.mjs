// T-801 c2, c3, c5 (41 I): the visual tier's own setup, proven on one state. c2 exact comparator without
// masks; c3 animations off, fonts ready, header in the capture; c5 sprite 200 image/svg+xml and a <use> with
// a non-zero box. The page states V1-V39 (c1) and V28 (c4) are written by their packages.
import fs from 'node:fs'
import { test, expect } from '../fixtures/guard.mjs'
import { CHROMIUM_CAPTURE_ARGS } from '../fixtures/constants.mjs'
import { comparePngs, COMPARATOR } from '../fixtures/pixel-compare.mjs'
import { SCREENSHOT_OPTIONS } from '../fixtures/pixel-exact.mjs'
import { visualReady, spriteCheck, useBox } from '../fixtures/visual-ready.mjs'

const AA = [
  'test/static/fixtures/t012/aa-a.png',
  'test/static/fixtures/t012/aa-b.png',
]

test.describe('T-801 @P0 visual setup', () => {
  test.use({ viewport: { width: 1440, height: 900 } })

  test('T-801 c2 @P0 exact comparator, no masks: one state captured twice is 0 px apart, an anti-aliased-only pair is not', async ({
    page,
  }) => {
    await page.goto('/search/?q=harnessdoi')
    await visualReady(page)
    const a = await page.screenshot({ ...SCREENSHOT_OPTIONS, fullPage: true })
    const b = await page.screenshot({ ...SCREENSHOT_OPTIONS, fullPage: true })
    const same = comparePngs(a, b)
    test
      .info()
      .annotations.push(
        { type: 'diff-pixels', description: `${same.diffPixels} capture-1` },
        { type: 'diff-pixels', description: `${same.diffPixels} capture-2` }
      )
    expect(COMPARATOR).toBe('exact-rgba-v1')
    expect(same).toMatchObject({ sameSize: true, diffPixels: 0 })
    const aa = comparePngs(fs.readFileSync(AA[0]), fs.readFileSync(AA[1]))
    expect(aa.diffPixels).toBe(24)
    expect(Object.keys(SCREENSHOT_OPTIONS).sort()).toEqual([
      'animations',
      'caret',
      'scale',
    ])
  })

  test('T-801 c3 @P0 animations off, document.fonts ready, reduced motion, header inside the capture', async ({
    page,
    browserName,
  }) => {
    await page.goto('/search/?q=harnessdoi')
    await visualReady(page)
    expect(SCREENSHOT_OPTIONS).toMatchObject({
      animations: 'disabled',
      caret: 'hide',
    })
    // Chromium rasterises every tile in full (partial raster makes captures of one page differ by a level)
    if (browserName === 'chromium')
      expect(test.info().project.use.launchOptions.args).toEqual(
        CHROMIUM_CAPTURE_ARGS
      )
    expect(await page.evaluate(() => document.fonts.status)).toBe('loaded')
    expect(
      await page.evaluate(
        () => matchMedia('(prefers-reduced-motion: reduce)').matches
      )
    ).toBe(true)
    const banner = await page.getByRole('banner').boundingBox()
    expect(banner).not.toBeNull()
    const shot = await page.screenshot({
      ...SCREENSHOT_OPTIONS,
      fullPage: true,
    })
    const { decodePng } = await import('../fixtures/pixel-compare.mjs')
    const png = decodePng(shot)
    // the header region is rendered, not masked: more than one colour inside its box
    const colours = new Set()
    for (
      let y = Math.floor(banner.y);
      y < Math.min(png.height, Math.ceil(banner.y + banner.height));
      y += 2
    )
      for (
        let x = Math.floor(banner.x);
        x < Math.min(png.width, Math.ceil(banner.x + banner.width));
        x += 2
      ) {
        const o = (y * png.width + x) * 4
        colours.add(
          (png.data[o] << 16) | (png.data[o + 1] << 8) | png.data[o + 2]
        )
      }
    test.info().annotations.push({
      type: 'diff-pixels',
      description: `n/a header-colours ${colours.size}`,
    })
    expect(colours.size).toBeGreaterThan(1)
    expect(png.width).toBe(1440)
  })

  test('T-801 c5 @P0 setup: sprite 200 image/svg+xml and a <use> with a non-zero getBBox()', async ({
    page,
  }) => {
    await page.goto('/search/?q=harnessdoi')
    const ready = await visualReady(page)
    expect(ready.sprite).toMatchObject({ status: 200, ok: true })
    expect(ready.sprite.contentType).toMatch(/^image\/svg\+xml/)
    expect((await spriteCheck(page)).status).toBe(200)
    const use = await useBox(page)
    expect(use.count).toBeGreaterThan(0)
    expect(use.nonZero).toBeGreaterThan(0)
    expect(use.first.href).toMatch(/^\/static\/search\/icons\.svg#/)
  })
})
