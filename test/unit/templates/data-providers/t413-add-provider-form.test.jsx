// T-413 (41 E): the "Suggest a new data provider" form of /data-providers
// (templates/data-providers/form.jsx) with its message generator
// (utils/generate-form-message.jsx), the real claim store and controller, the
// real page and MSW answering from the hand fixtures of test/fixtures/hand/
// e16-claim-form (findings/06 §5.1).
//
// c1 the four messages the form shows under the URL field (neutral, created,
// duplicated, error) and the progress state while the request is out; c2 Q-038:
// a 409 whose message is not JSON makes `JSON.parse` throw while the page
// renders (generate-form-message.jsx:53).
//
// The form is reached the way a visitor reaches it: a search without a match
// (`?q=` of nothing) shows "Is there a mistake?" and the form below it (the
// page sets action=ADD when the results are empty). The wait for a request is
// the 500 ms of the debounced effect of the controller, with real timers.
import React from 'react'
import routerMock, { setRouter } from 'next/router'

import { setupMsw } from '../../../utils/msw'
import {
  render,
  screen,
  waitFor as baseWaitFor,
  fireEvent,
  userEvent,
  withRouter,
  withStore,
} from '../../../utils/render'
import RootStore from '../../../../store/root'
import DataProvidersPage, {
  getServerSideProps,
} from '../../../../pages/data-providers/index'
import generateFormMessage from '../../../../templates/data-providers/utils/generate-form-message'

// The stores write after `await` outside an action (findings/03 §2.3), which
// MobX 6 reports with a dev-only console.warn that the production build of
// MobX does not print. Switching the check off changes no state transition.

jest.setTimeout(30000)

const { server, http, HttpResponse } = setupMsw()

// waits are generous: the suites of other packages run on the same machine
const SLOW = { timeout: 8000 }
const waitFor = (callback, options) =>
  baseWaitFor(callback, { ...SLOW, ...options })

const E16 = 'https://api.core.ac.uk/internal/data-providers'
const NEUTRAL = 'It can be any resource, home page or an OAI-PMH endpoint'
const SUPPORT_EMAIL = 'theteam@core.ac.uk'
const HARVESTED = 'https://core.ac.uk/faq#harvested-by-CORE-snippet'

// A form control is reachable as `form.<name>` in a browser (named properties
// of HTMLFormElement, WHATWG HTML 4.10.3); jsdom 26 has none, and the claim
// controller validates through `formRef.current.dataProviderUrl`
// (templates/data-providers/hooks/use-claim-controller.js:28).
beforeAll(() => {
  Object.defineProperty(HTMLFormElement.prototype, 'dataProviderUrl', {
    configurable: true,
    get() {
      return this.elements.namedItem('dataProviderUrl')
    },
  })
})
afterAll(() => {
  delete HTMLFormElement.prototype.dataProviderUrl
})

let requests
let scroll
let errorSpy

beforeEach(() => {
  requests = []
  server.events.on('request:start', ({ request }) => {
    requests.push(`${request.method} ${request.url}`)
  })
  // the result list scrolls on mount; jsdom does not implement it
  scroll = jest.spyOn(window, 'scroll').mockImplementation(() => {})
})

afterEach(() => {
  server.events.removeAllListeners()
  scroll.mockRestore()
  if (errorSpy) errorSpy.mockRestore()
  errorSpy = undefined
})

// the page of a search that finds nothing: the form is shown
const mountPage = async (query = { q: 'zzzzqqq' }, { wrapper } = {}) => {
  const { props } = await getServerSideProps({ query })
  const store = new RootStore({ statistics: { totalArticlesCount: 5 } })
  const view = render(<DataProvidersPage {...props} />, {
    wrappers: [withRouter(), withStore(store), wrapper].filter(Boolean),
  })
  return { store, ...view }
}

const urlInput = () => screen.getByLabelText('Data provider URL')
const finishButton = () => screen.getByRole('button', { name: 'Finish' })
const cancelButton = () => screen.getByRole('button', { name: 'Cancel' })
const field = () => document.getElementById('data-provider-url')
const helper = () => document.getElementById('data-provider-url-helper')
// the variant of the field group. The design draws it with its own hashed
// classes (text-field-error-<hash>, text-field-success-<hash>), the plain
// token `progress` while loading, and the plain token `normal` always.
const variantOf = (el) => {
  const tokens = el.className.split(' ')
  if (tokens.includes('progress')) return 'progress'
  const [status] = tokens
    .map((t) => t.match(/^text-field-(error|success)-/))
    .filter(Boolean)
  return status ? status[1] : 'normal'
}
// the status icon in the append addon: the <use> fragment, or the spinner
const iconOf = (el) => {
  const use = el.querySelector('span svg use')
  if (use) return use.getAttribute('href').split('#')[1]
  return el.querySelector('span svg circle') ? 'spinner' : null
}

const posts = () => requests.filter((r) => r.startsWith(`POST ${E16}`))

// types a whole value in one change and waits until the request that the
// debounced effect sends for it has been answered
const enter = async (store, value) => {
  const before = posts().length
  fireEvent.change(urlInput(), { target: { value } })
  await waitFor(() => expect(store.claim.getState().query).toBe(value))
  await waitFor(() => expect(posts().length).toBe(before + 1))
  await waitFor(() => expect(store.claim.getState().isLoading).toBe(false))
}

// a boundary of the test (the app's own has no fallback, Q-010: T-415)
class Boundary extends React.Component {
  state = { error: null }

  static getDerivedStateFromError(error) {
    return { error }
  }

  componentDidCatch(error) {
    const { onCatch } = this.props
    onCatch(error)
  }

  render() {
    const { error } = this.state
    const { children } = this.props
    return error ? <p role="alert">{error.name}</p> : children
  }
}
const boundaryWith = (onCatch) => {
  const Wrapper = ({ children }) => (
    <Boundary onCatch={onCatch}>{children}</Boundary>
  )
  return Wrapper
}

describe('T-413 @P1 add-provider form', () => {
  describe('T-413 c1 @P1 the four messages', () => {
    test('T-413 c1 @P1 neutral: the hint text, variant normal, Finish disabled with no title, Cancel enabled', async () => {
      await mountPage()
      expect(screen.getByRole('heading', { level: 3 }).textContent).toBe(
        'Suggest a new data provider'
      )
      expect(helper().textContent).toBe(NEUTRAL)
      expect(variantOf(field())).toBe('normal')
      expect(iconOf(field())).toBeNull()
      const url = urlInput()
      expect(url.type).toBe('url')
      expect(url.name).toBe('dataProviderUrl')
      expect(url.required).toBe(true)
      expect(url.value).toBe('')
      expect(url.placeholder).toBe('For example, https://oro.open.ac.uk')
      // Finish needs a created provider; its title is the (never set)
      // finishButtonTitle of the message
      expect(finishButton().disabled).toBe(true)
      expect(finishButton().type).toBe('submit')
      expect(finishButton().hasAttribute('title')).toBe(false)
      expect(cancelButton().type).toBe('button')
      expect(cancelButton().disabled).toBe(false)
      expect(requests).toEqual([])
    })

    test('T-413 c1 @P1 progress: while the request is out the variant is progress and the helper is gone', async () => {
      let release
      const gate = new Promise((resolve) => {
        release = resolve
      })
      server.use(
        http.post(E16, async () => {
          await gate
          return HttpResponse.json(
            { id: 1, name: 'N', email: '' },
            { status: 201 }
          )
        })
      )
      const { store } = await mountPage()
      fireEvent.change(urlInput(), {
        target: { value: 'https://created.example.org/' },
      })
      await waitFor(() => expect(store.claim.getState().isLoading).toBe(true))
      expect(variantOf(field())).toBe('progress')
      expect(iconOf(field())).toBe('spinner')
      expect(helper().textContent).toBe('')
      expect(finishButton().disabled).toBe(true)
      release()
      await waitFor(() => expect(store.claim.getState().isLoading).toBe(false))
      expect(variantOf(field())).toBe('success')
      expect(iconOf(field())).toBe('check')
      expect(urlInput().getAttribute('aria-invalid')).toBe('false')
    })

    test('T-413 c1 @P1 created: success variant, the provider name and the e-mail link, the harvested-by-CORE link, Finish enabled', async () => {
      const { store } = await mountPage()
      await enter(store, 'https://created.example.org/')
      expect(posts()).toEqual([`POST ${E16}`])
      expect(variantOf(field())).toBe('success')
      expect(iconOf(field())).toBe('check')
      expect(urlInput().getAttribute('aria-invalid')).toBe('false')
      expect(helper().textContent).toBe(
        'We found Example Repository under the entered address and added it ' +
          'to our data provider collection. As soon as we approve adding, we ' +
          'will start harvesting and sent a confirmation email to . Join the ' +
          'community and add a harvested by CORE badge on your website.'
      )
      const [mail, badge] = [...helper().querySelectorAll('a')]
      // the fixture holds no address: the link is empty (mailto: only)
      expect(mail.getAttribute('href')).toBe('mailto:')
      expect(mail.getAttribute('title')).toBe('the administrator email address')
      expect(mail.textContent).toBe('')
      expect(badge.getAttribute('href')).toBe(HARVESTED)
      expect(badge.getAttribute('title')).toBe('Harvested by CORE Logo')
      expect(badge.textContent).toBe('harvested by CORE')
      expect(helper().querySelectorAll('a')).toHaveLength(2)
      expect(finishButton().disabled).toBe(false)
      expect(finishButton().hasAttribute('title')).toBe(false)
      expect(store.claim.getState().created.id).toBe(990001)
    })

    test('T-413 c1 @P1 created: Finish clears the field, drops the provider and returns to the neutral message', async () => {
      const { store } = await mountPage()
      await enter(store, 'https://created.example.org/')
      fireEvent.click(finishButton())
      await waitFor(() => expect(store.claim.getState().created).toBeNull())
      expect(urlInput().value).toBe('')
      expect(store.claim.getState().query).toBe('')
      expect(helper().textContent).toBe(NEUTRAL)
      expect(variantOf(field())).toBe('normal')
      expect(iconOf(field())).toBeNull()
      expect(finishButton().disabled).toBe(true)
      // no second request: an empty field sends nothing
      expect(posts()).toHaveLength(1)
    })

    test('T-413 c1 @P1 duplicated with an existing provider: error variant, link to the CORE search of its id, support address', async () => {
      const { store } = await mountPage()
      await enter(store, 'https://duplicate.example.org/')
      expect(variantOf(field())).toBe('error')
      expect(iconOf(field())).toBe('alert-circle-outline')
      expect(urlInput().getAttribute('aria-invalid')).toBe('true')
      expect(helper().textContent).toBe(
        'Open Research Online (Open) is our data provider already. If you ' +
          'host multiple repositories or journals on the same domain please ' +
          `specify exact OAI-PMH endpoint or contact us at ${SUPPORT_EMAIL}.`
      )
      const [existing, support] = [...helper().querySelectorAll('a')]
      expect(existing.getAttribute('href')).toBe(
        'https://core.ac.uk/search?q=repositories.id:(86)'
      )
      expect(existing.textContent).toBe('Open Research Online (Open)')
      // the address is spelled with escapes in the source
      expect(support.getAttribute('href')).toBe(
        'mailto:t%68%65t%65am%40core%2e%61c%2eu%6b'
      )
      expect(support.textContent).toBe(SUPPORT_EMAIL)
      // nothing was created, so the form cannot be finished
      expect(finishButton().disabled).toBe(true)
      expect(store.claim.duplicated.message).toContain('existingDataProviders')
    })

    test.each([
      ['an empty list', '{"existingDataProviders":[]}'],
      ['no list', '{}'],
      ['an empty array', '[]'],
    ])(
      'T-413 c1 @P1 duplicated with %s: "Data provider already exists." and the support address, no link to a provider',
      async (name, message) => {
        server.use(
          http.post(E16, () => HttpResponse.json({ message }, { status: 409 }))
        )
        const { store } = await mountPage()
        await enter(store, 'https://generic.example.org/')
        expect(variantOf(field())).toBe('error')
        expect(iconOf(field())).toBe('alert-circle-outline')
        expect(urlInput().getAttribute('aria-invalid')).toBe('true')
        expect(helper().textContent).toBe(
          'Data provider already exists. If you host multiple repositories ' +
            'or journals on the same domain please specify exact OAI-PMH ' +
            `endpoint or contact us at ${SUPPORT_EMAIL}.`
        )
        const links = [...helper().querySelectorAll('a')]
        expect(links.map((a) => a.textContent)).toEqual([SUPPORT_EMAIL])
      }
    )

    test.each([
      [500, { message: 'Internal Server Error' }],
      [400, { message: 'bad' }],
      [404, {}],
    ])(
      'T-413 c1 @P1 error: an answer %d gives the "cannot detect" message with the support address',
      async (status, body) => {
        server.use(http.post(E16, () => HttpResponse.json(body, { status })))
        const { store } = await mountPage()
        await enter(store, 'https://broken.example.org/')
        expect(variantOf(field())).toBe('error')
        expect(iconOf(field())).toBe('alert-circle-outline')
        expect(urlInput().getAttribute('aria-invalid')).toBe('true')
        expect(helper().textContent).toBe(
          'We cannot detect a repository or a journal at this address. ' +
            'Please, provide the exact OAI-PMH endpoint. If you are having ' +
            `trouble contact us at ${SUPPORT_EMAIL}.`
        )
        const support = helper().querySelector('a')
        expect(support.getAttribute('href')).toBe(
          'mailto:t%68%65t%65am%40core%2e%61c%2eu%6b'
        )
        expect(support.textContent).toBe(SUPPORT_EMAIL)
        expect(finishButton().disabled).toBe(true)
        expect(store.claim.getState().error.status).toBe(status)
      }
    )

    test('T-413 c1 @P1 error: a network failure gives the same message', async () => {
      server.use(http.post(E16, () => HttpResponse.error()))
      const { store } = await mountPage()
      await enter(store, 'https://broken.example.org/')
      expect(variantOf(field())).toBe('error')
      expect(iconOf(field())).toBe('alert-circle-outline')
      expect(urlInput().getAttribute('aria-invalid')).toBe('true')
      expect(helper().textContent.startsWith('We cannot detect')).toBe(true)
      expect(store.claim.getState().error.status).toBeUndefined()
    })

    test('T-413 c1 @P1 the field value is the claim query as typed; the next settled value replaces the message', async () => {
      const { store } = await mountPage()
      await enter(store, 'https://broken.example.org/')
      expect(variantOf(field())).toBe('error')
      expect(iconOf(field())).toBe('alert-circle-outline')
      expect(urlInput().getAttribute('aria-invalid')).toBe('true')
      await enter(store, 'https://created.example.org/')
      expect(variantOf(field())).toBe('success')
      expect(iconOf(field())).toBe('check')
      expect(urlInput().getAttribute('aria-invalid')).toBe('false')
      expect(urlInput().value).toBe('https://created.example.org/')
      expect(posts()).toEqual([`POST ${E16}`, `POST ${E16}`])
    })

    test('T-413 c1 @P1 Cancel hides the form: the invitation to become a data provider takes its place', async () => {
      await mountPage()
      await userEvent.setup().click(cancelButton())
      expect(screen.queryByText('Suggest a new data provider')).toBeNull()
      expect(
        screen.getByText(
          'Cannot find your repository or journal in our list? Become a data provider now!'
        )
      ).toBeTruthy()
      expect(
        screen
          .getByRole('link', { name: 'Add data provider' })
          .getAttribute('href')
      ).toBe('https://core.ac.uk/benefits#join-core')
    })

    test('T-413 c1 @P1 ?dataProviderUrl= fills the field and sends the same request after the debounce', async () => {
      setRouter({ query: { dataProviderUrl: 'https://created.example.org/' } })
      const { store } = await mountPage()
      await waitFor(() =>
        expect(urlInput().value).toBe('https://created.example.org/')
      )
      await waitFor(() => expect(store.claim.getState().created).not.toBeNull())
      expect(posts()).toEqual([`POST ${E16}`])
      expect(routerMock.query).toEqual({
        dataProviderUrl: 'https://created.example.org/',
      })
      expect(variantOf(field())).toBe('success')
      expect(iconOf(field())).toBe('check')
      expect(urlInput().getAttribute('aria-invalid')).toBe('false')
    })
  })

  describe('T-413 c2 @P1 Q-038 a 409 whose message is not JSON throws while the page renders', () => {
    // generateFormMessage runs inside the render of the page
    // (pages/data-providers/index.jsx:119), so the error leaves React's render
    const quiet = () => {
      errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {})
    }

    test.each([
      ['plain text', 'Data provider already exists'],
      ['an empty string', ''],
      ['text with a brace', '{not json'],
    ])(
      'T-413 c2 @P1 Q-038 generateFormMessage throws a SyntaxError for %s',
      (name, message) => {
        let error
        try {
          generateFormMessage({ duplicated: { message } })
        } catch (e) {
          error = e
        }
        expect(error).toBeInstanceOf(SyntaxError)
        expect(error.name).toBe('SyntaxError')
      }
    )

    test('T-413 c2 @P1 Q-038 a duplicated answer without a message throws too (JSON.parse of undefined)', () => {
      expect(() => generateFormMessage({ duplicated: {} })).toThrow(SyntaxError)
      expect(() =>
        generateFormMessage({ duplicated: { message: undefined } })
      ).toThrow(SyntaxError)
    })

    test('T-413 c2 @P1 Q-038 a message that parses to null throws a TypeError at the destructuring', () => {
      expect(() =>
        generateFormMessage({ duplicated: { message: 'null' } })
      ).toThrow(TypeError)
    })

    test('T-413 c2 @P1 Q-038 the error is not caught for the other kinds: error and created never parse', () => {
      // error and created win over duplicated, so a broken duplicated message
      // next to them is never parsed
      const broken = { message: 'Data provider already exists' }
      expect(
        generateFormMessage({ error: new Error('x'), duplicated: broken })
          .variant
      ).toBe('error')
      expect(
        generateFormMessage({ created: { name: 'N' }, duplicated: broken })
          .variant
      ).toBe('success')
      expect(() => generateFormMessage({ duplicated: broken })).toThrow(
        SyntaxError
      )
    })

    test('T-413 c2 @P1 Q-038 on the page the throw happens in render: the form is gone and the boundary receives the SyntaxError', async () => {
      quiet()
      const caught = []
      const { store } = await mountPage(
        { q: 'zzzzqqq' },
        { wrapper: boundaryWith((error) => caught.push(error)) }
      )
      expect(screen.queryByRole('alert')).toBeNull()
      fireEvent.change(urlInput(), {
        target: { value: 'https://duplicate-text.example.org/' },
      })
      await waitFor(() => expect(screen.getByRole('alert')).toBeTruthy())
      expect(screen.getByRole('alert').textContent).toBe('SyntaxError')
      expect(caught).toHaveLength(1)
      expect(caught[0]).toBeInstanceOf(SyntaxError)
      // the answer was a 409 that the store kept as `duplicated`; the form
      // and the rest of the page are gone, nothing else was requested
      expect(store.claim.duplicated.message).toBe(
        'Data provider already exists'
      )
      expect(screen.queryByText('Suggest a new data provider')).toBeNull()
      expect(posts()).toEqual([`POST ${E16}`])
    })

    test('T-413 c2 @P1 Q-038 the throw comes after the loading state: progress is shown first, then the render fails', async () => {
      quiet()
      let release
      const gate = new Promise((resolve) => {
        release = resolve
      })
      server.use(
        http.post(E16, async () => {
          await gate
          return HttpResponse.json(
            { message: 'Data provider already exists' },
            { status: 409 }
          )
        })
      )
      const failures = []
      const { store } = await mountPage(
        { q: 'zzzzqqq' },
        { wrapper: boundaryWith((error) => failures.push(error.name)) }
      )
      fireEvent.change(urlInput(), {
        target: { value: 'https://duplicate-text.example.org/' },
      })
      await waitFor(() => expect(store.claim.getState().isLoading).toBe(true))
      // while loading the message is the progress variant: no parse yet
      expect(variantOf(field())).toBe('progress')
      expect(iconOf(field())).toBe('spinner')
      expect(failures).toEqual([])
      release()
      await waitFor(() => expect(screen.getByRole('alert')).toBeTruthy())
      expect(failures).toEqual(['SyntaxError'])
    })
  })
})
