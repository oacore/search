// T-121 (41 B, R-011; Q-020, Q-091): utils/invalidatePreviousRequests.js, the
// legacy method decorator behind Claim.retrieve, the filter, search, report and
// similar-works fetches. It is applied with the same decorator syntax and
// Babel config as the stores; the stores themselves are pinned elsewhere
// (T-202, T-205, T-211, T-734). Each makeStore() call decorates a new class,
// so every class gets its own controllers.
const http = require('http')

const invalidatePreviousRequests =
  require('../../../utils/invalidatePreviousRequests').default
const {
  invalidatePreviousRequests: wrap,
} = require('../../../utils/invalidatePreviousRequests')

const makeStore = () => {
  class Store {
    calls = []

    log = []

    error = null

    created = null

    isLoading = false

    // records its arguments and the aborts of the signal it receives last
    @invalidatePreviousRequests
    run(...args) {
      const signal = args[args.length - 1]
      this.calls.push({ self: this, args })
      this.log.push(`start ${args[0]}`)
      if (signal) {
        signal.addEventListener('abort', () =>
          this.log.push(`abort ${args[0]}`)
        )
      }
      return { returned: args.length }
    }

    @invalidatePreviousRequests
    other(...args) {
      this.calls.push({ self: this, args })
    }

    // a method with an optional parameter before the signal (Q-020)
    @invalidatePreviousRequests
    fetchFilters(q, sortType = 'recent', signal) {
      this.calls.push({ self: this, args: [q, sortType, signal] })
      return { q, sortType, signal }
    }

    // the shape of Claim.retrieve (store/claim.js:35-52): reset, loading on,
    // await the request, error to `error`, loading off in finally
    @invalidatePreviousRequests
    async flow(label, request, signal) {
      this.log.push(`start ${label}`)
      this.created = null
      this.error = null
      this.isLoading = true
      try {
        this.created = await request(signal)
      } catch (error) {
        this.error = error
        this.log.push(`reject ${label} ${error.name}`)
      } finally {
        this.isLoading = false
        this.log.push(`end ${label}`)
      }
    }
  }
  return Store
}

// the signal each call received (the last argument)
const signalsOf = (store) =>
  store.calls.map(({ args }) => args[args.length - 1])

// a promise that settles like a fetch tied to `signal`: it rejects with the
// signal's reason as soon as the signal aborts, and can be resolved by hand
const gate = (signal) => {
  const g = {}
  g.promise = new Promise((resolve, reject) => {
    g.resolve = resolve
    signal.addEventListener('abort', () => reject(signal.reason))
  })
  return g
}

describe('T-121 @P0 invalidatePreviousRequests', () => {
  describe('c1 call 2 aborts call 1', () => {
    test('T-121 c1 @P0 the first call aborts nothing and gets a live signal', () => {
      const store = new (makeStore())()
      store.run('1')
      const [signal] = signalsOf(store)
      expect(signal).toBeInstanceOf(AbortSignal)
      expect(signal.aborted).toBe(false)
    })

    test('T-121 c1 @P0 call 2 aborts the signal of call 1 and gets a fresh one', () => {
      const store = new (makeStore())()
      store.run('1')
      store.run('2')
      const [first, second] = signalsOf(store)
      expect(first.aborted).toBe(true)
      expect(first.reason.name).toBe('AbortError')
      expect(second).not.toBe(first)
      expect(second.aborted).toBe(false)
    })

    test('T-121 c1 @P0 call 3 aborts call 2 only; call 1 is aborted once', () => {
      const store = new (makeStore())()
      store.run('1')
      const onFirstAbort = jest.fn()
      signalsOf(store)[0].addEventListener('abort', onFirstAbort)
      store.run('2')
      store.run('3')
      const [, second, third] = signalsOf(store)
      expect(onFirstAbort).toHaveBeenCalledTimes(1)
      expect(second.aborted).toBe(true)
      expect(third.aborted).toBe(false)
    })

    test('T-121 c1 @P0 the abort of call 1 happens before the original method runs for call 2', () => {
      const store = new (makeStore())()
      store.run('1')
      store.run('2')
      expect(store.log).toEqual(['start 1', 'abort 1', 'start 2'])
    })
  })

  describe('c2 signal after args (Q-020)', () => {
    test('T-121 c2 @P0 the signal is appended after the caller arguments; this and the return value pass through', () => {
      const store = new (makeStore())()
      const result = store.run('a', 'b')
      const [{ self, args }] = store.calls
      expect(self).toBe(store)
      expect(args).toHaveLength(3)
      expect(args.slice(0, 2)).toEqual(['a', 'b'])
      expect(args[2]).toBeInstanceOf(AbortSignal)
      expect(result).toEqual({ returned: 3 })
    })

    test('T-121 c2 @P0 with no caller arguments the signal is the first argument', () => {
      const store = new (makeStore())()
      store.run()
      const [{ args }] = store.calls
      expect(args).toHaveLength(1)
      expect(args[0]).toBeInstanceOf(AbortSignal)
    })

    test('T-121 c2 @P0 a call that leaves an optional parameter out gets the signal in its place (sortType becomes the signal)', () => {
      const store = new (makeStore())()
      const short = store.fetchFilters('machine')
      expect(short.q).toBe('machine')
      expect(short.sortType).toBeInstanceOf(AbortSignal)
      expect(String(short.sortType)).toBe('[object AbortSignal]')
      expect(short.signal).toBeUndefined()

      const full = store.fetchFilters('machine', 'recent')
      expect(full.sortType).toBe('recent')
      expect(full.signal).toBeInstanceOf(AbortSignal)
      expect(full.signal.aborted).toBe(false)
      // the signal the short call received was invalidated by the next call
      expect(short.sortType.aborted).toBe(true)
    })

    test('T-121 c2 @P0 without AbortController the extra argument is undefined and nothing is aborted', () => {
      const saved = global.AbortController
      const store = new (makeStore())()
      try {
        global.AbortController = undefined
        store.run('a')
        store.run('b')
      } finally {
        global.AbortController = saved
      }
      expect(store.calls.map(({ args }) => args)).toEqual([
        ['a', undefined],
        ['b', undefined],
      ])
    })
  })

  describe('c3 one controller per class', () => {
    test('T-121 c3 @P0 the controller belongs to the class: a call on another instance aborts the previous one', () => {
      const Store = makeStore()
      const a = new Store()
      const b = new Store()
      a.run('a')
      b.run('b')
      expect(signalsOf(a)[0].aborted).toBe(true)
      expect(signalsOf(b)[0].aborted).toBe(false)
    })

    test('T-121 c3 @P0 another class has its own controller and is not aborted', () => {
      const left = new (makeStore())()
      const right = new (makeStore())()
      left.run('l')
      right.run('r')
      expect(signalsOf(left)[0].aborted).toBe(false)
      expect(signalsOf(right)[0].aborted).toBe(false)
      left.run('l2')
      expect(signalsOf(left)[0].aborted).toBe(true)
      expect(signalsOf(right)[0].aborted).toBe(false)
    })

    test('T-121 c3 @P0 two decorated methods of one class have a controller each and do not abort each other', () => {
      const store = new (makeStore())()
      store.run('first')
      store.other('second')
      expect(signalsOf(store)[0].aborted).toBe(false)
      expect(signalsOf(store)[1].aborted).toBe(false)
      store.run('first again')
      expect(signalsOf(store)[0].aborted).toBe(true)
      expect(signalsOf(store)[1].aborted).toBe(false)
    })
  })

  describe('c4 call 1 rejects after call 2 starts (Q-091)', () => {
    test('T-121 c4 @P0 the rejection of call 1 is delivered after call 2 has started', async () => {
      const store = new (makeStore())()
      const pending = []
      const request = (signal) => {
        const g = gate(signal)
        pending.push(g)
        return g.promise
      }

      const first = store.flow('1', request)
      const second = store.flow('2', request)
      // call 2 started synchronously; call 1's rejection is still queued
      expect(store.log).toEqual(['start 1', 'start 2'])

      await first
      expect(store.log).toEqual([
        'start 1',
        'start 2',
        'reject 1 AbortError',
        'end 1',
      ])

      pending[1].resolve('done 2')
      await second
      expect(store.log.slice(4)).toEqual(['end 2'])
    })

    test('T-121 c4 @P0 the aborted call turns loading off while call 2 runs, and its AbortError outlives call 2', async () => {
      const store = new (makeStore())()
      const pending = []
      const request = (signal) => {
        const g = gate(signal)
        pending.push(g)
        return g.promise
      }

      const first = store.flow('1', request)
      const second = store.flow('2', request)
      expect(store.isLoading).toBe(true)

      await first
      // call 2 is still pending, yet the flag it set is already false
      expect(store.isLoading).toBe(false)
      expect(store.created).toBeNull()
      expect(store.error.name).toBe('AbortError')

      pending[1].resolve('done 2')
      await second
      // call 2 succeeded, but call 1's error landed after call 2's reset
      expect(store.created).toBe('done 2')
      expect(store.error.name).toBe('AbortError')
    })

    describe('over a real fetch', () => {
      let server
      let origin

      beforeAll(async () => {
        server = http.createServer((req, res) => {
          req.resume()
          if (req.url === '/hang') return // never answered
          res.writeHead(200, { 'Content-Type': 'application/json' })
          res.end('{"ok":true}')
        })
        await new Promise((resolve) => {
          server.listen(0, '127.0.0.1', resolve)
        })
        origin = `http://127.0.0.1:${server.address().port}`
      })

      afterAll(async () => {
        server.closeAllConnections()
        await new Promise((done) => {
          server.close(done)
        })
      })

      test('T-121 c4 @P0 an in-flight fetch of call 1 rejects with AbortError once call 2 has started', async () => {
        const store = new (makeStore())()
        const get = (path) => async (signal) => {
          const response = await fetch(`${origin}${path}`, { signal })
          return response.json()
        }

        const first = store.flow('1', get('/hang'))
        const second = store.flow('2', get('/fast'))
        expect(store.log).toEqual(['start 1', 'start 2'])

        await first
        expect(store.log.slice(0, 4)).toEqual([
          'start 1',
          'start 2',
          'reject 1 AbortError',
          'end 1',
        ])
        expect(store.error.name).toBe('AbortError')

        await second
        expect(store.created).toEqual({ ok: true })
        // the sticky error from call 1 is still there
        expect(store.error.name).toBe('AbortError')
      })
    })
  })

  // CS-BAB-2: the wrapper the zustand stores use, created at module scope
  describe('c5 the wrapper form (CS-BAB-2)', () => {
    const recorder = () => {
      const calls = []
      const fn = wrap(function run(...args) {
        calls.push({ self: this, args })
        return args.length
      })
      return { calls, fn }
    }
    const signals = (calls) => calls.map(({ args }) => args[args.length - 1])

    test('T-121 c5 @P0 call 2 aborts call 1, the signal comes after the arguments, this and the return value pass through', () => {
      const { calls, fn } = recorder()
      const self = { name: 'store' }
      expect(fn.call(self, 'a', 'b')).toBe(3)
      expect(fn()).toBe(1)
      const [first, second] = signals(calls)
      expect(first).toBeInstanceOf(AbortSignal)
      expect(first.aborted).toBe(true)
      expect(second.aborted).toBe(false)
      expect(calls[0].self).toBe(self)
      expect(calls[0].args.slice(0, 2)).toEqual(['a', 'b'])
      expect(calls[1].args).toHaveLength(1)
    })

    test('T-121 c5 @P0 one controller per wrapped function, shared by every caller; another wrapper is independent', () => {
      const a = recorder()
      const b = recorder()
      a.fn.call({ id: 1 })
      b.fn.call({ id: 1 })
      a.fn.call({ id: 2 })
      expect(signals(a.calls).map((s) => s.aborted)).toEqual([true, false])
      expect(signals(b.calls).map((s) => s.aborted)).toEqual([false])
    })

    test('T-121 c5 @P0 without AbortController the extra argument is undefined', () => {
      const saved = global.AbortController
      try {
        delete global.AbortController
        const { calls, fn } = recorder()
        fn('x')
        fn('y')
        expect(calls.map(({ args }) => args)).toEqual([
          ['x', undefined],
          ['y', undefined],
        ])
      } finally {
        global.AbortController = saved
      }
    })
  })
})
