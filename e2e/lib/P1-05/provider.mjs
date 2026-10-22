// P1-05 helpers of the provider page /data-providers/<id>/ (T-715 J13, T-735 J26): the settled view, the pager
// and the sort box, the facts of the page read inside the page (visible text, attributes, computed
// pointer-events), so that one comparable object describes a step.
import { expect } from '../../fixtures/guard.mjs'
import {
  NAV_TIMEOUT,
  historySince,
  netLog,
  rel,
  settle,
  trackPage,
  watchRouter,
} from './page.mjs'

export const searchBox = (page) =>
  page.getByRole('combobox', { name: 'Search', exact: true })

export const arrow = (page, name) =>
  page.getByRole('link', { name, exact: true })

export const sortToggle = (page) => page.getByText(/^Sort by/)

// hard load of /data-providers/<id>/ to the settled hydrated page
export async function openProvider(page, p2Env, path) {
  const log = netLog(page, p2Env)
  const tracker = trackPage(page)
  const res = await page.goto(path)
  await watchRouter(page)
  await settle(page, tracker)
  return { log, tracker, status: res.status() }
}

// what the page shows, in one object
export const providerView = (page) =>
  page.evaluate(() => {
    const text = (e) => e.textContent.replace(/\s+/g, ' ').trim()
    const main = document.querySelector('#__next main') || document.body
    const leaf = (re) =>
      [...document.querySelectorAll('span, div')]
        .filter((e) => e.children.length === 0 && re.test(e.textContent))
        .map(text)
    const results = [...main.querySelectorAll('h3 a, a[href*="/outputs/"]')]
      .filter((a) => /\/outputs\/\d+$/.test(a.getAttribute('href') || ''))
      .map((a) => [
        text(a),
        a.getAttribute('href').replace(/^https?:\/\/[^/]+/, ''),
      ])
    // the meta box counts (full texts, metadata records) are card titles
    const counts = [...document.querySelectorAll('h1')]
      .map(text)
      .filter((t) => /^[\d,]+$/.test(t))
    return {
      url: location.pathname + location.search,
      title: document.title,
      name: text(main.querySelector('h1') || document.body),
      member: text(main.querySelector('h5') || document.body),
      found: leaf(/research outputs found$/),
      sort: [...document.querySelectorAll('[role="presentation"]')]
        .map(text)
        .filter((t) => /^Sort by/.test(t)),
      input: document.querySelector('#select-data-providers-outputs-select')
        ?.value,
      stats: leaf(/^Showing /),
      notice: leaf(
        /^(This data provider has not articles yet\.|An error occured)/
      ),
      results,
      pager: [
        ...document.querySelectorAll(
          'nav[aria-label="Pagination Navigation"] a'
        ),
      ].map((a) => [
        a.getAttribute('aria-label'),
        a.getAttribute('href'),
        a.getAttribute('aria-disabled'),
        getComputedStyle(a).pointerEvents,
      ]),
      counts,
    }
  })

// the sort menu: whether its list is rendered and its options as [text, checked, pointer-events]
export const sortMenu = (page) =>
  page.evaluate(() => {
    const text = (e) => e.textContent.replace(/\s+/g, ' ').trim()
    const box = [...document.querySelectorAll('[role="presentation"]')].find(
      (e) => /^Sort by/.test(text(e))
    )
    const list = box && box.nextElementSibling
    const ul = list && list.tagName === 'UL' ? list : null
    return {
      open: Boolean(ul),
      options: ul
        ? [...ul.querySelectorAll('li')].map((li) => [
            text(li),
            li.querySelector('input')
              ? li.querySelector('input').checked
              : null,
            getComputedStyle(li).pointerEvents,
          ])
        : [],
    }
  })

// the map of the page's map card (or any Leaflet map): container size, tile count, marker count, popups
export const mapState = (page) =>
  page.evaluate(() => {
    const c = document.querySelector('#map')
    const r = c.getBoundingClientRect()
    return {
      size: [Math.round(r.width), Math.round(r.height)],
      tiles: c.querySelectorAll('.leaflet-tile-loaded').length,
      markers: c.querySelectorAll('.leaflet-marker-icon:not(.marker-cluster)')
        .length,
      clusters: c.querySelectorAll('.marker-cluster').length,
    }
  })

export const urlIs = (page, p2Env, path) =>
  expect(page).toHaveURL(`${p2Env.baseURL}${path}`, { timeout: NAV_TIMEOUT })

// history entries added since `from`, as [method, url]
export async function entries(page, p2Env, from) {
  return (await historySince(page, p2Env, from)).map((h) => [h.method, h.url])
}

export { rel }
