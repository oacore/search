const getAssetsPath = (path = '/', target = process.env.BUILD_TARGET || '') =>
  target === 'aws' ? `/data-providers${path}` : path

const formatDate = (date, options = {}) => {
  const dateTimeFormat = new Intl.DateTimeFormat('en-GB', options)

  try {
    return dateTimeFormat.format(new Date(date))
  } catch (error) {
    if (process.env.NODE_ENV !== 'production')
      console.error('Date in invalid format', date, error)
    return date
  }
}

module.exports = { getAssetsPath, formatDate }
