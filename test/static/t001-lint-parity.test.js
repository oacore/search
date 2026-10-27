// T-001 (41 A; R-033, R-049, R-050; OC-2): lint parity. Lint is red today
// (13 ESLint + 16 stylelint findings); the gate is parity, not lint-zero.
// scripts/lint-parity.mjs runs the installed ESLint 7 and stylelint 13 with the
// installed configs (the commands of `npm run lint:js` and `lint:css`, never
// --fix) and reduces both results to (path, rule, count), repo-relative
// (ER-28). This file holds the oracle: the findings as literal tables, checked
// against the frozen baselines in docs/upgrade/findings/baselines/ and reduced
// here by a second implementation.
// c1: the application files and the CSS equal the baselines, 38 inline
// `eslint-disable` directives; an ESLint difference passes only as a T-001
// row of test/baseline/ACCEPTED-DIFFS.yml (42 §8, default deny; AD-001,
// AD-002). c2: the harness files (test/**, e2e/**,
// jest.config.js) are lint clean because of the .eslintrc.yml overrides
// (40 §7 rule 7). After W1 the oracle is the new-tool baseline taken on
// unchanged code (41 T-001).
const fs = require('fs')
const path = require('path')
const { spawnSync, execFileSync } = require('child_process')

const { ledgerRows } = require('./adapters/reference')

const ROOT = path.resolve(__dirname, '..', '..')
const BASELINES = path.join(ROOT, 'docs/upgrade/findings/baselines')

const run = (args) =>
  spawnSync(process.execPath, ['scripts/lint-parity.mjs', ...args], {
    cwd: ROOT,
    encoding: 'utf8',
    maxBuffer: 1 << 27,
  })

// the frozen baselines (OC-2), as (path, rule, count)
const ESLINT_FINDINGS = [
  ['api/index.js', 'import/no-named-as-default', 1],
  ['babel.config.js', 'prettier/prettier', 1],
  ['hooks/use-analytics.js', 'no-console', 1],
  ['hooks/use-analytics.js', 'prettier/prettier', 1],
  ['lib/loader.js', 'class-methods-use-this', 1],
  ['lib/loader.js', 'max-len', 2],
  ['modules/dropdown/index.jsx', 'no-unused-vars', 1],
  ['pages/search/index.jsx', 'no-console', 4],
  ['templates/output/index.jsx', 'prettier/prettier', 1],
]
const STYLELINT_FINDINGS = [
  ['modules/layout/styles.module.css', 'order/properties-order', 1],
  ['modules/layout/styles.module.css', 'selector-class-pattern', 4],
  ['templates/output/styles.module.css', 'prettier/prettier', 1],
  ['templates/output/update/styles.module.css', 'order/properties-order', 3],
  ['templates/output/update/styles.module.css', 'prettier/prettier', 3],
  ['templates/search/styles.module.css', 'order/properties-order', 3],
  [
    'templates/search/styles.module.css',
    'shorthand-property-no-redundant-values',
    1,
  ],
]
// the 38 inline directives of the application files: (path, rule, count); a
// comment that names two rules (modules/dropdown/index.jsx) adds two rows
const INLINE_DISABLES = [
  ['api/data-provider.js', 'camelcase', 2],
  ['api/errors.js', 'max-classes-per-file', 1],
  ['api/index.js', 'prefer-destructuring', 1],
  ['api/sign-in.js', 'camelcase', 1],
  ['api/works.js', 'camelcase', 2],
  ['hooks/use-analytics.js', 'no-console', 1],
  ['hooks/use-copy-to-clipboard.js', 'consistent-return', 1],
  ['hooks/use-outside-click.js', 'consistent-return', 1],
  ['hooks/use-pagination.js', 'consistent-return', 1],
  ['hooks/use-sync-url-params-with-store/index.js', 'eqeqeq', 1],
  ['hooks/use-window-size.js', 'consistent-return', 1],
  ['lib/loader.js', 'class-methods-use-this', 1],
  ['lib/loader.js', 'no-console', 1],
  ['modules/dropdown/index.jsx', 'consistent-return', 1],
  ['modules/dropdown/index.jsx', 'jsx-a11y/click-events-have-key-events', 1],
  ['modules/dropdown/index.jsx', 'jsx-a11y/no-static-element-interactions', 1],
  ['modules/dropdown/index.jsx', 'max-len', 1],
  ['modules/filters/filter-item.jsx', 'consistent-return', 1],
  ['modules/filters/year/index.jsx', 'react/no-array-index-key', 1],
  ['modules/meta/index.jsx', 'react/no-danger', 1],
  ['pages/_app.jsx', 'class-methods-use-this', 1],
  ['pages/_app.jsx', 'import/no-mutable-exports', 1],
  ['pages/data-providers/index.jsx', 'react/no-danger', 1],
  ['templates/data-provider/claim/claim-card.jsx', 'no-console', 1],
  ['templates/data-provider/claim/claim-card.jsx', 'prefer-const', 1],
  ['templates/data-provider/claim/claim-modal-edit.jsx', 'prefer-const', 1],
  ['templates/output/citation.jsx', 'no-console', 1],
  ['templates/output/index.jsx', 'jsx-a11y/anchor-is-valid', 1],
  ['templates/output/similar-works.jsx', 'max-len', 1],
  ['templates/output/similar-works.jsx', 'no-nested-ternary', 1],
  ['templates/output/update/index.jsx', 'no-console', 1],
  ['templates/search/results.jsx', 'no-nested-ternary', 1],
  ['utils/filters-transform.js', 'no-param-reassign', 1],
  ['utils/logger.js', 'no-console', 1],
  ['utils/related-words.js', 'prefer-spread', 1],
  ['utils/sort.js', 'no-nested-ternary', 1],
  ['utils/titleCase.js', 'import/prefer-default-export', 1],
]

const compare = (a, b) => {
  if (a === b) return 0
  return a < b ? -1 : 1
}
const sortRows = (rows) =>
  [...rows].sort((x, y) => compare(x[0], y[0]) || compare(x[1], y[1]))
const sum = (rows) => rows.reduce((n, r) => n + r[2], 0)
// path made repo-relative by this file's own rule (ER-28)
const rel = (p) =>
  path.isAbsolute(p) ? path.relative(ROOT, p).split(path.sep).join('/') : p
const tally = (pairs) => {
  const m = new Map()
  for (const [file, rule] of pairs) {
    const k = `${file}\u0000${rule}`
    m.set(k, (m.get(k) || 0) + 1)
  }
  return sortRows(
    [...m].map(([k, n]) => {
      const [file, rule] = k.split('\u0000')
      return [file, rule, n]
    })
  )
}
const baselineFile = (name) =>
  JSON.parse(fs.readFileSync(path.join(BASELINES, name), 'utf8'))

// the differences of a run from a literal table as {key, from, to}: key
// `<path> / <rule>`, counts as strings (0 = no finding)
const differences = (table, entries) => {
  const a = new Map(table.map(([f, r, n]) => [`${f} / ${r}`, n]))
  const b = new Map(entries.map(([f, r, n]) => [`${f} / ${r}`, n]))
  return [...new Set([...a.keys(), ...b.keys()])]
    .sort(compare)
    .filter((k) => (a.get(k) || 0) !== (b.get(k) || 0))
    .map((k) => ({
      key: k,
      from: String(a.get(k) || 0),
      to: String(b.get(k) || 0),
    }))
}
// default deny (42 §8): a difference passes only by a T-001 row in force
// whose key, from and to match exactly
const coveredBy = (d) =>
  ledgerRows('T-001').find(
    (r) => r.key === d.key && String(r.from) === d.from && String(r.to) === d.to
  )
const countDelta = (diffs) =>
  diffs.reduce((n, d) => n + Number(d.to) - Number(d.from), 0)

// the application's inline directives, scanned line by line (the script scans
// the whole text: two implementations)
const appFiles = () =>
  execFileSync(
    'git',
    [
      '-C',
      ROOT,
      'ls-files',
      '-z',
      '--cached',
      '--others',
      '--exclude-standard',
      '--',
      '*.js',
      '*.jsx',
    ],
    { encoding: 'utf8', maxBuffer: 1 << 26 }
  )
    .split('\0')
    .filter(Boolean)
    .filter(
      (f) =>
        !/^(test|e2e|docs|tools|node_modules)\//.test(f) &&
        f !== 'jest.config.js'
    )
const inlineDirectives = () => {
  const pairs = []
  let comments = 0
  for (const f of appFiles()) {
    for (const line of fs
      .readFileSync(path.join(ROOT, f), 'utf8')
      .split('\n')) {
      const m =
        /(?:\/\/|\/\*)\s*eslint-disable(?:-next-line|-line)?(?![\w-])(.*)$/.exec(
          line
        )
      if (m) {
        comments += 1
        m[1]
          .replace(/\*\/.*$/, '')
          .split(/\s--\s/)[0]
          .split(',')
          .map((r) => r.trim())
          .filter(Boolean)
          .forEach((r) => pairs.push([f, r]))
      }
    }
  }
  return { comments, rows: tally(pairs) }
}

describe('T-001 @P0 lint parity', () => {
  let report
  let raw
  beforeAll(() => {
    raw = run(['--json'])
    try {
      report = JSON.parse(raw.stdout)
    } catch (e) {
      throw new Error(
        `lint-parity.mjs printed no JSON (exit ${raw.status}): ${String(
          raw.stderr || raw.stdout
        ).slice(0, 600)}`
      )
    }
  }, 600000)

  test('T-001 c1 @P0 the script itself: normaliser, aggregation, comparison and directive scanner known answers', () => {
    const r = run(['--self-test'])
    expect(r.stdout).not.toMatch(/FAIL/)
    expect(r.stdout).toMatch(/self-test: (\d+)\/\1\n$/)
    expect(r.status).toBe(0)
  })

  test('T-001 c1 @P0 installed tools are ESLint 7 and stylelint 13 with the @oacore configs', () => {
    expect(report.tools.eslint).toMatch(/^7\./)
    expect(report.tools.stylelint).toMatch(/^13\./)
    expect(Object.keys(report.tools.configs).sort()).toEqual([
      '@oacore/eslint-config-react',
      '@oacore/stylelint-config-base',
    ])
  })

  test('T-001 c1 @P0 baselines reduced to (path, rule, count) are the literal tables: 13 ESLint and 16 stylelint findings', () => {
    const eslintBase = tally(
      baselineFile('eslint-baseline.json').flatMap((r) =>
        r.messages.map((m) => [rel(r.filePath), m.ruleId])
      )
    )
    const stylelintBase = tally(
      baselineFile('stylelint-baseline.json').flatMap((r) =>
        r.warnings.map((w) => [rel(r.source), w.rule])
      )
    )
    expect(eslintBase).toEqual(ESLINT_FINDINGS)
    expect(sum(eslintBase)).toBe(13)
    expect(stylelintBase).toEqual(STYLELINT_FINDINGS)
    expect(sum(stylelintBase)).toBe(16)
    // the script reduces the baselines the same way
    expect(report.baselines.eslint.entries).toEqual(ESLINT_FINDINGS)
    expect(report.baselines.stylelint.entries).toEqual(STYLELINT_FINDINGS)
  })

  test('T-001 c1 @P0 ESLint findings of the application files equal the baseline (path, rule, count)', () => {
    const diffs = differences(ESLINT_FINDINGS, report.eslint.entries)
    expect(diffs.filter((d) => !coveredBy(d))).toEqual([])
    expect(report.eslint.findings).toBe(13 + countDelta(diffs))
    // the script finds the same differences and accepts them by the same rows
    expect(report.eslint.ledger.uncovered).toEqual([])
    expect(report.eslint.ledger.accepted).toEqual(
      diffs.map((d) => ({ ...d, ad: coveredBy(d).id }))
    )
    // the baseline covered 156 files (docs/upgrade/findings/05 §2.3): the
    // whole application is linted, with no narrower scope
    expect(report.eslint.appFiles).toBeGreaterThanOrEqual(156)
  })

  test('T-001 c1 @P0 stylelint findings equal the baseline (path, rule, count)', () => {
    expect(report.stylelint.entries).toEqual(STYLELINT_FINDINGS)
    expect(report.stylelint.findings).toBe(16)
    expect(report.stylelint.diff).toEqual({
      added: [],
      removed: [],
      changed: [],
    })
    expect(report.stylelint.files).toBeGreaterThanOrEqual(28)
  })

  test('T-001 c1 @P0 every reported path is repo-relative (ER-28)', () => {
    const paths = [
      ...report.eslint.entries,
      ...report.stylelint.entries,
      ...report.baselines.eslint.entries,
      ...report.baselines.stylelint.entries,
      ...report.disables.entries,
      ...report.harness.entries,
    ].map((e) => e[0])
    expect(paths.length).toBeGreaterThan(40)
    for (const p of paths) {
      expect(p).not.toMatch(/^\/|^\.\.|\\|^[A-Za-z]:/)
      expect(fs.existsSync(path.join(ROOT, p))).toBe(true)
    }
    expect(report.outside).toEqual([])
  })

  test('T-001 c1 @P0 38 inline eslint-disable directives in 30 application files', () => {
    const scan = inlineDirectives()
    expect(scan.comments).toBe(38)
    expect(scan.rows).toEqual(INLINE_DISABLES)
    // the script counts the same directives
    expect(report.disables.total).toBe(38)
    expect(report.disables.entries).toEqual(INLINE_DISABLES)
    expect(report.disables.files).toBe(30)
    // none of them is a blanket disable
    expect(INLINE_DISABLES.filter((e) => e[1] === '*')).toEqual([])
  })

  test('T-001 c1 @P0 no --fix anywhere: the lint scripts, the hooks and the script itself (R-049)', () => {
    const pkg = JSON.parse(
      fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8')
    )
    expect(pkg.scripts['lint:js']).toBe(
      'eslint --ignore-path .gitignore --ext .js,.jsx .'
    )
    expect(pkg.scripts['lint:css']).toBe(
      "stylelint --ignore-path .gitignore '**/*.css'"
    )
    expect(JSON.stringify(pkg.scripts)).not.toMatch(/--fix|lint-staged/)
    expect(pkg.husky).toBeUndefined()
    expect(pkg['lint-staged']).toBeUndefined()
    const refused = run(['--fix', '--json'])
    expect(refused.status).toBe(2)
    expect(refused.stderr).toMatch(/R-049/)
    // the lint inputs were not rewritten by the run
    expect(report.untouched.same).toBe(true)
    expect(report.untouched.after.files).toBeGreaterThanOrEqual(11)
  })

  test('T-001 c1 @P0 the run is a parity run: lint is red today, so parity and zero findings differ (OC-2)', () => {
    // 29 plus the counts the T-001 rows of the ledger accept (AD-001, AD-002)
    const accepted = differences(ESLINT_FINDINGS, report.eslint.entries).filter(
      coveredBy
    )
    expect(report.eslint.findings + report.stylelint.findings).toBe(
      29 + countDelta(accepted)
    )
    expect(report.baselines.eslint.findings).toBe(13)
    expect(report.baselines.stylelint.findings).toBe(16)
    // the report's own verdict for c1
    expect(report.problems.filter((p) => /^c1/.test(p))).toEqual([])
  })

  test('T-001 c2 @P0 test/**, e2e/**, jest.config.js: no ESLint finding in the harness files', () => {
    expect(report.harness.entries).toEqual([])
    expect(report.harness.findings).toBe(0)
    expect(report.problems.filter((p) => /^c2/.test(p))).toEqual([])
    // the override scope was linted, not ignored
    expect(report.harness.list).toEqual(
      expect.arrayContaining([
        'jest.config.js',
        'test/setup/env-clock.js',
        'test/utils/render.js',
      ])
    )
    expect(report.harness.files).toBeGreaterThanOrEqual(30)
  })

  test('T-001 c2 @P0 the .eslintrc.yml overrides are what keeps the harness clean (effective config and control run)', () => {
    const ev = report.harness.evidence
    expect(ev.overridesDeclared).toEqual([
      {
        files: [
          'test/**/*.js',
          'test/**/*.jsx',
          'e2e/**/*.js',
          'jest.config.js',
        ],
      },
    ])
    const level = (v) => ({ off: 0, warn: 1, error: 2 }[v] ?? v)
    const offInHarness = [
      'import/no-extraneous-dependencies',
      'global-require',
      'import/no-dynamic-require',
      'no-restricted-syntax',
      'no-plusplus',
      'no-bitwise',
    ]
    const harnessProbes = ev.probes.filter((p) =>
      /^(test\/|jest\.config)/.test(p.file)
    )
    const appProbe = ev.probes.find(
      (p) => !/^(test\/|jest\.config)/.test(p.file)
    )
    expect(harnessProbes.map((p) => p.file)).toEqual(
      expect.arrayContaining(['jest.config.js'])
    )
    for (const p of harnessProbes) {
      expect(p.env).toMatchObject({ jest: true, node: true })
      for (const r of offInHarness)
        expect([p.file, r, level(p.rules[r])]).toEqual([p.file, r, 0])
      // max-len stays an error (limit relaxed for strings, URLs and the like)
      expect(level(p.rules['max-len'])).toBe(2)
    }
    // an application file keeps the strict rules
    expect(appProbe.env.jest).toBe(false)
    for (const r of offInHarness)
      expect([r, level(appProbe.rules[r])]).toEqual([r, 2])
    // without the overrides the same files are not clean: they are load-bearing
    expect(ev.control.files).toBe(report.harness.files)
    expect(ev.control.findings).toBeGreaterThan(100)
    expect(Object.keys(ev.control.rules)).toEqual(
      expect.arrayContaining(['no-undef', 'global-require'])
    )
  })

  test('T-001 c2 @P0 harness files name the rules they disable inline: no blanket eslint-disable', () => {
    const blanket = report.harness.disables.filter((d) => d[1] === '*')
    expect(blanket).toEqual([])
  })
})
