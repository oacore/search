export const getServerSideProps = async ({ query }) => {
  if (Object.keys(query).includes('q')) {
    return {
      redirect: {
        destination: `/search/${query.q}`,
        permanent: false,
      },
    }
  }
  return {
    redirect: {
      destination: `/`,
      permanent: false,
    },
  }
}

const Search = () => null

export default Search
