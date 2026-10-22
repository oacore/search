// T-715 (41 H, J13, Q-079, Q-044, Q-043, Q-049; R-013, R-039, R-047): the provider page /data-providers/<id>/.
// Pins today's behaviour exactly, quirks included, on provider 8 (Birkbeck, 30,950 outputs, a multi-repository
// member, starting billing) unless a step names another provider:
//   - the loaded page: name, sub header, membership label, count, ten results, pager, meta box counts, map card;
//   - the search box (Q-079): the first change of the box (blur or Enter) is swallowed by the `isInitialised`
//     guard; the next one pushes `?q=thesis&offset=0`;
//   - the pager (Q-044): Next, Previous (points at the current offset, so it re-pushes the same page), First,
//     Last (offset = total, past the end: the API answers 400, the page shows the error text and the pager says
//     "of a lot of"; its Next and Last point at NaN and are disabled); the disabled arrows carry
//     `aria-disabled` and `pointer-events:none` (Q-083);
//   - the sort (Q-043): "recent" and "relevance" both push `sort=relevance` and `page=1`, keep the offset and
//     delete the route `id`; the box keeps the label of the option that was clicked until the data is back;
//   - Q-049: the sort box of a provider without outputs and without accounts (no re-render after the first
//     one) shows an empty label and opens an empty menu; the box of provider 8 has both options;
//   - the map card (J13 "one marker"): the card map starts at the fixed view (centre 26.5, -43.1, zoom 2) of the
//     small card, so a marker shows only for a provider inside it (4835 at 0/0), not for the UK providers.
// The browser/server request counts of these actions are T-735 c2.
// Fixtures: provider-8 (+ req-P1-05 for thesis, offset 10, the last offset and the relevance sort), provider-4835,
// provider-3354 (E18 [] derived from the recorded 404), members, logos.
import { test, expect } from '../lib/P1-05/fixtures.mjs'
import {
  ACTION_TIMEOUT,
  NAV_TIMEOUT,
  TEST_TIMEOUT,
  settle,
} from '../lib/P1-05/page.mjs'
import {
  arrow,
  entries,
  mapState,
  openProvider,
  providerView,
  searchBox,
  sortMenu,
  sortToggle,
  urlIs,
} from '../lib/P1-05/provider.mjs'
import { popupLog, recordPopups } from '../lib/P1-05/leaflet.mjs'
import { resultsOf } from '../lib/P1-05/results.mjs'

test.use({
  cookieState: 'essential',
  navigationTimeout: NAV_TIMEOUT,
  actionTimeout: ACTION_TIMEOUT,
})

const API = 'https://api.core.ac.uk/v3/data-providers/8/outputs'
const E13 = (q, offset, sort) =>
  `${API}?q=${q}&offset=${offset}&limit=10&sort=${sort}`
const TITLE = 'CORE – Aggregating the world’s open access research papers'
const BASE = {
  title: TITLE,
  name: 'Birkbeck, University of London',
  member: 'starting member',
  input: '',
  notice: [],
  counts: ['11,194', '30,950'],
}
const FOUND = ['30950 research outputs found']
// the arrows of the pager at an offset: [label, href, aria-disabled, pointer-events]
// (the arrows keep the search term of the URL: the offset is set on the current URL)
const pagerAt = (offset, q = '') => [
  [
    'First',
    `/data-providers/8/?${q}offset=0`,
    String(offset === 0),
    offset === 0 ? 'none' : 'auto',
  ],
  [
    'Previous',
    `/data-providers/8/?${q}offset=${offset}`,
    String(offset === 0),
    offset === 0 ? 'none' : 'auto',
  ],
  ['Next', `/data-providers/8/?${q}offset=${offset + 10}`, 'false', 'auto'],
  ['Last', `/data-providers/8/?${q}offset=30950`, 'false', 'auto'],
]

test.describe('T-715 @P1 J13 provider page', () => {
  test.describe.configure({ timeout: TEST_TIMEOUT })

  test('T-715 @P1 provider 8 loaded: name, label, count, ten results, pager, meta box, map card', async ({
    page,
    p2Env,
    resolver,
  }) => {
    const { tracker } = await openProvider(page, p2Env, '/data-providers/8/')
    expect(await providerView(page)).toEqual({
      ...BASE,
      url: '/data-providers/8/',
      found: FOUND,
      sort: ['Sort by recent'],
      stats: ['Showing 1-10 of 30,950'],
      results: resultsOf(resolver, E13('', 0, 'recency')),
      pager: pagerAt(0),
    })
    // the sub header (the repository's own name), the search placeholder, the map card caption
    await expect(
      page.getByText('Birkbeck Institutional Research Online').first()
    ).toBeVisible()
    await expect(searchBox(page)).toHaveAttribute(
      'placeholder',
      'Search over 30950 research outputs in Birkbeck Institutional Research Online'
    )
    await expect(
      page.getByRole('img', { name: 'Birkbeck Institutional Research Online' })
    ).toBeVisible()
    await expect(page.locator('figcaption')).toHaveText(
      'Birkbeck Institutional Research Online is based in United Kingdom'
    )
    await expect(page.getByText('full texts')).toBeVisible()
    await expect(page.getByText('metadata records')).toBeVisible()
    await expect(page.getByText('Updated in last 30 days.')).toBeVisible()
    await expect(page.getByText('Data sources:')).toBeVisible()
    // the map card draws its tiles; the UK is outside its fixed first view: no marker
    await expect.poll(() => mapState(page).then((m) => m.tiles > 0)).toBe(true)
    expect(await mapState(page)).toMatchObject({
      size: [384, 176],
      markers: 0,
      clusters: 0,
    })
    await settle(page, tracker)
  })

  test('T-715 @P1 provider 4835 loaded: the map card shows its one marker; its popup names the provider and goes with the pan that opens it', async ({
    page,
    p2Env,
  }) => {
    const { tracker } = await openProvider(page, p2Env, '/data-providers/4835/')
    await expect(page.locator('#map .leaflet-marker-icon')).toHaveCount(1)
    await settle(page, tracker)
    expect(await mapState(page)).toMatchObject({ markers: 1, clusters: 0 })
    await recordPopups(page)
    await page.locator('#map .leaflet-marker-icon').click()
    // the popup holds the name (the card map has no link); the pan that fits it rebuilds the markers, which
    // removes the popup again
    await expect
      .poll(() => popupLog(page), { timeout: NAV_TIMEOUT })
      .toEqual([['added', 'Aberystwyth Research Portal'], ['removed']])
    await expect(page.locator('#map .leaflet-popup')).toHaveCount(0)
    await expect(page.locator('#map .leaflet-marker-icon')).toHaveCount(1)
  })

  test('T-715 @P1 search (Q-079): the first change is swallowed, the second one pushes q=thesis&offset=0', async ({
    page,
    p2Env,
    resolver,
  }) => {
    const { tracker } = await openProvider(page, p2Env, '/data-providers/8/')
    const before = await providerView(page)
    const histFrom = (await entries(page, p2Env, 0)).length
    const box = searchBox(page)
    // J13: type "thesis" and blur. The change is swallowed: no push, the page is as before, the box keeps the text
    await box.fill('thesis')
    await box.blur()
    await settle(page, tracker)
    expect(await providerView(page)).toEqual({ ...before, input: 'thesis' })
    expect(await entries(page, p2Env, histFrom)).toEqual([])
    // the next blur (even without a new change) is the first one that counts
    await box.focus()
    await box.blur()
    await urlIs(page, p2Env, '/data-providers/8/?q=thesis&offset=0')
    await settle(page, tracker)
    expect(await providerView(page)).toEqual({
      ...before,
      url: '/data-providers/8/?q=thesis&offset=0',
      input: 'thesis',
      results: resultsOf(resolver, E13('thesis', 0, 'recency')),
      pager: pagerAt(0, 'q=thesis&'),
    })
    expect(await entries(page, p2Env, histFrom)).toEqual([
      ['pushState', '/data-providers/8/?q=thesis&offset=0'],
    ])
    // Back restores the loaded page (the box is the page's own state: it keeps the text)
    await page.goBack()
    await urlIs(page, p2Env, '/data-providers/8/')
    await settle(page, tracker)
    expect(await providerView(page)).toMatchObject({
      url: '/data-providers/8/',
      results: before.results,
    })
  })

  test('T-715 @P1 pager (Q-044, Q-083): Next, Previous re-pushes the current offset, Last is past the end, First', async ({
    page,
    p2Env,
    resolver,
    guardLog,
  }) => {
    const { tracker } = await openProvider(page, p2Env, '/data-providers/8/')
    const histFrom = (await entries(page, p2Env, 0)).length
    const at = async (offset) => {
      await urlIs(page, p2Env, `/data-providers/8/?offset=${offset}`)
      await settle(page, tracker)
      return providerView(page)
    }

    await arrow(page, 'Next').click()
    expect(await at(10)).toEqual({
      ...BASE,
      url: '/data-providers/8/?offset=10',
      found: FOUND,
      sort: ['Sort by recent'],
      stats: ['Showing 11-20 of 30,950'],
      results: resultsOf(resolver, E13('', 10, 'recency')),
      pager: [
        ['First', '/data-providers/8/?offset=0', 'false', 'auto'],
        ['Previous', '/data-providers/8/?offset=10', 'false', 'auto'],
        ['Next', '/data-providers/8/?offset=20', 'false', 'auto'],
        ['Last', '/data-providers/8/?offset=30950', 'false', 'auto'],
      ],
    })
    // Q-044: Previous points at the current offset; it stays on the page (a push of the same URL is a replace)
    const here = await providerView(page)
    await arrow(page, 'Previous').click()
    await settle(page, tracker)
    expect(await providerView(page)).toEqual(here)

    // Last: offset = total (a multiple of the page size), past the end; the API answers 400
    await arrow(page, 'Last').click()
    expect(await at(30950)).toEqual({
      ...BASE,
      url: '/data-providers/8/?offset=30950',
      found: ['research outputs found'],
      sort: ['Sort by recent'],
      stats: ['Showing 30,951-30,960 of a lot of'],
      notice: [
        'An error occured. Try to reload the page in a bit or contact us.',
      ],
      results: [],
      pager: [
        ['First', '/data-providers/8/?offset=0', 'false', 'auto'],
        ['Previous', '/data-providers/8/?offset=30950', 'false', 'auto'],
        ['Next', '/data-providers/8/?offset=NaN', 'true', 'none'],
        ['Last', '/data-providers/8/?offset=NaN', 'true', 'none'],
      ],
      counts: BASE.counts,
    })

    // First goes back to the start
    await arrow(page, 'First').click()
    expect(await at(0)).toMatchObject({
      url: '/data-providers/8/?offset=0',
      stats: ['Showing 1-10 of 30,950'],
      results: resultsOf(resolver, E13('', 0, 'recency')),
      pager: pagerAt(0),
    })
    // the disabled arrows at the start are unreachable by pointer (Q-083): a forced click changes nothing
    await arrow(page, 'Previous').click({ force: true })
    await settle(page, tracker)
    expect(await providerView(page)).toMatchObject({
      url: '/data-providers/8/?offset=0',
    })

    // history: Next and Last and First push, Previous replaces
    expect(await entries(page, p2Env, histFrom)).toEqual([
      ['pushState', '/data-providers/8/?offset=10'],
      ['replaceState', '/data-providers/8/?offset=10'],
      ['pushState', '/data-providers/8/?offset=30950'],
      ['pushState', '/data-providers/8/?offset=0'],
    ])
    expect(guardLog.consoleErrors).toEqual([])
  })

  test('T-715 @P1 sort (Q-043): "recent" and "relevance" both push sort=relevance, the offset stays', async ({
    page,
    p2Env,
    resolver,
  }) => {
    const { tracker } = await openProvider(page, p2Env, '/data-providers/8/')
    const histFrom = (await entries(page, p2Env, 0)).length
    await arrow(page, 'Next').click()
    await urlIs(page, p2Env, '/data-providers/8/?offset=10')
    await settle(page, tracker)

    // the box opens with both options; "recent" is the label, neither option is checked (the page was loaded
    // with the default sort)
    await sortToggle(page).click()
    expect(await sortMenu(page)).toEqual({
      open: true,
      options: [
        ['recent', false, 'auto'],
        ['relevance', false, 'auto'],
      ],
    })
    // choosing "recent" pushes sort=relevance (page=1 is added, the offset stays), and the relevance results show
    await page
      .locator('ul li p')
      .filter({ hasText: /^recent$/ })
      .click()
    await urlIs(
      page,
      p2Env,
      '/data-providers/8/?offset=10&sort=relevance&page=1'
    )
    await settle(page, tracker)
    const afterRecent = await providerView(page)
    expect(afterRecent.results).toEqual(
      resultsOf(resolver, E13('', 10, 'relevance'))
    )
    expect(afterRecent.stats).toEqual(['Showing 11-20 of 30,950'])
    // the label still reads "recent", the option that was clicked
    expect(afterRecent.sort).toEqual(['Sort by recent'])

    // choosing "relevance" pushes the same URL (a replace) and the label follows
    await sortToggle(page).click()
    await page
      .locator('ul li p')
      .filter({ hasText: /^relevance$/ })
      .click()
    await settle(page, tracker)
    expect(await providerView(page)).toMatchObject({
      url: '/data-providers/8/?offset=10&sort=relevance&page=1',
      sort: ['Sort by relevance'],
      results: resultsOf(resolver, E13('', 10, 'relevance')),
    })
    // the active option is checked and unreachable by pointer (Q-083)
    await sortToggle(page).click()
    expect(await sortMenu(page)).toEqual({
      open: true,
      options: [
        ['recent', false, 'auto'],
        ['relevance', true, 'none'],
      ],
    })
    expect(await entries(page, p2Env, histFrom)).toEqual([
      ['pushState', '/data-providers/8/?offset=10'],
      ['pushState', '/data-providers/8/?offset=10&sort=relevance&page=1'],
      ['replaceState', '/data-providers/8/?offset=10&sort=relevance&page=1'],
    ])
  })

  test('T-715 @P1 sort from the first page: relevance results, offset 0 (Q-043)', async ({
    page,
    p2Env,
    resolver,
  }) => {
    const { tracker } = await openProvider(page, p2Env, '/data-providers/8/')
    await sortToggle(page).click()
    await page
      .locator('ul li p')
      .filter({ hasText: /^relevance$/ })
      .click()
    await urlIs(page, p2Env, '/data-providers/8/?sort=relevance&page=1')
    await settle(page, tracker)
    expect(await providerView(page)).toMatchObject({
      url: '/data-providers/8/?sort=relevance&page=1',
      sort: ['Sort by relevance'],
      stats: ['Showing 1-10 of 30,950'],
      results: resultsOf(resolver, E13('', 0, 'relevance')),
    })
  })

  test('T-715 @P1 Q-049: the sort box of a provider without outputs and accounts is empty', async ({
    page,
    p2Env,
  }) => {
    const { tracker } = await openProvider(page, p2Env, '/data-providers/3354/')
    await settle(page, tracker)
    // the template is not an observer: the sort options set after the first render never reach the box
    expect(await providerView(page)).toMatchObject({
      found: ['0 research outputs found'],
      sort: ['Sort by'],
      notice: ['This data provider has not articles yet.'],
      stats: ['Showing 1-10 of 0'],
      member: 'Not a member yet',
    })
    await sortToggle(page).click()
    expect(await sortMenu(page)).toEqual({ open: true, options: [] })
  })
})
