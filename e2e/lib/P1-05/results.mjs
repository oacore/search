// P1-05: the oracle of a result list. The fixture resolver answers the E13 request of a page state; the page
// must show exactly that answer's results, in its order: [title, /outputs/<id>].
const norm = (s) => String(s).replace(/\s+/g, ' ').trim()

export function resultsOf(resolver, url) {
  const answer = resolver.resolve('GET', url)
  if (answer.status !== 200) return []
  const body = JSON.parse(Buffer.from(answer.body).toString('utf8'))
  return body.results.map((r) => [norm(r.title), `/outputs/${r.id}`])
}
