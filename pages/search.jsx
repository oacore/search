import React, { useCallback } from 'react'
import { useRouter } from 'next/router'
import { Select, SearchResult } from '@oacore/design'

import apiRequest from 'api'
import Search from 'modules/search-layout'

export async function getServerSideProps({ query: searchParams }) {
  const { q = '', offset = 0, limit = 10 } = searchParams

  const requestBody = {
    basicQuery: {
      offset,
      count: limit,
      searchCriteria: q,
      sortByDate: false,
    },
    facetMap: {},
  }

  try {
    const { data } = await apiRequest('https://core.ac.uk/search/api/search', {
      method: 'POST',
      body: requestBody,
    })

    return {
      props: { data, query: q },
    }
  } catch (error) {
    console.log(error)
    return {
      props: { error },
      notFound: true,
    }
  }
}

const useSearch = () => {
  const router = useRouter()
  const eventHandler = useCallback(
    (event) => {
      const url = new URL(router.asPath, 'http://unused.host')
      url.searchParams.set('q', event.value)
      router.push(url.href.slice(url.origin.length))
    },
    [router]
  )
  return eventHandler
}

const DataProviderPage = ({ query, data, loading }) => (
  <Search>
    <Search.Main>
      <Select
        id="q"
        defaultValue={query}
        label="Search"
        prependIcon="#magnify"
        onInput={() => {}}
        onChange={useSearch()}
      />
      {data.results.map(
        ({ id, snippet: abstract, title, authors, datePublished }) => {
          const fullTextLink = `//core.ac.uk/reader/${id}`
          const metadataLink = `//core.ac.uk/display/${id}`

          return (
            <SearchResult
              key={id}
              id={id}
              tag={Search.Result}
              data={{
                title,
                author: authors.map((name) => ({ name })),
                publicationDate: datePublished,
                thumbnailUrl: `//core.ac.uk/image/${id}/medium`,
                metadataLink,
                fullTextLink,
              }}
              aria-busy={loading}
            >
              {abstract}
            </SearchResult>
          )
        }
      )}
      {data.results.length === 0 && <div>No results found</div>}
    </Search.Main>

    <Search.Sidebar tag="aside" />
  </Search>
)

export default DataProviderPage
