// P1-05 test object: the guard's `test` and `expect` (e2e/fixtures/guard.mjs) with the package's timeouts.
// The consent cookie is given (`essential`) so that the bottom-fixed cookie popup (T-719, T-740) never covers
// the page. No gap stand-in is needed: the harness answers result thumbnails (<stack>/image/**) and
// core.ac.uk/images/** itself, and doi.org is a listed SSR stub host.
import {
  test as guardTest,
  expect as guardExpect,
  stubControl,
} from '../../fixtures/guard.mjs'
import { EXPECT_TIMEOUT } from './page.mjs'

// web-first assertions wait up to EXPECT_TIMEOUT (40 §5: timeouts, never retries)
export const expect = guardExpect.configure({ timeout: EXPECT_TIMEOUT })
export { stubControl }

export const test = guardTest.extend({})
