// scripts/outdated-at.mjs (02 §5 step 5, 55 GATE-x.1): the outdated list of
// the direct dependencies at a version cut-off Tr. Runs the CLI on a fixture
// checkout (root + e2e package.json, installed versions) with the recorded
// registry answers of test/unit/scripts/lib/P1-09/npm-view/ (`npm view <name>
// time dist-tags homepage --json`, recorded 2026-10-21); never asks the
// registry. The expected values were derived by hand from the recorded `time`
// maps.
const fs = require('fs')
const os = require('os')
const path = require('path')
const { spawnSync } = require('child_process')

const ROOT = path.resolve(__dirname, '../../..')
const SCRIPT = path.join(ROOT, 'scripts/outdated-at.mjs')
const RECORDED = path.join(__dirname, 'lib/P1-09/npm-view')

const KEYS = [
  'current',
  'wanted',
  'latest',
  'dependent',
  'location',
  'type',
  'homepage',
  'dependedByLocation',
]

let tmp
let checkout
let registry

const writeJson = (file, value) => {
  fs.mkdirSync(path.dirname(file), { recursive: true })
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`)
}

const install = (dir, name, version) =>
  writeJson(path.join(dir, 'node_modules', name, 'package.json'), {
    name,
    version,
  })

const run = (args, { registryDir = registry, root = checkout } = {}) => {
  const r = spawnSync(
    process.execPath,
    [SCRIPT, ...args, '--root', root, '--registry-json', registryDir],
    { encoding: 'utf8' }
  )
  let json = null
  try {
    json = JSON.parse(r.stdout)
  } catch {
    json = null
  }
  return { status: r.status, stdout: r.stdout, stderr: r.stderr, json }
}

const homepage = (name) =>
  JSON.parse(
    fs.readFileSync(
      path.join(RECORDED, `${name.replace(/\//g, '__')}.json`),
      'utf8'
    )
  ).homepage

beforeAll(() => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'outdated-at-'))
  checkout = path.join(tmp, 'checkout')
  registry = path.join(tmp, 'registry')
  fs.mkdirSync(registry, { recursive: true })
  for (const f of fs.readdirSync(RECORDED))
    fs.copyFileSync(path.join(RECORDED, f), path.join(registry, f))
  // the root manifest repeats a quirk of the real one: a name in both
  // dependencies and devDependencies
  writeJson(path.join(checkout, 'package.json'), {
    name: 'fixture-root',
    private: true,
    dependencies: {
      '@zeit/next-source-maps': '0.0.4',
      'filesize': '^6.1.0',
      'mobx-react-lite': '^3.0.0',
      'throttle-debounce': '^3.0.1',
    },
    devDependencies: {
      '@zeit/next-source-maps': '0.0.3',
      'js-file-download': '^0.4.12',
    },
  })
  install(checkout, '@zeit/next-source-maps', '0.0.3')
  install(checkout, 'filesize', '6.4.0')
  install(checkout, 'mobx-react-lite', '3.4.3')
  install(checkout, 'throttle-debounce', '3.0.1')
  // js-file-download is not installed: no `current`
  const e2e = path.join(checkout, 'e2e')
  writeJson(path.join(e2e, 'package.json'), {
    name: 'fixture-e2e',
    private: true,
    devDependencies: {
      'pngjs': '7.0.0',
      'throttle-debounce': '5.0.2',
      'yaml': '2.9.1',
    },
  })
  install(e2e, 'pngjs', '7.0.0')
  install(e2e, 'throttle-debounce', '5.0.2')
  install(e2e, 'yaml', '2.9.1')
})

afterAll(() => {
  if (tmp) fs.rmSync(tmp, { recursive: true, force: true })
})

describe('outdated-at (02 §5 step 5)', () => {
  test('cut-off after every recorded release: npm outdated --long --json shape and npm listing rule', () => {
    const r = run(['2026-10-21T00:00:00Z'])
    expect(r.status).toBe(0)
    expect(r.stderr).toBe('')
    expect(Object.keys(r.json)).toEqual([
      'filesize',
      'js-file-download',
      'mobx-react-lite',
      'throttle-debounce',
    ])
    for (const row of Object.values(r.json)) {
      expect(Object.keys(row)).toEqual(
        row.current === undefined ? KEYS.slice(1) : KEYS
      )
    }
    expect(r.json).toEqual({
      // 11.0.27 is recorded with a time after the cut-off: ignored
      'filesize': {
        current: '6.4.0',
        wanted: '6.4.0',
        latest: '11.0.26',
        dependent: 'fixture-root',
        location: 'node_modules/filesize',
        type: 'dependencies',
        homepage: homepage('filesize'),
        dependedByLocation: '',
      },
      // not installed: listed without `current`
      'js-file-download': {
        wanted: '0.4.12',
        latest: '0.4.12',
        dependent: 'fixture-root',
        location: 'node_modules/js-file-download',
        type: 'devDependencies',
        homepage: homepage('js-file-download'),
        dependedByLocation: '',
      },
      'mobx-react-lite': {
        current: '3.4.3',
        wanted: '3.4.3',
        latest: '5.1.0',
        dependent: 'fixture-root',
        location: 'node_modules/mobx-react-lite',
        type: 'dependencies',
        homepage: homepage('mobx-react-lite'),
        dependedByLocation: '',
      },
      // the e2e copy (5.0.2 = wanted = latest) is up to date and not listed
      'throttle-debounce': {
        current: '3.0.1',
        wanted: '3.0.1',
        latest: '5.0.2',
        dependent: 'fixture-root',
        location: 'node_modules/throttle-debounce',
        type: 'dependencies',
        homepage: homepage('throttle-debounce'),
        dependedByLocation: '',
      },
    })
    // up to date: pngjs 7.0.0; yaml 2.9.1 (the newer 3.0.0-2 under `next` is
    // a prerelease); @zeit/next-source-maps 0.0.3 from devDependencies (npm's
    // edge order)
    for (const name of ['pngjs', 'yaml', '@zeit/next-source-maps'])
      expect(r.json[name]).toBeUndefined()
  })

  test('a version published after Tr never counts, for latest and for wanted', () => {
    const r = run(['2026-08-01T00:00:00Z'])
    expect(r.status).toBe(0)
    // mobx-react-lite 5.0.1 (2026-08-19) and later are after Tr
    expect(r.json['mobx-react-lite']).toMatchObject({
      current: '3.4.3',
      wanted: '3.4.3',
      latest: '5.0.0',
    })
    // yaml 2.9.1 is 2026-09-11: the exact spec has no version at Tr, the
    // installed one is newer than Tr
    expect(r.json.yaml).toEqual({
      current: '2.9.1',
      wanted: null,
      latest: '2.9.0',
      dependent: 'fixture-e2e',
      location: 'e2e/node_modules/yaml',
      type: 'devDependencies',
      homepage: homepage('yaml'),
      dependedByLocation: 'e2e',
    })
    expect(r.json.filesize.latest).toBe('11.0.22')
  })

  test('Tr is inclusive to the millisecond; a name two projects list maps to an array (root first)', () => {
    // throttle-debounce 4.0.1 was published at 2022-04-15T06:34:20.654Z
    const at = run(['2022-04-15T06:34:20.654Z'])
    const before = run(['2022-04-15T06:34:20.653Z'])
    expect(at.status).toBe(0)
    expect(before.status).toBe(0)
    expect(at.json['throttle-debounce']).toEqual([
      {
        current: '3.0.1',
        wanted: '3.0.1',
        latest: '4.0.1',
        dependent: 'fixture-root',
        location: 'node_modules/throttle-debounce',
        type: 'dependencies',
        homepage: homepage('throttle-debounce'),
        dependedByLocation: '',
      },
      {
        current: '5.0.2',
        wanted: null,
        latest: '4.0.1',
        dependent: 'fixture-e2e',
        location: 'e2e/node_modules/throttle-debounce',
        type: 'devDependencies',
        homepage: homepage('throttle-debounce'),
        dependedByLocation: 'e2e',
      },
    ])
    expect(before.json['throttle-debounce'].map((x) => x.latest)).toEqual([
      '4.0.0',
      '4.0.0',
    ])
    // an installed version newer than everything at Tr: listed with the at-Tr
    // wanted
    expect(at.json['mobx-react-lite']).toMatchObject({
      current: '3.4.3',
      wanted: '3.3.0',
      latest: '3.3.0',
    })
    expect(at.json.pngjs).toMatchObject({
      current: '7.0.0',
      wanted: null,
      latest: '6.0.0',
    })
  })

  test('prereleases never count, also when published after the release line they follow', () => {
    // yaml 2.8.3 (2026-03-21) came after 3.0.0-0 (2026-02-13);
    // mobx-react-lite 4.0.7-alpha (2024-07-17, dist-tag `alpha`) came after
    // 4.0.7
    const spring = run(['2026-04-01T00:00:00Z'])
    expect(spring.json.yaml).toMatchObject({ wanted: null, latest: '2.8.3' })
    expect(spring.json['mobx-react-lite'].latest).toBe('4.1.1')
    const summer24 = run(['2024-08-01T00:00:00Z'])
    expect(summer24.json['mobx-react-lite'].latest).toBe('4.0.7')
    expect(summer24.json.yaml.latest).toBe('2.5.0')
    // below the current latest tag and above every release at Tr:
    // 3.0.0-beta.1 (2020-08-31) vs 2.2.1 (2020-09-02); 3.0.0 (2020-09-30) is
    // after Tr, so `^3.0.0` has no version yet
    const sep20 = run(['2020-09-10T00:00:00Z'])
    expect(sep20.json['mobx-react-lite']).toMatchObject({
      current: '3.4.3',
      wanted: null,
      latest: '2.2.1',
    })
  })

  test('a version above the current latest dist-tag never counts (derived answer: latest moved back to 4.0.1)', () => {
    const derived = path.join(tmp, 'registry-derived')
    fs.mkdirSync(derived, { recursive: true })
    for (const f of fs.readdirSync(registry))
      fs.copyFileSync(path.join(registry, f), path.join(derived, f))
    const view = JSON.parse(
      fs.readFileSync(path.join(registry, 'throttle-debounce.json'), 'utf8')
    )
    view['dist-tags'] = { latest: '4.0.1' }
    writeJson(path.join(derived, 'throttle-debounce.json'), view)
    const r = run(['2026-10-21T00:00:00Z'], { registryDir: derived })
    expect(r.status).toBe(0)
    expect(
      r.json['throttle-debounce'].map(({ current, wanted, latest }) => ({
        current,
        wanted,
        latest,
      }))
    ).toEqual([
      { current: '3.0.1', wanted: '3.0.1', latest: '4.0.1' },
      { current: '5.0.2', wanted: null, latest: '4.0.1' },
    ])
  })

  test('--all lists every direct dependency; the later dependency type wins for a repeated name', () => {
    const r = run(['2026-10-21T00:00:00Z', '--all'])
    expect(r.status).toBe(0)
    expect(Object.keys(r.json)).toEqual([
      '@zeit/next-source-maps',
      'filesize',
      'js-file-download',
      'mobx-react-lite',
      'pngjs',
      'throttle-debounce',
      'yaml',
    ])
    expect(r.json['@zeit/next-source-maps']).toEqual({
      current: '0.0.3',
      wanted: '0.0.3',
      latest: '0.0.3',
      dependent: 'fixture-root',
      location: 'node_modules/@zeit/next-source-maps',
      type: 'devDependencies',
      homepage: homepage('@zeit/next-source-maps'),
      dependedByLocation: '',
    })
    expect(r.json['throttle-debounce']).toHaveLength(2)
    expect(r.json.yaml).toMatchObject({
      current: '2.9.1',
      wanted: '2.9.1',
      latest: '2.9.1',
      dependent: 'fixture-e2e',
    })
  })

  test('missing registry data: exit 1, the name on stderr, the other rows still printed', () => {
    const partial = path.join(tmp, 'registry-partial')
    fs.mkdirSync(partial, { recursive: true })
    for (const f of fs.readdirSync(registry)) {
      if (f !== 'yaml.json')
        fs.copyFileSync(path.join(registry, f), path.join(partial, f))
    }
    const r = run(['2026-10-21T00:00:00Z', '--all'], { registryDir: partial })
    expect(r.status).toBe(1)
    expect(r.stderr).toMatch(/outdated-at: yaml: no recorded answer/)
    expect(r.json.yaml).toBeUndefined()
    expect(r.json.pngjs).toMatchObject({ current: '7.0.0' })
  })

  test('usage errors: a Tr that is not ISO 8601, a spec that is not a semver range (exit 2)', () => {
    for (const tr of ['yesterday', '21/10/2026', '2026-13-45']) {
      const r = run([tr])
      expect(r.status).toBe(2)
      expect(r.stderr).toMatch(/usage: outdated-at\.mjs <Tr/)
    }
    const odd = path.join(tmp, 'odd')
    writeJson(path.join(odd, 'package.json'), {
      name: 'odd',
      dependencies: { filesize: 'github:avoidwork/filesize.js' },
    })
    writeJson(path.join(odd, 'e2e', 'package.json'), { name: 'odd-e2e' })
    const r = run(['2026-10-21T00:00:00Z'], { root: odd })
    expect(r.status).toBe(2)
    expect(r.stderr).toMatch(
      /node_modules\/filesize: unsupported spec "github:avoidwork\/filesize\.js"/
    )
  })

  test('range semantics of the semver subset (known answers of node-semver)', () => {
    const cases = [
      ['^1.2.3', '1.9.9', true],
      ['^1.2.3', '2.0.0', false],
      ['^1.2.3', '1.2.2', false],
      ['^0.2.3', '0.2.9', true],
      ['^0.2.3', '0.3.0', false],
      ['^0.0.3', '0.0.3', true],
      ['^0.0.3', '0.0.4', false],
      ['^0.0.24', '0.0.24', true],
      ['^0.0', '0.0.9', true],
      ['^0.0', '0.1.0', false],
      ['^0.x', '0.9.0', true],
      ['^1.x', '1.0.0', true],
      ['^1.2.x', '1.2.0', true],
      ['~1.2.3', '1.2.9', true],
      ['~1.2.3', '1.3.0', false],
      ['~1.2', '1.2.0', true],
      ['~1', '1.9.0', true],
      ['~1', '2.0.0', false],
      ['~>1.2', '1.2.5', true],
      ['1.2.3', '1.2.3', true],
      ['=1.2.3', '1.2.4', false],
      ['v1.2.3', '1.2.3', true],
      ['1.x', '1.5.0', true],
      ['1.2', '1.2.7', true],
      ['1.2', '1.3.0', false],
      ['*', '0.0.0', true],
      ['', '3.0.0', true],
      ['>1.2', '1.2.9', false],
      ['>1.2', '1.3.0', true],
      ['<1.2', '1.1.9', true],
      ['<1.2', '1.2.0', false],
      ['<=1.2', '1.2.9', true],
      ['<=1.2', '1.3.0', false],
      ['>=1.2', '1.2.0', true],
      ['>= 1.2.3 < 2', '1.9.0', true],
      ['>= 1.2.3 < 2', '2.0.0', false],
      ['1.2.3 - 2.3.4', '2.3.4', true],
      ['1.2.3 - 2.3.4', '2.3.5', false],
      ['1.2 - 2.3', '2.3.9', true],
      ['1.2 - 2.3', '2.4.0', false],
      ['1.2.3 - 2', '2.9.9', true],
      ['^1.0.0 || ^3.0.0', '3.1.0', true],
      ['^1.0.0 || ^3.0.0', '2.1.0', false],
      ['>=16.18.1', '24.0.0', true],
      ['^10.0.3', '10.2.3', true],
      ['^10.0.3', '11.0.0', false],
    ]
    const code = `
      import { satisfies } from ${JSON.stringify(SCRIPT)}
      const cases = ${JSON.stringify(cases)}
      console.log(JSON.stringify(cases.map(([r, v]) => satisfies(v, r))))
    `
    const r = spawnSync(process.execPath, ['--input-type=module', '-e', code], {
      encoding: 'utf8',
    })
    expect(r.status).toBe(0)
    expect(JSON.parse(r.stdout)).toEqual(cases.map((c) => c[2]))
  })
})
