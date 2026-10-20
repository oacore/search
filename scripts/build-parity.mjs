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
//                                      [--force] [--json] [--key-only]
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import crypto from 'node:crypto'
import { execFileSync, spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

export const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
export const ARTIFACT_DIR = path.resolve(process.env.ARTIFACT_DIR || path.join(REPO, '..', 'search-upgrade-artifacts'))
const git = (...a) => execFileSync('git', ['-C', REPO, ...a], { encoding: 'utf8', maxBuffer: 1 << 28 })

// parity build values (42 §2, 40 §2.4); nodsn = empty DSN (I-07)
export const PARITY_ENV = {
  BUILD_SCRIPT: 'build:test',
  APP_ENV: 'production',
  API_KEY: 'test-key',
  GA_TRACKING_CODE: 'G-TEST000000',
  SENTRY_DSN: 'https://public@o0.ingest.sentry.io/0',
}
export const variantEnv = (variant) => (variant === 'nodsn' ? { ...PARITY_ENV, SENTRY_DSN: '' } : { ...PARITY_ENV })

// <PI> = -- . ':!docs' ':!test' ':!e2e' ':!scripts' ':!tools' ':!*.md' (01 §4)
export const inRuntimeTree = (p) => !/^(docs|test|e2e|scripts|tools)\//.test(p) && !p.endsWith('.md')

export function runtimeKey(ref = 'HEAD', variant = 'default', mode = 'host') {
  const commit = git('rev-parse', `${ref}^{commit}`).trim()
  const lines = git('ls-tree', '-r', '--full-tree', commit)
    .split('\n')
    .filter(Boolean)
    .filter((l) => inRuntimeTree(l.split('\t')[1]))
  let snapshot = null
  try {
    snapshot = execFileSync('git', ['-C', REPO, 'rev-parse', `${commit}:test/fixtures/data-snapshot`], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim()
  } catch {
    snapshot = null
  }
  let harnessPages = null
  if (variant === 'harness') {
    try {
      harnessPages = execFileSync('git', ['-C', REPO, 'rev-parse', `${commit}:test/harness-pages`], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim()
    } catch {
      harnessPages = null
    }
  }
  const runtimeTree = crypto.createHash('sha256').update(lines.join('\n')).digest('hex')
  const key = crypto
    .createHash('sha256')
    .update(JSON.stringify({ runtimeTree, snapshot, harnessPages, variant, mode, env: variantEnv(variant), recipe: 'parity-v1' }))
    .digest('hex')
    .slice(0, 16)
  return { commit, runtimeTree, snapshot, harnessPages, variant, mode, key }
}

export const node18 = () => {
  if (process.env.NODE18_BIN) return process.env.NODE18_BIN
  const p = path.join(process.env.NVM_DIR || path.join(os.homedir(), '.nvm'), 'versions', 'node', 'v18.20.8', 'bin', 'node')
  if (!fs.existsSync(p)) throw new Error(`Node 18.20.8 not found at ${p}; set NODE18_BIN`)
  return p
}

const imagesFile = path.join(ARTIFACT_DIR, 'images.json')
export const readImages = () => (fs.existsSync(imagesFile) ? JSON.parse(fs.readFileSync(imagesFile, 'utf8')) : { builds: {} })
const writeImages = (data) => {
  fs.mkdirSync(ARTIFACT_DIR, { recursive: true })
  const tmp = `${imagesFile}.${process.pid}.tmp`
  fs.writeFileSync(tmp, `${JSON.stringify(data, null, 1)}\n`)
  fs.renameSync(tmp, imagesFile)
}

// at most two Next builds at once on this machine (owner notes §2): two mkdir slots
async function withBuildSlot(fn) {
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
        if (s === 'design') fs.cpSync(path.join(src, '@oacore', s), path.join(dst, '@oacore', s), { recursive: true, verbatimSymlinks: true })
        else fs.symlinkSync(path.join(src, '@oacore', s), path.join(dst, '@oacore', s))
      }
    } else if (e.name === '.bin') {
      fs.mkdirSync(path.join(dst, '.bin'))
      for (const b of fs.readdirSync(path.join(src, '.bin'))) {
        const from = path.join(src, '.bin', b)
        const st = fs.lstatSync(from)
        if (st.isSymbolicLink()) fs.symlinkSync(fs.readlinkSync(from), path.join(dst, '.bin', b))
        else fs.copyFileSync(from, path.join(dst, '.bin', b))
      }
    } else if (e.name !== '.cache') fs.symlinkSync(path.join(src, e.name), path.join(dst, e.name))
  }
}

export async function hostBuild({ ref = 'HEAD', variant = 'default', force = false, log = console.error } = {}) {
  const k = runtimeKey(ref, variant, 'host')
  const dir = path.join(ARTIFACT_DIR, 'builds', k.key)
  const meta = path.join(dir, 'build.json')
  if (!force && fs.existsSync(meta)) {
    log(`reusing host build ${k.key} (${dir})`)
    return JSON.parse(fs.readFileSync(meta, 'utf8'))
  }
  return withBuildSlot(async () => {
    fs.rmSync(dir, { recursive: true, force: true })
    fs.mkdirSync(dir, { recursive: true })
    const tar = spawnSync('sh', ['-c', `git -C "${REPO}" archive --format=tar ${k.commit} | tar -x -C "${dir}"`], { stdio: 'inherit' })
    if (tar.status !== 0) throw new Error('git archive failed')
    if (k.snapshot) {
      const snap = path.join(REPO, 'test', 'fixtures', 'data-snapshot')
      for (const f of fs.readdirSync(snap)) fs.copyFileSync(path.join(snap, f), path.join(dir, 'data', f))
    }
    if (variant === 'harness') {
      const src = path.join(dir, 'test', 'harness-pages')
      if (!fs.existsSync(src)) throw new Error('harness variant: test/harness-pages/ is absent at this ref')
      fs.cpSync(src, path.join(dir, 'pages', '__du-harness'), { recursive: true })
    }
    // the image never contains test/, e2e/, docs/ ... (.dockerignore, 42 §2)
    for (const d of ['docs', 'test', 'e2e', 'scripts', 'tools', 'kube', '.github']) fs.rmSync(path.join(dir, d), { recursive: true, force: true })
    linkNodeModules(dir)
    const env18 = variantEnv(variant)
    const bin = node18()
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
    log(`host build ${k.key}: npm run ${env18.BUILD_SCRIPT} on Node ${execFileSync(bin, ['-v'], { encoding: 'utf8' }).trim()} in ${dir}`)
    // Dockerfile RUN line: npm run ${BUILD_SCRIPT} && the three public/ copies
    const cmd = `npm run ${env18.BUILD_SCRIPT} && cp public/design/icons.svg public/icons.svg && mkdir -p public/images && cp -r public/static/images/* public/images/`
    const out = fs.openSync(path.join(dir, 'build.log'), 'w')
    const r = spawnSync('sh', ['-c', cmd], { cwd: dir, env, stdio: ['ignore', out, out] })
    fs.closeSync(out)
    if (r.status !== 0) throw new Error(`host build failed (exit ${r.status}); see ${path.join(dir, 'build.log')}`)
    const result = {
      ...k,
      dir,
      buildId: fs.readFileSync(path.join(dir, '.next', 'BUILD_ID'), 'utf8').trim(),
      node: execFileSync(bin, ['-v'], { encoding: 'utf8' }).trim(),
      buildEnv: { ...env18, BUILD_TARGET: 'azure', NODE_ENV: 'production', NODE_OPTIONS: '--openssl-legacy-provider' },
      builtAt: new Date().toISOString(),
      durationS: Math.round((Date.now() - started) / 1000),
      evidence: false,
    }
    fs.writeFileSync(meta, `${JSON.stringify(result, null, 1)}\n`)
    const images = readImages()
    images.builds[k.key] = result
    writeImages(images)
    log(`host build ${k.key} done in ${result.durationS}s, buildId ${result.buildId}`)
    return result
  })
}

export async function dockerBuild({ ref = 'HEAD', variant = 'default', force = false, log = console.error } = {}) {
  const k = runtimeKey(ref, variant, 'docker')
  const images = readImages()
  const prev = images.builds[k.key]
  if (!force && prev && prev.imageId) {
    const ok = spawnSync('docker', ['image', 'inspect', prev.imageId], { stdio: 'ignore' }).status === 0
    if (ok) {
      log(`reusing image ${prev.tag} ${prev.imageId}`)
      return prev
    }
  }
  const tag = `search-parity:${k.key}`
  const mode = variant === 'harness' ? 'harness' : 'parity'
  const args = [path.join(REPO, 'scripts', 'build-image.sh'), mode, k.commit, tag, ...(variant === 'nodsn' ? ['--variant', 'nodsn'] : [])]
  const r = spawnSync('bash', args, { stdio: 'inherit', env: { ...process.env, ARTIFACT_DIR } })
  if (r.status !== 0) throw new Error(`build-image.sh failed (exit ${r.status})`)
  const imageId = execFileSync('docker', ['image', 'inspect', '--format', '{{.Id}}', tag], { encoding: 'utf8' }).trim()
  const result = { ...k, tag, imageId, builtAt: new Date().toISOString(), evidence: true }
  images.builds[k.key] = result
  writeImages(images)
  return result
}

export function findBuild({ ref = 'HEAD', variant = 'default', mode = 'host' } = {}) {
  const k = runtimeKey(ref, variant, mode)
  const b = readImages().builds[k.key]
  if (!b) return null
  if (mode === 'host' && !fs.existsSync(path.join(b.dir, '.next', 'BUILD_ID'))) return null
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
  if (argv.includes('--key-only')) {
    console.log(JSON.stringify(runtimeKey(ref, variant, mode)))
    return
  }
  const fn = mode === 'docker' ? dockerBuild : hostBuild
  const res = await fn({ ref, variant, force: argv.includes('--force') })
  if (argv.includes('--json')) console.log(JSON.stringify(res, null, 1))
}

if (fileURLToPath(import.meta.url) === path.resolve(process.argv[1] || '')) {
  main(process.argv.slice(2)).catch((e) => {
    console.error(e.message)
    process.exit(1)
  })
}
