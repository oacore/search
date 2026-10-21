// P0-12 Playwright fixtures, added with `test.extend(p012Fixtures)` on the guard's own `test` (every spec still
// imports { test, expect } from e2e/fixtures/guard.mjs, manifest §4.4):
//   p012Gaps     (worker) which browser stand-ins of harness-gaps.mjs this stack needs
//   p012Ssr      (worker, auto) the SSR stand-in rules of harness-gaps.mjs, removed when the worker ends
//   p012Page     (auto) the browser stand-ins and the dom.mjs MutationObserver on the guard's `context`
import {
  coverBrowserGaps,
  coverSsrGaps,
  probeBrowserGaps,
} from './harness-gaps.mjs'
import { moInitScript } from './dom.mjs'

export const p012Fixtures = {
  p012Gaps: [
    async ({ p2Env }, use) => {
      await use(await probeBrowserGaps(p2Env))
    },
    { scope: 'worker' },
  ],
  p012Ssr: [
    async ({ p2Env, resolver }, use) => {
      const cleanup = await coverSsrGaps(p2Env, resolver)
      await use(true)
      await cleanup()
    },
    { scope: 'worker', auto: true },
  ],
  p012Page: [
    async ({ context, p2Env, resolver, p012Gaps }, use) => {
      await coverBrowserGaps(context, { p2Env, resolver, gaps: p012Gaps })
      await context.addInitScript(moInitScript)
      await use(true)
    },
    { auto: true },
  ],
}
