import cachedDataProviders from 'data/.formap.json'
import cachedMembers from 'data/.members.json'
import { fetchLogo } from 'api/data-provider'

const checkLogo = async (logoUrl) => {
  try {
    await fetchLogo(logoUrl)
    return logoUrl
  } catch (error) {
    return null
  }
}

const checkMembership = (dataProviderId) =>
  cachedMembers.data.find(
    (member) =>
      member.repo_id == dataProviderId && member.billing_type !== 'starting'
  )

const transformDataProviders = async (dataProviders) => {
  const transformedData = await Promise.all(
    dataProviders.map(async ({ url, id, logo }) => {
      const dataProvider = cachedDataProviders.data.find(
        (dp) => dp.id === parseInt(id, 10)
      )

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

export { checkLogo, checkMembership, transformDataProviders }
