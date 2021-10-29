import apiRequest from './index'

const fetchWorks = async (body) => {
  const url = new URL(`/v3/search/works`, process.env.API_URL).href

  const { data: dataWorks } = await apiRequest(url, {
    body,
    method: 'POST',
  })

  return dataWorks
}

export default fetchWorks
