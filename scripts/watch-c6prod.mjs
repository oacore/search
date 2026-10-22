#!/usr/bin/env node
// watch-c6prod.mjs - the 48 h prod watch of a deployable step (T-903; 01 §4 step 9; 55 C6-prod rows 1-10). It
// evaluates the rows on EXPORTED monitoring data (the shape of `test/signals/<tag>.json`, 55 C6-NI "Export", read
// with gate-stats.mjs: loadSignals, phiOf, rateRatioZ); it reads no monitoring system itself and never contacts
// production. Running it on production data is DEFERRED to the owner (Q-095: the first rollout of a step; the
// exports come from the team's existing monitoring, VF-16). Node built-ins and gate-stats.mjs only.
//
//   node scripts/watch-c6prod.mjs --baseline <export.json> --watch <export.json>
//        [--watch-from YYYY-MM-DD] [--rollout-end <ISO time>]
//        [--rollouts <file>] [--next-major] [--probes <file>] [--n <N> --m <M>] [--row8-uncounted]
//        [--api-log-before <file> --api-log-after <file>]
//        [--json] [--out <file>]
//   node scripts/watch-c6prod.mjs --self-test [--json]
//
// Windows. The watch is the two UTC days starting at --watch-from (default: the watch export's `window.from`;
// without --watch-from the window must be exactly two days = 48 h). With --rollout-end the watch days must not
// include the rollout's own day (rows 1-9 exclude the rollout window: mixed pods answer `_next/data/<buildId>`
// with 404, Q-095). The baseline is the same two weekdays of the previous 4 weeks (8 days) taken from the
// baseline export; an excluded day of the export (`excludedDays`, signed external root cause) is dropped, and a
// row with fewer than 4 baseline days is `unavailable`.
//
// Export fields read (all optional per row; a missing source is `unavailable`, printed, and its risk is caught
// by the C6-CI row named in the output, 55 C6-prod):
//   signals.errorEvents            x error events (Sentry), n page views           row 1 (C6-NI signal (i))
//   signals.logrocketErrorSessions x error sessions, n sessions                    row 1 when (i) is unusable
//   signals.gateway5xx             x SSR 5xx, n requests (gateway)                 row 2
//   restarts [{date, reason, exitCode, count}], podDays [{date, pods}]             row 3
//   p95 {"/search": [{date, ms}], "/works": [...]}                                 row 4
//   signals.gaPageViewsPerSession  x page_view events, n sessions                  row 5
//   errorGroups [{key (SHA-256), inApp, users, days: [{date, count}]}]             row 7
//   cpuPer1000 [{date, s}], replicas [{date, max}]                                 row 9
// Other inputs: --probes {t907: {passed, failed}, liveness: [{at: "0h"|"48h", events, withinMinutes}]} (rows 6,
// 8); --rollouts {rollouts: [{id, x5xx, nextData404}, ... oldest first, the last = this rollout]} (row 10);
// --api-log-before/--api-log-after JSON lines {host, scheme} of API access-log extracts (VF-02, the first
// rollout of W4e and 6.3: Host, Authorization present and scheme; no token value is accepted).
//
// Row logic (55 C6-prod):
//   1, 2   z = (ln r - ln 1.25) / sqrt(phi (1/x0 + 1/x1)) > 2.326 on the pooled 48 h against the pooled 8 baseline
//          days (phi = max(1, variance/mean of the baseline daily counts)), OR both watch days above the highest
//          baseline daily rate: breach; exactly one day above it: triage; a baseline without events: triage
//          when the watch has any, else pass
//   3      0 restarts; with restarts in the baseline export: per day, restarts per pod-day <= the baseline's
//          maximum daily value, and every (reason, exit code) of the watch is in the baseline's set
//   4      pooled p95 (mean of the daily p95) of /search and /works <= 1.10 x baseline
//   5      page_view per session within +-5 % of the baseline's pooled value
//   6      T-907 on prod green (failed 0, passed > 0)
//   7      a group of the watch with no event in any baseline day, inApp, with >= N events or >= M users: breach
//          (N, M owner-set, VF-04; without them the row is `not-set` and lists the candidates)
//   8      liveness probes at 0 h and 48 h: >= 1 event within 10 min each (`pending` until 48 h is recorded)
//   9      CPU-seconds per 1,000 requests <= 1.10 x baseline pooled and replicas < 15 throughout
//   10     rollout window: z of row 1 with x0 = events (5xx + `_next/data` 404) of the last 3 earlier rollouts,
//          n0 = 3, x1 = this rollout, n1 = 1, phi = 1; above their maximum only: triage; with --next-major (T-903:
//          0 5xx in the rollout per Next major) any 5xx is a breach
// Exit: 0 no breach (a `triage` row is triaged within 24 h, 40 §9), 1 a breach: ROLLBACK first (01 §5), 2 input
// error.
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { loadSignals, phiOf, rateRatioZ } from './gate-stats.mjs'

const Z_CRIT = 2.326
const RATIO = 1.25
const LATENCY_FACTOR = 1.1
const CPU_FACTOR = 1.1
const GA_BAND = 0.05
const REPLICA_CAP = 15
const LIVENESS_MINUTES = 10
const MIN_BASELINE_DAYS = 4
// bounds are inclusive; a ratio sitting exactly on a bound must not fail on binary rounding
const EPS = 1e-9
const atMost = (value, bound) => value <= bound * (1 + EPS)

const C6CI = { 3: 'C6-CI row 1', 4: 'C6-CI row 3', 9: 'C6-CI row 7' }

class InputError extends Error {}

// ---------- dates ----------
const DAY = 86400000
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/
const addDays = (iso, k) =>
  new Date(Date.parse(`${iso}T00:00:00Z`) + k * DAY).toISOString().slice(0, 10)
export const watchDates = (from) => [from, addDays(from, 1)]
// the same two weekdays of the previous four weeks
export const baselineDates = (from) =>
  [1, 2, 3, 4].flatMap((w) => [addDays(from, -7 * w), addDays(from, 1 - 7 * w)])

// ---------- small statistics ----------
const sum = (xs) => xs.reduce((a, b) => a + b, 0)
const mean = (xs) => sum(xs) / xs.length
const round = (v, d = 4) => (Number.isFinite(v) ? Number(v.toFixed(d)) : v)

// ---------- export access ----------
function readExport(file, what) {
  let loaded
  try {
    loaded = loadSignals(file)
  } catch (e) {
    throw new InputError(`${what}: ${e.message}`)
  }
  return loaded
}
const daysOf = (series, name, dates) => {
  const s = series[name]
  if (!s || s.unavailable) return null
  const by = new Map(s.days.map((d) => [d.date, d]))
  const days = dates.filter((d) => by.has(d)).map((d) => by.get(d))
  return days
}
// [{date, ...}] list of the doc keyed by date for the dates asked
const listDays = (list, dates) =>
  Array.isArray(list) ? list.filter((e) => dates.includes(e.date)) : null

// ---------- rows ----------
function rateRow(what, name, base, watch, ctx) {
  const b = daysOf(base.series, name, ctx.baselineDates)
  const w = daysOf(watch.series, name, ctx.watchDates)
  if (!b || !w)
    return { status: 'unavailable', what, reason: `signal ${name} missing` }
  if (w.length !== 2)
    return {
      status: 'unavailable',
      what,
      reason: `watch window incomplete (${w.length} of 2 days)`,
    }
  if (b.length < MIN_BASELINE_DAYS)
    return {
      status: 'unavailable',
      what,
      reason: `baseline has ${b.length} of 8 days`,
    }
  const x0 = sum(b.map((d) => d.x))
  const n0 = sum(b.map((d) => d.n))
  const x1 = sum(w.map((d) => d.x))
  const n1 = sum(w.map((d) => d.n))
  const phi = Math.max(1, phiOf(b))
  const maxBase = Math.max(...b.map((d) => d.x / d.n))
  const above = w.filter((d) => d.x / d.n > maxBase).length
  const out = {
    signal: name,
    baselineDays: b.length,
    rateBaselinePer1000: round((x0 / n0) * 1000),
    rateWatchPer1000: round((x1 / n1) * 1000),
    x0,
    n0,
    x1,
    n1,
    phi: round(phi),
    maxBaselineDailyRatePer1000: round(maxBase * 1000),
    daysAboveMax: above,
  }
  let z = null
  let pooled = false
  if (x0 > 0 && x1 > 0) {
    z = rateRatioZ({ x0, n0, x1, n1, phi, ratio: RATIO, crit: Z_CRIT })
    out.ratio = round(z.r)
    out.z = z.z
    pooled = z.breach
  }
  const bothAbove = above === 2
  let status = 'pass'
  let note
  if (pooled || bothAbove) {
    status = 'breach'
    note = pooled
      ? `pooled rate ${round(z.r, 3)} x the baseline, z ${round(
          z.z,
          3
        )} > ${Z_CRIT}`
      : 'both days above the highest baseline daily rate'
    if (pooled && bothAbove) note += '; both days above the baseline maximum'
  } else if (above === 1) {
    status = 'triage'
    note = 'one day above the highest baseline daily rate'
  } else if (x0 === 0 && x1 > 0) {
    status = 'triage'
    note = 'the baseline has no events to compare: any event is above it'
  }
  return { status, what, ...out, ...(note ? { note } : {}) }
}

function row3(base, watch, ctx) {
  const what = 'restarts, OOMKills'
  const w = listDays(watch.doc.restarts, ctx.watchDates)
  if (!w)
    return {
      status: 'unavailable',
      what,
      reason: 'no restarts source',
      coveredBy: C6CI[3],
    }
  const bAll = listDays(base.doc.restarts, ctx.baselineDates)
  const baseEvents = (bAll || []).filter((e) => e.count > 0)
  const pods = (doc, dates) =>
    new Map((listDays(doc.podDays, dates) || []).map((p) => [p.date, p.pods]))
  const perDay = (events, podMap) => {
    const byDay = new Map()
    for (const e of events)
      byDay.set(e.date, (byDay.get(e.date) || 0) + e.count)
    return new Map(
      [...byDay].map(([date, count]) => [date, count / (podMap.get(date) || 1)])
    )
  }
  const watchEvents = w.filter((e) => e.count > 0)
  if (!baseEvents.length) {
    return {
      status: watchEvents.length ? 'breach' : 'pass',
      what,
      baselineHasRestarts: false,
      restarts: sum(watchEvents.map((e) => e.count)),
      ...(watchEvents.length ? { note: 'restarts: 0 allowed' } : {}),
      coveredBy: C6CI[3],
    }
  }
  const baseCap = Math.max(
    ...[...perDay(baseEvents, pods(base.doc, ctx.baselineDates)).values()]
  )
  const set = new Set(baseEvents.map((e) => `${e.reason}/${e.exitCode}`))
  const days = perDay(watchEvents, pods(watch.doc, ctx.watchDates))
  const over = [...days].filter(([, v]) => v > baseCap).map(([d]) => d)
  const unknown = [
    ...new Set(
      watchEvents
        .map((e) => `${e.reason}/${e.exitCode}`)
        .filter((k) => !set.has(k))
    ),
  ]
  const bad = over.length > 0 || unknown.length > 0
  return {
    status: bad ? 'breach' : 'pass',
    what,
    baselineHasRestarts: true,
    capPerPodDay: round(baseCap),
    watchPerPodDay: Object.fromEntries(
      [...days].map(([d, v]) => [d, round(v)])
    ),
    daysOverCap: over,
    newTerminations: unknown,
    coveredBy: C6CI[3],
  }
}

function row4(base, watch, ctx) {
  const what = 'p95 latency /search/*, /works/*'
  if (!base.doc.p95 || !watch.doc.p95)
    return {
      status: 'unavailable',
      what,
      reason: 'no p95 source',
      coveredBy: C6CI[4],
    }
  const prefixes = {}
  let bad = false
  for (const prefix of ['/search', '/works']) {
    const b = listDays(base.doc.p95[prefix], ctx.baselineDates)
    const w = listDays(watch.doc.p95[prefix], ctx.watchDates)
    if (!b || !w || w.length !== 2 || b.length < MIN_BASELINE_DAYS)
      return {
        status: 'unavailable',
        what,
        reason: `p95 of ${prefix} incomplete`,
        coveredBy: C6CI[4],
      }
    const pb = mean(b.map((e) => e.ms))
    const pw = mean(w.map((e) => e.ms))
    prefixes[prefix] = {
      baselineMs: round(pb, 1),
      watchMs: round(pw, 1),
      ratio: round(pw / pb),
    }
    if (!atMost(pw, LATENCY_FACTOR * pb)) bad = true
  }
  return {
    status: bad ? 'breach' : 'pass',
    what,
    limit: LATENCY_FACTOR,
    prefixes,
    coveredBy: C6CI[4],
  }
}

function row5(base, watch, ctx) {
  const what = 'GA page_view per session'
  const b = daysOf(base.series, 'gaPageViewsPerSession', ctx.baselineDates)
  const w = daysOf(watch.series, 'gaPageViewsPerSession', ctx.watchDates)
  if (!b || !w || w.length !== 2 || b.length < MIN_BASELINE_DAYS)
    return {
      status: 'unavailable',
      what,
      reason: 'no GA source or window incomplete',
    }
  const rb = sum(b.map((d) => d.x)) / sum(b.map((d) => d.n))
  const rw = sum(w.map((d) => d.x)) / sum(w.map((d) => d.n))
  const ratio = rw / rb
  return {
    status: atMost(Math.abs(ratio - 1), GA_BAND) ? 'pass' : 'breach',
    what,
    baselinePerSession: round(rb),
    watchPerSession: round(rw),
    ratio: round(ratio),
    band: GA_BAND,
  }
}

function row6(probes) {
  const what = 'T-907 on prod'
  const t = probes && probes.t907
  if (!t) return { status: 'unavailable', what, reason: 'no T-907 result' }
  return {
    status: t.failed === 0 && t.passed > 0 ? 'pass' : 'breach',
    what,
    passed: t.passed,
    failed: t.failed,
  }
}

function row7(base, watch, ctx, opts) {
  const what = 'new error types'
  if (!Array.isArray(watch.doc.errorGroups))
    return { status: 'unavailable', what, reason: 'no error-group export' }
  const seen = new Set(
    (base.doc.errorGroups || [])
      .filter((g) =>
        (g.days || []).some((d) => d.date < ctx.watchDates[0] && d.count > 0)
      )
      .map((g) => g.key)
  )
  const candidates = watch.doc.errorGroups
    .map((g) => ({
      key: g.key,
      inApp: g.inApp === true,
      events: sum(
        (g.days || [])
          .filter((d) => ctx.watchDates.includes(d.date))
          .map((d) => d.count)
      ),
      users: g.users || 0,
    }))
    .filter((g) => g.events > 0 && !seen.has(g.key))
  const appGroups = candidates.filter((g) => g.inApp)
  const out = {
    what,
    newGroups: candidates.length,
    newInAppGroups: appGroups.length,
    logged: candidates.filter((g) => !g.inApp).map((g) => g.key),
  }
  if (opts.row8Uncounted)
    return {
      status: 'not-counted',
      ...out,
      note: 'row 8 has not passed on prod (2.8 exit, owner-signed)',
    }
  if (opts.n == null || opts.m == null)
    return {
      status: 'not-set',
      ...out,
      note: 'N and M are set by the owner (VF-04); the in-app candidates are listed',
      candidates: appGroups,
    }
  const hit = appGroups.filter((g) => g.events >= opts.n || g.users >= opts.m)
  return {
    status: hit.length ? 'breach' : 'pass',
    ...out,
    n: opts.n,
    m: opts.m,
    breaching: hit,
  }
}

function row8(probes) {
  const what = 'telemetry liveness'
  const list = probes && probes.liveness
  if (!Array.isArray(list))
    return { status: 'unavailable', what, reason: 'no liveness probe recorded' }
  const ok = (at) => {
    const p = list.find((e) => e.at === at)
    return p ? p.events >= 1 && p.withinMinutes <= LIVENESS_MINUTES : null
  }
  const at0 = ok('0h')
  const at48 = ok('48h')
  if (at0 === false || at48 === false)
    return { status: 'breach', what, at0, at48 }
  if (at0 === null || at48 === null)
    return { status: 'pending', what, at0, at48 }
  return { status: 'pass', what, at0, at48 }
}

function row9(base, watch, ctx) {
  const what = 'CPU-seconds per 1,000 requests; HPA replicas'
  const out = { what, coveredBy: C6CI[9] }
  const parts = []
  const b = listDays(base.doc.cpuPer1000, ctx.baselineDates)
  const w = listDays(watch.doc.cpuPer1000, ctx.watchDates)
  if (b && w && w.length === 2 && b.length >= MIN_BASELINE_DAYS) {
    const pb = mean(b.map((e) => e.s))
    const pw = mean(w.map((e) => e.s))
    out.cpu = { baseline: round(pb), watch: round(pw), ratio: round(pw / pb) }
    parts.push(atMost(pw, CPU_FACTOR * pb))
  } else out.cpu = 'unavailable'
  const r = listDays(watch.doc.replicas, ctx.watchDates)
  if (r && r.length) {
    out.maxReplicas = Math.max(...r.map((e) => e.max))
    parts.push(out.maxReplicas < REPLICA_CAP)
  } else out.maxReplicas = 'unavailable'
  if (!parts.length)
    return { status: 'unavailable', ...out, reason: 'no CPU or HPA source' }
  return { status: parts.every(Boolean) ? 'pass' : 'breach', ...out }
}

function row10(rollouts, opts) {
  const what = 'rollout window: 5xx and _next/data 404'
  const list = rollouts && rollouts.rollouts
  if (!Array.isArray(list) || !list.length)
    return { status: 'unavailable', what, reason: 'no rollout record' }
  const cur = list[list.length - 1]
  const earlier = list.slice(0, -1).slice(-3)
  const events = (r) => (r.x5xx || 0) + (r.nextData404 || 0)
  const out = {
    what,
    rollout: cur.id,
    x5xx: cur.x5xx || 0,
    nextData404: cur.nextData404 || 0,
    earlierRollouts: earlier.length,
  }
  if (opts.nextMajor && (cur.x5xx || 0) > 0)
    return {
      status: 'breach',
      ...out,
      note: 'a Next major rollout must show 0 5xx',
    }
  if (earlier.length < 3)
    return {
      status: 'unavailable',
      ...out,
      reason: `needs the last 3 recorded rollouts (${earlier.length} recorded)`,
    }
  const x0 = sum(earlier.map(events))
  const x1 = events(cur)
  out.x0 = x0
  out.x1 = x1
  out.maxEarlier = Math.max(...earlier.map(events))
  if (x1 === 0) return { status: 'pass', ...out }
  if (x0 > 0) {
    const z = rateRatioZ({
      x0,
      n0: 3,
      x1,
      n1: 1,
      phi: 1,
      ratio: RATIO,
      crit: Z_CRIT,
    })
    out.ratio = round(z.r)
    out.z = z.z
    if (z.breach)
      return {
        status: 'breach',
        ...out,
        note: `z ${round(z.z, 3)} > ${Z_CRIT}`,
      }
  }
  return x1 > out.maxEarlier
    ? {
        status: 'triage',
        ...out,
        note: 'above the maximum of the last 3 rollouts',
      }
    : { status: 'pass', ...out }
}

// VF-02: the first rollout of W4e and 6.3; API access-log lines from before the merge and from the first new pods
function apiLog(beforeFile, afterFile) {
  const what = 'VF-02 Host/Authorization at the API'
  const read = (file) =>
    fs
      .readFileSync(file, 'utf8')
      .split('\n')
      .filter((l) => l.trim())
      .map((l, i) => {
        let o
        try {
          o = JSON.parse(l)
        } catch {
          throw new InputError(`${file}:${i + 1}: not JSON`)
        }
        const extra = Object.keys(o).filter(
          (k) => !['host', 'scheme'].includes(k)
        )
        if (extra.length)
          throw new InputError(
            `${file}:${
              i + 1
            }: only host and scheme are accepted (got ${extra.join(', ')})`
          )
        if (
          o.scheme != null &&
          !/^[A-Za-z][A-Za-z0-9-]*$/.test(String(o.scheme))
        )
          throw new InputError(
            `${file}:${i + 1}: scheme must be the scheme word only`
          )
        return `${String(o.host).toLowerCase()}|${
          o.scheme == null ? 'none' : o.scheme
        }`
      })
  const before = read(beforeFile)
  const after = read(afterFile)
  if (!before.length || !after.length)
    return {
      status: 'unavailable',
      what,
      reason: 'an access-log extract is empty',
    }
  const sb = new Set(before)
  const sa = new Set(after)
  const onlyBefore = [...sb].filter((k) => !sa.has(k)).sort()
  const onlyAfter = [...sa].filter((k) => !sb.has(k)).sort()
  return {
    status: onlyBefore.length || onlyAfter.length ? 'breach' : 'pass',
    what,
    before: [...sb].sort(),
    after: [...sa].sort(),
    onlyBefore,
    onlyAfter,
    lines: [before.length, after.length],
  }
}

// ---------- evaluation ----------
export function evaluate({
  baseline,
  watch,
  rollouts = null,
  probes = null,
  options = {},
}) {
  const doc = watch.doc
  let from = options.watchFrom
  if (!from) {
    const w = doc.window
    if (!w || !ISO_DATE.test(w.from) || !ISO_DATE.test(w.to))
      throw new InputError('the watch export has no window; pass --watch-from')
    if (addDays(w.from, 1) !== w.to)
      throw new InputError(
        `the watch window must be exactly two days (48 h): ${w.from}..${w.to}; pass --watch-from to pick two days`
      )
    from = w.from
  }
  if (!ISO_DATE.test(from)) throw new InputError(`bad --watch-from ${from}`)
  const ctx = {
    watchDates: watchDates(from),
    baselineDates: baselineDates(from),
  }
  if (options.rolloutEnd) {
    const day = String(options.rolloutEnd).slice(0, 10)
    if (!ISO_DATE.test(day))
      throw new InputError(`bad --rollout-end ${options.rolloutEnd}`)
    if (ctx.watchDates.includes(day))
      throw new InputError(
        `the watch days ${ctx.watchDates.join(
          ', '
        )} include the rollout day ${day}: rows 1-9 exclude the rollout window (Q-095)`
      )
    if (day > from)
      throw new InputError(
        `the rollout ends (${day}) after the watch starts (${from})`
      )
  }
  const rows = {
    1: (() => {
      const sentry = rateRow(
        'error events per 1,000 page views',
        'errorEvents',
        baseline,
        watch,
        ctx
      )
      if (sentry.status !== 'unavailable') return sentry
      const lr = rateRow(
        'error sessions per 1,000 sessions (LogRocket; Sentry unusable)',
        'logrocketErrorSessions',
        baseline,
        watch,
        ctx
      )
      return lr.status === 'unavailable' ? sentry : lr
    })(),
    2: rateRow(
      'SSR 5xx per 1,000 requests',
      'gateway5xx',
      baseline,
      watch,
      ctx
    ),
    3: row3(baseline, watch, ctx),
    4: row4(baseline, watch, ctx),
    5: row5(baseline, watch, ctx),
    6: row6(probes),
    7: row7(baseline, watch, ctx, options),
    8: row8(probes),
    9: row9(baseline, watch, ctx),
    10: row10(rollouts, options),
  }
  if (options.row8Uncounted && rows[1].status !== 'unavailable')
    rows[1] = {
      ...rows[1],
      status: 'not-counted',
      note: 'row 8 has not passed on prod (2.8 exit, owner-signed)',
    }
  const by = (s) =>
    Object.entries(rows)
      .filter(([, r]) => r.status === s)
      .map(([k]) => k)
  if (options.apiLogBefore || options.apiLogAfter) {
    if (!(options.apiLogBefore && options.apiLogAfter))
      throw new InputError('--api-log-before and --api-log-after go together')
    rows['VF-02'] = apiLog(options.apiLogBefore, options.apiLogAfter)
  }
  const breaches = Object.entries(rows)
    .filter(([, r]) => r.status === 'breach')
    .map(([k]) => k)
  return {
    tool: 'watch-c6prod',
    schema: 1,
    watch: { days: ctx.watchDates, hours: 48 },
    baselineDates: ctx.baselineDates,
    baselineDatesFound: ctx.baselineDates.filter((d) =>
      Object.values(baseline.series).some(
        (s) => !s.unavailable && s.days.some((x) => x.date === d)
      )
    ),
    rows,
    summary: {
      breaches,
      triage: by('triage'),
      unavailable: by('unavailable'),
      notSet: by('not-set'),
      pending: by('pending'),
      notCounted: by('not-counted'),
      decision: breaches.length ? 'ROLLBACK' : 'CONTINUE',
    },
  }
}

// ---------- known answers (also run by T-903) ----------
function selfTest() {
  const checks = []
  const ok = (name, cond, detail) =>
    checks.push({ name, ok: Boolean(cond), detail })
  ok(
    'baseline dates: same two weekdays of the previous 4 weeks',
    JSON.stringify(baselineDates('2026-10-21')) ===
      JSON.stringify([
        '2026-10-14',
        '2026-10-15',
        '2026-10-07',
        '2026-10-08',
        '2026-09-30',
        '2026-10-01',
        '2026-09-23',
        '2026-09-24',
      ]),
    baselineDates('2026-10-21')
  )
  const dow = (d) => new Date(`${d}T00:00:00Z`).getUTCDay()
  ok(
    'every baseline day has the weekday of the watch day it stands for',
    baselineDates('2026-10-21').every(
      (d, i) => dow(d) === dow(i % 2 ? '2026-10-22' : '2026-10-21')
    )
  )
  const z = rateRatioZ({
    x0: 800,
    n0: 800000,
    x1: 400,
    n1: 200000,
    phi: 1,
    ratio: 1.25,
    crit: Z_CRIT,
  })
  ok(
    'row 1 z for r = 2 at x0 800, x1 400',
    Math.abs(
      z.z - (Math.log(2) - Math.log(1.25)) / Math.sqrt(1 / 800 + 1 / 400)
    ) < 1e-12 && z.breach,
    z
  )
  return checks
}

// ---------- CLI ----------
function parseArgs(argv) {
  const flags = new Set([
    '--next-major',
    '--row8-uncounted',
    '--json',
    '--self-test',
  ])
  const known = new Set([
    '--baseline',
    '--watch',
    '--watch-from',
    '--rollout-end',
    '--rollouts',
    '--probes',
    '--n',
    '--m',
    '--api-log-before',
    '--api-log-after',
    '--out',
  ])
  const out = {}
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (flags.has(a)) out[a] = true
    else if (known.has(a)) {
      if (i + 1 >= argv.length) throw new InputError(`${a} needs a value`)
      out[a] = argv[++i]
    } else throw new InputError(`unknown argument ${a}`)
  }
  return out
}
const readJson = (file, what) => {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'))
  } catch (e) {
    throw new InputError(`${what}: ${e.message}`)
  }
}

function print(result) {
  const lines = [
    `C6-prod watch ${result.watch.days.join(' + ')} (48 h) against ${
      result.baselineDatesFound.length
    } baseline days`,
  ]
  for (const [k, r] of Object.entries(result.rows))
    lines.push(
      `  row ${String(k).padEnd(5)} ${r.status.padEnd(12)} ${r.what}${
        r.note ? ` - ${r.note}` : ''
      }${r.reason ? ` - ${r.reason}` : ''}${
        r.coveredBy && r.status === 'unavailable'
          ? ` (caught pre-merge by ${r.coveredBy})`
          : ''
      }`
    )
  lines.push(
    result.summary.decision === 'ROLLBACK'
      ? `decision: ROLLBACK first (01 §5): rows ${result.summary.breaches.join(
          ', '
        )}`
      : `decision: CONTINUE${
          result.summary.triage.length
            ? ` (triage within 24 h: rows ${result.summary.triage.join(', ')})`
            : ''
        }`
  )
  return lines.join('\n')
}

function main(argv) {
  const a = parseArgs(argv)
  if (a['--self-test']) {
    const checks = selfTest()
    console.log(
      a['--json']
        ? JSON.stringify(checks, null, 1)
        : checks.map((c) => `${c.ok ? 'ok  ' : 'FAIL'} ${c.name}`).join('\n')
    )
    return checks.every((c) => c.ok) ? 0 : 1
  }
  if (!a['--baseline'] || !a['--watch'])
    throw new InputError(
      'usage: --baseline <export> --watch <export> [options] (see the header)'
    )
  const result = evaluate({
    baseline: readExport(a['--baseline'], 'baseline export'),
    watch: readExport(a['--watch'], 'watch export'),
    rollouts: a['--rollouts'] ? readJson(a['--rollouts'], 'rollouts') : null,
    probes: a['--probes'] ? readJson(a['--probes'], 'probes') : null,
    options: {
      watchFrom: a['--watch-from'],
      rolloutEnd: a['--rollout-end'],
      n: a['--n'] == null ? null : Number(a['--n']),
      m: a['--m'] == null ? null : Number(a['--m']),
      nextMajor: Boolean(a['--next-major']),
      row8Uncounted: Boolean(a['--row8-uncounted']),
      apiLogBefore: a['--api-log-before'],
      apiLogAfter: a['--api-log-after'],
    },
  })
  const text = a['--json'] ? JSON.stringify(result, null, 1) : print(result)
  if (a['--out'])
    fs.writeFileSync(a['--out'], `${JSON.stringify(result, null, 1)}\n`)
  console.log(text)
  return result.summary.decision === 'ROLLBACK' ? 1 : 0
}

if (fileURLToPath(import.meta.url) === path.resolve(process.argv[1] || '')) {
  try {
    process.exit(main(process.argv.slice(2)))
  } catch (e) {
    if (e instanceof InputError) {
      console.error(`watch-c6prod: ${e.message}`)
      process.exit(2)
    }
    throw e
  }
}
