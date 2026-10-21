#!/usr/bin/env node
// corpus-build.mjs - the C4 corpus sample (55 C4, 42 §7): a stratified, seeded draw of page URLs from an access
// log extract, with a floor per routed prefix, plus the T-612 edge URLs. Output is the RAW sample (paths and
// queries as logged, per-URL request and distinct-client counts): it stays in $ARTIFACT_DIR and is never
// committed; scripts/corpus-sanitise.mjs turns it into the committed list.
//
//   node scripts/corpus-build.mjs --name <corpus> --log <extract> [--n 1000] [--floor 50] [--seed <n>]
//                                 [--window <from>/<to>] [--include-assets] [--no-edge]
//   node scripts/corpus-build.mjs --name pilot --pilot [--seed <n>]
//   node scripts/corpus-build.mjs --self-test
//
// --log: NDJSON (one object per request) or CSV with a header line; fields read: method, host, target (or path
//        + query, or url), client (or ip / client_ip / cf-connecting-ip), time (or timestamp). Only GET requests
//        to core.ac.uk (or without a host field) count. The client field is used only to count distinct clients
//        per exact URL (the sanitiser keeps an exact query only when >=10 clients sent it); it is hashed in
//        memory and never written.
// Strata: the routed prefix of the target in the gateway table (e2e/proxy/generate.mjs routeTable: /search,
//        /works, /outputs, /data-providers, /static/search, /display) or `other`; the T-612 edge URLs form the
//        `edge` stratum. Allocation: N by observed request share, at least min(floor, unique URLs) per routed
//        prefix; within a stratum a weighted draw without replacement (weight = requests) with the recorded
//        seed. Asset-like targets (build chunks, images, fonts) are left out unless --include-assets.
// --pilot: the pilot list of the 2.5 self-test: every fixture scenario page route (test/fixtures/scenarios.json
//        and the search/provider queries the fixtures answer) plus the T-612 edge URLs; no log, no draw.
// Writes $ARTIFACT_DIR/corpus/<name>/sample.json.
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { fileURLToPath } from 'node:url'
import {
  FIXTURES,
  ASSET_RE,
  gateway,
  opts,
  readJson,
  rng,
  weightedSample,
  workDir,
  writeJson,
  byCodePoint,
} from './corpus-lib.mjs'

// ---------- log parsing ----------
function parseCsvLine(line) {
  const out = []
  let cur = ''
  let q = false
  for (let i = 0; i < line.length; i++) {
    const c = line[i]
    if (q) {
      if (c === '"' && line[i + 1] === '"') {
        cur += '"'
        i++
      } else if (c === '"') q = false
      else cur += c
    } else if (c === '"') q = true
    else if (c === ',') {
      out.push(cur)
      cur = ''
    } else cur += c
  }
  out.push(cur)
  return out
}
export function readLog(text) {
  const lines = text.split(/\r?\n/).filter((l) => l.trim())
  if (!lines.length) return []
  if (lines[0].trim().startsWith('{')) return lines.map((l) => JSON.parse(l))
  const head = parseCsvLine(lines[0]).map((h) => h.trim().toLowerCase())
  return lines.slice(1).map((l) => {
    const cells = parseCsvLine(l)
    return Object.fromEntries(head.map((h, i) => [h, cells[i]]))
  })
}
const pick = (o, names) => {
  for (const n of names) if (o[n] != null && o[n] !== '') return String(o[n])
  return null
}
export function targetOf(row) {
  const t = pick(row, ['target', 'request_uri', 'uri'])
  if (t) return t
  const url = pick(row, ['url', 'clientrequesturi'])
  if (url) {
    if (url.startsWith('/')) return url
    try {
      const u = new URL(url)
      return u.pathname + u.search
    } catch {
      return null
    }
  }
  const p = pick(row, ['path', 'clientrequestpath'])
  if (!p) return null
  const q = pick(row, ['query', 'clientrequestquery']) || ''
  return q ? `${p}${q.startsWith('?') ? '' : '?'}${q}` : p
}

// ---------- the draw ----------
export async function buildSample(
  rows,
  {
    n = 1000,
    floor = 50,
    seed = 1,
    includeAssets = false,
    edge = true,
    window = null,
  }
) {
  const gw = await gateway()
  const byUrl = new Map()
  let counted = 0
  let skipped = 0
  for (const row of rows) {
    const method = (
      pick(row, ['method', 'clientrequestmethod']) || 'GET'
    ).toUpperCase()
    const host = pick(row, ['host', 'clientrequesthost'])
    const target = targetOf(row)
    if (
      method !== 'GET' ||
      (host && host !== 'core.ac.uk') ||
      !target ||
      !target.startsWith('/')
    ) {
      skipped++
      continue
    }
    if (
      !includeAssets &&
      ASSET_RE.test(target.split('?')[0] + (target.includes('?') ? '?' : ''))
    ) {
      skipped++
      continue
    }
    const client = pick(row, [
      'client',
      'ip',
      'client_ip',
      'clientip',
      'cf-connecting-ip',
      'remote_addr',
    ])
    let e = byUrl.get(target)
    if (!e) {
      e = {
        target,
        stratum: gw.stratum(target),
        requests: 0,
        clients: new Set(),
      }
      byUrl.set(target, e)
    }
    e.requests++
    // distinct clients by an in-memory hash; the value is never written
    if (client)
      e.clients.add(
        crypto.createHash('sha256').update(client).digest('hex').slice(0, 16)
      )
    counted++
  }
  const strata = new Map()
  for (const e of byUrl.values()) {
    if (!strata.has(e.stratum)) strata.set(e.stratum, { urls: [], requests: 0 })
    const s = strata.get(e.stratum)
    s.urls.push(e)
    s.requests += e.requests
  }
  // allocation (N in total): first the floor of every routed prefix (min(floor, its unique URLs); `other` has
  // none), then the rest of N by observed request share (largest remainder), each stratum capped at its unique
  // URLs; when the floors alone exceed N, N grows to their sum (recorded as `n`)
  const names = [...strata.keys()].sort(byCodePoint)
  const total = names.reduce((a, k) => a + strata.get(k).requests, 0)
  const cap = (k) => strata.get(k).urls.length
  const alloc = Object.fromEntries(
    names.map((k) => [k, k === 'other' ? 0 : Math.min(floor, cap(k))])
  )
  const floors = Object.values(alloc).reduce((a, b) => a + b, 0)
  let left = Math.max(0, n - floors)
  const want = n > floors ? n : floors
  for (let pass = 0; pass < 4 && left > 0; pass++) {
    const open = names.filter((k) => alloc[k] < cap(k))
    const w = open.reduce((a, k) => a + strata.get(k).requests, 0)
    if (!w) break
    const exact = open.map((k) => ({
      k,
      v: (left * strata.get(k).requests) / w,
    }))
    let given = 0
    for (const { k, v } of exact) {
      const add = Math.min(cap(k) - alloc[k], Math.floor(v))
      alloc[k] += add
      given += add
    }
    left -= given
    const rema = exact
      .map(({ k, v }) => ({ k, r: v - Math.floor(v) }))
      .sort((a, b) => b.r - a.r || byCodePoint(a.k, b.k))
    for (const { k } of rema) {
      if (left <= 0) break
      if (alloc[k] < cap(k)) {
        alloc[k]++
        left--
      }
    }
  }
  const rand = rng(seed)
  const urls = []
  for (const k of names) {
    const drawn = weightedSample(
      strata.get(k).urls,
      alloc[k],
      (e) => e.requests,
      (e) => e.target,
      rand
    )
    for (const e of drawn.sort((a, b) => byCodePoint(a.target, b.target)))
      urls.push({
        target: e.target,
        stratum: k,
        requests: e.requests,
        clients: e.clients.size,
      })
  }
  if (edge)
    for (const t of gw.edge())
      if (!urls.some((u) => u.target === t))
        urls.push({ target: t, stratum: 'edge', requests: 0, clients: 0 })
  return {
    schema: 1,
    kind: 'raw-sample',
    note: 'RAW: never committed (42 §7); run scripts/corpus-sanitise.mjs',
    seed,
    n: want,
    requestedN: n,
    floor,
    window,
    includeAssets,
    gateway: {
      source: gw.table.source,
      sha256: gw.table.sha256,
      prefixes: gw.prefixes,
    },
    log: { rows: rows.length, counted, skipped, uniqueUrls: byUrl.size },
    strata: Object.fromEntries(
      names.map((k) => [
        k,
        {
          requests: strata.get(k).requests,
          uniqueUrls: strata.get(k).urls.length,
          drawn: alloc[k],
        },
      ])
    ),
    edge: edge ? gw.edge().length : 0,
    urls,
  }
}

// ---------- pilot list ----------
export async function pilotSample({ seed = 1 }) {
  const gw = await gateway()
  const sc = readJson(path.join(FIXTURES, 'scenarios.json'))
  const routes = new Set()
  for (const s of Object.values(sc.scenarios || {}))
    if (s.route && s.route.startsWith('/')) routes.add(s.route)
  // the query pages the fixtures answer (scenario descriptions and picks of scenarios.json)
  for (const q of ['climate', 'zzzzqqq', 'x', 'q074e'])
    routes.add(`/search/?q=${q}`)
  routes.add('/search/?q=x&page=0')
  routes.add('/data-providers/')
  const picks = (sc.picks && sc.picks.dataProvidersQueries) || {}
  for (const d of picks.disjoint || [])
    routes.add(`/data-providers/?q=${encodeURIComponent(d.q)}`)
  if (picks.withTrProvider)
    routes.add(
      `/data-providers/?q=${encodeURIComponent(picks.withTrProvider.q)}`
    )
  const urls = [...routes].sort(byCodePoint).map((t) => ({
    target: t,
    stratum: gw.stratum(t),
    requests: 0,
    clients: 0,
  }))
  for (const t of gw.edge())
    if (!urls.some((u) => u.target === t))
      urls.push({ target: t, stratum: 'edge', requests: 0, clients: 0 })
  const strata = {}
  for (const u of urls) strata[u.stratum] = (strata[u.stratum] || 0) + 1
  return {
    schema: 1,
    kind: 'pilot',
    note: 'pilot list of the 2.5 tool self-test: fixture scenario routes + T-612 edge URLs (no traffic log; the real corpus is DEFERRED, VF-26/OD-35)',
    seed,
    gateway: {
      source: gw.table.source,
      sha256: gw.table.sha256,
      prefixes: gw.prefixes,
    },
    strata,
    urls,
  }
}

// ---------- self-test ----------
async function selfTest() {
  const fails = []
  const ok = (c, m) => {
    if (!c) fails.push(m)
    console.log(`${c ? 'ok  ' : 'FAIL'} ${m}`)
  }
  // synthetic extract: 3 prefixes with skewed traffic, an asset, a POST, another host
  const rows = []
  const add = (target, k, clients = 1) => {
    for (let i = 0; i < k; i++)
      rows.push({
        method: 'GET',
        host: 'core.ac.uk',
        target,
        client: `10.0.0.${i % clients}`,
        time: '2026-10-01T00:00:00Z',
      })
  }
  for (let i = 0; i < 400; i++) add(`/search/?q=t${i}`, 1 + (i % 5), 3)
  for (let i = 0; i < 80; i++) add(`/works/${1000 + i}/`, 2)
  for (let i = 0; i < 20; i++) add(`/data-providers/${i}/`, 1)
  add('/static/search/_next/static/chunks/main.js', 50)
  rows.push({
    method: 'POST',
    host: 'core.ac.uk',
    target: '/search/',
    client: 'x',
  })
  rows.push({
    method: 'GET',
    host: 'example.org',
    target: '/search/',
    client: 'x',
  })
  add('/search/?q=popular', 30, 12)
  const a = await buildSample(rows, { n: 200, floor: 50, seed: 7 })
  const b = await buildSample(rows, { n: 200, floor: 50, seed: 7 })
  const c = await buildSample(rows, { n: 200, floor: 50, seed: 8 })
  ok(JSON.stringify(a) === JSON.stringify(b), 'same seed, same sample')
  ok(
    JSON.stringify(a.urls) !== JSON.stringify(c.urls),
    'another seed, another draw'
  )
  ok(
    a.strata['/works'].drawn >= 50 && a.strata['/data-providers'].drawn === 20,
    'floor 50 per routed prefix (all 20 when fewer exist)'
  )
  ok(
    !a.urls.some(
      (u) => u.stratum !== 'edge' && u.target.includes('_next/static')
    ),
    'asset targets left out'
  )
  ok(
    a.log.skipped === 50 + 2,
    'POST and other hosts skipped, asset rows skipped'
  )
  const pop = a.urls.find((u) => u.target === '/search/?q=popular')
  ok(pop && pop.clients === 12, 'distinct clients counted per exact URL (12)')
  ok(
    a.urls.filter((u) => u.stratum === 'edge').length ===
      (await gateway()).edge().length,
    'T-612 edge URLs included'
  )
  const drawnNonEdge = a.urls.filter((u) => u.stratum !== 'edge').length
  ok(drawnNonEdge === 200, `N = 200 drawn (${drawnNonEdge})`)
  ok(!JSON.stringify(a).includes('10.0.0.'), 'no client value in the output')
  const csv =
    'method,host,path,query,ip,timestamp\nGET,core.ac.uk,/works/5/,,1.2.3.4,2026-10-01\nGET,core.ac.uk,/search/,"?q=a,b",1.2.3.5,2026-10-01\n'
  const parsed = readLog(csv)
  ok(
    targetOf(parsed[1]) === '/search/?q=a,b' &&
      targetOf(parsed[0]) === '/works/5/',
    'CSV extract with quoted cells'
  )
  const p = await pilotSample({ seed: 1 })
  ok(
    p.urls.length > 40 &&
      p.urls.some((u) => u.target === '/works/1001/') &&
      p.urls.some((u) => u.stratum === 'edge'),
    `pilot list: ${p.urls.length} URLs`
  )
  console.log(
    fails.length ? `self-test: ${fails.length} FAILED` : 'self-test: all passed'
  )
  process.exit(fails.length ? 1 : 0)
}

async function main() {
  const o = opts(process.argv.slice(2))
  if (o.has('--self-test')) return selfTest()
  const name = o.get('--name')
  if (!name || !/^[a-z0-9][a-z0-9-]{0,40}$/.test(name))
    throw new Error('--name <corpus> (lower case, digits, -)')
  const seed = Number(o.get('--seed', String(Date.now() % 2147483647)))
  let sample
  if (o.has('--pilot')) sample = await pilotSample({ seed })
  else {
    const log = o.get('--log')
    if (!log) throw new Error('--log <extract> or --pilot')
    sample = await buildSample(readLog(fs.readFileSync(log, 'utf8')), {
      n: Number(o.get('--n', 1000)),
      floor: Number(o.get('--floor', 50)),
      seed,
      includeAssets: o.has('--include-assets'),
      edge: !o.has('--no-edge'),
      window: o.get('--window', null),
    })
    sample.source = { log: path.basename(log) }
  }
  sample.builtAt = new Date().toISOString()
  const out = path.join(workDir(name), 'sample.json')
  writeJson(out, sample)
  console.log(
    `corpus-build ${name}: ${sample.urls.length} URLs (${Object.entries(
      sample.strata
    )
      .map(([k, v]) => `${k} ${typeof v === 'number' ? v : v.drawn}`)
      .join(', ')}), seed ${seed} -> ${out}`
  )
}

if (fileURLToPath(import.meta.url) === path.resolve(process.argv[1] || ''))
  main().catch((e) => {
    console.error(e.message)
    process.exit(1)
  })
