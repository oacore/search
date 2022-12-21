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

const checkMembership = (dataProviderId) =>
  cachedMembers.data.find(
    ({ repo_id: repoId, billing_type: billingType }) =>
      +repoId === +dataProviderId && billingType !== 'starting'
  )

const checkType = (dataProviderId) =>
  cachedMembers.data.find((data) => +data.repo_id === +dataProviderId)

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
