// T-418 (41 A; R-022; Q-067, 60 §6 row 16): every Icon id the app renders is
// a <symbol> of the production sprite the parity build serves. The ids are
// the 20 the application source references and the 14 the rendered design
// components reference (findings/04 §3.3); both lists are derived from the
// sources and pinned here, so a new or removed id fails until the list (and
// the sprite) are updated together.
//
// The served sprite: the design `Icon` renders
// `<use href="<iconsPublicPath>#id">` with `iconsPublicPath` from the
// postinstall-generated node_modules/@oacore/design/lib/config.js
// (`/static/search/icons.svg`); the
// gateway maps `/static/search/*` to the app's `/*` and Next serves
// `public/icons.svg` at `/icons.svg`, the copy the Dockerfile makes of the
// design build output `public/design/icons.svg` (Dockerfile:25).
//
// Input: APP_ROOT = the app directory of the parity build (its .next is
// NEXT_DIR; the same layout as the image's /app).
const fs = require('fs')
const path = require('path')
const { execFileSync } = require('child_process')

const ROOT = path.resolve(__dirname, '..', '..')
const DESIGN = path.join(ROOT, 'node_modules', '@oacore', 'design')

// application ids (findings/04 §3.3: "Search uses 20 ids"); `check`,
// `magnify` and `pencil` exist only through the design config
const APP_IDS = [
  'account',
  'check',
  'check-circle',
  'checkbox-blank-outline',
  'checkbox-marked',
  'chevron-double-left',
  'chevron-double-right',
  'chevron-left',
  'chevron-right',
  'content-copy',
  'download',
  'emoticon-sad-outline',
  'format-quote-open',
  'magnify',
  'menu-down',
  'office-building',
  'open-in-new',
  'pencil',
  'share-variant',
  'tag',
]

// ids of the design components the app renders, with the compiled files
// that reference them (findings/04 §3.3 table)
const DESIGN_IDS = {
  'alert-circle-outline': ['lib/elements/forms/text-field.js'],
  'check': ['lib/elements/forms/text-field.js'],
  'core-symbol': ['lib/elements/logo/logo.js'],
  'coreLogo': ['lib/elements/footer/footer.js'],
  'github': ['lib/elements/footer/footer.js'],
  'information-outline': ['lib/modules/select/select.js'],
  'linkedin': ['lib/elements/footer/footer.js'],
  'magnify': ['lib/modules/header/search-bar.js'],
  'menu': ['lib/modules/header/header.js'],
  'office-building': ['lib/elements/logo/data-provider.js'],
  'open-in-new': ['lib/elements/link/link.js'],
  'twitter': ['lib/elements/footer/footer.js'],
  'window-close': [
    'lib/modules/header/advanced-search.js',
    'lib/modules/modal/modal.js',
    'lib/modules/select/select.js',
  ],
  'writing': ['lib/elements/footer/footer.js'],
}

// design modules the app never renders (bundled through the barrel only,
// findings/04 §4): their ids are not app icons
const UNRENDERED = {
  'active-arrow': [
    'lib/modules/documentation-membership-nav/documentation-membership-nav.js',
    'lib/modules/documentation-membership/documentation-membership.js',
  ],
  'drop-arrow': ['lib/modules/docs-select/docs-select.js'],
}

// a quoted `#name` literal; colours (#b75400, #E0E0E0, ...) are not ids
const LITERAL = /["'`]#([A-Za-z][A-Za-z0-9-]*)["'`]/g
const isColour = (id) => /^(?:[0-9a-f]{3}|[0-9a-f]{6})$/i.test(id)

const literalIds = (text) =>
  [...text.matchAll(LITERAL)].map((m) => m[1]).filter((id) => !isColour(id))

const sorted = (list) => [...new Set(list)].sort()

// application sources: the runtime tree of 01 §4 (`<PI>`), JS only
const appSources = () =>
  execFileSync('git', ['-C', ROOT, 'ls-files', '--', '*.js', '*.jsx'], {
    encoding: 'utf8',
  })
    .split('\n')
    .filter(Boolean)
    .filter((p) => !/^(docs|test|e2e|scripts|tools)\//.test(p))

const walk = (dir) =>
  fs
    .readdirSync(dir, { withFileTypes: true })
    .flatMap((e) =>
      e.isDirectory() ? walk(path.join(dir, e.name)) : [path.join(dir, e.name)]
    )

// every `#id` literal of the compiled design lib (lib/global is unused CSS)
const designLiterals = () => {
  const out = {}
  for (const file of walk(path.join(DESIGN, 'lib'))) {
    const rel = path.relative(DESIGN, file).split(path.sep).join('/')
    if (rel.endsWith('.js') && !rel.startsWith('lib/global/')) {
      for (const id of literalIds(fs.readFileSync(file, 'utf8')))
        (out[id] = out[id] || new Set()).add(rel)
    }
  }
  return Object.fromEntries(
    Object.keys(out)
      .sort()
      .map((id) => [id, [...out[id]].sort()])
  )
}

const appRoot = () => {
  const dir = process.env.APP_ROOT
    ? process.env.APP_ROOT
    : process.env.NEXT_DIR && path.dirname(process.env.NEXT_DIR)
  if (!dir) throw new Error('T-418 needs APP_ROOT (the parity build directory)')
  return path.resolve(dir)
}

// symbols of a sprite in document order: id, viewBox, body
const symbolsOf = (svg) =>
  [...svg.matchAll(/<symbol\b([^>]*)>([\s\S]*?)<\/symbol>/g)].map((m) => ({
    id: (m[1].match(/\bid="([^"]*)"/) || [])[1],
    viewBox: (m[1].match(/\bviewBox="([^"]*)"/) || [])[1],
    body: m[2],
  }))

const ALL_IDS = sorted([...APP_IDS, ...Object.keys(DESIGN_IDS)])

describe('T-418 @P0 icon ids', () => {
  test('T-418 @P0 the application source references exactly the 20 pinned icon ids', () => {
    const found = {}
    for (const file of appSources()) {
      for (const id of literalIds(
        fs.readFileSync(path.join(ROOT, file), 'utf8')
      ))
        (found[id] = found[id] || new Set()).add(file)
    }
    expect(Object.keys(found).sort()).toEqual(APP_IDS)
    expect(APP_IDS).toHaveLength(20)
    // the three ids search uses that only the design config supplies
    // (findings/04 §3.3)
    const designConfig = require(path.join(DESIGN, 'design.config.js'))
    const appConfig = require(path.join(ROOT, 'design.config.js'))
    const base = (config) =>
      config.icons.files.map((f) => path.basename(f, '.svg'))
    expect(APP_IDS.filter((id) => !base(appConfig).includes(id))).toEqual([
      'check',
      'magnify',
      'pencil',
    ])
    expect(
      ['check', 'magnify', 'pencil'].every((id) =>
        base(designConfig).includes(id)
      )
    ).toBe(true)
  })

  test('T-418 @P0 the rendered design components reference exactly the 14 pinned design ids', () => {
    const literals = designLiterals()
    // `#suggestion-result-` is a DOM id prefix of the Select (use-options.js),
    // `#alert` an example in the Icon's prop documentation
    const notIcons = {
      'alert': ['lib/elements/icon/icon.js'],
      'suggestion-result-': ['lib/modules/select/hooks/use-options.js'],
    }
    expect(literals).toEqual({ ...DESIGN_IDS, ...UNRENDERED, ...notIcons })
    expect(Object.keys(DESIGN_IDS)).toHaveLength(14)
  })

  test('T-418 @P0 every app and design icon id is a <symbol> of the served production sprite /static/search/icons.svg', () => {
    const root = appRoot()
    // the URL the Icon renders comes from the generated config of the build
    const configText = fs.readFileSync(
      path.join(root, 'node_modules', '@oacore', 'design', 'lib', 'config.js'),
      'utf8'
    )
    expect(configText).toMatch(
      /iconsPublicPath: "\/static\/search\/icons\.svg"/
    )
    // the served file is the Dockerfile copy of the design build output
    const served = fs.readFileSync(path.join(root, 'public', 'icons.svg'))
    const built = fs.readFileSync(
      path.join(root, 'public', 'design', 'icons.svg')
    )
    expect(served.equals(built)).toBe(true)
    const symbols = symbolsOf(served.toString('utf8'))
    // the production sprite (48 symbols; the development one adds file-check,
    // Q-067)
    expect(symbols.map((s) => s.id)).toHaveLength(48)
    expect(symbols.some((s) => s.id === 'file-check')).toBe(false)
    const missing = ALL_IDS.filter((id) => !symbols.some((s) => s.id === id))
    expect(missing).toEqual([])
    // the symbol a <use href="#id"> resolves to is the first with that id
    // (duplicates: office-building, account, open-in-new, Q-067); it has a
    // viewBox and drawing content
    for (const id of ALL_IDS) {
      const first = symbols.find((s) => s.id === id)
      expect([id, Boolean(first.viewBox)]).toEqual([id, true])
      expect([id, /<(path|circle|rect|polygon|g)\b/.test(first.body)]).toEqual([
        id,
        true,
      ])
    }
    expect(ALL_IDS).toHaveLength(30)
  })
})
