// T-116 (41 B, R-026, R-063): the root config modules env.config.js and
// csp.config.js. Both compute their value at load from process.env, so every
// case loads a fresh copy with jest.isolateModules after setting the env.
const ENV_KEYS = [
  'APP_ENV',
  'API_KEY',
  'API_URL',
  'SENTRY_DSN',
  'GA_TRACKING_CODE',
  'BUILD_TARGET',
  'NODE_ENV',
]

// null = variable absent
const loadWith = (vars, file) => {
  const saved = {}
  for (const k of ENV_KEYS) saved[k] = process.env[k]
  try {
    ENV_KEYS.forEach((k) => {
      delete process.env[k]
    })
    Object.entries(vars).forEach(([k, v]) => {
      if (v !== null) process.env[k] = v
    })
    let mod
    jest.isolateModules(() => {
      mod = require(`../../../${file}`)
    })
    return mod
  } finally {
    ENV_KEYS.forEach((k) => {
      if (saved[k] === undefined) delete process.env[k]
      else process.env[k] = saved[k]
    })
  }
}

const loadEnv = (vars) => loadWith({ API_KEY: 'k', ...vars }, 'env.config')
const loadCsp = (vars) => loadWith(vars, 'csp.config')

describe('T-116 @P0 config modules', () => {
  describe('c1 env.config.js', () => {
    test.each([
      [undefined, 'https://api-dev.core.ac.uk/internal'],
      ['', 'https://api-dev.core.ac.uk/internal'],
      ['local', 'http://127.0.0.1:8000/internal'],
      ['development', 'https://api-dev.core.ac.uk/internal'],
      ['staging', 'https://api-stg.core.ac.uk/internal'],
      ['production', 'https://api.core.ac.uk/internal'],
    ])('T-116 c1 @P0 APP_ENV=%j -> API_URL %s', (appEnv, apiUrl) => {
      const config = loadEnv({ APP_ENV: appEnv === undefined ? null : appEnv })
      expect(config.API_URL).toBe(apiUrl)
    })

    test.each(['qa', 'Production', 'STAGING', ' production'])(
      'T-116 c1 @P0 an unknown APP_ENV (%j) falls back to the production URL',
      (appEnv) => {
        expect(loadEnv({ APP_ENV: appEnv }).API_URL).toBe(
          'https://api.core.ac.uk/internal'
        )
      }
    )

    test('T-116 c1 @P0 the config carries API_URL, API_KEY, SENTRY_DSN, GA_TRACKING_CODE and BUILD_TARGET, nothing else', () => {
      const config = loadEnv({
        APP_ENV: 'staging',
        API_KEY: 'secret-key',
        SENTRY_DSN: 'https://public@o0.ingest.sentry.io/0',
        GA_TRACKING_CODE: 'G-TEST',
        BUILD_TARGET: 'azure',
      })
      expect(Object.keys(config)).toEqual([
        'API_URL',
        'API_KEY',
        'SENTRY_DSN',
        'GA_TRACKING_CODE',
        'BUILD_TARGET',
      ])
      expect(config).toEqual({
        API_URL: 'https://api-stg.core.ac.uk/internal',
        API_KEY: 'secret-key',
        SENTRY_DSN: 'https://public@o0.ingest.sentry.io/0',
        GA_TRACKING_CODE: 'G-TEST',
        BUILD_TARGET: 'azure',
      })
    })

    test('T-116 c1 @P0 SENTRY_DSN, GA_TRACKING_CODE and BUILD_TARGET are undefined when unset', () => {
      const config = loadEnv({ APP_ENV: 'production' })
      expect(config.SENTRY_DSN).toBeUndefined()
      expect(config.GA_TRACKING_CODE).toBeUndefined()
      expect(config.BUILD_TARGET).toBeUndefined()
      expect(config.API_KEY).toBe('k')
    })

    test('T-116 c1 @P0 the API_URL environment variable is ignored: the URL comes from APP_ENV only', () => {
      const config = loadEnv({
        APP_ENV: 'production',
        API_URL: 'http://elsewhere.example/internal',
      })
      expect(config.API_URL).toBe('https://api.core.ac.uk/internal')
    })

    test('T-116 c1 @P0 without API_KEY the module throws "API_KEY is not configured."', () => {
      expect(() => loadWith({ APP_ENV: 'production' }, 'env.config')).toThrow(
        new Error('API_KEY is not configured.')
      )
      // for every environment
      ;['local', 'development', 'staging', 'production'].forEach((appEnv) => {
        expect(() => loadWith({ APP_ENV: appEnv }, 'env.config')).toThrow(
          'API_KEY is not configured.'
        )
      })
    })

    test('T-116 c1 @P0 an empty API_KEY is accepted (only null/undefined is rejected)', () => {
      const config = loadWith(
        { APP_ENV: 'production', API_KEY: '' },
        'env.config'
      )
      expect(config.API_KEY).toBe('')
    })
  })

  describe('c2 csp.config.js', () => {
    const SELF = "'self'"
    const GA = '*.google-analytics.com *.doubleclick.net *.googletagmanager.com'
    const ANALYTICS = `${GA} *.cloudflareinsights.com`
    // the LogRocket hosts, with the ingest and CDN host of logrocket >= 11
    // (CS-LR-2, AD-028; `*.logrocket.com *.lgrckt-in.com` before)
    const LOGROCKET = '*.logrocket.com *.lgrckt-in.com *.logr-in.com'
    const CORE = '*.core.ac.uk core.ac.uk'

    // the policy as the module prints it, one directive per entry
    const PROD = [
      `default-src ${SELF} ${CORE}`,
      `script-src ${SELF} ${ANALYTICS} ${LOGROCKET} blob: data:`,
      `script-src-elem ${SELF} ${ANALYTICS} ${LOGROCKET} blob: data: 'unsafe-inline' 'unsafe-eval'`,
      `worker-src ${SELF} ${LOGROCKET} blob: data:`,
      `style-src ${SELF} 'unsafe-inline'`,
      `img-src ${SELF} ${CORE} data: *.openstreetmap.org ${ANALYTICS} ${LOGROCKET}`,
      `connect-src ${SELF} ${CORE} sentry.io ${ANALYTICS} ${LOGROCKET}`,
      "object-src 'none'",
      `media-src ${SELF} data: ${LOGROCKET}`,
      `child-src ${SELF} blob: ${LOGROCKET}`,
    ]

    // development: script-src and script-src-elem get 'unsafe-inline' and
    // 'unsafe-eval' appended (script-src-elem therefore carries them twice),
    // connect-src gets the local hosts and api-dev
    const DEV = PROD.map((directive) => {
      if (directive.startsWith('script-src '))
        return `${directive} 'unsafe-inline' 'unsafe-eval'`
      if (directive.startsWith('script-src-elem '))
        return `${directive} 'unsafe-inline' 'unsafe-eval'`
      if (directive.startsWith('connect-src '))
        return `${directive} localhost:* 127.0.0.1:* api-dev.core.ac.uk`
      return directive
    })

    test('T-116 c2 @P0 NODE_ENV=production: the production policy, exactly', () => {
      const policy = loadCsp({ NODE_ENV: 'production' })
      expect(typeof policy).toBe('string')
      expect(policy.split(';')).toEqual(PROD)
      expect(policy).toBe(PROD.join(';'))
      // no whitespace after the separators, no trailing separator
      expect(policy).not.toMatch(/; |;$/)
    })

    test('T-116 c2 @P0 NODE_ENV=development: the development policy, exactly', () => {
      const policy = loadCsp({ NODE_ENV: 'development' })
      expect(policy.split(';')).toEqual(DEV)
      expect(policy).toBe(DEV.join(';'))
    })

    test('T-116 c2 @P0 the development policy is spelled out literally (script-src, script-src-elem, connect-src)', () => {
      const directives = Object.fromEntries(
        loadCsp({ NODE_ENV: 'development' })
          .split(';')
          .map((d) => [d.slice(0, d.indexOf(' ')), d.slice(d.indexOf(' ') + 1)])
      )
      expect(directives['script-src']).toBe(
        "'self' *.google-analytics.com *.doubleclick.net *.googletagmanager.com *.cloudflareinsights.com *.logrocket.com *.lgrckt-in.com *.logr-in.com blob: data: 'unsafe-inline' 'unsafe-eval'"
      )
      expect(directives['script-src-elem']).toBe(
        "'self' *.google-analytics.com *.doubleclick.net *.googletagmanager.com *.cloudflareinsights.com *.logrocket.com *.lgrckt-in.com *.logr-in.com blob: data: 'unsafe-inline' 'unsafe-eval' 'unsafe-inline' 'unsafe-eval'"
      )
      expect(directives['connect-src']).toBe(
        "'self' *.core.ac.uk core.ac.uk sentry.io *.google-analytics.com *.doubleclick.net *.googletagmanager.com *.cloudflareinsights.com *.logrocket.com *.lgrckt-in.com *.logr-in.com localhost:* 127.0.0.1:* api-dev.core.ac.uk"
      )
    })

    test('T-116 c2 @P0 any NODE_ENV other than "production" (test, unset) gets the development policy', () => {
      const dev = loadCsp({ NODE_ENV: 'development' })
      expect(loadCsp({ NODE_ENV: 'test' })).toBe(dev)
      expect(loadCsp({})).toBe(dev)
      expect(loadCsp({ NODE_ENV: 'Production' })).toBe(dev)
    })

    test('T-116 c2 @P0 loading twice does not accumulate the development additions', () => {
      const first = loadCsp({ NODE_ENV: 'development' })
      const second = loadCsp({ NODE_ENV: 'development' })
      expect(second).toBe(first)
      expect(loadCsp({ NODE_ENV: 'production' })).toBe(PROD.join(';'))
    })

    test('T-116 c2 @P0 R-026 the LogRocket hosts are in every directive that lists them', () => {
      const prod = loadCsp({ NODE_ENV: 'production' }).split(';')
      const withLogRocket = prod
        .filter((d) => d.includes('*.logrocket.com'))
        .map((d) => d.slice(0, d.indexOf(' ')))
      expect(withLogRocket).toEqual([
        'script-src',
        'script-src-elem',
        'worker-src',
        'img-src',
        'connect-src',
        'media-src',
        'child-src',
      ])
      expect(
        prod.every(
          (d) => !d.includes('*.logrocket.com') || d.includes('*.lgrckt-in.com')
        )
      ).toBe(true)
    })
  })
})
