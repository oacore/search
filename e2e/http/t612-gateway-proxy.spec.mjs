// T-612 (41 G, R-020, R-068, R-072): the gateway-equivalent proxy. c1: generated from
// kube/{prod,stage}/httproute.yaml, which differ only in namespace and hostnames, and the running proxy serves
// that table; c2: the acceptance table through the running gateway-faithful proxy (raw target, element-wise
// longest prefix, ReplacePrefixMatch, other service).
import { test, expect, stubControl } from '../fixtures/guard.mjs'
import {
  compareEnvs,
  routeTable,
  ACCEPTANCE,
  longUrl,
  DEBUG_HEADER,
} from '../proxy/generate.mjs'

// a local SVG through the image endpoint, in its trailing-slash form
const SVG_IMAGE =
  '/static/search/_next/image/?url=%2Fstatic%2Fimages%2FerrorCard.svg&w=64&q=75'
const SLASH_308_BYTES = 'body length in bytes of the 308 of /works/1001'

test.describe('T-612 @P0 gateway proxy', () => {
  test('T-612 c1 @P0 generated from kube/{prod,stage}/httproute.yaml, which differ only in namespace and hostnames', async ({
    p2Env,
  }) => {
    const cmp = compareEnvs()
    expect(cmp.same).toBe(true)
    expect(cmp.prod).toEqual({
      namespace: 'core-frontend',
      hostnames: ['core.ac.uk'],
    })
    expect(cmp.stage).toEqual({
      namespace: 'core-frontend-stage',
      hostnames: ['stg.core.ac.uk'],
    })
    const table = routeTable({
      overlay: p2Env.proxy ? p2Env.proxy.overlay : null,
    })
    expect(
      table.entries.map((e) => [
        e.prefix,
        e.replacePrefixMatch,
        e.backendRequestTimeout,
      ])
    ).toEqual(
      p2Env.proxy && p2Env.proxy.overlay === 'cs-ops-1'
        ? [
            ['/search/_next/data', '/_next/data', 30],
            ['/data-providers', null, 30],
            ['/static/search', '/', 30],
            ['/outputs', null, 30],
            ['/display', '/outputs', 30],
            ['/search', null, 30],
            ['/works', null, 30],
          ]
        : [
            ['/data-providers', null, 30],
            ['/static/search', '/', 30],
            ['/outputs', null, 30],
            ['/display', '/outputs', 30],
            ['/search', null, 30],
            ['/works', null, 30],
          ]
    )
    // the stack serves exactly this table
    expect(p2Env.proxy.routeTableSha256).toBe(table.sha256)
  })

  test('T-612 c2 @P0 acceptance table through the gateway-faithful proxy', async ({
    request,
    p2Env,
  }) => {
    // /display/1/ renders output 1, an id no fixture uses: the stub answers it 404 by rule
    const rule = await stubControl(p2Env, 'POST', '/rules', {
      urlRegex: '^https://api\\.core\\.ac\\.uk/v3/outputs/1(\\?.*)?$',
      fail: { status: 404, body: '{"message":"Not found"}' },
    })
    const rows = [
      ...ACCEPTANCE.map(([target, route, upstream]) => ({
        target,
        route,
        upstream,
      })),
      { target: longUrl(), route: '/search', upstream: longUrl() },
    ]
    const seen = []
    for (const row of rows) {
      const res = await request.fetch(`${p2Env.baseURL}${row.target}`, {
        method: 'GET',
        headers: { [DEBUG_HEADER]: '1' },
        maxRedirects: 0,
      })
      const h = res.headers()
      if (row.route === 'other') {
        expect([row.target, res.status(), await res.text()]).toEqual([
          row.target,
          404,
          'other service\n',
        ])
      } else {
        expect([row.target, h['x-p2-route'], h['x-p2-upstream']]).toEqual([
          row.target,
          row.route,
          row.upstream,
        ])
        // answered by the app, never by the other-service rule
        expect([
          row.target,
          h['content-security-policy'] !== undefined,
        ]).toEqual([row.target, row.target !== '/works//1']) // AD-106
      }
      seen.push([row.target.slice(0, 80), res.status()])
    }
    // the app's answers as today, apart from the two entries with an AD id (S-10, OD-41: the status of a local SVG at
    // /static/search/_next/image moved with Next 12.3.7, AD-149)
    const status = Object.fromEntries(seen)
    const svgImage = await request.fetch(`${p2Env.baseURL}${SVG_IMAGE}`, {
      method: 'GET',
      maxRedirects: 0,
    })
    // the trailing-slash 308 itself: the redirect is not followed
    const slash308 = await request.fetch(`${p2Env.baseURL}/works/1001`, {
      method: 'GET',
      maxRedirects: 0,
    })
    expect({
      '/static/search': status['/static/search'],
      '/display': status['/display'],
      '/display/': status['/display/'],
      '/display/1?source=oai': status['/display/1?source=oai'],
      '//works/1': status['//works/1'],
      '/search/_next/data/b/works/1001.json?id=1001':
        status['/search/_next/data/b/works/1001.json?id=1001'],
      '/static/search/_next/image?url=%2Fx.png&w=64&q=75':
        status['/static/search/_next/image?url=%2Fx.png&w=64&q=75'],
      [SVG_IMAGE]: svgImage.status(),
      [SLASH_308_BYTES]: (await slash308.body()).length,
    }).toEqual({
      '/static/search': 200,
      '/display': 308,
      '/display/': 404,
      '/display/1?source=oai': 308,
      '//works/1': 404,
      '/search/_next/data/b/works/1001.json?id=1001': 404,
      '/static/search/_next/image?url=%2Fx.png&w=64&q=75': 308,
      [SVG_IMAGE]: 400, // AD-149
      [SLASH_308_BYTES]: 12, // AD-150
    })
    await stubControl(p2Env, 'DELETE', `/rules?id=${rule.id}`)
    test
      .info()
      .annotations.push({ type: 'statuses', description: JSON.stringify(seen) })
  })
})
