import React from 'react'
import { Card } from '@oacore/design'
import { classNames } from '@oacore/design/lib/utils'

import SimilarWorks from './similar-works'
import FullTextThumbnail from './thumbnail-card'
import Metadata from './metadata'
import MapCard from './map-card'
import Keywords from './keywords'
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
    similarOutputs,
    documentType,
    identifiers: { doi },
  },
  ...passProps
}) => (
  <Search {...passProps}>
    <Search.Main>
      <div>
        {documentType && (
          <span className={styles.documentType}>{documentType}</span>
        )}
        {doi && <span className={styles.doi}>{doi}</span>}
      </div>

      <h1>{title}</h1>
      <Metadata
        authors={authors}
        publicationDate={publicationDate}
        publisher={publisher}
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
          hrefDataProvider: `//core.ac.uk/data-providers/${dataProvider.id}`,
        }}
      />
      <Card className={classNames.use(styles.card)}>
        <p>
          To submit an update or takedown request for this paper, please submit
          an{' '}
          <a href={`//core.ac.uk/article-update/${id}`}>
            Update/Correction/Removal Request
          </a>
          .
        </p>
      </Card>
    </Search.Sidebar>
  </Search>
)

export default ScientificOutputTemplate
