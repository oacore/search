#!/usr/bin/env node
// audit-gate.mjs - the dependency audit gate of CI-8 (42 §10, 02 §3, R-072, S-5).
//
// Usage:
//   npm audit --omit=dev --audit-level=high --json > audit.json; node scripts/audit-gate.mjs audit.json
//   npm audit --omit=dev --json | node scripts/audit-gate.mjs
//   node scripts/audit-gate.mjs [file|-] [--level info|low|moderate|high|critical] [--allow <package>[,<package>]]
//                               [--json]
//
//   file|-      the `npm audit --json` report (audit report version 2, npm >= 7); default: standard input
//   --level     the lowest severity that counts (default high: high and critical)
//   --allow     extra allow-listed packages, severity cap `high` (tests; CI never passes it)
//   --json      print the verdict as JSON on stdout (nothing else)
//
// What it does: every advisory of the report at or above the level is blocking unless its package is on the
// allow-list. The allow-list is default-deny and capped: `d3-color` (02 §3: <3.1.0 is flagged high through
// d3-interpolate and d3-scale of the design Histoslider, until the DU-19 port at 7.1) is accepted up to
// severity high; a critical advisory of the same package still blocks. Packages that are vulnerable only
// through an allow-listed package (the `via: ['d3-color']` chains) carry no advisory of their own, so they are
// accepted with it and listed as effects. The report is validated first: a report that is not version 2, an
// `error` object (the registry was unreachable, no lock) or an unresolvable `via` chain is an error (exit 2),
// never a pass.
//
// Exit codes: 0 no blocking advisory; 1 at least one blocking advisory; 2 usage error or no usable report.
// Node built-ins only. In CI the step runs with `continue-on-error: ${{ vars.AUDIT_BLOCKING != 'true' }}`: the
// owner sets the variable when W7a (the first Next >= 15.5.24) is in prod; until then the gate reports.
import fs from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

export const SEVERITY_RANK = {
  info: 0,
  low: 1,
  moderate: 2,
  high: 3,
  critical: 4,
}
export const DEFAULT_LEVEL = 'high'
// package -> highest accepted severity; every entry cites the plan row that accepts it
export const ALLOW_LIST = [
  {
    package: 'd3-color',
    maxSeverity: 'high',
    reason:
      '02 §3: d3-color <3.1.0 reached through d3-interpolate and d3-scale (design Histoslider); closes at 7.2 (DU-19)',
  },
]

export class AuditReportError extends Error {}

const rank = (severity) =>
  Object.prototype.hasOwnProperty.call(SEVERITY_RANK, severity)
    ? SEVERITY_RANK[severity]
    : -1

const isObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v)

// text -> the validated report; AuditReportError for anything that is not a usable version 2 report
export function parseReport(text) {
  if (!String(text).trim())
    throw new AuditReportError(
      'no audit report: the input is empty (npm audit printed nothing)'
    )
  let report
  try {
    report = JSON.parse(text)
  } catch (e) {
    throw new AuditReportError(`the audit report is not JSON: ${e.message}`)
  }
  if (!isObject(report))
    throw new AuditReportError('the audit report is not a JSON object')
  if (isObject(report.error)) {
    const { code, summary, detail } = report.error
    throw new AuditReportError(
      `npm audit did not produce a report: ${[code, summary, detail]
        .filter(Boolean)
        .join(' - ')}`
    )
  }
  if (report.auditReportVersion !== 2)
    throw new AuditReportError(
      `unsupported audit report version ${JSON.stringify(
        report.auditReportVersion
      )} (version 2, npm >= 7, is required)`
    )
  if (!isObject(report.vulnerabilities))
    throw new AuditReportError('the audit report has no `vulnerabilities` map')
  return report
}

function allowEntry(allowList, pkg) {
  return allowList.find((a) => a.package === pkg) || null
}

// report -> verdict. `allowList` entries are { package, maxSeverity, reason }.
export function gate(
  report,
  { level = DEFAULT_LEVEL, allowList = ALLOW_LIST } = {}
) {
  if (rank(level) < 0)
    throw new AuditReportError(
      `unknown severity level ${JSON.stringify(level)}`
    )
  const names = new Set(Object.keys(report.vulnerabilities))
  const advisories = new Map() // key -> advisory
  const own = new Map() // package entry -> advisory keys
  const children = new Map() // package entry -> entries it is vulnerable through
  for (const [name, v] of Object.entries(report.vulnerabilities)) {
    if (!isObject(v) || !Array.isArray(v.via))
      throw new AuditReportError(`${name}: the entry has no \`via\` list`)
    own.set(name, [])
    children.set(name, [])
    for (const via of v.via) {
      if (typeof via === 'string') {
        // a vulnerability that comes from another package of the map
        if (!names.has(via))
          throw new AuditReportError(
            `${name}: \`via\` names ${via}, which is not in the report`
          )
        children.get(name).push(via)
      } else if (isObject(via)) {
        const pkg = via.name || name
        const key = `${pkg}\u0000${via.source || via.url || via.title}`
        if (!advisories.has(key))
          advisories.set(key, {
            package: pkg,
            severity: via.severity,
            title: via.title || '',
            url: via.url || '',
            range: via.range || v.range || '',
            fixAvailable: v.fixAvailable === undefined ? null : v.fixAvailable,
          })
        own.get(name).push(key)
      } else {
        throw new AuditReportError(
          `${name}: a \`via\` element is neither a name nor an advisory`
        )
      }
    }
  }
  const blocking = []
  const allowed = []
  const below = []
  const allowedKeys = new Set()
  for (const [key, a] of advisories) {
    if (rank(a.severity) < 0)
      throw new AuditReportError(
        `${a.package}: unknown advisory severity ${JSON.stringify(a.severity)}`
      )
    if (rank(a.severity) < rank(level)) {
      below.push(a)
    } else {
      const entry = allowEntry(allowList, a.package)
      if (entry && rank(a.severity) <= rank(entry.maxSeverity)) {
        allowed.push({ ...a, allowedBy: entry.reason })
        allowedKeys.add(key)
      } else blocking.push(a)
    }
  }
  const byRank = (x, y) =>
    rank(y.severity) - rank(x.severity) || x.package.localeCompare(y.package)
  blocking.sort(byRank)
  allowed.sort(byRank)
  below.sort(byRank)
  // the advisories at or above the level that each entry is vulnerable through, own and inherited (a fixpoint:
  // the chains can have cycles)
  const counted = (key) => rank(advisories.get(key).severity) >= rank(level)
  const reach = new Map(
    [...names].map((n) => [n, new Set(own.get(n).filter(counted))])
  )
  for (let changed = true; changed; ) {
    changed = false
    for (const n of names)
      for (const c of children.get(n))
        for (const key of reach.get(c))
          if (!reach.get(n).has(key)) {
            reach.get(n).add(key)
            changed = true
          }
  }
  // entries that are vulnerable only through allow-listed advisories of another package: effects of it
  const effects = [...names]
    .filter((n) => {
      const keys = [...reach.get(n)]
      return (
        keys.length > 0 &&
        keys.every((k) => allowedKeys.has(k)) &&
        own.get(n).filter(counted).length === 0
      )
    })
    .sort()
  return {
    level,
    ok: blocking.length === 0,
    counts: {
      blocking: blocking.length,
      allowed: allowed.length,
      belowLevel: below.length,
      packages: names.size,
    },
    blocking,
    allowed,
    effects,
    allowList: allowList.map((a) => ({
      package: a.package,
      maxSeverity: a.maxSeverity,
    })),
  }
}

export function format(verdict) {
  const lines = []
  const row = (a) =>
    `  ${a.severity.padEnd(8)} ${a.package}${a.range ? ` ${a.range}` : ''}  ${
      a.title
    }${a.url ? `  ${a.url}` : ''}`
  lines.push(
    `audit gate (level ${verdict.level}): ${verdict.counts.blocking} blocking, ${verdict.counts.allowed} allow-listed, ${verdict.counts.belowLevel} below the level, ${verdict.counts.packages} vulnerable packages in the report`
  )
  if (verdict.blocking.length) {
    lines.push('blocking:')
    verdict.blocking.forEach((a) => lines.push(row(a)))
  }
  if (verdict.allowed.length) {
    lines.push(
      `allow-listed (${verdict.allowList
        .map((a) => `${a.package} up to ${a.maxSeverity}`)
        .join(', ')}):`
    )
    verdict.allowed.forEach((a) => lines.push(row(a)))
  }
  if (verdict.effects.length)
    lines.push(
      `effects of allow-listed packages: ${verdict.effects.join(', ')}`
    )
  lines.push(verdict.ok ? 'audit gate: pass' : 'audit gate: FAIL')
  return lines.join('\n')
}

function summaryMarkdown(verdict) {
  const out = [
    `### Audit gate (CI-8, level ${verdict.level}): ${
      verdict.ok ? 'pass' : 'fail'
    }`,
    '',
    `${verdict.counts.blocking} blocking, ${verdict.counts.allowed} allow-listed, ${verdict.counts.belowLevel} below the level`,
  ]
  if (verdict.blocking.length) {
    out.push('', '| severity | package | advisory |', '|---|---|---|')
    verdict.blocking.forEach((a) =>
      out.push(`| ${a.severity} | ${a.package} | ${a.title} ${a.url} |`)
    )
  }
  return `${out.join('\n')}\n`
}

// argv -> { source, level, allow, json } or { error }
export function parseArgs(argv) {
  const out = { source: null, level: DEFAULT_LEVEL, allow: [], json: false }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a === '--json') out.json = true
    else if (a === '--level' || a === '--allow') {
      i++
      if (argv[i] === undefined || argv[i].startsWith('--'))
        return { error: `${a} needs a value` }
      if (a === '--level') out.level = argv[i]
      else
        out.allow.push(
          ...argv[i]
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean)
        )
    } else if (a.startsWith('--')) return { error: `unknown option ${a}` }
    else if (out.source !== null) return { error: 'more than one input file' }
    else out.source = a
  }
  return out
}

function main(argv) {
  const args = parseArgs(argv)
  if (args.error) {
    console.error(
      `audit gate: ${args.error}\nusage: audit-gate.mjs [file|-] [--level <severity>] [--allow <package>,...] [--json]`
    )
    return 2
  }
  const extra = args.allow.map((p) => ({
    package: p,
    maxSeverity: 'high',
    reason: '--allow',
  }))
  let verdict
  try {
    const text =
      !args.source || args.source === '-'
        ? fs.readFileSync(0, 'utf8')
        : fs.readFileSync(args.source, 'utf8')
    verdict = gate(parseReport(text), {
      level: args.level,
      allowList: [...ALLOW_LIST, ...extra],
    })
  } catch (e) {
    if (e instanceof AuditReportError || e.code === 'ENOENT') {
      console.error(`audit gate: ERROR ${e.message}`)
      return 2
    }
    throw e
  }
  if (args.json) console.log(JSON.stringify(verdict, null, 2))
  else console.log(format(verdict))
  if (process.env.GITHUB_STEP_SUMMARY) {
    try {
      fs.appendFileSync(
        process.env.GITHUB_STEP_SUMMARY,
        summaryMarkdown(verdict)
      )
    } catch {
      // the summary is a convenience
    }
  }
  return verdict.ok ? 0 : 1
}

if (fileURLToPath(import.meta.url) === path.resolve(process.argv[1] || ''))
  process.exitCode = main(process.argv.slice(2))
