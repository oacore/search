#!/usr/bin/env node
// lint-parity.mjs - lint parity of the installed tools against the frozen baselines (T-001, 41 §1 A; R-049, R-050;
// OC-2: lint is red today, the gate is parity, not lint-zero).
//
// Usage:
//   node scripts/lint-parity.mjs [--json] [--no-control]
//                                [--eslint-baseline <file>] [--stylelint-baseline <file>] [--any-tool-version]
//   node scripts/lint-parity.mjs --self-test
//
//   --json                 print the full report as JSON on stdout (nothing else)
//   --no-control           skip the override control run (ESLint without the .eslintrc.yml overrides, c2)
//   --eslint-baseline f    ESLint JSON result (default docs/upgrade/findings/baselines/eslint-baseline.json)
//   --stylelint-baseline f stylelint JSON result (default docs/upgrade/findings/baselines/stylelint-baseline.json)
//   --any-tool-version     do not require ESLint 7 and stylelint 13 (after W1 pass the new-tool baselines)
//   --self-test            known-answer tests of the normaliser, the aggregation, the comparison and the
//                          inline-disable scanner; runs no linter
//
// What it does (the commands of `npm run lint:js` and `npm run lint:css`, JSON formatter, never --fix, R-049):
//   eslint --ignore-path .gitignore --ext .js,.jsx . --format json
//   stylelint --ignore-path .gitignore '**/*.css' --formatter json
// Both results are reduced to (path, rule, count) with repo-relative paths (ER-28: the tools print absolute paths,
// the baselines are normalised) and compared with the baselines reduced the same way.
//
// Checks (exit 1 on any difference):
//   c1 findings    ESLint findings of the application files (everything outside the harness scope) and all
//                  stylelint findings equal the baselines (13 ESLint + 16 stylelint findings, OC-2); the 38 inline
//                  `eslint-disable` directives of the application files are counted (INLINE_DISABLES)
//   c2 harness     no ESLint finding in the harness scope (test/**, e2e/**, jest.config.js: the .eslintrc.yml
//                  overrides, 40 §7 rule 7); the report carries the effective config of a harness file and of an
//                  application file, and a control run of the harness files with the overrides removed (it must
//                  produce findings: the overrides are what keeps the harness clean)
//   c3 untouched   no file the linters read changed during the run (R-049); a --fix flag is refused (exit 2)
// Exit codes: 0 parity, 1 difference, 2 tool or usage error.
// Node built-ins only, plus the installed ESLint (and its js-yaml) for the c2 evidence; the linters and their
// configs are the ones installed in node_modules.

import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { createRequire } from 'node:module'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const require = createRequire(path.join(ROOT, 'package.json'))

export const DEFAULT_ESLINT_BASELINE =
  'docs/upgrade/findings/baselines/eslint-baseline.json'
export const DEFAULT_STYLELINT_BASELINE =
  'docs/upgrade/findings/baselines/stylelint-baseline.json'
// 41 T-001, 02 (the 38 `eslint-disable` comments): inline directives in the application files
export const INLINE_DISABLES = 38
export const EXPECTED_MAJORS = { eslint: 7, stylelint: 13 }
// the harness scope: .eslintrc.yml overrides (files: test/**/*.js, test/**/*.jsx, e2e/**/*.js, jest.config.js)
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
const sortEntries = (map) =>
  [...map.entries()]
    .map(([k, count]) => {
      const [file, rule] = k.split('\u0000')
      return [file, rule, count]
    })
    .sort(
      (a, b) =>
        (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0) ||
        (a[1] < b[1] ? -1 : a[1] > b[1] ? 1 : 0)
    )
const bump = (map, file, rule, n = 1) =>
  map.set(keyOf(file, rule), (map.get(keyOf(file, rule)) || 0) + n)

// ESLint JSON result -> [(path, rule, count)]; a parse error has no rule: "(fatal)"
export function aggregateEslint(results) {
  const m = new Map()
  for (const r of results)
    for (const msg of r.messages || [])
      bump(m, toRel(r.filePath), msg.ruleId || '(fatal)')
  return sortEntries(m)
}

// stylelint JSON result -> [(path, rule, count)]; parse errors, invalid options and deprecations count too
export function aggregateStylelint(results) {
  const m = new Map()
  for (const r of results) {
    const file = toRel(r.source)
    for (const w of r.warnings || []) bump(m, file, w.rule || '(unknown)')
    for (const w of r.parseErrors || [])
      bump(m, file, w.rule || '(parse-error)')
    const invalid = (r.invalidOptionWarnings || []).length
    const deprecated = (r.deprecations || []).length
    if (invalid) bump(m, file, '(invalid-option)', invalid)
    if (deprecated) bump(m, file, '(deprecation)', deprecated)
  }
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

// inline directives in a source text: one record per directive comment, { form, rules }; rules = ["*"] for a
// blanket disable. Comments only (`//` and `/* */`, also inside JSX braces); `--` starts a description (ESLint 7)
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

function runTool(bin, args, okStatuses) {
  const r = spawnSync(process.execPath, [bin, ...args], {
    cwd: ROOT,
    encoding: 'utf8',
    maxBuffer: 1 << 28,
    env: cleanEnv(),
  })
  if (r.error) throw new Error(`${path.basename(bin)}: ${r.error.message}`)
  if (!okStatuses.includes(r.status)) {
    throw new Error(
      `${path.basename(bin)} exited with ${r.status}: ${String(
        r.stderr || r.stdout
      ).slice(0, 600)}`
    )
  }
  try {
    return JSON.parse(r.stdout)
  } catch (e) {
    throw new Error(
      `${path.basename(bin)} printed no JSON: ${String(
        r.stdout || r.stderr
      ).slice(0, 300)}`
    )
  }
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

const readJson = (file) =>
  JSON.parse(fs.readFileSync(path.resolve(ROOT, file), 'utf8'))

// the effective configuration of one file, reduced to what the overrides change (c2)
async function configProbe(eslint, file) {
  const cfg = await eslint.calculateConfigForFile(path.join(ROOT, file))
  const sev = (v) => (Array.isArray(v) ? v[0] : v)
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
  return {
    file,
    env: {
      jest: !!(cfg.env && cfg.env.jest),
      node: !!(cfg.env && cfg.env.node),
      browser: !!(cfg.env && cfg.env.browser),
    },
    rules,
  }
}

async function harnessEvidence(harnessFiles, appSample) {
  const { ESLint } = require('eslint')
  const yaml = require('js-yaml')
  const cfgFile = path.join(ROOT, '.eslintrc.yml')
  const full = yaml.load(fs.readFileSync(cfgFile, 'utf8'))
  const { overrides, ...withoutOverrides } = full
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
      useEslintrc: false,
      baseConfig: withoutOverrides,
      resolvePluginsRelativeTo: ROOT,
    })
    const res = await eslint0.lintFiles(harnessFiles)
    const byRule = {}
    let findings = 0
    for (const r of res)
      for (const m of r.messages) {
        findings += 1
        byRule[m.ruleId || '(fatal)'] = (byRule[m.ruleId || '(fatal)'] || 0) + 1
      }
    control = {
      files: res.length,
      findings,
      rules: Object.fromEntries(
        Object.entries(byRule).sort(([a], [b]) => (a < b ? -1 : 1))
      ),
    }
  }
  return {
    overridesDeclared: (overrides || []).map((o) => ({ files: o.files })),
    probes,
    control,
  }
}

// ---------- the run ----------

export async function run(opts) {
  const eslintVersion = toolVersion('eslint')
  const stylelintVersion = toolVersion('stylelint')
  const tools = {
    eslint: eslintVersion,
    stylelint: stylelintVersion,
    configs: {
      '@oacore/eslint-config-react': toolVersion('@oacore/eslint-config-react'),
      '@oacore/stylelint-config-base': toolVersion(
        '@oacore/stylelint-config-base'
      ),
    },
  }
  const toolsAsPlanned =
    Number(eslintVersion.split('.')[0]) === EXPECTED_MAJORS.eslint &&
    Number(stylelintVersion.split('.')[0]) === EXPECTED_MAJORS.stylelint
  if (!toolsAsPlanned && !opts.anyToolVersion)
    throw new Error(
      `the baselines are for ESLint ${EXPECTED_MAJORS.eslint} and stylelint ${EXPECTED_MAJORS.stylelint}; installed ${eslintVersion} and ${stylelintVersion} (pass --any-tool-version with the new-tool baselines)`
    )

  const eslintBaselineFile = opts.eslintBaseline || DEFAULT_ESLINT_BASELINE
  const stylelintBaselineFile =
    opts.stylelintBaseline || DEFAULT_STYLELINT_BASELINE
  const eslintBase = aggregateEslint(readJson(eslintBaselineFile))
  const stylelintBase = aggregateStylelint(readJson(stylelintBaselineFile))
  // c3: a --fix run can only rewrite files that have findings
  const fixable = [...eslintBase, ...stylelintBase].map(([f]) => f)

  const before = inputsHash(fixable)
  const eslintResults = runTool(
    path.join(ROOT, 'node_modules', 'eslint', 'bin', 'eslint.js'),
    [
      '--ignore-path',
      '.gitignore',
      '--ext',
      '.js,.jsx',
      '.',
      '--format',
      'json',
    ],
    [0, 1]
  )
  const stylelintResults = runTool(
    path.join(ROOT, 'node_modules', 'stylelint', 'bin', 'stylelint.js'),
    ['--ignore-path', '.gitignore', '**/*.css', '--formatter', 'json'],
    [0, 2]
  )
  const after = inputsHash(fixable)

  const eslintAll = aggregateEslint(eslintResults)
  const eslintApp = eslintAll.filter(([f]) => !isHarnessPath(f))
  const eslintHarness = eslintAll.filter(([f]) => isHarnessPath(f))
  const stylelintAll = aggregateStylelint(stylelintResults)
  const outside = [...eslintAll, ...stylelintAll]
    .map(([f]) => f)
    .filter((f) => path.isAbsolute(f) || f.startsWith('..'))

  const linted = eslintResults.map((r) => toRel(r.filePath)).sort()
  const harnessFiles = linted.filter(isHarnessPath)
  const appFiles = linted.filter((f) => !isHarnessPath(f))

  // inline directives of the application files: one per comment; a comment naming n rules adds n entries
  const disables = new Map()
  let disableTotal = 0
  for (const f of appFiles) {
    for (const d of scanDisables(fs.readFileSync(path.join(ROOT, f), 'utf8'))) {
      disableTotal += 1
      for (const rule of d.rules) bump(disables, f, rule)
    }
  }
  const harnessDisables = []
  for (const f of harnessFiles)
    for (const d of scanDisables(fs.readFileSync(path.join(ROOT, f), 'utf8')))
      harnessDisables.push([f, d.rules.join(','), d.form])

  let harness = null
  if (!opts.noControl)
    harness = await harnessEvidence(
      harnessFiles,
      appFiles.find((f) => f.endsWith('.jsx'))
    )

  const report = {
    schema: 1,
    node: process.version,
    tools,
    baselines: {
      eslint: {
        file: eslintBaselineFile,
        findings: eslintBase.reduce((a, e) => a + e[2], 0),
        entries: eslintBase,
      },
      stylelint: {
        file: stylelintBaselineFile,
        findings: stylelintBase.reduce((a, e) => a + e[2], 0),
        entries: stylelintBase,
      },
    },
    eslint: {
      files: linted.length,
      appFiles: appFiles.length,
      harnessFiles: harnessFiles.length,
      findings: eslintApp.reduce((a, e) => a + e[2], 0),
      entries: eslintApp,
      diff: diffEntries(eslintBase, eslintApp),
    },
    stylelint: {
      files: stylelintResults.length,
      findings: stylelintAll.reduce((a, e) => a + e[2], 0),
      entries: stylelintAll,
      diff: diffEntries(stylelintBase, stylelintAll),
    },
    disables: {
      expected: INLINE_DISABLES,
      total: disableTotal,
      files: new Set(sortEntries(disables).map((e) => e[0])).size,
      entries: sortEntries(disables),
    },
    harness: {
      files: harnessFiles.length,
      list: harnessFiles,
      findings: eslintHarness.reduce((a, e) => a + e[2], 0),
      entries: eslintHarness,
      disables: harnessDisables,
      evidence: harness,
    },
    untouched: { before, after, same: before.sha256 === after.sha256 },
    outside,
  }
  const problems = []
  if (!isSame(report.eslint.diff))
    problems.push('c1 ESLint findings differ from the baseline')
  if (!isSame(report.stylelint.diff))
    problems.push('c1 stylelint findings differ from the baseline')
  if (report.disables.total !== INLINE_DISABLES)
    problems.push(
      `c1 ${report.disables.total} inline eslint-disable directives, expected ${INLINE_DISABLES}`
    )
  if (report.harness.findings)
    problems.push('c2 ESLint findings in the harness scope')
  if (harness && harness.control && !harness.control.findings)
    problems.push(
      'c2 the harness files are clean without the overrides: the overrides are not load-bearing'
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
    `lint parity: ESLint ${r.tools.eslint}, stylelint ${r.tools.stylelint}, node ${r.node}`
  )
  line(
    `  ESLint (application files): ${r.eslint.findings} findings (baseline ${r.baselines.eslint.findings}) in ${r.eslint.appFiles} files`
  )
  line(
    `  stylelint: ${r.stylelint.findings} findings (baseline ${r.baselines.stylelint.findings}) in ${r.stylelint.files} files`
  )
  line(
    `  inline eslint-disable directives (application files): ${r.disables.total} in ${r.disables.files} files (expected ${r.disables.expected})`
  )
  line(
    `  harness scope: ${r.harness.files} files, ${r.harness.findings} findings${
      r.harness.evidence && r.harness.evidence.control
        ? `; without the overrides ${r.harness.evidence.control.findings} findings`
        : ''
    }`
  )
  for (const [name, d] of [
    ['ESLint', r.eslint.diff],
    ['stylelint', r.stylelint.diff],
  ]) {
    for (const [f, rule, n] of d.added)
      line(`  + ${name} ${f} ${rule} x${n} (not in the baseline)`)
    for (const [f, rule, n] of d.removed)
      line(`  - ${name} ${f} ${rule} x${n} (gone)`)
    for (const [f, rule, a, b] of d.changed)
      line(`  ~ ${name} ${f} ${rule} ${a} -> ${b}`)
  }
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
      filePath: `${ROOT}/a.js`,
      messages: [{ ruleId: 'x' }, { ruleId: 'x' }, { ruleId: 'y' }],
    },
    { filePath: 'b.js', messages: [{ ruleId: null }] },
    { filePath: 'c.js', messages: [] },
  ]
  ok(
    'aggregateEslint',
    eq(aggregateEslint(eres), [
      ['a.js', 'x', 2],
      ['a.js', 'y', 1],
      ['b.js', '(fatal)', 1],
    ])
  )
  const sres = [
    {
      source: `${ROOT}/m.css`,
      warnings: [{ rule: 'r' }, { rule: 'r' }],
      parseErrors: [],
      invalidOptionWarnings: [],
      deprecations: [],
    },
    {
      source: 'n.css',
      warnings: [],
      parseErrors: [{}],
      invalidOptionWarnings: [{}],
      deprecations: [{}],
    },
  ]
  ok(
    'aggregateStylelint',
    eq(aggregateStylelint(sres), [
      ['m.css', 'r', 2],
      ['n.css', '(deprecation)', 1],
      ['n.css', '(invalid-option)', 1],
      ['n.css', '(parse-error)', 1],
    ])
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
    const report = await run({
      noControl: has('--no-control'),
      eslintBaseline: opt('--eslint-baseline'),
      stylelintBaseline: opt('--stylelint-baseline'),
      anyToolVersion: has('--any-tool-version'),
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
if (isMain) process.exitCode = await main(process.argv.slice(2))
