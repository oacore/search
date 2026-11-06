#!/usr/bin/env node
// run-faults.mjs - seeded faults (55 C1, C1-Q; 40 §10 `npm run faults`; run locally, there is no workflow).
//
//   npm run faults [-- --risk R-### | --clause Q-###-c<k> | --fault <file stem> | --sealed <gate>]
//                  [--jobs N (<= 2)] [--tiers detectors,smoke | all | detectors] [--validate-only] [--index]
//                  [--ref HEAD] [--lean] [--ref-build <key>] [--ref-build-harness <key>] [--max-failures N] [--keep]
//
// Lean mode (`--lean`, implied by `--tiers detectors`; owner notes section 0): no `git archive` and no `npm ci`. The
// faulted tree is a copy of the working tree (tracked and untracked files, so uncommitted tests run too) with a
// throwaway git repository whose base commit sits on the repository's HEAD (its history read through alternates),
// the patch applied there; the build is an APFS clone (`cp -Rc`) of an installed reference
// build (default: the newest of the KEEP builds; `--ref-build`, `--ref-build-harness` for a detector such as T-802
// that needs the harness variant), the faulted files copied in, and only the app build step run (`npm run build:test`
// and the Dockerfile copies; a Dockerfile fault runs the faulted RUN line instead). A patch to package.json or the
// lock reaches the clone's node_modules as `npm ci` of the faulted lock would install it, from the npm cache only
// (`leanInstall`: nothing is downloaded). A design-path patch is applied to
// the clone's own copy of @oacore/design. Detectors only: no P0 smoke subset, no 20% rule, no T-901. A Playwright tier
// stops after 5 failures (`--max-failures`, 0 = never). The clone is removed after the record is written (unless
// `--keep`).
//
// Per fault test/faults/<id>.patch (+ <id>.expect):
//   1. `git archive <ref>` into a temporary directory, a throwaway repository there, `git apply --3way` of the
//      patch (a stale patch fails; never a worktree of this repository). Design-path patches
//      (<id>.design.patch, paths relative to the package root) are applied with
//      `patch -p1 -d node_modules/@oacore/design` on the build's own copy of the package (55 C1-Q).
//   2. Build: a host parity build of the faulted commit (scripts/build-parity.mjs, local mode, the only mode;
//      Docker is out of scope). Faults whose detectors are all Jest-tier skip the Next build (owner notes §2).
//   3. Own stack per fault (scripts/e2e-stack.mjs up --build <key>), validity per 55 C1: build ok; T-901 green
//      unless it is a detector of the risk (local mode: T-901 needs the image, recorded not-run; the stack's
//      /api/healthz/ readiness is recorded instead); the .expect holds; <= 20% of the P0 smoke subset red.
//   4. Tiers: the fault's 41 §3 detectors (R) or 30 "Pinned by" tests (Q), plus the P0 smoke subset
//      (`--tiers all`: every tier). Killed = at least one detector red.
// Results: $ARTIFACT_DIR/faults/kill-matrix.json (every run, appended by fault id) and the committed summary
// test/faults/kill-summary.json (only faults that ran; a patch that did not run is never recorded as killed).
// --index writes test/faults/Q-clauses.json from the patches, test/faults/none/*.json marks and the exempt list.
//
// .expect (schema 1, declarative, black-box; 55 C1 "status, header, DOM or request"):
//   { "schema": 1, "fault": "<id>", "risk": "R-###" | "clause": "Q-###-c<k>", "mechanism": "<words>",
//     "checks": [ { "kind": "status" | "header" | "dom" | "request" | "console" | "build",
//                   "url": "/search/?q=climate", "via": "proxy" | "allow" | "origin", "js": true,
//                   "cookieState": "absent", "steps": [{ "click": "<selector>" } | { "fill": "<selector>", "value": "x" }
//                                                     | { "press": "<key>" } | { "goto": "<url>" }],
//                   "expect": { ... } } ],
//     "script": "<optional .mjs next to the patch: export default async ({ env, page, request }) => true>",
//     "readiness": "redirect" (optional: the fault changes the health probe; the stack is started without the health
//                  wait and /api/healthz/ must end at 200 {status:'ok'} after redirects, as T-901 c4 does) }
//   expect per kind: status {status} | header {name, equals | matches | absent} | dom {selector, count | text |
//   textMatches | attribute, value} | request {method?, urlMatches, count | min} | console {type, matches, min?}
//   | build {file (relative to .next), contains | notContains}.
import crypto from 'node:crypto'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { spawnSync, execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import {
  ARTIFACT_DIR,
  REPO,
  hostBuild,
  runtimeNode,
  readImages,
  writeImages,
  withBuildSlot,
} from './build-parity.mjs'

const FAULTS = path.join(REPO, 'test', 'faults')
const OUT = path.join(ARTIFACT_DIR, 'faults')
export const EXEMPT = ['Q-095', 'Q-096']
const JEST_LAYER = /^T-[1-5]\d\d$/ // layers B-F (41 §1 B..F); T-0xx static Jest too
const isJestTest = (t) => JEST_LAYER.test(t) || /^T-0\d\d$/.test(t)

const sh = (cmd, args, opts = {}) =>
  spawnSync(cmd, args, { encoding: 'utf8', maxBuffer: 1 << 28, ...opts })

// ---------- lean mode (owner notes section 0) ----------
// reference builds to clone: the newest of these that exists (all are in the KEEP set of the disk budget)
const LEAN_DEFAULT = ['509b876c81d78bc0', '1fb7e5b548c5ae8c']
const LEAN_HARNESS = ['f492f0e5d4252463', '227d0cdda34e61b6']
const buildDirOf = (key) => path.join(ARTIFACT_DIR, 'builds', key)
function leanReference(opts, harness) {
  const wanted = harness ? opts.refBuildHarness : opts.refBuild
  const list = wanted ? [wanted] : harness ? LEAN_HARNESS : LEAN_DEFAULT
  const key = list.find((k) =>
    fs.existsSync(path.join(buildDirOf(k), 'build.json'))
  )
  if (!key)
    throw new Error(
      `no reference build to clone (${list.join(
        ', '
      )}): build one with npm run build:parity${
        harness ? ' -- --variant harness' : ''
      } or pass --ref-build${harness ? '-harness' : ''}`
    )
  return {
    key,
    rec: JSON.parse(
      fs.readFileSync(path.join(buildDirOf(key), 'build.json'), 'utf8')
    ),
  }
}

// the working tree as a throwaway git repository (no .git of the repository, no node_modules, no secrets)
function leanTree(fault) {
  const root = path.join(os.tmpdir(), 'fault-lean')
  fs.mkdirSync(root, { recursive: true })
  const dir = fs.mkdtempSync(path.join(root, `${fault.id}-`))
  const list = sh('git', [
    '-C',
    REPO,
    'ls-files',
    '-z',
    '-co',
    '--exclude-standard',
  ])
  const names = list.stdout
    .split('\0')
    .filter(Boolean)
    .filter((f) => fs.existsSync(path.join(REPO, f)))
    .filter((f) => f !== '.env.fixtures' && !f.startsWith('.p2-work/'))
  const rs = sh(
    'rsync',
    ['-a', '--from0', '--files-from=-', `${REPO}/`, `${dir}/`],
    {
      input: names.join('\0'),
    }
  )
  if (rs.status !== 0) throw new Error(`rsync failed: ${rs.stderr}`)
  const g = (...a) =>
    sh('git', ['-C', dir, ...a], {
      env: {
        ...process.env,
        GIT_AUTHOR_NAME: 'fault',
        GIT_AUTHOR_EMAIL: 'fault@localhost',
        GIT_COMMITTER_NAME: 'fault',
        GIT_COMMITTER_EMAIL: 'fault@localhost',
      },
    })
  // a copy without .git fails T-001's inline-disable census. The base commit sits on the repository's HEAD, whose
  // objects the throwaway repository reads through alternates (never writes): T-013 and T-008 c1 read the locks of
  // HEAD's history as in a worktree, and `git apply --3way` finds a patch's pre-image blobs (42 §10)
  g('init', '-q')
  g('config', 'gc.auto', '0')
  const objects = path.resolve(
    REPO,
    sh('git', ['-C', REPO, 'rev-parse', '--git-path', 'objects']).stdout.trim()
  )
  fs.writeFileSync(
    path.join(dir, '.git', 'objects', 'info', 'alternates'),
    `${objects}\n`
  )
  g(
    'update-ref',
    'HEAD',
    sh('git', ['-C', REPO, 'rev-parse', 'HEAD']).stdout.trim()
  )
  g('add', '-A', '-f')
  g('commit', '-q', '-m', 'base')
  if (!fault.design) {
    const r = g('apply', '--3way', '--index', fault.file)
    if (r.status !== 0)
      return {
        dir,
        ok: false,
        error: `stale patch: git apply --3way failed: ${(r.stderr || '')
          .trim()
          .slice(0, 400)}`,
      }
    g('commit', '-q', '-m', `fault ${fault.id}`)
  }
  const files = fault.design
    ? []
    : g('diff', '--name-only', 'HEAD~1', 'HEAD')
        .stdout.split('\n')
        .filter(Boolean)
  return { dir, ok: true, commit: null, base: null, files }
}

// The install of a faulted package.json or lock in the clone, as `npm ci` of the faulted lock would make it, from
// the npm cache only (nothing is downloaded): each `packages` entry whose version, resolved or integrity moves is
// unpacked at its path from the cache by its sha512 integrity (a nested node_modules of the old copy kept, its bin
// links made), an entry the patch removes is removed with its bin links, the install scripts of an unpacked entry
// run (deeper entries first), then each root lifecycle script the patch adds or changes, in npm ci's order.
const CACACHE = path.join(os.homedir(), '.npm', '_cacache')
const DEP_SCRIPTS = ['preinstall', 'install', 'postinstall']
const ROOT_SCRIPTS = [
  'preinstall',
  'install',
  'postinstall',
  'prepublish',
  'preprepare',
  'prepare',
  'postprepare',
]
function cachedTarball(integrity) {
  const sri = String(integrity || '')
    .split(/\s+/)
    .find((s) => s.startsWith('sha512-'))
  if (!sri) return null
  const hex = Buffer.from(sri.slice(7), 'base64').toString('hex')
  const file = path.join(
    CACACHE,
    'content-v2',
    'sha512',
    hex.slice(0, 2),
    hex.slice(2, 4),
    hex.slice(4)
  )
  if (!fs.existsSync(file)) return null
  const got = crypto
    .createHash('sha512')
    .update(fs.readFileSync(file))
    .digest('hex')
  return got === hex ? file : null
}

// the node_modules directory that holds a lock path (its .bin is there)
const holderOf = (rel) =>
  rel.slice(0, rel.lastIndexOf('node_modules/') + 'node_modules'.length)
const depthOf = (rel) => rel.split('node_modules/').length

// a lifecycle script as npm runs it: sh -c in the package directory, the .bin of it and of every directory above it
// on PATH
function runScript(cwd, root, event, script, env) {
  const bins = []
  for (let d = cwd; ; d = path.dirname(d)) {
    bins.push(path.join(d, 'node_modules', '.bin'))
    if (d === path.dirname(d)) break
  }
  const pkg = JSON.parse(
    fs.readFileSync(path.join(cwd, 'package.json'), 'utf8')
  )
  const r = sh('sh', ['-c', script], {
    cwd,
    env: {
      ...env,
      PATH: `${bins.join(':')}:${env.PATH}`,
      INIT_CWD: root,
      npm_lifecycle_event: event,
      npm_lifecycle_script: script,
      npm_package_name: pkg.name || '',
      npm_package_version: pkg.version || '',
      npm_package_json: path.join(cwd, 'package.json'),
    },
  })
  if (r.status !== 0)
    throw new Error(
      `lean install: ${event} of ${
        path.relative(root, cwd) || 'the app'
      } failed (exit ${r.status}): ${(r.stderr || r.stdout || '')
        .trim()
        .slice(-300)}`
    )
}

// before, after: { pkg, lock } of the reference build and of the faulted tree; returns what it did
export function leanInstall(dir, before, after, env) {
  const was = before.lock.packages || {}
  const now = after.lock.packages || {}
  const done = []
  const moves = (a, b) =>
    !a || ['version', 'resolved', 'integrity'].some((f) => a[f] !== b[f])
  const fits = (e) =>
    [
      ['os', process.platform],
      ['cpu', process.arch],
    ].every(([f, me]) => {
      const list = e[f] || []
      const yes = list.filter((x) => !x.startsWith('!'))
      return !list.includes(`!${me}`) && (!yes.length || yes.includes(me))
    })
  const unlinkBins = (rel, e) => {
    for (const name of Object.keys((e && e.bin) || {})) {
      const link = path.join(dir, holderOf(rel), '.bin', name)
      let target
      try {
        target = path.resolve(path.dirname(link), fs.readlinkSync(link))
      } catch {
        continue
      }
      if (target.startsWith(`${path.join(dir, rel)}${path.sep}`))
        fs.rmSync(link, { force: true })
    }
  }
  const linkBins = (rel, e) => {
    for (const [name, file] of Object.entries(e.bin || {})) {
      const binDir = path.join(dir, holderOf(rel), '.bin')
      const target = path.join(dir, rel, file)
      fs.mkdirSync(binDir, { recursive: true })
      fs.rmSync(path.join(binDir, name), { force: true })
      fs.symlinkSync(path.relative(binDir, target), path.join(binDir, name))
      if (fs.existsSync(target)) fs.chmodSync(target, 0o755)
    }
  }
  const removed = Object.keys(was)
    .filter((k) => k && !now[k])
    .sort((a, b) => depthOf(b) - depthOf(a))
  for (const rel of removed) {
    unlinkBins(rel, was[rel])
    fs.rmSync(path.join(dir, rel), { recursive: true, force: true })
    done.push(`${rel} removed`)
  }
  const placed = []
  const moved = Object.keys(now)
    .filter((k) => k && moves(was[k], now[k]))
    .sort((a, b) => depthOf(a) - depthOf(b))
  for (const rel of moved) {
    const e = now[rel]
    if (e.optional && !fits(e)) {
      done.push(`${rel} skipped (optional, another platform)`)
      continue
    }
    const tgz = cachedTarball(e.integrity)
    if (!tgz)
      throw new Error(
        `lean install: ${rel} ${e.version} (${
          e.integrity || 'no integrity'
        }) is not in the npm cache`
      )
    const to = path.join(dir, rel)
    const nested = path.join(to, 'node_modules')
    const aside = `${to}.lean-${process.pid}`
    const keep = fs.existsSync(nested)
    if (keep) fs.renameSync(nested, aside)
    if (was[rel]) unlinkBins(rel, was[rel])
    fs.rmSync(to, { recursive: true, force: true })
    fs.mkdirSync(to, { recursive: true })
    const x = sh('tar', ['-xzf', tgz, '-C', to, '--strip-components=1'])
    if (x.status !== 0)
      throw new Error(`lean install: unpacking ${rel} failed: ${x.stderr}`)
    if (keep) {
      if (fs.existsSync(nested))
        throw new Error(`lean install: ${rel} brings its own node_modules`)
      fs.renameSync(aside, nested)
    }
    linkBins(rel, e)
    placed.push(rel)
    done.push(`${rel} ${e.version} from the npm cache`)
  }
  for (const rel of placed.sort((a, b) => depthOf(b) - depthOf(a))) {
    if (!now[rel].hasInstallScript) continue
    const cwd = path.join(dir, rel)
    const scripts =
      JSON.parse(fs.readFileSync(path.join(cwd, 'package.json'), 'utf8'))
        .scripts || {}
    const events = DEP_SCRIPTS.filter((ev) => scripts[ev])
    if (!events.length)
      throw new Error(
        `lean install: ${rel} has an install step this mode does not run (node-gyp)`
      )
    for (const ev of events) {
      runScript(cwd, dir, ev, scripts[ev], env)
      done.push(`${rel}: ${ev}`)
    }
  }
  const s0 = before.pkg.scripts || {}
  const s1 = after.pkg.scripts || {}
  for (const ev of ROOT_SCRIPTS)
    if (s1[ev] && s1[ev] !== s0[ev]) {
      runScript(dir, dir, ev, s1[ev], env)
      done.push(`the app: ${ev}`)
    }
  return done
}

// APFS clone of the reference build, the faulted files copied in, the app build step only
async function cloneBuild(tree, fault, opts, harness) {
  const ref = leanReference(opts, harness)
  const key = `${ref.key}-ln${fault.id}`
  const dir = buildDirOf(key)
  return withBuildSlot(async () => {
    fs.rmSync(dir, { recursive: true, force: true })
    const c = sh('cp', ['-Rc', buildDirOf(ref.key), dir])
    if (c.status !== 0) throw new Error(`clone failed: ${c.stderr}`)
    const dockerOnly =
      tree.files.length > 0 && tree.files.every((x) => x === 'Dockerfile')
    if (dockerOnly) {
      fs.rmSync(path.join(dir, 'public', 'icons.svg'), { force: true })
      fs.rmSync(path.join(dir, 'public', 'images'), {
        recursive: true,
        force: true,
      })
    } else fs.rmSync(path.join(dir, '.next'), { recursive: true, force: true })
    fs.rmSync(path.join(dir, 'build.log'), { force: true })
    for (const rel of tree.files) {
      if (rel === 'Dockerfile') continue
      const from = path.join(tree.dir, rel)
      const to = path.join(dir, rel)
      if (fs.existsSync(from)) {
        fs.mkdirSync(path.dirname(to), { recursive: true })
        fs.copyFileSync(from, to)
      } else fs.rmSync(to, { force: true })
    }
    if (fault.design) {
      const dpkg = path.join(dir, 'node_modules', '@oacore', 'design')
      if (!fs.realpathSync(dpkg).startsWith(fs.realpathSync(dir)))
        throw new Error('design package resolves outside the clone')
      const p = sh('patch', ['-p1', '-d', dpkg, '-i', fault.file])
      if (p.status !== 0) throw new Error('design patch did not apply')
    }
    const be = ref.rec.buildEnv
    const env = {
      PATH: `${path.dirname(runtimeNode())}:${process.env.PATH}`,
      HOME: process.env.HOME,
      TMPDIR: process.env.TMPDIR || os.tmpdir(),
      SENTRY_DSN: be.SENTRY_DSN,
      GA_TRACKING_CODE: be.GA_TRACKING_CODE,
      API_KEY: be.API_KEY,
      ICONS_PUBLIC_PATH: '',
      BUILD_TARGET: 'azure',
      APP_ENV: be.APP_ENV,
      NODE_ENV: 'production',
      NEXT_TELEMETRY_DISABLED: '1',
    }
    const readJson = (root, f) =>
      JSON.parse(fs.readFileSync(path.join(root, f), 'utf8'))
    const install = tree.files.some(
      (f) => f === 'package.json' || f === 'package-lock.json'
    )
      ? leanInstall(
          dir,
          {
            pkg: readJson(buildDirOf(ref.key), 'package.json'),
            lock: readJson(buildDirOf(ref.key), 'package-lock.json'),
          },
          {
            pkg: readJson(tree.dir, 'package.json'),
            lock: readJson(tree.dir, 'package-lock.json'),
          },
          env
        )
      : null
    // the image recipe after the build script (Dockerfile copies); a faulted Dockerfile supplies its own
    let after =
      'cp public/design/icons.svg public/icons.svg && mkdir -p public/images && cp -r public/static/images/* public/images/'
    if (tree.files.includes('Dockerfile')) {
      const flat = fs
        .readFileSync(path.join(tree.dir, 'Dockerfile'), 'utf8')
        .replace(/\\\n/g, ' ')
      // today's recipe runs `npm run build` (the build-script ARG of the phase-2 recipe is reverted)
      const m = flat.match(
        /^RUN npm run (?:\$\{BUILD_SCRIPT\}|build)(?=\s|$)(.*)$/m
      )
      if (!m) throw new Error('Dockerfile RUN line not recognised')
      after = m[1].trim().replace(/^&&/, '').trim() || 'true'
    }
    const cmd = dockerOnly ? after : `npm run ${be.BUILD_SCRIPT} && ${after}`
    const out = fs.openSync(path.join(dir, 'build.log'), 'w')
    const started = Date.now()
    const r = spawnSync('sh', ['-c', cmd], {
      cwd: dir,
      env,
      stdio: ['ignore', out, out],
    })
    fs.closeSync(out)
    if (r.status !== 0)
      throw new Error(
        `lean build failed (exit ${r.status}); see ${path.join(
          dir,
          'build.log'
        )}`
      )
    const rec = {
      ...ref.rec,
      key,
      dir,
      lean: {
        from: ref.key,
        files: tree.files,
        recipe: cmd,
        ...(install ? { install } : {}),
      },
      buildId: fs
        .readFileSync(path.join(dir, '.next', 'BUILD_ID'), 'utf8')
        .trim(),
      builtAt: new Date().toISOString(),
      durationS: Math.round((Date.now() - started) / 1000),
    }
    fs.writeFileSync(
      path.join(dir, 'build.json'),
      `${JSON.stringify(rec, null, 1)}\n`
    )
    const images = readImages()
    images.builds[key] = rec
    writeImages(images)
    return rec
  })
}

// the clone and its images.json entry go once the record is written (disk budget)
function dropClone(b) {
  if (!b || !b.dir || !/-ln(R|Q)-/.test(b.dir)) return
  fs.rmSync(b.dir, { recursive: true, force: true })
  const images = readImages()
  delete images.builds[b.key]
  writeImages(images)
}

// ---------- catalogue ----------
export function listFaults() {
  if (!fs.existsSync(FAULTS)) return []
  return fs
    .readdirSync(FAULTS)
    .filter((f) => /^(R|Q)-\d{3}.*\.patch$/.test(f))
    .map((f) => {
      const design = f.endsWith('.design.patch')
      const id = f.replace(/(\.design)?\.patch$/, '')
      const m =
        id.match(/^(R-\d{3})(-[a-z])?$/) || id.match(/^(Q-\d{3})-c(\d+)$/)
      return {
        id,
        file: path.join(FAULTS, f),
        design,
        kind: id[0],
        risk: id.startsWith('R') ? m && m[1] : null,
        clause: id.startsWith('Q') ? id : null,
        expect: path.join(FAULTS, `${id}.expect`),
      }
    })
    .sort((a, b) => a.id.localeCompare(b.id))
}

// 41 §3: risk -> black-box and white-box detectors
export function riskDetectors() {
  const doc = fs
    .readFileSync(
      path.join(REPO, 'docs', 'upgrade', '41-test-inventory.md'),
      'utf8'
    )
    .split('\n')
  const start = doc.findIndex((l) => /^## 3\. Risk/.test(l))
  const map = {}
  for (let i = start + 1; i < doc.length && !/^## 4/.test(doc[i]); i++) {
    if (!/^\| R-\d{3}/.test(doc[i])) continue
    const cells = doc[i].split('|').map((c) => c.trim())
    const risks = cells[1].match(/R-\d{3}/g) || []
    const tests = [
      ...new Set(
        [
          ...(cells[3] || '').matchAll(/T-\d{3}/g),
          ...(cells[4] || '').matchAll(/T-\d{3}/g),
        ].map((m) => m[0])
      ),
    ]
    for (const r of risks)
      map[r] = {
        blackBox: [...(cells[3] || '').matchAll(/T-\d{3}/g)].map((m) => m[0]),
        tests,
        c1: cells[5] || '',
      }
  }
  return map
}

// 30 "Pinned by" per quirk and the clause list (check-docs --cases-out)
export function quirkClauses() {
  const tmp = path.join(os.tmpdir(), `cases-${process.pid}.json`)
  sh(process.execPath, [
    path.join(REPO, 'tools', 'check-docs.mjs'),
    path.join(REPO, 'docs', 'upgrade'),
    '--cases-out',
    tmp,
  ])
  const all = JSON.parse(fs.readFileSync(tmp, 'utf8'))
  fs.rmSync(tmp, { force: true })
  return Object.fromEntries(
    Object.entries(all).filter(([k]) => k.startsWith('Q-'))
  )
}

// where each test lives: Jest (test/) or Playwright (e2e/)
export function testLocations(root = REPO) {
  const loc = {}
  const walk = (d) =>
    fs.existsSync(d)
      ? fs
          .readdirSync(d, { withFileTypes: true })
          .flatMap((e) =>
            e.name === 'node_modules'
              ? []
              : e.isDirectory()
              ? walk(path.join(d, e.name))
              : [path.join(d, e.name)]
          )
      : []
  for (const dir of ['test', 'e2e'])
    for (const f of walk(path.join(root, dir)).filter((p) =>
      /\.(test|spec)\.(m?js|jsx)$/.test(p)
    )) {
      const src = fs.readFileSync(f, 'utf8')
      for (const m of src.matchAll(
        /\b(?:test|it|describe)(?:\.\w+)?\(\s*['"`](T-\d{3})\b/g
      ))
        (loc[m[1]] = loc[m[1]] || new Set()).add(
          dir === 'test' ? 'jest' : 'playwright'
        )
    }
  return Object.fromEntries(Object.entries(loc).map(([k, v]) => [k, [...v]]))
}

// ---------- --index ----------
export function buildIndex() {
  const clauses = quirkClauses()
  const faults = listFaults().filter((f) => f.kind === 'Q')
  const noneDir = path.join(FAULTS, 'none')
  const none = fs.existsSync(noneDir)
    ? Object.fromEntries(
        fs
          .readdirSync(noneDir)
          .filter((f) => f.endsWith('.json'))
          .map((f) => [
            f.replace(/\.json$/, ''),
            JSON.parse(fs.readFileSync(path.join(noneDir, f), 'utf8')),
          ])
      )
    : {}
  const index = {
    schema: 1,
    generatedFrom: [
      'test/faults/Q-###-c<k>.patch',
      'test/faults/none/*.json',
      'exempt list (55 C1-Q)',
    ],
    exempt: EXEMPT,
    quirks: {},
  }
  for (const [q, info] of Object.entries(clauses)) {
    const entry = { pinnedBy: info.pinnedBy, clauses: {} }
    info.clauses.forEach((text, i) => {
      const id = `${q}-c${i + 1}`
      const patch = faults.find((f) => f.id === id)
      let status
      if (EXEMPT.includes(q)) status = 'exempt'
      else if (none[id]) status = 'none'
      else if (patch)
        status = fs.existsSync(patch.expect) ? 'patch' : 'patch-without-expect'
      else status = 'missing'
      entry.clauses[`c${i + 1}`] = {
        status,
        ...(patch
          ? { patch: path.relative(REPO, patch.file), design: patch.design }
          : {}),
        ...(none[id] ? { none: none[id] } : {}),
        text: text.slice(0, 160),
      }
    })
    index.quirks[q] = entry
  }
  const counts = {}
  for (const q of Object.values(index.quirks))
    for (const c of Object.values(q.clauses))
      counts[c.status] = (counts[c.status] || 0) + 1
  index.counts = counts
  fs.mkdirSync(FAULTS, { recursive: true })
  fs.writeFileSync(
    path.join(FAULTS, 'Q-clauses.json'),
    `${JSON.stringify(index, null, 2)}\n`
  )
  sh('npx', ['prettier', '--write', path.join(FAULTS, 'Q-clauses.json')], {
    cwd: REPO,
  })
  return index
}

// ---------- apply ----------
export function faultedTree(fault, ref) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), `fault-${fault.id}-`))
  const commit = execFileSync(
    'git',
    ['-C', REPO, 'rev-parse', `${ref}^{commit}`],
    { encoding: 'utf8' }
  ).trim()
  const tar = sh('sh', [
    '-c',
    `git -C "${REPO}" archive --format=tar ${commit} | tar -x -C "${dir}"`,
  ])
  if (tar.status !== 0) throw new Error('git archive failed')
  const g = (...a) =>
    sh('git', ['-C', dir, ...a], {
      env: {
        ...process.env,
        GIT_AUTHOR_NAME: 'fault',
        GIT_AUTHOR_EMAIL: 'fault@localhost',
        GIT_COMMITTER_NAME: 'fault',
        GIT_COMMITTER_EMAIL: 'fault@localhost',
      },
    })
  g('init', '-q')
  // -f: the archive holds tracked files that .gitignore lists (data/.statistics.json and the like)
  g('add', '-A', '-f')
  g('commit', '-q', '-m', 'base')
  if (!fault.design) {
    const r = g('apply', '--3way', '--index', fault.file)
    if (r.status !== 0)
      return {
        dir,
        ok: false,
        error: `stale patch: git apply --3way failed: ${(r.stderr || '')
          .trim()
          .slice(0, 400)}`,
      }
    g('commit', '-q', '-m', `fault ${fault.id}`)
  }
  const head = g('rev-parse', 'HEAD').stdout.trim()
  const files = fault.design
    ? []
    : g('diff', '--name-only', 'HEAD~1', 'HEAD')
        .stdout.split('\n')
        .filter(Boolean)
  return { dir, ok: true, commit: head, base: commit, files }
}

// ---------- .expect ----------
export async function evaluateExpect(expectFile, env, buildDir) {
  const spec = JSON.parse(fs.readFileSync(expectFile, 'utf8'))
  if (spec.schema !== 1)
    throw new Error(`${expectFile}: unsupported .expect schema ${spec.schema}`)
  const results = []
  const needBrowser =
    spec.checks.some((c) => ['dom', 'request', 'console'].includes(c.kind)) ||
    spec.script
  const { createRequire } = await import('node:module')
  const req = createRequire(path.join(REPO, 'e2e', 'package.json'))
  const pw =
    needBrowser ||
    spec.checks.some((c) => ['status', 'header'].includes(c.kind))
      ? req('@playwright/test')
      : null
  const { guardContext } = needBrowser
    ? await import('../e2e/fixtures/guard.mjs')
    : {}
  const { createResolver } = needBrowser
    ? await import('../test/fixtures/resolve.mjs')
    : {}
  const base = (via) =>
    via === 'allow' ? env.allowURL : via === 'origin' ? env.appURL : env.baseURL
  const browser = needBrowser ? await pw.chromium.launch() : null
  const api = pw ? await pw.request.newContext() : null
  try {
    for (const c of spec.checks) {
      const r = { kind: c.kind, url: c.url || null, ok: false }
      try {
        if (c.kind === 'build') {
          const f = path.join(buildDir, '.next', c.expect.file)
          const text = fs.existsSync(f) ? fs.readFileSync(f, 'utf8') : null
          r.ok =
            text !== null &&
            (c.expect.contains ? text.includes(c.expect.contains) : true) &&
            (c.expect.notContains ? !text.includes(c.expect.notContains) : true)
        } else if (c.kind === 'status' || c.kind === 'header') {
          const res = await api.fetch(`${base(c.via)}${c.url}`, {
            method: c.method || 'GET',
            maxRedirects: 0,
          })
          r.status = res.status()
          if (c.kind === 'status') r.ok = res.status() === c.expect.status
          else {
            const v = res.headers()[c.expect.name.toLowerCase()]
            r.value = v ?? null
            r.ok = c.expect.absent
              ? v === undefined
              : c.expect.equals !== undefined
              ? v === c.expect.equals
              : new RegExp(c.expect.matches).test(v || '')
          }
        } else {
          const log = {
            requests: [],
            console: [],
            consoleErrors: [],
            pageErrors: [],
            windowErrors: [],
            csp: [],
            badResponses: [],
            unexpected: [],
            unmatched: [],
            aborted: {},
            sentry: [],
            corsAdded: [],
            guardAbortConsole: [],
            preflights: 0,
            screenshots: 0,
            ssrProblems: [],
          }
          const ctx = await browser.newContext({
            baseURL: base(c.via),
            javaScriptEnabled: c.js !== false,
            timezoneId: 'UTC',
            locale: 'en-GB',
          })
          await guardContext(ctx, {
            env,
            resolver: createResolver({ linkOrigin: env.baseURL }),
            log,
            cookieState: c.cookieState || 'absent',
            baseURL: base(c.via),
          })
          const page = await ctx.newPage()
          await page.goto(c.url)
          for (const s of c.steps || []) {
            if (s.goto) await page.goto(s.goto)
            if (s.click) await page.locator(s.click).first().click()
            if (s.fill) await page.locator(s.fill).first().fill(s.value)
            if (s.press) await page.keyboard.press(s.press)
          }
          await page.waitForLoadState('networkidle').catch(() => {})
          if (c.kind === 'dom') {
            const loc = page.locator(c.expect.selector)
            if (c.expect.count !== undefined)
              r.ok = (await loc.count()) === c.expect.count
            else if (c.expect.text !== undefined)
              r.ok = (await loc.first().textContent()) === c.expect.text
            else if (c.expect.textMatches !== undefined)
              r.ok = new RegExp(c.expect.textMatches).test(
                (await loc.first().textContent()) || ''
              )
            else if (c.expect.attribute !== undefined)
              r.ok =
                (await loc.first().getAttribute(c.expect.attribute)) ===
                c.expect.value
          } else if (c.kind === 'request') {
            const n = log.requests.filter(
              (q) =>
                (!c.expect.method || q.method === c.expect.method) &&
                new RegExp(c.expect.urlMatches).test(q.url)
            ).length
            r.count = n
            r.ok =
              c.expect.count !== undefined
                ? n === c.expect.count
                : n >= (c.expect.min ?? 1)
          } else if (c.kind === 'console') {
            const n = log.console.filter(
              (m) =>
                (!c.expect.type || m.type === c.expect.type) &&
                new RegExp(c.expect.matches).test(m.text)
            ).length
            r.count = n
            r.ok = n >= (c.expect.min ?? 1)
          }
          await ctx.close()
        }
      } catch (e) {
        r.error = e.message
      }
      results.push(r)
    }
    if (spec.script) {
      const mod = await import(path.join(path.dirname(expectFile), spec.script))
      const page = await (
        await browser.newContext({ baseURL: env.baseURL })
      ).newPage()
      results.push({
        kind: 'script',
        ok: !!(await mod.default({ env, page, request: api })),
      })
    }
  } finally {
    if (browser) await browser.close()
    if (api) await api.dispose()
  }
  return { holds: results.every((r) => r.ok), checks: results }
}

// ---------- tiers ----------
const stripAnsi = (t) => String(t).replace(/\u001b\[[0-9;]*m/g, '')

// Jest on the runtime Node (40 §2.1); projects: the detectors' own, or node + dom for the P0 smoke subset
// the test files that name one of the ids in a test() title: a detector run loads only these
function jestFilesFor(treeDir, ids) {
  const out = []
  const walk = (d) => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      if (e.name === 'node_modules') continue
      const f = path.join(d, e.name)
      if (e.isDirectory()) walk(f)
      else if (/\.test\.(js|jsx)$/.test(e.name)) {
        const src = fs.readFileSync(f, 'utf8')
        if (
          ids.some((id) =>
            new RegExp(
              `\\b(?:test|it|describe)(?:\\.\\w+)?\\(\\s*['"\`]${id}\\b`
            ).test(src)
          )
        )
          out.push(path.relative(treeDir, f)) // relative: a temporary directory and its real path differ for Jest's rootDir
      }
    }
  }
  walk(path.join(treeDir, 'test'))
  return out
}

function runJest(treeDir, testIds, { nextDir, projects = null } = {}) {
  if (!testIds.length) return { ran: false, red: [], total: 0 }
  const out = path.join(treeDir, `jest-report-${process.hrtime.bigint()}.json`)
  const pattern = testIds
    .map((t) => (t.startsWith('T-') ? `${t}\\b` : t))
    .join('|')
  const files = projects
    ? []
    : jestFilesFor(
        treeDir,
        testIds.filter((x) => x.startsWith('T-'))
      )
  const args = [
    path.join(treeDir, 'node_modules', 'jest', 'bin', 'jest.js'),
    '-t',
    pattern,
    '--json',
    '--outputFile',
    out,
    '--ci',
    '--maxWorkers=2',
    ...(projects ? ['--selectProjects', ...projects] : []),
    ...(files.length ? ['--runTestsByPath', ...files] : []),
  ]
  const r = sh(runtimeNode(), args, {
    cwd: treeDir,
    env: {
      ...process.env,
      TZ: 'UTC',
      ...(nextDir
        ? { NEXT_DIR: nextDir, APP_ROOT: path.dirname(nextDir) }
        : {}),
    },
  })
  const rep = fs.existsSync(out)
    ? JSON.parse(fs.readFileSync(out, 'utf8'))
    : null
  const red = []
  let total = 0
  // a suite that failed to run has no assertion results: counted, so a tier that ran nothing shows it
  let failedToRun = 0
  for (const suite of (rep && rep.testResults) || []) {
    if (suite.status === 'failed' && !suite.assertionResults.length)
      failedToRun++
    for (const a of suite.assertionResults) {
      if (a.status === 'pending') continue
      total++
      if (a.status === 'failed')
        red.push({
          test: a.fullName,
          file: path.relative(treeDir, suite.name),
          messages: (a.failureMessages || []).map((m) =>
            stripAnsi(m).split('\n').slice(0, 6).join('\n')
          ),
        })
    }
  }
  return {
    ran: true,
    exit: r.status,
    red,
    total,
    failedToRun,
    ...(rep ? {} : { error: stripAnsi(r.stderr || '').slice(-400) }),
  }
}

function runPlaywright(treeDir, run, grep, project = 'chromium', extra = []) {
  const report = path.join(ARTIFACT_DIR, 'runs', run, 'report.json')
  const r = sh(
    process.execPath,
    [
      path.join(REPO, 'scripts', 'e2e-stack.mjs'),
      'test',
      '--run',
      run,
      '--project',
      project,
      '-g',
      grep,
      '--reporter',
      'json',
      ...extra,
    ],
    {
      cwd: treeDir,
      env: {
        ...process.env,
        ARTIFACT_DIR,
        PLAYWRIGHT_JSON_OUTPUT_NAME: report,
      },
    }
  )
  let rep = null
  try {
    rep = JSON.parse(r.stdout)
  } catch {
    rep = fs.existsSync(report)
      ? JSON.parse(fs.readFileSync(report, 'utf8'))
      : null
  }
  const red = []
  let total = 0
  const walkSuites = (s) => {
    for (const sp of s.specs || [])
      for (const t of sp.tests || []) {
        total++
        const res = t.results && t.results[t.results.length - 1]
        if (
          t.status === 'unexpected' ||
          (res && res.status !== 'passed' && res.status !== 'skipped')
        )
          red.push({
            test: sp.title,
            file: sp.file,
            messages: ((res && res.errors) || []).map((e) =>
              stripAnsi(e.message || '')
                .split('\n')
                .slice(0, 6)
                .join('\n')
            ),
          })
      }
    for (const c of s.suites || []) walkSuites(c)
  }
  for (const s of (rep && rep.suites) || []) walkSuites(s)
  return {
    ran: true,
    exit: r.status,
    red,
    total,
    ...(total === 0 && r.status !== 0
      ? {
          error: stripAnsi(r.stderr || r.stdout || '')
            .trim()
            .slice(-400),
        }
      : {}),
  }
}

async function runFault(fault, opts) {
  const started = new Date().toISOString()
  const rec = {
    id: fault.id,
    risk: fault.risk,
    clause: fault.clause,
    design: fault.design,
    started,
    mode: 'host',
    plan: opts.lean
      ? 'detectors only, lean (owner notes section 0): clone of an installed reference build + the app build step; no P0 smoke subset, no 20% rule, no T-901'
      : opts.tiers === 'all'
      ? 'all tiers'
      : 'detectors + P0 smoke (owner notes §2)',
  }
  const det = fault.risk
    ? (opts.detectors[fault.risk] || { tests: [] }).tests
    : (
        (opts.quirks[fault.clause.replace(/-c\d+$/, '')] || {}).pinnedBy || ''
      ).match(/T-\d{3}/g) || []
  rec.detectors = det
  if (!fs.existsSync(fault.expect)) {
    rec.valid = false
    rec.reason = 'no .expect'
    return rec
  }
  const tree = opts.lean ? leanTree(fault) : faultedTree(fault, opts.ref)
  rec.files = tree.files
  if (!tree.ok) {
    rec.valid = false
    rec.reason = tree.error
    return rec
  }
  // node_modules: an APFS clone (copy-on-write, removed with the tree) of the repository's, not a symlink: Jest
  // resolves real paths, and the ESM allow-list resolver (test/esm-resolver.js) admits only the packages under
  // the tree's own node_modules, so behind a symlink every suite that loads msw fails to run (no detector ran)
  const nm = sh('cp', [
    '-Rc',
    path.join(REPO, 'node_modules'),
    path.join(tree.dir, 'node_modules'),
  ])
  if (nm.status !== 0) {
    rec.valid = false
    rec.reason = `node_modules clone failed: ${(nm.stderr || '').trim()}`
    fs.rmSync(tree.dir, { recursive: true, force: true })
    return rec
  }
  if (fs.existsSync(path.join(REPO, 'e2e', 'node_modules')))
    fs.symlinkSync(
      path.join(REPO, 'e2e', 'node_modules'),
      path.join(tree.dir, 'e2e', 'node_modules')
    )
  const loc = testLocations(tree.dir)
  const jestOnly =
    det.length > 0 &&
    det.every((t) => (loc[t] || ['jest']).every((l) => l === 'jest'))
  let build = null
  const run = `fault-${fault.id}`
  const spec = JSON.parse(fs.readFileSync(fault.expect, 'utf8'))
  const readinessRedirect = spec.readiness === 'redirect'
  try {
    if (!jestOnly) {
      const b = await (opts.lean
        ? cloneBuild(tree, fault, opts, det.includes('T-802'))
        : hostBuild({
            ref: tree.commit,
            gitDir: tree.dir,
            log: () => {},
            suffix: '',
          })
      ).catch((e) => ({ error: e.message }))
      if (b.error) {
        rec.build = { ok: false, error: b.error }
        rec.valid = false
        rec.reason = 'build failed'
        return rec
      }
      build = b
      if (fault.design && !opts.lean) {
        const r = sh('sh', [
          '-c',
          `patch -p1 -d "${path.join(
            b.dir,
            'node_modules',
            '@oacore',
            'design'
          )}" < "${fault.file}" && cd "${b.dir}" && npm run build:test`,
        ])
        if (r.status !== 0) {
          rec.build = { ok: false, error: 'design patch or rebuild failed' }
          rec.valid = false
          return rec
        }
      }
      rec.build = { ok: true, key: b.key, buildId: b.buildId }
      const up = sh(
        process.execPath,
        [
          path.join(REPO, 'scripts', 'e2e-stack.mjs'),
          'up',
          '--run',
          run,
          '--build',
          b.key,
          ...(readinessRedirect ? ['--no-health-wait'] : []),
        ],
        { env: { ...process.env, ARTIFACT_DIR } }
      )
      rec.stack = { up: up.status === 0, healthz: up.status === 0 }
      rec.t901 = det.includes('T-901')
        ? 'detector'
        : 'not-run (local mode: T-901 needs the image; healthz readiness recorded instead)'
      if (up.status !== 0) {
        rec.valid = false
        rec.reason = `stack did not start: ${(up.stderr || '')
          .trim()
          .slice(0, 300)}`
        return rec
      }
      const env = JSON.parse(
        fs.readFileSync(
          path.join(ARTIFACT_DIR, 'runs', run, 'env.json'),
          'utf8'
        )
      )
      if (readinessRedirect) {
        // T-901 c4: GET /api/healthz/ follows redirects and ends at 200 {status:'ok'}
        const hz = await fetch(`${env.allowURL}/api/healthz/`, {
          redirect: 'follow',
        }).catch(() => null)
        const body = hz ? await hz.text() : ''
        rec.stack.healthzFollowed = hz
          ? { status: hz.status, url: hz.url, body }
          : null
        rec.stack.healthz =
          !!hz && hz.status === 200 && /"status":\s*"ok"/.test(body)
        if (!rec.stack.healthz) {
          rec.valid = false
          rec.reason =
            'healthz does not end at 200 after redirects (T-901 c4 would be red)'
          return rec
        }
      }
      rec.expect = await evaluateExpect(fault.expect, env, b.dir)
    } else {
      rec.build = { ok: null, skipped: 'Jest-only detectors (owner notes §2)' }
      rec.expect = {
        holds: null,
        skipped: 'black-box .expect needs a build; Jest-only fault',
      }
    }
    if (opts.validateOnly) {
      rec.valid = rec.expect.holds !== false
      return rec
    }
    // tiers
    const jestDet = det.filter((t) => (loc[t] || []).includes('jest'))
    const pwDet = det.filter((t) => (loc[t] || []).includes('playwright'))
    const missing = det.filter((t) => !loc[t])
    rec.missingDetectors = missing
    const jest = runJest(tree.dir, jestDet, {
      nextDir: build ? path.join(build.dir, '.next') : null,
    })
    // a kill needs one red detector: lean runs stop a Playwright tier after N failures (--max-failures)
    const stopAfter = opts.maxFailures
      ? [`--max-failures=${opts.maxFailures}`]
      : []
    const pw =
      build && pwDet.length
        ? runPlaywright(
            tree.dir,
            run,
            pwDet.map((t) => `${t}\\b`).join('|'),
            'chromium',
            stopAfter
          )
        : { ran: false, red: [], total: 0 }
    const pwVisual =
      build && pwDet.length
        ? runPlaywright(
            tree.dir,
            run,
            pwDet.map((t) => `${t}\\b`).join('|'),
            'visual',
            stopAfter
          )
        : { ran: false, red: [], total: 0 }
    // @wire titles run in the wire project, which depends on chromium: --no-deps keeps it to the detectors
    const pwWire =
      build && pwDet.length
        ? runPlaywright(
            tree.dir,
            run,
            pwDet.map((t) => `${t}\\b`).join('|'),
            'wire',
            ['--no-deps', ...stopAfter]
          )
        : { ran: false, red: [], total: 0 }
    const tierOf = (x) => ({
      ran: x.ran,
      exit: x.exit,
      total: x.total,
      red: x.red.length,
      ...(x.failedToRun ? { failedToRun: x.failedToRun } : {}),
      ...(x.error ? { error: x.error } : {}),
    })
    rec.tiers = {
      jest: tierOf(jest),
      chromium: tierOf(pw),
      visual: tierOf(pwVisual),
      wire: tierOf(pwWire),
    }
    if (opts.lean) {
      rec.p0 = {
        skipped:
          'lean mode (owner notes section 0): P0 smoke subset and the 20% rule not run',
      }
      rec.valid = rec.expect.holds !== false
      if (!rec.valid) rec.reason = '.expect does not hold'
    } else {
      // P0 smoke subset: Jest @P0 (node, dom, static) and the G tier @P0
      // (the static project reads repository history and two builds; it runs only for its detectors)
      const smokeJest = runJest(tree.dir, ['@P0'], {
        projects: ['node', 'dom'],
      })
      const smokePw = build
        ? runPlaywright(tree.dir, run, '@P0', 'chromium')
        : { ran: false, red: [], total: 0 }
      const p0Total = smokeJest.total + smokePw.total
      const p0Red = smokeJest.red.length + smokePw.red.length
      rec.p0 = {
        total: p0Total,
        red: p0Red,
        share: p0Total ? p0Red / p0Total : 0,
      }
      rec.valid = rec.expect.holds !== false && rec.p0.share <= 0.2
      if (!rec.valid)
        rec.reason =
          rec.expect.holds === false
            ? '.expect does not hold'
            : '> 20% of the P0 smoke subset red'
    }
    const red = [...jest.red, ...pw.red, ...pwVisual.red, ...pwWire.red]
    rec.redDetectors = [
      ...new Set(
        red
          .map((r) => (r.test.match(/T-\d{3}/) || [])[0])
          .filter((t) => det.includes(t))
      ),
    ]
    rec.red = red
    rec.killed = rec.valid && rec.redDetectors.length > 0
    rec.singleLayer = rec.killed && rec.redDetectors.every((t) => t === 'T-801')
  } finally {
    if (build)
      sh(
        process.execPath,
        [path.join(REPO, 'scripts', 'e2e-stack.mjs'), 'down', '--run', run],
        { env: { ...process.env, ARTIFACT_DIR } }
      )
    if (!opts.keep) {
      fs.rmSync(tree.dir, { recursive: true, force: true })
      if (opts.lean) dropClone(build)
    }
    rec.finished = new Date().toISOString()
  }
  return rec
}

// machine paths out of the committed summary (error texts quote them)
const portable = (t) =>
  String(t)
    .split(REPO)
    .join('<repo>')
    .split(ARTIFACT_DIR)
    .join('<artifacts>')
    .replace(/(?:\/private)?\/var\/folders\/[^\s)"']*/g, '<tmp>')
    .replace(/\/private\/tmp\/[^\s)"']*/g, '<tmp>')

// several fault runs may finish at once: the two result files are read, merged and written under a mkdir lock
function writeResults(records) {
  fs.mkdirSync(OUT, { recursive: true })
  const lock = path.join(OUT, '.kill-matrix.lock')
  for (let i = 0; i < 600; i++) {
    try {
      fs.mkdirSync(lock)
      break
    } catch (e) {
      if (e.code !== 'EEXIST') throw e
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 200)
    }
  }
  try {
    return writeResultsLocked(records)
  } finally {
    fs.rmSync(lock, { recursive: true, force: true })
  }
}

function writeResultsLocked(records) {
  const file = path.join(OUT, 'kill-matrix.json')
  const prev = fs.existsSync(file)
    ? JSON.parse(fs.readFileSync(file, 'utf8'))
    : { faults: {} }
  for (const r of records) prev.faults[r.id] = r
  prev.updated = new Date().toISOString()
  fs.writeFileSync(file, `${JSON.stringify(prev, null, 1)}\n`)
  // committed summary: faults that ran only. The committed file is the base (a record made on another machine or
  // by an earlier run stays), the records of this run replace their own entries.
  const summaryFile = path.join(FAULTS, 'kill-summary.json')
  const summary = fs.existsSync(summaryFile)
    ? JSON.parse(fs.readFileSync(summaryFile, 'utf8'))
    : {
        schema: 1,
        note: 'faults that ran; a patch that did not run is never recorded as killed (I-15)',
        faults: {},
      }
  for (const r of records)
    if (r.finished)
      summary.faults[r.id] = {
        risk: r.risk,
        clause: r.clause,
        valid: !!r.valid,
        killed: !!r.killed,
        singleLayer: !!r.singleLayer,
        redDetectors: r.redDetectors || [],
        redCount: (r.red || []).length,
        red: (r.red || []).slice(0, 3).map((x) => ({
          test: portable(x.test).slice(0, 160),
          file: /var\/folders|private\/tmp/.test(String(x.file))
            ? String(x.file).replace(/^.*?\/(?=(test|e2e)\/)/, '')
            : x.file,
          assertion: portable(
            ((x.messages || [])[0] || '').split('\n')[0]
          ).slice(0, 200),
        })),
        plan: r.plan,
        reason: r.reason || null,
        at: r.finished,
      }
  fs.mkdirSync(FAULTS, { recursive: true })
  const summaryOut = path.join(FAULTS, 'kill-summary.json')
  fs.writeFileSync(summaryOut, `${JSON.stringify(summary, null, 2)}\n`)
  // committed JSON goes through the repo's prettier config (npm run lint:json stays clean)
  sh('npx', ['prettier', '--write', summaryOut], { cwd: REPO })
  return file
}

async function main(argv) {
  const opt = (n, d) => {
    const i = argv.indexOf(n)
    return i >= 0 ? argv[i + 1] : d
  }
  if (argv.includes('--index')) {
    const idx = buildIndex()
    console.log(`test/faults/Q-clauses.json: ${JSON.stringify(idx.counts)}`)
    return 0
  }
  if (opt('--sealed')) {
    console.error(
      "--sealed runs the Reviewer's sealed batch from branch faults/sealed-<gate> at the gate (55 C1 (b)); it is never authored or run here"
    )
    return 2
  }
  const jobs = Math.min(2, Number(opt('--jobs', 1)))
  let faults = listFaults()
  if (opt('--risk')) faults = faults.filter((f) => f.risk === opt('--risk'))
  if (opt('--clause'))
    faults = faults.filter((f) => f.clause === opt('--clause'))
  if (opt('--fault')) faults = faults.filter((f) => f.id === opt('--fault'))
  if (!faults.length) {
    console.error('no fault patch matches (test/faults/<R|Q>-###*.patch)')
    return 1
  }
  const tiers = opt('--tiers', 'detectors,smoke')
  const opts = {
    ref: opt('--ref', 'HEAD'),
    tiers,
    lean: argv.includes('--lean') || tiers === 'detectors',
    refBuild: opt('--ref-build', null),
    refBuildHarness: opt('--ref-build-harness', null),
    maxFailures: Number(
      opt(
        '--max-failures',
        argv.includes('--lean') || tiers === 'detectors' ? 5 : 0
      )
    ),
    validateOnly: argv.includes('--validate-only'),
    keep: argv.includes('--keep'),
    detectors: riskDetectors(),
    quirks: quirkClauses(),
  }
  const records = []
  const queue = faults.slice()
  const worker = async () => {
    while (queue.length) {
      const f = queue.shift()
      process.stderr.write(`fault ${f.id} ...\n`)
      const r = await runFault(f, opts).catch((e) => ({
        id: f.id,
        valid: false,
        reason: e.message,
        finished: new Date().toISOString(),
      }))
      records.push(r)
      process.stderr.write(
        `fault ${f.id}: valid=${r.valid} killed=${r.killed ?? '-'} ${
          r.reason || ''
        }\n`
      )
    }
  }
  await Promise.all(Array.from({ length: jobs }, worker))
  const file = writeResults(records)
  console.log(
    JSON.stringify({
      file,
      ran: records.length,
      valid: records.filter((r) => r.valid).length,
      killed: records.filter((r) => r.killed).length,
    })
  )
  return records.every((r) => !r.valid || r.killed) ? 0 : 1
}

if (fileURLToPath(import.meta.url) === path.resolve(process.argv[1] || ''))
  main(process.argv.slice(2)).then(
    (c) => process.exit(c),
    (e) => {
      console.error(e.stack || e.message)
      process.exit(1)
    }
  )
