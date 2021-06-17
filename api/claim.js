import request from './index'

const apiRequest = (url, ...args) => request(`${url}`, ...args)

const fetchClaim = async (id) => {
  const { data } = await apiRequest(`/data-providers/${id}/claim`, {'method': 'POST'})
  return data
}

export { fetchClaim }
