import request from './index'

// TODO: Move this to appropriate place when the APIv3 is ready
const API_V3_URL = process.env.API_URL.replace('/internal', '/v3')

const apiRequest = (url, ...args) => request(`${API_V3_URL}${url}`, ...args)

const fetchMetadata = async (id) => {
  const { data } = await apiRequest(`/data-providers/${id}`)
  return data
}

const fetchOutputs = async (id, searchParams) => {
  const { data } = await apiRequest(`/data-providers/${id}/outputs`, {
    searchParams,
  })
  return data
}

export { fetchMetadata, fetchOutputs }
