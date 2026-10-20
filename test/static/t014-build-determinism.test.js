// T-014 (41 A, R-075, R-084, R-091), case (a): two parity builds of one tree
// have identical .next/static and .next/server after normalising the buildId
// (VF-09; VG-5). NEXT_DIR_A and NEXT_DIR_B are the two builds' .next
// directories (CI: two --no-cache image builds; local mode: two `--install ci`
// host builds). Case (b) (release vs parity image of every step head) needs the
// live data-loader and is DEFERRED (I-10).
const path = require('path')
const { spawnSync } = require('child_process')

const ROOT = path.resolve(__dirname, '..', '..')

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
      ['scripts/next-diff.mjs', a, b, '--json'],
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
