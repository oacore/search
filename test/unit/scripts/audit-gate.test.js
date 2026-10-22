// CI-8 (42 §10; R-072, S-5): scripts/audit-gate.mjs, the dependency audit
// gate of the `lint` job. The job pipes `npm audit --omit=dev
// --audit-level=high --json` into it with `continue-on-error` set unless the
// repository variable AUDIT_BLOCKING is 'true': the gate reports until the
// owner makes it blocking (W7a, the first Next >= 15.5.24). The one accepted
// advisory is d3-color (02 §3: <3.1.0 is flagged high), capped at high.
// The reports below have the shape of the npm audit report version 2 (checked
// against a real report of this repository: an advisory is an object in
// `via`, a package that is vulnerable through another is a name in `via`).
// Oracle: the verdicts are written out here, not derived from the script.
const fs = require('fs')
const os = require('os')
const path = require('path')
const { spawnSync } = require('child_process')

const ROOT = path.resolve(__dirname, '..', '..', '..')
const SCRIPT = path.join(ROOT, 'scripts', 'audit-gate.mjs')

// every case starts node processes: a loaded machine needs more than 5 s
jest.setTimeout(120000)

let sequence = 1000
const advisory = (name, severity, extra = {}) => {
  sequence += 1
  return {
    source: sequence,
    name,
    dependency: name,
    title: `${name} advisory ${sequence}`,
    url: `https://github.com/advisories/GHSA-${sequence}`,
    severity,
    cwe: ['CWE-400'],
    cvss: { score: 0, vectorString: null },
    range: '<1.0.0',
    ...extra,
  }
}
const entry = (name, severity, via, extra = {}) => ({
  name,
  severity,
  isDirect: false,
  via,
  effects: [],
  range: '<1.0.0',
  nodes: [`node_modules/${name}`],
  fixAvailable: true,
  ...extra,
})
const report = (...entries) => ({
  auditReportVersion: 2,
  vulnerabilities: Object.fromEntries(entries.map((e) => [e.name, e])),
  metadata: { vulnerabilities: { total: entries.length }, dependencies: {} },
})

const run = (args, input, env = {}) => {
  const r = spawnSync(process.execPath, [SCRIPT, ...args], {
    cwd: ROOT,
    encoding: 'utf8',
    input,
    env: { ...process.env, GITHUB_STEP_SUMMARY: '', ...env },
  })
  return { code: r.status, out: r.stdout, err: r.stderr }
}
const gate = (obj, args = []) => run(args, JSON.stringify(obj))
const verdict = (obj, args = []) => {
  const r = gate(obj, [...args, '--json'])
  return { ...r, json: r.out.trim().startsWith('{') ? JSON.parse(r.out) : null }
}

describe('CI-8 audit gate', () => {
  let tmp
  beforeAll(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'audit-gate-'))
  })
  afterAll(() => {
    fs.rmSync(tmp, { recursive: true, force: true })
  })

  test('CI-8 c1 an empty report passes', () => {
    const r = verdict(report())
    expect(r.code).toBe(0)
    expect(r.json.ok).toBe(true)
    expect(r.json.counts).toEqual({
      blocking: 0,
      allowed: 0,
      belowLevel: 0,
      packages: 0,
    })
  })

  test('CI-8 c2 the allow-list is d3-color up to high, nothing else (the 02 exception)', () => {
    const r = verdict(report())
    expect(r.json.allowList).toEqual([
      { package: 'd3-color', maxSeverity: 'high' },
    ])
    // the exception exists in the plan: when 02 closes it, this list goes
    const matrix = fs.readFileSync(
      path.join(ROOT, 'docs/upgrade/02-version-matrix.md'),
      'utf8'
    )
    expect(matrix).toMatch(
      /d3-color <3\.1\.0 is flagged high \(CI-8 allow-list/
    )
  })

  test('CI-8 c3 d3-color alone passes and is listed as allow-listed', () => {
    const d3 = entry('d3-color', 'high', [advisory('d3-color', 'high')])
    const r = verdict(report(d3))
    expect(r.code).toBe(0)
    expect(r.json.counts).toEqual({
      blocking: 0,
      allowed: 1,
      belowLevel: 0,
      packages: 1,
    })
    expect(r.json.allowed.map((a) => a.package)).toEqual(['d3-color'])
    const text = gate(report(d3))
    expect(text.out).toContain('audit gate: pass')
    expect(text.out).toContain('allow-listed (d3-color up to high)')
  })

  test('CI-8 c4 the allow-list is capped: a critical d3-color advisory blocks', () => {
    const d3 = entry('d3-color', 'critical', [
      advisory('d3-color', 'high'),
      advisory('d3-color', 'critical'),
    ])
    const r = verdict(report(d3))
    expect(r.code).toBe(1)
    expect(r.json.blocking.map((a) => [a.package, a.severity])).toEqual([
      ['d3-color', 'critical'],
    ])
    expect(r.json.allowed.map((a) => a.severity)).toEqual(['high'])
  })

  test('CI-8 c5 a high or critical advisory of any other package blocks, worst first', () => {
    const r = verdict(
      report(
        entry('d3-color', 'high', [advisory('d3-color', 'high')]),
        entry('lodash', 'high', [advisory('lodash', 'high')]),
        entry('next', 'critical', [advisory('next', 'critical')])
      )
    )
    expect(r.code).toBe(1)
    expect(r.json.ok).toBe(false)
    expect(r.json.blocking.map((a) => [a.package, a.severity])).toEqual([
      ['next', 'critical'],
      ['lodash', 'high'],
    ])
    const text = gate(
      report(entry('next', 'critical', [advisory('next', 'critical')]))
    )
    expect(text.out).toContain('blocking:')
    expect(text.out).toContain('audit gate: FAIL')
  })

  test('CI-8 c6 the level defaults to high: moderate advisories do not count, and --level moves it', () => {
    const rep = report(
      entry('postcss', 'moderate', [advisory('postcss', 'moderate')])
    )
    const high = verdict(rep)
    expect(high.code).toBe(0)
    expect(high.json.counts.belowLevel).toBe(1)
    const moderate = verdict(rep, ['--level', 'moderate'])
    expect(moderate.code).toBe(1)
    expect(moderate.json.blocking.map((a) => a.package)).toEqual(['postcss'])
    const critical = verdict(
      report(entry('lodash', 'high', [advisory('lodash', 'high')])),
      ['--level', 'critical']
    )
    expect(critical.code).toBe(0)
  })

  test('CI-8 c7 a package vulnerable only through d3-color is an effect of it and passes', () => {
    const rep = report(
      entry('d3-color', 'high', [advisory('d3-color', 'high')], {
        effects: ['d3-interpolate'],
      }),
      entry('d3-interpolate', 'high', ['d3-color'], { effects: ['d3-scale'] }),
      entry('d3-scale', 'high', ['d3-interpolate'])
    )
    const r = verdict(rep)
    expect(r.code).toBe(0)
    expect(r.json.effects).toEqual(['d3-interpolate', 'd3-scale'])
    expect(r.json.counts.blocking).toBe(0)
  })

  test('CI-8 c8 a chain that also reaches a blocking advisory is not an effect of d3-color', () => {
    const rep = report(
      entry('d3-color', 'high', [advisory('d3-color', 'high')]),
      entry('shell-quote', 'critical', [advisory('shell-quote', 'critical')]),
      entry('mixed', 'critical', ['d3-color', 'shell-quote'])
    )
    const r = verdict(rep)
    expect(r.code).toBe(1)
    expect(r.json.blocking.map((a) => a.package)).toEqual(['shell-quote'])
    expect(r.json.effects).toEqual([])
  })

  test('CI-8 c9 chains with a cycle are resolved', () => {
    const rep = report(
      entry('a', 'high', ['b']),
      entry('b', 'high', ['a', 'd3-color']),
      entry('d3-color', 'high', [advisory('d3-color', 'high')])
    )
    const r = verdict(rep)
    expect(r.code).toBe(0)
    expect(r.json.effects).toEqual(['a', 'b'])
  })

  test('CI-8 c10 the same advisory reached through several entries is counted once', () => {
    const shared = advisory('next', 'critical')
    const r = verdict(
      report(
        entry('next', 'critical', [shared]),
        entry('other', 'critical', [shared])
      )
    )
    expect(r.json.counts.blocking).toBe(1)
  })

  test('CI-8 c11 --allow adds a package (capped at high); the built-in list stays', () => {
    const rep = report(
      entry('lodash', 'high', [advisory('lodash', 'high')]),
      entry('d3-color', 'high', [advisory('d3-color', 'high')])
    )
    expect(verdict(rep).code).toBe(1)
    const r = verdict(rep, ['--allow', 'lodash'])
    expect(r.code).toBe(0)
    expect(r.json.allowed.map((a) => a.package).sort()).toEqual([
      'd3-color',
      'lodash',
    ])
    const capped = verdict(
      report(entry('lodash', 'critical', [advisory('lodash', 'critical')])),
      ['--allow', 'lodash']
    )
    expect(capped.code).toBe(1)
  })

  test('CI-8 c12 the report is read from a file or from standard input alike', () => {
    const rep = report(
      entry('next', 'critical', [advisory('next', 'critical')])
    )
    const file = path.join(tmp, 'audit.json')
    fs.writeFileSync(file, JSON.stringify(rep))
    const fromFile = run([file, '--json'])
    const fromStdin = run(['--json'], JSON.stringify(rep))
    const fromDash = run(['-', '--json'], JSON.stringify(rep))
    expect(fromFile.code).toBe(1)
    expect(fromFile.out).toBe(fromStdin.out)
    expect(fromDash.out).toBe(fromStdin.out)
  })

  test('CI-8 c13 no usable report is an error (exit 2), never a pass', () => {
    const cases = {
      'empty': ['', /no audit report/],
      'not JSON': ['<html>502</html>', /not JSON/],
      'a JSON list': ['[]', /not a JSON object/],
      'npm audit error': [
        JSON.stringify({
          error: {
            code: 'ENOTFOUND',
            summary: 'request to https://registry.npmjs.org failed',
          },
        }),
        /did not produce a report: ENOTFOUND/,
      ],
      'report version 1': [
        JSON.stringify({ actions: [], advisories: {}, metadata: {} }),
        /unsupported audit report version undefined/,
      ],
      'no vulnerabilities map': [
        JSON.stringify({ auditReportVersion: 2 }),
        /no `vulnerabilities` map/,
      ],
      'unknown via name': [
        JSON.stringify(report(entry('x', 'high', ['not-in-the-report']))),
        /not in the report/,
      ],
      'unknown severity': [
        JSON.stringify(report(entry('x', 'high', [advisory('x', 'severe')]))),
        /unknown advisory severity "severe"/,
      ],
      'entry without via': [
        JSON.stringify({
          auditReportVersion: 2,
          vulnerabilities: { x: { name: 'x', severity: 'high' } },
        }),
        /no `via` list/,
      ],
    }
    Object.entries(cases).forEach(([name, [input, message]]) => {
      const r = run([], input)
      expect([name, r.code]).toEqual([name, 2])
      expect(r.err).toMatch(message)
      expect(r.out).not.toContain('audit gate: pass')
    })
  })

  test('CI-8 c14 usage errors exit 2', () => {
    const rep = JSON.stringify(report())
    expect(run(['--bogus'], rep).code).toBe(2)
    expect(run(['--level'], rep).code).toBe(2)
    expect(run(['--level', 'severe'], rep).code).toBe(2)
    expect(run(['a.json', 'b.json'], rep).code).toBe(2)
    expect(run([path.join(tmp, 'absent.json')], '').code).toBe(2)
  })

  test('CI-8 c15 the GitHub step summary is written when the runner provides one', () => {
    const summary = path.join(tmp, 'summary.md')
    const rep = report(
      entry('next', 'critical', [advisory('next', 'critical')])
    )
    const r = run([], JSON.stringify(rep), { GITHUB_STEP_SUMMARY: summary })
    expect(r.code).toBe(1)
    const md = fs.readFileSync(summary, 'utf8')
    expect(md).toContain('Audit gate (CI-8, level high): fail')
    expect(md).toContain('| critical | next |')
  })
})
