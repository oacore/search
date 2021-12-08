import React from 'react'
import Head from 'next/head'
import { useRouter } from 'next/router'
import { Header } from '@oacore/design/lib/modules'

import { fetchWorks } from 'api/search'
import { useStore } from 'store'
import { findUrlsByType } from 'utils/helpers'
import Template from 'templates/search'
import QueryError from 'templates/error/query'

const log = (...args) => {
  if (process.env.NODE_ENV !== 'production')
    // eslint-disable-next-line no-console
    console.log(...args)
}

export const getServerSideProps = async ({ res, query: searchParams }) => {
  if (!searchParams.q) {
    res.statusCode = 302
    res.setHeader('Location', `/`) // Replace <link> with your url link
    return { props: {} }
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

      response.results.map((item) => {
        const articleWithUrls = findUrlsByType(item)
        item.dataProviders = item.dataProviders.map((dataProvider) => ({
          url: dataProvider,
        }))
        return articleWithUrls
      })
      Object.assign(data, response)
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

  const { statistics } = useStore()
  const totalArticlesCount =
    statistics.totalArticlesCount.toLocaleString('en-GB')

  Header.useSearchBar({
    onQueryChanged: (searchTerm) => {
      router.push({
        pathname: '/search',
        query: {
          ...router.query,
          q: encodeURIComponent(searchTerm),
          page: 1,
        },
      })
    },
    useAdvancedSearch: true,
    initQuery: data.query,
    searchBarProps: {
      label: `Search ${totalArticlesCount} papers around the world`,
      placeholder: `Search ${totalArticlesCount} papers around the world`,
      prependIcon: '#magnify',
      changeOnBlur: false,
    },
  })

  if (queryError) return <QueryError query={queryError.query} />

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
