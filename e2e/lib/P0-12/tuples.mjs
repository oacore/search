// The T-728 pinned diff (41 T-728 c2; 40 §4 item 2; 55 C7 (1)): the set of hydration events allowed on a
// React/Next version, keyed on the tuple (route, fixture, TZ, cookie state, engine, error code, DOM path of
// the first mismatch), never on message text. File: e2e/journeys/t728-pinned-tuples.json. React 17 prints no
// hydration event in production (it patches text and children silently), so its set is empty; W6a records
// the React 18 set, W7b the React 19 set. T-701 and T-728 fail on any event outside the set; T-728 also on a
// pinned tuple that no longer occurs (the observed set per combination equals the pinned one).
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { versionKey } from './console-pins.mjs'

const HERE = path.dirname(fileURLToPath(import.meta.url))
export const TUPLES_FILE = path.resolve(
  HERE,
  '..',
  '..',
  'journeys',
  't728-pinned-tuples.json'
)

export const TUPLE_KEYS = [
  'route',
  'fixture',
  'tz',
  'cookieState',
  'engine',
  'errorCode',
  'firstMismatchPath',
]

// React hydration error codes (react-dom 18/19 production builds, reported through window `error` /
// reportError, or through console.error by a caught boundary): 418 hydration text/element mismatch, 419
// server render aborted, 421 suspense boundary update before hydration, 422 / 425 text mismatch, 423 root
// recovered by client render
export const HYDRATION_CODES = ['418', '419', '421', '422', '423', '425']
// development texts of the same events (React 17 dev warnings; React 18/19 dev errors)
const HYDRATION_TEXT =
  /did not match|Expected server HTML to contain|Did not expect server HTML to contain|Hydration failed|There was an error while hydrating|Text content does not match server-rendered HTML|hydrated but some attributes of the server rendered HTML didn't match/

export const codeOf = (message) => {
  const m =
    /Minified React error #(\d+)/.exec(message) ||
    /react\.dev\/errors\/(\d+)/.exec(message) ||
    /reactjs\.org\/docs\/error-decoder\.html\?invariant=(\d+)/.exec(message)
  if (m && HYDRATION_CODES.includes(m[1])) return m[1]
  if (HYDRATION_TEXT.test(message)) return 'dev-text'
  return null
}

// hydration events of one page from the guard log (pageerror, window error, console.error)
export function hydrationEvents(guardLog) {
  const out = []
  for (const e of guardLog.pageErrors)
    if (codeOf(e.message))
      out.push({ channel: 'pageerror', code: codeOf(e.message) })
  for (const e of guardLog.windowErrors)
    if (codeOf(e.message))
      out.push({ channel: 'window-error', code: codeOf(e.message) })
  for (const c of guardLog.console)
    if (c.type === 'error' && codeOf(c.text))
      out.push({ channel: 'console.error', code: codeOf(c.text) })
  return out
}

export function validateTupleFile(json) {
  const problems = []
  if (!json || json.schema !== 1) problems.push('schema must be 1')
  if (JSON.stringify(json.tuple) !== JSON.stringify(TUPLE_KEYS))
    problems.push(`tuple must list exactly ${TUPLE_KEYS.join(', ')}`)
  for (const [key, set] of Object.entries(json.versions || {})) {
    if (!/^react-\d+\.\d+\+next-\d+\.\d+$/.test(key))
      problems.push(
        `${key}: version key must be react-<major.minor>+next-<major.minor>`
      )
    if (!Array.isArray(set.entries)) {
      problems.push(`${key}: entries must be an array`)
      continue
    }
    const seen = new Set()
    set.entries.forEach((e, i) => {
      const where = `${key} entries[${i}]`
      if (!e || typeof e !== 'object' || Array.isArray(e)) {
        problems.push(`${where}: must be an object`)
        return
      }
      const keys = Object.keys(e)
      if (
        JSON.stringify([...keys].sort()) !==
        JSON.stringify([...TUPLE_KEYS].sort())
      )
        problems.push(
          `${where}: keys must be exactly the tuple (no message text): ${keys.join(
            ', '
          )}`
        )
      if (
        e.errorCode != null &&
        !/^(\d{3}|dev-text)$/.test(String(e.errorCode))
      )
        problems.push(`${where}: errorCode must be a React error code`)
      if (
        e.firstMismatchPath != null &&
        !/^(body|html\[1\](\/[a-z0-9-]+\[\d+\])*)$/.test(
          String(e.firstMismatchPath)
        )
      )
        problems.push(`${where}: firstMismatchPath must be a DOM path`)
      const k = TUPLE_KEYS.map((t) => String(e[t])).join('\u0000')
      if (seen.has(k)) problems.push(`${where}: duplicate tuple`)
      seen.add(k)
    })
  }
  return problems
}

export const loadTupleFile = () =>
  JSON.parse(fs.readFileSync(TUPLES_FILE, 'utf8'))

export function pinnedTuples(key = versionKey()) {
  const json = loadTupleFile()
  const problems = validateTupleFile(json)
  if (problems.length)
    throw new Error(`t728-pinned-tuples.json: ${problems.join('; ')}`)
  const set = json.versions[key]
  if (!set)
    throw new Error(
      `t728-pinned-tuples.json has no set for ${key}: record it (W6a, W7b; 55 C7 (1))`
    )
  return set.entries
}

export const tupleKey = (t) => TUPLE_KEYS.map((k) => String(t[k])).join(' | ')

// the pinned tuples of one (route, fixture, tz, cookie state, engine) combination
export const pinnedFor = (entries, combo) =>
  entries.filter((e) =>
    ['route', 'fixture', 'tz', 'cookieState', 'engine'].every(
      (k) => e[k] === combo[k]
    )
  )
