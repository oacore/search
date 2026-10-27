// T-902 (41 J; R-048; 55 C6-CI rows 1-7, 01 §4 step 3a): the assertion layer
// over the soak tool (scripts/soak.mjs = `npm run soak`, run on a
// workstation; there is no workflow). The soak replays the C4 corpus through
// the SSR stub against three parity builds at prod limits (reference,
// candidate and golden), one arm loaded at a time in alternating blocks, and
// writes $ARTIFACT_DIR/soak/<id>/report.json with the seven rows. This file
// checks, without rerunning anything:
//   c1 the arrangement the plan prescribes (tool defaults, prod limits,
//      interleaved blocks) and the report of a pilot run
//      (`npm run soak -- ... --smoke`, 1-minute blocks);
//   c2 rows 1-7: every row of a report equals the verdict the 55 table gives
//      for the arm figures it carries, with known-answer reports at each
//      boundary, so a tool that mis-evaluates a row is caught.
// DEFERRED: the tolerances' calibration (3 runs with the golden in all arms,
// 2.8), the prod limits of a container (compose topology) and the row 4 slope
// bound (no 2.8 record yet). A pilot row 3 breach on identical builds is the
// false-breach rate that calibration measures. After a full soak run,
// T902_REPORT=<report.json> T902_EXPECT_PASS=1 makes the verdict itself an
// assertion.
// Ops test, outside the default Jest projects. Run:
//  npx jest --config '{"testMatch":["**/ops/t902*.test.js"],"transform":{}}'
const fs = require('fs')
const path = require('path')

const REPO = path.resolve(__dirname, '..', '..')
const ARTIFACT_DIR = path.resolve(
  process.env.ARTIFACT_DIR || path.join(REPO, '..', 'search-upgrade-artifacts')
)
const read = (rel) => fs.readFileSync(path.join(REPO, rel), 'utf8')
// yaml 2 lives in e2e/package.json (the e2e install)
const YAML = require(path.join(REPO, 'e2e', 'node_modules', 'yaml'))

const FACTOR = 1.1 // 55 C6-CI rows 3, 4, 7
const RSS_CAP_MIB = 700 // row 4 (prod limit 768Mi)
const ARMS = ['reference', 'candidate', 'golden']

// the 55 C6-CI table as a function of the arm figures returns {1: bool, ..., 7:
// bool} (row 6 null when the T-907 runs were switched off)
function oracle(report) {
  const { reference: R, candidate: C, golden: G } = report.arms
  const within = (a, b) => a == null || b == null || a <= FACTOR * b
  const prefixes = Object.keys(C.p95)
  const t907 = ARMS.flatMap((a) => report.arms[a].t907)
  return {
    // 0 restarts / OOM kills: no arm exited (an arm that crashed is no
    // comparison)
    1: ARMS.every((a) => !report.arms[a].exit),
    // 5xx at the proxy <= reference
    2: C.n5xx <= R.n5xx,
    // p95 per routed prefix <= 1.10 x reference and <= 1.10 x golden
    3: prefixes.every(
      (p) => within(C.p95[p], R.p95[p]) && within(C.p95[p], G.p95[p])
    ),
    // max RSS <= 1.10 x reference and < 700 MiB (the slope bound has no 2.8
    // record yet)
    4: within(C.rssMaxMiB, R.rssMaxMiB) && C.rssMaxMiB < RSS_CAP_MIB,
    // upstream calls per URL identical: carried by the tool as the list of
    // differing URLs
    5: report.rows[5].differing.length === 0,
    // T-907 against every arm at start and end: green
    6: t907.length === 0 ? null : t907.every((t) => t.rc === 0),
    // CPU per replayed request <= 1.10 x reference and <= 1.10 x golden
    7:
      within(C.cpuPerRequestMs, R.cpuPerRequestMs) &&
      within(C.cpuPerRequestMs, G.cpuPerRequestMs),
  }
}

// the assertion layer: what is wrong with a report (empty list = consistent)
function check(report) {
  const problems = []
  if (report.schema !== 1) problems.push('schema')
  if (JSON.stringify(Object.keys(report.arms)) !== JSON.stringify(ARMS))
    problems.push(`arms ${Object.keys(report.arms)}`)
  if (
    JSON.stringify(Object.keys(report.rows)) !==
    JSON.stringify(['1', '2', '3', '4', '5', '6', '7'])
  )
    problems.push(`rows ${Object.keys(report.rows)}`)
  if (problems.length) return problems
  for (const a of ARMS) {
    const arm = report.arms[a]
    for (const key of [
      'requests',
      'n5xx',
      'errors',
      'rssMaxMiB',
      'cpuPerRequestMs',
    ]) {
      if (!Number.isFinite(arm[key]))
        problems.push(`${a}.${key} is not a number`)
    }
    if (!(arm.requests > 0)) problems.push(`${a} replayed no request`)
    if (!arm.p95 || !Object.keys(arm.p95).length)
      problems.push(`${a} has no p95`)
    if (!Array.isArray(arm.t907)) problems.push(`${a}.t907`)
  }
  const want = oracle(report)
  for (const k of Object.keys(want)) {
    if (report.rows[k].pass !== want[k]) {
      problems.push(
        `row ${k}: report says ${report.rows[k].pass}, the 55 table gives ${want[k]}`
      )
    }
  }
  const breaches = Object.entries(report.rows)
    .filter(([, r]) => r.pass === false)
    .map(([k]) => Number(k))
  if (JSON.stringify(report.breaches) !== JSON.stringify(breaches)) {
    problems.push(
      `breaches ${JSON.stringify(report.breaches)} vs rows ${JSON.stringify(
        breaches
      )}`
    )
  }
  if (report.pass !== (breaches.length === 0)) problems.push('pass flag')
  return problems
}

// ---------- the pilot report ----------
function pilotReport() {
  if (process.env.T902_REPORT) {
    return {
      file: process.env.T902_REPORT,
      report: JSON.parse(fs.readFileSync(process.env.T902_REPORT, 'utf8')),
    }
  }
  const dir = path.join(ARTIFACT_DIR, 'soak')
  const found = fs.existsSync(dir)
    ? fs
        .readdirSync(dir)
        .map((id) => path.join(dir, id, 'report.json'))
        .filter((f) => fs.existsSync(f))
        .map((file) => ({
          file,
          report: JSON.parse(fs.readFileSync(file, 'utf8')),
        }))
        .filter((x) => x.report.schema === 1 && x.report.endedAt)
        .sort((a, b) => (a.report.endedAt < b.report.endedAt ? 1 : -1))
    : []
  if (!found.length) {
    throw new Error(
      `no soak report under ${dir}: run the pilot first, e.g. npm run soak -- --reference <build> --candidate <build> --golden <build> --smoke (or set T902_REPORT)`
    )
  }
  return found[0]
}

// a consistent report to perturb (figures of the pilot's shape)
const arm = (over = {}) => ({
  build: '0123456789abcdef',
  requests: 300,
  exit: null,
  n5xx: 6,
  errors: 0,
  p95: { '/data-providers': 900, '/search': 100, '/works': 300, 'other': 8 },
  rssMaxMiB: 400,
  rssSlopeKiBPer10k: 120,
  cpuPerRequestMs: 70,
  t907: [
    { tag: 'start', rc: 0, passed: 7 },
    { tag: 'end', rc: 0, passed: 7 },
  ],
  blocks: [{ block: 1, requests: 300, cpuS: 21 }],
  ...over,
})
function synthetic(over = {}) {
  const report = {
    schema: 1,
    id: 'synthetic',
    corpus: 'pilot',
    smoke: false,
    rps: 10,
    blockMin: 30,
    blocksPerArm: 3,
    arms: { reference: arm(), candidate: arm(), golden: arm() },
    rows: {},
    ...over,
  }
  // the verdicts a correct tool would write
  const want = oracle({
    ...report,
    rows: { 5: { differing: over.differing || [] } },
  })
  report.rows = Object.fromEntries(
    Object.entries(want).map(([k, v]) => [k, { pass: v }])
  )
  report.rows[5].differing = over.differing || []
  report.breaches = Object.entries(report.rows)
    .filter(([, r]) => r.pass === false)
    .map(([k]) => Number(k))
  report.pass = report.breaches.length === 0
  return report
}
// the verdict row `k` gets from the layer when the arms are changed but the
// report still carries the old rows
const rowsAfter = (mutate, differing) => {
  const base = synthetic()
  const edited = JSON.parse(JSON.stringify(base))
  mutate(edited.arms)
  if (differing) edited.rows[5].differing = differing
  return oracle(edited)
}

describe('T-902 @P1 pre-merge soak (C6-CI rows 1-7; calibration and prod limits DEFERRED)', () => {
  test('T-902 c1 @P1 01 §4 step 3a: the soak tool replays reference, candidate and golden parity builds through the stub at prod limits, in interleaved 30-minute blocks (OD-47)', () => {
    // --- the tool: defaults, the arm order and the interleaving ---
    const tool = read('scripts/soak.mjs')
    expect(tool).toMatch(/get\(\s*'--rps',\s*smoke \? 5 : 10\s*\)/)
    expect(tool).toMatch(/get\(\s*'--block-min',\s*smoke \? 1 : 30\s*\)/)
    expect(tool).toMatch(/get\(\s*'--blocks',\s*smoke \? 1 : 3\s*\)/)
    expect(tool).toMatch(
      /reference: o\.get\('--reference'\)[\s\S]*candidate: o\.get\('--candidate'\)[\s\S]*golden: o\.get\('--golden'/
    )
    // blocks outermost, arms inside: R C G R C G ...; one arm loaded at a time
    // (the loop awaits each block)
    expect(tool).toMatch(
      /for \(let b = 0; b < blocks; b\+\+\)\s*for \(const arm of arms\)\s*\{\s*const r = await block\(/
    )
    // the stub serves the corpus answers: no live API
    expect(tool).toMatch(/buildReplayRoot\(name, \{ base: 'fixtures' \}\)/)

    // prod limits: the cluster's and the tool's own statement
    const dep = YAML.parseAllDocuments(read('kube/prod/deployment.yaml'))
      .map((d) => d.toJS())
      .find((d) => d && d.kind === 'Deployment')
    const { limits } = dep.spec.template.spec.containers[0].resources
    expect(limits).toEqual({ cpu: '600m', memory: '768Mi' })
    expect(tool).toMatch(/mem_limit 768m, CPU 600m/)

    // the pilot report: three arms, blocks in order, one corpus, a stated
    // limits note
    const { file, report } = pilotReport()
    expect(report.schema).toBe(1)
    expect(Object.keys(report.arms)).toEqual(ARMS)
    expect(report.corpus).toEqual(expect.any(String))
    expect(report.limits).toMatch(/mem_limit 768m, CPU 600m/)
    expect(report.limits).toMatch(/not enforced in local mode/)
    // the schedule: the plan's 10 rps in blocks of 30 minutes, 3 per arm; a
    // smoke pilot is 5 rps, 1 block of 1 minute
    expect([report.rps, report.blockMin, report.blocksPerArm]).toEqual(
      report.smoke ? [5, 1, 1] : [10, 30, 3]
    )
    for (const a of ARMS) {
      const { blocks, requests } = report.arms[a]
      expect(blocks.map((b) => b.block)).toEqual(
        Array.from({ length: report.blocksPerArm }, (_, i) => i + 1)
      )
      // every arm received the same schedule: blocks of the same length at the
      // same rate, within a few percent
      expect(blocks.reduce((n, b) => n + b.requests, 0)).toBe(requests)
    }
    const counts = ARMS.map((a) => report.arms[a].requests)
    expect(Math.max(...counts) - Math.min(...counts)).toBeLessThanOrEqual(
      0.05 * Math.max(...counts)
    )
    expect(new Date(report.endedAt) > new Date(report.startedAt)).toBe(true)
    expect(path.basename(file)).toBe('report.json')
  })

  test('T-902 c2 @P1 55 C6-CI rows 1-7: the report of the pilot run equals the table; known-answer reports at each boundary', () => {
    // --- the pilot report ---
    const { report } = pilotReport()
    expect(check(report)).toEqual([])
    // the t907 rows of the pilot: both runs of every arm, in order
    for (const a of ARMS)
      expect(report.arms[a].t907.map((t) => t.tag)).toEqual(['start', 'end'])
    // calibration is DEFERRED: the row 4 slope bound has no 2.8 record or
    // tolerance
    expect(report.rows[4]).toMatchObject({
      record28: null,
      slopeTolerance: null,
    })
    expect(report.rows[4].candidate).toHaveProperty('slope')
    if (process.env.T902_EXPECT_PASS === '1') {
      expect(report.breaches).toEqual([])
      expect(report.pass).toBe(true)
    }

    // the layer accepts a consistent report and names every inconsistency
    expect(check(synthetic())).toEqual([])
    const base = synthetic()
    expect(base.rows[4].pass).toBe(true)
    expect(Object.values(base.rows).every((r) => r.pass === true)).toBe(true)

    // row 1: an arm that exited (restart / OOM) fails the row, whichever arm
    for (const a of ARMS) {
      expect(
        rowsAfter((arms) => {
          arms[a].exit = { code: 137, signal: 'SIGKILL' }
        })[1]
      ).toBe(false)
    }
    // row 2: 5xx <= reference, equal passes, one more fails
    expect(
      rowsAfter((arms) => {
        arms.candidate.n5xx = 6
      })[2]
    ).toBe(true)
    expect(
      rowsAfter((arms) => {
        arms.candidate.n5xx = 7
      })[2]
    ).toBe(false)
    expect(
      rowsAfter((arms) => {
        arms.candidate.n5xx = 0
        arms.reference.n5xx = 0
      })[2]
    ).toBe(true)
    // row 3: each prefix, against the reference and against the golden, 1.10
    // inclusive
    expect(
      rowsAfter((arms) => {
        arms.candidate.p95['/search'] = 110
      })[3]
    ).toBe(true)
    expect(
      rowsAfter((arms) => {
        arms.candidate.p95['/search'] = 110.5
      })[3]
    ).toBe(false)
    expect(
      rowsAfter((arms) => {
        arms.candidate.p95['/works'] = 331
      })[3]
    ).toBe(false)
    expect(
      rowsAfter((arms) => {
        arms.candidate.p95['/data-providers'] = 990
      })[3]
    ).toBe(true)
    expect(
      rowsAfter((arms) => {
        arms.candidate.p95['/data-providers'] = 991
      })[3]
    ).toBe(false)
    // within 1.10 x the reference but not 1.10 x a faster golden (the
    // cumulative arm)
    expect(
      rowsAfter((arms) => {
        arms.reference.p95['/search'] = 200
        arms.candidate.p95['/search'] = 150
      })[3]
    ).toBe(false)
    expect(
      rowsAfter((arms) => {
        arms.reference.p95['/search'] = 200
        arms.golden.p95['/search'] = 150
        arms.candidate.p95['/search'] = 165
      })[3]
    ).toBe(true)
    // row 4: 1.10 x the reference, and under 700 MiB whatever the reference
    expect(
      rowsAfter((arms) => {
        arms.candidate.rssMaxMiB = 440
      })[4]
    ).toBe(true)
    expect(
      rowsAfter((arms) => {
        arms.candidate.rssMaxMiB = 441
      })[4]
    ).toBe(false)
    expect(
      rowsAfter((arms) => {
        arms.reference.rssMaxMiB = 650
        arms.candidate.rssMaxMiB = 699.9
      })[4]
    ).toBe(true)
    expect(
      rowsAfter((arms) => {
        arms.reference.rssMaxMiB = 700
        arms.candidate.rssMaxMiB = 700
      })[4]
    ).toBe(false)
    // row 5: any URL whose upstream call set differs
    expect(rowsAfter(() => {}, [])[5]).toBe(true)
    expect(rowsAfter(() => {}, ['/works/1001/'])[5]).toBe(false)
    // row 6: T-907 at start and end of every arm
    for (const a of ARMS) {
      for (const i of [0, 1]) {
        expect(
          rowsAfter((arms) => {
            arms[a].t907[i].rc = 1
          })[6]
        ).toBe(false)
      }
    }
    expect(
      rowsAfter((arms) => {
        for (const a of ARMS) arms[a].t907 = []
      })[6]
    ).toBe(null)
    // row 7: CPU per request
    expect(
      rowsAfter((arms) => {
        arms.candidate.cpuPerRequestMs = 77
      })[7]
    ).toBe(true)
    expect(
      rowsAfter((arms) => {
        arms.candidate.cpuPerRequestMs = 77.1
      })[7]
    ).toBe(false)
    expect(
      rowsAfter((arms) => {
        arms.golden.cpuPerRequestMs = 60
      })[7]
    ).toBe(false)

    // a tool that evaluated a row wrongly is caught: arms changed, rows left as
    // the old tool wrote them
    const wrong = JSON.parse(JSON.stringify(base))
    wrong.arms.candidate.cpuPerRequestMs = 90
    expect(check(wrong)).toEqual([
      expect.stringMatching(
        /^row 7: report says true, the 55 table gives false/
      ),
    ])
    const wrongRow3 = JSON.parse(JSON.stringify(base))
    wrongRow3.arms.candidate.p95['/works'] = 600
    wrongRow3.arms.golden.p95['/works'] = 300
    expect(check(wrongRow3).map((p) => p.slice(0, 5))).toEqual(['row 3'])
    // a breach list or pass flag that disagrees with the rows
    const flag = JSON.parse(JSON.stringify(base))
    flag.rows[2].pass = false
    expect(check(flag)).toEqual(
      expect.arrayContaining([
        expect.stringMatching(/^row 2/),
        expect.stringMatching(/^breaches/),
        'pass flag',
      ])
    )
    // structure: a missing arm or row is a problem, not an exception
    const noGolden = JSON.parse(JSON.stringify(base))
    delete noGolden.arms.golden
    expect(check(noGolden)[0]).toMatch(/^arms /)
    const noRow = JSON.parse(JSON.stringify(base))
    delete noRow.rows[7]
    expect(check(noRow)[0]).toMatch(/^rows /)
  })
})
