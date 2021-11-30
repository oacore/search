import request from './index'

const apiRequest = (url, ...args) => request(`${url}`, ...args)

const fetchClaim = async (params) => {
  const { id, isDataProviderHasAccounts } = params
  let { name, email, rationale } = params

  if (typeof name === 'undefined') name = ''
  if (typeof email === 'undefined') email = ''
  if (typeof rationale === 'undefined') rationale = ''

  const body = {
    name,
    email,
    rationale,
    repositoryHasAccount: isDataProviderHasAccounts,
  }

  const { data } = await apiRequest(`/data-providers/${id}/claim`, {
    method: 'POST',
    body,
  })
  return data
}

export default fetchClaim
