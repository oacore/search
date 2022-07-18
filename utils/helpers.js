const { toJS } = require('mobx')

const getAssetsPath = (path = '/', target = process.env.BUILD_TARGET || '') =>
  target === 'aws' ? `/data-providers${path}` : path

const rewriteDataPath = (
  path = '/_next/data/:path*',
  target = process.env.NODE_ENV || ''
) => {
  let outputDataPath = {
    destination: path,
  }

  if (target === 'production') {
    outputDataPath = {
      ...outputDataPath,
      source: `/search${path}`,
    }
  } else {
    outputDataPath = {
      ...outputDataPath,
      source: outputDataPath.destination,
    }
  }

  return outputDataPath
}

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
  console.log(toJS(articles))
  articles.map((article) => {
    console.log(toJS(article.dataProviders))
    const dataProvidersWithNames = article.dataProviders.map(({ url }) => {
      const id = url.match(/\d+$/s).join(' ')

      const dataProvider = allDataProviders.find(
        (dp) => dp.id === parseInt(id, 10)
      )

      return {
        url,
        name: dataProvider ? dataProvider.name : null,
        id,
      }
    })
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

const findUrlsByType = (article) => {
  article.links.map(({ type }) => {
    article[type] = article.links.find((link) => link.type === type).url
    return type
  })

  return article
}

module.exports = {
  getAssetsPath,
  rewriteDataPath,
  formatDate,
  findDataProviders,
  findMaxValueInArray,
  findMinValueInArray,
  findUrlsByType,
}
