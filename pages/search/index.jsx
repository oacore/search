import { useRouter } from 'next/router'

export const getServerSideProps = async ({ query }) => ({
  props: { query },
})

const Search = ({ query }) => {
  const router = useRouter()
  if (typeof window !== 'undefined') {
    if (Object.keys(query).includes('q')) router.push(`/search/${query.q}`)
    else router.push('/')
  }

  return null
}

export default Search
