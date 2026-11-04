// T-804 (41 I; Q-085): keyboard smoke of every page type and every reachable design Modal, as the app behaves
// today (T-736 is the longer J29 journey on top of it). Desktop 1440x900, cookie state `essential`.
//   c1  Tab order, Esc per modal, focus return:
//       - the whole Tab order of each page from the top until the focus leaves the document (/search/?q=climate,
//         /works/1001/, /outputs/2001/, /data-providers/, /data-providers/86/, /outputs/update/ and the "Uh-oh"
//         page /works/4040/): one JSON baseline per page (each stop: tag, role, aria-label, text, icon, id, link
//         target with the stack origin removed), recorded with `npm run e2e:record -- --run <id> --provisional
//         --project chromium e2e/journeys/t804-keyboard-smoke.spec.mjs` (host baseline), deep-equal otherwise;
//       - Esc per modal: Cite closes (the focus is inside: the X button); the `hideManually` modals (Report type,
//         Report form, Report success, CSV download) ignore it (Q-085);
//       - focus return: closing Cite (Esc, Enter on X) and Report type (its Close) and CSV (Cancel) puts the focus
//         back on the button that opened it;
//   c2  failures as baseline (the keyboard gaps of today, pinned so that a change shows): the controls a pointer
//       can use and the keyboard cannot reach (`cursor: pointer`, not focusable, no focusable ancestor or
//       descendant: the six filter pills, "How to search?" and the sort box on the search page, the sort box of
//       the provider page; inside the dialogs the two Report type cards and the three CSV size cards), the Tab
//       cycle each dialog traps (Cite: only X; Report type and Report form before a role is chosen: only Close,
//       Continue is disabled, so a report cannot be made by keyboard), the focus that ends on <body> when the
//       Report form or the success modal closes (their opener is gone), and the focus that a backdrop click
//       moves to <body> inside a hideManually modal (the next Tab brings it back).
import { test, expect, open, setFixedTime } from '../lib/P1-07/page.mjs'
import { downloadButton, csvTitle } from '../lib/P0-17/locators.mjs'
import { expectJsonBaseline } from '../lib/P1-06/baseline.mjs'

test.use({
  cookieState: 'essential',
  actionTimeout: 60000,
  viewport: { width: 1440, height: 900 },
})
test.describe.configure({ timeout: 600000 })

const PAGES = [
  ['search', '/search/?q=climate', { bar: true, filters: true }],
  ['works', '/works/1001/', {}],
  ['outputs', '/outputs/2001/', {}],
  ['data-providers', '/data-providers/', { bar: /^Search data providers$/ }],
  ['provider', '/data-providers/86/', {}],
  ['update', '/outputs/update/', {}],
  ['uh-oh', '/works/4040/', {}],
]

// the focused element as a keyboard user can tell it (T-736's view); 'body' when nothing is focused
const focused = (page, p2Env) =>
  page.evaluate((origin) => {
    const e = document.activeElement
    if (!e || e === document.body) return 'body'
    const use = e.querySelector('use')
    const href = e.getAttribute('href')
    const d = {
      tag: e.tagName.toLowerCase(),
      role: e.getAttribute('role'),
      label: e.getAttribute('aria-label'),
      text: (e.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 40),
      icon: use ? use.getAttribute('href').split('#')[1] : null,
      id: e.id,
      href: href ? href.split(origin).join('') : null,
    }
    return Object.fromEntries(Object.entries(d).filter(([, v]) => v))
  }, new URL(p2Env.baseURL).origin)

const nameOf = (page) =>
  page.evaluate(() => {
    const e = document.activeElement
    if (!e || e === document.body) return 'body'
    return e.getAttribute('aria-label') || e.textContent.trim()
  })

// Tab n times inside a dialog: the names of the stops
async function cycle(page, n = 4) {
  const out = []
  for (let i = 0; i < n; i++) {
    await page.keyboard.press('Tab')
    out.push(await nameOf(page))
  }
  return out
}

// pointer-only controls: shown, `cursor: pointer`, neither it nor an ancestor is in the Tab order and it holds
// no focusable element; only the outermost of nested ones; within `scope` (a dialog) or the whole page
const pointerOnly = (page, scope = null) =>
  page.evaluate((sel) => {
    const stem = (c) => c.replace(/(-|__)[\w-]{5}$/, '')
    const root = sel ? document.querySelector(sel) : document.body
    const tabbable = (el) =>
      el.tabIndex >= 0 && !el.disabled && el.getClientRects().length > 0
    const pointer = (el) => getComputedStyle(el).cursor === 'pointer'
    const out = []
    for (const el of root.querySelectorAll('*')) {
      if (!pointer(el) || el.getClientRects().length === 0) continue
      if (getComputedStyle(el).visibility === 'hidden') continue
      let a = el
      let reachable = false
      while (a && a !== document.body) {
        if (tabbable(a)) reachable = true
        a = a.parentElement
      }
      if (reachable) continue
      if (el.querySelector('a[href],button,input,select,textarea,[tabindex]'))
        continue
      const p = el.parentElement
      if (p && p !== root && pointer(p) && !tabbable(p)) continue
      out.push(
        `${el.tagName.toLowerCase()}.${[...el.classList]
          .map(stem)
          .join('.')} ${(el.textContent || '')
          .replace(/\s+/g, ' ')
          .trim()
          .slice(0, 30)}`
      )
    }
    return out
  }, scope)

// ---------- c1: Tab order per page ----------

test.describe('T-804 c1 Tab order', () => {
  for (const [id, path, opts] of PAGES)
    test(`T-804 c1 @P1 ${id}: the Tab order from the top to the end of the page = B0`, async ({
      page,
      p2Env,
    }) => {
      await setFixedTime(page)
      await open(page, path, opts)
      const stops = []
      for (let i = 0; i < 400; i++) {
        await page.keyboard.press('Tab')
        const f = await focused(page, p2Env)
        if (f === 'body') break
        stops.push(f)
      }
      expect(stops.length, 'the Tab order ends within 400 stops').toBeLessThan(
        400
      )
      // every page starts with the header's logo link
      expect(stops[0]).toEqual({
        tag: 'a',
        text: 'CORECOnnectingREpositories',
        icon: 'core-symbol',
        href: 'https://core.ac.uk/',
      })
      await expectJsonBaseline(`t804-c1-tab-${id}`, { route: path, stops })
    })
})

// ---------- c1: Esc per modal and focus return ----------

test.describe('T-804 c1 Esc and focus return', () => {
  test('T-804 c1 @P1 Cite: Esc closes with the focus inside, Enter on X closes, the focus returns to Cite', async ({
    page,
  }) => {
    await setFixedTime(page)
    await open(page, '/outputs/2001/')
    const cite = page.getByRole('button', { name: 'Cite' })
    const dialog = page.getByRole('dialog')
    await cite.focus()
    await page.keyboard.press('Enter')
    await expect(dialog).toBeVisible()
    expect(await nameOf(page)).toBe('Close')
    await page.keyboard.press('Escape')
    await expect(dialog).toHaveCount(0)
    await expect(cite).toBeFocused()
    await page.keyboard.press('Enter')
    await expect(dialog).toBeVisible()
    expect(await nameOf(page)).toBe('Close')
    await page.keyboard.press('Enter')
    await expect(dialog).toHaveCount(0)
    await expect(cite).toBeFocused()
  })

  test('T-804 c1 @P1 Report: Esc does nothing in the type, form and success modals; Close returns the focus to Report from the type modal (Q-085)', async ({
    page,
  }) => {
    await setFixedTime(page)
    await open(page, '/outputs/2001/')
    const report = page.getByRole('button', { name: 'Report', exact: true })
    await report.focus()
    await page.keyboard.press('Enter')
    const type = page.locator('[aria-label="Problem-type-modal"]').first()
    await expect(type).toBeVisible()
    expect(await nameOf(page)).toBe('Close')
    await page.keyboard.press('Escape')
    await expect(type).toBeVisible()
    await page.keyboard.press('Enter')
    await expect(type).toHaveCount(0)
    await expect(report).toBeFocused()

    // the form and the success modal (the type is chosen by pointer: c2)
    await page.keyboard.press('Enter')
    await expect(type).toBeVisible()
    await type.getByText('The document should not be published').click()
    await type.getByRole('button', { name: 'Continue' }).focus()
    await page.keyboard.press('Enter')
    const form = page.locator('[aria-label="Problem-form-modal"]').first()
    await expect(form).toBeVisible()
    expect(await nameOf(page)).toBe('Close')
    await page.keyboard.press('Escape')
    await expect(form).toBeVisible()
    await form.getByText('Author', { exact: true }).click()
    await form.getByPlaceholder('e.g. John Doe').fill('Test Reporter')
    await form
      .getByPlaceholder('e.g. john.doe@ac.ck.uk')
      .fill('reporter@localhost')
    await form.locator('textarea').fill('report-ok')
    await form.getByRole('button', { name: 'Submit' }).focus()
    await page.keyboard.press('Enter')
    const success = page.locator('[aria-label="Success-type-modal"]').first()
    await expect(success.getByText('Thank you!')).toBeVisible()
    expect(await nameOf(page)).toBe('got it')
    await page.keyboard.press('Escape')
    await expect(success).toBeVisible()
  })

  test('T-804 c1 @P1 CSV download: Esc does nothing, Space on Cancel closes, the focus returns to the toolbar button (Q-085)', async ({
    page,
  }) => {
    await setFixedTime(page)
    await open(page, '/search/?q=climate', { bar: true, filters: true })
    const download = downloadButton(page)
    await download.focus()
    await page.keyboard.press('Enter')
    await expect(csvTitle(page)).toBeVisible()
    const dialog = page.getByRole('dialog')
    expect(await nameOf(page)).toBe('Cancel')
    await page.keyboard.press('Escape')
    await expect(dialog).toBeVisible()
    await page.keyboard.press('Space')
    await expect(dialog).toHaveCount(0)
    await expect(download).toBeFocused()
  })
})

// ---------- c2: failures as baseline ----------

test.describe('T-804 c2 keyboard gaps', () => {
  const POINTER_ONLY = {
    'search': [
      'span.styles-addon.styles-append.select-append-text How to search?',
      'div.styles_bar-item field',
      'div.styles_bar-item year',
      'div.styles_bar-item type',
      'div.styles_bar-item author',
      'div.styles_bar-item language',
      'div.styles_bar-item publisher',
      'div.sort_sort-box Sort by relevance',
    ],
    // AD-158: pointer-only today as well; the test counts an ancestor with tabIndex >= 0, and the <a> card and
    // dropdown content without href reported 0 before CS-ESC-1 and CS-ESC-4 (W5.5) made them a span and a div
    'works': [
      'div.styles_header-wrapper.styles_header-wrapper-clickable Stirling Online Research Repos',
      'svg.icon-icon.card-dropdown_icon-copy ',
      'div.styles_header-wrapper.styles_header-wrapper-clickable Stirling Online Research Repos',
      'svg.icon-icon.card-dropdown_icon-copy ',
      'div.styles_header-wrapper.styles_header-wrapper-clickable Crossref',
    ],
    'outputs': [
      'div.styles_header-wrapper Open Research Online (The Open',
      'svg.icon-icon.card-dropdown_icon-copy ',
    ],
    'data-providers': [],
    'provider': ['div.sort_sort-box Sort by recent'],
    'update': [],
    'uh-oh': [],
  }

  test('T-804 c2 @P1 the pointer-only controls of each page', async ({
    page,
  }) => {
    const found = {}
    for (const [id, path, opts] of PAGES) {
      await setFixedTime(page)
      await open(page, path, opts)
      found[id] = await pointerOnly(page)
    }
    expect(found).toEqual(POINTER_ONLY)
  })

  test('T-804 c2 @P1 the dialogs: trapped Tab cycles, pointer-only cards, no keyboard path to a report, focus back on Report after closing the form or the success modal, lost to <body> on a backdrop click', async ({
    page,
  }) => {
    await setFixedTime(page)
    await open(page, '/outputs/2001/')
    // Cite: the X button is the only stop
    await page.getByRole('button', { name: 'Cite' }).focus()
    await page.keyboard.press('Enter')
    await expect(page.getByRole('dialog')).toBeVisible()
    expect(await cycle(page)).toEqual(['Close', 'Close', 'Close', 'Close'])
    expect(await pointerOnly(page, '[role="dialog"]')).toEqual([])
    await page.keyboard.press('Escape')
    await expect(page.getByRole('dialog')).toHaveCount(0)

    // Report type: only Close; the cards are pointer-only and Continue stays disabled
    const report = page.getByRole('button', { name: 'Report', exact: true })
    await report.focus()
    await page.keyboard.press('Enter')
    const type = page.locator('[aria-label="Problem-type-modal"]').first()
    await expect(type).toBeVisible()
    expect(await cycle(page)).toEqual(['Close', 'Close', 'Close', 'Close'])
    expect(await pointerOnly(page, '[role="dialog"]')).toEqual([
      'div.card-container.card-outlined.styles_card-modal.styles_card-modal-report-type The document should not be pub',
      'div.card-container.card-outlined.styles_card-modal.styles_card-modal-report-type The document is outdated',
    ])
    await expect(type.getByRole('button', { name: 'Continue' })).toBeDisabled()
    // a backdrop click moves the focus out of the dialog to <body>; the next Tab brings it back
    await page.mouse.click(20, 600)
    await expect(type).toBeVisible()
    expect(await nameOf(page)).toBe('body')
    await page.keyboard.press('Tab')
    expect(await nameOf(page)).toBe('Close')

    // Report form before a role is chosen: only Close; closing it puts the focus back on Report (AD-171)
    await type.getByText('The document should not be published').click()
    await type.getByRole('button', { name: 'Continue' }).click()
    const form = page.locator('[aria-label="Problem-form-modal"]').first()
    await expect(form).toBeVisible()
    expect(await cycle(page)).toEqual(['Close', 'Close', 'Close', 'Close'])
    await form.getByRole('button', { name: 'Close', exact: true }).focus()
    await page.keyboard.press('Enter')
    await expect(page.getByRole('dialog')).toHaveCount(0)
    expect(await nameOf(page)).toBe('Report') // AD-171

    // the success modal: only "got it"; closing it puts the focus back on Report (AD-171)
    await report.click()
    await type.getByText('The document should not be published').click()
    await type.getByRole('button', { name: 'Continue' }).click()
    await expect(form).toBeVisible()
    await form.getByText('Author', { exact: true }).click()
    await form.getByPlaceholder('e.g. John Doe').fill('Test Reporter')
    await form
      .getByPlaceholder('e.g. john.doe@ac.ck.uk')
      .fill('reporter@localhost')
    await form.locator('textarea').fill('report-ok')
    await form.getByRole('button', { name: 'Submit' }).click()
    const success = page.locator('[aria-label="Success-type-modal"]').first()
    await expect(success.getByText('Thank you!')).toBeVisible()
    expect(await cycle(page)).toEqual(['got it', 'got it', 'got it', 'got it'])
    await page.keyboard.press('Enter')
    await expect(page.getByRole('dialog')).toHaveCount(0)
    expect(await nameOf(page)).toBe('Report') // AD-171

    // CSV download: Download and Cancel; the three size cards are pointer-only
    await setFixedTime(page)
    await open(page, '/search/?q=climate', { bar: true, filters: true })
    await downloadButton(page).focus()
    await page.keyboard.press('Enter')
    await expect(csvTitle(page)).toBeVisible()
    expect(await cycle(page)).toEqual([
      'Download',
      'Cancel',
      'Download',
      'Cancel',
    ])
    expect(await pointerOnly(page, '[role="dialog"]')).toEqual([
      'div.card-container.card-outlined.fieldset-box-item.fieldset-box-item-active Current page',
      'div.card-container.card-outlined.fieldset-box-item Top 100 results',
      'div.card-container.card-outlined.fieldset-box-item All the results (up to 1,000)',
    ])
  })
})
