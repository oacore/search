import React from 'react'
import { Header } from '@oacore/design'

import SimilarWorks from './similar-works'
import ThumbnailCard from './thumbnail-card'
import Metadata from './metadata'
import ApiCard from './api-card'
import Chips from './chips'
import MapCard from './map-card'
import Keywords from './keywords'

import Search from 'modules/search-layout'

const ArticlePageTemplate = ({
  id,
  title,
  abstract,
  repository,
  repositoryDocument,
  publisher,
  datePublished,
  authors,
  totalArticlesCount,
}) => {
  Header.useSearchBar({
    onQueryChanged: (searchTerm) => {
      window.location.href = `https://core.ac.uk/search?q=${encodeURIComponent(
        searchTerm
      )}`
    },
    initQuery: '',
    searchBarProps: {
      label: `Search ${totalArticlesCount.toLocaleString(
        'en-GB'
      )} papers around the world`,
      placeholder: `Search ${totalArticlesCount.toLocaleString(
        'en-GB'
      )} papers around the world`,
      prependIcon: '#magnify',
      changeOnBlur: false,
    },
  })

  return (
    <Search>
      <Search.Main>
        <Chips />
        <h1>{title}</h1>
        <Metadata
          authors={authors}
          datePublished={datePublished}
          publisher={publisher}
        />
        <h2>Abstract</h2>
        <p>{abstract}</p>
        {/* TODO: Connect both widgets to real data */}
        <Keywords keywords={['computer science', 'text mining']} />
        <SimilarWorks />
      </Search.Main>
      <Search.Sidebar>
        <ThumbnailCard
          id={id}
          repository={repository}
          repositoryDocument={repositoryDocument}
        />
        {/* TODO: Connect to real data */}
        <MapCard
          metadata={{
            name: 'Brunel University Research Archive',
            location: {
              longitude: -0.4729931,
              latitude: 51.5324044,
            },
          }}
        />
        <ApiCard />
      </Search.Sidebar>
    </Search>
  )
}

export default ArticlePageTemplate
