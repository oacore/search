// T-802 (41 I; R-024, R-025, R-074, R-075, R-087; Q-047, Q-068, Q-072, Q-090): component visuals. Every
// design-unit state of the harness page (test/harness-pages/[state].jsx, built only into the harness
// variant: `npm run build:parity -- --variant harness`, served by `npm run e2e:up -- --run <id> --variant
// harness`; never in the parity build, T-011 c3) is captured pixel-exact (e2e/fixtures/pixel-exact.mjs).
// c1 the harness build serves the states with IMPL (app env `IMPL`, default design; this spec reads the
//    expected value from its own env `IMPL`) and only through the allow-all proxy;
// c2 each state of IMPL equals the package capture (IMPL=design) at 0 px: the copy (W0.5, W5), each port
//    (7.1) and each antd unit (7.2) are compared with the same files. Captures are recorded only with
//    IMPL=design (`npm run e2e:record -- --run <id> --provisional --project visual -g 'T-802'`; host
//    baseline on this machine until B0);
// c3 the DU-08 edge states: 0, 1, 11 options, a long option, an empty query (menu open, both widths).
// The harness page path is not a gateway route, so pages load through the allow-all proxy; their assets
// (assetPrefix /static/search) are fetched through the gateway, which maps /static/search/* to the app's
// /* exactly as in production (kube/prod/httproute.yaml).
import { test, expect, setFixedTime } from '../fixtures/guard.mjs'
import { expectPixelExact } from '../fixtures/pixel-exact.mjs'
import { spriteCheck, useBox } from '../fixtures/visual-ready.mjs'

const IMPL = process.env.IMPL || 'design'
const HEIGHTS = { 1440: 900, 375: 812 }
const LONG_OPTION =
  'A very long suggestion that is much wider than the input of the select and has to wrap or overflow somewhere in the menu'

// one capture: state id, file name, what is captured, the user action before it, the widths
const C = (id, opts = {}) => ({
  id,
  name: id,
  target: 'unit',
  widths: [1440],
  cookie: 'essential',
  ...opts,
})
const BOTH = [1440, 375]

const CAPTURES = [
  C('du-02-icons', { use: 30 }),
  C('du-03-variants'),
  C('du-03-as-link'),
  C('du-03-disabled'),
  C('du-03-focused', { action: 'focus-button' }),
  C('du-04-statics'),
  C('du-04-outlined-tags'),
  C('du-04-tag-a'),
  C('du-05-links', { use: 1 }),
  C('du-06-auto-close', { target: 'viewport', widths: BOTH }),
  C('du-06-hide-manually', { target: 'viewport', widths: BOTH }),
  C('du-07-form-label'),
  C('du-07-form-addons'),
  C('du-07-form-controls'),
  C('du-07-text-fields'),
  C('du-07-text-field-status', { use: 4 }),
  C('du-07-text-field-focused', { action: 'focus-textbox' }),
  C('du-08-options-icons', { action: 'focus-combobox', target: 'viewport' }),
  C('du-08-pure'),
  C('du-08-0-options', {
    action: 'focus-combobox',
    target: 'viewport',
    widths: BOTH,
    edge: { options: 0, value: 'zz' },
  }),
  C('du-08-1-option', {
    action: 'focus-combobox',
    target: 'viewport',
    widths: BOTH,
    edge: { options: 1, value: 'O' },
  }),
  C('du-08-11-options', {
    action: 'focus-combobox',
    target: 'viewport',
    widths: BOTH,
    edge: { options: 11, value: 'O' },
  }),
  C('du-08-long-option', {
    action: 'focus-combobox',
    target: 'viewport',
    widths: BOTH,
    edge: { options: 1, value: 'A', text: LONG_OPTION },
  }),
  C('du-08-empty-query', {
    action: 'focus-combobox',
    target: 'viewport',
    widths: BOTH,
    edge: { options: 3, value: '' },
  }),
  C('du-09-header', { target: 'banner', widths: BOTH }),
  C('du-09-header', {
    name: 'du-09-header-menu',
    action: 'open-services',
    target: 'viewport',
  }),
  C('du-09-bar-hidden', { target: 'banner', widths: BOTH }),
  C('du-09-bar-shown', { target: 'banner', widths: BOTH }),
  C('du-09-bar-shown', {
    name: 'du-09-bar-suggestions',
    action: 'type-o',
    target: 'viewport',
  }),
  C('du-09-bar-advanced', { target: 'banner' }),
  C('du-09-bar-advanced', {
    name: 'du-09-bar-advanced-open',
    action: 'open-advanced',
    target: 'viewport',
  }),
  C('du-11-hover', { action: 'hover-download', target: 'viewport' }),
  C('du-11-click', { action: 'click-top-start', target: 'viewport' }),
  C('du-11-visible', { action: 'tippy-shown', target: 'viewport' }),
  C('du-12-items'),
  C('du-13-sizes', { use: 3 }),
  C('du-13-no-default'),
  C('du-14-default'),
  C('du-14-fixed', { target: 'viewport' }),
  C('du-15-icon-items', { widths: BOTH }),
  C('du-15-no-icon', { widths: BOTH }),
  C('du-16-loading'),
  C('du-16-regular', { logos: 2 }),
  C('du-16-redirect-no-logo'),
  C('du-16-metadata-only'),
  C('du-17-popup', { target: 'popup', cookie: 'absent', widths: BOTH }),
  C('du-18-footer', { target: 'contentinfo', widths: BOTH }),
  C('du-19-styleguide'),
  C('du-19-app-props'),
  C('du-20-text'),
  C('du-20-math'),
  C('du-20-break-line'),
  C('du-21-indeterminate'),
  C('du-21-determinate'),
  C('du-21-value-of-max'),
  C('du-22-four-items'),
  C('du-22-six-items'),
  C('du-22-six-items', { name: 'du-22-expanded', action: 'focus-more' }),
]

// every state the page defines, in the page's order
const STATE_IDS = [...new Set(CAPTURES.map((c) => c.id))]

const harnessURL = (p2Env, state) =>
  new URL(`/__du-harness/${state}/`, p2Env.allowURL).href

// assets of a page on the allow-all origin go through the gateway (see the header comment)
async function routeAssets(page, p2Env) {
  const allow = new URL(p2Env.allowURL).origin
  await page.route(
    (url) => url.origin === allow && url.pathname.startsWith('/static/search/'),
    async (route) => {
      const u = new URL(route.request().url())
      const response = await route.fetch({
        url: new URL(`${u.pathname}${u.search}`, p2Env.baseURL).href,
      })
      await route.fulfill({ response })
    }
  )
}

async function openState(page, p2Env, capture, width) {
  await page.setViewportSize({ width, height: HEIGHTS[width] })
  await setFixedTime(page)
  await routeAssets(page, p2Env)
  const res = await page.goto(harnessURL(p2Env, capture.id))
  expect(res.status(), `${capture.id} status`).toBe(200)
  // hydrated: the page's effect has run
  const root = page.locator(`[data-du-state="${capture.id}"]`)
  await expect(root).toHaveAttribute('data-du-ready', 'true')
  await expect(root).toHaveAttribute('data-du-impl', IMPL)
  await page.waitForLoadState('load')
  await page.evaluate(() =>
    document.fonts.ready.then(() => document.fonts.status)
  )
  const sprite = await spriteCheck(page)
  expect(sprite, 'sprite /static/search/icons.svg').toMatchObject({
    status: 200,
    ok: true,
  })
  if (capture.use)
    await expect
      .poll(async () => (await useBox(page)).nonZero, {
        message: 'icons drawn (a <use> with a non-zero box)',
      })
      .toBeGreaterThanOrEqual(capture.use)
  if (capture.logos)
    await expect(
      page.locator('img[src^="https://api.core.ac.uk/data-providers/"]')
    ).toHaveCount(capture.logos)
  await page.waitForFunction(() =>
    [...document.images].every((i) => i.complete)
  )
  return root
}

const tippy = (page) => page.locator('[data-tippy-root]')

async function act(page, capture) {
  const main = page.getByRole('main')
  switch (capture.action) {
    case undefined:
      return
    case 'focus-button':
      await main.getByRole('button', { name: 'Focused' }).focus()
      return
    case 'focus-textbox':
      await main.getByRole('textbox', { name: 'Full name' }).focus()
      await expect(
        main.getByRole('textbox', { name: 'Full name' })
      ).toBeFocused()
      return
    case 'focus-combobox': {
      const box = main.getByRole('combobox')
      await box.focus()
      await expect(box).toBeFocused()
      await expect(
        main.getByRole('listbox', { includeHidden: true })
      ).toHaveClass(/select-show-/)
      return
    }
    case 'open-services': {
      const services = page.getByRole('button', { name: 'Services' })
      await services.click()
      await expect(services).toHaveAttribute('aria-expanded', 'true')
      return
    }
    case 'type-o': {
      const banner = page.getByRole('banner')
      const box = banner.getByRole('combobox')
      // the label overlays the input (Q-083): the pointer lands on the label, which focuses the input
      await banner.locator('label[for="select-app-bar-search"]').click()
      await expect(box).toBeFocused()
      await page.keyboard.type('o')
      await expect(box).toHaveValue('o')
      await expect(page.getByRole('banner').getByRole('option')).toHaveCount(3)
      return
    }
    case 'open-advanced': {
      await page.getByRole('banner').getByText('How to search?').click()
      await expect(
        page.getByText('To refine your searches you can use:')
      ).toBeVisible()
      return
    }
    case 'hover-download':
      await main.getByRole('button', { name: 'Download' }).hover()
      await expect(tippy(page)).toBeVisible()
      return
    case 'click-top-start':
      await main.getByRole('button', { name: 'top-start' }).click()
      await expect(tippy(page)).toBeVisible()
      return
    case 'tippy-shown':
      await expect(tippy(page)).toBeVisible()
      return
    case 'focus-more': {
      await main.getByTitle('Show more').focus()
      await expect(main.getByRole('link', { name: 'Orange' })).toBeFocused()
      return
    }
    default:
      throw new Error(`T-802: unknown action ${capture.action}`)
  }
}

function targetOf(page, root, capture) {
  if (capture.target === 'unit') return root
  if (capture.target === 'banner') return page.getByRole('banner')
  if (capture.target === 'contentinfo') return page.getByRole('contentinfo')
  if (capture.target === 'popup') return page.locator('#cookies-popup')
  if (capture.target === 'viewport') return page
  throw new Error(`T-802: unknown target ${capture.target}`)
}

// Transitions that the last action started (focus, open) run to their end state before the shot. The
// placeholder of a focused field transitions `transform` and `opacity` (0.15 s) on the ::placeholder
// pseudo-element, which `animations: 'disabled'` does not fast-forward, so the shot showed it mid-transition
// in some runs (du-07-text-field-focused, du-08-options-icons). Settled = the computed placeholder style of
// every field is the same on two polls 250 ms apart; finite Web Animations are awaited as well, infinite
// ones are left alone.
const settleAnimations = async (page) => {
  await page.evaluate(() =>
    Promise.all(
      document
        .getAnimations()
        .filter((a) => Number.isFinite(a.effect.getComputedTiming().endTime))
        .map((a) => a.finished.catch(() => null))
    )
  )
  let last = null
  await expect
    .poll(
      async () => {
        const now = await page.evaluate(() =>
          [...document.querySelectorAll('input, textarea')]
            .map((el) => {
              const style = getComputedStyle(el, '::placeholder')
              return `${style.opacity}|${style.transform}`
            })
            .join(';')
        )
        const stable = now === last
        last = now
        return stable
      },
      { message: 'placeholder transitions settled', intervals: [250] }
    )
    .toBe(true)
}

async function captureState(page, p2Env, c, width) {
  if (process.env.RECORD === '1' && IMPL !== 'design')
    throw new Error('T-802: captures are recorded only with IMPL=design')
  const root = await openState(page, p2Env, c, width)
  await act(page, c)
  await settleAnimations(page)
  const target = targetOf(page, root, c)
  if (target !== page) await expect(target).toBeVisible()
  await expectPixelExact(target, `${c.name}-${width}.png`, { fullPage: false })
}

test.describe('T-802 @P0 component visuals', () => {
  test.use({ cookieState: 'essential' })

  test(`T-802 c1 @P0 the harness build serves every design-unit state with IMPL=${IMPL} through the allow-all proxy only`, async ({
    page,
    p2Env,
    request,
  }) => {
    // the harness variant of the build (the parity build has no harness page)
    expect(p2Env.build.variant).toBe('harness')
    expect((p2Env.appEnv && p2Env.appEnv.IMPL) || 'design').toBe(IMPL)
    await routeAssets(page, p2Env)
    const res = await page.goto(harnessURL(p2Env, 'index'))
    expect(res.status()).toBe(200)
    const index = page.locator('[data-du-index]')
    await expect(index).toHaveAttribute('data-du-ready', 'true')
    await expect(index).toHaveAttribute('data-du-index', IMPL)
    expect(JSON.parse(await index.textContent())).toEqual(STATE_IDS)
    // an unknown state is a 404 of the page, the gateway never routes the harness path to the app
    const unknown = await request.get(harnessURL(p2Env, 'du-99-none'))
    expect(unknown.status()).toBe(404)
    const viaGateway = await request.get(
      new URL('/__du-harness/index/', p2Env.baseURL).href
    )
    expect(viaGateway.status()).toBe(404)
    expect(await viaGateway.text()).toBe('other service\n')
  })

  for (const c of CAPTURES.filter((x) => x.cookie === 'essential' && !x.edge))
    for (const width of c.widths)
      test(`T-802 c2 @P0 ${c.name} at ${width} px equals the package capture (IMPL=${IMPL})`, async ({
        page,
        p2Env,
      }) => {
        await captureState(page, p2Env, c, width)
      })

  for (const c of CAPTURES.filter((x) => x.edge))
    for (const width of c.widths)
      test(`T-802 c3 @P0 DU-08 edge state ${c.name} at ${width} px: ${c.edge.options} option(s), query "${c.edge.value}", 0 px against the package capture (IMPL=${IMPL})`, async ({
        page,
        p2Env,
      }) => {
        const root = await openState(page, p2Env, c, width)
        await act(page, c)
        await settleAnimations(page)
        const box = root.getByRole('combobox')
        await expect(box).toHaveValue(c.edge.value)
        await expect(box).toHaveAttribute(
          'aria-expanded',
          String(c.edge.options > 0)
        )
        const options = root.getByRole('option')
        await expect(options).toHaveCount(c.edge.options)
        if (c.edge.text) await expect(options.first()).toHaveText(c.edge.text)
        await expectPixelExact(page, `${c.name}-${width}.png`, {
          fullPage: false,
        })
      })
})

test.describe('T-802 @P0 component visuals, no consent cookie', () => {
  test.use({ cookieState: 'absent' })

  for (const c of CAPTURES.filter((x) => x.cookie === 'absent'))
    for (const width of c.widths)
      test(`T-802 c2 @P0 ${c.name} at ${width} px equals the package capture (IMPL=${IMPL})`, async ({
        page,
        p2Env,
      }) => {
        await captureState(page, p2Env, c, width)
      })
})
