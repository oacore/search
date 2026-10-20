#!/usr/bin/env node
// fixtures-scrub.mjs - scrub rules for recorded API answers and the scrub check (40 §6, 42 §7).
//
// Library (used by scripts/fixtures-record.mjs):
//   scrubJson(value)            -> { value, stats }   blanks e-mails, phone numbers, contact fields, tokens, full texts
//   scrubText(text)             -> { text, stats }    same rules for non-JSON bodies (CSV, bibliographies)
//   scrubHeaders(headers)       -> { headers, stats } drops cookies and credentials from ordered header lists
//   readApiKey(file)            -> string | null      reads API_KEY from .env.fixtures (the key never leaves memory)
//
// CLI (`npm run fixtures:scrub-check`):
//   node scripts/fixtures-scrub.mjs --self-test
//   node scripts/fixtures-scrub.mjs [--root test/fixtures] [--env-file .env.fixtures] [--json]
//                                   [--write-sums] [--sums-only] [--no-sums]
//   Fails (exit 1) when a committed file under test/fixtures/** (except data-snapshot/, I-11) holds an e-mail
//   pattern, `Bearer `, an Authorization header or credential field, a phone number written as `tel:`, or the
//   API key itself (compared in memory; never printed). Then verifies test/fixtures/SHA256SUMS against the files
//   on disk (data-snapshot entries are checked only where the local copy exists, I-11).
//   --write-sums rewrites SHA256SUMS over the fixture data (api/, hand/, data/, data-snapshot/, scenarios.json,
//   record-plan.json; sha256sum format, paths relative to the root). Resolver code and request lists are not summed.
//
// What is kept: public scholarly metadata (titles, authors, abstracts, identifiers, links, provider names).
// What is blanked (value becomes "" - the type stays a string - and the count goes to the stats):
//   e-mail patterns inside any string; values of contact keys (email, contact*, phone, fax, mobile ...);
//   `fullText` (licensed third-party text, size); credential-looking values (keys named token, secret, api key,
//   authorization, password), host names of internal services quoted by the API (azurecontainerapps.io,
//   azurewebsites.net, svc.cluster.local -> upstream.invalid) and standalone key-like strings (32-128 chars of [A-Za-z0-9_-] with lower case,
//   upper case and a digit, outside data URIs and logo payloads).
// Node built-ins only.

import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { fileURLToPath } from 'node:url'

export const REPO = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..'
)
export const FIXTURES_DIR = path.join(REPO, 'test', 'fixtures')
export const SNAPSHOT_REL = 'data-snapshot/'

// ---------- patterns ----------
export const EMAIL_RE =
  /[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}/g
const EMAIL_TEST = new RegExp(EMAIL_RE.source)
const BEARER_RE = /Bearer\s+\S+/g
// +CC ... with 9-15 digits in groups; `tel:` URIs; labelled numbers
const PHONE_RE =
  /(?<![\w/.:-])(?:\+|00)\d{1,3}[ .-]?\(?\d{1,4}\)?(?:[ .-]?\d{2,4}){2,4}(?![\w])/g
const TEL_URI_RE = /\btel:[+\d][\d ().-]{5,}/gi
const LABELLED_PHONE_RE =
  /\b(?:tel(?:ephone)?|phone|fax|mobile)\s*[:.]\s*\+?\d[\d ().-]{6,}/gi
const KEYLIKE_RE = /^[A-Za-z0-9_-]{32,128}$/
// ISNI / ORCID identifiers (16 characters in groups of four) are public scholarly metadata, not phone numbers
const PERSON_ID_RE =
  /(?<![\w])\d{4}[ -]?\d{4}[ -]?\d{4}[ -]?\d{3}[\dXx](?![\w])/g
// host names of internal services that the API quotes in its error texts (the recommender upstream)
const INTERNAL_HOST_RE =
  /\b[a-z0-9-]+(?:\.[a-z0-9-]+)*\.(?:azurecontainerapps\.io|azurewebsites\.net|svc\.cluster\.local)\b/gi
export const INTERNAL_HOST_PLACEHOLDER = 'upstream.invalid'

const CONTACT_KEY_RE =
  /^(?:e-?mail|e-?mail_?address|mail|contact|contact_?(?:e-?mail|name|person|details|data|info|phone)|account_?e-?mail|owner_?e-?mail|admin_?e-?mail|phone|phone_?number|telephone|tel|mobile|fax)$/i
const CREDENTIAL_KEY_RE =
  /^(?:authorization|api_?-?key|apikey|access_?token|id_?token|refresh_?token|token|secret|client_?secret|password|passwd|credential)s?$/i
const FULLTEXT_KEY_RE = /^fullText$/

const digits = (s) => (s.match(/\d/g) || []).length
const hasMixed = (s) => /[a-z]/.test(s) && /[A-Z]/.test(s) && /\d/.test(s)

const newStats = () => ({
  emails: 0,
  phones: 0,
  contactFields: 0,
  credentials: 0,
  keyLike: 0,
  bearer: 0,
  fullText: 0,
  internalHosts: 0,
  headersDropped: 0,
})
const addStats = (a, b) => {
  for (const k of Object.keys(b)) a[k] = (a[k] || 0) + b[k]
  return a
}

export function scrubString(str, stats, { allowKeyLike = true } = {}) {
  let out = str
  if (out.length > 200 && /^(?:data:[^,]+,)?[A-Za-z0-9+/=\s]+$/.test(out)) {
    // base64 payload (logo): nothing to scrub inside, never regex-scan megabytes of image data
    return out
  }
  out = out.replace(BEARER_RE, () => {
    stats.bearer++
    return ''
  })
  out = out.replace(EMAIL_RE, () => {
    stats.emails++
    return ''
  })
  out = out.replace(INTERNAL_HOST_RE, () => {
    stats.internalHosts++
    return INTERNAL_HOST_PLACEHOLDER
  })
  const kept = []
  out = out.replace(PERSON_ID_RE, (m) => {
    kept.push(m)
    return `\u0001${kept.length - 1}\u0001`
  })
  out = out.replace(TEL_URI_RE, () => {
    stats.phones++
    return ''
  })
  out = out.replace(LABELLED_PHONE_RE, () => {
    stats.phones++
    return ''
  })
  out = out.replace(PHONE_RE, (m) => {
    const d = digits(m)
    if (d < 9 || d > 15) return m
    stats.phones++
    return ''
  })
  if (kept.length)
    out = out.replace(/\u0001(\d+)\u0001/g, (_, i) => kept[Number(i)])
  if (allowKeyLike && KEYLIKE_RE.test(out) && hasMixed(out)) {
    stats.keyLike++
    return ''
  }
  return out
}

export function scrubJson(input) {
  const stats = newStats()
  const walk = (v, key) => {
    if (Array.isArray(v)) return v.map((x) => walk(x, key))
    if (v && typeof v === 'object') {
      const o = {}
      for (const [k, x] of Object.entries(v)) {
        if (typeof x === 'string' && CONTACT_KEY_RE.test(k)) {
          if (x !== '') stats.contactFields++
          o[k] = ''
        } else if (typeof x === 'string' && CREDENTIAL_KEY_RE.test(k)) {
          if (x !== '') stats.credentials++
          o[k] = ''
        } else if (typeof x === 'string' && FULLTEXT_KEY_RE.test(k)) {
          if (x !== '') stats.fullText++
          o[k] = ''
        } else o[k] = walk(x, k)
      }
      return o
    }
    if (typeof v === 'string') return scrubString(v, stats)
    return v
  }
  return { value: walk(input, null), stats }
}

export function scrubText(text) {
  const stats = newStats()
  const text2 = scrubString(text, stats, { allowKeyLike: false })
  return { text: text2, stats }
}

const DROP_HEADERS = new Set([
  'set-cookie',
  'set-cookie2',
  'cookie',
  'authorization',
  'proxy-authorization',
  'x-api-key',
])
// tracking endpoints and protocol hints of the edge: no value for the tests
const VOLATILE_HEADERS = new Set([
  'report-to',
  'nel',
  'cf-ray',
  'cf-request-id',
  'alt-svc',
])
const CORE_ORIGIN_RE = /^https:\/\/(www\.)?core\.ac\.uk$/
export function scrubHeaders(headers, apiKey = null) {
  const stats = newStats()
  const out = []
  const echoesCoreOrigin = (headers || []).some(
    ([hn, hv]) =>
      String(hn).toLowerCase() === 'access-control-allow-origin' &&
      CORE_ORIGIN_RE.test(String(hv))
  )
  for (const [n, v] of headers || []) {
    const name = String(n).toLowerCase()
    const value = String(v)
    // a recorded CORS origin of the production site would block the page origin of the tests (I-26):
    // the browser guard adds the headers for the page origin where they are missing
    if (
      VOLATILE_HEADERS.has(name) ||
      (echoesCoreOrigin &&
        (name === 'access-control-allow-origin' ||
          name === 'access-control-allow-credentials'))
    ) {
      stats.headersDropped++
      continue
    }
    if (
      DROP_HEADERS.has(name) ||
      /Bearer\s/.test(value) ||
      (apiKey && value.includes(apiKey))
    ) {
      stats.headersDropped++
      continue
    }
    const s = scrubString(value, stats, { allowKeyLike: false })
    out.push([n, s])
  }
  return { headers: out, stats }
}

export { addStats, newStats }

// ---------- key ----------
export function readApiKey(file = path.join(REPO, '.env.fixtures')) {
  let text
  try {
    text = fs.readFileSync(file, 'utf8')
  } catch {
    return null
  }
  for (const line of text.split(/\r?\n/)) {
    const m = /^\s*(?:export\s+)?API_KEY\s*=\s*(.*?)\s*$/.exec(line)
    if (!m) continue
    let v = m[1]
    if (
      (v.startsWith('"') && v.endsWith('"')) ||
      (v.startsWith("'") && v.endsWith("'"))
    )
      v = v.slice(1, -1)
    return v || null
  }
  return null
}

export const redact = (s, key) => {
  let out = String(s).replace(BEARER_RE, 'Bearer [redacted]')
  if (key) out = out.split(key).join('[key]')
  return out
}

// ---------- check ----------
const walkFiles = (dir) =>
  fs.existsSync(dir)
    ? fs
        .readdirSync(dir, { withFileTypes: true })
        .sort((a, b) => (a.name < b.name ? -1 : 1))
        .flatMap((e) =>
          e.isDirectory()
            ? walkFiles(path.join(dir, e.name))
            : [path.join(dir, e.name)]
        )
    : []

const sha256File = (file) =>
  crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex')

const rel = (root, file) => path.relative(root, file).split(path.sep).join('/')

export function listFixtureFiles(root = FIXTURES_DIR) {
  return walkFiles(root)
    .map((f) => rel(root, f))
    .filter((r) => r !== 'SHA256SUMS' && !r.endsWith('.DS_Store'))
}

// SHA256SUMS covers the fixture data and their index, not the resolver code or the package request lists:
// api/, hand/, data/ (Jest data), data-snapshot/ (local, I-11), scenarios.json and record-plan.json
const SUMMED_RE =
  /^(?:(?:api|hand|data|data-snapshot)\/.+|scenarios\.json|record-plan\.json)$/
export const listSummedFiles = (root = FIXTURES_DIR) =>
  listFixtureFiles(root).filter((r) => SUMMED_RE.test(r))

export function scanFiles(root, key) {
  const problems = []
  const files = listFixtureFiles(root).filter(
    (r) => !r.startsWith(SNAPSHOT_REL)
  )
  for (const r of files) {
    const buf = fs.readFileSync(path.join(root, r))
    const text = buf.toString('utf8')
    const add = (rule, detail) => problems.push({ file: r, rule, detail })
    const em = text.match(EMAIL_RE)
    if (em) add('email', `${em.length} e-mail pattern(s)`)
    if (new RegExp(INTERNAL_HOST_RE.source, 'i').test(text))
      add('internal-host', 'internal service host name')
    if (/Bearer\s/.test(text)) add('bearer', '`Bearer ` present')
    if (key && text.includes(key)) add('api-key', 'the API key is present')
    if (/"authorization"\s*,/i.test(text) || /\["authorization"/i.test(text))
      add('authorization', 'Authorization header recorded')
    if (/"set-cookie"/i.test(text)) add('set-cookie', 'Set-Cookie recorded')
    if (TEL_URI_RE.test(text)) add('phone', 'tel: URI')
    TEL_URI_RE.lastIndex = 0
    if (r.endsWith('.json')) {
      try {
        const j = JSON.parse(text)
        const sw = (v, p) => {
          if (Array.isArray(v)) v.forEach((x, i) => sw(x, `${p}/${i}`))
          else if (v && typeof v === 'object')
            for (const [k, x] of Object.entries(v)) {
              // credential fields must be empty; an `email` field must not hold an address (a placeholder such as
              // `tester@localhost`, which has no domain suffix, is test data)
              if (
                typeof x === 'string' &&
                x !== '' &&
                (CREDENTIAL_KEY_RE.test(k) ||
                  (/^(?:e-?mail)$/i.test(k) &&
                    new RegExp(EMAIL_RE.source).test(x)))
              )
                add('field', `${p}/${k} holds a value`)
              sw(x, `${p}/${k}`)
            }
        }
        // fixture envelopes keep request.bodyText as a string; the body field is data
        sw(j.response && j.response.body ? j.response.body.data : j, '')
      } catch {
        add('json', 'not parseable')
      }
    }
  }
  return { files: files.length, problems }
}

export function readSums(root = FIXTURES_DIR) {
  const file = path.join(root, 'SHA256SUMS')
  if (!fs.existsSync(file)) return null
  const out = new Map()
  for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
    const m = /^([0-9a-f]{64})  (.+)$/.exec(line)
    if (m) out.set(m[2], m[1])
  }
  return out
}

export function computeSums(root = FIXTURES_DIR) {
  const lines = listSummedFiles(root).map((r) => {
    return `${sha256File(path.join(root, r))}  ${r}`
  })
  return `${lines
    .sort((a, b) => (a.slice(66) < b.slice(66) ? -1 : 1))
    .join('\n')}\n`
}

export function checkSums(root = FIXTURES_DIR) {
  const problems = []
  const sums = readSums(root)
  if (!sums) return [{ file: 'SHA256SUMS', rule: 'sums', detail: 'missing' }]
  const onDisk = new Set(listSummedFiles(root))
  for (const [r, h] of sums) {
    const f = path.join(root, r)
    if (!fs.existsSync(f)) {
      // the local data snapshot is not committed (I-11); everything else must exist
      if (!r.startsWith(SNAPSHOT_REL))
        problems.push({ file: r, rule: 'sums', detail: 'listed but missing' })
      continue
    }
    if (sha256File(f) !== h)
      problems.push({ file: r, rule: 'sums', detail: 'hash differs' })
  }
  for (const r of onDisk)
    if (!sums.has(r) && !r.startsWith(SNAPSHOT_REL))
      problems.push({ file: r, rule: 'sums', detail: 'not listed' })
  return problems
}

async function selfTest() {
  const os = await import('node:os')
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'fixscrub-'))
  const checks = []
  const ok = (name, cond) => {
    checks.push([name, Boolean(cond)])
    if (!cond) throw new Error(`self-test failed: ${name}`)
  }
  try {
    const st = newStats()
    const j = scrubJson({
      title: 'Climate',
      email: 'a.b@uni.example.org',
      contactEmail: 'x',
      abstract: 'write to c.d@lab.example.com or call +44 20 7946 0958',
      isni: '0000 0001 2222 015X',
      orcid: '0000-0002-1825-0097',
      doi: '10.1000/182',
      token: 'abc',
      fullText: 'licensed text',
      err: 'HTTP/2 404 for "https://svc-1.abc.uksouth.azurecontainerapps.io/x"',
      keyish: 'sKm3Qw8ZxT0pLr5Nv2HbYc9GdFa7JeUi',
    })
    void st
    const v = j.value
    ok('contact field blanked', v.email === '')
    ok('e-mail inside text blanked', !/@/.test(v.abstract))
    ok('phone number blanked', !/7946/.test(v.abstract))
    ok(
      'ISNI and ORCID kept',
      v.isni === '0000 0001 2222 015X' && v.orcid === '0000-0002-1825-0097'
    )
    ok('DOI and title kept', v.doi === '10.1000/182' && v.title === 'Climate')
    ok('credential and full text blanked', v.token === '' && v.fullText === '')
    ok('internal host replaced', v.err.includes(INTERNAL_HOST_PLACEHOLDER))
    ok('key-like string blanked', v.keyish === '')
    const h = scrubHeaders(
      [
        ['Set-Cookie', 'sid=1'],
        ['X-A', '1'],
        ['Authorization', 'Bearer abc'],
      ],
      'k'
    )
    ok(
      'cookie and credential headers dropped',
      h.headers.length === 1 && h.headers[0][0] === 'X-A'
    )
    // the scan
    fs.mkdirSync(path.join(tmp, 'api', 'sc'), { recursive: true })
    fs.mkdirSync(path.join(tmp, 'data-snapshot'))
    fs.writeFileSync(
      path.join(tmp, 'api', 'sc', 'good.json'),
      JSON.stringify({ response: { body: { data: { email: '' } } } })
    )
    fs.writeFileSync(
      path.join(tmp, 'data-snapshot', 'x.json'),
      '["someone@example.org"]'
    )
    ok(
      'clean tree passes, snapshot exempt',
      scanFiles(tmp, 'KEYKEYKEY').problems.length === 0
    )
    fs.writeFileSync(
      path.join(tmp, 'api', 'sc', 'bad.json'),
      JSON.stringify({
        a: 'someone@example.org',
        b: 'Bearer abc',
        c: 'KEYKEYKEY',
      })
    )
    const rules = scanFiles(tmp, 'KEYKEYKEY').problems.map((p) => p.rule)
    ok(
      'e-mail, Bearer and key found',
      ['email', 'bearer', 'api-key'].every((r) => rules.includes(r))
    )
    // sums
    fs.writeFileSync(path.join(tmp, 'SHA256SUMS'), computeSums(tmp))
    ok('sums verify', checkSums(tmp).length === 0)
    fs.appendFileSync(path.join(tmp, 'api', 'sc', 'good.json'), ' ')
    ok(
      'changed file detected',
      checkSums(tmp).some((p) => p.detail === 'hash differs')
    )
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true })
  }
  console.log(
    `fixtures-scrub self-test: ${checks.length}/${checks.length} checks passed`
  )
}

async function main() {
  const args = process.argv.slice(2)
  const opt = (n, d) => {
    const i = args.indexOf(n)
    return i >= 0 ? args[i + 1] : d
  }
  const has = (n) => args.includes(n)
  if (has('--self-test')) return selfTest()
  const root = path.resolve(opt('--root', FIXTURES_DIR))
  if (has('--write-sums')) {
    fs.writeFileSync(path.join(root, 'SHA256SUMS'), computeSums(root))
    console.log(`SHA256SUMS written: ${listSummedFiles(root).length} files`)
    return
  }
  const key = readApiKey(opt('--env-file', path.join(REPO, '.env.fixtures')))
  const result = {
    root: rel(REPO, root) || '.',
    scanned: 0,
    problems: [],
    notes: [],
  }
  if (!has('--sums-only')) {
    const scan = scanFiles(root, key)
    result.scanned = scan.files
    result.problems.push(...scan.problems)
    if (!key)
      result.notes.push(
        'API key file absent: the key comparison was skipped (patterns still checked)'
      )
    result.notes.push(
      `${SNAPSHOT_REL} exempt from the scan (public provider contact data kept local, I-11)`
    )
  }
  if (!has('--no-sums')) result.problems.push(...checkSums(root))
  if (has('--json')) console.log(JSON.stringify(result, null, 2))
  else {
    for (const p of result.problems)
      console.error(`FAIL ${p.rule}: ${p.file}: ${p.detail}`)
    for (const n of result.notes) console.log(`note: ${n}`)
    console.log(
      `scrub-check: ${result.scanned} files scanned, ${result.problems.length} problem(s)`
    )
  }
  process.exit(result.problems.length ? 1 : 0)
}

if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
)
  main()
