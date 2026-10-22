// CI-1 (42 §8, §10; 40 §1, 30 §1 rule 3): scripts/ad-ledger.mjs, the checker
// of test/baseline/ACCEPTED-DIFFS.yml that the `lint` job runs. Default deny:
// a diff passes only through a row with exact keys; the ledger is
// append-only; `kind: delta` never covers pixels, a status code or a
// Location; a delta row carries the repro run of the framework probe; every
// row is signed by the owner's `SIGNED:` comment, which the checker looks up
// through `gh api repos/oacore/search/issues/comments/<id>` (a fake `gh`
// stands in here). An empty ledger passes offline.
// Oracle: the expected violation codes are written out per case, not derived
// from the script.
const fs = require('fs')
const os = require('os')
const path = require('path')
const { pathToFileURL } = require('url')
const { spawnSync } = require('child_process')

const ROOT = path.resolve(__dirname, '..', '..', '..')
const SCRIPT = path.join(ROOT, 'scripts', 'ad-ledger.mjs')

jest.setTimeout(120000)

// ---------- helpers ----------

const validRow = (over = {}) => ({
  id: 'AD-001',
  kind: 'delta',
  test: 'T-603',
  key: '404-page@proxy/cache-control',
  from: '<absent>',
  to: 'private, no-cache, no-store, max-age=0, must-revalidate',
  reason: 'Next 12.3 adds Cache-Control on 404 (review:http-contract HC-06)',
  ref: ['OD-39', 'R-083'],
  step: 'W4d',
  repro: 'https://github.com/oacore/search/actions/runs/123456789',
  signedOffBy:
    'Jane Owner, https://github.com/oacore/search/pull/12#issuecomment-4001',
  date: '2026-11-02',
  ...over,
})
const productRow = (over = {}) =>
  validRow({
    id: 'AD-002',
    kind: 'product',
    test: 'T-801',
    key: 'V01@1440',
    from: 'sha256:aaa',
    to: 'sha256:bbb',
    reason: 'Search result card spacing (D15)',
    ref: ['OD-31'],
    step: '6.5',
    signedOffBy:
      'Jane Owner, https://github.com/oacore/search/pull/13#issuecomment-4002',
    repro: undefined,
    ...over,
  })

// rows -> YAML text (JSON strings are YAML double-quoted scalars; undefined
// values are left out)
const yamlOf = (rows) =>
  rows.length === 0
    ? '[]\n'
    : rows
        .map((r) =>
          Object.entries(r)
            .filter(([, v]) => v !== undefined)
            .map(([k, v], i) => {
              const value = Array.isArray(v)
                ? `[${v.map((x) => JSON.stringify(x)).join(', ')}]`
                : JSON.stringify(v)
              return `${i === 0 ? '- ' : '  '}${k}: ${value}`
            })
            .join('\n')
        )
        .join('\n')
        .concat('\n')

let tmp
let counter = 0
const scratch = (name) => {
  counter += 1
  return path.join(tmp, `${counter}-${name}`)
}
const write = (name, text) => {
  const file = scratch(name)
  fs.writeFileSync(file, text)
  return file
}
const NO_BASE = () => path.join(tmp, 'no-such-base.yml')

const run = (args, { cwd = ROOT, env = {} } = {}) => {
  const r = spawnSync(process.execPath, [SCRIPT, ...args], {
    cwd,
    encoding: 'utf8',
    env: { ...process.env, ...env },
  })
  return { code: r.status, out: r.stdout, err: r.stderr }
}
// rows (or YAML text) -> the JSON report of an offline structural check
// against an empty base
const check = (ledger, args = []) => {
  const file = write(
    'ledger.yml',
    typeof ledger === 'string' ? ledger : yamlOf(ledger)
  )
  const r = run([
    '--ledger',
    file,
    '--base-file',
    NO_BASE(),
    '--offline',
    '--json',
    ...args,
  ])
  return {
    ...r,
    report: r.out.trim().startsWith('{') ? JSON.parse(r.out) : null,
  }
}
const codes = (r) => r.report.violations.map((v) => v.code)

// functions of the module, called in a child process (the script is an ES
// module, Jest runs CommonJS)
const callEach = (fn, argLists) => {
  const code = `import(${JSON.stringify(
    pathToFileURL(SCRIPT).href
  )}).then((m) => {
    const lists = JSON.parse(process.argv[1])
    process.stdout.write(JSON.stringify(lists.map((a) => m[${JSON.stringify(
      fn
    )}](...a))))
  })`
  const r = spawnSync(
    process.execPath,
    ['-e', code, JSON.stringify(argLists)],
    {
      encoding: 'utf8',
    }
  )
  if (r.status !== 0) throw new Error(`${fn}: ${r.stderr}`)
  return JSON.parse(r.stdout)
}

// a fake GitHub CLI: answers from a JSON file { "<comment id>": { body } } and
// logs its arguments
const fakeGh = (db) => {
  const dbFile = write('gh-db.json', JSON.stringify(db))
  const logFile = scratch('gh-log.ndjson')
  const bin = write(
    'gh.js',
    `#!/usr/bin/env node
const fs = require('fs')
const args = process.argv.slice(2)
fs.appendFileSync(${JSON.stringify(logFile)}, JSON.stringify(args) + '\\n')
const m = /^repos\\/([^/]+\\/[^/]+)\\/issues\\/comments\\/(\\d+)$/.exec(args[1] || '')
const db = JSON.parse(fs.readFileSync(${JSON.stringify(dbFile)}, 'utf8'))
const hit = m && db[m[2]]
if (args[0] !== 'api' || !hit) { process.stderr.write('gh: Not Found (HTTP 404)\\n'); process.exit(1) }
if (hit.network) { process.stderr.write('error connecting to api.github.com\\n'); process.exit(1) }
process.stdout.write(JSON.stringify(hit.body))
`
  )
  fs.chmodSync(bin, 0o755)
  const calls = () =>
    fs.existsSync(logFile)
      ? fs
          .readFileSync(logFile, 'utf8')
          .split('\n')
          .filter(Boolean)
          .map((l) => JSON.parse(l))
      : []
  return { bin, calls }
}
const comment = (login, body) => ({ body: { user: { login }, body } })

// an online check (no --offline) against the fake gh
const checkOnline = (rows, db, extra = []) => {
  const gh = fakeGh(db)
  const file = write(
    'ledger.yml',
    typeof rows === 'string' ? rows : yamlOf(rows)
  )
  const r = run([
    '--ledger',
    file,
    '--base-file',
    NO_BASE(),
    '--json',
    '--gh',
    gh.bin,
    '--owner',
    'jane-owner',
    ...extra,
  ])
  return {
    ...r,
    report: r.out.trim().startsWith('{') ? JSON.parse(r.out) : null,
    gh,
  }
}

const git = (cwd, ...args) => {
  const r = spawnSync(
    'git',
    [
      '-c',
      'user.name=ci',
      '-c',
      'user.email=ci@example.test',
      '-c',
      'commit.gpgsign=false',
      ...args,
    ],
    { cwd, encoding: 'utf8' }
  )
  if (r.status !== 0) throw new Error(`git ${args.join(' ')}: ${r.stderr}`)
  return r.stdout.trim()
}

beforeAll(() => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ad-ledger-'))
})
afterAll(() => {
  fs.rmSync(tmp, { recursive: true, force: true })
})

// ---------- the ledger ----------

describe('CI-1 accepted-diffs ledger', () => {
  test('CI-1 c1 an empty ledger passes with no network, no gh and no owner', () => {
    ;['[]\n', '# only a comment\n[]\n', '# a ledger without rows\n'].forEach(
      (text) => {
        const file = write('empty.yml', text)
        // online mode, and a gh that does not exist: nothing is looked up
        const r = run([
          '--ledger',
          file,
          '--base-file',
          NO_BASE(),
          '--gh',
          '/nonexistent/gh',
          '--status',
          path.join(tmp, 'no-status.md'),
          '--json',
        ])
        expect([text, r.code]).toEqual([text, 0])
        const report = JSON.parse(r.out)
        expect(report.ok).toBe(true)
        expect(report.rows).toBe(0)
        expect(report.signatures).toEqual({ checked: 0, skipped: 0 })
      }
    )
  })

  test('CI-1 c2 the committed ledger is valid (empty at B0)', () => {
    const r = run(['--offline', '--base-file', NO_BASE(), '--json'])
    expect(r.code).toBe(0)
    expect(JSON.parse(r.out).violations).toEqual([])
    const committed = fs.readFileSync(
      path.join(ROOT, 'test/baseline/ACCEPTED-DIFFS.yml'),
      'utf8'
    )
    expect(committed).toMatch(/^\[\]$/m)
  })

  test('CI-1 c3 a missing ledger fails', () => {
    const r = run([
      '--ledger',
      path.join(tmp, 'absent.yml'),
      '--base-file',
      NO_BASE(),
      '--json',
    ])
    expect(r.code).toBe(1)
    expect(JSON.parse(r.out).violations.map((v) => v.code)).toEqual([
      'ledger-missing',
    ])
  })

  test('CI-1 c4 a delta row and a product row with exact keys pass; counts per kind are reported', () => {
    const r = check([validRow(), productRow()])
    expect(r.code).toBe(0)
    expect(r.report.violations).toEqual([])
    expect(r.report.rows).toBe(2)
    expect(r.report.inForce).toBe(2)
    expect(r.report.counts).toEqual({ delta: 1, product: 1 })
    expect(r.report.notes.join(' ')).toMatch(
      /signatures not verified \(--offline\): AD-001, AD-002/
    )
    const text = run([
      '--ledger',
      write('two.yml', yamlOf([validRow(), productRow()])),
      '--base-file',
      NO_BASE(),
      '--offline',
    ])
    expect(text.out).toContain(
      '2 row(s), 2 in force (delta 1, product 1), 0 withdrawn'
    )
  })

  test('CI-1 c5 values stay strings: unquoted dates, numbers and flow lists are exact literals', () => {
    const text = [
      '- id: AD-001',
      '  kind: delta',
      '  test: T-603',
      '  key: 404-page@proxy/cache-control',
      '  from: <absent>',
      '  to: 200',
      '  reason: Next 12.3 adds Cache-Control',
      '  ref: [OD-39, R-083]',
      '  step: 6.3',
      '  repro: https://github.com/oacore/search/actions/runs/1',
      '  signedOffBy: Jane Owner, https://github.com/oacore/search/pull/1#issuecomment-1',
      '  date: 2026-10-20',
      '',
    ].join('\n')
    const r = check(text)
    expect(r.report.violations).toEqual([])
    expect(r.code).toBe(0)
  })

  const mutations = [
    ['an unknown key', { comment: 'x' }, 'unknown-key'],
    ['kind other than delta or product', { kind: 'framework' }, 'bad-kind'],
    ['an id without the AD prefix', { id: 'ad-001' }, 'bad-id'],
    ['an id with too few digits', { id: 'AD-1' }, 'bad-id'],
    ['a test that is not a T id', { test: 'T-60' }, 'bad-test'],
    ['a test with four digits', { test: 'T-6030' }, 'bad-test'],
    ['a star glob in the key', { key: '*@proxy/etag' }, 'glob-key'],
    [
      'a brace glob in the key',
      { key: '404-page@proxy/{etag,vary}' },
      'glob-key',
    ],
    ['padding around the key', { key: ' 404-page@proxy/etag' }, 'bad-key'],
    ['an empty key', { key: '' }, 'empty-value'],
    ['an empty from', { from: '' }, 'empty-value'],
    ['from equal to to', { to: '<absent>' }, 'no-change'],
    ['an impossible month', { date: '2026-13-01' }, 'bad-date'],
    ['a day the month does not have', { date: '2026-02-30' }, 'bad-date'],
    ['a date in another format', { date: '02/11/2026' }, 'bad-date'],
    ['an empty ref list', { ref: [] }, 'bad-ref'],
    ['a ref that is not a list', { ref: 'OD-39' }, 'bad-ref'],
    [
      'a signature without a URL',
      { signedOffBy: 'Jane Owner' },
      'bad-signature',
    ],
    [
      'a signature URL of another repository',
      {
        signedOffBy:
          'Jane, https://github.com/someone/else/pull/1#issuecomment-1',
      },
      'bad-signature',
    ],
    [
      'a signature URL without a comment anchor',
      { signedOffBy: 'Jane, https://github.com/oacore/search/pull/1' },
      'bad-signature',
    ],
    [
      'a signature URL over http',
      {
        signedOffBy:
          'Jane, http://github.com/oacore/search/pull/1#issuecomment-1',
      },
      'bad-signature',
    ],
    ['a delta row without repro', { repro: undefined }, 'missing-repro'],
    [
      'a repro that is no CI run',
      { repro: 'https://example.com/run/1' },
      'bad-repro',
    ],
    [
      'a repro run of another repository',
      { repro: 'https://github.com/someone/else/actions/runs/1' },
      'bad-repro',
    ],
    ['an empty withdrawn reason', { withdrawn: '' }, 'empty-value'],
  ]
  const requiredKeys = [
    'id',
    'kind',
    'test',
    'key',
    'from',
    'to',
    'reason',
    'ref',
    'step',
    'signedOffBy',
    'date',
  ]

  test('CI-1 c6 default deny: every malformed delta row is rejected with its code', () => {
    const results = callEach(
      'checkRow',
      mutations.map(([, over]) => [validRow(over)])
    )
    mutations.forEach(([name, , code], i) => {
      expect([name, results[i].map((e) => e.code)]).toEqual([
        name,
        expect.arrayContaining([code]),
      ])
    })
    // and the unmodified row has none
    expect(callEach('checkRow', [[validRow()]])[0]).toEqual([])
  })

  test('CI-1 c7 default deny: a row missing any required key is rejected', () => {
    const results = callEach(
      'checkRow',
      requiredKeys.map((k) => [validRow({ [k]: undefined })])
    )
    requiredKeys.forEach((k, i) => {
      const found = results[i].map((e) => e.code)
      expect([k, found]).toEqual([k, expect.arrayContaining(['missing-key'])])
      expect(results[i].some((e) => e.message === `missing key ${k}`)).toBe(
        true
      )
    })
  })

  test('CI-1 c8 a product row carries OD-31 and needs no repro; a row that is not a mapping is rejected', () => {
    const [noOd31, ok, scalar] = callEach('checkRow', [
      [productRow({ ref: ['R-089'] })],
      [productRow()],
      ['AD-003'],
    ])
    expect(noOd31.map((e) => e.code)).toEqual(['product-ref'])
    expect(ok).toEqual([])
    expect(scalar.map((e) => e.code)).toEqual(['row-shape'])
    const r = check('- AD-003\n- just text\n')
    expect(r.code).toBe(1)
    expect(codes(r)).toEqual(['row-shape', 'row-shape'])
  })

  test('CI-1 c9 YAML that is not a list of rows is a violation, not a crash', () => {
    const broken = check('- id: [unclosed\n  kind: delta\n')
    expect(broken.code).toBe(1)
    expect(codes(broken)).toEqual(['yaml'])
    const duplicated = check(yamlOf([validRow()]).concat('  kind: product\n'))
    expect(duplicated.code).toBe(1)
    expect(codes(duplicated)).toEqual(['yaml'])
    const mapping = check('id: AD-001\nkind: delta\n')
    expect(mapping.code).toBe(1)
    expect(codes(mapping)).toEqual(['not-a-list'])
  })

  test('CI-1 c10 ids are never reused; one row per (test, key) among the rows in force', () => {
    const sameId = check([
      validRow(),
      validRow({ test: 'T-610', key: 'x@y/z' }),
    ])
    expect(codes(sameId)).toEqual(['duplicate-id'])
    const sameKey = check([validRow(), validRow({ id: 'AD-003' })])
    expect(codes(sameKey)).toEqual(['duplicate-test-key'])
    // the second row replaces a withdrawn one: allowed
    const replaced = check([
      validRow({ withdrawn: 'signed for the wrong value, 2026-11-05' }),
      validRow({ id: 'AD-003', to: 'no-store' }),
    ])
    expect(replaced.report.violations).toEqual([])
    expect(replaced.report.inForce).toBe(1)
    expect(replaced.report.withdrawn).toBe(1)
    // the same key under another test is another row
    const otherTest = check([
      validRow(),
      validRow({ id: 'AD-003', test: 'T-610' }),
    ])
    expect(otherTest.report.violations).toEqual([])
  })

  test('CI-1 c11 a delta row never covers pixels, a status code or a Location', () => {
    const cases = [
      [validRow({ test: 'T-801', key: 'V01@1440' }), 'delta-never-covers'],
      [validRow({ test: 'T-802', key: 'V40@375' }), 'delta-never-covers'],
      [validRow({ key: '404-page@proxy/:status' }), 'delta-never-covers'],
      [validRow({ key: '308-slash@origin/location' }), 'delta-never-covers'],
      [
        validRow({ key: '308-slash@origin.GET/Location' }),
        'delta-never-covers',
      ],
      [
        validRow({
          test: 'T-612',
          key: '/static/search/_next/x@proxy/:status',
        }),
        'delta-never-covers',
      ],
      [
        validRow({ test: 'T-601', key: '/works/1/ status' }),
        'delta-never-covers',
      ],
      [
        validRow({ test: 'T-731', key: '/works/1/ status' }),
        'delta-never-covers',
      ],
    ]
    const results = callEach(
      'checkRow',
      cases.map(([row]) => [row])
    )
    cases.forEach(([row, code], i) => {
      expect([row.test, row.key, results[i].map((e) => e.code)]).toEqual([
        row.test,
        row.key,
        expect.arrayContaining([code]),
      ])
    })
    // allowed: a header delta, and the one status row (T-612, the image
    // optimizer, OD-41)
    const allowed = callEach('checkRow', [
      [validRow({ key: '404-page@proxy/cache-control' })],
      [
        validRow({
          test: 'T-612',
          key: '/static/search/_next/image?url=%2Fx.png&w=64&q=75/:status',
        }),
      ],
    ])
    expect(allowed).toEqual([[], []])
  })

  test('CI-1 c12 the prohibitions are those of kind: delta; a product row (D15) may cover V##@viewport', () => {
    const r = check([
      productRow(),
      productRow({
        id: 'AD-003',
        test: 'T-603',
        key: '500@proxy/:status',
        from: '500',
        to: '200',
      }),
    ])
    expect(r.report.violations).toEqual([])
    expect(r.code).toBe(0)
  })

  test('CI-1 c13 the key predicate: literals pass, patterns do not', () => {
    const cases = [
      ['404-page@proxy/etag', false],
      ['V01@1440', false],
      ['a[href]', false],
      ['/static/search/_next/image?url=%2Fx.png&w=64&q=75', false],
      ['x{1}', false],
      ['*', true],
      ['**/etag', true],
      ['404-*@proxy/etag', true],
      ['{a,b}', true],
      ['404-page@proxy/{etag,vary}', true],
    ]
    const results = callEach(
      'hasGlob',
      cases.map(([key]) => [key])
    )
    expect(results).toEqual(cases.map(([, glob]) => glob))
  })

  // ---------- append-only ----------

  test('CI-1 c14 append-only: the base rows stay a prefix, unchanged; the one edit is an added withdrawn', () => {
    const r1 = validRow()
    const r2 = productRow()
    const base = write('base.yml', yamlOf([r1]))
    const ledgerOf = (rows) => write('head.yml', yamlOf(rows))
    const against = (rows) => {
      const r = run([
        '--ledger',
        ledgerOf(rows),
        '--base-file',
        base,
        '--offline',
        '--json',
      ])
      return { code: r.code, report: JSON.parse(r.out) }
    }
    expect(against([r1]).code).toBe(0)
    expect(against([r1, r2]).code).toBe(0)
    const removed = against([])
    expect(removed.code).toBe(1)
    expect(removed.report.violations.map((v) => v.code)).toEqual([
      'append-only',
    ])
    expect(removed.report.violations[0].message).toMatch(/AD-001 was removed/)
    const edited = against([validRow({ to: 'no-store' })])
    expect(edited.code).toBe(1)
    expect(edited.report.violations[0].message).toMatch(
      /AD-001 was edited \(to\)/
    )
    const reordered = against([r2, r1])
    expect(reordered.code).toBe(1)
    expect(reordered.report.violations.map((v) => v.code)).toEqual([
      'append-only',
    ])
    const withdrawn = against([
      validRow({ withdrawn: 'wrong value, 2026-11-05' }),
      r2,
    ])
    expect(withdrawn.report.violations).toEqual([])
    expect(withdrawn.report.inForce).toBe(1)
    // a withdrawn row may not be edited again, nor un-withdrawn
    const base2 = write(
      'base2.yml',
      yamlOf([validRow({ withdrawn: 'a, 2026-11-05' })])
    )
    const second = (row) => {
      const r = run([
        '--ledger',
        write('head2.yml', yamlOf([row])),
        '--base-file',
        base2,
        '--offline',
        '--json',
      ])
      return { code: r.code, report: JSON.parse(r.out) }
    }
    expect(second(validRow({ withdrawn: 'a, 2026-11-05' })).code).toBe(0)
    expect(second(validRow({ withdrawn: 'b, 2026-11-06' })).code).toBe(1)
    expect(second(validRow()).code).toBe(1)
  })

  test('CI-1 c15 append-only: an unparsable base ledger is a violation, a missing one is the empty ledger', () => {
    const bad = write('badbase.yml', 'id: [unclosed\n')
    const r = run([
      '--ledger',
      write('head.yml', yamlOf([validRow()])),
      '--base-file',
      bad,
      '--offline',
      '--json',
    ])
    expect(r.code).toBe(1)
    expect(JSON.parse(r.out).violations.map((v) => v.code)).toEqual(['yaml'])
    expect(check([validRow()]).code).toBe(0)
  })

  test('CI-1 c16 --base compares with the merge base of HEAD and the ref', () => {
    const repo = fs.mkdtempSync(path.join(tmp, 'repo-'))
    const ledger = path.join(repo, 'test/baseline/ACCEPTED-DIFFS.yml')
    fs.mkdirSync(path.dirname(ledger), { recursive: true })
    git(repo, 'init', '-q', '-b', 'main')
    fs.writeFileSync(path.join(repo, 'README.md'), 'x\n')
    git(repo, 'add', '.')
    git(repo, 'commit', '-q', '-m', 'start')
    // main holds the ledger with one row; the topic branches here
    fs.writeFileSync(ledger, yamlOf([validRow()]))
    git(repo, 'add', '.')
    git(repo, 'commit', '-q', '-m', 'ledger with AD-001')
    git(repo, 'branch', 'topic')
    // main moves on after the branch point: the merge base, not the tip, is
    // the reference
    fs.writeFileSync(
      ledger,
      yamlOf([validRow(), productRow({ id: 'AD-003', key: 'V02@1440' })])
    )
    git(repo, 'add', '.')
    git(repo, 'commit', '-q', '-m', 'AD-003 on main')
    git(repo, 'switch', '-q', 'topic')
    const onTopic = (rows, args = ['--base', 'main']) => {
      fs.writeFileSync(ledger, yamlOf(rows))
      return run(['--ledger', ledger, ...args, '--offline', '--json'], {
        cwd: repo,
      })
    }
    expect(onTopic([validRow(), productRow()]).code).toBe(0)
    const edited = onTopic([validRow({ to: 'no-store' })])
    expect(edited.code).toBe(1)
    expect(JSON.parse(edited.out).violations[0].code).toBe('append-only')
    // an unknown ref is an error when asked for, a skipped check by default
    const unknown = onTopic([validRow()], ['--base', 'origin/nope'])
    expect(unknown.code).toBe(1)
    expect(unknown.err).toMatch(
      /--base origin\/nope: no merge base of HEAD and origin\/nope/
    )
    const implicit = onTopic([validRow()], [])
    expect(implicit.code).toBe(0)
    expect(JSON.parse(implicit.out).notes.join(' ')).toMatch(
      /append-only check skipped: no merge base of HEAD and origin\/main/
    )
  })

  test('CI-1 c16b a ledger that is new on the branch: every row is new', () => {
    const repo = fs.mkdtempSync(path.join(tmp, 'repo-'))
    const ledger = path.join(repo, 'test/baseline/ACCEPTED-DIFFS.yml')
    fs.mkdirSync(path.dirname(ledger), { recursive: true })
    git(repo, 'init', '-q', '-b', 'main')
    fs.writeFileSync(path.join(repo, 'README.md'), 'x\n')
    git(repo, 'add', '.')
    git(repo, 'commit', '-q', '-m', 'start')
    git(repo, 'switch', '-q', '-c', 'topic')
    fs.writeFileSync(ledger, yamlOf([validRow(), productRow()]))
    const r = run(
      ['--ledger', ledger, '--base', 'main', '--offline', '--json'],
      { cwd: repo }
    )
    expect(r.code).toBe(0)
    expect(JSON.parse(r.out).violations).toEqual([])
    // outside a git tree an explicit --base is an error
    const outside = run(
      ['--ledger', write('x.yml', '[]\n'), '--base', 'main', '--offline'],
      { cwd: tmp }
    )
    expect(outside.code).toBe(1)
    expect(outside.err).toMatch(
      /not a git working tree|outside the working tree/
    )
  })

  // ---------- signatures ----------

  test('CI-1 c17 a signature passes when the owner wrote a SIGNED: comment that names the row', () => {
    const r = checkOnline([validRow()], {
      4001: comment(
        'jane-owner',
        'SIGNED: AD-001 (Cache-Control on 404, Next 12.3)'
      ),
    })
    expect(r.report.violations).toEqual([])
    expect(r.code).toBe(0)
    expect(r.report.signatures).toEqual({ checked: 1, skipped: 0 })
    // the lookup is `gh api repos/oacore/search/issues/comments/<id>`, only
    expect(r.gh.calls()).toEqual([
      ['api', 'repos/oacore/search/issues/comments/4001'],
    ])
    // one comment can sign several rows, and the login case does not matter
    const many = checkOnline(
      [
        validRow(),
        productRow({
          signedOffBy:
            'Jane Owner, https://github.com/oacore/search/pull/12#issuecomment-4001',
        }),
      ],
      { 4001: comment('Jane-Owner', 'SIGNED: AD-001, AD-002') }
    )
    expect(many.report.violations).toEqual([])
    expect(many.report.signatures.checked).toBe(2)
  })

  test('CI-1 c18 a signature fails: wrong author, wrong start, another row, no such comment', () => {
    const cases = [
      [
        'written by someone else',
        comment('mallory', 'SIGNED: AD-001'),
        'signature-author',
      ],
      [
        'not starting with SIGNED:',
        comment('jane-owner', 'LGTM, SIGNED: AD-001'),
        'signature-body',
      ],
      [
        'a leading space',
        comment('jane-owner', ' SIGNED: AD-001'),
        'signature-body',
      ],
      ['lower case', comment('jane-owner', 'signed: AD-001'), 'signature-body'],
      [
        'naming another row',
        comment('jane-owner', 'SIGNED: AD-002'),
        'signature-body',
      ],
      [
        'naming a longer id',
        comment('jane-owner', 'SIGNED: AD-0010'),
        'signature-body',
      ],
      [
        'naming a longer id (prefix)',
        comment('jane-owner', 'SIGNED: XAD-001'),
        'signature-body',
      ],
      ['an empty comment', comment('jane-owner', ''), 'signature-body'],
    ]
    cases.forEach(([name, answer, code]) => {
      const r = checkOnline([validRow()], { 4001: answer })
      expect([name, r.code]).toEqual([name, 1])
      expect([name, codes(r)]).toEqual([name, [code]])
    })
    const missing = checkOnline([validRow()], {})
    expect(missing.code).toBe(1)
    expect(codes(missing)).toEqual(['signature-missing'])
    expect(missing.report.signatures.checked).toBe(1)
  })

  test('CI-1 c19 a lookup that cannot be made fails online, and is skipped (reported) with --offline', () => {
    const net = checkOnline([validRow()], { 4001: { network: true } })
    expect(net.code).toBe(1)
    expect(codes(net)).toEqual(['signature-unverifiable'])
    expect(net.report.violations[0].message).toMatch(
      /error connecting to api.github.com/
    )
    const noGh = checkOnline([validRow()], {}, ['--gh', '/nonexistent/gh'])
    expect(noGh.code).toBe(1)
    expect(codes(noGh)).toEqual(['signature-unverifiable'])
    expect(noGh.report.violations[0].message).toMatch(/is not installed/)
    const off = check([validRow()], ['--gh', '/nonexistent/gh'])
    expect(off.code).toBe(0)
    expect(off.report.signatures).toEqual({ checked: 0, skipped: 1 })
    expect(off.report.notes.join(' ')).toMatch(
      /signatures not verified \(--offline\): AD-001/
    )
  })

  test('CI-1 c20 withdrawn rows keep their signature check', () => {
    const r = checkOnline(
      [validRow({ withdrawn: 'wrong value, 2026-11-05' })],
      {
        4001: comment('mallory', 'SIGNED: AD-001'),
      }
    )
    expect(r.code).toBe(1)
    expect(codes(r)).toEqual(['signature-author'])
  })

  test('CI-1 c21 the owner login comes from STATUS §1 People unless --owner is given', () => {
    const rows = [validRow()]
    const db = { 4001: comment('jane-owner', 'SIGNED: AD-001') }
    const ledger = write('ledger.yml', yamlOf(rows))
    const withStatus = (status) => {
      const gh = fakeGh(db)
      const r = run([
        '--ledger',
        ledger,
        '--base-file',
        NO_BASE(),
        '--json',
        '--gh',
        gh.bin,
        '--status',
        write('status.md', status),
      ])
      return { code: r.code, report: JSON.parse(r.out) }
    }
    const row = (people) =>
      `|Item|Value|\n|-|-|\n|People|${people}|\n|Baseline|x|\n`
    const filled = withStatus(
      row(
        'Owner: Jane Owner (@jane-owner); Reviewer (second engineer): Sam Two (@sam-two); channel: #search'
      )
    )
    expect(filled.code).toBe(0)
    expect(
      withStatus(row('Owner: Jane Owner (jane-owner); Reviewer: x (y)')).code
    ).toBe(0)
    const placeholder = withStatus(
      row(
        'Owner: _; Reviewer (second engineer): _ (name and GitHub login each, used by the 42 §8 signature check)'
      )
    )
    expect(placeholder.code).toBe(1)
    expect(placeholder.report.violations.map((v) => v.code)).toEqual([
      'owner-unknown',
    ])
    expect(placeholder.report.violations[0].message).toMatch(
      /owner is not filled in yet/
    )
    const noLogin = withStatus(
      row('Owner: Jane Owner; Reviewer: Sam Two (@sam-two)')
    )
    expect(noLogin.code).toBe(1)
    expect(noLogin.report.violations[0].message).toMatch(
      /no GitHub login for the owner/
    )
    const noRow = withStatus('|Item|Value|\n|-|-|\n|Baseline|x|\n')
    expect(noRow.report.violations[0].message).toMatch(/no People row/)
    // another person's login in the same row is not the owner's
    const reviewerOnly = withStatus(
      row('Owner: Jane Owner (@somebody-else); Reviewer: Sam Two (@jane-owner)')
    )
    expect(reviewerOnly.code).toBe(1)
    expect(codes({ report: reviewerOnly.report })).toEqual(['signature-author'])
  })

  test('CI-1 c22 ownerFromStatus reads only the Owner entry', () => {
    const people = (text) => `|People|${text}|`
    const [a, b, c, d] = callEach('ownerFromStatus', [
      [people('Owner: Jane Owner (@jane-owner); Reviewer: Sam (@sam)')],
      [people('Owner: Jane; Reviewer: Sam (@sam)')],
      [people('Owner: _; Reviewer: _')],
      ['no table here'],
    ])
    expect(a).toEqual({ login: 'jane-owner' })
    expect(b.error).toMatch(/no GitHub login for the owner/)
    expect(c.error).toMatch(/not filled in yet/)
    expect(d.error).toMatch(/no People row/)
  })

  // ---------- command line ----------

  test('CI-1 c23 usage errors exit 2', () => {
    expect(run(['--bogus']).code).toBe(2)
    expect(run(['--ledger']).code).toBe(2)
    expect(run(['--base', 'main', '--base-file', 'x']).code).toBe(2)
    expect(run(['positional']).code).toBe(2)
  })
})
