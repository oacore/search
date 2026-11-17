import cachedMembers from 'data/.members.json'
import cachedDataProviders from 'data/.formap.json'
import { fetchLogo } from 'api/data-provider'

function checkMembership(dataProviderId?: any) {
  return cachedMembers.find((item: any) => {
    if (Array.isArray(item.repo_id)) {
      return (
        item.repo_id.includes(dataProviderId) && item.billingType !== 'starting'
      )
    }

    return +item.repo_id === +dataProviderId && item.billingType !== 'starting'
  })
}

function checkDataProvider(dataProviderId?: any) {
  return cachedMembers.find((item: any) => {
    if (Array.isArray(item.repo_id))
      return item.repo_id.includes(dataProviderId)
    return +item.repo_id === +dataProviderId
  })
}

const checkLogo = async (dataProviderId?: any, logoUrl?: any) => {
  const isMember = !!checkMembership(dataProviderId)
  if (!isMember) return null
  try {
    await fetchLogo(logoUrl)
    return logoUrl
  } catch (error: any) {
    return null
  }
}

function checkType(dataProviderId?: any) {
  // TODO To many requests to this function
  return cachedMembers.find((item: any) => {
    if (Array.isArray(item.repo_id))
      return item.repo_id.includes(dataProviderId?.toString())
    return +item.repo_id === +dataProviderId
  })
}

// Making Search fast. Logo is exist
// const transformDataProviders = async (dataProviders) => {
//   const transformedData = await Promise.all(
//     dataProviders.map(async ({ url, id, logo }) => {
//       const dataProvider = cachedDataProviders.find((dp) => dp.id === +id)
//
//       const isMember = !!checkMembership(id)
//       if (dataProvider && isMember) dataProvider.logo = await checkLogo(logo)
//       return {
//         url,
//         ...dataProvider,
//       }
//     })
//   )
//
//   return transformedData
// }

const transformDataProviders = async (dataProviders?: any) => {
  const transformedData = await Promise.all(
    dataProviders.map(async ({ url, id }: any) => {
      const dataProvider = cachedDataProviders.find((dp: any) => dp.id === +id)

      return {
        url,
        ...dataProvider,
      }
    })
  )

  return transformedData
}

const findDataProvider = (id?: any) =>
  cachedDataProviders.find((dp: any) => dp.id === +id)

function checkUniversity(dataProviderId?: any) {
  const member: any = cachedMembers.find((item: any) => {
    if (Array.isArray(item.repo_id)) {
      return (
        item.repo_id.includes(dataProviderId.toString()) &&
        item.organisation_name
      )
    }
    return +item.repo_id === +dataProviderId && item.organisation_name
  })
  let universityName = member?.organisationName
  if (!universityName) {
    const dataProvider = cachedDataProviders.find(
      (dp: any) => dp.id === +dataProviderId
    )

    if (dataProvider && dataProvider.institutionName)
      return dataProvider.institutionName

    // No information about `institutionName`
    universityName = ''
  }
  return universityName
}

export {
  checkLogo,
  checkMembership,
  transformDataProviders,
  checkType,
  checkUniversity,
  checkDataProvider,
  findDataProvider,
}
