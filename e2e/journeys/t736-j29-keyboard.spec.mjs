// T-736 (41 H, J29; extends T-804; Q-083, Q-045, Q-085; R-075, R-087): the keyboard-only journeys, as the app
// behaves today, a11y gaps included.
//   c1  Tab order, tooltips on focus, Esc per modal and focus return:
//       - /search/?q=climate: logo link, the clear button (before the box), the search box, the three menu buttons,
//         the two toolbar buttons (their tooltips show while they are focused and only then), then every result's
//         links in document order;
//       - the CSV modal by keyboard: Enter on the toolbar button opens it with the focus on Cancel, Tab and
//         Shift+Tab cycle between Cancel and Download (the dialog traps the focus), the size options are not
//         focusable (no inputs), Esc does nothing (`hideManually`: Q-085), Space on Cancel closes it, the focus
//         returns to the toolbar button, `body.style.overflow` is `hidden` while it is open and `unset` after;
//         the header (z-index 10000) sits above the modal overlay (z-index 1030): Q-085;
//       - /data-providers/8/: logo, three menu buttons, the membership link, the search box, the result links, the
//         four pager arrows (links), the repository link, the map (focusable container, zoom buttons, attribution
//         links), the claim buttons;
//   c2  the pointer-events traps are keyboard-reachable (Q-083, Q-045):
//       - search pager: Previous on page 1 has the `disabled` attribute (not focusable, skipped by Tab) while the
//         Next of the last page has only the disabled class: it takes the focus and Enter pushes page 10 (Q-045);
//         Enter on the active page re-pushes it (a replace);
//       - provider pager: the arrows are links with `aria-disabled`: First and Previous at offset 0 take the focus
//         and Enter pushes (or replaces) the same offset; Next and Last at the end point at `offset=NaN`, and
//         Enter pushes it (the API's recorded answer for that offset is a 500: the error text shows).
// Fixtures: search-climate, req-P0-13 (the 85-hit search of T-706), provider-8 (+ req-P1-05 offsets), tiles.
import { test, expect } from '../lib/P1-05/fixtures.mjs'
import {
  ACTION_TIMEOUT,
  NAV_TIMEOUT,
  TEST_TIMEOUT,
  appQuiet,
  historySince,
  settle,
  trackPage,
  watchRouter,
} from '../lib/P1-05/page.mjs'
import {
  arrow,
  entries,
  openProvider,
  providerView,
  urlIs,
} from '../lib/P1-05/provider.mjs'
import { resultsOf } from '../lib/P1-05/results.mjs'

test.use({
  cookieState: 'essential',
  navigationTimeout: NAV_TIMEOUT,
  actionTimeout: ACTION_TIMEOUT,
})

// the focused element, described by what a keyboard user can tell: tag, role, label, text, icon, id, link target
const focused = (page, p2Env) =>
  page.evaluate((origin) => {
    const e = document.activeElement
    if (!e || e === document.body) return { tag: 'body' }
    const use = e.querySelector('use')
    const href = e.getAttribute('href')
    const d = {
      tag: e.tagName.toLowerCase(),
      role: e.getAttribute('role'),
      label: e.getAttribute('aria-label'),
      text: (e.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 40),
      icon: use ? use.getAttribute('href').split('#')[1] : null,
      id: e.id,
      href: href ? href.split(origin).join('') : null,
    }
    return Object.fromEntries(Object.entries(d).filter(([, v]) => v))
  }, new URL(p2Env.baseURL).origin)

async function tabStops(page, p2Env, n) {
  const stops = []
  for (let i = 0; i < n; i++) {
    await page.keyboard.press('Tab')
    stops.push(await focused(page, p2Env))
  }
  return stops
}

const tooltips = (page) =>
  page.evaluate(() =>
    [...document.querySelectorAll('[class*="popover"]')].map(
      (d) => `${d.textContent}:${getComputedStyle(d).visibility}`
    )
  )

test.describe('T-736 @P1 J29 keyboard only', () => {
  test.describe.configure({ timeout: TEST_TIMEOUT })

  test('T-736 c1 @P1 /search/?q=climate: Tab order of the header, the toolbar and the first results; tooltips show on focus only', async ({
    page,
    p2Env,
  }) => {
    const tracker = trackPage(page)
    await page.goto('/search/?q=climate')
    await watchRouter(page)
    await settle(page, tracker)
    // the toolbar buttons have a tooltip each, shown while the button is focused and gone with the focus; the
    // tooltip that loses the focus hides with a transition, so each Tab stop waits for its tooltip state
    // (40 §5: timeouts, never retries) before the next Tab
    const TIPS = [
      [],
      [],
      [],
      [],
      [],
      [],
      ['Download results in CSV:visible'],
      ['Copy url:visible'],
      [],
      [],
      [],
      [],
    ]
    const stops = []
    for (let i = 0; i < 12; i++) {
      await page.keyboard.press('Tab')
      stops.push(await focused(page, p2Env))
      await expect
        .poll(() => tooltips(page), {
          message: `the tooltips at Tab stop ${i + 1}`,
        })
        .toEqual(TIPS[i])
    }
    const T = 'fafad9968b7cd268c5fd64342bf88a26-19211324'
    expect(stops).toEqual([
      {
        tag: 'a',
        text: 'CORECOnnectingREpositories',
        icon: 'core-symbol',
        href: 'https://core.ac.uk/',
      },
      { tag: 'button', icon: 'window-close' },
      { tag: 'input', role: 'combobox', id: 'select-app-bar-search' },
      { tag: 'button', role: 'button', text: 'Services', id: 'services-title' },
      {
        tag: 'button',
        role: 'button',
        text: 'Support us',
        id: 'communities-title',
      },
      { tag: 'button', role: 'button', text: 'About', id: 'about-title' },
      { tag: 'button', icon: 'download' },
      { tag: 'button', icon: 'share-variant' },
      {
        tag: 'a',
        text: 'Climate change 2015: growing risks, crit',
        href: `/works/19211324/?t=${T}&search=q=climate`,
      },
      {
        tag: 'a',
        text: 'Climate Council',
        href: `/search?q=author:(Climate Council)&t=${T}`,
      },
      { tag: 'a', text: 'Full text link', href: '/download/30671329.pdf' },
      {
        tag: 'a',
        text: 'Analysis and Policy Observatory (APO)',
        href: `/data-providers/713?t=${T}`,
      },
    ])
    // Shift+Tab walks the same way back
    await page.keyboard.press('Shift+Tab')
    expect(await focused(page, p2Env)).toEqual(stops[10])
    for (let i = 0; i < 5; i++) await page.keyboard.press('Shift+Tab')
    expect(await focused(page, p2Env)).toEqual(stops[5])
  })

  test('T-736 c1 @P1 CSV modal by keyboard: focus on Cancel, Tab cycles, Esc does nothing, Space on Cancel closes and returns the focus (Q-085)', async ({
    page,
    p2Env,
  }) => {
    const tracker = trackPage(page)
    await page.goto('/search/?q=climate')
    await watchRouter(page)
    await settle(page, tracker)
    const download = page.locator('button:has(use[href$="#download"])')
    const dialog = page.getByRole('dialog')
    const state = () =>
      page.evaluate(() => {
        const header = document.querySelector('header#header')
        const d = document.querySelector('[role="dialog"]')
        let overlay = d
        while (overlay && getComputedStyle(overlay).position !== 'fixed')
          overlay = overlay.parentElement
        return {
          overflow: document.body.style.overflow,
          label: d ? d.getAttribute('aria-label') : null,
          inputs: d ? d.querySelectorAll('input').length : null,
          headerZ: getComputedStyle(header).zIndex,
          overlayZ: overlay ? getComputedStyle(overlay).zIndex : null,
        }
      })
    expect(await state()).toMatchObject({ overflow: '', label: null })

    await download.focus()
    await expect(download).toBeFocused()
    await page.keyboard.press('Enter')
    await expect(dialog).toBeVisible()
    // the focus lands on Cancel; the dialog's accessible name has a typo ("cvs"); no size option is focusable
    await expect(dialog.getByRole('button', { name: 'Cancel' })).toBeFocused()
    expect(await state()).toEqual({
      overflow: 'hidden',
      label: 'Download results in cvs modal',
      inputs: 0,
      // Q-085: the header is above the overlay
      headerZ: '10000',
      overlayZ: '1030',
    })
    // Tab and Shift+Tab stay between the two buttons
    const names = []
    for (const key of [
      'Tab',
      'Tab',
      'Tab',
      'Shift+Tab',
      'Shift+Tab',
      'Shift+Tab',
    ]) {
      await page.keyboard.press(key)
      names.push((await focused(page, p2Env)).text)
    }
    expect(names).toEqual([
      'Download',
      'Cancel',
      'Download',
      'Cancel',
      'Download',
      'Cancel',
    ])
    // Esc has no effect on a hideManually modal, even with the focus inside
    await page.keyboard.press('Escape')
    await expect(dialog).toBeVisible()
    await expect(dialog.getByRole('button', { name: 'Cancel' })).toBeFocused()
    expect((await state()).overflow).toBe('hidden')
    // Space on Cancel closes it; the focus goes back to the toolbar button, which shows its tooltip again
    await page.keyboard.press('Space')
    await expect(dialog).toHaveCount(0)
    await expect(download).toBeFocused()
    expect(await state()).toMatchObject({ overflow: 'unset', label: null })
    expect(await tooltips(page)).toEqual(['Download results in CSV:visible'])
  })

  test('T-736 c1 @P1 /data-providers/8/: Tab order of the header, the results, the pager arrows, the map and the claim buttons', async ({
    page,
    p2Env,
    resolver,
  }) => {
    const { tracker } = await openProvider(page, p2Env, '/data-providers/8/')
    await settle(page, tracker)
    await expect(
      page.locator('#map .leaflet-tile-loaded').first()
    ).toBeVisible()
    const stops = await tabStops(page, p2Env, 45)
    const firstResult = stops.findIndex((s) =>
      (s.href || '').startsWith('/outputs/')
    )
    const pager = stops.findIndex((s) => s.label === 'First')
    expect(stops.slice(0, firstResult)).toEqual([
      {
        tag: 'a',
        text: 'CORECOnnectingREpositories',
        icon: 'core-symbol',
        href: 'https://core.ac.uk/',
      },
      { tag: 'button', role: 'button', text: 'Services', id: 'services-title' },
      {
        tag: 'button',
        role: 'button',
        text: 'Support us',
        id: 'communities-title',
      },
      { tag: 'button', role: 'button', text: 'About', id: 'about-title' },
      {
        tag: 'a',
        text: 'starting member',
        href: 'https://core.ac.uk/membership',
      },
      {
        tag: 'input',
        role: 'combobox',
        id: 'select-data-providers-outputs-select',
      },
    ])
    // ten results: the title, the author links and the repository for each (26 stops in all)
    expect(pager - firstResult).toBe(26)
    // the first stop of the results is the title link of the first result of the page's E13 answer
    const [title, href] = resultsOf(
      resolver,
      'https://api.core.ac.uk/v3/data-providers/8/outputs?q=&offset=0&limit=10&sort=recency'
    )[0]
    expect(stops[firstResult]).toEqual({
      tag: 'a',
      text: title.slice(0, 40),
      href,
    })
    expect(stops.slice(pager)).toEqual([
      {
        tag: 'a',
        label: 'First',
        icon: 'chevron-double-left',
        href: '/data-providers/8/?offset=0',
      },
      {
        tag: 'a',
        label: 'Previous',
        icon: 'chevron-left',
        href: '/data-providers/8/?offset=0',
      },
      {
        tag: 'a',
        label: 'Next',
        icon: 'chevron-right',
        href: '/data-providers/8/?offset=10',
      },
      {
        tag: 'a',
        label: 'Last',
        icon: 'chevron-double-right',
        href: '/data-providers/8/?offset=30950',
      },
      {
        tag: 'a',
        text: 'Birkbeck Institutional Research Online',
        href: '/data-providers/8',
      },
      {
        tag: 'div',
        id: 'map',
        text: '+− Leaflet | © OpenStreetMap contributor',
      },
      { tag: 'a', role: 'button', label: 'Zoom in', text: '+', href: '#' },
      { tag: 'a', role: 'button', label: 'Zoom out', text: '−', href: '#' },
      { tag: 'a', text: 'Leaflet', href: 'https://leafletjs.com' },
      {
        tag: 'a',
        text: 'OpenStreetMap',
        href: 'https://www.openstreetmap.org/copyright',
      },
      {
        tag: 'a',
        text: 'CORE Repository Dashboard!',
        href: 'https://core.ac.uk/services/repository-dashboard',
      },
      { tag: 'button', text: 'SIGN IN' },
      { tag: 'button', text: 'Create account' },
    ])
  })

  test('T-736 c2 @P1 search pager (Q-083, Q-045): Previous on page 1 is a disabled button, the active page re-pushes itself, Next of the last page takes the focus and pushes page 10', async ({
    page,
    p2Env,
  }) => {
    const Q = 'climate AND (yearPublished>=1952 AND yearPublished<=1952)'
    const urlOf = (n) =>
      `/search/?${new URLSearchParams({ q: Q, page: String(n) })
        .toString()
        .replace(/[()]/g, (c) => (c === '(' ? '%28' : '%29'))}`
    const tracker = trackPage(page)
    await page.goto(urlOf(1))
    await watchRouter(page)
    await settle(page, tracker)
    const buttons = () =>
      page.evaluate(() =>
        [...document.querySelectorAll('ul[class*="pagination"] button')].map(
          (b) => [
            b.textContent.trim() ||
              b.querySelector('use').getAttribute('href').split('#')[1],
            b.disabled,
            getComputedStyle(b).pointerEvents,
          ]
        )
      )
    // page 1: the Previous button has the `disabled` attribute and the active page carries pointer-events:none
    expect(await buttons()).toEqual([
      ['chevron-left', true, 'none'],
      ['1', false, 'none'],
      ['2', false, 'auto'],
      ['3', false, 'auto'],
      ['4', false, 'auto'],
      ['5', false, 'auto'],
      ['6', false, 'auto'],
      ['7', false, 'auto'],
      ['last', false, 'auto'],
      ['chevron-right', false, 'auto'],
    ])
    const active = page.locator('ul[class*="pagination"] button', {
      hasText: /^1$/,
    })
    await active.focus()
    await expect(active).toBeFocused()
    // Shift+Tab leaves the pager backwards past the disabled Previous: the focus goes to the last link of the
    // results
    await page.keyboard.press('Shift+Tab')
    expect((await focused(page, p2Env)).tag).toBe('a')
    expect((await focused(page, p2Env)).href).toMatch(/^\/data-providers\/\d+/)
    // Enter on the active page pushes the same URL again: a replace, and the data is fetched again
    await active.focus()
    const histFrom = (await historySince(page, p2Env)).length
    await page.keyboard.press('Enter')
    await expect
      .poll(async () => (await historySince(page, p2Env, histFrom)).length, {
        timeout: NAV_TIMEOUT,
      })
      .toBe(1)
    await settle(page, tracker)
    expect(
      (await historySince(page, p2Env, histFrom)).map((h) => [h.method, h.url])
    ).toEqual([['replaceState', urlOf(1)]])

    // the last page by the keyboard ("last" button), then Tab to the Next arrow
    const lastBtn = page.locator('ul[class*="pagination"] button', {
      hasText: /^last$/,
    })
    await lastBtn.focus()
    await appQuiet(p2Env)
    await page.keyboard.press('Enter')
    await expect(page).toHaveURL(`${p2Env.baseURL}${urlOf(9)}`, {
      timeout: NAV_TIMEOUT,
    })
    await settle(page, tracker)
    const labels = (await buttons()).map(([t]) => t)
    expect(labels[labels.length - 2]).toBe('last')
    const lastActive = page.locator('ul[class*="pagination"] button', {
      hasText: /^last$/,
    })
    await lastActive.focus()
    await page.keyboard.press('Tab')
    // the Next arrow has the disabled class (pointer-events:none) but no disabled attribute: Tab reaches it
    const trap = await page.evaluate(() => {
      const b = document.activeElement
      return [
        b.tagName.toLowerCase(),
        b.disabled,
        getComputedStyle(b).pointerEvents,
        b.querySelector('use').getAttribute('href').split('#')[1],
      ]
    })
    expect(trap).toEqual(['button', false, 'none', 'chevron-right'])
    const histFrom2 = (await historySince(page, p2Env)).length
    await page.keyboard.press('Enter')
    await expect(page).toHaveURL(`${p2Env.baseURL}${urlOf(10)}`, {
      timeout: NAV_TIMEOUT,
    })
    await settle(page, tracker)
    // past the end: the empty state (T-706 pins the page in detail)
    await expect(
      page.getByText(`Sorry, we couldn’t find any results for “${Q}”.`)
    ).toBeVisible()
    expect(
      (await historySince(page, p2Env, histFrom2)).map((h) => [h.method, h.url])
    ).toEqual([['pushState', urlOf(10)]])
  })

  test('T-736 c2 @P1 provider pager (Q-083, Q-044): the disabled arrows are links that take the focus, and Enter pushes what they point at, offset=NaN included', async ({
    page,
    p2Env,
  }) => {
    const P = '/data-providers/8/'
    const FAILED =
      'An error occured. Try to reload the page in a bit or contact us.'
    const { tracker } = await openProvider(page, p2Env, P)
    const histFrom = (await historySince(page, p2Env)).length
    // the arrow that has the focus (with its aria-disabled) when Enter is pressed, and the page afterwards
    const step = async (label, path) => {
      const on = await page.evaluate(() => {
        const a = document.activeElement
        return [a.getAttribute('aria-label'), a.getAttribute('aria-disabled')]
      })
      await page.keyboard.press('Enter')
      await urlIs(page, p2Env, path)
      await settle(page, tracker)
      const v = await providerView(page)
      return [
        label,
        on,
        {
          stats: v.stats,
          notice: v.notice,
          results: v.results.length,
          pager: v.pager,
        },
      ]
    }
    const steps = []
    // First is disabled at offset 0 but takes the focus; Enter pushes ?offset=0 over the bare URL
    await arrow(page, 'First').focus()
    steps.push(await step('First', `${P}?offset=0`))
    // Tab to Previous (also disabled): Enter pushes the URL the page is on: a replace
    await page.keyboard.press('Tab')
    steps.push(await step('Previous', `${P}?offset=0`))
    // Tab to Next (enabled)
    await page.keyboard.press('Tab')
    steps.push(await step('Next', `${P}?offset=10`))
    // Last: offset = total, past the end
    await arrow(page, 'Last').focus()
    steps.push(await step('Last', `${P}?offset=30950`))
    // the end state: Next is disabled and points at NaN; it takes the focus and Enter pushes it
    await arrow(page, 'Next').focus()
    steps.push(await step('Next at the end', `${P}?offset=NaN`))

    const arrows = (offset, dis, next, last) => [
      [
        'First',
        `${P}?offset=0`,
        dis.first,
        dis.first === 'true' ? 'none' : 'auto',
      ],
      [
        'Previous',
        `${P}?offset=${offset}`,
        dis.first,
        dis.first === 'true' ? 'none' : 'auto',
      ],
      [
        'Next',
        `${P}?offset=${next}`,
        dis.end,
        dis.end === 'true' ? 'none' : 'auto',
      ],
      [
        'Last',
        `${P}?offset=${last}`,
        dis.end,
        dis.end === 'true' ? 'none' : 'auto',
      ],
    ]
    const atStart = { first: 'true', end: 'false' }
    const inside = { first: 'false', end: 'false' }
    const atEnd = { first: 'false', end: 'true' }
    const lost = { first: 'true', end: 'true' }
    expect(steps).toEqual([
      // the disabled arrows are links: they take the focus and Enter follows them
      [
        'First',
        ['First', 'true'],
        {
          stats: ['Showing 1-10 of 30,950'],
          notice: [],
          results: 10,
          pager: arrows(0, atStart, 10, 30950),
        },
      ],
      [
        'Previous',
        ['Previous', 'true'],
        {
          stats: ['Showing 1-10 of 30,950'],
          notice: [],
          results: 10,
          pager: arrows(0, atStart, 10, 30950),
        },
      ],
      [
        'Next',
        ['Next', 'false'],
        {
          stats: ['Showing 11-20 of 30,950'],
          notice: [],
          results: 10,
          pager: arrows(10, inside, 20, 30950),
        },
      ],
      // Last: the API answers 400; Next and Last now point at NaN and are disabled
      [
        'Last',
        ['Last', 'false'],
        {
          stats: ['Showing 30,951-30,960 of a lot of'],
          notice: [FAILED],
          results: 0,
          pager: arrows(30950, atEnd, 'NaN', 'NaN'),
        },
      ],
      // Enter on the disabled Next pushes offset=NaN: the page counts "a lot of", every arrow is disabled
      [
        'Next at the end',
        ['Next', 'true'],
        {
          stats: ['Showing a lot of-a lot of of a lot of'],
          notice: [FAILED],
          results: 0,
          pager: arrows('NaN', lost, 'NaN', 'NaN'),
        },
      ],
    ])
    expect(await entries(page, p2Env, histFrom)).toEqual([
      ['pushState', `${P}?offset=0`],
      ['replaceState', `${P}?offset=0`],
      ['pushState', `${P}?offset=10`],
      ['pushState', `${P}?offset=30950`],
      ['pushState', `${P}?offset=NaN`],
    ])
  })
})
