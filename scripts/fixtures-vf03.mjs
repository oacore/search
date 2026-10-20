#!/usr/bin/env node
// fixtures-vf03.mjs - settles VF-03 (live API shape facts) from the answers the recorder kept (40 §6 item 3, 50 step 2.2).
//
//   npm run fixtures:vf03 -- [--out "$ARTIFACT_DIR/fixtures"] [--json <file>]
//
// Reads <out>/raw/*.json (unscrubbed answers, never committed) and writes <out>/vf03-report.json plus a summary on stdout.
// Sample = every works search answer (results), every work (E4) and output (E6) object, every work-output list (E5),
// every provider-output list (E13) and every provider object (E7, E11) among the raw answers. Objects are de-duplicated
// by record id. Nothing is fetched here.
//
// Reported (Q-001, Q-050, Q-053, Q-073, Q-074, Q-075, Q-081):
//   - the 410 body type: the statuses and body types of every error answer seen (a 410 is reported only if one was seen)
//   - publishedDate formats: null, "", Z, offset (zero or not), date-only, zone-less, other
//   - share of empty publishedDate with a numeric yearPublished (works) and string yearPublished (outputs)
//   - doi null / "" / absent, per works and outputs
//   - providers without `location` / with a zero location
//   - links.display URL shapes (does it use /display/?)
//   - presence of the payload keys downloadLink, year, oai, subjects (the keys the meta module reads) and the meta
//     tags that follow (citation_pdf_url, DC.format, DC.issued need downloadLink / year)
//   - a live work whose output has doi null (C6-prod row 8 probe), if one is in the sample
// Node built-ins only.

import fs from 'node:fs'
import path from 'node:path'

const args = process.argv.slice(2)
const opt = (n, d) => {
  const i = args.indexOf(n)
  return i >= 0 && args[i + 1] && !args[i + 1].startsWith('--')
    ? args[i + 1]
    : d
}
const out = path.resolve(
  opt(
    '--out',
    process.env.ARTIFACT_DIR
      ? path.join(process.env.ARTIFACT_DIR, 'fixtures')
      : ''
  )
)
if (!opt('--out') && !process.env.ARTIFACT_DIR) {
  console.error('usage: fixtures-vf03 --out <recorder out dir> [--json <file>]')
  process.exit(2)
}
const rawDir = path.join(out, 'raw')

const bodyOf = (rec) => {
  const buf = Buffer.from(
    rec.response.bodyBase64 || rec.bodyBase64 || '',
    'base64'
  )
  const text = buf.toString('utf8')
  try {
    return { json: JSON.parse(text), text }
  } catch {
    return { json: undefined, text }
  }
}
const header = (rec, name) =>
  ((rec.response.headers || rec.headers || []).find(
    ([n]) => n.toLowerCase() === name
  ) || [])[1]

const works = new Map()
const outputs = new Map()
const providers = new Map()
const outputsOfWork = new Map() // work id -> output list
const errors = []
const sources = {
  searchAnswers: 0,
  workObjects: 0,
  outputObjects: 0,
  outputLists: 0,
  providerLists: 0,
  providerObjects: 0,
}

for (const f of fs.readdirSync(rawDir).sort()) {
  let rec
  try {
    rec = JSON.parse(fs.readFileSync(path.join(rawDir, f), 'utf8'))
  } catch {
    continue
  }
  const att = f.includes('.attempt')
  const req = rec.request || {}
  const status = att ? rec.status : rec.response.status
  const url = req.url || ''
  const m = req.method
  if (att) {
    errors.push({
      endpoint: `attempt of ${rec.entry}`,
      status,
      type: 'kept 5xx attempt',
    })
    continue
  }
  const { json, text } = bodyOf(rec)
  if (status >= 400) {
    const path_ = new URL(url).pathname.replace(
      /\/(?:\d+|0x\d+)(?=\/|$)/g,
      '/:id'
    )
    errors.push({
      endpoint: `${m} ${path_}`,
      status,
      contentType: header(rec, 'content-type') || null,
      bodyType:
        json === undefined
          ? 'text'
          : Array.isArray(json)
          ? 'json array'
          : typeof json === 'object'
          ? 'json object'
          : typeof json,
      keys: json && typeof json === 'object' ? Object.keys(json) : undefined,
    })
    continue
  }
  if (
    m === 'POST' &&
    /\/v3\/search\/works(\?|$)/.test(url) &&
    json &&
    Array.isArray(json.results)
  ) {
    sources.searchAnswers++
    for (const w of json.results) works.set(w.id, w)
  } else if (
    m === 'GET' &&
    /\/v3\/works\/\d+(\?t=.*)?$/.test(url) &&
    json &&
    json.id
  ) {
    sources.workObjects++
    works.set(json.id, json)
  } else if (
    m === 'GET' &&
    /\/v3\/works\/\d+\/outputs$/.test(url) &&
    Array.isArray(json)
  ) {
    sources.outputLists++
    const wid = Number(/works\/(\d+)\//.exec(url)[1])
    outputsOfWork.set(wid, json)
    for (const o of json) outputs.set(o.id, o)
  } else if (
    m === 'GET' &&
    /\/v3\/outputs\/\d+$/.test(url) &&
    json &&
    json.id
  ) {
    sources.outputObjects++
    outputs.set(json.id, json)
  } else if (
    m === 'GET' &&
    /\/v3\/data-providers\/\d+\/outputs\?/.test(url) &&
    json &&
    Array.isArray(json.results)
  ) {
    sources.providerLists++
    for (const o of json.results) outputs.set(o.id, o)
  } else if (
    m === 'GET' &&
    /\/v3\/data-providers\/\d+(\?t=.*)?$/.test(url) &&
    json &&
    json.id !== undefined
  ) {
    sources.providerObjects++
    providers.set(json.id, json)
  }
  void text
}

const count = (arr, fn) => {
  const o = {}
  for (const x of arr) {
    const k = fn(x)
    o[k] = (o[k] || 0) + 1
  }
  return Object.fromEntries(Object.entries(o).sort((a, b) => b[1] - a[1]))
}
const share = (n, d) =>
  d ? `${n}/${d} (${((100 * n) / d).toFixed(1)}%)` : `${n}/0`

const dateClass = (v) => {
  if (v === undefined) return 'absent'
  if (v === null) return 'null'
  if (v === '') return 'empty string'
  if (typeof v !== 'string') return `type ${typeof v}`
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$/.test(v)) return 'Z'
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?[+-]00:?00$/.test(v))
    return 'offset +00:00'
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?[+-]\d{2}:?\d{2}$/.test(v))
    return 'offset (non-zero)'
  if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return 'date-only'
  if (/^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}(:\d{2}(\.\d+)?)?$/.test(v))
    return 'zone-less'
  if (/^\d{4}$/.test(v)) return 'year-only string'
  return 'other'
}
const typeOf = (v) =>
  v === undefined
    ? 'absent'
    : v === null
    ? 'null'
    : Array.isArray(v)
    ? 'array'
    : typeof v
const doiClass = (v) =>
  v === undefined
    ? 'absent'
    : v === null
    ? 'null'
    : v === ''
    ? 'empty string'
    : 'string'
const displayShape = (links) => {
  const d = (links || []).filter((l) => l.type === 'display')
  if (!d.length) return 'no display link'
  return d
    .map((l) => {
      try {
        const u = new URL(l.url)
        return `${u.origin}${u.pathname.replace(/\d+/g, ':id')}`
      } catch {
        return 'unparsable'
      }
    })
    .join(' ')
}
const has = (list, key) =>
  list.filter((o) => Object.prototype.hasOwnProperty.call(o, key)).length

const W = [...works.values()]
const O = [...outputs.values()]
const P = [...providers.values()]

const emptyDateNumericYear = W.filter(
  (w) =>
    (w.publishedDate === '' || w.publishedDate == null) &&
    typeof w.yearPublished === 'number'
)
const emptyDateOut = O.filter(
  (o) =>
    (o.publishedDate === '' || o.publishedDate == null) &&
    o.yearPublished != null
)
const nullDoiOutputs = []
for (const [wid, list] of outputsOfWork)
  for (const o of list)
    if (o.doi == null)
      nullDoiOutputs.push({
        work: wid,
        output: o.id,
        doi: o.doi === undefined ? 'absent' : null,
      })

const report = {
  generatedAt: new Date().toISOString(),
  sample: {
    works: W.length,
    outputs: O.length,
    providers: P.length,
    workOutputLists: outputsOfWork.size,
    sources,
  },
  errorAnswers: {
    count: errors.length,
    grouped: Object.entries(
      count(errors, (e) =>
        JSON.stringify([
          e.endpoint,
          e.status,
          e.contentType || null,
          e.bodyType || e.type,
          e.keys || null,
        ])
      )
    ).map(([k, n]) => {
      const [endpoint, status, contentType, bodyType, keys] = JSON.parse(k)
      return { n, endpoint, status, contentType, bodyType, keys }
    }),
  },
  status410Seen: errors.some((e) => e.status === 410),
  works: {
    publishedDate: count(W, (w) => dateClass(w.publishedDate)),
    yearPublishedType: count(W, (w) => typeOf(w.yearPublished)),
    emptyDateWithNumericYear: share(emptyDateNumericYear.length, W.length),
    emptyDateWithNumericYearIds: emptyDateNumericYear
      .slice(0, 10)
      .map((w) => w.id),
    doi: count(W, (w) => doiClass(w.doi)),
    dataProvidersEmpty: share(
      W.filter(
        (w) => Array.isArray(w.dataProviders) && w.dataProviders.length === 0
      ).length,
      W.length
    ),
    dataProvidersAbsent: share(
      W.filter((w) => !('dataProviders' in w)).length,
      W.length
    ),
    displayLink: count(W, (w) => displayShape(w.links)),
    keyPresence: Object.fromEntries(
      [
        'downloadLink',
        'year',
        'oai',
        'subjects',
        'downloadUrl',
        'yearPublished',
        'oaiIds',
        'links',
      ].map((k) => [k, share(has(W, k), W.length)])
    ),
  },
  outputs: {
    publishedDate: count(O, (o) => dateClass(o.publishedDate)),
    yearPublishedType: count(O, (o) => typeOf(o.yearPublished)),
    emptyDateWithYear: share(emptyDateOut.length, O.length),
    doi: count(O, (o) => doiClass(o.doi)),
    fulltextStatus: count(O, (o) => String(o.fulltextStatus)),
    sourceFulltextUrls: count(O, (o) =>
      o.sourceFulltextUrls === undefined
        ? 'absent'
        : o.sourceFulltextUrls === null
        ? 'null'
        : Array.isArray(o.sourceFulltextUrls)
        ? o.sourceFulltextUrls.length
          ? 'non-empty array'
          : 'empty array'
        : typeof o.sourceFulltextUrls
    ),
    noDownloadLink: share(
      O.filter((o) => !(o.links || []).some((l) => l.type === 'download'))
        .length,
      O.length
    ),
    displayLink: count(O, (o) => displayShape(o.links)),
    keyPresence: Object.fromEntries(
      [
        'downloadLink',
        'year',
        'oai',
        'subjects',
        'downloadUrl',
        'yearPublished',
        'links',
      ].map((k) => [k, share(has(O, k), O.length)])
    ),
  },
  providers: {
    withoutLocation: share(P.filter((p) => !p.location).length, P.length),
    zeroLocation: share(
      P.filter(
        (p) =>
          p.location && p.location.latitude === 0 && p.location.longitude === 0
      ).length,
      P.length
    ),
    logoKinds: count(P, (p) =>
      p.logo == null
        ? 'null'
        : String(p.logo).startsWith('data:')
        ? 'data URI'
        : 'url'
    ),
  },
  metaTags: {
    citation_pdf_url_and_DC_format: `need payload key downloadLink: present in ${has(
      W,
      'downloadLink'
    )} works and ${has(O, 'downloadLink')} outputs of the sample`,
    DC_issued: `need payload key year: present in ${has(
      W,
      'year'
    )} works and ${has(O, 'year')} outputs of the sample`,
    DC_identifier: `need payload key oai: present in ${has(O, 'oai')} of ${
      O.length
    } outputs (works: ${has(W, 'oai')} of ${W.length})`,
    DC_subject: `need payload key subjects: present in ${has(
      O,
      'subjects'
    )} of ${O.length} outputs (works: ${has(W, 'subjects')})`,
  },
  doiNullOutputProbe: nullDoiOutputs.slice(0, 10),
}

fs.writeFileSync(
  path.join(out, 'vf03-report.json'),
  `${JSON.stringify(report, null, 2)}\n`
)
const j = opt('--json')
if (j) fs.writeFileSync(path.resolve(j), `${JSON.stringify(report, null, 2)}\n`)
console.log(JSON.stringify(report, null, 2))
