import React from 'react'

import DataProvidersSearchTemplate from 'templates/data-providers-search'
import apiRequest from 'api'

export async function getServerSideProps() {
  const { data } = await apiRequest('/repositories/formap')
  return {
    props: {
      dataProviders: data,
    },
  }
}

const SearchPage = ({ dataProviders }) => (
  <DataProvidersSearchTemplate dataProviders={dataProviders} />
)

export default SearchPage
