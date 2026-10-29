// T-728 c4: shared parts of the React-17 dev inventory (dev-inventory.mjs writes, the test checks):
// the app-tree hash, the patch hash, the warning classification and the output check.
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { T728_ROUTES } from './routes.mjs'
import { TIME_ZONES } from './page.mjs'
import { COOKIE_STATES } from '../../fixtures/constants.mjs'
import { DEV_WARNING_MAP } from './dev-inventory-map.mjs'

const HERE = path.dirname(fileURLToPath(import.meta.url))
export const REPO = path.resolve(HERE, '..', '..', '..')
export const PATCH = path.join(REPO, 'test', 'hydration', 'dev-ssr.patch')
export const INVENTORY_SCHEMA = 1

export const sha256 = (buf) =>
  crypto.createHash('sha256').update(buf).digest('hex')

// the app's own files at a commit: every tracked path outside the test, tooling and docs trees
const NOT_APP = /^(test|e2e|docs|scripts|tools|\.github)\//
export function appTreeHash(ref = 'HEAD') {
  const out = execFileSync('git', ['-C', REPO, 'ls-tree', '-r', ref], {
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
  })
  const lines = out
    .split('\n')
    .filter(Boolean)
    .filter((l) => !NOT_APP.test(l.split('\t')[1]))
  return sha256(lines.join('\n'))
}

export const patchHash = () => sha256(fs.readFileSync(PATCH))

// React 17 development warnings of the hydration family (react-dom.development.js warnForTextDifference,
// warnForPropDifference, warnForExtraAttributes, warnForInsertedHydrated*, warnForDeletedHydratableElement)
export const HYDRATION_WARNING =
  /^Warning: (Text content did not match|Prop `[^`]+` did not match|Extra attributes from the server|Expected server HTML to contain a matching|Did not expect server HTML to contain)/

// the Q row (or open issue) of one dev warning: first rule of DEV_WARNING_MAP whose fields all match
export function mapWarning(w) {
  for (const rule of DEV_WARNING_MAP) {
    const m = rule.match
    if (m.kind && m.kind !== w.kind) continue
    if (m.text && !m.text.test(w.text)) continue
    if (m.component && !m.component.test(w.components || '')) continue
    if (m.resource && !m.resource.test(w.resource || '')) continue
    if (m.route && !m.route.test(w.route)) continue
    return {
      q: rule.q || null,
      issue: rule.issue || null,
      rule: rule.id,
      devOnly: Boolean(rule.devOnly),
      emptySsr: Boolean(rule.emptySsr),
    }
  }
  return { q: null, issue: null, rule: null, devOnly: false, emptySsr: false }
}

// a mapping is valid when it names a row of 30, or an open P0-12 issue that asks the lead for one
const mappingProblem = (m, rows, label) => {
  if (m.q) return rows.has(m.q) ? null : `${label}: ${m.q} is not a row of 30`
  if (m.issue && /^P0-12-\d+$/.test(m.issue)) return null
  return `${label} maps to no Q row`
}

const qRows = () => {
  const text = fs.readFileSync(
    path.join(REPO, 'docs', 'upgrade', '30-quirks-register.md'),
    'utf8'
  )
  return new Set([...text.matchAll(/^\| (Q-\d{3})\b/gm)].map((m) => m[1]))
}

// problems of an inventory output (empty = valid for the current tree and patch)
export function checkInventory(inv) {
  const problems = []
  if (!inv || inv.schema !== INVENTORY_SCHEMA)
    return [`schema must be ${INVENTORY_SCHEMA}`]
  if (inv.source.appTree !== appTreeHash())
    problems.push('the inventory was made from another app tree: run it again')
  if (inv.source.patchSha256 !== patchHash())
    problems.push(
      'the inventory was made with another dev-ssr.patch: run it again'
    )
  // the runtime Node (24 from W4e, CS-N12-6; 18 before)
  if (!/^v24\./.test(inv.runtime.node))
    problems.push('next dev must run on the runtime Node 24')
  if (/--openssl-legacy-provider/.test(inv.runtime.nodeOptions))
    problems.push(
      'NODE_OPTIONS must not carry --openssl-legacy-provider (CS-N11-5: no local build or dev path sets it from Next 12)'
    )
  if (inv.runtime.react !== '17.0.2') problems.push('React 17.0.2 expected')
  // the full sweep: routes x fixtures x TZ x cookie state
  const want = []
  for (const r of T728_ROUTES)
    for (const tz of TIME_ZONES)
      for (const c of COOKIE_STATES) want.push(`${r.id}|${tz}|${c}`)
  const have = new Set(
    inv.loads.map((l) => `${l.route}|${l.tz}|${l.cookieState}`)
  )
  const missing = want.filter((k) => !have.has(k))
  if (missing.length)
    problems.push(
      `sweep incomplete: ${missing.length} of ${
        want.length
      } loads missing (${missing.slice(0, 3).join(', ')} ...)`
    )
  const rows = qRows()
  for (const l of inv.loads) {
    const label = `${l.route} ${l.tz} ${l.cookieState}`
    if (l.status !== 200) problems.push(`${label}: status ${l.status}`)
    if (l.error) problems.push(`${label}: ${l.error}`)
    if (l.settleTimeout) problems.push(`${label}: never settled`)
    if (!l.hydrated) problems.push(`${label}: no hydration`)
    // every page error of the load maps to a Q row; an empty #__next is accepted only with a page error whose
    // rule says the development server answers so
    const pageMaps = (l.pageErrors || []).map((text) => ({
      text,
      ...mapWarning({ kind: 'pageerror', text, route: l.route }),
    }))
    for (const p of pageMaps) {
      const bad = mappingProblem(p, rows, `${label}: page error ${p.text}`)
      if (bad) problems.push(bad)
    }
    if (!(l.ssrNextLength > 0) && !pageMaps.some((p) => p.emptySsr))
      problems.push(`${label}: the patched dev server rendered no SSR markup`)
  }
  // Q-052 c1: without the patch, next dev serves an empty #__next
  if (!inv.q052 || !inv.q052.unpatched || !inv.q052.unpatched.length)
    problems.push('Q-052 c1 check (unpatched dev server) missing')
  else
    for (const u of inv.q052.unpatched)
      if (u.ssrNextLength !== 0)
        problems.push(
          `Q-052 c1: unpatched next dev rendered ${u.ssrNextLength} characters into #__next on ${u.route}`
        )
  // every warning maps to a Q row of 30 (or names the open issue that asks the lead for a new row); the
  // recorded mapping is the current map's (the map changed: run the inventory again)
  for (const w of inv.warnings) {
    const m = mapWarning(w)
    if (m.rule !== w.rule)
      problems.push(
        `warning ${w.signature}: mapped by ${w.rule}, the map now says ${m.rule}`
      )
    const bad = mappingProblem(m, rows, `warning ${w.signature} (${w.kind})`)
    if (bad) problems.push(`${bad}: ${w.text}`)
  }
  return problems
}
