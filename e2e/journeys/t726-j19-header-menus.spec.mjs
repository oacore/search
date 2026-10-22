// T-726 (41 H, J19, R-075, R-087): the header menus and the hamburger. The design Header (header.jsx of
// @oacore/design) keeps one open menu at a time (`useMenuToggle`), toggles it from the menu button
// (`aria-expanded`, class `expanded` on the list and on the header container) and closes it from a click listener on
// <body> (`useOutsideClicksEffect`): a click outside #header or on any link closes the open menu. Pinned as the
// app behaves today, a11y gaps included:
//   desktop (1280x720): three menus (Services, Support us, About) with their links, open, switch, toggle off,
//       the keyboard (Enter and Space on the button, Tab into the list), Escape does nothing (no key handler), a
//       click outside and a click on a link close it;
//   mobile (375x812, touch): the hamburger (`Toggle navigation`) expands the nav, the menus open inside it by
//       tap, an outside tap closes the menu but not the nav, the hamburger tap collapses the nav only.
// The page is /outputs/update/ (no getServerSideProps, no API call): the header is the subject. The links of the
// menus are relative (`/services/api`, ...), routed to other services by the gateway, so a link click is kept on
// the page by a capture-phase listener (keepOnPage); the design listener still sees the click.
import { test, expect } from '../lib/P1-05/fixtures.mjs'
import {
  MENU_LABELS,
  headerState,
  hamburger,
  keepOnPage,
  menuButton,
  menuLinks,
} from '../lib/P1-05/header.mjs'
import {
  NAV_TIMEOUT,
  TEST_TIMEOUT,
  settle,
  trackPage,
  watchRouter,
} from '../lib/P1-05/page.mjs'

test.use({
  cookieState: 'essential',
  navigationTimeout: NAV_TIMEOUT,
  actionTimeout: 60000,
})

const LINKS = {
  'Services': [
    ['Services overviewExplore all CORE services', '/services'],
    ['API', '/services/api'],
    ['Dataset', '/services/dataset'],
    ['FastSync', '/services/fastsync'],
    ['Recommender', '/services/recommender'],
    ['Discovery', '/services/discovery'],
    ['OAI Resolver', '/documentation/oai-resolver'],
    ['Dashboard', '/services/repository-dashboard'],
    ['FAIR Certification', '/services/fair-certification'],
    ['Consultancy services', '/services/consultancy'],
  ],
  'Support us': [
    ['Membership', '/membership'],
    ['Sponsorship', '/sponsorship'],
    ['Research partnership', '/governance/research'],
  ],
  'About': [
    ['About us', '/about'],
    ['Our mission', '/about#mission'],
    ['Team', '/about#team'],
    ['Blog', '//blog.core.ac.uk'],
    ['FAQs', '/faq'],
    ['Contact us', '/about#contact'],
    ['Governance', '/governance'],
    ['Advisory Board', '/governance/advisory'],
    ['Board of supporters', '/governance/supporters'],
    ['Research network', '/governance/research'],
    ['Our research', '/about/research-outputs'],
    ['Labs', '/innovations/labs'],
  ],
}
// the header element carries the class of two design modules with the same file stem
const CONTAINER = ['styles-container', 'styles-container']
const IDS = {
  'Services': 'services-title',
  'Support us': 'communities-title',
  'About': 'about-title',
}

// which menus are open, from the state view: [] or [label]
const open = (state) =>
  state.menus.filter((m) => m.expanded === 'true').map((m) => m.label)

// the closed state of every menu: collapsed button, hidden list, no `expanded` stem
const closedMenus = (focused = null) =>
  MENU_LABELS.map((label) => ({
    label,
    id: IDS[label],
    haspopup: 'true',
    expanded: 'false',
    listStems: ['styles-menu-list'],
    listDisplay: 'none',
    listTakesRoom: false,
    focused: label === focused,
  }))

// the state with `label` open
const openMenus = (label, focused = label) =>
  closedMenus(focused).map((m) =>
    m.label === label
      ? {
          ...m,
          expanded: 'true',
          listStems: ['styles-menu-list', 'styles-expanded'],
          listDisplay: 'flex',
          listTakesRoom: true,
        }
      : m
  )

async function openPage(page) {
  const tracker = trackPage(page)
  await page.goto('/outputs/update/')
  await watchRouter(page)
  await settle(page, tracker)
  await expect(page.getByText('Article Takedown Request')).toBeVisible()
  await keepOnPage(page)
}

test.describe('T-726 @P1 J19 header menus and hamburger', () => {
  test.describe.configure({ timeout: TEST_TIMEOUT })

  test('T-726 @P1 desktop: three menus, one open at a time, links listed, outside click and link click close', async ({
    page,
  }) => {
    await openPage(page)
    // nothing is open on load; the hamburger is not shown at this width
    const closed = await headerState(page)
    expect(closed.containerStems).toEqual(CONTAINER)
    expect(closed.menus).toEqual(closedMenus())
    expect(closed.toggle).toMatchObject({
      label: 'Toggle navigation',
      shown: false,
      expanded: 'false',
      navStems: ['styles-item', 'styles-nav'],
      navTakesRoom: true,
    })
    // the links of the three lists (11 + 3 + 12 anchors), hrefs as written in the design source
    expect(await menuLinks(page)).toEqual(LINKS)

    // a click opens the menu: the button reads expanded, the list takes room, the header container carries
    // the `expanded` stem
    await menuButton(page, 'Services').click()
    let s = await headerState(page)
    expect(s.containerStems).toEqual([...CONTAINER, 'styles-expanded'])
    expect(s.menus).toEqual(openMenus('Services'))
    // one menu at a time: opening About closes Services
    await menuButton(page, 'About').click()
    s = await headerState(page)
    expect(open(s)).toEqual(['About'])
    expect(s.menus).toEqual(openMenus('About'))
    // the same button again closes it; the container loses the stem
    await menuButton(page, 'About').click()
    s = await headerState(page)
    expect(s.containerStems).toEqual(CONTAINER)
    expect(s.menus).toEqual(closedMenus('About'))

    // a click outside the header closes the open menu (the listener of <body>)
    await menuButton(page, 'Support us').click()
    expect(open(await headerState(page))).toEqual(['Support us'])
    await page.mouse.click(5, 400)
    s = await headerState(page)
    expect(s.containerStems).toEqual(CONTAINER)
    expect(s.menus).toEqual(closedMenus())

    // a click inside the open list on text that is not a link keeps it open; on a link it closes it
    // (`event.target.closest('a')`), and the page stays where it is (the navigation is cancelled by the test)
    await menuButton(page, 'Services').click()
    await page.getByRole('heading', { name: 'Access to raw data' }).click()
    expect(open(await headerState(page))).toEqual(['Services'])
    await page.getByRole('link', { name: 'Dataset', exact: true }).click()
    s = await headerState(page)
    // the clicked link sits in the list that is now hidden, so the focus is no longer on a menu button
    expect(s.menus).toEqual(closedMenus())
    expect(new URL(page.url()).pathname).toBe('/outputs/update/')
  })

  test('T-726 @P1 desktop keyboard: Enter and Space toggle, Tab enters the open list, Escape does nothing', async ({
    page,
  }) => {
    await openPage(page)
    const services = menuButton(page, 'Services')
    // Tab from the top: the logo link, then the three menu buttons in order (this page has no search bar)
    await page.keyboard.press('Tab')
    expect(
      await page.evaluate(() => document.activeElement.getAttribute('href'))
    ).toBe('https://core.ac.uk/')
    await page.keyboard.press('Tab')
    await expect(services).toBeFocused()
    // Enter opens, Enter closes; Space opens, Space closes: the buttons are native buttons
    await page.keyboard.press('Enter')
    expect((await headerState(page)).menus).toEqual(openMenus('Services'))
    await page.keyboard.press('Enter')
    expect((await headerState(page)).menus).toEqual(closedMenus('Services'))
    await page.keyboard.press('Space')
    expect((await headerState(page)).menus).toEqual(openMenus('Services'))
    // Escape has no handler: the menu stays open and keeps the focus on its button
    await page.keyboard.press('Escape')
    expect((await headerState(page)).menus).toEqual(openMenus('Services'))
    // the open list follows its button in the tab order: the first link, then the next ones
    await page.keyboard.press('Tab')
    await expect(
      page.getByRole('link', { name: /^Services overview/ })
    ).toBeFocused()
    await page.keyboard.press('Tab')
    await expect(
      page.getByRole('link', { name: 'API', exact: true })
    ).toBeFocused()
    // the other buttons are reached by Shift+Tab past the list items and by Tab after them; moving the focus
    // does not close the menu
    expect(open(await headerState(page))).toEqual(['Services'])
    // Enter on a link of the list closes it (a click on a link); the navigation is cancelled by the test
    await page.keyboard.press('Enter')
    expect((await headerState(page)).menus).toEqual(closedMenus())
    expect(new URL(page.url()).pathname).toBe('/outputs/update/')
  })

  test.describe('mobile 375x812 with touch', () => {
    test.use({
      viewport: { width: 375, height: 812 },
      hasTouch: true,
      isMobile: true,
    })

    test('T-726 @P1 mobile: hamburger expands the nav, the menus open inside it, outside tap closes the menu only', async ({
      page,
    }) => {
      await openPage(page)
      // collapsed: the toggle is shown, the nav takes no room and is hidden
      let s = await headerState(page)
      expect(s.toggle).toMatchObject({
        label: 'Toggle navigation',
        shown: true,
        expanded: 'false',
        navStems: ['styles-item', 'styles-nav'],
        navVisibility: 'hidden',
        navTakesRoom: false,
      })
      expect(s.menus).toEqual(closedMenus())

      await hamburger(page).tap()
      s = await headerState(page)
      expect(s.toggle).toMatchObject({
        expanded: 'true',
        navStems: ['styles-item', 'styles-nav', 'styles-expanded'],
        navVisibility: 'visible',
        navTakesRoom: true,
      })
      // the three menu buttons are in the nav, all closed
      expect(s.menus).toEqual(closedMenus())

      // a tap opens a menu inside the nav, a second menu replaces it
      await menuButton(page, 'Services').tap()
      s = await headerState(page)
      expect(open(s)).toEqual(['Services'])
      expect(s.menus).toEqual(openMenus('Services'))
      expect(s.containerStems).toEqual([...CONTAINER, 'styles-expanded'])
      await menuButton(page, 'About').tap()
      s = await headerState(page)
      expect(open(s)).toEqual(['About'])
      expect(s.toggle.expanded).toBe('true')

      // a tap outside the header closes the menu; the nav stays expanded (the hamburger state is separate)
      await page.touchscreen.tap(5, 790)
      s = await headerState(page)
      expect(s.menus).toEqual(closedMenus())
      expect(s.toggle).toMatchObject({ expanded: 'true', navTakesRoom: true })

      // the hamburger tap collapses the nav; an open menu would keep its own state
      await menuButton(page, 'Support us').tap()
      expect(open(await headerState(page))).toEqual(['Support us'])
      await hamburger(page).tap()
      s = await headerState(page)
      expect(s.toggle).toMatchObject({
        expanded: 'false',
        navStems: ['styles-item', 'styles-nav'],
        navVisibility: 'hidden',
        navTakesRoom: false,
      })
      expect(open(s)).toEqual(['Support us'])
      // the DOM, URL and request log stay those of the click path: no navigation happened
      expect(new URL(page.url()).pathname).toBe('/outputs/update/')
    })
  })
})
