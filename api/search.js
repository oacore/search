import apiRequest from './index'

const FileDownload = require('js-file-download')

export const fetchWorks = async (body) => {
  const url = new URL(`/v3/search/works`, process.env.API_URL).href

  const { data: dataWorks } = await apiRequest(url, {
    body,
    method: 'POST',
  })

  return dataWorks
}

export const fetchAggregations = async (body) => {
  const url = new URL(`/v3/search/works/aggregate`, process.env.API_URL).href

  const { data: aggregations } = await apiRequest(url, {
    body,
    method: 'POST',
  })
  return aggregations
}

export const downloadResultsInCSV = async (body) => {
  const url = new URL(`/v3/search/works`, process.env.API_URL).href

  await apiRequest(url, {
    body,
    method: 'POST',
  }).then(({ data }) => FileDownload(data, 'results.csv'))
}
