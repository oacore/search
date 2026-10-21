// P0-14: constants and views of the J5 journey (T-707): /search/?q=climate&page=2&sort=recent -> the first
// result's work page -> Back. Fixtures: req-P0-14 (the recorded recency page 2 and the derived answers of the
// work behind its first result, whose content is that of works-1001).
import { expect } from '../../fixtures/guard.mjs'
import { addedEntries, historyOf, rel } from './page.mjs'

export const START = '/search/?q=climate&page=2&sort=recent'
export const SEARCH_ID = 'acf43df7361f31ccae19b8c76873eccb'
// the ten results of the recorded page, in order (all have a single `display` link and no reader link)
export const RESULT_IDS = [
  80231700, 80234289, 27467543, 11556528, 80233820, 11485299, 80224613,
  27467818, 361023302, 6490824,
]
export const WORK_ID = RESULT_IDS[0]
export const WORK_PATH = `/works/${WORK_ID}/?t=${SEARCH_ID}-${WORK_ID}&search=q=climate&page=2&sort=recent`
export const HITS = '1,956,781 research outputs found'
export const WORK_TITLE =
  'Mandatory due diligence laws and climate change litigation: Bridging the corporate climate accountability gap?'

// the design MathMarkdown logs this for the KaTeX-rejected `\sb2` in the abstract of result 80224613 (T-741
// pin katex-convert, P0-10-4, Q-097): twice per hard load of the search page
export const KATEX = /^couldn`t convert string /

export async function searchView(page, p2Env) {
  const ids = await page.evaluate(() =>
    [...document.querySelectorAll('#__next a[href*="/works/"]')].map((a) => ({
      href: a.getAttribute('href'),
      text: a.textContent.trim().slice(0, 40),
    }))
  )
  return {
    url: rel(p2Env, page.url()),
    title: await page.title(),
    hits: await page.getByText(HITS).count(),
    // textContent: the page capitalises the label with CSS (innerText reads "Sort By Recent")
    sort: await page
      .getByText(/^Sort by /)
      .first()
      .textContent(),
    clearAllFilters: await page
      .getByRole('button', { name: 'Clear all filters' })
      .count(),
    resultLinks: ids,
    history: await historyOf(page, p2Env),
    addedEntries: await addedEntries(page),
    scrollY: await page.evaluate(() => Math.round(window.scrollY)),
    scrollRestoration: await page.evaluate(() => history.scrollRestoration),
  }
}

export const workView = async (page, p2Env) => ({
  url: rel(p2Env, page.url()),
  title: await page.title(),
  h1: (await page.locator('h1').first().innerText()).trim(),
  backLink: await page
    .getByRole('link', { name: 'Search results' })
    .getAttribute('href'),
  authors: await page
    .locator('li#author a')
    .evaluateAll((els) =>
      els.map((e) => [e.getAttribute('href'), e.textContent.trim()])
    ),
  doi: await page.locator('li#doi').allInnerTexts(),
  doiLabel: await page.locator('#doi-title').innerText(),
  date: (
    await page
      .locator('dd[aria-labelledby="metadata-publication-date-title"]')
      .innerText()
  ).trim(),
  publisher: (
    await page
      .locator('dd[aria-labelledby="metadata-publisher-title"]')
      .innerText()
  ).trim(),
  history: await historyOf(page, p2Env),
  addedEntries: await addedEntries(page),
})

export const expectKatexOnly = (guardLog, perLoad, loads) => {
  expect(guardLog.pageErrors).toEqual([])
  expect(guardLog.consoleErrors.every((e) => KATEX.test(e.text))).toBe(true)
  expect(guardLog.consoleErrors).toHaveLength(perLoad * loads)
}
