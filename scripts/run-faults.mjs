#!/usr/bin/env node
// run-faults.mjs - seeded faults (55 C1, C1-Q; 40 §10 `npm run faults`; workflow faults.yml).
//
//   npm run faults [-- --risk R-### | --clause Q-###-c<k> | --fault <file stem> | --sealed <gate>]
//                  [--jobs N (<= 2)] [--tiers detectors,smoke | all | detectors] [--validate-only] [--index]
//                  [--ref HEAD] [--lean] [--ref-build <key>] [--ref-build-harness <key>] [--max-failures N] [--keep]
//
// Lean mode (`--lean`, implied by `--tiers detectors`; owner notes section 0): no `git archive` and no `npm ci`. The
// faulted tree is a copy of the working tree (tracked and untracked files, so uncommitted tests run too) with a
// throwaway git repository, the patch applied there; the build is an APFS clone (`cp -Rc`) of an installed reference
// build (default: the newest of the KEEP builds; `--ref-build`, `--ref-build-harness` for a detector such as T-802
// that needs the harness variant), the faulted files copied in, and only the app build step run (`npm run build:test`
// and the Dockerfile copies; a Dockerfile fault runs the faulted RUN line instead). A design-path patch is applied to
// the clone's own copy of @oacore/design. Detectors only: no P0 smoke subset, no 20% rule, no T-901. A Playwright tier
// stops after 5 failures (`--max-failures`, 0 = never). The clone is removed after the record is written (unless
// `--keep`).
//
// Per fault test/faults/<id>.patch (+ <id>.expect):
//   1. `git archive <ref>` into a temporary directory, a throwaway repository there, `git apply --3way` of the
//      patch (a stale patch fails; never a worktree of this repository). Design-path patches
//      (<id>.design.patch, paths relative to the package root) are applied with
//      `patch -p1 -d node_modules/@oacore/design` on the build's own copy of the package (55 C1-Q).
//   2. Build: local mode = a host parity build of the faulted commit (scripts/build-parity.mjs); docker mode =
//      scripts/build-image.sh on the faulted tree with the layer cache. Faults whose detectors are all Jest-tier
//      skip the Next build (owner notes §2).
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
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { spawnSync, execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import {
  ARTIFACT_DIR,
  REPO,
  hostBuild,
  node18,
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
  // a copy without .git fails T-001's inline-disable census
  g('init', '-q')
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
      PATH: `${path.dirname(node18())}:${process.env.PATH}`,
      HOME: process.env.HOME,
      TMPDIR: process.env.TMPDIR || os.tmpdir(),
      SENTRY_DSN: be.SENTRY_DSN,
      GA_TRACKING_CODE: be.GA_TRACKING_CODE,
      API_KEY: be.API_KEY,
      ICONS_PUBLIC_PATH: '',
      BUILD_TARGET: 'azure',
      APP_ENV: be.APP_ENV,
      NODE_ENV: 'production',
      NODE_OPTIONS: '--openssl-legacy-provider',
      NEXT_TELEMETRY_DISABLED: '1',
    }
    // the image recipe after the build script (Dockerfile copies); a faulted Dockerfile supplies its own
    let after =
      'cp public/design/icons.svg public/icons.svg && mkdir -p public/images && cp -r public/static/images/* public/images/'
    if (tree.files.includes('Dockerfile')) {
      const flat = fs
        .readFileSync(path.join(tree.dir, 'Dockerfile'), 'utf8')
        .replace(/\\\n/g, ' ')
      const m = flat.match(/^RUN npm run \$\{BUILD_SCRIPT\}(.*)$/m)
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
      lean: { from: ref.key, files: tree.files, recipe: cmd },
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
  const r = sh(node18(), args, {
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
  for (const suite of (rep && rep.testResults) || [])
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
  return {
    ran: true,
    exit: r.status,
    red,
    total,
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
  fs.symlinkSync(
    path.join(REPO, 'node_modules'),
    path.join(tree.dir, 'node_modules')
  )
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
