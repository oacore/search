import React from 'react'
import Head from 'next/head'
import { Header } from '@oacore/design'

import request from 'api'
import { fetchMetadata, fetchSimilarTo } from 'api/outputs'
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

export async function getServerSideProps({ params: routeParams }) {
  const { id } = routeParams

  const data = {}

  try {
    const rawOutput = await fetchMetadata(id)

    // Strip some properties to optimise network traffic
    const { fullText: _, ...output } = rawOutput

    const { data: dataProvider } = await request(output.dataProvider)
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

    const url = `https://doi.org/${doi}`
    const citationRequests = CITATION_STYLES.map((style) =>
      request(url, {
        headers: {
          Accept: `text/x-bibliography; style=${style}; locale=${LOCALE}`,
        },
      })
        .then(({ data: blob }) => blob.text())
        .then((text) => ({
          id: style,
          style,
          value: text,
        }))
    )
    const citations = await Promise.all(citationRequests)
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

    if (typeof data.similarOutputs[0].links[0] != 'object') {
      // eslint-disable-next-line no-console
      console.log(data.similarOutputs[0].links)
      throw new Error('Links are not properly formatted at the moment...')
    }
  } catch (error) {
    log(error)

    // If any error happens, we pretend, there were no recommendations
    // This behaviour could be changed to explicit error reporting but should
    // be considered deeper.
    data.similarOutputs = []
  }

  return {
    props: { data },
  }
}

const ScientificOutputPage = ({ data }) => {
  const { statistics } = useStore()
  const totalArticlesCount = statistics.totalArticlesCount.toLocaleString(
    'en-GB'
  )

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
