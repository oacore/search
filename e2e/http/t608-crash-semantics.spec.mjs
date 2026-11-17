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
//       error events (I-35: two with 5.30, one from @sentry/node's rejection integration and one from the app's
//       handler; 41 says one). Sentry 7 sends one envelope event per crash or rejection (AD-015, AD-017).
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
// Sentry 7 has no store transport: every event goes to the envelope endpoint (AD-015, AD-017)
const ENVELOPE =
  'https://o0.ingest.sentry.io/api/0/envelope/?sentry_version=7&sentry_key=public&sentry_client=sentry.javascript.nextjs%2F11.12.0'
// listener function names as the preload reports them (Function.prototype.name)
// the bound handler of @sentry/node 5.30's integrations
const SENTRY_HANDLER = 'bound '
// Sentry 7's handlers: an anonymous arrow function for uncaught exceptions (AD-014) and sendUnhandledPromise
// for rejections (AD-016)
const SENTRY_UNCAUGHT = ''
const SENTRY_REJECTION = 'sendUnhandledPromise'
const APP_HANDLER = ''

// the Sentry requests at the counting stub (store or envelope endpoint)
const sentryEvents = async (env, since) =>
  (await stubControl(env, 'GET', `/collect?since=${since}`)).records.filter(
    (r) =>
      r.method === 'POST' &&
      (r.url === STORE ||
        r.url.startsWith('https://o0.ingest.sentry.io/api/0/envelope/'))
  )
// the error events of one request: the JSON body of a store request, each `event` item of an envelope (an
// envelope header line, then an item header line and its payload line per item; 55 C6-NI counting rule)
const eventsOf = (r) => {
  if (r.url === STORE) return [JSON.parse(r.bodyText)]
  const lines = r.bodyText.split('\n').filter(Boolean)
  const events = []
  for (let i = 1; i + 1 < lines.length; i += 2)
    if (JSON.parse(lines[i]).type === 'event')
      events.push(JSON.parse(lines[i + 1]))
  return events
}
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
      // node:domain's clear handler (domain is required by @sentry/node and put first), Next 13.5's `exception`
      // listener (next/dist/server/lib/start-server.js: it logs and keeps the process up), @sentry/node's
      // OnUncaughtException integration (an anonymous handler in Sentry 7, AD-014; bound in 5.30), Next 13.5's
      // `bound logError` (next/dist/server/lib/router-server.js) and the handler of pages/_app.jsx:25-27
      // W84: Sentry 11 no longer loads node:domain, so its clear handler is gone
      expect(shot.listeners).toBe(4) // AD-128, AD-183
      // W7a: Next 15.5's start-server listener is an anonymous function ('')
      // W7c: Next 16's router-server logError is no longer bound and registers before Sentry's
      // 6.8: instrumentation.ts initialises Sentry when the server starts (CS-SEN-2), before Next's router
      // server registers logError; pages/_app.jsx loaded it on the first page before
      expect(shot.names).toEqual(['', SENTRY_UNCAUGHT, 'logError', APP_HANDLER]) // AD-128, AD-183
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
        description: `exit 1 ${ms} ms after the throw; ${events.length} Sentry requests`,
      })
      expect(ms).toBeGreaterThanOrEqual(0)
      expect(ms).toBeLessThanOrEqual(EXIT_BOUND_MS)
      // the exit comes after the flush (Q-009): the event for the thrown error reached the counting stub
      // before the process ended. Sentry 7 sends one envelope with one event item, the integration's (level
      // fatal, unhandled); it drops the app handler's second capture of the same Error object (AD-015; 5.30
      // sent both to the store endpoint)
      expect(events.map((r) => r.url)).toEqual([ENVELOPE])
      expect(
        events.flatMap(eventsOf).map((e) => ({
          value: e.exception.values[0].value,
          level: e.level,
          mechanism: e.exception.values[0].mechanism,
        }))
      ).toEqual([
        {
          value: 'T-608 preload: asynchronous throw',
          level: 'fatal',
          // W84: Sentry 11 names the mechanism auto.node.onuncaughtexception
          mechanism: { type: 'auto.node.onuncaughtexception', handled: false },
        },
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
      // Next 13.5's `exception` listener, @sentry/node's OnUnhandledRejection integration (sendUnhandledPromise
      // in Sentry 7, AD-016), Next 13.5's `bound logError` and the handler of pages/_app.jsx:21-23
      // W7c: Next 16 installs one filtering listener and dispatches to the others; process.listeners()
      // lists it first, then its own listener, Sentry's and the app's (no router-server logError)
      expect(shot.listeners).toBe(1) // AD-129, AD-183
      expect(shot.names).toEqual([
        'filteringUnhandledRejectionHandler',
        'unhandledRejectionListener',
        SENTRY_REJECTION,
        APP_HANDLER,
      ]) // AD-129, AD-183
      await survives(env, shot.at)
      const events = await sentryEvents(env, mark.seq)
      expect(events.map((r) => r.url)).toEqual([ENVELOPE])
      const summary = events
        .flatMap(eventsOf)
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
      // Q-009 as the app behaves (I-35): Sentry 7 sends one event, the integration's, unhandled, with the
      // unhandledPromiseRejection extra; it drops the app handler's second capture of the same error (AD-017;
      // 5.30 sent one event per listener, both with the generic handled mechanism)
      expect(summary).toEqual([
        {
          value: 'T-608 preload: unhandled rejection',
          // W84: Sentry 11 names the mechanism auto.node.onunhandledrejection
          mechanism: { type: 'auto.node.onunhandledrejection', handled: false },
          unhandledPromiseRejection: true,
        },
      ])
    } finally {
      await down(id)
    }
  })
})
