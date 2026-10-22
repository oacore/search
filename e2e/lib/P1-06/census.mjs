// P1-06 in-page census functions (T-739, T-805). Each export runs inside the page through page.evaluate or
// page.addInitScript, so it is self-contained apart from window.__p106, which installHelpers defines.
//
// Element set: <html>, <body> and every element below <body> (the #__next tree and the portals the modals
// render into <body>), except head-only and non-rendered tags (script, style, link, meta, noscript,
// template). Element key: the DOM path from <html>, one `tag[n]` per level with n = the 1-based position among
// siblings of the same tag (`body[1]/div[1]/div[2]/header[1]`). Values that hold a URL of the test stack
// (its ports change per run) have the stack origin replaced by `<stack>`; nothing else is normalised (40 §1:
// the style aspects have no normalisation).

export function installHelpers() {
  if (window.__p106) return
  const SKIP = new Set([
    'head',
    'script',
    'style',
    'link',
    'meta',
    'noscript',
    'template',
    'title',
    'base',
  ])
  const pathOf = (el) => {
    if (!el || el.nodeType !== 1) return null
    if (el === document.documentElement) return 'html'
    const parts = []
    for (
      let e = el;
      e && e.nodeType === 1 && e !== document.documentElement;
      e = e.parentElement
    ) {
      let i = 1
      for (let s = e.previousElementSibling; s; s = s.previousElementSibling)
        if (s.tagName === e.tagName) i += 1
      parts.unshift(`${e.tagName.toLowerCase()}[${i}]`)
    }
    return parts.join('/')
  }
  // [element, path] in document order
  const walk = (root) => {
    const out = []
    const visit = (el, path) => {
      out.push([el, path])
      const counts = {}
      for (const c of el.children) {
        const tag = c.tagName.toLowerCase()
        counts[tag] = (counts[tag] || 0) + 1
        if (!SKIP.has(tag)) visit(c, `${path}/${tag}[${counts[tag]}]`)
      }
    }
    if (root) {
      visit(root, pathOf(root))
      return out
    }
    out.push([document.documentElement, 'html'])
    if (document.body) visit(document.body, pathOf(document.body))
    return out
  }
  let origins = []
  const norm = (v) => {
    let s = v
    for (const o of origins) s = s.split(o).join('<stack>')
    return s
  }
  // every property name getComputedStyle enumerates for the element (longhands and custom properties) minus
  // the exclusions, sorted by name, with its value
  const styleOf = (el, exclude, pseudo) => {
    const cs = getComputedStyle(el, pseudo || null)
    const names = []
    for (let i = 0; i < cs.length; i += 1)
      if (!exclude.has(cs[i])) names.push(cs[i])
    names.sort()
    const o = {}
    for (const n of names) o[n] = norm(cs.getPropertyValue(n))
    return o
  }
  const pseudoContent = (el) => {
    const out = {}
    for (const pe of ['::before', '::after']) {
      const c = norm(getComputedStyle(el, pe).getPropertyValue('content'))
      if (c && c !== 'none' && c !== 'normal') out[pe] = c
    }
    return out
  }
  // base (the most frequent value of each property over the elements; ties: the smaller JSON string; a
  // property an element does not enumerate counts as null) and per-object deltas against it
  const compress = (objects, weights) => {
    const counts = new Map()
    const names = new Set()
    objects.forEach((o) => Object.keys(o).forEach((n) => names.add(n)))
    objects.forEach((o, i) => {
      for (const n of names) {
        const v = n in o ? o[n] : null
        if (!counts.has(n)) counts.set(n, new Map())
        const m = counts.get(n)
        const k = JSON.stringify(v)
        m.set(k, (m.get(k) || 0) + (weights ? weights[i] : 1))
      }
    })
    const base = {}
    for (const n of [...names].sort()) {
      const best = [...counts.get(n)].sort((a, b) =>
        b[1] !== a[1] ? b[1] - a[1] : a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0
      )[0][0]
      const v = JSON.parse(best)
      if (v !== null) base[n] = v
    }
    const deltas = objects.map((o) => {
      const d = {}
      for (const n of [...names].sort()) {
        const v = n in o ? o[n] : null
        const b = n in base ? base[n] : null
        if (v !== b) d[n] = v
      }
      return d
    })
    return { base, deltas, properties: names.size }
  }
  window.__p106 = {
    SKIP,
    pathOf,
    walk,
    norm,
    styleOf,
    pseudoContent,
    compress,
    setOrigins: (o) => {
      origins = o
    },
    forced: [],
    forcedBase: [],
  }
}

// T-805 c1: computed-style census. Distinct style objects become profiles (first appearance in document
// order); each element line is `<path> <profile>` plus the `content` of ::before / ::after when it generates
// one (not none / normal).
export function styleCensus({ exclude, origins }) {
  const h = window.__p106
  h.setOrigins(origins)
  const ex = new Set(exclude)
  const index = new Map()
  const profiles = []
  const weights = []
  const elements = []
  for (const [el, path] of h.walk()) {
    const o = h.styleOf(el, ex)
    const key = JSON.stringify(o)
    let i = index.get(key)
    if (i === undefined) {
      i = profiles.length
      index.set(key, i)
      profiles.push(o)
      weights.push(0)
    }
    weights[i] += 1
    let line = `${path} ${i}`
    const pc = h.pseudoContent(el)
    for (const pe of Object.keys(pc)) line += ` ${pe}=${pc[pe]}`
    elements.push(line)
  }
  const { base, deltas, properties } = h.compress(profiles, weights)
  return { properties, base, profiles: deltas, elements }
}

// T-739 c1: geometry census, one line per element: `<path> <display> <visibility> <x> <y> <width> <height>`
// (getBoundingClientRect at scroll position 0, 0: document coordinates)
export function geometryCensus() {
  const h = window.__p106
  const elements = []
  for (const [el, path] of h.walk()) {
    const r = el.getBoundingClientRect()
    const cs = getComputedStyle(el)
    elements.push(
      `${path} ${cs.display} ${cs.visibility} ${r.x} ${r.y} ${r.width} ${r.height}`
    )
  }
  const d = document.documentElement
  return {
    viewport: { width: window.innerWidth, height: window.innerHeight },
    document: {
      clientWidth: d.clientWidth,
      scrollWidth: d.scrollWidth,
      scrollHeight: d.scrollHeight,
    },
    scroll: { x: window.scrollX, y: window.scrollY },
    elements,
  }
}

// T-739 c2: elements whose box reaches past the right edge of the viewport (the cause of a horizontal
// overflow), rendered ones only, with their right edge
export function overflowCensus() {
  const h = window.__p106
  const W = document.documentElement.clientWidth
  const out = []
  for (const [el, path] of h.walk()) {
    const r = el.getBoundingClientRect()
    if (r.width === 0 && r.height === 0) continue
    if (r.right > W) out.push(`${path} ${r.right}`)
  }
  return {
    clientWidth: W,
    scrollWidth: document.documentElement.scrollWidth,
    elements: out,
  }
}

// T-805 c2: the elements whose pseudo-classes are forced: rendered elements that are interactive by tag or
// role, or the outermost element of a pointer-cursor area (cursor: pointer, its parent not)
export function markInteractive() {
  const h = window.__p106
  const ROLES = new Set([
    'button',
    'link',
    'checkbox',
    'radio',
    'option',
    'menuitem',
    'tab',
    'switch',
    'combobox',
    'textbox',
    'slider',
    'presentation',
  ])
  const TAGS = new Set([
    'a',
    'button',
    'input',
    'select',
    'textarea',
    'summary',
    'label',
  ])
  const picked = []
  for (const [el, path] of h.walk()) {
    if (!el.getClientRects().length) continue
    const tag = el.tagName.toLowerCase()
    const role = el.getAttribute('role')
    const byTag =
      (TAGS.has(tag) && (tag !== 'a' || el.hasAttribute('href'))) ||
      el.hasAttribute('tabindex') ||
      (role && ROLES.has(role))
    const cursor = getComputedStyle(el).cursor === 'pointer'
    const parentCursor =
      el.parentElement &&
      getComputedStyle(el.parentElement).cursor === 'pointer'
    if (byTag || (cursor && !parentCursor)) picked.push([el, path])
  }
  h.forced = picked.map(([el]) => el)
  h.forcedBase = []
  return picked.map(([, path]) => path)
}

// the subtree snapshot of forced element i: '.' = the element, './a[1]/span[2]' = a descendant (at most
// 400 nodes), each with its full style and the content of ::before / ::after
export function forcedSnapshot({ i, exclude, origins, store }) {
  const h = window.__p106
  h.setOrigins(origins)
  const ex = new Set(exclude)
  const root = h.forced[i]
  const snap = {}
  const nodes = h.walk(root).slice(0, 400)
  const rootPath = h.pathOf(root)
  for (const [el, path] of nodes) {
    const rel = path === rootPath ? '.' : `.${path.slice(rootPath.length)}`
    const o = h.styleOf(el, ex)
    const pc = h.pseudoContent(el)
    for (const pe of Object.keys(pc)) o[`${pe} content`] = pc[pe]
    snap[rel] = o
  }
  if (store) {
    h.forcedBase[i] = snap
    return null
  }
  const base = h.forcedBase[i] || {}
  const delta = {}
  for (const rel of Object.keys(snap)) {
    const a = snap[rel]
    const b = base[rel] || {}
    const d = {}
    for (const n of Object.keys(a)) if (a[n] !== b[n]) d[n] = a[n]
    for (const n of Object.keys(b)) if (!(n in a)) d[n] = null
    if (Object.keys(d).length) delta[rel] = d
  }
  for (const rel of Object.keys(base))
    if (!(rel in snap)) delta[rel] = { '(node)': null }
  return delta
}

// T-805 c3: motion event recorder, installed before any page script (page.addInitScript): every
// transitionrun and animationstart with the target's path, the property or animation name and the pseudo
// element (and the target itself, see motionPhase). A run or start is what "motion happened" means here;
// end/cancel counts depend on frame timing.
export function installMotionRecorder() {
  if (window.__p106motion) return
  const rec = { events: [] }
  window.__p106motion = rec
  const pathOf = (el) => {
    if (!el || el.nodeType !== 1) return null
    if (el === document.documentElement) return 'html'
    const parts = []
    for (
      let e = el;
      e && e.nodeType === 1 && e !== document.documentElement;
      e = e.parentElement
    ) {
      let i = 1
      for (let s = e.previousElementSibling; s; s = s.previousElementSibling)
        if (s.tagName === e.tagName) i += 1
      parts.unshift(`${e.tagName.toLowerCase()}[${i}]`)
    }
    return parts.join('/')
  }
  const on = (type) =>
    document.addEventListener(
      type,
      (e) => {
        rec.events.push({
          line: [
            type,
            pathOf(e.target),
            e.propertyName || e.animationName || '',
            e.pseudoElement || '',
          ].join(' '),
          target: e.target,
        })
      },
      true
    )
  on('transitionrun')
  on('animationstart')
}

// T-805 c3: one phase of a state change: the motion events since the last phase (distinct, sorted), the
// animations still running (infinite ones; finite ones have ended once the phase is settled) and the computed
// transition-* / animation-* longhands of every element (base = the most frequent value set, deltas per path).
// The initial phase (the settled page after its load, `initial`) keeps only the events of elements that are
// still in the document: an element that a load renders and removes again (the similar-works loader while
// its request is answered) gets an animation frame or not depending on timing, an intermediate state (40 §5);
// the loaders are censused with their requests held instead. The phases after a user action keep every event.
export function motionPhase({ origins, initial = false }) {
  const h = window.__p106
  h.setOrigins(origins)
  const rec = window.__p106motion || { events: [] }
  const events = [
    ...new Set(
      rec.events
        .splice(0)
        .filter((e) => !initial || (e.target && e.target.isConnected))
        .map((e) => e.line)
    ),
  ].sort()
  const running = document
    .getAnimations()
    .filter((a) => a.playState === 'running' || a.playState === 'paused')
    .map((a) => {
      const t = a.effect.getTiming()
      return [
        a.constructor.name,
        h.pathOf(a.effect.target) + (a.effect.pseudoElement || ''),
        a.animationName || a.transitionProperty || '',
        `duration=${t.duration}`,
        `delay=${t.delay}`,
        `iterations=${t.iterations}`,
        `easing=${t.easing}`,
        `fill=${t.fill}`,
        `direction=${t.direction}`,
        a.playState,
      ].join(' ')
    })
    .sort()
  const objects = []
  const paths = []
  for (const [el, path] of h.walk()) {
    const cs = getComputedStyle(el)
    const o = {}
    const names = []
    for (let i = 0; i < cs.length; i += 1)
      if (/^(transition|animation)-/.test(cs[i])) names.push(cs[i])
    names.sort()
    for (const n of names) o[n] = h.norm(cs.getPropertyValue(n))
    objects.push(o)
    paths.push(path)
  }
  const { base, deltas } = h.compress(objects)
  const styles = {}
  deltas.forEach((d, i) => {
    if (Object.keys(d).length) styles[paths[i]] = d
  })
  return { events, running, base, styles }
}

// a phase is settled for motion once no finite animation runs any more
export function finiteAnimationsDone() {
  return document
    .getAnimations()
    .every(
      (a) =>
        a.playState !== 'running' ||
        a.effect.getComputedTiming().endTime === Infinity
    )
}

// T-805 c4: media-rule census of the runtime style sheets (document.styleSheets and adoptedStyleSheets, so a
// CSS-in-JS sheet is included): per sheet its owner, href (stack origin and the content hash of a Next CSS
// chunk replaced), rule counts by type, and every @media rule (also nested) with its at-rule chain, condition,
// number of child rules and the child selectors; plus the distinct media conditions
export function mediaCensus({ origins }) {
  const h = window.__p106
  h.setOrigins(origins)
  const label = (r) => {
    const t = r.constructor.name
    if (r.selectorText !== undefined) return r.selectorText
    if (t === 'CSSKeyframesRule') return `@keyframes ${r.name}`
    if (t === 'CSSMediaRule') return `@media ${r.conditionText}`
    if (t === 'CSSSupportsRule') return `@supports ${r.conditionText}`
    if (t === 'CSSFontFaceRule') return '@font-face'
    if (t === 'CSSImportRule') return `@import ${r.href}`
    if (t === 'CSSLayerBlockRule') return `@layer ${r.name}`
    if (t === 'CSSLayerStatementRule') return `@layer ${r.nameList.join(', ')}`
    if (t === 'CSSContainerRule') return `@container ${r.conditionText}`
    if (t === 'CSSPageRule') return '@page'
    return `@${t}`
  }
  const sheets = []
  const conditions = new Set()
  const list = [
    ...[...document.styleSheets].map((s) => [s, 'document']),
    ...[...(document.adoptedStyleSheets || [])].map((s) => [s, 'adopted']),
  ]
  list.forEach(([s, kind], index) => {
    const owner = s.ownerNode
      ? `${s.ownerNode.tagName.toLowerCase()}${
          s.ownerNode.id ? `#${s.ownerNode.id}` : ''
        }`
      : kind
    const href = s.href
      ? h.norm(s.href).replace(/\/[0-9a-f]{16,}\.css$/, '/<hash>.css')
      : null
    let rules
    try {
      rules = s.cssRules
    } catch (e) {
      sheets.push({ index, kind, owner, href, error: String(e.name) })
      return
    }
    const types = {}
    const media = []
    // at = the rule's index path in the sheet (1.4 = child 4 of rule 1); within = the enclosing at-rules
    const visit = (rs, at, within) => {
      for (let i = 0; i < rs.length; i += 1) {
        const r = rs[i]
        const t = r.constructor.name
        types[t] = (types[t] || 0) + 1
        if (t === 'CSSMediaRule') {
          conditions.add(r.conditionText)
          media.push({
            at: [...at, i].join('.'),
            within: within.join(' > '),
            condition: r.conditionText,
            rules: r.cssRules.length,
            children: [...r.cssRules].map(label),
          })
        }
        if (r.cssRules) visit(r.cssRules, [...at, i], [...within, label(r)])
      }
    }
    visit(rules, [], [])
    sheets.push({
      index,
      kind,
      owner,
      href,
      disabled: s.disabled,
      media: s.media ? s.media.mediaText : '',
      topLevelRules: rules.length,
      types,
      mediaRules: media,
    })
  })
  return { sheets, conditions: [...conditions].sort() }
}

export const mediaMatches = (conditions) =>
  conditions.map((c) => [c, window.matchMedia(c).matches])

// T-805 c5: cascade-layer and CSS-in-JS census (phase 7 brings antd's layered cssinjs; today none exists)
export function layerCensus() {
  const counts = {
    CSSLayerBlockRule: 0,
    CSSLayerStatementRule: 0,
    CSSScopeRule: 0,
    CSSContainerRule: 0,
  }
  const names = new Set()
  const visit = (rs) => {
    for (let i = 0; i < rs.length; i += 1) {
      const r = rs[i]
      const t = r.constructor.name
      if (t in counts) counts[t] += 1
      if (t === 'CSSLayerBlockRule') names.add(r.name)
      if (t === 'CSSLayerStatementRule') r.nameList.forEach((n) => names.add(n))
      if (r.cssRules) visit(r.cssRules)
    }
  }
  for (const s of [
    ...document.styleSheets,
    ...(document.adoptedStyleSheets || []),
  ]) {
    try {
      visit(s.cssRules)
    } catch {
      // cross-origin sheets are counted by the media census
    }
  }
  const CSSINJS = [
    'data-css-hash',
    'data-rc-order',
    'data-rc-priority',
    'data-token-hash',
    'data-cache-path',
  ]
  return {
    rules: counts,
    layerNames: [...names].sort(),
    adoptedStyleSheets: (document.adoptedStyleSheets || []).length,
    styleElements: document.querySelectorAll('style').length,
    cssinjsStyleElements: document.querySelectorAll(
      CSSINJS.map((a) => `style[${a}]`).join(', ')
    ).length,
    antClassElements: document.querySelectorAll('[class*="ant-"]').length,
    antCustomProperties: [...getComputedStyle(document.documentElement)].filter(
      (p) => p.startsWith('--ant')
    ).length,
  }
}

// T-805 c5: the design's global element rules on bare probes (R-087's elements: button and the button
// types, label, input, select, textarea, ul): a probe container is appended to <body>, each probe's full
// style is recorded as a delta against the container's <div> sibling, and the container is removed again
export function probeCensus({ exclude, origins }) {
  const h = window.__p106
  h.setOrigins(origins)
  const ex = new Set(exclude)
  const box = document.createElement('div')
  box.setAttribute('data-p106-probe', '')
  const make = (html) => {
    const t = document.createElement('template')
    t.innerHTML = html
    return t.content.firstElementChild
  }
  const probes = [
    ['div', '<div></div>'],
    ['button', '<button>x</button>'],
    ['button[type=button]', '<button type="button">x</button>'],
    ['button[type=submit]', '<button type="submit">x</button>'],
    ['button[type=reset]', '<button type="reset">x</button>'],
    ['input[type=button]', '<input type="button" value="x">'],
    ['input[type=submit]', '<input type="submit" value="x">'],
    ['input[type=reset]', '<input type="reset" value="x">'],
    ['label', '<label>x</label>'],
    ['input', '<input>'],
    ['input[type=checkbox]', '<input type="checkbox">'],
    ['select', '<select><option>x</option></select>'],
    ['textarea', '<textarea></textarea>'],
    ['ul', '<ul><li>x</li></ul>'],
    ['ul > li', null],
  ]
  const els = []
  for (const [name, html] of probes) {
    if (!html) {
      els.push([name, els.find(([n]) => n === 'ul')[1].firstElementChild])
      continue
    }
    const el = make(html)
    box.appendChild(el)
    els.push([name, el])
  }
  document.body.appendChild(box)
  const styles = els.map(([name, el]) => [name, h.styleOf(el, ex)])
  box.remove()
  const div = styles[0][1]
  const out = {}
  for (const [name, o] of styles.slice(1)) {
    const d = {}
    for (const n of Object.keys(o)) if (o[n] !== div[n]) d[n] = o[n]
    for (const n of Object.keys(div)) if (!(n in o)) d[n] = null
    out[name] = d
  }
  return { div, probes: out }
}
