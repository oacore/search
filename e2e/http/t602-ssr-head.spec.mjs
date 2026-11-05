// T-602 (41 G; R-003, R-005, R-042, R-069, R-078): the SSR head of findings/07 §7.1 on works 1001-1005,
// outputs 2001-2004, O-yearstring (2101), search, providers and the error answers, read from the raw HTTP
// body through the gateway-faithful proxy and parsed by the browser's HTML parser in an inert document (JS
// off, comments kept). c1 raw <title> bytes; c2 app-owned tags in order, set per page type (30 Q-053 table);
// c3 the head with only the 40 §1 normalisations = baseline; c4 html-validate findings pinned (Q-072 nested
// <a>, Q-089 duplicate ids); c5 work 1004's `</script>` payload runs (window.__PWN === 1) only in a throwaway
// sandboxed context (S-4, preserved: OD-36), never in the default context of any test, and the page stays: after
// hydration #__next holds what the server rendered (CS-N12-12).
import { HtmlValidate } from 'html-validate'
import { test, expect, guardContext } from '../fixtures/guard.mjs'
import { TIMEZONE_ID, LOCALE } from '../fixtures/constants.mjs'
import {
  T602_PAGES,
  CITATION_DATE,
  FAVICONS,
  FRAME,
  DEFAULT_TITLE,
  NEXT_ERROR_TITLE,
  fetchRaw,
  apiObject,
  escapeText,
  rawTitleBytes,
} from '../lib/P0-10/pages.mjs'
import { parseHead } from '../lib/P0-10/dom.mjs'
import {
  normaliseHead,
  normaliseFindings,
  seoNames,
  stackOrigins,
  NORMALISATIONS,
} from '../lib/P0-10/normalise.mjs'
import { expectBaseline } from '../lib/P0-10/baseline.mjs'
import {
  serveDoiFixtures,
  serveBrowserGaps,
} from '../lib/P0-10/harness-gaps.mjs'

const S4_PAYLOAD = '</script><script>window.__PWN=1</script>'
// Q-072 parser reports inside the full-text card: none on any page since CS-ESC-1 (W5.5) renders the card as a
// span. Before it: none with fulltextStatus 'disabled' (2003) or without a reader/download link (work 1002: the
// card was an <a> with no <a> buttons), 2 to 5 on the other pages
const NESTED_IN_CARD = {
  'works-1001': 0,
  'works-1002': 0,
  'works-1003': 0,
  'works-1004': 0,
  'works-1005': 0,
  'outputs-2001': 0,
  'outputs-2003': 0,
  'outputs-2004': 0,
  'outputs-2101': 0,
  'outputs-2105': 0,
  'outputs-2106': 0,
}
const TITLE_FOR = {
  'search': 'Search CORE',
  'providers': 'Data providers search',
  'default': DEFAULT_TITLE,
  'next-error': NEXT_ERROR_TITLE,
}
// the one tag Next 13.5 writes after the app's head tags of every server-rendered page: a preconnect to its own
// origin, from the empty `/_app` entry of next-font-manifest.json (AD-179)
const PRECONNECT_SELF = {
  tag: 'link',
  attrs: {
    'crossorigin': 'anonymous',
    'data-next-font': '',
    'href': '/',
    'rel': 'preconnect',
  },
}

const titleOf = (page, resolver) =>
  page.api
    ? `${apiObject(resolver, page.api).title} - CORE`
    : TITLE_FOR[page.type]

async function load(request, env, p) {
  const raw = await fetchRaw(request, `${env.baseURL}${p.path}`)
  expect(raw.status, `${p.id} status`).toBe(p.status)
  return raw
}

// what #__next holds: the first h1's text, the header and the main element (the cookie banner is added in the
// browser, so the number of children differs between the served and the hydrated page on every build)
const pageShape = (pg) =>
  pg.evaluate(() => {
    const root = document.getElementById('__next')
    return {
      h1: root?.querySelector('h1')?.textContent ?? null,
      header: Boolean(root?.querySelector('#header')),
      main: Boolean(root?.querySelector('main')),
    }
  })

test.describe('T-602 @P0 SSR head', () => {
  // each clause loops over ~30 pages incl. two ~7 MB provider-map pages; stacks of parallel packages share the CPU
  test.describe.configure({ timeout: 300000 })
  // E9 citations from the recorded fixtures while the stub does not list doi.org (I-40, P0-10-1)
  let restoreDoi = async () => {}
  test.beforeEach(async ({ p2Env, resolver }) => {
    restoreDoi = await serveDoiFixtures(p2Env, resolver)
  })
  test.afterEach(async () => restoreDoi())

  test('T-602 c1 @P0 raw <title> bytes from the HTTP body; DOM parser with JS off, comments kept: one text node', async ({
    page,
    request,
    p2Env,
    resolver,
  }) => {
    for (const p of T602_PAGES) {
      const raw = await load(request, p2Env, p)
      if (p.type === 'redirect') {
        expect(raw.headers.location, p.id).toBe(p.location)
        expect(raw.body.length, `${p.id} empty body`).toBe(1) // AD-103
        continue
      }
      const text = titleOf(p, resolver)
      // React 17 escapes " & ' < > in text; the title is one string, no `<!-- -->` separator (R-069)
      const bytes = rawTitleBytes(raw.body)
      expect(bytes, `${p.id} has a <title>`).not.toBeNull()
      expect(bytes.toString('utf8'), `${p.id} raw <title> bytes`).toBe(
        escapeText(text)
      )
      expect(bytes.length, `${p.id} raw <title> byte length`).toBe(
        Buffer.byteLength(escapeText(text))
      )
      const parsed = await parseHead(page, raw.text)
      const titles = parsed.head.filter((e) => e.tag === 'title')
      expect(titles, `${p.id} one <title> in the parsed head`).toHaveLength(1)
      expect(titles[0].childNodes, `${p.id} title child nodes`).toEqual([
        { type: 'text', data: text },
      ])
    }
  })

  test('T-602 c2 @P0 app-owned tags in order, set per page type (Q-053)', async ({
    page,
    request,
    p2Env,
    resolver,
  }) => {
    const origins = stackOrigins(p2Env)
    for (const p of T602_PAGES) {
      if (p.type === 'redirect') continue
      const raw = await load(request, p2Env, p)
      const parsed = await parseHead(page, raw.text)
      const n = normaliseHead(parsed.head, { origins })
      // every page: viewport, charset and the 5 favicons of main/head.jsx; no <html> attributes (no lang,
      // Q-054); no canonical, robots, Open Graph or Twitter tags
      expect(n.frame, `${p.id} charset + viewport`).toEqual(FRAME)
      expect(n.favicons, `${p.id} favicons`).toEqual(FAVICONS)
      expect(parsed.htmlAttrs, `${p.id} <html> attributes`).toEqual({})
      const names = seoNames(n.seo)
      expect(
        names.filter((x) =>
          /^(canonical|robots|og:|twitter:|citation_pdf_url$|DC\.format$|DC\.issued$)/.test(
            x
          )
        ),
        `${p.id} absent tags`
      ).toEqual([])
      if (p.type === 'works' || p.type === 'outputs') {
        const api = apiObject(resolver, p.api)
        const authors = (api.authors || []).map((a) => a.name)
        const publishedDate = api.publishedDate
          ? api.publishedDate
          : api.yearPublished
        const date = CITATION_DATE[p.id]
        expect(names, `${p.id} SEO tag order`).toEqual([
          'title',
          'citation_title',
          ...authors.map(() => 'citation_author'),
          ...(date ? ['citation_publication_date'] : []),
          ...authors.map(() => 'DC.creator'),
          'DC.title',
          ...(api.abstract ? ['DCTERMS.abstract'] : []),
          ...(api.oai ? ['DC.identifier'] : []),
          ...(api.subjects || []).map(() => 'DC.subject'),
          'ld+json',
        ])
        const content = (name) =>
          n.seo.filter((e) => e.attrs.name === name).map((e) => e.attrs.content)
        // raw API author strings in API order ("Surname, Given" kept, not the page's display form)
        expect(content('citation_author'), `${p.id} citation_author`).toEqual(
          authors
        )
        expect(content('DC.creator'), `${p.id} DC.creator`).toEqual(authors)
        expect(content('citation_title'), `${p.id} citation_title`).toEqual([
          api.title,
        ])
        expect(
          content('citation_publication_date'),
          `${p.id} citation_publication_date`
        ).toEqual(date ? [date] : [])
        if (api.oai)
          expect(content('DC.identifier'), `${p.id} DC.identifier`).toEqual([
            api.oai,
          ])
        const ld = n.seo.find((e) => e.tag === 'script')
        if (p.id === 'works-1004') {
          // the payload closes the JSON-LD script early (S-4, c5)
          expect(ld.jsonldUnparseable, `${p.id} JSON-LD`).toBeTruthy()
          continue
        }
        const article = ld.jsonld['@graph'].find(
          (g) => g['@type'] === 'ScholarlyArticle'
        )
        // JSON-LD author[].name is the author object, datePublished the raw value (Q-053)
        expect(article.author, `${p.id} JSON-LD author`).toEqual(
          (api.authors || []).map((a) => ({ '@type': 'Person', 'name': a }))
        )
        expect(article.datePublished, `${p.id} JSON-LD datePublished`).toBe(
          publishedDate || ''
        )
        expect(article['@id']).toBe(`https://core.ac.uk/reader/${api.id}`)
        expect(article.image).toBe(`https://core.ac.uk/image/${api.id}/large`)
        expect(
          n.other,
          `${p.id} no other head tags but the preconnect of AD-179`
        ).toEqual([PRECONNECT_SELF]) // AD-179
        expect(
          parsed.bodyLead,
          `${p.id} nothing parsed ahead of #__next`
        ).toEqual([])
      } else if (p.type === 'providers') {
        expect(names, `${p.id} SEO tag order`).toEqual([
          'title',
          'description',
          'ld+json',
        ])
        expect(n.seo[1].attrs.content).toBe(
          'Search over 15672 repositories and journals around the world'
        )
        expect(n.seo[2].jsonld['@graph'].map((g) => g['@type'])).toEqual([
          'BreadcrumbList',
          'SearchResultsPage',
        ])
        expect(n.other).toEqual([PRECONNECT_SELF]) // AD-179
      } else {
        // search, default title pages and Next's error page carry no app tag besides the title
        expect(names, `${p.id} SEO tags`).toEqual(['title'])
        expect(
          n.other,
          `${p.id} no other head tags but the preconnect of AD-179`
        ).toEqual([PRECONNECT_SELF]) // AD-179
        expect(parsed.bodyLead).toEqual([])
      }
    }
  })

  test('T-602 c3 @P0 head with only the 40 §1 normalisations = baseline', async ({
    page,
    request,
    p2Env,
  }) => {
    const origins = stackOrigins(p2Env)
    const buildId = p2Env.build ? p2Env.build.buildId : null
    expect(NORMALISATIONS.head).toHaveLength(10)
    for (const p of T602_PAGES) {
      const raw = await load(request, p2Env, p)
      const entry = {
        path: p.path,
        status: raw.status,
        location: raw.headers.location ?? null,
        contentType: raw.headers['content-type'] ?? null,
      }
      if (p.type !== 'redirect') {
        const parsed = await parseHead(page, raw.text)
        Object.assign(entry, {
          titleRaw: rawTitleBytes(raw.body).toString('utf8'),
          htmlAttrs: parsed.htmlAttrs,
          head: normaliseHead(parsed.head, { origins, buildId }),
          bodyLead: normaliseHead(
            parsed.bodyLead.filter((e) => e.tag),
            { origins, buildId }
          ),
          bodyLeadText: parsed.bodyLead
            .filter((e) => !e.tag)
            .map((e) => e.text ?? e.comment),
        })
      }
      expectBaseline(`t602-head-${p.id}`, entry, `${p.id} head = baseline`)
    }
  })

  test('T-602 c4 @P0 html-validate findings on the raw HTML pinned (Q-072 nested <a>, Q-089 duplicate ids)', async ({
    request,
    p2Env,
    resolver,
  }) => {
    const origins = stackOrigins(p2Env)
    const validator = new HtmlValidate({
      extends: ['html-validate:recommended'],
    })
    const dupIds = (findings) => {
      const c = {}
      for (const f of findings.filter((x) => x.ruleId === 'no-dup-id')) {
        const id = /Duplicate ID "([^"]*)"/.exec(f.message)[1]
        c[id] = (c[id] || 0) + 1
      }
      return c
    }
    const nestedA = (findings) =>
      findings.filter(
        (f) =>
          f.ruleId === 'element-permitted-content' &&
          f.message === '<a> element is not permitted as a descendant of <a>'
      )
    for (const p of T602_PAGES) {
      if (p.type === 'redirect') continue
      const raw = await load(request, p2Env, p)
      const report = await validator.validateString(raw.text)
      const messages = report.results.flatMap((r) => r.messages)
      const findings = normaliseFindings(raw.text, messages, { origins })
      expectBaseline(
        `t602-html-validate-${p.id}`,
        findings,
        `${p.id} html-validate findings = baseline`
      )
      const dups = dupIds(findings)
      // Q-089: the design header renders `about-title` twice on every page
      expect(dups['about-title'], `${p.id} about-title`).toBe(1)
      if (p.type === 'works' || p.type === 'outputs') {
        // Q-089: one `author` id per author item (templates/output/metadata.jsx:21)
        const n = (apiObject(resolver, p.api).authors || []).length
        expect(dups.author || 0, `${p.id} duplicate author ids`).toBe(
          Math.max(n - 1, 0)
        )
      }
      // Q-072: FullTextThumbnail rendered design Card tag='a' around its <a> buttons unless fulltextStatus was
      // 'disabled' (outputs 2003); since CS-ESC-1 the card is a span; every other nested <a> is pinned by the
      // baseline above
      if (p.type === 'works' || p.type === 'outputs') {
        const api = apiObject(resolver, p.api)
        const inCard = nestedA(findings).filter((f) =>
          new RegExp(`^#full-text-thumbnail-${api.id}(-body)? > `).test(
            f.selector
          )
        )
        expect(
          raw.text.includes(`id="full-text-thumbnail-${api.id}"`),
          `${p.id} full-text card`
        ).toBe(true)
        expect(inCard.length, `${p.id} nested <a> in the card`).toBe(
          NESTED_IN_CARD[p.id]
        )
      }
    }
  })

  test('T-602 c5 @P0 work 1004: the </script> payload runs (window.__PWN === 1) only in a throwaway sandboxed context (S-4, OD-36)', async ({
    page,
    request,
    p2Env,
    resolver,
    browser,
    baseURL,
    jsOffContext,
  }) => {
    const p = T602_PAGES.find((x) => x.id === 'works-1004')
    const api = apiObject(resolver, p.api)
    expect(api.title).toContain(S4_PAYLOAD)
    expect(api.abstract).toContain(S4_PAYLOAD)
    const raw = await load(request, p2Env, p)
    // JSON.stringify leaves `<` unescaped: the payload is in the JSON-LD text four times (breadcrumb name,
    // headline, name, abstract); every other place escapes it
    const ldStart = raw.text.indexOf('<script type="application/ld+json">')
    const headEnd = raw.text.indexOf('</head>')
    expect(raw.text.split(S4_PAYLOAD).length - 1).toBe(4)
    expect(raw.text.slice(ldStart, headEnd).split(S4_PAYLOAD).length - 1).toBe(
      4
    )
    // the inert parse: the JSON-LD script ends at the first `</script>`, the injected script element
    // follows, and the rest of the head text is parsed into <body> ahead of #__next
    const parsed = await parseHead(page, raw.text)
    const tags = parsed.head.map((e) =>
      e.tag === 'script' ? `script:${e.attrs.type || 'inline'}` : e.tag
    )
    expect(tags.slice(-2)).toEqual([
      'script:application/ld+json',
      'script:inline',
    ])
    const ld = parsed.head[parsed.head.length - 2]
    expect(ld.text.endsWith('"name":"Ünïcödé – 日本語 – ')).toBe(true)
    expect(() => JSON.parse(ld.text)).toThrow(SyntaxError)
    expect(parsed.head[parsed.head.length - 1].text).toBe('window.__PWN=1')
    expect(parsed.head.some((e) => e.attrs.name === 'next-head-count')).toBe(
      false
    )
    expect(parsed.bodyLead.length).toBeGreaterThan(0)
    expect(
      parsed.bodyLead[0].text.startsWith('– mandatory due diligence"')
    ).toBe(true)

    // throwaway sandboxed context: its own guard log, asserted here, closed at the end; JS enabled
    const sandboxLog = {
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
    }
    let hydrated
    const sandbox = await browser.newContext({
      baseURL,
      timezoneId: TIMEZONE_ID,
      locale: LOCALE,
      serviceWorkers: 'block',
      acceptDownloads: false,
    })
    try {
      await guardContext(sandbox, {
        env: p2Env,
        resolver,
        log: sandboxLog,
        baseURL,
      })
      await serveBrowserGaps(sandbox, { request, env: p2Env, resolver })
      const s = await sandbox.newPage()
      await s.goto(p.path)
      await expect.poll(() => s.evaluate(() => window.__PWN)).toBe(1)
      await expect
        .poll(() => sandboxLog.pageErrors.map((e) => e.message))
        .toEqual([
          "Cannot read properties of null (reading 'content')",
          "Cannot read properties of null (reading 'content')",
        ]) // AD-136
      // no script-src violation: script-src-elem allows 'unsafe-inline'; the one violation is the browser
      // Sentry report of that page error (connect-src, Q-096), to the envelope endpoint of Sentry 7 (AD-020;
      // the store endpoint of Sentry 5.30 before)
      await expect
        .poll(() =>
          sandboxLog.csp.map((v) => [
            v.effectiveDirective,
            v.blockedURI.split('?')[0],
          ])
        )
        .toEqual([
          ['connect-src', 'https://o0.ingest.sentry.io/api/0/envelope/'],
          ['connect-src', 'https://o0.ingest.sentry.io/api/0/envelope/'],
        ]) // AD-136
      expect(sandboxLog.unexpected).toEqual([])
      expect(sandboxLog.unmatched).toEqual([])
      // the head error has happened (the page error above): the hydrated page, compared below with the
      // server-rendered one
      hydrated = await pageShape(s)
    } finally {
      await sandbox.close()
    }

    // the default contexts never run it: with JavaScript off (guarded like every context) it is inert
    await serveBrowserGaps(jsOffContext, { request, env: p2Env, resolver })
    const off = await jsOffContext.newPage()
    await off.goto(p.path)
    expect(await off.evaluate(() => window.__PWN)).toBeUndefined()

    // the page stays after hydration (S-4: the head is corrupted, the page is shown): #__next of the sandboxed
    // page holds what the server rendered, as on Next 10.2.3 (CS-N12-12)
    const served = await pageShape(off)
    expect(served).toEqual({ h1: api.title, header: true, main: true })
    expect(hydrated).toEqual(served)
  })
})
