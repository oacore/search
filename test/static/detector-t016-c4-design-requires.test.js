// T-016 c4 (41 A; VG-2; R-025): in the client bundles, every require of an
// emitted @oacore/design module resolves to a package module (node_modules/**
// or a webpack built-in), never to a module of the app tree. The app's webpack
// aliases (next.config.js: hooks, utils, modules, lib, store, ...) shadow bare
// specifiers of the same name; design code compiled with them (a copy of the
// design source in the app tree, W5 layout A, 7.1) silently uses the app's
// same-named modules. The app's hooks/use-window-size and
// hooks/use-outside-click are verbatim copies of the design's own hooks today,
// so no rendered state, pixel or request shows such a hit: only the module
// graph does (R-025).
//
// Reads the production client chunks and their source maps (webpack 4 of
// Next 10.2.3, hashed module ids; the Next 10 adapter, ./adapters/next10.js):
// module id -> source path by the mapped segments inside each module
// function; edges = the calls of the module function's require parameter
// (`n("id")`, and `n.bind(null, "id")` for lazy loads), scope-aware, so a
// nested local of the same name is not an edge. When the design is vendored
// or copied into the app tree (W0.5, W5), its directory joins DESIGN_ROOTS.
const { traverse } = require('@babel/core')
const { parse } = require('@babel/parser')

const { buildDirs, openBuild, byCodePoint } = require('./adapters')
const { SourceMap } = require('./adapters/sourcemap')
const { normaliseSource } = require('./adapters/next10')

const DESIGN_ROOTS = ['node_modules/@oacore/design/']
const isDesign = (p) => DESIGN_ROOTS.some((r) => p.startsWith(r))
// a module outside the app tree: an installed package, a webpack built-in
// (`(webpack)/...`) or the design itself
const isPackage = (p) =>
  p.startsWith('node_modules/') || p.startsWith('(webpack)/') || isDesign(p)

// the modules table of a webpack 4 JSONP chunk,
// `(window.webpackJsonp_N_E = ...).push([[chunk ids], {id: function}])`,
// possibly assigned (`_N_E = ...`): [[id, function node]]
const modulesOf = (ast) => {
  const st = ast.program.body[0]
  if (!st || st.type !== 'ExpressionStatement') return []
  let e = st.expression
  if (e.type === 'AssignmentExpression') e = e.right
  if (
    e.type !== 'CallExpression' ||
    e.callee.type !== 'MemberExpression' ||
    e.callee.property.name !== 'push'
  )
    return []
  const arg = e.arguments[0]
  const table = arg && arg.type === 'ArrayExpression' && arg.elements[1]
  if (!table) return []
  if (table.type === 'ObjectExpression') {
    return table.properties.map((p) => [
      p.key.type === 'Identifier' ? p.key.name : String(p.key.value),
      p.value,
    ])
  }
  if (table.type === 'ArrayExpression')
    return table.elements.map((fn, i) => fn && [String(i), fn]).filter(Boolean)

  return []
}

// source path of a module function: the source most of the mapped segments
// inside it belong to
const sourceOf = (map, fn) => {
  const votes = new Map()
  const first = fn.loc.start.line - 1
  const last = fn.loc.end.line - 1
  for (let l = first; l <= last; l++) {
    for (const seg of map.lines[l] || []) {
      const inside =
        seg.length >= 4 &&
        (l > first || seg[0] >= fn.loc.start.column) &&
        (l < last || seg[0] < fn.loc.end.column)
      if (inside) votes.set(seg[1], (votes.get(seg[1]) || 0) + 1)
    }
  }
  const top = [...votes].sort((a, b) => b[1] - a[1])[0]
  return top ? normaliseSource(map.sources[top[0]]).path : null
}

// module ids a module function requires through its third parameter
const requiredIds = (fnText) => {
  const ids = []
  const ast = parse(`(${fnText})`, { sourceType: 'script' })
  traverse(ast, {
    Program(p) {
      const fn = p.get('body.0.expression')
      const param = fn.node.params[2]
      const binding = param && fn.scope.getBinding(param.name)
      if (!binding) return
      const literal = (node) =>
        node &&
        (node.type === 'StringLiteral' || node.type === 'NumericLiteral')
          ? String(node.value)
          : '<dynamic>'
      for (const ref of binding.referencePaths) {
        const parent = ref.parentPath
        if (parent.isCallExpression() && parent.node.callee === ref.node)
          ids.push(literal(parent.node.arguments[0]))
        else if (
          parent.isMemberExpression() &&
          parent.node.object === ref.node &&
          !parent.node.computed &&
          parent.node.property.name === 'bind' &&
          parent.parentPath.isCallExpression() &&
          parent.parentPath.node.callee === parent.node
        )
          ids.push(literal(parent.parentPath.node.arguments[1]))
      }
      p.stop()
    },
  })
  return ids
}

// scripts [{rel, code, map}] -> {designModules, edges, appTargets, unresolved}
function designEdges(scripts) {
  const idSource = new Map()
  const design = []
  // a script without a map holds no module this check can name: the
  // requires into it stay unresolved
  for (const s of scripts.filter((x) => x.map)) {
    const ast = parse(s.code, { sourceType: 'script' })
    for (const [id, fn] of modulesOf(ast)) {
      const src = sourceOf(s.map, fn) || `<unmapped:${s.rel}:${id}>`
      idSource.set(id, src)
      if (isDesign(src))
        design.push({ src, text: s.code.slice(fn.start, fn.end) })
    }
  }
  const appTargets = new Set()
  const unresolved = new Set()
  let edges = 0
  for (const m of design) {
    for (const id of requiredIds(m.text)) {
      edges++
      const target = idSource.get(id)
      if (!target) unresolved.add(`${m.src} -> ${id}`)
      else if (!isPackage(target)) appTargets.add(`${m.src} -> ${target}`)
    }
  }
  return {
    designModules: new Set(design.map((m) => m.src)).size,
    edges,
    appTargets: [...appTargets].sort(byCodePoint),
    unresolved: [...unresolved].sort(byCodePoint),
  }
}

// ---------- negative control: a synthetic chunk with its source map ----------

const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'
const vlq = (n) => {
  let v = n < 0 ? (-n << 1) | 1 : n << 1
  let out = ''
  do {
    let digit = v & 31
    v >>>= 5
    if (v) digit |= 32
    out += B64[digit]
  } while (v)
  return out
}
// one generated line; a segment at the start of each module function, mapped
// to its source (line 0, column 0)
const syntheticChunk = (modules) => {
  let code = '(window.webpackJsonp_N_E=window.webpackJsonp_N_E||[]).push([[7],{'
  const segments = []
  let lastCol = 0
  let lastSrc = 0
  modules.forEach(([id, fnText], i) => {
    code += `${i ? ',' : ''}${JSON.stringify(id)}:`
    segments.push(`${vlq(code.length - lastCol)}${vlq(i - lastSrc)}AA`)
    lastCol = code.length
    lastSrc = i
    code += fnText
  })
  code += '}]);'
  const map = new SourceMap({
    version: 3,
    sources: modules.map(([, , src]) => `webpack://_N_E/./${src}`),
    names: [],
    mappings: segments.join(','),
  })
  return { rel: 'static/chunks/synthetic.js', code, map }
}

describe('T-016 @P0 vendored design: client require edges', () => {
  test('T-016 c4 @P0 every require of the 110 bundled design modules resolves to a package module, none into the app tree (R-025 alias hit)', () => {
    const build = openBuild(buildDirs('T-016'))
    const res = designEdges(build.clientScripts())
    // the same 110 modules as c2 (lib/index.js re-exports everything)
    expect(res.designModules).toBe(110)
    expect(res.edges).toBeGreaterThan(0)
    expect(res.unresolved).toEqual([])
    expect(res.appTargets).toEqual([])
  }, 120000)

  test('T-016 c4 @P0 the edge check sees a design require resolved into the app tree, and ignores a nested local of the same name (negative control)', () => {
    const chunk = syntheticChunk([
      [
        'a1',
        'function(e,t,n){var r=n("b2"),o=n("c3");function i(n){return n("zz")}n.e(1).then(n.bind(null,"d4"))}',
        'node_modules/@oacore/design/lib/modules/header/search-bar.js',
      ],
      ['b2', 'function(e,t){t.a=1}', 'hooks/use-window-size.js'],
      ['c3', 'function(e,t){t.b=2}', 'node_modules/react/index.js'],
      [
        'd4',
        'function(e,t){t.c=3}',
        'node_modules/@oacore/design/lib/hooks/index.js',
      ],
    ])
    const res = designEdges([chunk])
    expect(res.designModules).toBe(2)
    // n("b2"), n("c3"), n.bind(null, "d4"); the nested n("zz") is a local
    expect(res.edges).toBe(3)
    expect(res.unresolved).toEqual([])
    expect(res.appTargets).toEqual([
      'node_modules/@oacore/design/lib/modules/header/search-bar.js -> hooks/use-window-size.js',
    ])
  })
})
