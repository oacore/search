// T-118 (41 B, R-055; Q-025): lib/loader.js, findings/06 §4.3. A cache file
// that parses is returned as it is and never fetched; a missing or unparsable
// cache is fetched live (3 s abort timeout, internalized URL) and written as
// {data, timestamp} with timestamp = new Date().getDate(), the DAY OF THE
// MONTH (Q-025, a different shape from the raw files data-loader.js writes);
// any failure (timeout, network, status >= 400, bad JSON) answers null and
// writes nothing. The cache is a real temp file, fetch is a spy, the clock is
// the harness clock (test/utils/clock.js).
const fs = require('fs')
const os = require('os')
const path = require('path')

const { FIXED_NOW, useFakeTimers, restoreClock } = require('../../utils/clock')
const Loader = require('../../../lib/loader').default

const URL_STATS = 'https://api.core.ac.uk/internal/statistics'
const TIMEOUT_MS = 3000

let dir
let realFetch
let logSpy

const cacheFile = (name = 'cache.json') => path.join(dir, name)

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })

// undefined = variable absent
const withEnv = async (vars, fn) => {
  const saved = {}
  Object.keys(vars).forEach((key) => {
    saved[key] = process.env[key]
    if (vars[key] === undefined) delete process.env[key]
    else process.env[key] = vars[key]
  })
  try {
    return await fn()
  } finally {
    Object.keys(saved).forEach((key) => {
      if (saved[key] === undefined) delete process.env[key]
      else process.env[key] = saved[key]
    })
  }
}

// a fetch that never answers and rejects like undici when its signal aborts
const hangingFetch = () =>
  jest.fn(
    (url, { signal }) =>
      new Promise((resolve, reject) => {
        signal.addEventListener('abort', () => {
          const error = new Error('This operation was aborted')
          error.name = 'AbortError'
          reject(error)
        })
      })
  )

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 't118-loader-'))
  realFetch = global.fetch
  global.fetch = jest.fn(() => {
    throw new Error('unexpected fetch')
  })
  logSpy = jest.spyOn(console, 'log').mockImplementation(() => {})
})

afterEach(() => {
  // a test may have moved the frozen clock
  jest.setSystemTime(FIXED_NOW)
  global.fetch = realFetch
  logSpy.mockRestore()
  fs.rmSync(dir, { recursive: true, force: true })
})

describe('T-118 @P1 lib/loader.js (findings/06 §4.3)', () => {
  describe('c1 a readable cache is returned without a fetch', () => {
    test('T-118 c1 @P1 a cache file that parses is returned as it is, whatever its shape, and fetch is not called', async () => {
      // the raw shape data-loader.js writes, and the {data, timestamp} shape
      // of the loader's own writes: both come back untouched
      const raw = { totalArticlesCount: 5, fullTextCount: 2 }
      fs.writeFileSync(cacheFile('raw.json'), JSON.stringify(raw))
      expect(
        await new Loader(URL_STATS, cacheFile('raw.json')).getData()
      ).toEqual(raw)

      const wrapped = { data: { a: 1 }, timestamp: 9 }
      fs.writeFileSync(cacheFile('wrapped.json'), JSON.stringify(wrapped))
      expect(
        await new Loader(URL_STATS, cacheFile('wrapped.json')).getData()
      ).toEqual(wrapped)

      expect(global.fetch).not.toHaveBeenCalled()
    })

    test('T-118 c1 @P1 an array or an empty object is a hit too (truthy); the file is not rewritten', async () => {
      fs.writeFileSync(cacheFile('empty-array.json'), '[]')
      fs.writeFileSync(cacheFile('empty-object.json'), '{}')
      const before = fs.statSync(cacheFile('empty-array.json')).mtimeMs
      expect(
        await new Loader(URL_STATS, cacheFile('empty-array.json')).getData()
      ).toEqual([])
      expect(
        await new Loader(URL_STATS, cacheFile('empty-object.json')).getData()
      ).toEqual({})
      expect(global.fetch).not.toHaveBeenCalled()
      expect(fs.statSync(cacheFile('empty-array.json')).mtimeMs).toBe(before)
      expect(fs.readFileSync(cacheFile('empty-array.json'), 'utf8')).toBe('[]')
    })

    test('T-118 c1 @P1 the cache is read on every call (no memoisation): a changed file shows on the next call', async () => {
      fs.writeFileSync(cacheFile(), JSON.stringify({ v: 1 }))
      const loader = new Loader(URL_STATS, cacheFile())
      expect(await loader.getData()).toEqual({ v: 1 })
      fs.writeFileSync(cacheFile(), JSON.stringify({ v: 2 }))
      expect(await loader.getData()).toEqual({ v: 2 })
      expect(global.fetch).not.toHaveBeenCalled()
    })

    test('T-118 c1 @P1 the file name is resolved against process.cwd() when it is relative', async () => {
      fs.writeFileSync(cacheFile(), JSON.stringify({ v: 3 }))
      const loader = new Loader(
        URL_STATS,
        path.relative(process.cwd(), cacheFile())
      )
      expect(loader.fileName).toBe(cacheFile())
      expect(loader.baseUrl).toBe(URL_STATS)
      expect(await loader.getData()).toEqual({ v: 3 })
    })

    test('T-118 c1 @P1 readCache answers null for a missing file and for text that is not JSON, logging the reason', () => {
      const missing = new Loader(URL_STATS, cacheFile('missing.json'))
      expect(missing.readCache()).toBeNull()
      expect(logSpy).toHaveBeenCalledWith(
        'data cache not initialized',
        expect.stringContaining('ENOENT')
      )

      fs.writeFileSync(cacheFile('bad.json'), '{not json')
      const bad = new Loader(URL_STATS, cacheFile('bad.json'))
      expect(bad.readCache()).toBeNull()
      expect(logSpy).toHaveBeenCalledTimes(2)
    })
  })

  describe('c2 a missing cache is fetched and written as {data, timestamp} (Q-025)', () => {
    test('T-118 c2 @P1 a miss fetches once and returns {data, timestamp} with timestamp = the day of the month (15 on the frozen clock)', async () => {
      const payload = { totalArticlesCount: 123 }
      global.fetch = jest.fn(async () => json(payload))
      const result = await new Loader(URL_STATS, cacheFile()).getData()
      expect(global.fetch).toHaveBeenCalledTimes(1)
      expect(result).toEqual({ data: payload, timestamp: 15 })
      expect(Object.keys(result)).toEqual(['data', 'timestamp'])
    })

    test('T-118 c2 @P1 the timestamp follows new Date().getDate(), not the epoch: 31 on 31 March, 1 on 1 April (UTC)', async () => {
      global.fetch = jest.fn(async () => json({ a: 1 }))
      jest.setSystemTime(new Date('2026-03-31T12:00:00Z'))
      expect(
        (await new Loader(URL_STATS, cacheFile('a.json')).getData()).timestamp
      ).toBe(31)
      jest.setSystemTime(new Date('2026-04-01T00:30:00Z'))
      expect(
        (await new Loader(URL_STATS, cacheFile('b.json')).getData()).timestamp
      ).toBe(1)
    })

    test('T-118 c2 @P1 the fetched value is written to the cache file as JSON of the wrapped object; the next call is a hit', async () => {
      const payload = [{ id: 1 }, { id: 2 }]
      global.fetch = jest.fn(async () => json(payload))
      const loader = new Loader(URL_STATS, cacheFile())
      await loader.getData()
      expect(JSON.parse(fs.readFileSync(cacheFile(), 'utf8'))).toEqual({
        data: payload,
        timestamp: 15,
      })
      expect(fs.readFileSync(cacheFile(), 'utf8')).toBe(
        JSON.stringify({ data: payload, timestamp: 15 })
      )
      expect(logSpy).toHaveBeenCalledWith('Wrote to data cache')

      const again = await loader.getData()
      expect(global.fetch).toHaveBeenCalledTimes(1)
      expect(again).toEqual({ data: payload, timestamp: 15 })
    })

    test('T-118 c2 @P1 a cache file that is not valid JSON counts as a miss and is overwritten', async () => {
      fs.writeFileSync(cacheFile(), '{truncated')
      global.fetch = jest.fn(async () => json({ ok: true }))
      const result = await new Loader(URL_STATS, cacheFile()).getData()
      expect(global.fetch).toHaveBeenCalledTimes(1)
      expect(result).toEqual({ data: { ok: true }, timestamp: 15 })
      expect(JSON.parse(fs.readFileSync(cacheFile(), 'utf8'))).toEqual(result)
    })

    test('T-118 c2 @P1 a cache file holding JSON null counts as a miss (falsy)', async () => {
      fs.writeFileSync(cacheFile(), 'null')
      global.fetch = jest.fn(async () => json({ ok: 1 }))
      const result = await new Loader(URL_STATS, cacheFile()).getData()
      expect(global.fetch).toHaveBeenCalledTimes(1)
      expect(result).toEqual({ data: { ok: 1 }, timestamp: 15 })
    })

    test('T-118 c2 @P1 any falsy JSON in the cache file (0, false, "", null) is a miss for getData, while readCache returns it as parsed', async () => {
      global.fetch = jest.fn(async () => json({ ok: 2 }))
      const cases = [
        ['zero.json', '0', 0],
        ['false.json', 'false', false],
        ['empty-string.json', '""', ''],
        ['null.json', 'null', null],
      ]
      for (const [name, text, parsed] of cases) {
        fs.writeFileSync(cacheFile(name), text)
        const loader = new Loader(URL_STATS, cacheFile(name))
        expect(loader.readCache()).toBe(parsed)
        // eslint-disable-next-line no-await-in-loop
        expect(await loader.getData()).toEqual({
          data: { ok: 2 },
          timestamp: 15,
        })
      }
      expect(global.fetch).toHaveBeenCalledTimes(cases.length)
    })

    test('T-118 c2 @P1 fetch gets the URL, an AbortSignal and the internalize headers ({} without Internal_API)', async () => {
      global.fetch = jest.fn(async () => json({ a: 1 }))
      await withEnv(
        { Internal_API: undefined, Internal_API_HOST: undefined },
        () => new Loader(URL_STATS, cacheFile()).getData()
      )
      const [url, options] = global.fetch.mock.calls[0]
      expect(url).toBe(URL_STATS)
      expect(Object.keys(options).sort()).toEqual(['headers', 'signal'])
      expect(options.headers).toEqual({})
      expect(options.signal).toBeInstanceOf(AbortSignal)
      expect(options.signal.aborted).toBe(false)
    })

    test('T-118 c2 @P1 with Internal_API and Internal_API_HOST the request goes to the service with a Host header', async () => {
      global.fetch = jest.fn(async () => json({ a: 1 }))
      await withEnv(
        {
          Internal_API: 'http://svc.local:8080',
          Internal_API_HOST: 'api.core.ac.uk',
        },
        () => new Loader(URL_STATS, cacheFile()).getData()
      )
      const [url, options] = global.fetch.mock.calls[0]
      expect(url).toBe('http://svc.local:8080/internal/statistics')
      expect(options.headers).toEqual({ Host: 'api.core.ac.uk' })
    })

    test('T-118 c2 @P1 a cache that cannot be written is logged and the fetched value is still returned', async () => {
      global.fetch = jest.fn(async () => json({ a: 1 }))
      const file = path.join(dir, 'no-such-dir', 'cache.json')
      const result = await new Loader(URL_STATS, file).getData()
      expect(result).toEqual({ data: { a: 1 }, timestamp: 15 })
      expect(fs.existsSync(file)).toBe(false)
      expect(logSpy).toHaveBeenCalledWith(
        'Error writing data to file',
        expect.stringContaining('ENOENT')
      )
    })
  })

  describe('c3 timeout and failures answer null', () => {
    beforeEach(() => {
      useFakeTimers()
    })

    afterEach(() => {
      restoreClock()
    })

    test('T-118 c3 @P1 a fetch that does not answer is aborted after 3 s (not before) and getData answers null', async () => {
      global.fetch = hangingFetch()
      const loader = new Loader(URL_STATS, cacheFile())
      let result
      let settled = false
      const pending = loader.getData().then((value) => {
        result = value
        settled = true
      })
      await jest.advanceTimersByTimeAsync(TIMEOUT_MS - 1)
      expect(settled).toBe(false)
      const { signal } = global.fetch.mock.calls[0][1]
      expect(signal.aborted).toBe(false)

      await jest.advanceTimersByTimeAsync(1)
      await pending
      expect(signal.aborted).toBe(true)
      expect(result).toBeNull()
      expect(fs.existsSync(cacheFile())).toBe(false)
      expect(logSpy).toHaveBeenCalledWith(
        'live fetch failed, rendering without it',
        expect.stringContaining('abort')
      )
    })

    test('T-118 c3 @P1 the timer is cleared after a fast answer: no pending timer, the signal is never aborted', async () => {
      global.fetch = jest.fn(async () => json({ a: 1 }))
      const result = await new Loader(URL_STATS, cacheFile()).getData()
      expect(result).toEqual({ data: { a: 1 }, timestamp: 15 })
      expect(jest.getTimerCount()).toBe(0)
      const { signal } = global.fetch.mock.calls[0][1]
      await jest.advanceTimersByTimeAsync(TIMEOUT_MS * 2)
      expect(signal.aborted).toBe(false)
    })

    test('T-118 c3 @P1 the timer is cleared after a failure too', async () => {
      global.fetch = jest.fn(async () => json({ error: 'x' }, 500))
      await new Loader(URL_STATS, cacheFile()).getData()
      expect(jest.getTimerCount()).toBe(0)
    })

    test.each([400, 401, 404, 429, 500, 502, 503])(
      'T-118 c3 @P1 status %i answers null, logs "Bad status" and writes no cache',
      async (status) => {
        global.fetch = jest.fn(async () => json({ message: 'nope' }, status))
        const loader = new Loader(URL_STATS, cacheFile())
        expect(await loader.getData()).toBeNull()
        expect(global.fetch).toHaveBeenCalledTimes(1)
        expect(fs.existsSync(cacheFile())).toBe(false)
        expect(logSpy).toHaveBeenCalledWith(
          'live fetch failed, rendering without it',
          `Bad status ${status}`
        )
      }
    )

    test('T-118 c3 @P1 a failed fetch is retried on the next call (no negative caching)', async () => {
      global.fetch = jest
        .fn()
        .mockResolvedValueOnce(json({}, 500))
        .mockResolvedValueOnce(json({ a: 1 }))
      const loader = new Loader(URL_STATS, cacheFile())
      expect(await loader.getData()).toBeNull()
      expect(await loader.getData()).toEqual({ data: { a: 1 }, timestamp: 15 })
      expect(global.fetch).toHaveBeenCalledTimes(2)
    })

    test('T-118 c3 @P1 a network error and a body that is not JSON answer null', async () => {
      global.fetch = jest.fn(async () => {
        throw new TypeError('fetch failed')
      })
      expect(
        await new Loader(URL_STATS, cacheFile('a.json')).getData()
      ).toBeNull()
      expect(logSpy).toHaveBeenCalledWith(
        'live fetch failed, rendering without it',
        'fetch failed'
      )

      global.fetch = jest.fn(
        async () => new Response('<html>oops</html>', { status: 200 })
      )
      expect(
        await new Loader(URL_STATS, cacheFile('b.json')).getData()
      ).toBeNull()
      expect(fs.existsSync(cacheFile('a.json'))).toBe(false)
      expect(fs.existsSync(cacheFile('b.json'))).toBe(false)
    })

    test('T-118 c3 @P1 no logging in production: log() writes through console.log only outside NODE_ENV=production', async () => {
      global.fetch = jest.fn(async () => json({}, 500))
      await withEnv({ NODE_ENV: 'production' }, async () => {
        expect(await new Loader(URL_STATS, cacheFile()).getData()).toBeNull()
      })
      expect(logSpy).not.toHaveBeenCalled()

      expect(await new Loader(URL_STATS, cacheFile()).getData()).toBeNull()
      expect(logSpy).toHaveBeenCalled()
    })
  })
})
