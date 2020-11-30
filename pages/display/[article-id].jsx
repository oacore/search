import React from 'react'
import Head from 'next/head'

import { useStore, observe } from 'store'
import Article from 'store/article'
import ArticlePageTemplate from 'templates/display'

const addEllipsis = (text, max) => {
  if (text.length <= max) return text

  return `${text.substring(0, max - 3)}...`
}

const structuredMetadata = (metadata) => {
  const ld = {
    '@context': 'http://schema.org',
    '@graph': [
      {
        '@type': 'BreadcrumbList',
        'itemListElement': [
          {
            '@type': 'ListItem',
            'position': 1,
            'item': {
              '@id': 'https://core.ac.uk',
              'name': 'CORE',
            },
          },
          {
            '@type': 'ListItem',
            'position': 2,
            'item': {
              '@id': `https://core.ac.uk/search?q=repositories.id:(${metadata.repositories.id})`,
              'name': metadata.repositories.name || 'unknown',
            },
          },
          {
            '@type': 'ListItem',
            'position': 3,
            'item': {
              '@id': `https://core.ac.uk/reader/${metadata.id}`,
              'name': metadata.title,
              'image': `https://core.ac.uk/image/${metadata.id}/large`,
            },
          },
        ],
      },
      {
        '@type': 'ScholarlyArticle',
        '@id': `https://core.ac.uk/reader/${metadata.id}`,
        'headline': addEllipsis(metadata.title || '', 110),
        'description': metadata.abstract || undefined,
        'name': metadata.title,
        'author':
          metadata.authors &&
          metadata.authors.map((author) => ({
            '@type': 'Person',
            'name': author,
          })),
        'datePublished': metadata.datePublished || '',
        'isAccessibleForFree': true,
        'provider': {
          '@type': 'Organization',
          'name': metadata.repositories.name || '',
        },
        'image': `https://core.ac.uk/image/${metadata.id}/large`,
        'publisher': {
          '@type': 'Organization',
          'name': metadata.publisher || '',
        },
      },
    ],
  }

  return JSON.stringify(ld)
}

export async function getServerSideProps({ query }) {
  const articleId = query['article-id']

  const metadata = await Article.fetchMetadata({
    id: articleId,
  })

  return {
    props: {
      initialState: {
        article: {
          ...metadata,
        },
      },
      structuredData: structuredMetadata(metadata),
    },
  }
}

const ArticlePage = observe(({ initialState, structuredData }) => {
  const { article, statistics } = useStore(initialState)

  return (
    <>
      <Head>
        <title>{article.title} - CORE</title>

        {article.downloadLink && (
          <>
            <meta name="DC.format" content={article.downloadLink} />
            <meta name="citation_pdf_url" content={article.downloadLink} />
          </>
        )}

        {article.title && (
          <>
            <meta name="DC.title" content={article.title} />
            <meta name="citation_title" content={article.title} />
          </>
        )}

        {article.abstract && (
          <meta name="DCTERMS.abstract" content={article.abstract} />
        )}

        {(article.authors || []).length &&
          article.authors.map((author) => (
            <meta key={author} name="citation_author" content={author} />
          )) &&
          article.authors.map((author) => (
            <meta key={author} name="DC.creator" content={author} />
          ))}

        {article.year && (
          <>
            <meta name="citation_publication_date" content={article.year} />
            <meta name="DC.issued" content={article.year} />
          </>
        )}
        {article.oai && <meta name="DC.identifier" content={article.oai} />}
        {(article.subjects || []).length &&
          article.subjects.map((subject) => (
            <meta key={subject} name="DC.subject" content={subject} />
          ))}

        {/* eslint-disable react/no-danger */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: structuredData,
          }}
        />
        {/* eslint-enable react/no-danger */}
      </Head>
      <ArticlePageTemplate
        id={article.id}
        title={article.title}
        abstract={article.abstract}
        repository={article.repositories}
        repositoryDocument={article.repositoryDocument}
        publisher={article.publisher}
        datePublished={article.datePublished}
        authors={article.authors}
        totalArticlesCount={statistics.totalArticlesCount}
      />
    </>
  )
})

export default ArticlePage
