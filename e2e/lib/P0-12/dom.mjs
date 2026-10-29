// P0-12 DOM capture for T-728 (40 §1 "SSR body DOM", §4 item 2): a line-per-node serialisation of
// document.body, a MutationObserver installed by an init script before any app script, a positional line diff
// (no-JS DOM -> settled hydrated DOM) and the first differing DOM path (a member of the 55 C7 (1) tuple).
//
// Serialisation (both DOMs, same code): one line per node in document order, indented by depth;
//   element  <tag a="v" ...>   attributes sorted by name; for input/select/textarea also the live
//                              properties :value and :checked (behavioural attributes, 40 §1)
//   text     "..."             JSON-escaped, whitespace kept
//   comment  <!--...-->
// A value (attribute or text) longer than 200 characters is written as its length, the first 48 characters
// and its SHA-256 (base64 logos, data-URI images, long abstracts): still an exact comparison, only shorter.
// Normalisations (40 §1, SSR body DOM row; nothing else): CSS-module class tokens [name]_[local]__[hash]
// -> [name]_[local] (the prebuilt @oacore/design names carry no build hash and stay as they are); the build
// id -> <buildId>; Next-owned script elements (#__NEXT_DATA__ and scripts loaded from /_next/static/: chunk
// URLs, their count and order are build artefacts) -> one marker line each, their bytes being pinned by
// T-610 / T-004. Harness artefact: the stack origins (http://127.0.0.1:<port>, a per-run port slot; the
// resolver rewrites https://core.ac.uk links to the proxy origin, 40 §2.4) -> <stack>.
import crypto from 'node:crypto'

export const DOM_FORMAT = 2
export const LONG_VALUE = 200

// ---------- page side (serialisable functions: no closures over module scope) ----------
export function serializeBodyInPage({ buildId, long }) {
  const MODULE_IDENT = /^([A-Za-z0-9-]+_[A-Za-z0-9_-]+?)__[A-Za-z0-9_-]{5}$/
  const enc = new TextEncoder()
  const hex = (buf) =>
    Array.from(new Uint8Array(buf))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('')
  const pending = []
  const norm = (s) => {
    let v = String(s)
    if (buildId) v = v.split(buildId).join('<buildId>')
    return v.replace(/http:\/\/127\.0\.0\.1:\d+/g, '<stack>')
  }
  // long values: placeholder now, digest filled in below (crypto.subtle is async)
  const val = (s) => {
    const v = norm(s)
    if (v.length <= long) return JSON.stringify(v)
    const slot = { v, out: null }
    pending.push(slot)
    return slot
  }
  const lines = []
  const pathOf = (el) => {
    const parts = []
    for (let e = el; e && e.nodeType === 1; e = e.parentElement) {
      let i = 1
      for (let s = e.previousElementSibling; s; s = s.previousElementSibling)
        if (s.tagName === e.tagName) i++
      parts.unshift(`${e.tagName.toLowerCase()}[${i}]`)
    }
    return parts.join('/')
  }
  const nextOwned = (el) =>
    el.tagName === 'SCRIPT' &&
    (el.id === '__NEXT_DATA__' ||
      /\/_next\/static\//.test(el.getAttribute('src') || ''))
  const walk = (node, depth, parentPath) => {
    const pad = '  '.repeat(depth)
    if (node.nodeType === 3) {
      lines.push({ path: parentPath, parts: [pad, val(node.data)] })
      return
    }
    if (node.nodeType === 8) {
      lines.push({
        path: parentPath,
        parts: [pad, '<!--', val(node.data), '-->'],
      })
      return
    }
    if (node.nodeType !== 1) return
    const el = node
    const tag = el.tagName.toLowerCase()
    const myPath = pathOf(el)
    if (nextOwned(el)) {
      lines.push({
        path: myPath,
        parts: [
          pad,
          `<script next-owned="${
            el.id === '__NEXT_DATA__' ? '__NEXT_DATA__' : 'chunk'
          }">`,
        ],
      })
      return
    }
    const attrs = []
    for (const a of Array.from(el.attributes)) {
      let v = a.value
      if (a.name === 'class')
        v = v
          .split(/\s+/)
          .filter(Boolean)
          .map((t) => t.replace(MODULE_IDENT, '$1'))
          .join(' ')
      attrs.push([a.name, v])
    }
    if (tag === 'input' || tag === 'select' || tag === 'textarea') {
      attrs.push([':value', String(el.value)])
      if (tag === 'input') attrs.push([':checked', String(el.checked)])
    }
    attrs.sort((x, y) => (x[0] < y[0] ? -1 : x[0] > y[0] ? 1 : 0))
    const parts = [pad, `<${tag}`]
    for (const [n, v] of attrs) parts.push(` ${n}=`, val(v))
    parts.push('>')
    lines.push({ path: myPath, parts })
    const kids = tag === 'template' ? el.content.childNodes : el.childNodes
    for (const k of Array.from(kids)) walk(k, depth + 1, myPath)
  }
  walk(document.body, 0, '')
  return Promise.all(
    pending.map(async (slot) => {
      const d = await crypto.subtle.digest('SHA-256', enc.encode(slot.v))
      slot.out = `<len=${slot.v.length} sha256=${hex(d).slice(
        0,
        16
      )} ${JSON.stringify(slot.v.slice(0, 48))}...>`
    })
  ).then(() =>
    lines.map((l) => ({
      path: l.path,
      text: l.parts.map((p) => (typeof p === 'string' ? p : p.out)).join(''),
    }))
  )
}

// MutationObserver init script (runs before any page script): it records nothing until the server markup is
// parsed, then every mutation under <body> with the DOM path of its target. Next 10 writes its scripts at the
// end of <body>: the parser's insertion of the first script loaded from /_next/static/ inside <body> marks the
// point (by then #__next and __NEXT_DATA__ are fully parsed). Next 12 writes them as deferred scripts in
// <head>, which run once parsing is done: there the point is the end of parsing (readyState `interactive`,
// before any deferred script runs), and the parser's records still queued then are dropped. Parser insertions
// of the remaining Next script elements and anything inside a Next-owned script are not app mutations and are
// left out. window.__p012.lastMutationAt feeds the settle check.
export function moInitScript() {
  const s = (window.__p012 = {
    armed: false,
    records: [],
    lastMutationAt: 0,
    overflow: 0,
  })
  const pathOf = (n) => {
    const parts = []
    for (
      let el = n && n.nodeType === 1 ? n : n && n.parentElement;
      el && el.nodeType === 1;
      el = el.parentElement
    ) {
      let i = 1
      for (let x = el.previousElementSibling; x; x = x.previousElementSibling)
        if (x.tagName === el.tagName) i++
      parts.unshift(`${el.tagName.toLowerCase()}[${i}]`)
    }
    return parts.join('/')
  }
  const isNextScript = (n) =>
    n.nodeType === 1 &&
    n.tagName === 'SCRIPT' &&
    (n.id === '__NEXT_DATA__' ||
      /\/_next\/static\//.test(n.getAttribute('src') || ''))
  const isChunkScript = (n) =>
    n.nodeType === 1 &&
    n.tagName === 'SCRIPT' &&
    /\/_next\/static\//.test(n.getAttribute('src') || '')
  const inNextScript = (n) => {
    for (let e = n; e; e = e.parentNode) if (isNextScript(e)) return true
    return false
  }
  const sig = (n) =>
    n.nodeType === 1
      ? n.tagName.toLowerCase()
      : n.nodeType === 3
      ? '#text'
      : n.nodeType === 8
      ? '#comment'
      : `#${n.nodeType}`
  const inBody = (n) => {
    for (let e = n; e; e = e.parentNode) if (e === document.body) return true
    return false
  }
  const mo = new MutationObserver((list) => {
    for (const m of list) {
      if (!s.armed) {
        if (
          m.type === 'childList' &&
          inBody(m.target) &&
          Array.from(m.addedNodes).some(isChunkScript)
        )
          s.armed = true
        continue
      }
      if (!inBody(m.target) || inNextScript(m.target)) continue
      const added = Array.from(m.addedNodes)
      const removed = Array.from(m.removedNodes)
      if (
        m.type === 'childList' &&
        removed.length === 0 &&
        added.length > 0 &&
        added.every(isNextScript)
      )
        continue
      s.lastMutationAt = performance.now()
      if (s.records.length >= 20000) {
        s.overflow++
        continue
      }
      s.records.push({
        type: m.type,
        target: pathOf(m.target),
        attribute: m.attributeName || null,
        added: added.map(sig),
        removed: removed.map(sig),
      })
    }
  })
  mo.observe(document, {
    subtree: true,
    childList: true,
    attributes: true,
    characterData: true,
  })
  document.addEventListener('readystatechange', () => {
    if (document.readyState !== 'interactive' || s.armed) return
    mo.takeRecords()
    s.armed = true
  })
}

// ---------- node side ----------
export const serializeBody = (page, buildId) =>
  page.evaluate(serializeBodyInPage, { buildId, long: LONG_VALUE })

export const linesText = (lines) => lines.map((l) => l.text).join('\n')

// Myers O(ND) line diff -> [{op: '=', '-', '+', a, b}] over two string arrays
export function diffLines(a, b) {
  const n = a.length
  const m = b.length
  const max = n + m
  const v = new Map([[1, 0]])
  const trace = []
  outer: for (let d = 0; d <= max; d++) {
    trace.push(new Map(v))
    for (let k = -d; k <= d; k += 2) {
      let x
      if (k === -d || (k !== d && (v.get(k - 1) ?? -1) < (v.get(k + 1) ?? -1)))
        x = v.get(k + 1) ?? 0
      else x = (v.get(k - 1) ?? 0) + 1
      let y = x - k
      while (x < n && y < m && a[x] === b[y]) {
        x++
        y++
      }
      v.set(k, x)
      if (x >= n && y >= m) break outer
    }
  }
  const ops = []
  let x = n
  let y = m
  for (let d = trace.length - 1; d >= 0; d--) {
    const vd = trace[d]
    const k = x - y
    let prevK
    if (k === -d || (k !== d && (vd.get(k - 1) ?? -1) < (vd.get(k + 1) ?? -1)))
      prevK = k + 1
    else prevK = k - 1
    const prevX = vd.get(prevK) ?? 0
    const prevY = prevX - prevK
    while (x > prevX && y > prevY) {
      ops.push({ op: '=', a: x - 1, b: y - 1 })
      x--
      y--
    }
    if (d > 0) {
      if (x === prevX) ops.push({ op: '+', b: y - 1 })
      else ops.push({ op: '-', a: x - 1 })
    }
    x = prevX
    y = prevY
  }
  return ops.reverse()
}

// the no-JS -> hydrated difference as text: hunks `@@ -<line in no-JS> +<line in hydrated> @@` (1-based,
// as in a unified diff, so the hydrated DOM is fully determined by the no-JS DOM and this text), then one
// line per changed line, prefixed '-' or '+', with the DOM path of the node; plus the first differing DOM
// path (C7 (1) tuple member) or null
export function domDiff(nojs, hydrated) {
  const ops = diffLines(
    nojs.map((l) => l.text),
    hydrated.map((l) => l.text)
  )
  const out = []
  let first = null
  let changed = 0
  let inHunk = false
  let ai = 0
  let bi = 0
  for (const o of ops) {
    if (o.op === '=') {
      inHunk = false
      ai++
      bi++
      continue
    }
    if (!inHunk) {
      out.push(`@@ -${ai + 1} +${bi + 1} @@`)
      inHunk = true
    }
    const l = o.op === '-' ? nojs[o.a] : hydrated[o.b]
    if (first == null) first = l.path || 'body'
    out.push(`${o.op} ${l.path || '-'} ${l.text.trim()}`)
    changed++
    if (o.op === '-') ai++
    else bi++
  }
  return { text: out.join('\n'), firstPath: first, changed }
}

// MutationObserver records reduced to a deterministic summary: the multiset of (type, target, attribute,
// added, removed), sorted, so async client work (fetches resolving in either order) cannot reorder it.
// Attribute records count as present (`*`), not by number: Leaflet fades tiles in with one inline-style
// write per animation frame, so their count follows the frame rate; the settled values are in the hydrated
// DOM itself. childList and characterData records keep their counts.
export function moSummary(records) {
  const counts = new Map()
  for (const r of records) {
    const key = `${r.type} ${r.target}${r.attribute ? ` @${r.attribute}` : ''}${
      r.added.length ? ` +[${r.added.join(',')}]` : ''
    }${r.removed.length ? ` -[${r.removed.join(',')}]` : ''}`
    counts.set(key, (counts.get(key) || 0) + 1)
  }
  return [...counts]
    .sort((x, y) => (x[0] < y[0] ? -1 : x[0] > y[0] ? 1 : 0))
    .map(([k, c]) => `${k.startsWith('attributes ') ? '*' : c} ${k}`)
    .join('\n')
}

export const sha256 = (s) => crypto.createHash('sha256').update(s).digest('hex')
