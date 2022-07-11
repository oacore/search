import request from './index'

// TODO: Move this to appropriate place when the APIv3 is ready
const API_V3_URL = process.env.API_URL.replace('/internal', '/v3')

const requestV3 = (url, ...args) => request(`${API_V3_URL}${url}`, ...args)

const fetchMetadata = async (id) => {
  const { data } = await requestV3(`/data-providers/${id}`)
  return data
}

const fetchOutputs = async (id, searchParams) => {
  const { data } = await requestV3(`/data-providers/${id}/outputs`, {
    searchParams,
  })
  return data
}

const fetchLogo = async (url) => {
  const response = await request(url)
  return response
}

const setLogoToMultipleDataProviders = async (dataProviders) => {
  const logoRequests = dataProviders.map(async (dataProvider) => {
    try {
      await fetchLogo(dataProvider.logo)
    } catch (error) {
      dataProvider.logo = null
    }
    return dataProvider
  })
  const transformedDataProviders = await Promise.all(logoRequests)
  return transformedDataProviders
}

export {
  fetchMetadata,
  fetchOutputs,
  fetchLogo,
  setLogoToMultipleDataProviders,
}
