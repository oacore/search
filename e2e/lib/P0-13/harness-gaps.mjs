// P0-13 test object: the guard's `test` (e2e/fixtures/guard.mjs) plus one package-local stand-in for an open
// harness gap (issue I-39), which answers what 40 §2.4 intends and switches itself off once the harness
// closes the gap:
//   thumbnails  The resolver rewrites `links[].url` https://core.ac.uk/... to the proxy origin (40 §2.4), so
//               the result thumbnails become <proxy>/image/<id>/large, which no gateway route serves (404; the
//               guard then fails the load with `asset >= 400`). While the proxy answers 404 there, the context
//               answers them with the resolver's core.ac.uk/image answer (the fixed 256 px PNG).
// The search pages have no DOI (E9) and no similar works, so the other gaps of the works pages do not apply.
// Nothing here hides a console message, page error, window error or asset failure of the app.
import { test as guardTest, expect } from '../../fixtures/guard.mjs'

export { expect }

const imageAnswer = (resolver) => async (route) => {
  const u = new URL(route.request().url())
  const r = resolver.resolve(
    'GET',
    `https://core.ac.uk/image/${u.pathname.split('/').slice(2).join('/')}`
  )
  const headers = {}
  for (const [n, v] of r.headers) headers[n.toLowerCase()] = v
  await route.fulfill({ status: r.status, headers, body: r.body })
}

export const test = guardTest.extend({
  p13Gaps: [
    async ({ context, p2Env, resolver, request }, use) => {
      const origin = new URL(p2Env.baseURL).origin
      const probe = await request.get(`${origin}/image/1/large`, {
        maxRedirects: 0,
      })
      const thumbnails = probe.status() === 404
      if (thumbnails)
        await context.route(
          (u) => u.origin === origin && u.pathname.startsWith('/image/'),
          imageAnswer(resolver)
        )
      await use({ thumbnails })
    },
    { auto: true },
  ],
})
