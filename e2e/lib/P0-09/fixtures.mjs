// P0-09 test object: the guard's `test` (e2e/fixtures/guard.mjs) plus three package-local stand-ins for
// harness gaps reported in the issues log; each answers exactly what 40 §2.4 / the fixtures intend, and each
// stays harmless once the harness closes the gap:
//   - p09DoiRules (worker, auto): the SSR stub flags doi.org as an unknown host (I-40), so every works or
//     outputs page with a DOI would fail the guard. The recorded E9 fixtures are served through stub rules
//     (status, content type and body of the fixture; rules answer before the host check). The rules match
//     only https://doi.org/<recorded doi> and are removed when the worker ends.
//   - p09Images (test, auto): the resolver rewrites `links[].url` of https://core.ac.uk to the proxy origin,
//     so the result thumbnails `https://core.ac.uk/image/<id>/large` reach the proxy as /image/... and 404
//     (I-39); the similar-works cards load `//core.ac.uk/images/document-placeholder.svg`
//     (templates/output/similar-works.jsx), which the guard has no row for. Both are core.ac.uk images (an
//     other service in prod) and are answered with the fixed 256 px PNG of 40 §2.4.
import fs from 'node:fs'
import path from 'node:path'
import {
  test as guardTest,
  expect,
  stubControl,
} from '../../fixtures/guard.mjs'
import { FIXTURES_ROOT, TILE_PNG } from '../../../test/fixtures/resolve.mjs'

export { expect, stubControl }

const walk = (dir) =>
  fs.existsSync(dir)
    ? fs
        .readdirSync(dir, { withFileTypes: true })
        .flatMap((e) =>
          e.isDirectory()
            ? walk(path.join(dir, e.name))
            : e.name.endsWith('.json')
            ? [path.join(dir, e.name)]
            : []
        )
    : []

// GET https://doi.org/<doi> requests of the committed fixtures
export const recordedDoiUrls = () => {
  const urls = new Set()
  for (const f of ['api', 'hand'].flatMap((d) =>
    walk(path.join(FIXTURES_ROOT, d))
  )) {
    try {
      const { request } = JSON.parse(fs.readFileSync(f, 'utf8'))
      if (
        request &&
        request.method === 'GET' &&
        String(request.url).startsWith('https://doi.org/')
      )
        urls.add(request.url)
    } catch {
      // not a fixture file
    }
  }
  return [...urls].sort()
}

const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

const isThumbnail = (u, stackOrigins) =>
  (stackOrigins.has(u.origin) && u.pathname.startsWith('/image/')) ||
  (u.hostname === 'core.ac.uk' && u.pathname.startsWith('/images/'))

export const test = guardTest.extend({
  p09DoiRules: [
    async ({ p2Env, resolver }, use) => {
      const ids = []
      for (const url of recordedDoiUrls()) {
        const r = resolver.resolve('GET', url)
        if (r.unmatched || r.networkError) continue
        const contentType =
          (r.headers.find(([n]) => n.toLowerCase() === 'content-type') ||
            [])[1] || 'text/plain'
        const rule = await stubControl(p2Env, 'POST', '/rules', {
          method: 'GET',
          urlRegex: `^${escapeRe(url)}$`,
          fail: {
            status: r.status,
            body: r.body.toString('utf8'),
            contentType,
          },
        })
        ids.push(rule.id)
      }
      await use(ids)
      for (const id of ids)
        await stubControl(p2Env, 'DELETE', `/rules?id=${id}`).catch(() => {})
    },
    { scope: 'worker', auto: true },
  ],
  p09Images: [
    async ({ context, p2Env }, use) => {
      const stackOrigins = new Set(
        [p2Env.baseURL, p2Env.allowURL, p2Env.appURL]
          .filter(Boolean)
          .map((u) => new URL(u).origin)
      )
      await context.route(
        (u) => isThumbnail(u, stackOrigins),
        (route) =>
          route.fulfill({
            status: 200,
            headers: {
              'content-type': 'image/png',
              'cache-control': 'no-store',
            },
            body: TILE_PNG,
          })
      )
      await use(stackOrigins)
    },
    { auto: true },
  ],
})
