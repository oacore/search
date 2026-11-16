// T-411 (41 E, R-037): the takedown page and its report modals with the real
// design library, the real report store and MSW answering from the recorded
// fixtures. c1 the URL parser (findings/06 §3.6, Q-036: unescaped dots), c2 the
// exact error JSX, c3 the chain type modal -> form modal -> request -> success
// modal, c4 Q-060 (the API error is shown on the page only, never in a modal)
// and Q-078 (the form highlights "Repository manager" while `role` is null and
// Submit stays disabled).
import React from 'react'
import { configure } from 'mobx'
import routerMock, { setRouter } from 'next/router'

import { setupMsw } from '../../../../utils/msw'
import {
  render,
  screen,
  waitFor as baseWaitFor,
  fireEvent,
  userEvent,
  withRouter,
  withStore,
} from '../../../../utils/render'
import RootStore from '../../../../../store/root'
import UpdateTemplate from '../../../../../templates/output/update'
import ReportFormModal from '../../../../../templates/output/report/report-form-modal'
import ReportTypeModal from '../../../../../templates/output/report/report-type-modal'

// The report store writes after `await` outside an action (findings/03 §2.3),
// which MobX 6 reports with a dev-only console.warn that the production build
// of MobX does not print. Switching the check off changes no state transition.
configure({ enforceActions: 'never' })

jest.setTimeout(30000)

const { server, http } = setupMsw()

// waits are generous: the suites of other packages run on the same machine
const SLOW = { timeout: 8000 }
const waitFor = (callback, options) =>
  baseWaitFor(callback, { ...SLOW, ...options })
const dialog = (name) => screen.findByRole('dialog', { name }, SLOW)

const PLACEHOLDER = 'e.g. https://core.ac.uk/display/1'
const API = 'https://api.core.ac.uk'
const E10_URL = `${API}/internal/outputs/update`

// the error JSX of templates/output/update/index.jsx:55-61, as markup
const NOT_ACCEPTED =
  'Links starting with https://core.ac.uk/<strong>works</strong> or ' +
  'https://core.ac.uk/<strong>search</strong> are not accepted. Please see ' +
  'below types of links you can use or contact us.'
// store/report.js:7-8
const API_ERROR =
  /^We couldn’t perform the action\. For any issue contact \w+@core\.science$/

// the hand fixture of the E10 report (test/fixtures/hand/e10-report)
const REPORTER = {
  name: 'Test Reporter',
  email: 'reporter@localhost',
}

let requests
let e10Bodies
let log

beforeEach(() => {
  requests = []
  e10Bodies = []
  // the page prints the parsed id (templates/output/update/index.jsx:52)
  log = jest.spyOn(console, 'log').mockImplementation(() => {})
  server.events.on('request:start', ({ request }) => {
    requests.push(`${request.method} ${request.url}`)
  })
  // records the body, then lets the fixture resolver answer
  server.use(
    http.post(E10_URL, async ({ request }) => {
      e10Bodies.push(await request.clone().text())
    })
  )
})

afterEach(() => {
  server.events.removeAllListeners()
  log.mockRestore()
})

const mountPage = () => {
  const store = new RootStore({ statistics: {} })
  const view = render(<UpdateTemplate />, {
    wrappers: [withRouter(), withStore(store)],
  })
  return { store, ...view }
}

const urlInput = () => screen.getByPlaceholderText(PLACEHOLDER)
const submitButton = () => screen.getByRole('button', { name: 'SUBMIT' })
const errorParagraph = (container) => container.querySelector('.error-message')

const typeUrl = (value) => fireEvent.change(urlInput(), { target: { value } })

// types the value, submits and waits until the report store is idle again
const submitUrl = async (store, value) => {
  typeUrl(value)
  fireEvent.click(submitButton())
  await waitFor(() => expect(store.report.isLoading).toBe(false))
}

const outputRequests = () =>
  requests.filter((r) => r.startsWith(`GET ${API}/v3/outputs/`))

describe('T-411 @P0 takedown page and report modals', () => {
  // [input, id the page asks the API for]
  const ACCEPTED = [
    ['2001', '2001'],
    ['https://core.ac.uk/outputs/2002', '2002'],
    ['http://core.ac.uk/outputs/2003', '2003'],
    ['core.ac.uk/display/2004', '2004'],
    ['https://core.ac.uk/display/2001?recSetID=', '2001'],
    ['https://core.ac.uk/download/2002.pdf', '2002'],
    ['https://core.ac.uk/download/pdf/2003', '2003'],
    // the example link of the page itself, with its trailing space
    ['https://core.ac.uk/download/82976757.pdf ', '82976757'],
    // Q-036: the dots of core.ac.uk are unescaped, so any character matches
    ['core2ac3uk/outputs/5', '2'],
    ['coreXacYuk/display/7', '7'],
    // only the digits right after the path count, the rest is cut off
    ['https://core.ac.uk/outputs/12abc34', '12'],
  ]
  ACCEPTED.forEach(([input, id]) => {
    test(`T-411 c1 @P0 "${input}" asks the API for output ${id} (06 §3.6, Q-036)`, async () => {
      const { store, container } = mountPage()
      await submitUrl(store, input)
      expect(log.mock.calls).toEqual([[`Takedown outputId => ${id}`]])
      expect(outputRequests()).toEqual([`GET ${API}/v3/outputs/${id}`])
      // an accepted link never shows the "not accepted" text
      const p = errorParagraph(container)
      expect(p === null || !p.innerHTML.includes('not accepted')).toBe(true)
    })
  })

  const REJECTED = [
    'https://core.ac.uk/works/19211324',
    'https://core.ac.uk/search?q=climate',
    'https://core.ac.uk/search/?q=2001',
    'https://example.org/outputs/5',
    'core.ac.uk/outputs/',
    'outputs/2001',
    'abc',
    // the bare-number branch is anchored at both ends
    ' 2001',
    '2001 ',
    '20 01',
    '-5',
  ]
  REJECTED.forEach((input) => {
    test(`T-411 c1 @P0 "${input}" is rejected without a request (06 §3.6)`, async () => {
      const { store, container } = mountPage()
      await submitUrl(store, input)
      expect(log.mock.calls).toEqual([['Takedown outputId => undefined']])
      expect(requests).toEqual([])
      expect(errorParagraph(container).innerHTML).toBe(NOT_ACCEPTED)
      expect(store.report.isModalReportTypeActive).toBe(false)
    })
  })

  test('T-411 c2 @P0 the error is the exact JSX: two <strong> words inside one paragraph of the form', () => {
    const { container, store } = mountPage()
    typeUrl('https://core.ac.uk/works/19211324')
    fireEvent.click(submitButton())
    const p = errorParagraph(container)
    expect(p.tagName).toBe('P')
    expect(p.parentElement.tagName).toBe('FORM')
    // sits after the input group and before the submit button
    expect(p.previousElementSibling.querySelector('input')).toBe(urlInput())
    expect(p.nextElementSibling).toBe(submitButton())
    expect(p.innerHTML).toBe(NOT_ACCEPTED)
    expect(p.textContent).toBe(
      'Links starting with https://core.ac.uk/works or ' +
        'https://core.ac.uk/search are not accepted. Please see below types ' +
        'of links you can use or contact us.'
    )
    expect([...p.querySelectorAll('strong')].map((s) => s.textContent)).toEqual(
      ['works', 'search']
    )
    // the store holds a React element, not a string (R-037)
    expect(typeof store.report.error).toBe('object')
  })

  test('T-411 c2 @P0 a later valid submit clears the error before the request goes out', async () => {
    const { store, container } = mountPage()
    await submitUrl(store, 'https://core.ac.uk/works/19211324')
    expect(errorParagraph(container).innerHTML).toBe(NOT_ACCEPTED)
    typeUrl('2001')
    fireEvent.click(submitButton())
    expect(errorParagraph(container)).toBeNull()
    await waitFor(() => expect(store.report.isLoading).toBe(false))
    expect(outputRequests()).toEqual([`GET ${API}/v3/outputs/2001`])
  })

  test('T-411 c3 @P0 chain: output fetched -> type modal -> form modal -> report sent -> success modal', async () => {
    const user = userEvent.setup()
    const { store, container } = mountPage()
    typeUrl('https://core.ac.uk/outputs/2001')
    await user.click(submitButton())

    // 1. the output of the recorded fixture, then the type modal
    const typeModal = await screen.findByRole('dialog', {
      name: 'Problem-type-modal',
    })
    expect(outputRequests()).toEqual([`GET ${API}/v3/outputs/2001`])
    expect(store.report.output.id).toBe(2001)
    expect(store.report.output.dataProvider.name).toBe(
      'Open Research Online (Open)'
    )
    // the full text is dropped from the stored output (store/report.js:72)
    expect('fullText' in store.report.output).toBe(false)
    expect(typeModal.querySelector('h3').textContent).toBe(
      'Which issue are you reporting?'
    )
    const options = [...typeModal.querySelectorAll('.card-modal-report-type')]
    expect(options.map((o) => o.textContent)).toEqual([
      'The document should not be published',
      'The document is outdated',
    ])
    const proceed = screen.getByRole('button', { name: 'Continue' })
    expect(proceed.disabled).toBe(true)

    // 2. an option enables Continue, which swaps the type for the form modal
    await user.click(screen.getByText('The document should not be published'))
    expect(store.report.updateOption).toBe('takeDownFullText')
    expect(options[0].className.split(' ')).toContain('card-modal-active')
    expect(proceed.disabled).toBe(false)
    await user.click(proceed)
    expect(screen.queryByRole('dialog', { name: 'Problem-type-modal' })).toBe(
      null
    )
    const formModal = await screen.findByRole('dialog', {
      name: 'Problem-form-modal',
    })
    expect(formModal.querySelector('h3').textContent).toBe(
      'Fill up your request'
    )
    expect(
      [...formModal.querySelectorAll('fieldset > div > div')].map(
        (d) => d.textContent
      )
    ).toEqual(['Repository manager', 'Author', 'Other'])

    // 3. a role reveals the fields; Submit sends the report and closes the form
    await user.click(screen.getByText('Author'))
    expect(store.report.role).toBe('author')
    await user.type(screen.getByLabelText('Name'), REPORTER.name)
    await user.type(screen.getByLabelText('Email'), REPORTER.email)
    await user.type(screen.getByLabelText('Comment'), 'report-ok')
    await user.click(screen.getByRole('button', { name: 'Submit' }))
    expect(screen.queryByRole('dialog', { name: 'Problem-form-modal' })).toBe(
      null
    )

    // 4. the success modal of the non-manager role
    const success = await screen.findByRole('dialog', {
      name: 'Success-type-modal',
    })
    expect(e10Bodies).toEqual([
      '{"outputId":2001,"name":"Test Reporter","email":"reporter@localhost",' +
        '"message":"report-ok","updateOption":"takeDownFullText",' +
        '"role":"author"}',
    ])
    expect(requests.filter((r) => r.startsWith('POST'))).toEqual([
      `POST ${E10_URL}`,
    ])
    expect(success.querySelector('h3').textContent).toBe('Thank you!')
    expect(success.textContent).toContain('We have received your request.')
    expect(success.querySelector('.modal-card-success-text').textContent).toBe(
      "We can remove the output's record only if the the document was " +
        // two spaces: the JSX has ' removed ' followed by ' at'
        'removed  at Open Research Online (Open).'
    )
    expect(success.querySelector('img').getAttribute('alt')).toBe('confirmed')
    expect(errorParagraph(container)).toBeNull()

    // 5. "got it" closes the modal and resets the whole report
    await user.click(screen.getByRole('button', { name: 'got it' }))
    expect(screen.queryByRole('dialog')).toBe(null)
    expect(store.report.output).toEqual({})
    expect(store.report.updateOption).toBe(null)
    expect(store.report.role).toBe(null)
    expect(routerMock.push).not.toHaveBeenCalled()
  })

  test('T-411 c3 @P0 chain: "got it" after a take-down re-navigates only when the current path is the output page', async () => {
    const user = userEvent.setup()
    setRouter({ asPath: '/outputs/2001' })
    const { store } = mountPage()
    typeUrl('2001')
    await user.click(submitButton())
    await dialog('Problem-type-modal')
    await user.click(screen.getByText('The document should not be published'))
    await user.click(screen.getByRole('button', { name: 'Continue' }))
    await user.click(await screen.findByText('Author', {}, SLOW))
    await user.type(screen.getByLabelText('Name'), REPORTER.name)
    await user.type(screen.getByLabelText('Email'), REPORTER.email)
    await user.type(screen.getByLabelText('Comment'), 'report-ok')
    await user.click(screen.getByRole('button', { name: 'Submit' }))
    await dialog('Success-type-modal')
    await user.click(screen.getByRole('button', { name: 'got it' }))
    expect(routerMock.push).toHaveBeenCalledTimes(1)
    expect(routerMock.push).toHaveBeenCalledWith('/outputs/2001')
    expect(store.report.output).toEqual({})
  })

  test('T-411 c3 @P0 chain: Close on the type modal ends it without further requests', async () => {
    const user = userEvent.setup()
    const { store } = mountPage()
    typeUrl('2001')
    await user.click(submitButton())
    await dialog('Problem-type-modal')
    await user.click(screen.getByRole('button', { name: 'Close' }))
    expect(screen.queryByRole('dialog')).toBe(null)
    expect(store.report.output).toEqual({})
    expect(requests).toEqual([`GET ${API}/v3/outputs/2001`])
    // the typed link stays in the field
    expect(urlInput().value).toBe('2001')
  })

  test('T-411 c4 @P0 Q-078: the form highlights "Repository manager" while role is null, Submit is disabled and the fields are hidden', async () => {
    const user = userEvent.setup()
    const { store } = mountPage()
    typeUrl('2001')
    await user.click(submitButton())
    await dialog('Problem-type-modal')
    await user.click(screen.getByText('The document is outdated'))
    await user.click(screen.getByRole('button', { name: 'Continue' }))
    const modal = await screen.findByRole('dialog', {
      name: 'Problem-form-modal',
    })
    expect(store.report.updateOption).toBe('issueWithContent')

    const active = () =>
      [...modal.querySelectorAll('fieldset > div > div')]
        .filter((d) => /fieldset-box-item-active/.test(d.className))
        .map((d) => d.textContent)
    // highlighted ...
    expect(active()).toEqual(['Repository manager'])
    // ... but not chosen
    expect(store.report.role).toBe(null)
    expect(screen.getByRole('button', { name: 'Submit' }).disabled).toBe(true)
    expect(modal.querySelector('input')).toBeNull()
    expect(modal.querySelector('textarea')).toBeNull()

    // a click on the highlighted item is what sets the role
    await user.click(screen.getByText('Repository manager'))
    expect(store.report.role).toBe('repositoryManager')
    expect(screen.getByRole('button', { name: 'Submit' }).disabled).toBe(false)
    expect(modal.querySelectorAll('input')).toHaveLength(2)
    expect(active()).toEqual(['Repository manager'])
    // the helper of the comment follows the chosen option
    expect(modal.textContent).toContain('What will you update on this page')
  })

  test('T-411 c4 @P0 Q-060: a failed report is shown on the page only, no modal is open', async () => {
    const user = userEvent.setup()
    const { store, container } = mountPage()
    typeUrl('2001')
    await user.click(submitButton())
    await dialog('Problem-type-modal')
    await user.click(screen.getByText('The document should not be published'))
    await user.click(screen.getByRole('button', { name: 'Continue' }))
    await user.click(await screen.findByText('Author', {}, SLOW))
    await user.type(screen.getByLabelText('Name'), REPORTER.name)
    await user.type(screen.getByLabelText('Email'), REPORTER.email)
    await user.type(screen.getByLabelText('Comment'), 'report-fail')
    await user.click(screen.getByRole('button', { name: 'Submit' }))

    await waitFor(() => expect(store.report.error).toMatch(API_ERROR))
    await waitFor(() => expect(store.report.isLoading).toBe(false))
    expect(e10Bodies).toHaveLength(1)
    // the form modal closed at Submit, nothing else opens
    expect(screen.queryByRole('dialog')).toBe(null)
    expect(store.report.isModalReportSuccessActive).toBe(false)
    expect(errorParagraph(container).textContent).toMatch(API_ERROR)
  })

  test('T-411 c4 @P0 Q-060: the modals never render the report error', async () => {
    // the design portal mounts one microtask after its effect (CS-R19-8)
    const store = new RootStore({ statistics: {} })
    store.report.error = 'report failed'
    store.report.updateOption = 'takeDownFullText'
    store.report.role = 'author'
    const wrappers = [withRouter(), withStore(store)]
    const form = render(<ReportFormModal id={2001} />, { wrappers })
    expect(
      await screen.findByRole('dialog', { name: 'Problem-form-modal' })
    ).toBeTruthy()
    expect(document.body.textContent).not.toContain('report failed')
    form.unmount()
    render(<ReportTypeModal />, { wrappers })
    expect(
      await screen.findByRole('dialog', { name: 'Problem-type-modal' })
    ).toBeTruthy()
    expect(document.body.textContent).not.toContain('report failed')
  })

  test('T-411 c4 @P0 Q-060: an output the API does not return gives the same page message and no modal', async () => {
    const { store, container } = mountPage()
    await submitUrl(store, 'https://core.ac.uk/outputs/990001')
    expect(outputRequests()).toEqual([`GET ${API}/v3/outputs/990001`])
    expect(store.report.error).toMatch(API_ERROR)
    expect(errorParagraph(container).textContent).toMatch(API_ERROR)
    expect(screen.queryByRole('dialog')).toBe(null)
  })
})
