// Jest resolver for the ESM allow-list (40 §2.1, VF-07). Jest always loads
// `.mjs` files as native ESM, which CommonJS tests cannot require, so
// transformIgnorePatterns alone cannot admit allow-listed packages that ship
// `.mjs` builds (msw 2.15 needs rettime and @open-draft/deferred-promise), or
// `.js` files under a `"type": "module"` package.json, which Jest loads as
// native ESM too (msw 3 needs @mswjs/interceptors 0.45). For those files this resolver returns a CommonJS copy (ESM syntax -> CommonJS
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
// `import.meta.url` (no CommonJS form) becomes the original file's URL, so
// paths resolved against it stay those of the package (@mswjs/interceptors)
const toCommonJs = (source, filename) => {
  babel = babel || require('@babel/core')
  const url = JSON.stringify(require('url').pathToFileURL(filename).href)
  return babel.transformSync(source.replace(/\bimport\.meta\.url\b/g, url), {
    filename,
    babelrc: false,
    configFile: false,
    sourceType: 'module',
    plugins: [require.resolve('@babel/plugin-transform-modules-commonjs')],
  }).code
}

// the "type" of the nearest package.json (per directory, cached)
const typeCache = new Map()
const packageTypeOf = (dir) => {
  if (typeCache.has(dir)) return typeCache.get(dir)
  let type = 'commonjs'
  const pj = path.join(dir, 'package.json')
  if (fs.existsSync(pj)) type = JSON.parse(fs.readFileSync(pj, 'utf8')).type
  else if (path.dirname(dir) !== dir && dir !== NODE_MODULES)
    type = packageTypeOf(path.dirname(dir))
  typeCache.set(dir, type)
  return type
}
const isEsm = (file) =>
  file.endsWith('.mjs') ||
  (file.endsWith('.js') && packageTypeOf(path.dirname(file)) === 'module')

const shimFor = (file) => {
  const target = path
    .join(CACHE, path.relative(NODE_MODULES, file))
    .replace(/\.m?js$/, '.cjs')
  const source = fs.readFileSync(file, 'utf8')
  // the transform's own text is part of the stamp: a changed shim rule
  // regenerates the copies
  const stamp = crypto
    .createHash('sha256')
    .update(source)
    .update(toCommonJs.toString())
    .digest('hex')
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
  if (isAllowed(resolved) && isEsm(resolved)) return shimFor(resolved)
  return resolved
}

module.exports.CACHE = CACHE
