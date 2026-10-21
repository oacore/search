// corpus-lib.mjs - shared parts of the C4 corpus tools (55 C4, 42 §7): corpus-build, corpus-sanitise,
// corpus-record, corpus (the differential runner) and soak. Node built-ins plus the repo's own harness modules.
//
// Layout of a corpus <name>:
//   committed  test/corpus/<name>/urls.json          sanitised URL list (paths, ids, query structure; no IP,
//                                                    user-agent, referrer, cookie or timestamp field)
//              test/corpus/<name>/manifest.json      seeds, strata, per-endpoint status histogram, acceptance,
//                                                    the build the responses were recorded through
//              test/corpus/<name>/scrub-report.json  sanitising rules, counts and the grep of the committed files
//              test/corpus/<name>/api/<scenario>/<sha12>.json   recorded responses (resolver format, 40 §2)
//   local      $ARTIFACT_DIR/corpus/<name>/          raw extract, raw sample, recorder raw answers and ledger,
//              the browser HAR, replay roots, run reports (never committed)
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { createRequire } from 'node:module'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { mulberry32 } from './gate-stats.mjs'

export const REPO = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..'
)
export const ARTIFACT_DIR = path.resolve(
  process.env.ARTIFACT_DIR || path.join(REPO, '..', 'search-upgrade-artifacts')
)
export const FIXTURES = path.join(REPO, 'test', 'fixtures')
export const corpusDir = (name) => path.join(REPO, 'test', 'corpus', name)
export const workDir = (name) => path.join(ARTIFACT_DIR, 'corpus', name)
const requireRepo = createRequire(path.join(REPO, 'package.json'))
export const resolverCore = requireRepo('./test/fixtures/resolve.cjs')

export const sha256 = (buf) =>
  crypto.createHash('sha256').update(buf).digest('hex')
export const readJson = (f, d) => {
  try {
    return JSON.parse(fs.readFileSync(f, 'utf8'))
  } catch (e) {
    if (d !== undefined) return d
    throw e
  }
}
export const writeJson = (f, obj) => {
  fs.mkdirSync(path.dirname(f), { recursive: true })
  fs.writeFileSync(f, `${JSON.stringify(obj, null, 1)}\n`)
}
// committed JSON goes through the repo's prettier config (npm run lint:json stays clean)
export const writeJsonPretty = (f, obj) => {
  const prettier = requireRepo('prettier')
  const options = prettier.resolveConfig.sync(f) || {}
  fs.mkdirSync(path.dirname(f), { recursive: true })
  fs.writeFileSync(
    f,
    prettier.format(JSON.stringify(obj), {
      ...options,
      filepath: f,
      parser: 'json',
    })
  )
}
export const byCodePoint = (a, b) => (a < b ? -1 : Number(a > b))
export const walk = (dir, base = dir) =>
  fs.existsSync(dir)
    ? fs
        .readdirSync(dir, { withFileTypes: true })
        .flatMap((e) => {
          const p = path.join(dir, e.name)
          if (e.isDirectory()) return walk(p, base)
          return e.isFile()
            ? [path.relative(base, p).split(path.sep).join('/')]
            : []
        })
        .sort(byCodePoint)
    : []
export const opts = (argv) => ({
  get: (n, d) => {
    const i = argv.indexOf(n)
    return i >= 0 && i + 1 < argv.length ? argv[i + 1] : d
  },
  has: (n) => argv.includes(n),
  list: (n) => argv.flatMap((a, i) => (a === n ? [argv[i + 1]] : [])),
})

// ---------- seeded randomness (mulberry32, the recorded-seed PRNG of the gates) ----------
export const rng = (seed) => mulberry32(Number(seed) >>> 0)
export function shuffle(list, rand) {
  const a = list.slice()
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}
// weighted sample without replacement (Efraimidis-Spirakis keys u^(1/w)); ties broken by the item key
export function weightedSample(items, k, weightOf, keyOf, rand) {
  return items
    .map((it) => ({
      it,
      s: Math.pow(rand(), 1 / Math.max(1e-9, weightOf(it))),
    }))
    .sort((a, b) => b.s - a.s || byCodePoint(keyOf(a.it), keyOf(b.it)))
    .slice(0, k)
    .map((x) => x.it)
}
// a seed from a label, for draws that must be fixed (and recorded) without a separate input
export const seedOf = (label) =>
  parseInt(sha256(String(label)).slice(0, 8), 16) >>> 0

// ---------- routed prefixes (kube/prod/httproute.yaml) and the T-612 edge URLs ----------
let gen = null
export async function gateway() {
  if (!gen) gen = await import('../e2e/proxy/generate.mjs')
  const table = gen.routeTable()
  return {
    table,
    prefixes: [...new Set(table.entries.map((e) => e.prefix))].sort(
      byCodePoint
    ),
    stratum: (target) => gen.routeFor(table, target).route,
    edge: () => [...gen.ACCEPTANCE.map(([t]) => t), gen.longUrl()],
  }
}
// asset-like targets: build artefacts and static files are not corpus pages (they are covered by T-603/T-005)
export const ASSET_RE =
  /(^|\/)_next\/static\/|\.(js|mjs|css|map|png|jpe?g|gif|svg|ico|webp|avif|woff2?|ttf|eot|txt|xml|json)(\?|$)/i

// ---------- endpoints (41 §2.1 E1-E22) ----------
export function endpointOf(method, url) {
  let u
  try {
    u = new URL(url)
  } catch {
    return 'other'
  }
  const m = String(method).toUpperCase()
  const p = u.pathname
  if (u.hostname === 'doi.org') return 'E9'
  if (u.hostname !== 'api.core.ac.uk') return 'E14'
  if (/^\/data-providers\/[^/]+\/logo$/.test(p)) return 'E21'
  if (m === 'POST' && /^\/v3\/search\/works\/aggregate$/.test(p)) return 'E2'
  if (m === 'POST' && /^\/v3\/search\/works$/.test(p))
    return u.search ? 'E1' : 'E3'
  if (m === 'POST' && /^\/v3\/recommend$/.test(p)) return 'E8'
  if (/^\/v3\/works\/[^/]+\/outputs$/.test(p)) return 'E5'
  if (/^\/v3\/works\/[^/]+$/.test(p)) return 'E4'
  if (/^\/v3\/outputs\/[^/]+$/.test(p)) return 'E6'
  if (/^\/v3\/data-providers\/[^/]+$/.test(p)) return u.search ? 'E11' : 'E7'
  if (/\/data-providers\/[^/]+\/stats$/.test(p)) return 'E12'
  if (/\/data-providers\/[^/]+\/outputs$/.test(p)) return 'E13'
  if (/\/data-providers\/[^/]+\/account$/.test(p)) return 'E18'
  if (/^\/internal\/members$/.test(p)) return 'E15'
  if (/^\/internal\/(statistics|repositories\/formap|members)$/.test(p))
    return 'E19'
  if (m === 'POST' && /^\/internal\/outputs\/update$/.test(p)) return 'E10'
  if (m === 'POST' && /^\/internal\/data-providers\/[^/]+\/claim$/.test(p))
    return 'E17'
  if (m === 'POST' && /^\/internal\/data-providers$/.test(p)) return 'E16'
  if (/logo/.test(p)) return 'E14'
  return 'other'
}
// never recorded into a corpus: mutating calls (hand fixtures, 40 §6) and E15 (replays serve the
// one-eligible-member fixture, 55 C4: pickFeaturedMember is random)
export const NEVER_RECORDED = new Set(['E10', 'E15', 'E16', 'E17', 'E19'])

// ---------- harness sandbox ----------
// The SSR stub answers from test/fixtures/resolve.mjs, whose root is its own directory (no root option), so a
// corpus stack runs a copy of the stack harness (scripts/e2e-stack.mjs and what it starts: SSR stub, proxy,
// host redirect, the resolver, the gateway routes) whose test/fixtures/{api,hand} is the replay root. The copy
// is byte-identical to the repo's files (checked); only the fixture directory differs. A harness option for the
// stub's root would make it unnecessary (G25 change request).
export const SANDBOX_FILES = [
  'scripts/e2e-stack.mjs',
  'scripts/build-parity.mjs',
  'e2e/fixtures/constants.mjs',
  'e2e/proxy/generate.mjs',
  'e2e/proxy/node-proxy.mjs',
  'test/ssr/stub.mjs',
  'test/ssr/x509.mjs',
  'test/ssr/hosts.json',
  'test/ssr/host-redirect.cjs',
  'test/ssr/fetchlog.cjs',
  'test/fixtures/resolve.mjs',
  'test/fixtures/resolve.cjs',
  'kube/prod/httproute.yaml',
  'kube/stage/httproute.yaml',
]
export const sandboxDir = (name) => path.join(workDir(name), 'sandbox')
export function prepareSandbox(name) {
  const sb = sandboxDir(name)
  for (const f of SANDBOX_FILES) {
    const src = path.join(REPO, f)
    const dst = path.join(sb, f)
    const same =
      fs.existsSync(dst) &&
      sha256(fs.readFileSync(dst)) === sha256(fs.readFileSync(src))
    if (same) continue
    fs.mkdirSync(path.dirname(dst), { recursive: true })
    fs.copyFileSync(src, dst)
  }
  // generate.mjs imports yaml from the e2e package
  const nm = path.join(sb, 'e2e', 'node_modules')
  if (!fs.existsSync(nm))
    fs.symlinkSync(path.join(REPO, 'e2e', 'node_modules'), nm)
  return sb
}

// ---------- replay roots (resolver format) ----------
// root/api + root/hand: the corpus answers first; then every fixture whose key the corpus does not hold.
// base 'fixtures' = all of test/fixtures/{api,hand}; 'members' = only the E15 /members fixture, the hand
// fixtures (mutating calls) and nothing else, so a recording run records every read-only answer itself.
// prefer 'fixtures' (base 'fixtures' only): the fixtures win a key both hold (the soak's T-907 c2 checks run on
// fixture answers; the replay blocks on corpus answers).
export function buildReplayRoot(
  name,
  { base = 'members', corpusRoot = null, prefer = 'corpus' } = {}
) {
  // the root is the fixture directory of the corpus' harness sandbox (below): the SSR stub of a sandbox stack
  // and the browser resolver read it
  const root = path.join(prepareSandbox(name), 'test', 'fixtures')
  fs.rmSync(path.join(root, 'api'), { recursive: true, force: true })
  fs.rmSync(path.join(root, 'hand'), { recursive: true, force: true })
  const keys = new Set()
  const src = corpusRoot || corpusDir(name)
  const corpusFiles = walk(path.join(src, 'api'))
  const copyCorpus = () => {
    let n = 0
    for (const f of corpusFiles) {
      const key = path.basename(f, '.json')
      if (keys.has(key)) continue
      const dst = path.join(root, 'api', `0-corpus-${name}`, f)
      fs.mkdirSync(path.dirname(dst), { recursive: true })
      fs.copyFileSync(path.join(src, 'api', f), dst)
      keys.add(key)
      n++
    }
    return n
  }
  let fromCorpus = prefer === 'fixtures' ? 0 : copyCorpus()
  let copied = 0
  for (const d of ['api', 'hand'])
    for (const f of walk(path.join(FIXTURES, d))) {
      const key = path.basename(f, '.json')
      if (keys.has(key)) continue
      if (base === 'members' && d === 'api') {
        const rec = readJson(path.join(FIXTURES, d, f), null)
        if (!rec || endpointOf(rec.request.method, rec.request.url) !== 'E15')
          continue
      }
      const dst = path.join(root, d, f)
      fs.mkdirSync(path.dirname(dst), { recursive: true })
      fs.copyFileSync(path.join(FIXTURES, d, f), dst)
      keys.add(key)
      copied++
    }
  if (prefer === 'fixtures') fromCorpus = copyCorpus()
  return { root, corpusFiles: fromCorpus, fixtureFiles: copied, base, prefer }
}

// ---------- stacks (scripts/e2e-stack.mjs; host mode, own port slot per run) ----------
export function stackUp(
  id,
  {
    ref = null,
    build = null,
    variant = null,
    env = {},
    appEnv = [],
    sandbox = null,
  } = {}
) {
  // docker mode (CI, P2_DOCKER_MODE=enabled): the stack takes the image of images.json for the ref; local mode
  // takes the host build by key
  const docker = (process.env.E2E_MODE || 'host') === 'docker'
  // a corpus stack (sandbox: <corpus name>) runs the harness copy whose fixture root is the replay root
  const script = sandbox
    ? path.join(prepareSandbox(sandbox), 'scripts', 'e2e-stack.mjs')
    : 'scripts/e2e-stack.mjs'
  const args = [script, 'up', '--run', id]
  if (docker && build && build.ref) args.push('--ref', build.ref)
  else if (ref) args.push('--ref', ref)
  if (!docker && build)
    args.push('--build', typeof build === 'string' ? build : build.key)
  if (variant) args.push('--variant', variant)
  for (const kv of appEnv) args.push('--app-env', kv)
  const r = spawnSync(process.execPath, args, {
    cwd: REPO,
    encoding: 'utf8',
    env: { ...process.env, ARTIFACT_DIR, ...env },
  })
  if (r.status !== 0)
    throw new Error(`e2e:up ${id} failed: ${(r.stderr || r.stdout).trim()}`)
  return stackEnv(id)
}
export function stackDown(id) {
  spawnSync(process.execPath, ['scripts/e2e-stack.mjs', 'down', '--run', id], {
    cwd: REPO,
    encoding: 'utf8',
    env: { ...process.env, ARTIFACT_DIR },
  })
}
export const stackEnv = (id) =>
  readJson(path.join(ARTIFACT_DIR, 'runs', id, 'env.json'))

// stub control API of a stack (test/ssr/stub.mjs)
export function control(env, method, p, payload) {
  return fetch(new URL(p, env.controlURL), {
    method,
    headers: { 'content-type': 'application/json' },
    body: payload ? JSON.stringify(payload) : undefined,
  }).then(async (r) => {
    const t = await r.text()
    return t ? JSON.parse(t) : null
  })
}

// build records of $ARTIFACT_DIR/images.json, by key or by ref (+variant)
export async function buildRecord({
  key = null,
  ref = null,
  variant = 'default',
}) {
  const bp = await import('./build-parity.mjs')
  const images = bp.readImages().builds
  if (key) return images[key] || null
  const mode = process.env.E2E_MODE || 'host'
  const k =
    mode === 'docker'
      ? bp.runtimeKey(ref, variant, 'docker')
      : bp.runtimeKey(ref, variant, 'host', 'ci')
  if (images[k.key]) return { ...images[k.key], ref }
  return images[k.key] || null
}
