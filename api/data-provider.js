import request from './index'

// TODO: Move this to appropriate place when the APIv3 is ready
const API_V3_URL = process.env.API_URL.replace('/internal', '/v3')

const requestV3 = (url, ...args) => request(`${API_V3_URL}${url}`, ...args)

const fetchMetadata = async (id) => {
  const { data } = await request(`/data-providers/${id}`)
  return data
}

const fetchOutputs = async (id, searchParams) => {
  const { data } = await requestV3(`/data-providers/${id}/outputs`, {
    searchParams,
  })
  return data
}

export { fetchMetadata, fetchOutputs }
