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

import { fileURLToPath } from 'node:url'
import path from 'node:path'
import fs from 'node:fs'

// ---------- special functions ----------
const LANCZOS = [676.5203681218851, -1259.1392167224028, 771.32342877765313, -176.61502916214059, 12.507343278686905, -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7]
export function lgamma(z) {
  if (z < 0.5) return Math.log(Math.PI / Math.abs(Math.sin(Math.PI * z))) - lgamma(1 - z)
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
  const bt = Math.exp(lgamma(a + b) - lgamma(a) - lgamma(b) + a * Math.log(x) + b * Math.log(1 - x))
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
export function rateRatioZ({ x0, n0, x1, n1, phi = 1, ratio = 1.25, crit = 2.326 }) {
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
export function bootstrapU({ pre, post, draws = 10000, seed = 1, q = 0.975, m = 1.05 }) {
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
  const day = (i, base) => ({ x: base + ((i * 37) % 23), n: 10000 + ((i * 101) % 997) })
  return { pre: Array.from({ length: 28 }, (_, i) => day(i, 350)), post: Array.from({ length: 14 }, (_, i) => day(i + 28, 345)) }
}

// ---------- known answers (T-012 c7) ----------
export const KNOWN_ANSWERS = [
  { id: 'cp-59-59', fn: () => clopperPearsonLower(59, 59), expect: 0.950492390111773, tol: 1e-9, note: '55 C1: 0.05^(1/59) = 0.9505' },
  { id: 'cp-58-58', fn: () => clopperPearsonLower(58, 58), expect: 0.9496606616695799, tol: 1e-9, note: '55 C1: 0.9497 at 58' },
  { id: 'cp-57-59', fn: () => clopperPearsonLower(57, 59), expect: 0.897110837290046, tol: 1e-7, note: 'exact binomial tail bisection' },
  { id: 'cp-50-59', fn: () => clopperPearsonLower(50, 59), expect: 0.7489027545182299, tol: 1e-7, note: 'exact binomial tail bisection' },
  { id: 'binom-c6ni-a', fn: () => conditionalBinomialP({ x0: 1000, n0: 100000, x1: 900, n1: 100000, m: 1.05 }).p, expect: 0.00042657909305371047, tol: 1e-9, note: '55 C6-NI exact conditional binomial, exact rational sum' },
  { id: 'binom-c6ni-b', fn: () => conditionalBinomialP({ x0: 1000, n0: 100000, x1: 1000, n1: 100000, m: 1.05 }).p, expect: 0.14260184057442965, tol: 1e-8, note: 'same, ratio 1.0' },
  { id: 'binom-c6ni-pi0', fn: () => conditionalBinomialP({ x0: 1000, n0: 100000, x1: 900, n1: 100000, m: 1.05 }).pi0, expect: 0.5121951219512195, tol: 1e-12, note: 'pi0 = m n1/(m n1 + n0)' },
  { id: 'power-9892', fn: () => power({ phi: 1, x0: 9892, preDays: 28, postDays: 14, m: 1.05 }).power, expect: 0.8000077399143981, tol: 1e-6, note: '55 C6-NI power = 0.80' },
  { id: 'z-row1', fn: () => rateRatioZ({ x0: 800, n0: 400000, x1: 300, n1: 100000, phi: 1 }).z, expect: 2.6930678716129157, tol: 1e-9, note: '55 C6-prod row 1, r = 1.5 > 1.25 at z > 2.326' },
  { id: 'z-row1-breach', fn: () => (rateRatioZ({ x0: 800, n0: 400000, x1: 300, n1: 100000, phi: 1 }).breach ? 1 : 0), expect: 1, tol: 0, note: 'breach flag' },
  { id: 'normcdf-1.96', fn: () => normCdf(1.96), expect: 0.9750021048517795, tol: 1e-12, note: 'Phi(1.96)' },
  { id: 'bootstrap-synthetic', fn: () => bootstrapU({ ...syntheticSeries(), draws: 10000, seed: 20261020 }).U, expect: null, tol: 1e-12, note: 'seeded day bootstrap on syntheticSeries(), U pinned in T-012' },
]

export function selfTest(pins = {}) {
  return KNOWN_ANSWERS.map((k) => {
    const got = k.fn()
    const expect = k.expect ?? pins[k.id] ?? null
    const ok = expect === null ? Number.isFinite(got) : Math.abs(got - expect) <= k.tol
    return { id: k.id, got, expect, ok, note: k.note }
  })
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
    else for (const r of rows) console.log(`${r.ok ? 'ok  ' : 'FAIL'} ${r.id} got ${r.got} expect ${r.expect} (${r.note})`)
    process.exit(rows.every((r) => r.ok) ? 0 : 1)
  } else if (cmd === 'cp') out = { L: clopperPearsonLower(num('--x'), num('--n'), num('--alpha', 0.05)) }
  else if (cmd === 'binom') out = conditionalBinomialP({ x0: num('--x0'), n0: num('--n0'), x1: num('--x1'), n1: num('--n1'), m: num('--m', 1.05) })
  else if (cmd === 'power') out = power({ phi: num('--phi', 1), x0: num('--x0'), preDays: num('--pre-days'), postDays: num('--post-days'), m: num('--m', 1.05) })
  else if (cmd === 'z') out = rateRatioZ({ x0: num('--x0'), n0: num('--n0'), x1: num('--x1'), n1: num('--n1'), phi: num('--phi', 1), ratio: num('--ratio', 1.25) })
  else if (cmd === 'bootstrap') {
    const series = JSON.parse(fs.readFileSync(opt('--file'), 'utf8'))
    out = bootstrapU({ ...series, seed: num('--seed', 1), draws: num('--draws', 10000), m: num('--m', 1.05) })
  } else {
    console.error('usage: gate-stats.mjs --self-test | cp | binom | power | z | bootstrap (see header)')
    process.exit(2)
  }
  console.log(JSON.stringify(out))
}

if (fileURLToPath(import.meta.url) === path.resolve(process.argv[1] || '')) main(process.argv.slice(2))
