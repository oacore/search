// Checks of T-008 (41 A, P0; R-014, R-015, R-027, R-054, R-066), shared by the
// Jest static test (test/static/t008-install.test.js) and the alpine arm64
// script (test/ops/t008.sh). Plain Node, no Jest globals: the script runs it
// inside the container on the freshly installed tree.
//
//   node test/static/lib/P0-16/install-checks.js --verify-tree <dir>
//        [--lock-only] [--json]
//
// `dir` holds package.json, package-lock.json and (without --lock-only) the
// installed node_modules.
const fs = require('fs')
const os = require('os')
const path = require('path')
const { spawnSync } = require('child_process')

const DESIGN = {
  name: '@oacore/design',
  version: '5.0.74',
  // 60-design-ownership.md §1: the published tarball, until DV9
  integrity:
    'sha512-kwYolSk+PrJtJzSkhyUz/YGJKDbPcf6UpALedXnhWhNeJL/xB8PDvgGjHYq+xOZi2V7SIB9h0tueAAgR6IagrQ==',
  // CS-DSN-2 (W5, AD-040): installed from the vendored directory, the
  // tarball extracted (the vendored tarball itself with CS-DSN-1, AD-009);
  // the package.json spec, the lock's root spec and `resolved`
  spec: 'file:vendor/oacore-design',
  tarball: 'vendor/oacore-design-5.0.74.tgz',
  // the published shasum (60 §1)
  sha1: 'e6a401d74defeb09d828b10374ff35107a9324c4',
}

// 02 §1 rule 6: the strict-mode `npm ls --all` problems of the unchanged
// tree (7), keyed `kind:name` or `kind:name<-dependent`, with the step that
// closes each of them (02 §4)
const PLAN_ALLOW = {
  'invalid:react': 'W0 (logrocket-react peer)',
  'invalid:react-dom': 'W0 (logrocket-react peer)',
  'missing:eslint-plugin-react-hooks<-eslint-config-airbnb': 'W1',
  'missing:jquery<-slick-carousel': '6.9',
  'missing:webpack<-next-images': '7.F',
  'missing:webpack<-file-loader': '7.F',
  'missing:webpack<-url-loader': '7.F',
}
// Two further strict-mode problems that the Jest/RTL test devDependencies
// add to the lock (issue P0-16-1): RTL 12.1.5 depends on `@types/react-dom
// <18`, whose peer wants @types/react ^17 while the lock holds 19.1.6; jest
// 30's `fdir` has an optional peer `picomatch ^3 || ^4` while the runtime
// tree holds 2.3.1. Neither is in the 02 §4 allow-list; they are pinned here
// as observed so that any third problem still fails.
const TOOLING_EXTRA = {
  'invalid:@types/react': 'test tooling (RTL 12.1.5, @types/react-dom peer)',
  'invalid:picomatch': 'test tooling (jest 30 fdir optional peer)',
}

const readJson = (file) => JSON.parse(fs.readFileSync(file, 'utf8'))

// `npm` of the running Node (the runtime Node's own npm), falling back to
// the one on PATH
function npmCommand() {
  const cli = path.resolve(
    path.dirname(process.execPath),
    '..',
    'lib',
    'node_modules',
    'npm',
    'bin',
    'npm-cli.js'
  )
  return fs.existsSync(cli)
    ? { cmd: process.execPath, args: [cli] }
    : { cmd: 'npm', args: [] }
}

function npm(args, { cwd, env } = {}) {
  const { cmd, args: pre } = npmCommand()
  return spawnSync(cmd, [...pre, ...args], {
    cwd,
    encoding: 'utf8',
    maxBuffer: 1 << 28,
    env: {
      ...process.env,
      // a user-level .npmrc may set legacy-peer-deps=true and a private
      // registry: ignore it (01 §1)
      npm_config_userconfig: '/dev/null',
      npm_config_update_notifier: 'false',
      npm_config_audit: 'false',
      npm_config_fund: 'false',
      ...env,
    },
  })
}

// a scratch directory with copies of package.json and package-lock.json (npm
// reads nothing else for --package-lock-only and --dry-run, and the working
// tree is never touched)
function lockCopy(dir) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 't008-'))
  ;['package.json', 'package-lock.json'].forEach((f) =>
    fs.copyFileSync(path.join(dir, f), path.join(tmp, f))
  )
  // the design is a file: directory (CS-DSN-2, AD-041): npm reads its
  // package.json
  fs.mkdirSync(path.join(tmp, 'vendor'))
  fs.symlinkSync(
    path.join(dir, 'vendor', 'oacore-design'),
    path.join(tmp, 'vendor', 'oacore-design'),
    'dir'
  )
  return tmp
}

// `$ npm ci --include=dev --legacy-peer-deps --install-links` without its
// network (c1): the lock must be in sync with package.json, otherwise `npm ci`
// refuses (the case the Dockerfile's `|| npm install` fallback hides). From W5
// every install passes --install-links, so the design directory is installed
// as a copy (CS-DSN-2, AD-041)
function ciDryRun(dir) {
  const tmp = lockCopy(dir)
  try {
    const r = npm(
      [
        'ci',
        '--dry-run',
        '--offline',
        '--ignore-scripts',
        '--include=dev',
        '--legacy-peer-deps',
        '--install-links',
        '--loglevel=notice',
      ],
      { cwd: tmp }
    )
    const added = (r.stdout.match(/added (\d+) packages?/) || [])[1]
    return {
      status: r.status,
      added: added === undefined ? null : Number(added),
      // EBADENGINE warnings of test tooling on the runtime Node are
      // expected (02 §2): only errors count
      errors: r.stderr.split('\n').filter((l) => /^npm error/.test(l)),
    }
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true })
  }
}

// 'invalid: react@17.0.2 /x/node_modules/react' -> 'invalid:react';
// 'missing: webpack@^4, required by next-images@1.8.5'
//   -> 'missing:webpack<-next-images'
function problemKey(problem) {
  const m = problem.match(/^(\w[\w ]*): (@?[^@\s]+)@(.*)$/)
  if (!m) return `unparsed:${problem}`

  const by = m[3].match(/, required by (@?[^@\s]+)@\S+$/)
  return by ? `${m[1]}:${m[2]}<-${by[1]}` : `${m[1]}:${m[2]}`
}

// c2: the strict-mode problem list. lockOnly = npm's virtual tree from the
// lock (platform independent), otherwise the installed tree of `dir`; with
// --install-links, as installed (without it npm expects a link for the design
// directory: invalid:@oacore/design; CS-DSN-2, AD-041)
function strictProblems(dir, { lockOnly = false } = {}) {
  const tmp = lockOnly ? lockCopy(dir) : null
  try {
    const r = npm(
      [
        'ls',
        '--all',
        '--no-legacy-peer-deps',
        '--install-links',
        '--json',
        ...(lockOnly ? ['--package-lock-only'] : []),
      ],
      { cwd: tmp || dir }
    )
    let json
    try {
      json = JSON.parse(r.stdout)
    } catch (e) {
      throw new Error(
        `npm ls produced no JSON (status ${r.status}): ${r.stderr.slice(
          0,
          400
        )}`
      )
    }
    const problems = json.problems || []
    return {
      status: r.status,
      problems,
      keys: problems.map(problemKey),
      // npm read the tree: a listing of nothing would report no problems
      top: Object.keys(json.dependencies || {}).length,
    }
  } finally {
    if (tmp) fs.rmSync(tmp, { recursive: true, force: true })
  }
}

function classifyProblems(keys) {
  const out = { allowed: [], tooling: [], unexpected: [] }
  keys.forEach((k) => {
    if (PLAN_ALLOW[k]) out.allowed.push(k)
    else if (TOOLING_EXTRA[k]) out.tooling.push(k)
    else out.unexpected.push(k)
  })
  return out
}

// ---------- c3: native binaries ----------
const SWC_LINUX = [
  'linux-arm64-gnu',
  'linux-arm64-musl',
  'linux-x64-gnu',
  'linux-x64-musl',
]
const SHARP_LINUX = [
  'linux-arm64',
  'linux-x64',
  'linuxmusl-arm64',
  'linuxmusl-x64',
]

// The rule, not the presence (none is locked at Next 10): what the lock
// holds of `@next/swc-*` and of sharp follows the version of next it locks.
// Next < 12 ships no SWC binary: no `@next/swc-*` entry. From 12 (optional
// dependencies of next) the lock holds both libcs for arm64 and x64, each at
// next's own version. From 15 the sharp binaries of both libcs too (R-027).
function nativeRule(lock) {
  const packages = lock.packages || {}
  const next = packages['node_modules/next']
  const major = Number(next.version.split('.')[0])
  const swcEntries = Object.keys(packages).filter((k) =>
    /^node_modules\/@next\/swc-/.test(k)
  )
  const violations = []
  const declared = Object.keys(next.optionalDependencies || {}).filter((n) =>
    /^@next\/swc-/.test(n)
  )
  if (major < 12) {
    if (swcEntries.length)
      violations.push(`next ${next.version} locks ${swcEntries.join(', ')}`)

    if (declared.length)
      violations.push(`next ${next.version} declares ${declared.join(', ')}`)
  } else {
    SWC_LINUX.forEach((v) => {
      const e = packages[`node_modules/@next/swc-${v}`]
      if (!e) violations.push(`lock misses @next/swc-${v}`)
      else if (e.version !== next.version) {
        violations.push(
          `@next/swc-${v} ${e.version} is not next's ${next.version}`
        )
      }
    })
    // gnu and musl always come together
    ;['arm64', 'x64'].forEach((arch) => {
      const gnu = packages[`node_modules/@next/swc-linux-${arch}-gnu`]
      const musl = packages[`node_modules/@next/swc-linux-${arch}-musl`]
      if (Boolean(gnu) !== Boolean(musl))
        violations.push(`linux-${arch}: only one of gnu and musl is locked`)
    })
  }
  if (major >= 15) {
    SHARP_LINUX.forEach((v) => {
      if (!packages[`node_modules/@img/sharp-${v}`])
        violations.push(`lock misses @img/sharp-${v}`)
    })
  }
  return {
    next: next.version,
    major,
    swcEntries: swcEntries.map((k) => k.replace('node_modules/', '')),
    violations,
  }
}

// the binary that this platform needs, present in an installed tree
// (alpine arm64 = linux-arm64-musl; a darwin host tree = darwin-<arch>, the
// only @next/swc-* entry npm installs there)
function installedNative(dir, lock) {
  const next = lock.packages['node_modules/next']
  const major = Number(next.version.split('.')[0])
  if (major < 12) return { checked: [], missing: [] }

  const libc = fs.existsSync('/etc/alpine-release') ? 'musl' : 'gnu'
  const arch = os.arch() === 'arm64' ? 'arm64' : 'x64'
  const target =
    process.platform === 'linux'
      ? `linux-${arch}-${libc}`
      : `${process.platform}-${arch}`
  const want = [`@next/swc-${target}`]
  const missing = want.filter(
    (n) => !fs.existsSync(path.join(dir, 'node_modules', n, 'package.json'))
  )
  return { checked: want, missing }
}

// ---------- c4: the design tarball ----------
function designViolations(pkg, lock, dir) {
  const v = []
  const dep = (pkg.dependencies || {})[DESIGN.name]
  if (dep !== DESIGN.spec)
    v.push(`package.json pins ${DESIGN.name} "${dep}", not ${DESIGN.spec}`)

  const root = (lock.packages[''].dependencies || {})[DESIGN.name]
  if (root !== DESIGN.spec)
    v.push(`the lock's root entry has "${root}", not ${DESIGN.spec}`)

  const e = lock.packages[`node_modules/${DESIGN.name}`]
  if (!e) v.push('the lock has no design entry')
  else {
    if (e.version !== DESIGN.version)
      v.push(`locked version ${e.version}, not ${DESIGN.version}`)

    // a directory entry has no integrity (CS-DSN-2, AD-040): the tarball's
    // sha512 is checked on the file itself
    if (e.integrity !== undefined)
      v.push(`locked integrity ${e.integrity} on the directory entry`)

    if (e.resolved !== DESIGN.spec) {
      v.push(
        `resolved ${e.resolved} is not the vendored tarball ${DESIGN.spec}`
      )
    }
  }
  if (dir) {
    const f = path.join(dir, 'node_modules', DESIGN.name, 'package.json')
    if (!fs.existsSync(f)) v.push('the design package is not installed')
    else if (readJson(f).version !== DESIGN.version)
      v.push(`installed version ${readJson(f).version}`)
  }
  return v
}

// ---------- c5: undeclared packages that must resolve ----------
// (node-fetch left the list with CS-N12-1: the data loader uses the global
// fetch of Node since W4a, and Next 12 no longer brings node-fetch along)
const RESOLVES = ['@mdi/svg', '@babel/runtime', 'yargs']
// what each is resolved by in the build (the design's icon build reads
// @mdi/svg's files; the Babel runtime transform emits helper requires; the
// design's bin uses yargs)
const PROBE = {
  '@mdi/svg': '@mdi/svg/package.json',
  '@babel/runtime': '@babel/runtime/helpers/interopRequireDefault',
  'yargs': 'yargs',
}

// `require.resolve` of plain Node, as the app does it, from the app root:
// { file, version } of the package the request lands in
function resolveFrom(dir, name) {
  const marker = `/node_modules/${name}/`
  const script =
    `const p = require.resolve(${JSON.stringify(PROBE[name])});` +
    `const d = p.slice(0, p.lastIndexOf(${JSON.stringify(marker)}) + ` +
    `${marker.length - 1});` +
    'console.log(JSON.stringify({ file: p, ' +
    "version: require(d + '/package.json').version }))"
  const r = spawnSync(process.execPath, ['-e', script], {
    cwd: dir,
    encoding: 'utf8',
  })
  return r.status === 0
    ? { got: JSON.parse(r.stdout) }
    : { error: r.stderr.slice(0, 200) }
}

// R-054: the three packages the app uses without declaring them resolve from
// the app root to the hoisted top-level copy, which is the lock's top-level
// entry
function resolveViolations(lock, dir) {
  const v = []
  const found = {}
  RESOLVES.forEach((name) => {
    const entry = lock.packages[`node_modules/${name}`]
    if (!entry) {
      v.push(`the lock has no top-level ${name}`)
      return
    }
    if (entry.dev) v.push(`top-level ${name} is a dev-only lock entry`)

    found[name] = { locked: entry.version }
    if (!dir) return

    const { got, error } = resolveFrom(dir, name)
    if (error) {
      v.push(`${name} does not resolve from ${dir}: ${error}`)
      return
    }
    found[name].installed = got.version
    found[name].file = path.relative(dir, got.file)
    if (!got.file.startsWith(path.join(dir, 'node_modules', name) + path.sep))
      v.push(`${name} resolves to ${got.file}, not the top-level copy`)

    if (got.version !== entry.version)
      v.push(`${name} ${got.version} installed, ${entry.version} locked`)
  })
  return { violations: v, found }
}

// AD-119, AD-185: the c3 violations accepted for next 13.5.11 (its linux SWC
// binaries are declared at 13.5.9)
const C3_ACCEPTED = [
  "@next/swc-linux-arm64-gnu 13.5.9 is not next's 13.5.11",
  "@next/swc-linux-arm64-musl 13.5.9 is not next's 13.5.11",
  "@next/swc-linux-x64-gnu 13.5.9 is not next's 13.5.11",
  "@next/swc-linux-x64-musl 13.5.9 is not next's 13.5.11",
]

function verifyTree(dir, { lockOnly = false } = {}) {
  const pkg = readJson(path.join(dir, 'package.json'))
  const lock = readJson(path.join(dir, 'package-lock.json'))
  const installed = lockOnly ? null : dir
  const problems = strictProblems(dir, { lockOnly })
  const cls = classifyProblems(problems.keys)
  const native = nativeRule(lock)
  const nativeInstalled = installed
    ? installedNative(installed, lock)
    : { checked: [], missing: [] }
  const resolves = resolveViolations(lock, installed)
  const design = designViolations(pkg, lock, installed)
  return {
    dir,
    mode: lockOnly ? 'lock-only' : 'installed',
    node: process.version,
    platform: `${os.platform()}-${os.arch()}`,
    c2: { status: problems.status, problems: problems.keys, ...cls },
    c3: { ...native, installed: nativeInstalled },
    c4: { violations: design },
    c5: resolves,
    ok:
      cls.unexpected.length === 0 &&
      native.violations.filter((x) => !C3_ACCEPTED.includes(x)).length === 0 &&
      nativeInstalled.missing.length === 0 &&
      design.length === 0 &&
      resolves.violations.length === 0,
  }
}

module.exports = {
  DESIGN,
  PLAN_ALLOW,
  PROBE,
  RESOLVES,
  SWC_LINUX,
  TOOLING_EXTRA,
  ciDryRun,
  classifyProblems,
  designViolations,
  installedNative,
  nativeRule,
  problemKey,
  readJson,
  resolveViolations,
  strictProblems,
  verifyTree,
}

if (require.main === module) {
  const argv = process.argv.slice(2)
  const i = argv.indexOf('--verify-tree')
  if (i < 0 || !argv[i + 1]) {
    process.stderr.write(
      'usage: install-checks.js --verify-tree <dir> [--lock-only] [--json]\n'
    )
    process.exit(2)
  }
  const report = verifyTree(path.resolve(argv[i + 1]), {
    lockOnly: argv.includes('--lock-only'),
  })
  process.stdout.write(`${JSON.stringify(report, null, 1)}\n`)
  process.exit(report.ok ? 0 : 1)
}
