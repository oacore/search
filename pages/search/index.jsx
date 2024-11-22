import React from 'react'
import Head from 'next/head'
import { useRouter } from 'next/router'
import { Header } from '@oacore/design/lib/modules'

import ErrorCard from '../error-card'

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
  // TODO for nice response
  // const { q, page = 1, limit = 10, sort = 'recency' } = searchParams
  const { q, page = 1, limit = 10, sort = 'relevance', t } = searchParams

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
      t,
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
        status: error?.status ?? null,
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

  const searchItem = router.query.q

  if (queryError?.status) return <ErrorCard />

  const { statistics } = useStore()
  const totalArticlesCount =
    statistics?.totalArticlesCount.toLocaleString('en-GB')
  Header.useSearchBar(
    {
      onQueryChanged: (searchTerm, pathName) => {
        router.push({
          pathname: pathName,
          query: {
            ...router.query,
            q: searchTerm,
            page: 1,
          },
        })
      },
      useAdvancedSearch: true,
      initQuery: data?.query,
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
    <div>
      {data?.results?.length >= 1 ? (
        <>
          <Head>
            <title>Search CORE</title>
          </Head>
          <Template data={data} />
        </>
      ) : (
        <QueryError query={searchItem} />
      )}
    </div>
  )
}

export default Search
