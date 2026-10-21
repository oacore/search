// Reference values of the build-artefact tests and the default-deny diff
// (40 §1, 42 §7-§8).
//
// Reference:
// - Before B0 (manifest §4.7): the outputs recorded once from the 2.3 parity
//   image, ./recorded/<test>.json (kind provisional), written by
//   STATIC_RECORD=1 from NEXT_DIR.
// - From B0 (42 §6 item 2): test/baseline/build/, an APP_ROOT layout copied
//   from the golden image (its .next as `next/`, since `.next` is a git-ignored
//   name; `public/`). The reader derives the reference from it, and must first
//   reproduce the recorded outputs there exactly (40 §8 rule 7: a reader is
//   proven on the golden build before it reads a candidate). With B0 present,
//   STATIC_RECORD=1 re-derives the recorded outputs from test/baseline/build/
//   only (kind B0; for a new chain link, 42 §9), never from NEXT_DIR.
//
// Diffs: every key whose value differs fails unless a row of
// test/baseline/ACCEPTED-DIFFS.yml matches test, key, from and to exactly and
// is not withdrawn (42 §8; signatures are checked by scripts/ad-ledger.mjs).
const fs = require('fs')
const path = require('path')
const { isDeepStrictEqual } = require('util')

const { ROOT, openBuild } = require('./index')

const BASELINE_BUILD = path.join(ROOT, 'test', 'baseline', 'build')
const LEDGER = path.join(ROOT, 'test', 'baseline', 'ACCEPTED-DIFFS.yml')
const RECORDED_DIR = path.join(__dirname, 'recorded')
const ABSENT = '<absent>'

function baselineBuild() {
  if (!fs.existsSync(BASELINE_BUILD)) return null
  const nextDir = ['next', '.next']
    .map((d) => path.join(BASELINE_BUILD, d))
    .find((d) => fs.existsSync(d))
  if (!nextDir) {
    throw new Error(
      'test/baseline/build/ exists without next/ (the golden .next): incomplete baseline'
    )
  }
  return { nextDir, appRoot: BASELINE_BUILD }
}

function writeJson(file, value) {
  const prettier = require(require.resolve('prettier', { paths: [ROOT] }))
  const options = prettier.resolveConfig.sync(file) || {}
  fs.mkdirSync(path.dirname(file), { recursive: true })
  fs.writeFileSync(
    file,
    prettier.format(JSON.stringify(value), { ...options, parser: 'json' })
  )
}

const readJson = (file) => JSON.parse(fs.readFileSync(file, 'utf8'))

// where the measured build came from (no absolute paths): the parity build
// record when present
function provenance(build) {
  const rec = path.join(build.appRoot, 'build.json')
  if (!fs.existsSync(rec)) return { buildId: build.buildId }
  const r = readJson(rec)
  return {
    commit: r.commit,
    key: r.key,
    variant: r.variant,
    mode: r.mode,
    node: r.node,
    buildId: build.buildId,
  }
}

const record = (file, testId, kind, build, derived) =>
  writeJson(file, {
    test: testId,
    kind,
    layout: build.layout,
    from: provenance(build),
    ...derived,
  })

// reference(testId, slug, derive, actual, build) -> {kind, value}
// derive(build) -> {entries: {key: string}}; actual = derive(candidate build)
function reference(testId, slug, derive, actual, build) {
  const file = path.join(RECORDED_DIR, `${slug}.json`)
  const golden = baselineBuild()
  const recording = process.env.STATIC_RECORD === '1'
  if (golden) {
    const goldenBuild = openBuild(golden)
    const value = derive(goldenBuild)
    if (recording) record(file, testId, 'B0', goldenBuild, value)
    else if (fs.existsSync(file)) {
      const recorded = readJson(file)
      if (!isDeepStrictEqual(recorded.entries, value.entries)) {
        throw new Error(
          `${testId}: the ${
            goldenBuild.layout
          } reader does not reproduce ${path.relative(
            ROOT,
            file
          )} on test/baseline/build/ (40 §8 rule 7)`
        )
      }
    }
    return { kind: 'test/baseline/build', value }
  }
  if (recording) {
    record(file, testId, 'provisional', build, actual)
    return { kind: 'recorded now', value: actual }
  }
  if (!fs.existsSync(file)) {
    throw new Error(
      `${testId}: no reference (${path.relative(
        ROOT,
        file
      )} missing and no test/baseline/build/); record the provisional one with STATIC_RECORD=1 on the parity image`
    )
  }
  return { kind: 'provisional', value: readJson(file) }
}

// rows of the ledger file (js-yaml from the installed tree; only read when
// the ledger exists)
function readLedger() {
  if (!fs.existsSync(LEDGER)) return []
  const yamlDir = path.dirname(
    require.resolve('js-yaml/package.json', { paths: [ROOT] })
  )
  const yaml = require(yamlDir)
  const { version } = readJson(path.join(yamlDir, 'package.json'))
  const load = /^3\./.test(version) ? yaml.safeLoad : yaml.load
  const rows = load(fs.readFileSync(LEDGER, 'utf8')) || []
  if (!Array.isArray(rows))
    throw new Error('test/baseline/ACCEPTED-DIFFS.yml is not a list')
  return rows
}

// rows in force for one test: same test id, not withdrawn
const ledgerRows = (testId, rows = readLedger()) =>
  rows.filter((r) => r && r.test === testId && !r.withdrawn)

// {key: string} maps -> {uncovered: [{key, from, to}], accepted: [...]}; a
// diff is accepted only by a row matching test, key, from and to exactly
function diffEntries(testId, ref, act, { rows } = {}) {
  const keys = [...new Set([...Object.keys(ref), ...Object.keys(act)])].sort()
  const inForce = ledgerRows(testId, rows)
  const uncovered = []
  const accepted = []
  for (const key of keys) {
    const from = key in ref ? ref[key] : ABSENT
    const to = key in act ? act[key] : ABSENT
    if (from !== to) {
      const row = inForce.find(
        (r) => r.key === key && String(r.from) === from && String(r.to) === to
      )
      ;(row ? accepted : uncovered).push({
        key,
        from,
        to,
        ...(row ? { ad: row.id } : {}),
      })
    }
  }
  return { uncovered, accepted }
}

// assertion-friendly summary: {count, first}
const summary = (list, n = 40) => ({
  count: list.length,
  first: list.slice(0, n),
})

module.exports = {
  reference,
  diffEntries,
  summary,
  baselineBuild,
  ledgerRows,
  ABSENT,
  RECORDED_DIR,
}
