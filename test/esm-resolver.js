// Jest resolver for the ESM allow-list (40 §2.1, VF-07). Jest always loads
// `.mjs` files as native ESM, which CommonJS tests cannot require, so
// transformIgnorePatterns alone cannot admit allow-listed packages that ship
// `.mjs` builds (msw 2.15 needs rettime and @open-draft/deferred-promise). For
// those files this resolver returns a CommonJS copy (ESM syntax -> CommonJS
// only, nothing else changed) under node_modules/.cache/esm-allow-shim/,
// regenerated whenever the source changes; requests made from a copy resolve as
// if made from the original file. Everything else resolves exactly as Jest's
// default resolver.
const fs = require('fs')
const path = require('path')
const crypto = require('crypto')

const ROOT = path.resolve(__dirname, '..')
const NODE_MODULES = path.join(ROOT, 'node_modules')
const CACHE = path.join(NODE_MODULES, '.cache', 'esm-allow-shim')
const allowList = require('./esm-allow-list.json').packages.map(
  (p) =>
    new RegExp(
      `^${p.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '[^/]+')}/`
    )
)

const packagePathOf = (file) => {
  const rel = path.relative(NODE_MODULES, file)
  if (rel.startsWith('..')) return null
  // last node_modules segment wins (nested installs)
  const parts = rel.split(path.sep)
  const i = parts.lastIndexOf('node_modules')
  return parts.slice(i + 1).join('/')
}
const isAllowed = (file) => {
  const p = packagePathOf(file)
  return p !== null && allowList.some((re) => re.test(p))
}

let babel = null
const toCommonJs = (source, filename) => {
  babel = babel || require('@babel/core')
  return babel.transformSync(source, {
    filename,
    babelrc: false,
    configFile: false,
    sourceType: 'module',
    plugins: [require.resolve('@babel/plugin-transform-modules-commonjs')],
  }).code
}

const shimFor = (file) => {
  const target = path
    .join(CACHE, path.relative(NODE_MODULES, file))
    .replace(/\.mjs$/, '.cjs')
  const source = fs.readFileSync(file, 'utf8')
  const stamp = crypto.createHash('sha256').update(source).digest('hex')
  const stampFile = `${target}.sha256`
  if (
    !fs.existsSync(target) ||
    !fs.existsSync(stampFile) ||
    fs.readFileSync(stampFile, 'utf8') !== stamp
  ) {
    fs.mkdirSync(path.dirname(target), { recursive: true })
    fs.writeFileSync(target, toCommonJs(source, file))
    fs.writeFileSync(stampFile, stamp)
  }
  return target
}

module.exports = (request, options) => {
  let { basedir } = options
  if (basedir.startsWith(CACHE + path.sep))
    basedir = path.join(NODE_MODULES, path.relative(CACHE, basedir))
  const resolved = options.defaultResolver(request, { ...options, basedir })
  if (resolved.endsWith('.mjs') && isAllowed(resolved)) return shimFor(resolved)
  return resolved
}

module.exports.CACHE = CACHE
