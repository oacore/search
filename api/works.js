import apiRequest from './index'

const fetchWork = async (id) => {
  const url = new URL(`/v3/works/${id}`, process.env.API_URL).href

  const { data } = await apiRequest(url)
  return data
}

const fetchWorkOutputs = async (id) => {
  const url = new URL(`/v3/works/${id}/outputs`, process.env.API_URL).href

  const { data } = await apiRequest(url)
  return data
}
export { fetchWork, fetchWorkOutputs }
