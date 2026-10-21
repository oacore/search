// T-108 (41 B, R-010, R-031, R-042): everything that depends on the runtime's
// time zone and ICU data, on the Node that runs Jest (18.20.8: ICU 74.2).
//   c1 formatDate (utils/helpers.js, findings/06 §3.5) in UTC, America/New_York
//      and Asia/Tokyo. process.env.TZ assigned in a Jest test does not reach
//      the real process, so every zone is a child process started with TZ set.
//   c2 Q-029 formatDate on an invalid Date returns the Date; React cannot
//      render it
//   c3 formatNumber (utils/format-number.js)
//   c4 regionDisplayName (templates/data-provider/index.jsx:24-38): the text of
//      all 676 two-letter codes (the snapshot must be the same on every
//      runtime Node, R-042), FK/HK/MO/PS recorded (Q-093)
//   c5 getCountryName (templates/data-providers/index.jsx:28-31) on the
//      vendored i18n-iso-countries 6.8.0 data, through the rendered providers
//      list
const fs = require('fs')
const path = require('path')
const { spawnSync } = require('child_process')

const React = require('react')

const { render, screen, withRouter } = require('../../utils/render')
const { formatDate } = require('../../../utils/helpers')
const { formatNumber } = require('../../../utils/format-number')
const DataProvidersSearchTemplate =
  require('../../../templates/data-providers').default

const REPO = path.resolve(__dirname, '../../..')
const DATE_CHILD = path.join(
  REPO,
  'test/unit/data/lib/P0-04/t108-format-date-child.cjs'
)

// ---------------------------------------------------------------- c1 ----
const UNDEF = { undefined: true }
const INVALID_DATE = { date: 'Invalid Date' }
const LONG = "{ day: 'numeric', month: 'long', year: 'numeric' }"
const HOURS = "{ hour: '2-digit', minute: '2-digit' }"

// [expression, UTC, America/New_York, Asia/Tokyo]
const DATE_CASES = [
  ["formatDate('2020-05-01')", '01/05/2020', '30/04/2020', '01/05/2020'],
  [
    `formatDate('2020-05-01', ${LONG})`,
    '1 May 2020',
    '30 April 2020',
    '1 May 2020',
  ],
  [
    "formatDate('2020-05-01T23:30:00Z')",
    '01/05/2020',
    '01/05/2020',
    '02/05/2020',
  ],
  [
    "formatDate('2020-05-01T00:00:00.000+02:00')",
    '30/04/2020',
    '30/04/2020',
    '01/05/2020',
  ],
  [`formatDate('2020-05-01T12:00:00Z', ${HOURS})`, '12:00', '08:00', '21:00'],
  // a Date goes through `new Date(date)` unchanged
  [
    "formatDate(new Date('2020-05-01'))",
    '01/05/2020',
    '30/04/2020',
    '01/05/2020',
  ],
  // epoch + 2020 ms, not the year 2020
  ['formatDate(new Date(2020))', '01/01/1970', '31/12/1969', '01/01/1970'],
  // a four-character input is a year and comes back unchanged (string or
  // number)
  ["formatDate('2020')", '2020', '2020', '2020'],
  ['formatDate(2020)', 2020, 2020, 2020],
  // errors are caught and the input comes back
  ["formatDate('bad')", 'bad', 'bad', 'bad'],
  ['formatDate(null)', null, null, null],
  ['formatDate(undefined)', UNDEF, UNDEF, UNDEF],
  ["formatDate(new Date('bad'))", INVALID_DATE, INVALID_DATE, INVALID_DATE],
]
// inputs the function logs (non-production) before returning them
const LOGGED = ["'bad'", 'null', 'undefined', 'Invalid Date']

const inZone = (timeZone) => {
  const run = spawnSync(process.execPath, [DATE_CHILD, REPO], {
    input: JSON.stringify(DATE_CASES.map(([expression]) => expression)),
    env: { PATH: process.env.PATH, TZ: timeZone, NODE_ENV: 'test' },
    encoding: 'utf8',
  })
  if (run.status !== 0)
    throw new Error(`date child failed (${run.status}): ${run.stderr}`)
  return { ...JSON.parse(run.stdout), stderr: run.stderr }
}

describe('T-108 @P0 locale, time zone and ICU', () => {
  describe('c1 formatDate in three time zones', () => {
    test.each([
      ['UTC', 1],
      ['America/New_York', 2],
      ['Asia/Tokyo', 3],
    ])('T-108 c1 @P0 formatDate in %s', (timeZone, column) => {
      const { timeZone: effective, results, stderr } = inZone(timeZone)
      // the child really ran in the zone
      expect(effective).toBe(timeZone)
      expect(results).toEqual(DATE_CASES.map((row) => row[column]))
      // each failing input is logged once, outside production
      expect(stderr.match(/Date in invalid format/g)).toHaveLength(
        LOGGED.length
      )
    })

    test('T-108 c1 @P0 the same instant formats to different days in the three zones', () => {
      const days = ['UTC', 'America/New_York', 'Asia/Tokyo'].map(
        (timeZone) => inZone(timeZone).results[0]
      )
      expect(days).toEqual(['01/05/2020', '30/04/2020', '01/05/2020'])
    })
  })

  describe('c2 Q-029 invalid dates', () => {
    afterEach(() => {
      jest.restoreAllMocks()
    })

    test('T-108 c2 @P0 Q-029 formatDate(new Date(invalid)) returns the Date object itself and logs', () => {
      const logged = jest.spyOn(console, 'error').mockImplementation(() => {})
      const invalid = new Date('not a date')
      const result = formatDate(invalid)
      expect(result).toBe(invalid)
      expect(Number.isNaN(result.getTime())).toBe(true)
      expect(String(result)).toBe('Invalid Date')
      expect(logged).toHaveBeenCalledTimes(1)
      expect(logged).toHaveBeenCalledWith(
        'Date in invalid format',
        invalid,
        expect.any(RangeError)
      )
    })

    test('T-108 c2 @P0 Q-029 React cannot render the returned Date: the render throws', () => {
      jest.spyOn(console, 'error').mockImplementation(() => {})
      const result = formatDate(new Date('not a date'))
      expect(() => render(<p>{result}</p>)).toThrow(
        /Objects are not valid as a React child/
      )
    })

    test('T-108 c2 @P0 Q-029 a string that is not a date comes back as the string (rendered as text)', () => {
      jest.spyOn(console, 'error').mockImplementation(() => {})
      const { container } = render(<p>{formatDate('not a date')}</p>)
      expect(container.textContent).toBe('not a date')
    })
  })

  describe('c3 formatNumber', () => {
    test.each([
      [0, '0'],
      [1234567.891, '1,234,567.89'],
      [452015991, '452,015,991'],
      [-1.005, '-1.01'],
      [0.125, '0.13'],
      ['123', '123'],
      [null, '0'],
      [1e21, '1,000,000,000,000,000,000,000'],
      [10n, '10'],
      [Infinity, '∞'],
    ])('T-108 c3 @P0 formatNumber(%p) = %p', (input, expected) => {
      expect(formatNumber(input)).toBe(expected)
    })

    test.each(['abc', NaN, undefined, 'NaN', 'more than 356 million'])(
      'T-108 c3 @P0 formatNumber(%p) is the user-visible fallback "a lot of"',
      (input) => {
        expect(formatNumber(input)).toBe('a lot of')
      }
    )

    test('T-108 c3 @P0 options: locale, fraction digits and the rest go to Intl.NumberFormat', () => {
      expect(formatNumber(1234567.891, { locale: 'de-DE' })).toBe(
        '1.234.567,89'
      )
      expect(formatNumber(1234.5, { maximumFractionDigits: 0 })).toBe('1,235')
      // maximumFractionDigits stays 2 unless given
      expect(formatNumber(0.256, { style: 'percent' })).toBe('25.6%')
      expect(formatNumber(1.5, { minimumFractionDigits: 2 })).toBe('1.50')
      // the default locale is en-GB: en-US prints the currency as $
      expect(formatNumber(1234.5, { style: 'currency', currency: 'USD' })).toBe(
        'US$1,234.50'
      )
    })

    test('T-108 c3 @P0 Number#toLocaleString("en-GB") (statistics, totalHits, filter counts)', () => {
      expect((452015991).toLocaleString('en-GB')).toBe('452,015,991')
      // a string is returned unchanged
      expect('more than 356 million'.toLocaleString('en-GB')).toBe(
        'more than 356 million'
      )
    })
  })

  describe('c4 regionDisplayName', () => {
    // regionDisplayName is module-local (not exported), so the block that
    // defines it and its Intl.DisplayNames instance is taken from the source
    // file and evaluated; the snapshot is therefore of the app's own code.
    const SOURCE = fs.readFileSync(
      path.join(REPO, 'templates/data-provider/index.jsx'),
      'utf8'
    )
    const BLOCK = SOURCE.slice(
      SOURCE.indexOf('const countryName ='),
      SOURCE.indexOf('const DataProviderTemplate')
    )

    const loadRegionDisplayName = ({ withoutDisplayNames = false } = {}) => {
      const descriptor = Object.getOwnPropertyDescriptor(Intl, 'DisplayNames')
      if (withoutDisplayNames) delete Intl.DisplayNames
      try {
        // eslint-disable-next-line no-new-func
        return new Function(`${BLOCK}\nreturn regionDisplayName`)()
      } finally {
        if (withoutDisplayNames)
          Object.defineProperty(Intl, 'DisplayNames', descriptor)
      }
    }

    const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('')
    const CODES = LETTERS.flatMap((a) => LETTERS.map((b) => `${a}${b}`))

    test('T-108 c4 @P0 the extracted block is the app code: one Intl.DisplayNames instance, en, region', () => {
      expect(BLOCK.startsWith('const countryName =')).toBe(true)
      expect(BLOCK).toContain(
        "new Intl.DisplayNames(['en'], { type: 'region' })"
      )
      expect(BLOCK).toContain('const regionDisplayName = (code) => {')
      expect(BLOCK).toContain('code.trim().toUpperCase()')
      expect(BLOCK.trim().endsWith('}')).toBe(true)
    })

    test('T-108 c4 @P0 R-042 the text of all 676 two-letter codes is the recorded snapshot (the same on every runtime Node)', () => {
      const regionDisplayName = loadRegionDisplayName()
      const regions = Object.fromEntries(
        CODES.map((code) => [code, regionDisplayName(code)])
      )
      expect(Object.keys(regions)).toHaveLength(676)
      expect(regions).toMatchSnapshot()
    })

    test('T-108 c4 @P0 Q-093 FK, HK, MO and PS as this runtime prints them (Chrome prints other texts)', () => {
      const regionDisplayName = loadRegionDisplayName()
      expect({
        FK: regionDisplayName('FK'),
        HK: regionDisplayName('HK'),
        MO: regionDisplayName('MO'),
        PS: regionDisplayName('PS'),
      }).toEqual({
        FK: 'Falkland Islands',
        HK: 'Hong Kong SAR China',
        MO: 'Macao SAR China',
        PS: 'Palestinian Territories',
      })
    })

    test('T-108 c4 @P0 R-031 a stable subset: GB, US, FR, TR, CZ, MK, CI, SZ, XK, ZZ', () => {
      const regionDisplayName = loadRegionDisplayName()
      expect(
        Object.fromEntries(
          ['GB', 'US', 'FR', 'TR', 'CZ', 'MK', 'CI', 'SZ', 'XK', 'ZZ'].map(
            (code) => [code, regionDisplayName(code)]
          )
        )
      ).toEqual({
        GB: 'United Kingdom',
        US: 'United States',
        FR: 'France',
        TR: 'Türkiye',
        CZ: 'Czechia',
        MK: 'North Macedonia',
        CI: 'Côte d’Ivoire',
        SZ: 'Eswatini',
        XK: 'Kosovo',
        ZZ: 'Unknown Region',
      })
    })

    test('T-108 c4 @P0 input handling: trim and upper-case, "" for null/non-string/empty, the code itself when Intl throws', () => {
      const regionDisplayName = loadRegionDisplayName()
      expect(regionDisplayName(' gb ')).toBe('United Kingdom')
      expect(regionDisplayName('tr')).toBe('Türkiye')
      ;[null, undefined, '', '   ', 42, {}, ['GB']].forEach((empty) => {
        expect(regionDisplayName(empty)).toBe('')
      })
      // not a region code: Intl.DisplayNames throws, the normalised input is
      // returned
      expect(regionDisplayName('g')).toBe('G')
      expect(regionDisplayName(' gbr ')).toBe('GBR')
      expect(regionDisplayName('1')).toBe('1')
    })

    test('T-108 c4 @P0 Q-093 without Intl.DisplayNames the raw (upper-cased) code is printed', () => {
      const regionDisplayName = loadRegionDisplayName({
        withoutDisplayNames: true,
      })
      expect(typeof Intl.DisplayNames).toBe('function')
      expect(regionDisplayName('hk')).toBe('HK')
      expect(regionDisplayName('GB')).toBe('GB')
      expect(regionDisplayName(null)).toBe('')
    })
  })

  describe('c5 getCountryName through the rendered providers list', () => {
    const provider = (id, name, location) => ({
      id,
      name,
      urlHomepage: `https://provider-${id}.example.test/`,
      ...(location === undefined ? {} : { dataProviderLocation: location }),
    })
    const at = (countryCode) => ({ countryCode, latitude: 1, longitude: 2 })

    // SearchResults scrolls in a layout effect; jsdom reports window.scroll as
    // "not implemented" on the console
    beforeEach(() => {
      jest.spyOn(window, 'scroll').mockImplementation(() => {})
    })

    afterEach(() => {
      jest.restoreAllMocks()
    })

    const renderList = async (results) => {
      const props = {
        dataProviders: results,
        query: '',
        dataProvidersSize: 20,
        results,
        setDataProvidersSize: jest.fn(),
        searchDataProviders: jest.fn(() => []),
        setQuery: jest.fn(),
        setShowForm: jest.fn(),
        showAddDataProviderForm: false,
        formRef: React.createRef(),
        totalArticlesCount: 'more than 356 million',
      }
      const view = render(<DataProvidersSearchTemplate {...props} />, {
        wrapper: withRouter(),
      })
      // the map is a next/dynamic component: wait for its stub inside act
      await screen.findByTestId('map-stub')
      return view
    }

    // [title, country text or null] per card
    const countries = (container) =>
      [...container.querySelectorAll('.result-card')].map((card) => {
        const country = card.querySelector(
          '[aria-labelledby="data-provider-country-title"]'
        )
        return [
          card.querySelector('.result-title').textContent,
          country ? country.textContent : null,
        ]
      })

    test('T-108 c5 @P0 TR is Turkey (vendored 6.8.0 data, not Türkiye); an array of names gives the first', async () => {
      const { container } = await renderList([
        provider(1, 'Turkish repository', at('TR')),
        provider(2, 'British repository', at('GB')),
        provider(3, 'American repository', at('US')),
        provider(4, 'Palestinian repository', at('PS')),
        provider(5, 'Czech repository', at('CZ')),
      ])
      expect(countries(container)).toEqual([
        ['Turkish repository', 'Turkey'],
        ['British repository', 'United Kingdom'],
        ['American repository', 'United States of America'],
        ['Palestinian repository', 'State of Palestine'],
        ['Czech repository', 'Czech Republic'],
      ])
    })

    test('T-108 c5 @P0 the code is upper-cased; null, a missing location and an unknown code give no country', async () => {
      const { container } = await renderList([
        provider(1, 'lower case', at('tr')),
        provider(2, 'null code', at(null)),
        provider(3, 'no location'),
        provider(4, 'unknown code', at('ZZ')),
        provider(5, 'undefined code', { latitude: 1, longitude: 2 }),
        provider(6, 'empty code', at('')),
      ])
      expect(countries(container)).toEqual([
        ['lower case', 'Turkey'],
        ['null code', null],
        ['no location', null],
        ['unknown code', null],
        ['undefined code', null],
        ['empty code', null],
      ])
    })
  })
})
