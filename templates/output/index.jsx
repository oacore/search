import React from 'react'
import { Card } from '@oacore/design'
import { classNames } from '@oacore/design/lib/utils'
import Search from 'modules/search-layout'

import SimilarWorks from './similar-works'
import RelatedSearch from './related-search'
import FullTextThumbnail from './thumbnail-card'
import Metadata from './metadata'
import MapCard from './map-card'
import Keywords from './keywords'
import CitationManager from './citation'
import styles from './styles.module.css'

const ScientificOutputTemplate = ({
  data: {
    id,
    title,
    authors,
    abstract,
    publisher,
    publishedDate,
    dataProvider,
    updatedDate,
    sourceFulltextUrls,
    tags,
    documentType,
    citations,
    similarOutputs,
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
        publishedDate={publishedDate}
        publisher={publisher}
      />
      {citations && citations.length > 0 && (
        <CitationManager
          data={{
            citations,
            actionLabel: 'Cite',
          }}
        />
      )}
      {abstract && (
        <section id="abstract" className={styles.abstract}>
          <h2>Abstract</h2>
          <p>{abstract}</p>
        </section>
      )}
      <Keywords tags={tags} />
      <SimilarWorks articleId={id} />
      <RelatedSearch articleId={id} articleTitle={title} simOutputs={similarOutputs} />
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
          updatedDate,
          sourceFulltextUrls,
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
