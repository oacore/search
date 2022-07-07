import { fetchLogo } from './data-provider'

import apiRequest from './index'

const fetchMetadata = async (id) => {
  // TODO: Centralise API_URL constructing
  const url = new URL(`/v3/outputs/${id}`, process.env.API_URL).href
  const { data } = await apiRequest(url)
  return data
}
const fetchDataProvider = async (url) => {
  const { data: dataProvider } = await apiRequest(url)
  const logo = await fetchLogo(dataProvider.id)
  Object.assign(dataProvider, {
    logo,
  })
  return dataProvider
}

const fetchSimilarTo = async (id, params) => {
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

const createReport = async (body) => {
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
