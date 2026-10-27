// P1-07 axe helpers (T-803): one axe run per state of findings/07 §6, its violations as a normalised JSON
// document, the baseline file of the state (written in record mode, compared otherwise) and the set difference
// that fails a new or a vanished violation.
//
// Run: the tag set of 07 §6 (wcag2a, wcag2aa, wcag21a, wcag21aa, best-practice) and, in a second run of the same
// page, the three duplicate-id rules (`duplicate-id`, `duplicate-id-active`, `duplicate-id-aria`): axe 4.14
// ships the first two disabled (deprecated) and reports an id that ARIA or a label refers to as a result to
// review (`incomplete`) of `duplicate-id-aria`, never as a violation, so Q-089 (duplicate DOM ids: `about-title`
// twice, `author` / `doi` N times, `data-provider-webpage-title` N times) is in no violation list. The JSON
// therefore keeps a `duplicateIds` section next to `violations`: per rule and outcome, each duplicated id, how
// often it occurs and the first element that carries it. A violation is (rule id, impact, node targets); an
// axe target is a CSS selector that can name a CSS-module class, whose hash suffix changes with the build, so
// the selectors are keyed on the class names without it (the same normalisation as the class census of T-605:
// `[name]_[local]`).
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { AxeBuilder } from '@axe-core/playwright'
import { test } from '../../fixtures/guard.mjs'
import { formatJsonSync } from '../../../scripts/prettier-sync.mjs'

const REPO = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
  '..',
  '..'
)

export const TAGS = [
  'wcag2a',
  'wcag2aa',
  'wcag21a',
  'wcag21aa',
  'best-practice',
]
export const DUPLICATE_RULES = [
  'duplicate-id',
  'duplicate-id-active',
  'duplicate-id-aria',
]
export const RECORD = process.env.RECORD === '1'

// ---------- normalisation ----------

// `.card-dropdown_ellipsis__M05jn` -> `.card-dropdown_ellipsis`; `.button-button-3fr3r` -> `.button-button`
// (design module classes carry `-<5 chars>`, app module classes `__<5 chars>`); the same class token in two
// builds then reads the same
const CLASS_TOKEN = /\.((?:\\.|[A-Za-z0-9_-])+)/g
export function normaliseClass(token) {
  if (/__[A-Za-z0-9_-]{5}$/.test(token)) return token.replace(/__[\w-]{5}$/, '')
  if (/^[A-Za-z][A-Za-z0-9]*(?:-[A-Za-z0-9]+)+-[A-Za-z0-9_-]{5}$/.test(token))
    return token.replace(/-[\w-]{5}$/, '')
  return token
}
// axe lists the attribute selectors of one compound selector in the order of its own feature scan
// (`[role="button"][aria-haspopup="true"]` on one page, the reverse on another): sorted, so the same element
// reads the same
const ATTRIBUTE_RUN = /(?:\[[^\]]*\])+/g
const sortAttributes = (run) => (run.match(/\[[^\]]*\]/g) || []).sort().join('')
export const normaliseTarget = (selector) =>
  selector
    .replace(CLASS_TOKEN, (_all, token) => `.${normaliseClass(token)}`)
    .replace(ATTRIBUTE_RUN, sortAttributes)

// ---------- one state ----------

// two runs of the page as it is: the tag set, then the duplicate-id rules
export async function runAxe(page) {
  const main = await new AxeBuilder({ page }).withTags(TAGS).analyze()
  const dup = await new AxeBuilder({ page })
    .withRules(DUPLICATE_RULES)
    .analyze()
  return { main, dup }
}

const nodeKey = (n) => n.target.join(' >>> ')

// the duplicated ids of a duplicate-id run, violations and results to review alike
function duplicateIdsOf(dup) {
  const out = []
  for (const outcome of ['violations', 'incomplete'])
    for (const r of dup[outcome])
      if (DUPLICATE_RULES.includes(r.id))
        for (const n of r.nodes) {
          const check = [...n.any, ...n.all, ...n.none][0]
          out.push({
            rule: r.id,
            outcome: outcome === 'violations' ? 'violation' : 'incomplete',
            id: check.data,
            count: check.relatedNodes.length + 1,
            target: n.target.map(normaliseTarget),
          })
        }
  return out.sort(
    (a, b) =>
      a.rule.localeCompare(b.rule) ||
      a.outcome.localeCompare(b.outcome) ||
      a.id.localeCompare(b.id)
  )
}

// the JSON of one state (sorted: the file is the same for the same page)
export function summarise({ main, dup }, { id, route, viewport }) {
  const violations = main.violations
    .filter((v) => !DUPLICATE_RULES.includes(v.id))
    .map((v) => ({
      id: v.id,
      impact: v.impact,
      nodes: v.nodes
        .map((n) => ({ target: n.target.map(normaliseTarget) }))
        .sort((a, b) => nodeKey(a).localeCompare(nodeKey(b))),
    }))
    .sort((a, b) => a.id.localeCompare(b.id))
  return {
    state: id,
    route,
    viewport,
    axe: main.testEngine.version,
    tags: TAGS,
    duplicateRules: DUPLICATE_RULES,
    violations,
    duplicateIds: duplicateIdsOf(dup),
  }
}

// ---------- the set difference ----------

// every violation node as `<rule id> | <target>` and every duplicated id as `<rule> <outcome> | #<id> x<count>
// | <target>`; the multiset, so a node that appears twice counts twice
export function violationKeys(summary) {
  const keys = []
  for (const v of summary.violations)
    for (const n of v.nodes) keys.push(`${v.id} | ${nodeKey(n)}`)
  for (const d of summary.duplicateIds || [])
    keys.push(
      `${d.rule} ${d.outcome} | #${d.id} x${d.count} | ${d.target.join(
        ' >>> '
      )}`
    )
  return keys.sort()
}

// { added, vanished, impact }: keys only in `actual` (a new violation), keys only in `baseline` (a vanished
// one), and the rules whose impact changed; all empty = identical
export function diffViolations(baseline, actual) {
  const count = (keys) => {
    const m = new Map()
    for (const k of keys) m.set(k, (m.get(k) || 0) + 1)
    return m
  }
  const a = count(violationKeys(actual))
  const b = count(violationKeys(baseline))
  const added = []
  const vanished = []
  for (const [k, n] of a)
    for (let i = 0; i < n - (b.get(k) || 0); i += 1) added.push(k)
  for (const [k, n] of b)
    for (let i = 0; i < n - (a.get(k) || 0); i += 1) vanished.push(k)
  const impactOf = (s) =>
    Object.fromEntries(s.violations.map((v) => [v.id, v.impact]))
  const bi = impactOf(baseline)
  const ai = impactOf(actual)
  const impact = Object.keys({ ...bi, ...ai })
    .filter((id) => id in bi && id in ai && bi[id] !== ai[id])
    .map((id) => `${id}: ${bi[id]} -> ${ai[id]}`)
  return { added, vanished, impact }
}

export const identical = (d) =>
  d.added.length === 0 && d.vanished.length === 0 && d.impact.length === 0

// ---------- baseline files ----------

// e2e/a11y/t803-axe.spec.mjs-snapshots/axe-<state>-<project>-<platform>.json (the snapshot path template of
// playwright.config.mjs)
export const baselinePath = (id) => test.info().snapshotPath(`axe-${id}.json`)

// committed JSON goes through prettier, so `npm run lint:json` stays clean (40 §7 rule 7)
export function writeBaseline(file, obj) {
  const text = formatJsonSync(obj, file)
  fs.mkdirSync(path.dirname(file), { recursive: true })
  fs.writeFileSync(file, text)
}

export const readBaseline = (file) =>
  fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : null

// the state files of a baselines folder: [state id, file]
export function baselineFiles(dir) {
  if (!fs.existsSync(dir)) return []
  return fs
    .readdirSync(dir)
    .map((f) => /^axe-(.+)-[a-z]+-[a-z0-9]+\.json$/.exec(f))
    .filter(Boolean)
    .map((m) => [m[1], path.join(dir, m[0])])
    .sort((x, y) => x[0].localeCompare(y[0]))
}

// the human text of a difference
export const describeDiff = (id, d) =>
  [
    `axe violations of ${id} differ from the baseline`,
    ...d.added.map((k) => `  new: ${k}`),
    ...d.vanished.map((k) => `  vanished: ${k}`),
    ...d.impact.map((k) => `  impact: ${k}`),
  ].join('\n')
