// T-015 (41 A; R-077): the JavaScript syntax floor of the client chunks, read
// with es-check 9.8.1 (root devDependency, exact). Every .js file under the
// build's .next/static (page, framework, main, webpack, polyfills and shared
// chunks, plus the per-build manifests) is parsed at an ECMAScript version; the
// floor is the lowest version of the ladder at which all of them parse.
//
// The floor is recorded per Next version (the step record: W4d, W7a, W7c and
// 7.0 re-measure it). Next 10.2.3 ships ES2015: two shared chunks carry
// untranspiled dependency code (an arrow function in one, a class in the
// other), so ES5 fails, while .browserslistrc governs Babel only (R-077). A
// Next, Babel or dependency change that raises the floor fails c2 until the
// new floor is recorded here with the step. The floor of a Next version that
// is not listed is not known: c1 and c2 fail and name the version; add it to
// FLOORS from the first measurement of that step.
const fs = require('fs')
const path = require('path')

const { runChecks } = require('es-check')

const { buildDirs, openBuild, ROOT, byCodePoint } = require('./adapters')

// es-check ecmaVersion names, lowest first
const LADDER = [
  'es5',
  'es2015',
  'es2016',
  'es2017',
  'es2018',
  'es2019',
  'es2020',
  'es2021',
  'es2022',
]

// Next version -> floor of its client chunks on the parity build (step record)
const FLOORS = {
  '10.2.3': 'es2015',
  // W4c, first measurement on 12.1.6: unchanged
  '12.1.6': 'es2015',
  // W4d, first measurement on 12.3.7: unchanged
  '12.3.7': 'es2015',
  // W6c, first measurement on 13.5.11: unchanged
  '13.5.11': 'es2015',
  // W6d, measured on 14.2.35 with CS-N14-2: unchanged
  '14.2.35': 'es2015',
}

const walk = (dir) =>
  fs.existsSync(dir)
    ? fs
        .readdirSync(dir, { withFileTypes: true })
        .sort((a, b) => byCodePoint(a.name, b.name))
        .flatMap((e) =>
          e.isDirectory()
            ? walk(path.join(dir, e.name))
            : [path.join(dir, e.name)]
        )
    : []

// the version of the Next that produced the build: the build's own
// node_modules, else the repo's
function nextVersionOf(appRoot) {
  for (const root of [appRoot, ROOT]) {
    const file = path.join(root, 'node_modules', 'next', 'package.json')
    if (fs.existsSync(file))
      return JSON.parse(fs.readFileSync(file, 'utf8')).version
  }
  throw new Error(`T-015: no node_modules/next/package.json under ${appRoot}`)
}

// One es-check run through the Node API. A run with a logger reports the
// number of files it parsed ("checking N files"); es-check then also maps every
// error back through the source maps (about 20 s on this build), so a run that
// may fail passes no logger. -> {success, failedFiles, checked}
function check(files, ecmaVersion, { count = false, base = '' } = {}) {
  const infos = []
  const options = count
    ? {
        logger: {
          info: (...a) => infos.push(a.join(' ')),
          error: () => {},
          warn: () => {},
          debug: () => {},
          isLevelEnabled: (level) => level === 'info' || level === 'error',
        },
      }
    : {}
  const result = runChecks([{ ecmaVersion, files, cache: false }], options)
  const line = infos.find((m) => /checking \d+ files?/.test(m))
  return {
    success: result.success,
    checked: line ? Number(line.match(/checking (\d+) file/)[1]) : null,
    failedFiles: [
      ...new Set(
        result.errors.map((e) =>
          path.isAbsolute(e.file)
            ? path.relative(base, e.file).replace(/\\/g, '/')
            : e.file
        )
      ),
    ].sort(byCodePoint),
  }
}

describe('T-015 @P1 JS syntax floor (es-check on client chunks)', () => {
  let nextDir
  let files
  let version
  // one es-check run per version, on demand (each run parses every chunk)
  const runs = new Map()
  const at = (v) => {
    if (!runs.has(v)) runs.set(v, check(files, v, { base: nextDir }))
    return runs.get(v)
  }

  beforeAll(() => {
    const build = openBuild(buildDirs('T-015'))
    nextDir = build.dir
    files = walk(path.join(nextDir, 'static'))
      .filter((f) => f.endsWith('.js'))
      .sort(byCodePoint)
    version = nextVersionOf(build.appRoot)
  })

  test('T-015 c1 @P1 es-check parses every client chunk at the recorded floor of the Next version', () => {
    expect(Object.keys(FLOORS)).toContain(version)
    const result = at(FLOORS[version])
    expect(result.failedFiles).toEqual([])
    expect(result.success).toBe(true)
  })

  test('T-015 c1 @P1 es-check checked all client chunks: every .js file of the build manifest, the polyfills and the page chunks', () => {
    const rel = (f) => path.relative(nextDir, f).replace(/\\/g, '/')
    const checkedSet = new Set(files.map(rel))
    expect(files.length).toBeGreaterThan(0)
    expect(check(files, FLOORS[version], { count: true })).toEqual({
      success: true,
      checked: files.length,
      failedFiles: [],
    })

    const manifest = JSON.parse(
      fs.readFileSync(path.join(nextDir, 'build-manifest.json'), 'utf8')
    )
    const referenced = new Set([
      ...manifest.polyfillFiles,
      ...manifest.lowPriorityFiles,
      ...Object.values(manifest.pages).flat(),
    ])
    const missing = [...referenced]
      .filter((f) => f.endsWith('.js') && !checkedSet.has(f))
      .sort(byCodePoint)
    expect(missing).toEqual([])
    expect(
      files.some((f) => /static\/chunks\/polyfills-[0-9a-f]+\.js$/.test(rel(f)))
    ).toBe(true)
    expect(
      files.some((f) =>
        /static\/chunks\/pages\/_app-[0-9a-f]+\.js$/.test(rel(f))
      )
    ).toBe(true)
  })

  test('T-015 c2 @P1 the floor of this Next version is recorded and exact: the lowest ladder version at which all chunks parse', () => {
    const lowest = LADDER.find((v) => at(v).success)
    expect({ next: version, floor: lowest }).toEqual({
      next: version,
      floor: FLOORS[version],
    })
  })

  test('T-015 c2 @P1 below the floor es-check fails on some chunk; the floor and the next version up pass', () => {
    const floor = FLOORS[version]
    const index = LADDER.indexOf(floor)
    expect(index).toBeGreaterThanOrEqual(0)
    LADDER.slice(0, index).forEach((v) => {
      const result = at(v)
      expect({ version: v, success: result.success }).toEqual({
        version: v,
        success: false,
      })
      expect(result.failedFiles.length).toBeGreaterThan(0)
    })
    LADDER.slice(index, index + 2).forEach((v) => {
      expect({ version: v, success: at(v).success }).toEqual({
        version: v,
        success: true,
      })
    })
  })

  test('T-015 c2 @P1 the recorded floors name a ladder version for each Next version', () => {
    Object.entries(FLOORS).forEach(([next, floor]) => {
      expect(next).toMatch(/^\d+\.\d+\.\d+$/)
      expect(LADDER).toContain(floor)
    })
  })
})
