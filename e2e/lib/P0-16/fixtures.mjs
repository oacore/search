// P0-16 Playwright fixtures, added with `test.extend(p016Fixtures)` on the guard's own `test` (every spec still
// imports { test, expect } from e2e/fixtures/guard.mjs, manifest §4.4):
//   p016Gaps     (worker) which browser stand-ins of harness-gaps.mjs this stack needs
//   p016Ssr      (worker, auto) the SSR stand-in rules of harness-gaps.mjs, removed when the worker ends
//   p016Page     (auto) the browser stand-ins on the guard's `context`
import {
  coverBrowserGaps,
  coverSsrGaps,
  probeBrowserGaps,
} from './harness-gaps.mjs'

export const p016Fixtures = {
  p016Gaps: [
    async ({ p2Env }, use) => {
      await use(await probeBrowserGaps(p2Env))
    },
    { scope: 'worker' },
  ],
  p016Ssr: [
    async ({ p2Env, resolver }, use) => {
      const cleanup = await coverSsrGaps(p2Env, resolver)
      await use(true)
      await cleanup()
    },
    { scope: 'worker', auto: true },
  ],
  p016Page: [
    async ({ context, p2Env, resolver, p016Gaps }, use) => {
      await coverBrowserGaps(context, { p2Env, resolver, gaps: p016Gaps })
      await use(true)
    },
    { auto: true },
  ],
}
