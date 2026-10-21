#!/usr/bin/env node
// corpus-sanitise.mjs - the committed form of a C4 corpus URL list (42 §7, 55 C4). Runs before the recording,
// so the recorded responses belong to the committed URLs.
//
//   node scripts/corpus-sanitise.mjs --name <corpus> [--seed <n>] [--min-clients 10]
//   node scripts/corpus-sanitise.mjs --name <corpus> --scan        re-run the grep of the committed files
//   node scripts/corpus-sanitise.mjs --self-test
//
// Input: $ARTIFACT_DIR/corpus/<name>/sample.json (scripts/corpus-build.mjs, raw). Output:
// test/corpus/<name>/urls.json and test/corpus/<name>/scrub-report.json.
// Rules:
//   - kept: the path (segments and ids, as logged, encoding included), parameter names and order, structural
//     values (page, limit, offset, sort, t and any purely numeric or hexadecimal value), and in free text: the
//     operators AND, OR, NOT, field prefixes (`authors:`, `yearPublished>=` ...), quotes, brackets, punctuation,
//     whitespace, the encoding (`+` or `%20` for spaces, percent-encoded or literal characters, hex case), the
//     token count and each token's script;
//   - replaced: every free-text word by a word of the same script drawn with the recorded seed from the work
//     titles of the committed fixtures (test/fixtures/api/**), case shape kept; numbers of more than 4 digits by
//     seeded digits of the same length;
//   - unless that exact URL (path and query) was sent by >= --min-clients distinct clients in the window (counted
//     on the raw extract by corpus-build): then it is kept as logged;
//   - the T-612 edge URLs (stratum `edge`, synthetic test targets) are kept as they are;
//   - no IP, user-agent, referrer, cookie or timestamp field is written (the output holds url and stratum only).
// The report lists the rules, the counts (terms replaced and kept, per script), never a replaced term, and a grep
// of every file under test/corpus/<name>/ for IP addresses, e-mail addresses and token patterns (and the API key,
// compared in memory, never printed): all must be 0. The owner signs the report in the corpus PR (DEFERRED).
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  FIXTURES,
  corpusDir,
  workDir,
  readJson,
  writeJsonPretty,
  rng,
  opts,
  walk,
  byCodePoint,
} from './corpus-lib.mjs'

export const STRUCTURAL = new Set(['page', 'limit', 'offset', 'sort', 't'])
const OPERATORS = new Set(['AND', 'OR', 'NOT'])
const SCRIPTS = [
  'Latin',
  'Cyrillic',
  'Greek',
  'Han',
  'Hiragana',
  'Katakana',
  'Hangul',
  'Arabic',
  'Hebrew',
  'Devanagari',
  'Thai',
]
const scriptRe = Object.fromEntries(
  SCRIPTS.map((s) => [s, new RegExp(`^\\p{Script=${s}}`, 'u')])
)
export const scriptOf = (word) =>
  SCRIPTS.find((s) => scriptRe[s].test(word)) || 'Other'
// letters of a script for the rare case the fixture titles hold no word of it
const FALLBACK_RANGE = {
  Latin: [0x61, 0x7a],
  Cyrillic: [0x430, 0x44f],
  Greek: [0x3b1, 0x3c9],
  Han: [0x4e00, 0x4fff],
  Hiragana: [0x3041, 0x3093],
  Katakana: [0x30a1, 0x30f3],
  Hangul: [0xac00, 0xae00],
  Arabic: [0x627, 0x64a],
  Hebrew: [0x5d0, 0x5ea],
  Devanagari: [0x915, 0x939],
  Thai: [0xe01, 0xe2e],
  Other: [0x61, 0x7a],
}

// ---------- the word pool: titles of the committed fixtures ----------
export function wordPool(root = path.join(FIXTURES, 'api')) {
  const words = new Set()
  const take = (v, key) => {
    if (Array.isArray(v)) v.forEach((x) => take(x, key))
    else if (v && typeof v === 'object')
      for (const [k, x] of Object.entries(v)) take(x, k)
    else if (typeof v === 'string' && key === 'title')
      for (const m of v.matchAll(/\p{L}[\p{L}\p{M}]{2,}/gu))
        words.add(m[0].toLowerCase())
  }
  for (const f of walk(root)) {
    const rec = readJson(path.join(root, f), null)
    if (!rec || !rec.response || !rec.response.body) continue
    const b = rec.response.body
    let data = null
    if (b.encoding === 'json') data = b.data
    else if (b.encoding === 'utf8')
      try {
        data = JSON.parse(b.data)
      } catch {
        data = null
      }
    if (data) take(data, null)
  }
  const pool = {}
  for (const w of [...words].sort(byCodePoint)) {
    const s = scriptOf(w)
    ;(pool[s] = pool[s] || []).push(w)
  }
  return pool
}

const shapeLike = (word, like) => {
  if (like === like.toUpperCase() && like !== like.toLowerCase())
    return word.toUpperCase()
  if (like[0] === like[0].toUpperCase() && like[0] !== like[0].toLowerCase())
    return word[0].toUpperCase() + word.slice(1)
  return word
}

// ---------- one query value ----------
const UNRESERVED = /[A-Za-z0-9\-_.~]/
export function sanitiseValue(raw, ctx) {
  const plusSpace = raw.includes('+') || !raw.includes('%20')
  const lowerHex = /%[0-9a-f][a-f]|%[a-f][0-9a-f]/.test(raw)
  let text
  try {
    text = decodeURIComponent(plusSpace ? raw.replace(/\+/g, ' ') : raw)
  } catch {
    // not decodable: an opaque value, replaced character for character by seeded letters
    ctx.stats.opaque++
    return raw.replace(/[A-Za-z]/g, () =>
      String.fromCharCode(0x61 + Math.floor(ctx.rand() * 26))
    )
  }
  const literal = new Set(
    raw.replace(/%[0-9A-Fa-f]{2}/g, '').replace(/\+/g, '')
  )
  const tokens = [
    ...text.matchAll(/(\p{L}[\p{L}\p{M}'’-]*)|(\p{N}+)|([^\p{L}\p{N}]+)/gu),
  ]
  let out = ''
  tokens.forEach((m, i) => {
    const [tok, word, num] = m
    const next = tokens[i + 1] ? tokens[i + 1][0] : ''
    if (word) {
      if (OPERATORS.has(word)) {
        ctx.stats.operators++
        out += word
      } else if (/^(:|>=|<=|>|<|=)/.test(next)) {
        ctx.stats.fieldPrefixes++
        out += word
      } else {
        const s = scriptOf(word)
        const list = ctx.pool[s]
        let w
        if (list && list.length) w = list[Math.floor(ctx.rand() * list.length)]
        else {
          const [a, b] = FALLBACK_RANGE[s] || FALLBACK_RANGE.Other
          w = Array.from({ length: Math.max(1, [...word].length) }, () =>
            String.fromCodePoint(a + Math.floor(ctx.rand() * (b - a + 1)))
          ).join('')
          ctx.stats.fallbackWords++
        }
        ctx.stats.termsReplaced++
        ctx.stats.byScript[s] = (ctx.stats.byScript[s] || 0) + 1
        out += shapeLike(w, word)
      }
    } else if (num) {
      if (num.length <= 4) out += num
      else {
        ctx.stats.numbersReplaced++
        out += Array.from({ length: num.length }, () =>
          String(Math.floor(ctx.rand() * 10))
        ).join('')
      }
    } else out += tok
  })
  let enc = ''
  for (const ch of out) {
    if (UNRESERVED.test(ch)) enc += ch
    else if (ch === ' ') enc += plusSpace ? '+' : '%20'
    else if (literal.has(ch)) enc += ch
    else {
      const e = encodeURIComponent(ch)
      enc += lowerHex ? e.toLowerCase() : e
    }
  }
  return enc
}

// `q` is always free text (a number in it is a term); other parameters keep numeric and hexadecimal values
export const FREE_TEXT = new Set(['q'])
const isStructural = (name, value) =>
  STRUCTURAL.has(name) ||
  (!FREE_TEXT.has(name) &&
    (/^[0-9]*$/.test(value) || /^[0-9a-f]{8,64}$/i.test(value)))

export function sanitiseTarget(target, ctx) {
  const q = target.indexOf('?')
  if (q < 0) return target
  const pathPart = target.slice(0, q)
  const query = target.slice(q + 1)
  const pairs = query.split('&').map((pair) => {
    const i = pair.indexOf('=')
    const name = i < 0 ? pair : pair.slice(0, i)
    const value = i < 0 ? null : pair.slice(i + 1)
    ctx.stats.params[name] = (ctx.stats.params[name] || 0) + 1
    if (value == null || value === '' || isStructural(name, value)) return pair
    return `${name}=${sanitiseValue(value, ctx)}`
  })
  return `${pathPart}?${pairs.join('&')}`
}

// ---------- the grep of the committed files ----------
const PATTERNS = [
  [
    'ipv4',
    /(?<![\d.])(?:25[0-5]|2[0-4]\d|1?\d?\d)(?:\.(?:25[0-5]|2[0-4]\d|1?\d?\d)){3}(?![\d.])/,
  ],
  [
    'ipv6',
    /(?<![\w:])(?:[0-9a-f]{1,4}:){7}[0-9a-f]{1,4}(?![\w:])|(?<![\w:])(?:[0-9a-f]{1,4}:){1,6}:(?:[0-9a-f]{1,4}:){0,5}[0-9a-f]{1,4}(?![\w:])/i,
  ],
  [
    'email',
    /[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}/,
  ],
  ['bearer', /Bearer\s/],
  ['github-token', /\bgh[pousr]_[A-Za-z0-9]{36}\b|\bgithub_pat_/],
  ['npm-token', /\bnpm_[A-Za-z0-9]{36}\b/],
  ['authorization', /"authorization"/i],
  ['cookie', /"(set-)?cookie"/i],
]
export async function grepCommitted(dir) {
  const { readApiKey } = await import('./fixtures-scrub.mjs')
  const key = readApiKey()
  const hits = Object.fromEntries(PATTERNS.map(([n]) => [n, 0]))
  hits.apiKey = 0
  const files = walk(dir)
  const where = []
  for (const f of files) {
    let text = fs.readFileSync(path.join(dir, f), 'utf8')
    // the report's own grep section names the rules (e.g. "authorization": 0); the rest of it is scanned
    if (f === 'scrub-report.json')
      try {
        const r = JSON.parse(text)
        delete r.grep
        text = JSON.stringify(r)
      } catch {
        // scanned as it is
      }
    for (const [n, re] of PATTERNS)
      if (re.test(text)) {
        hits[n]++
        where.push({ file: f, rule: n })
      }
    if (key && text.includes(key)) {
      hits.apiKey++
      where.push({ file: f, rule: 'apiKey' })
    }
  }
  return {
    files: files.length,
    hits,
    where: where.slice(0, 50),
    clean: Object.values(hits).every((v) => v === 0),
  }
}

export function sanitiseSample(sample, { seed, minClients = 10, pool }) {
  const ctx = {
    rand: rng(seed),
    pool,
    stats: {
      termsReplaced: 0,
      numbersReplaced: 0,
      operators: 0,
      fieldPrefixes: 0,
      opaque: 0,
      fallbackWords: 0,
      byScript: {},
      params: {},
    },
  }
  let keptExact = 0
  let edge = 0
  let changed = 0
  const seen = new Set()
  const urls = []
  for (const u of sample.urls) {
    let url
    let kept
    if (u.stratum === 'edge') {
      url = u.target
      edge++
    } else if (u.clients >= minClients) {
      url = u.target
      kept = `exact URL from ${minClients}+ distinct clients`
      keptExact++
    } else {
      url = sanitiseTarget(u.target, ctx)
      if (url !== u.target) changed++
    }
    // two raw URLs can map to one sanitised URL; it is replayed once
    if (seen.has(url)) continue
    seen.add(url)
    urls.push({ url, stratum: u.stratum, ...(kept ? { kept } : {}) })
  }
  return { urls, stats: { ...ctx.stats, keptExact, edge, changed } }
}

const RULES = [
  'paths and ids kept as logged (encoding included)',
  'parameter names and order kept; structural values kept (page, limit, offset, sort, t, purely numeric or hexadecimal values)',
  'free text: AND/OR/NOT, field prefixes, quotes, brackets, punctuation, whitespace, encoding, token count and script kept',
  'each free-text word replaced by a seeded word of the same script from the work titles of the committed fixtures (case shape kept); numbers of more than 4 digits replaced by seeded digits',
  'an exact URL sent by >= min-clients distinct clients in the window is kept as logged',
  'T-612 edge URLs (synthetic test targets) kept as they are',
  'no IP, user-agent, referrer, cookie or timestamp field written: the list holds url and stratum only',
]

async function sanitise(name, o) {
  const sample = readJson(path.join(workDir(name), 'sample.json'))
  const seed = Number(o.get('--seed', String(sample.seed)))
  const minClients = Number(o.get('--min-clients', 10))
  const pool = wordPool()
  const res = sanitiseSample(sample, { seed, minClients, pool })
  const dir = corpusDir(name)
  writeJsonPretty(path.join(dir, 'urls.json'), {
    schema: 1,
    name,
    kind: sample.kind === 'pilot' ? 'pilot' : 'corpus',
    sanitiseSeed: seed,
    sampleSeed: sample.seed,
    minClients,
    window: sample.window || null,
    gateway: sample.gateway,
    strata: res.urls.reduce(
      (a, u) => ({ ...a, [u.stratum]: (a[u.stratum] || 0) + 1 }),
      {}
    ),
    urls: res.urls,
  })
  const report = {
    schema: 1,
    name,
    rules: RULES,
    seed,
    minClients,
    wordPool: {
      source: 'titles in test/fixtures/api/** (committed 2.2 fixtures)',
      words: Object.fromEntries(
        Object.entries(pool).map(([s, l]) => [s, l.length])
      ),
    },
    counts: {
      rawUrls: sample.urls.length,
      urls: res.urls.length,
      ...res.stats,
    },
    grep: await grepCommitted(dir),
    signedOffBy: null,
    signature:
      'DEFERRED: the owner signs the scrub report in the corpus PR (42 §7)',
  }
  writeJsonPretty(path.join(dir, 'scrub-report.json'), report)
  console.log(
    `corpus-sanitise ${name}: ${res.urls.length} URLs (${
      res.stats.changed
    } sanitised, ${res.stats.keptExact} kept exact, ${res.stats.edge} edge); ${
      res.stats.termsReplaced
    } terms replaced; grep ${report.grep.clean ? 'clean' : 'NOT CLEAN'}`
  )
  if (!report.grep.clean) process.exit(1)
}

async function scan(name) {
  const dir = corpusDir(name)
  const file = path.join(dir, 'scrub-report.json')
  const report = readJson(file)
  // the report itself is part of the scan (it must not hold a raw term either)
  report.grep = await grepCommitted(dir)
  report.scannedAt = 'after recording'
  writeJsonPretty(file, report)
  console.log(
    `corpus scan ${name}: ${report.grep.files} files, hits ${JSON.stringify(
      report.grep.hits
    )} -> ${report.grep.clean ? 'clean' : 'NOT CLEAN'}`
  )
  if (!report.grep.clean) {
    for (const w of report.grep.where) console.log(`  ${w.rule} ${w.file}`)
    process.exit(1)
  }
}

async function selfTest() {
  const fails = []
  const ok = (c, m) => {
    if (!c) fails.push(m)
    console.log(`${c ? 'ok  ' : 'FAIL'} ${m}`)
  }
  const pool = {
    Latin: ['alpha', 'beta', 'gamma', 'delta'],
    Cyrillic: ['мир'],
  }
  const ctx = () => ({
    rand: rng(5),
    pool,
    stats: {
      termsReplaced: 0,
      numbersReplaced: 0,
      operators: 0,
      fieldPrefixes: 0,
      opaque: 0,
      fallbackWords: 0,
      byScript: {},
      params: {},
    },
  })
  const c1 = ctx()
  const a = sanitiseTarget(
    '/search/?q=John+Smith+AND+documentType%3A%22thesis%22&page=2&sort=recency&t=fafad9968b7cd268',
    c1
  )
  ok(/^\/search\/\?q=/.test(a), 'path kept')
  ok(
    a.includes('&page=2&sort=recency&t=fafad9968b7cd268'),
    'structural values kept'
  )
  ok(!/John|Smith|thesis/.test(a), 'free-text words replaced')
  ok(
    /\+AND\+documentType%3A%22/.test(a),
    'operator, field prefix, quotes and encoding kept'
  )
  ok(
    c1.stats.termsReplaced === 3,
    `3 terms replaced (${c1.stats.termsReplaced})`
  )
  const tokensOf = (s) =>
    decodeURIComponent(s.replace(/\+/g, ' ')).match(/\p{L}+|\p{N}+/gu).length
  ok(
    tokensOf(a.split('&')[0].slice('/search/?q='.length)) === 5,
    'token count kept'
  )
  const c2 = ctx()
  const b = sanitiseTarget(
    '/data-providers/?q=%D0%BF%D1%80%D0%B8%D0%B2%D0%B5%D1%82%20world',
    c2
  )
  ok(b.includes('%20') && !b.includes('+'), '%20 space encoding kept')
  ok(
    scriptOf(decodeURIComponent(b.split('=')[1]).split(' ')[0]) === 'Cyrillic',
    'script of each token kept'
  )
  const c3 = ctx()
  const d = sanitiseTarget('/search/?q=%E4%B8%AD%E6%96%87', c3)
  ok(
    c3.stats.fallbackWords === 1 &&
      scriptOf(decodeURIComponent(d.split('=')[1])) === 'Han',
    'a script without pool words gets seeded letters of that script'
  )
  const c4 = ctx()
  ok(
    sanitiseTarget('/search/?q=123456789', c4) !== '/search/?q=123456789',
    'long numbers replaced'
  )
  ok(
    sanitiseTarget('/search/?q=2019', ctx()) === '/search/?q=2019',
    'years kept'
  )
  const sample = {
    urls: [
      { target: '/search/?q=popular+query', stratum: '/search', clients: 12 },
      { target: '/search/?q=rare+query', stratum: '/search', clients: 1 },
      { target: '/display/1?source=oai', stratum: 'edge', clients: 0 },
      { target: '/works/1001/', stratum: '/works', clients: 0 },
    ],
  }
  const r1 = sanitiseSample(sample, { seed: 9, pool })
  const r2 = sanitiseSample(sample, { seed: 9, pool })
  ok(JSON.stringify(r1) === JSON.stringify(r2), 'same seed, same output')
  ok(
    r1.urls[0].url === '/search/?q=popular+query' && r1.urls[0].kept,
    'exact URL from >=10 clients kept'
  )
  ok(r1.urls[1].url !== '/search/?q=rare+query', 'rare query replaced')
  ok(r1.urls[2].url === '/display/1?source=oai', 'edge URL kept')
  ok(r1.urls[3].url === '/works/1001/', 'path-only URL kept')
  ok(
    Object.keys(r1.urls[0]).every((k) =>
      ['url', 'stratum', 'kept'].includes(k)
    ),
    'output holds url, stratum (and kept) only'
  )
  const tmp = path.join(workDir('self-test'), 'grep')
  fs.rmSync(tmp, { recursive: true, force: true })
  fs.mkdirSync(tmp, { recursive: true })
  fs.writeFileSync(path.join(tmp, 'a.json'), '{"x":"clean value 10.1016/j.x"}')
  const g1 = await grepCommitted(tmp)
  fs.writeFileSync(
    path.join(tmp, 'b.json'),
    '{"ip":"192.168.10.4","m":"a@b.org","h":"fe80::1:2"}'
  )
  const g2 = await grepCommitted(tmp)
  ok(g1.clean, 'grep: a clean file is clean')
  ok(
    g2.hits.ipv4 === 1 &&
      g2.hits.email === 1 &&
      g2.hits.ipv6 === 1 &&
      !g2.clean,
    'grep finds IPv4, IPv6 and e-mail'
  )
  fs.rmSync(tmp, { recursive: true, force: true })
  const p = wordPool()
  ok(
    (p.Latin || []).length > 100,
    `word pool from fixture titles (${(p.Latin || []).length} Latin words)`
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
  if (!name) throw new Error('--name <corpus>')
  if (o.has('--scan')) return scan(name)
  return sanitise(name, o)
}

if (fileURLToPath(import.meta.url) === path.resolve(process.argv[1] || ''))
  main().catch((e) => {
    console.error(e.message)
    process.exit(1)
  })
