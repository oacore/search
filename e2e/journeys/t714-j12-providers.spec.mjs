// T-714 (41 H; J12 providers directory, J27 add-provider form states, J32 map; Q-080, Q-084; R-013, R-047,
// R-052). The directory /data-providers/ is rendered from the formap snapshot (15,672 providers) and a client
// MobX store mirrored to the URL. Pins today's behaviour exactly, quirks included:
//   J12  the loaded page (first sync rewrites the URL to `?q=&size=10` with replaceState; ItemList of ten; the
//        description counts the snapshot); the header search lists ten suggestions, a selection filters the list and
//        the URL follows after the 250 ms debounce while the title stays "Data providers search" and the box keeps
//        the selected text (Q-080); a hard load with `?q=` filters but leaves the box empty (Q-080); "Load more"
//        grows `size` by 10 and keeps the scroll position (R-052); blur of the header search submits only below
//        500 px (Q-084);
//   J32  the map: eight icons at zoom 2 (seven clusters and a marker), the zoom controls, a cluster click, a
//        marker click opens a popup whose link has target=_blank (the popup of a click that pans the map is gone
//        as soon as the markers are rebuilt);
//   J27  the add-provider form of a query without results: empty, invalid URL (no request), in progress, created,
//        Finish, already registered (409), not detected (500), Cancel.
// The touch subset (375x812, hasTouch, isMobile, tap) repeats Load more, the zoom control, a cluster, the
// header search and the blur submit with taps.
// Fixtures: the formap snapshot (SSR), e16-claim-form (created / duplicate / broken .example.org), tiles.
import { test, expect } from '../lib/P1-05/fixtures.mjs'
import {
  ACTION_TIMEOUT,
  NAV_TIMEOUT,
  TEST_TIMEOUT,
  appQuiet,
  firstLine,
  historySince,
  pageConsole,
  settle,
} from '../lib/P1-05/page.mjs'
import { popupLog, recordPopups } from '../lib/P1-05/leaflet.mjs'
import {
  directoryView,
  finishButton,
  formView,
  headerBox,
  loadMore,
  mapSettled,
  mapView,
  openDirectory,
  suggestions,
  urlField,
  urlIs,
} from '../lib/P1-05/directory.mjs'

test.use({
  cookieState: 'essential',
  navigationTimeout: NAV_TIMEOUT,
  actionTimeout: ACTION_TIMEOUT,
})

// The page is 7 MB of server-rendered HTML that hydrates 15,672 rows, and the app is one Node process: a render
// keeps its event loop busy for seconds. Parallel renders end as gateway timeouts on a loaded machine, and a
// render that runs while another test navigates on the client turns that navigation into a document load (the
// Next 10 route loader gives a route change 3.8 s, 40 §5: timeouts, never retries). The tests of this file
// therefore carry @wire: they run in the serial wire project, one after the other and after every other test.
test.describe.configure({ mode: 'default', timeout: TEST_TIMEOUT })

const TITLE = 'Data providers search'
const D = '/data-providers/'
const WEB = 'webpage: '
// the first ten providers of the snapshot, in snapshot order: [name, href, webpage]
const FIRST_TEN = [
  [
    'Akademik Platform Helal Yaşam Dergisi',
    '22159',
    'https://dergipark.org.tr/api/public/oai/apjhls/',
  ],
  [
    'Kultury Wschodniosłowiańskie - Oblicza i Dialog',
    '2474',
    'http://pressto.amu.edu.pl',
  ],
  ['Poznańskie Spotkania Językoznawcze', '2477', 'http://pressto.amu.edu.pl'],
  [
    'Poznańskie Studia Polonistyczne. Seria Językoznawcza',
    '2478',
    'http://pressto.amu.edu.pl',
  ],
  [
    'Poznańskie Studia Polonistyczne. Seria Literacka',
    '2479',
    'http://pressto.amu.edu.pl',
  ],
  ['Poznańskie Studia Slawistyczne', '2480', 'http://pressto.amu.edu.pl'],
  ['Poznańskie Studia Teologiczne', '2481', 'http://pressto.amu.edu.pl'],
  ['Przegląd Politologiczny', '2483', 'http://pressto.amu.edu.pl'],
  ['Przegląd Strategiczny', '2485', 'http://pressto.amu.edu.pl'],
  [
    'Refleksje. Pismo naukowe studentów i doktorantów WNPiD UAM',
    '2487',
    'http://pressto.amu.edu.pl',
  ],
]
const cardsOf = (rows) =>
  rows.map(([name, id, web]) => [name, `${D}${id}`, `${WEB}${web}`])
const NAMES = FIRST_TEN.map(([name]) => name)
const PARAGRAPHS = [
  'Cannot find your repository or journal in our list? Become a data provider now!',
  'We aggregate research papers from data providers all over the world including institutional and subject repositories and journal publishers. This process, which is also called harvesting, allows us to offer search, text mining and analytical capabilities over not only metadata, but also the full text of the research papers making CORE a unique service in the research community.',
  'Our dataset currently contains a lot of open access articles, from over tons of thousands journals, collected from over 15,672 repositories and journals around the world.',
  'CORE (COnnecting REpositories) is a not-for-profit service supported by CORE Members.',
  'Discover our research outputs and cite our work.',
]
// the map at zoom 2 on the default view, icons sorted by position: [kind, label, x, y]
const MAP_2 = [
  ['cluster', '648', 56, 60],
  ['cluster', '210', 76, 179],
  ['cluster', '3', 140, 41],
  ['cluster', '17', 173, 204],
  ['marker', '', 226, 50],
  ['cluster', '8', 267, 97],
  ['cluster', '8385', 295, 178],
  ['cluster', '1309', 318, 23],
]
// after one zoom-in step (zoom 3), and after a click on the "210" cluster (zoom 3, centred on it)
const MAP_3 = [
  ['cluster', '146', -2, -2],
  ['cluster', '2', 0, 151],
  ['cluster', '16', 11, 198],
  ['marker', '', 89, 35],
  ['marker', '', 275, 13],
  ['cluster', '4', 309, 172],
  ['cluster', '5', 327, 84],
  ['marker', '', 368, 6],
]
const MAP_CLUSTER_210 = [
  ['cluster', '22', 37, -2],
  ['cluster', '28', 120, 39],
  ['cluster', '67', 172, 182],
  ['cluster', '117', 174, 97],
  ['marker', '', 250, 204],
  ['marker', '', 259, 7],
  ['cluster', '17', 329, 201],
  ['cluster', '3', 332, 121],
]
// the map at 375x812 (container 343x343): default view, one zoom step in, and after a tap on the "215" cluster
const TOUCH_MAP_2 = [
  ['cluster', '631', 37, 112],
  ['cluster', '215', 56, 232],
  ['cluster', '3', 119, 93],
  ['cluster', '69', 141, 287],
  ['marker', '', 205, 102],
  ['marker', '', 216, -22],
  ['cluster', '8', 246, 149],
  ['cluster', '8384', 274, 230],
  ['cluster', '1169', 290, 71],
  ['marker', '', 327, 284],
]
const TOUCH_MAP_3 = [
  ['cluster', '79', -8, 36],
  ['marker', '', 1, 296],
  ['cluster', '11', 3, 245],
  ['marker', '', 69, 86],
  ['cluster', '2', 97, 0],
  ['cluster', '3', 124, 316],
  ['marker', '', 255, 64],
  ['cluster', '4', 289, 223],
  ['cluster', '5', 307, 135],
]
const TOUCH_MAP_CLUSTER_215 = [
  ['cluster', '8', -8, -17],
  ['cluster', '58', 58, 43],
  ['cluster', '67', 102, 227],
  ['cluster', '117', 104, 142],
  ['cluster', '3', 177, 291],
  ['marker', '', 189, 52],
  ['cluster', '3', 262, 166],
  ['cluster', '53', 267, 278],
  ['cluster', '3', 314, 226],
]
const icons = (m) => m.icons.map((i) => [i.kind, i.text, i.x, i.y])

test.describe('T-714 @P1 J12 providers directory', () => {
  test.describe.configure({ timeout: TEST_TIMEOUT })

  test('T-714 @P1 @wire J12 loaded page: first sync rewrites the URL, ten cards, ItemList, description, add block, sidebar', async ({
    page,
    p2Env,
  }) => {
    const { tracker } = await openDirectory(page, p2Env)
    await settle(page, tracker)
    expect(await directoryView(page)).toEqual({
      url: `${D}?q=&size=10`,
      title: TITLE,
      description:
        'Search over 15672 repositories and journals around the world',
      ldNames: NAMES,
      stats: ['Showing 1-10 of 15,672'],
      cards: cardsOf(FIRST_TEN),
      headerInput: '',
      loadMore: true,
      paragraphs: PARAGRAPHS,
      form: false,
      scrollY: 0,
    })
    // the first sync of the load replaces twice: the route and then the synced query; no entry is added
    expect(
      (await historySince(page, p2Env)).map((h) => [h.method, h.url])
    ).toEqual([
      ['replaceState', D],
      ['replaceState', `${D}?q=&size=10`],
    ])
    await expect(headerBox(page)).toHaveAttribute(
      'placeholder',
      'e.g. repository or journal name'
    )
    await expect(
      page.getByRole('link', { name: 'Add data provider' })
    ).toHaveAttribute('href', 'https://core.ac.uk/benefits#join-core')
    await expect(
      page.getByRole('link', { name: 'Become a data provider' })
    ).toHaveAttribute('href', 'https://core.ac.uk/benefits#join-core')
  })

  test('T-714 @P1 @wire J12 header search: ten suggestions, a selection filters the list; the title stays and the box keeps the text (Q-080)', async ({
    page,
    p2Env,
  }) => {
    const { tracker } = await openDirectory(page, p2Env)
    const histFrom = (await historySince(page, p2Env)).length
    const box = headerBox(page)
    // focus lists the first ten providers
    await box.focus()
    await expect.poll(() => suggestions(page)).toEqual(NAMES)
    // typing narrows the ten suggestions; the URL does not change before a selection
    await box.pressSequentially('open univ', { delay: 20 })
    const open = [
      'AIOU Journals Allama Iqbal Open University',
      'Digital Library of Open University of Tanzania',
      'Ho Chi Minh City Open University Journal of Science',
      'Kypseli Digital Repository - Open University of Cyprus',
      'National Open University Institutional Repository',
      'OJS Libya Open University',
      'Open Research Online (Open University)',
      'Open University Malaysia Knowledge Repository',
      'Open University of the Netherlands Research Portal',
      'Repositório Aberto da Universidade Aberta',
    ]
    await expect.poll(() => suggestions(page)).toEqual(open)
    await settle(page, tracker)
    expect((await directoryView(page)).url).toBe(`${D}?q=&size=10`)
    // the second suggestion is chosen by the keyboard: the list is filtered to that provider
    await box.press('ArrowDown')
    await box.press('ArrowDown')
    await box.press('Enter')
    await urlIs(
      page,
      p2Env,
      `${D}?q=Digital+Library+of+Open+University+of+Tanzania&size=10`
    )
    await settle(page, tracker)
    const view = await directoryView(page)
    expect(view).toMatchObject({
      stats: ['Showing 1-1 of 1'],
      // Q-080: the query is never part of the title, and the box shows what was selected
      title: TITLE,
      headerInput: 'Digital Library of Open University of Tanzania',
      loadMore: false,
    })
    expect(view.cards).toHaveLength(1)
    expect(view.cards[0][0]).toBe(
      'Digital Library of Open University of Tanzania'
    )
    expect(
      (await historySince(page, p2Env, histFrom)).map((h) => [h.method, h.url])
    ).toEqual([
      [
        'pushState',
        `${D}?q=Digital+Library+of+Open+University+of+Tanzania&size=10`,
      ],
    ])
  })

  test('T-714 @P1 @wire J12 hard load with ?q= filters the list but the header box stays empty (Q-080)', async ({
    page,
    p2Env,
  }) => {
    const { tracker } = await openDirectory(page, p2Env, `${D}?q=aberystwyth`)
    await settle(page, tracker)
    const view = await directoryView(page)
    expect(view).toMatchObject({
      url: `${D}?q=aberystwyth&size=10`,
      title: TITLE,
      headerInput: '',
      stats: ['Showing 1-1 of 1'],
      loadMore: false,
    })
    expect(view.cards.map(([name, href]) => [name, href])).toEqual([
      ['Aberystwyth Research Portal', `${D}4835`],
    ])
  })

  test('T-714 @P1 @wire J12 Load more: size grows by 10, the cards follow, the scroll position stays (R-052)', async ({
    page,
    p2Env,
  }) => {
    const { tracker } = await openDirectory(page, p2Env)
    const histFrom = (await historySince(page, p2Env)).length
    await loadMore(page).scrollIntoViewIfNeeded()
    await settle(page, tracker)
    for (const size of [20, 30]) {
      await appQuiet(p2Env)
      const before = (await directoryView(page)).scrollY
      expect(before).toBeGreaterThan(0)
      await loadMore(page).click()
      await urlIs(page, p2Env, `${D}?q=&size=${size}`)
      await settle(page, tracker)
      const view = await directoryView(page)
      expect(view.stats).toEqual([`Showing 1-${size} of 15,672`])
      expect(view.cards).toHaveLength(size)
      expect(view.cards.slice(0, 10)).toEqual(cardsOf(FIRST_TEN))
      // the list saves scrollY before the size changes and restores it in a layout effect: the page does not jump
      // to the top (R-052)
      expect(view.scrollY).toBe(before)
      expect(view.loadMore).toBe(true)
      await loadMore(page).scrollIntoViewIfNeeded()
    }
    expect(
      (await historySince(page, p2Env, histFrom)).map((h) => [h.method, h.url])
    ).toEqual([
      ['pushState', `${D}?q=&size=20`],
      ['pushState', `${D}?q=&size=30`],
    ])
  })

  // Q-084: the design search bar sets changeOnBlur for widths below 500 px; on /data-providers/ the page leaves
  // the option unset, so the width alone decides whether a blur submits the typed text
  for (const [width, submits] of [
    [1280, false],
    [501, false],
    [500, false],
    [499, true],
    [375, true],
  ])
    test(`T-714 @P1 @wire J12 blur of the header search at ${width} px ${
      submits ? 'submits the typed text' : 'submits nothing'
    } (Q-084)`, async ({ page, p2Env }) => {
      await page.setViewportSize({ width, height: 812 })
      const { tracker } = await openDirectory(page, p2Env)
      const histFrom = (await historySince(page, p2Env)).length
      const box = headerBox(page)
      await box.fill('aberystwyth')
      await box.blur()
      if (submits) {
        await urlIs(page, p2Env, `${D}?q=aberystwyth&size=10`)
        await settle(page, tracker)
        expect((await directoryView(page)).stats).toEqual(['Showing 1-1 of 1'])
        expect(
          (await historySince(page, p2Env, histFrom)).map((h) => [
            h.method,
            h.url,
          ])
        ).toEqual([['pushState', `${D}?q=aberystwyth&size=10`]])
      } else {
        await settle(page, tracker)
        expect((await directoryView(page)).url).toBe(`${D}?q=&size=10`)
        expect((await directoryView(page)).stats).toEqual([
          'Showing 1-10 of 15,672',
        ])
        expect(await historySince(page, p2Env, histFrom)).toEqual([])
      }
      await expect(box).toHaveValue('aberystwyth')
    })
})

test.describe('T-714 @P1 J32 map of the directory', () => {
  test.describe.configure({ timeout: TEST_TIMEOUT })

  test('T-714 @P1 @wire J32 map: eight icons at zoom 2, the zoom controls, a cluster click', async ({
    page,
    p2Env,
  }) => {
    const { tracker } = await openDirectory(page, p2Env)
    await settle(page, tracker)
    await mapSettled(page)
    let m = await mapView(page)
    expect(m.size).toEqual([384, 240])
    expect(m.zooms).toEqual(['2'])
    expect(icons(m)).toEqual(MAP_2)

    await page.locator('#map .leaflet-control-zoom-in').click()
    await mapSettled(page, '3')
    m = await mapView(page)
    expect(m.zooms).toEqual(['3'])
    expect(icons(m)).toEqual(MAP_3)
    await page.locator('#map .leaflet-control-zoom-out').click()
    await mapSettled(page, '2')
    m = await mapView(page)
    expect(m.zooms).toEqual(['2'])
    expect(icons(m)).toEqual(MAP_2)

    await page.locator('#map .marker-cluster', { hasText: /^210$/ }).click()
    await mapSettled(page, '3')
    m = await mapView(page)
    // a cluster click zooms to the cluster's bounds
    expect(m.zooms).toEqual(['3'])
    expect(icons(m)).toEqual(MAP_CLUSTER_210)
  })

  test('T-714 @P1 @wire J32 marker popup: a link to the provider with target=_blank; a click that pans the map loses the popup when the markers are rebuilt', async ({
    page,
    p2Env,
  }) => {
    const { tracker } = await openDirectory(page, p2Env, `${D}?q=aberystwyth`)
    await settle(page, tracker)
    await mapSettled(page)
    const marker = page.locator('#map img.leaflet-marker-icon')
    await expect(marker).toHaveCount(1)
    await expect(marker).toHaveAttribute('alt', 'Marker')
    // record the popup nodes the map adds and removes (the popup of this marker is removed again when the
    // pan that opens it rebuilds the markers: the map component keeps the visible markers in state)
    await recordPopups(page)
    await marker.click()
    await expect
      .poll(() => popupLog(page), { timeout: NAV_TIMEOUT })
      .toEqual([
        [
          'added',
          '<a href="/data-providers/4835" target="_blank">Aberystwyth Research Portal</a>',
        ],
        ['removed'],
      ])
    await mapSettled(page)
    await expect(page.locator('#map .leaflet-popup')).toHaveCount(0)
    await expect(page.locator('#map img.leaflet-marker-icon')).toHaveCount(1)
  })
})

// the form of 41 §2.2 / findings 07: the state the page shows for each step, as formView reads it
const HELP = 'It can be any resource, home page or an OAI-PMH endpoint'
const MAILTO = 'mailto:t%68%65t%65am%40core%2e%61c%2eu%6b'
const SUPPORT = ['theteam@core.ac.uk', MAILTO, null]
const API = 'https://api.core.ac.uk'
const ZERO = `${D}?action=ADD&q=zzzzqqq&size=10`
const FORM = (o) => ({
  url: ZERO,
  value: '',
  valid: false,
  validationMessage: 'Please fill out this field.',
  ariaInvalid: 'false',
  variant: ['normal'],
  icon: null,
  helper: HELP,
  helperLinks: [],
  finishDisabled: true,
  cancelDisabled: false,
  ...o,
})
const TOUCHED = ['normal', 'text-field-touched']
const FAILED = ['text-field-error', 'normal', 'text-field-touched']
const PICTURE = {
  valid: true,
  validationMessage: '',
  ariaInvalid: 'true',
  variant: FAILED,
  icon: 'alert-circle-outline',
}
const STATES = {
  // nothing typed: required, helper text, Finish disabled
  'empty': FORM({}),
  // not a URL: the field is invalid (native type=url), the page does not react
  'invalid': FORM({ value: 'abc', validationMessage: 'Please enter a URL.' }),
  // the request is out: no helper text, Finish disabled
  'in progress': FORM({
    value: 'https://created.example.org/',
    valid: true,
    validationMessage: '',
    variant: ['progress', 'normal'],
    helper: '',
  }),
  // created: success variant and icon, the helper names the provider (the administrator e-mail is blank in the
  // fixture), Finish enabled
  'created': FORM({
    value: 'https://created.example.org/',
    valid: true,
    validationMessage: '',
    variant: ['text-field-success', 'normal'],
    icon: 'check',
    helper:
      'We found Example Repository under the entered address and added it to our data provider collection. As soon as we approve adding, we will start harvesting and sent a confirmation email to . Join the community and add a harvested by CORE badge on your website.',
    helperLinks: [
      ['', 'mailto:', 'the administrator email address'],
      [
        'harvested by CORE',
        'https://core.ac.uk/faq#harvested-by-CORE-snippet',
        'Harvested by CORE Logo',
      ],
    ],
    finishDisabled: false,
  }),
  // Finish: the claim is reset, the field is empty and touched, the form stays
  'finished': FORM({ variant: TOUCHED }),
  // 409: error variant, the helper links the registered provider
  'registered': FORM({
    ...PICTURE,
    value: 'https://duplicate.example.org/',
    helper:
      'Open Research Online (Open) is our data provider already. If you host multiple repositories or journals on the same domain please specify exact OAI-PMH endpoint or contact us at theteam@core.ac.uk.',
    helperLinks: [
      [
        'Open Research Online (Open)',
        'https://core.ac.uk/search?q=repositories.id:(86)',
        null,
      ],
      SUPPORT,
    ],
  }),
  // 500: error variant, the helper asks for the exact OAI-PMH endpoint
  'not detected': FORM({
    ...PICTURE,
    value: 'https://broken.example.org/',
    helper:
      'We cannot detect a repository or a journal at this address. Please, provide the exact OAI-PMH endpoint. If you are having trouble contact us at theteam@core.ac.uk.',
    helperLinks: [SUPPORT],
  }),
  // Cancel: the form is gone
  'cancelled': null,
}

test.describe('T-714 @P1 J27 add-provider form states', () => {
  test.describe.configure({ timeout: TEST_TIMEOUT })

  test('T-714 @P1 @wire J27 form: empty, invalid URL (no request), in progress, created, Finish, already registered (409), not detected (500), Cancel', async ({
    page,
    p2Env,
    guardLog,
  }) => {
    // the 409 and the 500 answers are reported by Chromium as console errors: declared and asserted below
    test
      .info()
      .annotations.push({ type: 'guard-expect', description: 'console' })
    // E16 is made by the browser: each call waits at a gate until the test lets it continue to the fixtures
    const posts = []
    const gates = []
    await page.route(
      (u) => u.href === `${API}/internal/data-providers`,
      async (route) => {
        const req = route.request()
        posts.push([
          req.method(),
          req.postData(),
          req.headers()['content-type'],
        ])
        const gate = {}
        gate.open = new Promise((resolve) => {
          gate.release = resolve
        })
        gates.push(gate)
        await gate.open
        await route.fallback().catch(() => {})
      }
    )
    const { tracker } = await openDirectory(
      page,
      p2Env,
      `${D}?q=zzzzqqq&size=10`
    )
    await settle(page, tracker)
    const states = {}
    const snap = async (name) => {
      states[name] = await formView(page)
    }

    // no provider matches: the mistake text and the form (the effect of the page writes action=ADD)
    await expect(
      page.getByRole('heading', { name: /^Is there a mistake\?/ })
    ).toBeVisible()
    await expect(
      page.getByText('We could not find any data provider matching your query.')
    ).toBeVisible()
    await expect(page.getByText(/^Showing /)).toHaveCount(0)
    await snap('empty')

    // not a URL: the native check fails, no request, nothing else changes
    await urlField(page).fill('abc')
    await settle(page, tracker)
    await snap('invalid')
    expect(posts).toEqual([])

    // a URL: the request goes out after 500 ms; while it is held the helper text is gone
    await urlField(page).fill('https://created.example.org/')
    await expect.poll(() => posts.length, { timeout: NAV_TIMEOUT }).toBe(1)
    await expect
      .poll(async () => (await formView(page)).variant)
      .toEqual(['progress', 'normal'])
    await snap('in progress')
    gates[0].release()
    await expect(finishButton(page)).toBeEnabled({ timeout: NAV_TIMEOUT })
    await settle(page, tracker)
    await snap('created')

    // Finish resets the claim: the field is empty again, the form stays
    await finishButton(page).click()
    await expect(urlField(page)).toHaveValue('')
    await settle(page, tracker)
    await snap('finished')

    // a registered address: 409 with the existing provider in the message
    await urlField(page).fill('https://duplicate.example.org/')
    await expect.poll(() => posts.length, { timeout: NAV_TIMEOUT }).toBe(2)
    gates[1].release()
    await expect(page.getByText('is our data provider already.')).toBeVisible({
      timeout: NAV_TIMEOUT,
    })
    await settle(page, tracker)
    await snap('registered')

    // an address that is not a data provider: 500
    await urlField(page).fill('https://broken.example.org/')
    await expect.poll(() => posts.length, { timeout: NAV_TIMEOUT }).toBe(3)
    gates[2].release()
    await expect(
      page.getByText(
        'We cannot detect a repository or a journal at this address.'
      )
    ).toBeVisible({ timeout: NAV_TIMEOUT })
    await settle(page, tracker)
    await snap('not detected')

    // Cancel closes the form: action leaves the URL, the add block is back
    await page.getByRole('button', { name: 'Cancel' }).click()
    await urlIs(page, p2Env, `${D}?q=zzzzqqq&size=10`)
    await settle(page, tracker)
    await snap('cancelled')

    expect(states).toEqual(STATES)
    // the claim requests: string bodies, so fetch labels them text/plain (Q-019)
    expect(posts).toEqual([
      [
        'POST',
        '{"uri":"https://created.example.org/"}',
        'text/plain;charset=UTF-8',
      ],
      [
        'POST',
        '{"uri":"https://duplicate.example.org/"}',
        'text/plain;charset=UTF-8',
      ],
      [
        'POST',
        '{"uri":"https://broken.example.org/"}',
        'text/plain;charset=UTF-8',
      ],
    ])
    // the add block is back (the page shows no results, so the text of the mistake stays)
    await expect(page.locator('#add-new-data-provider')).toContainText(
      'Cannot find your repository or journal in our list? Become a data provider now!'
    )
    // the first sync replaces the URL, the effect of an empty result list pushes action=ADD (Q-048.U4), Cancel
    // pushes the URL without it
    expect(
      (await historySince(page, p2Env)).map((h) => [h.method, h.url])
    ).toEqual([
      ['replaceState', `${D}?q=zzzzqqq&size=10`],
      ['pushState', ZERO],
      ['pushState', `${D}?q=zzzzqqq&size=10`],
    ])
    // Chromium reports the 409 and the 500 of the claim requests
    expect(
      pageConsole(guardLog)
        .filter((c) => c.type === 'error')
        .map((c) => firstLine(c.text))
    ).toEqual([
      'Failed to load resource: the server responded with a status of 409 (Conflict)',
      'Failed to load resource: the server responded with a status of 500 (Internal Server Error)',
    ])
  })
})

test.describe('T-714 @P1 J12 J32 touch subset 375x812', () => {
  test.describe.configure({ timeout: TEST_TIMEOUT })
  test.use({
    viewport: { width: 375, height: 812 },
    hasTouch: true,
    isMobile: true,
  })

  test('T-714 @P1 @wire touch: tap Load more (size 20, scroll kept), tap the map zoom control and a cluster', async ({
    page,
    p2Env,
  }) => {
    const { tracker } = await openDirectory(page, p2Env)
    await settle(page, tracker)
    await mapSettled(page)
    const first = await directoryView(page)
    expect(first.url).toBe(`${D}?q=&size=10`)
    expect(first.stats).toEqual(['Showing 1-10 of 15,672'])
    let m = await mapView(page)
    expect(m.size).toEqual([343, 343])
    expect(m.zooms).toEqual(['2'])
    expect(icons(m)).toEqual(TOUCH_MAP_2)

    await loadMore(page).scrollIntoViewIfNeeded()
    await appQuiet(p2Env)
    const before = (await directoryView(page)).scrollY
    await loadMore(page).tap()
    await urlIs(page, p2Env, `${D}?q=&size=20`)
    await settle(page, tracker)
    const view = await directoryView(page)
    expect(view.stats).toEqual(['Showing 1-20 of 15,672'])
    expect(view.cards).toHaveLength(20)
    expect(view.scrollY).toBe(before)

    await page.locator('#map').scrollIntoViewIfNeeded()
    await mapSettled(page)
    await page.locator('#map .leaflet-control-zoom-in').tap()
    await mapSettled(page, '3')
    m = await mapView(page)
    expect(icons(m)).toEqual(TOUCH_MAP_3)
    await page.locator('#map .leaflet-control-zoom-out').tap()
    await mapSettled(page, '2')
    m = await mapView(page)
    expect(icons(m)).toEqual(TOUCH_MAP_2)
    await page.locator('#map .marker-cluster', { hasText: /^215$/ }).tap()
    await mapSettled(page, '3')
    m = await mapView(page)
    expect(icons(m)).toEqual(TOUCH_MAP_CLUSTER_215)
  })

  test('T-714 @P1 @wire touch: tap the header search, type, tap outside: the blur submits below 500 px (Q-084)', async ({
    page,
    p2Env,
  }) => {
    const { tracker } = await openDirectory(page, p2Env)
    await settle(page, tracker)
    const box = headerBox(page)
    // the floating label covers the input: a finger lands on the label, which focuses the input
    await page.locator('label[for="select-app-bar-search"]').tap()
    await expect(box).toBeFocused()
    await expect.poll(() => suggestions(page)).toEqual(NAMES)
    await box.fill('aberystwyth')
    await expect
      .poll(() => suggestions(page).then((s) => s.length))
      .toBeGreaterThan(0)
    // a tap on the page heading area (outside the header) blurs the box
    await page.touchscreen.tap(20, 700)
    await urlIs(page, p2Env, `${D}?q=aberystwyth&size=10`)
    await settle(page, tracker)
    expect((await directoryView(page)).stats).toEqual(['Showing 1-1 of 1'])
  })
})
