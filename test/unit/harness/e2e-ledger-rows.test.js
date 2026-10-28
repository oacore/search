// The AD rows of a recorded e2e baseline (42 §8): known answers and negative
// controls of e2e/lib/P0-10/ledger-rows.mjs, the rules the e2e baseline hooks
// (e2e/lib/P0-10/baseline.mjs expectBaseline and expectSnapshot) apply. A row
// of the running test, in force, whose key names the baseline file replaces
// its literal `from` by its `to` at every occurrence; a withdrawn row, a row
// of another test or a key that does not name the file applies nothing; a
// JSON baseline row with a quote or backslash is refused; any other
// difference still fails.
// Oracle: the expected rows, texts and comparisons are written out per case,
// not derived from the module.
const path = require('path')
const { pathToFileURL } = require('url')
const { spawnSync } = require('child_process')

const ROOT = path.resolve(__dirname, '..', '..', '..')
const MODULE = path.join(ROOT, 'e2e', 'lib', 'P0-10', 'ledger-rows.mjs')

// calls of the module in a child process (an ES module; Jest runs CommonJS):
// [fn, ...args] with `info` = { title, annotations: [] } built from the title
// -> [{ value, annotations } | { error }]
const callEach = (calls) => {
  const code = `import(${JSON.stringify(
    pathToFileURL(MODULE).href
  )}).then((m) => {
    const { isDeepStrictEqual } = require('node:util')
    const fns = {
      ...m,
      // the comparison of expectBaseline: rows of the file, applied to the
      // baseline, then deep equality with the value
      compare: (file, info, rows, baseline, value) => {
        const own = m.ledgerRowsOf(file, info, rows)
        const expected = own.length
          ? m.applyLedgerRowsToJson(baseline, own, info)
          : baseline
        return isDeepStrictEqual(JSON.parse(JSON.stringify(value)), expected)
      },
    }
    // the argument list of each function, with the test info in its place
    const argsOf = {
      testIdOf: (a, info) => [info],
      ledgerRowsOf: ([file, rows], info) => [file, info, rows],
      applyLedgerRows: (a, info) => [...a, info],
      applyLedgerRowsToJson: (a, info) => [...a, info],
      compare: ([file, ...rest], info) => [file, info, ...rest],
    }
    const out = JSON.parse(process.argv[1]).map(([fn, title, ...args]) => {
      const info = { title, annotations: [] }
      try {
        const value = fns[fn](...argsOf[fn](args, info))
        return {
          value,
          annotations: info.annotations.map((a) => a.type + ' ' + a.description),
        }
      } catch (e) {
        return { error: e.message }
      }
    })
    process.stdout.write(JSON.stringify(out))
  })`
  const r = spawnSync(process.execPath, ['-e', code, JSON.stringify(calls)], {
    encoding: 'utf8',
  })
  if (r.status !== 0) throw new Error(r.stderr)
  return JSON.parse(r.stdout)
}

const TITLE = 'T-610 c3 @P0 app stdout/stderr census'
const row = (over = {}) => ({
  id: 'AD-901',
  kind: 'product',
  test: 'T-610',
  key: 'c.json',
  from: '    at i.It (<build>/m.js:<line>:<col>)',
  to: '    at i.Kt (<build>/m.js:<line>:<col>)',
  ...over,
})

describe('e2e baseline ledger hook (42 §8)', () => {
  test('the T-### id comes from the start of the title only', () => {
    const titles = [
      TITLE,
      'T-610',
      'T-6100 c1 x',
      'x T-610 c3',
      'T-61 c3',
      'census c3',
    ]
    expect(
      callEach(titles.map((t) => ['testIdOf', t])).map((r) => r.value)
    ).toEqual(['T-610', 'T-610', null, null, null, null])
  })

  test('the rows of a file: the running test, in force, a key that names the file', () => {
    const rows = [
      row({ id: 'AD-901' }),
      row({ id: 'AD-902', key: 'c.json, frame O' }),
      row({ id: 'AD-903', key: 'frame O, c.json' }),
      row({ id: 'AD-904', withdrawn: 'superseded, 2026-10-28' }),
      row({ id: 'AD-905', test: 'T-702' }),
      row({ id: 'AD-906', key: 'd.json' }),
      row({ id: 'AD-907', key: 'c' }),
      row({ id: 'AD-908', key: 'xc.json' }),
      row({ id: 'AD-909', key: 'c.json,frame O' }),
      row({ id: 'AD-910', key: 'c.json frame O' }),
      null,
    ]
    const ids = (r) => r.value.map((x) => x.id)
    const [own, other, none, untitled] = callEach([
      ['ledgerRowsOf', TITLE, 'c.json', rows],
      ['ledgerRowsOf', TITLE, 'd.json', rows],
      ['ledgerRowsOf', TITLE, 'e.json', rows],
      ['ledgerRowsOf', 'census c3', 'c.json', rows],
    ])
    expect(ids(own)).toEqual(['AD-901', 'AD-902', 'AD-903'])
    expect(ids(other)).toEqual(['AD-906'])
    expect(ids(none)).toEqual([])
    expect(ids(untitled)).toEqual([])
  })

  test('a row replaces its literal at every occurrence, in order, and is annotated with the count', () => {
    const r1 = { id: 'AD-901', from: 'It', to: 'Kt' }
    const r2 = { id: 'AD-902', from: 'i.O', to: 'i.g' }
    const out = callEach([
      ['applyLedgerRows', TITLE, 'at i.It; at i.O', [r1, r2]],
      ['applyLedgerRows', TITLE, 'It It', [r1]],
      ['applyLedgerRows', TITLE, 'at i.g', [r1, r2]],
      // the literal is text, not a line: it is replaced inside a longer line
      ['applyLedgerRows', TITLE, 'xIty', [r1]],
      ['applyLedgerRows', TITLE, 'at i.It', []],
    ])
    expect(out).toEqual([
      {
        value: 'at i.Kt; at i.g',
        annotations: ['ledger AD-901 x1', 'ledger AD-902 x1'],
      },
      { value: 'Kt Kt', annotations: ['ledger AD-901 x2'] },
      {
        value: 'at i.g',
        annotations: ['ledger AD-901 x0', 'ledger AD-902 x0'],
      },
      { value: 'xKty', annotations: ['ledger AD-901 x1'] },
      { value: 'at i.It', annotations: [] },
    ])
  })

  test('a JSON baseline row: replaced inside the JSON strings; a quote or a backslash is refused', () => {
    const baseline = { lines: ['    at i.It (<build>/m.js:<line>:<col>)', 'x'] }
    const out = callEach([
      ['applyLedgerRowsToJson', TITLE, baseline, [row()]],
      ['applyLedgerRowsToJson', TITLE, baseline, [row({ from: 'i.It"' })]],
      ['applyLedgerRowsToJson', TITLE, baseline, [row({ to: 'i.Kt\\' })]],
      [
        'applyLedgerRowsToJson',
        TITLE,
        baseline,
        [row({ id: 'AD-902', from: 'x', to: 'y' }), row({ from: '"x"' })],
      ],
    ])
    expect(out).toEqual([
      {
        value: { lines: ['    at i.Kt (<build>/m.js:<line>:<col>)', 'x'] },
        annotations: ['ledger AD-901 x1'],
      },
      {
        error:
          'AD-901: from/to of a JSON baseline row hold a quote or backslash',
      },
      {
        error:
          'AD-901: from/to of a JSON baseline row hold a quote or backslash',
      },
      {
        error:
          'AD-901: from/to of a JSON baseline row hold a quote or backslash',
      },
    ])
  })

  test('negative controls: the comparison passes with exactly the rows in force of the test and the file, and fails on anything else', () => {
    const rowIt = row({ id: 'AD-901', key: 'c.json, frame It' })
    const rowO = row({
      id: 'AD-902',
      key: 'c.json, frame O',
      from: '    at i.O (<build>/m.js:<line>:<col>)',
      to: '    at i.g (<build>/m.js:<line>:<col>)',
    })
    const lines = (...l) => ({
      sweep: [{ id: 'p', lines: ['URIError', ...l] }],
    })
    const It = '    at i.It (<build>/m.js:<line>:<col>)'
    const Kt = '    at i.Kt (<build>/m.js:<line>:<col>)'
    const O = '    at i.O (<build>/m.js:<line>:<col>)'
    const g = '    at i.g (<build>/m.js:<line>:<col>)'
    const baseline = lines(It, O)
    const value = lines(Kt, g)
    const cases = [
      // both rows: the value with both new names passes, annotated
      [[rowIt, rowO], baseline, value, true],
      // a row missing, withdrawn, of another test or not naming the file
      [[rowIt], baseline, value, false],
      [
        [rowIt, { ...rowO, withdrawn: 'superseded, 2026-10-28' }],
        baseline,
        value,
        false,
      ],
      [[rowIt, { ...rowO, test: 'T-702' }], baseline, value, false],
      [[rowIt, { ...rowO, key: 'd.json, frame O' }], baseline, value, false],
      // an extra difference beside the accepted ones
      [[rowIt, rowO], baseline, lines(Kt, g, 'extra'), false],
      [[rowIt, rowO], baseline, lines(Kt, g.replace('m.js', 'n.js')), false],
      // the old value no longer passes once the rows apply
      [[rowIt, rowO], baseline, baseline, false],
      // every occurrence is replaced: a value with one old name left fails
      [[rowIt], lines(It, It), lines(Kt, It), false],
      [[rowIt], lines(It, It), lines(Kt, Kt), true],
      // no row: the recorded baseline itself
      [[], baseline, baseline, true],
      [[], baseline, value, false],
    ]
    const out = callEach(
      cases.map(([rows, b, v]) => ['compare', TITLE, 'c.json', rows, b, v])
    )
    expect(out.map((r) => r.value)).toEqual(cases.map((c) => c[3]))
    expect(out[0].annotations).toEqual(['ledger AD-901 x1', 'ledger AD-902 x1'])
    // a title without the test id applies no row
    const [untitled] = callEach([
      ['compare', 'census c3', 'c.json', [rowIt, rowO], baseline, value],
    ])
    expect(untitled.value).toBe(false)
  })
})
