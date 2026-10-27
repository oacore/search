#!/usr/bin/env node
// build-parity.mjs - the one-time parity build of a ref (42 §1-§2, manifest §5.5): keyed by the runtime-tree
// hash (the <PI> paths of 01 §4, plus the frozen data snapshot and the variant), reused when it exists,
// recorded in $ARTIFACT_DIR/images.json. Only the harness owner and the fault runner build; `npm run e2e`
// refuses to start without an existing build.
//
//   docker mode (evidence): scripts/build-image.sh parity|harness <ref> <tag> [--variant nodsn]
//   host mode (fallback while docker is blocked, never evidence): git archive into
//     $ARTIFACT_DIR/builds/<key>/ with the repo node_modules linked, `npm run build:test` on Node 18.20.8 with
//     the parity build env and NODE_OPTIONS=--openssl-legacy-provider, then the Dockerfile's post-build copies.
//
// Usage: node scripts/build-parity.mjs [--mode host|docker] [--ref HEAD] [--variant default|nodsn|harness]
//                                      [--install link|ci] [--suffix <tag>] [--force] [--json] [--key-only]
//                                      [--alias-of <key>]
//
// --alias-of <key> (lean mode, owner notes section 0): no `npm ci`, no build. Re-keys an installed host build for
// <ref> when the app is unchanged since that build: the paths of the runtime tree that differ between the build's
// commit and <ref> may only be package.json, package-lock.json, jest.config.js, stryker.config.mjs, .github/,
// Dockerfile, .dockerignore, kube/ (the host build does not use them), and the production sections of package.json
// and the production entries of the lock must be equal. The build directory is an APFS clone (`cp -Rc`), recorded
// under the key of <ref> with `aliasOf`. Anything else is a real build.
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import crypto from 'node:crypto'
import { execFileSync, spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

export const REPO = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..'
)
export const ARTIFACT_DIR = path.resolve(
  process.env.ARTIFACT_DIR || path.join(REPO, '..', 'search-upgrade-artifacts')
)
const gitIn = (dir, ...a) =>
  execFileSync('git', ['-C', dir, ...a], {
    encoding: 'utf8',
    maxBuffer: 1 << 28,
  })

// parity build values (42 §2, 40 §2.4); nodsn = empty DSN (I-07)
export const PARITY_ENV = {
  BUILD_SCRIPT: 'build:test',
  APP_ENV: 'production',
  API_KEY: 'test-key',
  GA_TRACKING_CODE: 'G-TEST000000',
  SENTRY_DSN: 'https://public@o0.ingest.sentry.io/0',
}
export const variantEnv = (variant) =>
  variant === 'nodsn' ? { ...PARITY_ENV, SENTRY_DSN: '' } : { ...PARITY_ENV }

// <PI> = -- . ':!docs' ':!test' ':!e2e' ':!scripts' ':!tools' ':!*.md' (01 §4)
export const inRuntimeTree = (p) =>
  !/^(docs|test|e2e|scripts|tools)\//.test(p) && !p.endsWith('.md')

export const SNAPSHOT_DIR = path.join(REPO, 'test', 'fixtures', 'data-snapshot')
export function snapshotHash() {
  if (!fs.existsSync(SNAPSHOT_DIR)) return null
  const files = fs
    .readdirSync(SNAPSHOT_DIR)
    .filter((f) => fs.statSync(path.join(SNAPSHOT_DIR, f)).isFile())
    .sort()
  if (!files.length) return null
  const h = crypto.createHash('sha256')
  for (const f of files)
    h.update(
      `${f}\0${crypto
        .createHash('sha256')
        .update(fs.readFileSync(path.join(SNAPSHOT_DIR, f)))
        .digest('hex')}\n`
    )
  return h.digest('hex')
}

// gitDir: the repository holding <ref> (the fault runner builds faulted trees from throwaway repositories)
export function runtimeKey(
  ref = 'HEAD',
  variant = 'default',
  mode = 'host',
  install = 'ci',
  gitDir = REPO
) {
  const git = (...a) => gitIn(gitDir, ...a)
  const commit = git('rev-parse', `${ref}^{commit}`).trim()
  const lines = git('ls-tree', '-r', '--full-tree', commit)
    .split('\n')
    .filter(Boolean)
    .filter((l) => inRuntimeTree(l.split('\t')[1]))
  // the frozen data snapshot (42 §1): committed, or local and git-excluded (owner decision on I-11);
  // keyed by the sha256 of its files so a regenerated snapshot is a new build
  const snapshot = snapshotHash()
  let harnessPages = null
  if (variant === 'harness') {
    try {
      harnessPages = execFileSync(
        'git',
        ['-C', gitDir, 'rev-parse', `${commit}:test/harness-pages`],
        { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }
      ).trim()
    } catch {
      harnessPages = null
    }
  }
  const runtimeTree = crypto
    .createHash('sha256')
    .update(lines.join('\n'))
    .digest('hex')
  const key = crypto
    .createHash('sha256')
    .update(
      JSON.stringify({
        runtimeTree,
        snapshot,
        harnessPages,
        variant,
        mode,
        install,
        env: variantEnv(variant),
        recipe: 'parity-v1',
      })
    )
    .digest('hex')
    .slice(0, 16)
  return {
    commit,
    runtimeTree,
    snapshot,
    harnessPages,
    variant,
    mode,
    install,
    key,
  }
}

export const node18 = () => {
  if (process.env.NODE18_BIN) return process.env.NODE18_BIN
  const p = path.join(
    process.env.NVM_DIR || path.join(os.homedir(), '.nvm'),
    'versions',
    'node',
    'v18.20.8',
    'bin',
    'node'
  )
  if (!fs.existsSync(p))
    throw new Error(`Node 18.20.8 not found at ${p}; set NODE18_BIN`)
  return p
}

const imagesFile = path.join(ARTIFACT_DIR, 'images.json')
export const readImages = () =>
  fs.existsSync(imagesFile)
    ? JSON.parse(fs.readFileSync(imagesFile, 'utf8'))
    : { builds: {} }
export const writeImages = (data) => {
  fs.mkdirSync(ARTIFACT_DIR, { recursive: true })
  const tmp = `${imagesFile}.${process.pid}.tmp`
  fs.writeFileSync(tmp, `${JSON.stringify(data, null, 1)}\n`)
  fs.renameSync(tmp, imagesFile)
}

// at most two Next builds at once on this machine (owner notes §2): two mkdir slots
export async function withBuildSlot(fn) {
  const dir = path.join(ARTIFACT_DIR, 'locks')
  fs.mkdirSync(dir, { recursive: true })
  for (;;) {
    for (const n of [0, 1]) {
      const lock = path.join(dir, `build-${n}`)
      try {
        fs.mkdirSync(lock)
      } catch {
        // reclaim a slot whose owner is gone
        try {
          const pid = Number(fs.readFileSync(path.join(lock, 'pid'), 'utf8'))
          process.kill(pid, 0)
        } catch {
          fs.rmSync(lock, { recursive: true, force: true })
        }
        continue
      }
      fs.writeFileSync(path.join(lock, 'pid'), String(process.pid))
      try {
        return await fn()
      } finally {
        fs.rmSync(lock, { recursive: true, force: true })
      }
    }
    await new Promise((r) => setTimeout(r, 5000))
  }
}

// node_modules for a host build: every repo package linked, except @oacore/design, which is copied, because
// its `design build icons` binary searches design.config.js upwards from its own location and writes the
// sprite next to the config it finds (it must find the build tree's, never the repo's)
function linkNodeModules(dir) {
  const src = path.join(REPO, 'node_modules')
  const dst = path.join(dir, 'node_modules')
  fs.mkdirSync(dst)
  for (const e of fs.readdirSync(src, { withFileTypes: true })) {
    if (e.name === '@oacore') {
      fs.mkdirSync(path.join(dst, '@oacore'))
      for (const s of fs.readdirSync(path.join(src, '@oacore'))) {
        if (s === 'design')
          fs.cpSync(
            path.join(src, '@oacore', s),
            path.join(dst, '@oacore', s),
            { recursive: true, verbatimSymlinks: true }
          )
        else
          fs.symlinkSync(
            path.join(src, '@oacore', s),
            path.join(dst, '@oacore', s)
          )
      }
    } else if (e.name === '.bin') {
      fs.mkdirSync(path.join(dst, '.bin'))
      for (const b of fs.readdirSync(path.join(src, '.bin'))) {
        const from = path.join(src, '.bin', b)
        const st = fs.lstatSync(from)
        if (st.isSymbolicLink())
          fs.symlinkSync(fs.readlinkSync(from), path.join(dst, '.bin', b))
        else fs.copyFileSync(from, path.join(dst, '.bin', b))
      }
    } else if (e.name !== '.cache')
      fs.symlinkSync(path.join(src, e.name), path.join(dst, e.name))
  }
}

// install: 'ci' (default) = `npm ci --include=dev --legacy-peer-deps` of the ref's own lock on Node 18.20.8,
// as the Dockerfile does: its .next equals the image's (a linked tree resolves packages outside the build
// directory, which changes webpack module ids and chunk names) | 'link' = the repo node_modules linked
// (seconds faster; never for comparisons)
export async function hostBuild({
  ref = 'HEAD',
  variant = 'default',
  force = false,
  install = 'ci',
  suffix = '',
  gitDir = REPO,
  log = console.error,
} = {}) {
  const k = runtimeKey(ref, variant, 'host', install, gitDir)
  if (suffix) k.key = `${k.key}-${suffix}`
  const dir = path.join(ARTIFACT_DIR, 'builds', k.key)
  const meta = path.join(dir, 'build.json')
  if (!force && fs.existsSync(meta)) {
    log(`reusing host build ${k.key} (${dir})`)
    return JSON.parse(fs.readFileSync(meta, 'utf8'))
  }
  return withBuildSlot(async () => {
    fs.rmSync(dir, { recursive: true, force: true })
    fs.mkdirSync(dir, { recursive: true })
    const tar = spawnSync(
      'sh',
      [
        '-c',
        `git -C "${gitDir}" archive --format=tar ${k.commit} | tar -x -C "${dir}"`,
      ],
      { stdio: 'inherit' }
    )
    if (tar.status !== 0) throw new Error('git archive failed')
    if (k.snapshot) {
      // parity data = the frozen snapshot (42 §2: cp -a <snapshot>/. <ctx>/data/)
      for (const f of fs.readdirSync(SNAPSHOT_DIR))
        if (fs.statSync(path.join(SNAPSHOT_DIR, f)).isFile())
          fs.copyFileSync(path.join(SNAPSHOT_DIR, f), path.join(dir, 'data', f))
    }
    if (variant === 'harness') {
      const src = path.join(dir, 'test', 'harness-pages')
      if (!fs.existsSync(src))
        throw new Error(
          'harness variant: test/harness-pages/ is absent at this ref'
        )
      fs.cpSync(src, path.join(dir, 'pages', '__du-harness'), {
        recursive: true,
      })
    }
    // the image never contains test/, e2e/, docs/ ... (.dockerignore, 42 §2)
    for (const d of [
      'docs',
      'test',
      'e2e',
      'scripts',
      'tools',
      'kube',
      '.github',
    ])
      fs.rmSync(path.join(dir, d), { recursive: true, force: true })
    const env18 = variantEnv(variant)
    const bin = node18()
    if (install === 'ci') {
      // Dockerfile: the ENV of :10-15 is set while npm ci runs; NODE_ENV only afterwards
      const ciEnv = {
        PATH: `${path.dirname(bin)}:${process.env.PATH}`,
        HOME: process.env.HOME,
        TMPDIR: process.env.TMPDIR || os.tmpdir(),
        SENTRY_DSN: env18.SENTRY_DSN,
        GA_TRACKING_CODE: env18.GA_TRACKING_CODE,
        API_KEY: env18.API_KEY,
        ICONS_PUBLIC_PATH: '',
        BUILD_TARGET: 'azure',
        APP_ENV: env18.APP_ENV,
      }
      const out = fs.openSync(path.join(dir, 'install.log'), 'w')
      const r = spawnSync(
        'npm',
        [
          'ci',
          '--include=dev',
          '--legacy-peer-deps',
          '--no-audit',
          '--no-fund',
          '--prefer-offline',
        ],
        { cwd: dir, env: ciEnv, stdio: ['ignore', out, out] }
      )
      fs.closeSync(out)
      if (r.status !== 0)
        throw new Error(
          `npm ci failed (exit ${r.status}, no fallback); see ${path.join(
            dir,
            'install.log'
          )}`
        )
    } else linkNodeModules(dir)
    const env = {
      PATH: `${path.dirname(bin)}:${process.env.PATH}`,
      HOME: process.env.HOME,
      TMPDIR: process.env.TMPDIR || os.tmpdir(),
      // Dockerfile:10-15,21-23 with the parity build args
      SENTRY_DSN: env18.SENTRY_DSN,
      GA_TRACKING_CODE: env18.GA_TRACKING_CODE,
      API_KEY: env18.API_KEY,
      ICONS_PUBLIC_PATH: '',
      BUILD_TARGET: 'azure',
      APP_ENV: env18.APP_ENV,
      NODE_ENV: 'production',
      NODE_OPTIONS: '--openssl-legacy-provider',
      NEXT_TELEMETRY_DISABLED: '1',
    }
    const started = Date.now()
    log(
      `host build ${k.key}: npm run ${
        env18.BUILD_SCRIPT
      } on Node ${execFileSync(bin, ['-v'], {
        encoding: 'utf8',
      }).trim()} in ${dir}`
    )
    // the Dockerfile RUN line (`npm run build` there; the parity build script here, with the frozen data) && the
    // three public/ copies
    const cmd = `npm run ${env18.BUILD_SCRIPT} && cp public/design/icons.svg public/icons.svg && mkdir -p public/images && cp -r public/static/images/* public/images/`
    const out = fs.openSync(path.join(dir, 'build.log'), 'w')
    const r = spawnSync('sh', ['-c', cmd], {
      cwd: dir,
      env,
      stdio: ['ignore', out, out],
    })
    fs.closeSync(out)
    if (r.status !== 0)
      throw new Error(
        `host build failed (exit ${r.status}); see ${path.join(
          dir,
          'build.log'
        )}`
      )
    const result = {
      ...k,
      dir,
      buildId: fs
        .readFileSync(path.join(dir, '.next', 'BUILD_ID'), 'utf8')
        .trim(),
      node: execFileSync(bin, ['-v'], { encoding: 'utf8' }).trim(),
      buildEnv: {
        ...env18,
        BUILD_TARGET: 'azure',
        NODE_ENV: 'production',
        NODE_OPTIONS: '--openssl-legacy-provider',
      },
      builtAt: new Date().toISOString(),
      durationS: Math.round((Date.now() - started) / 1000),
      evidence: false,
      install,
    }
    fs.writeFileSync(meta, `${JSON.stringify(result, null, 1)}\n`)
    const images = readImages()
    images.builds[k.key] = result
    writeImages(images)
    log(
      `host build ${k.key} done in ${result.durationS}s, buildId ${result.buildId}`
    )
    return result
  })
}

export async function dockerBuild({
  ref = 'HEAD',
  variant = 'default',
  force = false,
  log = console.error,
} = {}) {
  const k = runtimeKey(ref, variant, 'docker')
  const images = readImages()
  const prev = images.builds[k.key]
  if (!force && prev && prev.imageId) {
    const ok =
      spawnSync('docker', ['image', 'inspect', prev.imageId], {
        stdio: 'ignore',
      }).status === 0
    if (ok) {
      log(`reusing image ${prev.tag} ${prev.imageId}`)
      return prev
    }
  }
  const tag = `search-parity:${k.key}`
  const mode = variant === 'harness' ? 'harness' : 'parity'
  const args = [
    path.join(REPO, 'scripts', 'build-image.sh'),
    mode,
    k.commit,
    tag,
    ...(variant === 'nodsn' ? ['--variant', 'nodsn'] : []),
  ]
  const r = spawnSync('bash', args, {
    stdio: 'inherit',
    env: { ...process.env, ARTIFACT_DIR },
  })
  if (r.status !== 0)
    throw new Error(`build-image.sh failed (exit ${r.status})`)
  const imageId = execFileSync(
    'docker',
    ['image', 'inspect', '--format', '{{.Id}}', tag],
    { encoding: 'utf8' }
  ).trim()
  const result = {
    ...k,
    tag,
    imageId,
    builtAt: new Date().toISOString(),
    evidence: true,
  }
  images.builds[k.key] = result
  writeImages(images)
  return result
}

const ALIAS_OK = (p) =>
  p === 'package.json' ||
  p === 'package-lock.json' ||
  p === 'jest.config.js' ||
  p === 'stryker.config.mjs' ||
  p === 'Dockerfile' ||
  p === '.dockerignore' ||
  /^(\.github|kube)\//.test(p)

const same = (a, b) => JSON.stringify(a) === JSON.stringify(b)

export function aliasBuild({
  ref = 'HEAD',
  variant = 'default',
  from,
  log = console.error,
} = {}) {
  const images = readImages()
  const src = images.builds[from]
  if (!src || !fs.existsSync(path.join(src.dir, '.next', 'BUILD_ID')))
    throw new Error(`alias: no installed host build ${from}`)
  if (src.variant !== variant)
    throw new Error(`alias: build ${from} is the ${src.variant} variant`)
  const k = runtimeKey(ref, variant, src.mode, src.install)
  const known = images.builds[k.key]
  if (known && fs.existsSync(path.join(known.dir, '.next', 'BUILD_ID'))) {
    log(`reusing host build ${k.key} (${known.dir})`)
    return known
  }
  const changed = gitIn(REPO, 'diff', '--name-only', src.commit, k.commit)
    .split('\n')
    .filter(Boolean)
    .filter(inRuntimeTree)
  const bad = changed.filter((p) => !ALIAS_OK(p))
  if (bad.length)
    throw new Error(
      `alias: the app tree differs from build ${from} (${bad
        .slice(0, 5)
        .join(', ')}): a real build is needed`
    )
  if (
    changed.includes('package.json') ||
    changed.includes('package-lock.json')
  ) {
    const at = (c, f) => JSON.parse(gitIn(REPO, 'show', `${c}:${f}`))
    const a = at(src.commit, 'package.json')
    const b = at(k.commit, 'package.json')
    for (const f of [
      'dependencies',
      'peerDependencies',
      'optionalDependencies',
      'engines',
      'browserslist',
      'resolutions',
      'overrides',
      'main',
    ])
      if (!same(a[f], b[f]))
        throw new Error(
          `alias: package.json ${f} changed: a real build is needed`
        )
    for (const f of ['build', 'build:test', 'start'])
      if (a.scripts[f] !== b.scripts[f])
        throw new Error(`alias: script ${f} changed: a real build is needed`)
    const prod = (c) => {
      const lock = at(c, 'package-lock.json').packages || {}
      return Object.fromEntries(
        Object.entries(lock).filter(
          ([k, v]) => k !== '' && !v.dev && !v.devOptional
        )
      )
    }
    if (!same(prod(src.commit), prod(k.commit)))
      throw new Error(
        'alias: production entries of the lock changed: a real build is needed'
      )
  }
  const dir = path.join(ARTIFACT_DIR, 'builds', k.key)
  fs.rmSync(dir, { recursive: true, force: true })
  const c = spawnSync('cp', ['-Rc', src.dir, dir], { stdio: 'inherit' })
  if (c.status !== 0) throw new Error('alias: clone failed')
  // commit and runtimeTree stay those of the installed tree (T-008 compares its lock with that commit's)
  const rec = {
    ...src,
    key: k.key,
    dir,
    aliasOf: from,
    aliasCommit: k.commit,
    aliasRuntimeTree: k.runtimeTree,
    builtAt: new Date().toISOString(),
    durationS: 0,
    evidence: false,
  }
  fs.writeFileSync(
    path.join(dir, 'build.json'),
    `${JSON.stringify(rec, null, 1)}\n`
  )
  images.builds[k.key] = rec
  writeImages(images)
  log(
    `host build ${
      k.key
    } = clone of ${from} (app tree unchanged since ${src.commit.slice(0, 7)})`
  )
  return rec
}

export function findBuild({
  ref = 'HEAD',
  variant = 'default',
  mode = 'host',
  install = 'ci',
} = {}) {
  const k = runtimeKey(ref, variant, mode, install)
  const b = readImages().builds[k.key]
  if (!b) return null
  if (mode === 'host' && !fs.existsSync(path.join(b.dir, '.next', 'BUILD_ID')))
    return null
  return b
}

async function main(argv) {
  const opt = (n, d) => {
    const i = argv.indexOf(n)
    return i >= 0 ? argv[i + 1] : d
  }
  const mode = opt('--mode', process.env.E2E_MODE || 'host')
  const ref = opt('--ref', 'HEAD')
  const variant = opt('--variant', 'default')
  const install = opt('--install', 'ci')
  if (argv.includes('--key-only')) {
    console.log(JSON.stringify(runtimeKey(ref, variant, mode, install)))
    return
  }
  // Docker is out of scope (owner rule of 2026-10-22): the docker path refuses whatever the environment says
  if (mode === 'docker')
    throw new Error(
      'docker mode is disabled: the builds are host builds only (Docker is out of scope)'
    )
  if (opt('--alias-of')) {
    const res = aliasBuild({ ref, variant, from: opt('--alias-of') })
    if (argv.includes('--json')) console.log(JSON.stringify(res, null, 1))
    return
  }
  const fn = mode === 'docker' ? dockerBuild : hostBuild
  const res = await fn({
    ref,
    variant,
    install,
    suffix: opt('--suffix', ''),
    force: argv.includes('--force'),
  })
  if (argv.includes('--json')) console.log(JSON.stringify(res, null, 1))
}

if (fileURLToPath(import.meta.url) === path.resolve(process.argv[1] || '')) {
  main(process.argv.slice(2)).catch((e) => {
    console.error(e.message)
    process.exit(1)
  })
}
