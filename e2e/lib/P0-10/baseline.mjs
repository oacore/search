// Record-mode JSON baselines of P0-10 (42 §6-§7): written only by `npm run e2e:record -- --run <id>
// --provisional ...` (RECORD=1, --update-snapshots) into Playwright's default snapshot folder next to the spec
// (<spec>-snapshots/<name>-<project>-<platform>.json), compared exactly (deep-equal) otherwise. A missing
// baseline fails. Values are written as pretty JSON through the repository's Prettier and its config (40 §7
// rule 7: `lint:json` checks every committed JSON), so a re-capture is byte-identical (42 §6 item 1).
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { test, expect } from '../../fixtures/guard.mjs'
import { formatJsonSync } from '../../../scripts/prettier-sync.mjs'
import { readLedger } from '../P0-11/contract.mjs'

const REPO = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
  '..',
  '..'
)
// the repository's Prettier format (synchronous: scripts/prettier-sync.mjs)
const formatJson = (value, file) => formatJsonSync(value, file)

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

// ---------- AD rows of a recorded baseline (42 §8) ----------
// A row of the running test (the T-### id its title starts with) that is in force and whose key names the
// baseline file (`<name>.json` as the spec names it; a composite key names several, separated by `, `) accepts
// exactly one difference: its literal `from` in the baseline as compared becomes its literal `to`. The file stays
// as recorded (baseline files are never edited), any other difference still fails (default deny), and a
// withdrawn row stops applying. The rows applied are annotated with the number of replacements.
export const testIdOf = (info = test.info()) =>
  (info.title.match(/^T-\d{3}\b/) || [null])[0]

export function ledgerRowsOf(file, info = test.info(), rows = null) {
  const id = testIdOf(info)
  return (rows || readLedger().rows).filter(
    (r) =>
      r &&
      r.test === id &&
      !r.withdrawn &&
      String(r.key).split(', ').includes(file)
  )
}

export function applyLedgerRows(text, rows, info = test.info()) {
  let out = text
  for (const r of rows) {
    const parts = out.split(String(r.from))
    out = parts.join(String(r.to))
    info.annotations.push({
      type: 'ledger',
      description: `${r.id} x${parts.length - 1}`,
    })
  }
  return out
}

// normalise: an optional normaliser of 40 §1 that the value has already been through, applied to the recorded
// baseline before the comparison (a normaliser added after the recording masks both sides; the file stays as
// recorded, 42 §8). Then the AD rows of the file apply to the JSON text of the normalised baseline (their
// `from` and `to` hold no quote or backslash, so they replace text inside the JSON strings only).
export function expectBaseline(name, value, message, normalise = (v) => v) {
  const info = test.info()
  const file = name.endsWith('.json') ? name : `${name}.json`
  const snapshot = info.snapshotPath(file)
  if (recordMode(info)) {
    fs.mkdirSync(path.dirname(snapshot), { recursive: true })
    fs.writeFileSync(snapshot, formatJson(value, snapshot))
    info.annotations.push({
      type: 'baseline',
      description: `recorded ${path.basename(snapshot)} (${provisionalNote()})`,
    })
    return
  }
  expect(
    fs.existsSync(snapshot),
    `missing baseline ${path.relative(
      process.cwd(),
      snapshot
    )}: record it with npm run e2e:record -- --run <id> --provisional`
  ).toBe(true)
  let baseline = normalise(JSON.parse(fs.readFileSync(snapshot, 'utf8')))
  const rows = ledgerRowsOf(file, info)
  if (rows.length) {
    for (const r of rows)
      if (/["\\]/.test(`${r.from}${r.to}`))
        throw new Error(
          `${r.id}: from/to of a JSON baseline row hold a quote or backslash`
        )
    baseline = JSON.parse(applyLedgerRows(JSON.stringify(baseline), rows, info))
  }
  expect(
    JSON.parse(JSON.stringify(value)),
    message || `= baseline ${file}`
  ).toEqual(baseline)
}

// a text snapshot of Playwright's toMatchSnapshot (`<spec>-snapshots/<name>-<project>-<platform>.<ext>`) with
// the AD rows of the file applied to the recorded text; without a row (and in record mode) it is
// toMatchSnapshot itself
export function expectSnapshot(text, name, message) {
  const info = test.info()
  const rows = recordMode(info) ? [] : ledgerRowsOf(name, info)
  if (!rows.length) {
    expect(text, message).toMatchSnapshot(name)
    return
  }
  const snapshot = info.snapshotPath(name)
  expect(
    fs.existsSync(snapshot),
    `missing baseline ${path.relative(process.cwd(), snapshot)}`
  ).toBe(true)
  const baseline = applyLedgerRows(
    fs.readFileSync(snapshot, 'utf8'),
    rows,
    info
  )
  expect(text, message || `= baseline ${name}`).toBe(baseline)
}
