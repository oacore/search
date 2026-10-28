#!/usr/bin/env node
// lint-parity.mjs - lint parity of the installed tools against the frozen new-tool baseline (T-001, 41 §1 A; R-033,
// R-049, R-050; OC-2: lint is red today, the gate is parity, not lint-zero). Since W1 the tools are ESLint 10 (flat
// config eslint.config.js; the rules-of-hooks findings as bulk suppressions in eslint-suppressions.json, CS-LINT-2),
// stylelint 17 (stylelint.config.js; ratchet test/baseline/stylelint-ratchet.json, CS-STY-1) and Prettier 3
// (prettier.config.js, CS-PRET-1). The baseline, test/baseline/t001-lint-w1.json, was taken with them on unchanged
// code and then frozen (41 T-001); the ESLint 7 / stylelint 13 baselines in docs/upgrade/findings/baselines/ were the
// reference until W1 and stay as the source the configs were generated from.
//
// Usage:
//   node scripts/lint-parity.mjs [--json] [--no-control] [--baseline <file>]
//   node scripts/lint-parity.mjs --capture <file>   write the baseline of the current tree (the W1 capture)
//   node scripts/lint-parity.mjs --self-test
//
// What it runs (never --fix, R-049):
//   eslint . --format json                                          (= npm run lint:js)
//   stylelint --ignore-path .gitignore --ignore-path .stylelintignore '**/*.css' --formatter json
//                                                                   (= npm run lint:css, scripts/stylelint-ratchet.mjs)
//   prettier --list-different <the files ESLint and stylelint lint> (the scope that eslint-plugin-prettier and
//                                                                    stylelint-prettier checked before W1)
// Results are reduced to (path, rule, count) with repo-relative paths (ER-28). ESLint messages without a rule count
// as "(unused-directive)" (an unused eslint-disable comment) or "(fatal)" (a parse error).
//
// Checks (exit 1 on any difference):
//   c1 findings    ESLint findings of the application files (everything outside the harness scope) equal the
//                  baseline; a difference passes only as a T-001 row of test/baseline/ACCEPTED-DIFFS.yml (42 §8,
//                  default deny: key `<path> / <rule>`, from and to the counts, 0 = no finding). The bulk
//                  suppressions equal the baseline's and none is stale (ESLint exit 2). stylelint findings equal the
//                  ratchet, and the ratchet equals the baseline less what the format-only commit resolved. Every
//                  file of the lint scope is Prettier-formatted except the baseline's list less the format-only
//                  commit's files. The 38 inline `eslint-disable` directives of the application files are counted.
//   c2 harness     no ESLint finding in the harness scope (test/**, e2e/**, jest.config.js: the `search/test-harness`
//                  block of eslint.config.js, 40 §7 rule 7); the report carries the effective config of harness
//                  files and of an application file, and a control run of the harness files without that block (it
//                  must produce findings: the block is what keeps the harness clean)
//   c3 untouched   no file the linters read changed during the run (R-049); a --fix flag is refused (exit 2)
// Exit codes: 0 parity, 1 difference, 2 tool or usage error.
// ESLint 10 and stylelint 17 need Node >= 20.19: started on an older Node (the static Jest project runs on the
// runtime Node) the script runs itself again on the tooling Node (scripts/lint-node.mjs); the report names both.

import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { createRequire } from 'node:module'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

import { DEFAULT_LEDGER, parseLedger } from './ad-ledger.mjs'
import { reexecOnToolingNode } from './lint-node.mjs'
import * as ratchet from './stylelint-ratchet.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const require = createRequire(path.join(ROOT, 'package.json'))

export const DEFAULT_BASELINE = 'test/baseline/t001-lint-w1.json'
export const SUPPRESSIONS = 'eslint-suppressions.json'
// 41 T-001, 02 (the 38 `eslint-disable` comments): inline directives in the application files
export const INLINE_DISABLES = 38
export const EXPECTED_MAJORS = { eslint: 10, stylelint: 17, prettier: 3 }
export const HARNESS_BLOCK = 'search/test-harness'
// the harness scope: the `search/test-harness` block (files: test/**/*.js, test/**/*.jsx, e2e/**/*.js, jest.config.js)
export const isHarnessPath = (p) =>
  /^(test|e2e)\//.test(p) || p === 'jest.config.js'

// ---------- pure helpers (self-tested) ----------

const realRoot = (() => {
  try {
    return fs.realpathSync(ROOT)
  } catch {
    return ROOT
  }
})()

// ER-28: repo-relative, forward slashes, no leading "./"; a path outside the repository stays absolute
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

const keyOf = (file, rule) => `${file}\u0000${rule}`
const cmp = (a, b) => (a < b ? -1 : a > b ? 1 : 0)
const sortEntries = (map) =>
  [...map.entries()]
    .map(([k, count]) => {
      const [file, rule] = k.split('\u0000')
      return [file, rule, count]
    })
    .sort((a, b) => cmp(a[0], b[0]) || cmp(a[1], b[1]))
const bump = (map, file, rule, n = 1) =>
  map.set(keyOf(file, rule), (map.get(keyOf(file, rule)) || 0) + n)
const sum = (entries) => entries.reduce((a, e) => a + e[2], 0)

// the rule of an ESLint message; messages without one are an unused directive or a parse error
export const ruleOf = (m) => {
  if (m.ruleId) return m.ruleId
  return /eslint-disable|eslint-enable/i.test(m.message || '')
    ? '(unused-directive)'
    : '(fatal)'
}

// ESLint JSON result -> [(path, rule, count)]
export function aggregateEslint(results, roots) {
  const m = new Map()
  for (const r of results)
    for (const msg of r.messages || [])
      bump(m, toRel(r.filePath, roots), ruleOf(msg))
  return sortEntries(m)
}

// eslint-suppressions.json -> [(path, rule, count)]
export function suppressionEntries(json) {
  const m = new Map()
  for (const [file, rules] of Object.entries(json || {}))
    for (const [rule, v] of Object.entries(rules || {}))
      bump(m, file, rule, Number(v && v.count) || 0)
  return sortEntries(m)
}

// compare two entry lists: what is new, what is gone, what changed its count
export function diffEntries(baseline, current) {
  const b = new Map(baseline.map(([f, r, c]) => [keyOf(f, r), c]))
  const c = new Map(current.map(([f, r, n]) => [keyOf(f, r), n]))
  const out = { added: [], removed: [], changed: [] }
  for (const [k, n] of c) {
    const [file, rule] = k.split('\u0000')
    if (!b.has(k)) out.added.push([file, rule, n])
    else if (b.get(k) !== n) out.changed.push([file, rule, b.get(k), n])
  }
  for (const [k, n] of b) {
    const [file, rule] = k.split('\u0000')
    if (!c.has(k)) out.removed.push([file, rule, n])
  }
  return out
}
export const isSame = (d) =>
  !d.added.length && !d.removed.length && !d.changed.length

// entries less the (path, rule, count) a list removes; a removal that the entries do not hold is an error
export function subtractEntries(entries, removed) {
  const m = new Map(entries.map(([f, r, n]) => [keyOf(f, r), n]))
  for (const [f, r, n] of removed) {
    const k = keyOf(f, r)
    if (!m.has(k) || m.get(k) < n)
      throw new Error(`cannot remove ${f} ${r} x${n}: not in the entries`)
    if (m.get(k) === n) m.delete(k)
    else m.set(k, m.get(k) - n)
  }
  return sortEntries(m)
}

// the ledger key of a (path, rule) pair (T-001 rows of test/baseline/ACCEPTED-DIFFS.yml)
export const ledgerKey = (file, rule) => `${file} / ${rule}`

// a diff against the ledger rows: each difference as { key, from, to } (counts as strings, 0 = no finding) is
// accepted only by a T-001 row in force (not withdrawn) whose key, from and to match exactly (42 §8, default deny)
export function applyLedger(diff, rows) {
  const inForce = (Array.isArray(rows) ? rows : []).filter(
    (r) => r && r.test === 'T-001' && !('withdrawn' in r)
  )
  const out = { accepted: [], uncovered: [] }
  const differences = [
    ...diff.added.map(([f, r, n]) => [f, r, 0, n]),
    ...diff.removed.map(([f, r, n]) => [f, r, n, 0]),
    ...diff.changed,
  ]
    .map(([f, r, a, b]) => ({
      key: ledgerKey(f, r),
      from: String(a),
      to: String(b),
    }))
    .sort((x, y) => cmp(x.key, y.key))
  for (const d of differences) {
    const row = inForce.find(
      (r) =>
        r.key === d.key && String(r.from) === d.from && String(r.to) === d.to
    )
    if (row) out.accepted.push({ ...d, ad: row.id })
    else out.uncovered.push(d)
  }
  return out
}

// inline directives in a source text: one record per directive comment, { form, rules }; rules = ["*"] for a
// blanket disable. Comments only (`//` and `/* */`, also inside JSX braces); `--` starts a description
export function scanDisables(text) {
  const out = []
  const re =
    /(?:\/\*\s*eslint-disable(-next-line|-line)?(?![\w-])([\s\S]*?)\*\/)|(?:\/\/\s*eslint-disable(-next-line|-line)?(?![\w-])([^\n]*))/g
  for (const m of text.matchAll(re)) {
    const form = (m[1] || m[3] || '').replace(/^-/, '') || 'block'
    const rest = (m[2] !== undefined ? m[2] : m[4]) || ''
    const rules = rest
      .split(/\s--\s/)[0]
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
    out.push({ form, rules: rules.length ? rules : ['*'] })
  }
  return out
}

// ---------- tools ----------

const cleanEnv = () => {
  const env = { ...process.env, FORCE_COLOR: '0', NO_COLOR: '1' }
  // the linters must not depend on the caller (Jest sets NODE_ENV=test)
  delete env.NODE_ENV
  delete env.BABEL_ENV
  return env
}

const toolVersion = (name) =>
  JSON.parse(
    fs.readFileSync(
      path.join(ROOT, 'node_modules', name, 'package.json'),
      'utf8'
    )
  ).version

const readJson = (file) =>
  JSON.parse(fs.readFileSync(path.resolve(ROOT, file), 'utf8'))

// eslint . --format json; exit 0/1 = findings, 2 = stale suppressions (or a configuration error: no JSON)
function runEslint() {
  const r = spawnSync(
    process.execPath,
    [
      path.join(ROOT, 'node_modules', 'eslint', 'bin', 'eslint.js'),
      '.',
      '--format',
      'json',
    ],
    { cwd: ROOT, encoding: 'utf8', maxBuffer: 1 << 28, env: cleanEnv() }
  )
  if (r.error) throw new Error(`eslint: ${r.error.message}`)
  let results
  try {
    results = JSON.parse(r.stdout)
  } catch {
    throw new Error(
      `eslint exited with ${r.status} and printed no JSON: ${String(
        r.stderr || r.stdout
      ).slice(0, 600)}`
    )
  }
  if (![0, 1, 2].includes(r.status))
    throw new Error(`eslint exited with ${r.status}: ${r.stderr.slice(0, 600)}`)
  return {
    status: r.status,
    results,
    staleSuppressions:
      r.status === 2 && /suppressions left that do not occur/.test(r.stderr),
  }
}

// prettier --list-different over a file list: the files that are not formatted
function runPrettier(files) {
  const r = spawnSync(
    process.execPath,
    [
      path.join(ROOT, 'node_modules', 'prettier', 'bin', 'prettier.cjs'),
      '--list-different',
      ...files,
    ],
    { cwd: ROOT, encoding: 'utf8', maxBuffer: 1 << 26, env: cleanEnv() }
  )
  if (r.error) throw new Error(`prettier: ${r.error.message}`)
  if (![0, 1].includes(r.status))
    throw new Error(
      `prettier exited with ${r.status}: ${r.stderr.slice(0, 600)}`
    )
  return r.stdout
    .split('\n')
    .map((s) => s.trim())
    .filter(Boolean)
    .map((f) => toRel(f))
    .sort()
}

// sha256 over the given files (repo-relative): the files a --fix run could rewrite are the ones with findings
function inputsHash(files) {
  const h = crypto.createHash('sha256')
  const list = [...new Set(files)].sort()
  for (const f of list) {
    h.update(f).update('\0')
    try {
      h.update(fs.readFileSync(path.join(ROOT, f)))
    } catch {
      h.update('(unreadable)')
    }
    h.update('\0')
  }
  return { files: list.length, sha256: h.digest('hex') }
}

const configBlocks = () => require(path.join(ROOT, 'eslint.config.js'))

// the effective configuration of one file, reduced to what the harness block changes (c2)
async function configProbe(eslint, file) {
  const cfg = await eslint.calculateConfigForFile(path.join(ROOT, file))
  const sev = (v) => {
    const s = Array.isArray(v) ? v[0] : v
    return { off: 0, warn: 1, error: 2 }[s] ?? s
  }
  const rules = {}
  for (const r of [
    'import/no-extraneous-dependencies',
    'global-require',
    'import/no-dynamic-require',
    'no-restricted-syntax',
    'no-plusplus',
    'no-bitwise',
    'max-len',
  ])
    rules[r] = cfg.rules && r in cfg.rules ? sev(cfg.rules[r]) : null
  const g = (cfg.languageOptions && cfg.languageOptions.globals) || {}
  return {
    file,
    env: {
      jest: 'describe' in g && 'expect' in g && 'jest' in g,
      node: 'require' in g && 'process' in g && '__dirname' in g,
      browser: 'window' in g && 'document' in g,
    },
    rules,
  }
}

async function harnessEvidence(harnessFiles, appSample) {
  const { ESLint } = require('eslint')
  const blocks = configBlocks()
  const harnessBlocks = blocks.filter((b) => b.name === HARNESS_BLOCK)
  const eslint = new ESLint({ cwd: ROOT })
  const sampleJs = harnessFiles.find(
    (f) => f.startsWith('test/') && f.endsWith('.js')
  )
  const sampleJsx = harnessFiles.find((f) => f.endsWith('.jsx'))
  const probes = []
  for (const f of [sampleJs, sampleJsx, 'jest.config.js', appSample].filter(
    Boolean
  ))
    probes.push(await configProbe(eslint, f))
  let control = null
  if (harnessFiles.length) {
    const eslint0 = new ESLint({
      cwd: ROOT,
      overrideConfigFile: true,
      baseConfig: blocks.filter((b) => b.name !== HARNESS_BLOCK),
    })
    const res = await eslint0.lintFiles(harnessFiles)
    const byRule = {}
    let findings = 0
    for (const r of res)
      for (const m of r.messages) {
        findings += 1
        byRule[ruleOf(m)] = (byRule[ruleOf(m)] || 0) + 1
      }
    control = {
      files: res.length,
      findings,
      rules: Object.fromEntries(
        Object.entries(byRule).sort(([a], [b]) => cmp(a, b))
      ),
    }
  }
  return {
    overridesDeclared: harnessBlocks.map((b) => ({
      name: b.name,
      files: b.files,
    })),
    probes,
    control,
  }
}

// ---------- the run ----------

export async function run(opts = {}) {
  const tools = {
    eslint: toolVersion('eslint'),
    stylelint: toolVersion('stylelint'),
    prettier: toolVersion('prettier'),
    parser: `typescript-eslint ${toolVersion('typescript-eslint')}`,
    plugins: {
      'eslint-plugin-import-x': toolVersion('eslint-plugin-import-x'),
      'eslint-plugin-jsx-a11y': toolVersion('eslint-plugin-jsx-a11y'),
      'eslint-plugin-react': toolVersion('eslint-plugin-react'),
      'eslint-plugin-react-hooks': toolVersion('eslint-plugin-react-hooks'),
      'stylelint-order': toolVersion('stylelint-order'),
      'stylelint-config-css-modules': toolVersion(
        'stylelint-config-css-modules'
      ),
      'stylelint-prettier': toolVersion('stylelint-prettier'),
    },
    // no private org config package is installed any more (CS-LINT-1, CS-PRET-1, CS-STY-1)
    orgConfigs: fs.existsSync(path.join(ROOT, 'node_modules', '@oacore'))
      ? fs
          .readdirSync(path.join(ROOT, 'node_modules', '@oacore'))
          .filter((d) => /config/.test(d))
      : [],
  }
  const major = (v) => Number(String(v).split('.')[0])
  for (const [name, m] of Object.entries(EXPECTED_MAJORS))
    if (major(tools[name]) !== m)
      throw new Error(
        `the baseline is for ${name} ${m}; installed ${tools[name]}`
      )

  const capture = Boolean(opts.capture)
  const baselineFile = opts.baseline || DEFAULT_BASELINE
  const base = capture ? null : readJson(baselineFile)
  const ratchetFile = ratchet.DEFAULT_RATCHET
  const ledgerRows = fs.existsSync(DEFAULT_LEDGER)
    ? parseLedger(fs.readFileSync(DEFAULT_LEDGER, 'utf8'))
    : []

  // c3: a --fix run can only rewrite files that have findings (or that Prettier would reformat)
  const fixable = base
    ? [
        ...base.eslint.entries,
        ...base.stylelint.entries,
        ...base.prettier.unformatted.map((f) => [f]),
      ].map(([f]) => f)
    : []
  const before = inputsHash(fixable)
  const es = runEslint()
  const st = ratchet.runStylelint()
  const linted = es.results.map((r) => toRel(r.filePath)).sort()
  const cssFiles = st.results.map((r) => toRel(r.source)).sort()
  const unformatted = runPrettier([...linted, ...cssFiles])
  const after = inputsHash(fixable)

  const eslintAll = aggregateEslint(es.results)
  const eslintApp = eslintAll.filter(([f]) => !isHarnessPath(f))
  const eslintHarness = eslintAll.filter(([f]) => isHarnessPath(f))
  const stylelintAll = ratchet.aggregate(st.results)
  const suppressions = fs.existsSync(path.join(ROOT, SUPPRESSIONS))
    ? suppressionEntries(readJson(SUPPRESSIONS))
    : []
  const outside = [
    ...eslintAll,
    ...stylelintAll,
    ...unformatted.map((f) => [f]),
  ]
    .map(([f]) => f)
    .filter((f) => path.isAbsolute(f) || f.startsWith('..'))
  const harnessFiles = linted.filter(isHarnessPath)
  const appFiles = linted.filter((f) => !isHarnessPath(f))

  // inline directives of the application files: one per comment; a comment naming n rules adds n entries
  const disables = new Map()
  let disableTotal = 0
  for (const f of appFiles)
    for (const d of scanDisables(fs.readFileSync(path.join(ROOT, f), 'utf8'))) {
      disableTotal += 1
      for (const rule of d.rules) bump(disables, f, rule)
    }
  const harnessDisables = []
  for (const f of harnessFiles)
    for (const d of scanDisables(fs.readFileSync(path.join(ROOT, f), 'utf8')))
      harnessDisables.push([f, d.rules.join(','), d.form])

  const harness = opts.noControl
    ? null
    : await harnessEvidence(
        harnessFiles,
        appFiles.find((f) => f.endsWith('.jsx'))
      )

  const current = {
    eslint: {
      files: linted.length,
      appFiles: appFiles.length,
      harnessFiles: harnessFiles.length,
      status: es.status,
      findings: sum(eslintApp),
      entries: eslintApp,
    },
    suppressions: {
      file: SUPPRESSIONS,
      stale: es.staleSuppressions,
      entries: suppressions,
    },
    stylelint: {
      files: st.results.length,
      status: st.status,
      findings: sum(stylelintAll),
      entries: stylelintAll,
    },
    prettier: { files: linted.length + cssFiles.length, unformatted },
    disables: {
      expected: INLINE_DISABLES,
      total: disableTotal,
      files: new Set(sortEntries(disables).map((e) => e[0])).size,
      entries: sortEntries(disables),
    },
  }
  if (capture)
    return {
      schema: 2,
      node: process.version,
      invokedWith: process.env.LINT_INVOKED_WITH || process.version,
      tools,
      ...current,
      harness: {
        files: harnessFiles.length,
        findings: sum(eslintHarness),
        entries: eslintHarness,
      },
    }

  // what the format-only commit resolved (empty before it lands)
  const fmt = base.formatOnly || {
    commit: null,
    files: [],
    resolved: { stylelint: [] },
  }
  const stylelintExpected = subtractEntries(
    base.stylelint.entries,
    fmt.resolved.stylelint
  )
  const unformattedExpected = base.prettier.unformatted.filter(
    (f) => !fmt.files.includes(f)
  )
  const ratchetFindings = ratchet.readRatchet(ratchetFile).findings
  const eslintDiff = diffEntries(base.eslint.entries, eslintApp)
  const report = {
    schema: 2,
    node: process.version,
    invokedWith: process.env.LINT_INVOKED_WITH || process.version,
    tools,
    baseline: {
      file: baselineFile,
      captured: base.captured,
      eslint: {
        findings: sum(base.eslint.entries),
        entries: base.eslint.entries,
      },
      suppressions: base.suppressions.entries,
      stylelint: {
        findings: sum(base.stylelint.entries),
        entries: base.stylelint.entries,
      },
      prettier: base.prettier.unformatted,
      formatOnly: fmt,
    },
    eslint: {
      ...current.eslint,
      diff: eslintDiff,
      ledger: applyLedger(eslintDiff, ledgerRows),
    },
    suppressions: {
      ...current.suppressions,
      diff: diffEntries(base.suppressions.entries, suppressions),
    },
    stylelint: {
      ...current.stylelint,
      expected: stylelintExpected,
      diff: diffEntries(stylelintExpected, stylelintAll),
      ratchet: {
        file: ratchetFile,
        diff: diffEntries(stylelintExpected, ratchetFindings),
      },
    },
    prettier: { ...current.prettier, expected: unformattedExpected },
    disables: current.disables,
    harness: {
      files: harnessFiles.length,
      list: harnessFiles,
      findings: sum(eslintHarness),
      entries: eslintHarness,
      disables: harnessDisables,
      evidence: harness,
    },
    untouched: { before, after, same: before.sha256 === after.sha256 },
    outside,
  }
  const problems = []
  if (report.eslint.ledger.uncovered.length)
    problems.push('c1 ESLint findings differ from the baseline')
  if (!isSame(report.suppressions.diff))
    problems.push('c1 the bulk suppressions differ from the baseline')
  if (report.suppressions.stale)
    problems.push('c1 a bulk suppression no longer occurs (ESLint exit 2)')
  if (!isSame(report.stylelint.diff))
    problems.push('c1 stylelint findings differ from the baseline')
  if (!isSame(report.stylelint.ratchet.diff))
    problems.push('c1 the stylelint ratchet differs from the baseline')
  if (JSON.stringify(unformatted) !== JSON.stringify(unformattedExpected))
    problems.push('c1 the Prettier-unformatted files differ from the baseline')
  if (report.disables.total !== INLINE_DISABLES)
    problems.push(
      `c1 ${report.disables.total} inline eslint-disable directives, expected ${INLINE_DISABLES}`
    )
  if (report.harness.findings)
    problems.push('c2 ESLint findings in the harness scope')
  if (harness && harness.control && !harness.control.findings)
    problems.push(
      'c2 the harness files are clean without the harness block: it is not load-bearing'
    )
  if (!report.untouched.same)
    problems.push('c3 a linted file changed during the run (R-049)')
  if (outside.length) problems.push('a reported path is outside the repository')
  report.problems = problems
  report.parity = problems.length === 0
  return report
}

function printText(r) {
  const line = (s = '') => process.stdout.write(`${s}\n`)
  line(
    `lint parity: ESLint ${r.tools.eslint}, stylelint ${r.tools.stylelint}, Prettier ${r.tools.prettier}, node ${r.node}`
  )
  line(
    `  ESLint (application files): ${r.eslint.findings} findings (baseline ${r.baseline.eslint.findings}) in ${r.eslint.appFiles} files; ${sum(
      r.suppressions.entries
    )} bulk-suppressed`
  )
  line(
    `  stylelint: ${r.stylelint.findings} findings (baseline ${r.baseline.stylelint.findings}, after the format-only commit ${sum(
      r.stylelint.expected
    )}) in ${r.stylelint.files} files`
  )
  line(
    `  Prettier: ${r.prettier.unformatted.length} of ${r.prettier.files} files not formatted (expected ${r.prettier.expected.length})`
  )
  line(
    `  inline eslint-disable directives (application files): ${r.disables.total} in ${r.disables.files} files (expected ${r.disables.expected})`
  )
  line(
    `  harness scope: ${r.harness.files} files, ${r.harness.findings} findings${
      r.harness.evidence && r.harness.evidence.control
        ? `; without the harness block ${r.harness.evidence.control.findings} findings`
        : ''
    }`
  )
  const ad = (f, rule) => {
    const a = r.eslint.ledger.accepted.find((x) => x.key === ledgerKey(f, rule))
    return a ? `; accepted by ${a.ad}` : ''
  }
  for (const [name, d] of [
    ['ESLint', r.eslint.diff],
    ['suppressions', r.suppressions.diff],
    ['stylelint', r.stylelint.diff],
    ['ratchet', r.stylelint.ratchet.diff],
  ]) {
    for (const [f, rule, n] of d.added)
      line(`  + ${name} ${f} ${rule} x${n} (not in the baseline${ad(f, rule)})`)
    for (const [f, rule, n] of d.removed)
      line(`  - ${name} ${f} ${rule} x${n} (gone${ad(f, rule)})`)
    for (const [f, rule, a, b] of d.changed)
      line(`  ~ ${name} ${f} ${rule} ${a} -> ${b}${ad(f, rule)}`)
  }
  for (const f of r.prettier.unformatted.filter(
    (x) => !r.prettier.expected.includes(x)
  ))
    line(`  + Prettier ${f} (not formatted)`)
  for (const f of r.prettier.expected.filter(
    (x) => !r.prettier.unformatted.includes(x)
  ))
    line(`  - Prettier ${f} (formatted now)`)
  for (const [f, rule, n] of r.harness.entries)
    line(`  ! harness ${f} ${rule} x${n}`)
  for (const p of r.problems) line(`  FAIL ${p}`)
  line(r.parity ? 'lint parity: OK' : 'lint parity: DIFFERENT')
}

// ---------- self-test ----------

function selfTest() {
  const results = []
  const ok = (name, cond) => {
    results.push([name, !!cond])
  }
  const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b)

  // ER-28: absolute, relative, real path, Windows separators, file URL
  ok('toRel absolute', toRel('/repo/a/b.js', ['/repo']) === 'a/b.js')
  ok(
    'toRel real path form',
    toRel('/real/repo/a.js', ['/link/repo', '/real/repo']) === 'a.js'
  )
  ok('toRel already relative', toRel('a/b.js', ['/repo']) === 'a/b.js')
  ok('toRel dot slash', toRel('./a/b.js', ['/repo']) === 'a/b.js')
  ok('toRel backslashes', toRel('C:\\repo\\a\\b.js', ['C:/repo']) === 'a/b.js')
  ok('toRel file url', toRel('file:///repo/a.js', ['/repo']) === 'a.js')
  ok(
    'toRel outside stays absolute',
    toRel('/other/a.js', ['/repo']) === '/other/a.js'
  )
  ok(
    'toRel prefix is a path element',
    toRel('/repository/a.js', ['/repo']) === '/repository/a.js'
  )

  const eres = [
    {
      filePath: '/repo/a.js',
      messages: [
        { ruleId: 'x' },
        { ruleId: 'x' },
        { ruleId: 'y' },
        {
          ruleId: null,
          message:
            "Unused eslint-disable directive (no problems were reported from 'x').",
        },
      ],
    },
    {
      filePath: 'b.js',
      messages: [{ ruleId: null, message: 'Parsing error: Unexpected token' }],
    },
    { filePath: 'c.js', messages: [] },
  ]
  ok(
    'aggregateEslint',
    eq(aggregateEslint(eres, ['/repo']), [
      ['a.js', '(unused-directive)', 1],
      ['a.js', 'x', 2],
      ['a.js', 'y', 1],
      ['b.js', '(fatal)', 1],
    ])
  )
  ok(
    'suppressionEntries',
    eq(
      suppressionEntries({
        'p/a.jsx': { 'react-hooks/rules-of-hooks': { count: 2 } },
        'm/b.jsx': { 'react-hooks/rules-of-hooks': { count: 1 } },
      }),
      [
        ['m/b.jsx', 'react-hooks/rules-of-hooks', 1],
        ['p/a.jsx', 'react-hooks/rules-of-hooks', 2],
      ]
    )
  )

  const base = [
    ['a.js', 'x', 2],
    ['b.js', 'y', 1],
  ]
  ok(
    'diff equal',
    isSame(
      diffEntries(
        base,
        base.map((e) => [...e])
      )
    )
  )
  ok(
    'diff added',
    eq(diffEntries(base, [...base, ['c.js', 'z', 1]]).added, [['c.js', 'z', 1]])
  )
  ok(
    'diff removed',
    eq(diffEntries(base, [base[0]]).removed, [['b.js', 'y', 1]])
  )
  ok(
    'diff changed',
    eq(diffEntries(base, [['a.js', 'x', 3], base[1]]).changed, [
      ['a.js', 'x', 2, 3],
    ])
  )
  ok(
    'diff same rule in another file is new',
    !isSame(
      diffEntries(base, [
        ['a.js', 'x', 2],
        ['b.js', 'y', 1],
        ['b.js', 'x', 1],
      ])
    )
  )
  ok(
    'subtract part of a count',
    eq(subtractEntries(base, [['a.js', 'x', 1]]), [
      ['a.js', 'x', 1],
      ['b.js', 'y', 1],
    ])
  )
  ok(
    'subtract a whole entry',
    eq(subtractEntries(base, [['b.js', 'y', 1]]), [['a.js', 'x', 2]])
  )
  let threw = false
  try {
    subtractEntries(base, [['c.js', 'z', 1]])
  } catch {
    threw = true
  }
  ok('subtract refuses what is not there', threw)

  // the ledger (42 §8): exact key, from and to; another test, a withdrawn row or another count is no match
  const row = (id, key, from, to, extra = {}) => ({
    id,
    test: 'T-001',
    key,
    from,
    to,
    ...extra,
  })
  const added = diffEntries(base, [...base, ['c.js', 'z', 1]])
  ok('ledger key', ledgerKey('a/b.js', 'import/x') === 'a/b.js / import/x')
  ok(
    'ledger accepts an exact row',
    eq(applyLedger(added, [row('AD-1', 'c.js / z', '0', '1')]), {
      accepted: [{ key: 'c.js / z', from: '0', to: '1', ad: 'AD-1' }],
      uncovered: [],
    })
  )
  ok(
    'ledger refuses another count, test, key or a withdrawn row',
    eq(
      applyLedger(added, [
        row('AD-1', 'c.js / z', '0', '2'),
        row('AD-2', 'c.js / z', '0', '1', { test: 'T-002' }),
        row('AD-3', 'c.js / y', '0', '1'),
        row('AD-4', 'c.js / z', '0', '1', { withdrawn: 'gone, 2026-10-27' }),
      ]).uncovered,
      [{ key: 'c.js / z', from: '0', to: '1' }]
    )
  )
  ok('ledger with no rows', applyLedger(added, []).uncovered.length === 1)

  const src = [
    '/* eslint-disable max-classes-per-file */',
    'const a = 1 // eslint-disable-line no-console',
    '// eslint-disable-next-line camelcase, no-console -- why',
    '{/* eslint-disable-next-line jsx-a11y/a,jsx-a11y/b */}',
    '/* eslint-disable */',
    "const s = 'eslint-disable no-console'",
    '// not eslint-disable here',
    '// eslint-disabled is not a directive',
  ].join('\n')
  ok(
    'scanDisables',
    eq(scanDisables(src), [
      { form: 'block', rules: ['max-classes-per-file'] },
      { form: 'line', rules: ['no-console'] },
      { form: 'next-line', rules: ['camelcase', 'no-console'] },
      { form: 'next-line', rules: ['jsx-a11y/a', 'jsx-a11y/b'] },
      { form: 'block', rules: ['*'] },
    ])
  )
  ok(
    'harness scope',
    isHarnessPath('test/a.js') &&
      isHarnessPath('e2e/a.js') &&
      isHarnessPath('jest.config.js') &&
      !isHarnessPath('pages/a.jsx') &&
      !isHarnessPath('scripts/a.js') &&
      !isHarnessPath('testing/a.js')
  )

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

// ---------- main ----------

// the exit status is set, not forced: process.exit() right after a large write to a pipe can cut the output
async function main(args) {
  const has = (n) => args.includes(n)
  const opt = (n) => {
    const i = args.indexOf(n)
    return i >= 0 ? args[i + 1] : undefined
  }
  const fixFlag = args.find((a) => a === '--fix' || a.startsWith('--fix-'))
  if (fixFlag) {
    process.stderr.write(
      `lint-parity: ${fixFlag} is refused: the parity check never rewrites sources (R-049)\n`
    )
    return 2
  }
  if (has('--self-test')) return selfTest()
  try {
    if (has('--capture')) {
      const out = await run({ capture: true, noControl: true })
      const file = opt('--capture')
      fs.writeFileSync(
        path.resolve(ROOT, file),
        `${JSON.stringify(out, null, 1)}\n`
      )
      process.stdout.write(`lint-parity: captured ${file}\n`)
      return 0
    }
    const report = await run({
      noControl: has('--no-control'),
      baseline: opt('--baseline'),
    })
    if (has('--json'))
      process.stdout.write(`${JSON.stringify(report, null, 1)}\n`)
    else printText(report)
    return report.parity ? 0 : 1
  } catch (e) {
    process.stderr.write(`lint-parity: ${e.message}\n`)
    return 2
  }
}

const isMain =
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
if (isMain) {
  const args = process.argv.slice(2)
  const fixFlag = args.find((a) => a === '--fix' || a.startsWith('--fix-'))
  const code =
    fixFlag || args.includes('--self-test')
      ? null
      : reexecOnToolingNode(import.meta.url, args)
  process.exitCode = code === null ? await main(args) : code
}
