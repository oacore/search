// P1-05: the J26 journey of provider 8 (T-735 c1 and c2 run the same steps and read different logs): search
// (Q-079), Back and Forward, pager (Q-044), sort (Q-043). Every step is an action plus the URL the page ends on;
// `step(label, action, path)` is supplied by the test, which reads whatever it pins around the action.
import { appQuiet, settle } from './page.mjs'
import {
  arrow,
  openProvider,
  searchBox,
  sortToggle,
  urlIs,
} from './provider.mjs'

const P = '/data-providers/8/'

export const ID = 8
export const STEP_URLS = {
  load: P,
  swallowed: P,
  search: `${P}?q=thesis&offset=0`,
  back1: P,
  forward1: `${P}?q=thesis&offset=0`,
  back2: P,
  next: `${P}?offset=10`,
  previous: `${P}?offset=10`,
  sort: `${P}?offset=10&sort=relevance&page=1`,
  back3: `${P}?offset=10`,
  back4: P,
}

export async function journey(page, p2Env, step) {
  const ctx = await openProvider(page, p2Env, P)
  const { tracker } = ctx
  const run = async (label, action) => {
    // a render in flight would turn a client navigation into a document load (Next 10 route loader, 3.8 s)
    await appQuiet(p2Env)
    await step(
      label,
      async () => {
        await action()
        await urlIs(page, p2Env, STEP_URLS[label])
        await settle(page, tracker)
      },
      ctx
    )
  }
  await step('load', async () => {}, ctx)
  const box = searchBox(page)
  // Q-079: the first change of the box is swallowed (no URL change, no request), the next one pushes
  await run('swallowed', async () => {
    await box.fill('thesis')
    await box.press('Enter')
  })
  await run('search', () => box.press('Enter'))
  await run('back1', () => page.goBack())
  await run('forward1', () => page.goForward())
  await run('back2', () => page.goBack())
  // Q-044: Next adds 10, Previous points at the current offset (a push of the same URL: a replace)
  await run('next', () => arrow(page, 'Next').click())
  await run('previous', () => arrow(page, 'Previous').click())
  // Q-043: "recent" pushes sort=relevance, page=1, the offset stays
  await run('sort', async () => {
    await sortToggle(page).click()
    await page
      .locator('ul li p')
      .filter({ hasText: /^recent$/ })
      .click()
  })
  await run('back3', () => page.goBack())
  await run('back4', () => page.goBack())
  return ctx
}
