import React from 'react'
import { Button, Icon } from '@oacore/design/lib/elements'

import SimilarWorks from './similar-works'
import RelatedSearch from './related-search'
import FullTextThumbnail from './thumbnail-card'
import Metadata from './metadata'
import MapCard from './map-card'
import Keywords from './keywords'
import ReportCard from './report'
import CitationManager from './citation'
import styles from './styles.module.css'
import OtherVersions from './other-versions'

import { getAssetsPath } from 'utils/helpers'
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
    createdDate,
    tags,
    documentType,
    citations,
    outputs,
    reader: readerUrl,
    download,
    thumbnail_l: thumbnailLargeUrl,
    identifiers: { doi, oai },
    mainDataProviderLink,
  },
  useOtherVersions = false,
  ...passProps
}) => (
  <Search {...passProps} className={styles.outputContainer}>
    <Search.Main>
      <div className={styles.background}>
        <div className={styles.info}>
          {documentType && (
            <span className={styles.documentType}>{documentType}</span>
          )}
          {oai && (
            <div className={styles.oai}>
              <img
                src={getAssetsPath('/static/images/oai.svg')}
                alt="oai"
                className={styles.oaiLogo}
              />
              {oai}
            </div>
          )}
        </div>
        <h1>{title}</h1>
        <Metadata
          authors={authors}
          publishedDate={publishedDate}
          publisher={publisher}
          doi={doi}
        />
        <div className={styles.buttons}>
          {citations && citations.length > 0 && (
            <CitationManager
              data={{
                citations,
                actionLabel: 'Cite',
              }}
            />
          )}
          {useOtherVersions && mainDataProviderLink && (
            <Button
              variant="outlined"
              className={styles.actionButton}
              tag="a"
              target="_blank"
              href={mainDataProviderLink.link}
              key={mainDataProviderLink.id}
            >
              View <span>on</span> {mainDataProviderLink.name}
              <Icon src="#open-in-new" />
            </Button>
          )}
        </div>
      </div>
      <div className={styles.containerMain}>
        <section id="abstract" className={styles.abstract}>
          <h2>Abstract</h2>
          {abstract ? (
            <p>{abstract}</p>
          ) : (
            <span className={styles.abstractEmpty}>
              Abstract is not available.
            </span>
          )}
        </section>
        <Keywords tags={tags} />
        <SimilarWorks articleId={id} useOtherVersions={useOtherVersions} />
        <RelatedSearch articleId={id} articleTitle={title} />
      </div>
    </Search.Main>
    <Search.Sidebar className={styles.containerSidebar}>
      <FullTextThumbnail
        id={`full-text-thumbnail-${id}`}
        href={readerUrl || `//core.ac.uk/reader/${id}`}
        src={thumbnailLargeUrl || `//core.ac.uk/image/${id}/large`}
        alt="thumbnail-image"
        data={{
          title: !useOtherVersions ? dataProvider.name : null,
          dataProviderLogo: dataProvider.logo,
          updatedDate,
          sourceFulltextUrls,
          fulltextStatus,
          createdDate,
          oai,
          download,
        }}
        tag={fulltextStatus === 'disabled' ? 'div' : 'a'}
        useOtherVersions={useOtherVersions}
      />
      {useOtherVersions && outputs.length > 0 && (
        <OtherVersions outputs={outputs} />
      )}
      {!useOtherVersions && (
        <MapCard
          metadata={{
            name: dataProvider.name,
            location: dataProvider.location,
            hrefDataProvider: `//core.ac.uk/data-providers/${dataProvider.id}`,
          }}
        />
      )}

      {!useOtherVersions && (
        <ReportCard
          id={id}
          sourceFulltextUrls={sourceFulltextUrls}
          dataProvider={dataProvider.name}
        />
      )}
    </Search.Sidebar>
  </Search>
)

export default ScientificOutputTemplate
