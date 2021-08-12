import React from 'react'

import SimilarWorks from './similar-works'
import FullTextThumbnail from './thumbnail-card'
import Metadata from './metadata'
import MapCard from './map-card'
import Keywords from './keywords'
import ReportCard from './report'
import CitationManager from './citation'
import styles from './styles.module.css'

import Search from 'modules/search-layout'

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
    fulltextStatus,
    tags,
    documentType,
    citations,
    identifiers: { doi },
  },
  ...passProps
}) => (
  <Search {...passProps} className={styles.outputContainer}>
    <Search.Main>
      <div className={styles.background}>
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
      </div>
      <div className={styles.containerMain}>
        {abstract && (
          <section id="abstract" className={styles.abstract}>
            <h2>Abstract</h2>
            <p>{abstract}</p>
          </section>
        )}

        <Keywords tags={tags} />
        <SimilarWorks articleId={id} />
      </div>
    </Search.Main>

    <Search.Sidebar className={styles.containerSidebar}>
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
          fulltextStatus,
        }}
      />
      <MapCard
        metadata={{
          name: dataProvider.name,
          location: dataProvider.location,
          hrefDataProvider: `//core.ac.uk/data-providers/${dataProvider.id}`,
        }}
      />
      <ReportCard
        id={id}
        sourceFulltextUrls={sourceFulltextUrls}
        dataProvider={dataProvider.name}
      />
    </Search.Sidebar>
  </Search>
)

export default ScientificOutputTemplate
