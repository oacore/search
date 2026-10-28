// T-729 (41 H; R-003, R-071): the post-hydration `document.head` of the works and outputs pages, read from the
// live document of the settled hydrated page. Q-069 (pinned, not corrected): the SSR head is complete (T-602),
// but Next 10's head manager does not manage the tags `modules/meta` renders inside <Head>, so after hydration
// the head is corrupted: viewport, charset and favicons are duplicated, DC.title, DCTERMS.abstract,
// DC.identifier, DC.subject and the JSON-LD vanish, and which citation_* / DC.creator tags survive depends on
// the author and subject counts; after a client navigation only <title> follows, the Meta tags stay stale.
// c1 per fixture with varied author (1, 3, 4, 6, 30) and subject (0, 1, 5) counts = baseline; c2 the head after
// client navigations = baseline (today's stale head; from Next 15 the head follows the navigation and the
// per-version diff enters as an AD row, OD-39). Only the Next-owned head elements, build ID and chunk hashes
// are normalised (normalise.mjs NORMALISATIONS.postHydrationHead).
import { test, expect } from '../fixtures/guard.mjs'
import { T602_PAGES, fetchRaw } from '../lib/P0-10/pages.mjs'
import { parseHead, liveHead } from '../lib/P0-10/dom.mjs'
import {
  headSequence,
  sequenceNames,
  countOf,
  stackOrigins,
  NORMALISATIONS,
} from '../lib/P0-10/normalise.mjs'
import { expectBaseline } from '../lib/P0-10/baseline.mjs'
import { trackPage, settle, clientNav } from '../lib/P0-10/settle.mjs'
import {
  serveDoiFixtures,
  serveBrowserGaps,
} from '../lib/P0-10/harness-gaps.mjs'

// work 1004 is left out: its payload runs scripts in a JS context (S-4; T-602 c5 sandbox only)
const FIXTURES = [
  'works-1001', // 6 authors, abstract
  'works-1002', // 1 author, no publication date
  'works-1003', // 30 authors
  'works-1005', // 6 authors, 300-character title
  'outputs-2001', // 4 authors, DC.identifier, 0 subjects
  'outputs-2003', // 3 authors, no abstract
  'outputs-2004', // 4 authors, no reader link
  'outputs-2101', // year string date (Q-053)
  'outputs-2105', // 5 subjects
  'outputs-2106', // 1 subject
].map((id) => T602_PAGES.find((p) => p.id === id))

// client navigations into a page with Meta tags, as the app performs them: output A -> B (41 §2.2 "Client nav
// output A → B", T-702 c9), driven through the router of the hydrated page (router.push, what next/link does).
// Not here: search results are full navigations (T-702 c6), and the header search of a works/outputs page
// (router.push('/search?q=' + term), pages/works/[id].jsx:130) crashes today with React #300 (issue P0-10-6)
// step = { href pushed, url the router ends at }
const step = (href, url = href) => ({ href, url })
const CHAINS = [
  {
    id: 'outputs-a-to-b',
    start: '/outputs/2003/',
    steps: [step('/outputs/2004/')],
  },
  {
    id: 'outputs-subjects',
    start: '/outputs/2105/',
    steps: [step('/outputs/2106/'), step('/outputs/2001/')],
  },
  {
    id: 'outputs-oai-to-yearstring',
    start: '/outputs/2001/?source=oai',
    steps: [step('/outputs/2101/')],
  },
]

const VANISH = ['DC.title', 'DCTERMS.abstract', 'DC.identifier', 'DC.subject']
const SEO_META = /^meta\[name=(citation_|DC\.|DCTERMS\.)/

const opts = (p2Env) => ({
  origins: stackOrigins(p2Env),
  buildId: p2Env.build ? p2Env.build.buildId : null,
})

async function ssrSequence(page, request, p2Env, path) {
  const raw = await fetchRaw(request, `${p2Env.baseURL}${path}`)
  expect(raw.status, `${path} status`).toBe(200)
  const parsed = await parseHead(page, raw.text)
  return headSequence(parsed.head, opts(p2Env))
}

const liveSequence = async (page, p2Env) => {
  const h = await liveHead(page)
  return { htmlAttrs: h.htmlAttrs, head: headSequence(h.head, opts(p2Env)) }
}

// the settled head as a test attachment (triage of a difference)
const attachJson = (name, value) =>
  test.info().attach(name, {
    body: JSON.stringify(value, null, 1),
    contentType: 'application/json',
  })

// the SEO meta of a sequence as `name=content`, in order
const seoMeta = (seq) =>
  seq
    .filter(
      (e) =>
        e.tag === 'meta' &&
        e.attrs.name &&
        SEO_META.test(`meta[name=${e.attrs.name}]`)
    )
    .map((e) => `${e.attrs.name}=${e.attrs.content}`)

test.describe('T-729 @P0 post-hydration head', () => {
  // a settled state can take a minute when the parallel packages' stacks load the CPUs (settle.mjs)
  test.describe.configure({ timeout: 240000 })
  // E9 citations from the recorded fixtures while the stub does not list doi.org (I-40, P0-10-1)
  let restoreDoi = async () => {}
  test.beforeEach(async ({ p2Env, resolver, context, request }) => {
    restoreDoi = await serveDoiFixtures(p2Env, resolver)
    await serveBrowserGaps(context, { request, env: p2Env, resolver })
  })
  test.afterEach(async () => restoreDoi())

  for (const fx of FIXTURES)
    test(`T-729 c1 @P0 document.head of ${fx.id} after hydration = pinned (Q-069)`, async ({
      page,
      request,
      p2Env,
    }) => {
      expect(NORMALISATIONS.postHydrationHead).toHaveLength(3)
      const ssr = await ssrSequence(page, request, p2Env, fx.path)
      const tracker = trackPage(page)
      await page.goto(fx.path)
      const live = await settle(page, tracker, () => liveSequence(page, p2Env))
      await attachJson('live-head', live)
      const s = sequenceNames(ssr)
      const l = sequenceNames(live.head)
      // what holds for every fixture (Q-069): one <title>, the SSR text
      expect(live.head.filter((e) => e.tag === 'title')).toEqual(
        ssr.filter((e) => e.tag === 'title')
      )
      // DC.title, DCTERMS.abstract, DC.identifier, DC.subject and the JSON-LD vanish
      for (const name of VANISH)
        expect(countOf(l, `meta[name=${name}]`), `${fx.id} ${name}`).toBe(0)
      expect(
        countOf(l, 'script[application/ld+json]'),
        `${fx.id} JSON-LD`
      ).toBe(0)
      expect(countOf(s, 'script[application/ld+json]')).toBe(1)
      // viewport and charset are duplicated, the favicons are duplicated in part or in full
      expect(countOf(s, 'meta[name=viewport]')).toBe(1)
      expect(countOf(l, 'meta[name=viewport]'), `${fx.id} viewport`).toBe(2)
      expect(countOf(l, 'meta[charset]'), `${fx.id} charset`).toBe(2)
      const icons = l.filter((n) => n.startsWith('link[icon')).length
      expect(icons, `${fx.id} favicons`).toBeGreaterThan(5)
      expect(icons).toBeLessThanOrEqual(10)
      // nothing is added that the SSR head did not have
      // except the LogRocket recorder script the client inserts (logrocket >= 11 loads it from
      // cdn.logr-in.com, CS-LR-1, AD-034; cdn.lgrckt-in.com with 10.0.0)
      for (const n of new Set(l))
        if (n !== 'script[src=https://cdn.logr-in.com/logger-1.min.js]')
          expect(s, `${fx.id} ${n} comes from the SSR head`).toContain(n)
      expectBaseline(
        `t729-head-${fx.id}`,
        { path: fx.path, ssrNames: s, ...live },
        `${fx.id} post-hydration head = baseline`
      )
    })

  for (const chain of CHAINS)
    test(`T-729 c2 @P0 document.head after client navigation ${chain.id} = pinned (stale, Q-069; per-version diff from 15 as AD rows, OD-39)`, async ({
      page,
      request,
      p2Env,
    }) => {
      const read = () => liveSequence(page, p2Env)
      const tracker = trackPage(page)
      await page.goto(chain.start)
      const first = await settle(page, tracker, read)
      await attachJson('live-head-0', first)
      const steps = [{ href: chain.start, title: await page.title(), ...first }]
      for (const { href, url } of chain.steps) {
        const target = await ssrSequence(page, request, p2Env, url)
        const live = await clientNav(page, tracker, href, read, { url })
        await attachJson(`live-head-${href}`, live)
        // <title> follows the navigation (next/head manages it) ...
        const title = live.head.filter((e) => e.tag === 'title')
        expect(title, `${href} title`).toEqual(
          target.filter((e) => e.tag === 'title')
        )
        expect(await page.title()).toBe(title[0].text)
        // ... the Meta tags do not: the SEO meta of the first hydrated page stay, the target's never appear
        expect(seoMeta(live.head), `${href} SEO meta stale`).toEqual(
          seoMeta(first.head)
        )
        steps.push({ href, url, title: await page.title(), ...live })
      }
      expectBaseline(
        `t729-nav-${chain.id}`,
        steps,
        `${chain.id} heads after client navigation = baseline`
      )
    })
})
