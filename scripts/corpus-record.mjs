#!/usr/bin/env node
// corpus-record.mjs - records the API answers of a sanitised C4 corpus through the golden build (55 C4, 42 §7).
//
//   node scripts/corpus-record.mjs --name <corpus> [--golden <ref>|--build <key>] [--budget 400] [--rounds 5]
//                                  [--direct 50] [--direct-seed <n>] [--limit <n URLs>] [--no-browser]
//   node scripts/corpus-record.mjs --name <corpus> --accept-only      acceptance and manifest from what exists
//
// How (SSR stub record mode, 40 §2.2): a golden stack (scripts/e2e-stack.mjs, own port slot) whose SSR stub
// serves a replay root (corpus answers so far + the E15 one-eligible-member fixture + the hand fixtures of the
// mutating calls) loads every corpus URL: SSR through the gateway-faithful proxy, then in Chromium with the
// journey guard's routing (browser calls E2, E8, E18, E21, E22 to the same resolver). Every request the root
// cannot answer (an unmatched triple at the stub's socket or in the browser) is recorded live by
// scripts/fixtures-record.mjs run(): read-only calls only, <= 1 request per 1.1 s, one at a time, a cache (a
// recorded triple is never requested again), a budget, 429 -> wait >= 10 min (2 retries) then abort, 401/403 ->
// abort. The app sends `Authorization: Bearer test-key` (inlined at build time); the recorder sends its own
// request with the key read from .env.fixtures in memory (only to api.core.ac.uk, never to doi.org or logo
// hosts without credentials) and stores no Authorization anywhere. Answers are scrubbed (40 §6) and written in
// resolver format to test/corpus/<name>/api/<name>-<endpoint>/<sha12>.json. The stub reloads the root and the
// URLs are loaded again, until a round finds nothing new (answers that depend on earlier answers: outputs of a
// work, provider of an output, citations of a DOI). Never recorded: E10, E16, E17 (mutating), E15 (replays use
// the one-eligible-member fixture: pickFeaturedMember is random), E19.
// Acceptance (55 C4): 0 recorded 401, 403 or 429; a per-endpoint status histogram; for --direct seeded recorded
// requests, a direct request with the key gives the same status class (else re-record). Results go to
// test/corpus/<name>/manifest.json (committed: counts, seeds, the build, no raw data), the browser calls as a
// scrubbed HAR to $ARTIFACT_DIR/corpus/<name>/browser.har, the recorder ledger and raw answers to
// $ARTIFACT_DIR/corpus/<name>/rec/ (never committed).
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
  writeJsonPretty,
  walk,
  opts,
  rng,
  shuffle,
  endpointOf,
  NEVER_RECORDED,
  buildReplayRoot,
  stackUp,
  stackDown,
  control,
  buildRecord,
  resolverCore,
  sha256,
} from './corpus-lib.mjs'

const requireE2e = createRequire(path.join(REPO, 'e2e', 'package.json'))
const RECORDABLE_HOSTS = new Set(['api.core.ac.uk', 'doi.org'])
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

const headerOf = (headers, name) => {
  const h = (headers || []).find(([n]) => n.toLowerCase() === name)
  return h ? h[1] : undefined
}

async function fetchSsr(env, target, timeoutMs = 90000) {
  const ctl = new AbortController()
  const t = setTimeout(() => ctl.abort(), timeoutMs)
  try {
    const r = await fetch(`${env.baseURL}${target}`, {
      redirect: 'manual',
      signal: ctl.signal,
      headers: { accept: 'text/html' },
    })
    const body = await r.text()
    return { status: r.status, length: body.length }
  } catch (e) {
    return { status: 0, error: e.message }
  } finally {
    clearTimeout(t)
  }
}

// load in Chromium until no request is in flight for 1.5 s (max 45 s)
async function browserPass(context, env, target) {
  const page = await context.newPage()
  const inflight = new Set()
  page.on('request', (r) => inflight.add(r))
  page.on('requestfinished', (r) => inflight.delete(r))
  page.on('requestfailed', (r) => inflight.delete(r))
  try {
    await page.goto(`${env.baseURL}${target}`, {
      waitUntil: 'load',
      timeout: 90000,
    })
    let quietSince = Date.now()
    const until = Date.now() + 45000
    while (Date.now() < until) {
      if (inflight.size) quietSince = Date.now()
      else if (Date.now() - quietSince > 1500) break
      await sleep(250)
    }
  } catch {
    // a page that does not load is still a corpus URL; its requests so far count
  } finally {
    await page.close()
  }
}

function entryOf(name, t, browser) {
  const endpoint = endpointOf(t.method, t.url)
  const body = t.bodyText != null ? t.bodyText : undefined
  const headers = {}
  if (t.accept) headers.Accept = t.accept
  if (t.contentType) headers['Content-Type'] = t.contentType
  return {
    id: `${name}.${endpoint.toLowerCase()}.${resolverCore.keyOf(
      t.method,
      t.url,
      body
    )}`,
    scenario: `${name}-${endpoint.toLowerCase()}`,
    endpoint,
    kind: 'live',
    rawUrl: true,
    accept: 'any',
    browser,
    // E21/E22 logo GETs: the browser sends no credentials
    anon: endpoint === 'E21',
    request: {
      method: t.method,
      url: t.url,
      ...(body !== undefined ? { body } : {}),
      headers,
    },
  }
}

function histogram(name) {
  const dir = path.join(corpusDir(name), 'api')
  const h = {}
  for (const f of walk(dir)) {
    const rec = readJson(path.join(dir, f))
    const e = endpointOf(rec.request.method, rec.request.url)
    h[e] = h[e] || {}
    h[e][rec.response.status] = (h[e][rec.response.status] || 0) + 1
  }
  return h
}

async function directCheck(name, { n, seed }) {
  const { run } = await import('./fixtures-record.mjs')
  const dir = path.join(corpusDir(name), 'api')
  const recs = walk(dir).map((f) => readJson(path.join(dir, f)))
  const pool = recs.filter(
    (r) =>
      !NEVER_RECORDED.has(endpointOf(r.request.method, r.request.url)) &&
      RECORDABLE_HOSTS.has(new URL(r.request.url).hostname)
  )
  const picked = shuffle(
    pool.sort((a, b) => (a.request.url < b.request.url ? -1 : 1)),
    rng(seed)
  ).slice(0, n)
  const out = path.join(workDir(name), 'direct')
  const rows = []
  for (const rec of picked) {
    const endpoint = endpointOf(rec.request.method, rec.request.url)
    const entry = {
      id: `direct.${resolverCore.keyOf(
        rec.request.method,
        rec.request.url,
        rec.request.bodyText
      )}`,
      scenario: 'direct',
      kind: 'live',
      rawUrl: true,
      accept: 'any',
      anon: endpoint === 'E21',
      request: {
        method: rec.request.method,
        url: rec.request.url,
        ...(rec.request.bodyText != null ? { body: rec.request.bodyText } : {}),
        headers:
          rec.request.method === 'POST'
            ? { 'Content-Type': 'application/json' }
            : {},
      },
    }
    const s = await run({
      out,
      entries: [entry],
      rawOnly: true,
      fixturesRoot: path.join(out, 'unused'),
      budget: 1000,
      quiet: true,
    })
    // a cached direct answer (an earlier check) carries no status in the summary: the ledger has it
    const fromLedger = () => {
      const f = path.join(out, 'ledger.ndjson')
      if (!fs.existsSync(f)) return null
      const hit = fs
        .readFileSync(f, 'utf8')
        .split('\n')
        .filter(Boolean)
        .map((l) => JSON.parse(l))
        .filter((l) => l.id === entry.id && l.status)
        .pop()
      return hit ? hit.status : null
    }
    const direct =
      Number(Object.keys(s.statuses)[0] || 0) || fromLedger() || null
    const cls = (x) => (x ? `${String(x)[0]}xx` : 'none')
    rows.push({
      endpoint,
      method: rec.request.method,
      url: rec.request.url,
      recorded: rec.response.status,
      direct,
      equalClass: cls(direct) === cls(rec.response.status),
      cached: s.cached > 0,
    })
  }
  return {
    n: rows.length,
    seed,
    equalClass: rows.filter((r) => r.equalClass).length,
    mismatches: rows.filter((r) => !r.equalClass),
    rows,
  }
}

function writeHar(name, browserKeys) {
  const dir = path.join(corpusDir(name), 'api')
  const entries = []
  for (const f of walk(dir)) {
    if (!browserKeys.has(path.basename(f, '.json'))) continue
    const rec = readJson(path.join(dir, f))
    const b = rec.response.body
    const text =
      b.encoding === 'json'
        ? JSON.stringify(b.data)
        : b.encoding === 'base64'
        ? b.data
        : b.data
    entries.push({
      startedDateTime: rec.source.recordedAt,
      time: 0,
      request: {
        method: rec.request.method,
        url: rec.request.url,
        httpVersion: 'HTTP/1.1',
        headers: [],
        queryString: [],
        cookies: [],
        headersSize: -1,
        bodySize: rec.request.bodyText ? rec.request.bodyText.length : 0,
        ...(rec.request.bodyText
          ? {
              postData: {
                mimeType: 'application/json',
                text: rec.request.bodyText,
              },
            }
          : {}),
      },
      response: {
        status: rec.response.status,
        statusText: '',
        httpVersion: 'HTTP/1.1',
        headers: rec.response.headers.map(([n, v]) => ({
          name: n,
          value: v,
        })),
        cookies: [],
        content: {
          size: text.length,
          mimeType: headerOf(rec.response.headers, 'content-type') || '',
          text,
          ...(b.encoding === 'base64' ? { encoding: 'base64' } : {}),
        },
        redirectURL: '',
        headersSize: -1,
        bodySize: -1,
      },
      cache: {},
      timings: { send: 0, wait: 0, receive: 0 },
    })
  }
  const har = {
    log: {
      version: '1.2',
      creator: { name: 'corpus-record', version: '1' },
      comment:
        'browser read-only calls of the corpus (E2, E8, E18, E21, E22), scrubbed; no Authorization recorded',
      entries,
    },
  }
  writeJson(path.join(workDir(name), 'browser.har'), har)
  return entries.length
}

async function main() {
  const o = opts(process.argv.slice(2))
  const name = o.get('--name')
  if (!name) throw new Error('--name <corpus>')
  const list = readJson(path.join(corpusDir(name), 'urls.json'))
  const golden = o.get('--golden', 'p2-local/golden')
  const build = o.get('--build')
    ? await buildRecord({ key: o.get('--build') })
    : await buildRecord({ ref: golden })
  if (!build) throw new Error(`no build for ${o.get('--build') || golden}`)
  const work = workDir(name)
  fs.mkdirSync(work, { recursive: true })
  const manifestFile = path.join(corpusDir(name), 'manifest.json')
  const prev = readJson(manifestFile, {})
  const state = readJson(path.join(work, 'record-state.json'), {
    attempted: [],
    browserKeys: [],
    unservable: [],
    rounds: [],
  })
  const attempted = new Set(state.attempted)
  const browserKeys = new Set(state.browserKeys)
  const unservable = new Map(state.unservable.map((u) => [u.url, u]))
  const saveState = () =>
    writeJson(path.join(work, 'record-state.json'), {
      attempted: [...attempted],
      browserKeys: [...browserKeys],
      unservable: [...unservable.values()],
      rounds: state.rounds,
    })
  const urls = list.urls.slice(0, Number(o.get('--limit', list.urls.length)))
  const budget = Number(o.get('--budget', 400))
  const runId = `corpus-rec-${name}`
  let totals = { requests: 0, cached: 0, statuses: {}, n429: 0 }

  if (!o.has('--accept-only')) {
    const { run } = await import('./fixtures-record.mjs')
    const { guardContext } = await import('../e2e/fixtures/guard.mjs')
    const { chromium } = requireE2e('@playwright/test')
    const replay = buildReplayRoot(name, { base: 'members' })
    stackDown(runId)
    const env = stackUp(runId, {
      build: build,
      sandbox: name,
    })
    let browser = null
    try {
      browser = o.has('--no-browser') ? null : await chromium.launch()
      const rounds = Number(o.get('--rounds', 5))
      for (let round = 1; round <= rounds; round++) {
        const resolver = resolverCore.createResolver({
          root: replay.root,
          linkOrigin: env.baseURL,
        })
        const found = new Map()
        const log = {
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
        const context = browser
          ? await browser.newContext({
              timezoneId: 'UTC',
              locale: 'en-GB',
              serviceWorkers: 'block',
            })
          : null
        if (context)
          await guardContext(context, {
            env,
            resolver,
            log,
            baseURL: env.baseURL,
          })
        let ssrStatus = {}
        for (const u of urls) {
          const mark = await control(env, 'POST', '/mark', {})
          const r = await fetchSsr(env, u.url)
          ssrStatus[r.status] = (ssrStatus[r.status] || 0) + 1
          const win = await control(env, 'GET', `/collect?since=${mark.seq}`)
          for (const rec of win.records) {
            if (rec.rule === 'unknown-host') {
              unservable.set(rec.url, {
                url: rec.url,
                reason: 'host not in test/ssr/hosts.json',
              })
              continue
            }
            if (rec.status !== 502 || rec.rule || rec.fixture) continue
            const key = resolverCore.keyOf(
              rec.method,
              rec.url,
              rec.bodyText || ''
            )
            if (!found.has(key))
              found.set(key, {
                t: {
                  method: rec.method,
                  url: rec.url,
                  bodyText: rec.bodyText,
                  accept: headerOf(rec.headers, 'accept'),
                  contentType: headerOf(rec.headers, 'content-type'),
                },
                browser: false,
              })
          }
          if (context) {
            const before = log.unmatched.length
            await browserPass(context, env, u.url)
            for (const t of log.unmatched.slice(before)) {
              const key = resolverCore.keyOf(t.method, t.url, t.bodyText || '')
              if (!found.has(key))
                found.set(key, {
                  t: {
                    method: t.method,
                    url: t.url,
                    bodyText: t.bodyText,
                    contentType: t.bodyText ? 'application/json' : undefined,
                  },
                  browser: true,
                })
            }
          }
        }
        if (context) await context.close()
        const entries = []
        const skipped = []
        for (const [key, f] of found) {
          const endpoint = endpointOf(f.t.method, f.t.url)
          const host = new URL(f.t.url).hostname
          if (attempted.has(key)) continue
          if (NEVER_RECORDED.has(endpoint) || !RECORDABLE_HOSTS.has(host)) {
            skipped.push({ endpoint, url: f.t.url })
            attempted.add(key)
            continue
          }
          attempted.add(key)
          if (f.browser) browserKeys.add(key)
          entries.push(entryOf(name, f.t, f.browser))
        }
        console.log(
          `round ${round}: ${urls.length} URLs (SSR ${JSON.stringify(
            ssrStatus
          )}), ${found.size} unmatched triples, ${entries.length} to record, ${
            skipped.length
          } never recorded`
        )
        let summary = null
        if (entries.length)
          summary = await run({
            out: path.join(work, 'rec'),
            entries,
            fixturesRoot: corpusDir(name),
            budget,
          })
        if (summary) {
          totals.requests += summary.requests
          totals.cached += summary.cached
          totals.n429 += summary.n429
          for (const [s, c] of Object.entries(summary.statuses))
            totals.statuses[s] = (totals.statuses[s] || 0) + c
        }
        state.rounds.push({
          round,
          urls: urls.length,
          ssr: ssrStatus,
          unmatched: found.size,
          recorded: entries.length,
          skipped: skipped.length,
          live: summary ? summary.requests : 0,
          failed: summary ? summary.failed.length : 0,
        })
        saveState()
        if (!entries.length) break
        // the stub and the browser resolver read the new answers
        buildReplayRoot(name, { base: 'members' })
        await control(env, 'POST', '/reload', {})
      }
    } finally {
      if (browser) await browser.close()
      stackDown(runId)
    }
  }

  // ---------- acceptance and manifest ----------
  const hist = histogram(name)
  const ledgerFile = path.join(work, 'rec', 'ledger.ndjson')
  const ledger = fs.existsSync(ledgerFile)
    ? fs
        .readFileSync(ledgerFile, 'utf8')
        .split('\n')
        .filter(Boolean)
        .map((l) => JSON.parse(l))
    : []
  const statusCount = (s) => ledger.filter((l) => l.status === s).length
  const recorded = (s) =>
    Object.values(hist).reduce((a, e) => a + (e[s] || 0), 0)
  const directN = Number(o.get('--direct', 50))
  const directSeed = Number(o.get('--direct-seed', prev.directSeed || 20261021))
  const direct = directN
    ? await directCheck(name, { n: directN, seed: directSeed })
    : null
  const harEntries = writeHar(name, browserKeys)
  const files = walk(path.join(corpusDir(name), 'api')).length
  const manifest = {
    schema: 1,
    name,
    kind: list.kind,
    urls: list.urls.length,
    recordedThrough: {
      build: build.key,
      buildId: build.buildId,
      commit: build.commit,
      ref: o.get('--build') ? null : golden,
      mode: 'host (local mode, owner notes §1)',
    },
    recordedAt: new Date().toISOString(),
    rounds: state.rounds,
    responses: files,
    browserResponses: browserKeys.size,
    harEntries,
    histogram: hist,
    neverRecorded: [...NEVER_RECORDED],
    unservable: [...unservable.values()],
    live: {
      ledgerRequests: ledger.filter((l) => l.status).length,
      thisRun: totals,
    },
    acceptance: {
      recorded401: recorded(401),
      recorded403: recorded(403),
      recorded429: recorded(429),
      ledger401: statusCount(401),
      ledger403: statusCount(403),
      ledger429: statusCount(429),
      direct: direct
        ? {
            n: direct.n,
            seed: direct.seed,
            equalClass: direct.equalClass,
            mismatches: direct.mismatches.map((m) => ({
              endpoint: m.endpoint,
              method: m.method,
              url: m.url,
              recorded: m.recorded,
              direct: m.direct,
            })),
          }
        : null,
    },
    directSeed,
  }
  manifest.acceptance.ok =
    manifest.acceptance.recorded401 === 0 &&
    manifest.acceptance.recorded403 === 0 &&
    manifest.acceptance.recorded429 === 0 &&
    (!direct || direct.mismatches.length === 0)
  writeJsonPretty(manifestFile, manifest)
  if (direct) writeJson(path.join(work, 'direct-check.json'), direct)
  console.log(
    `corpus-record ${name}: ${files} responses (${
      browserKeys.size
    } browser), histogram ${JSON.stringify(hist)}; 401/403/429 recorded ${
      manifest.acceptance.recorded401
    }/${manifest.acceptance.recorded403}/${
      manifest.acceptance.recorded429
    }; direct ${
      direct ? `${direct.equalClass}/${direct.n} same class` : 'skipped'
    } -> ${manifest.acceptance.ok ? 'accepted' : 'NOT accepted'}`
  )
  process.exit(manifest.acceptance.ok ? 0 : 1)
}

if (fileURLToPath(import.meta.url) === path.resolve(process.argv[1] || ''))
  main().catch((e) => {
    console.error(process.env.P2_DEBUG ? e.stack : e.message)
    process.exit(e.exitCode || 1)
  })

export { entryOf, histogram, sha256, ARTIFACT_DIR }
