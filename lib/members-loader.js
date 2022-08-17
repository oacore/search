import Loader from './loader'

const memberUrl = 'https://api-dev.core.ac.uk/internal/members'

const membersLoader = new Loader(memberUrl, 'data/.members.json')

const getMembers = async () => {
  await membersLoader.getData()
}

export default getMembers
