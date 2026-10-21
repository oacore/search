// P0-11 helpers: repository paths, the committed JSON writer (prettier, so `npm run lint:json` stays clean,
// 40 §7 rule 7) and the run's build facts.
import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'

export const REPO = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
  '..',
  '..'
)
export const ARTIFACT_DIR = path.resolve(
  process.env.ARTIFACT_DIR || path.join(REPO, '..', 'search-upgrade-artifacts')
)
const requireRoot = createRequire(path.join(REPO, 'package.json'))

export const readJson = (file, fallback) => {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'))
  } catch (e) {
    if (fallback !== undefined) return fallback
    throw e
  }
}

export function writeJsonPretty(file, obj) {
  const prettier = requireRoot('prettier')
  const options = prettier.resolveConfig.sync(file) || {}
  const text = prettier.format(JSON.stringify(obj), {
    ...options,
    filepath: file,
    parser: 'json',
  })
  fs.mkdirSync(path.dirname(file), { recursive: true })
  fs.writeFileSync(file, text)
  return file
}

// record mode (40 §10 `e2e:record`): RECORD=1, provisional captures of 2.3 add RECORD_PROVISIONAL=1
export const RECORD = process.env.RECORD === '1'
export const LINK =
  process.env.RECORD_PROVISIONAL === '1' ? 'provisional-2.3' : 'B0-local'

// the reference a capture belongs to (no timestamps: three captures of one image must be byte-identical, 42 §6)
export const referenceOf = (env) => ({
  mode: env.mode,
  commit: (env.build || env.image || {}).commit || null,
  build: (env.build || {}).key || (env.image || {}).imageId || null,
  variant: (env.build || env.image || {}).variant || null,
  proxyOverlay: env.proxy ? env.proxy.overlay : null,
})

export const images = () =>
  readJson(path.join(ARTIFACT_DIR, 'images.json'), { builds: {} }).builds
