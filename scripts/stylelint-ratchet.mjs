#!/usr/bin/env node
// stylelint-ratchet.mjs - the stylelint findings ratchet (CS-STY-1; R-049, R-050). stylelint has no bulk
// suppressions, so its findings on the existing CSS are a committed multiset of (path, rule, count) that may only
// shrink: test/baseline/stylelint-ratchet.json, frozen from the first stylelint 17 run on unchanged code.
//
// Usage:
//   node scripts/stylelint-ratchet.mjs [--json] [--ratchet <file>]
//   node scripts/stylelint-ratchet.mjs --prune [--ratchet <file>]
//   node scripts/stylelint-ratchet.mjs --self-test
//
// It runs the command of `npm run lint:css` with the JSON formatter (never --fix):
//   stylelint --ignore-path .gitignore '**/*.css' --formatter json
// reduces the result to (path, rule, count) with repo-relative paths (parse errors, invalid options and
// deprecations count as findings) and compares it with the ratchet.
// Exit codes: 0 equal; 1 a finding above the ratchet (a new (path, rule) or a higher count; wins over stale);
// 2 stale: a count went down or a (path, rule) is gone, and --prune lowers the ratchet to the run (it never raises
// it, and refuses while anything is above); 3 tool or usage error.
// stylelint 17 needs Node >= 20.19: on an older Node the script runs itself again on the tooling Node
// (scripts/lint-node.mjs).

import fs from 'node:fs'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

import { reexecOnToolingNode } from './lint-node.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
export const DEFAULT_RATCHET = 'test/baseline/stylelint-ratchet.json'
export const STYLELINT_ARGS = [
  '--ignore-path',
  '.gitignore',
  '**/*.css',
  '--formatter',
  'json',
]

const realRoot = (() => {
  try {
    return fs.realpathSync(ROOT)
  } catch {
    return ROOT
  }
})()

// repo-relative, forward slashes; a path outside the repository stays absolute
export function toRel(p, roots = [ROOT, realRoot]) {
  let s = String(p).replace(/\\/g, '/')
  if (s.startsWith('file://')) s = decodeURI(s.slice('file://'.length))
  for (const r of roots) {
    const root = r.replace(/\\/g, '/').replace(/\/+$/, '')
    if (s === root) return '.'
    if (s.startsWith(`${root}/`)) return s.slice(root.length + 1)
  }
  return s.replace(/^\.\//, '')
}

const cmp = (a, b) => (a < b ? -1 : a > b ? 1 : 0)
const sortEntries = (entries) =>
  [...entries].sort((x, y) => cmp(x[0], y[0]) || cmp(x[1], y[1]))

// stylelint JSON result -> [(path, rule, count)]
export function aggregate(results, roots) {
  const m = new Map()
  const bump = (file, rule, n = 1) => {
    const k = `${file}\u0000${rule}`
    m.set(k, (m.get(k) || 0) + n)
  }
  for (const r of results) {
    const file = toRel(r.source, roots)
    for (const w of r.warnings || []) bump(file, w.rule || '(unknown)')
    for (const w of r.parseErrors || []) bump(file, w.rule || '(parse-error)')
    if ((r.invalidOptionWarnings || []).length)
      bump(file, '(invalid-option)', r.invalidOptionWarnings.length)
    if ((r.deprecations || []).length)
      bump(file, '(deprecation)', r.deprecations.length)
  }
  return sortEntries(
    [...m].map(([k, n]) => {
      const [file, rule] = k.split('\u0000')
      return [file, rule, n]
    })
  )
}

// run against ratchet: above = new or higher; stale = gone or lower
export function compare(ratchet, current) {
  const a = new Map(ratchet.map(([f, r, n]) => [`${f}\u0000${r}`, n]))
  const b = new Map(current.map(([f, r, n]) => [`${f}\u0000${r}`, n]))
  const above = []
  const stale = []
  for (const [k, n] of b) {
    const [f, r] = k.split('\u0000')
    if (!a.has(k)) above.push([f, r, 0, n])
    else if (n > a.get(k)) above.push([f, r, a.get(k), n])
    else if (n < a.get(k)) stale.push([f, r, a.get(k), n])
  }
  for (const [k, n] of a) {
    const [f, r] = k.split('\u0000')
    if (!b.has(k)) stale.push([f, r, n, 0])
  }
  return { above: sortEntries(above), stale: sortEntries(stale) }
}

export const exitCodeOf = ({ above, stale }) => {
  if (above.length) return 1
  return stale.length ? 2 : 0
}

// the stylelint results of the tree (stylelint 17 writes its report to stderr when a rule fails)
export function runStylelint() {
  const bin = path.join(
    ROOT,
    'node_modules',
    'stylelint',
    'bin',
    'stylelint.mjs'
  )
  const env = { ...process.env, FORCE_COLOR: '0', NO_COLOR: '1' }
  delete env.NODE_ENV
  const r = spawnSync(process.execPath, [bin, ...STYLELINT_ARGS], {
    cwd: ROOT,
    encoding: 'utf8',
    maxBuffer: 1 << 28,
    env,
  })
  if (r.error) throw new Error(`stylelint: ${r.error.message}`)
  if (![0, 2].includes(r.status))
    throw new Error(
      `stylelint exited with ${r.status}: ${String(r.stderr || r.stdout).slice(
        0,
        600
      )}`
    )
  const text = [r.stdout, r.stderr].find((s) => /^\s*\[/.test(s || ''))
  if (!text)
    throw new Error(
      `stylelint printed no JSON: ${String(r.stderr || r.stdout).slice(0, 300)}`
    )
  return { status: r.status, results: JSON.parse(text) }
}

export const readRatchet = (file = DEFAULT_RATCHET) =>
  JSON.parse(fs.readFileSync(path.resolve(ROOT, file), 'utf8'))

export const stylelintVersion = () =>
  JSON.parse(
    fs.readFileSync(
      path.join(ROOT, 'node_modules', 'stylelint', 'package.json'),
      'utf8'
    )
  ).version

export function check({ ratchetFile = DEFAULT_RATCHET } = {}) {
  const ratchet = readRatchet(ratchetFile)
  const run = runStylelint()
  const current = aggregate(run.results)
  const diff = compare(ratchet.findings, current)
  return {
    ratchet: ratchetFile,
    tool: { stylelint: stylelintVersion(), node: process.version },
    status: run.status,
    files: run.results.length,
    findings: current.reduce((n, e) => n + e[2], 0),
    entries: current,
    ...diff,
    exit: exitCodeOf(diff),
  }
}

function selfTest() {
  const results = []
  const ok = (name, cond) => results.push([name, !!cond])
  const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b)
  const res = [
    {
      source: '/repo/a.css',
      warnings: [{ rule: 'x' }, { rule: 'x' }, { rule: 'y' }],
      parseErrors: [],
      invalidOptionWarnings: [{}],
      deprecations: [],
    },
    { source: 'b.css', warnings: [], parseErrors: [{}], deprecations: [{}] },
  ]
  ok(
    'aggregate',
    eq(aggregate(res, ['/repo']), [
      ['a.css', '(invalid-option)', 1],
      ['a.css', 'x', 2],
      ['a.css', 'y', 1],
      ['b.css', '(deprecation)', 1],
      ['b.css', '(parse-error)', 1],
    ])
  )
  const base = [
    ['a.css', 'x', 2],
    ['b.css', 'y', 1],
  ]
  ok('equal', exitCodeOf(compare(base, base)) === 0)
  ok(
    'new key is above',
    eq(compare(base, [...base, ['c.css', 'z', 1]]).above, [
      ['c.css', 'z', 0, 1],
    ])
  )
  ok(
    'higher count is above',
    exitCodeOf(compare(base, [['a.css', 'x', 3], base[1]])) === 1
  )
  ok(
    'lower count is stale',
    eq(compare(base, [['a.css', 'x', 1], base[1]]), {
      above: [],
      stale: [['a.css', 'x', 2, 1]],
    })
  )
  ok('gone key is stale', exitCodeOf(compare(base, [base[0]])) === 2)
  ok(
    'above wins over stale',
    exitCodeOf(compare(base, [['a.css', 'x', 3]])) === 1
  )
  ok('relative path', toRel('/repo/m/a.css', ['/repo']) === 'm/a.css')
  let failed = 0
  for (const [name, pass] of results) {
    process.stdout.write(`${pass ? 'ok  ' : 'FAIL'} ${name}\n`)
    if (!pass) failed += 1
  }
  process.stdout.write(
    `self-test: ${results.length - failed}/${results.length}\n`
  )
  return failed ? 1 : 0
}

function main(args) {
  const has = (n) => args.includes(n)
  const opt = (n) => {
    const i = args.indexOf(n)
    return i >= 0 ? args[i + 1] : undefined
  }
  if (args.some((a) => a === '--fix' || a.startsWith('--fix-'))) {
    process.stderr.write(
      'stylelint-ratchet: --fix is refused: the ratchet never rewrites CSS (R-049)\n'
    )
    return 3
  }
  if (has('--self-test')) return selfTest()
  const ratchetFile = opt('--ratchet') || DEFAULT_RATCHET
  let report
  try {
    report = check({ ratchetFile })
  } catch (e) {
    process.stderr.write(`stylelint-ratchet: ${e.message}\n`)
    return 3
  }
  if (has('--prune')) {
    if (report.above.length) {
      process.stderr.write(
        'stylelint-ratchet: findings above the ratchet; --prune only lowers it\n'
      )
      return 1
    }
    const ratchet = readRatchet(ratchetFile)
    ratchet.findings = report.entries
    ratchet.total = report.findings
    fs.writeFileSync(
      path.resolve(ROOT, ratchetFile),
      `${JSON.stringify(ratchet, null, 2)}\n`
    )
    process.stdout.write(
      `stylelint-ratchet: pruned ${report.stale.length} entries; ${report.findings} findings\n`
    )
    return 0
  }
  if (has('--json'))
    process.stdout.write(`${JSON.stringify(report, null, 1)}\n`)
  else {
    process.stdout.write(
      `stylelint ratchet: stylelint ${report.tool.stylelint}, ${report.findings} findings in ${report.files} files\n`
    )
    for (const [f, r, a, b] of report.above)
      process.stdout.write(`  + ${f} ${r} ${a} -> ${b} (above the ratchet)\n`)
    for (const [f, r, a, b] of report.stale)
      process.stdout.write(`  - ${f} ${r} ${a} -> ${b} (stale: --prune)\n`)
    process.stdout.write(
      [
        'stylelint ratchet: OK',
        'stylelint ratchet: ABOVE',
        'stylelint ratchet: STALE',
      ][report.exit] + '\n'
    )
  }
  return report.exit
}

const isMain =
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
if (isMain) {
  const code = reexecOnToolingNode(import.meta.url, process.argv.slice(2))
  process.exitCode = code === null ? main(process.argv.slice(2)) : code
}
