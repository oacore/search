#!/usr/bin/env node
// verify-design-verbatim.mjs - the installed @oacore/design equals the published tarball (T-016 c3; VG-1, VG-2
// support; 60 §1, §2; R-015, R-075).
//
// Usage:
//   node scripts/verify-design-verbatim.mjs [--root <dir>] [--target <dir>] [--version <v>] [--changes <file>]
//                                           [--tarball <file>] [--tarball-dir <dir>] [--json]
//   node scripts/verify-design-verbatim.mjs --self-test
//
//   --root         the app tree whose package-lock.json names the tarball (default: the repository)
//   --target       the copy to verify (default <root>/node_modules/@oacore/design; from W5 vendor/oacore-design)
//   --version      the published version (default: the version of the lock entry, 5.0.74)
//   --changes      the edit list of the copy (default <root>/vendor/CHANGES.md when it exists; 60 §2: a table whose
//                  first column is the changed file, relative to the package)
//   --tarball      use this tarball (it is verified against the lock integrity) instead of asking npm
//   --tarball-dir  keep the tarball obtained from npm in this directory (default: a temporary directory, removed)
//   --self-test    known-answer tests of the tar reader and the CHANGES parser; touches no tarball
//
// The tarball comes from the npm cache only, nothing is downloaded: `npm pack @oacore/design@<version> --offline`
// (needs the packument in the cache); when that misses, the content-addressed cache entry of the lock integrity
// (`npm ci` caches the tarball by integrity, not the packument). A miss of both exits 2.
// The tarball is checked against the sha512 integrity of package-lock.json (and the sha1 of 60 §1 for 5.0.74),
// read in memory (no extraction), and every file is compared byte for byte (sha256) with the copy.
//
// Pass = the set of files that differ (or exist on one side only) equals the allowed set:
//   - the files named by CHANGES.md (60 §2; none before DV1), each of which must really differ, and
//   - lib/config.js for a copy inside node_modules (its postinstall writes it from design.config.js; until DV7)
// A symlinked copy (R-075) or a symlink inside it fails.
// Exit codes: 0 verbatim, 1 differences, 2 usage, cache miss, integrity mismatch or missing copy.
// Node built-ins only (and `npm` for the pack).

import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import zlib from 'node:zlib'
import crypto from 'node:crypto'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const NAME = '@oacore/design'
// 60 §1: sha1 of @oacore/design@5.0.74 (package-lock.json:2365 before the lock was regenerated)
const SHA1_5_0_74 = 'e6a401d74defeb09d828b10374ff35107a9324c4'
// the postinstall of the installed package writes this file (bin build, from design.config.js)
const INSTALL_GENERATED = ['lib/config.js']

const sha = (alg, data, enc = 'hex') =>
  crypto.createHash(alg).update(data).digest(enc)

// ---------- tar (in memory) ----------

const cstr = (buf) => {
  const z = buf.indexOf(0)
  return buf.subarray(0, z < 0 ? buf.length : z).toString('utf8')
}

// pax extended header records: "<len> <key>=<value>\n"
export function parsePax(buf) {
  const out = {}
  let off = 0
  while (off < buf.length) {
    const sp = buf.indexOf(0x20, off)
    if (sp < 0) break
    const len = parseInt(buf.subarray(off, sp).toString('utf8'), 10)
    if (!(len > 0)) break
    const rec = buf.subarray(sp + 1, off + len - 1).toString('utf8')
    const eq = rec.indexOf('=')
    if (eq > 0) out[rec.slice(0, eq)] = rec.slice(eq + 1)
    off += len
  }
  return out
}

// ustar/pax/GNU tar reader: { files: Map(path -> Buffer), others: [{ path, type }] }; paths lose the first element
// ("package/"); a name that is absolute or contains ".." throws
export function readTar(buf) {
  const files = new Map()
  const others = []
  let off = 0
  let longName = null
  let paxPath = null
  while (off + 512 <= buf.length) {
    const h = buf.subarray(off, off + 512)
    if (h.every((b) => b === 0)) break
    // header checksum: the sum of all bytes with the checksum field read as spaces
    let sum = 0
    for (let i = 0; i < 512; i += 1) sum += i >= 148 && i < 156 ? 32 : h[i]
    const stored = parseInt(cstr(h.subarray(148, 156)).trim() || '-1', 8)
    if (sum !== stored)
      throw new Error(`tar header checksum mismatch at ${off}`)
    const size = parseInt(cstr(h.subarray(124, 136)).trim() || '0', 8)
    const type = h[156] ? String.fromCharCode(h[156]) : '0'
    const prefix = cstr(h.subarray(345, 500))
    const name0 = cstr(h.subarray(0, 100))
    const data = buf.subarray(off + 512, off + 512 + size)
    off += 512 + Math.ceil(size / 512) * 512
    if (type === 'x') {
      paxPath = parsePax(data).path || paxPath
    } else if (type === 'L') {
      longName = cstr(data)
    } else if (type !== 'g') {
      const raw = longName || paxPath || (prefix ? `${prefix}/${name0}` : name0)
      longName = null
      paxPath = null
      const parts = raw.split('/').filter((s) => s !== '' && s !== '.')
      if (raw.startsWith('/') || parts.includes('..'))
        throw new Error(`unsafe tar entry name: ${raw}`)
      const rel = parts.slice(1).join('/')
      if (type === '0' || type === '7') files.set(rel, Buffer.from(data))
      else if (type !== '5') others.push({ path: rel, type })
    }
  }
  return { files, others }
}

// CHANGES.md (60 §2): `File | Change | CS/Q | PR | Test`, one row per edit; the file is the first cell
export function parseChanges(text) {
  const files = []
  for (const line of text.split('\n')) {
    if (!line.trim().startsWith('|')) continue
    const first = line.trim().replace(/^\|/, '').split('|')[0].trim()
    const f = first.replace(/^`+|`+$/g, '').trim()
    if (!f || /^-+:?$/.test(f) || /^:?-+:?$/.test(f) || /^file$/i.test(f))
      continue
    files.push(f.replace(/^\.\//, ''))
  }
  return [...new Set(files)].sort()
}

// ---------- the copy ----------

function readTree(dir) {
  const files = new Map()
  const symlinks = []
  const walk = (d, rel) => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const abs = path.join(d, e.name)
      const r = rel ? `${rel}/${e.name}` : e.name
      if (e.isSymbolicLink()) symlinks.push(r)
      else if (e.isDirectory()) walk(abs, r)
      else if (e.isFile()) files.set(r, fs.readFileSync(abs))
      else symlinks.push(r)
    }
  }
  walk(dir, '')
  return { files, symlinks }
}

// ---------- the tarball ----------

const npm = (args, cwd) =>
  spawnSync('npm', args, { cwd, encoding: 'utf8', maxBuffer: 1 << 26 })

// npm's cache directory: the environment wins (`npm config get cache` refuses to print a cache set that way)
function cacheDir() {
  const env = process.env.npm_config_cache || process.env.NPM_CONFIG_CACHE
  if (env) return env
  const r = npm(['config', 'get', 'cache'], REPO)
  const dir = (r.stdout || '').trim().split('\n').pop()
  return r.status === 0 && dir ? dir : path.join(os.homedir(), '.npm')
}

function cacheEntry(integrity) {
  const m = /^sha512-(.+)$/.exec(integrity || '')
  if (!m) return null
  const hex = Buffer.from(m[1], 'base64').toString('hex')
  const file = path.join(
    cacheDir(),
    '_cacache',
    'content-v2',
    'sha512',
    hex.slice(0, 2),
    hex.slice(2, 4),
    hex.slice(4)
  )
  return fs.existsSync(file) ? file : null
}

// -> { file, source } or throws (exit 2)
function obtainTarball({ version, integrity, dir }) {
  const spec = `${NAME}@${version}`
  const r = npm(
    [
      'pack',
      spec,
      '--offline',
      '--ignore-scripts',
      '--json',
      '--pack-destination',
      dir,
    ],
    dir
  )
  if (r.status === 0) {
    let name = null
    try {
      name = JSON.parse(r.stdout)[0].filename
    } catch {
      name = fs.readdirSync(dir).find((f) => f.endsWith('.tgz'))
    }
    if (name && fs.existsSync(path.join(dir, name)))
      return {
        file: path.join(dir, name),
        source: `npm pack ${spec} --offline`,
      }
  }
  const cached = cacheEntry(integrity)
  if (cached)
    return { file: cached, source: 'npm cache entry of the lock integrity' }
  const why = String(r.stderr || '')
    .split('\n')
    .filter((l) => /code|ENOTCACHED|cache/i.test(l))
    .slice(0, 3)
    .join(' ')
    .replace(/https?:\/\/\S+/g, '<url>')
  const e = new Error(
    `no cached tarball for ${spec} (offline, nothing is downloaded; run an npm install that fetches it first): ${why}`
  )
  e.exitCode = 2
  throw e
}

// ---------- the check ----------

export function compare(tarFiles, copyFiles) {
  const differ = []
  const onlyTarball = []
  const onlyInstalled = []
  for (const [f, buf] of tarFiles) {
    if (!copyFiles.has(f)) onlyTarball.push(f)
    else if (!buf.equals(copyFiles.get(f))) differ.push(f)
  }
  for (const f of copyFiles.keys()) if (!tarFiles.has(f)) onlyInstalled.push(f)
  return {
    differ: differ.sort(),
    onlyTarball: onlyTarball.sort(),
    onlyInstalled: onlyInstalled.sort(),
  }
}

export function verdict(diff, expected) {
  const actual = new Set([
    ...diff.differ,
    ...diff.onlyTarball,
    ...diff.onlyInstalled,
  ])
  const unexpected = [...actual]
    .filter((f) => !expected.allowed.includes(f))
    .sort()
  // a CHANGES row for a file that is identical to the tarball is a stale row
  const stale = expected.changes.filter((f) => !actual.has(f)).sort()
  return { unexpected, stale }
}

export function verify(opts) {
  const root = path.resolve(opts.root || REPO)
  const lockFile = path.join(root, 'package-lock.json')
  const lock = JSON.parse(fs.readFileSync(lockFile, 'utf8')).packages[
    `node_modules/${NAME}`
  ]
  if (!lock)
    throw Object.assign(new Error(`${NAME} is not in ${lockFile}`), {
      exitCode: 2,
    })
  const version = opts.version || lock.version
  const target = path.resolve(
    root,
    opts.target || path.join('node_modules', NAME)
  )
  const installedCopy = target.split(path.sep).includes('node_modules')

  let st
  try {
    st = fs.lstatSync(target)
  } catch {
    throw Object.assign(new Error(`${target} does not exist`), { exitCode: 2 })
  }
  const copy = st.isSymbolicLink()
    ? { files: new Map(), symlinks: ['.'] }
    : readTree(target)

  let tmp = null
  let tarball
  if (opts.tarball)
    tarball = { file: path.resolve(opts.tarball), source: '--tarball' }
  else {
    const dir = opts.tarballDir
      ? path.resolve(opts.tarballDir)
      : (tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'design-pack-')))
    fs.mkdirSync(dir, { recursive: true })
    tarball = obtainTarball({ version, integrity: lock.integrity, dir })
    // a kept directory always holds the tarball, whichever way it was found
    if (opts.tarballDir && path.dirname(tarball.file) !== dir) {
      const kept = path.join(dir, `oacore-design-${version}.tgz`)
      // not copyFile: the cache entry is read-only and the copy would keep that mode
      fs.writeFileSync(kept, fs.readFileSync(tarball.file))
      tarball.file = kept
    }
  }
  try {
    const bytes = fs.readFileSync(tarball.file)
    const integrity = `sha512-${sha('sha512', bytes, 'base64')}`
    const sha1 = sha('sha1', bytes)
    const bad = []
    if (version === lock.version && integrity !== lock.integrity)
      bad.push('sha512 integrity differs from package-lock.json')
    if (version === '5.0.74' && sha1 !== SHA1_5_0_74)
      bad.push('sha1 differs from 60 §1')
    if (bad.length)
      throw Object.assign(
        new Error(`tarball ${tarball.source}: ${bad.join('; ')}`),
        { exitCode: 2 }
      )
    const tar = readTar(zlib.gunzipSync(bytes))
    if (tar.others.length)
      throw Object.assign(
        new Error(
          `tarball has non-file entries: ${tar.others
            .map((o) => o.path)
            .join(', ')}`
        ),
        { exitCode: 2 }
      )

    const changesFile = opts.changes
      ? path.resolve(opts.changes)
      : fs.existsSync(path.join(root, 'vendor', 'CHANGES.md'))
      ? path.join(root, 'vendor', 'CHANGES.md')
      : null
    const changes = changesFile
      ? parseChanges(fs.readFileSync(changesFile, 'utf8'))
      : []
    const allowed = [...changes, ...(installedCopy ? INSTALL_GENERATED : [])]
    const diff = compare(tar.files, copy.files)
    const { unexpected, stale } = verdict(diff, { allowed, changes })
    const problems = []
    if (copy.symlinks.length)
      problems.push(`symlink in the copy (R-075): ${copy.symlinks.join(', ')}`)
    if (unexpected.length)
      problems.push(`not allowed to differ: ${unexpected.join(', ')}`)
    if (stale.length)
      problems.push(`CHANGES.md rows without a difference: ${stale.join(', ')}`)
    return {
      schema: 1,
      target: path.relative(root, target) || '.',
      installedCopy,
      lock: { version: lock.version, integrity: lock.integrity },
      tarball: {
        spec: `${NAME}@${version}`,
        source: tarball.source,
        bytes: bytes.length,
        sha1,
        integrity,
        files: tar.files.size,
      },
      installed: { files: copy.files.size, symlinks: copy.symlinks },
      changes: {
        file: changesFile ? path.relative(root, changesFile) : null,
        files: changes,
      },
      allowed,
      diff,
      problems,
      ok: problems.length === 0,
    }
  } finally {
    if (tmp) fs.rmSync(tmp, { recursive: true, force: true })
  }
}

// ---------- self-test ----------

function tarEntry(name, body, type = '0') {
  const data = Buffer.from(body)
  const h = Buffer.alloc(512)
  h.write(name.slice(0, 100), 0)
  h.write('0000644\0', 100)
  h.write(`${data.length.toString(8).padStart(11, '0')}\0`, 124)
  h.write(type, 156)
  h.write('ustar\0', 257)
  let sum = 0
  for (let i = 0; i < 512; i += 1) sum += i >= 148 && i < 156 ? 32 : h[i]
  h.write(`${sum.toString(8).padStart(6, '0')}\0 `, 148)
  const pad = Buffer.alloc(Math.ceil(data.length / 512) * 512 - data.length)
  return Buffer.concat([h, data, pad])
}

function selfTest() {
  const results = []
  const ok = (name, cond) => results.push([name, !!cond])
  const tar = Buffer.concat([
    tarEntry('package/', '', '5'),
    tarEntry('package/a.js', 'one'),
    tarEntry('package/lib/b.css', 'two'),
    Buffer.alloc(1024),
  ])
  let r
  try {
    r = readTar(tar)
  } catch (e) {
    r = null
  }
  ok(
    'readTar reads files, drops the first element',
    r && [...r.files.keys()].join() === 'a.js,lib/b.css'
  )
  ok('readTar content', r && r.files.get('a.js').toString() === 'one')
  ok(
    'readTar rejects ..',
    (() => {
      try {
        readTar(
          Buffer.concat([tarEntry('package/../x', 'z'), Buffer.alloc(1024)])
        )
        return false
      } catch (e) {
        return /unsafe/.test(e.message)
      }
    })()
  )
  ok(
    'readTar rejects a corrupt header',
    (() => {
      const b = Buffer.from(tarEntry('package/a.js', 'one'))
      b[0] ^= 1
      try {
        readTar(Buffer.concat([b, Buffer.alloc(1024)]))
        return false
      } catch (e) {
        return /checksum/.test(e.message)
      }
    })()
  )
  ok(
    'readTar reports links',
    (() => {
      const x = readTar(
        Buffer.concat([tarEntry('package/l', '', '2'), Buffer.alloc(1024)])
      )
      return x.others.length === 1 && x.others[0].path === 'l'
    })()
  )
  const paxRecord = (key, value) => {
    const body = ` ${key}=${value}\n`
    let len = body.length + 1
    while (String(len).length + body.length !== len)
      len = String(len).length + body.length
    return `${len}${body}`
  }
  const pax = paxRecord('path', 'package/long/name.js')
  ok('parsePax', parsePax(Buffer.from(pax)).path === 'package/long/name.js')
  ok(
    'readTar uses the pax path',
    (() => {
      const x = readTar(
        Buffer.concat([
          tarEntry('package/PaxHeader', pax, 'x'),
          tarEntry('package/short', 'body'),
          Buffer.alloc(1024),
        ])
      )
      return [...x.files.keys()].join() === 'long/name.js'
    })()
  )
  ok(
    'parseChanges',
    parseChanges(
      '| File | Change | CS/Q | PR | Test |\n|---|---|---|---|---|\n| `lib/a.js` | x | CS-1 | #1 | T-1 |\n| ./lib/b.css | y | | | |\ntext\n'
    ).join() === 'lib/a.js,lib/b.css'
  )
  ok(
    'parseChanges empty table',
    parseChanges('| File | Change |\n| --- | --- |\n').length === 0
  )
  const a = new Map([
    ['x', Buffer.from('1')],
    ['y', Buffer.from('2')],
    ['z', Buffer.from('3')],
  ])
  const b = new Map([
    ['x', Buffer.from('1')],
    ['y', Buffer.from('9')],
    ['w', Buffer.from('4')],
  ])
  const d = compare(a, b)
  ok(
    'compare',
    JSON.stringify(d) ===
      JSON.stringify({
        differ: ['y'],
        onlyTarball: ['z'],
        onlyInstalled: ['w'],
      })
  )
  ok(
    'verdict unexpected',
    JSON.stringify(verdict(d, { allowed: ['y'], changes: [] }).unexpected) ===
      JSON.stringify(['w', 'z'])
  )
  ok(
    'verdict stale',
    JSON.stringify(
      verdict(d, { allowed: ['y', 'x'], changes: ['x'] }).stale
    ) === JSON.stringify(['x'])
  )
  let failed = 0
  for (const [name, pass] of results) {
    process.stdout.write(`${pass ? 'ok  ' : 'FAIL'} ${name}\n`)
    if (!pass) failed += 1
  }
  process.stdout.write(
    `self-test: ${results.length - failed}/${results.length}\n`
  )
  return failed ? 1 : 0
}

// ---------- main ----------

function printText(r) {
  const line = (s) => process.stdout.write(`${s}\n`)
  line(
    `verify-design-verbatim: ${r.target} vs ${r.tarball.spec} (${r.tarball.source})`
  )
  line(
    `  tarball ${r.tarball.files} files, sha1 ${
      r.tarball.sha1
    }, ${r.tarball.integrity.slice(0, 18)}...`
  )
  line(
    `  copy ${r.installed.files} files${
      r.installedCopy ? ' (installed copy)' : ''
    }`
  )
  line(
    `  differ: ${r.diff.differ.join(', ') || '-'}; only in tarball: ${
      r.diff.onlyTarball.join(', ') || '-'
    }; only in copy: ${r.diff.onlyInstalled.join(', ') || '-'}`
  )
  line(`  allowed: ${r.allowed.join(', ') || '-'}`)
  for (const p of r.problems) line(`  FAIL ${p}`)
  line(r.ok ? 'verbatim: OK' : 'verbatim: DIFFERENT')
}

function main(args) {
  const has = (n) => args.includes(n)
  const opt = (n) => {
    const i = args.indexOf(n)
    return i >= 0 ? args[i + 1] : undefined
  }
  if (has('--self-test')) return selfTest()
  try {
    const report = verify({
      root: opt('--root'),
      target: opt('--target'),
      version: opt('--version'),
      changes: opt('--changes'),
      tarball: opt('--tarball'),
      tarballDir: opt('--tarball-dir'),
    })
    if (has('--json'))
      process.stdout.write(`${JSON.stringify(report, null, 1)}\n`)
    else printText(report)
    return report.ok ? 0 : 1
  } catch (e) {
    process.stderr.write(`verify-design-verbatim: ${e.message}\n`)
    return e.exitCode || 2
  }
}

const isMain =
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
if (isMain) process.exitCode = main(process.argv.slice(2))
