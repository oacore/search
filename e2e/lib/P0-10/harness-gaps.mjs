// Package-local stand-ins for three open harness gaps (SP issues I-39, I-40, P0-10-1, P0-10-2). Each serves
// what 40 §2.2 / §2.4 say the harness serves, from the same recorded fixtures or resolver rules, and switches
// itself off once the harness covers the case, so a baseline recorded with them stays valid after the fix.
//   I-40: test/ssr/hosts.json lacks doi.org, so the SSR stub answers every E9 citation request 502 and records
//         an unknown-host problem (the guard then fails the test). While doi.org is unlisted, each DOI of the
//         page fixtures gets a stub rule answering the recorded E9 fixture (status, content type, body bytes).
//   I-39: the resolver rewrites `links[].url` https://core.ac.uk/image/... to the proxy origin, where nothing
//         serves /image/ (404 -> the guard's asset check). While the proxy answers 404 there, the context
//         answers <stack>/image/** with the resolver's core.ac.uk/image PNG (40 §2.4).
//   P0-10-2: the similar-works cards load `//core.ac.uk/images/document-placeholder.svg`
//         (templates/output/similar-works.jsx); the 40 §2.4 table has core.ac.uk/image/** only, so the guard
//         aborts it as an unexpected host and fails every hydrated works/outputs page. While the guard
//         classifies it as unexpected, the context answers core.ac.uk/images/** with the same PNG.
import fs from 'node:fs'
import { stubControl, classify } from '../../fixtures/guard.mjs'

const HOSTS = new URL('../../../test/ssr/hosts.json', import.meta.url)

// the DOIs of the page fixtures (test/fixtures/scenarios.json picks.dois; works 1004/1005/1007 and outputs
// 2003 reuse 10.1111/rego.12518, outputs 2002/2004/2006/2101 reuse 10.1186/1756-0500-5-503)
export const FIXTURE_DOIS = [
  '10.1111/rego.12518',
  '10.7910/dvn/hcydpq',
  '10.5194/asr-12-171-2015',
  '10.1186/1756-0500-5-503',
]

export const doiListed = () => {
  try {
    return JSON.parse(fs.readFileSync(HOSTS, 'utf8')).hosts.includes('doi.org')
  } catch {
    return false
  }
}

// returns a cleanup function that deletes only this caller's rules
export async function serveDoiFixtures(env, resolver) {
  if (doiListed()) return async () => {}
  const ids = []
  for (const doi of FIXTURE_DOIS) {
    const url = `https://doi.org/${doi}`
    const r = resolver.resolve('GET', url)
    if (r.unmatched) throw new Error(`no E9 fixture for ${url}`)
    const type = (r.headers.find(([n]) => n.toLowerCase() === 'content-type') ||
      [])[1]
    const rule = await stubControl(env, 'POST', '/rules', {
      method: 'GET',
      urlRegex: `^${url.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&')}$`,
      fail: {
        status: r.status,
        body: r.body.toString('utf8'),
        contentType: type || 'text/plain',
      },
    })
    ids.push(rule.id)
  }
  return async () => {
    for (const id of ids)
      await stubControl(env, 'DELETE', `/rules?id=${encodeURIComponent(id)}`)
  }
}

const imageAnswer = (resolver) => async (route) => {
  const u = new URL(route.request().url())
  const r = resolver.resolve(
    'GET',
    `https://core.ac.uk/image/${u.pathname.split('/').slice(2).join('/')}`
  )
  const headers = {}
  for (const [n, v] of r.headers) headers[n.toLowerCase()] = v
  await route.fulfill({ status: r.status, headers, body: r.body })
}

// browser-side stand-ins for one context (routes registered after the guard's take precedence)
export async function serveBrowserGaps(context, { request, env, resolver }) {
  const origin = new URL(env.baseURL).origin
  const probe = await request.get(`${origin}/image/1/large`, {
    maxRedirects: 0,
  })
  if (probe.status() === 404)
    await context.route(
      (u) => u.origin === origin && u.pathname.startsWith('/image/'),
      imageAnswer(resolver)
    )
  const placeholder = new URL(
    'http://core.ac.uk/images/document-placeholder.svg'
  )
  if (classify(placeholder, new Set()) === 'unexpected')
    await context.route(
      (u) => u.hostname === 'core.ac.uk' && u.pathname.startsWith('/images/'),
      imageAnswer(resolver)
    )
}
