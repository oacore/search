import request from './index'

const apiRequest = (url, ...args) => request(`${url}`, ...args)

const fetchDataProviderAccounts = async (params) => {
  const { id } = params

  const { data } = await apiRequest(`/data-providers/${id}/account`, {
    method: 'GET',
  })
  return data
}

export default fetchDataProviderAccounts
