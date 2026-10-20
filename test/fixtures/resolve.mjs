// ESM entry of the fixture resolver (40 §2) for the SSR stub and Playwright; the logic lives in
// resolve.cjs so that Jest (CommonJS) loads the same code.
import { createRequire } from 'node:module'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const require = createRequire(import.meta.url)
const core = require('./resolve.cjs')

export const FIXTURES_ROOT = path.dirname(fileURLToPath(import.meta.url))
export const {
  SCHEMA,
  EMPTY_SHA256,
  keyOf,
  bodySha256,
  sha256,
  toBuffer,
  servableHeaders,
  decodeBody,
  solidPng,
  TILE_PNG,
  MAGIC,
  rewriteLinks,
} = core
export const createResolver = (options = {}) =>
  core.createResolver({ root: FIXTURES_ROOT, ...options })
export default createResolver
