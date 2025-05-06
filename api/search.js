import apiRequest from './index'

const FileDownload = require('js-file-download')

export const fetchWorks = async (body) => {
  const { t } = body
  const split = t?.split('-')
  const isUndefined = split?.some((item) => item === undefined)

  const urlPrimary = new URL(
    `/v3/search/works${!isUndefined || t ? `?t=${t}` : ''}`,
    process.env.API_URL
  ).href

  const urlFallback = new URL(
    `/v3/search/works${!isUndefined || t ? `?t=${t}` : ''}`,
    process.env.API_URL_01
  ).href

  try {
    const { data: dataWorks } = await apiRequest(urlPrimary, {
      method: 'POST',
      body,
    })
    return dataWorks
  } catch (err) {
    console.warn(`Primary API failed (${urlPrimary}), retrying fallback…`, err)
    const { data: dataWorks } = await apiRequest(urlFallback, {
      method: 'POST',
      body,
    })
    return dataWorks
  }
}

export const fetchAggregations = async (body) => {
  const url = new URL(`/v3/search/works/aggregate`, process.env.API_URL).href
  const { data: aggregations } = await apiRequest(url, {
    body: {
      ...body,
      q: body.q || '',
    },
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

export const fetchLogos = async () => {
  const url = new URL(`/internal/members/banner`, process.env.API_URL).href
  const response = await apiRequest(url, {
    method: 'GET',
  })
  // eslint-disable-next-line no-return-await
  return await response.data
}
