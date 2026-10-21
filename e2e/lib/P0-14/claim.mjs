// P0-14: helpers of the claim-row tests (T-734; 41 §2.6 claim rows 1-5, 41 §2.2 E18, Q-027, Q-087, Q-091).
// A provider page asks `GET /internal/data-providers/{id}/account` (E18) from ClaimCard's render, on the
// server (un-awaited) and in the browser; rows 2, 3 and 5 reuse a provider whose recorded answer differs from
// the row, so the test overrides E18 (scenarios.json picks.claimRows): a stub rule for the server's request and
// a page route for the browser's. Rules are global to the stack, so the claim tests run one after the other.
import { stubControl } from '../../fixtures/guard.mjs'

export const API = 'https://api.core.ac.uk'
export const e18Url = (id) => `${API}/internal/data-providers/${id}/account`

// the rows of 41 §2.6: id, what E18 answers (null = the recorded fixture), the provider's billing type
export const ROWS = {
  '1': { id: 86, answer: null, billing: 'sustaining' },
  '2': { id: 4835, answer: { status: 200, body: '[]' }, billing: 'starting' },
  '3': { id: 86, answer: { status: 200, body: '[]' }, billing: 'sustaining' },
  '4': { id: 3354, answer: null, billing: null },
  '5a': {
    id: 86,
    answer: { status: 500, body: '{"message":"Internal Server Error"}' },
    billing: 'sustaining',
  },
  '5b': {
    id: 86,
    answer: { status: 401, body: '{"message":"Unauthorized"}' },
    billing: 'sustaining',
  },
}

// overrides E18 of the row for the server (stub rule) and the browser (page route); returns the cleanup
export async function overrideE18(page, p2Env, row) {
  if (!row.answer) return async () => {}
  const { status, body } = row.answer
  const rule = await stubControl(p2Env, 'POST', '/rules', {
    method: 'GET',
    urlPrefix: e18Url(row.id),
    fail: { status, body, contentType: 'application/json' },
  })
  const match = (u) => u.href === e18Url(row.id)
  await page.route(match, async (route) => {
    const origin = (await route.request().allHeaders()).origin
    await route.fulfill({
      status,
      contentType: 'application/json',
      headers: {
        'access-control-allow-origin': origin,
        'access-control-allow-credentials': 'true',
      },
      body,
    })
  })
  return async () => {
    await stubControl(
      p2Env,
      'DELETE',
      `/rules?id=${encodeURIComponent(rule.id)}`
    )
    await page.unroute(match).catch(() => {})
  }
}

// E18 requests made by the browser page (method, status once answered)
export function browserE18(page, id) {
  const seen = []
  page.on('request', (r) => {
    if (r.url() === e18Url(id)) {
      const e = { method: r.method(), status: null }
      seen.push(e)
      r.response()
        .then((res) => {
          if (res) e.status = res.status()
        })
        .catch(() => {})
    }
  })
  return seen
}

// the server's requests since a mark: [method, URL path], in arrival order
export async function stubWindow(p2Env, since) {
  const w = await stubControl(p2Env, 'GET', `/collect?since=${since}`)
  return w.records.map((r) => ({
    method: r.method,
    path: new URL(r.url).pathname + new URL(r.url).search,
    status: r.status,
  }))
}

export const stubMark = (p2Env, name) =>
  stubControl(p2Env, 'POST', '/mark', { name })

// what the provider page shows of the claim logic: the membership badge, the claim card text and its buttons
export const claimState = (page) =>
  page.evaluate(() => {
    const norm = (s) => s.replace(/\s+/g, ' ').trim()
    const badge = document.querySelector(
      'h5 a[href="https://core.ac.uk/membership"]'
    )
    const title = [...document.querySelectorAll('div')].find(
      (d) =>
        d.children.length === 0 &&
        d.textContent === 'Access Repository Dashboard'
    )
    const card = title && title.parentElement
    return {
      university: norm(document.querySelector('h1').textContent),
      badge: badge && norm(badge.textContent),
      cardText: card && norm(card.children[1].textContent),
      buttons:
        card &&
        [...card.querySelectorAll('button')].map((b) => norm(b.textContent)),
    }
  })
