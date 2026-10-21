// T-741 console pins: loader, version key and message classification. The pins live in
// e2e/lib/P0-12/t741-console-pins.json, one set per (React major.minor, Next major.minor) (41 T-741 c2);
// every message of a set cites R/Q rows (c3). T-701 reads the same set: a console.error that T-741 pins for
// that route and phase is not a T-701 event (41 T-701).
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const REPO = path.resolve(HERE, '..', '..', '..')
export const PINS_FILE = path.join(HERE, 't741-console-pins.json')

const majorMinor = (pkg) =>
  JSON.parse(
    fs.readFileSync(
      path.join(REPO, 'node_modules', pkg, 'package.json'),
      'utf8'
    )
  )
    .version.split('.')
    .slice(0, 2)
    .join('.')

export const installedVersions = () => ({
  react: majorMinor('react'),
  next: majorMinor('next'),
})
export const versionKey = (v = installedVersions()) =>
  `react-${v.react}+next-${v.next}`

export const loadPinsFile = () => JSON.parse(fs.readFileSync(PINS_FILE, 'utf8'))

export function loadPins(key = versionKey()) {
  const set = loadPinsFile().versions[key]
  if (!set)
    throw new Error(
      `t741-console-pins.json has no pin set for ${key}: record one for this React/Next version (41 T-741 c2)`
    )
  const messages = Object.entries(set.messages).map(([id, m]) => ({
    id,
    ...m,
    re: m.pattern ? new RegExp(m.pattern) : null,
  }))
  return { ...set, key, messageList: messages }
}

// the catalogue id of one console entry (type and first line of the text: console.error(error) appends the
// stack, whose chunk names and positions are build artefacts), or null
export function classify(pins, entry) {
  const text = String(entry.text).split('\n')[0]
  const hit = pins.messageList.find(
    (m) => m.type === entry.type && (m.re ? m.re.test(text) : m.text === text)
  )
  return hit ? hit.id : null
}

// counts per catalogue id; unknown messages are listed apart (type: first line)
export function census(pins, entries) {
  const counts = {}
  const unknown = []
  for (const e of entries) {
    const id = classify(pins, e)
    if (id) counts[id] = (counts[id] || 0) + 1
    else unknown.push(`${e.type}: ${String(e.text).split('\n')[0]}`)
  }
  return { counts: sortKeys(counts), unknown }
}

export const sortKeys = (o) =>
  Object.fromEntries(
    Object.entries(o).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
  )

// pinned console.error counts for a route, cookie state and phase (T-701's allowance)
export function pinnedErrors(pins, routeId, cookieState, phase = 'load') {
  const row = (pins.routes[routeId] || {})[cookieState]
  const counts = (row && row[phase]) || {}
  const out = {}
  for (const [id, n] of Object.entries(counts)) {
    const m = pins.messages[id]
    if (m && m.type === 'error') out[id] = n
  }
  return out
}

// row ids that exist in the registers: R-### (10), Q-### and the security notes S-# (30)
export function registerIds() {
  const ids = new Set()
  for (const f of ['10-risk-register.md', '30-quirks-register.md']) {
    const text = fs.readFileSync(path.join(REPO, 'docs', 'upgrade', f), 'utf8')
    for (const m of text.matchAll(/^\| ((?:R|Q)-\d{3}|S-\d{1,2})\b/gm))
      ids.add(m[1])
  }
  return ids
}

// console.error entries of `entries` that the pins do not allow for this route and cookie state (load phase
// counts are a budget: a pinned message may occur at most as often as pinned)
export function unpinnedErrors(pins, entries, routeId, cookieState) {
  const budget = { ...pinnedErrors(pins, routeId, cookieState, 'load') }
  const out = []
  for (const c of entries) {
    if (c.type !== 'error') continue
    const id = classify(pins, c)
    if (id && budget[id] > 0) budget[id] -= 1
    else out.push(`console.error: ${String(c.text).split('\n')[0]}`)
  }
  return out
}
