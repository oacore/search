import apiRequest from './index'

const fetchMetadata = async (id?: any) => {
  // TODO: Centralise API_URL constructing
  const url = new URL(`/v3/outputs/${id}`, process.env.API_URL).href
  const { data } = await apiRequest(url)
  return data
}
const fetchDataProvider = async (url?: any) => {
  const { data: dataProvider } = await apiRequest(url)

  return dataProvider
}

const fetchSimilarTo = async (id?: any, params?: any) => {
  const limit = 5
  const url = new URL('/v3/recommend', process.env.API_URL)
  const body = { identifier: `core:${id}`, limit, ...params }

  const { data } = await apiRequest(url, {
    body,
    method: 'POST',
  })

  return data
}

const fetchCitations = async (
  doi?: any,
  { styles = ['apa', 'bibtex'], locale = 'en-GB' }: any = {}
) => {
  if (!Array.isArray(styles) || styles.length === 0)
    throw new Error('No citation styles passed')

  const url = `https://doi.org/${doi}`
  const citationRequests = styles.map((style: any) =>
    apiRequest(url, {
      headers: {
        Accept: `text/x-bibliography; style=${style}; locale=${locale}`,
      },
    })
      .then(({ data: blob }: any) => blob.text())
      .then((text: any) => ({
        id: style,
        style,
        value: text,
      }))
  )
  const citations = await Promise.all(citationRequests)
  return citations
}

const createReport = async (body?: any) => {
  const url = new URL('/internal/outputs/update', process.env.API_URL).href

  const response = await apiRequest(url, {
    body,
    method: 'POST',
  })

  return response
}

export {
  fetchMetadata,
  fetchSimilarTo,
  fetchCitations,
  createReport,
  fetchDataProvider,
}
