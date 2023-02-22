import apiRequest from './index'

const fetchOaiResolver = async (valueInput) => {
  const url = new URL(`oai/${valueInput}`, process.env.API_URL).href

  const { data } = await apiRequest(url)
  return data
}

export default fetchOaiResolver
