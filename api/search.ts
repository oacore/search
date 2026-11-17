import apiRequest from './index'

const FileDownload = require('js-file-download')

export const fetchWorks = async (body?: any) => {
  const { t } = body
  const split = t?.split('-')
  const isUndefined = split?.some((item: any) => item === undefined)
  const url = new URL(
    `/v3/search/works${!isUndefined || t ? `?t=${t}` : ''}`,
    process.env.API_URL
  ).href

  const controller = new AbortController()
  // TODO TEMP
  const timeout = setTimeout(() => controller.abort(), 50000)

  try {
    const { data: dataWorks } = await apiRequest(url, {
      body,
      method: 'POST',
      signal: controller.signal,
    })
    return dataWorks
  } finally {
    clearTimeout(timeout)
  }
}

export const fetchAggregations = async (body?: any) => {
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

export const downloadResultsInCSV = async (body?: any) => {
  const url = new URL(`/v3/search/works`, process.env.API_URL).href

  await apiRequest(url, {
    body,
    method: 'POST',
  }).then(({ data }: any) => FileDownload(data, 'results.csv'))
}
