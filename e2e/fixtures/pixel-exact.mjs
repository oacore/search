// Pixel-exact screenshot comparison (40 §1): both PNGs decoded, RGBA compared exactly; pass = equal size and
// 0 differing pixels (anti-aliased pixels count). Every compared screenshot adds a `diff-pixels` annotation
// (the guard fails a test whose screenshots outnumber them), a diff PNG is attached on failure, and
// baselines are written only in record mode (RECORD=1 or --update-snapshots). Never masks, never tolerances.
import fs from 'node:fs'
import path from 'node:path'
import { test } from '@playwright/test'
import { comparePngs, COMPARATOR } from './pixel-compare.mjs'
import { loadEnv } from './guard.mjs'

export { COMPARATOR }

const recordMode = (info) =>
  process.env.RECORD === '1' || info.config.updateSnapshots === 'all'

export const SCREENSHOT_OPTIONS = {
  animations: 'disabled',
  caret: 'hide',
  scale: 'device',
}

// target: a Page (full page by default) or a Locator; name: '<state>-<width>.png'
export async function expectPixelExact(target, name, { fullPage = true } = {}) {
  const info = test.info()
  const file = name.endsWith('.png') ? name : `${name}.png`
  const isPage =
    typeof target.screenshot === 'function' && typeof target.goto === 'function'
  const actual = await target.screenshot({
    ...SCREENSHOT_OPTIONS,
    ...(isPage ? { fullPage } : {}),
  })
  const snapshot = info.snapshotPath(file)
  const env = (() => {
    try {
      return loadEnv()
    } catch {
      return null
    }
  })()
  const provisional =
    !env || env.mode !== 'docker'
      ? `host baseline (${process.platform} ${process.arch})`
      : process.env.RECORD_PROVISIONAL === '1'
      ? 'provisional'
      : null
  if (recordMode(info)) {
    fs.mkdirSync(path.dirname(snapshot), { recursive: true })
    fs.writeFileSync(snapshot, actual)
    info.annotations.push({
      type: 'diff-pixels',
      description: `recorded ${file}${provisional ? ` (${provisional})` : ''}`,
    })
    return { recorded: true, snapshot }
  }
  if (!fs.existsSync(snapshot)) {
    info.annotations.push({
      type: 'diff-pixels',
      description: `missing baseline ${file}`,
    })
    await info.attach(`${file}-actual`, {
      body: actual,
      contentType: 'image/png',
    })
    throw new Error(
      `pixel-exact: no baseline ${path.relative(
        process.cwd(),
        snapshot
      )} (record it with npm run e2e:record)`
    )
  }
  const expected = fs.readFileSync(snapshot)
  const res = comparePngs(expected, actual)
  info.annotations.push({
    type: 'diff-pixels',
    description: `${res.diffPixels} ${file}${
      provisional ? ` (${provisional})` : ''
    }`,
  })
  if (!res.sameSize || res.diffPixels !== 0) {
    await info.attach(`${file}-actual`, {
      body: actual,
      contentType: 'image/png',
    })
    await info.attach(`${file}-expected`, {
      body: expected,
      contentType: 'image/png',
    })
    if (res.diffPng)
      await info.attach(`${file}-diff`, {
        body: res.diffPng,
        contentType: 'image/png',
      })
    throw new Error(
      `pixel-exact: ${file}: ${
        res.sameSize
          ? `${res.diffPixels} differing pixels`
          : `size ${res.width} x ${res.height}`
      } (${COMPARATOR})`
    )
  }
  return { diffPixels: 0, snapshot }
}
