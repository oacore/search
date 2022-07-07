import React from 'react'
import Head from 'next/head'
import { Header } from '@oacore/design'
import { useRouter } from 'next/router'

import { fetchMetadata, fetchCitations, fetchDataProvider } from 'api/outputs'
import { useStore } from 'store'
import Meta from 'modules/meta'
import Template from 'templates/output'
import { findUrlsByType } from 'utils/helpers'
import Error404 from 'templates/error/404'
import log from 'utils/logger'

const LOCALE = 'en-GB'
const CITATION_STYLES = ['apa', 'bibtex']

// Needed for clear development of the data retrieval
// At the time of development the API was unstable

const setOutputError = (error, id) => {
  let serverError = { code: error.status }
  if (error.status === 410) {
    serverError = {
      ...serverError,
      message:
        error.status === 410 && `The article with ID ${id} has been disabled`,
    }
  } else if (error.message.includes('data-providers')) {
    serverError = {
      ...serverError,
      message: 'Data provider has been disabled',
    }
  } else {
    serverError = {
      ...serverError,
      message: 'The page you were looking for could not be found',
    }
  }
  return serverError
}

export async function getServerSideProps({ params: routeParams }) {
  const { id } = routeParams

  const data = {}

  try {
    const rawOutput = await fetchMetadata(id)

    // Strip some properties to optimise network traffic
    const { fullText: _, ...output } = rawOutput
    const dataProvider = await fetchDataProvider(output.dataProvider.url)

    const { sourceFulltextUrls } = output

    if (
      sourceFulltextUrls instanceof Array &&
      sourceFulltextUrls &&
      sourceFulltextUrls[0]
    )
      output.sourceFulltextUrls = [sourceFulltextUrls]
    const outputWithUrls = findUrlsByType(output)

    Object.assign(data, {
      ...outputWithUrls,
      publishedDate: output.publishedDate
        ? output.publishedDate
        : output.yearPublished,
      dataProvider,
    })
  } catch (error) {
    log(error)
    const serverError = setOutputError(error, id)
    return {
      props: { serverError },
    }
  }

  try {
    const doi = data.identifiers?.doi
    if (!doi) throw new Error('No DOI — no citation')

    const citations = await fetchCitations(doi, {
      styles: CITATION_STYLES,
      locale: LOCALE,
    })
    data.citations = citations
  } catch (citationRetrievalError) {
    log(citationRetrievalError)

    data.citations = []
  }

  return {
    props: { data },
  }
}

const ScientificOutputPage = ({ serverError, data }) => {
  const { statistics } = useStore()
  const router = useRouter()

  const totalArticlesCount =
    statistics.totalArticlesCount.toLocaleString('en-GB')

  Header.useSearchBar({
    onQueryChanged: (searchTerm) => {
      router.push(`/search/?q=${searchTerm}`)
    },
    initQuery: '',
    searchBarProps: {
      label: `Search ${totalArticlesCount} from papers around the world`,
      placeholder: `Search ${totalArticlesCount} from papers around the world`,
      prependIcon: '#magnify',
      changeOnBlur: false,
    },
  })
  if (serverError) return <Error404 error={serverError} />

  return (
    <>
      <Head>
        <title>{data.title} - CORE</title>
        <Meta data={data} />
      </Head>
      <Template data={data} />
    </>
  )
}

export default ScientificOutputPage
