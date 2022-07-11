import cachedDataProviders from '../.formap.json'
import cachedMembers from '../.members.json'

import { fetchLogo } from 'api/data-provider'

const checkLogo = async (isMember, logoUrl) => {
  if (isMember) {
    try {
      await fetchLogo(logoUrl)
      return logoUrl
    } catch (error) {
      return null
    }
  }
  return null
}

const checkMembership = (dataProviderId) =>
  cachedMembers.data.find(
    (member) => member.data_provider_id === parseInt(dataProviderId, 10)
  )

const transformDataProviders = async (dataProviders) => {
  const transformedData = await Promise.all(
    dataProviders.map(async ({ url, id, logo }) => {
      const dataProvider = cachedDataProviders.data.find(
        (dp) => dp.id === parseInt(id, 10)
      )

      const isMember = checkMembership(id)

      dataProvider.logo = await checkLogo(isMember, logo)

      return {
        url,
        ...dataProvider,
      }
    })
  )

  return transformedData
}

export { checkLogo, checkMembership, transformDataProviders }
