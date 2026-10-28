#!/usr/bin/env node
// prod-tree-report.mjs - the production dependency tree of a whole jump against the jump's base, every change
// mapped to its change-site row (20, 60) or version row (02). T-013 compares the lock with the latest dependency
// step merge only (AD-005), so a silent move of a shared production copy between two step merges would not show
// at the jump tip; this report compares the jump tip with the jump's base and fails on any change no row names.
//
// Usage:
//   node scripts/prod-tree-report.mjs [--jump <id>] [--base <git ref>] [--head <git ref>] [--map <file>] [--json]
//   node scripts/prod-tree-report.mjs --self-test
//
//   --jump   the section of the map (default: the map's `default`)
//   --base   base ref (default: the section's `base`); --head the head ref (default: the working tree's lock)
//   --map    the row map (default: scripts/prod-tree-rows.json)
//
// The production tree of a lock (lockfileVersion 2/3) = its `packages` entries without `dev` or `devOptional`
// (links excluded), as a set of name@version. An item is a name@version in one tree and not the other (added or
// removed; a version move is one of each). Its reachers are the root dependencies (package.json `dependencies`,
// `optionalDependencies`) whose production closure holds it, resolved the way node resolves `require` through
// nested node_modules. An item is explained by
//   (a) a `versions` entry of the section naming that name@version (a shared copy that moved, a removal from a
//       package that stays), or
//   (b) its reachers, when every reacher is a `roots` entry whose base and head versions are those of the trees
//       (`from`/`to`, null = not a root dependency on that side): the item came or went with that root's change.
// Unexplained items fail the report (exit 1). A map entry that matches nothing is reported as stale (exit 1).
// Exit codes: 0 every change mapped; 1 an unmapped change or a stale map entry; 2 usage or input error.
// Node built-ins only.

import fs from 'node:fs'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const args = process.argv.slice(2)
const opt = (n, d) => {
  const i = args.indexOf(n)
  return i >= 0 ? args[i + 1] : d
}
const has = (n) => args.includes(n)

const nameOf = (key, entry) =>
  entry.name || key.slice(key.lastIndexOf('node_modules/') + 13)

// the production graph of a lock: node keys, their name@version, their resolved production dependencies
export function prodGraph(lock) {
  const pk = lock.packages || {}
  const prod = (k) => pk[k] && !pk[k].dev && !pk[k].devOptional && !pk[k].link
  const resolve = (from, dep) => {
    // node resolution: <from>/node_modules/<dep>, then each ancestor's node_modules, then the root
    let base = from
    for (;;) {
      const k = base ? `${base}/node_modules/${dep}` : `node_modules/${dep}`
      if (pk[k]) return k
      if (!base) return null
      const i = base.lastIndexOf('/node_modules/')
      base = i >= 0 ? base.slice(0, i) : ''
    }
  }
  const deps = (k) => {
    const e = pk[k] || {}
    return [
      ...Object.keys(e.dependencies || {}),
      ...Object.keys(e.optionalDependencies || {}),
      ...Object.keys(e.peerDependencies || {}),
    ]
      .map((d) => resolve(k, d))
      .filter((r) => r && prod(r))
  }
  const root = pk[''] || {}
  const roots = Object.fromEntries(
    [
      ...Object.keys(root.dependencies || {}),
      ...Object.keys(root.optionalDependencies || {}),
    ]
      .map((n) => [n, resolve('', n)])
      .filter(([, k]) => k && prod(k))
  )
  const ids = new Map()
  for (const k of Object.keys(pk))
    if (k && prod(k)) ids.set(k, `${nameOf(k, pk[k])}@${pk[k].version}`)
  // reachers: per node key, the root dependency names whose closure holds it
  const reach = new Map()
  for (const [rname, rkey] of Object.entries(roots)) {
    const seen = new Set([rkey])
    const stack = [rkey]
    while (stack.length) {
      const k = stack.pop()
      if (!reach.has(k)) reach.set(k, new Set())
      reach.get(k).add(rname)
      for (const d of deps(k))
        if (!seen.has(d)) {
          seen.add(d)
          stack.push(d)
        }
    }
  }
  const rootVersions = Object.fromEntries(
    Object.entries(roots).map(([n, k]) => [n, pk[k].version])
  )
  return { ids, reach, rootVersions }
}

export function report(oldLock, newLock, section) {
  const a = prodGraph(oldLock)
  const b = prodGraph(newLock)
  const set = (g) => new Set(g.ids.values())
  const sa = set(a)
  const sb = set(b)
  const reachersOf = (g, id) => {
    const out = new Set()
    for (const [k, v] of g.ids)
      if (v === id) for (const r of g.reach.get(k) || []) out.add(r)
    return [...out].sort()
  }
  const roots = section.roots || {}
  const versions = section.versions || {}
  const rootOk = (r) =>
    roots[r] &&
    (roots[r].from ?? null) === (a.rootVersions[r] ?? null) &&
    (roots[r].to ?? null) === (b.rootVersions[r] ?? null)
  const used = new Set()
  const items = []
  for (const [kind, from, to, g] of [
    ['removed', sa, sb, a],
    ['added', sb, sa, b],
  ])
    for (const id of [...from].filter((x) => !to.has(x)).sort()) {
      const reachers = reachersOf(g, id)
      let row = null
      if (versions[id]) {
        row = versions[id]
        used.add(`versions:${id}`)
      } else if (reachers.length && reachers.every(rootOk)) {
        row = reachers.map((r) => roots[r].row).join('; ')
        for (const r of reachers) used.add(`roots:${r}`)
      }
      items.push({ kind, id, reachers, row })
    }
  // a root entry is in use when its own version changed, even if every item it explains is also a versions entry
  for (const r of Object.keys(roots)) if (rootOk(r)) used.add(`roots:${r}`)
  const stale = [
    ...Object.keys(roots)
      .filter((r) => !used.has(`roots:${r}`))
      .map((r) => `roots:${r}`),
    ...Object.keys(versions)
      .filter((v) => !used.has(`versions:${v}`))
      .map((v) => `versions:${v}`),
  ]
  const unmapped = items.filter((i) => !i.row)
  const rootChanges = Object.keys({ ...a.rootVersions, ...b.rootVersions })
    .filter((r) => a.rootVersions[r] !== b.rootVersions[r])
    .sort()
    .map((r) => ({
      root: r,
      from: a.rootVersions[r] ?? null,
      to: b.rootVersions[r] ?? null,
      row: rootOk(r) ? roots[r].row : null,
    }))
  return {
    production: { base: sa.size, head: sb.size },
    added: items.filter((i) => i.kind === 'added').length,
    removed: items.filter((i) => i.kind === 'removed').length,
    rootChanges,
    items,
    unmapped,
    stale,
    ok: unmapped.length === 0 && stale.length === 0,
  }
}

function selfTest() {
  let n = 0
  let fail = 0
  const t = (name, fn) => {
    n += 1
    try {
      fn()
      process.stdout.write(`ok ${name}\n`)
    } catch (e) {
      fail += 1
      process.stdout.write(`FAIL ${name}: ${e.message}\n`)
    }
  }
  const eq = (x, y) => {
    if (JSON.stringify(x) !== JSON.stringify(y))
      throw new Error(`${JSON.stringify(x)} !== ${JSON.stringify(y)}`)
  }
  const lock = (rootDeps, pk) => ({
    lockfileVersion: 2,
    packages: { '': { dependencies: rootDeps }, ...pk },
  })
  const OLD = lock(
    { a: '1', d: '1' },
    {
      'node_modules/a': { version: '1.0.0', dependencies: { s: '1' } },
      'node_modules/s': { version: '1.0.0' },
      'node_modules/d': { version: '1.0.0', dependencies: { x: '1' } },
      'node_modules/x': { version: '1.0.0' },
      'node_modules/t': { version: '1.0.0', dev: true },
    }
  )
  const NEW = lock(
    { a: '2', d: '1' },
    {
      'node_modules/a': { version: '2.0.0', dependencies: { s: '2' } },
      'node_modules/a/node_modules/s': { version: '2.0.0' },
      'node_modules/s': { version: '1.0.0', dev: true },
      'node_modules/d': { version: '1.0.0', dependencies: { x: '1' } },
      'node_modules/x': { version: '1.1.0' },
      'node_modules/t': { version: '2.0.0', dev: true },
    }
  )
  t(
    'items: a root bump, its nested copy, a shared copy that moved, dev entries ignored',
    () => {
      const r = report(OLD, NEW, {})
      eq(
        r.items.map((i) => [i.kind, i.id, i.reachers]),
        [
          ['removed', 'a@1.0.0', ['a']],
          ['removed', 's@1.0.0', ['a']],
          ['removed', 'x@1.0.0', ['d']],
          ['added', 'a@2.0.0', ['a']],
          ['added', 's@2.0.0', ['a']],
          ['added', 'x@1.1.0', ['d']],
        ]
      )
      eq(r.ok, false)
    }
  )
  t(
    'a roots entry explains its own subtree only; the moved copy under an unchanged root stays unmapped',
    () => {
      const r = report(OLD, NEW, {
        roots: { a: { from: '1.0.0', to: '2.0.0', row: 'CS-A' } },
      })
      eq(
        r.unmapped.map((i) => i.id),
        ['x@1.0.0', 'x@1.1.0']
      )
    }
  )
  t('a versions entry explains the moved copy; everything mapped is ok', () => {
    const r = report(OLD, NEW, {
      roots: { a: { from: '1.0.0', to: '2.0.0', row: 'CS-A' } },
      versions: { 'x@1.0.0': 'CS-X', 'x@1.1.0': 'CS-X' },
    })
    eq([r.ok, r.unmapped, r.stale], [true, [], []])
  })
  t(
    'a roots entry with other versions does not explain anything, and a map entry that matches nothing is stale',
    () => {
      const r = report(OLD, NEW, {
        roots: { a: { from: '1.0.0', to: '3.0.0', row: 'CS-A' } },
        versions: { 'x@1.0.0': 'CS-X', 'x@1.1.0': 'CS-X', 'y@1.0.0': 'CS-Y' },
      })
      eq(r.unmapped.length, 4)
      eq(r.stale, ['roots:a', 'versions:y@1.0.0'])
    }
  )
  t('a root removed (to null) explains the tree it took away', () => {
    const NEW2 = lock(
      { d: '1' },
      {
        'node_modules/d': { version: '1.0.0', dependencies: { x: '1' } },
        'node_modules/x': { version: '1.0.0' },
      }
    )
    const r = report(OLD, NEW2, {
      roots: { a: { from: '1.0.0', to: null, row: 'CS-A' } },
    })
    eq([r.ok, r.removed, r.added], [true, 2, 0])
  })
  process.stdout.write(`self-test: ${n - fail}/${n}\n`)
  return fail ? 1 : 0
}

function main() {
  if (has('--self-test')) return selfTest()
  const mapFile = path.resolve(
    repo,
    opt('--map', path.join('scripts', 'prod-tree-rows.json'))
  )
  let map
  try {
    map = JSON.parse(fs.readFileSync(mapFile, 'utf8'))
  } catch (e) {
    process.stderr.write(
      `prod-tree-report: cannot read ${mapFile}: ${e.message}\n`
    )
    return 2
  }
  const jump = opt('--jump', map.default)
  const section = map[jump]
  if (!section || typeof section !== 'object') {
    process.stderr.write(`prod-tree-report: no section ${jump} in the map\n`)
    return 2
  }
  const base = opt('--base', section.base)
  const head = opt('--head', null)
  const show = (ref) =>
    JSON.parse(
      execFileSync('git', ['-C', repo, 'show', `${ref}:package-lock.json`], {
        encoding: 'utf8',
        maxBuffer: 1 << 28,
      })
    )
  let oldLock
  let newLock
  try {
    oldLock = show(base)
    newLock = head
      ? show(head)
      : JSON.parse(
          fs.readFileSync(path.join(repo, 'package-lock.json'), 'utf8')
        )
  } catch (e) {
    process.stderr.write(`prod-tree-report: ${e.message}\n`)
    return 2
  }
  const r = {
    jump,
    base,
    head: head || 'working tree',
    ...report(oldLock, newLock, section),
  }
  if (has('--json')) process.stdout.write(`${JSON.stringify(r, null, 1)}\n`)
  else {
    const lines = [
      `production tree ${r.base} -> ${r.head}: ${r.production.base} -> ${r.production.head} name@version, ${r.removed} removed, ${r.added} added`,
      ...r.rootChanges.map(
        (c) =>
          `  root ${c.root}: ${c.from ?? '-'} -> ${c.to ?? '-'}  ${c.row || 'UNMAPPED'}`
      ),
      ...r.items
        .filter(
          (i) =>
            !i.reachers.every((x) => r.rootChanges.some((c) => c.root === x)) ||
            !i.row
        )
        .map(
          (i) =>
            `  ${i.kind} ${i.id} (reached from ${i.reachers.join(', ') || 'nothing'}): ${i.row || 'UNMAPPED'}`
        ),
      ...r.stale.map((s) => `  stale map entry ${s}`),
      r.ok
        ? 'ok: every change maps to a row'
        : `FAIL: ${r.unmapped.length} unmapped, ${r.stale.length} stale`,
    ]
    process.stdout.write(`${lines.join('\n')}\n`)
  }
  return r.ok ? 0 : 1
}

if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
)
  process.exitCode = main()
