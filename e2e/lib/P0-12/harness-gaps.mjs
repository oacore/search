// P0-12 stand-ins for four open gaps of the shared harness (issues I-39, I-40, P0-12-1, P0-12-2). Each one
// answers a request the way the 40 §2.2 / §2.4 tables (and review:ui-flows §8.7, §8.9) say the harness
// should, from the recorded fixtures or the resolver's fixed answers, and switches itself off once the harness
// covers the case. None of them hides a console message, page error, window error or asset failure of the app.
//
//   doi.org      SSR citation requests (E9) reach the stub as host doi.org, which test/ssr/hosts.json does not
//                list (I-40): the stub records unknown-host and answers 502. While doi.org is unlisted, a stub
//                rule per recorded doi.org fixture answers it (status, content type, body bytes).
//   thumbnails   The resolver rewrites `links[].url` https://core.ac.uk/... to the proxy origin (40 §2.4), so
//                result thumbnails become <proxy>/image/<id>/large, which no gateway route serves (404, I-39).
//                While the proxy answers 404 there, the context answers them with the resolver's core.ac.uk/image
//                answer (the fixed 256 px PNG).
//   placeholder  templates/output/similar-works.jsx renders //core.ac.uk/images/document-placeholder.svg; the
//                guard has no rule for core.ac.uk/images/** and aborts it as an unexpected host (P0-12-1). While
//                the guard classifies it so, the context answers it with the same PNG.
//   allow-all    The allow-all proxy forwards the raw target, so the local-only pages it serves (`/`,
//                `/error-card/`, Q-005) load /static/search/** assets that the app answers 404 without the
//                gateway's ReplacePrefixMatch (review:ui-flows §8.9; P0-12-2). While the allow-all proxy
//                answers 404 there, the context sends those asset requests to the gateway proxy.
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { stubControl, classify } from '../../fixtures/guard.mjs'

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

const listFixtureRequests = () => {
  const out = []
  for (const top of ['api', 'hand']) {
    const dir = path.join(FIXTURES, top)
    if (!fs.existsSync(dir)) continue
    for (const scenario of fs.readdirSync(dir)) {
      const sdir = path.join(dir, scenario)
      if (!fs.statSync(sdir).isDirectory()) continue
      for (const f of fs.readdirSync(sdir))
        if (f.endsWith('.json'))
          out.push(
            JSON.parse(fs.readFileSync(path.join(sdir, f), 'utf8')).request
          )
    }
  }
  return out
}

const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&')

// SSR part (stack-wide stub rules): returns a cleanup that deletes only this caller's rules
export async function coverSsrGaps(p2Env, resolver) {
  if (doiListed()) return async () => {}
  const ids = []
  const seen = new Set()
  for (const { method, url } of listFixtureRequests()) {
    if (!/^https:\/\/doi\.org\//.test(url) || seen.has(`${method} ${url}`))
      continue
    seen.add(`${method} ${url}`)
    const r = resolver.resolve(method, url)
    if (r.unmatched || r.networkError) continue
    const ct = r.headers.find(([n]) => n.toLowerCase() === 'content-type')
    const res = await stubControl(p2Env, 'POST', '/rules', {
      method,
      urlRegex: `^${escapeRe(url)}$`,
      fail: {
        status: r.status,
        body: r.body.toString('utf8'),
        contentType: ct ? ct[1] : 'text/plain',
      },
    })
    if (res && res.id) ids.push(res.id)
  }
  return async () => {
    for (const id of ids)
      await stubControl(
        p2Env,
        'DELETE',
        `/rules?id=${encodeURIComponent(id)}`
      ).catch(() => null)
  }
}

const statusOf = async (url) => {
  try {
    const r = await fetch(url, { method: 'GET', redirect: 'manual' })
    await r.arrayBuffer()
    return r.status
  } catch {
    return 0
  }
}

// which browser stand-ins are needed on this stack (probed once per worker)
export async function probeBrowserGaps(p2Env) {
  const placeholder = new URL(
    'https://core.ac.uk/images/document-placeholder.svg'
  )
  return {
    thumbnails: (await statusOf(`${p2Env.baseURL}/image/1/large`)) === 404,
    placeholder: classify(placeholder, new Set()) === 'unexpected',
    allowAssets:
      (await statusOf(`${p2Env.allowURL}/static/search/icons.svg`)) === 404,
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

// browser part for one context; routes registered after the guard's run first for their URLs only
export async function coverBrowserGaps(context, { p2Env, resolver, gaps }) {
  const origins = [p2Env.baseURL, p2Env.allowURL]
    .filter(Boolean)
    .map((u) => new URL(u).origin)
  if (gaps.thumbnails)
    await context.route(
      (u) => origins.includes(u.origin) && u.pathname.startsWith('/image/'),
      pngAnswer(resolver)
    )
  if (gaps.placeholder)
    await context.route(
      (u) => u.hostname === 'core.ac.uk' && u.pathname.startsWith('/images/'),
      pngAnswer(resolver)
    )
  if (gaps.allowAssets) {
    const allow = new URL(p2Env.allowURL).origin
    const gateway = new URL(p2Env.baseURL).origin
    await context.route(
      (u) => u.origin === allow && u.pathname.startsWith('/static/search/'),
      // continued (streamed) to the same path on the gateway listener; a request still in flight when its
      // context closes is dropped
      (route) =>
        route
          .continue({ url: route.request().url().replace(allow, gateway) })
          .catch(() => null)
    )
  }
}
