// T-601 (41 G, R-005, R-020, R-045, R-085): route/status matrix through the gateway-faithful proxy. c1 the
// findings/02 §4.1 URLs with and without the trailing slash and with their query parameters (status,
// Location, page marker), corrected by review:ui-flows §1 and Q-001, Q-002, Q-005, Q-073, Q-098; c2 the extra
// list, each with the upstream calls the SSR stub records (T-607 wire log); c3 the SSR 500 fixtures; c4 the
// local-only pages through the allow-all proxy; c5 the public client source maps (S-9). Tables:
// e2e/lib/P0-09/routes.mjs; fixtures test/fixtures/{api,hand}/** incl. req-P0-09.
import fs from 'node:fs'
import path from 'node:path'
import { test, expect } from '../lib/P0-09/fixtures.mjs'
import { withWireCapture } from '../fixtures/guard.mjs'
import {
  C1_ROWS,
  C1_ASSETS,
  C2_ROWS,
  C3_ROWS,
  C4_ROWS,
  M,
  probe,
  view,
  expected,
} from '../lib/P0-09/routes.mjs'

const assetUrls = (html) => {
  const out = new Set()
  for (const m of html.matchAll(
    /(?:src|href)="(\/static\/search\/_next\/static\/[^"]+\.(?:js|css|png|svg|gif|jpg))"/g
  ))
    out.add(m[1])
  return [...out]
}

test.describe('T-601 @P0 route/status matrix', () => {
  // several page loads or ~70 sequential requests per test; the machine runs other stacks in parallel
  test.describe.configure({ timeout: 120000 })

  test('T-601 c1 @P0 findings/02 §4.1 URLs ± slash, with queries: status, Location, marker', async ({
    request,
    p2Env,
  }) => {
    const actual = []
    const want = []
    for (const row of C1_ROWS) {
      const p = await probe(request, p2Env.baseURL, row.path)
      actual.push(view(row, p))
      want.push(expected(row))
    }
    for (const row of C1_ASSETS) {
      const p = await probe(request, p2Env.baseURL, row.path)
      actual.push(view(row, p))
      want.push(expected(row))
    }
    expect(actual).toEqual(want)

    // build-hashed assets of the search page: chunks, CSS and next-images files under /static/search/_next
    const html = (await probe(request, p2Env.baseURL, '/search/?q=climate'))
      .body
    const urls = assetUrls(html)
    const kinds = { js: 0, css: 0, image: 0 }
    const assets = []
    for (const u of urls) {
      const p = await probe(request, p2Env.baseURL, u)
      const kind = /\.js$/.test(u) ? 'js' : /\.css$/.test(u) ? 'css' : 'image'
      kinds[kind] += 1
      assets.push([
        kind,
        p.status,
        p.location,
        (p.contentType || '').split(';')[0],
      ])
    }
    const typeOf = {
      js: 'application/javascript',
      css: 'text/css',
    }
    expect(
      assets.map(([k, s, l, ct]) => [k, s, l, k === 'image' ? 'image' : ct])
    ).toEqual(
      assets.map(([k]) => [k, 200, null, k === 'image' ? 'image' : typeOf[k]])
    )
    expect(
      assets.filter(([k, , , ct]) => k === 'image' && !/^image\//.test(ct))
    ).toEqual([])
    expect(kinds.js).toBeGreaterThan(0)
    expect(kinds.css).toBeGreaterThan(0)
    expect(kinds.image).toBeGreaterThan(0)

    // the client data path of the search page (T-604 covers the other _next/data cases)
    const buildId = /"buildId":"([^"]+)"/.exec(html)[1]
    const data = await probe(
      request,
      p2Env.baseURL,
      `/static/search/_next/data/${buildId}/search.json?q=climate`
    )
    // the client asks under /static/search from Next 15 (CS-N15-3); JSON with a charset (W7a)
    expect([
      data.status,
      data.contentType,
      data.body.includes(M.nextData),
    ]).toEqual([200, 'application/json; charset=utf-8', true])
  })

  test('T-601 c2 @P0 @wire extra list with its T-607 upstream calls', async ({
    request,
    p2Env,
  }) => {
    const actual = []
    const want = []
    for (const row of C2_ROWS) {
      const { result, records } = await withWireCapture(p2Env, () =>
        probe(request, p2Env.baseURL, row.path)
      )
      const upstream = records
        .map((r) => [r.method, r.url, r.bodyText ?? null])
        .sort((a, b) =>
          a.join(' ') < b.join(' ') ? -1 : a.join(' ') > b.join(' ') ? 1 : 0
        )
      actual.push({
        path: row.path,
        status: result.status,
        marker: result.text.includes(row.marker) ? row.marker : null,
        upstream,
      })
      want.push({
        path: row.path,
        status: row.status,
        marker: row.marker,
        upstream: [...row.upstream].sort((a, b) =>
          a.join(' ') < b.join(' ') ? -1 : a.join(' ') > b.join(' ') ? 1 : 0
        ),
      })
    }
    expect(actual).toEqual(want)
  })

  test('T-601 c3 @P0 500 fixtures W-410-*, W-emptydate, W-nodp, O-nofulltext', async ({
    request,
    p2Env,
  }) => {
    const actual = []
    for (const row of C3_ROWS) {
      const p = await probe(request, p2Env.baseURL, row.path)
      actual.push([
        row.fixture,
        p.status,
        p.title,
        p.text.includes(row.marker),
        p.text.includes(M.error500),
      ])
    }
    // the 500 rows: Next's built-in error page in the layout (no pages/_error, Q-098), title as on 10.2.3;
    // W-410-* and W-emptydate render their page with 200 since the owner fix 978c6e4
    expect(actual).toEqual(
      C3_ROWS.map((row) => [
        row.fixture,
        row.status,
        row.title,
        true,
        row.status === 500,
      ])
    )
  })

  test('T-601 c4 @P0 local-only pages via the allow-all proxy', async ({
    request,
    p2Env,
  }) => {
    const actual = []
    const want = []
    for (const row of C4_ROWS) {
      const p = await probe(request, p2Env.allowURL, row.path)
      actual.push(view(row, p))
      want.push(expected(row))
    }
    expect(actual).toEqual(want)
    // the same paths are not routed by the gateway (c1 rows "other service")
    for (const row of C4_ROWS) {
      const p = await probe(request, p2Env.baseURL, row.path)
      expect([row.path, p.status, p.body]).toEqual([
        row.path,
        404,
        'other service\n',
      ])
    }
  })

  test('T-601 c5 @P0 .map 200 (S-9)', async ({ request, p2Env }) => {
    // the maps of the served build (.next/static of the run's build; NEXT_DIR for an extracted image)
    const nextDir =
      process.env.NEXT_DIR ||
      (p2Env.build && p2Env.build.dir && path.join(p2Env.build.dir, '.next'))
    expect(nextDir, 'the run has no .next to list the maps from').toBeTruthy()
    const staticDir = path.join(nextDir, 'static')
    const walk = (d) =>
      fs
        .readdirSync(d, { withFileTypes: true })
        .flatMap((e) =>
          e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]
        )
    const maps = walk(staticDir)
      .filter((f) => f.endsWith('.map'))
      .map((f) => path.relative(staticDir, f).split(path.sep).join('/'))
      .sort()
    // S-9: 27 JS and 8 CSS maps
    expect([
      maps.filter((m) => m.endsWith('.js.map')).length,
      maps.filter((m) => m.endsWith('.css.map')).length,
    ]).toEqual([22, 8]) // AD-102
    const rows = []
    for (const m of maps) {
      const asset = `/static/search/_next/static/${m.slice(0, -'.map'.length)}`
      const a = await probe(request, p2Env.baseURL, asset)
      const p = await probe(request, p2Env.baseURL, `${asset}.map`)
      let json = null
      try {
        json = JSON.parse(p.body)
      } catch {
        json = null
      }
      const comment = m.endsWith('.css.map')
        ? `/*# sourceMappingURL=${path.posix.basename(m)}*/`
        : `//# sourceMappingURL=${path.posix.basename(m)}`
      const sources =
        json && Array.isArray(json.sources) ? json.sources.length : null
      const content = json && json.sourcesContent
      rows.push([
        m,
        a.status,
        a.body.trimEnd().endsWith(comment),
        p.status,
        p.contentType,
        sources === 0
          ? 'empty'
          : !json || (Array.isArray(content) && content.length > sources)
            ? false
            : json.sources.filter(
                (s, i) =>
                  !Array.isArray(content) || typeof content[i] !== 'string'
              ),
      ])
    }
    // every map with sources carries their full sourcesContent: the 6th field lists the sources without
    // content (also those past the end of sourcesContent; false for more entries than sources); the one
    // exception is the map of the empty CSS-extraction chunk `<hash>_CSS.<hash>.js` (no sources, no
    // sourcesContent; P0-09 issues)
    // AD-199: on Next 13.5 every .js map lists the SWC minifier's output `<anon>` without content, the _app map
    // also the empty module react-cookie/es6/types.js and the webpack runtime map its three startup entries
    // AD-206: on Next 14.2 no map lists <anon>; the other entries stay as above
    const withoutContent = (m) =>
      /^chunks\/pages\/_app-[0-9a-f]{16}\.js\.map$/.test(m)
        ? ['webpack://_N_E/./node_modules/react-cookie/es6/types.js']
        : /^chunks\/webpack-[0-9a-f]{16}\.js\.map$/.test(m)
          ? [
              'webpack://_N_E/webpack/before-startup',
              'webpack://_N_E/webpack/startup',
              'webpack://_N_E/webpack/after-startup',
            ]
          : []
    const isEmptyCssChunk = (m) =>
      /^chunks\/[0-9a-f]+_CSS\.[0-9a-f]+\.js\.map$/.test(m)
    expect(maps.filter(isEmptyCssChunk).length).toBe(0) // AD-056
    expect(rows).toEqual(
      maps.map((m) => [
        m,
        200,
        true,
        200,
        'application/json; charset=UTF-8',
        isEmptyCssChunk(m) ? 'empty' : withoutContent(m), // AD-199
      ])
    )
  })
})
