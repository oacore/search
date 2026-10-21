// T-016 (41 A; VG-1, VG-2; R-015, R-075): the design package is used verbatim.
// c1: the installed @oacore/design is a real directory (not a symlink) with
// the 466 files of the tarball. c2: the modules the client bundles emit for it
// equal their files (modulo the minifier and the NODE_ENV define), with no
// injected core-js import: the production build leaves node_modules alone,
// while a copy under the app tree or a symlink would be compiled by the app's
// babel.config.js (useBuiltIns: 'usage', R-075). c3:
// scripts/verify-design-verbatim.mjs compares the installed package with the
// 5.0.74 tarball from the npm cache (nothing is downloaded): it differs only in
// lib/config.js, which the package's postinstall writes (60 §2; until DV7).
//
// c2 reads the production client chunks of the parity build and their source
// maps (webpack 4 of Next 10.2.3, hashed module ids): NEXT_DIR = its .next,
// APP_ROOT = the app directory that holds it. Build-artefact adapters are
// version specific (40 §8 rule 7).
const fs = require('fs')
const os = require('os')
const path = require('path')
const { spawnSync } = require('child_process')

const { traverse } = require('@babel/core')
const generate = require('@babel/generator').default
const { parse } = require('@babel/parser')
const terser = require('next/dist/compiled/terser')

const ROOT = path.resolve(__dirname, '..', '..')
const DESIGN = path.join('node_modules', '@oacore', 'design')

const appRoot = () => {
  if (process.env.APP_ROOT) return path.resolve(process.env.APP_ROOT)
  if (process.env.NEXT_DIR)
    return path.dirname(path.resolve(process.env.NEXT_DIR))
  return null
}
// the trees to check: the repository, and the app directory of the build
const roots = () => [...new Set([ROOT, appRoot()].filter(Boolean))]

const walkFiles = (dir) =>
  fs.existsSync(dir)
    ? fs
        .readdirSync(dir, { withFileTypes: true })
        .flatMap((e) =>
          e.isDirectory()
            ? walkFiles(path.join(dir, e.name))
            : [path.join(dir, e.name)]
        )
    : []

// ---------- c1: the install shape (VG-1) ----------

// -> { symlink, scopeSymlink, real, files, symlinks }
const inspectInstall = (root) => {
  const pkg = path.join(root, DESIGN)
  const st = fs.lstatSync(pkg)
  const scope = fs.lstatSync(path.dirname(pkg))
  const regular = []
  const symlinks = []
  const walk = (dir) =>
    fs.readdirSync(dir, { withFileTypes: true }).forEach((e) => {
      const abs = path.join(dir, e.name)
      if (e.isSymbolicLink()) symlinks.push(path.relative(pkg, abs))
      else if (e.isDirectory()) walk(abs)
      else regular.push(path.relative(pkg, abs))
    })
  if (st.isDirectory()) walk(pkg)
  return {
    symlink: st.isSymbolicLink(),
    scopeSymlink: scope.isSymbolicLink(),
    real: fs.realpathSync(pkg),
    files: regular.length,
    symlinks,
    version: st.isDirectory()
      ? JSON.parse(fs.readFileSync(path.join(pkg, 'package.json'), 'utf8'))
          .version
      : null,
  }
}

// ---------- c2: emitted modules against their files (VG-2) ----------

const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'
const B64_INDEX = Object.fromEntries([...B64].map((c, i) => [c, i]))
// source map "mappings" -> per generated line, [column, source index] of every
// segment that has a source
const decodeMappings = (mappings) => {
  let source = 0
  return mappings.split(';').map((line) => {
    let column = 0
    const out = []
    if (!line) return out
    line.split(',').forEach((segment) => {
      const values = []
      let shift = 0
      let value = 0
      ;[...segment].forEach((ch) => {
        const digit = B64_INDEX[ch]
        value += (digit & 31) << shift
        if (digit & 32) shift += 5
        else {
          values.push(value & 1 ? -(value >> 1) : value >> 1)
          value = 0
          shift = 0
        }
      })
      column += values[0]
      if (values.length > 1) {
        source += values[1]
        out.push([column, source])
      }
    })
    return out
  })
}

// the terser options of Next 10.2.3 (next/dist/build/webpack-config.js,
// `terserOptions`), which minified the chunks
const NEXT_TERSER = {
  parse: { ecma: 8 },
  compress: { ecma: 5, warnings: false, comparisons: false, inline: 2 },
  mangle: { safari10: true },
  output: { ecma: 5, safari10: true, comments: false, ascii_only: true },
}
const REQUIRE_CALL = /\brequire\((["'])(?:(?!\1)[^\\]|\\.)*\1\)/g

// a function with every local binding renamed in scope order ($0, $1, ...) and
// printed compactly: equal for two functions that differ only in names
const canon = (fnText) => {
  const ast = parse(`(${fnText})`, { sourceType: 'script' })
  const seen = new Set()
  let n = 0
  traverse(ast, {
    Scope(p) {
      const { scope } = p
      if (seen.has(scope)) return
      seen.add(scope)
      Object.keys(scope.bindings)
        .filter((name) => scope.bindings[name].scope === scope)
        .forEach((name) => {
          scope.rename(name, `$${n}`)
          n += 1
        })
    },
  })
  return generate(ast, { compact: true, comments: false }).code
}

// does the emitted module function equal the file? Both are reduced to the
// same form: the file gets the build's define (process.env.NODE_ENV), its
// require calls become placeholders, it is minified like the chunk, and the
// emitted function's `n("id")` calls become the same placeholders. The module
// ids are webpack's business (hashed ids of the resolved path).
const PLACEHOLDER = '__webpack_require__("#")'
const escapeRe = (name) => name.replace(/[$]/g, '\\$&')
// the third parameter of a module function is webpack's require; a module that
// does not use it has fewer parameters after minification
const requireParam = (params) => (params[2] ? params[2].name : null)
const sameModule = async (emitted, requireName, fileText) => {
  const emittedNorm = requireName
    ? emitted.replace(
        new RegExp(`\\b${escapeRe(requireName)}\\(("[^"]*"|\\d+)\\)`, 'g'),
        PLACEHOLDER
      )
    : emitted
  const rewritten = fileText
    .replace(/\bprocess\.env\.NODE_ENV\b/g, '"production"')
    .replace(REQUIRE_CALL, PLACEHOLDER)
  const wrapped = `x={a:function(module,exports,__webpack_require__){${rewritten}\n}}`
  const out = await terser.minify(wrapped, NEXT_TERSER)
  const fn = out.code.replace(/^x=\{a:/, '').replace(/\};?$/, '')
  const ownName = requireParam(
    parse(`(${fn})`, { sourceType: 'script' }).program.body[0].expression.params
  )
  const minNorm = ownName
    ? fn.replace(
        new RegExp(`\\b${escapeRe(ownName)}\\("#"\\)`, 'g'),
        PLACEHOLDER
      )
    : fn
  const count = (text) => text.split(PLACEHOLDER).length - 1
  return {
    equal: canon(emittedNorm) === canon(minNorm),
    emittedRequires: count(emittedNorm),
    fileRequires: (fileText.match(REQUIRE_CALL) || []).length,
  }
}

const DESIGN_SOURCE =
  /^webpack:\/\/[^/]*\/\.\/(node_modules\/@oacore\/design\/.+)$/

// -> [{ file, emitted, requireName }] for every design module of one chunk
const designModulesOf = (code, map) => {
  const lines = decodeMappings(map.mappings)
  const ast = parse(code, { sourceType: 'script' })
  const call = ast.program.body[0].expression
  const table = call.arguments[0].elements[1]
  return table.properties
    .map((p) => {
      const votes = {}
      for (
        let l = p.value.loc.start.line - 1;
        l <= p.value.loc.end.line - 1;
        l += 1
      ) {
        ;(lines[l] || []).forEach(([col, src]) => {
          const after =
            l > p.value.loc.start.line - 1 || col >= p.value.loc.start.column
          const before =
            l < p.value.loc.end.line - 1 || col < p.value.loc.end.column
          if (after && before) votes[src] = (votes[src] || 0) + 1
        })
      }
      const top = Object.entries(votes).sort((a, b) => b[1] - a[1])[0]
      const source = top ? map.sources[top[0]] : ''
      const m = DESIGN_SOURCE.exec(source)
      return (
        m && {
          file: m[1],
          index: Number(top[0]),
          emitted: code.slice(p.value.start, p.value.end),
          requireName: requireParam(p.value.params),
        }
      )
    })
    .filter(Boolean)
}

const analyseClient = async (nextDir, root) => {
  const res = {
    modules: [],
    mismatched: [],
    sourceDiffers: [],
    addedRequires: 0,
    designSources: 0,
  }
  const maps = walkFiles(path.join(nextDir, 'static', 'chunks')).filter((f) =>
    f.endsWith('.js.map')
  )
  for (const mapFile of maps) {
    const map = JSON.parse(fs.readFileSync(mapFile, 'utf8'))
    const designIdx = map.sources.filter((s) => DESIGN_SOURCE.test(s))
    if (designIdx.length) {
      res.designSources += designIdx.length
      const code = fs.readFileSync(mapFile.replace(/\.map$/, ''), 'utf8')
      for (const m of designModulesOf(code, map)) {
        const fileText = fs.readFileSync(path.join(root, m.file), 'utf8')
        // eslint-disable-next-line no-await-in-loop
        const r = await sameModule(m.emitted, m.requireName, fileText)
        res.modules.push(m.file)
        if (!r.equal) res.mismatched.push(m.file)
        res.addedRequires += r.emittedRequires - r.fileRequires
        if (map.sourcesContent[m.index] !== fileText)
          res.sourceDiffers.push(m.file)
      }
    }
  }
  return res
}

// the server bundles: the design package is an external there (not bundled)
const analyseServer = (nextDir) => {
  const externals = new Set()
  const bundled = []
  walkFiles(path.join(nextDir, 'server'))
    .filter((f) => f.endsWith('.js.map'))
    .forEach((f) => {
      JSON.parse(fs.readFileSync(f, 'utf8')).sources.forEach((s) => {
        const ext = /^webpack:\/\/\/external "(@oacore\/design[^"]*)"$/.exec(s)
        if (ext) externals.add(ext[1])
        else if (/@oacore\/design/.test(s)) bundled.push(s)
      })
    })
  return { externals: [...externals].sort(), bundled }
}

// ---------- c3: the script ----------

const verify = (args) => {
  const r = spawnSync(
    process.execPath,
    ['scripts/verify-design-verbatim.mjs', ...args],
    { cwd: ROOT, encoding: 'utf8', maxBuffer: 1 << 26 }
  )
  let report = null
  try {
    report = JSON.parse(r.stdout)
  } catch (e) {
    // exit 2: the reason is on stderr
  }
  return { status: r.status, report, stderr: r.stderr, stdout: r.stdout }
}

const copyTree = (from, to) => {
  fs.mkdirSync(to, { recursive: true })
  fs.readdirSync(from, { withFileTypes: true }).forEach((e) => {
    const src = path.join(from, e.name)
    const dst = path.join(to, e.name)
    if (e.isDirectory()) copyTree(src, dst)
    else fs.copyFileSync(src, dst)
  })
}

describe('T-016 @P0 vendored design', () => {
  test('T-016 c1 @P0 the installed design is a real directory, not a symlink, with 466 files', () => {
    roots().forEach((root) => {
      const i = inspectInstall(root)
      expect([root, i.symlink]).toEqual([root, false])
      expect([root, i.scopeSymlink]).toEqual([root, false])
      // the package sits where it is installed, not in a sibling checkout
      expect(i.real.endsWith(DESIGN)).toBe(true)
      expect(i.symlinks).toEqual([])
      expect([root, i.files]).toEqual([root, 466])
      expect(i.version).toBe('5.0.74')
    })
  })

  test('T-016 c1 @P0 the install check sees a symlinked package (R-075 negative control)', () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 't016-'))
    try {
      const other = path.join(tmp, 'design-checkout')
      copyTree(path.join(ROOT, DESIGN), other)
      fs.mkdirSync(path.join(tmp, 'app', 'node_modules', '@oacore'), {
        recursive: true,
      })
      fs.symlinkSync(other, path.join(tmp, 'app', DESIGN), 'dir')
      const i = inspectInstall(path.join(tmp, 'app'))
      expect(i.symlink).toBe(true)
      expect(i.real.endsWith(DESIGN)).toBe(false)
      // a symlink inside the package is seen too
      fs.rmSync(path.join(tmp, 'app', DESIGN))
      copyTree(other, path.join(tmp, 'app', DESIGN))
      fs.rmSync(path.join(tmp, 'app', DESIGN, 'lib', 'index.js'))
      fs.symlinkSync(
        path.join(other, 'lib', 'index.js'),
        path.join(tmp, 'app', DESIGN, 'lib', 'index.js')
      )
      expect(inspectInstall(path.join(tmp, 'app')).symlinks).toEqual([
        path.join('lib', 'index.js'),
      ])
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true })
    }
  })

  test('T-016 c2 @P0 the 110 emitted design modules equal their files (modulo the minifier), no core-js import added', async () => {
    if (!process.env.NEXT_DIR) {
      throw new Error(
        'T-016 c2 needs NEXT_DIR (.next of the parity image or local parity build)'
      )
    }
    const nextDir = path.resolve(process.env.NEXT_DIR)
    const root = appRoot()
    const res = await analyseClient(nextDir, root)
    // lib/index.js re-exports everything: 110 of the 114 lib modules are
    // evaluated (60 §3)
    expect(res.designSources).toBe(110)
    expect(new Set(res.modules).size).toBe(110)
    expect(res.mismatched).toEqual([])
    // the file webpack read is the installed file
    expect(res.sourceDiffers).toEqual([])
    // no import added to any module (babel's useBuiltIns: 'usage' would add
    // core-js and @babel/runtime ones)
    expect(res.addedRequires).toBe(0)
    // the server runs the installed package: it is external in every server
    // bundle (nothing of it is compiled for the server)
    const server = analyseServer(nextDir)
    expect(server.bundled).toEqual([])
    expect(server.externals).toEqual([
      '@oacore/design',
      '@oacore/design/lib',
      '@oacore/design/lib/elements',
      '@oacore/design/lib/elements/logo',
      '@oacore/design/lib/modules',
      '@oacore/design/lib/utils',
      '@oacore/design/lib/utils/class-names',
    ])
  }, 300000)

  test('T-016 c2 @P0 the module comparison sees an injected core-js import, a changed literal and an added statement (negative controls)', async () => {
    const file = path.join(ROOT, DESIGN, 'lib', 'elements', 'heading.js')
    const text = fs.readFileSync(file, 'utf8')
    // the module as the build emits it: the file with its requires replaced by
    // module ids, minified like the chunk
    const wrapped = `x={a:function(module,exports,__webpack_require__){${text
      .replace(/\bprocess\.env\.NODE_ENV\b/g, '"production"')
      .replace(REQUIRE_CALL, '__webpack_require__("ab12")')}\n}}`
    const out = await terser.minify(wrapped, NEXT_TERSER)
    const emitted = out.code.replace(/^x=\{a:/, '').replace(/\};?$/, '')
    const param = /^function\(\w,\w,(\w)\)/.exec(emitted)[1]
    const compare = (fn) => sameModule(fn, param, text)

    const same = await compare(emitted)
    expect(same.equal).toBe(true)
    expect(same.emittedRequires).toBe(same.fileRequires)
    expect(same.fileRequires).toBeGreaterThan(0)
    // babel's useBuiltIns: 'usage' puts imports in front of the module body
    const injected = await compare(
      emitted.replace(
        '{"use strict";',
        `{"use strict";${param}("zz99");${param}("zz98");`
      )
    )
    expect(injected.equal).toBe(false)
    expect(injected.emittedRequires - injected.fileRequires).toBe(2)
    // a changed directive, an added statement
    expect(
      (await compare(emitted.replace('"use strict"', '"use sloppy"'))).equal
    ).toBe(false)
    const added = await compare(emitted.replace(/\}$/, ',t.displayName="X"}'))
    expect(added.equal).toBe(false)
    expect(added.emittedRequires).toBe(added.fileRequires)
  }, 120000)

  test('T-016 c2 @P0 a tampered chunk is flagged: one changed directive, one changed source (negative control)', async () => {
    if (!process.env.NEXT_DIR) throw new Error('T-016 c2 needs NEXT_DIR')
    const nextDir = path.resolve(process.env.NEXT_DIR)
    const root = appRoot()
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 't016-chunk-'))
    try {
      const chunks = walkFiles(path.join(nextDir, 'static', 'chunks'))
        .filter((f) => f.endsWith('.js.map'))
        .filter((f) =>
          JSON.parse(fs.readFileSync(f, 'utf8')).sources.some((src) =>
            DESIGN_SOURCE.test(src)
          )
        )
      expect(chunks.length).toBeGreaterThan(0)
      const mapFile = chunks[0]
      const code = fs.readFileSync(mapFile.replace(/\.map$/, ''), 'utf8')
      const map = JSON.parse(fs.readFileSync(mapFile, 'utf8'))
      const mods = designModulesOf(code, map)
      const strict = mods.filter((m) =>
        /^function\(\w,\w,\w\)\{"use strict";/.test(m.emitted)
      )
      const [victim, other] = [strict[0], strict[1]]
      // same-length edit: the offsets of the source map stay valid
      const at =
        code.indexOf(victim.emitted) + victim.emitted.indexOf('"use strict"')
      const tampered = `${code.slice(0, at)}"use sloppy"${code.slice(at + 12)}`
      expect(tampered).toHaveLength(code.length)
      map.sourcesContent[other.index] += '\n// edited'
      const dir = path.join(tmp, '.next', 'static', 'chunks')
      fs.mkdirSync(dir, { recursive: true })
      const name = path.basename(mapFile)
      fs.writeFileSync(path.join(dir, name.replace(/\.map$/, '')), tampered)
      fs.writeFileSync(path.join(dir, name), JSON.stringify(map))
      const res = await analyseClient(path.join(tmp, '.next'), root)
      expect(res.designSources).toBe(
        map.sources.filter((src) => DESIGN_SOURCE.test(src)).length
      )
      expect(res.mismatched).toEqual([victim.file])
      expect(res.sourceDiffers).toEqual([other.file])
      expect(res.addedRequires).toBe(0)
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true })
    }
  }, 300000)

  test('T-016 c3 @P0 verify-design-verbatim: the installed design equals the 5.0.74 tarball except lib/config.js', () => {
    const tarballDir = fs.mkdtempSync(path.join(os.tmpdir(), 't016-tgz-'))
    try {
      roots().forEach((root) => {
        const r = verify([
          '--root',
          root,
          '--tarball-dir',
          tarballDir,
          '--json',
        ])
        if (r.status !== 0) throw new Error(`${root}: ${r.stderr || r.stdout}`)
        const rep = r.report
        expect(rep.tarball.spec).toBe('@oacore/design@5.0.74')
        expect(rep.tarball.files).toBe(466)
        expect(rep.tarball.sha1).toBe(
          'e6a401d74defeb09d828b10374ff35107a9324c4'
        )
        expect(rep.tarball.integrity).toBe(rep.lock.integrity)
        expect(rep.tarball.integrity).toMatch(/^sha512-kwYolSk\+PrJtJzSkhy/)
        expect(rep.installedCopy).toBe(true)
        expect(rep.installed.files).toBe(466)
        expect(rep.installed.symlinks).toEqual([])
        // the whole difference: the file the postinstall writes
        expect(rep.diff).toEqual({
          differ: ['lib/config.js'],
          onlyTarball: [],
          onlyInstalled: [],
        })
        expect(rep.changes).toEqual({ file: null, files: [] })
        expect(rep.problems).toEqual([])
        expect(rep.ok).toBe(true)
      })
      expect(
        fs.readdirSync(tarballDir).filter((f) => f.endsWith('.tgz'))
      ).toEqual(['oacore-design-5.0.74.tgz'])
    } finally {
      fs.rmSync(tarballDir, { recursive: true, force: true })
    }
  }, 120000)

  test('T-016 c3 @P0 the verifier fails on a changed, added or missing file, a symlink, and a CHANGES row without a change (negative controls)', () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 't016-ctl-'))
    try {
      const tgzDir = path.join(tmp, 'tgz')
      fs.mkdirSync(tgzDir)
      const first = verify(['--tarball-dir', tgzDir, '--json'])
      expect(first.status).toBe(0)
      const tgz = path.join(tgzDir, 'oacore-design-5.0.74.tgz')
      expect(fs.existsSync(tgz)).toBe(true)
      const fresh = (name) => {
        const dir = path.join(tmp, name, DESIGN)
        copyTree(path.join(ROOT, DESIGN), dir)
        return dir
      }
      const run = (dir, extra = []) =>
        verify(['--tarball', tgz, '--target', dir, '--json', ...extra])

      // an untouched copy passes
      const ok = fresh('ok')
      expect(run(ok).status).toBe(0)

      // a changed byte
      const changed = fresh('changed')
      fs.appendFileSync(path.join(changed, 'lib', 'index.js'), '\n// x\n')
      let r = run(changed)
      expect(r.status).toBe(1)
      expect(r.report.diff.differ).toEqual(['lib/config.js', 'lib/index.js'])
      expect(r.report.problems.join()).toMatch(
        /not allowed to differ: lib\/index\.js/
      )

      // an added file
      const added = fresh('added')
      fs.writeFileSync(
        path.join(added, 'lib', 'extra.js'),
        'module.exports = 1\n'
      )
      r = run(added)
      expect(r.status).toBe(1)
      expect(r.report.diff.onlyInstalled).toEqual(['lib/extra.js'])

      // a missing file
      const missing = fresh('missing')
      fs.rmSync(path.join(missing, 'lib', 'index.css'))
      r = run(missing)
      expect(r.status).toBe(1)
      expect(r.report.diff.onlyTarball).toEqual(['lib/index.css'])

      // a symlinked file, and a symlinked package (R-075)
      const linked = fresh('linked')
      fs.rmSync(path.join(linked, 'lib', 'index.js'))
      fs.symlinkSync(
        path.join(ROOT, DESIGN, 'lib', 'index.js'),
        path.join(linked, 'lib', 'index.js')
      )
      r = run(linked)
      expect(r.status).toBe(1)
      expect(r.report.problems.join()).toMatch(/symlink in the copy/)
      const dirLink = path.join(tmp, 'dirlink', DESIGN)
      fs.mkdirSync(path.dirname(dirLink), { recursive: true })
      fs.symlinkSync(ok, dirLink, 'dir')
      r = run(dirLink)
      expect(r.status).toBe(1)
      expect(r.report.problems.join()).toMatch(/symlink in the copy/)

      // CHANGES.md lists the edits (60 §2): a listed edit passes, a row for an
      // unchanged file is stale
      const edited = fresh('edited')
      fs.appendFileSync(path.join(edited, 'lib', 'index.js'), '\n// x\n')
      const changes = path.join(tmp, 'CHANGES.md')
      const table = (file) =>
        `| File | Change | CS/Q | PR | Test |\n| --- | --- | --- | --- | --- |\n| \`${file}\` | x | CS-1 | 1 | T-016 |\n`
      fs.writeFileSync(changes, table('lib/index.js'))
      r = run(edited, ['--changes', changes])
      expect(r.status).toBe(0)
      expect(r.report.changes.files).toEqual(['lib/index.js'])
      fs.writeFileSync(changes, table('lib/elements/heading.js'))
      r = run(edited, ['--changes', changes])
      expect(r.status).toBe(1)
      expect(r.report.problems.join()).toMatch(
        /without a difference: lib\/elements\/heading\.js/
      )

      // outside node_modules (a vendored copy) lib/config.js is no exception
      const vendored = path.join(tmp, 'vendor', 'oacore-design')
      copyTree(path.join(ROOT, DESIGN), vendored)
      r = run(vendored)
      expect(r.status).toBe(1)
      expect(r.report.installedCopy).toBe(false)
      expect(r.report.problems.join()).toMatch(
        /not allowed to differ: lib\/config\.js/
      )
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true })
    }
  }, 180000)
})
