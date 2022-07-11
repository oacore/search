import Loader from './loader'

const statsUrl = 'https://api.core.ac.uk/internal/statistics'

const statsLoader = new Loader(statsUrl, '.statistics.json', true)

const getStatistics = async () => {
  await statsLoader.getData()
}

export default getStatistics
