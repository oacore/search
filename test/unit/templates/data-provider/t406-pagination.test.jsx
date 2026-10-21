// T-406 (41 E, R-013): provider pagination with the real design library and
// next/link. Hrefs at offsets 0/10/90 of 100 (Q-044: Previous points at the
// current offset because the component asks for 'PREVIOUS' while the switch
// knows 'PREV'; Next and Last end on an empty page when total % limit is 0),
// exactly one <a> per control (R-013: no nested anchors), aria-disabled, and
// the pointer-events trap (Q-083: a disabled arrow is only styled and
// aria-disabled, a keyboard or forced click still navigates).
import fs from 'fs'
import path from 'path'

import React from 'react'
import routerMock, { setRouter } from 'next/router'

import {
  render,
  screen,
  fireEvent,
  userEvent,
  withRouter,
} from '../../../utils/render'
import Pagination from '../../../../templates/data-provider/pagination'

jest.setTimeout(30000)

const CONTROLS = ['First', 'Previous', 'Next', 'Last']
const ICONS = {
  First: '#chevron-double-left',
  Previous: '#chevron-left',
  Next: '#chevron-right',
  Last: '#chevron-double-right',
}

// the page the pager sits on: /data-providers/<id> with the given query string
const mountAt = (asPath, props = {}) => {
  const [, search = ''] = asPath.split('?')
  setRouter({
    pathname: '/data-providers/[id]',
    asPath,
    query: {
      id: '86',
      ...Object.fromEntries(new URLSearchParams(search).entries()),
    },
  })
  return render(<Pagination total={100} {...props} />, {
    wrapper: withRouter(),
  })
}

const controls = () =>
  Object.fromEntries(
    CONTROLS.map((name) => [name, screen.getByRole('link', { name })])
  )

const hrefs = () =>
  Object.fromEntries(
    Object.entries(controls()).map(([name, a]) => [
      name,
      a.getAttribute('href'),
    ])
  )

const disabled = () =>
  Object.fromEntries(
    Object.entries(controls()).map(([name, a]) => [
      name,
      a.getAttribute('aria-disabled'),
    ])
  )

describe('T-406 @P0 provider pagination', () => {
  const AT_OFFSET = {
    0: {
      First: '/data-providers/86?offset=0',
      Previous: '/data-providers/86?offset=0',
      Next: '/data-providers/86?offset=10',
      Last: '/data-providers/86?offset=100',
    },
    10: {
      First: '/data-providers/86?offset=0',
      Previous: '/data-providers/86?offset=10',
      Next: '/data-providers/86?offset=20',
      Last: '/data-providers/86?offset=100',
    },
    90: {
      First: '/data-providers/86?offset=0',
      Previous: '/data-providers/86?offset=90',
      Next: '/data-providers/86?offset=100',
      Last: '/data-providers/86?offset=100',
    },
  }
  for (const [offset, expected] of Object.entries(AT_OFFSET)) {
    test(`T-406 c1 @P0 hrefs at offset ${offset} of 100 (Q-044)`, () => {
      mountAt(`/data-providers/86?offset=${offset}`)
      expect(hrefs()).toEqual(expected)
    })
  }

  test('T-406 c1 @P0 no offset in the URL counts as 0 and the other params keep their place', () => {
    mountAt('/data-providers/86')
    expect(hrefs()).toEqual({
      First: '/data-providers/86?offset=0',
      Previous: '/data-providers/86?offset=0',
      Next: '/data-providers/86?offset=10',
      Last: '/data-providers/86?offset=100',
    })
    expect(screen.getByText(/Showing/).textContent).toBe('Showing 1-10 of 100')
  })

  test('T-406 c1 @P0 query params stay in place, offset is replaced in place and limit drives the step', () => {
    mountAt('/data-providers/86?q=climate&offset=20&limit=5&sort=recency')
    expect(hrefs()).toEqual({
      First: '/data-providers/86?q=climate&offset=0&limit=5&sort=recency',
      Previous: '/data-providers/86?q=climate&offset=20&limit=5&sort=recency',
      Next: '/data-providers/86?q=climate&offset=25&limit=5&sort=recency',
      Last: '/data-providers/86?q=climate&offset=100&limit=5&sort=recency',
    })
    expect(screen.getByText(/Showing/).textContent).toBe('Showing 21-25 of 100')
  })

  test('T-406 c1 @P0 total 95 at offset 90: Last and Next stop at 90 and the stats read 91-100 of 95 (Q-044)', () => {
    mountAt('/data-providers/86?offset=90', { total: 95 })
    expect(hrefs()).toEqual({
      First: '/data-providers/86?offset=0',
      Previous: '/data-providers/86?offset=90',
      Next: '/data-providers/86?offset=90',
      Last: '/data-providers/86?offset=90',
    })
    expect(screen.getByText(/Showing/).textContent).toBe('Showing 91-100 of 95')
    expect(disabled()).toEqual({
      First: 'false',
      Previous: 'false',
      Next: 'true',
      Last: 'true',
    })
  })

  test('T-406 c2 @P0 one <a> per control, four in a row, no nested anchor', () => {
    const { container } = mountAt('/data-providers/86?offset=10')
    const nav = screen.getByRole('navigation', {
      name: 'Pagination Navigation',
    })
    expect(nav.tagName).toBe('NAV')
    const anchors = container.querySelectorAll('a')
    expect(anchors).toHaveLength(4)
    expect(container.querySelectorAll('a a')).toHaveLength(0)
    expect([...anchors].map((a) => a.getAttribute('aria-label'))).toEqual(
      CONTROLS
    )

    // the four anchors are the children of one wrapper, nothing between them
    const wrapper = anchors[0].parentElement
    expect([...wrapper.children]).toEqual([...anchors])
    expect(wrapper.parentElement.className).toBe('arrow-pagination')

    const titles = {
      First: 'Navigate to the first page',
      Previous: 'Navigate to the previous page',
      Next: 'Navigate to the next page',
      Last: 'Navigate to the last page',
    }
    for (const [name, a] of Object.entries(controls())) {
      expect(a.tagName).toBe('A')
      expect(a.getAttribute('title')).toBe(titles[name])
      expect(a.hasAttribute('target')).toBe(false)
      expect(a.hasAttribute('rel')).toBe(false)
      // each anchor holds exactly its icon from the served sprite
      expect([...a.children].map((e) => e.tagName.toLowerCase())).toEqual([
        'svg',
      ])
      expect(a.firstElementChild.getAttribute('role')).toBe('img')
      expect(a.querySelector('use').getAttribute('href')).toBe(
        `/static/search/icons.svg${ICONS[name]}`
      )
    }
    // no <button>: the arrows are links, so they are reachable by Tab
    expect(container.querySelectorAll('button')).toHaveLength(0)
  })

  test('T-406 c3 @P0 aria-disabled is a string on every control and follows offset and total', () => {
    const states = {}
    for (const offset of [0, 10, 90]) {
      const { unmount } = mountAt(`/data-providers/86?offset=${offset}`)
      states[offset] = disabled()
      unmount()
    }
    expect(states).toEqual({
      0: { First: 'true', Previous: 'true', Next: 'false', Last: 'false' },
      10: { First: 'false', Previous: 'false', Next: 'false', Last: 'false' },
      90: { First: 'false', Previous: 'false', Next: 'true', Last: 'true' },
    })
  })

  test('T-406 c3 @P0 the class `disabled` is on the same controls as aria-disabled, the href stays', () => {
    for (const [offset, off] of [
      [0, ['First', 'Previous']],
      [90, ['Next', 'Last']],
    ]) {
      const { unmount } = mountAt(`/data-providers/86?offset=${offset}`)
      for (const [name, a] of Object.entries(controls())) {
        const tokens = a.className.split(/\s+/)
        expect(tokens).toContain('arrow')
        expect(tokens.includes('disabled')).toBe(off.includes(name))
        expect(a.getAttribute('href')).toMatch(/^\/data-providers\/86\?offset=/)
        expect(a.hasAttribute('disabled')).toBe(false)
        expect(a.hasAttribute('tabindex')).toBe(false)
      }
      unmount()
    }
  })

  test('T-406 c4 @P0 Q-083: a forced click on a disabled arrow still navigates', () => {
    mountAt('/data-providers/86?offset=90')
    const next = screen.getByRole('link', { name: 'Next' })
    expect(next.getAttribute('aria-disabled')).toBe('true')
    const notPrevented = fireEvent.click(next)
    expect(notPrevented).toBe(false)
    expect(routerMock.push).toHaveBeenCalledTimes(1)
    expect(routerMock.push.mock.calls[0][0]).toBe(
      '/data-providers/86?offset=100'
    )
    expect(routerMock.push.mock.calls[0][1]).toBe(
      '/data-providers/86?offset=100'
    )
  })

  test('T-406 c4 @P0 Q-083: Enter on a focused disabled arrow navigates (keyboard)', async () => {
    mountAt('/data-providers/86?offset=0')
    const first = screen.getByRole('link', { name: 'First' })
    expect(first.getAttribute('aria-disabled')).toBe('true')
    const user = userEvent.setup()
    first.focus()
    expect(document.activeElement).toBe(first)
    await user.keyboard('{Enter}')
    expect(routerMock.push).toHaveBeenCalledTimes(1)
    expect(routerMock.push.mock.calls[0][0]).toBe('/data-providers/86?offset=0')
  })

  test('T-406 c4 @P0 an enabled arrow navigates the same way and shallow is handed to the router', () => {
    mountAt('/data-providers/86?offset=10', { shallow: true })
    fireEvent.click(screen.getByRole('link', { name: 'Next' }))
    expect(routerMock.push).toHaveBeenCalledTimes(1)
    const [href, as, options] = routerMock.push.mock.calls[0]
    expect([href, as]).toEqual([
      '/data-providers/86?offset=20',
      '/data-providers/86?offset=20',
    ])
    expect(options.shallow).toBe(true)
  })

  test('T-406 c4 @P0 Q-083: the disabled state is only a CSS rule, pointer-events none, on the class the component sets', () => {
    const css = fs.readFileSync(
      path.join(
        __dirname,
        '../../../../templates/data-provider/styles.module.css'
      ),
      'utf8'
    )
    const rule = css.match(/\.pagination \.disabled\s*\{([^}]*)\}/)
    expect(rule).not.toBeNull()
    expect(rule[1]).toMatch(/pointer-events:\s*none/)
  })
})
