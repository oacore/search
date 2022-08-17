import React from 'react'
import Head from 'next/head'
import { useRouter } from 'next/router'
import { Header } from '@oacore/design/lib/modules'

import { findUrlsByType } from 'utils/helpers'
import log from 'utils/logger'
import { fetchWorks } from 'api/search'
import { useStore } from 'store'
import Template from 'templates/search'
import QueryError from 'templates/error/query'
import { transformDataProviders } from 'utils/data-providers-transform'

export const getServerSideProps = async ({ query: searchParams }) => {
  if (Object.keys(searchParams).length === 0) {
    return {
      redirect: {
        permanent: true,
        destination: '/',
      },
      props: {},
    }
  }
  const { q, page = 1, limit = 10, sort = 'relevance' } = searchParams

  const data = {
    currentPage: +page,
    query: q,
    sort,
  }

  if (page <= 1000) {
    const offset = page - 1 > 0 ? (page - 1) * 10 : page - 1

    const body = {
      q,
      offset,
      limit,
      exclude: ['fullText'],
      sort: sort === 'recent' ? 'recency' : sort,
    }
    try {
      const response = await fetchWorks(body)

      const transformedWorks = await Promise.all(
        response.results.map(async (work) => {
          const articleWithUrls = findUrlsByType(work)
          return {
            ...articleWithUrls,
            dataProviders: await transformDataProviders(work.dataProviders),
          }
        })
      )

      Object.assign(data, {
        ...response,
        results: transformedWorks,
      })
    } catch (error) {
      log(error)
      const queryError = {
        query: q,
      }
      return {
        props: { queryError },
      }
    }
  } else data.results = []

  return {
    props: { data },
  }
}

const Search = ({ data, queryError }) => {
  const router = useRouter()

  if (queryError) return <QueryError query={queryError.query} />

  const { statistics } = useStore()
  const totalArticlesCount =
    statistics.totalArticlesCount.toLocaleString('en-GB')
  Header.useSearchBar(
    {
      onQueryChanged: (searchTerm) => {
        router.push({
          pathname: '/search',
          query: {
            ...router.query,
            q: searchTerm,
            page: 1,
          },
        })
      },
      useAdvancedSearch: true,
      initQuery: data.query,
      searchBarProps: {
        label: `Search ${totalArticlesCount} from papers around the world`,
        placeholder: `Search ${totalArticlesCount} from papers around the world`,
        prependIcon: '#magnify',
        changeOnBlur: false,
      },
    },
    { isHidden: false }
  )

  return (
    <>
      <Head>
        <title>Search CORE</title>
      </Head>
      <Template data={data} />
    </>
  )
}

export default Search
