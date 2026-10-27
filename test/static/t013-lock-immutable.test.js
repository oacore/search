// T-013 (41 A, R-015, R-084): the production dependency tree is immutable under
// test tooling, against <base'> (the CS-W0-9 merge; 42 §5 item 3) until W0;
// from the W0 merge on, against the latest dependency step merge (AD-005; the
// script's default reference). Runs scripts/lock-immutable.mjs and reads its
// JSON report.
const path = require('path')
const fs = require('fs')
const { spawnSync } = require('child_process')

const ROOT = path.resolve(__dirname, '..', '..')
let report
beforeAll(() => {
  const r = spawnSync(
    process.execPath,
    ['scripts/lock-immutable.mjs', '--json'],
    { cwd: ROOT, encoding: 'utf8', maxBuffer: 1 << 26 }
  )
  report = JSON.parse(r.stdout)
}, 120000)
const of = (check) => report.violations.filter((v) => v.check === check)

describe('T-013 @P0 prod tree immutable', () => {
  test("T-013 c1 @P0 every <base'> lock entry keeps version, resolved and integrity", () => {
    expect(report.base).toMatch(/^[0-9a-f]{40}$/)
    expect(report.oldEntries).toBeGreaterThan(1700)
    expect(of('c1')).toEqual([])
    expect(report.moved).toEqual([])
  })

  test('T-013 c2 @P0 npm ls --omit=dev --all is identical (and the non-dev lock entries)', () => {
    expect(report.npmLs.identical).toBe(true)
    expect(of('c2')).toEqual([])
  })

  test("T-013 c3 @P0 drift is pinned by overrides to <base'> versions only", () => {
    expect(of('c3')).toEqual([])
    // the report saw every override (the drift pins of the test
    // devDependencies, CS-W0-10 later)
    const pkg = JSON.parse(
      fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8')
    )
    const flat = []
    const walk = (o) =>
      Object.entries(o || {}).forEach(([k, v]) =>
        typeof v === 'string'
          ? flat.push(k)
          : (typeof v['.'] === 'string' && flat.push(k),
            walk(
              Object.fromEntries(Object.entries(v).filter(([x]) => x !== '.'))
            ))
      )
    walk(pkg.overrides)
    expect(report.overrides.map((o) => o.key).sort()).toEqual(flat.sort())
  })

  test('T-013 c4 @P0 Playwright and axe only in e2e/package.json', () => {
    expect(of('c4')).toEqual([])
    const root = JSON.parse(
      fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8')
    )
    const e2e = JSON.parse(
      fs.readFileSync(path.join(ROOT, 'e2e', 'package.json'), 'utf8')
    )
    const all = { ...root.dependencies, ...root.devDependencies }
    expect(
      Object.keys(all).filter((n) => /playwright|axe-core/.test(n))
    ).toEqual([])
    expect(e2e.devDependencies['@playwright/test']).toBe('1.64.1')
    expect(e2e.devDependencies['@axe-core/playwright']).toBe('4.14.0')
    expect(report.e2e).toEqual({ playwright: '1.64.1', axe: '4.14.0' })
  })
})
