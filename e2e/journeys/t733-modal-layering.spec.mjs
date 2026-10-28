// T-733 (41 H; Q-085, header unmasked; R-075, R-087): the layering of the design Modal (modal.jsx of
// @oacore/design) as the app behaves today, pinned before the design moves (W5 edits, 7.2.DU-06):
//   - the overlay root is fixed over the whole viewport at z-index 1030 (`--app-bar-fixed-z-index` + 10) and the
//     sticky header stays above it at z-index 10000: the header is never masked, every point of its band hits
//     the header while a modal is open, and a click (or a tap) there reaches the header, so a click over the logo
//     navigates away to https://core.ac.uk/ with the modal still open (Q-085);
//   - a modal with `onClose` (Cite) has the X button, closes on a backdrop click and on Esc, but Esc only when the
//     focus is inside it (the key handler sits on the overlay): Esc with the focus on <body> does nothing;
//   - the `hideManually` modals (Report type, CSV download) have no X and ignore Esc and backdrop clicks;
//   - `body.style.overflow` is `hidden` while a modal is open and ends `unset` (not the empty string of before).
// Touch (41 §2.6 Touch row): 375x812 with `hasTouch` and `isMobile`, the same facts by tap.
// The navigation to https://core.ac.uk/ is answered by a one-line page of this test (the guard aborts that host).
import { test, expect, open, setFixedTime } from '../lib/P1-07/page.mjs'
import { downloadButton, csvTitle } from '../lib/P0-17/locators.mjs'

test.use({ cookieState: 'essential', actionTimeout: 60000 })
test.describe.configure({ timeout: 600000 })

const DESKTOP = { width: 1440, height: 900 }
const MOBILE = { width: 375, height: 812 }
const CORE = 'https://core.ac.uk/'

// the layers while a dialog is open (or not): the header and the overlay root (the first fixed ancestor of the
// dialog) with their computed position and z-index and their box, what each point of the header band hits
// (nine points at the band's vertical middle, from the left edge to the right edge), what a point just below
// the header hits, the X buttons of the dialog and the body overflow
const layering = (page) =>
  page.evaluate(() => {
    const round = (v) => Math.round(v * 100) / 100
    const box = (el) => {
      const b = el.getBoundingClientRect()
      return [b.x, b.y, b.width, b.height].map(round)
    }
    const header = document.querySelector('header#header')
    const dialog = document.querySelector('[role="dialog"]')
    let overlay = dialog
    while (overlay && getComputedStyle(overlay).position !== 'fixed')
      overlay = overlay.parentElement
    const layerAt = (x, y) => {
      const e = document.elementFromPoint(x, y)
      if (!e) return null
      if (header.contains(e)) return 'header'
      if (dialog && dialog.contains(e)) return 'dialog'
      if (overlay && overlay.contains(e)) return 'overlay'
      return 'page'
    }
    const hb = header.getBoundingClientRect()
    const band = [...Array(9)].map((_, i) =>
      layerAt(Math.min(hb.width - 1, (hb.width * i) / 8), hb.y + hb.height / 2)
    )
    const logo = header.querySelector(`a[href="https://core.ac.uk/"]`)
    const lb = logo.getBoundingClientRect()
    const hs = getComputedStyle(header)
    return {
      header: { position: hs.position, zIndex: hs.zIndex, box: box(header) },
      overlay: overlay
        ? {
            position: getComputedStyle(overlay).position,
            zIndex: getComputedStyle(overlay).zIndex,
            box: box(overlay),
            background: getComputedStyle(overlay).backgroundColor,
          }
        : null,
      headerBand: band,
      logo: layerAt(lb.x + lb.width / 2, lb.y + lb.height / 2),
      belowHeader: layerAt(5, hb.bottom + 5),
      closeButtons: dialog
        ? dialog.querySelectorAll('button[aria-label="Close"]').length
        : null,
      overflow: document.body.style.overflow,
    }
  })

// a point of the overlay outside the dialog and below the header (the backdrop), scanned upwards from the
// bottom edge along the left and the right edge of the viewport
const backdropPoint = (page) =>
  page.evaluate(() => {
    const header = document.querySelector('header#header')
    const dialog = document.querySelector('[role="dialog"]')
    const bottom = header.getBoundingClientRect().bottom
    for (const x of [5, window.innerWidth - 5])
      for (let y = window.innerHeight - 5; y > bottom; y -= 10) {
        const e = document.elementFromPoint(x, y)
        if (e && !dialog.contains(e) && !header.contains(e)) return { x, y }
      }
    return null
  })

const logoCenter = (page) =>
  page.evaluate(() => {
    const b = document
      .querySelector('header#header a[href="https://core.ac.uk/"]')
      .getBoundingClientRect()
    return { x: b.x + b.width / 2, y: b.y + b.height / 2 }
  })

// the one page the logo navigation lands on
const answerCore = (page) =>
  page.route(CORE, (route) =>
    route.fulfill({
      status: 200,
      contentType: 'text/html',
      body: '<!doctype html><title>core.ac.uk</title><p>core.ac.uk</p>',
    })
  )

const focusedText = (page) =>
  page.evaluate(() => {
    const e = document.activeElement
    if (!e || e === document.body) return 'body'
    return e.getAttribute('aria-label') || e.textContent.trim()
  })

// the facts every open modal shares (Q-085)
const OPEN_DESKTOP = {
  header: {
    position: 'sticky',
    zIndex: '10000',
    box: [0, 0, 1440, 51.86],
  },
  overlay: {
    position: 'fixed',
    zIndex: '1030',
    box: [0, 0, 1440, 900],
    background: 'rgba(0, 0, 0, 0.5)',
  },
  headerBand: Array(9).fill('header'),
  logo: 'header',
  belowHeader: 'overlay',
  overflow: 'hidden',
}

test.describe('T-733 @P1 modal layering, desktop', () => {
  test.use({ viewport: DESKTOP })

  test('T-733 @P1 Cite modal: the header stays above the overlay and unmasked; Esc only with the focus inside, a backdrop click closes, overflow ends unset (Q-085)', async ({
    page,
  }) => {
    await setFixedTime(page)
    await open(page, '/outputs/2001/')
    expect(await layering(page)).toMatchObject({
      overlay: null,
      closeButtons: null,
      overflow: '',
      logo: 'header',
    })
    const cite = page.getByRole('button', { name: 'Cite' })
    const dialog = page.getByRole('dialog')
    await cite.click()
    await expect(page.getByRole('heading', { name: 'Citation' })).toBeVisible()
    expect(await layering(page)).toEqual({ ...OPEN_DESKTOP, closeButtons: 1 })
    expect(await focusedText(page)).toBe('Close')

    // Esc needs the focus inside: with the focus on <body> it does nothing
    await page.evaluate(() => document.activeElement.blur())
    expect(await focusedText(page)).toBe('body')
    await page.keyboard.press('Escape')
    await expect(dialog).toBeVisible()
    // Tab brings the focus back into the dialog (focus lock), and then Esc closes it
    await page.keyboard.press('Tab')
    expect(await focusedText(page)).toBe('Close')
    await page.keyboard.press('Escape')
    await expect(dialog).toHaveCount(0)
    expect((await layering(page)).overflow).toBe('unset')
    await expect(cite).toBeFocused()

    // a click on the backdrop (the overlay outside the dialog) closes it
    await cite.click()
    await expect(dialog).toBeVisible()
    const p = await backdropPoint(page)
    expect(p).not.toBeNull()
    await page.mouse.click(p.x, p.y)
    await expect(dialog).toHaveCount(0)
    expect((await layering(page)).overflow).toBe('unset')
  })

  test('T-733 @P1 Cite modal: a click over the logo reaches the header and navigates away with the modal open (Q-085)', async ({
    page,
  }) => {
    await setFixedTime(page)
    await open(page, '/outputs/2001/')
    await page.getByRole('button', { name: 'Cite' }).click()
    await expect(page.getByRole('dialog')).toBeVisible()
    await answerCore(page)
    const at = await logoCenter(page)
    await Promise.all([page.waitForURL(CORE), page.mouse.click(at.x, at.y)])
    await expect(page).toHaveTitle('core.ac.uk')
  })

  test('T-733 @P1 hideManually modals: Report type and CSV download have no X and ignore Esc and backdrop clicks; the header stays above and unmasked (Q-085)', async ({
    page,
  }) => {
    await setFixedTime(page)
    await open(page, '/outputs/2001/')
    const report = page.getByRole('button', { name: 'Report', exact: true })
    await report.click()
    const type = page.locator('[aria-label="Problem-type-modal"]').first()
    await expect(type).toBeVisible()
    expect(await layering(page)).toEqual({ ...OPEN_DESKTOP, closeButtons: 0 })
    await page.keyboard.press('Escape')
    await expect(type).toBeVisible()
    let p = await backdropPoint(page)
    expect(p).not.toBeNull()
    await page.mouse.click(p.x, p.y)
    await expect(type).toBeVisible()
    expect((await layering(page)).overflow).toBe('hidden')
    // only its own Close button closes it
    await type.getByRole('button', { name: 'Close', exact: true }).click()
    await expect(type).toHaveCount(0)
    expect((await layering(page)).overflow).toBe('unset')

    await open(page, '/search/?q=climate', { bar: true, filters: true })
    await downloadButton(page).click()
    await expect(csvTitle(page)).toBeVisible()
    const csv = page.getByRole('dialog')
    expect(await layering(page)).toEqual({ ...OPEN_DESKTOP, closeButtons: 0 })
    await page.keyboard.press('Escape')
    await expect(csv).toBeVisible()
    p = await backdropPoint(page)
    expect(p).not.toBeNull()
    await page.mouse.click(p.x, p.y)
    await expect(csv).toBeVisible()
    expect((await layering(page)).overflow).toBe('hidden')
    // the header is clickable above the hideManually modal too: the logo navigates away
    await answerCore(page)
    const at = await logoCenter(page)
    await Promise.all([page.waitForURL(CORE), page.mouse.click(at.x, at.y)])
  })
})

test.describe('T-733 @P1 modal layering, touch 375x812', () => {
  test.use({ viewport: MOBILE, hasTouch: true, isMobile: true })

  test('T-733 @P1 touch: the header stays above the overlay; a tap on the backdrop closes the Cite modal, a tap over the logo navigates away (Q-085)', async ({
    page,
  }) => {
    await setFixedTime(page)
    await open(page, '/outputs/2001/')
    const cite = page.getByRole('button', { name: 'Cite' })
    const dialog = page.getByRole('dialog')
    await cite.tap()
    await expect(dialog).toBeVisible()
    const facts = await layering(page)
    expect(facts).toMatchObject({
      header: { position: 'sticky', zIndex: '10000' },
      overlay: {
        position: 'fixed',
        zIndex: '1030',
        background: 'rgba(0, 0, 0, 0.5)',
      },
      headerBand: Array(9).fill('header'),
      logo: 'header',
      closeButtons: 1,
      overflow: 'hidden',
    })
    expect(facts.overlay.box).toEqual([0, 0, 375, 812])
    const p = await backdropPoint(page)
    expect(p).not.toBeNull()
    await page.touchscreen.tap(p.x, p.y)
    await expect(dialog).toHaveCount(0)
    expect((await layering(page)).overflow).toBe('unset')

    await cite.tap()
    await expect(dialog).toBeVisible()
    await answerCore(page)
    const at = await logoCenter(page)
    await Promise.all([page.waitForURL(CORE), page.touchscreen.tap(at.x, at.y)])
  })
})
