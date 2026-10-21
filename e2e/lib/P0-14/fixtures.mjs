// P0-14 test object: the guard's `test` (e2e/fixtures/guard.mjs) plus
//   - p14Doi (worker, auto): the stub rules for the E9 fixtures while doi.org is not an SSR stub host (I-40);
//   - p14Gaps (test, auto): the browser stand-ins for thumbnails (I-39) and a history baseline init script:
//     `window.__p14h0` = history.length at the start of every document, so entries added by the page are
//     counted relative to the document start (a test never depends on how many entries the context had).
import {
  test as guardTest,
  expect as guardExpect,
  stubControl,
} from '../../fixtures/guard.mjs'
import { serveDoiFixtures, serveBrowserGaps } from './gaps.mjs'
import { EXPECT_TIMEOUT } from './page.mjs'

// web-first assertions wait up to EXPECT_TIMEOUT: the machine runs several stacks at once (40 §5: timeouts,
// never retries)
export const expect = guardExpect.configure({ timeout: EXPECT_TIMEOUT })
export { stubControl }

export const test = guardTest.extend({
  p14Doi: [
    async ({ p2Env, resolver }, use) => {
      const cleanup = await serveDoiFixtures(p2Env, resolver)
      await use(true)
      await cleanup().catch(() => {})
    },
    { scope: 'worker', auto: true },
  ],
  p14Gaps: [
    async ({ context, request, p2Env, resolver }, use) => {
      await context.addInitScript(() => {
        window.__p14h0 = history.length
      })
      await serveBrowserGaps(context, { request, env: p2Env, resolver })
      await use(true)
    },
    { auto: true },
  ],
})
