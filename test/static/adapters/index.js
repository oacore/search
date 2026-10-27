// Build-artefact adapters (40 §3 layer A, 40 §8 rule 7): readers of the
// version-specific `.next` layout plus the version-independent views T-003,
// T-004, T-005, T-010 (and T-007, read-only) compare. Input = the app
// directory of the local parity build (APP_ROOT; its .next is NEXT_DIR), the
// layout an image's /app has too.
//
// A reader is chosen by detect(); today only Next 10 (./next10.js). A new
// reader must reproduce the recorded outputs on the golden build (the
// reference of ./reference.js) before it reads a candidate.
const fs = require('fs')
const path = require('path')
const crypto = require('crypto')

const next10 = require('./next10')
const { positionsOf } = require('./sourcemap')

const ROOT = path.resolve(__dirname, '..', '..', '..')
const READERS = [next10]

// Files of an APP_ROOT the static tests read (relative paths; `.next/cache`
// is never read). The build-derived baseline (42 §6 item 2) needs these, with
// `.next/` stored as `next/` in test/baseline/build/ (./reference.js).
const INPUTS = [
  '.next/BUILD_ID',
  '.next/build-manifest.json',
  '.next/routes-manifest.json',
  '.next/server/pages-manifest.json',
  '.next/server/**/*.js',
  '.next/server/**/*.js.map',
  '.next/static/css/*',
  '.next/static/chunks/**',
  '.next/static/media/*',
  '.next/static/images/*',
  'public/icons.svg',
  'public/design/icons.svg',
  'public/images/**',
  'public/static/images/**',
]

const sha256 = (data) => crypto.createHash('sha256').update(data).digest('hex')

const byCodePoint = (a, b) => (a < b ? -1 : Number(a > b))

const sortObject = (obj) =>
  Object.fromEntries(
    Object.keys(obj)
      .sort(byCodePoint)
      .map((k) => [k, obj[k]])
  )

// NEXT_DIR (required) and APP_ROOT (default: the directory holding NEXT_DIR)
function buildDirs(testId, env = process.env) {
  if (!env.NEXT_DIR) {
    throw new Error(
      `${testId} needs NEXT_DIR (.next of a local parity build) and APP_ROOT`
    )
  }
  const nextDir = path.resolve(env.NEXT_DIR)
  const appRoot = env.APP_ROOT
    ? path.resolve(env.APP_ROOT)
    : path.dirname(nextDir)
  return { nextDir, appRoot }
}

function openBuild({ nextDir, appRoot }) {
  const reader = READERS.find((r) => r.detect(nextDir))
  if (!reader) {
    throw new Error(
      `no build-artefact reader for ${nextDir} (40 §8 rule 7: add one and prove it on the golden build)`
    )
  }
  const build = reader.open(nextDir)
  const root = appRoot || path.dirname(nextDir)
  return {
    ...build,
    appRoot: root,
    publicFile: (rel) => path.join(root, 'public', rel),
    publicFiles: (sub) =>
      next10
        .walk(path.join(root, 'public', sub))
        .map((r) => r.replace(/\\/g, '/')),
  }
}

// source name of every mapped source of the given scripts: package roots per
// package name ({name: [root, ...]})
function packageRoots(build, scripts) {
  const roots = {}
  for (const s of scripts.filter((x) => x.map)) {
    for (const raw of s.map.sources) {
      const src = build.normaliseSource(raw)
      const pkg = src.path && build.packageOf(src.path)
      if (pkg) {
        roots[pkg.name] = roots[pkg.name] || new Set()
        roots[pkg.name].add(pkg.root)
      }
    }
  }
  return Object.fromEntries(
    Object.keys(roots)
      .sort(byCodePoint)
      .map((k) => [k, [...roots[k]].sort(byCodePoint)])
  )
}

// mapped source paths of the given scripts (bundled modules)
function bundledSources(build, scripts) {
  const paths = new Set()
  for (const s of scripts) {
    for (const raw of (s.map && s.map.sources) || []) {
      const src = build.normaliseSource(raw)
      if (src.path) paths.add(src.path)
    }
  }
  return paths
}

// module names the scripts load at run time instead of bundling (webpack
// externals; Next 10 lists them as `external "x"` sources of server maps)
function externals(build, scripts) {
  const names = new Set()
  for (const s of scripts) {
    for (const raw of (s.map && s.map.sources) || []) {
      const src = build.normaliseSource(raw)
      if (src.external) names.add(src.external)
    }
  }
  return [...names].sort(byCodePoint)
}

// occurrences of `needle` (string or global RegExp) in the generated code,
// attributed to the original source module through each script's map:
// {source: count}; a hit in a script without map counts as `<unmapped:rel>`
function literalSites(build, scripts, needle) {
  const counts = {}
  const re =
    typeof needle === 'string'
      ? new RegExp(needle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')
      : needle
  for (const s of scripts) {
    const offsets = [...s.code.matchAll(re)].map((m) => m.index)
    if (offsets.length) {
      positionsOf(s.code, offsets).forEach((p) => {
        const o = s.map && s.map.originalPositionFor(p.line, p.column)
        const key = o
          ? build.normaliseSource(o.source).path ||
            `external:${build.normaliseSource(o.source).external}`
          : `<unmapped:${s.rel}>`
        counts[key] = (counts[key] || 0) + 1
      })
    }
  }
  return sortObject(counts)
}

const IMAGE_EXT = /\.(png|jpe?g|gif|svg|webp|ico|bmp)$/i

// image modules of next-images (url-loader/file-loader output kept in the
// maps' sourcesContent): {module: {kind: 'file'|'data', value}}
function imageModules(build, scripts) {
  const mods = {}
  for (const s of scripts.filter((x) => x.map)) {
    s.map.sources.forEach((raw, i) => {
      const src = build.normaliseSource(raw).path
      if (!src || !IMAGE_EXT.test(src)) return
      const content = s.map.sourcesContent[i] || ''
      const m = content.match(/module\.exports\s*=\s*("(?:[^"\\]|\\.)*")/)
      if (!m) return
      const value = JSON.parse(m[1])
      const entry = {
        kind: value.startsWith('data:') ? 'data' : 'file',
        value,
      }
      const prev = mods[src]
      if (prev && prev.value !== entry.value)
        throw new Error(`image module ${src} has two different exports`)
      mods[src] = entry
    })
  }
  return sortObject(mods)
}

// default-import sites of image files in the app source tree (the sites
// CS-N11-3 lists: every `.js`/`.jsx` outside the test, tooling and data
// directories), resolved to repo-relative module paths
const SOURCE_SKIP = new Set([
  'test',
  'e2e',
  'docs',
  'scripts',
  'tools',
  'kube',
  'public',
  'data',
  'out',
  'coverage',
])
function sourceImageImports(root = ROOT) {
  const files = []
  const skip = (dir, name) =>
    name.startsWith('.') ||
    name === 'node_modules' ||
    (dir === root && SOURCE_SKIP.has(name))
  const visit = (dir) => {
    for (const e of fs
      .readdirSync(dir, { withFileTypes: true })
      .sort((a, b) => byCodePoint(a.name, b.name))) {
      const p = path.join(dir, e.name)
      if (e.isDirectory()) {
        if (!skip(dir, e.name)) visit(p)
      } else if (/\.jsx?$/.test(e.name)) files.push(p)
    }
  }
  visit(root)
  const sites = []
  for (const file of files) {
    const text = fs.readFileSync(file, 'utf8')
    const re = /^\s*import\s+[\w$]+\s+from\s+['"]([^'"]+)['"]/gm
    for (const m of text.matchAll(re)) {
      if (IMAGE_EXT.test(m[1]) && m[1].startsWith('.')) {
        const importer = path.relative(root, file).replace(/\\/g, '/')
        sites.push({
          importer,
          specifier: m[1],
          module: path.posix.normalize(
            path.posix.join(path.posix.dirname(importer), m[1])
          ),
        })
      }
    }
  }
  return sites
}

// the icon sprite: <symbol> count, ids in order, duplicated ids, bytes hash
function spriteInfo(file) {
  const buf = fs.readFileSync(file)
  const text = buf.toString('utf8')
  const ids = [...text.matchAll(/<symbol\b[^>]*\bid="([^"]*)"/g)].map(
    (m) => m[1]
  )
  const counts = {}
  ids.forEach((id) => {
    counts[id] = (counts[id] || 0) + 1
  })
  const duplicates = sortObject(
    Object.fromEntries(Object.entries(counts).filter(([, n]) => n > 1))
  )
  return {
    symbols: (text.match(/<symbol\b/g) || []).length,
    ids,
    duplicates,
    sha256: sha256(buf),
    bytes: buf.length,
  }
}

module.exports = {
  ROOT,
  INPUTS,
  buildDirs,
  openBuild,
  packageRoots,
  bundledSources,
  externals,
  literalSites,
  imageModules,
  sourceImageImports,
  spriteInfo,
  sha256,
  sortObject,
  byCodePoint,
  IMAGE_EXT,
}
