// Built-CSS keying for T-003 (41 A; review:00 X40.11): every style rule (and
// every at-rule that holds declarations, e.g. @font-face) of the emitted CSS is
// keyed by (source file, normalised selector list, at-rule chain, ordinal).
// The source file comes from the emitted CSS map. CSS-module class hashes are
// removed only together with the source file in the key: 21 of 26 module files
// are named styles.module.css, so a hash-stripped selector alone would merge
// unrelated rules. One source rule emitted into several CSS chunks counts once
// (chunking is not CSS content); the ordinal orders rules with the same
// (source, selectors, at-rule chain) by their original position.
const path = require('path')

const ROOT = path.resolve(__dirname, '..', '..', '..')
// the app's own PostCSS parser (package.json devDependency postcss)
const postcss = require(require.resolve('postcss', { paths: [ROOT] }))

const UNMAPPED = '<unmapped>'

const collapse = (s) => String(s).replace(/\s+/g, ' ').trim()

// whitespace only: around combinators, commas, colons and parentheses
const normaliseSelector = (s) =>
  collapse(s)
    .replace(/\s*([>+~,])\s*/g, '$1')
    .replace(/\(\s+/g, '(')
    .replace(/\s+\)/g, ')')

const normaliseParams = (s) =>
  collapse(s)
    .replace(/\(\s+/g, '(')
    .replace(/\s+\)/g, ')')
    .replace(/\s*:\s*/g, ':')
    .replace(/\s*,\s*/g, ',')

// Next 10 getCssModuleLocalIdent: `<[name], or [folder] for index.module.css>_
// <local>__<hash5>`, invalid characters replaced by '_'
function moduleHashPattern(source) {
  if (!/\.module\.css$/.test(source)) return null
  const base = path.posix.basename(source)
  const prefix = (
    base === 'index.module.css'
      ? path.posix.basename(path.posix.dirname(source))
      : base.replace(/\.module\.css$/, '')
  ).replace(/[^a-zA-Z0-9-_]/g, '_')
  const esc = prefix.replace(/[-]/g, '\\-')
  // hash: loader-utils base64 digest, alphabet 0-9 a-z A-Z - _
  return new RegExp(
    `(${esc}_[A-Za-z0-9_-]+)__[A-Za-z0-9_-]{5}(?![A-Za-z0-9_-])`,
    'g'
  )
}

const stripModuleHash = (text, pattern) =>
  pattern ? text.replace(pattern, '$1') : text

function originOf(map, node) {
  if (!map || !node.source || !node.source.start) return null
  return map.originalPositionFor(
    node.source.start.line - 1,
    node.source.start.column - 1
  )
}

const chainOf = (node, pattern) => {
  const chain = []
  for (let p = node.parent; p && p.type !== 'root'; p = p.parent) {
    if (p.type === 'atrule') {
      chain.unshift(
        `@${p.name.toLowerCase()} ${stripModuleHash(
          normaliseParams(p.params),
          pattern
        )}`.trim()
      )
    } else if (p.type === 'rule') {
      chain.unshift(
        `& ${stripModuleHash(normaliseSelector(p.selector), pattern)}`
      )
    }
  }
  return chain.join(' > ')
}

const declText = (d, pattern) =>
  `${d.prop.startsWith('--') ? d.prop : d.prop.toLowerCase()}:${stripModuleHash(
    collapse(d.value),
    pattern
  )}${d.important ? '!important' : ''}`

// media features of an @media prelude: names in `(name:` / `(name)` incl.
// unresolved custom media `(--name)`; a prelude without any feature counts
// under its media types (`type:print`)
const mediaFeatures = (params) => {
  const text = String(params)
  const features = [
    ...text.matchAll(/\(\s*(-{0,2}[a-zA-Z][\w-]*)\s*[:)<>=]/g),
  ].map((m) => m[1].toLowerCase())
  if (!features.length) {
    features.push(
      ...text
        .replace(/\([^)]*\)/g, ' ')
        .split(/[\s,]+/)
        .filter((w) => w && !/^(and|not|only|or)$/i.test(w))
        .map((w) => `type:${w.toLowerCase()}`)
    )
  }
  return [...new Set(features)].sort()
}

// files: [{rel, css, map}] in canonical order (reader.cssFiles())
function keyCss(files, normaliseSource) {
  const seen = new Map() // identity -> entry
  const entries = []
  const media = new Map() // identity -> {source, params, features}
  const fileKeys = new Map() // rel -> [identity in emitted order]
  const raw = { customMedia: 0, extend: 0, colorMod: 0, unmapped: 0 }
  for (const file of files) {
    raw.customMedia += file.css.split('@media (--').length - 1
    raw.extend += file.css.split('@extend').length - 1
    raw.colorMod += file.css.split('color-mod(').length - 1
    const root = postcss.parse(file.css, { from: undefined, map: false })
    const order = []
    let index = 0
    root.walk((node) => {
      const isRule = node.type === 'rule'
      const isDeclAtRule =
        node.type === 'atrule' &&
        (node.nodes || []).some((c) => c.type === 'decl')
      const o = originOf(file.map, node)
      const src = o ? normaliseSource(o.source).path || UNMAPPED : UNMAPPED
      const pattern = src === UNMAPPED ? null : moduleHashPattern(src)
      if (node.type === 'atrule' && node.name.toLowerCase() === 'media') {
        const params = stripModuleHash(normaliseParams(node.params), pattern)
        const id = [
          src,
          chainOf(node, pattern),
          params,
          o ? `${o.line}:${o.column}` : `${file.rel}#${index}`,
        ].join('\u0000')
        if (!media.has(id)) {
          media.set(id, {
            source: src,
            params,
            features: mediaFeatures(params),
          })
        }
      }
      if (!isRule && !isDeclAtRule) return
      index++
      if (src === UNMAPPED) raw.unmapped++
      const selector = isRule
        ? stripModuleHash(normaliseSelector(node.selector), pattern)
        : `@${node.name.toLowerCase()} ${normaliseParams(node.params)}`.trim()
      const chain = chainOf(node, pattern)
      const decls = node.nodes
        .filter((c) => c.type === 'decl')
        .map((d) => declText(d, pattern))
      const pos = o ? [o.line, o.column] : [Number.MAX_SAFE_INTEGER, index]
      const id = [src, selector, chain, pos.join(':'), decls.join(';')].join(
        '\u0000'
      )
      order.push(id)
      if (!seen.has(id)) {
        const entry = {
          source: src,
          selector,
          chain,
          decls,
          pos,
          seq: entries.length,
        }
        seen.set(id, entry)
        entries.push(entry)
      }
    })
    fileKeys.set(file.rel, order)
  }
  // ordinals per (source, selectors, chain) by original position
  const groups = new Map()
  for (const e of entries) {
    const base = [e.source, e.selector, e.chain || '-'].join(' | ')
    if (!groups.has(base)) groups.set(base, [])
    groups.get(base).push(e)
  }
  for (const [base, list] of groups) {
    list.sort(
      (a, b) => a.pos[0] - b.pos[0] || a.pos[1] - b.pos[1] || a.seq - b.seq
    )
    list.forEach((e, i) => {
      e.key = `${base} | ${i}`
    })
  }
  const keyOfId = (id) => seen.get(id).key
  return { entries, media: [...media.values()], fileKeys, keyOfId, raw }
}

module.exports = {
  keyCss,
  mediaFeatures,
  moduleHashPattern,
  normaliseSelector,
  normaliseParams,
  UNMAPPED,
}
