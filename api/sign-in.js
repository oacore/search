// Deprecated
// Use dashboard.core.ac.uk
import request from './index'

const NO_INTERNAL = process.env.API_URL.replace('/internal', '')
const apiRequest = (url, ...args) => request(`${NO_INTERNAL}${url}`, ...args)

const fetchSignIn = async (params) => {
  // eslint-disable-next-line camelcase
  const { email, password, remember_me } = params
  const body = { email, password, remember_me }

  const { data } = await apiRequest(`/login_check`, {
    method: 'POST',
    body,
  })

  return data
}

export default fetchSignIn
