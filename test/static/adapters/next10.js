// Next 10 `.next` layout reader (40 §3 layer A, 40 §8 rule 7). Reads only the
// files a production `next build` of Next 10.2.3 writes: BUILD_ID,
// build-manifest.json, routes-manifest.json, server/pages-manifest.json,
// static/{css,chunks,media,images}/, server/**/*.js(.map). A different layout
// (another Next major) needs its own reader, proven on the golden build first:
// it must reproduce the recorded outputs there before it reads a candidate.
const fs = require('fs')
const path = require('path')

const { SourceMap } = require('./sourcemap')

const byCodePoint = (a, b) => (a < b ? -1 : Number(a > b))

const walk = (dir, base = dir) =>
  fs.existsSync(dir)
    ? fs
        .readdirSync(dir, { withFileTypes: true })
        .sort((a, b) => byCodePoint(a.name, b.name))
        .flatMap((e) => {
          const p = path.join(dir, e.name)
          return e.isDirectory() ? walk(p, base) : [path.relative(base, p)]
        })
    : []

const readJson = (file) => JSON.parse(fs.readFileSync(file, 'utf8'))

// webpack source names of Next 10 maps: client `webpack://_N_E/./x`, server
// `webpack:///./x`, server externals `webpack:///external "x"`; webpack 5 of
// Next 12 names the external's type too: `webpack://search/external
// commonjs "x"`
function normaliseSource(raw) {
  const s = String(raw)
  const ext = s.match(/^webpack:\/\/[^/]*\/external (?:[\w-]+ )?"(.+)"$/)
  if (ext) return { external: ext[1] }
  return {
    path: s
      .replace(/^webpack:\/\/[^/]*\//, '')
      .replace(/^\.\//, '')
      .replace(/\\/g, '/'),
  }
}

// a package root is the path up to the package directory after the last
// node_modules/ ('node_modules/a/node_modules/@b/c/x.js' -> '@b/c' at
// 'node_modules/a/node_modules/@b/c')
function packageOf(sourcePath) {
  const m = sourcePath.match(/^(.*node_modules\/((?:@[^/]+\/)?[^/]+))(?:\/|$)/)
  return m ? { name: m[2], root: m[1] } : null
}

function detect(nextDir) {
  const has = (rel) => fs.existsSync(path.join(nextDir, rel))
  if (
    !has('BUILD_ID') ||
    !has('build-manifest.json') ||
    !has('routes-manifest.json') ||
    !has('server/pages-manifest.json')
  )
    return false
  const routes = readJson(path.join(nextDir, 'routes-manifest.json'))
  // Next 10: rewrites is an array; from 15 it is {beforeFiles, afterFiles,
  // fallback} and needs another reader
  return (
    routes.version === 3 &&
    Array.isArray(routes.rewrites) &&
    has('server/pages') &&
    !has('server/app')
  )
}

function open(nextDir) {
  const dir = path.resolve(nextDir)
  if (!detect(dir)) {
    throw new Error(
      `${dir} is not a Next 10 .next layout (no reader for it: add one and prove it on the golden build, 40 §8 rule 7)`
    )
  }
  const buildId = fs.readFileSync(path.join(dir, 'BUILD_ID'), 'utf8').trim()
  const cache = new Map()
  const once = (key, fn) => {
    if (!cache.has(key)) cache.set(key, fn())
    return cache.get(key)
  }

  const buildManifest = () =>
    once('bm', () => readJson(path.join(dir, 'build-manifest.json')))
  const routesManifest = () =>
    once('rm', () => readJson(path.join(dir, 'routes-manifest.json')))
  const pagesManifest = () =>
    once('pm', () => readJson(path.join(dir, 'server', 'pages-manifest.json')))

  // files a page loads in document order: _app's files, then the page's own
  // (next/dist/next-server/server/get-page-files + _document dedupe)
  const pageFiles = (page) => {
    const { pages } = buildManifest()
    const shared = pages['/_app'] || []
    const own = pages[page] || []
    return [...new Set([...shared, ...own])]
  }

  const script = (rel) => {
    const file = path.join(dir, rel)
    const mapFile = `${file}.map`
    return {
      rel,
      code: fs.readFileSync(file, 'utf8'),
      map: fs.existsSync(mapFile)
        ? new SourceMap(fs.readFileSync(mapFile, 'utf8'))
        : null,
    }
  }
  const scripts = (sub, filter) =>
    walk(path.join(dir, sub))
      .map((rel) => path.posix.join(sub, rel.replace(/\\/g, '/')))
      .filter((rel) => rel.endsWith('.js') && (!filter || filter(rel)))
      .map(script)

  // CSS files in a canonical order: first appearance over the build-manifest
  // pages (_app first, then routes sorted), then any other file by name
  const cssFiles = () =>
    once('css', () => {
      const { pages } = buildManifest()
      const order = []
      const routes = Object.keys(pages).sort()
      for (const page of ['/_app', ...routes.filter((p) => p !== '/_app')]) {
        for (const f of pages[page] || [])
          if (f.endsWith('.css') && !order.includes(f)) order.push(f)
      }
      for (const rel of walk(path.join(dir, 'static', 'css'))) {
        if (rel.endsWith('.css') && !order.includes(`static/css/${rel}`))
          order.push(`static/css/${rel}`)
      }
      return order.map((rel) => {
        const file = path.join(dir, rel)
        const mapFile = `${file}.map`
        return {
          rel,
          css: fs.readFileSync(file, 'utf8'),
          map: fs.existsSync(mapFile)
            ? new SourceMap(fs.readFileSync(mapFile, 'utf8'))
            : null,
        }
      })
    })

  return {
    layout: 'next10',
    dir,
    buildId,
    buildManifest,
    routesManifest,
    pagesManifest,
    pageFiles,
    pages: () => Object.keys(buildManifest().pages).sort(),
    cssFiles,
    // client scripts: everything under static/ except the per-build manifests
    clientScripts: () =>
      once('client', () =>
        scripts('static', (rel) => !rel.startsWith(`static/${buildId}/`))
      ),
    serverScripts: () => once('server', () => scripts('server')),
    mediaFiles: () =>
      walk(path.join(dir, 'static', 'media')).map((r) => r.replace(/\\/g, '/')),
    imageFiles: () =>
      walk(path.join(dir, 'static', 'images')).map((r) =>
        r.replace(/\\/g, '/')
      ),
    // absolute path of a file under .next (`static/images/x.svg`)
    staticFile: (rel) => path.join(dir, rel),
    normaliseSource,
    packageOf,
  }
}

module.exports = { detect, open, normaliseSource, packageOf, walk }
