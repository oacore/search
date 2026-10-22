// T-903 (41 J; R-016, R-048; 55 C6-prod, 01 §4 step 9): the 48 h prod watch.
// The watch itself runs on production after a merge and is DEFERRED to the
// owner (Q-095: a rollout can mix pods; the monitoring exports come from the
// team's existing accounts, VF-16). What runs here is the evaluator
// scripts/watch-c6prod.mjs on synthetic exports with known answers; the
// expected values are computed in this file from the formulas of 55, never
// from the tool:
//   c1 the watch window, the baseline (the same two weekdays of the previous
//      four weeks) and the rollout-window exclusion;
//   c2 the ten rows, each with a pass, a breach and its edge cases;
//   c3 breach -> rollback;
//   c4 0 5xx in the rollout per Next major (row 10);
//   c5 the Host/Authorization comparison of the first rollout of W4e and 6.3
//      (VF-02).
// Ops test, outside the default Jest projects. Run:
//  npx jest --config '{"testMatch":["**/ops/t903*.test.js"],"transform":{}}'
const fs = require('fs')
const os = require('os')
const path = require('path')
const { spawnSync } = require('child_process')

jest.setTimeout(180000)

const REPO = path.resolve(__dirname, '..', '..')
const TOOL = path.join(REPO, 'scripts', 'watch-c6prod.mjs')
const STATS = path.join(REPO, 'scripts', 'gate-stats.mjs')

// ---------- dates and exports ----------
const DAY = 86400000
const addDays = (iso, k) =>
  new Date(Date.parse(`${iso}T00:00:00Z`) + k * DAY).toISOString().slice(0, 10)
const range = (from, n) => Array.from({ length: n }, (_, i) => addDays(from, i))

const WATCH_FROM = '2026-10-21' // a Wednesday: the watch is Wednesday and Thursday
const WATCH = [WATCH_FROM, addDays(WATCH_FROM, 1)]
const BASELINE_FROM = '2026-09-16'
// the export of the earlier weeks holds 35 days; only 8 of them are the
// baseline
const EXPORT_DAYS = range(BASELINE_FROM, 35)
const SELECTED = [1, 2, 3, 4].flatMap((w) => [
  addDays(WATCH_FROM, -7 * w),
  addDays(WATCH_FROM, 1 - 7 * w),
])
// a day outside the 8 carries values that would change every verdict if it were
// used
const OUTLIER = 9000

const rateSignal = (dates, f) => ({
  unit: 'event',
  source: 'synthetic',
  days: dates.map((date, i) => ({ date, ...f(date, i) })),
})
// baseline signal: the selected days follow `selected` (a list of 8 values, or
// one value), the others 9000
const baselineSignal = (selected, n = 100000) =>
  rateSignal(EXPORT_DAYS, (date) => {
    const i = SELECTED.indexOf(date)
    if (i < 0) return { x: OUTLIER, n }
    return { x: Array.isArray(selected) ? selected[i] : selected, n }
  })
const watchSignal = (xs, n = 100000) =>
  rateSignal(WATCH, (date, i) => ({ x: xs[i], n }))

// the daily counts of the baseline: 80 and 120 alternately (mean 100, sample
// variance 3200 / 7)
const SPREAD = [80, 120, 80, 120, 80, 120, 80, 120]
const PHI_SPREAD = 3200 / 7 / 100

const makeExport = (tag, dates, extras = {}) => ({
  schema: 1,
  tag,
  exportedAt: `${addDays(dates[dates.length - 1], 1)}T00:00:00Z`,
  window: { from: dates[0], to: dates[dates.length - 1] },
  sources: { synthetic: { retentionDays: 35 } },
  signals: {},
  ...extras,
})

let dir
const write = (name, obj) => {
  const file = path.join(dir, name)
  fs.writeFileSync(
    file,
    typeof obj === 'string' ? obj : JSON.stringify(obj, null, 1)
  )
  return file
}
beforeAll(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 't903-'))
})
afterAll(() => {
  fs.rmSync(dir, { recursive: true, force: true })
})

// runs the tool; the JSON result for exit 0 and 1, the message for exit 2
function watch({ baseline, watchDoc, args = [], probes, rollouts }) {
  const argv = [
    TOOL,
    '--baseline',
    write('baseline.json', baseline),
    '--watch',
    write('watch.json', watchDoc),
    '--json',
    ...args,
  ]
  if (probes) argv.push('--probes', write('probes.json', probes))
  if (rollouts) argv.push('--rollouts', write('rollouts.json', rollouts))
  const r = spawnSync(process.execPath, argv, { encoding: 'utf8' })
  if (r.status === 2) return { rc: 2, error: r.stderr.trim() }
  expect([0, 1]).toContain(r.status)
  return { rc: r.status, ...JSON.parse(r.stdout) }
}
const baseDoc = (signals = {}, extras = {}) =>
  makeExport('baseline', EXPORT_DAYS, { signals, ...extras })
const watchDocOf = (signals = {}, extras = {}) =>
  makeExport('watch', WATCH, { signals, ...extras })
const statusOf = (res, row) => res.rows[row].status

// z of 55 C6-prod row 1, from the formula (not from the tool)
const zOf = ({ x0, n0, x1, n1, phi }) =>
  (Math.log(x1 / n1 / (x0 / n0)) - Math.log(1.25)) /
  Math.sqrt(phi * (1 / x0 + 1 / x1))

describe('T-903 @P1 prod watch 48 h (C6-prod evaluator on synthetic exports)', () => {
  test('T-903 c1 @P1 01 §4 step 9: 48 h window, baseline = the same two weekdays of the previous four weeks, rollout window excluded', () => {
    // 8 baseline days of 100 events per 100,000 views, 27 other days of 9,000:
    // only the 8 are used
    const run = (
      args = [],
      watchDoc = watchDocOf({ errorEvents: watchSignal([100, 100]) })
    ) =>
      watch({
        baseline: baseDoc({ errorEvents: baselineSignal(100) }),
        watchDoc,
        args,
      })
    const res = run()
    expect(res.rc).toBe(0)
    expect(res.watch).toEqual({ days: WATCH, hours: 48 })
    expect(res.baselineDates).toEqual(SELECTED)
    expect(res.baselineDatesFound).toEqual(SELECTED)
    // the same two weekdays of the previous 4 weeks: Wednesday + Thursday, 7,
    // 14, 21 and 28 days earlier
    expect(
      res.baselineDates.map((d) => new Date(`${d}T00:00:00Z`).getUTCDay())
    ).toEqual([3, 4, 3, 4, 3, 4, 3, 4])
    expect(res.baselineDates).toHaveLength(8)
    // pooled over exactly those 8 days: x0 = 800 of n0 = 800,000, x1 = 200 of
    // n1 = 200,000
    const row = res.rows[1]
    expect([row.x0, row.n0, row.x1, row.n1, row.baselineDays]).toEqual([
      800, 800000, 200, 200000, 8,
    ])
    expect(row.rateBaselinePer1000).toBe(1)
    expect(row.rateWatchPer1000).toBe(1)

    // exactly two days: a longer window needs --watch-from, a shorter one is
    // refused
    const longer = makeExport('watch', range(WATCH_FROM, 3), {
      signals: {
        errorEvents: rateSignal(range(WATCH_FROM, 3), () => ({
          x: 100,
          n: 100000,
        })),
      },
    })
    expect(run([], longer).error).toMatch(/exactly two days \(48 h\)/)
    const picked = run(['--watch-from', WATCH_FROM], longer)
    expect(picked.rc).toBe(0)
    expect(picked.watch.days).toEqual(WATCH)
    const one = makeExport('watch', [WATCH_FROM], {
      signals: {
        errorEvents: rateSignal([WATCH_FROM], () => ({ x: 100, n: 100000 })),
      },
    })
    expect(run([], one).error).toMatch(/exactly two days/)
    // a watch export that lacks one of the two days cannot be evaluated:
    // unavailable, never a pass
    expect(run(['--watch-from', WATCH_FROM], one).rows[1]).toMatchObject({
      status: 'unavailable',
    })

    // rows 1-9 exclude the rollout window (Q-095): the rollout's own day is not
    // a watch day
    expect(run(['--rollout-end', `${WATCH_FROM}T09:30:00Z`]).error).toMatch(
      /include the rollout day 2026-10-21/
    )
    const clean = run(['--rollout-end', `${addDays(WATCH_FROM, -1)}T22:40:00Z`])
    expect(clean.rc).toBe(0)
    expect(
      run(['--rollout-end', `${addDays(WATCH_FROM, 3)}T09:00:00Z`]).error
    ).toMatch(/after the watch starts/)

    // an excluded day of the export (signed external cause) leaves the
    // baseline: 7 days, still evaluated
    const excluded = baseDoc(
      { errorEvents: baselineSignal(100) },
      {
        excludedDays: [
          { date: SELECTED[2], reason: 'external', signedBy: 'owner' },
        ],
      }
    )
    const seven = watch({
      baseline: excluded,
      watchDoc: watchDocOf({ errorEvents: watchSignal([100, 100]) }),
    })
    expect(seven.rows[1].baselineDays).toBe(7)
    expect(seven.baselineDatesFound).toEqual(
      SELECTED.filter((d) => d !== SELECTED[2])
    )
    // fewer than 4 baseline days: unavailable
    const thin = baseDoc({
      errorEvents: rateSignal(SELECTED.slice(0, 3), () => ({
        x: 100,
        n: 100000,
      })),
    })
    expect(
      watch({
        baseline: thin,
        watchDoc: watchDocOf({ errorEvents: watchSignal([100, 100]) }),
      }).rows[1]
    ).toMatchObject({ status: 'unavailable' })
  })

  test('T-903 c2 @P1 55 C6-prod rows 1-10 on exported monitoring data: pass, breach and edge cases with known answers', () => {
    // rows 1 and 2 (same test): pooled z, both days above the baseline maximum,
    // one day above it
    const rate = (name, xsWatch, baselineXs = SPREAD, n = 100000) =>
      watch({
        baseline: baseDoc({ [name]: baselineSignal(baselineXs, n) }),
        watchDoc: watchDocOf({ [name]: watchSignal(xsWatch, n) }),
      })
    for (const [row, name] of [
      [1, 'errorEvents'],
      [2, 'gateway5xx'],
    ]) {
      const pass = rate(name, [110, 110])
      expect(statusOf(pass, row)).toBe('pass')
      expect(pass.rows[row].phi).toBeCloseTo(PHI_SPREAD, 3)
      // one day above the highest baseline daily rate (120): triage only
      const triage = rate(name, [125, 100])
      expect(statusOf(triage, row)).toBe('triage')
      expect(triage.rc).toBe(0)
      // both days above it: breach even though the pooled rate is exactly 1.25
      // x (z = 0)
      const both = rate(name, [125, 125])
      expect(statusOf(both, row)).toBe('breach')
      expect(both.rows[row].z).toBeCloseTo(0, 9)
      expect(both.rows[row].note).toMatch(/both days above/)
      // the pooled test alone: one huge day, the other under the maximum
      const pooled = rate(name, [400, 100])
      expect(statusOf(pooled, row)).toBe('breach')
      const z = zOf({
        x0: 800,
        n0: 800000,
        x1: 500,
        n1: 200000,
        phi: PHI_SPREAD,
      })
      expect(z).toBeGreaterThan(2.326)
      expect(pooled.rows[row].z).toBeCloseTo(z, 9)
      expect(pooled.rows[row].daysAboveMax).toBe(1)
      expect(pooled.rc).toBe(1)
    }
    // the tool's z is gate-stats' z for the same counts (phi 1: a constant
    // baseline)
    {
      const res = rate('gateway5xx', [105, 115], 100)
      const r = res.rows[2]
      expect(r.phi).toBe(1)
      const cli = spawnSync(
        process.execPath,
        [
          STATS,
          'z',
          '--x0',
          '800',
          '--n0',
          '800000',
          '--x1',
          '220',
          '--n1',
          '200000',
          '--phi',
          '1',
        ],
        { encoding: 'utf8' }
      )
      expect(r.z).toBeCloseTo(JSON.parse(cli.stdout).z, 12)
      expect(r.z).toBeCloseTo(
        zOf({ x0: 800, n0: 800000, x1: 220, n1: 200000, phi: 1 }),
        12
      )
    }
    // phi never drops below 1 (a constant baseline has variance 0): the z is
    // the Poisson z
    expect(rate('errorEvents', [102, 102], 100).rows[1].phi).toBe(1)
    // a pooled breach is decided on the z against 2.326: counts on either side
    // of it. The baseline has the same 100 events a day but 80,000 and 120,000
    // views alternately (its highest daily rate is 0.00125), and the watch has
    // one day far above it and one far below, so the pooled test alone decides
    // breach or triage.
    {
      const alternating = rateSignal(EXPORT_DAYS, (date) => {
        const i = SELECTED.indexOf(date)
        return i < 0
          ? { x: OUTLIER, n: 100000 }
          : { x: 100, n: i % 2 ? 120000 : 80000 }
      })
      const seen = [290, 292, 293, 294, 295, 300].map((x1) => {
        const res = watch({
          baseline: baseDoc({ gateway5xx: alternating }),
          watchDoc: watchDocOf({ gateway5xx: watchSignal([x1 - 3, 3]) }),
        })
        const z = zOf({ x0: 800, n0: 800000, x1, n1: 200000, phi: 1 })
        return [res.rows[2].z, z, res.rows[2].status, z > 2.326]
      })
      for (const [got, want, status, over] of seen) {
        expect(got).toBeCloseTo(want, 9)
        expect(status).toBe(over ? 'breach' : 'triage')
      }
      // the counts straddle the critical value
      expect(seen.map((s) => s[3])).toEqual([
        false,
        false,
        false,
        true,
        true,
        true,
      ])
    }
    // an almost constant baseline (99 and 101 alternately: variance / mean
    // = 0.0114) is not credited above Poisson: phi is floored at 1
    {
      const res = rate(
        'errorEvents',
        [130, 130],
        [99, 101, 99, 101, 99, 101, 99, 101]
      )
      expect(res.rows[1].phi).toBe(1)
      expect(res.rows[1].z).toBeCloseTo(
        zOf({ x0: 800, n0: 800000, x1: 260, n1: 200000, phi: 1 }),
        9
      )
    }
    // a baseline without events: any event is above it (both days: breach; one
    // day: triage); none: pass
    expect(statusOf(rate('gateway5xx', [0, 0], 0), 2)).toBe('pass')
    expect(statusOf(rate('gateway5xx', [3, 0], 0), 2)).toBe('triage')
    expect(statusOf(rate('gateway5xx', [3, 2], 0), 2)).toBe('breach')
    // row 1 falls back to LogRocket error sessions when the Sentry series is
    // not exported (C6-NI (iii))
    {
      const res = rate('logrocketErrorSessions', [110, 110])
      expect(res.rows[1]).toMatchObject({
        status: 'pass',
        signal: 'logrocketErrorSessions',
      })
    }
    // a source that is not exported is unavailable, printed, never a pass or a
    // breach
    {
      const res = watch({ baseline: baseDoc(), watchDoc: watchDocOf() })
      expect(res.rc).toBe(0)
      for (const row of [1, 2, 3, 4, 5, 6, 7, 8, 9, 10])
        expect(['unavailable']).toContain(statusOf(res, row))
      expect(res.summary.unavailable).toEqual([
        '1',
        '2',
        '3',
        '4',
        '5',
        '6',
        '7',
        '8',
        '9',
        '10',
      ])
      expect(res.rows[3].coveredBy).toBe('C6-CI row 1')
      expect(res.rows[4].coveredBy).toBe('C6-CI row 3')
      expect(res.rows[9].coveredBy).toBe('C6-CI row 7')
      expect(res.summary.decision).toBe('CONTINUE')
    }

    // ---- row 3: restarts and OOMKills ----
    const restarts = (baselineList, watchList, pods) =>
      watch({
        baseline: baseDoc(
          {},
          { restarts: baselineList, ...(pods ? { podDays: pods.base } : {}) }
        ),
        watchDoc: watchDocOf(
          {},
          { restarts: watchList, ...(pods ? { podDays: pods.watch } : {}) }
        ),
      })
    expect(statusOf(restarts([], []), 3)).toBe('pass')
    expect(
      restarts([], [{ date: WATCH[0], reason: 'Error', exitCode: 1, count: 1 }])
        .rows[3]
    ).toMatchObject({
      status: 'breach',
      baselineHasRestarts: false,
    })
    {
      // the 2.0 export has restarts: 2 per day on 4 of the baseline days over 4
      // pods = 0.5 per pod-day
      const base = SELECTED.slice(0, 4).map((date) => ({
        date,
        reason: 'Error',
        exitCode: 1,
        count: 2,
      }))
      const pods = {
        base: SELECTED.map((date) => ({ date, pods: 4 })),
        watch: WATCH.map((date) => ({ date, pods: 8 })),
      }
      // 4 restarts over 8 pods = 0.5 per pod-day: at the cap
      const atCap = restarts(
        base,
        [{ date: WATCH[0], reason: 'Error', exitCode: 1, count: 4 }],
        pods
      )
      expect(atCap.rows[3]).toMatchObject({ status: 'pass', capPerPodDay: 0.5 })
      // 5 over 8 pods = 0.625: over the cap
      const over = restarts(
        base,
        [{ date: WATCH[0], reason: 'Error', exitCode: 1, count: 5 }],
        pods
      )
      expect(over.rows[3]).toMatchObject({
        status: 'breach',
        daysOverCap: [WATCH[0]],
      })
      // within the cap but a termination the export never had
      const oom = restarts(
        base,
        [{ date: WATCH[1], reason: 'OOMKilled', exitCode: 137, count: 1 }],
        pods
      )
      expect(oom.rows[3]).toMatchObject({
        status: 'breach',
        newTerminations: ['OOMKilled/137'],
      })
    }
    expect(
      watch({ baseline: baseDoc(), watchDoc: watchDocOf() }).rows[3].status
    ).toBe('unavailable')

    // ---- row 4: p95 latency, 1.10 x the pooled baseline ----
    const p95 = (search, works) =>
      watch({
        baseline: baseDoc(
          {},
          {
            p95: {
              '/search': SELECTED.map((date) => ({ date, ms: 200 })),
              '/works': SELECTED.map((date) => ({ date, ms: 300 })),
            },
          }
        ),
        watchDoc: watchDocOf(
          {},
          {
            p95: {
              '/search': WATCH.map((date) => ({ date, ms: search })),
              '/works': WATCH.map((date) => ({ date, ms: works })),
            },
          }
        ),
      })
    expect(p95(220, 330).rows[4]).toMatchObject({ status: 'pass', limit: 1.1 })
    expect(p95(221, 300).rows[4].status).toBe('breach')
    expect(p95(200, 331).rows[4].status).toBe('breach')
    expect(p95(220, 330).rows[4].prefixes['/search'].ratio).toBe(1.1)

    // ---- row 5: GA page_view per session, +-5 % ----
    const ga = (x) =>
      watch({
        baseline: baseDoc({ gaPageViewsPerSession: baselineSignal(300000) }),
        watchDoc: watchDocOf({ gaPageViewsPerSession: watchSignal([x, x]) }),
      })
    // n is 100,000 sessions a day: 3.00 per session in the baseline
    expect(statusOf(ga(315000), 5)).toBe('pass')
    expect(statusOf(ga(285000), 5)).toBe('pass')
    expect(statusOf(ga(315300), 5)).toBe('breach')
    expect(statusOf(ga(284700), 5)).toBe('breach')

    // ---- row 6: T-907 on prod ----
    const t907 = (passed, failed) =>
      watch({
        baseline: baseDoc(),
        watchDoc: watchDocOf(),
        probes: { t907: { passed, failed } },
      })
    expect(statusOf(t907(7, 0), 6)).toBe('pass')
    expect(statusOf(t907(6, 1), 6)).toBe('breach')
    expect(statusOf(t907(0, 0), 6)).toBe('breach')

    // ---- row 7: new error types ----
    {
      const K1 = 'a'.repeat(64)
      const K2 = 'b'.repeat(64)
      const K3 = 'c'.repeat(64)
      const base = baseDoc(
        {},
        {
          errorGroups: [
            {
              key: K1,
              inApp: true,
              users: 4,
              days: [{ date: SELECTED[0], count: 5 }],
            },
          ],
        }
      )
      const groups = [
        {
          key: K1,
          inApp: true,
          users: 90,
          days: WATCH.map((date) => ({ date, count: 500 })),
        },
        {
          key: K2,
          inApp: true,
          users: 3,
          days: [
            { date: WATCH[0], count: 7 },
            { date: WATCH[1], count: 5 },
          ],
        },
        {
          key: K3,
          inApp: false,
          users: 40,
          days: [{ date: WATCH[1], count: 900 }],
        },
      ]
      const row7 = (args) =>
        watch({
          baseline: base,
          watchDoc: watchDocOf({}, { errorGroups: groups }),
          args,
        }).rows[7]
      // K1 is not new, K3 is new but not in an app chunk (logged, triaged
      // within 24 h), K2 is new and in app code
      expect(row7(['--n', '10', '--m', '5'])).toMatchObject({
        status: 'breach',
        newGroups: 2,
        newInAppGroups: 1,
      })
      expect(
        row7(['--n', '10', '--m', '5']).breaching.map((g) => g.key)
      ).toEqual([K2])
      expect(row7(['--n', '13', '--m', '5']).status).toBe('pass')
      expect(row7(['--n', '13', '--m', '3']).status).toBe('breach')
      expect(row7(['--n', '13', '--m', '5']).logged).toEqual([K3])
      const unset = row7([])
      expect(unset).toMatchObject({ status: 'not-set' })
      expect(unset.candidates.map((g) => g.key)).toEqual([K2])
      expect(row7(['--n', '10', '--m', '5', '--row8-uncounted']).status).toBe(
        'not-counted'
      )
    }

    // ---- row 8: telemetry liveness at 0 h and 48 h ----
    const live = (liveness) =>
      watch({
        baseline: baseDoc(),
        watchDoc: watchDocOf(),
        probes: { liveness },
      })
    const at = (h, events = 1, withinMinutes = 4) => ({
      at: h,
      events,
      withinMinutes,
    })
    expect(statusOf(live([at('0h'), at('48h')]), 8)).toBe('pass')
    expect(statusOf(live([at('0h'), at('48h', 1, 10)]), 8)).toBe('pass')
    expect(statusOf(live([at('0h')]), 8)).toBe('pending')
    expect(statusOf(live([at('0h'), at('48h', 0)]), 8)).toBe('breach')
    expect(statusOf(live([at('0h'), at('48h', 1, 11)]), 8)).toBe('breach')

    // ---- row 9: CPU-seconds per 1,000 requests and HPA replicas ----
    const cpu = (seconds, replicas) =>
      watch({
        baseline: baseDoc(
          {},
          { cpuPer1000: SELECTED.map((date) => ({ date, s: 10 })) }
        ),
        watchDoc: watchDocOf(
          {},
          {
            cpuPer1000: WATCH.map((date) => ({ date, s: seconds })),
            replicas: WATCH.map((date) => ({ date, max: replicas })),
          }
        ),
      })
    expect(cpu(11, 14).rows[9]).toMatchObject({
      status: 'pass',
      maxReplicas: 14,
    })
    expect(statusOf(cpu(11.1, 14), 9)).toBe('breach')
    expect(statusOf(cpu(10, 15), 9)).toBe('breach')
    expect(
      watch({
        baseline: baseDoc(),
        watchDoc: watchDocOf(
          {},
          { replicas: WATCH.map((date) => ({ date, max: 4 })) }
        ),
      }).rows[9]
    ).toMatchObject({ status: 'pass', cpu: 'unavailable' })

    // row 10: rollout window (z with x0 = the last 3 rollouts, n0 = 3, x1 =
    // this one, n1 = 1, phi = 1)
    const history = [
      { id: 'r0', x5xx: 9, nextData404: 90 },
      { id: 'r1', x5xx: 1, nextData404: 30 },
      { id: 'r2', x5xx: 0, nextData404: 28 },
      { id: 'r3', x5xx: 2, nextData404: 33 },
    ]
    const rollout = (x5xx, nextData404, list = history) =>
      watch({
        baseline: baseDoc(),
        watchDoc: watchDocOf(),
        rollouts: { rollouts: [...list, { id: 'now', x5xx, nextData404 }] },
      })
    // earlier = r1..r3: 94 events, the maximum of one rollout is 35
    const z90 = zOf({ x0: 94, n0: 3, x1: 90, n1: 1, phi: 1 })
    expect(z90).toBeGreaterThan(2.326)
    expect(rollout(0, 90).rows[10]).toMatchObject({
      status: 'breach',
      x0: 94,
      x1: 90,
    })
    expect(rollout(0, 90).rows[10].z).toBeCloseTo(z90, 9)
    expect(zOf({ x0: 94, n0: 3, x1: 40, n1: 1, phi: 1 })).toBeLessThan(2.326)
    expect(rollout(0, 40).rows[10]).toMatchObject({
      status: 'triage',
      maxEarlier: 35,
    })
    expect(statusOf(rollout(1, 29), 10)).toBe('pass')
    expect(statusOf(rollout(0, 0), 10)).toBe('pass')
    // fewer than 3 earlier rollouts: the z-test cannot be run
    expect(rollout(0, 5, history.slice(2)).rows[10].status).toBe('unavailable')
  })

  test('T-903 c3 @P1 breach -> rollback: exit 1 and the decision ROLLBACK first (01 §5); triage, unavailable and pending rows never roll back', () => {
    const baseline = baseDoc({ gateway5xx: baselineSignal(SPREAD) })
    const run = (xs, extra = {}, extraArgs = []) =>
      watch({
        baseline,
        watchDoc: watchDocOf({ gateway5xx: watchSignal(xs) }, extra),
        args: extraArgs,
        probes: { t907: { passed: 7, failed: 0 } },
      })
    const ok = run([110, 110])
    expect(ok.rc).toBe(0)
    expect(ok.summary).toMatchObject({ breaches: [], decision: 'CONTINUE' })
    // a triage row continues (triaged within 24 h, 40 §9)
    const triage = run([125, 100])
    expect(triage.rc).toBe(0)
    expect(triage.summary).toMatchObject({
      breaches: [],
      triage: ['2'],
      decision: 'CONTINUE',
    })
    // one breach is enough, whatever the other rows say
    const breach = run([400, 100])
    expect(breach.rc).toBe(1)
    expect(breach.summary).toMatchObject({
      breaches: ['2'],
      decision: 'ROLLBACK',
    })
    // several breaches are all listed
    const failedProbe = watch({
      baseline,
      watchDoc: watchDocOf({ gateway5xx: watchSignal([400, 100]) }),
      probes: {
        t907: { passed: 6, failed: 1 },
        liveness: [{ at: '0h', events: 0, withinMinutes: 3 }],
      },
    })
    expect(failedProbe.rc).toBe(1)
    expect(failedProbe.summary.breaches).toEqual(['2', '6', '8'])
    expect(failedProbe.summary.decision).toBe('ROLLBACK')
    // the printed form names the decision and the runbook section
    const printed = spawnSync(
      process.execPath,
      [
        TOOL,
        '--baseline',
        write('b.json', baseline),
        '--watch',
        write('w.json', watchDocOf({ gateway5xx: watchSignal([400, 100]) })),
      ],
      { encoding: 'utf8' }
    )
    expect(printed.status).toBe(1)
    expect(printed.stdout).toMatch(/row 2\s+breach/)
    expect(printed.stdout).toMatch(/decision: ROLLBACK first \(01 §5\): rows 2/)
    const quiet = spawnSync(
      process.execPath,
      [
        TOOL,
        '--baseline',
        write('b.json', baseline),
        '--watch',
        write('w.json', watchDocOf({ gateway5xx: watchSignal([110, 110]) })),
      ],
      { encoding: 'utf8' }
    )
    expect(quiet.status).toBe(0)
    expect(quiet.stdout).toMatch(/decision: CONTINUE/)
    // an input error is its own exit code: a broken export never reads as a
    // pass
    const broken = spawnSync(
      process.execPath,
      [
        TOOL,
        '--baseline',
        write('b.json', baseline),
        '--watch',
        write('w.json', '{ not json'),
      ],
      { encoding: 'utf8' }
    )
    expect(broken.status).toBe(2)
    // an export carrying an e-mail address is refused (the exports hold counts
    // and hashed keys only)
    const mail = watchDocOf({ gateway5xx: watchSignal([110, 110]) })
    mail.note = 'someone@example.org'
    const refused = spawnSync(
      process.execPath,
      [
        TOOL,
        '--baseline',
        write('b.json', baseline),
        '--watch',
        write('w.json', mail),
      ],
      { encoding: 'utf8' }
    )
    expect(refused.status).toBe(2)
    expect(refused.stderr).toMatch(/e-mail pattern/)
    // the built-in known answers pass
    const self = spawnSync(process.execPath, [TOOL, '--self-test'], {
      encoding: 'utf8',
    })
    expect(self.status).toBe(0)
  })

  test('T-903 c4 @P1 0 5xx in the rollout per Next major (row 10): any 5xx is a breach, 404s of mixed pods are not', () => {
    const history = [
      { id: 'r1', x5xx: 3, nextData404: 30 },
      { id: 'r2', x5xx: 2, nextData404: 28 },
      { id: 'r3', x5xx: 4, nextData404: 33 },
    ]
    const run = (current, args) =>
      watch({
        baseline: baseDoc(),
        watchDoc: watchDocOf(),
        rollouts: { rollouts: [...history, current] },
        args,
      })
    // 5xx inside what earlier rollouts showed: no breach of the ordinary test
    // ...
    const ordinary = run({ id: 'now', x5xx: 1, nextData404: 30 }, [])
    expect(ordinary.rows[10].status).toBe('pass')
    expect(ordinary.rc).toBe(0)
    // ... but a Next major allows none
    const major = run({ id: 'now', x5xx: 1, nextData404: 30 }, ['--next-major'])
    expect(major.rows[10]).toMatchObject({ status: 'breach', x5xx: 1 })
    expect(major.rows[10].note).toMatch(/0 5xx/)
    expect(major.rc).toBe(1)
    expect(major.summary.decision).toBe('ROLLBACK')
    // 0 5xx passes even with the usual _next/data 404s of a mixed fleet (Q-095)
    const clean = run({ id: 'now', x5xx: 0, nextData404: 31 }, ['--next-major'])
    expect(clean.rows[10].status).toBe('pass')
    expect(clean.rc).toBe(0)
    // the rule holds when the history is too short for the z-test
    const short = watch({
      baseline: baseDoc(),
      watchDoc: watchDocOf(),
      rollouts: { rollouts: [{ id: 'now', x5xx: 2, nextData404: 0 }] },
      args: ['--next-major'],
    })
    expect(short.rows[10].status).toBe('breach')
    const shortClean = watch({
      baseline: baseDoc(),
      watchDoc: watchDocOf(),
      rollouts: { rollouts: [{ id: 'now', x5xx: 0, nextData404: 40 }] },
      args: ['--next-major'],
    })
    expect(shortClean.rows[10].status).toBe('unavailable')
    expect(shortClean.rc).toBe(0)
  })

  test('T-903 c5 @P1 W4e and 6.3: Host/Authorization access-log extracts of the first rollout (VF-02): any difference -> rollback', () => {
    const lines = (...rows) => rows.map((r) => JSON.stringify(r)).join('\n')
    const compare = (before, after) =>
      watch({
        baseline: baseDoc(),
        watchDoc: watchDocOf(),
        args: [
          '--api-log-before',
          write('api-before.jsonl', before),
          '--api-log-after',
          write('api-after.jsonl', after),
        ],
      })
    const same = compare(
      lines(
        { host: 'api.core.ac.uk', scheme: 'Bearer' },
        { host: 'api.core.ac.uk', scheme: 'Bearer' }
      ),
      lines({ host: 'API.core.ac.uk', scheme: 'Bearer' })
    )
    // the volume differs (2 lines, 1 line): only the set of (Host, scheme) is
    // compared
    expect(same.rows['VF-02']).toMatchObject({
      status: 'pass',
      lines: [2, 1],
      before: ['api.core.ac.uk|Bearer'],
    })
    expect(same.rc).toBe(0)
    const host = compare(
      lines({ host: 'api.core.ac.uk', scheme: 'Bearer' }),
      lines({
        host: 'core-frontend-api.core-frontend.svc.cluster.local',
        scheme: 'Bearer',
      })
    )
    expect(host.rows['VF-02']).toMatchObject({
      status: 'breach',
      onlyBefore: ['api.core.ac.uk|Bearer'],
      onlyAfter: ['core-frontend-api.core-frontend.svc.cluster.local|Bearer'],
    })
    expect(host.rc).toBe(1)
    expect(host.summary.decision).toBe('ROLLBACK')
    // Authorization missing, or another scheme
    expect(
      compare(
        lines({ host: 'api.core.ac.uk', scheme: 'Bearer' }),
        lines({ host: 'api.core.ac.uk', scheme: null })
      ).rows['VF-02'].onlyAfter
    ).toEqual(['api.core.ac.uk|none'])
    expect(
      compare(
        lines({ host: 'api.core.ac.uk', scheme: 'Bearer' }),
        lines({ host: 'api.core.ac.uk', scheme: 'Basic' })
      ).rc
    ).toBe(1)
    // an extract never carries the credential itself: a line with anything but
    // host and scheme is refused
    const token = compare(
      lines({ host: 'api.core.ac.uk', scheme: 'Bearer' }),
      lines({
        host: 'api.core.ac.uk',
        scheme: 'Bearer',
        authorization: 'Bearer abcdef',
      })
    )
    expect(token.rc).toBe(2)
    expect(token.error).toMatch(/only host and scheme/)
    expect(
      compare(
        lines({ host: 'api.core.ac.uk', scheme: 'Bearer abcdef' }),
        lines({ host: 'api.core.ac.uk', scheme: 'Bearer' })
      ).error
    ).toMatch(/scheme word only/)
    // an empty extract is no evidence
    expect(
      compare('', lines({ host: 'api.core.ac.uk', scheme: 'Bearer' })).rows[
        'VF-02'
      ].status
    ).toBe('unavailable')
  })
})
