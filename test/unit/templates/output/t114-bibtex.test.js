// T-114 (41 B, R-053; Q-037): bibtex-parse-js 0.0.24 `toJSON`, the parser
// behind templates/output/citation.jsx:67 (findings/06 §6). Pins the 06 §6
// sample, `[]` for text without an entry, the thrown STRING of malformed input
// (Q-037: not an Error; the ORCID fork 0.0.25 throws TypeErrors instead), and
// that every copy of bibtexParse.js behaves the same. Today the only copy is
// node_modules/bibtex-parse-js/bibtexParse.js; from W0 (CS-BIB-1) the file is
// vendored verbatim at vendor/bibtex-parse-js/bibtexParse.js and the same cases
// run on it (c4), with the sha256 of the 0.0.24 file as the "verbatim" proof.
const crypto = require('crypto')
const fs = require('fs')
const path = require('path')

const ROOT = path.resolve(__dirname, '..', '..', '..', '..')

// sha256 of bibtexParse.js in bibtex-parse-js@0.0.24 (npm), the file the
// vendored copy must equal byte for byte (CS-BIB-1)
const SHA256_0_0_24 =
  'bfdebc92c299a6955e81781e9cf9482bff6637cd33268d4f5ce0aef9aa3494ac'

const COPIES = [
  {
    name: 'node_modules/bibtex-parse-js',
    file: path.join(ROOT, 'node_modules', 'bibtex-parse-js', 'bibtexParse.js'),
  },
  {
    name: 'vendor/bibtex-parse-js',
    file: path.join(ROOT, 'vendor', 'bibtex-parse-js', 'bibtexParse.js'),
  },
].filter((copy) => fs.existsSync(copy.file))

const sha256 = (file) =>
  crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex')

// what a doi.org `application/x-bibtex` answer looks like (invented names)
const SAMPLE = [
  '@article{Doe_2020, title={Deep {Learning}: a review}, volume={12},',
  ' ISSN={1234-5678}, url={http://dx.doi.org/10.1000/xyz123},',
  ' DOI={10.1000/xyz123}, number={3}, journal={Journal of Tests},',
  ' publisher={Example Press}, author={Doe, Jane and Roe, Richard},',
  ' year={2020}, month=jan, pages={1--10}}',
  '',
].join('\n')

const SAMPLE_JSON = [
  {
    citationKey: 'Doe_2020',
    entryType: 'article',
    entryTags: {
      title: 'Deep {Learning}: a review',
      volume: '12',
      ISSN: '1234-5678',
      url: 'http://dx.doi.org/10.1000/xyz123',
      DOI: '10.1000/xyz123',
      number: '3',
      journal: 'Journal of Tests',
      publisher: 'Example Press',
      author: 'Doe, Jane and Roe, Richard',
      year: '2020',
      month: 'jan',
      pages: '1--10',
    },
  },
]

// the value a call throws, or NOT_THROWN
const NOT_THROWN = Symbol('not thrown')
const thrownBy = (fn) => {
  try {
    fn()
  } catch (error) {
    return error
  }
  return NOT_THROWN
}

// a fresh module instance per copy
const load = (file) => {
  let mod
  jest.isolateModules(() => {
    mod = require(file)
  })
  return mod
}

// the cases of c1-c3, run on one copy
const defineCases = (getParser) => {
  describe('c1 the 06 §6 sample', () => {
    test('T-114 c1 @P1 a doi.org style entry parses to citationKey, entryType and entryTags (braces and key case kept)', () => {
      const parsed = getParser().toJSON(SAMPLE)
      expect(parsed).toEqual(SAMPLE_JSON)
      // keys keep the case they were written in
      expect(Object.keys(parsed[0].entryTags)).toEqual(
        Object.keys(SAMPLE_JSON[0].entryTags)
      )
      expect(parsed[0].entryTags.ISSN).toBe('1234-5678')
      expect(parsed[0].entryTags.DOI).toBe('10.1000/xyz123')
      // braces inside a value are kept
      expect(parsed[0].entryTags.title).toBe('Deep {Learning}: a review')
    })

    test('T-114 c1 @P1 the fields citation.jsx reads (title, journal, year, ISBN, ISSN) come out as strings', () => {
      const [entry] = getParser().toJSON(
        '@book{b, title={Two}, journal={J}, year=2021, ISBN={123}, ISSN={9}}'
      )
      expect(entry.entryTags).toEqual({
        title: 'Two',
        journal: 'J',
        year: '2021',
        ISBN: '123',
        ISSN: '9',
      })
      expect(entry.entryType).toBe('book')
    })

    test('T-114 c1 @P1 quoted values, a bare month, an empty value and a trailing comma parse', () => {
      const parser = getParser()
      expect(
        parser.toJSON('@article{k, title = "Quoted", year = 2020}')
      ).toEqual([
        {
          citationKey: 'k',
          entryType: 'article',
          entryTags: { title: 'Quoted', year: '2020' },
        },
      ])
      expect(parser.toJSON('@article{k, month=jan}')[0].entryTags).toEqual({
        month: 'jan',
      })
      expect(parser.toJSON('@article{k, title={}}')[0].entryTags).toEqual({
        title: '',
      })
      expect(parser.toJSON('@article{k, title={X},}')[0].entryTags).toEqual({
        title: 'X',
      })
    })

    test('T-114 c1 @P1 several entries come out in input order; text before an entry is skipped', () => {
      const parsed = getParser().toJSON(
        'some text\n@article{a, title={One}}\n@book{b, title={Two}, ISBN={123}}'
      )
      expect(parsed).toEqual([
        { citationKey: 'a', entryType: 'article', entryTags: { title: 'One' } },
        {
          citationKey: 'b',
          entryType: 'book',
          entryTags: { title: 'Two', ISBN: '123' },
        },
      ])
    })

    test('T-114 c1 @P1 the entry type keeps its case and an @comment entry is returned without a key', () => {
      const parser = getParser()
      expect(parser.toJSON('@ARTICLE{k, TITLE={X}, Year={2020}}')[0]).toEqual({
        citationKey: 'k',
        entryType: 'ARTICLE',
        entryTags: { TITLE: 'X', Year: '2020' },
      })
      expect(parser.toJSON('@comment{x}\n@article{k, title={X}}')).toEqual([
        { entryType: 'COMMENT', entry: 'x' },
        { citationKey: 'k', entryType: 'article', entryTags: { title: 'X' } },
      ])
    })

    test('T-114 c1 @P1 toBibtex writes the parsed sample back as one entry', () => {
      const parser = getParser()
      expect(Object.keys(parser).sort()).toEqual(['toBibtex', 'toJSON'])
      expect(parser.toBibtex(parser.toJSON(SAMPLE))).toBe(
        '@article{Doe_2020, title= {Deep {Learning}: a review}, volume= {12}, ISSN= {1234-5678}, url= {http://dx.doi.org/10.1000/xyz123}, DOI= {10.1000/xyz123}, number= {3}, journal= {Journal of Tests}, publisher= {Example Press}, author= {Doe, Jane and Roe, Richard}, year= {2020}, month= {jan}, pages= {1--10}}\n\n'
      )
    })
  })

  describe('c2 text without an entry', () => {
    test.each([
      ['an empty string', ''],
      ['plain text', 'garbage'],
      ['a number', 5],
      ['whitespace', '  \n\t '],
      ['text with braces but no @', 'title={x}, year={2020}'],
    ])('T-114 c2 @P1 %s gives []', (name, input) => {
      expect(getParser().toJSON(input)).toEqual([])
    })

    test('T-114 c2 @P1 undefined and null are a TypeError (not a string)', () => {
      const parser = getParser()
      expect(thrownBy(() => parser.toJSON(undefined))).toBeInstanceOf(TypeError)
      expect(thrownBy(() => parser.toJSON(null))).toBeInstanceOf(TypeError)
    })
  })

  describe('c3 malformed input throws a string (Q-037)', () => {
    test('T-114 c3 @P1 an unbalanced brace throws the string "Token mismatch, expected }, found "', () => {
      const parser = getParser()
      const cases = [
        '@article{k, title={Deep {Learning}: a review}',
        '@article{k, title={Deep {Learning: a review}, year={2020}}',
      ]
      cases.forEach((input) => {
        const thrown = thrownBy(() => parser.toJSON(input))
        expect(typeof thrown).toBe('string')
        expect(thrown).not.toBeInstanceOf(Error)
        expect(thrown).toBe('Token mismatch, expected }, found ')
      })
    })

    test('T-114 c3 @P1 an entry cut after the type throws the string "Runaway key"', () => {
      const parser = getParser()
      ;['@', '@article'].forEach((input) => {
        const thrown = thrownBy(() => parser.toJSON(input))
        expect(typeof thrown).toBe('string')
        expect(thrown).toBe('Runaway key')
      })
    })

    test('T-114 c3 @P1 an entry without fields throws the string "... = value expected, equals sign missing:}"', () => {
      const thrown = thrownBy(() => getParser().toJSON('@article{k}'))
      expect(typeof thrown).toBe('string')
      expect(thrown).toBe('... = value expected, equals sign missing:}')
    })

    test('T-114 c3 @P1 an @string entry throws a TypeError, the one malformed input that is no string', () => {
      const thrown = thrownBy(() => getParser().toJSON('@string{foo = {bar}}'))
      expect(thrown).toBeInstanceOf(TypeError)
    })

    test('T-114 c3 @P1 the parser keeps no state between calls: a throw does not change the next result', () => {
      const parser = getParser()
      expect(typeof thrownBy(() => parser.toJSON('@article{k'))).toBe('string')
      expect(parser.toJSON(SAMPLE)).toEqual(SAMPLE_JSON)
      expect(parser.toJSON('garbage')).toEqual([])
    })
  })
}

describe('T-114 @P1 bibtex-parse-js (findings/06 §6; Q-037)', () => {
  test('T-114 @P1 at least one copy of bibtexParse.js exists (node_modules before W0, vendor/ after)', () => {
    expect(COPIES.length).toBeGreaterThan(0)
  })

  // c1-c3 on the copy the app imports (the vendored one once it exists)
  const appCopy = COPIES[COPIES.length - 1]
  defineCases(() => load(appCopy.file))

  describe('c4 the same cases on every copy of bibtexParse.js (vendored copy, CS-BIB-1)', () => {
    COPIES.forEach((copy) => {
      test(`T-114 c4 @P1 ${copy.name}/bibtexParse.js is the unmodified 0.0.24 file (sha256 of the npm tarball)`, () => {
        expect(sha256(copy.file)).toBe(SHA256_0_0_24)
      })

      test(`T-114 c4 @P1 ${copy.name}/bibtexParse.js gives the 06 §6 sample, [] for garbage and a thrown string for an unbalanced brace`, () => {
        const parser = load(copy.file)
        expect(Object.keys(parser).sort()).toEqual(['toBibtex', 'toJSON'])
        expect(parser.toJSON(SAMPLE)).toEqual(SAMPLE_JSON)
        expect(parser.toJSON('')).toEqual([])
        expect(parser.toJSON('garbage')).toEqual([])
        const thrown = thrownBy(() =>
          parser.toJSON('@article{k, title={Deep {Learning}: a review}')
        )
        expect(typeof thrown).toBe('string')
        expect(thrown).toBe('Token mismatch, expected }, found ')
      })
    })

    test('T-114 c4 @P1 all copies return deep-equal results for the same inputs', () => {
      const inputs = [
        SAMPLE,
        '',
        'garbage',
        '@article{k, title = "Quoted", year = 2020}',
        '@comment{x}\n@article{k, title={X}}',
      ]
      const parsers = COPIES.map((copy) => load(copy.file))
      inputs.forEach((input) => {
        const first = parsers[0].toJSON(input)
        parsers.slice(1).forEach((parser) => {
          expect(parser.toJSON(input)).toEqual(first)
        })
      })
    })
  })
})
