import apiRequest from './index'

// eslint-disable-next-line camelcase
const fetchWork = async (id, search_id) => {
  const split = search_id?.split('-')
  const isUndefined = split?.some((item) => item === undefined)
  const url = new URL(
    // eslint-disable-next-line camelcase
    `/v3/works/${id}${!isUndefined ? `?t=${search_id}` : ''}`,
    process.env.API_URL
  ).href

  const { data } = await apiRequest(url)
  return data
}

const fetchWorkOutputs = async (id) => {
  const url = new URL(`/v3/works/${id}/outputs`, process.env.API_URL).href

  const { data } = await apiRequest(url)

  return data
}
export { fetchWork, fetchWorkOutputs }
