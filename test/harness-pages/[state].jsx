// T-802 harness page (41 I; OD-30; 60 §3 DU-02..DU-22): one design-unit state
// per URL, rendered inside the app shell (pages/_app.jsx: the design global
// CSS, main/global.css, Layout with the app Header and Footer, the consent
// popup). Built only into the harness variant (`npm run build:parity --
// --variant harness` copies test/harness-pages/** to pages/__du-harness/**),
// never into the parity build (T-011 c3). Route: /__du-harness/<state>/,
// served through the allow-all proxy; /__du-harness/index/ lists the states.
//
// IMPL (server env, default `design`) selects the implementation of the
// units: `design` = the installed @oacore/design package through the import
// paths the app uses (findings/04 §1a). The copy (W0.5, W5), the ports (7.1)
// and the antd units (7.2) add their entry to IMPLS; T-802 c2 then compares
// their captures with the package captures (0 px).
//
// Props: the styleguide examples (findings/04 §5) and the app's call shapes,
// as in T-417 (test/unit/design/lib/P0-07/units.jsx). The page is
// self-contained: the harness build removes test/ after copying it.
import React, { useEffect, useState } from 'react'
import {
  Button,
  Card,
  DataProviderLogo,
  ExpandableList,
  Fieldset,
  Form,
  Header,
  Icon,
  Link,
  LoadingBar,
  MetadataList,
  Modal,
  SearchResult,
  Select,
  TextField,
} from '@oacore/design'
import {
  Histoslider,
  MathMarkdown,
  ProgressSpinner,
} from '@oacore/design/lib/elements'
import { Popover } from '@oacore/design/lib/modules'

const DESIGN = {
  Button,
  Card,
  DataProviderLogo,
  ExpandableList,
  Fieldset,
  Form,
  Header,
  Histoslider,
  Icon,
  Link,
  LoadingBar,
  MathMarkdown,
  MetadataList,
  Modal,
  Popover,
  ProgressSpinner,
  SearchResult,
  Select,
  TextField,
}

const IMPLS = { design: DESIGN }

// the 30 icon ids of T-418: the app's 20 and the rendered design units' 14
const ICON_IDS = [
  'account',
  'alert-circle-outline',
  'check',
  'check-circle',
  'checkbox-blank-outline',
  'checkbox-marked',
  'chevron-double-left',
  'chevron-double-right',
  'chevron-left',
  'chevron-right',
  'content-copy',
  'core-symbol',
  'coreLogo',
  'download',
  'emoticon-sad-outline',
  'format-quote-open',
  'github',
  'information-outline',
  'linkedin',
  'magnify',
  'menu',
  'menu-down',
  'office-building',
  'open-in-new',
  'pencil',
  'share-variant',
  'tag',
  'twitter',
  'window-close',
  'writing',
]

// logo fixtures exist for these providers (test/fixtures/api/logos)
const PROVIDER_A = { id: 86, name: 'Open Research Online' }
const PROVIDER_B = { id: 2313, name: 'Aberdeen University Research Archive' }

const SELECT_OPTIONS = [
  { id: 1, icon: '#magnify', value: 'Option A' },
  { id: 2, icon: '#magnify', value: 'Option B' },
  { id: 3, icon: '#magnify', value: 'Option C' },
  { id: 4, value: 'Option D (without icon)' },
]

const LONG_OPTION =
  'A very long suggestion that is much wider than the input of the select and has to wrap or overflow somewhere in the menu'

// DU-08 edge states (41 T-802, 80 §3 row 10)
const optionList = (n) =>
  Array.from({ length: n }, (_, i) => ({ id: i + 1, value: `Option ${i + 1}` }))

const SEARCH_RESULT_DATA = {
  workId: 82984538,
  title: 'Towards effective research recommender systems for repositories',
  author: [
    { name: 'Knoth, Petr' },
    { name: 'Anastasiou, Lucas' },
    { name: 'Charalampous, Aristotelis' },
    { name: 'Cancellieri, Matteo' },
    { name: 'Pearce, Samuel' },
  ],
  publicationDate: '2017',
  publicationVenue: 'Open Repositories 2017',
  fieldOfStudy: 'Computer science',
  thumbnailUrl: '//core.ac.uk/image/82984538/medium',
  metadataLink: '//core.ac.uk/display/82984538',
  fullTextLink: '//core.ac.uk/reader/82984538',
  dataProviders: [PROVIDER_A, PROVIDER_B],
}

const HISTO_DATA = [
  { x0: 2018, x: 2019, y: 100 },
  { x0: 2019, x: 2020, y: 120 },
  { x0: 2020, x: 2021, y: 140 },
]

const FIELDSET_ITEMS = [
  { id: 1, label: 'First item', value: 'firstItem' },
  { id: 2, label: 'Second item', value: 'secondItem' },
  { id: 3, label: 'Third item', value: 'thirdItem' },
]

const noop = () => {}

// a controlled select as the styleguide example and the app's provider
// search (templates/data-provider/search.jsx) drive it
const SelectHarness = ({ I, options, initial = '', ...props }) => {
  const [value, setValue] = useState(initial)
  return (
    <I.Select
      id="du-select"
      value={value}
      label="Search"
      onChange={noop}
      onInput={(data) => setValue(data.value)}
      {...props}
    >
      {options.map((o) => (
        <I.Select.Option
          key={o.id}
          id={o.id}
          value={o.value}
          icon={o.icon}
          customValue={o.customValue}
        >
          {o.value}
        </I.Select.Option>
      ))}
    </I.Select>
  )
}

// the header search bar as the pages configure it (pages/search/index.jsx:123,
// templates/data-providers/index.jsx:125); the app Layout's Header shows it
const SEARCH_BAR = {
  onQueryChanged: noop,
  initQuery: '',
  suggestionsDelay: 0,
  getSuggestions: (term) =>
    SELECT_OPTIONS.slice(0, Math.max(0, SELECT_OPTIONS.length - term.length)),
  searchBarProps: {
    label: 'Search',
    placeholder: 'e.g. repository or journal name',
    prependIcon: '#magnify',
  },
}
const SEARCH_BAR_ADVANCED = {
  ...SEARCH_BAR,
  useAdvancedSearch: true,
  searchBarProps: {
    label: 'Search papers',
    placeholder: 'Search papers',
    prependIcon: '#magnify',
    changeOnBlur: false,
  },
}

const HeaderSearchBar = ({ I, config, isHidden }) => {
  I.Header.useSearchBar(config, { isHidden })
  return <p>The search bar is in the header.</p>
}

const selectState =
  (options, initial, props = {}) =>
  (I) =>
    (
      <div style={{ minHeight: '40rem' }}>
        <SelectHarness I={I} options={options} initial={initial} {...props} />
      </div>
    )

// state id -> render(I); ids carry the DU number (no "search" in a URL:
// pages/_app.jsx:93 styles every page whose path matches /search/)
const STATES = {
  'du-02-icons': (I) => (
    <ul style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem' }}>
      {ICON_IDS.map((id) => (
        <li key={id} style={{ width: '10rem' }}>
          <I.Icon src={`#${id}`} alt={id} />
          <span> {id}</span>
        </li>
      ))}
    </ul>
  ),
  'du-03-variants': (I) => (
    <p>
      <I.Button variant="contained">Contained</I.Button>
      <I.Button variant="outlined">Outlined</I.Button>
      <I.Button variant="text">Text</I.Button>
    </p>
  ),
  'du-03-as-link': (I) => (
    <p>
      <I.Button variant="contained" href="#next" tag="a">
        Next
      </I.Button>
      <I.Button href="/search/">Homepage</I.Button>
    </p>
  ),
  'du-03-disabled': (I) => (
    <p>
      <I.Button variant="contained" disabled>
        Contained
      </I.Button>
      <I.Button variant="outlined" disabled>
        Outlined
      </I.Button>
    </p>
  ),
  // the focus ring keeps the unresolved color-mod() (Q-066)
  'du-03-focused': (I) => (
    <p>
      <I.Button variant="contained">Focused</I.Button>
    </p>
  ),
  'du-04-statics': (I) => (
    <I.Card>
      <I.Card.Title>Hi there, I am just simple Card</I.Card.Title>
      <I.Card.Description>This is just mine description</I.Card.Description>
      <p>Text inside</p>
      <I.Card.Footer>This is just simple footer.</I.Card.Footer>
    </I.Card>
  ),
  'du-04-outlined-tags': (I) => (
    <I.Card variant="outlined" tag="section" className="extra">
      <I.Card.Title tag="h2">Title</I.Card.Title>
      <I.Card.Description tag="div">Description</I.Card.Description>
    </I.Card>
  ),
  // Q-072: the full-text card passes tag="a" and holds anchors
  // (templates/output/index.jsx:225)
  'du-04-tag-a': (I) => (
    <I.Card tag="a" href="/download/1.pdf" variant="outlined">
      <I.Card.Title tag="span">Full text</I.Card.Title>
      <I.Button tag="a" href="/reader/1" variant="contained">
        Read
      </I.Button>
    </I.Card>
  ),
  'du-05-links': (I) => (
    <ul>
      <li>
        <I.Link href="/">Go to homepage</I.Link>
      </li>
      <li>
        <I.Link href="https://www.ref.ac.uk/guidance.pdf" external>
          REF Audit Guidance
        </I.Link>
      </li>
      <li>
        <I.Link href="https://core.ac.uk/" external icon={false}>
          CORE
        </I.Link>
      </li>
      <li>
        <I.Link target="_blank" rel="nofollow" className="x">
          No href
        </I.Link>
      </li>
    </ul>
  ),
  'du-06-auto-close': (I) => (
    <I.Modal aria-label="Demo modal" onClose={noop}>
      <I.Modal.Title>Demo One</I.Modal.Title>
      <I.Modal.Content tag="p">Closes on overlay click or Esc.</I.Modal.Content>
      <I.Modal.Footer>
        <I.Button variant="contained">Close me!</I.Button>
      </I.Modal.Footer>
    </I.Modal>
  ),
  'du-06-hide-manually': (I) => (
    <I.Modal aria-labelledby="du-modal-title" hideManually>
      <I.Modal.Title id="du-modal-title">Demo Two</I.Modal.Title>
      <I.Modal.Content>
        <p>Hidden only by the button.</p>
      </I.Modal.Content>
      <I.Modal.Footer>
        <I.Button variant="contained">Close me!</I.Button>
      </I.Modal.Footer>
    </I.Modal>
  ),
  'du-07-form-label': (I) => (
    <I.Form.Group>
      <I.Form.Label htmlFor="du-form-1">Label</I.Form.Label>
      <I.Form.Control id="du-form-1" defaultValue="Hello" />
    </I.Form.Group>
  ),
  'du-07-form-addons': (I) => (
    <I.Form.Group>
      <I.Form.Addon place="prepend">$</I.Form.Addon>
      <I.Form.Addon place="append">.00</I.Form.Addon>
      <I.Form.Control type="number" id="du-form-2" placeholder="e.g. 10" />
      <I.Form.Label htmlFor="du-form-2">Amount</I.Form.Label>
    </I.Form.Group>
  ),
  'du-07-form-controls': (I) => (
    <I.Form aria-label="controls">
      <I.Form.Group tag="div">
        <I.Form.Control type="select" id="du-form-3" defaultValue="Ipsum">
          <option>Lorem</option>
          <option>Ipsum</option>
        </I.Form.Control>
        <I.Form.Label htmlFor="du-form-3">Select</I.Form.Label>
      </I.Form.Group>
      <I.Form.Group tag="div">
        <I.Form.Control
          type="textarea"
          id="du-form-4"
          placeholder="Hello world!"
        />
        <I.Form.Label htmlFor="du-form-4">Textarea</I.Form.Label>
      </I.Form.Group>
    </I.Form>
  ),
  'du-07-text-fields': (I) => (
    <div>
      <I.TextField
        id="du-text"
        name="name"
        label="Full name"
        placeholder="e.g. John Doe"
      />
      <I.TextField
        id="du-password"
        type="password"
        name="password"
        minLength="8"
        label="Password"
        placeholder="Something secure"
        helper="Should be at least 8 characters length."
      />
      <I.TextField
        id="du-pure"
        label="Name"
        name="name"
        variant="pure"
        size="small"
      />
      <I.TextField
        variant="focus"
        size="large"
        id="du-focus"
        name="name"
        label="Name"
      />
    </div>
  ),
  'du-07-text-field-status': (I) => (
    <div>
      <I.TextField
        id="du-progress"
        name="user-name"
        label="User name"
        defaultValue="john"
        helper="Checking username availability"
        variant="progress"
        statusIcon
      />
      <I.TextField
        id="du-success"
        name="user-name"
        label="User name"
        defaultValue="john"
        helper="Nice to meet you john!"
        variant="success"
        statusIcon
      />
      <I.TextField
        id="du-error"
        name="user-name"
        label="User name"
        helper="User name is required"
        variant="error"
        statusIcon
      />
      {/* the claim modal's string status icon (claim-modal.jsx:77) */}
      <I.TextField
        id="du-pencil"
        name="email"
        label="E-mail"
        defaultValue="x@localhost"
        statusIcon="#pencil"
        disabled
      />
    </div>
  ),
  // floating label of a focused field
  'du-07-text-field-focused': (I) => (
    <I.TextField
      id="du-focused"
      name="name"
      label="Full name"
      placeholder="e.g. John Doe"
    />
  ),
  'du-08-options-icons': selectState(
    [
      ...SELECT_OPTIONS,
      { id: 7, icon: '#magnify', value: 'Other', customValue: true },
    ],
    '',
    {
      placeholder: 'e.g. article title or author name',
      prependIcon: '#magnify',
    }
  ),
  'du-08-pure': selectState(SELECT_OPTIONS, 'Opt', {
    variant: 'pure',
    changeOnBlur: false,
  }),
  'du-08-0-options': selectState([], 'zz'),
  'du-08-1-option': selectState(optionList(1), 'O'),
  'du-08-11-options': selectState(optionList(11), 'O'),
  'du-08-long-option': selectState([{ id: 1, value: LONG_OPTION }], 'A'),
  'du-08-empty-query': selectState(optionList(3), ''),
  // the app Header (Layout) without a configured search bar
  'du-09-header': () => <p>The app header has no search bar here.</p>,
  'du-09-bar-hidden': (I) => (
    <HeaderSearchBar I={I} config={SEARCH_BAR} isHidden />
  ),
  'du-09-bar-shown': (I) => (
    <HeaderSearchBar I={I} config={SEARCH_BAR} isHidden={false} />
  ),
  'du-09-bar-advanced': (I) => (
    <HeaderSearchBar I={I} config={SEARCH_BAR_ADVANCED} isHidden={false} />
  ),
  'du-11-hover': (I) => (
    <div style={{ padding: '6rem 2rem' }}>
      <I.Popover placement="top" content="Download results in CSV">
        <I.Button type="button" variant="text">
          Download
        </I.Button>
      </I.Popover>
    </div>
  ),
  'du-11-click': (I) => (
    <div style={{ padding: '6rem 2rem' }}>
      <I.Popover placement="top-start" trigger="click" content="Click content">
        <I.Button variant="outlined">top-start</I.Button>
      </I.Popover>
    </div>
  ),
  // modules/copyable-input/index.jsx:50: manual visibility
  'du-11-visible': (I) => (
    <div style={{ padding: '6rem 2rem' }}>
      <I.Popover placement="top" content="Copied!" visible>
        <I.Button type="button">Copy</I.Button>
      </I.Popover>
    </div>
  ),
  'du-12-items': (I) => (
    <I.MetadataList>
      <I.MetadataList.Item id="du-field" label="Field of study">
        Computer Science
      </I.MetadataList.Item>
      <I.MetadataList.Item
        id="du-date"
        label="Publication date"
        itemProp="datePublished"
      >
        23 June 2016
      </I.MetadataList.Item>
      <I.MetadataList.Item id="du-empty" label="Publisher" />
    </I.MetadataList>
  ),
  'du-13-sizes': (I) => (
    <div>
      <I.DataProviderLogo alt="Logo sm" imageSrc="" size="sm" />
      <I.DataProviderLogo alt="Logo md" imageSrc="" size="md" />
      <I.DataProviderLogo alt="Logo lg" imageSrc="" size="lg" />
    </div>
  ),
  'du-13-no-default': (I) => (
    <p>
      <I.DataProviderLogo alt="Hidden" useDefault={false} tag="span" />
      After the logo
    </p>
  ),
  'du-14-default': (I) => <I.LoadingBar />,
  'du-14-fixed': (I) => <I.LoadingBar fixed tag="span" className="extra" />,
  'du-15-icon-items': (I) => (
    <I.Fieldset
      items={FIELDSET_ITEMS}
      icon="#account"
      onClick={noop}
      title="Who you are"
    />
  ),
  'du-15-no-icon': (I) => (
    <I.Fieldset
      title="Size"
      items={FIELDSET_ITEMS.slice(0, 2)}
      onClick={noop}
      className="extra"
    />
  ),
  'du-16-loading': (I) => <I.SearchResult id="du-result-1" aria-busy="true" />,
  'du-16-regular': (I) => (
    <I.SearchResult id="du-result-2" data={SEARCH_RESULT_DATA}>
      In this paper, we argue why and how the integration of recommender systems
      for research can enhance repositories.
    </I.SearchResult>
  ),
  'du-16-redirect-no-logo': (I) => (
    <I.SearchResult
      id="du-result-3"
      searchId="s1"
      renderRedirectLink
      useLogo={false}
      data={{
        ...SEARCH_RESULT_DATA,
        title: 'Title $x^2$ **x**',
        fullTextLink: 'https://example.org/paper.pdf',
        isRecommended: true,
      }}
    >
      Abstract text
    </I.SearchResult>
  ),
  'du-16-metadata-only': (I) => (
    <I.SearchResult
      id="du-result-4"
      data={{
        workId: 1,
        title: 'Metadata only',
        author: [{ name: 'Doe, Jane' }],
        dataProviders: [],
      }}
    />
  ),
  // the app's own consent popup (main/index.jsx:19), no cookie set
  'du-17-popup': () => <p>The consent popup is the app&apos;s own.</p>,
  // the app's own footer (modules/layout/index.jsx)
  'du-18-footer': () => <p>The footer is the app&apos;s own.</p>,
  'du-19-styleguide': (I) => (
    <I.Histoslider data={HISTO_DATA.map((d) => ({ ...d }))} selectFunc={noop} />
  ),
  // modules/filters/year/index.jsx:43-51
  'du-19-app-props': (I) => (
    <I.Histoslider
      data={HISTO_DATA.map((d) => ({ ...d }))}
      selection={[2019, 2021]}
      className="slider"
      padding={20}
      width={298}
      showLabels
      selectFunc={noop}
    />
  ),
  'du-20-text': (I) => <I.MathMarkdown>Plain text title</I.MathMarkdown>,
  // KaTeX only, **x** stays literal (Q-097)
  'du-20-math': (I) => (
    <I.MathMarkdown>
      {'Inline $x^2$ and block $$\\frac{1}{2}$$ and **x** stays'}
    </I.MathMarkdown>
  ),
  'du-20-break-line': (I) => (
    <I.MathMarkdown breakLine>{'First\n\nSecond'}</I.MathMarkdown>
  ),
  'du-21-indeterminate': (I) => <I.ProgressSpinner />,
  'du-21-determinate': (I) => <I.ProgressSpinner value={0.5} />,
  'du-21-value-of-max': (I) => (
    <I.ProgressSpinner value={50} max={100} className="extra">
      <title>Loading</title>
    </I.ProgressSpinner>
  ),
  'du-22-four-items': (I) => (
    <I.ExpandableList aria-label="Fruit">
      {['Apple', 'Peach', 'Orange', 'Raspberries'].map((f) => (
        <I.ExpandableList.Item key={f}>{f}</I.ExpandableList.Item>
      ))}
    </I.ExpandableList>
  ),
  'du-22-six-items': (I) => (
    <I.ExpandableList aria-label="Fruit">
      {['Apple', 'Peach', 'Orange', 'Raspberries', 'Banana', 'Mango'].map(
        (f) => (
          <I.ExpandableList.Item key={f}>
            <a href={`/works/?q=${f}`}>{f}</a>
          </I.ExpandableList.Item>
        )
      )}
    </I.ExpandableList>
  ),
}

const HarnessState = ({ state, impl }) => {
  // hydration marker: the spec acts and captures only after it
  const [ready, setReady] = useState(false)
  useEffect(() => setReady(true), [])
  const I = IMPLS[impl]
  if (state === 'index') {
    return (
      <pre data-du-index={impl} data-du-ready={ready}>
        {JSON.stringify(Object.keys(STATES))}
      </pre>
    )
  }
  return (
    <section
      data-du-state={state}
      data-du-impl={impl}
      data-du-ready={ready}
      style={{ padding: '1rem', background: '#fff' }}
    >
      {STATES[state](I)}
    </section>
  )
}

export async function getServerSideProps({ params }) {
  const impl = process.env.IMPL || 'design'
  const { state } = params
  if (!IMPLS[impl] || (state !== 'index' && !STATES[state]))
    return { notFound: true }
  return { props: { state, impl } }
}

export default HarnessState
