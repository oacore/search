// P0-10 normalisers (T-602, T-605, T-610, T-729). Only the differences 40 §1 lists are removed:
//   SSR head (T-602): next-head-count (10-14), data-next-head (15+), data-reactroot (12+), the charset/viewport
//   swap at 12, React 19 image preloads and non-SEO tag order (R-078), build ID, chunk hashes, Next
//   script/preload tags, inter-tag whitespace, attribute order.
//   Post-hydration head (T-729): the same document head, live; only the Next-owned elements (script/preload/
//   prefetch tags of /_next/, the CSS Next injects on client navigation, next-head-count), build ID and chunk
//   hashes are removed; every other element is kept in document order (the corruption is the order and count).
//   Classes (T-605): hash suffix -> [name]_[local].
//   Server output (T-610): buildId, other Next-owned keys, console.time labels and durations
//   (pages/search/index.jsx:49-66), allow-listed Next 13.5/16 uncaughtException lines, the line:column numbers of
//   stack frames in the stdout/stderr census (function and file names kept; owner SIGNED: 2026-10-27, 40 §8
//   rule 8).
// One harness artefact is normalised everywhere: the run's own stack origins (http://127.0.0.1:<port>, a
// per-run port slot) become <stack>, because the resolver rewrites https://core.ac.uk links to the proxy origin
// (40 §2.4) and the port differs per slot.
import crypto from 'node:crypto'

export const STACK = '<stack>'

export const NORMALISATIONS = {
  head: [
    'meta[name=next-head-count] dropped (Next 10-14)',
    'data-next-head attribute dropped (Next 15+)',
    'data-reactroot attribute dropped (React 12+ marker)',
    'charset and viewport compared as a set (swap at Next 12)',
    'non-SEO tag order: favicons and the charset/viewport set are compared apart from the SEO sequence (R-078)',
    'React 19 image preloads (link[rel=preload][as=image]) dropped',
    'Next script/preload tags dropped (_next/ chunks, __NEXT_DATA__, nomodule, noscript[data-n-css])',
    'build ID and chunk hashes replaced',
    'inter-tag whitespace ignored (DOM children only)',
    'attribute order ignored (sorted)',
  ],
  classes: ['CSS-module hash suffix: [name]_[local]__[hash] -> [name]_[local]'],
  postHydrationHead: [
    'Next-owned elements dropped (_next/ scripts, preload/prefetch/stylesheet links, style[data-n-href], noscript[data-n-css], next-head-count)',
    'build ID and chunk hashes replaced',
    'attribute order ignored (sorted)',
  ],
  serverOutput: [
    'buildId and other Next-owned keys of __NEXT_DATA__ replaced',
    'console.time labels (request ids) and durations replaced',
    'allow-listed Next 13.5/16 uncaughtException listener lines (none on Next 10)',
    'line:column numbers of stack frames in the stdout/stderr census replaced (function and file names kept)',
  ],
}

// ---------- generic ----------
export const stackOrigins = (env) =>
  [env.baseURL, env.allowURL, env.appURL, env.stubURL, env.controlURL]
    .filter(Boolean)
    .map((u) => new URL(u).origin)

export function replaceStack(value, origins) {
  let out = value
  for (const o of origins) out = out.split(o).join(STACK)
  // any other loopback origin of the stack (e.g. the stub port inside a URL) is a harness artefact too
  return out.replace(/http:\/\/127\.0\.0\.1:\d+/g, STACK)
}

export const sha256 = (s) => crypto.createHash('sha256').update(s).digest('hex')

// stable JSON with sorted object keys (deep-equal semantics, 40 §1 "parsed, deep-equal")
export function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical)
  if (value && typeof value === 'object') {
    const out = {}
    for (const k of Object.keys(value).sort()) out[k] = canonical(value[k])
    return out
  }
  return value
}
export const canonicalJson = (v) => JSON.stringify(canonical(v))

export const sortAttrs = (attrs) =>
  Object.fromEntries(
    Object.entries(attrs).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
  )

// ---------- build id, chunk hashes ----------
export function replaceBuild(value, buildId) {
  let out = value
  if (buildId) out = out.split(buildId).join('<buildId>')
  return out
    .replace(
      /\/_next\/static\/(chunks|css|runtime|media|images)\/([^"'\s)]*?)[.-][0-9a-f]{8,32}(\.[a-z0-9]+)/g,
      '/_next/static/$1/$2.<hash>$3'
    )
    .replace(
      /\/_next\/static\/css\/[0-9a-f]{8,32}\.css/g,
      '/_next/static/css/<hash>.css'
    )
}

// ---------- SSR head (T-602, T-729) ----------
const SEO_META = /^(citation_|DC\.|DCTERMS\.)/
export function classifyHeadElement(el) {
  const { tag } = el
  const a = el.attrs
  const href = a.href || ''
  const src = a.src || ''
  if (tag === 'title') return 'seo'
  if (tag === 'meta') {
    if (a.name === 'next-head-count') return 'next'
    if (a.name && (SEO_META.test(a.name) || a.name === 'description'))
      return 'seo'
    if (a.name === 'viewport' || a.charset !== undefined) return 'frame'
    return 'other'
  }
  if (tag === 'script') {
    if (a.type === 'application/ld+json') return 'seo'
    if (a.id === '__NEXT_DATA__' || /\/_next\//.test(src) || 'nomodule' in a)
      return 'next'
    return 'other'
  }
  if (tag === 'link') {
    const rel = (a.rel || '').toLowerCase()
    if (rel === 'icon') return 'favicon'
    if (rel === 'preload' && a.as === 'image') return 'next' // React 19 image preloads (R-078)
    if (/\/_next\//.test(href) && /^(preload|stylesheet|prefetch)$/.test(rel))
      return 'next'
    return 'other'
  }
  if (tag === 'noscript' && 'data-n-css' in a) return 'next'
  // the page CSS Next 10 inserts on a client navigation (<style data-n-href="/_next/static/css/...">)
  if (tag === 'style' && /\/_next\//.test(a['data-n-href'] || '')) return 'next'
  return 'other'
}

const DROP_ATTRS = new Set(['data-next-head', 'data-reactroot', 'data-n-head'])

// el: { tag, attrs, text?, childNodes? } from dom.mjs parseDocument; returns the normalised head view
export function normaliseHead(head, { origins = [], buildId = null } = {}) {
  const clean = (el) => {
    const attrs = {}
    for (const [k, v] of Object.entries(el.attrs))
      if (!DROP_ATTRS.has(k))
        attrs[k] = replaceBuild(replaceStack(v, origins), buildId)
    const out = { tag: el.tag, attrs: sortAttrs(attrs) }
    if (el.tag === 'title') {
      out.childNodes = el.childNodes
      out.text = el.text
    }
    if (el.tag === 'script' && el.attrs.type === 'application/ld+json') {
      try {
        out.jsonld = JSON.parse(el.text)
      } catch (e) {
        out.jsonldUnparseable = { text: el.text, error: e.name }
      }
    } else if (
      el.text !== undefined &&
      el.tag !== 'title' &&
      classifyHeadElement(el) === 'other'
    )
      out.text = replaceBuild(replaceStack(el.text, origins), buildId)
    return out
  }
  const seo = []
  const favicons = []
  const frame = []
  const other = []
  for (const el of head) {
    const kind = classifyHeadElement(el)
    if (kind === 'next') continue
    const c = clean(el)
    if (kind === 'seo') seo.push(c)
    else if (kind === 'favicon') favicons.push(c)
    else if (kind === 'frame') frame.push(c)
    else other.push(c)
  }
  frame.sort((x, y) =>
    JSON.stringify(x) < JSON.stringify(y)
      ? -1
      : JSON.stringify(x) > JSON.stringify(y)
      ? 1
      : 0
  )
  return { seo, favicons, frame, other }
}

// compact one-line view of the SEO sequence: tag[name] for readable assertions
export const seoNames = (seo) =>
  seo.map((e) =>
    e.tag === 'meta'
      ? e.attrs.name
      : e.tag === 'script'
      ? 'ld+json'
      : e.tag === 'title'
      ? 'title'
      : e.tag
  )

// ---------- post-hydration head (T-729) ----------
// every non-Next element of a head in document order: { tag, attrs (sorted), text? (title, inline scripts and
// styles), jsonld? }
export function headSequence(head, { origins = [], buildId = null } = {}) {
  const out = []
  for (const el of head) {
    if (classifyHeadElement(el) === 'next') continue
    const attrs = {}
    for (const [k, v] of Object.entries(el.attrs))
      if (!DROP_ATTRS.has(k))
        attrs[k] = replaceBuild(replaceStack(v, origins), buildId)
    const e = { tag: el.tag, attrs: sortAttrs(attrs) }
    if (el.tag === 'title') e.text = el.text
    else if (el.tag === 'script' && el.attrs.type === 'application/ld+json') {
      try {
        e.jsonld = JSON.parse(el.text)
      } catch {
        e.text = el.text
      }
    } else if (el.text !== undefined && el.text !== '')
      e.text = replaceBuild(replaceStack(el.text, origins), buildId)
    out.push(e)
  }
  return out
}

// one readable name per element: meta[name=...], meta[charset], link[icon 64x64], title, script[src=...]
export const sequenceNames = (seq) =>
  seq.map((e) => {
    const a = e.attrs
    if (e.tag === 'meta')
      return a.name
        ? `meta[name=${a.name}]`
        : a.charset !== undefined
        ? 'meta[charset]'
        : 'meta'
    if (e.tag === 'link') return `link[${a.rel}${a.sizes ? ` ${a.sizes}` : ''}]`
    if (e.tag === 'script')
      return a.src ? `script[src=${a.src}]` : `script[${a.type || 'inline'}]`
    return e.tag
  })

export const countOf = (names, name) => names.filter((n) => n === name).length

// ---------- classes (T-605) ----------
// Next 10 CSS-module idents are [name]_[local]__[hash:base64:5] (md5; sha1 from 13); @oacore/design ships
// prebuilt class names (e.g. button-button-3fr3r) that no app build changes, so they stay as they are
const MODULE_IDENT = /^([A-Za-z0-9-]+_[A-Za-z0-9_-]+?)__[A-Za-z0-9_-]{5}$/
export const normaliseClassToken = (t) => {
  const m = MODULE_IDENT.exec(t)
  return m ? m[1] : t
}
export const normaliseClassList = (value) =>
  value === null
    ? null
    : value
        .split(/\s+/)
        .filter((t) => t !== '')
        .map(normaliseClassToken)
        .join(' ')

// ---------- html-validate findings (T-602 c4) ----------
const startTagAt = (html, offset) => {
  const lt = html.lastIndexOf('<', offset)
  const gt = html.indexOf('>', offset)
  return lt >= 0 && gt >= 0 ? html.slice(lt, gt + 1) : ''
}
const attrOf = (tagText, name) => {
  const m = new RegExp(`\\s${name}="([^"]*)"`, 'i').exec(tagText)
  return m ? m[1] : null
}
export const isNextOwnedTag = (tagText) =>
  /\/_next\//.test(tagText) ||
  /id="__NEXT_DATA__"/.test(tagText) ||
  /\snomodule/i.test(tagText) ||
  /data-n-css/.test(tagText) ||
  /name="next-head-count"/.test(tagText)

// a head element is named by what it is (its position moves with the Next-owned tags around it)
const headDescriptor = (tagText) => {
  const tag = (/^<([a-zA-Z]+)/.exec(tagText) || [])[1] || '?'
  const parts = ['name', 'rel', 'sizes', 'type', 'charset']
    .map((n) => [n, attrOf(tagText, n)])
    .filter(([, v]) => v !== null)
    .map(([n, v]) => `[${n}=${v}]`)
  return `head > ${tag.toLowerCase()}${parts.join('')}`
}

export function normaliseFindings(html, messages, { origins = [] } = {}) {
  const headEnd = html.indexOf('</head>')
  const out = []
  for (const m of messages) {
    const tagText =
      typeof m.offset === 'number' ? startTagAt(html, m.offset) : ''
    if (tagText && isNextOwnedTag(tagText)) continue
    const inHead = headEnd < 0 || (m.offset ?? 0) < headEnd
    const selector =
      m.selector && /^html > head > /.test(m.selector) && tagText
        ? headDescriptor(tagText)
        : m.selector
        ? m.selector
        : inHead
        ? 'head'
        : null
    out.push({
      ruleId: m.ruleId,
      severity: m.severity,
      selector,
      message: replaceStack(m.message, origins),
    })
  }
  return out
}

// ---------- app stdout/stderr (T-610 c3) ----------
// Next 13.5 / 16 register their own uncaughtException/unhandledRejection listeners and print lines this
// list allows (40 §1); Next 10 prints none, so the list is empty until such a step adds entries via an AD row
export const NEXT_LISTENER_ALLOW = []

// a stack frame line of the census (`    at fn (<build>/file.js:12:34)`, `    at <build>/file.js:12:34`): its
// trailing line:column becomes <line>:<col>; the function and the file stay (owner SIGNED: 2026-10-27, 40 §8
// rule 8: a bundle change moves the numbers, not the frames). Other lines are left as they are.
export const maskFrameNumbers = (line) =>
  line.replace(/^(\s*at\s.*?):\d+:\d+(\)?)$/, '$1:<line>:<col>$2')

export function normaliseLogLine(line, { buildDir = null, origins = [] } = {}) {
  let l = line
  if (buildDir) l = l.split(buildDir).join('<build>')
  l = replaceStack(l, origins)
  // the listen address of the run's port slot (`ready - started server on 127.0.0.1:<port>`)
  l = l.replace(/\b127\.0\.0\.1:\d+/g, '127.0.0.1:<port>')
  // console.time labels carry `${Date.now()}-${random5}` and a duration (pages/search/index.jsx:49-66)
  // (the build directory is a harness artefact: one per parity build key)
  l = l.replace(
    /^(fetchWorks|transformDataProviders):\d+-[a-z0-9]{1,5}: [\d.]+(ms|s)$/,
    '$1:<reqId>: <duration>'
  )
  // stack frames: line and column masked, function and file kept
  return maskFrameNumbers(l)
}

// census rows (dom.mjs censusReader) -> one line per element: DOM path, normalised class tokens, behaviour
// attributes; URLs with the stack origin and build hashes replaced
export const censusLines = (rows, { origins = [], buildId = null } = {}) =>
  rows.map(({ path, class: cls, attrs }) => {
    const parts = [path]
    if (cls !== null)
      parts.push(`class=${JSON.stringify(normaliseClassList(cls))}`)
    for (const [k, v] of Object.entries(attrs))
      parts.push(
        `${k}=${JSON.stringify(
          replaceBuild(replaceStack(v, origins), buildId)
        )}`
      )
    return parts.join(' ')
  })

// ---------- server output (T-610 c2) ----------
// a V8 stack frame with a source location: `at fn (/path/file.js:1:2)`, `at /path/file.js:1:2`, also inside
// JSON-escaped text (`\\n    at ...`); prose such as "look at lower levels" has no path:line:column
export const STACK_FRAME =
  /\bat\s+(?:[^\s()<>"'\\]+\s+)?\(?(?:\/|file:\/\/|webpack(?:-internal)?:|node:|internal\/|[A-Za-z]:\\)[^\s()<>"']*:\d+:\d+\)?/

// findings of a server answer body: the in-cluster service name (prod Internal_API is a svc.cluster.local URL,
// api/internalize.js), the Internal_API origin of this stack, a bearer token, a stack frame, a server file path
export function serverOutputFindings(
  text,
  { internalOrigins = [], buildDir = null } = {}
) {
  const found = []
  const add = (kind, i, len) =>
    found.push({ kind, sample: text.slice(Math.max(0, i - 40), i + len + 40) })
  let i = text.indexOf('svc.cluster.local')
  if (i >= 0) add('svc.cluster.local', i, 17)
  for (const o of internalOrigins) {
    i = o ? text.indexOf(o) : -1
    if (i >= 0) add('Internal_API origin', i, o.length)
  }
  i = text.indexOf('Bearer ')
  if (i >= 0) add('Bearer ', i, 7)
  const m = STACK_FRAME.exec(text)
  if (m) add('stack frame', m.index, m[0].length)
  for (const p of [buildDir, '/.next/server/'].filter(Boolean)) {
    i = text.indexOf(p)
    if (i >= 0) add('server path', i, p.length)
  }
  return found
}
