#!/usr/bin/env node
// corpus.mjs - `npm run corpus`: the C4 differential corpus run (55 C4). Every URL of a recorded corpus is rendered
// on two stacks served from the same recorded answers, the golden reference and the candidate, and compared
// aspect by aspect; a difference passes only when a row of test/baseline/ACCEPTED-DIFFS.yml matches (test, key,
// from, to) exactly (42 §8; default deny; screenshots never).
//
//   npm run corpus -- --golden <build key|ref> --candidate <build key|ref> [--corpus <name>] [--id <run id>]
//                     [--limit <n URLs>] [--grep <url regex>] [--screens <percent, 10>] [--screen-seed <n>] [--tz UTC,America/Los_Angeles,Asia/Tokyo]
//   npm run corpus -- --self [--golden <ref>]       golden vs golden (2.5): two stacks of one build; 0 diffs
//                                                   expected, every URL rendered on both
//   npm run corpus -- --controls                    positive controls of test/faults/controls.json (2.7; refused
//                                                   while the file holds no control)
//   npm run corpus -- --self-test                   the comparison's own known answers (no stack)
//   npm run corpus -- --self --inject '<stub rule>'  a fault on the candidate arm's SSR stub: must report diffs
//   npm run corpus -- --live ...                    the GATE-x.6 live A/B (release-recipe images, live API): docker
//                                                   mode only, refused locally (owner notes §1; I-10)
//
// Refuses equal --golden and --candidate digests unless --self; records per URL each stack's build key (the
// local stand-in for the container imageID) and the served __NEXT_DATA__.buildId; a buildId that is not the
// requested build's fails the run.
// Aspects per URL (the key syntax of the owning test):
//   T-601 status, T-603 contract headers (`<url>/<class>@proxy/<header>`: the route class key after the URL, as
//   the per-URL keys are written, so a row accepts a header pair only on the URLs it lists; date ignored; etag,
//   content-length, last-modified presence only), T-602 SSR head (P0-10 normaliseHead), T-728 SSR body DOM (JS
//   off, P0-12 serialisation), T-605 class census (DOM parser view), T-610 __NEXT_DATA__ (props, page, query; buildId
//   normalised) and _next/data of gSSP pages, T-607 SSR request trace (stub wire records; sorted), then a browser
//   pass per time zone with the T-701/T-728 checks: console errors and page errors (T-701), browser request
//   trace (T-702: document, fetch and XHR requests; asset hashes not compared), settled hydrated DOM (T-728);
//   T-801 screenshots at 1440, 768 and 375 for a seeded per-stratum draw of --screens percent of the URLs.
// Harness normalisation (not app behaviour): the stack origin (http://127.0.0.1:<port>, one port slot per stack;
// the resolver rewrites core.ac.uk links to it, 40 §2.4) -> <stack>.
// Output: $ARTIFACT_DIR/corpus/runs/<id>/report.json (+ diff PNGs); exit 1 on any unexplained diff.
import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import {
  REPO,
  ARTIFACT_DIR,
  corpusDir,
  workDir,
  readJson,
  writeJson,
  opts,
  rng,
  shuffle,
  seedOf,
  byCodePoint,
  buildReplayRoot,
  stackUp,
  stackDown,
  control,
  buildRecord,
  resolverCore,
  sha256,
} from './corpus-lib.mjs'

const requireE2e = createRequire(path.join(REPO, 'e2e', 'package.json'))
const TIME_ZONES = ['UTC', 'America/Los_Angeles', 'Asia/Tokyo']
const WIDTHS = [1440, 768, 375]
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

const lib = {}
async function loadLibs() {
  lib.guard = await import('../e2e/fixtures/guard.mjs')
  lib.dom12 = await import('../e2e/lib/P0-12/dom.mjs')
  lib.dom10 = await import('../e2e/lib/P0-10/dom.mjs')
  lib.norm10 = await import('../e2e/lib/P0-10/normalise.mjs')
  lib.http11 = await import('../e2e/lib/P0-11/http.mjs')
  lib.contract = await import('../e2e/lib/P0-11/contract.mjs')
  lib.wire = await import('../e2e/lib/P0-11/wire.mjs')
  lib.pixels = await import('../e2e/fixtures/pixel-compare.mjs')
  lib.ledger = requireE2e('../test/static/adapters/reference.js')
}

const stackOrigin = (s) => s.replace(/http:\/\/127\.0\.0\.1:\d+/g, '<stack>')
const norm = (v, buildId) => {
  let s = typeof v === 'string' ? v : JSON.stringify(v)
  if (buildId) s = s.split(buildId).join('<buildId>')
  return stackOrigin(s)
}
const classOf = (status, ctype) => {
  if (status === 308 || status === 301 || status === 302) return String(status)
  if (status === 404) return '404'
  if (status >= 500) return '500'
  if (/html/.test(ctype || '')) return 'HTML'
  return `status-${status}`
}

function emptyLog() {
  return {
    requests: [],
    console: [],
    consoleErrors: [],
    pageErrors: [],
    windowErrors: [],
    csp: [],
    badResponses: [],
    unexpected: [],
    unmatched: [],
    aborted: {},
    sentry: [],
    corsAdded: [],
    guardAbortConsole: [],
    preflights: 0,
    screenshots: 0,
    ssrProblems: [],
  }
}

// settled: load, Next's hydration measure (or 10 s without one: error pages), no request in flight for 1 s,
// loaders gone, images complete, and the body serialisation equal on two polls 300 ms apart
async function settle(page, inflight, read, timeoutMs = 60000) {
  const until = Date.now() + timeoutMs
  await page.waitForLoadState('load', { timeout: timeoutMs }).catch(() => {})
  await page
    .waitForFunction(
      () => performance.getEntriesByName('Next.js-hydration').length > 0,
      null,
      { timeout: 10000 }
    )
    .catch(() => {})
  let last = null
  let quietSince = Date.now()
  while (Date.now() < until) {
    if (inflight.size) quietSince = Date.now()
    const st = await page
      .evaluate(
        () =>
          new Promise((resolve) =>
            requestAnimationFrame(() =>
              requestAnimationFrame(() =>
                resolve({
                  loaders: document.querySelectorAll(
                    '[class*="loading-bar-"],[class*="styles-spinner-"],[class*="loading-block"],[class*="loading-box"]'
                  ).length,
                  images: [...document.images].every((i) => i.complete),
                })
              )
            )
          )
      )
      .catch(() => ({ loaders: 1, images: false }))
    const value = await read()
    const sig = JSON.stringify(value)
    if (
      !inflight.size &&
      Date.now() - quietSince > 1000 &&
      !st.loaders &&
      st.images &&
      sig === last
    )
      return { value, settled: true }
    last = sig
    await sleep(300)
  }
  return { value: await read(), settled: false }
}

async function contextFor(browser, arm, { tz, js = true }) {
  const log = emptyLog()
  const context = await browser.newContext({
    timezoneId: tz,
    locale: 'en-GB',
    serviceWorkers: 'block',
    javaScriptEnabled: js,
    reducedMotion: 'reduce',
  })
  await lib.guard.guardContext(context, {
    env: arm.env,
    resolver: arm.resolver,
    log,
    baseURL: arm.env.baseURL,
  })
  return { context, log }
}

// The SSR wire window closes only after the stub has had no request in flight for WIRE_QUIET_MS, at the latest
// WIRE_QUIET_MAX_MS after the answer: the claim card of a provider page fetches its accounts without waiting for the
// answer (issue J2-RC-2), so that request can reach the stub just after the page has answered (issue J2-CL-H3). The
// same wait and constants as stubQuiet of e2e/fixtures/guard.mjs (decision R2-2 (a)).
const WIRE_QUIET_MS = 250
const WIRE_QUIET_MAX_MS = 2000
const WIRE_QUIET_POLL_MS = 25
async function stubQuiet(env) {
  const deadline = Date.now() + WIRE_QUIET_MAX_MS
  let seen = null
  let quietSince = Date.now()
  while (Date.now() < deadline) {
    const { seq, inFlight } = await control(env, 'GET', '/health')
    if (inFlight > 0 || seq !== seen) {
      seen = seq
      quietSince = Date.now()
    } else if (Date.now() - quietSince >= WIRE_QUIET_MS) return
    await sleep(WIRE_QUIET_POLL_MS)
  }
}

const BROWSER_TYPES = new Set(['document', 'fetch', 'xhr'])
async function renderOne(arm, url, { screens, browser }) {
  const out = { arm: arm.name, build: arm.build.key, url }
  const env = arm.env
  // ---- SSR: status, headers, body, wire ----
  const mark = await control(env, 'POST', '/mark', {})
  let res
  try {
    res = await lib.http11.rawRequest(env.baseURL, url, {
      headers: { 'accept': 'text/html', 'accept-encoding': 'identity' },
      timeoutMs: 120000,
    })
  } catch (e) {
    res = {
      status: 0,
      rawHeaders: [],
      headers: {},
      body: Buffer.alloc(0),
      error: e.message,
    }
  }
  await stubQuiet(env)
  const win = await control(env, 'GET', `/collect?since=${mark.seq}`)
  const html = res.body.toString('utf8')
  const nd = lib.dom10.nextDataOf(html)
  const buildId = nd ? nd.buildId : null
  out.status = res.status
  out.servedBuildId = buildId
  out.cls = classOf(res.status, res.headers['content-type'])
  out.headers = JSON.parse(
    norm(lib.contract.normaliseHeaders(res.rawHeaders), buildId)
  )
  out.wire = win.records
    .map((r) => lib.wire.normaliseRecord(r, env.appEnv))
    .map((r) => JSON.parse(norm(r, buildId)))
    .sort((a, b) => byCodePoint(JSON.stringify(a), JSON.stringify(b)))
  out.ssrProblems = win.problems.length
  if (nd) {
    out.nextData = JSON.parse(
      norm({ page: nd.page, query: nd.query, props: nd.props }, buildId)
    )
    if (nd.gssp) {
      const dyn = nd.page.replace(/\[([^\]]+)\]/g, (_, k) =>
        encodeURIComponent(nd.query[k])
      )
      const q = new URLSearchParams()
      for (const m of nd.page.matchAll(/\[([^\]]+)\]/g))
        q.set(m[1], nd.query[m[1]])
      const u = new URL(url, 'http://unused.host')
      for (const [k, v] of u.searchParams) if (!q.has(k)) q.append(k, v)
      const target = `/search/_next/data/${buildId}${
        dyn === '/' ? '/index' : dyn
      }.json${q.toString() ? `?${q}` : ''}`
      try {
        const d = await lib.http11.rawRequest(env.baseURL, target, {
          timeoutMs: 120000,
        })
        let body = d.body.toString('utf8')
        try {
          body = JSON.parse(norm(JSON.parse(body), buildId))
        } catch {
          body = norm(body, buildId)
        }
        out.nextDataJson = { status: d.status, body }
      } catch (e) {
        out.nextDataJson = { status: 0, error: e.message }
      }
    }
  }
  // ---- DOM parser view (JS off): head, census, body DOM ----
  {
    const { context } = await contextFor(browser, arm, { tz: 'UTC', js: false })
    const page = await context.newPage()
    try {
      await page
        .goto(`${env.baseURL}${url}`, { waitUntil: 'load', timeout: 120000 })
        .catch(() => {})
      if (/<html/i.test(html)) {
        const head = await lib.dom10.parseHead(page, html)
        out.head = JSON.parse(
          norm(
            {
              html: head.htmlAttrs,
              head: lib.norm10.normaliseHead(head.head, {
                origins: [],
                buildId,
              }),
              lead: head.bodyLead,
            },
            buildId
          )
        )
        const census = await lib.dom10.parsedCensus(page, html)
        out.census = lib.norm10
          .censusLines(census.rows, { origins: [], buildId })
          .map((l) => stackOrigin(l))
          .concat(
            census.objectObject.map(
              (x) => `[object Object] ${x.path} ${x.attr}`
            )
          )
        out.bodyDom = (await lib.dom12.serializeBody(page, buildId)).map(
          (l) => l.text
        )
      }
    } finally {
      await context.close()
    }
  }
  // ---- browser pass per time zone: console, requests, hydrated DOM ----
  out.browser = {}
  for (const tz of arm.timeZones) {
    const { context, log } = await contextFor(browser, arm, { tz })
    const page = await context.newPage()
    const inflight = new Set()
    page.on('request', (r) => inflight.add(r))
    page.on('requestfinished', (r) => inflight.delete(r))
    page.on('requestfailed', (r) => inflight.delete(r))
    try {
      await page
        .goto(`${env.baseURL}${url}`, { waitUntil: 'load', timeout: 120000 })
        .catch(() => {})
      const s = await settle(page, inflight, () =>
        lib.dom12
          .serializeBody(page, buildId)
          .then((lines) => lines.map((l) => l.text))
          .catch(() => [])
      )
      const types = {}
      for (const r of log.requests)
        types[r.resourceType] = (types[r.resourceType] || 0) + 1
      out.browser[tz] = {
        settled: s.settled,
        hydrated: s.value,
        console: log.consoleErrors
          .map((c) => norm(c.text, buildId))
          .sort(byCodePoint),
        pageErrors: log.pageErrors
          .map((e) => norm(e.message, buildId))
          .sort(byCodePoint),
        windowErrors: log.windowErrors
          .map((e) => norm(e.message, buildId))
          .sort(byCodePoint),
        csp: log.csp.length,
        requests: log.requests
          .filter((r) => BROWSER_TYPES.has(r.resourceType))
          .map(
            (r) =>
              `${r.method} ${norm(r.url, buildId)}${
                r.postDataSha256 ? ` ${r.postDataSha256.slice(0, 12)}` : ''
              }`
          )
          .sort(byCodePoint),
        resourceTypes: Object.fromEntries(Object.entries(types).sort()),
        unmatched: log.unmatched.length,
      }
      if (tz === 'UTC' && screens) {
        out.screens = {}
        for (const w of WIDTHS) {
          await page.setViewportSize({ width: w, height: 900 })
          await settle(page, inflight, () =>
            page.evaluate(() =>
              document.body ? document.body.scrollHeight : 0
            )
          )
          await page.evaluate(() => document.fonts && document.fonts.ready)
          out.screens[w] = await page.screenshot({
            fullPage: true,
            animations: 'disabled',
            caret: 'hide',
          })
        }
      }
    } finally {
      await context.close()
    }
  }
  return out
}

// the aspects compared, each with its owning test and key
function compare(a, b) {
  const diffs = []
  const add = (test, key, from, to) => diffs.push({ test, key, from, to })
  const j = (v) => (v === undefined ? '<absent>' : JSON.stringify(v))
  if (a.status !== b.status) add('T-601', `${a.url}/status`, a.status, b.status)
  const hk = new Set([...Object.keys(a.headers), ...Object.keys(b.headers)])
  for (const h of [...hk].sort(byCodePoint))
    if (j(a.headers[h]) !== j(b.headers[h]))
      add(
        'T-603',
        `${a.url}/${a.cls}@proxy/${h}`,
        j(a.headers[h]),
        j(b.headers[h])
      )
  if (j(a.head) !== j(b.head))
    add('T-602', `${a.url}/head`, sha256(j(a.head)), sha256(j(b.head)))
  if (j(a.bodyDom) !== j(b.bodyDom))
    add('T-728', `${a.url}/ssr-body`, firstDiff(a.bodyDom, b.bodyDom), '')
  if (j(a.census) !== j(b.census))
    add('T-605', `${a.url}/census`, firstDiff(a.census, b.census), '')
  if (j(a.nextData) !== j(b.nextData))
    add(
      'T-610',
      `${a.url}/__NEXT_DATA__`,
      sha256(j(a.nextData)),
      sha256(j(b.nextData))
    )
  if (j(a.nextDataJson) !== j(b.nextDataJson))
    add(
      'T-610',
      `${a.url}/_next/data`,
      sha256(j(a.nextDataJson)),
      sha256(j(b.nextDataJson))
    )
  if (j(a.wire) !== j(b.wire))
    add('T-607', `${a.url}/ssr-wire`, sha256(j(a.wire)), sha256(j(b.wire)))
  for (const tz of Object.keys(a.browser)) {
    const x = a.browser[tz]
    const y = b.browser[tz] || {}
    if (
      j(x.console) !== j(y.console) ||
      j(x.pageErrors) !== j(y.pageErrors) ||
      j(x.windowErrors) !== j(y.windowErrors)
    )
      add(
        'T-701',
        `${a.url}/console@${tz}`,
        j([x.console, x.pageErrors, x.windowErrors]),
        j([y.console, y.pageErrors, y.windowErrors])
      )
    if (j(x.requests) !== j(y.requests))
      add(
        'T-702',
        `${a.url}/requests@${tz}`,
        firstDiff(x.requests, y.requests),
        ''
      )
    if (j(x.hydrated) !== j(y.hydrated))
      add(
        'T-728',
        `${a.url}/hydrated@${tz}`,
        firstDiff(x.hydrated, y.hydrated),
        ''
      )
  }
  return diffs
}
function firstDiff(a = [], b = []) {
  a = a || []
  b = b || []
  for (let i = 0; i < Math.max(a.length, b.length); i++)
    if (a[i] !== b[i])
      return `line ${i + 1}: ${String(a[i]).slice(0, 160)} | ${String(
        b[i]
      ).slice(0, 160)}`
  return 'equal'
}

// tool self-test of the comparison (no stack, no browser): each aspect, changed in a copy of a render, gives one
// diff with its owning test and key; an exact ledger row explains a diff, a near one does not
function selfTest() {
  const fails = []
  const ok = (c, m) => {
    if (!c) fails.push(m)
    console.log(`${c ? 'ok  ' : 'FAIL'} ${m}`)
  }
  const base = {
    url: '/works/1/',
    status: 200,
    cls: 'HTML',
    headers: { 'cache-control': ['private'], 'x-a': ['1'] },
    head: { title: 'a' },
    bodyDom: ['<div>', '"text"'],
    census: ['/html[1]/body[1] class="a"'],
    nextData: { page: '/works/[id]', props: { a: 1 } },
    nextDataJson: { status: 200, body: { a: 1 } },
    wire: [{ method: 'GET', url: 'https://api.core.ac.uk/v3/works/1' }],
    browser: {
      UTC: {
        console: [],
        pageErrors: [],
        windowErrors: [],
        requests: ['GET <stack>/works/1/'],
        hydrated: ['<div>'],
      },
    },
  }
  const clone = () => JSON.parse(JSON.stringify(base))
  ok(compare(base, clone()).length === 0, 'equal renders: 0 diffs')
  const cases = [
    ['T-601', (r) => (r.status = 500), '/works/1//status'],
    ['T-603', (r) => (r.headers['x-a'] = ['2']), '/works/1//HTML@proxy/x-a'],
    ['T-603', (r) => delete r.headers['x-a'], '/works/1//HTML@proxy/x-a'],
    ['T-602', (r) => (r.head.title = 'b'), '/works/1//head'],
    ['T-728', (r) => r.bodyDom.push('"x"'), '/works/1//ssr-body'],
    [
      'T-605',
      (r) => (r.census[0] = '/html[1]/body[1] class="b"'),
      '/works/1//census',
    ],
    ['T-610', (r) => (r.nextData.props.a = 2), '/works/1//__NEXT_DATA__'],
    ['T-610', (r) => (r.nextDataJson.body.a = 2), '/works/1//_next/data'],
    [
      'T-607',
      (r) => r.wire.push({ method: 'GET', url: 'x' }),
      '/works/1//ssr-wire',
    ],
    [
      'T-701',
      (r) => r.browser.UTC.console.push('Error: x'),
      '/works/1//console@UTC',
    ],
    [
      'T-701',
      (r) => r.browser.UTC.pageErrors.push('x'),
      '/works/1//console@UTC',
    ],
    [
      'T-702',
      (r) => r.browser.UTC.requests.push('POST x'),
      '/works/1//requests@UTC',
    ],
    [
      'T-728',
      (r) => (r.browser.UTC.hydrated = ['<span>']),
      '/works/1//hydrated@UTC',
    ],
  ]
  for (const [test, change, key] of cases) {
    const b = clone()
    change(b)
    const d = compare(base, b)
    ok(
      d.length === 1 && d[0].test === test && d[0].key === key,
      `${test} ${key}: one diff`
    )
  }
  const b = clone()
  b.headers['x-a'] = ['2']
  const [d] = compare(base, b)
  const rows = [
    {
      id: 'AD-001',
      test: 'T-603',
      key: '/works/1//HTML@proxy/x-a',
      from: '["1"]',
      to: '["2"]',
    },
  ]
  const match = (r) =>
    r.test === d.test &&
    r.key === d.key &&
    String(r.from) === String(d.from) &&
    String(r.to) === String(d.to)
  ok(rows.some(match), 'an exact (test, key, from, to) row matches')
  ok(
    !rows.map((r) => ({ ...r, to: '["3"]' })).some(match),
    'a row with another `to` does not'
  )
  // the header key per URL: the same change on another URL of the class has that URL's key, and a row on another
  // URL's key, or on the class key alone, does not explain the diff
  const other = { ...clone(), url: '/works/2/' }
  const otherChanged = JSON.parse(JSON.stringify(other))
  otherChanged.headers['x-a'] = ['2']
  const d2 = compare(other, otherChanged)
  ok(
    d2.length === 1 && d2[0].key === '/works/2//HTML@proxy/x-a',
    "T-603 the same header change on another URL: that URL's key"
  )
  ok(
    !rows.map((r) => ({ ...r, key: '/works/2//HTML@proxy/x-a' })).some(match),
    "a row on another URL's header key does not"
  )
  ok(
    !rows.map((r) => ({ ...r, key: 'HTML@proxy/x-a' })).some(match),
    'a row on the class key alone does not'
  )
  console.log(
    fails.length ? `self-test: ${fails.length} FAILED` : 'self-test: all passed'
  )
  process.exit(fails.length ? 1 : 0)
}

async function main() {
  const o = opts(process.argv.slice(2))
  if (o.has('--self-test')) return selfTest()
  if (o.has('--live'))
    throw new Error(
      '--live (GATE-x.6 live A/B) runs on release-recipe images in docker mode only: DEFERRED locally (owner notes §1, I-10)'
    )
  if (o.has('--controls')) {
    const c = readJson(path.join(REPO, 'test', 'faults', 'controls.json'))
    const set = (c.controls || []).filter((x) => x.fault)
    if (!set.length)
      throw new Error(
        'test/faults/controls.json holds no positive control yet (fixed at 2.7, 55 C4)'
      )
    throw new Error(
      'positive controls need the fault images of scripts/run-faults.mjs (2.7)'
    )
  }
  const name = o.get('--corpus', 'pilot')
  const self = o.has('--self')
  const goldenSpec = o.get('--golden', 'p2-local/golden')
  const findBuild = async (spec) =>
    /^[0-9a-f]{16}(-[a-z0-9-]+)?$/.test(spec)
      ? buildRecord({ key: spec })
      : buildRecord({ ref: spec })
  const golden = await findBuild(goldenSpec)
  if (!golden) throw new Error(`no build for --golden ${goldenSpec}`)
  const candidate = self ? golden : await findBuild(o.get('--candidate', ''))
  if (!candidate) throw new Error('--candidate <build key|ref> (or --self)')
  const { buildDigest } = await import('./baseline-tools.mjs')
  // the digest of a build: the image ID in docker mode, the static+server content digest of a host build
  const digestOf = (b) => b.imageId || buildDigest(b.dir).next
  const dg = digestOf(golden)
  const dc = digestOf(candidate)
  if (!self && (golden.key === candidate.key || dg === dc))
    throw new Error(
      `--golden and --candidate have equal digests (${dg.slice(
        0,
        12
      )}); pass --self for golden vs golden`
    )
  await loadLibs()
  const list = readJson(path.join(corpusDir(name), 'urls.json'))
  const only = o.get('--grep') ? new RegExp(o.get('--grep')) : null
  const urls = list.urls
    .filter((u) => !only || only.test(u.url))
    .slice(0, Number(o.get('--limit', list.urls.length)))
  const timeZones = o.get('--tz', TIME_ZONES.join(',')).split(',')
  // screenshots: a seeded draw of --screens percent per stratum (at least one per stratum)
  const pct = Number(o.get('--screens', 10))
  const screenSeed = Number(o.get('--screen-seed', seedOf(`${name}-screens`)))
  const rand = rng(screenSeed)
  const shots = new Set()
  const byStratum = {}
  for (const u of urls)
    (byStratum[u.stratum] = byStratum[u.stratum] || []).push(u.url)
  for (const k of Object.keys(byStratum).sort(byCodePoint)) {
    const l = byStratum[k].slice().sort(byCodePoint)
    const n = pct > 0 ? Math.max(1, Math.round((l.length * pct) / 100)) : 0
    for (const u of shuffle(l, rand).slice(0, n)) shots.add(u)
  }
  const id = o.get(
    '--id',
    `${self ? 'self' : 'ab'}-${name}-${new Date()
      .toISOString()
      .replace(/[-:]/g, '')
      .slice(0, 15)}`
  )
  const out = path.join(ARTIFACT_DIR, 'corpus', 'runs', id)
  fs.mkdirSync(out, { recursive: true })
  const replay = buildReplayRoot(name, { base: 'members' })
  const { chromium } = requireE2e('@playwright/test')
  const arms = [
    { name: 'golden', build: golden, run: `${id}-g` },
    { name: 'candidate', build: candidate, run: `${id}-c` },
  ]
  const report = {
    schema: 1,
    id,
    corpus: name,
    self,
    golden: {
      key: golden.key,
      buildId: golden.buildId,
      commit: golden.commit,
      digest: dg,
    },
    candidate: {
      key: candidate.key,
      buildId: candidate.buildId,
      commit: candidate.commit,
      digest: dc,
    },
    timeZones,
    screens: {
      percent: pct,
      seed: screenSeed,
      urls: [...shots].sort(byCodePoint),
    },
    replayRoot: {
      corpusFiles: replay.corpusFiles,
      fixtureFiles: replay.fixtureFiles,
    },
    startedAt: new Date().toISOString(),
    urls: [],
    diffs: [],
  }
  const ledger = lib.ledger
  let browser = null
  try {
    for (const arm of arms) {
      stackDown(arm.run)
      arm.env = stackUp(arm.run, {
        build: arm.build,
        sandbox: name,
      })
      arm.resolver = resolverCore.createResolver({
        root: replay.root,
        linkOrigin: arm.env.baseURL,
      })
      arm.timeZones = timeZones
    }
    // --inject <stub rule JSON>: a fault on the candidate arm's SSR stub (tool self-test of the comparison: a
    // --self run with an injected fault must report diffs); recorded in the report
    if (o.get('--inject')) {
      const rule = JSON.parse(o.get('--inject'))
      report.injected = { arm: 'candidate', rule }
      report.injected.id = (
        await control(arms[1].env, 'POST', '/rules', rule)
      ).id
    }
    browser = await chromium.launch({ args: ['--disable-partial-raster'] })
    let i = 0
    for (const u of urls) {
      i++
      const shot = shots.has(u.url)
      const ra = await renderOne(arms[0], u.url, { screens: shot, browser })
      const rb = await renderOne(arms[1], u.url, { screens: shot, browser })
      const diffs = compare(ra, rb)
      const buildCheck = [
        [ra, golden],
        [rb, candidate],
      ].filter(([r, b]) => r.servedBuildId && r.servedBuildId !== b.buildId)
      for (const [r, b] of buildCheck)
        diffs.push({
          test: 'C4',
          key: `${u.url}/buildId@${r.arm}`,
          from: b.buildId,
          to: r.servedBuildId,
          fatal: true,
        })
      if (shot)
        for (const w of WIDTHS) {
          const c = lib.pixels.comparePngs(ra.screens[w], rb.screens[w])
          if (!c.sameSize || c.diffPixels) {
            const f = path.join(out, `${sha256(u.url).slice(0, 12)}-${w}`)
            fs.writeFileSync(`${f}-golden.png`, ra.screens[w])
            fs.writeFileSync(`${f}-candidate.png`, rb.screens[w])
            if (c.diffPng) fs.writeFileSync(`${f}-diff.png`, c.diffPng)
            diffs.push({
              test: 'T-801',
              key: `${u.url}/${w}.png`,
              from: c.sameSize
                ? `${c.width}x${c.height}`
                : `golden ${c.width[0]}x${c.height[0]}, candidate ${c.width[1]}x${c.height[1]}`,
              to: `${c.diffPixels} differing pixels`,
              never: true,
            })
          }
        }
      // ledger: (test, key, from, to) exact, never for T-801
      const rows = ledger ? ledger.ledgerRows : null
      for (const d of diffs) {
        if (d.never || d.fatal || !rows) continue
        const r = rows(d.test).find(
          (x) =>
            x.key === d.key &&
            String(x.from) === String(d.from) &&
            String(x.to) === String(d.to)
        )
        if (r) d.ad = r.id
      }
      const unexplained = diffs.filter((d) => !d.ad)
      report.urls.push({
        url: u.url,
        stratum: u.stratum,
        renders: {
          golden: {
            build: ra.build,
            servedBuildId: ra.servedBuildId,
            status: ra.status,
            settled: Object.values(ra.browser).every((x) => x.settled),
          },
          candidate: {
            build: rb.build,
            servedBuildId: rb.servedBuildId,
            status: rb.status,
            settled: Object.values(rb.browser).every((x) => x.settled),
          },
        },
        screenshots: shot ? WIDTHS : [],
        diffs: diffs.length,
        unexplained: unexplained.length,
      })
      for (const d of diffs) report.diffs.push({ url: u.url, ...d })
      console.log(
        `${String(i).padStart(3)}/${urls.length} ${u.url.slice(0, 80)} ${
          ra.status
        }/${rb.status} ${
          unexplained.length ? `${unexplained.length} DIFF` : 'same'
        }${shot ? ' (screens)' : ''}`
      )
    }
  } finally {
    if (browser) await browser.close()
    for (const arm of arms) stackDown(arm.run)
  }
  report.endedAt = new Date().toISOString()
  const unexplained = report.diffs.filter((d) => !d.ad)
  report.summary = {
    urls: report.urls.length,
    renderedTwice: report.urls.filter(
      (u) =>
        u.renders.golden.status !== undefined &&
        u.renders.candidate.status !== undefined
    ).length,
    screenshots: report.screens.urls.length,
    diffs: report.diffs.length,
    accepted: report.diffs.filter((d) => d.ad).length,
    unexplained: unexplained.length,
    byAspect: unexplained.reduce(
      (a, d) => ({ ...a, [d.test]: (a[d.test] || 0) + 1 }),
      {}
    ),
    unsettled: report.urls.filter(
      (u) => !u.renders.golden.settled || !u.renders.candidate.settled
    ).length,
    ruleOfThree: report.urls.length
      ? 1 - Math.pow(0.05, 1 / report.urls.length)
      : null,
  }
  report.pass = unexplained.length === 0
  writeJson(path.join(out, 'report.json'), report)
  console.log(
    `corpus ${self ? '--self' : 'A/B'} ${name}: ${
      report.summary.urls
    } URLs, rendered twice ${report.summary.renderedTwice}, ${
      report.summary.screenshots
    } with screenshots; diffs ${report.summary.diffs} (${
      report.summary.unexplained
    } unexplained) -> ${report.pass ? 'PASS' : 'FAIL'}; ${path.join(
      out,
      'report.json'
    )}`
  )
  process.exit(report.pass ? 0 : 1)
}

if (fileURLToPath(import.meta.url) === path.resolve(process.argv[1] || ''))
  main().catch((e) => {
    console.error(process.env.P2_DEBUG ? e.stack : e.message)
    process.exit(1)
  })
