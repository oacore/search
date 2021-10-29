// Some simple data for testing

const FILTERS = [
  {
    id: 1,
    label: 'field',
    items: [
      {
        id: 2,
        label: 'MOSCOW',
        count: 1,
      },
      {
        id: 3,
        label: 'German',
        count: 1234,
      },
      {
        id: 4,
        label: 'French',
        count: 123,
      },
      {
        id: 5,
        label: 'Italian',
        count: 3,
      },
      {
        id: 6,
        label: 'Russian',
        count: 54,
      },
      {
        id: 12343435354,
        label: 'unclassified',
        count: 47,
      },
      {
        id: 124356789,
        label: 'Art',
        count: 1,
      },
      {
        id: 34645676,
        label: 'english',
        count: 1,
      },
      {
        id: 1232423,
        label: 'German',
        count: 3453,
      },
      {
        id: 23435345,
        label: 'French',
        count: 123,
      },
      {
        id: 12345334,
        label: 'Italian',
        count: 3,
      },
      {
        id: 768675,
        label: 'Russian',
        count: 23423,
      },
      {
        id: 456546,
        label: 'unclassified',
        count: 47,
      },
      {
        id: 1243,
        label: 'Art',
        count: 1,
      },
      {
        id: 4563,
        label: 'english',
        count: 1,
      },
      {
        id: 12312,
        label: 'German',
        count: 245,
      },
      {
        id: 456,
        label: 'French',
        count: 123,
      },
      {
        id: 213,
        label: 'Italian',
        count: 3,
      },
    ],
  },
  {
    id: 2,
    label: 'year',
    items: [
      {
        id: 2,
        label: 2001,
        count: 10001,
      },
      {
        id: 345646546456,
        label: 'unclassified',
        count: 100000,
      },
      {
        id: 3,
        label: 2002,
        count: 25000,
      },
      {
        id: 4,
        label: 2003,
        count: 4000,
      },

      {
        id: 5,
        label: 2004,
        count: 18000,
      },
      {
        id: 6,
        label: 2005,
        count: 4234,
      },
      {
        id: 12343435354,
        label: 2006,
        count: 23534,
      },
      {
        id: 124356789,
        label: 2007,
        count: 34546,
      },
      {
        id: 34645676,
        label: 2008,
        count: 21345,
      },
      {
        id: 1232423,
        label: 2009,
        count: 24234,
      },
      {
        id: 23435345,
        label: 2010,
        count: 35346,
      },
      {
        id: 12345334,
        label: 2011,
        count: 12433,
      },
      {
        id: 768675,
        label: 2012,
        count: 23423,
      },
      {
        id: 456546,
        label: 2013,
        count: 34665,
      },
      {
        id: 1243,
        label: 2014,
        count: 34543,
      },
      {
        id: 4563,
        label: 2015,
        count: 6786,
      },
      {
        id: 12312,
        label: 2016,
        count: 23546,
      },
      {
        id: 456,
        label: 2017,
        count: 23534,
      },
      {
        id: 213,
        label: 2018,
        count: 23453,
      },
    ],
  },
  {
    id: 3,
    label: 'language',
    items: [
      {
        id: 1,
        label: 'unclassified',
        count: 47,
      },
      {
        id: 2,
        label: 'english',
        count: 324,
      },
      {
        id: 3,
        label: 'German',
        count: 213,
      },
      {
        id: 4,
        label: 'French',
        count: 8,
      },
      {
        id: 5,
        label: 'Italian',
        count: 3,
      },
      {
        id: 6,
        label: 'Russian',
        count: 3,
      },
      {
        id: 7,
        label: 'Art',
        count: 2,
      },
    ],
  },
  {
    id: 4,
    label: 'Author',
    items: [
      {
        id: 1,
        label: 'unclassified',
        count: 47,
      },
      {
        id: 2,
        label: 'english',
        count: 324,
      },
      {
        id: 3,
        label: 'German',
        count: 213,
      },
      {
        id: 4,
        label: 'French',
        count: 8,
      },
      {
        id: 5,
        label: 'Italian',
        count: 3,
      },
      {
        id: 6,
        label: 'Russian',
        count: 3,
      },
      {
        id: 7,
        label: 'Art',
        count: 2,
      },
    ],
  },
  {
    id: 5,
    label: 'Type',
    items: [
      {
        id: 1,
        label: 'unclassified',
        count: 47,
      },
      {
        id: 2,
        label: 'english',
        count: 324,
      },
      {
        id: 3,
        label: 'German',
        count: 213,
      },
      {
        id: 4,
        label: 'French',
        count: 8,
      },
      {
        id: 5,
        label: 'Italian',
        count: 3,
      },
      {
        id: 6,
        label: 'Russian',
        count: 3,
      },
      {
        id: 7,
        label: 'Art',
        count: 2,
      },
    ],
  },
  {
    id: 6,
    label: 'publisher',
    items: [
      {
        id: 2,
        label: 'english',
        count: 324,
      },
      {
        id: 3,
        label: 'German',
        count: 213,
      },
      {
        id: 4,
        label: 'French',
        count: 8,
      },
      {
        id: 5,
        label: 'Italian',
        count: 3,
      },
    ],
  },
  {
    id: 7,
    label: 'sort by',
    items: [
      {
        id: 1,
        label: 'Relevant',
        count: 14785,
      },
      {
        id: 2,
        label: 'Relevant with full text',
        count: 2329,
      },
      {
        id: 3,
        label: 'Recent',
        count: 583,
      },
    ],
  },
]

export default FILTERS
