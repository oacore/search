import React from 'react'
import Head from 'next/head'
import { Header } from '@oacore/design'
import { useRouter } from 'next/router'

import log from 'utils/logger'
import { fetchWork, fetchWorkOutputs } from 'api/works'
import { fetchCitations } from 'api/outputs'
import { useStore } from 'store'
import Meta from 'modules/meta'
import Template from 'templates/output'
import Error404 from 'templates/error/404'
import { findUrlsByType } from 'utils/helpers'
import { checkLogo, checkMembership } from 'utils/data-providers-transform'

const LOCALE = 'en-GB'
const CITATION_STYLES = ['apa', 'bibtex']

export async function getServerSideProps({ params: routeParams, req }) {
  const { id } = routeParams

  const data = {}

  try {
    const rawWork = await fetchWork(id)
    const { fullText: _, ...work } = rawWork
    const outputs = await fetchWorkOutputs(id)

    const transformedOutputs = await Promise.all(
      outputs.map(async (output) => {
        const articleWithUrls = findUrlsByType(output)

        const { dataProvider } = output

        const isMember = checkMembership(dataProvider.id)
        dataProvider.logo = await checkLogo(isMember, dataProvider.logo)

        return {
          ...articleWithUrls,
          dataProvider,
        }
      })
    )

    const workWithUrls = findUrlsByType(work)
    const mainDataProviderLink = {
      id: workWithUrls.arxivId || workWithUrls.pubmedId,
      link:
        (workWithUrls.arxivId &&
          `https://arxiv.com/abs/${workWithUrls.arxivId}`) ||
        (workWithUrls.pubmedId &&
          `https://pubmed.ncbi.nlm.nih.gov/PMC${workWithUrls.pubmedId}`),
      name:
        (workWithUrls.arxivId && 'arXiv') ||
        (workWithUrls.pubmedId && 'PubMed'),
    }

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
        (workWithUrls.sourceFulltextUrls &&
          workWithUrls.sourceFulltextUrls[0]) ||
        null,
      outputs: transformedOutputs,
      dataProvider: workWithUrls.dataProviders[0],
      mainDataProviderLink: Object.values(mainDataProviderLink).some(
        (link) => link !== null
      )
        ? mainDataProviderLink
        : null,
    })
  } catch (error) {
    log(error)
    const prevHistoryUrl = req.headers.referer ?? null

    const serverError = {
      code: error.status,
      message:
        error.status === 410
          ? error.data
          : `The page you were looking for could not be found`,
      prevHistoryUrl,
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
      router.push(`/search?q=${searchTerm}`)
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
      <Template data={data} useOtherVersions />
    </>
  )
}

export default ScientificWorkPage
