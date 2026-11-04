// T-012 (41 A): harness self-tests in the Jest `static` project: c1-c4 for this
// project, and the project-independent clauses c5 (harness constants), c6
// (comparator negative control), c7 (gate-stats).
const fs = require('fs')
const path = require('path')
const crypto = require('crypto')
const { execFileSync, spawnSync } = require('child_process')

const { registerProjectChecks, ROOT } = require('../utils/harness-checks')

registerProjectChecks('static')

const node = (args, opts = {}) =>
  spawnSync(process.execPath, args, { cwd: ROOT, encoding: 'utf8', ...opts })
const sha256 = (buf) => crypto.createHash('sha256').update(buf).digest('hex')
const walk = (dir) => {
  if (!fs.existsSync(dir)) return []
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    if (e.name === 'node_modules') return []
    const p = path.join(dir, e.name)
    return e.isDirectory() ? walk(p) : [p]
  })
}

// values `node tools/check-docs.mjs docs/upgrade --constants` printed when the
// harness was accepted (40 §8 rule 8); normalisations: re-pinned for the T-610
// stack-frame line:column mask (owner SIGNED: 2026-10-27; was 7c1eb36f…) and
// for the T-610 start-up time of Next 13.5 (owner SIGNED: 2026-11-05; was
// 24b8faf8…)
const PINNED_DOC_CONSTANTS = {
  t805: 'd4f5fa58f13465be33e010a65ff2217d92f25a35c3a65731f4f2662b0ef24f23',
  normalisations:
    'ab4e769d9830381ccfd564f0ea7aafef83562b37e205adc3997d7ba19bca3d76',
  adKeyRule: '6edfe76c66ed7ecb4ebe7e667a67ff8550230ececbf596119fb832a601ae08bd',
}
// seeded synthetic bootstrap of scripts/gate-stats.mjs (seed 20261020, 10,000
// draws)
const PINNED_BOOTSTRAP_U = 1.0051033484309744

describe('T-012 harness constants and comparator', () => {
  test('T-012 c5 @P0 harness constants: exact comparator, no mask, retries 0, forbidOnly, docs constants, t805 list', () => {
    // comparator: pixel-exact.mjs delegates to the exact RGBA compare
    const pe = fs.readFileSync(
      path.join(ROOT, 'e2e/fixtures/pixel-exact.mjs'),
      'utf8'
    )
    expect(pe).toMatch(/from '\.\/pixel-compare\.mjs'/)
    const pc = node([
      '--input-type=module',
      '-e',
      "import { COMPARATOR } from './e2e/fixtures/pixel-compare.mjs'; console.log(COMPARATOR)",
    ])
    expect(pc.stdout.trim()).toBe('exact-rgba-v1')
    const same = node([
      'e2e/fixtures/pixel-compare.mjs',
      'test/static/fixtures/t012/aa-a.png',
      'test/static/fixtures/t012/aa-a.png',
      '--json',
    ])
    expect(JSON.parse(same.stdout)).toMatchObject({
      sameSize: true,
      diffPixels: 0,
    })
    // no masks, skips or tolerances anywhere in the Playwright tree
    for (const f of walk(path.join(ROOT, 'e2e')).filter((p) =>
      /\.(m?js|cjs)$/.test(p)
    )) {
      const src = fs.readFileSync(f, 'utf8')
      expect([path.relative(ROOT, f), /\bmask\s*:/.test(src)]).toEqual([
        path.relative(ROOT, f),
        false,
      ])
      expect([
        path.relative(ROOT, f),
        /maxDiffPixel|threshold\s*:/.test(src),
      ]).toEqual([path.relative(ROOT, f), false])
      expect([
        path.relative(ROOT, f),
        /\b(test|it|describe)\.(only|skip|fixme)\(/.test(src),
      ]).toEqual([path.relative(ROOT, f), false])
    }
    // retries 0 and forbidOnly true in the Playwright config constants
    const constants = JSON.parse(
      node(['e2e/fixtures/constants.mjs', '--json']).stdout
    )
    expect(constants).toMatchObject({
      RETRIES: 0,
      FORBID_ONLY: true,
      TIMEZONE_ID: 'UTC',
      LOCALE: 'en-GB',
    })
    const cfg = fs.readFileSync(
      path.join(ROOT, 'playwright.config.mjs'),
      'utf8'
    )
    expect(cfg).toMatch(/retries: RETRIES/)
    expect(cfg).toMatch(/forbidOnly: FORBID_ONLY/)
    expect(cfg.match(/retries\s*:/g)).toHaveLength(1)
    expect(cfg).not.toMatch(/\bmask\b|maxDiffPixel|threshold/)
    // capture setting: Chromium rasterises every tile in full in the pixel
    // projects
    expect(constants.CHROMIUM_CAPTURE_ARGS).toEqual([
      '--disable-partial-raster',
    ])
    expect(cfg).toMatch(/launchOptions: \{ args: CHROMIUM_CAPTURE_ARGS \}/)
    expect(cfg.match(/\.\.\.capture,/g)).toHaveLength(2)
    if (Number(process.versions.node.split('.')[0]) >= 20) {
      // the resolved config (needs @playwright/test, Node >= 20)
      const out = node(
        [
          '--input-type=module',
          '-e',
          "const c = (await import('./playwright.config.mjs')).default; const args = (n) => (c.projects.find((p) => p.name === n)?.use.launchOptions?.args ?? null); const wire = c.projects.find((p) => p.name === 'wire'); console.log(JSON.stringify({ wireAfter: wire.dependencies.slice().sort(), retries: c.retries, forbidOnly: c.forbidOnly, projectRetries: c.projects.map((p) => p.retries ?? null), tz: c.use.timezoneId, locale: c.use.locale, visualArgs: args('visual'), chromiumArgs: args('chromium') }))",
        ],
        { env: { ...process.env, E2E_CONFIG_PROBE: '1' } }
      )
      expect(out.stderr).toBe('')
      expect(JSON.parse(out.stdout)).toEqual(
        expect.objectContaining({
          retries: 0,
          forbidOnly: true,
          tz: 'UTC',
          locale: 'en-GB',
          visualArgs: ['--disable-partial-raster'],
          chromiumArgs: null,
        })
      )
      // the wire project runs after the chromium project (its tests read the
      // stub's wire log; the runner's webkit and firefox projects join it)
      expect(JSON.parse(out.stdout).wireAfter).toEqual(['chromium'])
      expect(
        JSON.parse(out.stdout).projectRetries.every(
          (r) => r === null || r === 0
        )
      ).toBe(true)
    }
    // docs constants (T-805 list, 40 §1 normalisation column, 42 §8 key rule)
    const docs = JSON.parse(
      execFileSync(
        process.execPath,
        ['tools/check-docs.mjs', 'docs/upgrade', '--constants'],
        { cwd: ROOT, encoding: 'utf8' }
      )
    )
    expect(docs).toEqual(PINNED_DOC_CONSTANTS)
    // t805-exclusions.json: absent and "not set" in STATUS §1 until 2.5 (I-09),
    // then its sha256 = STATUS §1
    const status = fs.readFileSync(
      path.join(ROOT, 'docs/upgrade/STATUS.md'),
      'utf8'
    )
    const golden =
      status.split('\n').find((l) => l.startsWith('|Golden|')) || ''
    const exclusions = path.join(ROOT, 'test/baseline/t805-exclusions.json')
    const recorded = (golden.match(
      /t805-exclusions\.json`? sha256[^|]*?\b([0-9a-f]{64})\b/
    ) || [])[1]
    if (recorded) expect(sha256(fs.readFileSync(exclusions))).toBe(recorded)
    else {
      expect(fs.existsSync(exclusions)).toBe(false)
      expect(golden).toMatch(
        /`t805-exclusions\.json` sha256 \(40 §1\): not set/
      )
    }
  })

  test('T-012 c6 @P0 comparator negative control: an anti-aliased-only pair counts > 0', () => {
    const r = node([
      'e2e/fixtures/pixel-compare.mjs',
      'test/static/fixtures/t012/aa-a.png',
      'test/static/fixtures/t012/aa-b.png',
      '--json',
    ])
    expect(r.status).toBe(1)
    const res = JSON.parse(r.stdout)
    expect(res.sameSize).toBe(true)
    expect(res.diffPixels).toBe(24)
  })

  test('T-012 c7 @P0 gate-stats known answers', () => {
    const r = node(['scripts/gate-stats.mjs', '--self-test', '--json'])
    const rows = JSON.parse(r.stdout)
    expect(rows.filter((x) => !x.ok)).toEqual([])
    expect(r.status).toBe(0)
    const byId = Object.fromEntries(rows.map((x) => [x.id, x.got]))
    expect(byId['cp-59-59'].toFixed(4)).toBe('0.9505')
    expect(byId['cp-58-58'].toFixed(4)).toBe('0.9497')
    expect(byId['power-9892'].toFixed(2)).toBe('0.80')
    expect(byId['binom-c6ni-a']).toBeLessThan(0.025)
    expect(byId['z-row1']).toBeGreaterThan(2.326)
    expect(byId['bootstrap-synthetic']).toBe(PINNED_BOOTSTRAP_U)
  })
})
