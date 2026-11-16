// T-001 (41 A; R-033, R-049, R-050; OC-2): lint parity. Lint is red today;
// the gate is parity, not lint-zero. Since W1 the tools are ESLint 10 (flat
// eslint.config.js; the five rules-of-hooks findings as bulk suppressions,
// CS-LINT-2), stylelint 17 (stylelint.config.js; the ratchet
// test/baseline/stylelint-ratchet.json, CS-STY-1) and Prettier 3
// (prettier.config.js, CS-PRET-1); the @oacore configs are gone. The oracle is
// the new-tool baseline taken on unchanged code and then frozen
// (test/baseline/t001-lint-w1.json, 41 T-001); this file holds it as literal
// tables, checks the baseline file against them and reduces the results a
// second time. The ESLint 7 / stylelint 13 baselines
// (docs/upgrade/findings/baselines/) were the reference until W1: the step
// from them to the new tables is a literal table here too.
// c1: the application files, the bulk suppressions, the CSS and the Prettier
// state equal the baseline (less what the format-only commit resolved), 36
// inline `eslint-disable` directives; an ESLint difference passes only as a
// T-001 row of test/baseline/ACCEPTED-DIFFS.yml (42 §8, default deny).
// c2: the harness files (test/**, e2e/**, jest.config.js) are lint clean
// because of the `search/test-harness` block of eslint.config.js (40 §7
// rule 7). The linters need Node >= 20.19: scripts/lint-parity.mjs runs itself
// on the tooling Node when Jest runs on the runtime Node.
const fs = require('fs')
const path = require('path')
const { spawnSync, execFileSync } = require('child_process')

const { ledgerRows } = require('./adapters/reference')

const ROOT = path.resolve(__dirname, '..', '..')
const OLD_BASELINES = path.join(ROOT, 'docs/upgrade/findings/baselines')
const BASELINE = path.join(ROOT, 'test/baseline/t001-lint-w1.json')
const RATCHET = path.join(ROOT, 'test/baseline/stylelint-ratchet.json')

const run = (script, args) =>
  spawnSync(process.execPath, [script, ...args], {
    cwd: ROOT,
    encoding: 'utf8',
    maxBuffer: 1 << 27,
  })

// the frozen new-tool baseline (ESLint 10, typescript-eslint parser), taken on
// unchanged code: the application files as (path, rule, count)
const ESLINT_FINDINGS = [
  ['api/data-provider.js', 'camelcase', 1],
  ['api/index.js', 'import/no-named-as-default', 1],
  ['api/sign-in.js', 'camelcase', 1],
  ['api/works.js', 'camelcase', 1],
  ['hooks/use-analytics.js', 'no-console', 1],
  ['lib/loader.js', 'class-methods-use-this', 1],
  ['lib/loader.js', 'max-len', 2],
  ['modules/dropdown/index.jsx', 'no-unused-vars', 1],
  ['modules/filters/loading-block.jsx', 'no-use-before-define', 1],
  ['pages/search/index.jsx', 'no-console', 4],
  [
    'templates/data-providers/hooks/index.js',
    'import/prefer-default-export',
    1,
  ],
  ['templates/output/hooks/index.js', 'import/prefer-default-export', 1],
  [
    'templates/output/report/report-success-modal.jsx',
    'no-use-before-define',
    2,
  ],
]
// rules-of-hooks (Q-047, R-033): bulk suppressions, source untouched
const SUPPRESSIONS = [
  ['modules/dropdown/index.jsx', 'react-hooks/rules-of-hooks', 1],
  ['pages/_app.jsx', 'react-hooks/rules-of-hooks', 1],
  ['pages/search/index.jsx', 'react-hooks/rules-of-hooks', 2],
  ['templates/search/results.jsx', 'react-hooks/rules-of-hooks', 1],
]
// stylelint 17 on unchanged code: the same (path, rule, count) as stylelint 13
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
// the files Prettier 3 would reformat on unchanged code: the format-only
// commit (.git-blame-ignore-revs) formats exactly these
const PRETTIER_UNFORMATTED = [
  'babel.config.js',
  'hooks/use-analytics.js',
  'modules/dropdown/styles.module.css',
  'templates/output/index.jsx',
  'templates/output/similar-works.jsx',
  'templates/output/styles.module.css',
  'templates/output/update/styles.module.css',
  'templates/search/results.jsx',
  'test/harness-pages/[state].jsx',
]
// what the format-only commit resolves: the stylelint-prettier findings of
// the files it formats (nothing else changes)
const FORMAT_RESOLVED_STYLELINT = [
  ['templates/output/styles.module.css', 'prettier/prettier', 1],
  ['templates/output/update/styles.module.css', 'prettier/prettier', 3],
]

// the ESLint 7 / stylelint 13 baselines (the T-001 reference until W1)
const OLD_ESLINT_FINDINGS = [
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
// from the old table to the new one, each with its cause
const OLD_TO_NEW = {
  // eslint-plugin-prettier is gone (CS-LINT-1); Prettier checks on its own
  removed: [
    ['babel.config.js', 'prettier/prettier', 1],
    ['hooks/use-analytics.js', 'prettier/prettier', 1],
    ['templates/output/index.jsx', 'prettier/prettier', 1],
  ],
  added: [
    // W0 CS-BAB-3 (AD-001, AD-002)
    [
      'templates/data-providers/hooks/index.js',
      'import/prefer-default-export',
      1,
    ],
    ['templates/output/hooks/index.js', 'import/prefer-default-export', 1],
    // typescript-eslint scope analysis: the references in an optional chain
    // and in a shorthand property, which babel-eslint did not give camelcase
    ['api/data-provider.js', 'camelcase', 1],
    ['api/sign-in.js', 'camelcase', 1],
    ['api/works.js', 'camelcase', 1],
    // JSX element names are references now (a component used in JSX above
    // its const declaration)
    ['modules/filters/loading-block.jsx', 'no-use-before-define', 1],
    [
      'templates/output/report/report-success-modal.jsx',
      'no-use-before-define',
      2,
    ],
  ],
}
// the 36 inline directives of the application files: (path, rule, count); a
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
const keyed = (rows) => new Map(rows.map(([f, r, n]) => [`${f}\u0000${r}`, n]))
// a table less some rows, by this file's own rule
const minus = (rows, removed) => {
  const m = keyed(rows)
  removed.forEach(([f, r, n]) => {
    const k = `${f}\u0000${r}`
    if (m.get(k) === n) m.delete(k)
    else m.set(k, m.get(k) - n)
  })
  return sortRows(
    [...m].map(([k, n]) => {
      const [file, rule] = k.split('\u0000')
      return [file, rule, n]
    })
  )
}
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
const readJson = (file) => JSON.parse(fs.readFileSync(file, 'utf8'))

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
    // the vendored design is outside the scan, as ESLint ignores vendor/**
    // (CS-W0-12, AD-043)
    .filter(
      (f) =>
        !/^(test|e2e|docs|tools|node_modules|vendor\/oacore-design)\//.test(
          f
        ) && f !== 'jest.config.js'
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
  let base
  beforeAll(() => {
    base = readJson(BASELINE)
    raw = run('scripts/lint-parity.mjs', ['--json'])
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

  test('T-001 c1 @P0 the scripts themselves: normaliser, aggregation, comparison, ledger, ratchet and directive scanner known answers', () => {
    for (const script of [
      'scripts/lint-parity.mjs',
      'scripts/stylelint-ratchet.mjs',
    ]) {
      const r = run(script, ['--self-test'])
      expect(r.stdout).not.toMatch(/FAIL/)
      expect(r.stdout).toMatch(/self-test: (\d+)\/\1\n$/)
      expect(r.status).toBe(0)
    }
  })

  test('T-001 c1 @P0 installed tools are ESLint 10, stylelint 18 and Prettier 3, run on the tooling Node, with no @oacore config', () => {
    expect(report.tools.eslint).toMatch(/^10\./)
    expect(report.tools.stylelint).toMatch(/^18\./)
    expect(report.tools.prettier).toMatch(/^3\./)
    expect(report.tools.parser).toMatch(/^typescript-eslint 8\./)
    expect(report.tools.orgConfigs).toEqual([])
    expect(Number(report.node.slice(1).split('.')[0])).toBeGreaterThanOrEqual(
      24
    )
    const pkg = readJson(path.join(ROOT, 'package.json'))
    const deps = { ...pkg.dependencies, ...pkg.devDependencies }
    expect(
      Object.keys(deps).filter((d) => /^@oacore\/.*config/.test(d))
    ).toEqual([])
    expect(Object.keys(deps)).not.toEqual(
      expect.arrayContaining(['babel-eslint'])
    )
    expect(Object.keys(deps)).not.toEqual(
      expect.arrayContaining(['eslint-plugin-prettier'])
    )
    expect(fs.existsSync(path.join(ROOT, '.eslintrc.yml'))).toBe(false)
    // the org options inlined (CS-PRET-1), the org configs no longer loaded
    // by any config file
    expect(require(path.join(ROOT, 'prettier.config.js'))).toEqual({
      trailingComma: 'es5',
      semi: false,
      singleQuote: true,
      endOfLine: 'lf',
      quoteProps: 'consistent',
    })
    const stylelintConfig = require(path.join(ROOT, 'stylelint.config.js'))
    expect(stylelintConfig.extends).toEqual(['stylelint-config-css-modules'])
    expect(stylelintConfig.plugins).toEqual([
      'stylelint-order',
      'stylelint-prettier',
    ])
    for (const f of [
      'eslint.config.js',
      'prettier.config.js',
      'stylelint.config.js',
    ]) {
      const source = fs.readFileSync(path.join(ROOT, f), 'utf8')
      expect([f, /require\(\s*['"`][^'"`]*@oacore/.test(source)]).toEqual([
        f,
        false,
      ])
    }
  })

  test('T-001 c1 @P0 the frozen baseline is the literal tables: 18 ESLint findings, 5 suppressions, 16 stylelint findings, 9 unformatted files', () => {
    expect(base.test).toBe('T-001')
    expect(base.eslint.entries).toEqual(ESLINT_FINDINGS)
    expect(sum(base.eslint.entries)).toBe(18)
    expect(base.suppressions.entries).toEqual(SUPPRESSIONS)
    expect(base.stylelint.entries).toEqual(STYLELINT_FINDINGS)
    expect(sum(base.stylelint.entries)).toBe(16)
    expect(base.prettier.unformatted).toEqual(PRETTIER_UNFORMATTED)
    expect(base.disables.total).toBe(38)
    // taken with the W1 tools
    expect(base.tools.eslint).toBe(report.tools.eslint)
    expect(base.tools.stylelint).toBe(report.tools.stylelint)
    expect(base.tools.prettier).toBe(report.tools.prettier)
    // the script reads the same baseline
    expect(report.baseline.eslint.entries).toEqual(ESLINT_FINDINGS)
    expect(report.baseline.stylelint.entries).toEqual(STYLELINT_FINDINGS)
  })

  test('T-001 c1 @P0 the step from the ESLint 7 / stylelint 13 baselines to the new tables is the literal one', () => {
    const oldEslint = tally(
      readJson(path.join(OLD_BASELINES, 'eslint-baseline.json')).flatMap((r) =>
        r.messages.map((m) => [rel(r.filePath), m.ruleId])
      )
    )
    const oldStylelint = tally(
      readJson(path.join(OLD_BASELINES, 'stylelint-baseline.json')).flatMap(
        (r) => r.warnings.map((w) => [rel(r.source), w.rule])
      )
    )
    expect(oldEslint).toEqual(OLD_ESLINT_FINDINGS)
    expect(sum(oldEslint)).toBe(13)
    expect(
      sortRows([...minus(oldEslint, OLD_TO_NEW.removed), ...OLD_TO_NEW.added])
    ).toEqual(ESLINT_FINDINGS)
    expect(oldStylelint).toEqual(STYLELINT_FINDINGS)
  })

  test('T-001 c1 @P0 ESLint findings of the application files equal the baseline (path, rule, count)', () => {
    const diffs = differences(ESLINT_FINDINGS, report.eslint.entries)
    expect(diffs.filter((d) => !coveredBy(d))).toEqual([])
    expect(report.eslint.ledger.uncovered).toEqual([])
    // the script finds the same differences and accepts them by the same rows
    expect(report.eslint.ledger.accepted).toEqual(
      diffs.map((d) => ({ ...d, ad: coveredBy(d).id }))
    )
    expect(report.eslint.findings).toBe(
      sum(ESLINT_FINDINGS) +
        diffs.reduce((n, d) => n + Number(d.to) - Number(d.from), 0)
    )
    // `npm run lint:js` exits 1 while findings exist, as the ESLint 7
    // script did (CS-LINT-3, CS-LINT-4)
    expect(report.eslint.status).toBe(1)
    // the whole application is linted, with no narrower scope (156 files
    // before W1, plus eslint.config.js)
    expect(report.eslint.appFiles).toBeGreaterThanOrEqual(157)
  })

  test('T-001 c1 @P0 the bulk suppressions are the five rules-of-hooks findings and none is stale (CS-LINT-2)', () => {
    const file = readJson(path.join(ROOT, 'eslint-suppressions.json'))
    const rows = sortRows(
      Object.entries(file).flatMap(([f, rules]) =>
        Object.entries(rules).map(([r, v]) => [f, r, v.count])
      )
    )
    expect(rows).toEqual(SUPPRESSIONS)
    expect(report.suppressions.entries).toEqual(SUPPRESSIONS)
    expect(report.suppressions.stale).toBe(false)
  })

  test('T-001 c1 @P0 stylelint findings equal the baseline (path, rule, count)', () => {
    const expected = minus(
      STYLELINT_FINDINGS,
      base.formatOnly.resolved.stylelint
    )
    expect(report.stylelint.entries).toEqual(expected)
    expect(report.stylelint.findings).toBe(sum(expected))
    // the ratchet holds the same rows (it may only shrink, CS-STY-1)
    expect(readJson(RATCHET).findings).toEqual(expected)
    expect(report.stylelint.files).toBeGreaterThanOrEqual(28)
    // stylelint fails the run while findings exist, as stylelint 13 did
    expect(report.stylelint.status).toBe(2)
  })

  test('T-001 c1 @P0 Prettier: every file in the lint scope is formatted after the format-only commit, which formats exactly the baseline list', () => {
    expect(report.prettier.unformatted).toEqual([])
    expect(report.prettier.files).toBeGreaterThanOrEqual(300)
    const fmt = base.formatOnly
    expect(fmt.files).toEqual(PRETTIER_UNFORMATTED)
    expect(fmt.resolved.stylelint).toEqual(FORMAT_RESOLVED_STYLELINT)
    // it resolves only stylelint-prettier findings of files it formats
    for (const [f, rule] of fmt.resolved.stylelint) {
      expect(rule).toBe('prettier/prettier')
      expect(fmt.files).toContain(f)
    }
    // listed for `git blame --ignore-revs-file`
    const revs = fs
      .readFileSync(path.join(ROOT, '.git-blame-ignore-revs'), 'utf8')
      .split('\n')
      .filter((l) => /^[0-9a-f]{40}$/.test(l))
    expect(revs).toContain(fmt.commit)
  })

  test('T-001 c1 @P0 every reported path is repo-relative (ER-28)', () => {
    const paths = [
      ...report.eslint.entries,
      ...report.stylelint.entries,
      ...report.baseline.eslint.entries,
      ...report.baseline.stylelint.entries,
      ...report.suppressions.entries,
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

  test('T-001 c1 @P0 36 inline eslint-disable directives in 29 application files', () => {
    const scan = inlineDirectives()
    expect(scan.comments).toBe(36) // AD-156
    expect(scan.rows).toEqual(INLINE_DISABLES)
    // the script counts the same directives
    expect(report.disables.total).toBe(36) // AD-156
    expect(report.disables.entries).toEqual(INLINE_DISABLES)
    expect(report.disables.files).toBe(29) // AD-156
    // none of them is a blanket disable
    expect(INLINE_DISABLES.filter((e) => e[1] === '*')).toEqual([])
  })

  test('T-001 c1 @P0 no --fix anywhere: the lint scripts, the hook and the scripts themselves (R-049)', () => {
    const pkg = readJson(path.join(ROOT, 'package.json'))
    expect(pkg.scripts['lint:js']).toBe('eslint .')
    // stylelint also reads .stylelintignore, which keeps the vendored design
    // (and its stylelint.config.js) out (CS-DSN-2, AD-042)
    expect(pkg.scripts['lint:css']).toBe(
      "stylelint --ignore-path .gitignore --ignore-path .stylelintignore '**/*.css'"
    )
    expect(JSON.stringify(pkg.scripts)).not.toMatch(/--fix/)
    // the pre-commit hook (CS-HUS-1): ESLint and stylelint report, only
    // Prettier writes, and only JS and JSON; lint-staged reads the root
    // config only, never the vendored design's .lintstagedrc (CS-DSN-2,
    // AD-042)
    expect(pkg.scripts.prepare).toBe('husky')
    expect(
      fs.readFileSync(path.join(ROOT, '.husky/pre-commit'), 'utf8').trim()
    ).toBe('npx lint-staged --config package.json')
    expect(pkg['lint-staged']).toEqual({
      '*.{js,jsx}': ['eslint --no-warn-ignored', 'prettier --write'],
      '*.css': ['stylelint', 'prettier --check'],
      '*.json': 'prettier --write',
    })
    expect(JSON.stringify(pkg['lint-staged'])).not.toMatch(/--fix/)
    // vendored files stay verbatim under the hook's Prettier (CS-HUS-2)
    expect(
      fs.readFileSync(path.join(ROOT, '.prettierignore'), 'utf8').split('\n')
    ).toContain('vendor/')
    // each script refuses --fix with its own usage exit code:
    // lint-parity 2, stylelint-ratchet 3
    for (const [script, status] of [
      ['scripts/lint-parity.mjs', 2],
      ['scripts/stylelint-ratchet.mjs', 3],
    ]) {
      const refused = run(script, ['--fix', '--json'])
      expect(refused.status).toBe(status)
      expect(refused.stderr).toMatch(/R-049/)
    }
    // the lint inputs were not rewritten by the run
    expect(report.untouched.same).toBe(true)
    expect(report.untouched.after.files).toBeGreaterThanOrEqual(11)
  })

  test('T-001 c1 @P0 the run is a parity run: lint is red today, so parity and zero findings differ (OC-2)', () => {
    // 18 ESLint findings (= the frozen baseline) and 12 stylelint
    // findings (the baseline holds 16)
    expect(report.eslint.findings + report.stylelint.findings).toBe(18 + 12)
    expect(report.eslint.findings).toBe(18)
    expect(report.stylelint.findings).toBe(12)
    expect(report.baseline.eslint.findings).toBe(18)
    expect(report.baseline.stylelint.findings).toBe(16)
    // the report's own verdict for c1
    expect(report.problems.filter((p) => /^c1/.test(p))).toEqual([])
  })

  test('T-001 c2 @P0 test/**, e2e/**, jest.config.js: no ESLint finding in the harness files', () => {
    expect(report.harness.entries).toEqual([])
    expect(report.harness.findings).toBe(0)
    expect(report.problems.filter((p) => /^c2/.test(p))).toEqual([])
    // the harness scope was linted, not ignored
    expect(report.harness.list).toEqual(
      expect.arrayContaining([
        'jest.config.js',
        'test/setup/env-clock.js',
        'test/utils/render.js',
      ])
    )
    expect(report.harness.files).toBeGreaterThanOrEqual(30)
  })

  test('T-001 c2 @P0 the search/test-harness block of eslint.config.js is what keeps the harness clean (effective config and control run)', () => {
    const ev = report.harness.evidence
    expect(ev.overridesDeclared).toEqual([
      {
        name: 'search/test-harness',
        files: [
          'test/**/*.js',
          'test/**/*.jsx',
          'e2e/**/*.js',
          'jest.config.js',
        ],
      },
    ])
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
        expect([p.file, r, p.rules[r]]).toEqual([p.file, r, 0])
      // max-len stays an error (limit relaxed for strings, URLs and the like)
      expect(p.rules['max-len']).toBe(2)
    }
    // an application file keeps the strict rules
    expect(appProbe.env.jest).toBe(false)
    expect(appProbe.env.browser).toBe(true)
    for (const r of offInHarness) expect([r, appProbe.rules[r]]).toEqual([r, 2])
    // without the block the same files are not clean: it is load-bearing
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
