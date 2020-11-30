import apiRequest from './index'

const fetchMetadata = async (id) => {
  // TODO: Centralise API_URL constructing
  const url = new URL(`/v3/outputs/${id}`, process.env.API_URL).href
  const { data } = await apiRequest(url)
  return data
}

const fetchSimilarTo = async (id) => {
  const url = new URL('/v3/recommend', process.env.API_URL)
  const body = { identifier: `core:${id}` }

  const { data } = await apiRequest(url, {
    body,
    method: 'POST',
  })

  return data
}

export { fetchMetadata, fetchSimilarTo }
