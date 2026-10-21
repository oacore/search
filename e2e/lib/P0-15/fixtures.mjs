// P0-15 test object: the guard's `test` (e2e/fixtures/guard.mjs) plus three package-local stand-ins for gaps of
// the shared harness (issues I-39, I-40, P0-12-1, P0-12-2 in the issues log). Each answers what 40 §2.2 / §2.4 intend and
// stays harmless once the harness closes its gap. None of them hides a console message, page error, window
// error, CSP violation or asset failure of the app, and none touches Google, LogRocket or Sentry traffic.
//   p15DoiRules   (worker, auto) the SSR stub flags doi.org as an unknown host (I-40: test/ssr/hosts.json does
//                 not list it), so every works or outputs page with a DOI would fail the guard. The recorded E9
//                 fixtures (status, content type, body) are served through stub rules that match only
//                 https://doi.org/<recorded doi>; the worker removes them when it ends.
//   p15Images     (test, auto) the resolver rewrites `links[].url` https://core.ac.uk/... to the proxy origin
//                 (40 §2.4), so result thumbnails reach the proxy as /image/<id>/large, which no gateway route
//                 serves (I-39); the similar-works cards load //core.ac.uk/images/document-placeholder.svg,
//                 which the guard has no row for (P0-12-1). Both are core.ac.uk images (another service in
//                 prod) and are answered with the fixed 256 px PNG of 40 §2.4.
//   p15AllowAssets (test, auto) the allow-all proxy forwards the raw target, so the local-only pages it serves
//                 (`/`, `/error-card/`, Q-005) load /static/search/** assets that the app answers 404 without
//                 the gateway's ReplacePrefixMatch (P0-12-2); while the allow-all proxy answers 404 there, the
//                 asset URLs are fetched through the gateway proxy. Probed once per worker.
import fs from 'node:fs'
import path from 'node:path'
import {
  test as guardTest,
  expect as guardExpect,
  stubControl,
} from '../../fixtures/guard.mjs'
import { FIXTURES_ROOT, TILE_PNG } from '../../../test/fixtures/resolve.mjs'

// web-first assertions wait up to 45 s: the machine runs several stacks at once (40 §5: timeouts, never retries)
export const expect = guardExpect.configure({ timeout: 45000 })
export { stubControl }

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

const statusOf = async (url) => {
  try {
    const r = await fetch(url, { method: 'GET', redirect: 'manual' })
    await r.arrayBuffer()
    return r.status
  } catch {
    return 0
  }
}

export const test = guardTest.extend({
  p15AllowGap: [
    async ({ p2Env }, use) => {
      await use(
        (await statusOf(`${p2Env.allowURL}/static/search/icons.svg`)) === 404
      )
    },
    { scope: 'worker' },
  ],
  p15DoiRules: [
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
  p15Images: [
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
  p15AllowAssets: [
    async ({ context, p2Env, p15AllowGap }, use) => {
      if (p15AllowGap) {
        const allow = new URL(p2Env.allowURL).origin
        const gateway = new URL(p2Env.baseURL).origin
        await context.route(
          (u) => u.origin === allow && u.pathname.startsWith('/static/search/'),
          async (route) => {
            const response = await route.fetch({
              url: route.request().url().replace(allow, gateway),
            })
            await route.fulfill({ response })
          }
        )
      }
      await use(p15AllowGap)
    },
    { auto: true },
  ],
})
