// P1-06 fixture oracle: what the recorded API answers for one search request (E1), read through the harness
// resolver, so a page must list exactly that answer. Every request of the package is answered by fixtures that
// exist (test/fixtures/requests/P1-06.json lists the scenarios).
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
