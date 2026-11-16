// T-606 (41 G; R-055, R-062; Q-004, Q-009): SSR resilience against a failing upstream, through the
// gateway-faithful proxy of a sub-stack of its own (a failure rule on the stub is global to its stack, so the
// package stack and its parallel tests never see one; the sub-stack serves only this file's tests, in order).
// c1 failing stubs: every upstream call of the app (every request to https://api.core.ac.uk/) answered 500,
//    503 with an HTML body, by a dropped connection, or 504 after 3 s: each SSR route renders in under 30 s
//    with today's soft answers (Q-001, Q-003: ErrorCard 200 on a status, "no results" 200 on a network error,
//    "Uh-oh" 200 for works/outputs, 404 for a provider page), the failing stub is really hit, the app process
//    stays up and its stdout/stderr holds only the allow-listed lines (R-055; the Next 13.5/16 listener lines
//    of NL-19 are the list's only future entries), no server Sentry event is sent;
// c2 Q-004: statistics always use the fallback ("more than 356 million", "a lot of"): the same figures with a
//    healthy stub, with the failing stubs, and with a stub that would answer a real statistics payload, which
//    the app never asks for;
// c3 LogRocket import safe (R-062, Q-009): `logrocket` imports, initialises twice and captures an exception
//    under the app's Node and the tooling Node; the server renders (LogRocket.init runs in every production
//    render, LogRocket.captureException on every failed upstream call) without a log line, an outbound request
//    to a LogRocket host or a LogRocket mention in the HTML;
// c1 also pins where the 30 s come from: the gateway's `backendRequest: 30s` (kube/prod/httproute.yaml). The app
//    has no deadline of its own for an API call, so a stub that answers only after that ends in the gateway's 504,
//    not in a render.
import fs from 'node:fs'
import http from 'node:http'
import os from 'node:os'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { test, expect, stubControl } from '../fixtures/guard.mjs'
import * as sub from '../lib/P0-10/substack.mjs'

const REPO = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
  '..'
)
const API = 'https://api.core.ac.uk/'
const RENDER_LIMIT_MS = 30000

const M = {
  errorCard: 'This page is not available now',
  queryError: 'Sorry, we couldn’t find any results for',
  uhoh: 'The page you were looking for could not be found',
  // the <title> tag carries data-next-head from Next 15: match from its >
  providers: '>Data providers search</title>',
}
const DEFAULT_TITLE =
  'CORE – Aggregating the world’s open access research papers'

// failure modes: kind selects the soft answer the app renders (Q-003: a status → ErrorCard, a network error →
// "no results")
const MODES = [
  {
    id: 'http-500-json',
    kind: 'http',
    rule: {
      fail: {
        status: 500,
        contentType: 'application/json',
        body: '{"message":"Internal Server Error"}',
      },
    },
  },
  {
    id: 'http-503-html',
    kind: 'http',
    rule: {
      fail: {
        status: 503,
        contentType: 'text/html',
        body: '<html><body>Service Unavailable</body></html>',
      },
    },
  },
  { id: 'network-error', kind: 'net', rule: { fail: 'neterror' } },
  {
    id: 'slow-504',
    kind: 'http',
    delayMs: 3000,
    rule: {
      latencyMs: 3000,
      fail: {
        status: 504,
        contentType: 'application/json',
        body: '{"message":"Gateway Timeout"}',
      },
    },
  },
]

// api: the route calls the API during SSR (providers list and /outputs/update/ read only the baked snapshot)
const ROUTES = [
  {
    path: '/search/?q=climate',
    api: true,
    want: {
      http: [200, M.errorCard, DEFAULT_TITLE],
      net: [200, M.queryError, DEFAULT_TITLE],
    },
  },
  {
    path: '/search/?q=zzzzqqq',
    api: true,
    want: {
      http: [200, M.errorCard, DEFAULT_TITLE],
      net: [200, M.queryError, DEFAULT_TITLE],
    },
  },
  {
    path: '/works/1001/',
    api: true,
    want: {
      http: [200, M.uhoh, DEFAULT_TITLE],
      net: [200, M.uhoh, DEFAULT_TITLE],
    },
  },
  {
    path: '/outputs/2001/',
    api: true,
    want: {
      http: [200, M.uhoh, DEFAULT_TITLE],
      net: [200, M.uhoh, DEFAULT_TITLE],
    },
  },
  {
    path: '/data-providers/86/',
    api: true,
    want: {
      http: [404, M.uhoh, DEFAULT_TITLE],
      net: [404, M.uhoh, DEFAULT_TITLE],
    },
  },
  {
    path: '/data-providers/3354/',
    api: true,
    want: {
      http: [404, M.uhoh, DEFAULT_TITLE],
      net: [404, M.uhoh, DEFAULT_TITLE],
    },
  },
  {
    path: '/data-providers/?q=climate',
    api: false,
    want: {
      http: [200, M.providers, 'Data providers search'],
      net: [200, M.providers, 'Data providers search'],
    },
  },
  {
    path: '/outputs/update/',
    api: false,
    want: {
      http: [200, null, DEFAULT_TITLE],
      net: [200, null, DEFAULT_TITLE],
    },
  },
]

// the app's stdout/stderr in production: the two start-up lines of `next start` and the console.time labels of
// the providers page. Next 13.5 and 16 add their own uncaughtException/unhandledRejection listener lines (NL-19):
// they are allow-listed here by the step that lands such a Next; Next 10 prints none.
const NEXT_LISTENER_ALLOW = []
const LOG_ALLOW = [
  /^ready - started server on /,
  /^info {2}- Using webpack 4\./,
  /^(fetchWorks|transformDataProviders):\d+-[a-z0-9]+: [\d.]+ms$/,
  ...NEXT_LISTENER_ALLOW,
]
// the start-up banner of `next start` on Next 14.2 (the block form signed for Next 13.5 on 2026-11-05; this block
// owner SIGNED: 2026-11-05, 40 §8 rule 8): accepted only as one block of these five lines in this order, the
// version exact, only the port and the time masked (the blank line before ` ✓ Starting...` goes with the other
// empty lines); it is taken out once before LOG_ALLOW, so a second banner line, another order, another version or
// host, or more text after the time is still red
const NEXT_BANNER = [
  // Next 16.4: no indent, no Starting line, the config load time last (W7c)
  /^▲ Next\.js 16\.4\.6$/,
  /^- Local: {9}http:\/\/127\.0\.0\.1:\d+$/,
  /^- Network: {7}http:\/\/127\.0\.0\.1:\d+$/,
  /^✓ Ready in [\d.]+m?s$/,
  /^✓ Running next\.config\.js took [\d.]+m?s$/,
]
const withoutBanner = (lines) => {
  const at = lines.findIndex((_, i) =>
    NEXT_BANNER.every((re, k) => re.test(lines[i + k] ?? ''))
  )
  return at < 0
    ? lines
    : [...lines.slice(0, at), ...lines.slice(at + NEXT_BANNER.length)]
}

const get = (origin, target) =>
  new Promise((resolve, reject) => {
    const u = new URL(origin)
    const started = Date.now()
    const req = http.request(
      {
        host: u.hostname,
        port: u.port,
        path: target,
        method: 'GET',
        agent: false,
      },
      (res) => {
        const chunks = []
        res.on('data', (c) => chunks.push(c))
        res.on('end', () =>
          resolve({
            status: res.statusCode,
            ms: Date.now() - started,
            text: Buffer.concat(chunks).toString('utf8'),
          })
        )
        res.on('error', reject)
      }
    )
    req.setTimeout(120000, () =>
      req.destroy(new Error(`no answer after 120 s: ${target}`))
    )
    req.on('error', reject)
    req.end()
  })

// body text as the user reads it: React 17's text-node separators removed
const plain = (html) => html.replace(/<!-- -->/g, '')
const titleOf = (html) =>
  (/<title(?: [^>]*)?>([^<]*)<\/title>/.exec(html) || [])[1]
const nextDataOf = (html) => {
  const m =
    /<script id="__NEXT_DATA__" type="application\/json">(.*?)<\/script>/s.exec(
      html
    )
  return m ? JSON.parse(m[1]) : null
}

// one request of the sub-stack with the stub's own window: [response, the stub records it caused]
async function probe(env, target, origin = env.baseURL) {
  const mark = await stubControl(env, 'POST', '/mark', {})
  const res = await get(origin, target)
  const win = await stubControl(env, 'GET', `/collect?since=${mark.seq}`)
  return { ...res, records: win.records, problems: win.problems }
}

const hostOf = (rec) => new URL(rec.url).hostname

test.describe('T-606 @P1 SSR resilience', () => {
  // one sub-stack for the three tests, in order (a failure rule is global to its stack)
  test.describe.configure({ mode: 'default', timeout: 300000 })
  let id = null
  let env = null

  test.beforeAll(async ({ p2Env }, testInfo) => {
    testInfo.setTimeout(300000)
    id = sub.subId(p2Env, 't606')
    env = (await sub.up(id, p2Env)).env
  })
  test.afterAll(async () => {
    if (id) await sub.down(id)
  })
  test.beforeEach(async () => {
    await stubControl(env, 'POST', '/reset', {})
  })

  test('T-606 c1 @P1 failing stubs (500, 503 HTML, dropped connection, 504 after 3 s): every SSR route renders in under 30 s, soft answers as today, the process stays up', async () => {
    const seen = []
    for (const mode of MODES) {
      const rule = await stubControl(env, 'POST', '/rules', {
        urlPrefix: API,
        ...mode.rule,
      })
      for (const route of ROUTES) {
        const r = await probe(env, route.path)
        const html = plain(r.text)
        const hits = r.records.filter((x) => x.rule === `rule:${rule.id}`)
        const [status, marker, title] = route.want[mode.kind]
        seen.push({
          mode: mode.id,
          path: route.path,
          status: r.status,
          marker: marker == null || html.includes(marker),
          title: titleOf(r.text),
          wantTitle: title,
          wantStatus: status,
          hit: hits.length > 0,
          wantHit: route.api,
          // the failing stub was really in the path: the delay is on every answered call
          delayed:
            !mode.delayMs || !route.api ? true : r.ms >= mode.delayMs - 100,
          underLimit: r.ms < RENDER_LIMIT_MS,
          problems: r.problems.length,
        })
      }
      await stubControl(env, 'DELETE', `/rules?id=${rule.id}`)
    }
    expect(seen).toHaveLength(MODES.length * ROUTES.length)
    expect(
      seen.filter(
        (s) =>
          s.status !== s.wantStatus ||
          !s.marker ||
          s.title !== s.wantTitle ||
          s.hit !== s.wantHit ||
          !s.delayed ||
          !s.underLimit ||
          s.problems
      )
    ).toEqual([])

    // R-055: the process survived every failure; Next printed nothing beyond the allow-listed lines and its start-up banner (TC-4; AD-148 on Next 12.3, AD-182 on Next 13.5)
    const health = await get(env.allowURL, '/api/healthz/')
    expect([health.status, health.text]).toEqual([200, '{"status":"ok"}'])
    expect(() => process.kill(env.pids.app, 0)).not.toThrow()
    expect(fs.existsSync(path.join(env.runDir, 'app-exit.json'))).toBe(false)
    const lines = fs
      .readFileSync(sub.appLogOf(env), 'utf8')
      .split('\n')
      .filter((l) => l !== '')
    expect(
      withoutBanner(lines).filter((l) => !LOG_ALLOW.some((re) => re.test(l)))
    ).toEqual([]) // AD-148, AD-182
    // no server Sentry event for an upstream failure (the soft pages are answers, not errors)
    const records = await stubControl(env, 'GET', '/records')
    expect(records.filter((x) => /(^|\.)sentry\.io$/.test(hostOf(x)))).toEqual(
      []
    )
    expect(await stubControl(env, 'GET', '/problems')).toEqual([])
  })

  test('T-606 c2 @P1 Q-004: statistics always use the fallback with a healthy, a failing and a statistics-serving stub', async () => {
    const FALLBACK = { totalArticlesCount: 'more than 356 million' }
    const pages = [
      '/search/?q=climate',
      '/works/1001/',
      '/outputs/2001/',
      '/data-providers/',
      '/data-providers/86/',
      '/outputs/update/',
      '/search/foo/',
    ]
    const serving = {
      urlRegex: '^https://api\\.core\\.ac\\.uk/internal/statistics',
      fail: {
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          totalArticlesCount: 123456789,
          fullTextCount: 12345,
        }),
      },
    }
    const conditions = [
      { id: 'healthy', rules: [] },
      { id: 'http-500', rules: [{ urlPrefix: API, ...MODES[0].rule }] },
      { id: 'network-error', rules: [{ urlPrefix: API, ...MODES[2].rule }] },
      { id: 'statistics-served', rules: [serving] },
    ]
    const seen = []
    for (const c of conditions) {
      await stubControl(env, 'POST', '/reset', {})
      const rules = []
      for (const r of c.rules)
        rules.push(await stubControl(env, 'POST', '/rules', r))
      for (const path_ of pages) {
        const r = await probe(env, path_)
        const data = nextDataOf(r.text)
        const html = plain(r.text)
        seen.push({
          condition: c.id,
          path: path_,
          statistics: data && data.props.statistics,
          // the providers page prints the fallback of formatNumber (T-108 c3), once
          lot:
            path_ === '/data-providers/'
              ? html.includes(
                  'Our dataset currently contains a lot of open access articles'
                )
              : null,
          // the app never asks the statistics endpoint (the loader serves the baked file, the answer is unused)
          statisticsCalls: r.records.filter((x) => /\/statistics\b/.test(x.url))
            .length,
        })
      }
      await stubControl(env, 'DELETE', '/rules')
    }
    expect(seen).toHaveLength(conditions.length * pages.length)
    expect(
      seen.filter(
        (s) =>
          JSON.stringify(s.statistics) !== JSON.stringify(FALLBACK) ||
          s.lot === false ||
          s.statisticsCalls !== 0
      )
    ).toEqual([])
    // no real count anywhere in an SSR page of the serving stub
    const r = await probe(env, '/search/?q=climate')
    expect(r.text).not.toContain('123456789')
  })

  test('T-606 c3 @P1 LogRocket import safe: logrocket loads, initialises and captures on the server; renders and failed calls leave no log line, request or mention', async ({
    p2Env,
  }) => {
    // the package under the app's own node_modules, in the Node that serves the app and in the tooling Node
    const nvmDir = process.env.NVM_DIR || path.join(os.homedir(), '.nvm')
    const appNode = path.join(
      nvmDir,
      'versions',
      'node',
      p2Env.build.node,
      'bin',
      'node'
    )
    expect(fs.existsSync(appNode), `app node ${appNode}`).toBe(true)
    const script = `
      const LogRocket = require('logrocket')
      LogRocket.init('cab1al/search-gfe6o')
      LogRocket.init('cab1al/search-gfe6o')
      LogRocket.captureException(new Error('probe'))
      setTimeout(() => console.log(JSON.stringify({ node: process.version, ok: true })), 250)
    `
    const imported = [appNode, process.execPath].map((node) => {
      const r = spawnSync(node, ['-e', script], {
        cwd: p2Env.build.dir,
        encoding: 'utf8',
        timeout: 60000,
      })
      return { status: r.status, out: r.stdout.trim(), err: r.stderr.trim() }
    })
    expect(imported.map((i) => [i.status, i.err])).toEqual([
      [0, ''],
      [0, ''],
    ])
    expect(imported.map((i) => JSON.parse(i.out).ok)).toEqual([true, true])

    // renders: LogRocket.init runs in every production render, repeated; LogRocket.captureException runs on
    // every failed upstream call (api/index.js) in the failing conditions
    const targets = ['/search/?q=climate', '/works/1001/', '/outputs/2001/']
    const conditions = [
      { id: 'healthy', rule: null, want: [200, 200, 200] },
      { id: 'http-500', rule: MODES[0].rule, want: [200, 200, 200] },
      { id: 'network-error', rule: MODES[2].rule, want: [200, 200, 200] },
    ]
    const results = []
    const mentions = []
    for (const c of conditions) {
      const rule = c.rule
        ? await stubControl(env, 'POST', '/rules', {
            urlPrefix: API,
            ...c.rule,
          })
        : null
      const statuses = []
      for (let i = 0; i < 3; i++)
        for (const t of targets) {
          const r = await probe(env, t)
          statuses.push(r.status)
          if (/logrocket|lgrckt|logr-in/i.test(r.text)) mentions.push([c.id, t])
        }
      results.push([c.id, [...new Set(statuses)], statuses.length])
      if (rule) await stubControl(env, 'DELETE', `/rules?id=${rule.id}`)
    }
    expect(results).toEqual([
      ['healthy', [200], 9],
      ['http-500', [200], 9],
      ['network-error', [200], 9],
    ])
    expect(mentions).toEqual([])
    // nothing reached a LogRocket host (an unlisted name would also be an `unknown-host` problem of the stub)
    const records = await stubControl(env, 'GET', '/records')
    expect(
      records.filter((x) => /logrocket|lgrckt|logr-in/i.test(hostOf(x)))
    ).toEqual([])
    expect(await stubControl(env, 'GET', '/problems')).toEqual([])
    const log = fs.readFileSync(sub.appLogOf(env), 'utf8')
    expect(log).not.toMatch(/logrocket/i)
    expect(() => process.kill(env.pids.app, 0)).not.toThrow()
  })
  test("T-606 c1 @P1 a stub that answers after the gateway's 30 s backend timeout ends in the gateway 504: the app has no deadline of its own", async () => {
    // the limit is the route's backendRequest (the proxy of the harness is generated from it)
    const route = fs.readFileSync(
      path.join(REPO, 'kube', 'prod', 'httproute.yaml'),
      'utf8'
    )
    const limits = [...route.matchAll(/backendRequest:\s*(\d+)s/g)].map(
      (m) => Number(m[1]) * 1000
    )
    expect(limits.length).toBeGreaterThan(0)
    expect(new Set(limits)).toEqual(new Set([RENDER_LIMIT_MS]))
    // 15 s past the limit: the gateway gives up first whatever the load of the host
    const rule = await stubControl(env, 'POST', '/rules', {
      urlPrefix: API,
      latencyMs: RENDER_LIMIT_MS + 15000,
      fail: { status: 504, body: '{"message":"Gateway Timeout"}' },
    })
    const hung = await get(env.baseURL, '/works/1001/')
    await stubControl(env, 'DELETE', `/rules?id=${rule.id}`)
    expect(hung.status).toBe(504)
    expect(hung.text).not.toMatch(/<html/i)
    expect(hung.ms).toBeGreaterThanOrEqual(RENDER_LIMIT_MS - 1000)
    // the app is still up and answers the next request (the stuck render does not wedge it)
    const next = await get(env.baseURL, '/outputs/update/')
    expect(next.status).toBe(200)
  })
})
