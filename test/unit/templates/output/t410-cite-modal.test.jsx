// T-410 (41 E, R-053): the Cite button and modal of the output template
// (templates/output/citation.jsx) with the real design Button, Icon and Modal.
// The citation texts are the BibTeX answers of doi.org as the API recorded them
// (the committed doi.org fixture holds the apa answer only, because the
// resolver does not key on the Accept header); derived variants change one
// field of a recorded text.
// c1 Text: the modal shows the bibtex citation as `title, Journal: <journal>,
//    : <year>[, ISBN: ..][, ISSN: ..]`; the apa citation is never shown.
// c2 copy: the icon copies the text of the block to the clipboard and shows
//    "copied" until the modal is closed.
// c3 no DOI: the page gets `citations: []` and the template renders no Cite
//    button (the real getServerSideProps and template on a recorded output).
// c4 Q-037: BibTeX the parser cannot read makes it throw a string while the
//    modal renders; that unmounts the tree. Two of the four recorded doi.org
//    answers are of that kind (`month=Sept`, `month=July`).
import React from 'react'
import { configure } from 'mobx'
import { setRouter } from 'next/router'

import { setupMsw } from '../../../utils/msw'
import {
  act,
  render,
  screen,
  waitFor as baseWaitFor,
  fireEvent,
  userEvent,
  withRouter,
  withStore,
} from '../../../utils/render'
import RootStore from '../../../../store/root'
import CitationManager from '../../../../templates/output/citation'
import OutputTemplate from '../../../../templates/output'
import { getServerSideProps } from '../../../../pages/outputs/[id]'

// The similar-works store of the output template writes after `await` outside
// an action, which MobX 6 reports with a dev-only console.warn that the
// production build of MobX does not print (findings/03 §2.3). Switching the
// check off changes no state transition.
configure({ enforceActions: 'never' })

jest.setTimeout(30000)

const { server, resolver, http, HttpResponse } = setupMsw()

// waits are generous: the suites of other packages run on the same machine
const waitFor = (callback, options) =>
  baseWaitFor(callback, { timeout: 8000, ...options })

const DOI = '10.1186/1756-0500-5-503'

// recorded: doi.org with `Accept: text/x-bibliography; style=bibtex;
// locale=en-GB` for the DOI of output 2001 (a leading space, as served)
const BIB_FOWLER =
  ' @article{Fowler_2012, title={Novel approach for deriving genome wide SNP ' +
  'analysis data from archived blood spots}, volume={5}, ISSN={1756-0500}, ' +
  'url={http://dx.doi.org/10.1186/1756-0500-5-503}, DOI={10.1186/1756-0500-5-503}, ' +
  'number={1}, journal={BMC Research Notes}, publisher={Springer Science and ' +
  'Business Media LLC}, author={Fowler, Katie E and Reitter, Chris P and ' +
  'Walling, Grant A and Griffin, Darren K}, year={2012}, month=Sept }\n'
// derived: the same text with the month in braces, which the parser reads
const BIB_FOWLER_OK = BIB_FOWLER.replace('month=Sept', 'month={Sept}')
// derived: with an ISBN field added after the year
const BIB_FOWLER_ISBN = BIB_FOWLER_OK.replace(
  'year={2012}',
  'year={2012}, ISBN={978-3-16-148410-0}'
)
// recorded: doi.org for the DOI of work 1001 (`month=Mar`, which parses)
const BIB_RAJAVUORI =
  ' @article{Rajavuori_2023, title={Mandatory due diligence laws and climate ' +
  'change litigation: Bridging the corporate climate accountability gap?}, ' +
  'volume={17}, ISSN={1748-5991}, url={http://dx.doi.org/10.1111/rego.12518}, ' +
  'DOI={10.1111/rego.12518}, number={4}, journal={Regulation &amp; ' +
  'Governance}, publisher={Wiley}, author={Rajavuori, Mikko and Savaresi, ' +
  'Annalisa and van Asselt, Harro}, year={2023}, month=Mar, ' +
  'pages={944–953} }\n'
const APA =
  'Fowler, K. E., Reitter, C. P., Walling, G. A., & Griffin, D. K. (2012). ' +
  'Novel approach for deriving genome wide SNP analysis data from archived ' +
  'blood spots. BMC Research Notes, 5(1). https://doi.org/10.1186/1756-0500-5-503\n'

const TEXT_FOWLER =
  'Novel approach for deriving genome wide SNP analysis data from archived ' +
  'blood spots, Journal: BMC Research Notes, : 2012, ISSN: 1756-0500'

const citations = (bibtex, apa = APA) => [
  { id: 'apa', style: 'apa', value: apa },
  { id: 'bibtex', style: 'bibtex', value: bibtex },
]

// the console messages React prints for a render error and for the missing
// keys of the citation blocks are collected here
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

let consoleError
let consoleLog
// one user-event instance per test: setting it up installs a clipboard stub
let user
beforeEach(() => {
  user = userEvent.setup()
  consoleError = jest.spyOn(console, 'error').mockImplementation(() => {})
  consoleLog = jest.spyOn(console, 'log').mockImplementation(() => {})
  jest.spyOn(console, 'time').mockImplementation(() => {})
  jest.spyOn(console, 'timeEnd').mockImplementation(() => {})
})
afterEach(() => {
  jest.restoreAllMocks()
  expect(unmatched).toEqual([])
})

const mountCite = (list, actionLabel = 'Cite') =>
  render(<CitationManager data={{ citations: list, actionLabel }} />)

const citeButton = (name = 'Cite') => screen.getByRole('button', { name })
const dialog = () => screen.queryByRole('dialog')
const block = () => document.getElementById('cite-bibtex')
const blockText = () =>
  block().querySelector('[class*="column-text"]').textContent
const openCite = async () => {
  await user.click(citeButton())
  expect(dialog()).not.toBeNull()
}
const messages = () =>
  consoleError.mock.calls.map((args) => args.map(String).join(' '))

describe('T-410 @P1 Cite modal', () => {
  describe('T-410 c1 @P1 text', () => {
    test('T-410 c1 @P1 the button shows the action label and toggles aria-pressed; the modal opens with the title "Citation"', async () => {
      mountCite(citations(BIB_FOWLER_OK))
      expect(citeButton()).toHaveAttribute('aria-pressed', 'false')
      expect(dialog()).toBeNull()

      await openCite()
      expect(citeButton()).toHaveAttribute('aria-pressed', 'true')
      expect(
        screen.getByRole('heading', { level: 2, name: 'Citation' })
      ).toBeInTheDocument()
      // the label is whatever the caller passes
    })

    test('T-410 c1 @P1 the text is title, ", Journal: …", the stray ", : <year>" and ", ISSN: …"', async () => {
      mountCite(citations(BIB_FOWLER_OK))
      await openCite()
      expect(blockText()).toBe(TEXT_FOWLER)
      // exactly one citation block: the apa text is never rendered
      expect(document.querySelectorAll('[id^="cite-"]')).toHaveLength(1)
      expect(document.body.textContent).not.toContain('Griffin, D. K.')
      expect(document.body.textContent).not.toContain('Walling')
      // the keys of the parse are used as they are: braces are kept in values
      expect(blockText()).not.toContain('Fowler')
    })

    test('T-410 c1 @P1 ISBN is printed before ISSN; a missing journal, year or ISSN leaves its part out', async () => {
      const view = mountCite(citations(BIB_FOWLER_ISBN))
      await openCite()
      expect(blockText()).toBe(
        'Novel approach for deriving genome wide SNP analysis data from ' +
          'archived blood spots, Journal: BMC Research Notes, : 2012, ' +
          'ISBN: 978-3-16-148410-0, ISSN: 1756-0500'
      )
      view.unmount()

      // derived from the recorded text: a title alone
      const bare = ' @misc{k, title={Only a title} }'
      mountCite(citations(bare))
      await openCite()
      expect(blockText()).toBe('Only a title')
    })

    test('T-410 c1 @P1 entities of the recorded text stay as they are in the DOM text', async () => {
      mountCite(citations(BIB_RAJAVUORI))
      await openCite()
      expect(blockText()).toBe(
        'Mandatory due diligence laws and climate change litigation: ' +
          'Bridging the corporate climate accountability gap?, Journal: ' +
          'Regulation &amp; Governance, : 2023, ISSN: 1748-5991'
      )
    })

    test('T-410 c1 @P1 the modal is closed by its Close button and by Esc, both reset the button', async () => {
      mountCite(citations(BIB_FOWLER_OK))
      await openCite()
      await userEvent
        .setup()
        .click(screen.getByRole('button', { name: 'Close' }))
      expect(dialog()).toBeNull()
      expect(citeButton()).toHaveAttribute('aria-pressed', 'false')

      await openCite()
      fireEvent.keyDown(dialog(), { key: 'Escape', keyCode: 27 })
      expect(dialog()).toBeNull()
      expect(citeButton()).toHaveAttribute('aria-pressed', 'false')
    })
  })

  describe('T-410 c2 @P1 copy', () => {
    let writeText

    beforeEach(() => {
      // jsdom has no queryCommandSupported; a browser answers true for "copy"
      document.queryCommandSupported = jest.fn(() => true)
      writeText = jest.fn(() => Promise.resolve())
      // replaces the clipboard stub that user-event installed in its setup
      Object.defineProperty(navigator, 'clipboard', {
        value: { writeText },
        configurable: true,
      })
    })
    afterEach(() => {
      delete document.queryCommandSupported
      delete navigator.clipboard
    })

    const copyIcon = () => block().querySelector('[class*="column-icon"] svg')

    test('T-410 c2 @P1 clicking the icon writes the text of the block to the clipboard and shows "copied"', async () => {
      mountCite(citations(BIB_FOWLER_OK))
      await openCite()
      expect(screen.queryByText('copied')).toBeNull()
      expect(copyIcon().getAttribute('class')).not.toContain('copied-success')

      await user.click(copyIcon())

      // the support check is short-circuited by the function existing
      expect(document.queryCommandSupported).not.toHaveBeenCalled()
      expect(writeText).toHaveBeenCalledTimes(1)
      expect(writeText).toHaveBeenCalledWith(TEXT_FOWLER)
      await waitFor(() =>
        expect(screen.getByText('copied')).toBeInTheDocument()
      )
      expect(copyIcon().getAttribute('class')).toContain('copied-success')
      expect(consoleLog).toHaveBeenCalledTimes(1)
      expect(consoleLog).toHaveBeenCalledWith(
        `Copying to clipboard: ${TEXT_FOWLER}`
      )
    })

    test('T-410 c2 @P1 closing the modal clears "copied"; the reopened modal starts without it', async () => {
      mountCite(citations(BIB_FOWLER_OK))
      await openCite()
      await user.click(copyIcon())
      await waitFor(() =>
        expect(screen.getByText('copied')).toBeInTheDocument()
      )

      await user.click(screen.getByRole('button', { name: 'Close' }))
      expect(dialog()).toBeNull()
      await user.click(citeButton())
      expect(dialog()).not.toBeNull()
      expect(screen.queryByText('copied')).toBeNull()
      expect(copyIcon().getAttribute('class')).not.toContain('copied-success')
    })

    test('T-410 c2 @P1 a refused write is logged and does not show "copied"', async () => {
      const refusal = new Error('denied')
      writeText.mockImplementation(() => Promise.reject(refusal))
      mountCite(citations(BIB_FOWLER_OK))
      await openCite()
      await user.click(copyIcon())

      await waitFor(() =>
        expect(
          consoleError.mock.calls.some(
            ([first, second]) =>
              first === 'Async: Could not copy text: ' && second === refusal
          )
        ).toBe(true)
      )
      expect(screen.queryByText('copied')).toBeNull()
      expect(consoleLog).not.toHaveBeenCalled()
    })

    test('T-410 c2 @P1 the copied text is the DOM text of the block, so it follows the citation shown', async () => {
      mountCite(citations(BIB_RAJAVUORI))
      await openCite()
      await user.click(copyIcon())
      expect(writeText).toHaveBeenCalledWith(
        'Mandatory due diligence laws and climate change litigation: ' +
          'Bridging the corporate climate accountability gap?, Journal: ' +
          'Regulation &amp; Governance, : 2023, ISSN: 1748-5991'
      )
      await waitFor(() =>
        expect(screen.getByText('copied')).toBeInTheDocument()
      )
    })
  })

  describe('T-410 c3 @P1 no DOI -> no Cite', () => {
    const DOI_URL = `https://doi.org/${DOI}`
    const E6 = 'https://api.core.ac.uk/v3/outputs/2001'
    let doiRequests

    // doi.org answers by Accept header, like the real service; the committed
    // fixture would give the apa text for both
    const answerDoi = () =>
      server.use(
        http.get(DOI_URL, ({ request }) => {
          doiRequests.push(request.headers.get('accept'))
          const bibtex = (request.headers.get('accept') || '').includes(
            'style=bibtex'
          )
          return new HttpResponse(bibtex ? BIB_FOWLER_OK : APA, {
            status: 200,
            headers: { 'Content-Type': 'text/x-bibliography' },
          })
        })
      )

    const recordedOutput = () =>
      JSON.parse(resolver.resolve('GET', E6).body.toString('utf8'))

    const pageData = async () => {
      const { props } = await getServerSideProps({ params: { id: '2001' } })
      return props.data
    }
    const mountTemplate = async (data) => {
      setRouter({
        query: { id: '2001' },
        pathname: '/outputs/[id]',
        asPath: '/outputs/2001',
      })
      const store = new RootStore({ statistics: {} })
      const view = render(<OutputTemplate data={data} />, {
        wrappers: [withRouter(), withStore(store)],
      })
      // the similar works are fetched on mount: wait for the card to settle
      await waitFor(() => expect(store.similarWorks.isLoading).toBe(false))
      await act(async () => {
        await new Promise((resolve) => {
          setTimeout(resolve, 50)
        })
      })
      return view
    }

    beforeEach(() => {
      doiRequests = []
      answerDoi()
    })

    test('T-410 c3 @P1 with a DOI the gSSP fetches apa and bibtex and the template shows the Cite button, whose modal prints the bibtex text', async () => {
      const data = await pageData()
      expect(doiRequests.slice().sort()).toEqual([
        'text/x-bibliography; style=apa; locale=en-GB',
        'text/x-bibliography; style=bibtex; locale=en-GB',
      ])
      expect(data.identifiers.doi).toBe(DOI)
      expect(data.citations.map((c) => c.id)).toEqual(['apa', 'bibtex'])

      await mountTemplate(data)
      await openCite()
      expect(blockText()).toBe(TEXT_FOWLER)
    })

    test('T-410 c3 @P1 without a DOI the gSSP sets citations [] without asking doi.org and the template has no Cite button', async () => {
      server.use(
        http.get(E6, () => {
          const output = recordedOutput()
          return HttpResponse.json({
            ...output,
            identifiers: { ...output.identifiers, doi: null },
          })
        })
      )
      const data = await pageData()
      expect(data.identifiers.doi).toBeNull()
      expect(data.citations).toEqual([])
      expect(doiRequests).toEqual([])

      await mountTemplate(data)
      expect(screen.queryByRole('button', { name: 'Cite' })).toBeNull()
      expect(screen.queryByText('Cite')).toBeNull()
      // the rest of the page is there
      expect(document.querySelector('h1').textContent).toContain(
        'Novel approach'
      )
    })

    test('T-410 c3 @P1 a failing doi.org also gives citations [] and no Cite button; an empty list renders no button either', async () => {
      server.use(
        http.get(DOI_URL, () =>
          HttpResponse.json({ message: 'down' }, { status: 500 })
        )
      )
      const data = await pageData()
      expect(data.citations).toEqual([])

      const view = await mountTemplate(data)
      expect(screen.queryByRole('button', { name: 'Cite' })).toBeNull()
      view.unmount()

      // `citations` absent altogether: no button, no error
      await mountTemplate({ ...data, citations: undefined })
      expect(screen.queryByRole('button', { name: 'Cite' })).toBeNull()
    })
  })

  describe('T-410 c4 @P1 Q-037 malformed BibTeX throws a string in render', () => {
    // React 19 under act hands an uncaught render error to act, which rethrows
    // it to the caller of the click; it no longer dispatches window `error`
    // events or logs it there (React 17/18 did both, AD-168)
    let uncaught
    const onError = (event) => {
      uncaught.push(event.error)
      event.preventDefault()
    }
    const clickCite = () => {
      try {
        fireEvent.click(citeButton())
      } catch (error) {
        return error
      }
      return undefined
    }
    beforeEach(() => {
      uncaught = []
      window.addEventListener('error', onError)
    })
    afterEach(() => {
      window.removeEventListener('error', onError)
    })

    test('T-410 c4 @P1 the recorded text with month=Sept: opening the modal throws a string and the tree is unmounted', () => {
      const { container } = mountCite(citations(BIB_FOWLER))
      expect(container.innerHTML).not.toBe('')

      // the button click re-renders the component, which throws on the way
      const thrown = clickCite()

      expect(typeof thrown).toBe('string')
      expect(thrown).toBe('Value expected:Sept }\n for key: Sept')
      expect(uncaught).toEqual([])
      // nothing is left of the button or of the page
      expect(container.innerHTML).toBe('')
      expect(dialog()).toBeNull()
      expect(
        messages().some((m) =>
          m.includes(
            'The above error occurred in the <CitationManager> component'
          )
        )
      ).toBe(false)
    })

    test('T-410 c4 @P1 unterminated values throw their own strings, and the tree is unmounted each time', () => {
      const cases = [
        ['@article{k, title={Unbalanced, year={2012} ', 'Unterminated value'],
        [
          '@article{k, title="abc, year={2012}}',
          'Unterminated value:abc, year={2012}}',
        ],
        [
          // a space in the key, as in the recorded text of work 1002
          '@misc{climate watch_2021, title={NDC-SDG Linkages}, year={2021} }',
          '... = value expected, equals sign missing:watch_2021, title={NDC-SDG Linkages}, year={2021} }',
        ],
      ]
      cases.forEach(([text, expected]) => {
        uncaught = []
        const { container, unmount } = mountCite(citations(text))
        expect(clickCite()).toBe(expected)
        expect(uncaught).toEqual([])
        expect(container.innerHTML).toBe('')
        unmount()
      })
    })

    test('T-410 c4 @P1 text the parser reads as nothing (garbage, empty, the apa text) opens an empty modal without a block', async () => {
      const cases = ['garbage', '', APA]
      for (const text of cases) {
        const { unmount } = mountCite(citations(text))
        // eslint-disable-next-line no-await-in-loop
        await openCite()
        expect(
          screen.getByRole('heading', { name: 'Citation' })
        ).toBeInTheDocument()
        expect(block()).toBeNull()
        expect(uncaught).toEqual([])
        unmount()
      }
    })

    test('T-410 c4 @P1 only the bibtex entry is read: an apa-only list opens an empty modal, a malformed apa entry is ignored', async () => {
      mountCite([
        { id: 'apa', style: 'apa', value: '@article{k, title={Unbalanced' },
      ])
      await openCite()
      expect(block()).toBeNull()
      expect(uncaught).toEqual([])
    })

    test('T-410 c4 @P1 of the recorded answers month=Mar (work 1001) reads, month=Sept (output 2001) does not', async () => {
      const view = mountCite(citations(BIB_RAJAVUORI))
      await openCite()
      expect(blockText()).toContain('Journal: Regulation &amp; Governance')
      expect(uncaught).toEqual([])
      view.unmount()

      const crash = mountCite(citations(BIB_FOWLER))
      expect(clickCite()).toMatch(/^Value expected:Sept/)
      expect(crash.container.innerHTML).toBe('')
    })
  })
})
