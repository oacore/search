import request from './index'

// TODO: Move this to appropriate place when the APIv3 is ready
const API_V3_URL = process.env.API_URL.replace('/internal', '/v3')

const requestV3 = (url, ...args) => request(`${API_V3_URL}${url}`, ...args)

const fetchMetadata = async (id) => {
  const { data } = await requestV3(`/data-providers/${id}`)
  return data
}

const fetchOutputs = async (id, searchParams) => {
  const { data } = await requestV3(`/data-providers/${id}/outputs`, {
    searchParams,
  })
  return data
}

const fetchLogo = async (dataProvider) => {
  const id =
    typeof dataProvider === 'number'
      ? dataProvider
      : dataProvider?.match(/data-providers\/([0-9]+)/)[1]
  const { data } = await request(`/data-providers/${id}/logo`)
  return data
}

const fetchLogos = async (outputs) => {
  const dataProvidersRequest = outputs.map(async (output) => {
    const updatedOutput = {}
    if (output.dataProviders) {
      const requests = output.dataProviders.map(async (dp) => {
        const logo = await fetchLogo(dp)
        const updatedDataProvider = {
          logo,
          url: dp,
        }

        return updatedDataProvider
      })
      const updatedDataProvider = await Promise.all(requests)
      Object.assign(updatedOutput, {
        ...output,
        dataProviders: updatedDataProvider,
      })
    }
    if (output.dataProvider) {
      const logo = await fetchLogo(output.dataProvider.url)
      Object.assign(updatedOutput, {
        ...output,
        dataProviders: [
          {
            ...output.dataProvider,
            logo,
          },
        ],
      })
    }

    return updatedOutput
  })
  const outputWithLogos = await Promise.all(dataProvidersRequest)
  return outputWithLogos
}

export { fetchMetadata, fetchOutputs, fetchLogo, fetchLogos }
