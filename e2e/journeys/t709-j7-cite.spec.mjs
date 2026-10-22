// T-709 (41 H, J7, R-053): the Cite modal of a work page, as it behaves today (findings/07 §3 J7 with the
// review:ui-flows §4.1 corrections):
//   - the dialog has no aria-label (nor aria-labelledby); opening it moves the focus to its Close button,
//     `aria-pressed` of "Cite" follows the open state, `body.style.overflow` is `hidden` while it is open and
//     `unset` afterwards, and closing returns the focus to "Cite";
//   - the citation is the flattened BibTeX entry `<title>, Journal: <journal>, : <year>, ISSN: <issn>` (Q-037:
//     the literal `, : ` before the year; the HTML entity of doi.org's answer stays literal);
//   - the copy icon is not focusable: clicking it copies the text (clipboard, console.log line) and shows
//     "copied", and leaves the focus on <body>, where Esc does nothing (Esc closes only with focus inside);
//     a backdrop click closes; reopening shows no "copied";
//   - a work without a DOI has no Cite button (no citation request, citations []).
// Fixtures (req-P1-04, test/fixtures/requests/P1-04.json): work 1709 = work 1001 with its DOI in upper case, so
// its two citation requests carry the recorded BibTeX answer of doi.org (I-41: the resolver keys ignore the
// Accept header, so the recorded pair of work 1001 answers both with the APA text and its modal shows only the
// heading); work 1719 = work 1001 without a DOI.
import { test } from '../fixtures/guard.mjs'
import {
  expect,
  open,
  ACTION_TIMEOUT,
  NAV_TIMEOUT,
  TEST_TIMEOUT,
} from '../lib/P1-04/page.mjs'

test.use({ navigationTimeout: NAV_TIMEOUT, actionTimeout: ACTION_TIMEOUT })
test.describe.configure({ timeout: TEST_TIMEOUT })

const TITLE =
  'Mandatory due diligence laws and climate change litigation: Bridging the corporate climate accountability gap?'
// doi.org's BibTeX: journal={Regulation &amp; Governance}; bibtex-parse-js keeps the entity as text
const CITATION = `${TITLE}, Journal: Regulation &amp; Governance, : 2023, ISSN: 1748-5991`

const pageState = (page) =>
  page.evaluate(() => {
    const a = document.activeElement
    return {
      active: a
        ? `${a.tagName.toLowerCase()} ${
            a.getAttribute('aria-label') || a.textContent.trim().slice(0, 30)
          }`
        : null,
      overflow: document.body.style.overflow,
      dialogs: document.querySelectorAll('[role="dialog"]').length,
    }
  })

test.describe('T-709 @P1 J7 Cite', () => {
  test.use({ cookieState: 'essential' })

  test('T-709 @P1 J7 work 1709: no aria-label, the flattened BibTeX text, copy, Esc only with focus inside, backdrop click, focus return', async ({
    page,
    context,
    p2Env,
    guardLog,
  }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write'], {
      origin: new URL(p2Env.baseURL).origin,
    })
    await open(page, '/works/1709/')
    await expect(page.locator('h1')).toHaveText(TITLE)
    const cite = page.getByRole('button', { name: 'Cite' })
    const dialog = page.getByRole('dialog')
    await expect(cite).toHaveAttribute('aria-pressed', 'false')
    expect(await pageState(page)).toMatchObject({ overflow: '', dialogs: 0 })

    // ---- open: focus on Close, no accessible name, overflow hidden ----
    await cite.click()
    await expect(dialog).toBeVisible()
    await expect(dialog.getByRole('button', { name: 'Close' })).toBeFocused()
    expect(await dialog.getAttribute('aria-label')).toBeNull()
    expect(await dialog.getAttribute('aria-labelledby')).toBeNull()
    await expect(dialog.getByRole('heading', { level: 2 })).toHaveText(
      'Citation'
    )
    await expect(cite).toHaveAttribute('aria-pressed', 'true')
    expect(await pageState(page)).toMatchObject({
      active: 'button Close',
      overflow: 'hidden',
      dialogs: 1,
    })
    // Q-037: one block (the BibTeX entry), the literal ", : " before the year
    const block = dialog.locator('#cite-bibtex')
    await expect(block).toHaveCount(1)
    await expect(block.locator('[class*="column-text"]')).toHaveText(CITATION)
    await expect(dialog.getByText('copied', { exact: true })).toHaveCount(0)

    // ---- Esc with the focus inside closes; focus back on Cite ----
    await page.keyboard.press('Escape')
    await expect(dialog).toHaveCount(0)
    await expect(cite).toBeFocused()
    await expect(cite).toHaveAttribute('aria-pressed', 'false')
    expect(await pageState(page)).toMatchObject({
      active: 'button Cite',
      overflow: 'unset',
      dialogs: 0,
    })

    // ---- copy: the icon is not focusable; clipboard = the text; "copied" ----
    await cite.click()
    await expect(dialog.getByRole('button', { name: 'Close' })).toBeFocused()
    const icon = block.locator('svg[role="img"]')
    await expect(icon).toHaveCount(1)
    expect(await icon.getAttribute('tabindex')).toBeNull()
    await icon.click()
    await expect(dialog.getByText('copied', { exact: true })).toBeVisible()
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(
      CITATION
    )
    expect(
      guardLog.console
        .filter((c) => c.type === 'log' && c.text.startsWith('Copying'))
        .map((c) => c.text)
    ).toEqual([`Copying to clipboard: ${CITATION}`])
    // the focus left the dialog for <body>: Esc does nothing
    expect((await pageState(page)).active).toMatch(/^body /)
    await page.keyboard.press('Escape')
    await expect(dialog).toBeVisible()
    await expect(dialog.getByText('copied', { exact: true })).toBeVisible()
    expect(await pageState(page)).toMatchObject({
      overflow: 'hidden',
      dialogs: 1,
    })

    // ---- backdrop click (beside the dialog, below the header) closes ----
    const box = await dialog.boundingBox()
    await page.mouse.click(
      Math.max(5, Math.floor(box.x / 2)),
      Math.floor(box.y + box.height / 2)
    )
    await expect(dialog).toHaveCount(0)
    await expect(cite).toBeFocused()
    expect(await pageState(page)).toMatchObject({
      active: 'button Cite',
      overflow: 'unset',
    })

    // ---- reopen: "copied" is gone; the Close button closes ----
    await cite.click()
    await expect(dialog.locator('#cite-bibtex')).toHaveCount(1)
    await expect(dialog.getByText('copied', { exact: true })).toHaveCount(0)
    await dialog.getByRole('button', { name: 'Close' }).click()
    await expect(dialog).toHaveCount(0)
    await expect(cite).toHaveAttribute('aria-pressed', 'false')
    expect(await pageState(page)).toMatchObject({ overflow: 'unset' })
    expect(page.url()).toBe(`${new URL(p2Env.baseURL).origin}/works/1709/`)
  })

  test('T-709 @P1 J7 work 1719 without a DOI: no Cite button, citations []', async ({
    page,
  }) => {
    await open(page, '/works/1719/')
    await expect(page.locator('h1')).toHaveText(TITLE)
    await expect(page.getByRole('heading', { name: 'Abstract' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Cite' })).toHaveCount(0)
    expect(
      await page.evaluate(
        () => window.__NEXT_DATA__.props.pageProps.data.citations
      )
    ).toEqual([])
    // the DOI row of the metadata list is absent with the DOI
    await expect(page.locator('#doi-title')).toHaveCount(0)
  })
})
