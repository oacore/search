// T-609 (41 G; R-004, R-018, R-073): SSR is per request. c1: 200 interleaved SSR requests over two queries and
// works 1001/1002, with random stub latency on every upstream answer: each response holds only its own data
// (bytes equal to the page fetched alone, and its own q / id). c2: the row runs on every 6.x PR, i.e. its
// tests are in the per-PR tier (@P0 in the chromium project). c3: /data-providers/?q=<a> and ?q=<b> (the two
// snapshot terms with disjoint results, test/fixtures/scenarios.json) in the same mix: each SSR result list
// holds only its own q (the server store's only per-request state, pages/data-providers/index.jsx:34).
// The order and the latency draws come from a recorded seed (annotation; T609_SEED replays another).
import fs from 'node:fs'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { test, expect } from '../fixtures/guard.mjs'
import { references, runMix, mismatches, diagnosis } from '../lib/P0-11/mix.mjs'
import { REPO, ARTIFACT_DIR } from '../lib/P0-11/files.mjs'

const SEED = Number(process.env.T609_SEED || 609)
const TOTAL = 200
const C1 = {
  '/search/?q=climate': { page: '/search', query: { q: 'climate' } },
  '/search/?q=x': { page: '/search', query: { q: 'x' } },
  '/works/1001/': { page: '/works/[id]', query: { id: '1001' } },
  '/works/1002/': { page: '/works/[id]', query: { id: '1002' } },
}
const picks = JSON.parse(
  fs.readFileSync(path.join(REPO, 'test', 'fixtures', 'scenarios.json'), 'utf8')
).picks.dataProvidersQueries.disjoint
const DP = Object.fromEntries(
  picks.map((p) => [
    `/data-providers/?q=${encodeURIComponent(p.q)}`,
    { q: p.q, ids: p.ids },
  ])
)
const even = (targets, n) =>
  Object.fromEntries(targets.map((t) => [t, n / targets.length]))

const annotate = (mix) =>
  test.info().annotations.push({
    type: 'mix',
    description: `seed ${mix.seed}; ${mix.total} requests; max in flight ${mix.maxInFlight}; latency draws ${mix.latencies.n} in [${mix.latencies.min}, ${mix.latencies.max}] ms; upstream calls ${mix.upstream.seen} (references predict ${mix.upstream.expected}); ${mix.ms} ms`,
  })

test.describe('T-609 @P0 SSR concurrency', () => {
  // the mixes load the one app hard: not in parallel with each other
  test.describe.configure({ mode: 'default', timeout: 600000 })

  test('T-609 c1 @P0 200 interleaved SSR requests (2 queries, works 1001/1002) with random latency: each response holds only its data', async ({
    p2Env,
  }) => {
    const targets = Object.keys(C1)
    const refs = await references(p2Env, targets)
    for (const t of targets) {
      expect(refs[t].status, t).toBe(200)
      expect(
        { page: refs[t].facts.page, query: refs[t].facts.query },
        t
      ).toEqual(C1[t])
    }
    const mix = await runMix(p2Env, even(targets, TOTAL), {
      seed: SEED,
      refs,
    })
    annotate(mix)
    expect(mix.responses).toHaveLength(TOTAL)
    // really interleaved, with latency spread
    expect(mix.maxInFlight).toBeGreaterThanOrEqual(10)
    expect(mix.latencies.max - mix.latencies.min).toBeGreaterThan(100)
    expect(mismatches(mix, refs), diagnosis(mix)).toEqual([])
    for (const r of mix.responses)
      expect({ page: r.facts.page, query: r.facts.query }).toEqual(C1[r.target])
  })

  test('T-609 c2 @P0 every 6.x PR: the row is in the per-PR tier (@P0, chromium project)', async () => {
    const cli = path.join(
      REPO,
      'e2e',
      'node_modules',
      '@playwright',
      'test',
      'cli.js'
    )
    const env = Object.fromEntries(
      Object.entries(process.env).filter(
        ([k]) => !/^(TEST_|PW_|PLAYWRIGHT_)/.test(k)
      )
    )
    const list = (project) => {
      const r = spawnSync(
        process.execPath,
        [
          cli,
          'test',
          '--config',
          path.join(REPO, 'playwright.config.mjs'),
          '--list',
          '--project',
          project,
          '--grep',
          '@P0',
          path.join('e2e', 'http', 't609-concurrency.spec.mjs'),
        ],
        { cwd: REPO, encoding: 'utf8', env: { ...env, ARTIFACT_DIR } }
      )
      // --list exits 1 with "No tests found" when the selection is empty
      if (r.status !== 0) {
        expect(r.stdout + r.stderr).toMatch(/No tests found/)
        return []
      }
      return [...r.stdout.matchAll(/› (T-609 c\d) @P0/g)].map((m) => m[1])
    }
    // the per-PR selection (40 §10: `-- --grep @P0`) picks every clause of the row in the chromium project
    expect([...new Set(list('chromium'))].sort()).toEqual([
      'T-609 c1',
      'T-609 c2',
      'T-609 c3',
    ])
    // and none is hidden in the serial wire project
    expect(list('wire')).toEqual([])
  })

  test('T-609 c3 @P0 /data-providers/?q=<a> and ?q=<b> in the same mix: each SSR result list holds only its own q (R-004)', async ({
    p2Env,
  }) => {
    const dpTargets = Object.keys(DP)
    expect(dpTargets).toHaveLength(2)
    // disjoint, non-empty picks
    const [a, b] = Object.values(DP)
    expect(a.ids.length).toBeGreaterThan(0)
    expect(b.ids.length).toBeGreaterThan(0)
    expect(a.ids.filter((id) => b.ids.includes(id))).toEqual([])
    const targets = [...Object.keys(C1), ...dpTargets]
    const refs = await references(p2Env, targets)
    for (const t of dpTargets) {
      expect(refs[t].status, t).toBe(200)
      expect(refs[t].facts.resultIds, t).toEqual(DP[t].ids)
      expect(refs[t].facts.jsonLdIds, t).toEqual(DP[t].ids)
    }
    // 30 of each term interleaved with 35 of each c1 page
    const counts = {
      ...even(Object.keys(C1), 140),
      ...even(dpTargets, 60),
    }
    const mix = await runMix(p2Env, counts, { seed: SEED + 1, refs })
    annotate(mix)
    expect(mix.responses).toHaveLength(TOTAL)
    expect(mix.maxInFlight).toBeGreaterThanOrEqual(10)
    const dp = mix.responses.filter((r) => DP[r.target])
    expect(dp).toHaveLength(60)
    for (const r of dp) {
      const own = DP[r.target]
      const at = `#${r.i} ${r.target}`
      expect(r.status, at).toBe(200)
      expect(r.facts.query, at).toEqual({ q: own.q })
      expect(r.facts.params.q, at).toBe(own.q)
      // the rendered list and the JSON-LD list: only this q's providers
      expect(r.facts.resultIds, at).toEqual(own.ids)
      expect(r.facts.jsonLdIds, at).toEqual(own.ids)
    }
    expect(mismatches(mix, refs), diagnosis(mix)).toEqual([])
  })
})
