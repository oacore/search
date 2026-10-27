// P1-06 record-mode JSON baselines (42 §6-§7): written only by `npm run e2e:record -- --run <id> ...` (RECORD=1,
// --update-snapshots) into Playwright's default snapshot folder next to the spec
// (<spec>-snapshots/<name>-<project>-<platform>.json), compared deep-equal otherwise; a missing baseline fails.
// Files are written through the repository's Prettier and its config (40 §7 rule 7: `lint:json` checks every
// committed JSON), so a re-capture of an unchanged page is byte-identical (42 §6 item 1). On a difference the
// test fails with a readable list of the differing keys (`explain`) and the actual value as an attachment.
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { test } from '../../fixtures/guard.mjs'
import { formatJsonSync } from '../../../scripts/prettier-sync.mjs'

const REPO = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
  '..',
  '..'
)

// the repository's Prettier format (synchronous: scripts/prettier-sync.mjs)
export const formatJson = (value, file) => formatJsonSync(value, file)

export const recordMode = (info = test.info()) =>
  process.env.RECORD === '1' ||
  info.config.updateSnapshots === 'all' ||
  info.config.updateSnapshots === 'changed'

const provisionalNote = () => {
  try {
    const env = JSON.parse(
      fs.readFileSync(
        path.join(
          path.resolve(process.env.ARTIFACT_DIR || '.'),
          'runs',
          process.env.E2E_RUN || 'default',
          'env.json'
        ),
        'utf8'
      )
    )
    return env.mode !== 'docker'
      ? `host baseline (${process.platform} ${process.arch})`
      : 'provisional'
  } catch {
    return 'provisional'
  }
}

const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v)

// a generic structural diff: `path: expected -> actual` lines, at most `limit`
export function genericDiff(expected, actual, limit = 40) {
  const out = []
  const walk = (a, b, at) => {
    if (out.length >= limit) return
    if (JSON.stringify(a) === JSON.stringify(b)) return
    if (Array.isArray(a) && Array.isArray(b)) {
      const n = Math.max(a.length, b.length)
      for (let i = 0; i < n && out.length < limit; i += 1)
        walk(a[i], b[i], `${at}[${i}]`)
      return
    }
    if (isObj(a) && isObj(b)) {
      for (const k of [...new Set([...Object.keys(a), ...Object.keys(b)])])
        walk(a[k], b[k], at ? `${at}.${k}` : k)
      return
    }
    out.push(`${at}: ${JSON.stringify(a)} -> ${JSON.stringify(b)}`)
  }
  walk(expected, actual, '')
  return out
}

// compare `value` with the baseline `name` (record mode writes it); `explain(expected, actual)` returns the
// difference lines of a failure (default: genericDiff)
export async function expectJsonBaseline(
  name,
  value,
  { explain = genericDiff, message } = {}
) {
  const info = test.info()
  const file = name.endsWith('.json') ? name : `${name}.json`
  const snapshot = info.snapshotPath(file)
  const actual = JSON.parse(JSON.stringify(value))
  if (recordMode(info)) {
    fs.mkdirSync(path.dirname(snapshot), { recursive: true })
    fs.writeFileSync(snapshot, formatJson(actual, snapshot))
    info.annotations.push({
      type: 'baseline',
      description: `recorded ${path.basename(snapshot)} (${provisionalNote()})`,
    })
    return { recorded: true }
  }
  if (!fs.existsSync(snapshot))
    throw new Error(
      `missing baseline ${path.relative(
        REPO,
        snapshot
      )}: record it with npm run e2e:record -- --run <id> --project <project> -g '<title>'`
    )
  const expected = JSON.parse(fs.readFileSync(snapshot, 'utf8'))
  if (JSON.stringify(expected) === JSON.stringify(actual))
    return { recorded: false }
  await info.attach(`${file}-actual`, {
    body: JSON.stringify(actual, null, 1),
    contentType: 'application/json',
  })
  const lines = explain(expected, actual)
  throw new Error(
    `${message || file} differs from the baseline ${path.relative(
      REPO,
      snapshot
    )}:\n${(lines.length ? lines : ['(key order or type)']).join('\n')}`
  )
}

// the per-(element, property) view of a style census (T-805 c1): profile deltas over the base, plus the
// ::before / ::after content
export function expandStyleCensus(c) {
  const out = new Map()
  for (const line of c.elements) {
    const [key, rest] = splitLine(line)
    const parts = rest.split(' ')
    const profile = Number(parts[0])
    const o = { ...c.base, ...c.profiles[profile] }
    for (const n of Object.keys(o)) if (o[n] === null) delete o[n]
    const pseudo = rest.slice(parts[0].length + 1)
    const m = pseudo.match(/^(::before=.*?)?(?: ?(::after=.*))?$/)
    if (pseudo) {
      for (const seg of [m && m[1], m && m[2]].filter(Boolean)) {
        const [pe, ...v] = seg.split('=')
        o[`${pe} content`] = v.join('=')
      }
    }
    out.set(key, o)
  }
  return out
}

const splitLine = (line) => {
  const i = line.indexOf(' ')
  return [line.slice(0, i), line.slice(i + 1)]
}

export function explainStyleCensus(expected, actual, limit = 60) {
  const lines = []
  for (const k of ['properties']) {
    if (expected[k] !== actual[k])
      lines.push(`${k}: ${expected[k]} -> ${actual[k]}`)
  }
  const a = expandStyleCensus(expected)
  const b = expandStyleCensus(actual)
  for (const key of a.keys())
    if (!b.has(key) && lines.length < limit)
      lines.push(`element removed: ${key}`)
  for (const key of b.keys())
    if (!a.has(key) && lines.length < limit) lines.push(`element added: ${key}`)
  for (const [key, ea] of a) {
    const eb = b.get(key)
    if (!eb) continue
    for (const n of [...new Set([...Object.keys(ea), ...Object.keys(eb)])]) {
      if (lines.length >= limit) break
      if (ea[n] !== eb[n])
        lines.push(
          `${key} ${n}: ${JSON.stringify(ea[n])} -> ${JSON.stringify(eb[n])}`
        )
    }
  }
  return lines
}

// line lists keyed by their first token (geometry: the path): changed, removed and added lines
export function explainLines(field = 'elements', limit = 60) {
  return (expected, actual) => {
    const lines = genericDiff(
      { ...expected, [field]: undefined },
      { ...actual, [field]: undefined },
      10
    )
    const a = new Map((expected[field] || []).map((l) => splitLine(l)))
    const b = new Map((actual[field] || []).map((l) => splitLine(l)))
    for (const [k, v] of a) {
      if (lines.length >= limit) break
      if (!b.has(k)) lines.push(`removed: ${k} ${v}`)
      else if (b.get(k) !== v) lines.push(`${k}: ${v} -> ${b.get(k)}`)
    }
    for (const [k, v] of b) {
      if (lines.length >= limit) break
      if (!a.has(k)) lines.push(`added: ${k} ${v}`)
    }
    return lines
  }
}
