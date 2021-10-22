import React from 'react'
import Head from 'next/head'
import { Header } from '@oacore/design'

import request from 'api'
import { fetchWork, fetchWorkOutputs } from 'api/works'
import { fetchCitations } from 'api/outputs'
import { useStore } from 'store'
import Meta from 'modules/meta'
import Template from 'templates/output'
import { findUrlsByType } from 'utils/helpers'

const LOCALE = 'en-GB'
const CITATION_STYLES = ['apa', 'bibtex']

// Needed for clear development of the data retrieval
// At the time of development the API was unstable
const log = (...args) => {
  if (process.env.NODE_ENV !== 'production')
    // eslint-disable-next-line no-console
    console.log(...args)
}

export async function getServerSideProps({ params: routeParams }) {
  const { id } = routeParams

  const data = {}

  try {
    const rawWork = await fetchWork(id)

    const { fullText: _, ...work } = rawWork
    const outputs = await fetchWorkOutputs(id)

    outputs.map((output) => {
      const articleWithUrls = findUrlsByType(output)
      return articleWithUrls
    })
    const workWithUrls = findUrlsByType(work)

    const matchedOutput = outputs.find(
      (output) => output.reader === workWithUrls.reader
    )

    const { data: dataProvider } = await request(matchedOutput.dataProvider.url)

    // outputs.map((item) => console.log(item.id))
    // console.log(matchedOutput.id)
    Object.assign(data, {
      ...workWithUrls,
      identifiers: {
        ...work.identifiers,
        oai: matchedOutput.identifiers.oai || null,
        doi: work.doi,
        publishedDate: work.publishedDate
          ? work.publishedDate
          : work.yearPublished,
      },
      sourceFulltextUrls:
        matchedOutput.sourceFulltextUrls &&
        matchedOutput.sourceFulltextUrls instanceof Array &&
        matchedOutput.sourceFulltextUrls[0],
      outputs: outputs.filter((output) => output.id !== matchedOutput.id),
      dataProvider,
      id: matchedOutput.id,
      workId: workWithUrls.id,
    })
  } catch (error) {
    log(error)
    return {
      props: { error },
      notFound: true,
    }
  }

  try {
    const { doi } = data
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

const ScientificWorkPage = ({ data }) => {
  const { statistics } = useStore()
  const totalArticlesCount =
    statistics.totalArticlesCount.toLocaleString('en-GB')

  Header.useSearchBar({
    onQueryChanged: (searchTerm) => {
      window.location.href = `https://core.ac.uk/search?q=${encodeURIComponent(
        searchTerm
      )}`
    },
    initQuery: '',
    searchBarProps: {
      label: `Search ${totalArticlesCount} papers around the world`,
      placeholder: `Search ${totalArticlesCount} papers around the world`,
      prependIcon: '#magnify',
      changeOnBlur: false,
    },
  })

  return (
    <>
      <Head>
        <title>{data.title} - CORE</title>
        <Meta data={data} />
      </Head>
      <Template data={data} useOtherVersions />
    </>
  )
}

export default ScientificWorkPage
