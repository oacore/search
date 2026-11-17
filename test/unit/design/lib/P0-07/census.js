// T-417 census engine (P0-07). Renders one state of a design unit in jsdom and
// records, as canonical strings:
// - dom: the rendered DOM of the unit (container and its portals), tag,
//   attributes in DOM order (class tokens in order) and text;
// - interactions (c2): for every element of the unit and every interaction
//   (click, dblclick, hover, focus, Enter, Space, Esc, ArrowDown) on a fresh
//   render: the DOM mutations, the focused element, the URL and navigation
//   intents, the network requests, the checkValidity() changes, the cookie
//   writes, the callbacks called and the console output;
// - overlays (c4): with the overlay open, window blur, scroll by 100 px and
//   resize by +1 and -1 px: DOM mutations, focus, network.
// Timing is fake and fixed: every observation is taken 300 ms (fake time,
// timers in order with the microtasks between them) after the action, so
// "hover 300 ms" is the pointer held for 300 ms. Keyboard interactions focus
// the element first (a no-op when it is not focusable) and press the key on
// the active element, as a user does.
// Navigation is never performed by jsdom: an anchor activation or a form
// submission that nobody prevented is recorded as an intent and then
// prevented at the window (the last listener of the bubbling path).
// jsdom has no setImmediate: the core-js polyfill the Babel config injected
// into this file (useBuiltIns: 'usage') until CS-SWC-1, now imported by hand
require('core-js/modules/web.immediate')
const crypto = require('crypto')
const util = require('util')

const React = require('react')

const {
  render,
  act,
  cleanup,
  userEvent,
  screen,
} = require('../../../../utils/render')
const { FIXED_NOW } = require('../../../../utils/clock')

const INTERACTIONS = [
  'click',
  'dblclick',
  'hover',
  'focus',
  'Enter',
  'Space',
  'Esc',
  'ArrowDown',
]
const KEYS = {
  Enter: '{Enter}',
  Space: '[Space]',
  Esc: '{Escape}',
  ArrowDown: '{ArrowDown}',
}
const WINDOW_EVENTS = ['blur', 'scroll-100', 'resize+1', 'resize-1']
const SETTLE_MS = 300
const BASE_URL = 'http://localhost/'
const BASE_WIDTH = 1024
const BASE_HEIGHT = 768

// fake timers that leave the microtask and immediate queues real, so that
// promises (fetch, MSW) settle while time is controlled
const fakeTimers = () =>
  jest.useFakeTimers({
    now: FIXED_NOW,
    doNotFake: ['nextTick', 'queueMicrotask', 'setImmediate', 'clearImmediate'],
  })

const flush = () => new Promise((resolve) => setImmediate(resolve))

// user-event on the fake clock. Between two pointer or key events the fake
// time moves by 0 ms, so the timers and React effects due by then run, as in a
// browser where a user never sends two events in one task (`delay: null`
// sends a whole typed string inside one task: the Select's input/value
// effects then never settle, which no browser can produce)
const userSetup = () =>
  userEvent.setup({
    delay: 0,
    advanceTimers: (ms) => jest.advanceTimersByTime(ms),
  })

const sha256 = (text) => crypto.createHash('sha256').update(text).digest('hex')

// long literals (data URIs, inline SVG, popper styles) are kept as their
// length and sha256 so the reference stays readable; equality is exact
const LONG_VALUE = 200
const literal = (value) =>
  value.length > LONG_VALUE
    ? `sha256:${sha256(value)}:${value.length}`
    : JSON.stringify(value)

// a mutation list longer than this is kept as count, sha256 and its head
const LONG_LIST = 16
const compactList = (lines) =>
  lines.length > LONG_LIST
    ? {
        count: lines.length,
        sha256: sha256(lines.join('\n')),
        head: lines.slice(0, 8),
      }
    : lines

// ---------- canonical DOM ----------
const elementChildren = (node) => Array.from(node.children || [])

const pathOf = (node) => {
  if (!node || node === document.body) return 'body'
  if (node === document.documentElement) return 'html'
  if (node.nodeType !== 1) {
    // a text or comment node: its parent's path and its child index
    const parent = node.parentNode
    if (!parent) return '(detached)#text'
    const index = Array.from(parent.childNodes).indexOf(node)
    return `${pathOf(parent)}>#${index}`
  }
  const parts = []
  let n = node
  while (n && n !== document.body) {
    const parent = n.parentElement
    if (!parent) return `(detached)${parts.length ? `>${parts.join('>')}` : ''}`
    parts.unshift(
      `${elementChildren(parent).indexOf(n)}:${n.tagName.toLowerCase()}`
    )
    n = parent
  }
  return parts.join('>')
}

const attrs = (el) =>
  Array.from(el.attributes)
    .map((a) => `${a.name}=${literal(a.value)}`)
    .join(' ')

const serialize = (node, depth = 0, out = []) => {
  const pad = '  '.repeat(depth)
  for (const child of Array.from(node.childNodes)) {
    if (child.nodeType === 1) {
      const a = attrs(child)
      out.push(`${pad}<${child.tagName.toLowerCase()}${a ? ` ${a}` : ''}>`)
      serialize(child, depth + 1, out)
    } else if (child.nodeType === 3) {
      if (child.data.length) out.push(`${pad}${literal(child.data)}`)
    } else if (child.nodeType === 8) out.push(`${pad}<!--${child.data}-->`)
  }
  return out
}

// the unit's DOM: everything in body (RTL's container first, then portals)
const unitDom = () => serialize(document.body)

const unitElements = () =>
  Array.from(document.body.querySelectorAll('*')).filter(
    (el) => el !== document.body.firstElementChild
  )

const describeNode = (n) => {
  if (n.nodeType === 3) return `#text${JSON.stringify(n.data.slice(0, 40))}`
  if (n.nodeType === 8) return '#comment'
  if (n.nodeType !== 1) return `#node${n.nodeType}`
  const id = n.id ? `#${n.id}` : ''
  const cls = n.getAttribute('class')
    ? `.${n.getAttribute('class').trim().split(/\s+/).join('.')}`
    : ''
  return `${n.tagName.toLowerCase()}${id}${cls}`
}

// consecutive identical lines are kept once with their count
const runLength = (lines) => {
  const out = []
  let last = null
  let count = 0
  const push = () => {
    if (last !== null) out.push(count > 1 ? `${last} x${count}` : last)
  }
  for (const line of lines) {
    if (line === last) count += 1
    else {
      push()
      last = line
      count = 1
    }
  }
  push()
  return out
}

const summarizeMutations = (records) =>
  runLength(
    records.map((r) => {
      const target = pathOf(r.target)
      if (r.type === 'attributes') {
        const value =
          r.target.getAttribute && r.target.getAttribute(r.attributeName)
        return `attr ${target} ${r.attributeName}=${
          value == null ? '(removed)' : literal(value)
        }`
      }
      if (r.type === 'characterData')
        return `text ${target} ${literal(r.target.data)}`
      const added = Array.from(r.addedNodes).map(describeNode)
      const removed = Array.from(r.removedNodes).map(describeNode)
      return `child ${target}${added.length ? ` +[${added.join(', ')}]` : ''}${
        removed.length ? ` -[${removed.join(', ')}]` : ''
      }`
    })
  )

const FORM_ELEMENTS = 'input,select,textarea,button,fieldset,form,output'
const validity = () =>
  Array.from(document.querySelectorAll(FORM_ELEMENTS)).map(
    (el) => `${pathOf(el)}:${el.checkValidity() ? 'valid' : 'invalid'}`
  )

const focusPath = () => pathOf(document.activeElement)

// ---------- environment ----------
const cookieNames = () =>
  document.cookie
    .split(';')
    .map((c) => c.split('=')[0].trim())
    .filter(Boolean)

const clearCookies = () => {
  for (const name of cookieNames()) {
    document.cookie = `${name}=; Max-Age=0; path=/`
    document.cookie = `${name}=; Max-Age=0`
  }
}

const setWindowSize = (width, height = BASE_HEIGHT) => {
  Object.defineProperty(window, 'innerWidth', {
    configurable: true,
    writable: true,
    value: width,
  })
  Object.defineProperty(window, 'innerHeight', {
    configurable: true,
    writable: true,
    value: height,
  })
}

const setScroll = (y) => {
  for (const key of ['scrollY', 'pageYOffset']) {
    Object.defineProperty(window, key, {
      configurable: true,
      writable: true,
      value: y,
    })
  }
  document.documentElement.scrollTop = y
}

const resetEnvironment = () => {
  cleanup()
  // leftovers of portals (Modal's #modal-root is never removed, 60 §6 row 6)
  for (const el of Array.from(document.body.children)) el.remove()
  document.body.removeAttribute('style')
  document.body.removeAttribute('class')
  document.documentElement.removeAttribute('style')
  if (document.activeElement && document.activeElement !== document.body)
    document.activeElement.blur()
  window.history.replaceState(null, '', BASE_URL)
  clearCookies()
  setWindowSize(BASE_WIDTH)
  setScroll(0)
}

// ---------- logs ----------
const createLogs = () => ({
  network: [],
  pending: 0,
  nav: [],
  calls: [],
  console: [],
})

// the logs of the observation in progress live on the window: the window
// listeners below are installed once per jsdom window, while this module may
// be loaded once per module registry (every census runs in a fresh one)
const LOGS = '__t417CurrentLogs'
const logsNow = () => window[LOGS] || null
const setLogs = (logs) => {
  window[LOGS] = logs
}

const GUARDS = '__t417Guards'
const ATTACHED = '__t417Attached'

const installWindowGuards = () => {
  // registered once per test file (jsdom window lives per file)
  if (window[GUARDS]) return
  window[GUARDS] = true
  // jsdom has no scrollIntoView (the Select calls it on ArrowDown,
  // use-options.js:125): a browser scrolls, here the call is recorded
  if (typeof Element.prototype.scrollIntoView !== 'function') {
    // eslint-disable-next-line func-names
    Element.prototype.scrollIntoView = function (...args) {
      if (logsNow()) {
        logsNow().calls.push(
          `scrollIntoView ${pathOf(this)} ${JSON.stringify(args)}`
        )
      }
    }
  }
  window.addEventListener('click', (event) => {
    const anchor =
      event.target && event.target.closest && event.target.closest('a[href]')
    if (!anchor || event.defaultPrevented) return
    if (logsNow()) {
      logsNow().nav.push(
        `navigate ${anchor.href}${
          anchor.target ? ` target=${anchor.target}` : ''
        }${anchor.hasAttribute('download') ? ' download' : ''}`
      )
    }
    event.preventDefault()
  })
  window.addEventListener('submit', (event) => {
    if (event.defaultPrevented) return
    const form = event.target
    if (logsNow()) {
      logsNow().nav.push(
        `submit ${pathOf(form)} ${(
          form.getAttribute('method') || 'get'
        ).toLowerCase()} ${form.action}`
      )
    }
    event.preventDefault()
  })
}

const attachNetwork = (server) => {
  if (!server || server[ATTACHED]) return
  server[ATTACHED] = true
  server.events.on('request:start', ({ request }) => {
    const logs = logsNow()
    if (!logs) return
    logs.pending += 1
    logs.network.push(
      `${request.method} ${request.url} credentials=${request.credentials}`
    )
  })
  const done = () => {
    const logs = logsNow()
    if (logs && logs.pending > 0) logs.pending -= 1
  }
  server.events.on('response:mocked', done)
  server.events.on('response:bypass', done)
  server.events.on('request:unhandled', done)
}

const REACT_DEV_WARNING =
  /^(In HTML, |<\w+> cannot (contain|be a descendant of) |Accessing element\.ref was removed in React 19)/

const captureConsole = (logs) => {
  const spies = ['error', 'warn', 'log', 'info'].map((level) =>
    jest.spyOn(console, level).mockImplementation((...args) => {
      const text = util
        .format(
          ...args.map((a) =>
            a instanceof Error ? `${a.name}: ${a.message}` : a
          )
        )
        .split('\n')[0]
      // React development-build warnings are deduplicated per module
      // instance and absent from production builds: not behaviour, not
      // recorded (the tests that need one assert it directly)
      if (/^Warning: /.test(text)) return
      // React 19 prints the same development warnings without the prefix
      if (REACT_DEV_WARNING.test(text)) return
      logs.console.push(`${level} ${text}`)
    })
  )
  return () => spies.forEach((s) => s.mockRestore())
}

// ---------- settling ----------
const settle = async (logs, ms = SETTLE_MS) => {
  // timers fire in order with the microtasks between them
  await act(async () => {
    await jest.advanceTimersByTimeAsync(ms)
  })
  for (let i = 0; i < 50 && logs.pending > 0; i++) {
    // eslint-disable-next-line no-await-in-loop
    await act(async () => {
      await flush()
      await jest.advanceTimersByTimeAsync(0)
    })
  }
  // effects of the last answers
  await act(async () => {
    await flush()
  })
}

// ---------- rendering a state ----------
const makeCtx = (logs, user) => ({
  user,
  spy:
    (name) =>
    (...args) => {
      logs.calls.push(
        `${name}(${args
          .map((a) =>
            a && typeof a === 'object' && 'type' in a && 'target' in a
              ? `event:${a.type}`
              : JSON.stringify(a)
          )
          .join(', ')})`
      )
    },
  byRole: (role, options) => screen.getByRole(role, options),
})

const mountState = async (unit, stateName, impl, { server } = {}) => {
  resetEnvironment()
  installWindowGuards()
  attachNetwork(server)
  for (const c of (unit.cookies && unit.cookies[stateName]) || [])
    document.cookie = `${c}; path=/`
  const logs = createLogs()
  setLogs(logs)
  const restoreConsole = captureConsole(logs)
  const user = userSetup()
  const ctx = makeCtx(logs, user)
  const element = unit.states[stateName](impl.components, ctx)
  let view
  await act(async () => {
    view = render(element)
  })
  await settle(logs)
  return { view, logs, ctx, user, restoreConsole }
}

const unmountState = async (mounted) => {
  await act(async () => {
    mounted.view.unmount()
  })
  mounted.restoreConsole()
  setLogs(null)
  resetEnvironment()
}

const resetLogs = (logs) => {
  logs.network.length = 0
  logs.nav.length = 0
  logs.calls.length = 0
  logs.console.length = 0
}

// one observation: action() runs, the environment settles, the deltas are
// returned in a compact object (empty keys omitted)
const observe = async (mounted, action) => {
  const { logs } = mounted
  const before = {
    url: window.location.href,
    focus: focusPath(),
    validity: validity(),
    cookies: document.cookie,
  }
  resetLogs(logs)
  // records are delivered to the callback in a microtask: keep them all
  const records = []
  const observer = new MutationObserver((list) => records.push(...list))
  observer.observe(document.documentElement, {
    subtree: true,
    childList: true,
    attributes: true,
    characterData: true,
  })
  let error = null
  try {
    await action()
  } catch (e) {
    error = `${e.name}: ${String(e.message).split('\n')[0]}`
  }
  await settle(logs)
  records.push(...observer.takeRecords())
  const mutations = summarizeMutations(records)
  observer.disconnect()
  const after = {
    url: window.location.href,
    focus: focusPath(),
    validity: validity(),
    cookies: document.cookie,
  }
  const out = {}
  if (mutations.length) out.m = compactList(mutations)
  if (after.focus !== before.focus) out.f = after.focus
  if (after.url !== before.url) out.u = after.url
  if (logs.nav.length) out.nav = [...logs.nav]
  if (logs.network.length) out.n = [...logs.network]
  const changed = after.validity.filter((v, i) => v !== before.validity[i])
  if (changed.length || after.validity.length !== before.validity.length)
    out.v = after.validity
  if (after.cookies !== before.cookies) out.k = after.cookies
  if (logs.calls.length) out.c = [...logs.calls]
  if (logs.console.length) out.log = [...logs.console]
  if (error) out.e = error
  return out
}

const interact = (mounted, el, kind) => {
  const { user } = mounted
  if (kind === 'click') return user.click(el)
  if (kind === 'dblclick') return user.dblClick(el)
  if (kind === 'hover') return user.hover(el)
  if (kind === 'focus') {
    return act(async () => {
      if (typeof el.focus === 'function') el.focus()
    })
  }
  return (async () => {
    await act(async () => {
      if (typeof el.focus === 'function') el.focus()
    })
    await user.keyboard(KEYS[kind])
  })()
}

const elementAt = (path) => {
  if (path === 'body') return document.body
  let node = document.body
  for (const part of path.split('>')) {
    const [index, tag] = part.split(':')
    node = elementChildren(node)[Number(index)]
    if (!node || node.tagName.toLowerCase() !== tag) return null
  }
  return node
}

const compact = (obs) => (Object.keys(obs).length ? obs : '-')

// static part of a state: DOM after mount and the requests made by mounting
const staticCensus = async (unit, stateName, impl, opts) => {
  const mounted = await mountState(unit, stateName, impl, opts)
  const out = {
    dom: unitDom(),
    mount: compact({
      ...(mounted.logs.network.length ? { n: [...mounted.logs.network] } : {}),
      ...(mounted.logs.console.length
        ? { log: [...mounted.logs.console] }
        : {}),
      ...(validity().length ? { v: validity() } : {}),
      ...(document.cookie ? { k: document.cookie } : {}),
      f: focusPath(),
    }),
    nodes: unitElements().map(pathOf),
  }
  await unmountState(mounted)
  return out
}

// interactions of one node with equal observations share one key
// ("click,dblclick"); quiet interactions are left out, quiet nodes listed
const groupNode = (byKind) => {
  const groups = new Map()
  for (const kind of INTERACTIONS) {
    const obs = byKind[kind]
    if (obs !== '-') {
      const key = JSON.stringify(obs)
      if (!groups.has(key)) groups.set(key, { kinds: [], obs })
      groups.get(key).kinds.push(kind)
    }
  }
  return Object.fromEntries(
    [...groups.values()].map(({ kinds, obs }) => [kinds.join(','), obs])
  )
}

// c2: every node x every interaction, each on a fresh render
const interactionCensus = async (unit, stateName, impl, opts, nodes) => {
  const quiet = []
  const active = {}
  for (const path of nodes) {
    const byKind = {}
    for (const kind of INTERACTIONS) {
      // eslint-disable-next-line no-await-in-loop
      const mounted = await mountState(unit, stateName, impl, opts)
      const el = elementAt(path)
      let obs
      if (!el) obs = { e: 'node not found after a fresh render' }
      else {
        // eslint-disable-next-line no-await-in-loop
        obs = await observe(mounted, () => interact(mounted, el, kind))
      }
      byKind[kind] = compact(obs)
      // eslint-disable-next-line no-await-in-loop
      await unmountState(mounted)
    }
    const grouped = groupNode(byKind)
    if (Object.keys(grouped).length) active[path] = grouped
    else quiet.push(path)
  }
  return { quiet, active }
}

const windowEvent = async (kind) => {
  if (kind === 'blur') {
    // the window loses focus: the focused element gets blur/focusout, then
    // the window gets blur (document.activeElement is kept)
    await act(async () => {
      const active = document.activeElement
      if (active && active !== document.body) {
        active.dispatchEvent(new FocusEvent('blur', { relatedTarget: null }))
        active.dispatchEvent(
          new FocusEvent('focusout', { bubbles: true, relatedTarget: null })
        )
      }
      window.dispatchEvent(new FocusEvent('blur'))
    })
    return
  }
  if (kind === 'scroll-100') {
    await act(async () => {
      setScroll(100)
      document.dispatchEvent(new Event('scroll', { bubbles: true }))
    })
    return
  }
  const delta = kind === 'resize+1' ? 1 : -1
  await act(async () => {
    setWindowSize(BASE_WIDTH + delta, BASE_HEIGHT + delta)
    window.dispatchEvent(new Event('resize'))
  })
}

// c4: overlay open, then each window event on a fresh render
const overlayCensus = async (unit, impl, opts) => {
  const { state, open, kind } = unit.overlay
  const result = { kind, state }
  {
    const mounted = await mountState(unit, state, impl, opts)
    result.open = compact(await observe(mounted, () => open(mounted.ctx)))
    result.openDom = unitDom()
    await unmountState(mounted)
  }
  for (const event of WINDOW_EVENTS) {
    // eslint-disable-next-line no-await-in-loop
    const mounted = await mountState(unit, state, impl, opts)
    // eslint-disable-next-line no-await-in-loop
    await observe(mounted, () => open(mounted.ctx))
    // eslint-disable-next-line no-await-in-loop
    const obs = await observe(mounted, () => windowEvent(event))
    // c4 aspects: DOM mutations, focus, network (plus callbacks, console and
    // errors, which would be behaviour changes too)
    const kept = {}
    for (const key of ['m', 'f', 'n', 'c', 'log', 'e'])
      if (obs[key]) kept[key] = obs[key]
    result[event] = compact(kept)
    // eslint-disable-next-line no-await-in-loop
    await unmountState(mounted)
  }
  return result
}

// the whole census of one unit, always in this order (states in their
// declaration order: static part, then interactions; then the overlay)
const unitCensus = async (unit, impl, opts) => {
  const states = {}
  for (const name of Object.keys(unit.states)) {
    // eslint-disable-next-line no-await-in-loop
    states[name] = await staticCensus(unit, name, impl, opts)
  }
  for (const name of Object.keys(unit.states)) {
    // eslint-disable-next-line no-await-in-loop
    states[name].interactions = await interactionCensus(
      unit,
      name,
      impl,
      opts,
      states[name].nodes
    )
  }
  const overlay = unit.overlay ? await overlayCensus(unit, impl, opts) : null
  return { du: unit.du, name: unit.name, states, overlay }
}

module.exports = {
  sha256,
  installWindowGuards,
  attachNetwork,
  setLogs,
  createLogs,
  unitCensus,
  windowEvent,
  INTERACTIONS,
  WINDOW_EVENTS,
  SETTLE_MS,
  fakeTimers,
  userSetup,
  flush,
  pathOf,
  serialize,
  unitDom,
  mountState,
  unmountState,
  observe,
  settle,
  staticCensus,
  interactionCensus,
  overlayCensus,
  resetEnvironment,
  React,
}
