// P1-05 header helpers (T-726 J19, T-727 J20, T-736 J29): the design Header (header.jsx of @oacore/design) with
// its three menus, the hamburger and the search bar. Roles, labels and text first (README errata ER-24); the
// design CSS modules have the class shape `<file>-<name>-<hash5>`, read only through hash-free stems.

export const MENU_LABELS = ['Services', 'Support us', 'About']

// the menu buttons by their visible label
export const menuButton = (page, label) =>
  page.getByRole('button', { name: label, exact: true })

export const hamburger = (page) =>
  page.getByRole('button', { name: 'Toggle navigation' })

// the facts of the header read inside the page: per menu its button (id, expanded, popup), its list (class
// stems, display, whether it takes room) and whether it holds the focus; the container class stems; the
// hamburger and the nav it controls
export const headerState = (page) =>
  page.evaluate(async () => {
    // the header animates (`transition: .15s` on the nav and the lists): read the state once the finite
    // transitions of the page have ended, so no computed value is read mid-transition
    await Promise.all(
      document
        .getAnimations()
        .filter((a) => a.effect.getTiming().iterations !== Infinity)
        .map((a) => a.finished.catch(() => null))
    )
    const stem = (c) => c.replace(/-[\w-]{5}$/, '')
    const stems = (el) => [...el.classList].map(stem)
    const header = document.querySelector('header#header')
    const room = (el) => {
      const r = el.getBoundingClientRect()
      return r.width > 0 && r.height > 0
    }
    const menus = [...header.querySelectorAll('button[aria-haspopup]')].map(
      (b) => {
        const list = b.parentElement.querySelector(':scope > ul')
        const cs = getComputedStyle(list)
        return {
          label: b.textContent.trim(),
          id: b.id,
          haspopup: b.getAttribute('aria-haspopup'),
          expanded: b.getAttribute('aria-expanded'),
          listStems: stems(list),
          listDisplay: cs.display,
          listTakesRoom: room(list),
          focused: document.activeElement === b,
        }
      }
    )
    const toggle = header.querySelector('button[aria-controls]')
    const nav = document.getElementById(toggle.getAttribute('aria-controls'))
    return {
      containerStems: stems(header),
      menus,
      toggle: {
        label: toggle.getAttribute('aria-label'),
        shown: toggle.getBoundingClientRect().width > 0,
        expanded: toggle.getAttribute('aria-expanded'),
        focused: document.activeElement === toggle,
        navStems: stems(nav),
        navVisibility: getComputedStyle(nav).visibility,
        navTakesRoom: room(nav),
      },
    }
  })

// the links of each menu list: [label, href attribute]
export const menuLinks = (page) =>
  page.evaluate(() => {
    const header = document.querySelector('header#header')
    const out = {}
    for (const b of header.querySelectorAll('button[aria-haspopup]'))
      out[b.textContent.trim()] = [
        ...b.parentElement.querySelectorAll(':scope > ul a'),
      ].map((a) => [
        a.textContent.trim().replace(/\s+/g, ' '),
        a.getAttribute('href'),
      ])
    return out
  })

// A click on a link of the header must close the menu without leaving the page: a capture-phase listener
// cancels the navigation of every link click, the handler of the design Header (a bubbling click listener on
// <body>) still sees the event.
export const keepOnPage = (page) =>
  page.evaluate(() => {
    if (window.__p105keep) return
    window.__p105keep = true
    document.addEventListener(
      'click',
      (e) => {
        if (e.target.closest('a')) e.preventDefault()
      },
      true
    )
  })
