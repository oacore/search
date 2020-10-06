import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/router'

import Result from './result'
import DataProviderOutputsSearch from './search'
import ClaimCard from './claim-card'
import MapCard from './map-card'
import styles from './styles.module.css'

import Pagination from 'modules/pagination'
import Search from 'modules/search-layout'

const DataProviderTemplate = ({ outputs, metadata, loadPage }) => {
  const [activePage, setActivePage] = useState(1)
  const router = useRouter()

  useEffect(() => {
    const handleRouteChange = (newUrl) => {
      const url = new URL(newUrl, window.location)
      if (url.searchParams.get('page'))
        setActivePage(url.searchParams.get('page'))
    }

    router.events.on('routeChangeStart', handleRouteChange)

    return () => {
      router.events.off('routeChangeStart', handleRouteChange)
    }
  }, [])

  useEffect(() => {
    loadPage({ id: 1, page: activePage })
  }, [activePage])

  const paginationHrefBuilder = (index) => ({
    href: {
      pathname: '/data-providers/[data-provider-id]',
      query: {
        page: index,
      },
    },

    as: {
      pathname: '/data-providers/1',
      query: {
        page: index,
      },
    },
    shallow: true,
  })

  return (
    <Search className={styles.layout}>
      <Search.Main>
        <span className={styles.titleBox}>
          <span>{metadata.institution}</span>
          <h1 className={styles.title}>{metadata.name}</h1>
        </span>

        <DataProviderOutputsSearch
          onQueryChanged={() => {}}
          className={styles.search}
        />
        {outputs.map((o) => (
          <Result key={o.id} {...o} />
        ))}
        <Pagination
          activePage={activePage}
          pageCount={1000}
          marginPagesDisplayed={2}
          pageRangeDisplayed={5}
          onPageChange={() => {}}
          hrefBuilder={paginationHrefBuilder}
        />
      </Search.Main>
      <Search.Sidebar>
        <MapCard metadata={metadata} />
        <ClaimCard name={metadata.name} />
      </Search.Sidebar>
    </Search>
  )
}

export default DataProviderTemplate
