const normalize = (string?: any) =>
  string.normalize('NFD').replace(/[\u0300-\u036f]/g, '')

const normalizeDataProviders = (dataProviders?: any) =>
  dataProviders
    .filter((el: any) => el.name)
    .map((el: any) => ({
      ...el,
      normalizedName: normalize(el.name || ''),
      normalizedInstitutionName: normalize(el.institutionName || ''),
    }))

export default normalizeDataProviders
