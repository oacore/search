/* eslint-disable jsx-a11y/anchor-is-valid */
import React, { useEffect, useRef, useState } from 'react'
import { Button, Card, Icon, MathMarkdown } from '@oacore/design/lib/elements'
import { useRouter } from 'next/router'

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
import { KeptDiv } from './kept-element'
import useRepairedSidebar from './repaired-sidebar'

import { getAssetsPath } from 'utils/helpers'
import Search from 'modules/search-layout'
import useHydrated from 'hooks/use-hydrated'

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
    memberType,
    license,
  },
  useOtherVersions = false,
  ...passProps
}: any) => {
  const router = useRouter()

  const includeOai = router.asPath.includes('source=oai')
  const [uniqueDoiArray, setUiqueDoiArray] = useState<any>([])
  const [oaiModal, setOaiModal] = useState(includeOai)

  const modalRef = useRef<any>(null)
  const repaired: any = useRepairedSidebar({
    id,
    fulltextStatus,
    readerUrl,
    useOtherVersions,
  })

  const closeModal = () => {
    setOaiModal(false)
  }

  const handleClickOutside = (event?: any) => {
    if (modalRef.current && !modalRef.current.contains(event.target))
      closeModal()
  }

  useEffect(() => {
    const doiArray = [doi]

    if (outputs)
      doiArray.push(...outputs.map((item: any) => item.doi.toLowerCase()))

    setUiqueDoiArray([...new Set(doiArray)])
  }, [])

  useEffect(() => {
    document.addEventListener('mousedown', handleClickOutside)

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [])

  // The gateway rewrites /display/ to /outputs/, so the server rendered this
  // trail for /outputs/ and the browser's asPath stays /display/ (Q-075). The
  // render that hydrates it uses the server's path. After mount the tail
  // follows the browser's path; the link keeps the server's until the path
  // changes.
  const hydrated = useHydrated()
  const hydratedPath = useRef(hydrated ? null : router.asPath)
  if (router.asPath !== hydratedPath.current) hydratedPath.current = null
  const serverPath = router.asPath.replace(/^\/display\//, '/outputs/')
  const trailPath = hydrated ? router.asPath : serverPath
  const linkPath = hydratedPath.current ? serverPath : router.asPath

  const isTypeWorks = trailPath.includes('/works/')
  const isTypeOutputs = trailPath.includes('/outputs/')
  const pos = linkPath.indexOf('search=')
  const resultSearch = `https://core.ac.uk/search/?${linkPath.slice(pos + 7)}`

  return (
    <Search {...passProps} className={styles['output-container']}>
      {oaiModal && !useOtherVersions && (
        <div ref={modalRef} className={styles['oai-modal']}>
          <h3 className={styles.oaiModalTitle}>Repository landing page</h3>
          <div className={styles['oai-modal-text']}>
            We are not able to resolve this{' '}
            <a href="https://oai.core.ac.uk">OAI</a> Identifier to the
            repository landing page. If you are the repository manager for this
            record, please head to the{' '}
            <a href="https://core.ac.uk/services/repository-dashboard">
              Dashboard
            </a>{' '}
            and adjust the settings.
          </div>
          <div className={styles['oai-modal-buttons']}>
            <Button
              onClick={() => {
                window.open(
                  'https://core.ac.uk/services/repository-dashboard',
                  '_blank'
                )
              }}
              variant="contained"
            >
              Go to the Dashboard
            </Button>
            <Button onClick={closeModal} variant="text">
              Close
            </Button>
          </div>
        </div>
      )}
      <Search.Main>
        <div className={styles.background}>
          <div className={styles['navigation-trail']}>
            <a href={resultSearch} target="_blank" rel="noreferrer">
              Search results
            </a>
            {(isTypeWorks || isTypeOutputs) && (
              <>
                <span className={styles.separator}>{'>'}</span>
                {isTypeWorks && <a href="#">Research work</a>}
                {isTypeOutputs && (
                  <a href="#">
                    Research output from {dataProvider?.name || 'repository'}
                  </a>
                )}
              </>
            )}
          </div>
          <div className={styles.info}>
            {documentType && (
              <span className={styles['document-type']}>{documentType}</span>
            )}
            {oai && (
              <div className={styles.oai}>
                <img
                  src={getAssetsPath('/static/images/oai.svg')}
                  alt="oai"
                  className={styles.oaiLogo}
                />
                <a href={`https://api.core.ac.uk/oai/${oai}`}>{oai}</a>
              </div>
            )}
          </div>
          <h1>
            <MathMarkdown>{title}</MathMarkdown>
          </h1>
          <Metadata
            authors={authors}
            publishedDate={publishedDate}
            publisher={publisher}
            doi={doi}
            uniqueDoiArray={uniqueDoiArray}
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
                className={styles['action-button']}
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
        <div className={styles['container-main']}>
          <section id="abstract" className={styles.abstract}>
            <h2>Abstract</h2>
            {abstract ? (
              <MathMarkdown>{abstract}</MathMarkdown>
            ) : (
              <span className={styles['abstract-empty']}>
                Abstract is not available.
              </span>
            )}
          </section>
          <Keywords tags={tags} />
          <SimilarWorks articleId={id} useOtherVersions={useOtherVersions} />
          <RelatedSearch articleId={id} articleTitle={title} />
        </div>
      </Search.Main>
      <Search.Sidebar className={styles['container-sidebar']}>
        <FullTextThumbnail
          id={`full-text-thumbnail-${id}`}
          href={readerUrl}
          src={thumbnailLargeUrl || `//core.ac.uk/image/${id}/large`}
          alt="thumbnail-image"
          doi={doi}
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
          metadata={{
            hrefDataProvider: `//core.ac.uk/data-providers/${dataProvider.id}`,
          }}
          providerId={dataProvider.id}
          tag={fulltextStatus === 'disabled' ? 'div' : 'span'}
          useOtherVersions={useOtherVersions}
          memberType={memberType}
        />
        {useOtherVersions && outputs.length > 0 && (
          <OtherVersions
            useOtherVersions={useOtherVersions}
            outputs={outputs}
            metadata={{
              hrefDataProvider: `//core.ac.uk/data-providers/${dataProvider.id}`,
            }}
          />
        )}
        {!useOtherVersions && (
          <MapCard
            id={repaired.map.id}
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
            repaired={repaired.report}
          />
        )}
        {license && (
          <Card tag={KeptDiv} variant="outlined" {...repaired.license}>
            Licence: <span className={styles['license-type']}>{license}</span>
          </Card>
        )}
      </Search.Sidebar>
    </Search>
  )
}

export default ScientificOutputTemplate
