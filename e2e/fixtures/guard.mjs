// Journey guard (40 §2.4, §2.5): every Playwright spec imports { test, expect } from here.
// Per test it fails on: pageerror, console.error outside e2e/console-allow/react-<major.minor>.json, window
// error, securitypolicyviolation, image/stylesheet/script/font responses >= 400, a request to a host the
// table below does not handle, an unmatched fixture (browser or SSR stub), and a screenshot without a
// diff-pixels annotation. It records the request and console logs, context.cookies() and the
// localStorage/sessionStorage key sets (attached as guard-log.json), and sets the cookie state.
//
// Browser hosts (40 §2.4):
//   the stack (proxy, allow-all proxy)                       -> network
//   api.core.ac.uk/** (incl. E22), doi.org/**                -> fixture resolver
//   *.tile.openstreetmap.org, core.ac.uk/image/**, core.ac.uk/images/** -> fixed 256 px PNG (resolver rules)
//   <stack origin>/image/**  (result thumbnails: the resolver rewrites core.ac.uk links to the proxy origin,
//                             where no gateway route serves them)       -> the same PNG as core.ac.uk/image/**
//   www.googletagmanager.com/gtag/js*                        -> empty script + dataLayer init-script spy
//   other google*, *.logrocket.com, *.lgrckt-in.com, *.logr-in.com, *.cloudflareinsights.com -> abort, count
//   o0.ingest.sentry.io, sentry.io                           -> count, 200
//   anything else                                            -> abort, count, fail
import fs from 'node:fs'
import path from 'node:path'
import http from 'node:http'
import crypto from 'node:crypto'
import { test as base, expect } from '@playwright/test'
import { createResolver } from '../../test/fixtures/resolve.mjs'
import { FIXED_TIME, COOKIE_STATES, TIMEZONE_ID, LOCALE } from './constants.mjs'

export { expect }

const ARTIFACT_DIR = path.resolve(
  process.env.ARTIFACT_DIR ||
    path.join(
      path.dirname(new URL(import.meta.url).pathname),
      '..',
      '..',
      '..',
      'search-upgrade-artifacts'
    )
)
export const RUN = process.env.E2E_RUN || 'default'
export const RUN_DIR = path.join(ARTIFACT_DIR, 'runs', RUN)
export const loadEnv = () =>
  JSON.parse(fs.readFileSync(path.join(RUN_DIR, 'env.json'), 'utf8'))

const reactVersion = (() => {
  try {
    const p = JSON.parse(
      fs.readFileSync(
        new URL('../../node_modules/react/package.json', import.meta.url),
        'utf8'
      )
    )
    return p.version.split('.').slice(0, 2).join('.')
  } catch {
    return '17.0'
  }
})()
const ALLOW_FILE = new URL(
  `../console-allow/react-${reactVersion}.json`,
  import.meta.url
)
const consoleAllow = JSON.parse(
  fs.readFileSync(ALLOW_FILE, 'utf8')
).entries.map((e) => ({ ...e, re: new RegExp(e.pattern) }))

const ABORT_COUNT = [
  /(^|\.)google[a-z-]*\.[a-z.]+$/,
  /(^|\.)doubleclick\.net$/,
  /(^|\.)logrocket\.com$/,
  /(^|\.)lgrckt-in\.com$/,
  /(^|\.)logr-in\.com$/,
  /(^|\.)cloudflareinsights\.com$/,
]
const SENTRY = /(^|\.)sentry\.io$/
const RESOLVER_HOSTS = new Set(['api.core.ac.uk', 'doi.org'])
const BAD_TYPES = new Set(['image', 'stylesheet', 'script', 'font'])

export const classify = (u, stackOrigins) => {
  if (stackOrigins.has(u.origin)) return 'stack'
  if (u.protocol === 'data:' || u.protocol === 'blob:') return 'local'
  if (RESOLVER_HOSTS.has(u.hostname)) return 'resolver'
  if (
    /(^|\.)tile\.openstreetmap\.org$/.test(u.hostname) ||
    (u.hostname === 'core.ac.uk' &&
      (u.pathname.startsWith('/image/') || u.pathname.startsWith('/images/')))
  )
    return 'resolver'
  if (
    u.hostname === 'www.googletagmanager.com' &&
    u.pathname.startsWith('/gtag/js')
  )
    return 'resolver'
  if (SENTRY.test(u.hostname)) return 'sentry'
  if (ABORT_COUNT.some((re) => re.test(u.hostname))) return 'abort-count'
  return 'unexpected'
}

// init script (runs before any page script): history log, dataLayer spy, error/CSP listeners, optional
// MutationObserver log
const initScript = ({ mutationLog }) => {
  const p2 = (window.__p2 = {
    history: [],
    dataLayer: [],
    mutations: [],
    csp: [],
    errors: [],
  })
  const report = (e) => {
    try {
      if (window.__p2Report) window.__p2Report(e)
    } catch {
      // the binding may not exist in a detached frame
    }
  }
  for (const method of ['pushState', 'replaceState']) {
    const orig = history[method]
    history[method] = function patched(state, title, url) {
      const r = orig.apply(this, arguments)
      p2.history.push({
        method,
        url: url == null ? null : new URL(String(url), location.href).href,
        stateKeys:
          state && typeof state === 'object' ? Object.keys(state).sort() : [],
        scrollRestoration: history.scrollRestoration,
        scrollY: window.scrollY,
      })
      return r
    }
  }
  window.addEventListener('popstate', () =>
    p2.history.push({
      method: 'popstate',
      url: location.href,
      scrollRestoration: history.scrollRestoration,
      scrollY: window.scrollY,
    })
  )
  let dl = []
  // `window.dataLayer = window.dataLayer || []` hands the wrapped array back to the setter: wrap each array
  // once, or every entry is recorded once per wrapper
  const wrapped = new WeakSet()
  const wrap = (arr) => {
    if (wrapped.has(arr)) return arr
    wrapped.add(arr)
    const push = arr.push
    arr.push = function spyPush(...items) {
      for (const it of items) {
        try {
          p2.dataLayer.push(
            JSON.parse(
              JSON.stringify(
                it && it.length !== undefined && typeof it !== 'string'
                  ? Array.from(it)
                  : it
              )
            )
          )
        } catch {
          p2.dataLayer.push(String(it))
        }
      }
      return push.apply(this, items)
    }
    return arr
  }
  dl = wrap(dl)
  Object.defineProperty(window, 'dataLayer', {
    configurable: true,
    get: () => dl,
    set: (v) => {
      dl = Array.isArray(v) ? wrap(v) : v
    },
  })
  window.addEventListener(
    'error',
    (e) => {
      if (e instanceof ErrorEvent) {
        p2.errors.push({ message: e.message, filename: e.filename })
        report({
          kind: 'window-error',
          message: e.message,
          filename: e.filename,
          lineno: e.lineno,
        })
      }
    },
    true
  )
  document.addEventListener('securitypolicyviolation', (e) => {
    const v = {
      blockedURI: e.blockedURI,
      violatedDirective: e.violatedDirective,
      effectiveDirective: e.effectiveDirective,
      sourceFile: e.sourceFile,
    }
    p2.csp.push(v)
    report({ kind: 'csp', ...v })
  })
  if (mutationLog) {
    const pathOf = (n) => {
      const parts = []
      for (
        let el = n && n.nodeType === 1 ? n : n && n.parentElement;
        el && el.nodeType === 1;
        el = el.parentElement
      ) {
        let i = 1
        for (let s = el.previousElementSibling; s; s = s.previousElementSibling)
          if (s.tagName === el.tagName) i++
        parts.unshift(`${el.tagName.toLowerCase()}[${i}]`)
      }
      return parts.join('/')
    }
    const start = () => {
      const mo = new MutationObserver((list) => {
        for (const m of list)
          if (p2.mutations.length < 5000)
            p2.mutations.push({
              type: m.type,
              target: pathOf(m.target),
              attribute: m.attributeName || null,
              added: m.addedNodes.length,
              removed: m.removedNodes.length,
            })
      })
      mo.observe(document, {
        subtree: true,
        childList: true,
        attributes: true,
        characterData: true,
      })
    }
    if (document.documentElement) start()
    else document.addEventListener('readystatechange', start, { once: true })
  }
}

export const cookiesFor = (state, url) => {
  if (!COOKIE_STATES.includes(state))
    throw new Error(`cookieState must be one of ${COOKIE_STATES.join(', ')}`)
  const expires =
    Math.floor(Date.parse(FIXED_TIME) / 1000) + 365 * 24 * 3600 * 10
  const c = (name) => ({ name, value: 'true', url, expires })
  if (state === 'absent') return []
  if (state === 'essential') return [c('essential_cookies_allowed')]
  return [c('essential_cookies_allowed'), c('analytics_cookies_allowed')]
}

// wire up one browser context (also used for JS-off contexts)
export async function guardContext(
  context,
  { env, resolver, log, cookieState = 'absent', mutationLog = false, baseURL }
) {
  // the browser reports a resource the guard aborts as "Failed to load resource" on the console; that line
  // is the guard's own doing (40 §2.4 abort-and-count), logged but never an app console.error
  const abortedUrls = new Set()
  const stackOrigins = new Set(
    [
      env.baseURL,
      env.allowURL,
      env.appURL,
      'http://proxy:8080',
      'http://proxy:8081',
    ]
      .filter(Boolean)
      .map((u) => new URL(u).origin)
  )
  await context.exposeBinding('__p2Report', (source, e) => {
    if (e.kind === 'csp')
      log.csp.push({ ...e, page: source.page && source.page.url() })
    else if (e.kind === 'window-error')
      log.windowErrors.push({ ...e, page: source.page && source.page.url() })
  })
  await context.addInitScript(initScript, { mutationLog })
  const cookies = cookiesFor(cookieState, baseURL || env.baseURL)
  if (cookies.length) await context.addCookies(cookies)
  // result thumbnails: the resolver rewrites https://core.ac.uk links to the proxy origin (40 §2.4), where no
  // gateway route serves /image/**; they are answered like core.ac.uk/image/** (the fixed PNG)
  await context.route(
    (url) => stackOrigins.has(url.origin) && url.pathname.startsWith('/image/'),
    (route) => {
      const u = new URL(route.request().url())
      const r = resolver.resolve('GET', `https://core.ac.uk${u.pathname}`)
      const headers = {}
      for (const [n, v] of r.headers) headers[n.toLowerCase()] = v
      return route.fulfill({ status: r.status, headers, body: r.body })
    }
  )
  await context.route(
    (url) =>
      classify(url, stackOrigins) !== 'stack' &&
      classify(url, stackOrigins) !== 'local',
    async (route) => {
      const req = route.request()
      const u = new URL(req.url())
      const kind = classify(u, stackOrigins)
      if (kind === 'resolver') {
        if (req.method() === 'OPTIONS') {
          // preflights are dropped from comparisons (40 §1); answered as allowed
          const h = await req.allHeaders()
          log.preflights++
          return route.fulfill({
            status: 204,
            headers: {
              'access-control-allow-origin': h.origin || '*',
              'access-control-allow-credentials': 'true',
              'access-control-allow-methods':
                h['access-control-request-method'] || 'GET',
              'access-control-allow-headers':
                h['access-control-request-headers'] || '',
              'access-control-max-age': '600',
            },
          })
        }
        const r = resolver.resolve(
          req.method(),
          req.url(),
          req.postDataBuffer() || undefined
        )
        if (r.networkError) {
          abortedUrls.add(req.url())
          return route.abort('failed')
        }
        if (r.unmatched) log.unmatched.push(r.unmatched)
        const headers = {}
        for (const [n, v] of r.headers)
          headers[n.toLowerCase()] = headers[n.toLowerCase()]
            ? `${headers[n.toLowerCase()]}, ${v}`
            : v
        const origin = (await req.allHeaders()).origin
        if (
          origin &&
          !headers['access-control-allow-origin'] &&
          u.hostname === 'api.core.ac.uk'
        ) {
          headers['access-control-allow-origin'] = origin
          headers['access-control-allow-credentials'] = 'true'
          log.corsAdded.push(req.url())
        }
        return route.fulfill({ status: r.status, headers, body: r.body })
      }
      if (kind === 'sentry') {
        log.sentry.push({
          method: req.method(),
          url: req.url(),
          bytes: (req.postDataBuffer() || Buffer.alloc(0)).length,
        })
        return route.fulfill({
          status: 200,
          headers: { 'content-type': 'application/json' },
          body: '{}',
        })
      }
      log.aborted[u.hostname] = (log.aborted[u.hostname] || 0) + 1
      abortedUrls.add(req.url())
      if (kind === 'unexpected')
        log.unexpected.push({
          method: req.method(),
          url: req.url(),
          resourceType: req.resourceType(),
        })
      return route.abort('blockedbyclient')
    }
  )
  const watch = (page) => {
    page.on('console', (m) => {
      const entry = {
        type: m.type(),
        text: m.text(),
        url: page.url(),
        location: m.location(),
      }
      log.console.push(entry)
      if (m.type() !== 'error') return
      if (
        /^Failed to load resource: net::ERR_(BLOCKED_BY_CLIENT|FAILED)/.test(
          entry.text
        ) &&
        abortedUrls.has(entry.location.url)
      ) {
        log.guardAbortConsole.push(entry)
        return
      }
      if (!consoleAllow.some((a) => a.re.test(entry.text)))
        log.consoleErrors.push(entry)
    })
    page.on('pageerror', (e) =>
      log.pageErrors.push({
        message: e.message,
        stack: e.stack,
        url: page.url(),
      })
    )
    page.on('request', (r) =>
      log.requests.push({
        t: Date.now(),
        method: r.method(),
        url: r.url(),
        resourceType: r.resourceType(),
        navigation: r.isNavigationRequest(),
        postDataSha256: r.postDataBuffer()
          ? require256(r.postDataBuffer())
          : null,
      })
    )
    page.on('response', (r) => {
      const t = r.request().resourceType()
      if (BAD_TYPES.has(t) && r.status() >= 400)
        log.badResponses.push({
          status: r.status(),
          url: r.url(),
          resourceType: t,
        })
    })
    const shot = page.screenshot.bind(page)
    page.screenshot = (...a) => {
      log.screenshots++
      return shot(...a)
    }
  }
  context.pages().forEach(watch)
  context.on('page', watch)
  return context
}

const require256 = (buf) =>
  crypto.createHash('sha256').update(buf).digest('hex')

const emptyLog = () => ({
  requests: [],
  console: [],
  consoleErrors: [],
  pageErrors: [],
  windowErrors: [],
  csp: [],
  badResponses: [],
  unexpected: [],
  unmatched: [],
  aborted: {},
  sentry: [],
  corsAdded: [],
  guardAbortConsole: [],
  preflights: 0,
  screenshots: 0,
  ssrProblems: [],
})

const control = (env, method, p, payload) =>
  new Promise((resolve, reject) => {
    const u = new URL(p, env.controlURL)
    const req = http.request(
      u,
      { method, headers: { 'content-type': 'application/json' } },
      (res) => {
        let b = ''
        res.on('data', (d) => (b += d))
        res.on('end', () => resolve(b ? JSON.parse(b) : null))
      }
    )
    req.on('error', reject)
    if (payload) req.write(JSON.stringify(payload))
    req.end()
  })

export const test = base.extend({
  cookieState: ['absent', { option: true }],
  mutationLog: [false, { option: true }],
  p2Env: [
    async ({}, use) => {
      await use(loadEnv())
    },
    { scope: 'worker' },
  ],
  resolver: [
    async ({ p2Env }, use) => {
      await use(createResolver({ linkOrigin: p2Env.baseURL }))
    },
    { scope: 'worker' },
  ],
  guardLog: async ({}, use) => {
    await use(emptyLog())
  },
  context: async (
    { context, p2Env, resolver, guardLog, cookieState, mutationLog, baseURL },
    use
  ) => {
    await guardContext(context, {
      env: p2Env,
      resolver,
      log: guardLog,
      cookieState,
      mutationLog,
      baseURL,
    })
    await use(context)
  },
  // a second context with JavaScript disabled, guarded the same way (V28, T-728)
  jsOffContext: async (
    { browser, p2Env, resolver, guardLog, cookieState, baseURL },
    use
  ) => {
    const ctx = await browser.newContext({
      javaScriptEnabled: false,
      baseURL,
      timezoneId: TIMEZONE_ID,
      locale: LOCALE,
    })
    await guardContext(ctx, {
      env: p2Env,
      resolver,
      log: guardLog,
      cookieState,
      baseURL,
    })
    await use(ctx)
    await ctx.close()
  },
  guard: [
    async ({ context, guardLog, p2Env }, use, testInfo) => {
      // stub window of this test: SSR problems during it fail the test
      const mark = await control(p2Env, 'POST', '/mark', {
        name: `t-${testInfo.testId}-${testInfo.repeatEachIndex}`,
      }).catch(() => null)
      await use(guardLog)
      if (mark) {
        const win = await control(
          p2Env,
          'GET',
          `/collect?since=${mark.seq}`
        ).catch(() => null)
        if (win) guardLog.ssrProblems.push(...win.problems)
      }
      // final state: cookies and storage key sets per open page
      guardLog.cookies = await context.cookies().catch(() => [])
      guardLog.storage = []
      for (const p of context.pages()) {
        if (p.isClosed()) continue
        const keys = await p
          .evaluate(() => ({
            url: location.href,
            local: Object.keys(localStorage).sort(),
            session: Object.keys(sessionStorage).sort(),
            history: (window.__p2 || {}).history || [],
            dataLayer: (window.__p2 || {}).dataLayer || [],
          }))
          .catch(() => null)
        if (keys) guardLog.storage.push(keys)
      }
      const diffAnnotations = testInfo.annotations.filter(
        (a) => a.type === 'diff-pixels'
      ).length
      // negative controls only: a test that asserts on a violation kind itself declares it with
      // test.info().annotations.push({ type: 'guard-expect', description: '<kind>' }) and must assert on
      // guardLog for that kind (kinds: pageerror, console, window-error, csp, asset)
      const expected = new Set(
        testInfo.annotations
          .filter((a) => a.type === 'guard-expect')
          .map((a) => a.description)
      )
      const violations = []
      const add = (kind, msg) => !expected.has(kind) && violations.push(msg)
      if (guardLog.pageErrors.length)
        add(
          'pageerror',
          `pageerror: ${guardLog.pageErrors.map((e) => e.message).join(' | ')}`
        )
      if (guardLog.consoleErrors.length)
        add(
          'console',
          `console.error: ${guardLog.consoleErrors
            .map((e) => e.text.split('\n')[0])
            .join(' | ')}`
        )
      if (guardLog.windowErrors.length)
        add(
          'window-error',
          `window error: ${guardLog.windowErrors
            .map((e) => e.message)
            .join(' | ')}`
        )
      if (guardLog.csp.length)
        add(
          'csp',
          `securitypolicyviolation: ${guardLog.csp
            .map((v) => `${v.effectiveDirective} ${v.blockedURI}`)
            .join(' | ')}`
        )
      if (guardLog.badResponses.length)
        add(
          'asset',
          `asset >= 400: ${guardLog.badResponses
            .map((r) => `${r.status} ${r.url}`)
            .join(' | ')}`
        )
      if (guardLog.unexpected.length)
        violations.push(
          `unexpected host: ${guardLog.unexpected
            .map((r) => r.url)
            .join(' | ')}`
        )
      if (guardLog.unmatched.length)
        violations.push(
          `unmatched browser fixture: ${guardLog.unmatched
            .map((r) => `${r.method} ${r.url} ${r.bodySha256}`)
            .join(' | ')}`
        )
      if (guardLog.ssrProblems.length)
        violations.push(
          `SSR stub: ${guardLog.ssrProblems
            .map((p) => `${p.kind} ${p.method || ''} ${p.url || p.host}`)
            .join(' | ')}`
        )
      if (guardLog.screenshots > diffAnnotations)
        violations.push(
          `${
            guardLog.screenshots - diffAnnotations
          } screenshot(s) without a diff-pixels annotation`
        )
      fs.mkdirSync(testInfo.outputDir, { recursive: true })
      const file = testInfo.outputPath('guard-log.json')
      fs.writeFileSync(
        file,
        JSON.stringify(
          { ...guardLog, expected: [...expected], violations },
          null,
          1
        )
      )
      await testInfo.attach('guard-log', {
        path: file,
        contentType: 'application/json',
      })
      if (violations.length) throw new Error(`guard: ${violations.join('\n')}`)
    },
    { auto: true },
  ],
})

// ---------- helpers ----------
export const setFixedTime = (page) =>
  page.clock.setFixedTime(new Date(FIXED_TIME))
export const installClock = (page) =>
  page.clock.install({ time: new Date(FIXED_TIME) })
export const historyLog = (page) =>
  page.evaluate(() => (window.__p2 || {}).history || [])
export const dataLayerLog = (page) =>
  page.evaluate(() => (window.__p2 || {}).dataLayer || [])
export const mutationLogOf = (page) =>
  page.evaluate(() => (window.__p2 || {}).mutations || [])

// serialised read of the SSR stub's wire records made while fn runs (the wire project runs with 1 worker;
// the lock also serialises wire captures across runs that share a stack)
export async function withWireCapture(env, fn) {
  const lock = path.join(RUN_DIR, 'wire.lock')
  for (let i = 0; ; i++) {
    try {
      fs.mkdirSync(lock)
      break
    } catch {
      if (i > 600) throw new Error('withWireCapture: lock held for 60 s')
      await new Promise((r) => setTimeout(r, 100))
    }
  }
  try {
    const mark = await control(env, 'POST', '/mark', {
      name: `wire-${Date.now()}`,
    })
    const result = await fn()
    const win = await control(env, 'GET', `/collect?since=${mark.seq}`)
    return { result, records: win.records, problems: win.problems }
  } finally {
    fs.rmSync(lock, { recursive: true, force: true })
  }
}
export const stubControl = control
