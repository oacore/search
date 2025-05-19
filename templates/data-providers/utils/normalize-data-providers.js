const normalize = (string) =>
  string.normalize('NFD').replace(/[\u0300-\u036f]/g, '')

const normalizeDataProviders = (dataProviders) =>
  dataProviders
    .filter((el) => el.name)
    .map((el) => ({
      ...el,
      normalizedName: normalize(el.name || ''),
      normalizedInstitutionName: normalize(el.institutionName || ''),
    }))

export default normalizeDataProviders
