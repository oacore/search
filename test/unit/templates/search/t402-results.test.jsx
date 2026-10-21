// T-402 (41 E, R-010, R-033, R-051): the result cards of the search page with
// the real design SearchResult, rendered from the works of the recorded
// `climate` page (shaped like the getServerSideProps does: findUrlsByType).
// c1 the title link (Q-012: nested query not encoded), c2 the reader link
// rewrite, c3 the full-text link order (findings/06 §2.2), c4 the logo rule
// (Q-023: member found by `checkType`, number arrays never match), c5 one
// browser GET per card per provider for the logo (E22, Q-090), c6 the date in
// UTC.
import React from 'react'
import { setRouter } from 'next/router'

import { setupMsw } from '../../../utils/msw'
import { render, waitFor as baseWaitFor, act } from '../../../utils/render'
import { findUrlsByType } from '../../../../utils/helpers'
import Results from '../../../../templates/search/results'

jest.setTimeout(30000)

const { server, resolver } = setupMsw()

// waits are generous: the suites of other packages run on the same machine
const waitFor = (callback, options) =>
  baseWaitFor(callback, { timeout: 8000, ...options })

// the synthetic members of the Jest project (test/fixtures/data), changed in
// place per test: the template reads this array through `checkType`
const members = require('data/.members.json')

const SEARCH_URL = 'https://api.core.ac.uk/v3/search/works?t=undefined'
const PAGE = JSON.parse(
  resolver
    .resolve(
      'POST',
      SEARCH_URL,
      '{"q":"climate","offset":0,"limit":10,"exclude":["fullText"],' +
        '"sort":"relevance"}'
    )
    .body.toString()
)
const SEARCH_ID = PAGE.searchId
const AS_PATH = '/search?q=climate&page=2'
const NESTED = 'q=climate&page=2'

// a recorded result as pages/search/index.jsx hands it to the template: the
// link urls copied onto the work, the providers reduced to what is rendered
const shape = (work) => ({
  ...findUrlsByType({ ...work }),
  dataProviders: (work.dataProviders || []).map(({ id, name, url }) => ({
    id,
    name,
    url,
  })),
})
const WORKS = PAGE.results.map(shape)
const byId = (id) => WORKS.find((w) => w.id === id)

// recorded: download + reader + display, no publishedDate, year 2015
const W_HOSTED = byId(19211324)
// recorded: two providers, publishedDate with +00:00
const W_TWO = byId(18872441)
// recorded: three providers
const W_THREE = byId(17489114)
// recorded: only a display link, no year
const W_BARE = byId(153927213)

// a copy of a recorded work with other links (the rest stays), re-shaped
const withLinks = (work, links) => {
  const copy = { ...work, links }
  for (const key of ['download', 'reader', 'display', 'thumbnail_m'])
    delete copy[key]
  return shape(copy)
}
const link = (type, url) => ({ type, url })
const linksOf = (work, ...types) =>
  work.links.filter((l) => types.includes(l.type))

const card = (id) => document.getElementById(`work-search-output-${id}`)
const titleLink = (id) => card(id).querySelector('h3 a')
const thumb = (id) => card(id).querySelector('figure a')
const caption = (id) => card(id).querySelector('figure span').textContent
const variantOf = (id) =>
  card(id).className.match(/full-text-(hosted|linked|missing)/)[1]
const dateOf = (id) => card(id).querySelector('[itemprop="datePublished"]')

const row = (member) => ({
  organisation_id: 9100,
  billing_plan_id: 1,
  billing_start_date: '2025-01-01 00:00:00',
  billing_end_date: '2027-01-01 00:00:00',
  description: 'synthetic member',
  activated: 1,
  country_code: 'GB',
  organisation_name: 'Synthetic Member',
  ...member,
})

const original = members.slice()
let started
let answered

beforeEach(() => {
  // no member unless a test adds rows: the cards of c1-c3 and c6 are plain
  members.splice(0, members.length)
  setRouter({ asPath: AS_PATH })
  started = []
  answered = 0
  server.events.on('request:start', ({ request }) => {
    started.push(request)
  })
  server.events.on('response:mocked', () => {
    answered += 1
  })
})

afterEach(() => {
  server.events.removeAllListeners()
  members.splice(0, members.length, ...original)
})

// waits until every logo request has an answer and the cards took it in
const settle = async () => {
  await waitFor(() => expect(answered).toBe(started.length))
  await act(async () => {
    await new Promise((resolve) => {
      setTimeout(resolve, 0)
    })
  })
}

// show(works) uses the recorded searchId, show(works, undefined) passes none
const show = async (works, ...rest) => {
  const searchId = rest.length ? rest[0] : SEARCH_ID
  const view = render(<Results works={works} searchId={searchId} />)
  await settle()
  return view
}

describe('T-402 @P0 search result cards', () => {
  test('T-402 c1 @P0 title href: <display link>/?t=<searchId>-<id>&search=<asPath after ?> for every card (Q-012)', async () => {
    await show(WORKS)
    expect(WORKS).toHaveLength(10)
    for (const work of WORKS) {
      const a = titleLink(work.id)
      expect(a.getAttribute('href')).toBe(
        `${work.display}/?t=${SEARCH_ID}-${work.id}&search=${NESTED}`
      )
      expect(a.textContent).toBe(work.title)
      expect(a.parentElement.tagName).toBe('H3')
      expect(a.parentElement.getAttribute('itemprop')).toBe('name')
    }
    expect(titleLink(19211324).getAttribute('href')).toBe(
      `https://core.ac.uk/works/19211324/?t=${SEARCH_ID}-19211324&search=${NESTED}`
    )
  })

  test('T-402 c1 @P0 title href: the nested query is the raw asPath after the first "?", not encoded (Q-012)', async () => {
    const expectations = [
      ['/search?q=climate&page=2', 'q=climate&page=2'],
      [
        '/search?q=C%23%20%26%20C%2B%2B&page=1',
        'q=C%23%20%26%20C%2B%2B&page=1',
      ],
      ['/search?q=a?b&sort=recent', 'q=a?b&sort=recent'],
      ['/search?', ''],
      // no "?" at all: indexOf is -1, the whole path is taken
      ['/search', '/search'],
    ]
    for (const [asPath, nested] of expectations) {
      setRouter({ asPath })
      // eslint-disable-next-line no-await-in-loop
      const { unmount } = await show([W_HOSTED])
      expect(titleLink(W_HOSTED.id).getAttribute('href')).toBe(
        `${W_HOSTED.display}/?t=${SEARCH_ID}-${W_HOSTED.id}&search=${nested}`
      )
      unmount()
    }

    // read back as a URL, the "&page=1" of the nested query is a top-level
    // parameter of the works link
    setRouter({ asPath: '/search?q=C%23%20%26%20C%2B%2B&page=1' })
    await show([W_HOSTED])
    const url = new URL(titleLink(W_HOSTED.id).getAttribute('href'))
    expect([...url.searchParams.keys()]).toEqual(['t', 'search', 'page'])
    expect(url.searchParams.get('search')).toBe('q=C# & C++')
    expect(url.searchParams.get('page')).toBe('1')
  })

  test('T-402 c1 @P0 title href: without a searchId the link is the display link as it is', async () => {
    await show([W_HOSTED, W_BARE], undefined)
    expect(titleLink(W_HOSTED.id).getAttribute('href')).toBe(W_HOSTED.display)
    expect(titleLink(W_BARE.id).getAttribute('href')).toBe(W_BARE.display)
  })

  test('T-402 c1 @P0 title href: a work without a display link gets "undefined/?t=..." with a searchId and a plain title without one', async () => {
    const noDisplay = withLinks(W_HOSTED, linksOf(W_HOSTED, 'download'))
    expect(noDisplay.display).toBeUndefined()

    const view = await show([noDisplay])
    expect(titleLink(noDisplay.id).getAttribute('href')).toBe(
      `undefined/?t=${SEARCH_ID}-${noDisplay.id}&search=${NESTED}`
    )
    view.unmount()

    await show([noDisplay], undefined)
    expect(titleLink(noDisplay.id)).toBeNull()
    expect(card(noDisplay.id).querySelector('h3').textContent).toBe(
      noDisplay.title
    )
  })

  test('T-402 c2 @P0 reader link https://core.ac.uk/reader/1 becomes https://api.core.ac.uk/reader-ui/1, with the search tail', async () => {
    const reader = withLinks(W_HOSTED, [
      link('reader', 'https://core.ac.uk/reader/1'),
      ...linksOf(W_HOSTED, 'display'),
    ])
    expect(reader.download).toBeUndefined()
    const view = await show([reader])
    expect(thumb(reader.id).getAttribute('href')).toBe(
      `https://api.core.ac.uk/reader-ui/1/?t=${SEARCH_ID}-${reader.id}&search=${NESTED}`
    )
    expect(caption(reader.id)).toBe('Get PDF')
    expect(variantOf(reader.id)).toBe('hosted')
    view.unmount()

    // without a searchId: no tail
    await show([reader], undefined)
    expect(thumb(reader.id).getAttribute('href')).toBe(
      'https://api.core.ac.uk/reader-ui/1'
    )
  })

  test('T-402 c2 @P0 reader link: the rewrite needs https://core.ac.uk and replaces the first /reader/ only', async () => {
    const cases = [
      // [recorded reader url, link of the card]
      [
        'https://core.ac.uk/reader/30671329',
        'https://api.core.ac.uk/reader-ui/30671329',
      ],
      [
        'https://core.ac.uk/reader/7/reader/8',
        'https://api.core.ac.uk/reader-ui/7/reader/8',
      ],
      // http: the host is not rewritten, "api.core" is missing: no link
      ['http://core.ac.uk/reader/5', null],
      // another host: not rewritten, no link
      ['https://reader.example.org/reader/9', null],
    ]
    for (const [url, expected] of cases) {
      const work = withLinks(W_HOSTED, [
        link('reader', url),
        ...linksOf(W_HOSTED, 'display'),
      ])
      // eslint-disable-next-line no-await-in-loop
      const { unmount } = await show([work], undefined)
      if (expected === null) {
        expect(thumb(work.id).hasAttribute('href')).toBe(false)
        expect(caption(work.id)).toBe('No full text')
      } else expect(thumb(work.id).getAttribute('href')).toBe(expected)

      unmount()
    }
  })

  test('T-402 c3 @P0 full-text link order (06 §2.2): download link, else the reader-ui link, else none', async () => {
    const download = linksOf(W_HOSTED, 'download')
    const reader = linksOf(W_HOSTED, 'reader')
    const display = linksOf(W_HOSTED, 'display')
    expect(download).toHaveLength(1)
    expect(reader).toHaveLength(1)
    const readerUi = reader[0].url
      .replace('https://core.ac.uk', 'https://api.core.ac.uk')
      .replace('/reader/', '/reader-ui/')
    const external = 'https://repository.example.org/files/1.pdf'

    const cases = [
      // [name, links, href, caption, variant]
      [
        'download + reader',
        [...download, ...reader, ...display],
        download[0].url,
        'Get PDF',
        'hosted',
      ],
      [
        'download only',
        [...download, ...display],
        download[0].url,
        'Get PDF',
        'hosted',
      ],
      [
        'reader only',
        [...reader, ...display],
        `${readerUi}/?t=${SEARCH_ID}-${W_HOSTED.id}&search=${NESTED}`,
        'Get PDF',
        'hosted',
      ],
      ['display only', display, null, 'No full text', 'missing'],
      [
        'external download',
        [link('download', external), ...display],
        external,
        'Full text link',
        'linked',
      ],
      [
        'external download + reader',
        [link('download', external), ...reader, ...display],
        external,
        'Full text link',
        'linked',
      ],
    ]
    for (const [name, links, href, text, variant] of cases) {
      const work = withLinks(W_HOSTED, links)
      // eslint-disable-next-line no-await-in-loop
      const { unmount } = await show([work])
      const a = thumb(work.id)
      expect([name, a.getAttribute('href')]).toEqual([name, href])
      expect([name, caption(work.id)]).toEqual([name, text])
      expect([name, variantOf(work.id)]).toEqual([name, variant])
      unmount()
    }
  })

  test('T-402 c3 @P0 full-text link order: the thumbnail comes from the thumbnail_m link or the core.ac.uk image of the id', async () => {
    const withThumb = withLinks(W_HOSTED, [
      ...linksOf(W_HOSTED, 'download', 'display'),
      link('thumbnail_m', 'https://core.ac.uk/image/1/medium'),
    ])
    const without = withLinks(W_HOSTED, linksOf(W_HOSTED, 'download'))
    const view = await show([withThumb])
    expect(thumb(withThumb.id).querySelector('img').getAttribute('src')).toBe(
      'https://core.ac.uk/image/1/medium'
    )
    view.unmount()
    await show([without])
    expect(thumb(without.id).querySelector('img').getAttribute('src')).toBe(
      `//core.ac.uk/image/${without.id}/medium`
    )
  })

  test('T-402 c4 @P0 logo rule (Q-023): only a member row with a number repo_id and billing_type supporting or sustaining gives the logo group', async () => {
    const [first] = W_THREE.dataProviders
    const cases = [
      // [name, member rows, logo group, recommended]
      ['no member', [], false, false],
      [
        'supporting',
        [row({ billing_type: 'supporting', repo_id: first.id })],
        true,
        false,
      ],
      [
        'sustaining',
        [row({ billing_type: 'sustaining', repo_id: first.id })],
        true,
        true,
      ],
      [
        'starting',
        [row({ billing_type: 'starting', repo_id: first.id })],
        false,
        false,
      ],
      // a number array is compared with a string: it never matches
      [
        'supporting, repo_id [id]',
        [row({ billing_type: 'supporting', repo_id: [first.id] })],
        false,
        false,
      ],
      // only the first provider of the work is looked up
      [
        'member is the second provider',
        [
          row({
            billing_type: 'supporting',
            repo_id: W_THREE.dataProviders[1].id,
          }),
        ],
        false,
        false,
      ],
      // the row key is billing_type
      [
        'billingType key',
        [row({ billingType: 'supporting', repo_id: first.id })],
        false,
        false,
      ],
    ]
    for (const [name, rows, group, recommended] of cases) {
      members.splice(0, members.length, ...rows)
      // eslint-disable-next-line no-await-in-loop
      const { unmount } = await show([W_THREE])
      const header = card(W_THREE.id).querySelector('header')
      expect([name, header.children.length === 2]).toEqual([name, group])
      expect([
        name,
        card(W_THREE.id).textContent.includes('Recommended from our members'),
      ]).toEqual([name, recommended])
      // the repository links below do not depend on the rule
      expect(
        [...card(W_THREE.id).querySelectorAll('[itemprop="publisher"] a')].map(
          (a) => a.textContent
        )
      ).toEqual(W_THREE.dataProviders.map((p) => p.name))
      unmount()
    }
  })

  test('T-402 c4 @P0 logo rule: the lookup is by the first provider id, a work without providers gets neither logos nor a crash', async () => {
    members.splice(
      0,
      members.length,
      row({ billing_type: 'supporting', repo_id: 197 })
    )
    // the property is absent, as in a recorded answer without providers
    const none = { ...W_BARE, id: W_BARE.id + 1, dataProviders: undefined }
    const view = await show([W_BARE, none])
    expect(card(W_BARE.id).querySelector('header').children).toHaveLength(2)
    const second = card(none.id)
    expect(second.querySelector('header').children).toHaveLength(1)
    expect(second.querySelectorAll('[itemprop="publisher"]')).toHaveLength(0)
    view.unmount()
  })

  test('T-402 c5 @P0 E22: one GET api.core.ac.uk/data-providers/<id>/logo per provider of every logo card, without credentials', async () => {
    members.splice(
      0,
      members.length,
      // card 2: a logo card with one provider, the recorded logo answers 200
      row({ billing_type: 'supporting', repo_id: 2313 }),
      // card 5: a logo card whose three providers all get a request
      row({ billing_type: 'sustaining', repo_id: 708 }),
      // not logo cards
      row({ billing_type: 'starting', repo_id: 198 }),
      row({ billing_type: 'supporting', repo_id: [713] })
    )
    await show(WORKS)
    const urls = started.map((r) => r.url)
    expect(urls).toEqual([
      'https://api.core.ac.uk/data-providers/2313/logo',
      'https://api.core.ac.uk/data-providers/708/logo',
      'https://api.core.ac.uk/data-providers/679/logo',
      'https://api.core.ac.uk/data-providers/14567/logo',
    ])
    for (const request of started) {
      expect(request.method).toBe('GET')
      // fetch(url) with no options: no credentials mode "include"
      expect(request.credentials).toBe('same-origin')
      expect(request.headers.get('authorization')).toBeNull()
      expect(request.headers.get('cookie')).toBeNull()
    }
    // a logo is shown for every request the fixtures answer with 200 (the
    // recorded provider logo; the other requests get an error status and show
    // nothing), in the header of the card that asked
    const ok = (url) => resolver.resolve('GET', url).status === 200
    const shown = (id) =>
      [...card(id).querySelectorAll('header img')].map((img) => [
        img.getAttribute('src'),
        img.getAttribute('alt'),
      ])
    expect(ok(urls[0])).toBe(true)
    expect(shown(62704171)).toEqual([
      [urls[0], byId(62704171).dataProviders[0].name],
    ])
    expect(shown(17489114)).toEqual(
      W_THREE.dataProviders
        .map((p, i) => [urls[i + 1], p.name])
        .filter(([url]) => ok(url))
    )
    expect(document.querySelectorAll('header img')).toHaveLength(
      urls.filter(ok).length
    )
    // the sustaining member's card carries the banner
    expect(card(17489114).textContent).toContain('Recommended from our members')
  })

  test('T-402 c5 @P0 E22: no dedupe, two cards with the same provider send the same GET twice, a re-render sends none', async () => {
    members.splice(
      0,
      members.length,
      row({ billing_type: 'supporting', repo_id: 2313 })
    )
    const a = byId(62704171)
    const b = { ...a, id: a.id + 1 }
    const view = await show([a, b])
    expect(started.map((r) => r.url)).toEqual([
      'https://api.core.ac.uk/data-providers/2313/logo',
      'https://api.core.ac.uk/data-providers/2313/logo',
    ])
    expect(document.querySelectorAll('header img')).toHaveLength(2)

    view.rerender(<Results works={[a, b]} searchId={SEARCH_ID} />)
    await settle()
    expect(started).toHaveLength(2)
  })

  test('T-402 c5 @P0 E22: members that are not logo cards cause no request at all', async () => {
    members.splice(
      0,
      members.length,
      row({ billing_type: 'starting', repo_id: 2313 })
    )
    await show(WORKS)
    expect(started).toEqual([])
  })

  test('T-402 c6 @P0 UTC date: publishedDate is formatted as DD/MM/YYYY of the UTC day', async () => {
    expect(Intl.DateTimeFormat().resolvedOptions().timeZone).toBe('UTC')
    const cases = [
      // [publishedDate, yearPublished, text]
      ['2001-01-01T00:00:00+00:00', 2001, '01/01/2001'],
      ['2008-01-01T00:00:00+00:00', 2008, '01/01/2008'],
      // an offset moves the instant to another UTC day
      ['2020-12-31T23:30:00-05:00', 2020, '01/01/2021'],
      ['2020-01-01T00:30:00+02:00', 2020, '31/12/2019'],
      ['2015-06-30T23:59:59Z', 2015, '30/06/2015'],
      // date-only is UTC midnight
      ['2015-06-30', 2015, '30/06/2015'],
      // no date: the year, as a string
      ['', 2015, '2015'],
      [null, 1999, '1999'],
      // nothing at all: an empty item
      ['', null, ''],
    ]
    for (const [publishedDate, yearPublished, text] of cases) {
      const work = { ...W_HOSTED, publishedDate, yearPublished }
      // eslint-disable-next-line no-await-in-loop
      const { unmount } = await show([work])
      expect([
        publishedDate,
        yearPublished,
        dateOf(work.id).textContent,
      ]).toEqual([publishedDate, yearPublished, text])
      unmount()
    }
  })

  test('T-402 c6 @P0 UTC date: the recorded dates of the page', async () => {
    await show(WORKS)
    const expected = (work) => {
      if (work.publishedDate) {
        const d = new Date(work.publishedDate)
        const pad = (n) => String(n).padStart(2, '0')
        return `${pad(d.getUTCDate())}/${pad(
          d.getUTCMonth() + 1
        )}/${d.getUTCFullYear()}`
      }
      return work.yearPublished != null ? String(work.yearPublished) : ''
    }
    expect(WORKS.some((w) => w.publishedDate)).toBe(true)
    expect(WORKS.some((w) => !w.publishedDate && w.yearPublished != null)).toBe(
      true
    )
    expect(WORKS.some((w) => !w.publishedDate && w.yearPublished == null)).toBe(
      true
    )
    for (const work of WORKS) {
      expect([work.id, dateOf(work.id).textContent]).toEqual([
        work.id,
        expected(work),
      ])
    }
    expect(W_TWO.publishedDate).toBe('2001-01-01T00:00:00+00:00')
    expect(dateOf(W_TWO.id).textContent).toBe('01/01/2001')
  })
})
