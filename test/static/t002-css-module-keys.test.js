// T-002 (41 A; R-001): CSS-module keys, from source. The 67 files that import a
// `*.module.css` read class names as `styles.<id>` or `styles['dashed-name']`;
// until step 6.9 next.config.js patched css-loader to also export every class
// under its camelCase form, and 202 reads used only that form (CS-CSS-2 made
// them dashed reads, CS-CSS-3 removed the patch). This test checks every read
// against the keys of its module (the harness CSS-module transform models
// Next's convention, 40 §2.1). It is blind to the build no-op behind R-001 by design:
// T-003, T-605 and T-801 see that.
//
// Existing bug, pinned (D1): 24 reads name a class that is not in their module
// (`styles.modal`, `styles.ellipsis`, ...). They evaluate to `undefined`, so
// the element gets no class; the plan's "every read exists" does not hold on
// the unchanged app (PINNED_DANGLING). A new dangling read, or one that gets
// fixed, changes this list and fails the test.
// The plan's "430 reads" is a grep token count of `styles.<letters>`; the real
// member reads are 365 (see the reconciliation test).
const fs = require('fs')
const path = require('path')
const { execFileSync } = require('child_process')

const { parse } = require('@babel/parser')

const { exportsFor } = require('../transforms/css-module')

const ROOT = path.resolve(__dirname, '..', '..')
const has = (o, k) => Object.prototype.hasOwnProperty.call(o, k)
const git = (...args) =>
  execFileSync('git', ['-C', ROOT, ...args], {
    encoding: 'utf8',
    maxBuffer: 1 << 26,
  })
    .split('\0')
    .filter(Boolean)
    .sort()

// application sources: tracked or new, outside the harness and the tooling
const sourceFiles = () =>
  git(
    'ls-files',
    '-z',
    '--cached',
    '--others',
    '--exclude-standard',
    '--',
    '*.js',
    '*.jsx',
    '*.ts',
    '*.tsx'
  ).filter(
    // the vendored design is not application source (CS-DSN-2, AD-044); its
    // installed copy under node_modules is left out as before
    (f) =>
      !/^(test|e2e|scripts|tools|docs|node_modules|vendor\/oacore-design)\//.test(
        f
      ) && f !== 'jest.config.js'
  )
const cssModules = () => git('ls-files', '-z', '--', '*.module.css')

const PARSER_PLUGINS = [
  'jsx',
  'decorators-legacy',
  'classProperties',
  'exportDefaultFrom',
  'dynamicImport',
]
const SKIP = new Set(['loc', 'start', 'end', 'extra'])
// preorder walk over a Babel AST: visit(node, parent, key)
const walk = (node, visit, parent = null, key = null) => {
  if (!node || typeof node.type !== 'string') return
  visit(node, parent, key)
  Object.keys(node).forEach((k) => {
    if (SKIP.has(k) || /Comments$/.test(k)) return
    const v = node[k]
    if (Array.isArray(v)) v.forEach((c) => walk(c, visit, node, k))
    else if (v && typeof v.type === 'string') walk(v, visit, node, k)
  })
}

const count = (text, re) => [...text.matchAll(re)].length

// the CSS-module bindings of one file: local name -> repo-relative module
const importsOf = (file, program, out) => {
  const bindings = new Map()
  program.body
    .filter((n) => n.type === 'ImportDeclaration')
    .filter((n) => /\.css$/.test(n.source.value))
    .forEach((n) => {
      const spec = n.source.value
      if (!/\.module\.css$/.test(spec)) {
        out.otherCssImports.push([file, spec, n.specifiers.length])
        return
      }
      const css = path
        .relative(ROOT, path.resolve(ROOT, path.dirname(file), spec))
        .split(path.sep)
        .join('/')
      out.modules.add(css)
      n.specifiers.forEach((s) => {
        if (s.type !== 'ImportDefaultSpecifier')
          throw new Error(`${file}: only default imports of ${spec} expected`)
        bindings.set(s.local.name, css)
      })
    })
  return bindings
}

const readsOf = (file, src, program, bindings, out) => {
  walk(program, (node, parent, key) => {
    const isRead =
      node.type === 'MemberExpression' &&
      node.object.type === 'Identifier' &&
      bindings.has(node.object.name)
    if (isRead) {
      const css = bindings.get(node.object.name)
      const p = node.property
      const dynamicRead = node.computed && p.type !== 'StringLiteral'
      if (dynamicRead) {
        const expr = src.slice(node.start, node.end)
        out.dynamic.push({ file, css, expr })
      } else
        out.reads.push({ file, css, key: node.computed ? p.value : p.name })
    } else if (node.type === 'Identifier' && bindings.has(node.name)) {
      const isObject = parent.type === 'MemberExpression' && key === 'object'
      if (!isObject && parent.type !== 'ImportDefaultSpecifier')
        out.bare.push({ file, use: src.slice(parent.start, parent.end) })
    }
  })
}

const scan = () => {
  const out = {
    importers: [],
    modules: new Set(),
    otherCssImports: [],
    reads: [],
    dynamic: [],
    bare: [],
    tokens: { all: 0, modulePath: 0, outsideImporters: 0, camel: 0 },
  }
  sourceFiles().forEach((file) => {
    const src = fs.readFileSync(path.join(ROOT, file), 'utf8')
    const tokens = [...src.matchAll(/styles\.[A-Za-z_]+/g)].map((m) => m[0])
    const modulePath = tokens.filter((t) => t === 'styles.module').length
    out.tokens.all += tokens.length
    out.tokens.modulePath += modulePath
    out.tokens.camel += count(src, /styles\.[a-z]+[A-Z][A-Za-z]*/g)
    const { program } = parse(src, {
      sourceType: 'module',
      // CS-TS-4 (6.6): the moved .ts/.tsx sources carry type annotations
      plugins: /\.tsx?$/.test(file)
        ? [...PARSER_PLUGINS, 'typescript']
        : PARSER_PLUGINS,
    })
    const bindings = importsOf(file, program, out)
    if (!bindings.size) {
      out.tokens.outsideImporters += tokens.length - modulePath
      return
    }
    out.importers.push({ file, css: [...new Set(bindings.values())] })
    readsOf(file, src, program, bindings, out)
  })
  const keysOf = {}
  out.keys = (css) => {
    if (!keysOf[css]) {
      const text = fs.readFileSync(path.join(ROOT, css), 'utf8')
      keysOf[css] = exportsFor(text, css)
    }
    return keysOf[css]
  }
  // found under its original name, only under the camelCase form, or not at all
  out.reads.forEach((r) => {
    const keys = out.keys(r.css)
    if (!has(keys, r.key)) r.kind = 'dangling'
    else r.kind = keys[r.key] === r.key ? 'original' : 'camelCase'
  })
  return out
}

// 24 reads of a class that its module does not define (existing bug, D1):
// [file, key, reads]
const PINNED_DANGLING = [
  ['modules/dropdown/index.tsx', 'ellipsis', 2],
  ['modules/filters/bar-item.tsx', 'barItemIcon', 1],
  ['modules/filters/bar-item.tsx', 'sortBarItem', 1],
  ['modules/filters/loading-block.tsx', 'barItemIcon', 1],
  ['templates/data-provider/claim/claim-modal-edit.tsx', 'modal', 1],
  ['templates/data-provider/claim/claim-success-modal.tsx', 'modal', 1],
  ['templates/data-provider/index.tsx', 'headerInfo', 1],
  ['templates/data-provider/index.tsx', 'headerInfoCaptionColor', 1],
  ['templates/data-provider/index.tsx', 'headerInfoCaptionLink', 1],
  ['templates/data-provider/index.tsx', 'headerInfoCaptionLinkColor', 1],
  ['templates/data-provider/logo.tsx', 'repositoryLogo', 1],
  ['templates/output/card-dropdown.tsx', 'dropdownContent', 1],
  ['templates/output/index.tsx', 'oaiLogo', 1],
  ['templates/output/index.tsx', 'oaiModalTitle', 1],
  ['templates/output/report/report-form-modal.tsx', 'modal', 1],
  ['templates/output/report/report-success-modal.tsx', 'customLink', 1],
  ['templates/output/report/report-success-modal.tsx', 'modal', 1],
  ['templates/output/report/report-type-modal.tsx', 'modal', 1],
  ['templates/output/similar-works.tsx', 'searchResult', 1],
  ['templates/search/index.tsx', 'more', 1],
  ['templates/search/index.tsx', 'sort', 1],
  ['templates/search/modals/download-results.tsx', 'modal', 1],
  ['templates/search/sort.tsx', 'sortBoxIcon', 1],
]

// reads grouped by (file, key), sorted
const group = (reads) => {
  const m = new Map()
  reads.forEach((r) => {
    const k = `${r.file}\u0000${r.key}`
    m.set(k, (m.get(k) || 0) + 1)
  })
  return [...m]
    .map(([k, n]) => [...k.split('\u0000'), n])
    .sort((a, b) => {
      if (a[0] !== b[0]) return a[0] < b[0] ? -1 : 1
      return a[1] < b[1] ? -1 : 1
    })
}

describe('T-002 @P0 CSS-module keys (source)', () => {
  let s
  beforeAll(() => {
    s = scan()
  }, 120000)

  test('T-002 @P0 67 files import a *.module.css (all .tsx, default imports): the 26 CSS modules of the repository', () => {
    expect(s.importers).toHaveLength(67) // AD-157
    // CS-TS-4 (6.6): the importers are .tsx since the move
    expect(s.importers.filter((i) => !/\.tsx$/.test(i.file))).toEqual([])
    // one CSS module per importer
    expect(s.importers.filter((i) => i.css.length !== 1)).toEqual([])
    expect([...s.modules].sort()).toEqual(cssModules())
    expect(s.modules.size).toBe(26)
    // other CSS imports: the global ones of pages/_app.jsx, without bindings
    const other = s.otherCssImports
    expect(other.map((c) => c[0])).toEqual(
      Array(other.length).fill('pages/_app.tsx')
    )
    expect(other.filter((c) => c[2] !== 0)).toEqual([])
    expect(other.map((c) => c[1])).toEqual(
      expect.arrayContaining([
        'main/global.css',
        // the frozen design CSS (CS-DSN-6, DV7)
        '../styles/global/design/index.css',
      ])
    )
  })

  test('T-002 @P0 365 member reads of the module bindings; the one computed read is styles[size] of modules/logo; no other use', () => {
    expect(s.reads).toHaveLength(365) // AD-157
    expect(s.dynamic).toEqual([
      {
        file: 'modules/logo/index.tsx',
        css: 'modules/logo/styles.module.css',
        expr: 'styles[size]',
      },
    ])
    // the default size 'md' exists in the module; modules/logo is never given
    // another size
    expect(has(s.keys('modules/logo/styles.module.css'), 'md')).toBe(true)
    // no spread, argument or alias of the binding that would hide reads
    expect(s.bare).toEqual([])
  })

  test('T-002 @P0 every styles.<id> read exists in its module under the original or the camelCase key, except the 24 pinned dangling reads', () => {
    const dangling = s.reads.filter((r) => r.kind === 'dangling')
    expect(group(dangling)).toEqual(PINNED_DANGLING)
    expect(dangling).toHaveLength(24)
    // everything else resolves (AD-157)
    expect(s.reads.filter((r) => r.kind !== 'dangling')).toHaveLength(341)
  })

  test("T-002 @P0 every resolving read names its class as written (CS-CSS-2: the 202 camelCase-only reads in 48 files became styles['dashed-name']); none needs the camelCase export (R-001)", () => {
    const camel = s.reads.filter((r) => r.kind === 'camelCase')
    expect(camel).toHaveLength(0)
    // the 341 resolve under the original name: 337 plain or dashed ones and
    // the 4 classes that are written in camelCase in the CSS
    const original = s.reads.filter((r) => r.kind === 'original')
    expect(original).toHaveLength(341)
    expect(original.filter((r) => /-/.test(r.key))).toHaveLength(202)
    const spelledCamel = original
      .map((r) => r.key)
      .filter((k) => /[A-Z]/.test(k))
    expect([...new Set(spelledCamel)].sort()).toEqual([
      'activeClass',
      'maintenanceBanner',
      'maintenanceBannerText',
      'memberType',
    ])
  })

  test("T-002 @P0 the key model: every class is exported under its name as written, no camelCase form (CS-CSS-3, Next's asIs convention)", () => {
    let dashed = 0
    cssModules().forEach((css) => {
      const text = fs.readFileSync(path.join(ROOT, css), 'utf8')
      const keys = exportsFor(text, css)
      Object.entries(keys).forEach(([key, original]) => {
        expect(key).toBe(original)
      })
      dashed += Object.keys(keys).filter((k) =>
        /^[a-z][a-z0-9]*(-[a-z0-9]+)+$/.test(k)
      ).length
    })
    expect(dashed).toBeGreaterThan(150)
  })

  test("T-002 @P0 the plan's grep figures reconcile with the member reads: 433 tokens and 221 camelCase tokens before CS-CSS-2, 202 fewer since", () => {
    // 430 = git grep -o 'styles\.[A-Za-z_]+' over the application sources;
    // CS-CSS-2 turned 202 of them into styles['dashed-name']
    expect(s.tokens.all).toBe(437 - 202) // AD-110, AD-157
    // `./styles.module.css` import paths
    expect(s.tokens.modulePath).toBe(62) // AD-157
    // styles.length and styles.map in api/outputs.js
    expect(s.tokens.outsideImporters).toBe(6) // AD-111
    // styles.<id> in commented-out JSX (modules/layout, thumbnail-card)
    const inComments = 4
    // AD-157
    expect(s.reads.length + inComments + s.tokens.modulePath + 2).toBe(433)
    // 221 = the tokens spelled in camelCase before CS-CSS-2: 202 + 4 + 14
    // reads and one commented-out token; the 202 are dashed reads now
    expect(s.tokens.camel).toBe(221 - 202)
    const spelled = s.reads.filter((r) => /^[a-z]+[A-Z][A-Za-z]*$/.test(r.key))
    expect(spelled).toHaveLength(220 - 202)
  })
})
