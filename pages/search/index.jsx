import { useRouter } from 'next/router'

const Search = () => {
  const router = useRouter()
  if (typeof window !== 'undefined') router.push('/')

  return null
}

Search.getInitialProps = (ctx) => {
  if (ctx.res) {
    ctx.res.writeHead(302, { Location: '/' })
    ctx.res.end()
  }
  return {}
}

export default Search
