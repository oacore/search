const dateTimeFormatCache = new Map()

const formatDate = (date, options = {}) => {
  const stringOptions = JSON.stringify(options)
  let dateTimeFormat = dateTimeFormatCache.get(stringOptions)
  if (!dateTimeFormat) {
    dateTimeFormat = new Intl.DateTimeFormat('en-GB', options)
    dateTimeFormatCache.set(stringOptions, dateTimeFormat)
  }

  try {
    return dateTimeFormat.format(new Date(date))
  } catch (error) {
    if (process.env.NODE_ENV === 'development')
      console.error('Date in invalid format', date, error)

    return date
  }
}

export default formatDate
