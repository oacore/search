// P0-17 dark subset of V1 (41 §2.5, T-801 c1): no dark mode exists (V20), so the page rendered for
// `colorScheme: 'dark'` equals the light capture at 0 px (exact RGBA, e2e/fixtures/pixel-compare.mjs).
// Two comparisons, both pixel-exact and without masks:
//   1. the same page state captured twice, with the dark scheme (the context's) and then with the light scheme
//      (page.emulateMedia): a `prefers-color-scheme` rule anywhere in the page would make them differ;
//   2. the dark shot against the light baseline of the same state (`V1-<width>.png`, the file the light V1 test
//      compares with), except while baselines are being recorded (the light one may not exist yet).
import fs from 'node:fs'
import { test } from '../../fixtures/guard.mjs'
import { expect } from './harness-gaps.mjs'
import { comparePngs } from '../../fixtures/pixel-compare.mjs'
import { SCREENSHOT_OPTIONS } from '../../fixtures/pixel-exact.mjs'
import { visualReady } from '../../fixtures/visual-ready.mjs'
import { loadLazyImages, pointerAway } from './ready.mjs'

const recordMode = (info) =>
  process.env.RECORD === '1' || info.config.updateSnapshots === 'all'

export async function darkEqualsLight(page, name) {
  const info = test.info()
  const note = (text) =>
    info.annotations.push({ type: 'diff-pixels', description: text })

  await loadLazyImages(page)
  await pointerAway(page)
  await visualReady(page)
  expect(
    await page.evaluate(
      () => matchMedia('(prefers-color-scheme: dark)').matches
    )
  ).toBe(true)
  const dark = await page.screenshot({ ...SCREENSHOT_OPTIONS, fullPage: true })

  await page.emulateMedia({ colorScheme: 'light' })
  expect(
    await page.evaluate(
      () => matchMedia('(prefers-color-scheme: dark)').matches
    )
  ).toBe(false)
  await visualReady(page)
  const light = await page.screenshot({ ...SCREENSHOT_OPTIONS, fullPage: true })

  const same = comparePngs(light, dark)
  note(`${same.diffPixels} ${name} dark vs light (same state)`)
  if (!same.sameSize || same.diffPixels !== 0) {
    await info.attach('dark', { body: dark, contentType: 'image/png' })
    await info.attach('light', { body: light, contentType: 'image/png' })
    if (same.diffPng)
      await info.attach('diff', {
        body: same.diffPng,
        contentType: 'image/png',
      })
  }
  expect(same).toMatchObject({ sameSize: true, diffPixels: 0 })

  if (recordMode(info)) {
    note(`recording ${name}: the light baseline is not compared`)
    return
  }
  const baseline = info.snapshotPath(name)
  expect(
    fs.existsSync(baseline),
    `light baseline ${name} (record it with npm run e2e:record)`
  ).toBe(true)
  const against = comparePngs(fs.readFileSync(baseline), dark)
  note(`${against.diffPixels} ${name} dark vs the light baseline`)
  if (!against.sameSize || against.diffPixels !== 0) {
    await info.attach(`${name}-actual`, {
      body: dark,
      contentType: 'image/png',
    })
    await info.attach(`${name}-expected`, {
      body: fs.readFileSync(baseline),
      contentType: 'image/png',
    })
    if (against.diffPng)
      await info.attach(`${name}-diff`, {
        body: against.diffPng,
        contentType: 'image/png',
      })
  }
  expect(against).toMatchObject({ sameSize: true, diffPixels: 0 })
}
