#!/usr/bin/env node
// lock-immutable.mjs - proves that test tooling leaves the production dependency tree untouched (T-013, 42 §5 item 3).
//
// Usage:
//   node scripts/lock-immutable.mjs [--base <git ref>] [--old <lock>] [--new <lock>] [--old-pkg <package.json>]
//                                   [--new-pkg <package.json>] [--no-npm-ls] [--json]
//
//   --base     reference commit (default: the first-parent merge whose subject ends with "(CS-W0-9)", i.e. <base'>)
//   --old      old lockfile path (default: `git show <base>:package-lock.json`)
//   --new      new lockfile path (default: ./package-lock.json)
//   --no-npm-ls  skip the `npm ls --omit=dev --all --package-lock-only` comparison
//
// Checks (exit 1 on any violation):
//   c1 old-entries   every old `packages` entry keeps version, resolved and integrity at its path
//   c2 npm-ls        `npm ls --omit=dev --all --json --package-lock-only` of old and new trees are identical,
//                    and the set of non-dev lock entries is identical
//   c3 overrides     an old entry that moved to another path is pinned by `overrides` in the new package.json
//   c4 e2e-only      Playwright and axe packages appear only in e2e/package.json (never in the root manifest
//                    or as new root lock entries)
// Node built-ins only.

import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const args = process.argv.slice(2)
const opt = (n, d) => {
  const i = args.indexOf(n)
  return i >= 0 ? args[i + 1] : d
}
const has = (n) => args.includes(n)
const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const git = (...a) =>
  execFileSync('git', ['-C', repo, ...a], {
    encoding: 'utf8',
    maxBuffer: 1 << 28,
  })

export function findBasePrime() {
  if (process.env.BASE_PRIME) return process.env.BASE_PRIME
  const out = git('log', '--first-parent', '--format=%H %s', 'HEAD').split('\n')
  const hit = out.find((l) => / \(CS-W0-9\)$/.test(l) && /^\S+ Merge /.test(l))
  if (!hit)
    throw new Error(
      'no <base\'> merge commit (subject ending "(CS-W0-9)") on the first-parent history; set BASE_PRIME'
    )
  return hit.split(' ')[0]
}

const nameOf = (key) => {
  const i = key.lastIndexOf('node_modules/')
  return i < 0 ? key : key.slice(i + 'node_modules/'.length)
}

function overridePins(overrides, name, version) {
  // accepts {name: version}, {parent: {name: version}} (one level) and {name: {".": version}}
  if (!overrides) return false
  const hit = (v) =>
    v === version || (v && typeof v === 'object' && v['.'] === version)
  if (hit(overrides[name])) return true
  return Object.values(overrides).some(
    (v) => v && typeof v === 'object' && hit(v[name])
  )
}

const E2E_ONLY = /^(@playwright\/|playwright$|playwright-core$|@axe-core\/)/

export function compareLocks(oldLock, newLock, newPkg) {
  const v = []
  const op = oldLock.packages || {}
  const np = newLock.packages || {}
  const moved = []
  for (const [k, o] of Object.entries(op)) {
    if (k === '') continue
    const n = np[k]
    if (
      n &&
      n.version === o.version &&
      n.resolved === o.resolved &&
      n.integrity === o.integrity
    )
      continue
    const name = nameOf(k)
    const elsewhere = Object.entries(np).find(
      ([k2, e]) =>
        k2 !== k &&
        nameOf(k2) === name &&
        e.version === o.version &&
        e.integrity === o.integrity
    )
    if (elsewhere) {
      moved.push({
        path: k,
        to: elsewhere[0],
        name,
        version: o.version,
        pinned: overridePins(newPkg.overrides, name, o.version),
      })
      continue
    }
    v.push({
      check: 'c1',
      path: k,
      old: { version: o.version, resolved: o.resolved, integrity: o.integrity },
      new: n
        ? { version: n.version, resolved: n.resolved, integrity: n.integrity }
        : null,
    })
  }
  for (const m of moved)
    if (!m.pinned)
      v.push({
        check: 'c3',
        path: m.path,
        movedTo: m.to,
        name: m.name,
        version: m.version,
        msg: 'moved entry not pinned by overrides',
      })
  // overrides only pin drift back to versions the old lock already has; they never introduce a version
  const pins = []
  const collect = (obj, scope) => {
    for (const [key, val] of Object.entries(obj || {})) {
      if (typeof val === 'string') pins.push({ key, scope, version: val })
      else if (val && typeof val === 'object') {
        if (typeof val['.'] === 'string')
          pins.push({ key, scope, version: val['.'] })
        collect(
          Object.fromEntries(Object.entries(val).filter(([k]) => k !== '.')),
          key
        )
      }
    }
  }
  collect(newPkg.overrides, null)
  const oldVersions = new Map()
  for (const [k, e] of Object.entries(op))
    if (k)
      oldVersions.set(nameOf(k), [
        ...(oldVersions.get(nameOf(k)) || []),
        e.version,
      ])
  for (const p of pins) {
    if (p.version.startsWith('$')) continue
    const name = p.key.replace(/^(@?[^@]+)@.*$/, '$1')
    if (!(oldVersions.get(name) || []).includes(p.version))
      v.push({
        check: 'c3',
        msg: `override ${p.scope ? `${p.scope} > ` : ''}${p.key} = ${
          p.version
        } is not a version of the old lock`,
      })
  }
  // root entry: only devDependencies may change
  const or = { ...(op[''] || {}) }
  const nr = { ...(np[''] || {}) }
  delete or.devDependencies
  delete nr.devDependencies
  if (JSON.stringify(or) !== JSON.stringify(nr))
    v.push({
      check: 'c1',
      path: '',
      msg: 'root lock entry changed outside devDependencies',
    })
  if (oldLock.lockfileVersion !== newLock.lockfileVersion)
    v.push({
      check: 'c1',
      path: '',
      msg: `lockfileVersion ${oldLock.lockfileVersion} -> ${newLock.lockfileVersion}`,
    })
  // prod entry sets
  const prod = (p) =>
    Object.entries(p)
      .filter(([k, e]) => k && !e.dev)
      .map(([k, e]) => `${k}@${e.version}#${e.integrity}`)
      .sort()
  const a = prod(op)
  const b = prod(np)
  const onlyOld = a.filter((x) => !b.includes(x))
  const onlyNew = b.filter((x) => !a.includes(x))
  if (onlyOld.length || onlyNew.length)
    v.push({
      check: 'c2',
      msg: 'non-dev lock entries differ',
      onlyOld: onlyOld.slice(0, 20),
      onlyNew: onlyNew.slice(0, 20),
    })
  // e2e-only packages
  for (const sect of [
    'dependencies',
    'devDependencies',
    'optionalDependencies',
    'peerDependencies',
  ])
    for (const n of Object.keys(newPkg[sect] || {}))
      if (E2E_ONLY.test(n))
        v.push({ check: 'c4', msg: `${n} in root package.json ${sect}` })
  for (const k of Object.keys(np))
    if (k && E2E_ONLY.test(nameOf(k)) && !op[k])
      v.push({ check: 'c4', msg: `${k} is a new root lock entry` })
  return {
    violations: v,
    moved,
    overrides: pins,
    oldEntries: Object.keys(op).length - 1,
    newEntries: Object.keys(np).length - 1,
  }
}

export function npmLsLockOnly(pkgText, lockText) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'lock-immutable-'))
  try {
    fs.writeFileSync(path.join(dir, 'package.json'), pkgText)
    fs.writeFileSync(path.join(dir, 'package-lock.json'), lockText)
    let out
    try {
      out = execFileSync(
        'npm',
        ['ls', '--omit=dev', '--all', '--json', '--package-lock-only'],
        {
          cwd: dir,
          encoding: 'utf8',
          maxBuffer: 1 << 28,
          stdio: ['ignore', 'pipe', 'ignore'],
        }
      )
    } catch (e) {
      out = e.stdout // npm ls exits 1 on peer problems; the JSON is still complete
    }
    // npm prints absolute paths in problem strings: make them root-relative
    for (const d of new Set([dir, fs.realpathSync(dir)]))
      out = out.split(d).join('<root>')
    return out
  } finally {
    fs.rmSync(dir, { recursive: true, force: true })
  }
}

export function stripOverridden(text) {
  const drop = (x) => {
    if (Array.isArray(x)) return x.map(drop)
    if (x && typeof x === 'object') {
      const o = {}
      for (const [k, v] of Object.entries(x))
        if (k !== 'overridden') o[k] = drop(v)
      return o
    }
    return x
  }
  return JSON.stringify(drop(JSON.parse(text)), null, 2)
}

function main() {
  const base =
    opt('--base', null) || (opt('--old', null) ? null : findBasePrime())
  const oldText = opt('--old', null)
    ? fs.readFileSync(opt('--old'), 'utf8')
    : git('show', `${base}:package-lock.json`)
  const oldPkgText = opt('--old-pkg', null)
    ? fs.readFileSync(opt('--old-pkg'), 'utf8')
    : base
    ? git('show', `${base}:package.json`)
    : null
  const newText = fs.readFileSync(
    opt('--new', path.join(repo, 'package-lock.json')),
    'utf8'
  )
  const newPkgText = fs.readFileSync(
    opt('--new-pkg', path.join(repo, 'package.json')),
    'utf8'
  )
  const res = compareLocks(
    JSON.parse(oldText),
    JSON.parse(newText),
    JSON.parse(newPkgText)
  )
  res.base = base
  if (!has('--no-npm-ls')) {
    if (!oldPkgText)
      throw new Error(
        '--old-pkg is needed with --old for the npm ls comparison'
      )
    const a = npmLsLockOnly(oldPkgText, oldText)
    const b = npmLsLockOnly(newPkgText, newText)
    // `overridden` is npm's annotation that an `overrides` rule touched a shared node (c3 pins drift that way);
    // names, versions, resolved URLs and structure must still be identical
    const sa = stripOverridden(a)
    const sb = stripOverridden(b)
    res.npmLs = {
      identical: sa === sb,
      rawIdentical: a === b,
      oldBytes: a.length,
      newBytes: b.length,
    }
    if (sa !== sb)
      res.violations.push({
        check: 'c2',
        msg: 'npm ls --omit=dev --all --package-lock-only differs',
      })
  }
  const e2ePkg = path.join(repo, 'e2e', 'package.json')
  if (fs.existsSync(e2ePkg)) {
    const e = JSON.parse(fs.readFileSync(e2ePkg, 'utf8'))
    const all = { ...e.dependencies, ...e.devDependencies }
    res.e2e = {
      playwright: all['@playwright/test'] || null,
      axe: all['@axe-core/playwright'] || null,
    }
  }
  res.ok = res.violations.length === 0
  if (has('--json')) console.log(JSON.stringify(res, null, 1))
  else {
    console.log(
      `base ${base || '(file)'}: ${res.oldEntries} old entries, ${
        res.newEntries
      } new entries, ${res.moved.length} moved`
    )
    for (const x of res.violations)
      console.log(`VIOLATION ${x.check} ${x.path ?? ''} ${x.msg ?? ''}`)
    console.log(res.ok ? 'OK lock immutable' : 'FAIL')
  }
  process.exit(res.ok ? 0 : 1)
}

if (fileURLToPath(import.meta.url) === path.resolve(process.argv[1] || ''))
  main()
