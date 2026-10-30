#!/usr/bin/env node
// baseline-tools.mjs - the file and record helpers of scripts/baseline-capture.sh (42 §4, §6, §7, §9).
// Node built-ins only (plus the repo's own harness modules). Never reads a credential value.
//
//   paths                                  the capture set: what record mode of T-6xx, T-7xx, T-8xx writes
//                                          (Playwright snapshot folders next to the specs, the T-603 contract
//                                          and the T-607 wire baseline), one repo-relative path per line
//   clear                                  delete the capture set from the working tree, so that the next
//                                          record run writes every file anew (Playwright's --update-snapshots
//                                          rewrites only files that differ)
//   collect --to <dir>                     copy the capture set into <dir> (repo-relative paths kept)
//   diff --out <dir> [--n 3]               file-level report of c1 vs c2..cN (diff -r is run by the shell);
//                                          writes <dir>/capture-diff.json, exit 1 on any difference
//   digest --build <dir>                   content digests of a parity build: .next static + server + manifests
//                                          (buildId normalised) and public/
//   golden --ref <ref> --out <file> [--tag <name>] [--link <id>] [--accept <file>]...
//                                          golden.json: G, its tree, the builds of every variant (key, buildId,
//                                          Node, date, digests, sizes) and the acceptance results
//   npm-ls --build <dir> --base <file> [--out <file>]
//                                          T-013 on the build: its installed `npm ls --omit=dev --all --json`
//                                          (runtime Node) equals the <base> record (build directory and npm's
//                                          `overridden` annotation normalised); exit 1 on a difference
//   token-scan --build <dir> [--out <file>]
//                                          no registry credential in the build tree (no .npmrc, no auth line, no
//                                          token-shaped string in .next, public or the top level): the local
//                                          stand-in for the image's `docker history` check; prints counts only
//   extract --build <dir> --to <dir>       test/baseline/build/: the INPUTS of test/static/adapters/index.js,
//                                          `.next/` stored as `next/` (a git-ignored name), `public/`; refuses a
//                                          file that carries an absolute path of this machine
//   env --build <dir> --out <file> [--run <id>] [--rss-idle-kb N] [--rss-after-kb N] [--npm-ls-out <file>]
//                                          test/baseline/env.json (42 §6 item 3)
//   manifest --link <id> [--kind golden] [--reference <text>] [--provisional <text>]
//                                          test/baseline/manifest.json ({link, fixtures, baselines, corpus}
//                                          SHA-256 sets) and test/baseline/SHA256SUMS (`sha256sum -c` from the
//                                          repository root); --reference is the JSON text of the `reference`
//                                          block ({G, tag, builds}); without it the manifest keeps its current
//                                          block (with no manifest yet: the one golden.json gives)
//   rss --run <id>                         RSS (KiB) of the app process of a running stack
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import crypto from 'node:crypto'
import { createRequire } from 'node:module'
import { execFileSync, spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

import { formatJsonSync } from './prettier-sync.mjs'

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const ARTIFACT_DIR = path.resolve(
  process.env.ARTIFACT_DIR || path.join(REPO, '..', 'search-upgrade-artifacts')
)
const require = createRequire(path.join(REPO, 'package.json'))

const sha256 = (buf) => crypto.createHash('sha256').update(buf).digest('hex')
const readJson = (f, d) => {
  try {
    return JSON.parse(fs.readFileSync(f, 'utf8'))
  } catch (e) {
    if (d !== undefined) return d
    throw e
  }
}
const writeJson = (f, obj) => {
  fs.mkdirSync(path.dirname(f), { recursive: true })
  fs.writeFileSync(f, `${JSON.stringify(obj, null, 1)}\n`)
}
// committed JSON goes through the repo's prettier config (npm run lint:json stays clean)
const writeJsonPretty = (f, obj) => {
  fs.mkdirSync(path.dirname(f), { recursive: true })
  fs.writeFileSync(f, formatJsonSync(obj, f))
}
const byCodePoint = (a, b) => (a < b ? -1 : Number(a > b))
const walk = (dir, base = dir, skip = () => false) =>
  fs.existsSync(dir)
    ? fs
        .readdirSync(dir, { withFileTypes: true })
        .flatMap((e) => {
          const p = path.join(dir, e.name)
          const rel = path.relative(base, p).split(path.sep).join('/')
          if (skip(rel, e)) return []
          if (e.isDirectory()) return walk(p, base, skip)
          return e.isFile() ? [rel] : []
        })
        .sort(byCodePoint)
    : []
const git = (...a) =>
  execFileSync('git', ['-C', REPO, ...a], {
    encoding: 'utf8',
    maxBuffer: 1 << 28,
  }).trim()

const argv = process.argv.slice(2)
const cmd = argv[0]
const opt = (n, d) => {
  const i = argv.indexOf(n)
  return i >= 0 ? argv[i + 1] : d
}
const optList = (n) => argv.flatMap((a, i) => (a === n ? [argv[i + 1]] : []))

// ---------- the capture set ----------
// record mode (npm run e2e:record) writes: every Playwright snapshot folder next to a spec under
// e2e/{http,journeys,a11y,visual}, the T-603 contract and the T-607 wire baseline. The hand-made pins
// (e2e/journeys/t728-pinned-tuples.json, e2e/lib/P0-12/t741-console-pins.json) are no record-mode output.
export const CAPTURE_FILES = [
  'e2e/http/contract.baseline.json',
  'e2e/lib/P0-11/t607-wire.baseline.json',
]
const CAPTURE_TIERS = ['http', 'journeys', 'a11y', 'visual']
export function captureDirs(root = REPO) {
  const out = []
  for (const tier of CAPTURE_TIERS) {
    const dir = path.join(root, 'e2e', tier)
    if (!fs.existsSync(dir)) continue
    const rec = (d) => {
      for (const e of fs.readdirSync(d, { withFileTypes: true })) {
        if (!e.isDirectory() || e.name === 'node_modules') continue
        const p = path.join(d, e.name)
        if (e.name.endsWith('.spec.mjs-snapshots'))
          out.push(path.relative(root, p).split(path.sep).join('/'))
        else rec(p)
      }
    }
    rec(dir)
  }
  return out.sort(byCodePoint)
}
export const capturePaths = (root = REPO) => [
  ...captureDirs(root),
  ...CAPTURE_FILES.filter((f) => fs.existsSync(path.join(root, f))),
]
// every file of the capture set (repo-relative)
export function captureFiles(root = REPO) {
  const files = []
  for (const d of captureDirs(root))
    for (const f of walk(path.join(root, d))) files.push(`${d}/${f}`)
  for (const f of CAPTURE_FILES)
    if (fs.existsSync(path.join(root, f))) files.push(f)
  return files.sort(byCodePoint)
}

function clear() {
  const removed = []
  for (const p of capturePaths()) {
    fs.rmSync(path.join(REPO, p), { recursive: true, force: true })
    removed.push(p)
  }
  console.log(`cleared ${removed.length} capture paths`)
}

function collect() {
  const to = path.resolve(opt('--to'))
  fs.rmSync(to, { recursive: true, force: true })
  const files = captureFiles()
  for (const f of files) {
    const dst = path.join(to, f)
    fs.mkdirSync(path.dirname(dst), { recursive: true })
    fs.copyFileSync(path.join(REPO, f), dst)
  }
  const list = files.map((f) => ({
    path: f,
    sha256: sha256(fs.readFileSync(path.join(REPO, f))),
  }))
  writeJson(path.join(to, '..', `${path.basename(to)}.files.json`), list)
  console.log(`collected ${files.length} files into ${to}`)
}

function diffCaptures() {
  const out = path.resolve(opt('--out'))
  const n = Number(opt('--n', 3))
  const set = (dir) =>
    new Map(
      walk(dir).map((f) => [f, sha256(fs.readFileSync(path.join(dir, f)))])
    )
  const c1 = set(path.join(out, 'c1'))
  const report = { at: new Date().toISOString(), files: c1.size, pairs: [] }
  for (let i = 2; i <= n; i++) {
    const ci = set(path.join(out, `c${i}`))
    const onlyA = [...c1.keys()].filter((f) => !ci.has(f))
    const onlyB = [...ci.keys()].filter((f) => !c1.has(f))
    const differ = [...c1.keys()].filter(
      (f) => ci.has(f) && ci.get(f) !== c1.get(f)
    )
    report.pairs.push({
      a: 'c1',
      b: `c${i}`,
      filesB: ci.size,
      onlyA,
      onlyB,
      differ,
      identical: !onlyA.length && !onlyB.length && !differ.length,
    })
  }
  report.identical = report.pairs.every((p) => p.identical)
  writeJson(path.join(out, 'capture-diff.json'), report)
  for (const p of report.pairs)
    console.log(
      `${p.a} vs ${p.b}: ${p.identical ? 'identical' : 'DIFFERENT'} (${
        report.files
      } files; ${p.differ.length} differ, ${p.onlyA.length} only in ${p.a}, ${
        p.onlyB.length
      } only in ${p.b})`
    )
  process.exit(report.identical ? 0 : 1)
}

// ---------- build digests ----------
export function buildDigest(dir) {
  const next = path.join(dir, '.next')
  const id = fs.readFileSync(path.join(next, 'BUILD_ID'), 'utf8').trim()
  const norm = (s) => s.split(id).join('<BUILD_ID>')
  const stable = []
  const raw = []
  const files = walk(next, next, (rel) => rel === 'cache' || rel === 'trace')
  for (const rel of files) {
    const buf = fs.readFileSync(path.join(next, rel))
    raw.push(`${rel}\0${sha256(buf)}`)
    // static/ and server/ with the buildId normalised: what T-014 (a) compares (scripts/next-diff.mjs), so two
    // builds of one tree share it; the top-level manifests carry per-build values (prerender preview keys)
    if (!/^(static|server)\//.test(rel)) continue
    const s = buf.toString('latin1')
    const nb = s.includes(id) ? Buffer.from(norm(s), 'latin1') : buf
    stable.push(`${norm(rel)}\0${sha256(nb)}`)
  }
  const pub = walk(path.join(dir, 'public')).map(
    (rel) => `${rel}\0${sha256(fs.readFileSync(path.join(dir, 'public', rel)))}`
  )
  return {
    buildId: id,
    nextFiles: files.length,
    next: sha256(stable.sort(byCodePoint).join('\n')),
    nextRaw: sha256(raw.sort(byCodePoint).join('\n')),
    publicFiles: pub.length,
    public: sha256(pub.join('\n')),
    method:
      'sha256 over sorted "<path>\\0<sha256>" lines; next = .next/static + .next/server with the buildId replaced in paths and contents (stable across builds of one tree, T-014 (a)); nextRaw = every .next file except cache/ and trace, raw bytes (this build only)',
  }
}

const duKiB = (p) => {
  if (!fs.existsSync(p)) return 0
  const r = spawnSync('du', ['-sk', p], { encoding: 'utf8' })
  return Number((r.stdout || '0').split(/\s/)[0])
}
export function buildSizes(dir) {
  return {
    unit: 'KiB (du -sk)',
    next:
      duKiB(path.join(dir, '.next')) - duKiB(path.join(dir, '.next', 'cache')),
    nodeModules: duKiB(path.join(dir, 'node_modules')),
    public: duKiB(path.join(dir, 'public')),
    total: duKiB(dir) - duKiB(path.join(dir, '.next', 'cache')),
  }
}

// ---------- golden.json ----------
async function golden() {
  const ref = opt('--ref', 'p2-local/golden')
  const out = path.resolve(opt('--out', path.join(ARTIFACT_DIR, 'golden.json')))
  const { runtimeKey, readImages } = await import('./build-parity.mjs')
  const commit = git('rev-parse', `${ref}^{commit}`)
  const builds = {}
  for (const variant of (
    opt('--variants', 'default,nodsn,harness') || ''
  ).split(',')) {
    const k = runtimeKey(ref, variant, 'host', 'ci')
    const b = readImages().builds[k.key]
    if (!b || !fs.existsSync(path.join(b.dir, '.next', 'BUILD_ID'))) {
      builds[variant] = { key: k.key, missing: true }
      continue
    }
    builds[variant] = {
      key: b.key,
      commit: b.commit,
      runtimeTree: b.runtimeTree,
      snapshot: b.snapshot,
      buildId: b.buildId,
      node: b.node,
      install: b.install,
      builtAt: b.builtAt,
      durationS: b.durationS,
      buildEnv: b.buildEnv,
      digest: buildDigest(b.dir),
      sizes: buildSizes(b.dir),
      dir: path.relative(ARTIFACT_DIR, b.dir),
    }
  }
  const prev = readJson(out, {})
  const accept = { ...(prev.acceptance || {}) }
  for (const f of optList('--accept')) Object.assign(accept, readJson(f))
  const rec = {
    schema: 1,
    link: opt('--link', prev.link || 'B0-local'),
    tag: opt('--tag', ref),
    G: commit,
    tree: git('rev-parse', `${commit}^{tree}`),
    subject: git('log', '-1', '--format=%s', commit),
    mode: 'host',
    evidence: false,
    note: 'local mode (owner notes §1: no Docker): host parity builds of G with their own npm ci on Node 18.20.8 stand in for the golden image; the image digest, docker history and registry steps are DEFERRED (I-06, I-23)',
    machine: `${os.platform()} ${os.arch()} ${os.release()}`,
    recordedAt: new Date().toISOString(),
    builds,
    acceptance: accept,
  }
  writeJson(out, rec)
  console.log(
    `golden.json: G ${commit.slice(0, 7)}; ${Object.entries(builds)
      .map(([v, b]) => `${v} ${b.missing ? 'MISSING' : b.key}`)
      .join(', ')} -> ${out}`
  )
}

// ---------- T-013 on the build ----------
const node18bin = async () => (await import('./build-parity.mjs')).node18()
function normaliseNpmLs(obj, dir) {
  // any parity build directory (records made elsewhere may carry a redacted path)
  const re = /\/[^\s"]*?\/builds\/[^/\s"]+/g
  const text = JSON.stringify(obj, (k, v) =>
    k === 'overridden' ? undefined : v
  )
    .split(dir)
    .join('<BUILD>')
    .replace(re, '<BUILD>')
  return JSON.parse(text)
}
function deepDiff(a, b, at = '$', out = []) {
  if (out.length > 50) return out
  if (typeof a !== typeof b || Array.isArray(a) !== Array.isArray(b)) {
    out.push({ at, a, b })
    return out
  }
  if (a && typeof a === 'object') {
    const keys = new Set([...Object.keys(a), ...Object.keys(b)])
    for (const k of keys) {
      if (!(k in a)) out.push({ at: `${at}.${k}`, a: '<absent>', b: b[k] })
      else if (!(k in b)) out.push({ at: `${at}.${k}`, a: a[k], b: '<absent>' })
      else deepDiff(a[k], b[k], `${at}.${k}`, out)
    }
    return out
  }
  if (a !== b) out.push({ at, a, b })
  return out
}
async function npmLs() {
  const dir = path.resolve(opt('--build'))
  const base = path.resolve(opt('--base'))
  const bin = await node18bin()
  const r = spawnSync('npm', ['ls', '--omit=dev', '--all', '--json'], {
    cwd: dir,
    encoding: 'utf8',
    maxBuffer: 1 << 28,
    env: {
      PATH: `${path.dirname(bin)}:${process.env.PATH}`,
      HOME: process.env.HOME,
    },
  })
  const got = normaliseNpmLs(JSON.parse(r.stdout), dir)
  const baseRec = readJson(base)
  const want = normaliseNpmLs(baseRec, '<none>')
  const diffs = deepDiff(want, got)
  const res = {
    check:
      'T-013 on the golden build: installed npm ls --omit=dev --all --json = the <base> record',
    build: path.relative(ARTIFACT_DIR, dir),
    base: path.relative(ARTIFACT_DIR, base),
    node: execFileSync(bin, ['-v'], { encoding: 'utf8' }).trim(),
    npmExit: r.status,
    normalised:
      'build directory path -> <BUILD>; npm `overridden` annotation removed (I-22)',
    identical: diffs.length === 0,
    diffs,
    sha256: sha256(JSON.stringify(got)),
  }
  if (opt('--out')) writeJson(path.resolve(opt('--out')), res)
  console.log(
    `npm ls --omit=dev --all: ${
      res.identical ? 'identical' : `${diffs.length} differences`
    } to the <base> record`
  )
  process.exit(res.identical ? 0 : 1)
}

// ---------- credential scan (stand-in for docker history) ----------
function tokenScan() {
  const dir = path.resolve(opt('--build'))
  const patterns = [
    // an auth line with a value; the tracked template (.npmrc.dist `{GITHUB_TOKEN}`) and the Dockerfile's
    // `printf ... %s` (CS-W0-8) carry placeholders, never a credential
    [
      'auth-line',
      /:_auth(?:Token)?\s*=\s*(?!\{GITHUB_TOKEN\}|%s|\$\{|\$\()[^\s'"\\]+/,
    ],
    [
      'github-token',
      /\bgh[pousr]_[A-Za-z0-9]{36}\b|\bgithub_pat_[A-Za-z0-9_]{60,}/,
    ],
    ['npm-token', /\bnpm_[A-Za-z0-9]{36}\b/],
  ]
  const npmrc = walk(
    dir,
    dir,
    (rel) => rel === 'node_modules' || rel === '.next/cache'
  ).filter((f) => path.basename(f) === '.npmrc')
  const scanned = [
    ...walk(path.join(dir, '.next'), dir, (rel) => rel === '.next/cache'),
    ...walk(path.join(dir, 'public')).map((f) => `public/${f}`),
    ...fs
      .readdirSync(dir, { withFileTypes: true })
      .filter((e) => e.isFile())
      .map((e) => e.name),
  ]
  const hits = Object.fromEntries(patterns.map(([n]) => [n, 0]))
  for (const f of scanned) {
    const s = fs.readFileSync(path.join(dir, f), 'latin1')
    for (const [n, re] of patterns) if (re.test(s)) hits[n]++
  }
  const res = {
    check:
      'no registry credential in the build tree (local stand-in for `docker history`, 42 §4)',
    build: path.relative(ARTIFACT_DIR, dir),
    files: scanned.length,
    npmrcFiles: npmrc.length,
    hits,
    clean: npmrc.length === 0 && Object.values(hits).every((v) => v === 0),
  }
  if (opt('--out')) writeJson(path.resolve(opt('--out')), res)
  console.log(
    `token scan: ${res.files} files, .npmrc ${
      res.npmrcFiles
    }, hits ${JSON.stringify(hits)} -> ${res.clean ? 'clean' : 'NOT CLEAN'}`
  )
  process.exit(res.clean ? 0 : 1)
}

// ---------- test/baseline/build/ ----------
const globRe = (g) =>
  new RegExp(
    `^${g
      .replace(/[.+^${}()|[\]\\]/g, '\\$&')
      .replace(/\*\*\//g, '\u0001')
      .replace(/\*\*/g, '\u0002')
      .replace(/\*/g, '[^/]*')
      .replace(/\u0001/g, '(?:.*/)?')
      .replace(/\u0002/g, '.*')}$`
  )
function extract() {
  const dir = path.resolve(opt('--build'))
  const to = path.resolve(
    opt('--to', path.join(REPO, 'test', 'baseline', 'build'))
  )
  const { INPUTS } = require('./test/static/adapters/index.js')
  const res = INPUTS.map(globRe)
  const candidates = [
    ...walk(path.join(dir, '.next'), dir, (rel) => rel === '.next/cache'),
    ...walk(path.join(dir, 'public')).map((f) => `public/${f}`),
  ]
  const picked = candidates.filter((f) => res.some((re) => re.test(f)))
  // the absolute paths of this machine a build could carry: the repo, the artefact directory, the home and
  // temp directories and their real paths (macOS links /tmp and /var into /private)
  const local = [
    ...new Set(
      [REPO, ARTIFACT_DIR, os.homedir(), os.tmpdir()].flatMap((p) => {
        try {
          return [p, fs.realpathSync(p)]
        } catch {
          return [p]
        }
      })
    ),
  ]
  const leaks = []
  fs.rmSync(to, { recursive: true, force: true })
  for (const f of picked) {
    const buf = fs.readFileSync(path.join(dir, f))
    const s = buf.toString('latin1')
    if (local.some((p) => s.includes(p))) leaks.push(f)
    const dst = path.join(to, f.replace(/^\.next\//, 'next/'))
    fs.mkdirSync(path.dirname(dst), { recursive: true })
    fs.writeFileSync(dst, buf)
  }
  if (leaks.length) {
    fs.rmSync(to, { recursive: true, force: true })
    console.error(
      `extract: ${
        leaks.length
      } files carry an absolute path of this machine (first: ${leaks
        .slice(0, 5)
        .join(', ')}); nothing written`
    )
    process.exit(1)
  }
  // provenance of the reference (test/static/adapters/reference.js reads build.json of an APP_ROOT): the
  // build record without its local directory
  const rec = readJson(path.join(dir, 'build.json'), null)
  if (rec)
    writeJsonPretty(path.join(to, 'build.json'), {
      link: opt('--link', 'B0-local'),
      commit: rec.commit,
      key: rec.key,
      variant: rec.variant,
      mode: rec.mode || 'host',
      install: rec.install,
      node: rec.node,
      buildId: rec.buildId,
      builtAt: rec.builtAt,
      inputs:
        'the INPUTS of test/static/adapters/index.js; .next stored as next/ (git-ignored name)',
    })
  const kib = duKiB(to)
  writeJson(path.join(ARTIFACT_DIR, 'golden', 'extract.json'), {
    from: path.relative(ARTIFACT_DIR, dir),
    to: path.relative(REPO, to),
    files: picked.length,
    kib,
    inputs: INPUTS,
  })
  console.log(
    `extract: ${picked.length} files (${kib} KiB) -> ${path.relative(REPO, to)}`
  )
}

// ---------- env.json ----------
const run = (bin, args, o = {}) => {
  const r = spawnSync(bin, args, { encoding: 'utf8', maxBuffer: 1 << 28, ...o })
  return r.status === 0 ? r.stdout.trim() : null
}
// the design font stacks (node_modules/@oacore/design/lib/foundation/type.css --font-family-base and
// --font-family-monospace), resolved by the capture host's fontconfig
const FONT_FAMILIES = [
  'roboto',
  '-apple-system',
  'blinkmacsystemfont',
  'Segoe UI',
  'Helvetica Neue',
  'arial',
  'Noto Sans',
  'sans-serif',
  'Apple Color Emoji',
  'Segoe UI Emoji',
  'Segoe UI Symbol',
  'Noto Color Emoji',
  'sfmono-regular',
  'menlo',
  'monaco',
  'consolas',
  'Liberation Mono',
  'Courier New',
  'monospace',
]
async function env() {
  const dir = path.resolve(opt('--build'))
  const out = path.resolve(
    opt('--out', path.join(REPO, 'test', 'baseline', 'env.json'))
  )
  const bin = await node18bin()
  const versions = JSON.parse(
    run(bin, ['-p', 'JSON.stringify(process.versions)']) || '{}'
  )
  const fc = Object.fromEntries(
    FONT_FAMILIES.map((f) => [
      f,
      run('fc-match', [f]) || '<fc-match unavailable>',
    ])
  )
  const browserslist = run(
    process.execPath,
    [path.join(REPO, 'node_modules', 'browserslist', 'cli.js')],
    { cwd: REPO }
  )
  const committedBl = fs.readFileSync(
    path.join(REPO, 'test', 'static', 'fixtures', 'browserslist.txt'),
    'utf8'
  )
  const npmLsAll = spawnSync('npm', ['ls', '--all', '--json'], {
    cwd: dir,
    encoding: 'utf8',
    maxBuffer: 1 << 28,
    env: {
      PATH: `${path.dirname(bin)}:${process.env.PATH}`,
      HOME: process.env.HOME,
    },
  })
  const npmLs = normaliseNpmLs(JSON.parse(npmLsAll.stdout), dir)
  const npmLsOut = opt(
    '--npm-ls-out',
    path.join(path.dirname(out), 'npm-ls-all.json')
  )
  writeJsonPretty(npmLsOut, npmLs)
  const pw = createRequire(path.join(REPO, 'e2e', 'package.json'))
  // version of an installed package (its package.json, read from the file: exports maps may hide it)
  const pkgVersion = (req, name) => {
    try {
      return req(`${name}/package.json`).version
    } catch {
      try {
        const main = req.resolve(name)
        let d = path.dirname(main)
        while (d !== path.dirname(d)) {
          const f = path.join(d, 'package.json')
          if (fs.existsSync(f) && readJson(f).name === name)
            return readJson(f).version
          d = path.dirname(d)
        }
      } catch {
        // not installed
      }
      return null
    }
  }
  let chromium = null
  let chromiumFonts = null
  try {
    const { chromium: c } = pw('@playwright/test')
    const b = await c.launch()
    chromium = b.version()
    // the families the capture browser renders (macOS Chromium does not use fontconfig): a family is
    // available when text set in it measures differently from both generic fallbacks
    const page = await b.newPage()
    chromiumFonts = await page.evaluate((families) => {
      const ctx = document.createElement('canvas').getContext('2d')
      const w = (font) => {
        ctx.font = font
        return ctx.measureText('mmmmmmmmmmlli WQ@ 0123456789').width
      }
      const out = {}
      for (const f of families) {
        if (['sans-serif', 'monospace'].includes(f)) {
          out[f] = 'generic'
          continue
        }
        const a = w(`32px "${f}", monospace`) !== w('32px monospace')
        const b2 = w(`32px "${f}", serif`) !== w('32px serif')
        out[f] = a && b2 ? 'available' : 'not available'
      }
      return out
    }, FONT_FAMILIES)
    await b.close()
  } catch (e) {
    chromium = `unavailable: ${e.message.split('\n')[0]}`
  }
  const golden = readJson(path.join(ARTIFACT_DIR, 'golden.json'), {})
  const rec = {
    schema: 1,
    link: golden.link || 'B0-local',
    G: golden.G || null,
    recordedAt: new Date().toISOString(),
    host: {
      kind: 'host baseline, macOS arm64 (owner notes §1); the CI runner capture is DEFERRED (VF-10)',
      platform: `${os.platform()} ${os.arch()}`,
      release: os.release(),
      macos: run('sw_vers', ['-productVersion']),
      cpus: os.cpus().length,
      memGiB: Math.round(os.totalmem() / 1073741824),
    },
    runtime: {
      what: 'process.versions of the runtime Node that serves the golden build (the image Node in docker mode)',
      versions,
    },
    fonts: {
      what: 'fc-match per family of the design font stacks (type.css), on the capture host',
      fontconfig: run('fc-match', ['--version']) || null,
      families: fc,
      chromium: {
        what: 'availability of each family to the capture Chromium (text width vs both generic fallbacks); on macOS Chromium resolves fonts through CoreText, not fontconfig',
        families: chromiumFonts,
      },
    },
    browserslist: {
      output: browserslist ? browserslist.split('\n') : null,
      sha256: browserslist ? sha256(`${browserslist}\n`) : null,
      equalsCommitted: browserslist
        ? `${browserslist}\n` === committedBl
        : null,
    },
    npmLsAll: {
      file: path.relative(REPO, npmLsOut),
      sha256: sha256(fs.readFileSync(npmLsOut)),
      exit: npmLsAll.status,
      problems: (npmLs.problems || []).length,
      normalised:
        'build directory path -> <BUILD>; npm `overridden` annotation removed',
    },
    digests: Object.fromEntries(
      Object.entries(golden.builds || {}).map(([v, b]) => [
        v,
        b.missing
          ? null
          : {
              key: b.key,
              buildId: b.buildId,
              next: b.digest.next,
              public: b.digest.public,
            },
      ])
    ),
    tools: {
      tooling: { node: process.version, npm: run('npm', ['-v']) },
      git: run('git', ['--version']),
      playwright: pkgVersion(pw, '@playwright/test'),
      chromium,
      axe: pkgVersion(pw, '@axe-core/playwright'),
      htmlValidate: pkgVersion(pw, 'html-validate'),
      pngjs: pkgVersion(pw, 'pngjs'),
      jest: pkgVersion(require, 'jest'),
      jestEnvironmentJsdom: pkgVersion(require, 'jest-environment-jsdom'),
      jestFixedJsdom: pkgVersion(require, 'jest-fixed-jsdom'),
      msw: pkgVersion(require, 'msw'),
      testingLibraryReact: pkgVersion(require, '@testing-library/react'),
      next: pkgVersion(createRequire(path.join(dir, 'package.json')), 'next'),
      react: pkgVersion(createRequire(path.join(dir, 'package.json')), 'react'),
      design: pkgVersion(
        createRequire(path.join(dir, 'package.json')),
        '@oacore/design'
      ),
    },
    image: {
      what: 'size of the golden build tree (the image size in docker mode)',
      sizes:
        (golden.builds &&
          golden.builds.default &&
          golden.builds.default.sizes) ||
        buildSizes(dir),
    },
    rss: {
      unit: 'KiB (ps -o rss of the next start process, Node 18.20.8)',
      idle: opt('--rss-idle-kb') ? Number(opt('--rss-idle-kb')) : null,
      afterP0Sweep: opt('--rss-after-kb')
        ? Number(opt('--rss-after-kb'))
        : null,
      run: opt('--run', null),
    },
  }
  writeJsonPretty(out, rec)
  console.log(`env.json -> ${path.relative(REPO, out)}`)
}

function rss() {
  const id = opt('--run')
  const e = readJson(path.join(ARTIFACT_DIR, 'runs', id, 'env.json'))
  const pid = e.pids && e.pids.app
  const kb = pid ? run('ps', ['-o', 'rss=', '-p', String(pid)]) : null
  // next start forks no worker at 10.2.3; report the app process itself
  console.log(kb ? kb.trim() : '')
}

// ---------- manifest.json + SHA256SUMS ----------
// baselines = the capture set + the hand-made pins + test/baseline/** + the Jest-tier recorded references
const BASELINE_EXTRA = [
  'e2e/journeys/t728-pinned-tuples.json',
  'e2e/lib/P0-12/t741-console-pins.json',
]
const JEST_REFERENCES = [
  'test/static/adapters/recorded',
  'test/unit/store/__baseline__',
  'test/unit/design/lib/P0-07/reference',
]
export function baselineFiles(root = REPO) {
  const files = new Set(captureFiles(root))
  for (const f of BASELINE_EXTRA)
    if (fs.existsSync(path.join(root, f))) files.add(f)
  for (const d of [...JEST_REFERENCES, 'test/baseline'])
    for (const f of walk(path.join(root, d))) files.add(`${d}/${f}`)
  files.delete('test/baseline/SHA256SUMS')
  files.delete('test/baseline/manifest.json')
  return [...files].sort(byCodePoint)
}
const setOf = (files, root = REPO) => {
  const entries = files.map((f) => [
    f,
    sha256(fs.readFileSync(path.join(root, f))),
  ])
  return {
    files: entries.length,
    sha256: sha256(entries.map(([f, h]) => `${h}  ${f}`).join('\n')),
    entries: Object.fromEntries(entries),
  }
}
const goldenReference = () => {
  const golden = readJson(path.join(ARTIFACT_DIR, 'golden.json'), {})
  return {
    G: golden.G || null,
    tag: golden.tag || null,
    builds: Object.fromEntries(
      Object.entries(golden.builds || {}).map(([v, b]) => [
        v,
        b.missing ? null : b.key,
      ])
    ),
  }
}
// the capture link's `reference` block: --reference, else the block the manifest already holds, so that a refresh
// after a ledger or baseline change does not write another link's reference back
function referenceBlock(manifestFile) {
  const text = opt('--reference')
  if (text === undefined)
    return readJson(manifestFile, {}).reference || goldenReference()
  const block = JSON.parse(text)
  if (!block || !('G' in block) || !('tag' in block) || !block.builds)
    throw new Error('--reference: expected the JSON text of {G, tag, builds}')
  return block
}
function manifest() {
  const link = opt('--link', 'B0-local')
  const manifestFile = path.join(REPO, 'test', 'baseline', 'manifest.json')
  const fixtures = walk(
    path.join(REPO, 'test', 'fixtures'),
    path.join(REPO, 'test', 'fixtures'),
    (rel) => rel === 'data-snapshot'
  )
    .filter((f) => !/^(resolve\.(c|m)js)$/.test(f))
    .map((f) => `test/fixtures/${f}`)
  const baselines = baselineFiles()
  const corpus = walk(path.join(REPO, 'test', 'corpus')).map(
    (f) => `test/corpus/${f}`
  )
  const fx = setOf(fixtures)
  const bl = setOf(baselines)
  const cp = setOf(corpus)
  const snapshotSums = fs
    .readFileSync(path.join(REPO, 'test', 'fixtures', 'SHA256SUMS'), 'utf8')
    .split('\n')
    .filter((l) => /\sdata-snapshot\//.test(l))
  const rec = {
    schema: 1,
    link,
    kind: opt('--kind', 'golden'),
    provisional: opt(
      '--provisional',
      'host baseline, macOS arm64 (owner notes §1); provisional until the CI capture on ubuntu-24.04-arm and the owner-signed B0 PR (VF-10, I-06)'
    ),
    reference: referenceBlock(manifestFile),
    fixtures: {
      files: fx.files,
      sha256: fx.sha256,
      dataSnapshot: {
        note: 'git-excluded local snapshot (owner decision, I-11); its sums are committed in test/fixtures/SHA256SUMS',
        sums: snapshotSums,
      },
    },
    baselines: { files: bl.files, sha256: bl.sha256 },
    corpus: { files: cp.files, sha256: cp.sha256 },
    method:
      'sha256 over the "<sha256>  <path>" lines (sorted by path) of each set; per-file sums of the baselines are in test/baseline/SHA256SUMS',
  }
  writeJsonPretty(manifestFile, rec)
  const sums = [...baselines, 'test/baseline/manifest.json'].map(
    (f) => `${sha256(fs.readFileSync(path.join(REPO, f)))}  ${f}`
  )
  fs.writeFileSync(
    path.join(REPO, 'test', 'baseline', 'SHA256SUMS'),
    `${sums.join('\n')}\n`
  )
  console.log(
    `manifest: link ${link}; fixtures ${fx.files} (${fx.sha256.slice(
      0,
      12
    )}), baselines ${bl.files} (${bl.sha256.slice(0, 12)}), corpus ${
      cp.files
    } (${cp.sha256.slice(0, 12)}); SHA256SUMS ${sums.length} lines`
  )
}

async function main() {
  const cmds = {
    'paths': () => console.log(capturePaths().join('\n')),
    clear,
    collect,
    'diff': diffCaptures,
    'digest': () =>
      console.log(
        JSON.stringify(buildDigest(path.resolve(opt('--build'))), null, 1)
      ),
    golden,
    'npm-ls': npmLs,
    'token-scan': tokenScan,
    extract,
    env,
    manifest,
    rss,
  }
  if (!cmds[cmd]) {
    console.error(
      `usage: baseline-tools.mjs ${Object.keys(cmds).join('|')} (see header)`
    )
    process.exit(2)
  }
  await cmds[cmd]()
}

if (fileURLToPath(import.meta.url) === path.resolve(process.argv[1] || ''))
  main().catch((e) => {
    console.error(e.stack || e.message)
    process.exit(1)
  })
