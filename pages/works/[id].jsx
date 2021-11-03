import React from 'react'
import Head from 'next/head'
import { Header } from '@oacore/design'
import { useRouter } from 'next/router'

import Error404 from '../../templates/error/404'

import { fetchWork, fetchWorkOutputs } from 'api/works'
import { fetchCitations } from 'api/outputs'
import { useStore } from 'store'
import Meta from 'modules/meta'
import Template from 'templates/output'
import { findUrlsByType } from 'utils/helpers'

const LOCALE = 'en-GB'
const CITATION_STYLES = ['apa', 'bibtex']

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

    Object.assign(data, {
      ...workWithUrls,
      identifiers: {
        ...work.identifiers,
        doi: work.doi,
      },
      publishedDate: work.publishedDate
        ? work.publishedDate
        : work.yearPublished,
      sourceFulltextUrls:
        workWithUrls.sourceFulltextUrls &&
        workWithUrls.sourceFulltextUrls instanceof Array &&
        workWithUrls.sourceFulltextUrls[0],
      outputs,
      dataProvider: workWithUrls.dataProviders[0],
    })
  } catch (error) {
    log(error)
    const serverError = {
      code: error.status,
      message:
        error.status === 410
          ? error.data
          : `The page you were looking for could not be found`,
    }
    return {
      props: { serverError },
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

const ScientificWorkPage = ({ serverError, data }) => {
  const { statistics } = useStore()
  const router = useRouter()

  const totalArticlesCount =
    statistics.totalArticlesCount.toLocaleString('en-GB')

  Header.useSearchBar({
    onQueryChanged: (searchTerm) => {
      router.push(encodeURIComponent(searchTerm))
    },
    initQuery: '',
    searchBarProps: {
      label: `Search ${totalArticlesCount} papers around the world`,
      placeholder: `Search ${totalArticlesCount} papers around the world`,
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
      <Template data={data} useOtherVersions />
    </>
  )
}

export default ScientificWorkPage
