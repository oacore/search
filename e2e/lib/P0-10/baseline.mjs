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

export function expectBaseline(name, value, message) {
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
  const baseline = JSON.parse(fs.readFileSync(snapshot, 'utf8'))
  expect(
    JSON.parse(JSON.stringify(value)),
    message || `= baseline ${file}`
  ).toEqual(baseline)
}
