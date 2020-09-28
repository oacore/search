const generateMetadata = (results) =>
  JSON.stringify({
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
              '@id': `https://core.ac.uk/data-providers/search`,
              'name': 'Data providers search',
            },
          },
        ],
      },
      {
        '@type': 'SearchResultsPage',
        'mainEntity': {
          '@type': 'ItemList',
          'itemListElement': results.map((el, index) => ({
            '@type': 'ListItem',
            'position': index,
            'item': {
              '@id': `https://core.ac.uk/search?q=repositories.id:(${el.id})`,
              'name': el.name,
            },
          })),
        },
      },
    ],
  })

export default generateMetadata
