#!/usr/bin/env node
// freeze-design-css.mjs - DV7 (CS-DSN-6, 60 §5): writes the global CSS of @oacore/design 5.0.74 as the app's
// own files under styles/global/design/, processed once by the PostCSS chain the build ran over it until step 6.9
// (the plugins, order and options of postcss.config.js, loaded the way Next loads them). From then on the build
// needs no PostCSS plugin for it: custom media and @extend are resolved, autoprefixer output is written.
//
// Usage: node scripts/freeze-design-css.mjs   (from the repository root; needs the chain's plugins installed,
// i.e. the tree before CS-CSS-4 removed them)
//
// Walk: @oacore/design/lib/index.css and every file its @import rules reach, in import order: the lib files keep
// their path under styles/global/design/; `~package/file` imports (sanitize.css, slick-carousel) go to
// styles/global/design/packages/<package>/<file> and the @import names that copy; the url() assets of slick
// (fonts, ajax-loader.gif) are copied next to it. The KaTeX import of math-markdown.css stays a package import.
// Each output keeps an inline source map back to the sources the build attributed the CSS to (the design's src/
// files through the lib maps, the package files), so the emitted CSS maps name the same sources.
import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const OUT = path.join(ROOT, 'styles', 'global', 'design')
const require = createRequire(path.join(ROOT, 'package.json'))
const fromNext = (request) =>
  require(require.resolve(request, { paths: [path.dirname(require.resolve('next/package.json'))] }))

const { getPostCssPlugins } = fromNext('next/dist/build/webpack/config/blocks/css/plugins.js')
const postcss = require('postcss')

const IMPORT = /@import\s+url\((["']?)([^"')]+)\1\)\s*;/g
const URL = /url\((["']?)([^"')]+)\1\)/g

function outputOf(file) {
  const lib = path.dirname(require.resolve('@oacore/design/lib/index.css'))
  if (file.startsWith(lib + path.sep)) return path.join(OUT, path.relative(lib, file))
  const nm = file.lastIndexOf(`node_modules${path.sep}`)
  if (nm < 0) throw new Error(`no output path for ${file}`)
  return path.join(OUT, 'packages', file.slice(nm + 'node_modules/'.length))
}

async function main() {
  process.chdir(ROOT)
  const plugins = await getPostCssPlugins(ROOT, undefined)
  const processor = postcss(plugins)
  fs.rmSync(OUT, { recursive: true, force: true })
  const done = new Set()
  const written = []
  const visit = async (file) => {
    if (done.has(file)) return
    done.add(file)
    const out = outputOf(file)
    let css = fs.readFileSync(file, 'utf8')
    const children = []
    css = css.replace(IMPORT, (all, quote, url) => {
      if (url.startsWith('~')) {
        const target = require.resolve(url.slice(1))
        children.push(target)
        const rel = path.relative(path.dirname(out), outputOf(target)).split(path.sep).join('/')
        return `@import url(${quote}${rel}${quote});`
      }
      if (/^katex\//.test(url)) return all
      children.push(path.resolve(path.dirname(file), url))
      return all
    })
    const result = await processor.process(css, {
      from: file,
      to: out,
      map: { inline: true, annotation: true, sourcesContent: true },
    })
    fs.mkdirSync(path.dirname(out), { recursive: true })
    fs.writeFileSync(out, result.css)
    written.push(path.relative(ROOT, out))
    // assets the CSS names by a relative url() (slick's fonts and loader gif)
    for (const [, , url] of css.matchAll(URL)) {
      if (/^(data:|https?:|~|#)/.test(url) || url.endsWith('.css')) continue
      const asset = path.resolve(path.dirname(file), url.replace(/[?#].*$/, ''))
      const copy = path.resolve(path.dirname(out), url.replace(/[?#].*$/, ''))
      fs.mkdirSync(path.dirname(copy), { recursive: true })
      fs.copyFileSync(asset, copy)
      written.push(path.relative(ROOT, copy))
    }
    for (const child of children) await visit(child)
  }
  await visit(require.resolve('@oacore/design/lib/index.css'))
  console.log([...new Set(written)].join('\n'))
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
