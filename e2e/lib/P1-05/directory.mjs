// P1-05 helpers of the providers directory /data-providers/ (T-714 J12, J27, J32): the settled view, the header
// search with its suggestions, the add-provider form and the Leaflet map, read inside the page.
import { expect } from '../../fixtures/guard.mjs'
import { NAV_TIMEOUT, netLog, settle, trackPage, watchRouter } from './page.mjs'

export const headerBox = (page) =>
  page.getByRole('combobox', { name: 'Search data providers' })

export const suggestions = (page) => page.getByRole('option').allInnerTexts()

export const loadMore = (page) =>
  page.getByRole('button', { name: 'Load more' })

export const urlField = (page) => page.getByLabel('Data provider URL')

export const finishButton = (page) =>
  page.getByRole('button', { name: 'Finish' })

// hard load of a /data-providers/ URL to the settled hydrated page
export async function openDirectory(page, p2Env, path = '/data-providers/') {
  const log = netLog(page, p2Env)
  const tracker = trackPage(page)
  const res = await page.goto(path)
  await watchRouter(page)
  await settle(page, tracker)
  return { log, tracker, status: res.status() }
}

export const urlIs = (page, p2Env, path) =>
  expect(page).toHaveURL(`${p2Env.baseURL}${path}`, { timeout: NAV_TIMEOUT })

// what the page shows, in one object
export const directoryView = (page) =>
  page.evaluate(() => {
    const text = (e) => e.textContent.replace(/\s+/g, ' ').trim()
    const ld = JSON.parse(
      document.querySelector('script[type="application/ld+json"]').textContent
    )
    const items = ld['@graph'][1].mainEntity.itemListElement
    // a card: the title link and its metadata list (webpage, and country when the provider has one)
    const cards = [...document.querySelectorAll('#__next main a')]
      .filter((a) => /^\/data-providers\/\d+$/.test(a.getAttribute('href')))
      .map((a) => {
        const card = a.parentElement.parentElement
        return [
          text(a),
          a.getAttribute('href'),
          ...[...card.querySelectorAll('dl > div')].map(
            (g) =>
              `${text(g.querySelector('dt'))}: ${text(g.querySelector('dd'))}`
          ),
        ]
      })
    const stats = [...document.querySelectorAll('span, div')]
      .filter((e) => e.children.length === 0 && /^Showing /.test(e.textContent))
      .map(text)
    return {
      url: location.pathname + location.search,
      title: document.title,
      description: document.querySelector('meta[name="description"]')?.content,
      ldNames: items.map((i) => i.item.name),
      stats,
      cards,
      headerInput: document.querySelector('#select-app-bar-search')?.value,
      loadMore: [...document.querySelectorAll('button')].some(
        (b) => text(b) === 'Load more'
      ),
      paragraphs: [...document.querySelectorAll('#__next p')].map(text),
      form: [...document.querySelectorAll('h3')].some(
        (h) => text(h) === 'Suggest a new data provider'
      ),
      scrollY: Math.round(window.scrollY),
    }
  })

// the facts of a Leaflet map: container size, zoom level of the loaded tiles, markers and clusters with their
// position inside the container
export const mapView = (page) =>
  page.evaluate(() => {
    const c = document.querySelector('#map')
    const r = c.getBoundingClientRect()
    const tiles = [...c.querySelectorAll('.leaflet-tile-loaded')].map((t) =>
      t.src.replace(/^https?:\/\/[a-c]\.tile\.openstreetmap\.org\//, '')
    )
    const zooms = [...new Set(tiles.map((t) => t.split('/')[0]))]
    const icons = [...c.querySelectorAll('.leaflet-marker-icon')]
      .map((m) => {
        const b = m.getBoundingClientRect()
        return {
          kind: m.classList.contains('marker-cluster') ? 'cluster' : 'marker',
          text: m.textContent.trim(),
          x: Math.round(b.x - r.x),
          y: Math.round(b.y - r.y),
        }
      })
      .sort((a, b) => a.x - b.x || a.y - b.y)
    return {
      size: [Math.round(r.width), Math.round(r.height)],
      zooms,
      icons,
    }
  })

// wait until the map shows `zoom` and only that level (Leaflet keeps the tiles of the previous level until its
// zoom animation ended), has no tile loading and no animation running; the marker layer is rebuilt by the page
// after every move, so the icons are read only after this
export async function mapSettled(page, zoom = '2') {
  await expect
    .poll(
      () =>
        page.evaluate((want) => {
          const c = document.querySelector('#map')
          if (!c) return 'no map'
          if (c.querySelector('.leaflet-zoom-anim')) return 'zooming'
          if (c.querySelector('.leaflet-tile:not(.leaflet-tile-loaded)'))
            return 'loading'
          const levels = [
            ...new Set(
              [...c.querySelectorAll('.leaflet-tile-loaded')].map(
                (t) => t.src.split('/').slice(-3)[0]
              )
            ),
          ]
          if (levels.join() !== want) return `levels ${levels.join()}`
          return document
            .getAnimations()
            .filter((a) => a.effect.getTiming().iterations !== Infinity).length
            ? 'animating'
            : 'ready'
        }, zoom),
      { timeout: NAV_TIMEOUT, intervals: [250] }
    )
    .toBe('ready')
}

// ---------- the add-provider form (J27) ----------

// the form of a query without results: the field with its validity, the helper text and its links, the status
// variant of the field group (class stems), the status icon, the buttons
export const formView = (page) =>
  page.evaluate(() => {
    const text = (e) => e.textContent.replace(/\s+/g, ' ').trim()
    const stem = (c) => c.replace(/-[\w-]{5}$/, '')
    const form = document.querySelector('form')
    if (!form) return null
    const group = form.querySelector('#data-provider-url')
    const field = form.querySelector('#data-provider-url-control')
    const helper = form.querySelector('#data-provider-url-helper')
    const icon = group.querySelector('use')
    return {
      url: location.pathname + location.search,
      value: field.value,
      valid: field.validity.valid,
      validationMessage: field.validationMessage,
      ariaInvalid: field.getAttribute('aria-invalid'),
      variant: [...group.classList]
        .map(stem)
        .filter((c) => c !== 'styles-group'),
      icon: icon ? icon.getAttribute('href').split('#')[1] : null,
      helper: helper ? text(helper) : null,
      helperLinks: helper
        ? [...helper.querySelectorAll('a')].map((a) => [
            text(a),
            a.getAttribute('href'),
            a.getAttribute('title'),
          ])
        : [],
      finishDisabled: form.querySelector('button[type="submit"]').disabled,
      cancelDisabled: form.querySelector('button[type="button"]').disabled,
    }
  })
