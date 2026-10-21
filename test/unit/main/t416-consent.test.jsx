// T-416 (41 E, R-041): the consent popup of main/index.jsx with the real design
// library. Q-070: the popup is keyed on `essential_cookies_allowed` alone;
// "Essential cookies only" writes that cookie, "I agree" writes it and
// `analytics_cookies_allowed`; value `true`, `Path=/`, one year, no other
// attribute; both cookies are first removed without a path; consent given after
// mount is applied at the next load only.
import React from 'react'
import ReactGA from 'react-ga4'

import { render, screen, userEvent, withRouter } from '../../utils/render'
import Main from '../../../main'

jest.setTimeout(30000)

const ESSENTIAL = 'essential_cookies_allowed'
const ANALYTICS = 'analytics_cookies_allowed'
const YEAR = 365 * 24 * 60 * 60

// document.cookie as jsdom implements it, and every string assigned to it
const cookieDescriptor = Object.getOwnPropertyDescriptor(
  Document.prototype,
  'cookie'
)
const writes = []

const initialState = { statistics: { totalArticlesCount: 5 } }

const mount = () =>
  render(
    <Main initialState={initialState}>
      <p>page content</p>
    </Main>,
    { wrapper: withRouter() }
  )

const popup = () => document.getElementById('cookies-popup')

// a cookie as the browser would hold it before the page is loaded
const preset = (name) => {
  cookieDescriptor.set.call(document, `${name}=true; Path=/`)
}

const wipe = () => {
  for (const name of [ESSENTIAL, ANALYTICS])
    cookieDescriptor.set.call(document, `${name}=; Max-Age=0; Path=/`)
}

beforeEach(() => {
  wipe()
  writes.length = 0
  Object.defineProperty(document, 'cookie', {
    configurable: true,
    get() {
      return cookieDescriptor.get.call(this)
    },
    set(value) {
      writes.push(value)
      cookieDescriptor.set.call(this, value)
    },
  })
  ReactGA.initialize.mockClear()
  ReactGA.send.mockClear()
  window.history.pushState({}, '', '/')
  delete window.ga
})

afterEach(() => {
  delete document.cookie
  wipe()
})

describe('T-416 @P0 consent popup and cookie writes', () => {
  test('T-416 @P0 without the essential cookie the popup is shown and nothing is written', () => {
    mount()
    const box = popup()
    expect(box).not.toBeNull()
    expect(box.querySelector('p').textContent).toBe(
      'We use cookies to improve our website.'
    )
    const learnMore = screen.getByRole('link', { name: 'Learn more' })
    expect(learnMore.getAttribute('href')).toBe('/cookies')

    const essential = screen.getByRole('button', {
      name: 'Essential cookies only',
    })
    const agree = screen.getByRole('button', { name: 'I agree' })
    expect(box.querySelectorAll('button')).toHaveLength(2)
    // the button ids carry the cookie names the handler writes
    expect(essential.id).toBe(ESSENTIAL)
    expect(agree.id).toBe(`${ESSENTIAL},${ANALYTICS}`)
    // the page content is rendered next to the popup
    expect(screen.getByText('page content')).toBeTruthy()
    expect(writes).toEqual([])
    expect(document.cookie).toBe('')
  })

  test('T-416 @P0 "Essential cookies only" removes both cookies without a path, then writes the essential one', async () => {
    mount()
    await userEvent
      .setup()
      .click(screen.getByRole('button', { name: 'Essential cookies only' }))

    expect(writes).toEqual([
      `${ESSENTIAL}=; Max-Age=0; Expires=Sun, 01 Feb 1970 00:00:01 GMT`,
      `${ANALYTICS}=; Max-Age=0; Expires=Sun, 01 Feb 1970 00:00:01 GMT`,
      `${ESSENTIAL}=true; Max-Age=${YEAR}; Path=/`,
    ])
    expect(document.cookie).toBe(`${ESSENTIAL}=true`)
    expect(popup()).toBeNull()
    // the rest of the page stays
    expect(screen.getByText('page content')).toBeTruthy()
  })

  test('T-416 @P0 "I agree" removes both cookies, then writes essential and analytics', async () => {
    mount()
    await userEvent
      .setup()
      .click(screen.getByRole('button', { name: 'I agree' }))

    expect(writes).toEqual([
      `${ESSENTIAL}=; Max-Age=0; Expires=Sun, 01 Feb 1970 00:00:01 GMT`,
      `${ANALYTICS}=; Max-Age=0; Expires=Sun, 01 Feb 1970 00:00:01 GMT`,
      `${ESSENTIAL}=true; Max-Age=${YEAR}; Path=/`,
      `${ANALYTICS}=true; Max-Age=${YEAR}; Path=/`,
    ])
    expect(document.cookie.split('; ').sort()).toEqual([
      `${ANALYTICS}=true`,
      `${ESSENTIAL}=true`,
    ])
    expect(popup()).toBeNull()
  })

  test('T-416 @P0 the written cookies carry value true, Path=/ and Max-Age of one year, no other attribute', async () => {
    mount()
    await userEvent
      .setup()
      .click(screen.getByRole('button', { name: 'I agree' }))

    const sets = writes.filter((w) => !w.includes('Max-Age=0'))
    expect(sets).toHaveLength(2)
    for (const w of sets) {
      const [pair, ...attributes] = w.split('; ')
      expect(pair).toMatch(/^(essential|analytics)_cookies_allowed=true$/)
      expect(attributes).toEqual([`Max-Age=${YEAR}`, 'Path=/'])
    }
    // the removals carry no Path (so they clear a cookie of the current path
    // only), no Domain, no Secure, no SameSite
    const removals = writes.filter((w) => w.includes('Max-Age=0'))
    expect(removals).toHaveLength(2)
    for (const w of removals)
      expect(w).not.toMatch(/Path=|Domain=|Secure|SameSite|HttpOnly/)
  })

  test('T-416 @P0 the popup is keyed on the essential cookie alone: gone when it is set, still shown with only the analytics cookie', () => {
    preset(ESSENTIAL)
    const { unmount } = mount()
    expect(popup()).toBeNull()
    expect(writes).toEqual([])
    unmount()

    // analytics alone does not hide the popup
    wipe()
    preset(ANALYTICS)
    mount()
    expect(popup()).not.toBeNull()
    expect(writes).toEqual([])
  })

  test('T-416 @P0 the popup is not shown on /cookies', () => {
    window.history.pushState({}, '', '/cookies')
    mount()
    expect(popup()).toBeNull()
    expect(writes).toEqual([])
  })

  test('T-416 @P0 consent given after mount is applied at the next load (Q-070)', async () => {
    const first = mount()
    expect(window.ga).toBeUndefined()
    await userEvent
      .setup()
      .click(screen.getByRole('button', { name: 'I agree' }))
    // the analytics hook read its cookie at mount: still off in this load
    expect(window.ga).toBeUndefined()
    expect(ReactGA.initialize).not.toHaveBeenCalled()
    const writesOfThisLoad = writes.length
    first.unmount()

    // next load: both cookies are present, the popup is gone and the hook
    // switches analytics on (outside production: the `ga` logging stub)
    mount()
    expect(popup()).toBeNull()
    expect(typeof window.ga).toBe('function')
    expect(writes).toHaveLength(writesOfThisLoad)
  })
})
