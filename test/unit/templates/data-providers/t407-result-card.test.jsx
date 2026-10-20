// T-407 (41 E, R-013): providers result card with the real design library:
// anchor structure, and a click on the title navigates client-side to
// /data-providers/<id> through next/link.
const React = require('react')

const {
  render,
  screen,
  fireEvent,
  withRouter,
} = require('../../../utils/render')
const ResultCard =
  require('../../../../templates/data-providers/result-card').default

const props = {
  repoId: 86,
  title: 'Open Research Online (Open University)',
  homePage: 'https://oro.open.ac.uk/',
  country: 'United Kingdom',
}

describe('T-407 @P0 providers result card', () => {
  test('T-407 c1 @P0 anchor structure: icon, title link, webpage link, country', () => {
    const { container } = render(React.createElement(ResultCard, props), {
      wrapper: withRouter(),
    })
    const card = container.firstElementChild
    expect(card.tagName).toBe('DIV')
    expect(card.className.split(' ')).toEqual(
      expect.arrayContaining(['result', 'result-card'])
    )
    const heading = card.querySelector(':scope > span.result-heading')
    expect([...heading.children].map((e) => e.tagName.toLowerCase())).toEqual([
      'svg',
      'a',
    ])
    const svg = heading.children[0]
    expect(svg.getAttribute('aria-hidden')).toBe('true')
    expect(svg.querySelector('use').getAttribute('href')).toBe(
      '/static/search/icons.svg#office-building'
    )
    const title = screen.getByRole('link', { name: props.title })
    expect(title).toBe(heading.children[1])
    expect(title.getAttribute('href')).toBe('/data-providers/86')
    expect(title.getAttribute('class')).toBe('result-title')
    expect(title.hasAttribute('target')).toBe(false)

    const list = card.querySelector(':scope > dl.result-metadata')
    expect(
      [...list.querySelectorAll('dt')].map((dt) => [dt.id, dt.textContent])
    ).toEqual([
      ['data-provider-webpage-title', 'webpage'],
      ['data-provider-country-title', 'country'],
    ])
    const web = screen.getByRole('link', { name: props.homePage })
    expect([
      web.getAttribute('href'),
      web.getAttribute('target'),
      web.getAttribute('rel'),
    ]).toEqual([props.homePage, '_blank', 'noopener noreferrer'])
    expect(
      list.querySelector('[aria-labelledby="data-provider-country-title"]')
        .textContent
    ).toBe('United Kingdom')
    expect(screen.getAllByRole('link')).toHaveLength(2)
  })

  test('T-407 c1 @P0 without a country the country item is absent', () => {
    const { container } = render(
      React.createElement(ResultCard, { ...props, country: undefined }),
      { wrapper: withRouter() }
    )
    expect(container.querySelector('#data-provider-country-title')).toBeNull()
    expect(container.querySelectorAll('dt')).toHaveLength(1)
  })

  test('T-407 c2 @P0 click on the title -> client navigation to /data-providers/<id>', () => {
    const router = require('next/router').default
    render(React.createElement(ResultCard, props), { wrapper: withRouter() })
    const title = screen.getByRole('link', { name: props.title })
    const notPrevented = fireEvent.click(title)
    expect(notPrevented).toBe(false)
    expect(router.push).toHaveBeenCalledTimes(1)
    expect(router.push.mock.calls[0][0]).toBe('/data-providers/86')
    expect(router.push.mock.calls[0][1]).toBe('/data-providers/86')
  })
})
