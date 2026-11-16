// T-003 (41 A; R-008, R-009, R-023, R-024, R-043, R-086; Q-066): the built
// CSS of the parity build (NEXT_DIR/static/css and the emitted CSS maps), read
// by the Next 10 adapter. Every rule is keyed by (source file, normalised
// selector list, at-rule chain, ordinal) through the CSS maps, never by a
// hash-stripped selector alone (review:00 X40.11), and its declarations equal
// the reference; per page, the cascade order of the keys equals the reference
// (global CSS import order, R-023). Reference and diff rules:
// test/static/adapters/reference.js (B0 at 2.5, provisional before).
const { buildDirs, openBuild, sha256 } = require('./adapters')
const { keyCss } = require('./adapters/css')
const { reference, diffEntries, summary } = require('./adapters/reference')

const FEATURE_FAMILIES = ['prefers-*', 'hover', 'pointer', 'forced-colors']

function derive(build) {
  const files = build.cssFiles()
  const keyed = keyCss(files, build.normaliseSource)
  const entries = {}
  for (const e of keyed.entries) entries[`rule:${e.key}`] = e.decls.join(';')
  // counts over the emitted CSS text (Q-066 color-mod, unresolved custom
  // media and @extend: R-008, R-009)
  entries['count:@media (--'] = String(keyed.raw.customMedia)
  entries['count:@extend'] = String(keyed.raw.extend)
  entries['count:color-mod('] = String(keyed.raw.colorMod)
  entries['count:color-mod( in keyed declarations'] = String(
    keyed.entries.reduce(
      (n, e) =>
        n + e.decls.reduce((m, d) => m + d.split('color-mod(').length - 1, 0),
      0
    )
  )
  entries['count:unmapped rules'] = String(keyed.raw.unmapped)
  entries['count:@media blocks with a custom media feature'] = String(
    keyed.media.filter((m) => m.features.some((f) => f.startsWith('--'))).length
  )
  // media rules (CSSMediaRule blocks, one per source block) per feature
  const perFeature = {}
  for (const m of keyed.media)
    for (const f of m.features) perFeature[f] = (perFeature[f] || 0) + 1
  const families = {
    'prefers-*': Object.keys(perFeature)
      .filter((f) => f.startsWith('prefers-'))
      .reduce((n, f) => n + perFeature[f], 0),
    'hover': perFeature.hover || 0,
    'pointer': perFeature.pointer || 0,
    'forced-colors': perFeature['forced-colors'] || 0,
  }
  for (const f of FEATURE_FAMILIES)
    entries[`media-family:${f}`] = String(families[f])
  for (const f of Object.keys(perFeature).sort())
    entries[`media-feature:${f}`] = String(perFeature[f])
  entries['media-rules'] = String(keyed.media.length)
  // cascade order per page: _app CSS then the page's own, as the document
  // links them; run-length sources for reading, sha256 of the key sequence
  const byRel = new Map(files.map((f) => [f.rel, f]))
  for (const page of build.pages().filter((p) => p !== '/_app')) {
    const ids = build
      .pageFiles(page)
      .filter((rel) => rel.endsWith('.css'))
      .flatMap((rel) => (byRel.has(rel) ? keyed.fileKeys.get(rel) : []))
    const keys = ids.map(keyed.keyOfId)
    const runs = []
    keys.forEach((k) => {
      const src = k.split(' | ')[0]
      const last = runs[runs.length - 1]
      if (last && last[0] === src) last[1]++
      else runs.push([src, 1])
    })
    entries[`order:${page}`] = `${sha256(keys.join('\n'))} ${runs
      .map(([s, n]) => `${s}*${n}`)
      .join(',')}`
  }
  return { entries }
}

const pick = (entries, prefix) =>
  Object.fromEntries(
    Object.entries(entries).filter(([k]) => prefix.some((p) => k.startsWith(p)))
  )

describe('T-003 @P0 built CSS', () => {
  let build
  let actual
  let ref
  beforeAll(() => {
    build = openBuild(buildDirs('T-003'))
    actual = derive(build)
    ref = reference('T-003', 't003-built-css', derive, actual, build).value
  })

  test('T-003 c1 @P0 rules keyed by (source file, normalised selectors, at-rule chain, ordinal) via the CSS maps; 0 @media (--, 0 @extend, color-mod( count (Q-066); declarations per key and per-page order = reference', () => {
    const a = actual.entries
    // every rule reached its source through the emitted CSS maps
    expect(a['count:unmapped rules']).toBe('0')
    // custom media resolved (postcss-custom-media importFrom, R-008) and
    // @extend expanded (postcss-extend-rule, R-009)
    expect(a['count:@media (--']).toBe('0')
    expect(a['count:@media blocks with a custom media feature']).toBe('0')
    expect(a['count:@extend']).toBe('0')
    // Q-066: the design button focus ring keeps `color-mod(` unresolved (7
    // occurrences since W83, whose cssnano 9 drops two duplicate box-shadows:
    // the --button-focus-ring custom property and the contained/focus
    // box-shadows), so it never renders
    expect(a['count:color-mod(']).toBe('7')
    expect(a['count:color-mod( in keyed declarations']).toBe('7')
    const ringKey = Object.keys(a).find(
      (k) =>
        k.startsWith(
          'rule:node_modules/@oacore/design/src/elements/button/button.css | :root | -'
        ) && a[k].includes('--button-focus-ring:')
    )
    expect(ringKey).toBeDefined()
    expect(a[ringKey]).toMatch(
      /--button-focus-ring:0 0 0 3px color-mod\(var\(--primary\) alpha\(25%\)\)/
    )
    // the module hash is removed only with the source file in the key: the
    // same local class in two styles.module.css files stays two keys
    const containers = Object.keys(a).filter((k) =>
      / \| \.styles_container \| /.test(k)
    )
    expect(
      new Set(containers.map((k) => k.split(' | ')[0])).size
    ).toBeGreaterThan(1)
    const rules = Object.keys(a).filter((k) => k.startsWith('rule:'))
    expect(rules.length).toBeGreaterThan(1000)
    // no CSS-module hash suffix survives in a module file's key
    expect(
      rules.filter((k) => /\.module\.css \|/.test(k) && k.includes('__'))
    ).toEqual([])
    const { uncovered } = diffEntries(
      'T-003',
      pick(ref.entries, ['rule:', 'count:', 'order:']),
      pick(a, ['rule:', 'count:', 'order:'])
    )
    expect(summary(uncovered)).toEqual({ count: 0, first: [] })
  })

  test('T-003 c2 @P0 media-rule count per feature (prefers-*, hover, pointer, forced-colors) = reference; a diff passes only as an AD row', () => {
    const a = actual.entries
    // today: one prefers-reduced-motion block (sanitize.css reduce-motion),
    // no hover, pointer or forced-colors media rules
    expect(pick(a, ['media-family:'])).toEqual({
      'media-family:prefers-*': '1',
      'media-family:hover': '0',
      'media-family:pointer': '0',
      'media-family:forced-colors': '0',
    })
    expect(a['media-feature:prefers-reduced-motion']).toBe('1')
    // default deny (42 §8): a diff passes only with a ledger row matching
    // test, key, from and to exactly, not withdrawn
    const key = 'media-family:hover'
    const changed = { ...pick(ref.entries, ['media-']), [key]: '1' }
    const row = { id: 'AD-000', test: 'T-003', key, from: '0', to: '1' }
    const keysOf = (rows) =>
      diffEntries('T-003', pick(ref.entries, ['media-']), changed, {
        rows,
      }).uncovered.map((d) => d.key)
    expect(keysOf([])).toEqual([key])
    expect(keysOf([row])).toEqual([])
    expect(keysOf([{ ...row, to: '2' }])).toEqual([key])
    expect(keysOf([{ ...row, test: 'T-805' }])).toEqual([key])
    expect(keysOf([{ ...row, withdrawn: 'reason, 2026-10-20' }])).toEqual([key])
    const { uncovered } = diffEntries(
      'T-003',
      pick(ref.entries, ['media-']),
      pick(a, ['media-'])
    )
    expect(summary(uncovered)).toEqual({ count: 0, first: [] })
  })
})
