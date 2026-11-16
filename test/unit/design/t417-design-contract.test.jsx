// T-417 (41 E; R-024, R-025, R-056, R-075; Q-047, Q-068, Q-072, Q-090): the
// design contract of the 23 @oacore/design components the app imports, plus
// `useCookie` and `classNames` (findings/04 §0), on the implementation IMPL
// (T417_IMPL, default `design` = the installed 5.0.74 package; see
// lib/P0-07/impl.js).
// c1 DOM and classes of every unit state (lib/P0-07/units.jsx: the styleguide
//    props of findings/04 §5 and the app's call shapes), the statics, both
//    classNames shapes, useCookie, the 60 §6 preserved behaviours and the E22
//    count (Q-090 (b)).
// c2 interaction census: click, dblclick, hover 300 ms, focus, Enter, Space,
//    Esc, ArrowDown on every node of every state, each on a fresh render:
//    DOM mutations, focus, URL and navigation intents, network,
//    checkValidity() (lib/P0-07/census.js).
// c3 the package census is the reference for the copy (W0.5, W5), each port
//    (7.1) and each antd unit (7.2): it is recorded per component under
//    lib/P0-07/reference/ (RECORD=1, IMPL=design only) and a second census in a
//    fresh module registry reproduces it exactly. With another IMPL every c1,
//    c2 and c4 comparison below is that implementation against the package.
// c4 overlays (modal, select, popover, header dropdown) open: window blur,
//    scroll by 100 px, resize by +1 and -1 px: DOM mutations, focus, network.
// Every unit census runs in its own fresh module registry
// (lib/P0-07/fresh.js), so it does not depend on the tests selected before it.
import { execFileSync } from 'child_process'
import fs from 'fs'
import path from 'path'
import util from 'util'

import React from 'react'
import { hydrateRoot } from 'react-dom/client'
import ReactDOMServer from 'react-dom/server'

import { setupMsw } from '../../utils/msw'
import { render, act, screen } from '../../utils/render'
import { restoreClock } from '../../utils/clock'

const census = require('./lib/P0-07/census')
const { fresh } = require('./lib/P0-07/fresh')
const reference = require('./lib/P0-07/reference')
const {
  UNITS,
  COMPONENT_NAMES,
  PROVIDER_A,
  PROVIDER_B,
  SEARCH_RESULT_DATA,
  FIELDSET_ITEMS,
  HeaderPage,
  headerConfig,
} = require('./lib/P0-07/units')
const { loadImpl, implName } = require('./lib/P0-07/impl')

const { server } = setupMsw()

const IMPL = implName()
const impl = loadImpl(IMPL)
const I = impl.components

// a full unit census takes seconds to minutes on a loaded machine
jest.setTimeout(20 * 60 * 1000)

const ROOT = path.resolve(__dirname, '..', '..', '..')
const LIB = path.join(impl.root, 'lib')
const css = (rel) => fs.readFileSync(path.join(LIB, rel), 'utf8')

// the 23 components of findings/04 §0
const COMPONENTS = [
  'Button',
  'Card',
  'Cookies',
  'CookiesProvider',
  'DataProviderLogo',
  'DesignProvider',
  'ExpandableList',
  'Fieldset',
  'Footer',
  'Form',
  'Header',
  'Histoslider',
  'Icon',
  'Link',
  'LoadingBar',
  'MathMarkdown',
  'MetadataList',
  'Modal',
  'Popover',
  'ProgressSpinner',
  'SearchResult',
  'Select',
  'TextField',
]

// ---------- the unit censuses (one fresh module registry per unit) ----------
const censusCache = new Map()
const computeCensus = (name) =>
  fresh(async ({ census: engine, units, impl: freshImpl }) => {
    const unit = units.UNITS.find((u) => u.name === name)
    return engine.unitCensus(unit, freshImpl, { server })
  })

const referenceDocument = (result) => ({
  schema: reference.SCHEMA,
  impl: 'design',
  package: reference.packageIdentity(),
  du: result.du,
  name: result.name,
  states: result.states,
  overlay: result.overlay,
})

const censusOf = (name) => {
  if (!censusCache.has(name)) {
    censusCache.set(
      name,
      computeCensus(name).then((result) => {
        if (reference.recording()) {
          if (IMPL !== 'design')
            throw new Error('T-417: RECORD=1 is only allowed with IMPL=design')
          reference.write(name, referenceDocument(result))
        }
        return result
      })
    )
  }
  return censusCache.get(name)
}

const staticPart = (states) =>
  Object.fromEntries(
    Object.entries(states).map(([k, s]) => [
      k,
      { dom: s.dom, mount: s.mount, nodes: s.nodes },
    ])
  )

const interactionPart = (states) =>
  Object.fromEntries(
    Object.entries(states).map(([k, s]) => [k, s.interactions])
  )

// ---------- direct tests: mounting with the fake clock ----------
// requests in flight (census.settle waits until none is pending)
const net = { pending: 0 }
server.events.on('request:start', () => {
  net.pending += 1
})
const answered = () => {
  net.pending = Math.max(0, net.pending - 1)
}
server.events.on('response:mocked', answered)
server.events.on('request:unhandled', answered)

const settle = async () => {
  await census.settle(net)
}

const mount = async (element) => {
  let view
  await act(async () => {
    view = render(element)
  })
  await settle()
  return view
}

// console output a test expects (React errors of the hook-order quirks,
// development-only warnings); anything else still fails the test
const expectConsole = () => {
  const lines = []
  const spies = ['error', 'warn'].map((level) =>
    jest.spyOn(console, level).mockImplementation((...args) => {
      lines.push(`${level} ${util.format(...args).split('\n')[0]}`)
    })
  )
  return {
    lines,
    restore: () => spies.forEach((s) => s.mockRestore()),
  }
}

class Boundary extends React.Component {
  state = { error: null }

  static getDerivedStateFromError(error) {
    return { error }
  }

  render() {
    const { error } = this.state
    const { children } = this.props
    return error ? <p data-testid="boundary">{error.message}</p> : children
  }
}

const requests = []
server.events.on('request:start', ({ request }) => {
  requests.push({
    method: request.method,
    url: request.url,
    credentials: request.credentials,
    authorization: request.headers.get('authorization'),
  })
})

beforeAll(() => {
  census.installWindowGuards()
})

beforeEach(() => {
  census.resetEnvironment()
  census.fakeTimers()
  requests.length = 0
  net.pending = 0
})

afterEach(() => {
  census.resetEnvironment()
  restoreClock()
})

describe(`T-417 @P0 design contract (IMPL=${IMPL})`, () => {
  test('T-417 c1 @P0 the 23 components, useCookie and classNames resolve to one object through every import path the app uses', () => {
    expect(Object.keys(I).sort()).toEqual([...COMPONENTS].sort())
    expect(COMPONENT_NAMES.sort()).toEqual([...COMPONENTS].sort())
    for (const name of COMPONENTS) expect(I[name]).toBeTruthy()
    expect(typeof impl.useCookie).toBe('function')
    const p = impl.paths
    expect(p['@oacore/design/lib']).toBe(p['@oacore/design'])
    for (const name of [
      'Button',
      'Card',
      'DataProviderLogo',
      'Histoslider',
      'Icon',
      'Link',
      'LoadingBar',
      'MathMarkdown',
      'ProgressSpinner',
    ]) {
      expect(p['@oacore/design/lib/elements'][name]).toBe(
        p['@oacore/design'][name]
      )
    }
    for (const name of ['Header', 'Modal', 'Popover']) {
      expect(p['@oacore/design/lib/modules'][name]).toBe(
        p['@oacore/design'][name]
      )
    }
    expect(p['@oacore/design/lib/elements/icon'].default).toBe(I.Icon)
    expect(p['@oacore/design/lib/elements/logo'].DataProviderLogo).toBe(
      I.DataProviderLogo
    )
    expect(p['@oacore/design/lib/utils'].classNames).toBe(
      impl.classNamesNamespace
    )
    expect(p['@oacore/design/lib/utils/class-names'].default).toBe(
      impl.classNamesDefault
    )
  })

  describe.each(UNITS.map((u) => [u.name, u]))(
    'T-417 c1 @P0 %s states',
    (name, unit) => {
      test(`T-417 c1 @P0 ${name}: DOM, classes and mount effects of every state equal the package reference (${unit.du})`, async () => {
        const result = await censusOf(name)
        const ref = reference.read(name)
        expect(ref.impl).toBe('design')
        if (IMPL === 'design')
          expect(ref.package).toEqual(reference.packageIdentity())
        expect(Object.keys(result.states)).toEqual(Object.keys(unit.states))
        expect(staticPart(result.states)).toEqual(staticPart(ref.states))
      })
    }
  )

  test('T-417 c1 @P0 statics: Card, Modal, MetadataList, ExpandableList, Form, Header.useSearchBar, Select.Option (60 §6 row 14)', () => {
    for (const s of ['Title', 'Description', 'Footer'])
      expect(typeof I.Card[s]).toBe('function')
    for (const s of ['Title', 'Content', 'Footer'])
      expect(typeof I.Modal[s]).toBe('function')
    expect(I.MetadataList.Item).toBeTruthy()
    expect(I.ExpandableList.Item).toBeTruthy()
    for (const s of ['Control', 'Label', 'Group', 'Addon'])
      expect(I.Form[s]).toBeTruthy()
    expect(typeof I.Header.useSearchBar).toBe('function')
    expect(I.Select.Option).toBeTruthy()
    // names the components rely on (the Select keeps only SelectOption
    // children, findings/04 §4 row 13)
    expect(I.Select.Option.displayName).toBe('SelectOption')
    expect(I.Modal.Title.displayName).toBe('ModalTitle')
    expect(I.MetadataList.Item.displayName).toBe('MetaDataList.Item')
    expect(I.ExpandableList.displayName).toBe('ExpandableList')
    expect(I.ExpandableList.Item.displayName).toBe('ExpandableList.Item')
  })

  test('T-417 c1 @P0 classNames: the namespace (use, from, default) and the default class with statics give the same strings (60 §6 row 13)', async () => {
    const ns = impl.classNamesNamespace
    const Cls = impl.classNamesDefault
    expect(ns.default).toBe(Cls)
    expect(ns.use).toBe(Cls.use)
    expect(ns.from).toBe(Cls.from)
    expect(String(ns.use('a', { b: true, c: false }, ['d', null]))).toBe(
      'a b d'
    )
    expect(String(Cls.use('a', { b: true, c: false }, ['d', null]))).toBe(
      'a b d'
    )
    // .from maps names through a CSS module, unknown names stay as written
    expect(
      String(
        ns.use('button', 'text').from({ button: 'h-button' }).join('extra')
      )
    ).toBe('h-button text extra')
    expect(String(Cls.from({ x: 'h-x' }).use('x y'))).toBe('h-x y')
    // a ClassNames inside use() and join() is flattened
    expect(String(ns.use(Cls.use('inner'), 'outer'))).toBe('inner outer')
    expect(String(ns.use('x').join(Cls.use('y')))).toBe('x y')
    expect(String(ns.use())).toBe('')
    expect(String(ns.use(false, undefined).join(undefined))).toBe('')
    expect(ns.use('a') instanceof Cls).toBe(true)
    // React stringifies the object it gets as className
    const view = await mount(<div className={ns.use('k', { j: true })} />)
    expect(view.container.firstChild.getAttribute('class')).toBe('k j')
  })

  test('T-417 c1 @P0 useCookie: absent cookies give the declared defaults, "true"/"false" become booleans, other values stay strings', async () => {
    const Probe = ({ name }) => (
      <output data-name={name}>{String(impl.useCookie(name))}</output>
    )
    const probe = async () => {
      const view = await mount(
        <I.CookiesProvider>
          <Probe name="essential_cookies_allowed" />
          <Probe name="analytics_cookies_allowed" />
          <Probe name="other_cookie" />
        </I.CookiesProvider>
      )
      const values = Array.from(view.container.querySelectorAll('output')).map(
        (o) => o.textContent
      )
      view.unmount()
      return values
    }
    expect(await probe()).toEqual(['false', 'false', 'undefined'])
    document.cookie = 'essential_cookies_allowed=true; path=/'
    document.cookie = 'analytics_cookies_allowed=false; path=/'
    document.cookie = 'other_cookie=abc; path=/'
    expect(await probe()).toEqual(['true', 'false', 'abc'])
  })

  describe('T-417 c1 @P0 preserved behaviours (60 §6)', () => {
    const typeInto = async (user, input, text) => {
      await user.click(input)
      await user.keyboard(text)
      await settle()
    }

    test('T-417 c1 @P0 row 1 Q-084: the search bar spreads searchBarProps after the computed changeOnBlur (blur submits below 500 px unless the page passes changeOnBlur)', async () => {
      const run = async ({ width, searchBarProps }) => {
        Object.defineProperty(window, 'innerWidth', {
          configurable: true,
          writable: true,
          value: width,
        })
        const calls = []
        const config = headerConfig(
          {
            spy:
              () =>
              (...args) =>
                calls.push(args),
          },
          searchBarProps ? { searchBarProps } : {}
        )
        const view = await mount(
          <I.DesignProvider>
            <HeaderPage I={I} config={config} isHidden={false} />
          </I.DesignProvider>
        )
        const user = census.userSetup()
        const input = screen.getByRole('combobox')
        await typeInto(user, input, 'abc')
        calls.length = 0
        await act(async () => {
          input.blur()
        })
        await settle()
        view.unmount()
        return calls
      }
      // /data-providers/ (no changeOnBlur in searchBarProps)
      expect(await run({ width: 1024 })).toEqual([])
      expect(await run({ width: 499 })).toEqual([['abc']])
      // /search/ passes changeOnBlur: false, which wins over the width
      const searchProps = {
        label: 'Search',
        prependIcon: '#magnify',
        changeOnBlur: false,
      }
      expect(await run({ width: 499, searchBarProps: searchProps })).toEqual([])
      // and true wins over a wide window
      expect(
        await run({
          width: 1024,
          searchBarProps: { ...searchProps, changeOnBlur: true },
        })
      ).toEqual([['abc']])
    })

    test('T-417 c1 @P0 row 2: header menus close through a document.body click listener (outside the header or on a link)', async () => {
      const user = census.userSetup()
      await mount(<I.Header id="du-header" />)
      const services = screen.getByRole('button', { name: 'Services' })
      await user.click(services)
      await settle()
      expect(services.getAttribute('aria-expanded')).toBe('true')
      expect(
        document.getElementById('du-header').getAttribute('class')
      ).toMatch(/styles-expanded-/)
      await user.click(document.body)
      await settle()
      expect(services.getAttribute('aria-expanded')).toBe('false')
      await user.click(services)
      await settle()
      expect(services.getAttribute('aria-expanded')).toBe('true')
      await user.click(screen.getByRole('link', { name: 'API' }))
      await settle()
      expect(services.getAttribute('aria-expanded')).toBe('false')
      // another menu title switches the open menu
      await user.click(services)
      await user.click(screen.getByRole('button', { name: 'About' }))
      await settle()
      expect(services.getAttribute('aria-expanded')).toBe('false')
      expect(
        screen
          .getByRole('button', { name: 'About' })
          .getAttribute('aria-expanded')
      ).toBe('true')
    })

    test('T-417 c1 @P0 row 3 Q-047: useOutsideClick is called only while isHidden, so flipping isHidden on a mounted header crashes the search bar', async () => {
      const config = headerConfig({ spy: () => () => {} })
      const Page = ({ hidden }) => (
        <Boundary>
          <HeaderPage I={I} config={config} isHidden={hidden} />
        </Boundary>
      )
      const Root = ({ hidden }) => (
        <I.DesignProvider>
          <Page hidden={hidden} />
        </I.DesignProvider>
      )
      const logs = expectConsole()
      try {
        const view = await mount(<Root hidden />)
        expect(screen.getByRole('img', { name: 'Search icon' })).toBeTruthy()
        await act(async () => {
          view.rerender(<Root hidden={false} />)
        })
        await settle()
        expect(screen.getByTestId('boundary').textContent).toBe(
          'Rendered fewer hooks than expected. This may be caused by an accidental early return statement.'
        )
      } finally {
        logs.restore()
      }
      expect(
        logs.lines.some((l) => /Rendered fewer hooks than expected/.test(l))
      ).toBe(true)
    })

    test('T-417 c1 @P0 row 4 Q-089: the header renders the id about-title twice (menu title and group title)', async () => {
      await mount(<I.Header id="du-header" />)
      const dup = Array.from(document.querySelectorAll('[id="about-title"]'))
      expect(dup.map((e) => e.tagName.toLowerCase())).toEqual(['button', 'h3'])
    })

    test('T-417 c1 @P0 row 5 Q-068: the advanced-search stylesheet of the closure resets every ul globally', () => {
      const text = css('modules/header/advanced-search.css')
      expect(text).toMatch(
        /(^|\n)ul\{\n {2}padding:0;\n {2}margin:0;\n {2}list-style:none;\n\}/
      )
      // the global stylesheet the app imports (pages/_app.jsx:18) pulls it in
      expect(css('index.css')).toMatch(/modules\/index\.css/)
      expect(css('modules/index.css')).toMatch(
        /@import url\("header\/advanced-search\.css"\);/
      )
    })

    test('T-417 c1 @P0 row 6 Q-085 Q-068: modal z 1030 under the header z 10000, mount = open, focus lock with return, body overflow hidden then unset, Esc only with focus inside, aria-label twice, the first-render onClose', async () => {
      expect(css('modules/modal/modal.css')).toMatch(
        /\.modal-overlay-root-[\w-]+\{[^}]*z-index:calc\(1020 \+ 10\);/
      )
      expect(css('modules/header/styles.css')).toMatch(
        /--header-z-index:10000;/
      )
      const first = jest.fn()
      const second = jest.fn()
      const Page = ({ open, onClose }) => (
        <div>
          <button type="button">trigger</button>
          {open && (
            <I.Modal aria-label="Demo modal" onClose={onClose}>
              <I.Modal.Title>Title</I.Modal.Title>
              <I.Modal.Content>Content</I.Modal.Content>
            </I.Modal>
          )}
        </div>
      )
      const view = await mount(<Page open={false} onClose={first} />)
      const trigger = screen.getByRole('button', { name: 'trigger' })
      await act(async () => {
        trigger.focus()
      })
      await act(async () => {
        view.rerender(<Page open onClose={first} />)
      })
      await settle()
      // mounted = open, portal into #modal-root
      const dialog = screen.getByRole('dialog')
      expect(document.getElementById('modal-root').contains(dialog)).toBe(true)
      expect(document.body.style.overflow).toBe('hidden')
      // the rest props reach the overlay and the dialog
      expect(
        Array.from(document.querySelectorAll('[aria-label="Demo modal"]')).map(
          (e) => e.getAttribute('role') || e.tagName.toLowerCase()
        )
      ).toEqual(['div', 'dialog'])
      // focus is locked inside (close button first)
      expect(dialog.contains(document.activeElement)).toBe(true)
      expect(document.activeElement.getAttribute('aria-label')).toBe('Close')
      // the handlers keep the first onClose
      await act(async () => {
        view.rerender(<Page open onClose={second} />)
      })
      await settle()
      const user = census.userSetup()
      await user.keyboard('{Escape}')
      expect(first).toHaveBeenCalledTimes(1)
      expect(second).not.toHaveBeenCalled()
      // the close button reads the current prop
      await user.click(screen.getByRole('button', { name: 'Close' }))
      expect(second).toHaveBeenCalledTimes(1)
      // Esc with the focus outside the overlay does nothing
      await act(async () => {
        document.activeElement.blur()
      })
      await act(async () => {
        document.body.dispatchEvent(
          new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })
        )
      })
      expect(first).toHaveBeenCalledTimes(1)
      // unmount: overflow unset, focus back on the trigger, root kept
      await act(async () => {
        view.rerender(<Page open={false} onClose={second} />)
      })
      await settle()
      expect(document.body.style.overflow).toBe('unset')
      expect(document.activeElement).toBe(trigger)
      expect(document.getElementById('modal-root')).not.toBeNull()
    })

    test('T-417 c1 @P0 row 6 Q-085: hideManually renders no close button and ignores Esc and the overlay', async () => {
      const onClose = jest.fn()
      await mount(
        <I.Modal aria-labelledby="t" hideManually onClose={onClose}>
          <I.Modal.Title id="t">Manual</I.Modal.Title>
          <I.Button>Inside</I.Button>
        </I.Modal>
      )
      expect(screen.queryByRole('button', { name: 'Close' })).toBeNull()
      const user = census.userSetup()
      await user.keyboard('{Escape}')
      await user.click(screen.getByRole('dialog').parentElement)
      expect(onClose).not.toHaveBeenCalled()
    })

    test('T-417 c1 @P0 row 7 Q-070 Q-051: the consent popup renders without essential_cookies_allowed, only when window exists, and not on /cookies', async () => {
      const shown = async () => {
        const view = await mount(
          <I.CookiesProvider>
            <I.Cookies />
          </I.CookiesProvider>
        )
        const popup = document.getElementById('cookies-popup')
        view.unmount()
        return popup !== null
      }
      expect(await shown()).toBe(true)
      document.cookie = 'analytics_cookies_allowed=true; path=/'
      expect(await shown()).toBe(true)
      document.cookie = 'essential_cookies_allowed=true; path=/'
      expect(await shown()).toBe(false)
      census.resetEnvironment()
      window.history.replaceState(null, '', '/cookies')
      expect(await shown()).toBe(false)
      // server render (Node, no window): nothing
      const script = [
        "const React = require('react')",
        "const { renderToString } = require('react-dom/server')",
        "const Cookies = require('@oacore/design/lib/elements/cookies').default",
        "const Provider = require('@oacore/design/lib/elements/cookies/cookies-provider').default",
        'process.stdout.write(JSON.stringify(renderToString(React.createElement(Provider, null, React.createElement(Cookies)))))',
      ].join(';')
      const ssr = execFileSync(process.execPath, ['-e', script], {
        cwd: ROOT,
        encoding: 'utf8',
        env: { PATH: process.env.PATH, NODE_ENV: 'production' },
      })
      expect(JSON.parse(ssr)).toBe('')
    })

    test('T-417 c1 @P0 row 8 Q-072 c1 c2: Card passes tag to its root; the HTML parser hoists the inner anchors (0 inside without JS), and React 19 hydration reports a hydration error and renders the card on the client', async () => {
      const card = (
        <I.Card tag="a" href="/download/1.pdf" variant="outlined">
          <I.Button tag="a" href="/reader/1" variant="contained">
            Read
          </I.Button>
          <I.Button tag="a" href="/download/1">
            Download
          </I.Button>
        </I.Card>
      )
      const html = ReactDOMServer.renderToString(card)
      expect(html).toMatch(/^<a class="card-container-[\w-]+ card-outlined-/)
      const box = document.createElement('div')
      document.body.appendChild(box)
      box.innerHTML = html
      const inner = () => box.firstElementChild.querySelectorAll('a').length
      expect(box.querySelectorAll('a')).toHaveLength(3)
      expect(inner()).toBe(0)
      const logs = expectConsole()
      // React 19 reports the recoverable hydration error as a window `error`
      // event (no reportError in jsdom; React 18 logged it instead)
      const reported = []
      const onError = (event) => {
        reported.push(String(event.error && event.error.message))
        event.preventDefault()
      }
      window.addEventListener('error', onError)
      let root
      try {
        await act(async () => {
          root = hydrateRoot(box, card)
        })
      } finally {
        window.removeEventListener('error', onError)
        logs.restore()
      }
      expect(inner()).toBe(2)
      expect(box.children).toHaveLength(1)
      expect(reported).toHaveLength(1)
      expect(reported[0]).toMatch(
        /^Hydration failed because the server rendered HTML didn't match the client/
      )
      // development builds of React 19 log these lines (React 18: 7 lines,
      // AD-170); production builds print no warning and report the failed
      // hydration as a minified React error (T-802 du-04-tag-a, TC-5)
      expect(logs.lines).toEqual([
        'error In HTML, <a> cannot be a descendant of <a>.',
        'error <a> cannot contain a nested <a>.',
      ])
      act(() => root.unmount())
      // a client render nests them directly
      const view = await (async () => {
        const c = expectConsole()
        try {
          return await mount(card)
        } finally {
          c.restore()
        }
      })()
      expect(view.container.firstElementChild.tagName).toBe('A')
      expect(
        view.container.firstElementChild.querySelectorAll('a')
      ).toHaveLength(2)
    })

    test('T-417 c1 @P0 row 9 Q-047: ExpandableList calls useCallback after its early return, so crossing 4 children on a mounted list crashes (React #310)', async () => {
      const items = (n) =>
        Array.from({ length: n }, (_, i) => (
          <I.ExpandableList.Item key={i}>{`Item ${i}`}</I.ExpandableList.Item>
        ))
      const List = ({ n }) => (
        <Boundary>
          <I.ExpandableList aria-label="list">{items(n)}</I.ExpandableList>
        </Boundary>
      )
      const logs = expectConsole()
      try {
        const view = await mount(<List n={4} />)
        expect(screen.queryByRole('button')).toBeNull()
        await act(async () => {
          view.rerender(<List n={5} />)
        })
        expect(screen.getByTestId('boundary').textContent).toBe(
          'Rendered more hooks than during the previous render.'
        )
        view.unmount()
        const back = await mount(<List n={6} />)
        await act(async () => {
          back.rerender(<List n={3} />)
        })
        expect(screen.getByTestId('boundary').textContent).toBe(
          'Rendered fewer hooks than expected. This may be caused by an accidental early return statement.'
        )
      } finally {
        logs.restore()
      }
    })

    test('T-417 c1 @P0 row 9: more than 4 items show 2 and "+N more"; focusing the button expands and moves the focus to the third item', async () => {
      await mount(
        <I.ExpandableList aria-label="list">
          {['a', 'b', 'c', 'd', 'e'].map((t) => (
            <I.ExpandableList.Item key={t}>
              <a href={`/search/?q=${t}`}>{t}</a>
            </I.ExpandableList.Item>
          ))}
        </I.ExpandableList>
      )
      const more = screen.getByTitle('Show more')
      expect(more.textContent).toBe('+3 more')
      const hidden = Array.from(document.querySelectorAll('li')).map((li) =>
        /expandable-list-hide-/.test(li.getAttribute('class') || '')
      )
      expect(hidden).toEqual([false, false, false, true, true, true])
      await act(async () => {
        more.focus()
      })
      await settle()
      expect(document.activeElement.textContent).toBe('c')
    })

    test('T-417 c1 @P0 row 10 Q-090 (b) E22: one browser GET of api.core.ac.uk/data-providers/{id}/logo per provider per card, no dedupe, no Authorization', async () => {
      const images = () =>
        Array.from(document.querySelectorAll('img[alt]')).map((i) =>
          i.getAttribute('src')
        )
      const view = await mount(
        <div>
          <I.SearchResult id="c1" data={SEARCH_RESULT_DATA} />
          <I.SearchResult
            id="c2"
            data={{ ...SEARCH_RESULT_DATA, dataProviders: [PROVIDER_A] }}
          />
        </div>
      )
      const a = `https://api.core.ac.uk/data-providers/${PROVIDER_A.id}/logo`
      const b = `https://api.core.ac.uk/data-providers/${PROVIDER_B.id}/logo`
      expect(requests).toEqual([
        {
          method: 'GET',
          url: a,
          credentials: 'same-origin',
          authorization: null,
        },
        {
          method: 'GET',
          url: b,
          credentials: 'same-origin',
          authorization: null,
        },
        {
          method: 'GET',
          url: a,
          credentials: 'same-origin',
          authorization: null,
        },
      ])
      // a recorded 200 answer shows the logo with the request URL as src
      // (each card also shows its thumbnail after the logos)
      const thumb = SEARCH_RESULT_DATA.thumbnailUrl
      expect(images()).toEqual([a, b, thumb, a, thumb])
      view.unmount()
      // useLogo={false}: no request
      requests.length = 0
      await mount(
        <I.SearchResult id="c3" useLogo={false} data={SEARCH_RESULT_DATA} />
      )
      expect(requests).toEqual([])
    })

    test('T-417 c1 @P0 row 10 Q-047 Q-090: the logo hooks run inside dataProviders.map, so a different provider count on a mounted card crashes', async () => {
      const Card = ({ providers }) => (
        <Boundary>
          <I.SearchResult
            id="c4"
            data={{ ...SEARCH_RESULT_DATA, dataProviders: providers }}
          />
        </Boundary>
      )
      const logs = expectConsole()
      try {
        const view = await mount(<Card providers={[PROVIDER_A]} />)
        await act(async () => {
          view.rerender(<Card providers={[PROVIDER_A, PROVIDER_B]} />)
        })
        await settle()
        expect(screen.getByTestId('boundary').textContent).toBe(
          'Rendered more hooks than during the previous render.'
        )
      } finally {
        logs.restore()
      }
    })

    test('T-417 c1 @P0 row 11 Q-068: Fieldset marks items[0] active after mount without calling onClick, throws on empty items; its stylesheet keeps @media (--screen-until-desktop)', async () => {
      const onClick = jest.fn()
      const user = census.userSetup()
      const view = await mount(
        <I.Fieldset items={FIELDSET_ITEMS} title="Who" onClick={onClick} />
      )
      const boxes = () =>
        Array.from(view.container.querySelectorAll('fieldset > div > div')).map(
          (b) => /fieldset-box-item-active-/.test(b.getAttribute('class'))
        )
      expect(boxes()).toEqual([true, false, false])
      expect(onClick).not.toHaveBeenCalled()
      await user.click(screen.getByText('Second item'))
      expect(onClick).toHaveBeenCalledWith('secondItem')
      expect(boxes()).toEqual([false, true, false])
      view.unmount()
      const logs = expectConsole()
      try {
        await mount(
          <Boundary>
            <I.Fieldset items={[]} title="Empty" onClick={onClick} />
          </Boundary>
        )
      } finally {
        logs.restore()
      }
      expect(screen.getByTestId('boundary').textContent).toBe(
        "Cannot read properties of undefined (reading 'value')"
      )
      expect(css('elements/fieldset/fieldset.css')).toMatch(
        /@media \(--screen-until-desktop\)\{/
      )
    })

    test('T-417 c1 @P0 row 12 R-056: Popover triggers on mouseenter and focus unless visible is given; trigger="click" shows on click only', async () => {
      const user = census.userSetup()
      const tip = () => document.querySelector('[data-tippy-root]')
      const run = async (element, action) => {
        const view = await mount(element)
        await action(screen.getByRole('button'))
        await settle()
        const t = tip()
        const out = t ? t.textContent : null
        view.unmount()
        census.resetEnvironment()
        return out
      }
      const pop = (props) => (
        <I.Popover content="Tip" {...props}>
          <I.Button>Trigger</I.Button>
        </I.Popover>
      )
      expect(await run(pop({}), (b) => user.hover(b))).toBe('Tip')
      expect(
        await run(pop({}), (b) =>
          act(async () => {
            b.focus()
          })
        )
      ).toBe('Tip')
      expect(await run(pop({ visible: false }), (b) => user.hover(b))).toBe(
        null
      )
      expect(await run(pop({ visible: true }), async () => {})).toBe('Tip')
      expect(await run(pop({ trigger: 'click' }), (b) => user.hover(b))).toBe(
        null
      )
      expect(await run(pop({ trigger: 'click' }), (b) => user.click(b))).toBe(
        'Tip'
      )
    })

    test('T-417 c1 @P0 row 15 Q-066: the button focus ring keeps the unresolved color-mod()', () => {
      expect(css('elements/button/button.css')).toMatch(
        /color-mod\(var\(--primary\) alpha\(25%\)\)/
      )
    })

    test('T-417 c1 @P0 row 16 Q-067: design and app icon configs both list office-building, account and open-in-new; production lists 31 + 17 = 48 icons (dev adds file-check)', () => {
      const load = (file, nodeEnv) => {
        const saved = process.env.NODE_ENV
        process.env.NODE_ENV = nodeEnv
        let config
        jest.isolateModules(() => {
          config = require(file)
        })
        process.env.NODE_ENV = saved
        return config.icons.files.map((f) => path.basename(f, '.svg'))
      }
      const designProd = load(
        path.join(impl.root, 'design.config.js'),
        'production'
      )
      const designDev = load(path.join(impl.root, 'design.config.js'), 'test')
      const app = load(path.join(ROOT, 'design.config.js'), 'production')
      expect(designProd).toHaveLength(31)
      expect(designDev).toEqual([...designProd, 'file-check'])
      expect(app).toHaveLength(17)
      expect(designProd.filter((id) => app.includes(id)).sort()).toEqual([
        'account',
        'office-building',
        'open-in-new',
      ])
    })

    test('T-417 c1 @P0 row 17 R-012 R-059: Histoslider and MathMarkdown defaults', () => {
      // React 19 ignores defaultProps on function components: the design
      // applies the same values inside each component (CS-R19-2, CS-R19-3), so
      // a bare element renders the DOM of one that passes them all
      const html = (Component, props) => {
        const view = render(React.createElement(Component, props))
        const out = view.container.innerHTML
        view.unmount()
        return out
      }
      const same = (Component, defaults, bare) => {
        expect(Component.defaultProps).toBeUndefined()
        expect(html(Component, bare)).toBe(
          html(Component, { ...defaults, ...bare })
        )
      }
      same(
        I.Histoslider,
        {
          selectedBarColor: '#EF8237',
          rangeColor: '#b75400',
          unselectedColor: '#E0E0E0',
          showOnDrag: false,
          width: 300,
          height: 200,
          barBorderRadius: 2,
          barPadding: 2,
          padding: 20,
          sliderHeight: 20,
          handleLabelFormat: '0.5P',
          formatLabelFunction: undefined,
          showLabels: false,
        },
        {
          data: [
            { x0: 2010, x: 2011, y: 3 },
            { x0: 2011, x: 2012, y: 5 },
          ],
          selectFunc: () => {},
        }
      )
      same(
        I.MathMarkdown,
        {
          children: null,
          displayMode: false,
          output: 'htmlAndMathml',
          leqno: false,
          fleqn: false,
          throwOnError: true,
          errorColor: '#cc0000',
          minRuleThickness: 0,
          colorIsTextColor: false,
          strict: 'warn',
          trust: false,
          enforceOutput: false,
          breakLine: false,
        },
        { children: 'A $x^2$ and $$y$$' }
      )
    })

    test('T-417 c1 @P0 row 18 Q-097: MathMarkdown renders KaTeX only, **x** stays literal', async () => {
      const view = await mount(
        <I.MathMarkdown>A **x** and $x^2$</I.MathMarkdown>
      )
      const span = view.container.firstElementChild
      expect(span.tagName).toBe('SPAN')
      expect(span.textContent.startsWith('A **x** and ')).toBe(true)
      expect(span.querySelector('strong, b, em')).toBeNull()
      expect(span.querySelectorAll('.katex')).toHaveLength(1)
      expect(span.querySelector('.katex-mathml math')).not.toBeNull()
    })
  })

  describe.each(UNITS.map((u) => [u.name, u]))(
    'T-417 c2 @P0 %s interactions',
    (name, unit) => {
      test(`T-417 c2 @P0 ${name}: click, dblclick, hover 300 ms, focus, Enter, Space, Esc, ArrowDown on every node equal the package reference (${unit.du})`, async () => {
        const result = await censusOf(name)
        const ref = reference.read(name)
        for (const [state, s] of Object.entries(result.states)) {
          const covered = [
            ...s.interactions.quiet,
            ...Object.keys(s.interactions.active),
          ].sort()
          expect([state, covered]).toEqual([state, [...s.nodes].sort()])
        }
        expect(interactionPart(result.states)).toEqual(
          interactionPart(ref.states)
        )
      })
    }
  )

  describe('T-417 c3 @P0 package reference', () => {
    test('T-417 c3 @P0 every unit has a reference taken from the installed package; no other reference file exists', () => {
      expect(reference.list()).toEqual([...COMPONENT_NAMES].sort())
      for (const name of COMPONENT_NAMES) {
        const ref = reference.read(name)
        expect(ref.impl).toBe('design')
        expect(ref.package).toMatchObject({
          name: '@oacore/design',
          version: '5.0.74',
          lockVersion: '5.0.74',
          integrity:
            'sha512-kwYolSk+PrJtJzSkhyUz/YGJKDbPcf6UpALedXnhWhNeJL/xB8PDvgGjHYq+xOZi2V7SIB9h0tueAAgR6IagrQ==',
        })
        expect(ref.name).toBe(name)
      }
    })

    test.each(UNITS.map((u) => [u.name]))(
      'T-417 c3 @P0 %s: a second census in a fresh module registry equals the first and the package reference',
      async (name) => {
        const first = await censusOf(name)
        const second = await computeCensus(name)
        expect(second).toEqual(first)
        const ref = reference.read(name)
        expect({ states: second.states, overlay: second.overlay }).toEqual({
          states: ref.states,
          overlay: ref.overlay,
        })
      }
    )
  })

  describe.each(UNITS.filter((u) => u.overlay).map((u) => [u.overlay.kind, u]))(
    'T-417 c4 @P0 overlay %s',
    (kind, unit) => {
      test(`T-417 c4 @P0 ${kind} open (${unit.name}): window blur, scroll by 100 px, resize by +1 and -1 px give the DOM mutations, focus and network of the package reference`, async () => {
        const result = await censusOf(unit.name)
        const ref = reference.read(unit.name)
        expect(Object.keys(result.overlay)).toEqual([
          'kind',
          'state',
          'open',
          'openDom',
          ...census.WINDOW_EVENTS,
        ])
        expect(result.overlay).toEqual(ref.overlay)
      })
    }
  )

  test('T-417 c4 @P0 the overlay census covers modal, select, popover and dropdown', () => {
    expect(
      UNITS.filter((u) => u.overlay)
        .map((u) => u.overlay.kind)
        .sort()
    ).toEqual(['dropdown', 'modal', 'popover', 'select'])
  })
})
