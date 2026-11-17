import request from './index'

const apiRequest = (url?: any, ...args: any[]) => request(`${url}`, ...args)

const fetchDataProviderAccounts = async (params?: any) => {
  const { id } = params

  const { data } = await apiRequest(`/data-providers/${id}/account`, {
    method: 'GET',
  })
  return data
}

export default fetchDataProviderAccounts
