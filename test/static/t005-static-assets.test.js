// T-005 (41 A; R-007, R-021, R-022; Q-067): static assets of the parity build
// (APP_ROOT layout: .next and public/ after the Dockerfile copies,
// Dockerfile:24-27): the served icon sprite, the next-images modules, the
// .next/static/media files and public/images/*. Reference and diff rules:
// test/static/adapters/reference.js.
const fs = require('fs')
const path = require('path')

const {
  ROOT,
  buildDirs,
  openBuild,
  bundledSources,
  imageModules,
  sourceImageImports,
  spriteInfo,
  sha256,
} = require('./adapters')
const { reference, diffEntries, summary } = require('./adapters/reference')

// next-images output paths: assetPrefix (BUILD_TARGET=azure) + /_next/
const IMAGE_URL_PREFIX = '/static/search/_next/static/images/'
const baseName = (file) => file.replace(/\.[0-9a-f]{8,}(\.[^.]+)$/, '$1')

function derive(build) {
  const entries = {}
  // the sprite the app serves (public/icons.svg, copied from the design build
  // output public/design/icons.svg)
  for (const rel of ['icons.svg', 'design/icons.svg']) {
    const s = spriteInfo(build.publicFile(rel))
    entries[`sprite:${rel}:symbols`] = String(s.symbols)
    entries[`sprite:${rel}:ids`] = s.ids.join(',')
    entries[`sprite:${rel}:duplicates`] = JSON.stringify(s.duplicates)
    entries[`sprite:${rel}:sha256`] = s.sha256
  }
  // next-images modules as both bundles see them
  const client = imageModules(build, build.clientScripts())
  const server = imageModules(build, build.serverScripts())
  for (const mod of [
    ...new Set([...Object.keys(client), ...Object.keys(server)]),
  ].sort()) {
    const m = client[mod] || server[mod]
    entries[`image:${mod}`] =
      m.kind === 'file'
        ? `file ${m.value}`
        : `data ${m.value.slice(0, m.value.indexOf(','))} sha256:${sha256(
            m.value
          )}`
    entries[`image-sides:${mod}`] = [
      client[mod] && 'client',
      server[mod] && 'server',
    ]
      .filter(Boolean)
      .join(',')
    if (m.kind === 'file') {
      const emitted = build.staticFile(
        `static/images/${m.value.slice(IMAGE_URL_PREFIX.length)}`
      )
      entries[`image-file:${mod}`] = fs.existsSync(emitted)
        ? sha256(fs.readFileSync(emitted))
        : '<missing>'
    }
  }
  // the image import sites of the source tree and what each resolves to in
  // the build
  const bundled = new Set([
    ...bundledSources(build, build.clientScripts()),
    ...bundledSources(build, build.serverScripts()),
  ])
  const kinds = { file: 0, data: 0 }
  for (const site of sourceImageImports()) {
    const m = client[site.module] || server[site.module]
    const kind = m ? m.kind : 'not-built'
    if (kinds[kind] !== undefined) kinds[kind]++
    entries[`import:${site.importer} <- ${site.specifier}`] = kind
    entries[`import-site-bundled:${site.importer} <- ${site.specifier}`] =
      bundled.has(site.importer) ? 'yes' : 'no'
  }
  entries['imports:file'] = String(kinds.file)
  entries['imports:data'] = String(kinds.data)
  entries['static/images'] = build.imageFiles().join(',')
  // .next/static/media (css-loader url() assets) by base name
  const media = {}
  for (const f of build.mediaFiles())
    media[baseName(f)] = (media[baseName(f)] || 0) + 1
  for (const name of Object.keys(media).sort())
    entries[`media:${name}`] = String(media[name])
  entries['media:files'] = String(build.mediaFiles().length)
  // public/images/* (Dockerfile copy of public/static/images)
  for (const rel of build.publicFiles('images')) {
    entries[`public:images/${rel}`] = sha256(
      fs.readFileSync(build.publicFile(`images/${rel}`))
    )
  }
  return { entries }
}

const pick = (entries, prefix) =>
  Object.fromEntries(
    Object.entries(entries).filter(([k]) => prefix.some((p) => k.startsWith(p)))
  )

describe('T-005 @P0 static assets', () => {
  let build
  let actual
  let ref
  const compare = (prefixes) => {
    const { uncovered } = diffEntries(
      'T-005',
      pick(ref.entries, prefixes),
      pick(actual.entries, prefixes)
    )
    expect(summary(uncovered)).toEqual({ count: 0, first: [] })
  }
  beforeAll(() => {
    build = openBuild(buildDirs('T-005'))
    actual = derive(build)
    ref = reference('T-005', 't005-static-assets', derive, actual, build).value
  })

  test('T-005 c1 @P0 prod sprite: 48 symbols, duplicate ids office-building, account, open-in-new (Q-067), byte hash = reference', () => {
    const a = actual.entries
    for (const rel of ['icons.svg', 'design/icons.svg']) {
      expect(a[`sprite:${rel}:symbols`]).toBe('48')
      expect(JSON.parse(a[`sprite:${rel}:duplicates`])).toEqual({
        'account': 2,
        'office-building': 2,
        'open-in-new': 2,
      })
      expect(a[`sprite:${rel}:ids`].split(',')).toHaveLength(48)
    }
    // the served copy is byte-identical to the design build output
    expect(a['sprite:icons.svg:sha256']).toBe(
      a['sprite:design/icons.svg:sha256']
    )
    compare(['sprite:'])
  })

  test('T-005 c2 @P0 next-images: 9 file URLs and 5 data URIs over the 14 import sites', () => {
    const a = actual.entries
    expect(a['imports:file']).toBe('9')
    expect(a['imports:data']).toBe('5')
    const sites = pick(a, ['import:'])
    expect(Object.keys(sites)).toHaveLength(14)
    expect(
      Object.entries(sites).filter(([, kind]) => kind === 'not-built')
    ).toEqual([])
    // the fifth data URI site is in templates/data-provider/logo.jsx, a
    // module no page imports (not in any bundle); its Default.svg is the data
    // URI module the search page bundles, so the build holds 4 data URI
    // modules for the 5 sites
    expect(
      Object.entries(pick(a, ['import-site-bundled:'])).filter(
        ([, v]) => v === 'no'
      )
    ).toEqual([
      [
        'import-site-bundled:templates/data-provider/logo.jsx <- ./images/Default.svg',
        'no',
      ],
    ])
    const modules = pick(a, ['image:'])
    const files = Object.entries(modules).filter(([, v]) =>
      v.startsWith('file ')
    )
    const data = Object.entries(modules).filter(([, v]) =>
      v.startsWith('data ')
    )
    expect(files).toHaveLength(9)
    expect(data).toHaveLength(4)
    for (const [, v] of data)
      expect(v).toMatch(/^data data:image\/svg\+xml;base64 /)
    // each file URL is the emitted file under assetPrefix, with the source's
    // bytes
    for (const [key, v] of files) {
      const mod = key.slice('image:'.length)
      expect(v.startsWith(`file ${IMAGE_URL_PREFIX}`)).toBe(true)
      expect(a[`image-file:${mod}`]).toBe(
        sha256(fs.readFileSync(path.join(ROOT, mod)))
      )
    }
    expect(a['static/images'].split(',')).toHaveLength(9)
    compare([
      'image:',
      'image-sides:',
      'image-file:',
      'import:',
      'import-site-bundled:',
      'imports:',
      'static/images',
    ])
  })

  test('T-005 c3 @P0 .next/static/media base names: 60 KaTeX fonts, slick, ajax-loader.gif', () => {
    const a = actual.entries
    const media = pick(a, ['media:'])
    delete media['media:files']
    const names = Object.keys(media).map((k) => k.slice('media:'.length))
    expect(names.filter((n) => n.startsWith('KaTeX_'))).toHaveLength(60)
    expect(names.filter((n) => /^slick\./.test(n)).sort()).toEqual([
      'slick.eot',
      'slick.svg',
      'slick.ttf',
      'slick.woff',
    ])
    expect(names.filter((n) => !n.startsWith('KaTeX_')).sort()).toEqual([
      'ajax-loader.gif',
      'layers-2x.png',
      'layers.png',
      'map-background.png',
      'marker-icon.png',
      'repoBackground.svg',
      'slick.eot',
      'slick.svg',
      'slick.ttf',
      'slick.woff',
    ])
    // every base name once
    expect(Object.values(media).every((n) => n === '1')).toBe(true)
    compare(['media:'])
  })

  test('T-005 c4 @P0 public/images/* = the Dockerfile copy of public/static/images', () => {
    const a = actual.entries
    const images = pick(a, ['public:images/'])
    expect(Object.keys(images)).toEqual([
      'public:images/errorCard.svg',
      'public:images/map/marker.svg',
      'public:images/oai.svg',
      'public:images/redirect.svg',
    ])
    for (const [key, hash] of Object.entries(images)) {
      const rel = key.slice('public:images/'.length)
      expect(
        sha256(fs.readFileSync(build.publicFile(`static/images/${rel}`)))
      ).toBe(hash)
    }
    expect(build.publicFiles('images')).toEqual(
      build.publicFiles('static/images')
    )
    compare(['public:'])
  })
})
