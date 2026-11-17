import request from './index'

// TODO: Move this to appropriate place when the APIv3 is ready
const API_V3_URL = process.env.API_URL!.replace('/internal', '/v3')

const requestV3 = (url?: any, ...args: any[]) =>
  request(`${API_V3_URL}${url}`, ...args)

// eslint-disable-next-line camelcase
const fetchMetadata = async (id?: any, search_id?: any) => {
  const split = search_id?.split('-')
  const isUndefined = split?.some((item: any) => item === undefined)
  const { data } = await requestV3(
    // eslint-disable-next-line camelcase
    `/data-providers/${id}${!isUndefined || search_id ? `?t=${search_id}` : ''}`
  )
  return data
}

const fetchStats = async (id?: any) => {
  const { data } = await requestV3(`/data-providers/${id}/stats`)
  return data
}

const fetchOutputs = async (id?: any, searchParams?: any) => {
  const { data } = await requestV3(`/data-providers/${id}/outputs`, {
    searchParams,
  })
  return data
}

const fetchLogo = async (url?: any) => {
  const response = await request(url)
  return response
}

export { fetchMetadata, fetchOutputs, fetchStats, fetchLogo }
