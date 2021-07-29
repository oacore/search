import React from 'react'
import Head from 'next/head'
import { Header } from '@oacore/design'

import request from 'api'
import { fetchMetadata, fetchSimilarTo, fetchCitations } from 'api/outputs'
import { useStore } from 'store'
import Meta from 'modules/meta'
import Template from 'templates/output'

const LOCALE = 'en-GB'
const CITATION_STYLES = ['apa', 'bibtex']

// Needed for clear development of the data retrieval
// At the time of development the API was unstable
const log = (...args) => {
  if (process.env.NODE_ENV !== 'production')
    // eslint-disable-next-line no-console
    console.log(...args)
}

export async function getStaticProps({ params: routeParams }) {
  const { id } = routeParams

  const data = {}
  let revalidate = 60 * 60 * 24 * 7 // seconds, i.e. every week

  try {
    const rawOutput = await fetchMetadata(id)

    // Strip some properties to optimise network traffic
    const { fullText: _, ...output } = rawOutput

    const { data: dataProvider } = await request(output.dataProvider)

    output.publishedDate = output.publishedDate
      ? output.publishedDate
      : output.yearPublished

    Object.assign(data, {
      ...output,
      dataProvider,
    })
  } catch (error) {
    log(error)

    return {
      props: { error },
      notFound: true,
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

    // If any error happens, we pretend, citation could not be generated
    // or retrieved. This behaviour should be improved because we could generate
    // citations ourselves using some library.
    //
    // Take your time to explore:
    // - https://citeproc-js.readthedocs.io/en/latest/index.html
    // - https://citationstyles.org
    data.citations = []
  }

  try {
    const similarOutputs = await fetchSimilarTo(id)

    // Strip some properties to optimise network traffic
    data.similarOutputs = similarOutputs.map(
      ({ fullText, ...output }) => output
    )
  } catch (error) {
    log(error)

    // If any error happens, we pretend, there were no recommendations
    // This behaviour could be changed to explicit error reporting but should
    // be considered deeper.
    data.similarOutputs = []
    revalidate = 30
  }

  return {
    props: { data },
    revalidate,
  }
}

export async function getStaticPaths() {
  // Generating only 1st page as static for the first time
  // In the future we could retrieve a number of most popular pages
  // and pre-render them to static
  const paths = [
    {
      params: { id: '1' },
    },
  ]

  return { paths, fallback: 'blocking' }
}

const ScientificOutputPage = ({ data }) => {
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
      <Template data={data} />
    </>
  )
}

export default ScientificOutputPage
