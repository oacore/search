// T-012 (41 A): harness self-tests in the Jest `dom` project (c1-c4), plus the
// dom-only setup contract.
const React = require('react')

const { registerProjectChecks } = require('../../utils/harness-checks')
const {
  render,
  screen,
  fireEvent,
  waitFor,
  renderHook,
  withRouter,
  userEvent,
} = require('../../utils/render')
const { FIXED_NOW } = require('../../utils/clock')

registerProjectChecks('dom')

describe('T-012 harness self-tests (dom project setup)', () => {
  test('T-012 c4 @P0 withRouter provides the mock router through RouterContext (dom)', () => {
    const NextLink = require('next/link').default
    const router = require('next/router').default
    render(
      React.createElement(
        NextLink,
        { href: '/data-providers/86' },
        React.createElement('a', null, 'provider')
      ),
      { wrapper: withRouter() }
    )
    const link = screen.getByRole('link', { name: 'provider' })
    expect(link.getAttribute('href')).toBe('/data-providers/86')
    fireEvent.click(link)
    expect(router.push).toHaveBeenCalledTimes(1)
  })

  test('T-012 c3 @P0 render helpers: dom-10 queries, act-wrapped events, local renderHook, frozen Date (dom)', async () => {
    const Counter = () => {
      const [n, setN] = React.useState(0)
      return React.createElement(
        'button',
        { type: 'button', onClick: () => setN(n + 1) },
        `count ${n}`
      )
    }
    render(React.createElement(Counter))
    await userEvent.setup().click(screen.getByRole('button'))
    await waitFor(() =>
      expect(screen.getByRole('button').textContent).toBe('count 1')
    )
    const { result } = renderHook(() => React.useState(Date.now())[0])
    expect(result.current).toBe(FIXED_NOW)
    expect(new Date().toISOString()).toBe('2026-01-15T12:00:00.000Z')
  })
})
