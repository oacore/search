import fs from 'fs'
import path from 'path'

const statsUrl = 'https://api.core.ac.uk/internal/statistics'

const log = (...args) => {
  if (process.env.NODE_ENV !== 'production')
    // eslint-disable-next-line no-console
    console.log(...args)
}

const fetchStats = async (url) => {
  let stats = null
  const date = new Date()

  return new Promise((resolve, reject) => {
    if (stats == null) {
      fetch(url)
        .then((res) => {
          if (res.status >= 400)
            throw new Error('Could not fetch actual statistics')
          return res
        })
        .then((res) => res.json())
        .then((data) => {
          stats = {
            ...data,
            timestamp: date.getDate(),
          }
          resolve(stats)
        })
        .catch(reject)
    } else {
      log('Take data from cache')
      log(stats)
    }
  })
}

const STATISTICS_CACHE_PATH = path.resolve('.statistics.json')

export default async function getStatistics() {
  let cachedData
  const date = new Date()
  try {
    cachedData = JSON.parse(
      fs.readFileSync(path.join(__dirname, STATISTICS_CACHE_PATH), 'utf8')
    )
  } catch (error) {
    log('Statistics cache not initialized')
  }
  // Fetch data once a day
  if (!cachedData || date.getDate() !== cachedData.timestamp) {
    const data = await fetchStats(statsUrl)
    try {
      fs.writeFileSync(
        path.join(__dirname, STATISTICS_CACHE_PATH),
        JSON.stringify(data),
        'utf8'
      )
      log('Wrote to statistics cache')
    } catch (error) {
      log('Error writing statistics to file')
      log(error)
    }

    cachedData = data
  }

  return cachedData
}
