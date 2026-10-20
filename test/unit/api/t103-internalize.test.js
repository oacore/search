// T-103 (41 B, R-016): api/internalize.js, the six findings/06 §1.4 cases.
// isServer is computed at module load, so every case loads a fresh copy with
// jest.isolateModules after setting process.env (and window).
const SVC = 'http://svc.local:8080'
const HOST = 'api.core.ac.uk'

const load = ({ base = SVC, host = HOST, windowAtImport = false } = {}) => {
  const saved = {
    base: process.env.Internal_API,
    host: process.env.Internal_API_HOST,
  }
  // null = variable absent
  if (base === null) delete process.env.Internal_API
  else process.env.Internal_API = base
  if (host === null) delete process.env.Internal_API_HOST
  else process.env.Internal_API_HOST = host
  if (windowAtImport) global.window = {}
  let mod
  jest.isolateModules(() => {
    mod = require('../../../api/internalize')
  })
  if (windowAtImport) delete global.window
  return {
    internalize: mod.internalize,
    restore: () => {
      if (saved.base === undefined) delete process.env.Internal_API
      else process.env.Internal_API = saved.base
      if (saved.host === undefined) delete process.env.Internal_API_HOST
      else process.env.Internal_API_HOST = saved.host
    },
  }
}

const withEnv = (opts, fn) => {
  const { internalize, restore } = load(opts)
  try {
    fn(internalize)
  } finally {
    restore()
  }
}

describe('T-103 @P0 internalize (findings/06 §1.4)', () => {
  test('T-103 @P0 public API URL is rewritten to the service with a Host header', () => {
    withEnv({}, (internalize) => {
      expect(internalize('https://api.core.ac.uk/v3/works/1?t=x')).toEqual({
        url: 'http://svc.local:8080/v3/works/1?t=x',
        headers: { Host: 'api.core.ac.uk' },
      })
    })
  })

  test('T-103 @P0 another host (doi.org) is unchanged', () => {
    withEnv({}, (internalize) => {
      expect(internalize('https://doi.org/10.1/x')).toEqual({
        url: 'https://doi.org/10.1/x',
        headers: {},
      })
    })
  })

  test('T-103 @P0 the dev API host is unchanged', () => {
    withEnv({}, (internalize) => {
      expect(
        internalize('https://api-dev.core.ac.uk/internal/works/1')
      ).toEqual({
        url: 'https://api-dev.core.ac.uk/internal/works/1',
        headers: {},
      })
    })
  })

  test('T-103 @P0 a malformed URL is unchanged', () => {
    withEnv({}, (internalize) => {
      expect(internalize('not a url')).toEqual({
        url: 'not a url',
        headers: {},
      })
    })
  })

  test('T-103 @P0 either variable missing leaves any URL unchanged', () => {
    for (const opts of [
      { base: null },
      { host: null },
      { base: null, host: null },
    ]) {
      withEnv(opts, (internalize) => {
        expect(internalize('https://api.core.ac.uk/v3/works/1?t=x')).toEqual({
          url: 'https://api.core.ac.uk/v3/works/1?t=x',
          headers: {},
        })
      })
    }
  })

  test('T-103 @P0 window defined at import time leaves any URL unchanged', () => {
    withEnv({ windowAtImport: true }, (internalize) => {
      expect(internalize('https://api.core.ac.uk/v3/works/1?t=x')).toEqual({
        url: 'https://api.core.ac.uk/v3/works/1?t=x',
        headers: {},
      })
    })
  })
})
