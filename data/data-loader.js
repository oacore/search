const { promises: fsPromises } = require('fs')
const path = require('path')
const fs = require('fs')

const fetch = require('node-fetch')

// Hack to avoid data retrieval in the all components
// TODO: Implement Babel plugin instead

const fetchStats = (url) => {
  if (!url) return null
  let stats = null

  console.log(`Fetching URL: ${url}`)
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
          stats = data
          resolve(stats)
        })
        .catch(reject)
    } else resolve(stats)
  })
}

const saveCachedStats = (cacheFilePath, statisticsData) => {
  if (!cacheFilePath) throw new Error('Cache path cannot be empty')
  return fs.writeFileSync(cacheFilePath, statisticsData)
}

const loadCachedStats = async (cacheFilePath, { ignoreModified = false }) => {
  if (!cacheFilePath) throw new Error('Cache path cannot be empty')
  if (!ignoreModified) {
    const cacheStats = await fsPromises.stat(cacheFilePath)
    if (cacheStats.mtimeMs < Date.now() - 6 * 60 * 60 * 1000)
      throw new Error('Cache outdated')
    console.info(`File ${cacheFilePath} was last modified on: ${new Date(
      cacheStats.mtimeMs
    ).toString()}
    less than 6 hours ago. There is no reason to update.`)
  }

  return fsPromises
    .readFile(cacheFilePath)
    .then((contents) => JSON.parse(contents))
}

const getApiFromFileName = function (filepath) {
  const filename = filepath.split('/').pop()
  switch (filename) {
    case '.statistics.json':
      return 'https://api.core.ac.uk/internal/statistics'
    case '.formap.json':
      return 'https://api.core.ac.uk/internal/repositories/formap'
    case '.members.json':
      return 'https://api.core.ac.uk/internal/members'
    default:
      return null
  }
}

const retrieveStats = async (cacheFilePath) => {
  const errorMsg =
    'Fail. ==> Statistics retrieval failed due to API Core instability.'

  try {
    const stats = await fetchStats(getApiFromFileName(cacheFilePath))
    if (!stats) return null
    try {
      console.info(`Downloaded, now saving to ${cacheFilePath}`)
      return await saveCachedStats(cacheFilePath, JSON.stringify(stats))
    } catch (cannotWriteFile) {
      console.error(cannotWriteFile)
    }

    return stats
  } catch (fetchError) {
    console.error(fetchError)
    throw new Error(errorMsg)
  }
}

const dataLoader = async function loadDataFile() {
  await fs.readdir(path.join(__dirname, ''), function (err, files) {
    if (err) return console.error(`Unable to scan directory: ${err}`)

    // TODO hot debug on prod
    // for (const file of files)
    //   if (file.endsWith('.json')) retrieveStats(path.join(__dirname, file))

    return true
  })
}

module.exports = dataLoader

if (require.main === module) dataLoader()
