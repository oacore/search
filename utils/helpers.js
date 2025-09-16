const getAssetsPath = (path = '/', target = process.env.BUILD_TARGET || '') =>
  target === 'azure' ? `/static/search{path}` : path

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
  findMaxValueInArray,
  findMinValueInArray,
  findUrlsByType,
}
