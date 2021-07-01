import request from './index'

const apiRequest = (url, ...args) => request(`${url}`, ...args)

const fetchClaim = async (params) => {
  const { id } = params
  let { name, email, rationable } = params

  if (typeof name === 'undefined') name = ''
  if (typeof email === 'undefined') email = ''
  if (typeof rationable === 'undefined') rationable = ''

  const { data } = await apiRequest(`/data-providers/${id}/claim`, {
    method: 'POST',
    name,
    email,
    rationable,
  })
  return data
}

export default fetchClaim
