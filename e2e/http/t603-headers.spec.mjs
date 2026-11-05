// T-603 (41 G; R-026, R-083; S-6; 42 §8): the header contract. Every route class (HTML gSSP and gIP-only,
// _next/data, public/, _next/static, .map, icons.svg, 308, 404, 500, healthz), at the origin (the app's own
// listener) and through the proxy, for GET, HEAD, a conditional GET with the returned ETag and
// Accept-Encoding: br, gzip, equals e2e/http/contract.baseline.json (date ignored; etag, content-length and
// last-modified, the mtime of the build tree, as presence). c2: deltas pass only as rows of test/baseline/ACCEPTED-DIFFS.yml (OD-39, default deny). c3: the
// production CSP on every class. c4: the executable inline-script count of every HTML response.
// Record mode (`npm run e2e:record`, RECORD=1) writes the baseline instead of comparing (c1); golden
// re-captures it at 2.5. Requests are raw node:http (exact request headers, undecoded bodies).
import path from 'node:path'
import { test, expect } from '../fixtures/guard.mjs'
import {
  ROUTES,
  CLASSES,
  CASES,
  BASELINE_FILE,
  IGNORED,
  PRESENCE_ONLY,
  NEVER_COVERED,
  capture,
  baselineRows,
  diffRows,
  readLedger,
  applyLedger,
  productionCsp,
} from '../lib/P0-11/contract.mjs'
import {
  RECORD,
  LINK,
  REPO,
  readJson,
  writeJsonPretty,
  referenceOf,
} from '../lib/P0-11/files.mjs'

const OUT = process.env.CONTRACT_BASELINE_OUT
  ? path.resolve(process.env.CONTRACT_BASELINE_OUT)
  : BASELINE_FILE
const loadBaseline = () => {
  const b = readJson(OUT, null)
  if (!b)
    throw new Error(
      `${path.relative(
        REPO,
        OUT
      )} is missing: record it with npm run e2e:record -- --run <id> --provisional --project chromium -g 'T-603'`
    )
  return b
}
// conditional GETs answered by the static file server (send) drop every content-* header, CSP included (it
// removes the content header fields on 304); pinned as today's behaviour
const STATIC_304_WITHOUT_CSP = [
  ...['public', 'next-static', 'map', 'icons-svg'].flatMap((r) =>
    ['origin', 'proxy'].map((v) => `${r}@${v}.conditional`)
  ),
  // Next 13.5's trailing-slash 308s carry no CSP (AD-177)
  ...['origin', 'proxy'].flatMap((v) =>
    ['GET', 'HEAD', 'br-gzip'].map((c) => `308-slash@${v}.${c}`)
  ),
].sort()

test.describe('T-603 @P0 header contract', () => {
  test.describe.configure({ timeout: 300000 })

  test('T-603 c1 @P0 status and every header per route class, origin and proxy, GET, HEAD, conditional GET, br/gzip = contract.baseline.json', async ({
    p2Env,
  }) => {
    const { rows } = await capture(p2Env)
    // every class, both vias, every applicable case was exercised
    expect([...new Set(rows.map((r) => r.class))].sort()).toEqual(
      [...CLASSES].sort()
    )
    for (const r of ROUTES)
      for (const via of ['origin', 'proxy']) {
        const cases = rows
          .filter((x) => x.route === r.route && x.via === via)
          .map((x) => x.case)
        expect(cases.filter((c) => c !== 'conditional')).toEqual(
          CASES.filter((c) => c !== 'conditional')
        )
      }
    if (RECORD) {
      writeJsonPretty(OUT, {
        link: LINK,
        reference: { test: 'T-603', ...referenceOf(p2Env) },
        rules: {
          ignored: IGNORED,
          presenceOnly: PRESENCE_ONLY,
          neverCovered: NEVER_COVERED,
          ledger: 'test/baseline/ACCEPTED-DIFFS.yml',
        },
        routes: baselineRows(rows),
      })
      test.info().annotations.push({
        type: 'record',
        description: `${path.relative(REPO, OUT)}: ${
          rows.length
        } rows (${LINK})`,
      })
      return
    }
    const baseline = loadBaseline()
    // the proxy table must be the one the baseline was captured with (CS-OPS-1 overlay or not)
    expect(p2Env.proxy ? p2Env.proxy.overlay : null).toBe(
      baseline.reference.proxyOverlay
    )
    const diffs = diffRows(baseline.routes, baselineRows(rows))
    const ledger = readLedger()
    const { remaining, used } = applyLedger(diffs, ledger.rows)
    test.info().annotations.push({
      type: 'contract',
      description: `${rows.length} rows; ${diffs.length} diffs; ledger ${
        ledger.present ? 'present' : 'absent'
      }, rows used ${JSON.stringify(used)}`,
    })
    expect(remaining).toEqual([])
  })

  test('T-603 c2 @P0 deltas only as AD rows (OD-39): default deny, exact test/key/from/to, never a status or a Location', async () => {
    // the ledger in force (absent before 2.5 = empty) is a list of rows with the 42 §8 fields
    const ledger = readLedger()
    for (const row of ledger.rows.filter((r) => r && r.test === 'T-603')) {
      for (const f of ['id', 'kind', 'test', 'key', 'from', 'to'])
        expect(row, `${row.id} ${f}`).toHaveProperty(f)
      expect(['delta', 'product']).toContain(row.kind)
    }
    // the baseline declares the 42 §8 rules and holds no ignored header and only presence for etag,
    // content-length and last-modified (P0-11-5)
    if (!RECORD) {
      const baseline = loadBaseline()
      expect(baseline.rules.ignored).toEqual(['date'])
      expect(baseline.rules.presenceOnly).toEqual([
        'etag',
        'content-length',
        'last-modified',
      ])
      for (const row of baseline.routes) {
        expect(row.expect.headers).not.toHaveProperty('date')
        for (const h of PRESENCE_ONLY)
          for (const v of row.expect.headers[h] || [])
            expect(v).toBe('<present>')
      }
    }
    // the matcher itself: one synthetic delta per rule
    const d = (header, from, to, kase = 'GET') => ({
      id: `404-page@origin.${kase}`,
      route: '404-page',
      via: 'origin',
      case: kase,
      header,
      from,
      to,
    })
    const cc = 'private, no-cache, no-store, max-age=0, must-revalidate'
    const row = (over) => ({
      id: 'AD-900',
      kind: 'delta',
      test: 'T-603',
      key: '404-page@origin/cache-control',
      from: '<absent>',
      to: cc,
      ...over,
    })
    const left = (diffs, rows) =>
      applyLedger(diffs, rows).remaining.map((x) => x.header)
    // default deny: no row, no pass
    expect(left([d('cache-control', '<absent>', cc)], [])).toEqual([
      'cache-control',
    ])
    // exact row passes, for every case when the key has no case
    expect(
      left(
        [
          d('cache-control', '<absent>', cc),
          d('cache-control', '<absent>', cc, 'HEAD'),
        ],
        [row()]
      )
    ).toEqual([])
    // a key with a case covers that case only
    expect(
      left(
        [
          d('cache-control', '<absent>', cc),
          d('cache-control', '<absent>', cc, 'HEAD'),
        ],
        [row({ key: '404-page@origin.HEAD/cache-control' })]
      )
    ).toEqual(['cache-control'])
    // from or to differ, another test, withdrawn: no pass
    expect(
      left([d('cache-control', '<absent>', cc)], [row({ from: 'no-cache' })])
    ).toEqual(['cache-control'])
    expect(
      left([d('cache-control', '<absent>', cc)], [row({ to: 'no-store' })])
    ).toEqual(['cache-control'])
    expect(
      left([d('cache-control', '<absent>', cc)], [row({ test: 'T-601' })])
    ).toEqual(['cache-control'])
    expect(
      left(
        [d('cache-control', '<absent>', cc)],
        [row({ withdrawn: 'superseded, 2026-10-20' })]
      )
    ).toEqual(['cache-control'])
    // a status code or a Location is never covered
    expect(
      left(
        [d(':status', '404', '200'), d('location', '/a', '/b')],
        [
          row({ key: '404-page@origin/:status', from: '404', to: '200' }),
          row({
            id: 'AD-901',
            key: '404-page@origin/location',
            from: '/a',
            to: '/b',
          }),
        ]
      )
    ).toEqual([':status', 'location'])
    // a composite key covers each listed key exactly (here 404-page@origin), never one it does not list, and
    // never a status code
    const other = (header, from, to) => ({
      ...d(header, from, to),
      id: '404-page@proxy.GET',
      via: 'proxy',
    })
    expect(
      left(
        [d('cache-control', '<absent>', cc)],
        [
          row({
            key: '500@origin/cache-control, 404-page@origin/cache-control',
          }),
        ]
      )
    ).toEqual([])
    expect(
      left(
        [other('cache-control', '<absent>', cc)],
        [
          row({
            key: '500@origin/cache-control, 404-page@origin/cache-control',
          }),
        ]
      )
    ).toEqual(['cache-control'])
    expect(
      left(
        [d(':status', '404', '200')],
        [
          row({
            key: '404-page@origin/cache-control, 404-page@origin/:status',
            from: '404',
            to: '200',
          }),
        ]
      )
    ).toEqual([':status'])
    // a header the baseline lacks, or a row the capture lacks, is a diff too
    const base = [
      {
        id: 'x@origin.GET',
        route: 'x',
        via: 'origin',
        case: 'GET',
        expect: { status: 200, headers: { vary: ['Accept-Encoding'] } },
      },
    ]
    expect(
      diffRows(base, [
        {
          ...base[0],
          expect: {
            status: 200,
            headers: { 'vary': ['Accept-Encoding'], 'x-new': ['1'] },
          },
        },
      ]).map((x) => [x.header, x.from, x.to])
    ).toEqual([['x-new', '<absent>', '1']])
    expect(diffRows(base, []).map((x) => x.header)).toEqual([':row'])
  })

  test('T-603 c3 @P0 the production CSP on every route class, origin and proxy', async ({
    p2Env,
  }) => {
    const { policy } = productionCsp(p2Env.build && p2Env.build.dir)
    expect(policy).toMatch(/^default-src 'self' /)
    const { rows } = await capture(p2Env)
    const without = []
    for (const r of rows) {
      const csp = r._raw.headers['content-security-policy']
      if (!csp) {
        without.push(r.id)
        continue
      }
      expect(csp, r.id).toEqual([policy])
    }
    // every class carries it on GET, HEAD and br/gzip; only the static 304s drop it
    expect(without.sort()).toEqual(STATIC_304_WITHOUT_CSP)
    // every class but 308-slash has a response with CSP (AD-177)
    for (const cls of CLASSES.filter((c) => c !== '308-slash'))
      expect(
        rows.filter(
          (r) => r.class === cls && r._raw.headers['content-security-policy']
        ).length,
        cls
      ).toBeGreaterThan(0)
  })

  test('T-603 c4 @P0 executable inline-script count of every HTML response (S-6)', async ({
    p2Env,
  }) => {
    const { rows } = await capture(p2Env)
    const counted = rows.filter((r) => r.expect.inlineScripts !== undefined)
    // HTML gSSP, gIP-only, both 404s and the 500, origin and proxy
    expect(counted.map((r) => r.id).sort()).toEqual(
      ['html-gssp', 'html-gip', '404-page', '404-notfound', '500']
        .flatMap((r) => ['origin', 'proxy'].map((v) => `${r}@${v}.GET`))
        .sort()
    )
    const actual = Object.fromEntries(
      counted.map((r) => [r.id, r.expect.inlineScripts])
    )
    test.info().annotations.push({
      type: 'inline-scripts',
      description: JSON.stringify(actual),
    })
    if (RECORD) {
      for (const v of Object.values(actual))
        expect(Number.isInteger(v)).toBe(true)
      return
    }
    const baseline = loadBaseline()
    const expected = Object.fromEntries(
      baseline.routes
        .filter((r) => r.expect.inlineScripts !== undefined)
        .map((r) => [r.id, r.expect.inlineScripts])
    )
    expect(actual).toEqual(expected)
  })
})
