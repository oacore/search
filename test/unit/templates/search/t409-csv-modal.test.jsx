// T-409 (41 E, R-028): the CSV download modal of the search page
// (templates/search/modals/download-results.jsx) opened from the real search
// template, with the real design Modal and Fieldset, the real search store and
// MSW answering the E3 POST from the recorded fixtures (scenario search-csv;
// js-file-download is the harness factory spy). The props of the template come
// from the real getServerSideProps of the page.
// c1 `activeLimit`: the three size cards set the store's limit (10, 100, 1000).
// c2 E3 body: Download sends `{q, accept: 'text/csv', limit}` and hands the
//    Blob to FileDownload as results.csv; the 1000 option is refused by the API
//    (400), which is only logged.
// c3 Q-056 the modal is gone before the download finishes, Q-077 the reopened
//    modal highlights "Current page" while `activeLimit` keeps the last choice,
//    Q-085 a `hideManually` modal ignores Esc and the backdrop, has no close
//    button, and leaves `overflow: unset` on the body.
// c4 Cancel closes the modal and sends nothing.
import React from 'react'
import { configure } from 'mobx'
import { setRouter } from 'next/router'
import FileDownload from 'js-file-download'

import { setupMsw } from '../../../utils/msw'
import {
  act,
  render,
  screen,
  waitFor as baseWaitFor,
  fireEvent,
  userEvent,
  within,
  withRouter,
  withStore,
} from '../../../utils/render'
import RootStore from '../../../../store/root'
import { getServerSideProps } from '../../../../pages/search'
import SearchTemplate from '../../../../templates/search'

// The search store writes `activeDownloadModal` outside an action while the
// template observes it, which MobX 6 reports with a dev-only console.warn that
// the production build of MobX does not print (findings/03 §2.3). Switching the
// check off changes no state transition.
configure({ enforceActions: 'never' })

jest.setTimeout(30000)

const { server, resolver, http } = setupMsw()

// waits are generous: the suites of other packages run on the same machine
const waitFor = (callback, options) =>
  baseWaitFor(callback, { timeout: 8000, ...options })

const E3 = 'https://api.core.ac.uk/v3/search/works'
const TITLE = 'Download results in CSV'
const DIALOG = 'Download results in cvs modal'
const CURRENT = 'Current page'
const TOP100 = 'Top 100 results'
const ALL = 'All the results (up to 1,000)'

const csvAnswer = (limit) =>
  resolver.resolve(
    'POST',
    E3,
    JSON.stringify({ q: 'climate', accept: 'text/csv', limit })
  )

// a request the fixtures cannot answer is a 502 naming its triple: no test may
// depend on one by accident
let unmatched
beforeEach(() => {
  unmatched = []
  const resolve = resolver.resolve.bind(resolver)
  jest.spyOn(resolver, 'resolve').mockImplementation((...args) => {
    const answerOf = resolve(...args)
    if (answerOf.unmatched) unmatched.push(answerOf.unmatched)
    return answerOf
  })
})

let started
let answered
let posts
let release

const settle = async () => {
  await waitFor(() => expect(answered).toBe(started))
  await act(async () => {
    await new Promise((resolve) => {
      setTimeout(resolve, 20)
    })
  })
  await waitFor(() => expect(answered).toBe(started))
}

beforeEach(() => {
  // the design Modal leaves "unset" here after a test that opened one
  document.body.style.overflow = ''
  started = 0
  answered = 0
  posts = []
  release = null
  FileDownload.mockClear()
  server.events.on('request:start', () => {
    started += 1
  })
  server.events.on('response:mocked', () => {
    answered += 1
  })
  jest.spyOn(console, 'time').mockImplementation(() => {})
  jest.spyOn(console, 'timeEnd').mockImplementation(() => {})
  jest.spyOn(console, 'log').mockImplementation(() => {})
  // logs every E3 request; the answers come from the recorded fixtures, after
  // `release` when a test holds them
  server.use(
    http.post(E3, async ({ request }) => {
      const text = await request.clone().text()
      // the E1 search of the page is a POST to the same path
      if (JSON.parse(text).accept !== 'text/csv') return undefined
      posts.push({
        body: text,
        contentType: request.headers.get('content-type'),
        accept: request.headers.get('accept'),
      })
      if (release) await release.promise
      return undefined
    })
  )
})
afterEach(async () => {
  if (release) release.resolve()
  // no answer may arrive after the test: the page would be unmounted
  await settle()
  server.events.removeAllListeners()
  jest.restoreAllMocks()
  expect(unmatched).toEqual([])
})

const hold = () => {
  let resolve
  const promise = new Promise((r) => {
    resolve = r
  })
  release = { promise, resolve }
}

let store
let view
const mountPage = async () => {
  const { props } = await getServerSideProps({ query: { q: 'climate' } })
  started = 0
  answered = 0
  setRouter({
    query: { q: 'climate', page: '1' },
    pathname: '/search',
    asPath: '/search?q=climate&page=1',
  })
  store = new RootStore({ statistics: {} })
  view = render(<SearchTemplate data={props.data} members={props.members} />, {
    wrappers: [withRouter(), withStore(store)],
  })
  await waitFor(() =>
    expect(screen.getByText(/research outputs found/)).toBeInTheDocument()
  )
  await settle()
  return view
}

// the first action button of the results header is the CSV download
const downloadIcon = () =>
  view.container.querySelectorAll('button.action-button')[0]
const user = () => userEvent.setup()
const dialog = () => screen.queryByRole('dialog', { name: DIALOG })
const openModal = async () => {
  await user().click(downloadIcon())
  expect(dialog()).not.toBeNull()
}
const card = (label) => screen.getByText(label).closest('[class*="box-item"]')
const isActive = (label) => /box-item-active/.test(card(label).className)
const actives = () => [CURRENT, TOP100, ALL].filter((label) => isActive(label))
const submit = () => screen.getByRole('button', { name: 'Download' })
const cancel = () => screen.getByRole('button', { name: 'Cancel' })

describe('T-409 @P1 CSV download modal', () => {
  test('T-409 c1 @P1 the modal shows the title, the text and three sizes, "Current page" first and highlighted', async () => {
    await mountPage()
    expect(dialog()).toBeNull()
    expect(store.search.activeLimit).toBe(10)
    expect(store.search.activeDownloadModal).toBe(false)

    await openModal()
    expect(store.search.activeDownloadModal).toBe(true)
    const modal = within(dialog())
    expect(modal.getByRole('heading', { level: 3 }).textContent).toBe(TITLE)
    expect(
      modal.getByText(
        /By downloading the file you will receive the search results/
      )
    ).toBeInTheDocument()
    expect(modal.getByText('Size')).toBeInTheDocument()
    expect(
      [...dialog().querySelectorAll('[class*="box-item"] span')].map(
        (span) => span.textContent
      )
    ).toEqual([CURRENT, TOP100, ALL])
    expect(actives()).toEqual([CURRENT])
    expect(submit()).toBeEnabled()
    expect(cancel()).toBeEnabled()
    // the dialog is in the portal root the design Modal adds to the body
    expect(dialog().closest('#modal-root')).not.toBeNull()
  })

  test('T-409 c1 @P1 a size card sets activeLimit (10, 100, 1000) and moves the highlight, nothing is sent yet', async () => {
    await mountPage()
    await openModal()

    await user().click(screen.getByText(TOP100))
    expect(store.search.activeLimit).toBe(100)
    expect(actives()).toEqual([TOP100])

    await user().click(screen.getByText(ALL))
    expect(store.search.activeLimit).toBe(1000)
    expect(actives()).toEqual([ALL])

    await user().click(screen.getByText(CURRENT))
    expect(store.search.activeLimit).toBe(10)
    expect(actives()).toEqual([CURRENT])

    // choosing is not downloading
    expect(posts).toEqual([])
    expect(FileDownload).not.toHaveBeenCalled()
    expect(dialog()).not.toBeNull()
  })

  test('T-409 c2 @P1 Download sends the E3 body {q, accept, limit} for the current page and downloads results.csv', async () => {
    await mountPage()
    await openModal()

    await user().click(submit())
    await settle()

    expect(posts).toEqual([
      {
        body: '{"q":"climate","accept":"text/csv","limit":10}',
        contentType: 'application/json',
        accept: 'application/json',
      },
    ])
    expect(FileDownload).toHaveBeenCalledTimes(1)
    const [blob, name] = FileDownload.mock.calls[0]
    expect(name).toBe('results.csv')
    expect(blob).toBeInstanceOf(Blob)
    expect(await blob.text()).toBe(csvAnswer(10).body.toString('utf8'))
    // the modal is closed for good and the store is idle
    expect(dialog()).toBeNull()
    expect(store.search.activeDownloadModal).toBe(false)
    expect(store.search.isLoading).toBe(false)
  })

  test('T-409 c2 @P1 the top-100 choice goes into the body as limit 100', async () => {
    await mountPage()
    await openModal()
    await user().click(screen.getByText(TOP100))
    await user().click(submit())
    await settle()

    expect(posts.map((p) => p.body)).toEqual([
      '{"q":"climate","accept":"text/csv","limit":100}',
    ])
    expect(FileDownload).toHaveBeenCalledTimes(1)
    expect(await FileDownload.mock.calls[0][0].text()).toBe(
      csvAnswer(100).body.toString('utf8')
    )
    expect(FileDownload.mock.calls[0][1]).toBe('results.csv')
  })

  test('T-409 c2 @P1 the "up to 1,000" choice is refused by the API (400): logged, nothing downloaded, the modal is gone', async () => {
    const error = jest.spyOn(console, 'error').mockImplementation(() => {})
    await mountPage()
    await openModal()
    await user().click(screen.getByText(ALL))
    await user().click(submit())
    await settle()

    expect(posts.map((p) => p.body)).toEqual([
      '{"q":"climate","accept":"text/csv","limit":1000}',
    ])
    expect(error).toHaveBeenCalledTimes(1)
    expect(error.mock.calls[0][0]).toBeInstanceOf(Error)
    expect(error.mock.calls[0][0].status).toBe(400)
    expect(FileDownload).not.toHaveBeenCalled()
    expect(dialog()).toBeNull()
    expect(store.search.isLoading).toBe(false)
    // the limit stays, so the next Download would ask for 1000 again
    expect(store.search.activeLimit).toBe(1000)
  })

  test('T-409 c3 @P1 Q-056: the modal closes when Download is clicked, before the request is answered', async () => {
    hold()
    await mountPage()
    await openModal()
    await user().click(submit())

    // the request is on the wire and unanswered ...
    await waitFor(() => expect(posts).toHaveLength(1))
    expect(FileDownload).not.toHaveBeenCalled()
    expect(store.search.isLoading).toBe(true)
    // ... but the modal is already gone: onSubmit sets the flag to undefined
    expect(dialog()).toBeNull()
    expect(store.search.activeDownloadModal).toBeUndefined()
    // the page shows the progress bar instead
    expect(
      view.container.querySelector('[class*="loading-bar"]')
    ).not.toBeNull()

    // the answer arrives: the file is saved, the flag becomes false
    release.resolve()
    release = null
    await waitFor(() => expect(FileDownload).toHaveBeenCalledTimes(1))
    await waitFor(() => expect(store.search.isLoading).toBe(false))
    expect(store.search.activeDownloadModal).toBe(false)
    expect(dialog()).toBeNull()
  })

  test('T-409 c3 @P1 Q-056: a modal opened again while the download runs has Download disabled, and the answer closes it', async () => {
    hold()
    await mountPage()
    await openModal()
    await user().click(submit())
    await waitFor(() => expect(posts).toHaveLength(1))
    expect(dialog()).toBeNull()

    // nothing stops the user from opening the modal once more
    await openModal()
    expect(store.search.isLoading).toBe(true)
    expect(submit()).toBeDisabled()
    expect(cancel()).toBeEnabled()
    await user().click(submit())
    expect(posts).toHaveLength(1)

    // the answer of the first request closes the new modal as well
    release.resolve()
    release = null
    await waitFor(() => expect(FileDownload).toHaveBeenCalledTimes(1))
    await waitFor(() => expect(store.search.isLoading).toBe(false))
    expect(dialog()).toBeNull()
    expect(store.search.activeDownloadModal).toBe(false)
    expect(posts).toHaveLength(1)
  })

  test('T-409 c3 @P1 Q-077: the reopened modal highlights "Current page" while activeLimit keeps the last choice', async () => {
    await mountPage()
    await openModal()
    await user().click(screen.getByText(TOP100))
    await user().click(submit())
    await settle()
    expect(dialog()).toBeNull()
    expect(store.search.activeLimit).toBe(100)

    await openModal()
    // the Fieldset starts again from its first item ...
    expect(actives()).toEqual([CURRENT])
    // ... the store does not
    expect(store.search.activeLimit).toBe(100)

    // so a download without choosing asks for 100 under "Current page"
    await user().click(submit())
    await settle()
    expect(posts.map((p) => JSON.parse(p.body).limit)).toEqual([100, 100])
    expect(FileDownload).toHaveBeenCalledTimes(2)
    expect(await FileDownload.mock.calls[1][0].text()).toBe(
      csvAnswer(100).body.toString('utf8')
    )
  })

  test('T-409 c3 @P1 Q-085: a hideManually modal ignores Esc and a backdrop click and has no close button', async () => {
    await mountPage()
    await openModal()
    const dlg = dialog()
    expect(screen.queryByRole('button', { name: 'Close' })).toBeNull()

    // Esc inside the modal
    fireEvent.keyDown(dlg, { key: 'Escape', code: 'Escape', keyCode: 27 })
    fireEvent.keyDown(dlg, { key: 'Esc', keyCode: 27 })
    expect(dialog()).not.toBeNull()
    expect(store.search.activeDownloadModal).toBe(true)

    // a click on the backdrop (the dialog's parent), and on the document
    fireEvent.click(dlg.parentElement)
    fireEvent.click(document.body)
    expect(dialog()).not.toBeNull()
    expect(store.search.activeDownloadModal).toBe(true)
    expect(posts).toEqual([])
  })

  test('T-409 c3 @P1 Q-085: the body is locked while the modal is open and ends "unset" after it closes', async () => {
    await mountPage()
    // before the first open nothing touched the body
    expect(document.body.style.overflow).toBe('')

    await openModal()
    expect(document.body.style.overflow).toBe('hidden')
    await user().click(cancel())
    expect(dialog()).toBeNull()
    // the design Modal writes "unset", not the previous (empty) value
    expect(document.body.style.overflow).toBe('unset')

    // and again through the Download path
    await openModal()
    expect(document.body.style.overflow).toBe('hidden')
    await user().click(submit())
    await settle()
    expect(document.body.style.overflow).toBe('unset')
  })

  test('T-409 c4 @P1 Cancel closes the modal, sends nothing and downloads nothing', async () => {
    await mountPage()
    // requests the page itself made (aggregations, logos) are not the modal's
    const before = started
    await openModal()
    await user().click(cancel())

    expect(dialog()).toBeNull()
    expect(store.search.activeDownloadModal).toBe(false)
    expect(store.search.isLoading).toBe(false)
    await settle()
    expect(posts).toEqual([])
    expect(started).toBe(before)
    expect(FileDownload).not.toHaveBeenCalled()
  })

  test('T-409 c4 @P1 Cancel after choosing a size keeps the choice in the store, and the next Download uses it', async () => {
    await mountPage()
    await openModal()
    await user().click(screen.getByText(TOP100))
    await user().click(cancel())
    expect(dialog()).toBeNull()
    expect(store.search.activeLimit).toBe(100)
    expect(posts).toEqual([])

    await openModal()
    expect(actives()).toEqual([CURRENT])
    await user().click(submit())
    await settle()
    expect(posts.map((p) => p.body)).toEqual([
      '{"q":"climate","accept":"text/csv","limit":100}',
    ])
  })
})
