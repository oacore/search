import cachedMembers from 'data/.members.json'
import cachedDataProviders from 'data/.formap.json'
import { fetchLogo } from 'api/data-provider'

const checkLogo = async (logoUrl) => {
  try {
    await fetchLogo(logoUrl)
    return logoUrl
  } catch (error) {
    return null
  }
}

function checkMembership(dataProviderId) {
  return cachedMembers.data.find((item) => {
    if (Array.isArray(item.repo_id)) {
      return (
        item.repo_id.includes(dataProviderId.toString()) &&
        item.billingType !== 'starting'
      )
    }
    return +item.repo_id === +dataProviderId && item.billingType !== 'starting'
  })
}

function checkType(dataProviderId) {
  // TODO To many requests to this function
  return cachedMembers.data.find((item) => {
    if (Array.isArray(item.repo_id))
      return item.repo_id.includes(dataProviderId?.toString())
    return +item.repo_id === +dataProviderId
  })
}

const transformDataProviders = async (dataProviders) => {
  const transformedData = await Promise.all(
    dataProviders.map(async ({ url, id, logo }) => {
      const dataProvider = cachedDataProviders.data.find((dp) => dp.id === +id)

      const isMember = !!checkMembership(id)
      if (dataProvider && isMember) dataProvider.logo = await checkLogo(logo)
      return {
        url,
        ...dataProvider,
      }
    })
  )
  return transformedData
}

export { checkLogo, checkMembership, transformDataProviders, checkType }
