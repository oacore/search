#!/usr/bin/env node
// next-diff.mjs - compares two Next.js build outputs (T-014, 42 §5 items 1-2): every file under .next/static and
// .next/server, byte for byte after normalising the buildId (in file names and contents) and, for builds
// made in different directories, the absolute build root (docker builds always use /app; host builds do not).
//
// Usage: node scripts/next-diff.mjs <nextDirA> <nextDirB> [--root-a <dir>] [--root-b <dir>] [--json] [--exclude <regex>]
// Exit 0 when identical.
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { fileURLToPath } from 'node:url'

const walk = (dir, base = dir) =>
  fs.existsSync(dir)
    ? fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
        const p = path.join(dir, e.name)
        return e.isDirectory() ? walk(p, base) : [path.relative(base, p)]
      })
    : []

export function diffNext(
  a,
  b,
  { rootA = null, rootB = null, exclude = null } = {}
) {
  const idA = fs.readFileSync(path.join(a, 'BUILD_ID'), 'utf8').trim()
  const idB = fs.readFileSync(path.join(b, 'BUILD_ID'), 'utf8').trim()
  const norm = (rel, id) => rel.split(id).join('<BUILD_ID>')
  const list = (dir, id) => {
    const m = new Map()
    for (const sub of ['static', 'server'])
      for (const rel of walk(path.join(dir, sub)))
        m.set(norm(`${sub}/${rel}`, id), `${sub}/${rel}`)
    return m
  }
  const la = list(a, idA)
  const lb = list(b, idB)
  const skip = exclude ? new RegExp(exclude) : null
  const onlyA = [...la.keys()]
    .filter((k) => !lb.has(k) && !(skip && skip.test(k)))
    .sort()
  const onlyB = [...lb.keys()]
    .filter((k) => !la.has(k) && !(skip && skip.test(k)))
    .sort()
  const differ = []
  let same = 0
  const content = (dir, rel, id, root) => {
    let buf = fs.readFileSync(path.join(dir, rel))
    let s = buf.toString('latin1')
    if (s.includes(id) || (root && s.includes(root))) {
      s = s.split(id).join('<BUILD_ID>')
      if (root) s = s.split(root).join('<ROOT>')
      buf = Buffer.from(s, 'latin1')
    }
    return buf
  }
  for (const [k, relA] of la) {
    if (!lb.has(k) || (skip && skip.test(k))) continue
    const ca = content(a, relA, idA, rootA)
    const cb = content(b, lb.get(k), idB, rootB)
    if (ca.equals(cb)) same++
    else {
      let i = 0
      while (i < ca.length && i < cb.length && ca[i] === cb[i]) i++
      differ.push({
        file: k,
        sizeA: ca.length,
        sizeB: cb.length,
        firstDiffAt: i,
        sha256A: crypto.createHash('sha256').update(ca).digest('hex'),
        sha256B: crypto.createHash('sha256').update(cb).digest('hex'),
      })
    }
  }
  return {
    buildIdA: idA,
    buildIdB: idB,
    files: la.size,
    same,
    onlyA,
    onlyB,
    differ,
    identical: !onlyA.length && !onlyB.length && !differ.length,
  }
}

function main(argv) {
  const opt = (n, d) => {
    const i = argv.indexOf(n)
    return i >= 0 ? argv[i + 1] : d
  }
  const pos = argv.filter(
    (x, i) =>
      !x.startsWith('--') &&
      !['--root-a', '--root-b', '--exclude'].includes(argv[i - 1])
  )
  const r = diffNext(path.resolve(pos[0]), path.resolve(pos[1]), {
    rootA: opt('--root-a', null),
    rootB: opt('--root-b', null),
    exclude: opt('--exclude', null),
  })
  if (argv.includes('--json')) console.log(JSON.stringify(r, null, 1))
  else {
    console.log(
      `${r.files} files; ${r.same} identical; ${r.differ.length} differ; ${r.onlyA.length} only in A; ${r.onlyB.length} only in B`
    )
    for (const d of r.differ.slice(0, 50))
      console.log(
        `DIFF ${d.file} (${d.sizeA} vs ${d.sizeB} bytes, first difference at ${d.firstDiffAt})`
      )
    for (const f of r.onlyA.slice(0, 20)) console.log(`ONLY-A ${f}`)
    for (const f of r.onlyB.slice(0, 20)) console.log(`ONLY-B ${f}`)
  }
  process.exit(r.identical ? 0 : 1)
}

if (fileURLToPath(import.meta.url) === path.resolve(process.argv[1] || ''))
  main(process.argv.slice(2))
