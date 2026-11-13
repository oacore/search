// T-014 (41 A, R-075, R-084, R-091), case (a): two parity builds of one tree
// have identical .next/static and .next/server after normalising the buildId
// (VF-09; VG-5). NEXT_DIR_A and NEXT_DIR_B are the two builds' .next
// directories (CI: two --no-cache image builds; local mode: two `--install ci`
// host builds). Case (b) (release vs parity image of every step head) needs the
// live data-loader and is DEFERRED (I-10).
const fs = require('fs')
const path = require('path')
const { spawnSync } = require('child_process')

const ROOT = path.resolve(__dirname, '..', '..')

// The absolute root a build was made in, as Next recorded it (`appDir` of
// .next/required-server-files.json: /app in a docker build, the build's own
// folder on the host), else the folder that holds .next. Both roots go to
// scripts/next-diff.mjs, so that each build's own root, written into its
// output, compares equal (owner decision T14 (a) of the jump 3 jump check,
// 2026-11-13; an acceptance change, 40 §8 rule 8)
const buildRoot = (nextDir) => {
  const dir = path.resolve(ROOT, nextDir)
  const file = path.join(dir, 'required-server-files.json')
  if (!fs.existsSync(file)) return path.dirname(dir)
  const { appDir } = JSON.parse(fs.readFileSync(file, 'utf8'))
  return appDir || path.dirname(dir)
}

describe('T-014 @P0 build determinism', () => {
  test('T-014 @P0 (a) two builds of one tree: .next/static and .next/server identical, buildId normalised', () => {
    const a = process.env.NEXT_DIR_A
    const b = process.env.NEXT_DIR_B
    if (!a || !b) {
      throw new Error(
        'T-014 (a) needs NEXT_DIR_A and NEXT_DIR_B (two builds of one tree)'
      )
    }
    const r = spawnSync(
      process.execPath,
      [
        'scripts/next-diff.mjs',
        a,
        b,
        '--root-a',
        buildRoot(a),
        '--root-b',
        buildRoot(b),
        '--json',
      ],
      { cwd: ROOT, encoding: 'utf8', maxBuffer: 1 << 26 }
    )
    const res = JSON.parse(r.stdout)
    expect({
      differ: res.differ.map((d) => d.file),
      onlyA: res.onlyA,
      onlyB: res.onlyB,
    }).toEqual({ differ: [], onlyA: [], onlyB: [] })
    expect(res.files).toBeGreaterThan(50)
    expect(r.status).toBe(0)
  })
})
