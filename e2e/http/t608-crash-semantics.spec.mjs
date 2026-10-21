// T-608 (41 G; Q-009; R-040, R-055; I-07): crash semantics of the server process. Each case starts its own
// short-lived stack (scripts/e2e-stack.mjs up: own port slot, an existing build, never a rebuild) with a
// preload mounted into the app and loaded through NODE_OPTIONS (appended). After a page has rendered (so
// pages/_app.jsx has registered its process handlers) the test sends SIGUSR2 and the preload throws or rejects
// from a timer callback, outside any request.
//   c1: the parity build with the prod-shaped test DSN: @sentry/node 5.30's uncaught-exception handler exits 1
//       within ~3 s (its 2 s shutdown timeout) despite the app's own handler.
//   c2: the same tree built without a DSN (nodsn variant, I-07): no Sentry handler, the app's handler
//       listens, the process survives.
//   c3: an unhandled rejection with the test DSN: the process survives and the counting stub receives the
//       error events (I-35: two, one from @sentry/node's rejection integration and one from the app's
//       handler; 41 says one).
// Local (host) mode only: the signal goes to the app process (env.json pids.app).
import path from 'node:path'
import { test, expect, stubControl } from '../fixtures/guard.mjs'
import { rawRequest } from '../lib/P0-11/http.mjs'
import { REPO } from '../lib/P0-11/files.mjs'
import {
  up,
  down,
  trigger,
  healthz,
  appExit,
  preloadLines,
  buildRecord,
  nodsnBuild,
  TEST_DSN,
} from '../lib/P0-11/substack.mjs'

const PRELOAD_THROW = path.join(
  REPO,
  'e2e',
  'lib',
  'P0-11',
  'preload-throw.cjs'
)
const PRELOAD_REJECT = path.join(
  REPO,
  'e2e',
  'lib',
  'P0-11',
  'preload-reject.cjs'
)
// c1 bound (41: "within ~3 s"): @sentry/node 5.30 waits at most its 2 s shutdown timeout before exit(1)
const EXIT_BOUND_MS = 3000
// survival is observed for twice that bound after the trigger
const SURVIVE_MS = 2 * EXIT_BOUND_MS
const STORE = 'https://o0.ingest.sentry.io/api/0/store/'
// listener function names as the preload reports them (Function.prototype.name)
const DOMAIN_CLEAR = 'domainUncaughtExceptionClear'
const SENTRY_HANDLER = 'bound '
const APP_HANDLER = ''

const sentryEvents = async (env, since) =>
  (await stubControl(env, 'GET', `/collect?since=${since}`)).records.filter(
    (r) => r.method === 'POST' && r.url === STORE
  )
const fired = (env) =>
  preloadLines(env).find((l) => l.p011 === 'T-608 trigger') || null

// start, check the preload is in and a page renders, mark the stub, trigger
async function armed(id, build, preload, mode) {
  const env = await up(id, { build, preload })
  expect(
    preloadLines(env).filter((l) => l.p011 === 'T-608 preload'),
    'preload loaded once'
  ).toEqual([{ p011: 'T-608 preload', mode, pid: env.pids.app }])
  expect((await rawRequest(env.appURL, '/search/?q=climate')).status).toBe(200)
  expect(fired(env)).toBeNull()
  const mark = await stubControl(env, 'POST', '/mark', { name: id })
  trigger(env)
  await expect.poll(() => fired(env), { timeout: 10000 }).not.toBeNull()
  return { env, mark, shot: fired(env) }
}

// survival: until SURVIVE_MS after the trigger, every poll finds the process alive and serving healthz
async function survives(env, at) {
  await expect
    .poll(
      async () => {
        if (appExit(env)) return `exited ${JSON.stringify(appExit(env))}`
        const s = await healthz(env)
        if (s !== 200) return `healthz ${s}`
        return Date.now() >= at + SURVIVE_MS ? 'survived' : 'running'
      },
      { timeout: SURVIVE_MS + 10000, intervals: [250] }
    )
    .toBe('survived')
  expect((await rawRequest(env.appURL, '/search/?q=climate')).status).toBe(200)
}

test.describe('T-608 @P0 crash semantics', () => {
  // one sub-stack at a time, in this order; a failure does not stop the next case
  test.describe.configure({ mode: 'default', timeout: 240000 })

  test('T-608 c1 @P0 preload throws async: the prod-shaped test DSN build exits 1 within ~3 s', async ({
    p2Env,
  }) => {
    const build = p2Env.build.key
    expect(buildRecord(build).buildEnv.SENTRY_DSN).toBe(TEST_DSN)
    const id = `${p2Env.run}-t608-c1`
    try {
      const { env, mark, shot } = await armed(id, build, PRELOAD_THROW, 'throw')
      // node:domain's clear handler (domain is required by @sentry/node and put first), @sentry/node's
      // OnUncaughtException integration (a bound anonymous handler) and the handler of pages/_app.jsx:25-27
      expect(shot.listeners).toBe(3)
      expect(shot.names).toEqual([DOMAIN_CLEAR, SENTRY_HANDLER, APP_HANDLER])
      await expect.poll(() => appExit(env), { timeout: 15000 }).not.toBeNull()
      const exit = appExit(env)
      expect({ code: exit.code, signal: exit.signal }).toEqual({
        code: 1,
        signal: null,
      })
      const ms = Date.parse(exit.at) - shot.at
      const events = await sentryEvents(env, mark.seq)
      test.info().annotations.push({
        type: 'crash',
        description: `exit 1 ${ms} ms after the throw; ${events.length} Sentry store requests`,
      })
      expect(ms).toBeGreaterThanOrEqual(0)
      expect(ms).toBeLessThanOrEqual(EXIT_BOUND_MS)
      // the exit comes after the flush (Q-009): the integration's event and the app handler's event, both
      // for the thrown error, reached the counting stub before the process ended
      expect(
        events.map((r) => JSON.parse(r.bodyText).exception.values[0].value)
      ).toEqual([
        'T-608 preload: asynchronous throw',
        'T-608 preload: asynchronous throw',
      ])
    } finally {
      await down(id)
    }
  })

  test('T-608 c2 @P0 preload throws async: the no-DSN build survives', async ({
    p2Env,
  }) => {
    const build = await nodsnBuild(p2Env.build.key)
    expect(buildRecord(build).buildEnv.SENTRY_DSN).toBe('')
    const id = `${p2Env.run}-t608-c2`
    try {
      const { env, mark, shot } = await armed(id, build, PRELOAD_THROW, 'throw')
      // no Sentry.init without a DSN, so no integration handler; the handler of pages/_app.jsx:25-27 listens
      // (utils/sentry.js still requires @sentry/node, which loads node:domain and its clear handler)
      expect(shot.names).not.toContain(SENTRY_HANDLER)
      expect(shot.names).toContain(APP_HANDLER)
      await survives(env, shot.at)
      // nothing is sent without a DSN
      expect(await sentryEvents(env, mark.seq)).toEqual([])
    } finally {
      await down(id)
    }
  })

  test('T-608 c3 @P0 unhandledRejection: the process survives and the counting stub receives the events', async ({
    p2Env,
  }) => {
    const build = p2Env.build.key
    expect(buildRecord(build).buildEnv.SENTRY_DSN).toBe(TEST_DSN)
    const id = `${p2Env.run}-t608-c3`
    try {
      const { env, mark, shot } = await armed(
        id,
        build,
        PRELOAD_REJECT,
        'reject'
      )
      // @sentry/node's OnUnhandledRejection integration and the handler of pages/_app.jsx:21-23
      expect(shot.listeners).toBe(2)
      expect(shot.names).toEqual([SENTRY_HANDLER, APP_HANDLER])
      await survives(env, shot.at)
      const events = await sentryEvents(env, mark.seq)
      const summary = events
        .map((r) => JSON.parse(r.bodyText))
        .map((e) => ({
          value: e.exception.values[0].value,
          mechanism: e.exception.values[0].mechanism,
          unhandledPromiseRejection: Boolean(
            e.extra && e.extra.unhandledPromiseRejection
          ),
        }))
        .sort((a, b) => (JSON.stringify(a) < JSON.stringify(b) ? -1 : 1))
      test.info().annotations.push({
        type: 'sentry',
        description: JSON.stringify(summary),
      })
      // Q-009 as the app behaves (I-35): one event per listener for the same error, both with the generic
      // handled mechanism of @sentry/node 5.30; the integration's own event carries the
      // unhandledPromiseRejection extra
      expect(summary).toEqual([
        {
          value: 'T-608 preload: unhandled rejection',
          mechanism: { handled: true, type: 'generic' },
          unhandledPromiseRejection: false,
        },
        {
          value: 'T-608 preload: unhandled rejection',
          mechanism: { handled: true, type: 'generic' },
          unhandledPromiseRejection: true,
        },
      ])
    } finally {
      await down(id)
    }
  })
})
