// T-710 (41 H, J8, Q-063, R-021): the full-text card and the provider rows of a work page, as they behave today
// (findings/07 §3 J8, §2.9-§2.10, review:ui-flows §4.1 J8):
//   - "Open in the Core reader" is an anchor to the reader URL without `target` (same tab);
//   - "Download PDF" is an anchor with `download` and `target=_blank` but no `href` (Q-063): its click handler
//     appends a transient `<a href=<download URL> target=_blank rel="noopener noreferrer">` to <body>, clicks it
//     and removes it, so the PDF opens in a new page without opener or referrer; the server HTML has no href either;
//   - a provider row of "Available Versions" navigates the window to //core.ac.uk/data-providers/<id>
//     (`window.location.href`, scheme of the page);
//   - "Download from data provider" is an anchor only when the CORE download URL contains "core.ac.uk"; else it is
//     the disabled-looking button with the popover "We don't have a full text link from this data provider".
//     The anchor's href is the version's `sourceFulltextUrls` joined without a separator, its first `http:`
//     made `https:` (`templates/output/card-dropdown.jsx` httpsValidate), and its aria-labelledby /
//     aria-describedby name ids that no element has.
// The fixtures give `https://core.ac.uk/...` links, which the resolver serves on the gateway origin (40 §2.4), so
// in this stack the recorded download URLs do not contain "core.ac.uk" and every row of work 1001 shows the
// popover button, unlike production (P1-04 issue). Work 1710 (req-P1-04: work 1001 whose first version's
// download link has the http scheme, which the resolver leaves on core.ac.uk) reaches the core-hosted branch.
// The download page and core.ac.uk are other services: the test answers the new page itself and stops the
// provider navigation at the network (both are counted).
import { test } from '../fixtures/guard.mjs'
import {
  expect,
  open,
  rel,
  ACTION_TIMEOUT,
  NAV_TIMEOUT,
  TEST_TIMEOUT,
} from '../lib/P1-04/page.mjs'

test.use({ navigationTimeout: NAV_TIMEOUT, actionTimeout: ACTION_TIMEOUT })
test.describe.configure({ timeout: TEST_TIMEOUT })

const READER = '/reader/566708785'
const DOWNLOAD = '/download/566708785.pdf'
const PROVIDERS = [
  ['Stirling Online Research Repository (RIOXX)', 10883],
  ['Stirling Online Research Repository', 107],
  ['Crossref', 4786],
]
const NO_LINK = "We don't have a full text link from this data provider"
// sourceFulltextUrls of the first version of work 1001 (the recorded dspace PDF and the DOI link), joined
const JOINED_FULLTEXT =
  'https://dspace.stir.ac.uk/retrieve/6842e106-fee1-4f6f-be59-5ef0f5e17459/Regulation%20%20%20Governance%20-%202023%20-%20Rajavuori%20-%20Mandatory%20due%20diligence%20laws%20and%20climate%20change%20litigation%20%20Bridging%20the.pdfhttps://doi.org/10.1111/rego.12518'

// the anchors the page clicks programmatically (the transient download anchor)
const spyAnchorClicks = (page) =>
  page.addInitScript(() => {
    window.__p104anchors = []
    const orig = HTMLAnchorElement.prototype.click
    HTMLAnchorElement.prototype.click = function click(...args) {
      const entry = {
        href: this.getAttribute('href'),
        target: this.getAttribute('target'),
        rel: this.getAttribute('rel'),
        parent: this.parentElement ? this.parentElement.tagName : null,
      }
      const r = orig.apply(this, args)
      entry.connectedAfterClick = this.isConnected
      window.__p104anchors.push(entry)
      return r
    }
  })

test.describe('T-710 @P1 J8 full text and provider links', () => {
  test.use({ cookieState: 'essential' })

  test('T-710 @P1 J8 works 1001: reader link without target; Download PDF without href (Q-063) opens the PDF in a new page through a transient anchor', async ({
    page,
    context,
    p2Env,
    request,
  }) => {
    const origin = new URL(p2Env.baseURL).origin
    // server HTML: the reader anchor has an href and no target, the Download PDF anchor no href
    const html = await (await request.get('/works/1001/')).text()
    // innermost anchors (the card itself is an anchor around them, Q-072)
    const anchorOf = (text) =>
      [...html.matchAll(/<a\b([^>]*)>((?:(?!<\/?a\b).)*?)<\/a>/gs)]
        .filter((m) => m[2].replace(/<[^>]+>/g, '').trim() === text)
        .map((m) => m[1])
    const [readerAttrs] = anchorOf('Open in the Core reader')
    expect(readerAttrs).toContain(`href="${origin}${READER}"`)
    expect(readerAttrs).not.toContain('target=')
    const [pdfAttrs] = anchorOf('Download PDF')
    expect(pdfAttrs).toContain('target="_blank"')
    expect(pdfAttrs).toContain('download=""')
    expect(pdfAttrs).not.toContain('href=')

    // the download URL is another service (core.ac.uk in production): the new page is answered here
    const downloads = []
    await context.route(
      (u) => u.origin === origin && u.pathname === DOWNLOAD,
      (route) => {
        downloads.push({
          url: route.request().url(),
          navigation: route.request().isNavigationRequest(),
        })
        return route.fulfill({
          status: 200,
          contentType: 'text/html',
          body: '<!doctype html><title>download</title>',
        })
      }
    )
    await spyAnchorClicks(page)
    await open(page, '/works/1001/')

    const reader = page.locator('a', {
      hasText: /^Open in the Core reader\s*$/,
    })
    await expect(reader).toHaveCount(1)
    await expect(reader).toHaveAttribute('href', `${origin}${READER}`)
    expect(await reader.getAttribute('target')).toBeNull()
    const pdf = page.locator('a[download]', { hasText: 'Download PDF' })
    await expect(pdf).toHaveCount(1)
    expect(await pdf.getAttribute('href')).toBeNull()
    await expect(pdf).toHaveAttribute('target', '_blank')

    const [popup] = await Promise.all([
      context.waitForEvent('page', { timeout: NAV_TIMEOUT }),
      pdf.click(),
    ])
    await popup.waitForLoadState('load')
    expect(popup.url()).toBe(`${origin}${DOWNLOAD}`)
    // rel="noopener noreferrer": the new page has no opener and no referrer
    expect(
      await popup.evaluate(() => ({
        opener: window.opener,
        referrer: document.referrer,
      }))
    ).toEqual({ opener: null, referrer: '' })
    expect(downloads).toEqual([
      { url: `${origin}${DOWNLOAD}`, navigation: true },
    ])
    expect(await page.evaluate(() => window.__p104anchors)).toEqual([
      {
        href: `${origin}${DOWNLOAD}`,
        target: '_blank',
        rel: 'noopener noreferrer',
        parent: 'BODY',
        connectedAfterClick: false,
      },
    ])
    // the visible anchor still has no href; the work page stays
    expect(await pdf.getAttribute('href')).toBeNull()
    expect(rel(p2Env, page.url())).toBe('/works/1001/')
    await popup.close()
  })

  test('T-710 @P1 J8 works 1001 Available Versions: a provider row navigates to //core.ac.uk/data-providers/<id>; Download from data provider is the popover button', async ({
    page,
    context,
    p2Env,
  }) => {
    // core.ac.uk is another service: the navigation is recorded and stopped at the network
    const navigations = []
    await context.route(
      (u) =>
        u.hostname === 'core.ac.uk' &&
        u.pathname.startsWith('/data-providers/'),
      (route) => {
        navigations.push({
          url: route.request().url(),
          navigation: route.request().isNavigationRequest(),
          mainFrame: route.request().frame() === page.mainFrame(),
        })
        return route.abort('aborted')
      }
    )
    await open(page, '/works/1001/')
    const versions = page
      .getByRole('heading', { name: 'Available Versions' })
      .locator('xpath=..')
    // the card's own title is a level-3 heading too
    await expect(versions.getByRole('heading', { level: 3 })).toHaveText([
      'Available Versions',
      ...PROVIDERS.map(([name]) => name),
    ])

    // "Download from data provider": a button outside any anchor on every row, with the popover text
    const dl = versions.getByRole('button', {
      name: 'Download from data provider',
    })
    await expect(dl).toHaveCount(3)
    expect(
      await dl.evaluateAll((els) =>
        els.map((b) => Boolean(b.closest('a[href]')))
      )
    ).toEqual([false, false, false])
    await dl.first().hover()
    await expect(page.getByText(NO_LINK, { exact: true })).toBeVisible()
    await page.mouse.move(0, 0)
    await expect(page.getByText(NO_LINK, { exact: true })).toHaveCount(0)

    // each provider row: one main-frame navigation to the provider's core.ac.uk page
    const scheme = new URL(p2Env.baseURL).protocol
    for (const [name, id] of PROVIDERS) {
      const before = navigations.length
      await versions
        .getByRole('heading', { level: 3, name, exact: true })
        .click({ noWaitAfter: true })
      await expect.poll(() => navigations.length).toBe(before + 1)
      expect(navigations[before]).toEqual({
        url: `${scheme}//core.ac.uk/data-providers/${id}`,
        navigation: true,
        mainFrame: true,
      })
    }
    // every navigation stopped at the network: the work page stays
    expect(rel(p2Env, page.url())).toBe('/works/1001/')
  })

  test('T-710 @P1 J8 works 1710 Available Versions: a core-hosted version gets the "Download from data provider" anchor (joined sourceFulltextUrls, dangling aria ids), the others the popover button', async ({
    page,
  }) => {
    await open(page, '/works/1710/')
    const versions = page
      .getByRole('heading', { name: 'Available Versions' })
      .locator('xpath=..')
    await expect(versions.getByRole('heading', { level: 3 })).toHaveText([
      'Available Versions',
      ...PROVIDERS.map(([name]) => name),
    ])
    const dl = versions.getByRole('button', {
      name: 'Download from data provider',
    })
    await expect(dl).toHaveCount(3)
    const rows = await dl.evaluateAll((els) =>
      els.map((b) => {
        const a = b.closest('a[href]')
        return a
          ? {
              anchor: true,
              href: a.getAttribute('href'),
              target: a.getAttribute('target'),
              rel: a.getAttribute('rel'),
              labelledby: a.getAttribute('aria-labelledby'),
              describedby: a.getAttribute('aria-describedby'),
              idrefsFound: [
                a.getAttribute('aria-labelledby'),
                a.getAttribute('aria-describedby'),
              ].filter((id) => document.getElementById(id)).length,
            }
          : { anchor: false }
      })
    )
    expect(rows).toEqual([
      {
        anchor: true,
        href: JOINED_FULLTEXT,
        target: '_blank',
        rel: 'noreferrer',
        labelledby: '566708785-downloaded-from-title',
        describedby: '566708785-downloaded-from-body',
        idrefsFound: 0,
      },
      { anchor: false },
      { anchor: false },
    ])
    // the anchor row has no popover; the second row keeps it
    await dl.nth(0).hover()
    await expect(page.getByText(NO_LINK, { exact: true })).toHaveCount(0)
    await dl.nth(1).hover()
    await expect(page.getByText(NO_LINK, { exact: true })).toBeVisible()
    await page.mouse.move(0, 0)
    await expect(page.getByText(NO_LINK, { exact: true })).toHaveCount(0)
  })
})
