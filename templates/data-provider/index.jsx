import React from 'react'

import Result from './result'
import DataProviderOutputsSearch from './search'
import ClaimCard from './claim-card'
import MapCard from './map-card'
import styles from './styles.module.css'

import Search from 'modules/search-layout'

const DataProviderTemplate = ({ outputs, metadata }) => (
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
    </Search.Main>
    <Search.Sidebar>
      <MapCard metadata={metadata} />
      <ClaimCard name={metadata.name} />
    </Search.Sidebar>
  </Search>
)

export default DataProviderTemplate
