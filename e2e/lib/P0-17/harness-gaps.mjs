// P0-17 test object: the guard's `test` (e2e/fixtures/guard.mjs) plus package-local stand-ins for open gaps of
// the shared harness (issues I-39, I-40, P0-12-1, P0-12-2). Each answers what 40 §2.2 / §2.4 intend and
// switches itself off once the harness closes its gap (probed once per worker). None of them hides a console
// message, page error, window error or asset failure of the app, and none touches Google, LogRocket or
// Sentry traffic.
//   thumbnails   The resolver rewrites `links[].url` https://core.ac.uk/... to the proxy origin (40 §2.4), so
//                the result thumbnails become <proxy>/image/<id>/large, which no gateway route serves (404; the
//                guard then fails the load with `asset >= 400`). While the proxy answers 404 there, the context
//                answers them with the resolver's core.ac.uk/image answer (the fixed 256 px PNG).
//   placeholder  templates/output/similar-works.jsx renders //core.ac.uk/images/document-placeholder.svg; the
//                guard has no row for core.ac.uk/images/**. While the guard calls that host unexpected, the
//                context answers it with the same fixed PNG.
//   allowAssets  The allow-all proxy forwards the raw target, so the local-only page it serves (`/error-card/`,
//                Q-005) loads /static/search/** assets that the app answers 404 without the gateway's
//                ReplacePrefixMatch. While the allow-all proxy answers 404 there, the context fetches those
//                URLs through the gateway proxy.
//   p17Doi       (opt-in, worker) works and outputs pages ask doi.org for their citation text on the server (E9);
//                test/ssr/hosts.json does not list doi.org (I-40), so the stub flags it as an unknown host. While
//                it is unlisted, a stub rule per recorded doi.org fixture answers the request; the worker removes
//                its rules when it ends.
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  test as guardTest,
  expect as guardExpect,
  stubControl,
  classify,
} from '../../fixtures/guard.mjs'

// web-first assertions wait up to 90 s: the machine runs several stacks, builds and suites at once, so a
// starved renderer needs tens of seconds for one step (40 §5: timeouts, never retries)
export const expect = guardExpect.configure({ timeout: 90000 })

const REPO = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
  '..',
  '..'
)
const FIXTURES = path.join(REPO, 'test', 'fixtures')
const HOSTS = path.join(REPO, 'test', 'ssr', 'hosts.json')

const doiListed = () => {
  try {
    return JSON.parse(fs.readFileSync(HOSTS, 'utf8')).hosts.includes('doi.org')
  } catch {
    return false
  }
}

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
const recordedDoiUrls = () => {
  const urls = new Set()
  for (const f of ['api', 'hand'].flatMap((d) =>
    walk(path.join(FIXTURES, d))
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

const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&')

const statusOf = async (url) => {
  try {
    const r = await fetch(url, { method: 'GET', redirect: 'manual' })
    await r.arrayBuffer()
    return r.status
  } catch {
    return 0
  }
}

const pngAnswer = (resolver) => async (route) => {
  const u = new URL(route.request().url())
  const tail = u.pathname.startsWith('/image/')
    ? u.pathname
    : '/image/placeholder/large'
  const r = resolver.resolve('GET', `https://core.ac.uk${tail}`)
  const headers = {}
  for (const [n, v] of r.headers) headers[n.toLowerCase()] = v
  await route.fulfill({ status: r.status, headers, body: r.body })
}

export const test = guardTest.extend({
  // which stand-ins this stack needs (probed once per worker)
  p17Probe: [
    async ({ p2Env }, use) => {
      await use({
        thumbnails: (await statusOf(`${p2Env.baseURL}/image/1/large`)) === 404,
        placeholder:
          classify(
            new URL('https://core.ac.uk/images/document-placeholder.svg'),
            new Set()
          ) === 'unexpected',
        allowAssets:
          (await statusOf(`${p2Env.allowURL}/static/search/icons.svg`)) === 404,
      })
    },
    { scope: 'worker' },
  ],
  p17Gaps: [
    async ({ context, p2Env, resolver, p17Probe }, use) => {
      const origins = [p2Env.baseURL, p2Env.allowURL]
        .filter(Boolean)
        .map((u) => new URL(u).origin)
      if (p17Probe.thumbnails)
        await context.route(
          (u) => origins.includes(u.origin) && u.pathname.startsWith('/image/'),
          pngAnswer(resolver)
        )
      if (p17Probe.placeholder)
        await context.route(
          (u) =>
            u.hostname === 'core.ac.uk' && u.pathname.startsWith('/images/'),
          pngAnswer(resolver)
        )
      if (p17Probe.allowAssets) {
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
      await use(p17Probe)
    },
    { auto: true },
  ],
  p17Doi: [
    async ({ p2Env, resolver }, use) => {
      const ids = []
      if (!doiListed())
        for (const url of recordedDoiUrls()) {
          const r = resolver.resolve('GET', url)
          if (r.unmatched || r.networkError) continue
          const ct = r.headers.find(([n]) => n.toLowerCase() === 'content-type')
          const rule = await stubControl(p2Env, 'POST', '/rules', {
            method: 'GET',
            urlRegex: `^${escapeRe(url)}$`,
            fail: {
              status: r.status,
              body: r.body.toString('utf8'),
              contentType: ct ? ct[1] : 'text/plain',
            },
          })
          if (rule && rule.id) ids.push(rule.id)
        }
      await use(ids.length)
      for (const id of ids)
        await stubControl(
          p2Env,
          'DELETE',
          `/rules?id=${encodeURIComponent(id)}`
        ).catch(() => null)
    },
    { scope: 'worker' },
  ],
})
