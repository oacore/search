import cachedDataProviders from 'data/.formap.json'
import cachedMembers from 'data/.members.json'
import { fetchLogo } from 'api/data-provider'

const checkMembership = (dataProviderId) =>
  cachedMembers?.data.find(
    ({ repo_id: repoId, }) =>
      +repoId === +dataProviderId
  )

const checkLogo = async (dataProviderId, logoUrl) => {
  const isMember = !!checkMembership(dataProviderId)
  if (!isMember) return null
  try {
    await fetchLogo(logoUrl)
    console.log('fetched')
    return logoUrl
  } catch (error) {
    return null
  }
}

const transformDataProviders = async (dataProviders) => {
  const transformedData = await Promise.all(
    dataProviders.map(async ({ url, id, logo }) => {
      const dataProvider = cachedDataProviders.data.find((dp) => dp.id === +id)
      Object.assign(dataProvider, {
        logo: await checkLogo(id, logo),
      })
      return {
        url,
        ...dataProvider,
      }
    })
  )

  return transformedData
}

export { checkLogo, checkMembership, transformDataProviders }
