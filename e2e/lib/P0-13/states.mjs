// P0-13 oracle of the search states: what the recorded API answers for one search request (E1), read
// through the harness resolver. The page of a state must list exactly the works of that answer, in order, with
// its total in the count line. The request itself (the q the app sends) is spelled out by each test, so a
// wrong q is an unmatched fixture (the guard fails the test) and a wrong page is a different list.
export const E1_URL = 'https://api.core.ac.uk/v3/search/works?t=undefined'

export function answer(resolver, { q, offset = 0, sort = 'relevance' }) {
  const body = JSON.stringify({
    q,
    offset,
    limit: 10,
    exclude: ['fullText'],
    sort,
  })
  const r = resolver.resolve('POST', E1_URL, Buffer.from(body, 'utf8'))
  if (r.unmatched) throw new Error(`no E1 fixture for ${body}`)
  const json = JSON.parse(r.body.toString('utf8'))
  return {
    totalHits: json.totalHits,
    searchId: json.searchId,
    works: json.results,
    ids: json.results.map((w) => String(w.id)),
    hits: `${json.totalHits.toLocaleString('en-GB')} research outputs found`,
  }
}

// the six facet pills of the filters bar, in order
export const PILLS = [
  'field',
  'year',
  'type',
  'author',
  'language',
  'publisher',
]

// pills with the highlight class, by label
export const activePills = (view) =>
  view.pills.filter((p) => p.active).map((p) => p.label)

export const openPills = (view) =>
  view.pills.filter((p) => p.open).map((p) => p.label)

// pagination labels of a view: '(prev)', '1*' (active), 'last', '…' (dots), '(next)'; a disabled button is
// suffixed with 'D' (class) and 'd' (attribute)
export function pagerLabels(view) {
  const p = view.pagination
  if (!p) return null
  return p.map((item, i) => {
    if (item.dots) return '…'
    const name =
      item.label === '(icon)' ? (i === 0 ? '(prev)' : '(next)') : item.label
    return `${name}${item.active ? '*' : ''}${item.disabledClass ? 'D' : ''}${
      item.disabledAttr ? 'd' : ''
    }`
  })
}

// the address Next builds for a router push with a query object: form encoding (space -> +, other reserved
// characters as %XX, parentheses too), parameters in the order given
export const searchUrl = (params) =>
  `/search/?${new URLSearchParams(params)
    .toString()
    .replace(/[()]/g, (c) => (c === '(' ? '%28' : '%29'))}`
