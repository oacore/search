import Loader from './loader'

const formapUrl = 'https://api.core.ac.uk/internal/repositories/formap'

const formapLoader = new Loader(formapUrl, 'data/.formap.json')

const getDataProviders = async () => {
  await formapLoader.getData()
}

export default getDataProviders
