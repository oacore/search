// T-743 (41 H; OD-39; decision 1 (a) of the owner's jump 2 batch round 1): the text Next's route announcer gives
// screen readers after a client navigation. Next renders the announcer as `<p id="__next-route-announcer__"
// aria-live="assertive">` in a `<next-route-announcer>` element it appends to the body: 10.2.3 and 12.3.7 put the
// `<p>` in that element's light DOM, later versions in its shadow root; the reader takes either. It announces on
// every change of the router's asPath after the first load: Next 10.2.3 the page's first h1, else
// `document.title`; Next 12.3.7 `document.title`, else the first h1.
// Per navigation, from a settled hard load: one client navigation (the app's router, or the page's own link or
// button), the settled page (no request in flight and no DOM mutation for 400 ms: the announcement is set in an
// effect after the route change commits, e2e/lib/P0-12/page.mjs), then the announcer's exact text (textContent,
// the string Next sets) = the baseline of that navigation, captured on Next 10.2.3. Each navigation has its own
// baseline file, so an accepted text of a later Next applies through the ledger as one row per file
// (e2e/lib/P0-10/baseline.mjs; 42 §8).
// Fixtures: works-1001, outputs-2001, provider-86, provider-8 (+ req-P1-05 for offset 10), search-climate.
import { test as base, expect } from '../fixtures/guard.mjs'
import { p012Fixtures } from '../lib/P0-12/fixtures.mjs'
import { routeChange, settle, trackRequests } from '../lib/P0-12/page.mjs'
import { expectBaseline } from '../lib/P0-10/baseline.mjs'

const test = base.extend(p012Fixtures)
// a hard load plus the settle waits can take minutes on a heavily loaded machine (40 §5: timeouts, never retries)
test.describe.configure({ timeout: 300000 })
// no cookie popup over the pager (T-715's state)
test.use({ cookieState: 'essential' })

// the announcer element(s) and the text of the announcement, in the light DOM or in the shadow root
const readAnnouncer = (page) =>
  page.evaluate(() => {
    const hosts = [...document.querySelectorAll('next-route-announcer')]
    const found = [...document.querySelectorAll('#__next-route-announcer__')]
    for (const h of hosts)
      if (h.shadowRoot)
        found.push(
          ...h.shadowRoot.querySelectorAll('#__next-route-announcer__')
        )
    return {
      hosts: hosts.length,
      announcers: found.length,
      text: found.length === 1 ? found[0].textContent : null,
    }
  })

// a client navigation the page's own link or button starts, awaited as routeChange (e2e/lib/P0-12/page.mjs)
// awaits the app's router: its routeChangeComplete, a 'Route Cancelled' of another url let through (row W4d-21
// of the owner's jump 2 batch round 1), any other routeChangeError fails; then the settled page
async function clickChange(page, tracker, target, click) {
  await page.evaluate((u) => {
    window.__t743 = new Promise((resolve, reject) => {
      const ev = window.next.router.events
      const off = () => {
        ev.off('routeChangeComplete', ok)
        ev.off('routeChangeError', bad)
      }
      const ok = () => {
        off()
        resolve()
      }
      const bad = (err, url) => {
        if (
          err &&
          err.cancelled &&
          err.message === 'Route Cancelled' &&
          url !== u
        )
          return
        off()
        reject(new Error(`routeChangeError ${err && err.message}`))
      }
      ev.on('routeChangeComplete', ok)
      ev.on('routeChangeError', bad)
    })
  }, target)
  await click()
  await page.evaluate(() => window.__t743)
  await settle(page, tracker, { hydration: false })
}

async function pinAnnouncement(page, p2Env, nav) {
  const tracker = trackRequests(page)
  const res = await page.goto(nav.start)
  expect(res.status(), `hard load of ${nav.start}`).toBe(200)
  await settle(page, tracker)
  if (nav.click)
    await clickChange(page, tracker, nav.target, () => nav.click(page))
  else await routeChange(page, tracker, nav.target)
  await expect(page).toHaveURL(`${p2Env.baseURL}${nav.target}`)
  const a = await readAnnouncer(page)
  expect(
    [a.hosts, a.announcers],
    'one next-route-announcer element holding one announcer'
  ).toEqual([1, 1])
  expectBaseline(nav.name, {
    navigation: `${nav.start} -> ${nav.target} (${nav.how})`,
    announced: a.text,
  })
}

const NAV = {
  providerDetail: {
    name: 't743-works-1001-to-provider-86',
    start: '/works/1001/',
    target: '/data-providers/86/',
    how: 'router.push',
  },
  providerPager: {
    name: 't743-provider-8-pager-next',
    start: '/data-providers/8/',
    target: '/data-providers/8/?offset=10',
    how: 'the pager link Next, shallow',
    click: (page) =>
      page.getByRole('link', { name: 'Next', exact: true }).click(),
  },
  outputs: {
    name: 't743-works-1001-to-outputs-2001',
    start: '/works/1001/',
    target: '/outputs/2001/',
    how: 'router.push',
  },
  works: {
    name: 't743-outputs-2001-to-works-1001',
    start: '/outputs/2001/',
    target: '/works/1001/',
    how: 'router.push',
  },
  search: {
    name: 't743-search-climate-page-2',
    start: '/search/?q=climate',
    target: '/search/?q=climate&page=2',
    how: 'the pager button 2',
    click: (page) =>
      page.getByRole('button', { name: '2', exact: true }).click(),
  },
}

test.describe('T-743 @P1 route announcer text after a client navigation', () => {
  test('T-743 c1 @P1 /works/1001/ -> /data-providers/86/: the announced text = baseline', async ({
    page,
    p2Env,
  }) => {
    await pinAnnouncement(page, p2Env, NAV.providerDetail)
  })

  test('T-743 c2 @P1 /data-providers/8/ pager Next (shallow, ?offset=10): the announced text = baseline', async ({
    page,
    p2Env,
  }) => {
    await pinAnnouncement(page, p2Env, NAV.providerPager)
  })

  test('T-743 c3 @P1 /works/1001/ -> /outputs/2001/: the announced text = baseline', async ({
    page,
    p2Env,
  }) => {
    await pinAnnouncement(page, p2Env, NAV.outputs)
  })

  test('T-743 c4 @P1 /outputs/2001/ -> /works/1001/: the announced text = baseline', async ({
    page,
    p2Env,
  }) => {
    await pinAnnouncement(page, p2Env, NAV.works)
  })

  test('T-743 c5 @P1 /search/?q=climate -> page 2: the announced text = baseline', async ({
    page,
    p2Env,
  }) => {
    await pinAnnouncement(page, p2Env, NAV.search)
  })
})
