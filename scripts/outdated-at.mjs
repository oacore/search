#!/usr/bin/env node
// outdated-at.mjs - the outdated list of the direct dependencies at a gate's version cut-off Tr (02 §5 step 5,
// 55 GATE-x.1, 40 §10 `npm run outdated-at -- <Tr>`). A version published after Tr is ignored, so the list
// does not change when the registry moves on after the gate sweep. Node built-ins only.
//
// Usage:
//   node scripts/outdated-at.mjs <Tr> [--root <dir>] [--projects .,e2e] [--registry-json <dir>]
//                                [--record <dir>] [--concurrency 4] [--all]
//
//   <Tr>             the cut-off: an ISO 8601 date or date-time, e.g. the committer date
//                    `git log -1 --format=%cI <gate commit> -- package.json package-lock.json e2e/package*.json ...`
//   --root           repository root (default: the parent of this script's folder)
//   --projects       package folders relative to --root whose package.json is read (default `.,e2e`)
//   --registry-json  read `<dir>/<name>.json` (the output of `npm view <name> time dist-tags homepage --json`,
//                    `/` in the name written as `__`) instead of asking the registry (recorded answers, tests)
//   --record         also write every registry answer to `<dir>/<name>.json` (same naming)
//   --concurrency    parallel `npm view` calls (default 4; each retried up to 4 times with back-off on network
//                    errors and 429)
//   --all            list every direct dependency, also the ones that are up to date
//
// Per direct dependency (`peerDependencies`, `dependencies`, `optionalDependencies`, `devDependencies` of each
// project; a name listed twice takes the spec of the later of these, as npm's tree builder does: root
// `"@zeit/next-source-maps"` is `0.0.4` in `dependencies` and `0.0.3` in `devDependencies`, and the lock
// installs 0.0.3 as a dev package):
//   candidates = versions without a prerelease part whose `time` <= Tr and which are <= the current `latest`
//                dist-tag (a version above `latest`, e.g. one published under another tag, never counts)
//   latest     = the highest candidate (the registry's `latest` as it stood at Tr)
//   wanted     = the highest candidate that satisfies the package.json range (null if none does)
//   current    = the version installed in `<project>/node_modules/<name>` (omitted if not installed)
// Printed as JSON in the `npm outdated --long --json` shape (npm 11): {<name>: {current, wanted, latest,
// dependent, location, type, homepage, dependedByLocation}}; a name that two projects depend on maps to an array
// of such objects. Listed (without --all) when current is missing, current != wanted or wanted != latest, which
// is npm's rule. Differences from npm, all on purpose: `latest` is the registry's latest as it stood at Tr,
// never a prerelease (npm prints the current `latest` tag even when it is a prerelease, e.g. the @oacore
// configs' `2.0.0-stylelint.1`); `location` and `dependedByLocation` are relative to --root and `dependent` is
// the project's package.json name, so the output does not depend on where the repository is checked out (npm
// prints absolute paths and the folder name).
//
// Exit: 0 = list printed; 1 = registry data missing or unusable for some dependency (named on stderr, the
// list of the others is still printed); 2 = usage error (bad Tr, unreadable package.json, unsupported spec).

import fs from 'node:fs'
import path from 'node:path'
import { execFile } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const SELF_DIR = path.dirname(fileURLToPath(import.meta.url))
// npm's edge order: a later type replaces an earlier edge of the same name
const DEP_TYPES = [
  'peerDependencies',
  'dependencies',
  'optionalDependencies',
  'devDependencies',
]

// ---------- semver (the subset npm ranges in package.json use) ----------
const VERSION_RE =
  /^v?(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?(?:\+[0-9A-Za-z.-]+)?$/

export function parseVersion(v) {
  const m = VERSION_RE.exec(String(v).trim())
  if (!m) return null
  return {
    major: Number(m[1]),
    minor: Number(m[2]),
    patch: Number(m[3]),
    pre: m[4] ? m[4].split('.') : [],
  }
}

export function compareVersions(a, b) {
  const x = typeof a === 'string' ? parseVersion(a) : a
  const y = typeof b === 'string' ? parseVersion(b) : b
  for (const k of ['major', 'minor', 'patch'])
    if (x[k] !== y[k]) return x[k] < y[k] ? -1 : 1
  if (!x.pre.length || !y.pre.length) {
    if (x.pre.length === y.pre.length) return 0
    return x.pre.length ? -1 : 1 // a prerelease sorts before its release
  }
  for (let i = 0; i < Math.max(x.pre.length, y.pre.length); i++) {
    if (i >= x.pre.length) return -1
    if (i >= y.pre.length) return 1
    const p = x.pre[i]
    const q = y.pre[i]
    if (p === q) continue
    const pn = /^\d+$/.test(p)
    const qn = /^\d+$/.test(q)
    if (pn && qn) return Number(p) < Number(q) ? -1 : 1
    if (pn) return -1
    if (qn) return 1
    return p < q ? -1 : 1
  }
  return 0
}

const isWild = (s) => s === undefined || s === '' || /^[xX*]$/.test(s)

// a partial version "1", "1.2", "1.x", "*" -> {parts, wild} (parts = the numbers given before the first wildcard)
function partial(s) {
  const t = s.trim().replace(/^v/, '').replace(/^=/, '')
  if (t === '' || /^[xX*]$/.test(t)) return { parts: [], pre: [] }
  const m =
    /^(\d+|[xX*])(?:\.(\d+|[xX*]))?(?:\.(\d+|[xX*]))?(?:-([0-9A-Za-z.-]+))?(?:\+[0-9A-Za-z.-]+)?$/.exec(
      t
    )
  if (!m) throw new Error(`unsupported version "${s}"`)
  const parts = []
  for (const p of [m[1], m[2], m[3]]) {
    if (isWild(p)) break
    parts.push(Number(p))
  }
  return { parts, pre: parts.length === 3 && m[4] ? m[4].split('.') : [] }
}

const v3 = (a, b, c, pre = []) => ({ major: a, minor: b, patch: c, pre })
const ZERO = v3(0, 0, 0)
// the lowest version of the next major/minor/patch, below every prerelease of it ("<2.0.0-0")
const lowest = (a, b, c) => v3(a, b, c, ['0'])

// one comparator token -> list of [op, version] primitives (op in >=, >, <, <=, =)
function desugar(tok) {
  const m = /^(<=|>=|<|>|=|\^|~>|~)?\s*(.*)$/.exec(tok)
  const op = m[1] || ''
  const { parts, pre } = partial(m[2])
  const [a, b, c] = parts
  const n = parts.length
  if (op === '^') {
    if (n === 0) return [['>=', ZERO]]
    if (n === 1)
      return [
        ['>=', v3(a, 0, 0)],
        ['<', lowest(a + 1, 0, 0)],
      ]
    if (n === 2)
      return a > 0
        ? [
            ['>=', v3(a, b, 0)],
            ['<', lowest(a + 1, 0, 0)],
          ]
        : [
            ['>=', v3(0, b, 0)],
            ['<', lowest(0, b + 1, 0)],
          ]
    const lo = ['>=', v3(a, b, c, pre)]
    if (a > 0) return [lo, ['<', lowest(a + 1, 0, 0)]]
    if (b > 0) return [lo, ['<', lowest(0, b + 1, 0)]]
    return [lo, ['<', lowest(0, 0, c + 1)]]
  }
  if (op === '~' || op === '~>') {
    if (n === 0) return [['>=', ZERO]]
    if (n === 1)
      return [
        ['>=', v3(a, 0, 0)],
        ['<', lowest(a + 1, 0, 0)],
      ]
    return [
      ['>=', v3(a, b, n === 3 ? c : 0, pre)],
      ['<', lowest(a, b + 1, 0)],
    ]
  }
  if (op === '' || op === '=') {
    if (n === 0) return [['>=', ZERO]]
    if (n === 1)
      return [
        ['>=', v3(a, 0, 0)],
        ['<', lowest(a + 1, 0, 0)],
      ]
    if (n === 2)
      return [
        ['>=', v3(a, b, 0)],
        ['<', lowest(a, b + 1, 0)],
      ]
    return [['=', v3(a, b, c, pre)]]
  }
  if (n === 0) return op === '<' || op === '>' ? [['<', ZERO]] : [['>=', ZERO]]
  if (n === 3) return [[op, v3(a, b, c, pre)]]
  // partial with an operator
  const next = n === 1 ? lowest(a + 1, 0, 0) : lowest(a, b + 1, 0)
  const base = n === 1 ? v3(a, 0, 0) : v3(a, b, 0)
  if (op === '>') return [['>=', next]]
  if (op === '>=') return [['>=', base]]
  if (op === '<') return [['<', lowest(base.major, base.minor, 0)]]
  return [['<', next]] // <=
}

export function parseRange(range) {
  const sets = String(range)
    .split('||')
    .map((s) => s.trim())
  return sets.map((set) => {
    if (set === '' || set === '*' || /^[xX]$/.test(set)) return [['>=', ZERO]]
    const hy = /^(\S+)\s+-\s+(\S+)$/.exec(set)
    if (hy) {
      const lo = partial(hy[1])
      const hi = partial(hy[2])
      const out = []
      if (lo.parts.length)
        out.push([
          '>=',
          v3(lo.parts[0], lo.parts[1] || 0, lo.parts[2] || 0, lo.pre),
        ])
      else out.push(['>=', ZERO])
      if (hi.parts.length === 3)
        out.push(['<=', v3(hi.parts[0], hi.parts[1], hi.parts[2], hi.pre)])
      else if (hi.parts.length === 2)
        out.push(['<', lowest(hi.parts[0], hi.parts[1] + 1, 0)])
      else if (hi.parts.length === 1)
        out.push(['<', lowest(hi.parts[0] + 1, 0, 0)])
      return out
    }
    // "> 1.2.3" -> ">1.2.3"
    const toks = set
      .replace(/(<=|>=|<|>|=|\^|~>|~)\s+/g, '$1')
      .split(/\s+/)
      .filter(Boolean)
    return toks.flatMap(desugar)
  })
}

// only release versions are ever tested here (candidates have no prerelease part), so the
// prerelease-tuple rule of node-semver does not arise
export function satisfies(version, range) {
  const v = typeof version === 'string' ? parseVersion(version) : version
  if (!v) return false
  const sets = typeof range === 'string' ? parseRange(range) : range
  return sets.some((set) =>
    set.every(([op, w]) => {
      const c = compareVersions(v, w)
      if (op === '>=') return c >= 0
      if (op === '>') return c > 0
      if (op === '<') return c < 0
      if (op === '<=') return c <= 0
      return c === 0
    })
  )
}

export function isRangeSpec(spec) {
  try {
    parseRange(spec)
    return true
  } catch {
    return false
  }
}

// ---------- the cut-off evaluation ----------
export function parseCutoff(tr) {
  if (typeof tr !== 'string' || !/^\d{4}-\d{2}-\d{2}/.test(tr)) return null
  const t = Date.parse(tr)
  return Number.isFinite(t) ? t : null
}

// view = the JSON of `npm view <name> time dist-tags homepage --json`
export function atCutoff(view, trMs) {
  const time = view.time || {}
  const tags = view['dist-tags'] || {}
  const cap = tags.latest && parseVersion(tags.latest)
  const candidates = Object.keys(time)
    .filter((v) => v !== 'created' && v !== 'modified')
    .map((v) => ({ v, p: parseVersion(v), t: Date.parse(time[v]) }))
    .filter(
      ({ p, t }) =>
        p &&
        !p.pre.length &&
        Number.isFinite(t) &&
        t <= trMs &&
        (!cap || compareVersions(p, cap) <= 0)
    )
    .sort((x, y) => compareVersions(y.p, x.p))
  return candidates
}

export function evaluate({
  spec,
  type,
  current,
  dependent,
  location,
  dependedByLocation,
  view,
  trMs,
}) {
  const candidates = atCutoff(view, trMs)
  const latest = candidates.length ? candidates[0].v : null
  let wanted = null
  if (spec === 'latest' || spec === '' || spec === '*') wanted = latest
  else {
    const sets = parseRange(spec)
    const hit = candidates.find((c) => satisfies(c.p, sets))
    wanted = hit ? hit.v : null
  }
  const row = {}
  if (current) row.current = current
  Object.assign(row, {
    wanted,
    latest,
    dependent,
    location,
    type,
    homepage: view.homepage,
    dependedByLocation,
  })
  const outdated = !current || current !== wanted || wanted !== latest
  return { row, outdated }
}

// ---------- inputs ----------
const fileNameOf = (name) => `${name.replace(/\//g, '__')}.json`

export function directDependencies(root, projects) {
  const out = []
  for (const proj of projects) {
    const dir = path.resolve(root, proj)
    const pkgFile = path.join(dir, 'package.json')
    const pkg = JSON.parse(fs.readFileSync(pkgFile, 'utf8'))
    const edges = new Map()
    for (const type of DEP_TYPES)
      for (const [name, spec] of Object.entries(pkg[type] || {}))
        edges.set(name, { spec, type })
    const rel = path.relative(root, dir)
    const names = [...edges.keys()].sort()
    for (const name of names) {
      const { spec, type } = edges.get(name)
      let current
      try {
        current = JSON.parse(
          fs.readFileSync(
            path.join(dir, 'node_modules', name, 'package.json'),
            'utf8'
          )
        ).version
      } catch {
        current = undefined
      }
      const relPosix = rel ? rel.split(path.sep).join('/') : ''
      out.push({
        name,
        spec: String(spec),
        type,
        current,
        dependent: pkg.name || path.basename(dir),
        location: relPosix
          ? `${relPosix}/node_modules/${name}`
          : `node_modules/${name}`,
        dependedByLocation: relPosix,
      })
    }
  }
  return out
}

const TRANSIENT =
  /E429|ETIMEDOUT|ECONNRESET|ENOTFOUND|EAI_AGAIN|ECONNREFUSED|socket hang up|network/i
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

function npmView(name) {
  return new Promise((resolve) => {
    execFile(
      process.platform === 'win32' ? 'npm.cmd' : 'npm',
      ['view', name, 'time', 'dist-tags', 'homepage', '--json'],
      {
        maxBuffer: 64 * 1024 * 1024,
        env: { ...process.env, npm_config_loglevel: 'error' },
      },
      (err, stdout, stderr) =>
        resolve({
          code: err ? err.code ?? 1 : 0,
          stdout,
          stderr: String(stderr),
        })
    )
  })
}

async function fetchView(name, { registryJson, record }) {
  if (registryJson) {
    const f = path.join(registryJson, fileNameOf(name))
    if (!fs.existsSync(f)) throw new Error(`no recorded answer ${f}`)
    return JSON.parse(fs.readFileSync(f, 'utf8'))
  }
  let last = ''
  for (let attempt = 0; attempt < 5; attempt++) {
    if (attempt) await sleep(2000 * 2 ** (attempt - 1))
    const r = await npmView(name)
    if (r.code === 0) {
      const view = JSON.parse(r.stdout)
      if (record) {
        fs.mkdirSync(record, { recursive: true })
        fs.writeFileSync(
          path.join(record, fileNameOf(name)),
          `${JSON.stringify(view, null, 2)}\n`
        )
      }
      return view
    }
    // first line only: the registry error code, never the configuration
    last =
      r.stderr.split('\n').find((l) => /ERR|error/i.test(l)) || `exit ${r.code}`
    if (!TRANSIENT.test(r.stderr)) break
  }
  throw new Error(`npm view ${name} failed: ${last.trim()}`)
}

async function pool(items, n, fn) {
  const out = new Array(items.length)
  let i = 0
  await Promise.all(
    Array.from({ length: Math.max(1, Math.min(n, items.length)) }, async () => {
      while (i < items.length) {
        const k = i++
        out[k] = await fn(items[k], k)
      }
    })
  )
  return out
}

export async function outdatedAt(trMs, opts) {
  const deps = directDependencies(opts.root, opts.projects)
  for (const d of deps)
    if (!isRangeSpec(d.spec) && d.spec !== 'latest')
      throw new Error(
        `${d.location}: unsupported spec "${d.spec}" (not a semver range)`
      )
  const errors = []
  const views = new Map()
  const names = [...new Set(deps.map((d) => d.name))]
  await pool(names, opts.concurrency || 4, async (name) => {
    try {
      views.set(name, await fetchView(name, opts))
    } catch (e) {
      errors.push({ name, error: e.message })
    }
  })
  const result = {}
  for (const d of deps) {
    if (!views.has(d.name)) continue
    const { row, outdated } = evaluate({ ...d, view: views.get(d.name), trMs })
    if (!outdated && !opts.all) continue
    if (result[d.name] === undefined) result[d.name] = row
    else if (Array.isArray(result[d.name])) result[d.name].push(row)
    else result[d.name] = [result[d.name], row]
  }
  const sorted = Object.fromEntries(
    Object.keys(result)
      .sort()
      .map((k) => [k, result[k]])
  )
  return {
    result: sorted,
    errors: errors.sort((a, b) => (a.name < b.name ? -1 : 1)),
  }
}

async function main(argv) {
  const opt = (n, d) => {
    const i = argv.indexOf(n)
    return i >= 0 ? argv[i + 1] : d
  }
  const valued = new Set([
    '--root',
    '--projects',
    '--registry-json',
    '--record',
    '--concurrency',
  ])
  const positional = argv.filter(
    (a, i) => !a.startsWith('--') && !(i > 0 && valued.has(argv[i - 1]))
  )
  const tr = positional[0]
  const trMs = parseCutoff(tr)
  if (trMs === null) {
    console.error(
      'usage: outdated-at.mjs <Tr: ISO 8601 date or date-time> [--root <dir>] [--projects .,e2e] [--registry-json <dir>] [--record <dir>] [--concurrency 4] [--all]'
    )
    return 2
  }
  const root = path.resolve(opt('--root', path.join(SELF_DIR, '..')))
  const projects = opt('--projects', '.,e2e')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
  const registryJson = opt('--registry-json', null)
  let out
  try {
    out = await outdatedAt(trMs, {
      root,
      projects,
      registryJson: registryJson && path.resolve(registryJson),
      record: opt('--record', null) && path.resolve(opt('--record')),
      concurrency: Number(opt('--concurrency', 4)),
      all: argv.includes('--all'),
    })
  } catch (e) {
    console.error(e.message)
    return 2
  }
  process.stdout.write(`${JSON.stringify(out.result, null, 2)}\n`)
  for (const e of out.errors)
    console.error(`outdated-at: ${e.name}: ${e.error}`)
  return out.errors.length ? 1 : 0
}

if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
)
  main(process.argv.slice(2)).then((code) => {
    process.exitCode = code
  })
