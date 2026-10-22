// T-805 property exclusions (40 §1): the computed-style census compares every property getComputedStyle
// enumerates per engine, minus test/baseline/t805-exclusions.json = the properties shown nondeterministic
// across 3 captures on the golden build (42 §6). Its sha256 is recorded with B0 in STATUS §1 and checked by
// T-012 (40 §8 rule 8: a new exclusion is an acceptance change).
//
// File: { schema: 1, description, captures, engines: { chromium: [..] | null, webkit: .., firefox: .. } };
// null = not captured for that engine (the census of that engine then fails until it is).
//
// CLI (builds the file from three capture folders = copies of t805-computed-styles.spec.mjs-snapshots taken
// after three record runs of `T-805 c1` with an empty list for the engine):
//   node e2e/lib/P1-06/exclusions.mjs --engine chromium --project visual --captures <dir1> <dir2> <dir3>
//     [--write] [--note <text>]
// It prints the properties whose value differs for any (state, element) between the captures, and the
// element-set or file-set differences (a determinism defect, never an exclusion: 40 §5). --write updates the
// engine's list in the file.
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { fileURLToPath } from 'node:url'
import { expandStyleCensus, formatJson } from './baseline.mjs'

const REPO = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
  '..',
  '..'
)
export const EXCLUSIONS_FILE = path.join(
  REPO,
  'test',
  'baseline',
  't805-exclusions.json'
)

export function loadExclusions() {
  const text = fs.readFileSync(EXCLUSIONS_FILE, 'utf8')
  return {
    ...JSON.parse(text),
    sha256: crypto.createHash('sha256').update(text).digest('hex'),
  }
}

// the excluded property names of an engine; null when the engine has not been captured
export function exclusionsFor(engine) {
  const f = loadExclusions()
  const list = f.engines ? f.engines[engine] : undefined
  return list === undefined ? null : list
}

export function nondeterministic(captures) {
  const props = new Set()
  const defects = []
  const files = captures.map((dir) =>
    fs
      .readdirSync(dir)
      .filter((f) => /^t805-c1-.*\.json$/.test(f))
      .sort()
  )
  const all = [...new Set(files.flat())].sort()
  for (const f of all) {
    const present = files.map((list) => list.includes(f))
    if (present.some((p) => !p)) {
      defects.push(
        `file ${f} missing in capture(s) ${present
          .map((p, i) => (p ? null : i + 1))
          .filter(Boolean)
          .join(', ')}`
      )
      continue
    }
    const maps = captures.map((dir) =>
      expandStyleCensus(JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')))
    )
    const keys = [...maps[0].keys()]
    for (let i = 1; i < maps.length; i += 1) {
      const other = [...maps[i].keys()]
      if (JSON.stringify(other) !== JSON.stringify(keys))
        defects.push(`${f}: element set of capture ${i + 1} differs`)
    }
    for (const key of keys) {
      const objs = maps.map((m) => m.get(key)).filter(Boolean)
      if (objs.length !== maps.length) continue
      const names = new Set(objs.flatMap((o) => Object.keys(o)))
      for (const n of names) {
        const vals = new Set(objs.map((o) => JSON.stringify(o[n])))
        if (vals.size > 1) props.add(n)
      }
    }
  }
  return { properties: [...props].sort(), defects, files: all.length }
}

const isMain =
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
if (isMain) {
  const argv = process.argv.slice(2)
  const opt = (k) => {
    const i = argv.indexOf(k)
    return i >= 0 ? argv[i + 1] : null
  }
  const engine = opt('--engine') || 'chromium'
  const i = argv.indexOf('--captures')
  const captures = []
  for (let j = i + 1; j < argv.length && !argv[j].startsWith('--'); j += 1)
    captures.push(path.resolve(argv[j]))
  if (captures.length < 3) {
    console.error('need --captures <dir1> <dir2> <dir3>')
    process.exit(2)
  }
  const r = nondeterministic(captures)
  console.log(JSON.stringify({ engine, captures, ...r }, null, 1))
  if (argv.includes('--write')) {
    if (r.defects.length) {
      console.error('determinism defects: not written')
      process.exit(1)
    }
    const f = JSON.parse(fs.readFileSync(EXCLUSIONS_FILE, 'utf8'))
    f.engines[engine] = r.properties
    f.captures[engine] = {
      ...(f.captures[engine] || {}),
      files: r.files,
      note: opt('--note') || (f.captures[engine] || {}).note || '',
    }
    fs.writeFileSync(EXCLUSIONS_FILE, formatJson(f, EXCLUSIONS_FILE))
    console.log(`written ${path.relative(REPO, EXCLUSIONS_FILE)}`)
  }
}
