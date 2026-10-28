#!/usr/bin/env node
// ad-ledger.mjs - the checker of the accepted-diffs ledger (CI-1; 42 §8, 40 §1, 30 §1 rule 3, 55 C4).
//
// Usage:
//   node scripts/ad-ledger.mjs [--ledger <file>] [--base <git ref> | --base-file <file>] [--offline]
//                              [--owner <login>] [--status <STATUS.md>] [--repo <owner/name>] [--gh <command>]
//                              [--cwd <dir>] [--json]
//
//   --ledger     the ledger (default test/baseline/ACCEPTED-DIFFS.yml); `[]` is the empty ledger
//   --base       git ref whose merge base with HEAD holds the previous ledger (append-only check). CI passes
//                `origin/main`. Without --base and --base-file the check runs against `origin/main` when that ref
//                exists and is skipped (reported) otherwise.
//   --base-file  the previous ledger as a file (a missing file is the empty ledger)
//   --offline    structural checks only; the signature lookups are skipped and reported
//   --owner      the owner's GitHub login (default: the Owner entry of STATUS §1 People)
//   --gh         the GitHub CLI (default gh); the lookups are `gh api repos/<repo>/issues/comments/<id>`
//
// Checks, default deny (42 §8):
//   rows      the file is a YAML list of rows with exactly the keys id, kind, test, key, from, to, reason, ref,
//             step, signedOffBy, date (+ repro for `kind: delta`, + withdrawn); every scalar is a string, so
//             `from`/`to` are compared as the exact literals; keys are exact literals (no globs); one row per
//             (test, key) among the rows in force, for each key a composite key lists (two rows may list one
//             baseline file `<name>.json` when their literals do not overlap); ids unique and never reused
//   never     `kind: delta` never covers T-801/T-802 (0 px, D7), a status code (sole exception: T-612's
//             `/static/search/_next/image` row, OD-41), a `Location` (30 §1 rule 3), or the T-601/T-731 status
//             cells (30 §1 rule 3)
//   delta     a `kind: delta` row needs `repro:`, the CI run of the framework probe; a `kind: product` row
//             (D15) carries OD-31 in `ref`
//   append    the rows of the base ledger are a prefix of the ledger and unchanged; the only edit is an added
//             `withdrawn: <reason, date>`
//   signed    `signedOffBy` is one of two forms (42 §8):
//             local (D20, 2026-10-27: no GitHub in the track, so no comment exists): exactly
//             `SIGNED: owner, <YYYY-MM-DD> (<note>)`, a real date that is not in the future and a non-empty note,
//             the owner's confirmation in the work session (STATUS §2); nothing is looked up;
//             GitHub (for a later CI): `<name>, <URL of the SIGNED: comment>`: the comment exists
//             (`gh api repos/oacore/search/issues/comments/<id>`), its author is the owner, its body starts with
//             `SIGNED:` and names the AD id. Offline and without rows nothing is looked up: an empty ledger
//             passes without the network.
// Exit codes: 0 pass; 1 at least one violation (or signatures that cannot be looked up while online mode is
// required); 2 usage error or a missing tool (js-yaml).
// Node built-ins plus the installed js-yaml (a transitive devDependency of ESLint, like T-001's reader).
import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
export const DEFAULT_LEDGER = path.join(
  ROOT,
  'test',
  'baseline',
  'ACCEPTED-DIFFS.yml'
)
export const DEFAULT_STATUS = path.join(ROOT, 'docs', 'upgrade', 'STATUS.md')
export const DEFAULT_REPO = 'oacore/search'

export const REQUIRED_KEYS = [
  'id',
  'kind',
  'test',
  'key',
  'from',
  'to',
  'reason',
  'ref',
  'step',
  'signedOffBy',
  'date',
]
export const OPTIONAL_KEYS = ['repro', 'withdrawn']
export const KINDS = ['delta', 'product']

const isObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v)
const isText = (v) => typeof v === 'string' && v.trim() !== ''
const validDate = (s) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false
  const d = new Date(`${s}T00:00:00Z`)
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s
}
// a glob is a pattern, a key is a literal (42 §8). The matchers compare keys exactly, so this is the guard against
// a pattern that would never match (or one a future matcher would expand): `*` and `{a,b}` are refused. A `?` is
// allowed: URL keys carry a query string and accessible names end in one. So is the wildcard group `(.*)` of a
// Next route source (path-to-regexp) right after a route parameter name, `:<name>(.*)`, which is literal text of
// the key that names that route, e.g. T-010's `header:/:path(.*)`; a `(.*)` without a parameter name before it, and
// a `*` anywhere else, are still refused.
export const hasGlob = (key) =>
  /\*|\{[^}]*,[^}]*\}/.test(key.replace(/:[A-Za-z_]\w*\(\.\*\)/g, ''))
// the keys a key lists: a composite key lists several, separated by `, ` (42 §8), as the hooks read it
// (e2e/lib/P0-11/contract.mjs rowKeys, e2e/lib/P0-10/baseline.mjs ledgerRowsOf); every per-key rule holds for each
export const keysOf = (key) => [...new Set(String(key).split(', '))]

// ---------- YAML ----------

// text -> the rows; every scalar stays a string (FAILSAFE schema: no dates, numbers, nulls or merge keys)
export function parseLedger(text) {
  let yaml
  try {
    yaml = createRequire(path.join(ROOT, 'package.json'))('js-yaml')
  } catch (e) {
    const err = new Error(`js-yaml is not installed (run npm ci): ${e.message}`)
    err.code = 'NO_YAML'
    throw err
  }
  // js-yaml 3 loads safely through safeLoad, 4 through load
  const major = Number(String(yaml.version || '').split('.')[0])
  const load =
    typeof yaml.safeLoad === 'function' && major < 4 ? yaml.safeLoad : yaml.load
  const doc = load(text, { schema: yaml.FAILSAFE_SCHEMA })
  if (doc === undefined || doc === null || doc === '') return []
  return doc
}

// ---------- rows ----------

const commentUrlRe = (repo) =>
  new RegExp(
    `^(.+), (https://github\\.com/${repo.replace(
      /[.*+?^${}()|[\]\\]/g,
      '\\$&'
    )}/(?:issues|pull)/\\d+#issuecomment-(\\d+))$`
  )
const reproRe = (repo) =>
  new RegExp(
    `^https://github\\.com/${repo.replace(
      /[.*+?^${}()|[\]\\]/g,
      '\\$&'
    )}/actions/runs/\\d+(?:[/?#].*)?$`
  )

export const commentIdOf = (signedOffBy, repo = DEFAULT_REPO) => {
  const m = commentUrlRe(repo).exec(String(signedOffBy))
  return m ? m[3] : null
}

// the local signature (D20): exact prefix, an ISO date, one space, a parenthesised non-empty note, nothing after
const LOCAL_SIGNATURE = /^SIGNED: owner, (\d{4}-\d{2}-\d{2}) \(([^()]*)\)$/
// the latest calendar date the checker can be running on: the local date or the UTC date, whichever is later
export const todayOf = (now = new Date()) => {
  const pad = (n) => String(n).padStart(2, '0')
  const local = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(
    now.getDate()
  )}`
  const utc = now.toISOString().slice(0, 10)
  return local > utc ? local : utc
}
// a local signature -> null when valid, else why not
export function localSignatureProblem(signedOffBy, today = todayOf()) {
  const m = LOCAL_SIGNATURE.exec(String(signedOffBy))
  if (!m) return 'not the form "SIGNED: owner, <YYYY-MM-DD> (<note>)"'
  if (!validDate(m[1])) return `${m[1]} is not a real date`
  if (m[1] > today) return `${m[1]} is in the future`
  if (m[2].trim() === '') return 'the note is empty'
  return null
}
// which form a signature has: 'github', 'local' or null (neither, or a local form that is not valid)
export function signatureForm(
  signedOffBy,
  { repo = DEFAULT_REPO, today = todayOf() } = {}
) {
  if (commentUrlRe(repo).test(String(signedOffBy))) return 'github'
  return localSignatureProblem(signedOffBy, today) === null ? 'local' : null
}

// is a row of a `kind: delta` allowed to cover this (test, key)? -> reason it may not, or null
export function deltaForbidden(row) {
  const { test, key } = row
  if (test === 'T-801' || test === 'T-802')
    return `${test} compares pixels exactly (0 px, D7): a delta row never covers it`
  const header = String(key).split('/').pop().toLowerCase()
  if (header === 'location')
    return 'a Location never changes (30 §1 rule 3): a delta row never covers it'
  if (header === ':status' || header === 'status') {
    // OD-41: the image optimizer row of T-612 is the one status exception
    if (test === 'T-612' && String(key).includes('/static/search/_next/image'))
      return null
    return 'a status code never changes (30 §1 rule 3): a delta row never covers it'
  }
  if ((test === 'T-601' || test === 'T-731') && /status/i.test(String(key)))
    return `${test} status cells are never accepted (30 §1 rule 3)`
  return null
}

// one row -> [{ code, message }]
export function checkRow(row, { repo = DEFAULT_REPO, today = todayOf() } = {}) {
  const errors = []
  const bad = (code, message) => errors.push({ code, message })
  if (!isObject(row)) {
    bad('row-shape', 'a row is not a mapping')
    return errors
  }
  const keys = Object.keys(row)
  for (const k of keys)
    if (![...REQUIRED_KEYS, ...OPTIONAL_KEYS].includes(k))
      bad('unknown-key', `unknown key ${JSON.stringify(k)} (default deny)`)
  for (const k of REQUIRED_KEYS)
    if (!(k in row)) bad('missing-key', `missing key ${k}`)
  const text = (k) => {
    if (!(k in row)) return false
    if (!isText(row[k])) {
      bad('empty-value', `${k} must be a non-empty string`)
      return false
    }
    return true
  }
  if (text('id') && !/^AD-\d{3,}$/.test(row.id))
    bad('bad-id', `id ${JSON.stringify(row.id)} is not AD-<number>`)
  if (text('kind') && !KINDS.includes(row.kind))
    bad('bad-kind', `kind must be delta or product, not ${row.kind}`)
  if (text('test') && !/^T-\d{3}$/.test(row.test))
    bad('bad-test', `test ${JSON.stringify(row.test)} is not a T-### id`)
  if (text('key')) {
    if (hasGlob(row.key))
      bad(
        'glob-key',
        `key ${JSON.stringify(row.key)} is a glob: keys are exact literals`
      )
    if (row.key !== row.key.trim())
      bad('bad-key', 'key has leading or trailing whitespace')
  }
  const hasFrom = text('from')
  const hasTo = text('to')
  if (hasFrom && hasTo && row.from === row.to)
    bad('no-change', 'from and to are equal: the row accepts nothing')
  text('reason')
  text('step')
  if ('ref' in row) {
    if (
      !Array.isArray(row.ref) ||
      row.ref.length === 0 ||
      !row.ref.every(isText)
    )
      bad(
        'bad-ref',
        'ref must be a non-empty list of strings, e.g. [OD-39, R-083]'
      )
    else if (row.kind === 'product' && !row.ref.includes('OD-31'))
      bad('product-ref', 'a kind: product row carries OD-31 in ref (42 §9)')
  }
  if (text('date') && !validDate(row.date))
    bad('bad-date', `date ${JSON.stringify(row.date)} is not a YYYY-MM-DD date`)
  if (text('signedOffBy') && !commentUrlRe(repo).test(row.signedOffBy)) {
    const why = localSignatureProblem(row.signedOffBy, today)
    if (why)
      bad(
        'bad-signature',
        `signedOffBy must be the local form "SIGNED: owner, <YYYY-MM-DD> (<note>)" (D20; ${why}) or "<name>, https://github.com/${repo}/(issues|pull)/<n>#issuecomment-<id>"`
      )
  }
  if (row.kind === 'delta') {
    if (!('repro' in row))
      bad(
        'missing-repro',
        'a kind: delta row needs repro: the CI run of the framework probe'
      )
    const why =
      isText(row.test) && isText(row.key)
        ? keysOf(row.key)
            .map((key) => deltaForbidden({ ...row, key }))
            .find(Boolean) || null
        : null
    if (why) bad('delta-never-covers', why)
  }
  if ('repro' in row && (!isText(row.repro) || !reproRe(repo).test(row.repro)))
    bad(
      'bad-repro',
      `repro must be a CI run URL (https://github.com/${repo}/actions/runs/<id>)`
    )
  if ('withdrawn' in row) text('withdrawn')
  return errors
}

// a key that names a recorded e2e baseline file: the hook replaces each row's literal `from` by its `to` in it
export const isBaselineFileKey = (key) => /^[\w.-]+\.json$/.test(key)
// two literals overlap when one holds the other or an end of one is the start of the other
export function overlaps(a, b) {
  if (a.includes(b) || b.includes(a)) return true
  for (let k = 1; k < Math.min(a.length, b.length); k++)
    if (a.endsWith(b.slice(0, k)) || b.endsWith(a.slice(0, k))) return true
  return false
}
// may two rows in force of one test both list this key? Only a baseline file key, and only when each row
// replaces a literal of its own: neither row's `from` overlaps the other row's `from` or `to`, so no row
// hides, shares or creates the text another row replaces (42 §8)
export const mayShareKey = (key, a, b) =>
  isBaselineFileKey(key) &&
  [a.from, a.to, b.from, b.to].every(isText) &&
  !overlaps(a.from, b.from) &&
  !overlaps(a.from, b.to) &&
  !overlaps(b.from, a.to)

// the rows -> violations across rows: [{ code, id, message }]
export function checkRows(rows, { repo = DEFAULT_REPO } = {}) {
  const out = []
  if (!Array.isArray(rows)) {
    out.push({
      code: 'not-a-list',
      id: null,
      message: 'the ledger is not a YAML list',
    })
    return out
  }
  const seen = new Map()
  const inForce = new Map()
  const listed = new Map() // test + one key of a (composite) key -> the rows in force that list it
  rows.forEach((row, i) => {
    const id = isObject(row) && isText(row.id) ? row.id : `row ${i + 1}`
    for (const e of checkRow(row, { repo })) out.push({ ...e, id })
    if (!isObject(row)) return
    if (isText(row.id)) {
      if (seen.has(row.id))
        out.push({
          code: 'duplicate-id',
          id,
          message: `id ${row.id} is used by rows ${seen.get(row.id)} and ${
            i + 1
          }: ids are never reused`,
        })
      else seen.set(row.id, i + 1)
    }
    if (!('withdrawn' in row) && isText(row.test) && isText(row.key)) {
      const k = `${row.test}\u0000${row.key}`
      if (inForce.has(k))
        out.push({
          code: 'duplicate-test-key',
          id,
          message: `${row.test} ${JSON.stringify(
            row.key
          )} has a second row in force (${inForce.get(
            k
          )}): one row per (test, key)`,
        })
      else {
        inForce.set(k, row.id || i + 1)
        // a composite key lists several keys: the rule holds for each of them
        const clash = keysOf(row.key)
          .map((part) => [
            part,
            (listed.get(`${row.test}\u0000${part}`) || []).find(
              (other) => !mayShareKey(part, other.row, row)
            ),
          ])
          .find(([, other]) => other)
        if (clash)
          out.push({
            code: 'duplicate-test-key',
            id,
            message: `${row.test} ${JSON.stringify(clash[0])} (listed in ${JSON.stringify(
              row.key
            )}) has a second row in force (${
              clash[1].id
            }): one row per (test, key), for each key of a composite key; rows may share a baseline file key (<name>.json) only when no row's from overlaps the other row's from or to`,
          })
      }
      for (const part of keysOf(row.key)) {
        const at = `${row.test}\u0000${part}`
        listed.set(at, [
          ...(listed.get(at) || []),
          { id: row.id || i + 1, row },
        ])
      }
    }
  })
  return out
}

// ---------- append-only ----------

const stable = (v) => {
  if (Array.isArray(v)) return `[${v.map(stable).join(',')}]`
  if (isObject(v))
    return `{${Object.keys(v)
      .sort()
      .map((k) => `${JSON.stringify(k)}:${stable(v[k])}`)
      .join(',')}}`
  return JSON.stringify(v)
}

// base rows against head rows: the base is a prefix, unchanged except for an added `withdrawn`
export function checkAppendOnly(baseRows, headRows) {
  const out = []
  if (!Array.isArray(baseRows) || !Array.isArray(headRows)) return out
  baseRows.forEach((b, i) => {
    const id = isObject(b) && isText(b.id) ? b.id : `row ${i + 1}`
    const h = headRows[i]
    if (h === undefined) {
      out.push({
        code: 'append-only',
        id,
        message: `${id} was removed (rows are never deleted; withdraw it with withdrawn:)`,
      })
      return
    }
    if (stable(b) === stable(h)) return
    if (isObject(b) && isObject(h)) {
      const rest = { ...h }
      delete rest.withdrawn
      if (
        !('withdrawn' in b) &&
        isText(h.withdrawn) &&
        stable(rest) === stable(b)
      )
        return
      const changed = [...new Set([...Object.keys(b), ...Object.keys(h)])]
        .filter((k) => stable(b[k]) !== stable(h[k]))
        .sort()
      out.push({
        code: 'append-only',
        id,
        message: `${id} was edited (${changed.join(
          ', '
        )}): the only allowed edit adds withdrawn:`,
      })
      return
    }
    out.push({ code: 'append-only', id, message: `row ${i + 1} was replaced` })
  })
  return out
}

function git(args, cwd) {
  const r = spawnSync('git', args, {
    cwd,
    encoding: 'utf8',
    maxBuffer: 1 << 26,
  })
  return { status: r.status, stdout: r.stdout || '', stderr: r.stderr || '' }
}

// the ledger text at the merge base of HEAD and `ref` -> { text } | { skipped } | { error }; without
// `explicit` a missing ref only skips the check
export function baseFromGit(ref, ledgerFile, cwd, { explicit }) {
  const fail = (reason) =>
    explicit ? { error: `--base ${ref}: ${reason}` } : { skipped: reason }
  const top = git(['rev-parse', '--show-toplevel'], cwd)
  if (top.status !== 0) return fail(`${cwd} is not a git working tree`)
  const rel = path
    .relative(fs.realpathSync(top.stdout.trim()), fs.realpathSync(ledgerFile))
    .split(path.sep)
    .join('/')
  if (rel.startsWith('..'))
    return fail('the ledger is outside the working tree')
  const mb = git(['merge-base', 'HEAD', ref], cwd)
  if (mb.status !== 0)
    return fail(
      `no merge base of HEAD and ${ref} (${
        mb.stderr.trim().split('\n')[0] || 'unknown ref'
      }); CI checks out the full history (fetch-depth: 0)`
    )
  const sha = mb.stdout.trim()
  const show = git(['show', `${sha}:${rel}`], cwd)
  // the ledger does not exist at the base yet: every row is new
  if (show.status !== 0) return { text: '', sha }
  return { text: show.stdout, sha }
}

// ---------- the owner and the signatures ----------

// STATUS §1 People row -> { login } | { error }
export function ownerFromStatus(text) {
  const row = String(text)
    .split('\n')
    .find((l) => /^\|\s*People\s*\|/.test(l))
  if (!row) return { error: 'STATUS §1 has no People row' }
  const m = /Owner:\s*([^;|]*)/.exec(row)
  const entry = m ? m[1].trim() : ''
  if (!entry || /^_+(\s|$)/.test(entry))
    return { error: 'STATUS §1 People: the owner is not filled in yet' }
  const at = /@([A-Za-z0-9](?:[A-Za-z0-9-]{0,38}))/.exec(entry)
  const paren = /\(([A-Za-z0-9](?:[A-Za-z0-9-]{0,38}))\)/.exec(entry)
  const login = at ? at[1] : paren ? paren[1] : null
  if (!login)
    return {
      error:
        'STATUS §1 People: no GitHub login for the owner (write `Owner: <name> (@<login>)`)',
    }
  return { login }
}

// one lookup through the GitHub CLI -> { comment } | { missing } | { unverifiable }
export function lookupComment(id, { gh = 'gh', repo = DEFAULT_REPO } = {}) {
  const r = spawnSync(gh, ['api', `repos/${repo}/issues/comments/${id}`], {
    encoding: 'utf8',
    timeout: 60000,
    maxBuffer: 1 << 24,
  })
  if (r.error)
    return {
      unverifiable:
        r.error.code === 'ENOENT'
          ? `${gh} is not installed`
          : `${gh} failed: ${r.error.message}`,
    }
  const detail = `${r.stderr || ''}${r.stdout || ''}`
  if (r.status !== 0) {
    if (/HTTP 404|Not Found/.test(detail)) return { missing: true }
    return {
      unverifiable: (
        detail.trim().split('\n')[0] || `${gh} exited ${r.status}`
      ).slice(0, 200),
    }
  }
  try {
    return { comment: JSON.parse(r.stdout) }
  } catch {
    return { unverifiable: `${gh} printed no JSON` }
  }
}

const idPattern = (id) =>
  new RegExp(
    `(^|[^A-Za-z0-9-])${id.replace(
      /[.*+?^${}()|[\]\\]/g,
      '\\$&'
    )}(?![A-Za-z0-9-])`
  )

// a looked-up comment -> violations of one row
export function checkComment(row, comment, { owner }) {
  const out = []
  const bad = (code, message) => out.push({ code, id: row.id, message })
  const login = comment && comment.user && comment.user.login
  if (!login || String(login).toLowerCase() !== String(owner).toLowerCase())
    bad(
      'signature-author',
      `the SIGNED: comment of ${row.id} was written by ${
        login || 'an unknown user'
      }, not by the owner (${owner})`
    )
  const body = String((comment && comment.body) || '')
  if (!body.startsWith('SIGNED:'))
    bad(
      'signature-body',
      `the comment of ${row.id} does not start with SIGNED:`
    )
  else if (!idPattern(row.id).test(body))
    bad('signature-body', `the SIGNED: comment does not name ${row.id}`)
  return out
}

// ---------- the whole check ----------

// options: { ledgerText, baseText?, baseNote?, owner?, ownerError?, offline, gh, repo } -> report
export function check({
  ledgerText,
  baseText = null,
  baseNote = null,
  owner = null,
  ownerError = null,
  offline = false,
  gh = 'gh',
  repo = DEFAULT_REPO,
}) {
  const violations = []
  const notes = []
  let rows
  try {
    rows = parseLedger(ledgerText)
  } catch (e) {
    if (e.code === 'NO_YAML') throw e
    violations.push({
      code: 'yaml',
      id: null,
      message: `the ledger is not valid YAML: ${
        String(e.message).split('\n')[0]
      }`,
    })
    return {
      ok: false,
      rows: 0,
      inForce: 0,
      counts: {},
      withdrawn: 0,
      violations,
      notes,
      signatures: { checked: 0, skipped: 0 },
    }
  }
  violations.push(...checkRows(rows, { repo }))
  if (baseText !== null) {
    let baseRows = []
    try {
      baseRows = parseLedger(baseText)
    } catch (e) {
      violations.push({
        code: 'yaml',
        id: null,
        message: `the base ledger is not valid YAML: ${
          String(e.message).split('\n')[0]
        }`,
      })
    }
    violations.push(...checkAppendOnly(baseRows, rows))
  } else if (baseNote) notes.push(`append-only check skipped: ${baseNote}`)
  const list = Array.isArray(rows) ? rows.filter(isObject) : []
  const inForce = list.filter((r) => !('withdrawn' in r))
  const counts = { delta: 0, product: 0 }
  inForce.forEach((r) => {
    if (r.kind in counts) counts[r.kind] += 1
  })
  const signatures = { checked: 0, skipped: 0 }
  const signable = list.filter(
    (r) => isText(r.id) && commentIdOf(r.signedOffBy, repo)
  )
  // local signatures (D20) have nothing to look up: listed, never counted as checked or skipped
  const local = list.filter(
    (r) => isText(r.id) && signatureForm(r.signedOffBy, { repo }) === 'local'
  )
  if (local.length)
    notes.push(
      `local signatures (D20, the owner's confirmation in the work session; nothing to look up): ${local
        .map((r) => r.id)
        .join(', ')}`
    )
  if (signable.length) {
    if (offline) {
      signatures.skipped = signable.length
      notes.push(
        `signatures not verified (--offline): ${signable
          .map((r) => r.id)
          .join(', ')}`
      )
    } else if (!owner) {
      violations.push({
        code: 'owner-unknown',
        id: null,
        message: `${
          ownerError || 'the owner login is unknown'
        }; the signatures of ${
          signable.length
        } row(s) cannot be checked (pass --owner or fill STATUS §1)`,
      })
    } else {
      for (const row of signable) {
        const got = lookupComment(commentIdOf(row.signedOffBy, repo), {
          gh,
          repo,
        })
        if (got.comment) {
          signatures.checked += 1
          violations.push(...checkComment(row, got.comment, { owner }))
        } else if (got.missing) {
          signatures.checked += 1
          violations.push({
            code: 'signature-missing',
            id: row.id,
            message: `the SIGNED: comment of ${row.id} does not exist (${row.signedOffBy})`,
          })
        } else {
          violations.push({
            code: 'signature-unverifiable',
            id: row.id,
            message: `the SIGNED: comment of ${row.id} cannot be looked up: ${got.unverifiable} (use --offline only where there is no network)`,
          })
        }
      }
    }
  }
  return {
    ok: violations.length === 0,
    rows: list.length,
    inForce: inForce.length,
    counts,
    withdrawn: list.length - inForce.length,
    violations,
    notes,
    signatures,
  }
}

export function format(report) {
  const lines = []
  for (const v of report.violations)
    lines.push(`ERROR ${v.code}${v.id ? ` [${v.id}]` : ''}: ${v.message}`)
  for (const n of report.notes) lines.push(`NOTE ${n}`)
  lines.push(
    `ad-ledger: ${report.rows} row(s), ${report.inForce} in force (delta ${
      report.counts.delta || 0
    }, product ${report.counts.product || 0}), ${
      report.withdrawn
    } withdrawn; signatures checked ${report.signatures.checked}, skipped ${
      report.signatures.skipped
    }: ${report.ok ? 'pass' : 'FAIL'}`
  )
  return lines.join('\n')
}

// ---------- command line ----------

const VALUE_OPTIONS = [
  '--ledger',
  '--base',
  '--base-file',
  '--owner',
  '--status',
  '--repo',
  '--gh',
  '--cwd',
]
const FLAGS = ['--offline', '--json']

export function parseArgs(argv) {
  const out = {}
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (FLAGS.includes(a)) out[a.slice(2)] = true
    else if (VALUE_OPTIONS.includes(a)) {
      i++
      if (argv[i] === undefined || argv[i].startsWith('--'))
        return { error: `${a} needs a value` }
      out[a.slice(2)] = argv[i]
    } else return { error: `unknown argument ${a}` }
  }
  if (out.base && out['base-file'])
    return { error: '--base and --base-file exclude each other' }
  return out
}

function main(argv) {
  const args = parseArgs(argv)
  if (args.error) {
    console.error(
      `ad-ledger: ${args.error} (see the header of scripts/ad-ledger.mjs)`
    )
    return 2
  }
  const cwd = path.resolve(args.cwd || process.cwd())
  const ledgerFile = path.resolve(cwd, args.ledger || DEFAULT_LEDGER)
  const repo = args.repo || DEFAULT_REPO
  if (!fs.existsSync(ledgerFile)) {
    const report = {
      ok: false,
      rows: 0,
      inForce: 0,
      counts: {},
      withdrawn: 0,
      violations: [
        {
          code: 'ledger-missing',
          id: null,
          message: `${ledgerFile} does not exist (it is committed with B0, 42 §7)`,
        },
      ],
      notes: [],
      signatures: { checked: 0, skipped: 0 },
    }
    if (args.json) console.log(JSON.stringify(report, null, 2))
    else console.log(format(report))
    return 1
  }
  let baseText = null
  let baseNote = null
  if (args['base-file']) {
    const f = path.resolve(cwd, args['base-file'])
    baseText = fs.existsSync(f) ? fs.readFileSync(f, 'utf8') : ''
  } else {
    const ref = args.base || 'origin/main'
    const base = baseFromGit(ref, ledgerFile, cwd, {
      explicit: Boolean(args.base),
    })
    if (base.error) {
      console.error(`ad-ledger: ${base.error}`)
      return 1
    }
    if (base.skipped) baseNote = base.skipped
    else baseText = base.text
  }
  let owner = args.owner || null
  let ownerError = null
  if (!owner && !args.offline) {
    const statusFile = path.resolve(cwd, args.status || DEFAULT_STATUS)
    if (fs.existsSync(statusFile)) {
      const o = ownerFromStatus(fs.readFileSync(statusFile, 'utf8'))
      owner = o.login || null
      ownerError = o.error || null
    } else ownerError = `${statusFile} does not exist`
  }
  let report
  try {
    report = check({
      ledgerText: fs.readFileSync(ledgerFile, 'utf8'),
      baseText,
      baseNote,
      owner,
      ownerError,
      offline: Boolean(args.offline),
      gh: args.gh || 'gh',
      repo,
    })
  } catch (e) {
    if (e.code === 'NO_YAML') {
      console.error(`ad-ledger: ${e.message}`)
      return 2
    }
    throw e
  }
  if (args.json) console.log(JSON.stringify(report, null, 2))
  else console.log(format(report))
  return report.ok ? 0 : 1
}

if (fileURLToPath(import.meta.url) === path.resolve(process.argv[1] || ''))
  process.exitCode = main(process.argv.slice(2))
