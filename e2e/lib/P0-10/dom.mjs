// P0-10 DOM readers. The SSR view of a page is the raw HTTP body parsed by the browser's HTML parser in an
// inert document (DOMParser: scripting disabled, no subresource loads, comments kept), which is the "DOM
// parser, JS off" view of 40 §1; the hydrated view is the live document of a JS-enabled page.

// the __NEXT_DATA__ payload is a JSON text inside one script element; its bytes do not change the parsed
// tree around it, so the large ones (/data-providers/ is ~7 MB) are replaced before they cross into the page
export function withoutNextData(html) {
  return html.replace(
    /(<script id="__NEXT_DATA__" type="application\/json">)[\s\S]*?(<\/script>)/,
    '$1{}$2'
  )
}

// in-page (serialised by page.evaluate, so self-contained; no eval: the app's CSP has no 'unsafe-eval'):
// source = raw HTML to parse inertly, or null for the live document; element -> { tag, attrs, text?, childNodes? }
function headReader(source) {
  const doc =
    source == null
      ? document
      : new DOMParser().parseFromString(source, 'text/html')
  const attrsOf = (el) => {
    const o = {}
    for (const a of el.attributes) o[a.name] = a.value
    return o
  }
  const nodesOf = (el) =>
    [...el.childNodes].map((n) =>
      n.nodeType === 8
        ? { type: 'comment', data: n.data }
        : n.nodeType === 3
        ? { type: 'text', data: n.data }
        : { type: 'element', tag: n.localName }
    )
  const describe = (el) => {
    const tag = el.localName
    const out = { tag, attrs: attrsOf(el) }
    if (tag === 'title') {
      out.text = el.textContent
      out.childNodes = nodesOf(el)
    } else if (['script', 'style', 'noscript'].includes(tag))
      out.text = el.textContent
    return out
  }
  const lead = []
  // nodes the parser moved into <body> ahead of the app root (a head broken open by markup, S-4)
  for (const n of doc.body ? [...doc.body.childNodes] : []) {
    if (n.nodeType === 1 && n.id === '__next') break
    if (n.nodeType === 3 && !n.data.trim()) continue
    lead.push(
      n.nodeType === 1
        ? describe(n)
        : n.nodeType === 3
        ? { text: n.data }
        : { comment: n.data }
    )
  }
  return {
    htmlAttrs: attrsOf(doc.documentElement),
    head: [...doc.head.children].map(describe),
    bodyLead: lead,
  }
}

export const parseHead = (page, html) =>
  page.evaluate(headReader, withoutNextData(html))
export const liveHead = (page) => page.evaluate(headReader, null)

// in-page: class census of a document (T-605). Every element under <body> that has a class attribute, plus
// every button, a, input and form, keyed by its DOM path (tag[n of that tag among siblings], #id kept for
// reading), with its class attribute and type, form, disabled, href, target, rel; image URLs (img src,
// svg image/use href) ride along so a wrong asset prefix (R-021) or an import object (R-007) shows. Also
// every attribute value (and <style> text) that contains "[object Object]".
function censusReader(source) {
  const doc =
    source == null
      ? document
      : new DOMParser().parseFromString(source, 'text/html')
  const BEHAVIOUR = ['type', 'form', 'disabled', 'href', 'target', 'rel']
  const TAGS = new Set(['button', 'a', 'input', 'form'])
  const rows = []
  const objectObject = []
  const step = (el) => {
    let i = 1
    for (let s = el.previousElementSibling; s; s = s.previousElementSibling)
      if (s.localName === el.localName) i++
    return `${el.localName}[${i}]${el.id ? `#${el.id}` : ''}`
  }
  const walk = (el, prefix) => {
    const p = `${prefix}/${step(el)}`
    for (const a of el.attributes)
      if (a.value.includes('[object Object]'))
        objectObject.push({ path: p, attr: a.name, value: a.value })
    if (el.localName === 'style' && el.textContent.includes('[object Object]'))
      objectObject.push({ path: p, attr: '#text', value: el.textContent })
    const tag = el.localName
    const attrs = {}
    if (TAGS.has(tag))
      for (const n of BEHAVIOUR)
        if (el.hasAttribute(n)) attrs[n] = el.getAttribute(n)
    if (tag === 'img') {
      if (el.hasAttribute('src')) attrs.src = el.getAttribute('src')
      if (el.hasAttribute('srcset')) attrs.srcset = el.getAttribute('srcset')
    }
    if (tag === 'image' || tag === 'use') {
      const h = el.getAttribute('href') || el.getAttribute('xlink:href')
      if (h !== null) attrs.href = h
    }
    if (el.hasAttribute('class') || Object.keys(attrs).length || TAGS.has(tag))
      rows.push({
        path: p,
        class: el.hasAttribute('class') ? el.getAttribute('class') : null,
        attrs,
      })
    for (const c of el.children) walk(c, p)
  }
  if (doc.body) walk(doc.body, '/html[1]')
  return { rows, objectObject }
}

export const parsedCensus = (page, html) =>
  page.evaluate(censusReader, withoutNextData(html))
export const liveCensus = (page) => page.evaluate(censusReader, null)

// the __NEXT_DATA__ JSON of a raw HTML body (T-610)
export function nextDataOf(html) {
  const m =
    /<script id="__NEXT_DATA__" type="application\/json">([\s\S]*?)<\/script>/.exec(
      html
    )
  return m ? JSON.parse(m[1]) : null
}
