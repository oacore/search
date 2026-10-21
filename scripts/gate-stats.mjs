#!/usr/bin/env node
// gate-stats.mjs - statistics core of the gates (55 C1, C6-NI, C6-prod; 40 §10). Shipped at 2.1 with its
// known-answer tests (T-012 c7); the C6-NI export loader, size check and C6-prod/C6-CI evaluators are
// added at 2.5 and 2.7 on top of these functions. Node built-ins only.
//
// Usage:
//   node scripts/gate-stats.mjs --self-test [--json]       known answers (exit 1 on a mismatch)
//   node scripts/gate-stats.mjs cp --x 59 --n 59           Clopper-Pearson one-sided 95% lower bound (C1 L)
//   node scripts/gate-stats.mjs binom --x0 .. --n0 .. --x1 .. --n1 .. [--m 1.05]   exact conditional binomial p
//   node scripts/gate-stats.mjs power --phi 1 --x0 9892 --pre-days 28 --post-days 14 [--m 1.05]
//   node scripts/gate-stats.mjs z --x0 .. --n0 .. --x1 .. --n1 .. [--phi 1] [--ratio 1.25]
//   node scripts/gate-stats.mjs bootstrap --file <series.json> [--seed 1] [--draws 10000] [--m 1.05]
//     series.json = {pre: [{x, n}, ...], post: [{x, n}, ...]} (one entry per day)
//   C6-NI (added at 2.5 on top of the core above; printed only, 55 C6-NI):
//   node scripts/gate-stats.mjs signals --file test/signals/<tag>.json [--post-days 14]
//     loads and validates an export (daily counts and rates, SHA-256 group keys, never message text) and prints
//     per signal its window, x, n, phi and the power of the next window
//   node scripts/gate-stats.mjs ni --pre test/signals/<tag>.json --post test/signals/<tag>.json --signal <name>
//                                  [--m 1.05] [--seed 1] [--draws 10000] [--replicates 10000] [--inner 500]
//     day-level bootstrap U, the size check at the margin with the fitted phi (simulated replicate windows; if the
//     size exceeds 0.025 the simulated critical quantile replaces the 97.5th percentile), the exact conditional
//     binomial p (cross-check) and the power, all printed

import { fileURLToPath } from 'node:url'
import path from 'node:path'
import fs from 'node:fs'

// ---------- special functions ----------
const LANCZOS = [
  676.5203681218851, -1259.1392167224028, 771.32342877765313,
  -176.61502916214059, 12.507343278686905, -0.13857109526572012,
  9.9843695780195716e-6, 1.5056327351493116e-7,
]
export function lgamma(z) {
  if (z < 0.5)
    return Math.log(Math.PI / Math.abs(Math.sin(Math.PI * z))) - lgamma(1 - z)
  z -= 1
  let a = 0.99999999999980993
  const t = z + 7.5
  for (let i = 0; i < 8; i++) a += LANCZOS[i] / (z + i + 1)
  return 0.5 * Math.log(2 * Math.PI) + (z + 0.5) * Math.log(t) - t + Math.log(a)
}

// continued fraction of the regularised incomplete beta (modified Lentz)
function betacf(x, a, b) {
  const MAXIT = 1000
  const EPS = 1e-15
  const FPMIN = 1e-300
  const qab = a + b
  const qap = a + 1
  const qam = a - 1
  let c = 1
  let d = 1 - (qab * x) / qap
  if (Math.abs(d) < FPMIN) d = FPMIN
  d = 1 / d
  let h = d
  for (let m = 1; m <= MAXIT; m++) {
    const m2 = 2 * m
    let aa = (m * (b - m) * x) / ((qam + m2) * (a + m2))
    d = 1 + aa * d
    if (Math.abs(d) < FPMIN) d = FPMIN
    c = 1 + aa / c
    if (Math.abs(c) < FPMIN) c = FPMIN
    d = 1 / d
    h *= d * c
    aa = (-(a + m) * (qab + m) * x) / ((a + m2) * (qap + m2))
    d = 1 + aa * d
    if (Math.abs(d) < FPMIN) d = FPMIN
    c = 1 + aa / c
    if (Math.abs(c) < FPMIN) c = FPMIN
    d = 1 / d
    const del = d * c
    h *= del
    if (Math.abs(del - 1) < EPS) break
  }
  return h
}

export function regIncBeta(x, a, b) {
  if (x <= 0) return 0
  if (x >= 1) return 1
  const bt = Math.exp(
    lgamma(a + b) -
      lgamma(a) -
      lgamma(b) +
      a * Math.log(x) +
      b * Math.log(1 - x)
  )
  if (x < (a + 1) / (a + b + 2)) return (bt * betacf(x, a, b)) / a
  return 1 - (bt * betacf(1 - x, b, a)) / b
}

// inverse of the regularised incomplete beta by bisection (monotone, 200 halvings)
export function betaInv(p, a, b) {
  let lo = 0
  let hi = 1
  for (let i = 0; i < 200; i++) {
    const mid = (lo + hi) / 2
    if (regIncBeta(mid, a, b) < p) lo = mid
    else hi = mid
  }
  return (lo + hi) / 2
}

// complementary error function: Maclaurin series of erf for |x| < 3, Lentz continued fraction above
export function erfc(x) {
  const z = Math.abs(x)
  let r
  if (z < 3) {
    let sum = z
    let term = z
    for (let n = 1; n < 200; n++) {
      term *= (-z * z) / n
      const add = term / (2 * n + 1)
      sum += add
      if (Math.abs(add) < 1e-17 * Math.abs(sum)) break
    }
    r = 1 - (2 / Math.sqrt(Math.PI)) * sum
  } else {
    let f = z
    let C = z
    let D = 0
    for (let n = 1; n < 500; n++) {
      const an = n / 2
      D = z + an * D
      D = D === 0 ? 1e-300 : 1 / D
      C = z + an / C
      const delta = C * D
      f *= delta
      if (Math.abs(delta - 1) < 1e-16) break
    }
    r = Math.exp(-z * z) / (f * Math.sqrt(Math.PI))
  }
  return x >= 0 ? r : 2 - r
}
export const normCdf = (x) => 0.5 * erfc(-x / Math.SQRT2)

// ---------- C1: Clopper-Pearson ----------
// one-sided lower bound L = Beta^-1(alpha; x, n - x + 1); x = n gives alpha^(1/n)
export function clopperPearsonLower(x, n, alpha = 0.05) {
  if (x <= 0) return 0
  if (x === n) return Math.pow(alpha, 1 / n)
  return betaInv(alpha, x, n - x + 1)
}

// ---------- C6-NI: exact conditional binomial ----------
// p = P(X <= x1), X ~ Bin(k, pi0), k = x0 + x1, pi0 = m n1 / (m n1 + n0)
export function binomCdf(x, k, p) {
  if (x >= k) return 1
  if (x < 0) return 0
  const lp = Math.log(p)
  const lq = Math.log1p(-p)
  const lk = lgamma(k + 1)
  let max = -Infinity
  const terms = []
  for (let i = 0; i <= x; i++) {
    const t = lk - lgamma(i + 1) - lgamma(k - i + 1) + i * lp + (k - i) * lq
    terms.push(t)
    if (t > max) max = t
  }
  let s = 0
  for (const t of terms) s += Math.exp(t - max)
  return Math.min(1, Math.exp(max) * s)
}
export function conditionalBinomialP({ x0, n0, x1, n1, m = 1.05 }) {
  const k = x0 + x1
  const pi0 = (m * n1) / (m * n1 + n0)
  const p = binomCdf(x1, k, pi0)
  return { k, pi0, p, nonInferior: p <= 0.025 }
}

// ---------- C6-NI: power ----------
// Phi(ln m / SE - 1.96), SE = sqrt(phi (1/x0 + 1/x1hat)), x1hat = x0 n1 / n0 (n in days of equal units)
export function power({ phi = 1, x0, preDays, postDays, m = 1.05 }) {
  const x1hat = (x0 * postDays) / preDays
  const se = Math.sqrt(phi * (1 / x0 + 1 / x1hat))
  return { x1hat, se, power: normCdf(Math.log(m) / se - 1.96) }
}

// ---------- C6-prod row 1 ----------
// z = (ln r - ln ratio) / sqrt(phi (1/x0 + 1/x1)), r = (x1/n1)/(x0/n0); breach when z > 2.326
export function rateRatioZ({
  x0,
  n0,
  x1,
  n1,
  phi = 1,
  ratio = 1.25,
  crit = 2.326,
}) {
  const r = x1 / n1 / (x0 / n0)
  const z = (Math.log(r) - Math.log(ratio)) / Math.sqrt(phi * (1 / x0 + 1 / x1))
  return { r, z, breach: z > crit }
}

// ---------- C6-NI: day-level bootstrap ----------
// mulberry32: the recorded-seed PRNG of every bootstrap and draw in the gates
export function mulberry32(seed) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
// quantile with linear interpolation between order statistics (type 7)
export function quantile(sorted, q) {
  const h = (sorted.length - 1) * q
  const lo = Math.floor(h)
  const hi = Math.ceil(h)
  return sorted[lo] + (h - lo) * (sorted[hi] - sorted[lo])
}
// U = 97.5th percentile of rate_post / rate_pre over `draws` resamples of whole days
export function bootstrapU({
  pre,
  post,
  draws = 10000,
  seed = 1,
  q = 0.975,
  m = 1.05,
}) {
  const rnd = mulberry32(seed)
  const rate = (days) => {
    let x = 0
    let n = 0
    for (let i = 0; i < days.length; i++) {
      const d = days[Math.floor(rnd() * days.length)]
      x += d.x
      n += d.n
    }
    return x / n
  }
  const ratios = new Float64Array(draws)
  for (let i = 0; i < draws; i++) {
    const rp = rate(pre)
    ratios[i] = rate(post) / rp
  }
  const sorted = Array.from(ratios).sort((a, b) => a - b)
  const U = quantile(sorted, q)
  return { U, nonInferior: U < m, draws, seed }
}

// deterministic synthetic series of the T-012 bootstrap known answer (no randomness in the data)
export function syntheticSeries() {
  const day = (i, base) => ({
    x: base + ((i * 37) % 23),
    n: 10000 + ((i * 101) % 997),
  })
  return {
    pre: Array.from({ length: 28 }, (_, i) => day(i, 350)),
    post: Array.from({ length: 14 }, (_, i) => day(i + 28, 345)),
  }
}

// ---------- C6-NI: signals exports (test/signals/<tag>.json, 55 C6-NI, 42 §7) ----------
// {schema: 1, tag, exportedAt, window: {from, to}, sources: {<source>: {retentionDays, unavailable?: 'VF-nn'}},
//  signals: {<name>: {unit, source, days: [{date, x, n}], unavailable?}}, errorGroups: [{key: <sha256 hex>,
//  days: [{date, count}]}], p95: {<prefix>: [{date, ms}]}, rss: [{date, pod, mib}], restarts: [{date, reason,
//  exitCode, count}], cpuPer1000: [{date, s}], excludedDays: [{date, reason, signedBy}]}
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/
const HEX64 = /^[0-9a-f]{64}$/
export function validateSignals(doc) {
  const problems = []
  if (!doc || doc.schema !== 1) problems.push('schema must be 1')
  if (!doc || typeof doc.tag !== 'string') problems.push('tag missing')
  const sig = (doc && doc.signals) || {}
  for (const [name, v] of Object.entries(sig)) {
    if (v.unavailable) continue
    if (!Array.isArray(v.days) || !v.days.length)
      problems.push(`${name}: no days`)
    for (const d of v.days || []) {
      if (!ISO_DATE.test(d.date)) problems.push(`${name}: bad date ${d.date}`)
      if (
        !(Number.isFinite(d.x) && d.x >= 0 && Number.isFinite(d.n) && d.n > 0)
      )
        problems.push(`${name} ${d.date}: x, n must be numbers (x >= 0, n > 0)`)
    }
    const dates = (v.days || []).map((d) => d.date)
    if (new Set(dates).size !== dates.length)
      problems.push(`${name}: duplicate dates`)
  }
  // error groups carry hashed keys only: message text never enters an export
  for (const g of (doc && doc.errorGroups) || [])
    if (!HEX64.test(String(g.key)))
      problems.push(
        `errorGroups: key ${String(g.key).slice(
          0,
          20
        )} is not a SHA-256 hex digest`
      )
  const text = JSON.stringify(doc || {})
  if (/[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+\.[A-Za-z]{2,}/.test(text))
    problems.push('an e-mail pattern is in the export')
  return problems
}
export function loadSignals(file) {
  const doc = JSON.parse(fs.readFileSync(file, 'utf8'))
  const problems = validateSignals(doc)
  if (problems.length)
    throw new Error(`${file}: ${problems.slice(0, 5).join('; ')}`)
  const excluded = new Set((doc.excludedDays || []).map((d) => d.date))
  const series = {}
  for (const [name, v] of Object.entries(doc.signals || {}))
    series[name] = v.unavailable
      ? { unavailable: v.unavailable }
      : {
          unit: v.unit,
          source: v.source,
          days: v.days
            .filter((d) => !excluded.has(d.date))
            .sort((a, b) => (a.date < b.date ? -1 : 1))
            .map((d) => ({ date: d.date, x: d.x, n: d.n })),
        }
  return { doc, series, excluded: [...excluded].sort() }
}
// phi = variance / mean of the daily counts (sample variance, n - 1)
export function phiOf(days) {
  const xs = days.map((d) => d.x)
  if (xs.length < 2) return 1
  const mean = xs.reduce((a, b) => a + b, 0) / xs.length
  const v = xs.reduce((a, b) => a + (b - mean) ** 2, 0) / (xs.length - 1)
  return mean > 0 ? v / mean : 1
}
// power with units: x1hat = x0 n1 / n0 (55 C6-NI Power)
export function powerUnits({ phi = 1, x0, n0, n1, m = 1.05 }) {
  const x1hat = (x0 * n1) / n0
  const se = Math.sqrt(phi * (1 / x0 + 1 / x1hat))
  return { x1hat, se, power: normCdf(Math.log(m) / se - 1.96) }
}
// seeded samplers for the size simulation: Poisson (Knuth below 30, else a rounded normal with the Poisson
// variance) and Gamma (Marsaglia-Tsang); a quasi-Poisson day count = Poisson(Gamma(mu/(phi-1), phi-1)) when phi > 1
function normal(rnd) {
  let u = 0
  while (u === 0) u = rnd()
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * rnd())
}
function poisson(mu, rnd) {
  if (mu <= 0) return 0
  if (mu < 30) {
    const L = Math.exp(-mu)
    let k = 0
    let p = 1
    do {
      k++
      p *= rnd()
    } while (p > L)
    return k - 1
  }
  return Math.max(0, Math.round(mu + Math.sqrt(mu) * normal(rnd)))
}
function gamma(shape, scale, rnd) {
  if (shape < 1)
    return gamma(shape + 1, scale, rnd) * Math.pow(rnd(), 1 / shape)
  const d = shape - 1 / 3
  const c = 1 / Math.sqrt(9 * d)
  for (;;) {
    let x
    let v
    do {
      x = normal(rnd)
      v = 1 + c * x
    } while (v <= 0)
    v = v * v * v
    const u = rnd()
    if (
      u < 1 - 0.0331 * x ** 4 ||
      Math.log(u) < 0.5 * x * x + d * (1 - v + Math.log(v))
    )
      return d * v * scale
  }
}
const dayCount = (mu, phi, rnd) =>
  phi > 1 ? poisson(gamma(mu / (phi - 1), phi - 1, rnd), rnd) : poisson(mu, rnd)
// the size of the bootstrap test at the margin: replicate windows with the observed day units, pre rate r0 and
// post rate m r0, counts quasi-Poisson with the fitted phi; size = share of replicates declared non-inferior
// (U < m). Inner bootstrap draws per replicate: `inner` (the observed test uses `draws`).
export function sizeCheck({
  pre,
  post,
  m = 1.05,
  phi = 1,
  replicates = 10000,
  inner = 500,
  seed = 1,
  q = 0.975,
}) {
  const rnd = mulberry32(seed)
  const r0 = pre.reduce((a, d) => a + d.x, 0) / pre.reduce((a, d) => a + d.n, 0)
  const qs = [0.975, 0.98, 0.985, 0.99, 0.9925, 0.995, 0.9975, 0.999]
  const below = new Array(qs.length).fill(0)
  const sorted = new Float64Array(inner)
  for (let r = 0; r < replicates; r++) {
    const sp = pre.map((d) => ({ x: dayCount(r0 * d.n, phi, rnd), n: d.n }))
    const so = post.map((d) => ({
      x: dayCount(m * r0 * d.n, phi, rnd),
      n: d.n,
    }))
    for (let i = 0; i < inner; i++) {
      let x0 = 0
      let n0 = 0
      for (let k = 0; k < sp.length; k++) {
        const d = sp[Math.floor(rnd() * sp.length)]
        x0 += d.x
        n0 += d.n
      }
      let x1 = 0
      let n1 = 0
      for (let k = 0; k < so.length; k++) {
        const d = so[Math.floor(rnd() * so.length)]
        x1 += d.x
        n1 += d.n
      }
      sorted[i] = x0 > 0 ? x1 / n1 / (x0 / n0) : Infinity
    }
    sorted.sort()
    qs.forEach((qq, j) => {
      if (quantile(sorted, qq) < m) below[j]++
    })
  }
  const size = below[qs.indexOf(q)] / replicates
  const critical = qs.find((qq, j) => below[j] / replicates <= 0.025) || null
  return {
    size,
    exceeds: size > 0.025,
    criticalQuantile: size > 0.025 ? critical : q,
    sizes: Object.fromEntries(qs.map((qq, j) => [qq, below[j] / replicates])),
    replicates,
    inner,
    seed,
    phi,
  }
}
// the printed C6-NI statement of one signal: bootstrap U, size check, binomial cross-check, power
export function niTest({
  pre,
  post,
  m = 1.05,
  seed = 1,
  draws = 10000,
  replicates = 10000,
  inner = 500,
}) {
  const phi = phiOf(pre)
  const x0 = pre.reduce((a, d) => a + d.x, 0)
  const n0 = pre.reduce((a, d) => a + d.n, 0)
  const x1 = post.reduce((a, d) => a + d.x, 0)
  const n1 = post.reduce((a, d) => a + d.n, 0)
  const boot = bootstrapU({ pre, post, draws, seed, m })
  const size = sizeCheck({
    pre,
    post,
    m,
    phi,
    replicates,
    inner,
    seed: seed + 1,
  })
  let U = boot.U
  let Ucritical = null
  if (size.exceeds && size.criticalQuantile) {
    // the simulated critical quantile replaces the 97.5th percentile (55 C6-NI Size check)
    Ucritical = bootstrapU({
      pre,
      post,
      draws,
      seed,
      m,
      q: size.criticalQuantile,
    }).U
    U = Ucritical
  }
  const binom = conditionalBinomialP({ x0, n0, x1, n1, m })
  const pw = powerUnits({ phi: Math.max(1, phi), x0, n0, n1, m })
  return {
    m,
    x0,
    n0,
    x1,
    n1,
    preDays: pre.length,
    postDays: post.length,
    phi,
    U97_5: boot.U,
    U,
    Ucritical,
    nonInferior: U < m,
    size,
    binomial: { p: binom.p, pi0: binom.pi0, nonInferior: binom.nonInferior },
    power: pw.power,
    informative: pw.power >= 0.8,
    draws,
    seed,
    printedOnly: true,
  }
}
// deterministic synthetic exports of the C6-NI known answers: a pre window of 28 days, a post window of 14
export function syntheticExport(
  tag,
  { days = 28, base = 350, start = '2026-09-01', ratio = 1 } = {}
) {
  const t0 = Date.parse(`${start}T00:00:00Z`)
  return {
    schema: 1,
    tag,
    exportedAt: `${start}T00:00:00Z`,
    window: {
      from: start,
      to: new Date(t0 + (days - 1) * 86400000).toISOString().slice(0, 10),
    },
    sources: { gateway: { retentionDays: 30 } },
    signals: {
      gateway5xx: {
        unit: 'request',
        source: 'gateway',
        days: Array.from({ length: days }, (_, i) => ({
          date: new Date(t0 + i * 86400000).toISOString().slice(0, 10),
          x: Math.round((base + ((i * 37) % 23)) * ratio),
          n: 10000 + ((i * 101) % 997),
        })),
      },
    },
    errorGroups: [
      { key: '0'.repeat(63) + '1', days: [{ date: start, count: 3 }] },
    ],
  }
}

// ---------- known answers (T-012 c7) ----------
export const KNOWN_ANSWERS = [
  {
    id: 'cp-59-59',
    fn: () => clopperPearsonLower(59, 59),
    expect: 0.950492390111773,
    tol: 1e-9,
    note: '55 C1: 0.05^(1/59) = 0.9505',
  },
  {
    id: 'cp-58-58',
    fn: () => clopperPearsonLower(58, 58),
    expect: 0.9496606616695799,
    tol: 1e-9,
    note: '55 C1: 0.9497 at 58',
  },
  {
    id: 'cp-57-59',
    fn: () => clopperPearsonLower(57, 59),
    expect: 0.897110837290046,
    tol: 1e-7,
    note: 'exact binomial tail bisection',
  },
  {
    id: 'cp-50-59',
    fn: () => clopperPearsonLower(50, 59),
    expect: 0.7489027545182299,
    tol: 1e-7,
    note: 'exact binomial tail bisection',
  },
  {
    id: 'binom-c6ni-a',
    fn: () =>
      conditionalBinomialP({
        x0: 1000,
        n0: 100000,
        x1: 900,
        n1: 100000,
        m: 1.05,
      }).p,
    expect: 0.00042657909305371047,
    tol: 1e-9,
    note: '55 C6-NI exact conditional binomial, exact rational sum',
  },
  {
    id: 'binom-c6ni-b',
    fn: () =>
      conditionalBinomialP({
        x0: 1000,
        n0: 100000,
        x1: 1000,
        n1: 100000,
        m: 1.05,
      }).p,
    expect: 0.14260184057442965,
    tol: 1e-8,
    note: 'same, ratio 1.0',
  },
  {
    id: 'binom-c6ni-pi0',
    fn: () =>
      conditionalBinomialP({
        x0: 1000,
        n0: 100000,
        x1: 900,
        n1: 100000,
        m: 1.05,
      }).pi0,
    expect: 0.5121951219512195,
    tol: 1e-12,
    note: 'pi0 = m n1/(m n1 + n0)',
  },
  {
    id: 'power-9892',
    fn: () =>
      power({ phi: 1, x0: 9892, preDays: 28, postDays: 14, m: 1.05 }).power,
    expect: 0.8000077399143981,
    tol: 1e-6,
    note: '55 C6-NI power = 0.80',
  },
  {
    id: 'z-row1',
    fn: () =>
      rateRatioZ({ x0: 800, n0: 400000, x1: 300, n1: 100000, phi: 1 }).z,
    expect: 2.6930678716129157,
    tol: 1e-9,
    note: '55 C6-prod row 1, r = 1.5 > 1.25 at z > 2.326',
  },
  {
    id: 'z-row1-breach',
    fn: () =>
      rateRatioZ({ x0: 800, n0: 400000, x1: 300, n1: 100000, phi: 1 }).breach
        ? 1
        : 0,
    expect: 1,
    tol: 0,
    note: 'breach flag',
  },
  {
    id: 'normcdf-1.96',
    fn: () => normCdf(1.96),
    expect: 0.9750021048517795,
    tol: 1e-12,
    note: 'Phi(1.96)',
  },
  {
    id: 'bootstrap-synthetic',
    fn: () =>
      bootstrapU({ ...syntheticSeries(), draws: 10000, seed: 20261020 }).U,
    expect: null,
    tol: 1e-12,
    note: 'seeded day bootstrap on syntheticSeries(), U pinned in T-012',
  },
]

// C6-NI known answers (2.5); the lead adds them to T-012 (pins of the seeded values below)
export const NI_KNOWN_ANSWERS = [
  {
    id: 'ni-phi',
    fn: () => phiOf([{ x: 10 }, { x: 12 }, { x: 8 }, { x: 10 }]),
    expect: 8 / 30,
    tol: 1e-12,
    note: 'phi = sample variance / mean of 10, 12, 8, 10 = (8/3)/10',
  },
  {
    id: 'ni-power-units',
    fn: () => powerUnits({ phi: 1, x0: 9892, n0: 28, n1: 14, m: 1.05 }).power,
    expect: 0.8000077399143981,
    tol: 1e-9,
    note: 'units form of 55 C6-NI power (x1hat = x0 n1/n0) = the 0.80 row',
  },
  {
    id: 'ni-loader-rejects-text',
    fn: () => {
      const bad = syntheticExport('bad')
      bad.errorGroups = [{ key: 'TypeError: x is undefined', days: [] }]
      return validateSignals(bad).length > 0 ? 1 : 0
    },
    expect: 1,
    tol: 0,
    note: 'an error-group key that is not a SHA-256 digest (message text) is refused',
  },
  {
    id: 'ni-loader-accepts',
    fn: () => validateSignals(syntheticExport('2.0')).length,
    expect: 0,
    tol: 0,
    note: 'a well-formed export validates',
  },
  {
    id: 'ni-size-phi1',
    fn: () => {
      const pre = syntheticExport('pre').signals.gateway5xx.days
      const post = syntheticExport('post', { days: 14, start: '2026-10-01' })
        .signals.gateway5xx.days
      return sizeCheck({
        pre,
        post,
        m: 1.05,
        phi: 1,
        replicates: 2000,
        inner: 400,
        seed: 20261021,
      }).size
    },
    expect: null,
    range: [0, 0.06],
    tol: 0,
    note: 'size at the margin, phi 1, seeded (2,000 replicates x 400 draws): near 0.025; value pinned in T-012',
  },
  {
    id: 'ni-test-equal-windows',
    fn: () => {
      const pre = syntheticExport('pre').signals.gateway5xx.days
      const post = syntheticExport('post', { days: 14, start: '2026-10-01' })
        .signals.gateway5xx.days
      return niTest({
        pre,
        post,
        m: 1.05,
        seed: 20261021,
        draws: 10000,
        replicates: 500,
        inner: 200,
      }).U97_5
    },
    expect: null,
    range: [0.98, 1.05],
    tol: 0,
    note: 'bootstrap U of two windows at ratio ~1: below the margin 1.05; value pinned in T-012',
  },
  {
    id: 'ni-test-worse-window',
    fn: () => {
      const pre = syntheticExport('pre').signals.gateway5xx.days
      const post = syntheticExport('post', {
        days: 14,
        start: '2026-10-01',
        ratio: 1.2,
      }).signals.gateway5xx.days
      return niTest({
        pre,
        post,
        m: 1.05,
        seed: 20261021,
        draws: 10000,
        replicates: 200,
        inner: 200,
      }).nonInferior
        ? 1
        : 0
    },
    expect: 0,
    tol: 0,
    note: 'a post window 20% worse is not non-inferior',
  },
]

export function selfTest(pins = {}) {
  const ni = NI_KNOWN_ANSWERS.map((k) => {
    const got = k.fn()
    const expect = k.expect ?? pins[k.id] ?? null
    const ok =
      expect === null
        ? Number.isFinite(got) &&
          (!k.range || (got >= k.range[0] && got <= k.range[1]))
        : Math.abs(got - expect) <= k.tol
    return { id: k.id, got, expect, ok, note: k.note }
  })
  return [
    ...KNOWN_ANSWERS.map((k) => {
      const got = k.fn()
      const expect = k.expect ?? pins[k.id] ?? null
      const ok =
        expect === null ? Number.isFinite(got) : Math.abs(got - expect) <= k.tol
      return { id: k.id, got, expect, ok, note: k.note }
    }),
    ...ni,
  ]
}

// ---------- CLI ----------
function main(argv) {
  const opt = (n, d) => {
    const i = argv.indexOf(n)
    return i >= 0 ? argv[i + 1] : d
  }
  const num = (n, d) => (opt(n) == null ? d : Number(opt(n)))
  const cmd = argv[0]
  let out
  if (cmd === '--self-test' || argv.includes('--self-test')) {
    const rows = selfTest()
    if (argv.includes('--json')) console.log(JSON.stringify(rows, null, 1))
    else
      for (const r of rows)
        console.log(
          `${r.ok ? 'ok  ' : 'FAIL'} ${r.id} got ${r.got} expect ${r.expect} (${
            r.note
          })`
        )
    process.exit(rows.every((r) => r.ok) ? 0 : 1)
  } else if (cmd === 'cp')
    out = {
      L: clopperPearsonLower(num('--x'), num('--n'), num('--alpha', 0.05)),
    }
  else if (cmd === 'binom')
    out = conditionalBinomialP({
      x0: num('--x0'),
      n0: num('--n0'),
      x1: num('--x1'),
      n1: num('--n1'),
      m: num('--m', 1.05),
    })
  else if (cmd === 'power')
    out = power({
      phi: num('--phi', 1),
      x0: num('--x0'),
      preDays: num('--pre-days'),
      postDays: num('--post-days'),
      m: num('--m', 1.05),
    })
  else if (cmd === 'z')
    out = rateRatioZ({
      x0: num('--x0'),
      n0: num('--n0'),
      x1: num('--x1'),
      n1: num('--n1'),
      phi: num('--phi', 1),
      ratio: num('--ratio', 1.25),
    })
  else if (cmd === 'bootstrap') {
    const series = JSON.parse(fs.readFileSync(opt('--file'), 'utf8'))
    out = bootstrapU({
      ...series,
      seed: num('--seed', 1),
      draws: num('--draws', 10000),
      m: num('--m', 1.05),
    })
  } else if (cmd === 'signals') {
    const { doc, series, excluded } = loadSignals(opt('--file'))
    const postDays = num('--post-days', 14)
    out = {
      tag: doc.tag,
      window: doc.window,
      excludedDays: excluded,
      signals: Object.fromEntries(
        Object.entries(series).map(([name, s]) => {
          if (s.unavailable) return [name, { unavailable: s.unavailable }]
          const x0 = s.days.reduce((a, d) => a + d.x, 0)
          const n0 = s.days.reduce((a, d) => a + d.n, 0)
          const phi = phiOf(s.days)
          const pw = powerUnits({
            phi: Math.max(1, phi),
            x0,
            n0,
            n1: (n0 * postDays) / s.days.length,
          })
          return [
            name,
            {
              days: s.days.length,
              x0,
              n0,
              rate: x0 / n0,
              phi,
              powerNextWindow: pw.power,
              informative: pw.power >= 0.8,
            },
          ]
        })
      ),
    }
  } else if (cmd === 'ni') {
    const pre = loadSignals(opt('--pre')).series[opt('--signal')]
    const post = loadSignals(opt('--post')).series[opt('--signal')]
    if (!pre || !post || pre.unavailable || post.unavailable)
      throw new Error(
        `signal ${opt('--signal')} is missing or unavailable in an export`
      )
    out = niTest({
      pre: pre.days,
      post: post.days,
      m: num('--m', 1.05),
      seed: num('--seed', 1),
      draws: num('--draws', 10000),
      replicates: num('--replicates', 10000),
      inner: num('--inner', 500),
    })
  } else {
    console.error(
      'usage: gate-stats.mjs --self-test | cp | binom | power | z | bootstrap | signals | ni (see header)'
    )
    process.exit(2)
  }
  console.log(JSON.stringify(out))
}

if (fileURLToPath(import.meta.url) === path.resolve(process.argv[1] || ''))
  main(process.argv.slice(2))
