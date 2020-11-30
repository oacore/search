import apiRequest from './index'

const fetchMetadata = async (id) => {
  // TODO: Centralise API_URL constructing
  const url = new URL(`/v3/outputs/${id}`, process.env.API_URL).href
  const { data } = await apiRequest(url)
  return data
}

const fetchSimilarTo = async (
  id,
  {
    /**
     * The number of recommendations to return from the API.
     *
     * The number is preset to 5 because of possible poor accuracy
     * after the 5th result.
     *
     * @type {Number}
     */
    limit = 5,
  } = {}
) => {
  const url = new URL('/v3/recommend', process.env.API_URL)
  const body = { identifier: `core:${id}`, limit }

  const { data } = await apiRequest(url, {
    body,
    method: 'POST',
  })

  return data
}

const fetchCitations = async (
  doi,
  { styles = ['apa', 'bibtex'], locale = 'en-GB' } = {}
) => {
  if (!Array.isArray(styles) || styles.length === 0)
    throw new Error('No citation styles passed')

  const url = `https://doi.org/${doi}`
  const citationRequests = styles.map((style) =>
    apiRequest(url, {
      headers: {
        Accept: `text/x-bibliography; style=${style}; locale=${locale}`,
      },
    })
      .then(({ data: blob }) => blob.text())
      .then((text) => ({
        id: style,
        style,
        value: text,
      }))
  )
  const citations = await Promise.all(citationRequests)
  return citations
}

export { fetchMetadata, fetchSimilarTo, fetchCitations }
