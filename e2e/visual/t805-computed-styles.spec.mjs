// T-805 (41 I; R-023, R-043, R-074, R-086, R-087): computed styles = B0, in five clauses.
//   c1  computed-style census (40 §1 property list: every property getComputedStyle enumerates per engine,
//       custom properties included, plus the `content` of ::before / ::after, minus
//       test/baseline/t805-exclusions.json) of every element under <body> (the #__next tree and the portals)
//       on the 41 §2.5 engine subset at 1440 and 375; tagged @engines, so the runner's WebKit and Firefox
//       projects run it with their own baselines.
//   c2  Chromium CDP CSS.forcePseudoState: per interactive element of five page shells, the style changes in
//       its subtree under a forced :hover, :focus, :focus-visible and :active (one at a time) = B0.
//   c3  motion census with reducedMotion 'no-preference' and animations on: per state change (modal, select,
//       popover, toast, loaders, cookie popup) and phase, the transitionrun / animationstart events, the
//       animations still running and the computed transition-* / animation-* longhands = B0. State changes are
//       made without pointer movement where the state is not a pointer state (a dispatched click, a key), so
//       the census holds the motion of the state change and not hover or press transitions (those are c2).
//   c4  media-rule census of the runtime document.styleSheets and adoptedStyleSheets (CSS-in-JS included) per
//       page shell, with the match state of every condition at the M widths = B0.
//   c5  phase 7 (antd) cascade probes and layer rules: today no @layer rule, no CSS-in-JS sheet or style
//       element, no ant- class or --ant custom property on any page shell, and the design's global element
//       rules (R-087: button, label, input, select, textarea, ul) on bare probes = B0; the probes antd adds at
//       7.0 (80 §1 PR 1) compare against this record.
// Baselines: JSON next to this spec (expectJsonBaseline; host baseline macOS arm64, owner notes §1). Pages are
// settled first (fonts, images, quiet network; 40 §5); the fixed clock; cookie state `essential` unless the
// state is the cookie popup.
import { test, expect } from '../fixtures/guard.mjs'
import {
  TEST_TIMEOUT,
  NAV_TIMEOUT,
  slow,
  openAt,
  quiet,
  fontsAndImages,
  neutralPointer,
  stackOrigins,
  rel,
  appQuiet,
  sizeOf,
} from '../lib/P1-06/page.mjs'
import {
  installHelpers,
  installMotionRecorder,
  styleCensus,
  markInteractive,
  forcedSnapshot,
  motionPhase,
  finiteAnimationsDone,
  mediaCensus,
  mediaMatches,
  layerCensus,
  probeCensus,
} from '../lib/P1-06/census.mjs'
import {
  expectJsonBaseline,
  explainStyleCensus,
} from '../lib/P1-06/baseline.mjs'
import { exclusionsFor } from '../lib/P1-06/exclusions.mjs'
import {
  ENGINE_STATES,
  ENGINE_WIDTHS,
  headerSearch,
  providersSearch,
  downloadButton,
  copyButton,
  sortBox,
  sortMenu,
  cookieText,
} from '../lib/P1-06/states.mjs'

test.use({ cookieState: 'essential' })

const M = [1920, 1440, 768, 767, 375]
const PSEUDO = ['hover', 'focus', 'focus-visible', 'active']

// the five page shells of c2 and the six of c4 / c5
const SHELLS = [
  { id: 'search', path: '/search/?q=climate' },
  { id: 'works', path: '/works/1001/' },
  { id: 'outputs', path: '/outputs/2001/' },
  { id: 'update', path: '/outputs/update/' },
  { id: 'providers', path: '/data-providers/' },
]
const SHELLS_C4 = [...SHELLS, { id: 'provider', path: '/data-providers/86/' }]

// the exclusion list of this engine: absent (null) = not captured yet for the engine, which fails the census
function exclusions(browserName) {
  const list = exclusionsFor(browserName)
  expect(
    list,
    `test/baseline/t805-exclusions.json has no capture for ${browserName} (42 §6: 3 captures on the golden build)`
  ).not.toBeNull()
  return list
}

// a settled page with fonts and every image loaded, at the top, the pointer on a neutral point
async function settled(page, tracker) {
  await quiet(page, tracker)
  await fontsAndImages(page)
  await quiet(page, tracker)
}

async function afterAction(page, tracker) {
  await neutralPointer(page)
  await page.evaluate(() =>
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' })
  )
  await page.waitForFunction(() => window.scrollY === 0, null, {
    timeout: NAV_TIMEOUT,
  })
  await settled(page, tracker)
  await slow.poll(() => page.evaluate(finiteAnimationsDone)).toBe(true)
}

// ---------- c1 ----------

test.describe('T-805 c1 computed-style census, engine subset', () => {
  test.describe.configure({ timeout: TEST_TIMEOUT })
  for (const st of ENGINE_STATES)
    test.describe(st.id, () => {
      test.use({ cookieState: st.cookieState || 'essential' })
      for (const w of ENGINE_WIDTHS)
        test(`T-805 c1 @P1 @engines ${st.id} ${w}: computed styles of every element (40 §1 list) = B0`, async ({
          page,
          p2Env,
          browserName,
        }) => {
          const exclude = exclusions(browserName)
          await page.addInitScript(installHelpers)
          const { tracker } = await openAt(page, st.path, w)
          await settled(page, tracker)
          if (st.act) {
            await st.act(page, w)
            await afterAction(page, tracker)
          }
          const census = await page.evaluate(styleCensus, {
            exclude,
            origins: stackOrigins(p2Env),
          })
          expect(census.elements.length).toBeGreaterThan(50)
          await expectJsonBaseline(
            `t805-c1-${st.id}-${w}`,
            {
              state: st.id,
              url: rel(p2Env, page.url()),
              viewport: page.viewportSize(),
              engine: browserName,
              excluded: exclude.length,
              ...census,
            },
            { explain: explainStyleCensus }
          )
        })
    })
})

// ---------- c2 ----------

test.describe('T-805 c2 forced pseudo-classes (Chromium CDP)', () => {
  test.describe.configure({ timeout: TEST_TIMEOUT })
  for (const shell of SHELLS)
    for (const w of ENGINE_WIDTHS)
      test(`T-805 c2 @P1 ${shell.id} ${w}: forced hover, focus, focus-visible, active per interactive element = B0`, async ({
        page,
        p2Env,
        browserName,
      }) => {
        expect(
          browserName,
          'CSS.forcePseudoState is a Chromium CDP method'
        ).toBe('chromium')
        const exclude = exclusions(browserName)
        const origins = stackOrigins(p2Env)
        await page.addInitScript(installHelpers)
        const { tracker } = await openAt(page, shell.path, w)
        await settled(page, tracker)
        const cdp = await page.context().newCDPSession(page)
        await cdp.send('DOM.enable')
        await cdp.send('CSS.enable')
        await cdp.send('DOM.getDocument', { depth: 0 })
        const paths = await page.evaluate(markInteractive)
        expect(paths.length).toBeGreaterThan(5)
        const forced = {}
        for (let i = 0; i < paths.length; i += 1) {
          const { result } = await cdp.send('Runtime.evaluate', {
            expression: `window.__p106.forced[${i}]`,
          })
          const { nodeId } = await cdp.send('DOM.requestNode', {
            objectId: result.objectId,
          })
          await page.evaluate(forcedSnapshot, {
            i,
            exclude,
            origins,
            store: true,
          })
          const states = {}
          for (const pc of PSEUDO) {
            await cdp.send('CSS.forcePseudoState', {
              nodeId,
              forcedPseudoClasses: [pc],
            })
            const delta = await page.evaluate(forcedSnapshot, {
              i,
              exclude,
              origins,
              store: false,
            })
            await cdp.send('CSS.forcePseudoState', {
              nodeId,
              forcedPseudoClasses: [],
            })
            if (Object.keys(delta).length) states[pc] = delta
          }
          if (Object.keys(states).length) forced[paths[i]] = states
        }
        await cdp.detach()
        await expectJsonBaseline(`t805-c2-${shell.id}-${w}`, {
          shell: shell.id,
          url: rel(p2Env, page.url()),
          viewport: page.viewportSize(),
          interactive: paths,
          forced,
        })
      })
})

// ---------- c3 ----------

// a phase of a state change: once the reached state is asserted by the caller, every finite animation has
// ended, two frames have passed (the animation events of the last frame are dispatched), then the census
// (the initial 'load' phase: events of elements still in the document only, see motionPhase)
async function phase(page, p2Env, name) {
  await slow
    .poll(() => page.evaluate(finiteAnimationsDone), {
      timeout: NAV_TIMEOUT,
    })
    .toBe(true)
  await page.evaluate(
    () =>
      new Promise((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
      )
  )
  return {
    phase: name,
    ...(await page.evaluate(motionPhase, {
      origins: stackOrigins(p2Env),
      initial: name === 'load',
    })),
  }
}

// a request gate: requests matching `match` wait until release(); the request is then handed to the guard's
// routing (fallback), so it is answered from the fixtures as usual
async function gate(page, match) {
  let release
  const opened = new Promise((r) => {
    release = r
  })
  let held = 0
  await page.route(match, async (route) => {
    held += 1
    await opened
    await route.fallback()
  })
  return { release: () => release(), held: () => held }
}

const MOTION = [
  {
    id: 'modal-cite',
    title: 'modal: the Cite modal opens and closes (/works/1001/)',
    path: '/works/1001/',
    run: async (page, p2Env, tracker, phases) => {
      const cite = page.getByRole('button', { name: 'Cite' })
      await cite.dispatchEvent('click')
      await slow(page.getByRole('heading', { name: 'Citation' })).toBeVisible()
      phases.push(await phase(page, p2Env, 'open'))
      // Esc closes only with the focus inside the modal (findings/07 J7 correction): the modal focuses its
      // close button when it opens
      await page.keyboard.press('Escape')
      await slow(page.getByRole('heading', { name: 'Citation' })).toHaveCount(0)
      phases.push(await phase(page, p2Env, 'closed'))
    },
  },
  {
    id: 'select-sort',
    title: 'select: the sort select opens and closes (/search/?q=climate)',
    path: '/search/?q=climate',
    run: async (page, p2Env, tracker, phases) => {
      await sortBox(page).dispatchEvent('click')
      await slow(sortMenu(page)).toBeVisible()
      phases.push(await phase(page, p2Env, 'open'))
      await sortBox(page).dispatchEvent('click')
      await slow(sortMenu(page)).toHaveCount(0)
      phases.push(await phase(page, p2Env, 'closed'))
    },
  },
  {
    id: 'select-suggestions',
    title:
      'select: the design Select of the providers header search lists suggestions (/data-providers/)',
    path: '/data-providers/',
    run: async (page, p2Env, tracker, phases) => {
      await providersSearch(page).focus()
      phases.push(await phase(page, p2Env, 'focused'))
      await page.keyboard.type('birk')
      await slow(
        page.getByText('Birkbeck Institutional Research Online')
      ).toBeVisible()
      phases.push(await phase(page, p2Env, 'suggestions'))
    },
  },
  {
    id: 'popover-csv',
    title:
      'popover: the "Download results in CSV" popover on hover (/search/?q=climate)',
    path: '/search/?q=climate',
    run: async (page, p2Env, tracker, phases) => {
      await downloadButton(page).hover()
      await slow(page.getByText('Download results in CSV')).toBeVisible()
      phases.push(await phase(page, p2Env, 'shown'))
      await neutralPointer(page)
      await slow(page.getByText('Download results in CSV')).toHaveCount(0)
      phases.push(await phase(page, p2Env, 'hidden'))
    },
  },
  {
    id: 'toast-copy',
    title:
      'toast: "Link copied" after the copy button, gone after its timeout (/search/?q=climate)',
    path: '/search/?q=climate',
    permissions: ['clipboard-read', 'clipboard-write'],
    run: async (page, p2Env, tracker, phases) => {
      await copyButton(page).dispatchEvent('click')
      await slow(page.getByText('Link copied', { exact: true })).toBeVisible()
      phases.push(await phase(page, p2Env, 'shown'))
      await slow(page.getByText('Link copied', { exact: true })).toHaveCount(0)
      phases.push(await phase(page, p2Env, 'gone'))
    },
  },
  {
    id: 'loader-filters',
    title:
      'loaders: the filters loading block while the aggregation is held (/search/?q=climate)',
    path: '/search/?q=climate',
    before: (page) =>
      gate(page, 'https://api.core.ac.uk/v3/search/works/aggregate'),
    held: true,
    run: async (page, p2Env, tracker, phases, g) => {
      await slow(page.locator('[class*="loading-block"]').first()).toBeVisible()
      phases.push(await phase(page, p2Env, 'loading'))
      g.release()
      await slow(page.locator('[class*="loading-block"]')).toHaveCount(0)
      await quiet(page, tracker)
      phases.push(await phase(page, p2Env, 'loaded'))
    },
  },
  {
    id: 'loader-bar',
    title:
      'loaders: the loading bar of a client navigation while its data request is held (/search/?q=climate)',
    path: '/search/?q=climate',
    run: async (page, p2Env, tracker, phases) => {
      await appQuiet(p2Env)
      const g = await gate(page, (u) => u.pathname.includes('/_next/data/'))
      const input = headerSearch(page)
      await input.focus()
      await input.fill('machine learning')
      phases.push(await phase(page, p2Env, 'typed'))
      await input.press('Enter')
      // the bar is a 0 px high box whose ::before draws the line (design LoadingBar): attached, not visible
      await slow(page.locator('[class*="loading-bar-"]').first()).toBeAttached()
      phases.push(await phase(page, p2Env, 'loading'))
      g.release()
      await slow(page).toHaveURL(
        `${p2Env.baseURL}/search/?q=machine+learning&page=1`,
        { timeout: NAV_TIMEOUT }
      )
      await slow(page.locator('[class*="loading-bar-"]')).toHaveCount(0)
      await quiet(page, tracker)
      await fontsAndImages(page)
      phases.push(await phase(page, p2Env, 'loaded'))
    },
  },
  {
    id: 'loader-similar',
    title:
      'loaders: "Loading suggested articles..." while the similar-works request is held (/works/1001/)',
    path: '/works/1001/',
    before: (page) => gate(page, 'https://api.core.ac.uk/v3/recommend'),
    held: true,
    run: async (page, p2Env, tracker, phases, g) => {
      await slow(page.getByText('Loading suggested articles...')).toBeVisible()
      phases.push(await phase(page, p2Env, 'loading'))
      g.release()
      await slow(page.getByText('Loading suggested articles...')).toHaveCount(0)
      await quiet(page, tracker)
      await fontsAndImages(page)
      phases.push(await phase(page, p2Env, 'loaded'))
    },
  },
  {
    id: 'cookie-popup',
    title:
      'cookie popup: shown on a first visit, gone after "Essential cookies only" (/outputs/update/)',
    path: '/outputs/update/',
    cookieState: 'absent',
    run: async (page, p2Env, tracker, phases) => {
      await slow(cookieText(page)).toBeVisible()
      phases.push(await phase(page, p2Env, 'shown'))
      await page
        .getByRole('button', { name: 'Essential cookies only' })
        .dispatchEvent('click')
      await slow(cookieText(page)).toHaveCount(0)
      phases.push(await phase(page, p2Env, 'accepted'))
    },
  },
]

test.describe('T-805 c3 motion census', () => {
  test.describe.configure({ timeout: TEST_TIMEOUT })
  for (const sc of MOTION)
    test.describe(sc.id, () => {
      test.use({ cookieState: sc.cookieState || 'essential' })
      test(`T-805 c3 @P1 ${sc.title} = B0`, async ({
        page,
        context,
        p2Env,
      }) => {
        if (sc.permissions)
          await context.grantPermissions(sc.permissions, {
            origin: new URL(p2Env.baseURL).origin,
          })
        const g = sc.before ? await sc.before(page) : null
        await page.emulateMedia({ reducedMotion: 'no-preference' })
        await page.addInitScript(installHelpers)
        await page.addInitScript(installMotionRecorder)
        // a held request keeps the page from being quiet: the load phase is taken once hydrated
        const { tracker } = await openAt(page, sc.path, 1440, {
          settled: !sc.held,
        })
        const phases = []
        if (!sc.held) {
          await settled(page, tracker)
          phases.push(await phase(page, p2Env, 'load'))
        }
        await sc.run(page, p2Env, tracker, phases, g)
        expect(
          await page.evaluate(
            () => matchMedia('(prefers-reduced-motion: no-preference)').matches
          )
        ).toBe(true)
        await expectJsonBaseline(`t805-c3-${sc.id}`, {
          scenario: sc.id,
          url: rel(p2Env, page.url()),
          viewport: page.viewportSize(),
          reducedMotion: 'no-preference',
          phases,
        })
      })
    })
})

// ---------- c4 ----------

test.describe('T-805 c4 media-rule census', () => {
  test.describe.configure({ timeout: TEST_TIMEOUT })
  for (const shell of SHELLS_C4)
    test(`T-805 c4 @P1 ${shell.id}: @media rules of the runtime style sheets and their matches at the M widths = B0`, async ({
      page,
      p2Env,
    }) => {
      await page.addInitScript(installHelpers)
      const { tracker } = await openAt(page, shell.path, 1440)
      await settled(page, tracker)
      const census = await page.evaluate(mediaCensus, {
        origins: stackOrigins(p2Env),
      })
      expect(census.sheets.length).toBeGreaterThan(0)
      const matches = {}
      for (const c of census.conditions) matches[c] = {}
      for (const w of M) {
        await page.setViewportSize(sizeOf(w))
        await page.waitForFunction((width) => window.innerWidth === width, w)
        for (const [c, m] of await page.evaluate(
          mediaMatches,
          census.conditions
        ))
          matches[c][w] = m
      }
      await expectJsonBaseline(`t805-c4-${shell.id}`, {
        shell: shell.id,
        url: rel(p2Env, page.url()),
        ...census,
        matches,
      })
    })
})

// ---------- c5 ----------

test.describe('T-805 c5 phase 7 cascade probes and layer rules', () => {
  test.describe.configure({ timeout: TEST_TIMEOUT })
  test('T-805 c5 @P1 layer rules: no @layer rule, CSS-in-JS sheet, ant- class or --ant property on any page shell', async ({
    page,
    p2Env,
  }) => {
    await page.addInitScript(installHelpers)
    const pages = {}
    for (const shell of SHELLS_C4) {
      const { tracker } = await openAt(page, shell.path, 1440)
      await settled(page, tracker)
      pages[shell.id] = await page.evaluate(layerCensus)
    }
    for (const [id, c] of Object.entries(pages))
      expect(c, id).toMatchObject({
        rules: { CSSLayerBlockRule: 0, CSSLayerStatementRule: 0 },
        layerNames: [],
        adoptedStyleSheets: 0,
        cssinjsStyleElements: 0,
        antClassElements: 0,
        antCustomProperties: 0,
      })
    await expectJsonBaseline('t805-c5-layers', { pages })
  })

  for (const w of ENGINE_WIDTHS)
    test(`T-805 c5 @P1 cascade probes ${w}: the design's global element rules on bare button, label, input, select, textarea, ul probes = B0`, async ({
      page,
      p2Env,
      browserName,
    }) => {
      const exclude = exclusions(browserName)
      await page.addInitScript(installHelpers)
      const { tracker } = await openAt(page, '/outputs/update/', w)
      await settled(page, tracker)
      const probes = await page.evaluate(probeCensus, {
        exclude,
        origins: stackOrigins(p2Env),
      })
      // the design styles a bare button (lib/elements/button/button.css): the probe differs from a <div>
      expect(Object.keys(probes.probes.button).length).toBeGreaterThan(0)
      await expectJsonBaseline(`t805-c5-probes-${w}`, {
        url: rel(p2Env, page.url()),
        viewport: page.viewportSize(),
        ...probes,
      })
    })
})
