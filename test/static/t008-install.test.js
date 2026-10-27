// T-008 (41 A, P0; R-014, R-015, R-027, R-054, R-066): the install.
// The container half (linux/arm64 alpine, a real `npm ci`) is
// test/ops/t008.sh and is DEFERRED while Docker is out of scope; this file is
// the half that needs no container. It reads the repo's package.json and
// package-lock.json (the strict-mode problem set comes from npm's virtual
// tree, platform independent) and the installed tree of APP_ROOT (a
// `--install ci` parity build, as T-006 reads it). The checks are
// test/static/lib/P0-16/install-checks.js, the same code the container
// script runs inside the image.
//   c1  `npm ci --include=dev --legacy-peer-deps` (the Dockerfile's flags)
//       accepts the lock, offline and without an `npm install` fallback; the
//       build that produced APP_ROOT used `npm ci` and left the lock
//       byte-identical to its commit.
//   c2  with `npm_config_userconfig=/dev/null --no-legacy-peer-deps`,
//       `npm ls --all` problems are a subset of the 02 §1 rule 6 allow-list
//       (today's 7). Two more come from the test devDependencies (issue
//       P0-16-1); they are pinned separately, so a third problem fails.
//   c3  the native-binary rule (musl and gnu `@next/swc-*`, sharp musl from
//       15) holds for the locked next. None is locked at Next 10: the rule
//       is asserted, and proven on synthetic locks, not the presence.
//   c4  @oacore/design 5.0.74, integrity sha512-kwYolSk… (until DV9),
//       installed from vendor/oacore-design-5.0.74.tgz (CS-DSN-1, AD-009),
//       the file with that sha512 and the published sha1.
//   c5  node-fetch, @mdi/svg, @babel/runtime and yargs resolve from the app
//       root to the hoisted copy.
// Needs APP_ROOT (or NEXT_DIR), like T-006, for the installed-tree checks.
const fs = require('fs')
const path = require('path')
const crypto = require('crypto')
const { execFileSync } = require('child_process')

const checks = require('./lib/P0-16/install-checks')

const ROOT = path.resolve(__dirname, '..', '..')
const read = (f) => JSON.parse(fs.readFileSync(path.join(ROOT, f), 'utf8'))
const pkg = read('package.json')
const lock = read('package-lock.json')

const appRoot = () => {
  if (process.env.APP_ROOT) return path.resolve(process.env.APP_ROOT)

  if (process.env.NEXT_DIR)
    return path.dirname(path.resolve(process.env.NEXT_DIR))

  throw new Error(
    'T-008 needs APP_ROOT (app directory of the image or local build) or NEXT_DIR'
  )
}
const sha = (b) => crypto.createHash('sha256').update(b).digest('hex')

// the strict-mode problem sets cost seconds each: computed once per file
let lockProblems
let installedProblems
let dryRun
beforeAll(() => {
  lockProblems = checks.strictProblems(ROOT, { lockOnly: true })
  installedProblems = checks.strictProblems(appRoot())
  dryRun = checks.ciDryRun(ROOT)
}, 240000)

// a lock reduced to what nativeRule reads
const lockOf = (nextVersion, extra = {}) => ({
  packages: { 'node_modules/next': { version: nextVersion }, ...extra },
})
const entry = (name, version) => ({ [`node_modules/${name}`]: { version } })
const swc = (v, version) => entry(`@next/swc-${v}`, version)
const allSwc = (version) =>
  Object.assign({}, ...checks.SWC_LINUX.map((v) => swc(v, version)))

describe('T-008 @P0 install', () => {
  test('T-008 c1 @P0 npm ci accepts the lock offline with the Dockerfile flags, no fallback', () => {
    // the lock and package.json are in sync, so `npm ci` has nothing to refuse
    expect(dryRun.errors).toEqual([])
    expect(dryRun.status).toBe(0)
    // floors of a real tree, lowered from > 2000 and > 2300 by AD-003 and
    // AD-004 (W0 removes 452 lock entries)
    expect(dryRun.added).toBeGreaterThan(1900)
    expect(Object.keys(lock.packages).length).toBeGreaterThan(1900)

    // the tree under APP_ROOT came from `npm ci` and the install did not
    // rewrite the lock
    const dir = appRoot()
    const record = path.join(dir, 'build.json')
    if (fs.existsSync(record)) {
      const build = JSON.parse(fs.readFileSync(record, 'utf8'))
      expect(build.install).toBe('ci')
      const committed = execFileSync(
        'git',
        ['-C', ROOT, 'show', `${build.commit}:package-lock.json`],
        { maxBuffer: 1 << 28 }
      )
      const installed = fs.readFileSync(path.join(dir, 'package-lock.json'))
      expect(sha(installed)).toBe(sha(committed))
    }
  })

  test('T-008 c2 @P0 strict-mode npm ls --all problems are within the 02 allow-list (lock)', () => {
    const cls = checks.classifyProblems(lockProblems.keys)
    expect(cls.unexpected).toEqual([])
    // npm really read the tree (a tree of nothing has no problems either)
    expect(lockProblems.top).toBeGreaterThan(20)
  })

  test('T-008 c2 @P0 the installed tree has the same strict-mode problem set', () => {
    const cls = checks.classifyProblems(installedProblems.keys)
    expect(cls.unexpected).toEqual([])
    expect(installedProblems.top).toBeGreaterThan(20)
    expect([...installedProblems.keys].sort()).toEqual(
      [...lockProblems.keys].sort()
    )
  })

  test('T-008 c2 @P0 the allow-list keys parse the way npm prints its problems', () => {
    expect(
      checks.problemKey('invalid: react@17.0.2 /app/node_modules/react')
    ).toBe('invalid:react')
    expect(
      checks.problemKey(
        'missing: webpack@^4.0.0 || ^5.0.0, required by next-images@1.8.5'
      )
    ).toBe('missing:webpack<-next-images')
    expect(
      checks.problemKey('missing: @scope/pkg@^1, required by other@2.0.0')
    ).toBe('missing:@scope/pkg<-other')
    // a new problem is in neither list
    const cls = checks.classifyProblems([
      'missing:lodash<-something',
      'invalid:react',
      'extraneous:left-pad',
    ])
    expect(cls.unexpected).toEqual([
      'missing:lodash<-something',
      'extraneous:left-pad',
    ])
    expect(cls.allowed).toEqual(['invalid:react'])
  })

  test('T-008 c3 @P0 musl and gnu @next/swc-* are locked as the locked next requires', () => {
    const rule = checks.nativeRule(lock)
    expect(rule.violations).toEqual([])
    expect(rule.next).toBe(lock.packages['node_modules/next'].version)
    // the installed tree holds what its platform needs (nothing at Next 10)
    expect(checks.installedNative(appRoot(), lock).missing).toEqual([])
    // none at Next 10: the rule, not the presence
    if (rule.major < 12) expect(rule.swcEntries).toEqual([])
  })

  test('T-008 c3 @P0 the rule fails a lock that misses a libc variant or locks a binary too early', () => {
    // Next 10 without binaries, Next 12.3.7 with all four linux variants
    expect(checks.nativeRule(lockOf('10.2.3')).violations).toEqual([])
    expect(
      checks.nativeRule(lockOf('12.3.7', allSwc('12.3.7'))).violations
    ).toEqual([])
    // Next 10 with a binary locked
    const early = lockOf('10.2.3', swc('linux-x64-gnu', '10.2.3'))
    expect(checks.nativeRule(early).violations.join()).toMatch(
      /locks node_modules\/@next\/swc-linux-x64-gnu/
    )
    // no musl variants at 12.3.7 (a lock regenerated on macOS by npm < 10)
    const gnuOnly = {
      ...swc('linux-arm64-gnu', '12.3.7'),
      ...swc('linux-x64-gnu', '12.3.7'),
    }
    expect(checks.nativeRule(lockOf('12.3.7', gnuOnly)).violations).toEqual(
      expect.arrayContaining([
        'lock misses @next/swc-linux-arm64-musl',
        'lock misses @next/swc-linux-x64-musl',
        'linux-arm64: only one of gnu and musl is locked',
      ])
    )
    // a binary of another version than next's
    const wrong = { ...allSwc('12.3.7'), ...swc('linux-x64-musl', '12.1.6') }
    expect(checks.nativeRule(lockOf('12.3.7', wrong)).violations).toEqual([
      "@next/swc-linux-x64-musl 12.1.6 is not next's 12.3.7",
    ])
    // from 15 the sharp binaries of both libcs
    const next15 = lockOf('15.5.28', allSwc('15.5.28'))
    expect(checks.nativeRule(next15).violations.length).toBe(4)
    const libcs = ['linux-arm64', 'linux-x64', 'linuxmusl-arm64']
    libcs.push('linuxmusl-x64')
    Object.assign(
      next15.packages,
      ...libcs.map((v) => entry(`@img/sharp-${v}`, '0.34.0'))
    )
    expect(checks.nativeRule(next15).violations).toEqual([])
  })

  test('T-008 c4 @P0 @oacore/design is 5.0.74 with integrity sha512-kwYolSk…', () => {
    // the vendored tarball spec (CS-DSN-1, AD-009; was 5.0.74 and the
    // GitHub Packages URL)
    const spec = 'file:vendor/oacore-design-5.0.74.tgz'
    expect(checks.DESIGN.spec).toBe(spec)
    expect(pkg.dependencies['@oacore/design']).toBe(spec)
    expect(lock.packages[''].dependencies['@oacore/design']).toBe(spec)
    const e = lock.packages['node_modules/@oacore/design']
    expect(e.version).toBe('5.0.74')
    expect(e.resolved).toBe(spec)
    expect(e.integrity).toMatch(/^sha512-kwYolSk\+PrJtJzSkh/)
    expect(e.integrity).toBe(checks.DESIGN.integrity)
    // the vendored file is the published tarball: the locked sha512 and the
    // published sha1 (60 §1)
    const tgz = fs.readFileSync(path.join(ROOT, checks.DESIGN.tarball))
    expect(
      `sha512-${crypto.createHash('sha512').update(tgz).digest('base64')}`
    ).toBe(checks.DESIGN.integrity)
    expect(crypto.createHash('sha1').update(tgz).digest('hex')).toBe(
      checks.DESIGN.sha1
    )
    expect(checks.designViolations(pkg, lock, appRoot())).toEqual([])
    // the check can fail: another version, another integrity, the registry
    // tarball
    const moved = JSON.parse(JSON.stringify(lock))
    moved.packages['node_modules/@oacore/design'].version = '5.0.75'
    moved.packages['node_modules/@oacore/design'].integrity = 'sha512-other'
    moved.packages['node_modules/@oacore/design'].resolved =
      'https://npm.pkg.github.com/download/@oacore/design/5.0.74/e6a401d74defeb09d828b10374ff35107a9324c4'
    expect(checks.designViolations(pkg, moved, null)).toEqual([
      'locked version 5.0.75, not 5.0.74',
      `locked integrity sha512-other, not ${checks.DESIGN.integrity}`,
      `resolved ${moved.packages['node_modules/@oacore/design'].resolved} is not the vendored tarball ${spec}`,
    ])
    const floating = { dependencies: { '@oacore/design': 'latest' } }
    expect(checks.designViolations(floating, lock, null)).toEqual([
      `package.json pins @oacore/design "latest", not ${spec}`,
    ])
  })

  test('T-008 c5 @P0 the lock holds node-fetch, @mdi/svg, @babel/runtime and yargs at the top level', () => {
    checks.RESOLVES.forEach((name) => {
      const e = lock.packages[`node_modules/${name}`]
      expect([name, e !== undefined]).toEqual([name, true])
      // hoisted into the production tree, not a dev-only copy (R-054)
      expect([name, Boolean(e.dev)]).toEqual([name, false])
    })
  })

  test('T-008 c5 @P0 they resolve from the app root to the hoisted copy at the locked version', () => {
    const { violations, found } = checks.resolveViolations(lock, appRoot())
    expect(violations).toEqual([])
    expect(Object.keys(found).sort()).toEqual([...checks.RESOLVES].sort())
    checks.RESOLVES.forEach((name) => {
      expect(found[name].installed).toBe(found[name].locked)
      expect(found[name].file.startsWith(`node_modules/${name}/`)).toBe(true)
    })
  })
})
