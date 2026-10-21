// T-417 design units and their states (P0-07). Props come from the design
// styleguide examples that findings/04 §5 names as the only behaviour specs
// (node_modules/@oacore/design/src/**/*.md), made valid for the propTypes the
// components declare, plus the shapes the app passes (findings/04 §1c call
// sites). Every state renders the unit alone; the census (./census.js) walks
// every node of it. `overlay` marks the states of the c4 overlay census and
// `open` is the user action that opens the overlay.
import React, { useState } from 'react'

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

// DU-08 edge states (41 T-802, 80 §3 row 10), shared with the T-802 pages
const optionList = (n) =>
  Array.from({ length: n }, (_, i) => ({
    id: i + 1,
    value: `Option ${i + 1}`,
  }))

// a controlled select as the styleguide example and the app's provider
// search (templates/data-provider/search.jsx) drive it
const SelectHarness = ({ I, ctx, options, initial = '', ...props }) => {
  const [value, setValue] = useState(initial)
  return (
    <I.Select
      id="du-select"
      value={value}
      label="Search"
      onChange={ctx.spy('onChange')}
      onInput={(data) => {
        ctx.spy('onInput')(data)
        setValue(data.value)
      }}
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
// templates/data-providers/index.jsx:125)
const HeaderPage = ({ I, config, isHidden }) => {
  I.Header.useSearchBar(config, { isHidden })
  return <I.Header id="du-header" />
}

const headerConfig = (ctx, extra = {}) => ({
  onQueryChanged: ctx.spy('onQueryChanged'),
  initQuery: '',
  suggestionsDelay: 0,
  getSuggestions: (term) =>
    SELECT_OPTIONS.slice(0, Math.max(0, SELECT_OPTIONS.length - term.length)),
  searchBarProps: {
    label: 'Search',
    placeholder: 'e.g. repository or journal name',
    prependIcon: '#magnify',
  },
  ...extra,
})

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

// one entry per design unit (60 §3 DU numbering); `name` is the component
// name of findings/04 §0
const UNITS = [
  {
    du: 'DU-02',
    name: 'Icon',
    states: {
      'alt': (I) => <I.Icon src="#check" alt="OK" />,
      'aria-hidden-in-button': (I) => (
        <button type="button">
          <I.Icon src="#check" aria-hidden />
          OK
        </button>
      ),
      'class-and-url': (I) => (
        <I.Icon src="/static/search/images/logo.svg" className="extra" />
      ),
    },
  },
  {
    du: 'DU-03',
    name: 'Button',
    states: {
      'variants': (I) => (
        <p>
          <I.Button variant="contained">Contained</I.Button>
          <I.Button variant="outlined">Outlined</I.Button>
          <I.Button variant="text">Text</I.Button>
        </p>
      ),
      'as-link': (I) => (
        <p>
          <I.Button variant="contained" href="#next" tag="a">
            Next
          </I.Button>
          <I.Button href="/search/">Homepage</I.Button>
        </p>
      ),
      'disabled': (I) => (
        <I.Button variant="contained" disabled>
          Contained
        </I.Button>
      ),
      'in-form': (I) => (
        <form action="/search/" aria-label="button form">
          <input name="q" required aria-label="query" />
          <I.Button variant="contained">Search</I.Button>
        </form>
      ),
    },
  },
  {
    du: 'DU-04',
    name: 'Card',
    states: {
      'statics': (I) => (
        <I.Card>
          <I.Card.Title>Hi there, I am just simple Card</I.Card.Title>
          <I.Card.Description>This is just mine description</I.Card.Description>
          <p>Text inside</p>
          <I.Card.Footer>This is just simple footer.</I.Card.Footer>
        </I.Card>
      ),
      'outlined-tags': (I) => (
        <I.Card variant="outlined" tag="section" className="extra">
          <I.Card.Title tag="h2">Title</I.Card.Title>
          <I.Card.Description tag="div">Description</I.Card.Description>
        </I.Card>
      ),
      // Q-072: the full-text card passes tag="a" and holds anchors
      // (templates/output/index.jsx:225)
      'tag-a-nested-anchors': (I) => (
        <I.Card tag="a" href="/download/1.pdf" variant="outlined">
          <I.Card.Title tag="span">Full text</I.Card.Title>
          <I.Button tag="a" href="/reader/1" variant="contained">
            Read
          </I.Button>
        </I.Card>
      ),
    },
  },
  {
    du: 'DU-05',
    name: 'Link',
    states: {
      'internal': (I) => <I.Link href="/">Go to homepage</I.Link>,
      'external': (I) => (
        <I.Link href="https://www.ref.ac.uk/guidance.pdf" external>
          REF Audit Guidance
        </I.Link>
      ),
      'external-no-icon': (I) => (
        <I.Link href="https://core.ac.uk/" external icon={false}>
          CORE
        </I.Link>
      ),
      'no-href': (I) => (
        <I.Link target="_blank" rel="nofollow" className="x">
          No href
        </I.Link>
      ),
    },
  },
  {
    du: 'DU-06',
    name: 'Modal',
    states: {
      'auto-close': (I, ctx) => (
        <I.Modal aria-label="Demo modal" onClose={ctx.spy('onClose')}>
          <I.Modal.Title>Demo One</I.Modal.Title>
          <I.Modal.Content tag="p">
            Closes on overlay click or Esc.
          </I.Modal.Content>
          <I.Modal.Footer>
            <I.Button onClick={ctx.spy('footer')} variant="contained">
              Close me!
            </I.Button>
          </I.Modal.Footer>
        </I.Modal>
      ),
      'hide-manually': (I, ctx) => (
        <I.Modal aria-labelledby="du-modal-title" hideManually>
          <I.Modal.Title id="du-modal-title">Demo Two</I.Modal.Title>
          <I.Modal.Content>
            <p>Hidden only by the button.</p>
          </I.Modal.Content>
          <I.Modal.Footer>
            <I.Button onClick={ctx.spy('footer')} variant="contained">
              Close me!
            </I.Button>
          </I.Modal.Footer>
        </I.Modal>
      ),
    },
    overlay: {
      state: 'auto-close',
      kind: 'modal',
      // mounted = open (60 §6 row 6)
      open: async () => {},
    },
  },
  {
    du: 'DU-07',
    name: 'Form',
    states: {
      'label-before': (I) => (
        <I.Form.Group>
          <I.Form.Label htmlFor="du-form-1">Label</I.Form.Label>
          <I.Form.Control id="du-form-1" defaultValue="Hello" />
        </I.Form.Group>
      ),
      'addons-number': (I) => (
        <I.Form.Group>
          <I.Form.Addon place="prepend">$</I.Form.Addon>
          <I.Form.Addon place="append">.00</I.Form.Addon>
          <I.Form.Control type="number" id="du-form-2" placeholder="e.g. 10" />
          <I.Form.Label htmlFor="du-form-2">Amount</I.Form.Label>
        </I.Form.Group>
      ),
      'select-textarea': (I) => (
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
      'required-submit': (I, ctx) => (
        <I.Form aria-label="required form" onSubmit={ctx.spy('onSubmit')}>
          <I.TextField
            id="du-form-email"
            type="email"
            label="E-mail"
            required
          />
          <I.Button variant="contained" type="submit">
            Send
          </I.Button>
        </I.Form>
      ),
    },
  },
  {
    du: 'DU-07',
    name: 'TextField',
    states: {
      'text': (I) => (
        <I.TextField
          id="du-text"
          name="name"
          label="Full name"
          placeholder="e.g. John Doe"
        />
      ),
      'password-helper': (I) => (
        <I.TextField
          id="du-password"
          type="password"
          name="password"
          minLength="8"
          label="Password"
          placeholder="Something secure"
          helper="Should be at least 8 characters length."
        />
      ),
      'pure-small': (I) => (
        <I.TextField
          id="du-pure"
          label="Name"
          name="name"
          variant="pure"
          size="small"
        />
      ),
      'focus-large': (I) => (
        <I.TextField
          variant="focus"
          size="large"
          id="du-focus"
          name="name"
          label="Name"
        />
      ),
      'progress': (I) => (
        <I.TextField
          id="du-progress"
          name="user-name"
          label="User name"
          defaultValue="john"
          helper="Checking username availability"
          variant="progress"
          statusIcon
        />
      ),
      'success': (I) => (
        <I.TextField
          id="du-success"
          name="user-name"
          label="User name"
          defaultValue="john"
          helper="Nice to meet you john!"
          variant="success"
          statusIcon
        />
      ),
      'error': (I) => (
        <I.TextField
          id="du-error"
          name="user-name"
          label="User name"
          helper="User name is required"
          variant="error"
          statusIcon
        />
      ),
      // the claim modal's string status icon (claim-modal.jsx:77)
      'status-icon-string': (I) => (
        <I.TextField
          id="du-pencil"
          name="email"
          label="E-mail"
          defaultValue="x@localhost"
          statusIcon="#pencil"
          disabled
        />
      ),
    },
  },
  {
    du: 'DU-08',
    name: 'Select',
    states: {
      'options-icons': (I, ctx) => (
        <SelectHarness
          I={I}
          ctx={ctx}
          options={[
            ...SELECT_OPTIONS,
            { id: 7, icon: '#magnify', value: 'Other', customValue: true },
          ]}
          placeholder="e.g. article title or author name"
          prependIcon="#magnify"
        />
      ),
      'pure-no-blur-change': (I, ctx) => (
        <SelectHarness
          I={I}
          ctx={ctx}
          options={SELECT_OPTIONS}
          initial="Opt"
          variant="pure"
          changeOnBlur={false}
        />
      ),
      'edge-0-options': (I, ctx) => (
        <SelectHarness I={I} ctx={ctx} options={[]} initial="zz" />
      ),
      'edge-1-option': (I, ctx) => (
        <SelectHarness I={I} ctx={ctx} options={optionList(1)} initial="O" />
      ),
      'edge-11-options': (I, ctx) => (
        <SelectHarness I={I} ctx={ctx} options={optionList(11)} initial="O" />
      ),
      'edge-long-option': (I, ctx) => (
        <SelectHarness
          I={I}
          ctx={ctx}
          options={[{ id: 1, value: LONG_OPTION }]}
          initial="A"
        />
      ),
      'edge-empty-query': (I, ctx) => (
        <SelectHarness I={I} ctx={ctx} options={optionList(3)} initial="" />
      ),
    },
    overlay: {
      state: 'options-icons',
      kind: 'select',
      open: async (ctx) => {
        await ctx.user.click(ctx.byRole('combobox'))
        await ctx.user.keyboard('{ArrowDown}')
      },
    },
  },
  {
    du: 'DU-09',
    name: 'Header',
    states: {
      'no-search-bar': (I) => <I.Header id="du-header" />,
      'search-bar-hidden': (I, ctx) => (
        <I.DesignProvider>
          <HeaderPage I={I} config={headerConfig(ctx)} isHidden />
        </I.DesignProvider>
      ),
      'search-bar-shown-advanced': (I, ctx) => (
        <I.DesignProvider>
          <HeaderPage
            I={I}
            config={headerConfig(ctx, {
              useAdvancedSearch: true,
              searchBarProps: {
                label: 'Search papers',
                placeholder: 'Search papers',
                prependIcon: '#magnify',
                changeOnBlur: false,
              },
            })}
            isHidden={false}
          />
        </I.DesignProvider>
      ),
    },
    overlay: {
      state: 'no-search-bar',
      kind: 'dropdown',
      open: async (ctx) => {
        await ctx.user.click(ctx.byRole('button', { name: 'Services' }))
      },
    },
  },
  {
    du: 'DU-10',
    name: 'DesignProvider',
    states: {
      children: (I) => (
        <I.DesignProvider>
          <p>My application with design provider</p>
        </I.DesignProvider>
      ),
    },
  },
  {
    du: 'DU-11',
    name: 'Popover',
    states: {
      'hover-focus': (I) => (
        <I.Popover placement="top" content="Download results in CSV">
          <I.Button type="button" variant="text">
            Download
          </I.Button>
        </I.Popover>
      ),
      'click-trigger': (I) => (
        <I.Popover
          placement="top-start"
          trigger="click"
          content="Click content"
        >
          <I.Button variant="outlined">top-start</I.Button>
        </I.Popover>
      ),
      'interactive-text-field': (I) => (
        <I.Popover
          placement="top-end"
          interactive
          content={<I.TextField id="du-popover-field" label="Full name" />}
        >
          <I.Button variant="outlined">top-end</I.Button>
        </I.Popover>
      ),
      // modules/copyable-input/index.jsx:50: manual visibility
      'visible-manual': (I) => (
        <I.Popover placement="top" content="Copied!" visible>
          <I.Button type="button">Copy</I.Button>
        </I.Popover>
      ),
      'hidden-manual': (I) => (
        <I.Popover placement="top" content="Copied!" visible={false}>
          <I.Button type="button">Copy</I.Button>
        </I.Popover>
      ),
    },
    overlay: {
      state: 'hover-focus',
      kind: 'popover',
      open: async (ctx) => {
        await ctx.user.hover(ctx.byRole('button', { name: 'Download' }))
      },
    },
  },
  {
    du: 'DU-12',
    name: 'MetadataList',
    states: {
      items: (I) => (
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
    },
  },
  {
    du: 'DU-13',
    name: 'DataProviderLogo',
    states: {
      'sizes': (I) => (
        <div>
          <I.DataProviderLogo alt="Logo sm" imageSrc="/logo-1.png" size="sm" />
          <I.DataProviderLogo alt="Logo md" imageSrc="/logo-1.png" size="md" />
          <I.DataProviderLogo alt="Logo lg" imageSrc="/logo-1.png" size="lg" />
        </div>
      ),
      'default-icon': (I) => <I.DataProviderLogo alt="Default" imageSrc="" />,
      'no-default': (I) => (
        <I.DataProviderLogo alt="Hidden" useDefault={false} tag="span" />
      ),
    },
  },
  {
    du: 'DU-14',
    name: 'LoadingBar',
    states: {
      'default': (I) => <I.LoadingBar />,
      'fixed-tag': (I) => <I.LoadingBar fixed tag="span" className="extra" />,
    },
  },
  {
    du: 'DU-15',
    name: 'Fieldset',
    states: {
      'icon-items': (I, ctx) => (
        <I.Fieldset
          items={FIELDSET_ITEMS}
          icon="#account"
          onClick={ctx.spy('onClick')}
          title="Who you are"
        />
      ),
      'no-icon': (I, ctx) => (
        <I.Fieldset
          title="Size"
          items={FIELDSET_ITEMS.slice(0, 2)}
          onClick={ctx.spy('onClick')}
          className="extra"
        />
      ),
    },
  },
  {
    du: 'DU-16',
    name: 'SearchResult',
    states: {
      'loading': (I) => <I.SearchResult id="du-result-1" aria-busy="true" />,
      'regular': (I) => (
        <I.SearchResult id="du-result-2" data={SEARCH_RESULT_DATA}>
          In this paper, we argue why and how the integration of recommender
          systems for research can enhance repositories.
        </I.SearchResult>
      ),
      'redirect-recommended-no-logo': (I) => (
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
      'metadata-only': (I) => (
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
    },
  },
  {
    du: 'DU-17',
    name: 'Cookies',
    states: {
      'popup-no-cookie': (I) => (
        <I.CookiesProvider>
          <I.Cookies />
        </I.CookiesProvider>
      ),
      'essential-set': (I) => (
        <I.CookiesProvider>
          <I.Cookies />
        </I.CookiesProvider>
      ),
    },
    // cookies present before the state renders
    cookies: { 'essential-set': ['essential_cookies_allowed=true'] },
  },
  {
    du: 'DU-17',
    name: 'CookiesProvider',
    states: {
      children: (I) => (
        <I.CookiesProvider>
          <p>Provider child</p>
        </I.CookiesProvider>
      ),
    },
  },
  {
    du: 'DU-18',
    name: 'Footer',
    states: { default: (I) => <I.Footer /> },
  },
  {
    du: 'DU-19',
    name: 'Histoslider',
    states: {
      'styleguide': (I, ctx) => (
        <I.Histoslider
          data={HISTO_DATA.map((d) => ({ ...d }))}
          selectFunc={ctx.spy('selectFunc')}
        />
      ),
      // modules/filters/year/index.jsx:43-51
      'app-props': (I, ctx) => (
        <I.Histoslider
          data={HISTO_DATA.map((d) => ({ ...d }))}
          selection={[2019, 2021]}
          className="slider"
          padding={20}
          width={298}
          showLabels
          selectFunc={ctx.spy('selectFunc')}
        />
      ),
    },
  },
  {
    du: 'DU-20',
    name: 'MathMarkdown',
    states: {
      'text': (I) => <I.MathMarkdown>Plain text title</I.MathMarkdown>,
      'inline-block-literal': (I) => (
        <I.MathMarkdown>
          {'Inline $x^2$ and block $$\\frac{1}{2}$$ and **x** stays'}
        </I.MathMarkdown>
      ),
      'break-line': (I) => (
        <I.MathMarkdown breakLine>{'First\n\nSecond'}</I.MathMarkdown>
      ),
      'no-children': (I) => <I.MathMarkdown />,
    },
  },
  {
    du: 'DU-21',
    name: 'ProgressSpinner',
    states: {
      'indeterminate': (I) => <I.ProgressSpinner />,
      'determinate': (I) => <I.ProgressSpinner value={0.5} />,
      'value-of-max': (I) => (
        <I.ProgressSpinner value={50} max={100} className="extra">
          <title>Loading</title>
        </I.ProgressSpinner>
      ),
    },
  },
  {
    du: 'DU-22',
    name: 'ExpandableList',
    states: {
      'four-items': (I) => (
        <I.ExpandableList aria-label="Fruit">
          {['Apple', 'Peach', 'Orange', 'Raspberries'].map((f) => (
            <I.ExpandableList.Item key={f}>{f}</I.ExpandableList.Item>
          ))}
        </I.ExpandableList>
      ),
      'six-focusable-items': (I) => (
        <I.ExpandableList aria-label="Fruit">
          {['Apple', 'Peach', 'Orange', 'Raspberries', 'Banana', 'Mango'].map(
            (f) => (
              <I.ExpandableList.Item key={f}>
                <a href={`/search/?q=${f}`}>{f}</a>
              </I.ExpandableList.Item>
            )
          )}
        </I.ExpandableList>
      ),
    },
  },
]

const COMPONENT_NAMES = [...new Set(UNITS.map((u) => u.name))]

module.exports = {
  UNITS,
  COMPONENT_NAMES,
  PROVIDER_A,
  PROVIDER_B,
  SEARCH_RESULT_DATA,
  FIELDSET_ITEMS,
  HISTO_DATA,
  LONG_OPTION,
  optionList,
  noop,
  SelectHarness,
  HeaderPage,
  headerConfig,
}
