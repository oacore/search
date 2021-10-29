import React from 'react'

const DCMeta = ({
  data: { title, authors, abstract, downloadLink, year, oai, subjects },
}) => (
  <>
    {downloadLink && <meta name="DC.format" content={downloadLink} />}
    {(authors || []).map(({ name }) => (
      <meta key={name} name="DC.creator" content={name} />
    ))}
    {title && <meta name="DC.title" content={title} />}
    {abstract && <meta name="DCTERMS.abstract" content={abstract} />}
    {year && <meta name="DC.issued" content={year} />}
    {oai && <meta name="DC.identifier" content={oai} />}
    {(subjects || []).map((subject) => (
      <meta key={subject} name="DC.subject" content={subject} />
    ))}
  </>
)

const CitationMeta = ({ data: { title, authors, downloadLink, year } }) => (
  <>
    {downloadLink && <meta name="citation_pdf_url" content={downloadLink} />}
    {title && <meta name="citation_title" content={title} />}
    {(authors || []).map(({ name }) => (
      <meta key={name} name="citation_author" content={name} />
    ))}
    {year && <meta name="citation_publication_date" content={year} />}
  </>
)

const addEllipsis = (text, max) =>
  text.length <= max ? text : `${text.substring(0, max - 3)}...`

const structuredMetadata = ({
  id,
  title,
  authors,
  abstract,
  publisher,
  publishedDate,
  dataProvider,
}) => {
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
              '@id': `https://core.ac.uk/reader/${id}`,
              'name': title,
              'image': `https://core.ac.uk/image/${id}/large`,
            },
          },
        ],
      },
      {
        '@type': 'ScholarlyArticle',
        '@id': `https://core.ac.uk/reader/${id}`,
        'headline': addEllipsis(title || '', 110),
        'abstract': abstract || undefined,
        'name': title,
        'author': (authors || []).map((author) => ({
          '@type': 'Person',
          'name': author,
        })),
        'datePublished': publishedDate || '',
        'isAccessibleForFree': true,
        'provider': {
          '@type': 'Organization',
          'name': dataProvider.name || '',
        },
        'image': `https://core.ac.uk/image/${id}/large`,
        'publisher': {
          '@type': 'Organization',
          'name': publisher || '',
        },
      },
    ],
  }

  if (dataProvider.id) {
    const foundedElem = ld['@graph'].find(
      (item) => item['@type'] === 'BreadcrumbList'
    )
    foundedElem.itemListElement.push({
      '@type': 'ListItem',
      'position': 3,
      'item': {
        '@id': `${
          dataProvider.id
            ? `https://core.ac.uk/search?q=repositories.id:(${dataProvider.id})`
            : null
        }`,
        'name': dataProvider.name || 'Unknown',
      },
    })
  }

  return JSON.stringify(ld)
}

// Intentionally embedding JSON-LD
/* eslint-disable react/no-danger */
const LinkedData = ({ data }) => (
  <script
    type="application/ld+json"
    dangerouslySetInnerHTML={{
      __html: structuredMetadata(data),
    }}
  />
)
/* eslint-enable react/no-danger */

const Meta = ({ data }) => (
  <>
    <CitationMeta data={data} />
    <DCMeta data={data} />
    <LinkedData data={data} />
  </>
)

export default Meta
