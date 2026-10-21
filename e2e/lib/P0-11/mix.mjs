// P0-11 helpers for T-609 (41 G; R-004, R-018, R-073): interleaved SSR requests with random upstream latency.
// Each target is first fetched alone (no latency, nothing else of this file in flight) as its reference, with
// the SSR stub's records of that render (its upstream calls). Then the mix (a seeded shuffle of N requests over
// the targets) runs with up to `concurrency` requests in flight while the SSR stub delays the upstream answers
// by a random amount: before each request is sent, the stub's latency rule is replaced by one with a fresh
// seeded draw, so concurrent renders see different delays. The rule matches exactly the upstream URLs the
// references called (stub rules are global to the stack and the first match wins, so a broader pattern could
// shadow a rule of another test). A response "holds only its data" when its bytes equal its own target's
// reference (the pages are deterministic: same fixtures, one eligible member, frozen data), plus
// target-specific facts read from the HTML. The stub's record count of the mix window is kept for the failure
// message: fewer upstream calls than the references predict means a call never reached the stub (a transport
// failure between app and stub, P0-11-1), not a mixed-up response.
import { stubControl } from '../../fixtures/guard.mjs'
import { rawRequest, sha256, prng, shuffle, pool } from './http.mjs'

const nextData = (html) => {
  const m =
    /<script id="__NEXT_DATA__" type="application\/json">(.*?)<\/script>/s.exec(
      html
    )
  return m ? JSON.parse(m[1]) : null
}
// the server-rendered body before __NEXT_DATA__ (what a user sees)
const bodyPart = (html) => {
  const i = html.indexOf('<script id="__NEXT_DATA__"')
  return i < 0 ? html : html.slice(0, i)
}

// facts of one page: the q or id the server rendered, and for /data-providers/ the result list
export function facts(html) {
  const data = nextData(html)
  const body = bodyPart(html)
  const page = data ? data.page : null
  const out = { page, query: data ? data.query : null }
  if (page === '/data-providers') {
    out.resultIds = [...body.matchAll(/href="\/data-providers\/(\d+)"/g)].map(
      (m) => Number(m[1])
    )
    const ld = /<script type="application\/ld\+json">(.*?)<\/script>/s.exec(
      body
    )
    out.jsonLdIds = ld
      ? JSON.parse(ld[1])
          ['@graph'].filter((g) => g['@type'] === 'SearchResultsPage')
          .flatMap((g) => g.mainEntity.itemListElement)
          .map((it) =>
            Number(/repositories\.id:\((\d+)\)/.exec(it.item['@id'])[1])
          )
      : null
    const dp = data.props.pageProps.initialState.dataProviders
    out.params = dp.params
  }
  return out
}

// the app's own listener, one fresh connection per request: SSR isolation is a property of the app process,
// and the host-mode proxy's pooled keep-alive upstream sockets are reset by the app under this load (P0-11-2),
// which would turn into proxy 502s unrelated to the app's output
const fetchPage = async (env, target) => {
  const r = await rawRequest(env.appURL, target, {
    headers: { connection: 'keep-alive' },
    timeoutMs: 120000,
  })
  const html = r.body.toString('utf8')
  return {
    target,
    status: r.status,
    bytes: r.body.length,
    sha256: sha256(r.body),
    facts: facts(html),
    ms: r.ms,
  }
}

const upstreamKey = (rec) => `${rec.method} ${rec.url} ${rec.bodySha256}`

// each target alone, with the upstream calls of its render
export async function references(env, targets) {
  const out = {}
  for (const t of targets) {
    const mark = await stubControl(env, 'POST', '/mark', {
      name: `t609-ref-${Date.now()}`,
    })
    const page = await fetchPage(env, t)
    const win = await stubControl(env, 'GET', `/collect?since=${mark.seq}`)
    out[t] = {
      ...page,
      upstream: win.records.map(upstreamKey).sort(),
      upstreamUrls: [...new Set(win.records.map((r) => r.url))].sort(),
    }
  }
  return out
}

const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
// exactly the absolute upstream URLs of the references (Internal_API and the host-mode redirected doi.org)
export const upstreamPattern = (refs) => {
  const urls = [
    ...new Set(Object.values(refs).flatMap((r) => r.upstreamUrls)),
  ].sort()
  return urls.length ? `^(${urls.map(escapeRegex).join('|')})$` : null
}

// counts: {target: n}; returns the responses in dispatch order plus the run's facts
export async function runMix(
  env,
  counts,
  { seed, refs, concurrency = 20, maxLatencyMs = 250 }
) {
  const rand = prng(seed)
  const order = shuffle(
    Object.entries(counts).flatMap(([t, n]) => Array(n).fill(t)),
    rand
  )
  const urlRegex = upstreamPattern(refs)
  let ruleId = null
  let chain = Promise.resolve()
  const latencies = []
  // serialised rule swap: add the new rule, then drop the old one (the first matching rule wins)
  const swap = () => {
    chain = chain.then(async () => {
      const latencyMs = Math.floor(rand() * maxLatencyMs)
      latencies.push(latencyMs)
      if (!urlRegex) return
      const rule = await stubControl(env, 'POST', '/rules', {
        urlRegex,
        latencyMs,
      })
      if (ruleId) await stubControl(env, 'DELETE', `/rules?id=${ruleId}`)
      ruleId = rule.id
    })
    return chain
  }
  let inFlight = 0
  let maxInFlight = 0
  const started = Date.now()
  const mark = await stubControl(env, 'POST', '/mark', {
    name: `t609-mix-${seed}-${started}`,
  })
  try {
    const responses = await pool(
      order.map((target, i) => async () => {
        await swap()
        inFlight++
        maxInFlight = Math.max(maxInFlight, inFlight)
        try {
          return { i, ...(await fetchPage(env, target)) }
        } finally {
          inFlight--
        }
      }),
      concurrency
    )
    const win = await stubControl(env, 'GET', `/collect?since=${mark.seq}`)
    return {
      seed,
      total: order.length,
      maxInFlight,
      latencies: {
        n: latencies.length,
        min: Math.min(...latencies),
        max: Math.max(...latencies),
      },
      ms: Date.now() - started,
      upstream: {
        // the references' upstream calls summed over the mix vs. what reached the stub in the mix window
        // (the window can also hold calls of a test running in parallel on the same stack)
        expected: order.reduce((n, t) => n + refs[t].upstream.length, 0),
        seen: win.records.length,
        problems: win.problems.length,
      },
      responses,
    }
  } finally {
    await chain.catch(() => null)
    if (ruleId) await stubControl(env, 'DELETE', `/rules?id=${ruleId}`)
  }
}

// responses whose status or bytes differ from their own target's reference
export const mismatches = (mix, refs) =>
  mix.responses
    .filter(
      (r) =>
        r.status !== refs[r.target].status || r.sha256 !== refs[r.target].sha256
    )
    .map((r) => ({
      i: r.i,
      target: r.target,
      status: r.status,
      bytes: r.bytes,
      facts: r.facts,
    }))

export const diagnosis = (mix) =>
  `seed ${mix.seed}; upstream calls in the mix window ${mix.upstream.seen}, the references predict ${mix.upstream.expected} (fewer: a call never reached the stub, P0-11-1); stub problems ${mix.upstream.problems}`
