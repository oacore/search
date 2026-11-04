// T-412 (41 E, R-038): the claim card of /data-providers/[id] (findings/06
// §5.2) inside the real provider template (templates/data-provider/index.jsx),
// with the real design library, the real provider data (the props of the real
// getServerSideProps over the recorded answers) and MSW answering E18 and E17.
// Written now under the 41 §0 rule (I-12): this is the only pin of Q-061.
//
// The template owns the state the card flips on (`isDataProviderHasAccounts`),
// so the card is tested inside it; the result list is emptied (it is T-402's)
// and the map is the harness stub.
//
// c1 the §5.2 table and the claim rows 1-5 of 41 §2.6, SSR markup against the
// final one: the card and the "member" caption of the header render
// "Not a member yet" and the non-member text on the server whatever the
// provider is, and flip after the browser's E18 answers (Q-087); the flows of
// the card (links, SIGN IN, Create account, the edit modal, the success modal)
// and Q-061, the claim modal that nothing opens. c2 a failed claim POST shows
// nothing (Q-027 c2). c3 the E18 requests: one in every render, SSR included,
// 2 in the browser with accounts and 1 without, +1 per card re-render (Q-087,
// Q-027).
//
// Every wait on the network is an act-wrapped wait: next/link of the template
// updates its state from an idle callback.
import fs from 'fs'
import path from 'path'
import util from 'util'

import React from 'react'
import { hydrateRoot } from 'react-dom/client'
import { renderToString } from 'react-dom/server'
import LogRocket from 'logrocket'

import { setupMsw } from '../../../utils/msw'
import {
  render,
  screen,
  within,
  act,
  waitFor as baseWaitFor,
  userEvent,
  withRouter,
  withStore,
} from '../../../utils/render'
import RootStore from '../../../../store/root'
import Template from '../../../../templates/data-provider'
import { getServerSideProps } from '../../../../pages/data-providers/[id]'

jest.setTimeout(30000)

const { server, http, HttpResponse } = setupMsw()

// waits are generous: the suites of other packages run on the same machine
const SLOW = { timeout: 8000 }
const waitFor = (callback, options) =>
  baseWaitFor(callback, { ...SLOW, ...options })
// time for requests that should NOT happen to show up
const idle = (ms = 150) =>
  act(async () => {
    await new Promise((resolve) => {
      setTimeout(resolve, ms)
    })
  })

const API = 'https://api.core.ac.uk/internal'
const E18 = (id) => `${API}/data-providers/${id}/account`
const E17 = (id) => `${API}/data-providers/${id}/claim`

const ORO = 'Open Research Online (The Open University)'
const ABER = 'Aberystwyth Research Portal'
const EYLUL = '9 Eylül University'
const MEMBERSHIP = 'https://core.ac.uk/membership'
const DASHBOARD_SERVICE = 'https://core.ac.uk/services/repository-dashboard'
const DASHBOARD = 'https://dashboard.core.ac.uk/'
const NOT_A_MEMBER = 'Not a member yet'

// the card text of the three states (claim-card.jsx:117-148): the hard-coded
// provider name of the non-member branch is a quirk of the page, not of the
// data
const NON_MEMBER_TEXT =
  'Do you manage Open Research Online? Become a CORE Member to access ' +
  'insider analytics, issue reports and manage access to outputs from your ' +
  'repository in the CORE Repository Dashboard! 👇'
const dashboardText = (name) =>
  `Do you manage ${name}? Access insider analytics, issue reports and manage ` +
  'access to outputs from your repository in the CORE Repository Dashboard!👇'

const NON_MEMBER_CARD = {
  text: NON_MEMBER_TEXT,
  links: [
    ['CORE Member', MEMBERSHIP, '_blank'],
    ['CORE Repository Dashboard!', DASHBOARD_SERVICE, '_blank'],
  ],
  buttons: ['Become a member'],
}
const dashboardCard = (name) => ({
  text: dashboardText(name),
  links: [['CORE Repository Dashboard!', DASHBOARD_SERVICE, '_blank']],
  buttons: ['SIGN IN', 'Create account'],
})

// The edit modal and the success modal get `className={classNames.use(...)}`
// from the card, an object where the design's Modal declares a string: React
// prints the failed prop type once per process (dev only). It is the one
// console message these flows are allowed to print.
const KNOWN_WARNING =
  /Failed prop type: Invalid prop `className` of type `object` supplied to `Modal`, expected `string`/

let requests
let bodies
let openSpy
let logSpy
let errorSpy
let hydrated

beforeEach(() => {
  requests = []
  bodies = []
  hydrated = []
  server.events.on('request:start', ({ request }) => {
    requests.push({
      method: request.method,
      url: request.url,
      authorization: request.headers.get('authorization'),
    })
  })
  // the card opens the dashboard and the membership page in a new window
  openSpy = jest.spyOn(window, 'open').mockImplementation(() => null)
  LogRocket.captureException.mockClear()
  // hand every other console.error to the harness guard (test/setup/dom.js)
  const guarded = console.error
  errorSpy = jest.spyOn(console, 'error').mockImplementation((...args) => {
    if (!KNOWN_WARNING.test(util.format(...args))) guarded(...args)
  })
})

afterEach(() => {
  act(() => {
    hydrated.forEach((host) => {
      host.root.unmount()
      host.remove()
    })
  })
  server.events.removeAllListeners()
  openSpy.mockRestore()
  errorSpy.mockRestore()
  if (logSpy) logSpy.mockRestore()
  logSpy = undefined
})

// the provider page props of the real getServerSideProps; the result list is
// emptied
const loadData = async (id) => {
  const { props } = await getServerSideProps({
    params: { id: String(id) },
    query: {},
  })
  requests = []
  return {
    ...props.data,
    outputs: { ...props.data.outputs, results: [], data: [], totalHits: 0 },
  }
}

const answerAccounts = (id, answer) =>
  server.use(
    http.get(E18(id), () => {
      if (answer === 'neterror') return HttpResponse.error()
      if (typeof answer === 'number')
        return HttpResponse.json({ message: 'no' }, { status: answer })
      return HttpResponse.json(answer)
    })
  )

// the claim POST: the body is recorded, then the fixture (E17 hand answers for
// provider 86) or the given answer replies
const recordClaims = (id, answer) =>
  server.use(
    http.post(E17(id), async ({ request }) => {
      bodies.push(await request.clone().text())
      if (answer === undefined) return undefined
      if (answer === 'neterror') return HttpResponse.error()
      return HttpResponse.json(answer.body, { status: answer.status })
    })
  )

const frame = () => {
  const Router = withRouter()
  const Store = withStore(new RootStore({ statistics: {} }))
  const Frame = ({ children }) => (
    <Router>
      <Store>{children}</Store>
    </Router>
  )
  return Frame
}
const page = (data) => <Template data={data} onSearch={() => {}} />

const mount = (data) => {
  const Frame = frame()
  return render(page(data), { wrapper: Frame })
}

// the markup the server sends: one render, the E18 request of that render is
// left running
const serverHtml = (data) => {
  const Frame = frame()
  return renderToString(<Frame>{page(data)}</Frame>)
}
// the browser takes over the server markup (the load of a real visit)
const hydrate = (html, data) => {
  const host = document.createElement('div')
  host.innerHTML = html
  document.body.appendChild(host)
  hydrated.push(host)
  const Frame = frame()
  act(() => {
    host.root = hydrateRoot(host, <Frame>{page(data)}</Frame>)
  })
  return host
}
const parse = (html) => {
  const host = document.createElement('div')
  host.innerHTML = html
  return host
}
// what a visitor reads: the caption of the header and the three parts of the
// card
const read = (root) => {
  const card = root.querySelector('.claim-card')
  const [title, text, actions] = card.children
  return {
    caption: root.querySelector('h5 a').textContent,
    captionHref: root.querySelector('h5 a').getAttribute('href'),
    title: title.textContent,
    text: text.textContent,
    links: [...text.querySelectorAll('a')].map((a) => [
      a.textContent,
      a.getAttribute('href'),
      a.getAttribute('target'),
    ]),
    buttons: [...actions.querySelectorAll('button')].map((b) => b.textContent),
  }
}
const cardOf = (state) => ({
  text: state.text,
  links: state.links,
  buttons: state.buttons,
})

const gets = (id) => requests.filter((r) => r.url === E18(id))
const claims = (id) => requests.filter((r) => r.url === E17(id))

const dialog = () =>
  screen.findByRole(
    'dialog',
    { name: 'Create Repository Dashboard Account' },
    SLOW
  )
const fillEdit = async (user, { name, email, rationale }) => {
  const modal = await dialog()
  const field = (label) => within(modal).getByLabelText(label)
  if (name !== undefined) await user.type(field('Name'), name)
  if (email !== undefined) {
    await user.clear(field('Email'))
    await user.type(field('Email'), email)
  }
  if (rationale !== undefined)
    await user.type(field('Justification'), rationale)
  return modal
}

const ROWS = [
  {
    row: 1,
    title: 'claim row 1: provider 86 with accounts',
    id: 86,
    accounts: undefined, // the recorded answer: a list of accounts
    name: ORO,
    server: { caption: NOT_A_MEMBER, card: NON_MEMBER_CARD },
    final: {
      caption: 'supporting member',
      card: dashboardCard(ORO),
    },
    browserGets: 2,
  },
  {
    row: 2,
    title: 'claim row 2: provider 4835 (a starting member) with no accounts',
    id: 4835,
    accounts: [],
    name: ABER,
    server: { caption: NOT_A_MEMBER, card: dashboardCard(ABER) },
    final: { caption: NOT_A_MEMBER, card: dashboardCard(ABER) },
    browserGets: 1,
  },
  {
    row: 3,
    title: 'claim row 3: provider 86 with no accounts',
    id: 86,
    accounts: [],
    name: ORO,
    server: { caption: NOT_A_MEMBER, card: NON_MEMBER_CARD },
    final: { caption: NOT_A_MEMBER, card: NON_MEMBER_CARD },
    browserGets: 1,
  },
  {
    row: 4,
    title: 'claim row 4: provider 3354, not a member, with no accounts',
    id: 3354,
    accounts: undefined, // the recorded (derived) answer is []
    name: EYLUL,
    server: { caption: NOT_A_MEMBER, card: NON_MEMBER_CARD },
    final: { caption: NOT_A_MEMBER, card: NON_MEMBER_CARD },
    browserGets: 1,
  },
  {
    row: 5,
    title: 'claim row 5: provider 86, the accounts answer is 401',
    id: 86,
    accounts: 401,
    name: ORO,
    server: { caption: NOT_A_MEMBER, card: NON_MEMBER_CARD },
    final: { caption: NOT_A_MEMBER, card: NON_MEMBER_CARD },
    browserGets: 1,
    failing: true,
  },
  {
    row: 5,
    title: 'claim row 5: provider 86, the accounts answer is 500',
    id: 86,
    accounts: 500,
    name: ORO,
    server: { caption: NOT_A_MEMBER, card: NON_MEMBER_CARD },
    final: { caption: NOT_A_MEMBER, card: NON_MEMBER_CARD },
    browserGets: 1,
    failing: true,
  },
]

describe('T-412 @P1 claim card', () => {
  describe('T-412 c1 @P1 findings 06 §5.2 and the claim rows 1-5, SSR vs final', () => {
    test.each(ROWS)(
      'T-412 c1 @P1 $title: the server markup and the final markup',
      async ({ id, accounts, name, server: onServer, final, browserGets }) => {
        if (accounts !== undefined) answerAccounts(id, accounts)
        const data = await loadData(id)

        // 1. the server: caption and card read the initial state (Q-087)
        const html = serverHtml(data)
        const before = read(parse(html))
        expect(before.caption).toBe(onServer.caption)
        expect(before.captionHref).toBe(MEMBERSHIP)
        expect(before.title).toBe('Access Repository Dashboard')
        expect(cardOf(before)).toEqual(onServer.card)
        // the render itself asked for the accounts (Q-027)
        await waitFor(() => expect(gets(id)).toHaveLength(1))
        await idle()
        expect(gets(id)).toHaveLength(1)
        requests = []
        LogRocket.captureException.mockClear()

        // 2. the browser renders the page again: first the same text, then
        // the answers of E18 flip the caption and the card (accounts only)
        const { container: host } = mount(data)
        expect(read(host).caption).toBe(onServer.caption)
        expect(cardOf(read(host))).toEqual(onServer.card)
        await waitFor(() => expect(gets(id)).toHaveLength(browserGets))
        if (final.caption !== onServer.caption)
          await waitFor(() => expect(read(host).caption).toBe(final.caption))
        await idle()
        const after = read(host)
        expect(after.caption).toBe(final.caption)
        expect(after.captionHref).toBe(MEMBERSHIP)
        expect(cardOf(after)).toEqual(final.card)
        expect(gets(id)).toHaveLength(browserGets)
        // the name in the header is the provider's
        expect(host.querySelector('.header-info-title') || host).toBeTruthy()
        expect(host.textContent).toContain(name)
      }
    )

    test('T-412 c1 @P1 claim rows 5: a failing accounts request leaves the state false, is reported to LogRocket once, and shows no message', async () => {
      for (const status of [401, 500, 'neterror']) {
        answerAccounts(86, status)
        // eslint-disable-next-line no-await-in-loop
        const data = await loadData(86)
        LogRocket.captureException.mockClear()
        const view = mount(data)
        // eslint-disable-next-line no-await-in-loop
        await waitFor(() => expect(gets(86)).toHaveLength(1))
        // eslint-disable-next-line no-await-in-loop
        await idle()
        expect(LogRocket.captureException).toHaveBeenCalledTimes(1)
        expect(read(view.container).caption).toBe(NOT_A_MEMBER)
        expect(cardOf(read(view.container))).toEqual(NON_MEMBER_CARD)
        // nothing was added to the page: no alert, no error text
        expect(screen.queryByRole('alert')).toBeNull()
        expect(view.container.textContent).not.toMatch(/error|failed|wrong/i)
        // a failed answer is not retried
        expect(gets(86)).toHaveLength(1)
        view.unmount()
        requests = []
        server.resetHandlers()
      }
    })

    test('T-412 c1 @P1 the provider type decides, not the billing of the page: a starting member sees the dashboard card on the server too', async () => {
      answerAccounts(4835, [])
      const data = await loadData(4835)
      expect(data.billingType).toBe('starting')
      const state = read(parse(serverHtml(data)))
      expect(cardOf(state)).toEqual(dashboardCard(ABER))
      expect(state.caption).toBe(NOT_A_MEMBER)
      await idle()
    })

    test('T-412 c1 @P1 Become a member opens the membership page in a new window, once, and nothing else', async () => {
      answerAccounts(86, [])
      const data = await loadData(86)
      const view = mount(data)
      await waitFor(() => expect(gets(86)).toHaveLength(1))
      await userEvent.setup().click(
        within(view.container).getByRole('button', {
          name: 'Become a member',
        })
      )
      expect(openSpy).toHaveBeenCalledTimes(1)
      expect(openSpy).toHaveBeenCalledWith(MEMBERSHIP, '_blank')
      expect(screen.queryByRole('dialog')).toBeNull()
    })

    test('T-412 c1 @P1 SIGN IN opens the dashboard in a new window; Create account opens the edit modal, not a window', async () => {
      const data = await loadData(86)
      const view = mount(data)
      await waitFor(() =>
        expect(read(view.container).buttons).toEqual([
          'SIGN IN',
          'Create account',
        ])
      )
      const user = userEvent.setup()
      await user.click(
        within(view.container).getByRole('button', { name: 'SIGN IN' })
      )
      expect(openSpy).toHaveBeenCalledTimes(1)
      expect(openSpy).toHaveBeenCalledWith(DASHBOARD, '_blank')
      expect(screen.queryByRole('dialog')).toBeNull()
      await user.click(
        within(view.container).getByRole('button', { name: 'Create account' })
      )
      expect(await dialog()).toBeTruthy()
      expect(openSpy).toHaveBeenCalledTimes(1)
    })

    test('T-412 c1 @P1 the edit modal with accounts: invitation text, three fields, the justification helper names the provider, no Back button', async () => {
      const data = await loadData(86)
      const view = mount(data)
      const user = userEvent.setup()
      await waitFor(() =>
        expect(read(view.container).buttons).toContain('Create account')
      )
      await user.click(
        within(view.container).getByRole('button', { name: 'Create account' })
      )
      const modal = await dialog()
      expect(within(modal).getByRole('heading').textContent).toBe(
        'Create Repository Dashboard Account'
      )
      expect(modal.textContent).toContain(
        'Enter the institutional email address and a few details to get invitation to the CORE Dashboard.'
      )
      expect(within(modal).getByLabelText('Email').type).toBe('email')
      expect(within(modal).getByLabelText('Email').value).toBe('')
      expect(modal.textContent).toContain('Your institutional email address.')
      expect(within(modal).getByLabelText('Name').type).toBe('text')
      expect(within(modal).getByLabelText('Justification').type).toBe('text')
      expect(modal.textContent).toContain(
        `We will send an email with your justification to the registered repository manager of ${ORO} to check that you are an authorised person to get access.`
      )
      expect(within(modal).queryByRole('button', { name: 'Back' })).toBeNull()
      expect(
        within(modal).getByRole('button', { name: 'Continue' })
      ).toBeTruthy()
      // the claim modal text of the other, unreachable modal is not this one
      expect(modal.textContent).not.toContain('To give you instant access')
    })

    test('T-412 c1 @P1 the edit modal without accounts (a starting member): ownership text with its typos, the manual-verification note, Back and Continue', async () => {
      answerAccounts(4835, [])
      const data = await loadData(4835)
      const view = mount(data)
      const user = userEvent.setup()
      await waitFor(() => expect(gets(4835)).toHaveLength(1))
      await user.click(
        within(view.container).getByRole('button', { name: 'Create account' })
      )
      const modal = await dialog()
      expect(modal.textContent).toContain(
        'To give you instant access to Repository Dashboard, we need to verify ' +
          'that you have ownership of of the repository by sending an email to ' +
          'the registered repository administrator.'
      )
      expect(modal.textContent).toContain('manual verification')
      expect(modal.textContent).toContain(
        'Since you changed email, we need to manually check that you are the repository manager'
      )
      const back = within(modal).getByRole('button', { name: 'Back' })
      expect(
        within(modal).getByRole('button', { name: 'Continue' })
      ).toBeTruthy()
      // Back closes the modal
      await user.click(back)
      await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    })

    test('T-412 c1 @P1 Continue with a missing field sends nothing and keeps the modal; the fields keep what was typed', async () => {
      const data = await loadData(86)
      const view = mount(data)
      const user = userEvent.setup()
      await waitFor(() =>
        expect(read(view.container).buttons).toContain('Create account')
      )
      recordClaims(86)
      await user.click(
        within(view.container).getByRole('button', { name: 'Create account' })
      )
      const modal = await fillEdit(user, { name: 'Test Claimant' })
      await user.click(within(modal).getByRole('button', { name: 'Continue' }))
      await idle()
      expect(claims(86)).toHaveLength(0)
      expect(screen.getByRole('dialog')).toBe(modal)
      expect(within(modal).getByLabelText('Name').value).toBe('Test Claimant')
    })

    test('T-412 c1 @P1 a claim from the edit modal: E17 POST with the typed fields and the account flag, then the success modal and a debug log of the answer', async () => {
      logSpy = jest.spyOn(console, 'log').mockImplementation(() => {})
      const data = await loadData(86)
      const view = mount(data)
      const user = userEvent.setup()
      await waitFor(() =>
        expect(read(view.container).buttons).toContain('Create account')
      )
      recordClaims(86)
      await user.click(
        within(view.container).getByRole('button', { name: 'Create account' })
      )
      const modal = await fillEdit(user, {
        name: 'Test Claimant',
        email: 'claimant@localhost',
        rationale: 'claim-ok',
      })
      await user.click(within(modal).getByRole('button', { name: 'Continue' }))

      const success = await screen.findByRole(
        'dialog',
        { name: 'Claim success modal' },
        SLOW
      )
      expect(claims(86)).toHaveLength(1)
      expect(claims(86)[0].method).toBe('POST')
      expect(JSON.parse(bodies[0])).toEqual({
        name: 'Test Claimant',
        email: 'claimant@localhost',
        rationale: 'claim-ok',
        repositoryHasAccount: true,
      })
      // Key order of the body: name, email, rationale, repositoryHasAccount
      expect(Object.keys(JSON.parse(bodies[0]))).toEqual([
        'name',
        'email',
        'rationale',
        'repositoryHasAccount',
      ])
      // with accounts: the approval text, addressed to the provider's address
      // (empty in the fixture)
      expect(success.textContent).toContain(
        'We sent your request to the registered repository manager for approval. You will be contacted at'
      )
      expect(success.textContent).toContain(
        'as soon repository manager approves your request.'
      )
      expect(logSpy).toHaveBeenCalledWith(
        JSON.stringify({ message: 'Claim request accepted' })
      )
      // Close: the success modal and the edit modal go
      await user.click(
        within(success).getByText('Close', { selector: 'button' })
      )
      await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    })

    test('T-412 c1 @P1 a claim without accounts: repositoryHasAccount false and the "we will check your eligibility" text with the typed address', async () => {
      logSpy = jest.spyOn(console, 'log').mockImplementation(() => {})
      answerAccounts(4835, [])
      const data = await loadData(4835)
      const view = mount(data)
      const user = userEvent.setup()
      await waitFor(() => expect(gets(4835)).toHaveLength(1))
      recordClaims(4835, { status: 201, body: { message: 'ok' } })
      await user.click(
        within(view.container).getByRole('button', { name: 'Create account' })
      )
      const modal = await fillEdit(user, {
        name: 'Test Claimant',
        email: 'claimant@localhost',
        rationale: 'claim-starting',
      })
      await user.click(within(modal).getByRole('button', { name: 'Continue' }))
      const success = await screen.findByRole(
        'dialog',
        { name: 'Claim success modal' },
        SLOW
      )
      expect(JSON.parse(bodies[0]).repositoryHasAccount).toBe(false)
      expect(success.textContent).toContain(
        'We will now check your eligibility for a Repository Dashboard Account and contact you at claimant@localhost. It may take a few business days.'
      )
      expect(within(success).getByText('claimant@localhost').tagName).toBe('B')
    })

    test('T-412 c1 @P1 Q-061 the claim modal is unreachable: no control opens it, its fields never exist, whichever way the card is used', async () => {
      logSpy = jest.spyOn(console, 'log').mockImplementation(() => {})
      const FIRST_MODAL_IDS = [
        'contactEmailFirst',
        'contactNameFirst',
        'contactRationale',
      ]
      const claimModalShown = () =>
        // its own fields; the edit modal has contactName, contactEmail and,
        // like it, contactRationale
        ['contactEmailFirst', 'contactNameFirst'].some((id) =>
          document.getElementById(id)
        )
      expect(FIRST_MODAL_IDS).toContain('contactRationale')

      answerAccounts(4835, [])
      const data = await loadData(4835)
      const view = mount(data)
      const user = userEvent.setup()
      await waitFor(() => expect(gets(4835)).toHaveLength(1))
      expect(claimModalShown()).toBe(false)

      // 1. every control of the card
      await user.click(
        within(view.container).getByRole('button', { name: 'SIGN IN' })
      )
      expect(claimModalShown()).toBe(false)
      expect(screen.queryByRole('dialog')).toBeNull()
      // 2. the edit modal, its controls, the success modal and its Close
      await user.click(
        within(view.container).getByRole('button', { name: 'Create account' })
      )
      let modal = await dialog()
      expect(claimModalShown()).toBe(false)
      await user.click(within(modal).getByRole('button', { name: 'Back' }))
      await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
      expect(claimModalShown()).toBe(false)

      recordClaims(4835, { status: 201, body: { message: 'ok' } })
      await user.click(
        within(view.container).getByRole('button', { name: 'Create account' })
      )
      modal = await fillEdit(user, {
        name: 'Test Claimant',
        email: 'claimant@localhost',
        rationale: 'x',
      })
      await user.click(within(modal).getByRole('button', { name: 'Continue' }))
      const success = await screen.findByRole(
        'dialog',
        { name: 'Claim success modal' },
        SLOW
      )
      expect(claimModalShown()).toBe(false)
      await user.click(
        within(success).getByText('Close', { selector: 'button' })
      )
      await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
      expect(claimModalShown()).toBe(false)
      // at no point was there more than the one dialog the flow opened
      expect(document.querySelectorAll('[role="dialog"]')).toHaveLength(0)
    })

    test('T-412 c1 @P1 Q-061 in the source: nothing sets the claim modal active and sign-in-modal.jsx is imported by no file', () => {
      const root = path.join(__dirname, '../../../..')
      const card = fs.readFileSync(
        path.join(root, 'templates/data-provider/claim/claim-card.jsx'),
        'utf8'
      )
      // the state exists ...
      expect(card).toContain(
        'const [isClaimModalActive, setIsClaimModalActive] = useState(false)'
      )
      expect(card).toContain(
        'const [isSignInModalActive, setIsSignInModalActive] = useState(false)'
      )
      // ... and no call sets it to anything but false
      for (const setter of [
        'setIsClaimModalActive',
        'setIsSignInModalActive',
        'setModalActive',
        'setClaimModalActive',
        'setSignInModalActive',
      ])
        expect(card).not.toMatch(new RegExp(`${setter}\\(\\s*true`))
      // nobody imports the sign-in modal
      const imports = []
      const walk = (dir) => {
        for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
          const full = path.join(dir, entry.name)
          if (entry.isDirectory()) walk(full)
          else if (/\.(js|jsx)$/.test(entry.name)) {
            const source = fs.readFileSync(full, 'utf8')
            if (/sign-in-modal/.test(source))
              imports.push(path.relative(root, full))
          }
        }
      }
      for (const dir of [
        'pages',
        'templates',
        'modules',
        'main',
        'hooks',
        'store',
        'utils',
        'api',
        'lib',
      ])
        walk(path.join(root, dir))
      expect(imports).toEqual([])
    })
  })

  describe('T-412 c2 @P1 a failed claim POST shows nothing (Q-027)', () => {
    const openEdit = async (data) => {
      const view = mount(data)
      const user = userEvent.setup()
      await waitFor(() =>
        expect(read(view.container).buttons).toContain('Create account')
      )
      await user.click(
        within(view.container).getByRole('button', { name: 'Create account' })
      )
      return { view, user }
    }

    test('T-412 c2 @P1 Q-027 POST 500: no success modal, no message, the edit modal stays with its values', async () => {
      logSpy = jest.spyOn(console, 'log').mockImplementation(() => {})
      const data = await loadData(86)
      const { view, user } = await openEdit(data)
      recordClaims(86)
      const modal = await fillEdit(user, {
        name: 'Test Claimant',
        email: 'claimant@localhost',
        rationale: 'claim-fail',
      })
      const textBefore = document.body.textContent
      LogRocket.captureException.mockClear()
      await user.click(within(modal).getByRole('button', { name: 'Continue' }))
      await waitFor(() => expect(claims(86)).toHaveLength(1))
      await idle()
      // the hand fixture answered 500
      expect(JSON.parse(bodies[0])).toEqual({
        name: 'Test Claimant',
        email: 'claimant@localhost',
        rationale: 'claim-fail',
        repositoryHasAccount: true,
      })
      expect(
        screen.queryByRole('dialog', { name: 'Claim success modal' })
      ).toBeNull()
      expect(screen.getByRole('dialog')).toBe(modal)
      expect(document.body.textContent).toBe(textBefore)
      expect(screen.queryByRole('alert')).toBeNull()
      expect(within(modal).getByLabelText('Name').value).toBe('Test Claimant')
      expect(within(modal).getByLabelText('Email').value).toBe(
        'claimant@localhost'
      )
      expect(within(modal).getByLabelText('Justification').value).toBe(
        'claim-fail'
      )
      // the success branch logs the answer: not here
      expect(logSpy).not.toHaveBeenCalled()
      // the only trace is the LogRocket report of the API layer
      expect(LogRocket.captureException).toHaveBeenCalledTimes(1)
      expect(LogRocket.captureException.mock.calls[0][0].status).toBe(500)
      // the card behind the modal is unchanged
      expect(read(view.container).buttons).toEqual([
        'SIGN IN',
        'Create account',
      ])
    })

    test.each([
      [400, { message: 'bad' }],
      [401, { message: 'no' }],
      [409, { message: 'exists' }],
      [422, { message: 'invalid' }],
      [503, { message: 'down' }],
    ])('T-412 c2 @P1 Q-027 POST %d: nothing either', async (status, body) => {
      logSpy = jest.spyOn(console, 'log').mockImplementation(() => {})
      const data = await loadData(86)
      const { user } = await openEdit(data)
      recordClaims(86, { status, body })
      const modal = await fillEdit(user, {
        name: 'N',
        email: 'a@localhost',
        rationale: 'r',
      })
      const textBefore = document.body.textContent
      await user.click(within(modal).getByRole('button', { name: 'Continue' }))
      await waitFor(() => expect(claims(86)).toHaveLength(1))
      await idle()
      expect(
        screen.queryByRole('dialog', { name: 'Claim success modal' })
      ).toBeNull()
      expect(document.body.textContent).toBe(textBefore)
      expect(logSpy).not.toHaveBeenCalled()
    })

    test('T-412 c2 @P1 Q-027 a network failure: nothing, and the modal can be submitted again with the same fields', async () => {
      logSpy = jest.spyOn(console, 'log').mockImplementation(() => {})
      const data = await loadData(86)
      const { user } = await openEdit(data)
      recordClaims(86, 'neterror')
      const modal = await fillEdit(user, {
        name: 'Test Claimant',
        email: 'claimant@localhost',
        rationale: 'claim-ok',
      })
      await user.click(within(modal).getByRole('button', { name: 'Continue' }))
      await waitFor(() => expect(claims(86)).toHaveLength(1))
      await idle()
      expect(
        screen.queryByRole('dialog', { name: 'Claim success modal' })
      ).toBeNull()
      expect(logSpy).not.toHaveBeenCalled()
      // the retry reaches the hand fixture that accepts the claim: the
      // handler of the failed attempt is dropped first
      server.resetHandlers()
      recordClaims(86)
      await user.click(within(modal).getByRole('button', { name: 'Continue' }))
      expect(
        await screen.findByRole('dialog', { name: 'Claim success modal' }, SLOW)
      ).toBeTruthy()
      expect(claims(86)).toHaveLength(2)
    })
  })

  describe('T-412 c3 @P1 the /account requests per render (Q-087, Q-027)', () => {
    test('T-412 c3 @P1 Q-027 the server render asks for the accounts: one GET of E18 with the API key, no body', async () => {
      const data = await loadData(86)
      serverHtml(data)
      await waitFor(() => expect(gets(86)).toHaveLength(1))
      await idle()
      expect(requests).toEqual([
        {
          method: 'GET',
          url: E18(86),
          authorization: 'Bearer test-key',
        },
      ])
    })

    test('T-412 c3 @P1 Q-087 one load of a provider with accounts: 1 server GET and 2 browser GETs, then no more', async () => {
      const data = await loadData(86)
      const html = serverHtml(data)
      await waitFor(() => expect(gets(86)).toHaveLength(1))
      await idle()
      const host = hydrate(html, data)
      await waitFor(() => expect(gets(86)).toHaveLength(3))
      await waitFor(() => expect(read(host).caption).toBe('supporting member'))
      // settled: the second answer sets the same value, nothing renders again
      await idle(300)
      expect(gets(86)).toHaveLength(3)
    })

    test('T-412 c3 @P1 Q-087 one load of a provider without accounts: 1 server GET and 1 browser GET', async () => {
      answerAccounts(86, [])
      const data = await loadData(86)
      const html = serverHtml(data)
      await waitFor(() => expect(gets(86)).toHaveLength(1))
      await idle()
      const host = hydrate(html, data)
      await waitFor(() => expect(gets(86)).toHaveLength(2))
      await idle(300)
      expect(gets(86)).toHaveLength(2)
      // nothing flips: the caption and the card are the server's
      expect(read(host).caption).toBe(NOT_A_MEMBER)
      expect(cardOf(read(host))).toEqual(NON_MEMBER_CARD)
    })

    test('T-412 c3 @P1 Q-027 every browser GET carries the method, the URL and the key of the first', async () => {
      const data = await loadData(86)
      mount(data)
      await waitFor(() => expect(gets(86)).toHaveLength(2))
      await idle()
      expect(requests).toEqual(
        Array(2).fill({
          method: 'GET',
          url: E18(86),
          authorization: 'Bearer test-key',
        })
      )
    })

    test('T-412 c3 @P1 Q-087 +1 per re-render of the card: opening and closing the edit modal each ask once more', async () => {
      answerAccounts(4835, [])
      const data = await loadData(4835)
      const view = mount(data)
      const user = userEvent.setup()
      await waitFor(() => expect(gets(4835)).toHaveLength(1))
      await idle()
      expect(gets(4835)).toHaveLength(1)

      await user.click(
        within(view.container).getByRole('button', { name: 'Create account' })
      )
      const modal = await dialog()
      await waitFor(() => expect(gets(4835)).toHaveLength(2))
      await idle()
      expect(gets(4835)).toHaveLength(2)

      await user.click(within(modal).getByRole('button', { name: 'Back' }))
      await waitFor(() => expect(gets(4835)).toHaveLength(3))
      await idle()
      expect(gets(4835)).toHaveLength(3)
    })

    test('T-412 c3 @P1 Q-087 typing in the modal re-renders the modal only: no request per keystroke', async () => {
      answerAccounts(4835, [])
      const data = await loadData(4835)
      const view = mount(data)
      const user = userEvent.setup()
      await waitFor(() => expect(gets(4835)).toHaveLength(1))
      await user.click(
        within(view.container).getByRole('button', { name: 'Create account' })
      )
      await waitFor(() => expect(gets(4835)).toHaveLength(2))
      const modal = await dialog()
      await user.type(within(modal).getByLabelText('Name'), 'Test Claimant')
      await user.type(
        within(modal).getByLabelText('Justification'),
        'twelve chars'
      )
      await idle(300)
      expect(gets(4835)).toHaveLength(2)
    })

    test('T-412 c3 @P1 Q-027 with accounts, a re-render asks again but changes nothing: the card and the count stay put after each', async () => {
      const data = await loadData(86)
      const view = mount(data)
      const user = userEvent.setup()
      await waitFor(() => expect(gets(86)).toHaveLength(2))
      await waitFor(() =>
        expect(read(view.container).caption).toBe('supporting member')
      )
      await idle()
      expect(gets(86)).toHaveLength(2)
      await user.click(
        within(view.container).getByRole('button', { name: 'Create account' })
      )
      await dialog()
      await waitFor(() => expect(gets(86)).toHaveLength(3))
      await idle(300)
      expect(gets(86)).toHaveLength(3)
      expect(read(view.container).caption).toBe('supporting member')
    })

    test('T-412 c3 @P1 Q-027 an unmounted card asks no more', async () => {
      answerAccounts(86, [])
      const data = await loadData(86)
      const view = mount(data)
      await waitFor(() => expect(gets(86)).toHaveLength(1))
      view.unmount()
      await idle(300)
      expect(gets(86)).toHaveLength(1)
    })
  })
})
