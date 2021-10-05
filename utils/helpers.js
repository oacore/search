const getAssetsPath = (path = '/', target = process.env.BUILD_TARGET || '') =>
  target === 'aws' ? `/data-providers${path}` : path

const formatDate = (date, options = {}) => {
  const dateTimeFormat = new Intl.DateTimeFormat('en-GB', options)

  // Year length always = 4
  try {
    return date.toString().length === 4
      ? date
      : dateTimeFormat.format(new Date(date))
  } catch (error) {
    if (process.env.NODE_ENV !== 'production')
      console.error('Date in invalid format', date, error)
    return date
  }
}

const findDataProviders = (allDataProviders, articles) => {
  articles.map((article) => {
    const dataProvidersWithNames = article.dataProviders.map(
      (dataProviderUrl) => {
        const id = dataProviderUrl
          .match(/(?<=data-providers\/).[0-9]+/)
          .join('')

        const dataProvider = allDataProviders.find(
          (dp) => dp.id === parseInt(id, 10)
        )

        return {
          dataProviderUrl,
          name: dataProvider ? dataProvider.name : null,
          id,
        }
      }
    )
    article.dataProviders = dataProvidersWithNames

    return article
  })
  return articles
}

const findMinValueInArray = (array, key) =>
  Math.min.apply(
    null,
    array.map((item) => item[key])
  )

const findMaxValueInArray = (array, key) =>
  Math.max.apply(
    null,
    array.map((item) => item[key])
  )

module.exports = {
  getAssetsPath,
  formatDate,
  findDataProviders,
  findMaxValueInArray,
  findMinValueInArray,
}
