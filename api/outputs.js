import apiRequest from './index'

const fetchMetadata = async ({ id }) => {
  const { data } = await apiRequest(`/articles/${id}`)
  return data
}

// eslint-disable-next-line import/prefer-default-export
export { fetchMetadata }
