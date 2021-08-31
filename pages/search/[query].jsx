import React from 'react'
import Head from 'next/head'
import { useRouter } from 'next/router'
import { Header } from '@oacore/design/lib/modules'

import fetchWorks from 'api/search'
import Template from 'templates/search'
import { useStore } from 'store'

const log = (...args) => {
  if (process.env.NODE_ENV !== 'production')
    // eslint-disable-next-line no-console
    console.log(...args)
}

export const getServerSideProps = async ({ query: searchParams }) => {
  const { query: q, page = 1, limit = 10 } = searchParams

  const data = {
    currentPage: parseInt(page, 10),
    query: q,
  }

  const offset = page - 1 > 0 ? (page - 1) * 10 : page - 1

  const body = {
    q,
    offset,
    limit,
  }

  try {
    const response = await fetchWorks(body)

    Object.assign(data, response)
  } catch (error) {
    log(error)
    return {
      props: { error },
      notFound: true,
    }
  }

  return {
    props: { data },
  }
}

const SearchOutputsPage = ({ data }) => {
  const { statistics } = useStore()
  const router = useRouter()
  const totalArticlesCount =
    statistics.totalArticlesCount.toLocaleString('en-GB')

  Header.useSearchBar({
    onQueryChanged: (searchTerm) => {
      router.push(`${searchTerm}`)
    },
    initQuery: '',
    searchBarProps: {
      label: `Search ${totalArticlesCount} papers around the world`,
      placeholder: `Search ${totalArticlesCount} papers around the world`,
      prependIcon: '#magnify',
      changeOnBlur: false,
    },
  })

  return (
    <>
      <Head>
        <title>Search CORE</title>
      </Head>
      <Template data={data} />
    </>
  )
}

export default SearchOutputsPage
