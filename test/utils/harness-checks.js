// T-012 c1-c4: the per-project harness self-tests (41 T-012), registered by
// each Jest project's T-012 file.
const fs = require('fs')
const path = require('path')

const ROOT = path.resolve(__dirname, '..', '..')

// RouterContext module per Next major.minor (40 §2.1, review:test-strategy V4)
const ROUTER_CONTEXT_PATHS = [
  { range: [10, 10], path: 'next/dist/next-server/lib/router-context' },
  { range: [11, 12], path: 'next/dist/shared/lib/router-context' },
  {
    range: [13.5, 16],
    path: 'next/dist/shared/lib/router-context.shared-runtime',
  },
]
const routerContextPathFor = (version) => {
  const [maj, min] = version.split('.').map(Number)
  const v = maj + min / 10
  const hit = ROUTER_CONTEXT_PATHS.find(
    (r) => v >= r.range[0] && v < Math.floor(r.range[1]) + 1
  )
  return hit ? hit.path : null
}

const registerProjectChecks = (project) => {
  describe(`T-012 harness self-tests (${project} project)`, () => {
    test(`T-012 c1 @P0 real *.module.css gives kebab and camel keys, unknown key undefined (${project})`, () => {
      const styles = require('../../templates/data-providers/styles.module.css')
      expect(styles['result-card']).toBe('result-card')
      expect(styles.resultCard).toBe('result-card')
      expect(styles['add-data-provider-card']).toBe('add-data-provider-card')
      expect(styles.addDataProviderCard).toBe('add-data-provider-card')
      expect(styles.layout).toBe('layout')
      expect(styles.unknownKey).toBeUndefined()
      expect(Object.getPrototypeOf(styles)).toBe(Object.prototype)
      // the transform's camelCase is css-loader's (camelcase 6.2 bundled by
      // Next)
      const { camelCase } = require('../transforms/css-module')
      expect(
        ['a-b', 'foo--bar', 'x2-y', 'BEM__elem--mod', '-lead'].map(camelCase)
      ).toEqual(['aB', 'fooBar', 'x2Y', 'bemElemMod', 'lead'])
    })

    test(`T-012 c2 @P0 ESM allow-list feeds transformIgnorePatterns and ESM-only packages load (${project})`, () => {
      const list = require('../esm-allow-list.json').packages
      const config = require('../../jest.config')
      const proj = config.projects.find((p) => p.displayName === project)
      expect(proj).toBeDefined()
      expect(proj.transformIgnorePatterns).toHaveLength(1)
      const re = new RegExp(proj.transformIgnorePatterns[0])
      for (const name of list) {
        const sample = name.replace('*', 'pkg')
        expect(re.test(`/x/node_modules/${sample}/index.js`)).toBe(false)
      }
      expect(re.test('/x/node_modules/react/index.js')).toBe(true)
      // each listed package that is installed and ESM-only loads through the
      // transform
      const esmOnly = ['until-async', 'rettime', '@open-draft/deferred-promise']
      for (const name of esmOnly) {
        const pkg = JSON.parse(
          fs.readFileSync(
            path.join(ROOT, 'node_modules', name, 'package.json'),
            'utf8'
          )
        )
        expect(pkg.type).toBe('module')
        expect(() => require(name)).not.toThrow()
      }
      if (project !== 'static') {
        const msw = require('msw/node')
        expect(typeof msw.setupServer).toBe('function')
      }
    })

    if (project !== 'static') {
      describe(`T-012 c2 MSW through the allow-list (${project})`, () => {
        const { setupMsw } = require('./msw')
        setupMsw({ root: path.join(__dirname, 'fixtures-none') })
        test(`T-012 c2 @P0 msw 2.15 intercepts fetch and the fixture resolver answers (${project})`, async () => {
          const miss = await fetch(
            'https://api.core.ac.uk/internal/harness-probe?t=undefined'
          )
          expect(miss.status).toBe(502)
          expect(await miss.json()).toMatchObject({
            error: 'unmatched fixture',
            method: 'GET',
            url: 'https://api.core.ac.uk/internal/harness-probe?t=undefined',
          })
          const body = JSON.stringify({
            q: '__status500',
            offset: 0,
            limit: 10,
          })
          const res = await fetch(
            'https://api.core.ac.uk/v3/search/works?t=undefined',
            {
              method: 'POST',
              body,
              headers: { 'Content-Type': 'application/json' },
            }
          )
          expect(res.status).toBe(500)
          await expect(
            fetch('https://api.core.ac.uk/v3/search/works', {
              method: 'POST',
              body: '{"q":"__neterror"}',
            })
          ).rejects.toThrow()
        })
      })
    }

    test(`T-012 c3 @P0 router mock covers the installed next/router, prefetch included (${project})`, async () => {
      const real = jest.requireActual('next/dist/client/router')
      const mock = require('next/router')
      expect(mock.router).toBe(mock.default)
      for (const k of Object.keys(real)) expect(Object.keys(mock)).toContain(k)
      for (const k of Object.getOwnPropertyNames(real.default))
        expect(Object.keys(mock.default)).toContain(k)
      expect(mock.useRouter()).toBe(mock.default)
      await expect(mock.default.prefetch('/search/')).resolves.toBeUndefined()
      expect(mock.default.prefetch).toHaveBeenCalledWith('/search/')
      for (const m of ['on', 'off', 'emit'])
        expect(typeof mock.default.events[m]).toBe('function')
      // reset in beforeEach: a change made in one test is gone in the next
      mock.setRouter({ query: { q: 'leak' }, asPath: '/search/?q=leak' })
    })

    test(`T-012 c3 @P0 router mock is reset before each test (${project})`, () => {
      const mock = require('next/router')
      expect(mock.default.query).toEqual({})
      expect(mock.default.asPath).toBe('/')
      expect(mock.default.prefetch).not.toHaveBeenCalled()
    })

    test(`T-012 c3 @P0 the js-file-download spy is callable through require and import interop (${project})`, () => {
      // api/search.js: `const FileDownload = require('js-file-download')`,
      // then `FileDownload(data, name)`
      const required = require('js-file-download')
      expect(typeof required).toBe('function')
      expect(jest.isMockFunction(required)).toBe(true)
      required.mockClear()
      required('data', 'results.csv')
      expect(required).toHaveBeenCalledWith('data', 'results.csv')
      // `import FileDownload from 'js-file-download'` (Babel) reads `.default`
      expect(required.default).toBe(required)
    })

    test(`T-012 c4 @P0 RouterContext path map matches the installed Next (${project})`, () => {
      const { version } = require('next/package.json')
      const p = routerContextPathFor(version)
      expect(p).toBe(require('../mocks/next-router').ROUTER_CONTEXT_PATH)
      const { RouterContext } = require(p)
      expect(RouterContext && RouterContext.Provider).toBeDefined()
      // next/link's useRouter (next/dist/client/router) reads the same context
      // module
      const link = require.resolve('next/dist/client/router')
      const src = fs.readFileSync(link, 'utf8')
      const rel = (src.match(
        /require\(["'](\.\.\/[^"']*router-context(?:\.shared-runtime)?)(?:\.js)?["']\)/
      ) || [])[1]
      expect(rel).toBeDefined()
      expect(require.resolve(path.resolve(path.dirname(link), rel))).toBe(
        require.resolve(p)
      )
      // test/utils/render.js provides that context
      expect(
        fs.readFileSync(path.join(ROOT, 'test/utils/render.js'), 'utf8')
      ).toContain(`require('${p}')`)
      expect(routerContextPathFor('12.3.7')).toBe(
        'next/dist/shared/lib/router-context'
      )
      expect(routerContextPathFor('13.5.11')).toBe(
        'next/dist/shared/lib/router-context.shared-runtime'
      )
      expect(routerContextPathFor('16.0.1')).toBe(
        'next/dist/shared/lib/router-context.shared-runtime'
      )
    })
  })
}

module.exports = {
  registerProjectChecks,
  routerContextPathFor,
  ROUTER_CONTEXT_PATHS,
  ROOT,
}
