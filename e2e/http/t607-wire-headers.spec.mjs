// T-607 (41 G; Q-022, Q-016; R-016, R-028, R-076): in-cluster wire headers. c1: every run starts the app with
// Internal_API = the stub and Internal_API_HOST = api.core.ac.uk, so SSR API calls take the internalised path
// (api/internalize.js). c2: the stub's socket records of every SSR call of one page per endpoint family
// (Host, Authorization, Accept, Content-Type, User-Agent, Accept-Encoding, sentry-trace/baggage and every
// other header, in order) = e2e/lib/P0-11/t607-wire.baseline.json. Today native fetch drops the Host override,
// so the wire Host is the service host (Q-022), and no server fetch carries sentry-trace or baggage (R-076).
// Wire project (@wire, 1 worker); captures are serialised by withWireCapture. Record mode (RECORD=1) writes
// the baseline instead of comparing.
import path from 'node:path'
import { test, expect } from '../fixtures/guard.mjs'
import {
  WIRE_BASELINE,
  WIRE_PAGES,
  NAMED,
  captureWire,
  headerOf,
} from '../lib/P0-11/wire.mjs'
import { placeholders, fill } from '../lib/P0-11/contract.mjs'
import {
  RECORD,
  LINK,
  REPO,
  readJson,
  writeJsonPretty,
  referenceOf,
} from '../lib/P0-11/files.mjs'

const OUT = process.env.WIRE_BASELINE_OUT
  ? path.resolve(process.env.WIRE_BASELINE_OUT)
  : WIRE_BASELINE
const API = 'https://api.core.ac.uk/'

test.describe('T-607 @P0 @wire in-cluster wire headers', () => {
  test.describe.configure({ timeout: 300000 })

  test('T-607 c1 @P0 @wire every run: Internal_API is the stub, Internal_API_HOST is api.core.ac.uk', async ({
    p2Env,
  }) => {
    const env = p2Env.appEnv
    expect(env.Internal_API_HOST).toBe('api.core.ac.uk')
    // docker topology: the stub service; local mode: the stub's own HTTP listener of this run
    expect(env.Internal_API).toBe(
      p2Env.mode === 'docker' ? 'http://stub' : p2Env.stubURL
    )
    // the app takes the internalised path: its API calls arrive on the stub's Internal_API listener, not
    // through the host-mode redirect preload, at the service host
    const { status, raw } = await captureWire(p2Env, '/search/?q=climate')
    expect(status).toBe(200)
    const api = raw.filter((r) => r.url.startsWith(API))
    expect(api.map((r) => `${r.method} ${r.url}`).sort()).toEqual([
      'GET https://api.core.ac.uk/internal/members',
      'POST https://api.core.ac.uk/v3/search/works?t=undefined',
    ])
    for (const r of api) {
      expect(r.listener).toBe('http')
      expect(r.redirected).toBe(false)
      expect(r.wireHost).toBe(new URL(env.Internal_API).host)
    }
  })

  test('T-607 c2 @P0 @wire Host, Authorization, Accept, Content-Type, UA, Accept-Encoding, sentry-trace/baggage of every SSR call = baseline (Q-022)', async ({
    p2Env,
  }) => {
    const values = await placeholders(p2Env)
    const pages = []
    for (const target of WIRE_PAGES) {
      const c = await captureWire(p2Env, fill(target, values))
      pages.push({ target, status: c.status, records: c.records })
    }
    // the named headers one by one (today's values; the full comparison follows)
    for (const p of pages) {
      expect(p.records.length, p.target).toBeGreaterThan(0)
      for (const r of p.records) {
        const at = `${p.target} ${r.method} ${r.url}`
        const host = headerOf(r, 'host')
        if (r.url.startsWith(API)) {
          // Q-022: the service host, never the Internal_API_HOST override
          expect(host, at).toEqual(['<Internal_API host>'])
          expect(headerOf(r, 'authorization'), at).toEqual(['Bearer <API_KEY>'])
          expect(headerOf(r, 'accept'), at).toEqual(['application/json'])
          expect(headerOf(r, 'content-type'), at).toEqual(
            r.method === 'POST' ? ['application/json'] : []
          )
        } else expect(host, at).toEqual(['<redirected>'])
        expect(headerOf(r, 'user-agent'), at).toEqual(['node'])
        expect(headerOf(r, 'accept-encoding'), at).toEqual(['gzip, deflate'])
        // R-076: no tracing headers on server fetches today
        expect(headerOf(r, 'sentry-trace'), at).toEqual([])
        expect(headerOf(r, 'baggage'), at).toEqual([])
      }
    }
    test.info().annotations.push({
      type: 'wire',
      description: pages
        .map((p) => `${p.target}: ${p.records.length} calls`)
        .join('; '),
    })
    if (RECORD) {
      writeJsonPretty(OUT, {
        link: LINK,
        reference: { test: 'T-607', ...referenceOf(p2Env) },
        named: NAMED,
        normalised: {
          'host (Internal_API)': '<Internal_API host>',
          'host (host-mode redirect)': '<redirected>',
          'API key in a value': '<API_KEY>',
          'order':
            'records of one page sorted by method, URL, body sha256, headers',
        },
        pages,
      })
      test.info().annotations.push({
        type: 'record',
        description: `${path.relative(REPO, OUT)} (${LINK})`,
      })
      return
    }
    const baseline = readJson(OUT, null)
    if (!baseline)
      throw new Error(
        `${path.relative(
          REPO,
          OUT
        )} is missing: record it with npm run e2e:record -- --run <id> --provisional --project wire -g 'T-607'`
      )
    expect(pages).toEqual(baseline.pages)
  })
})
