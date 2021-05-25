import React from 'react'

import SimilarWorks from './similar-works'
import FullTextThumbnail from './thumbnail-card'
import Metadata from './metadata'
import MapCard from './map-card'
import Keywords from './keywords'
import CitationManager from './citations'
import styles from './styles.module.css'

import Search from 'modules/search-layout'

const ScientificOutputTemplate = ({
  data: {
    id,
    title,
    authors,
    abstract,
    publisher,
    publicationDate,
    dataProvider,
    citations,
    similarOutputs,
  },
  ...passProps
}) => (
  <Search {...passProps}>
    <Search.Main>
      <h1>{title}</h1>
      <Metadata
        authors={authors}
        publicationDate={publicationDate}
        publisher={publisher}
      />
      <CitationManager
        data={{
          citations,
          actionLabel: 'Cite',
        }}
      />
      {abstract && (
        <section id="abstract" className={styles.abstract}>
          <h2>Abstract</h2>
          <p>{abstract}</p>
        </section>
      )}
      <Keywords keywords={['computer science', 'text mining']} />
      {similarOutputs.length > 0 && <SimilarWorks data={similarOutputs} />}
    </Search.Main>

    <Search.Sidebar>
      <FullTextThumbnail
        id={`full-text-thumbnail-${id}`}
        href={`//core.ac.uk/reader/${id}`}
        src={`//core.ac.uk/image/${id}/large`}
        alt=""
        data={{
          title: dataProvider.name,
          type: 'PDF',
          size: 200312, // repositoryDocument.pdfSize,
        }}
      />
      <MapCard
        metadata={{
          name: dataProvider.name,
          location: dataProvider.location,
        }}
      />
    </Search.Sidebar>
  </Search>
)

export default ScientificOutputTemplate
