// T-011 (41 A, R-091): repo layout. No test file under pages/ (each file there
// is a route); no ignored file under test/ or e2e/ (review:00 X40.3;
// e2e/node_modules is the installed e2e package, I-08, and
// test/fixtures/data-snapshot is kept local and git-excluded by owner decision,
// I-11); the harness page of T-802 never reaches the production pages-manifest.
const fs = require('fs')
const path = require('path')
const { execFileSync } = require('child_process')

const ROOT = path.resolve(__dirname, '..', '..')
const walk = (d) =>
  fs.existsSync(d)
    ? fs
        .readdirSync(d, { withFileTypes: true })
        .flatMap((e) =>
          e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]
        )
    : []

describe('T-011 @P0 repo layout', () => {
  test('T-011 c1 @P0 no *.test.* or *.spec.* under pages/', () => {
    const onDisk = walk(path.join(ROOT, 'pages'))
      .map((p) => path.relative(ROOT, p))
      .filter((p) => /\.(test|spec)\./.test(p))
    const tracked = execFileSync('git', ['-C', ROOT, 'ls-files', 'pages'], {
      encoding: 'utf8',
    })
      .split('\n')
      .filter((p) => /\.(test|spec)\./.test(p))
    expect(onDisk).toEqual([])
    expect(tracked).toEqual([])
    expect(walk(path.join(ROOT, 'pages')).length).toBeGreaterThan(5)
  })

  test('T-011 c2 @P0 git ls-files --others --ignored --exclude-standard -- test e2e is empty', () => {
    const out = execFileSync(
      'git',
      [
        '-C',
        ROOT,
        'ls-files',
        '--others',
        '--ignored',
        '--exclude-standard',
        '--',
        'test',
        'e2e',
      ],
      { encoding: 'utf8', maxBuffer: 1 << 28 }
    )
    const ignored = out
      .split('\n')
      .filter(Boolean)
      .filter((p) => !p.startsWith('e2e/node_modules/')) // I-08
      .filter((p) => !p.startsWith('test/fixtures/data-snapshot/')) // I-11 owner decision: local only
    expect(ignored).toEqual([])
  })

  test('T-011 c3 @P0 the harness page is absent from the production pages-manifest', () => {
    if (!process.env.NEXT_DIR) {
      throw new Error(
        'T-011 c3 needs NEXT_DIR (.next of the parity image or local parity build)'
      )
    }
    const manifest = JSON.parse(
      fs.readFileSync(
        path.join(
          path.resolve(process.env.NEXT_DIR),
          'server',
          'pages-manifest.json'
        ),
        'utf8'
      )
    )
    const routes = Object.keys(manifest)
    expect(routes).toEqual(
      expect.arrayContaining([
        '/search',
        '/works/[id]',
        '/outputs/[id]',
        '/data-providers',
        '/data-providers/[id]',
        '/api/healthz',
      ])
    )
    expect(routes.filter((r) => /__du-harness/.test(r))).toEqual([])
    expect(
      Object.values(manifest).filter((f) => /__du-harness/.test(f))
    ).toEqual([])
  })
})
