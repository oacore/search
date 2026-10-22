// T-009 (41 A, R-067, Q-026): the shape and the size floors of the three data
// files the build bakes in (data/.formap.json, data/.members.json,
// data/.statistics.json; findings/06 §4.1, §4.4). Producer-side format drift
// (the data-loader writes whatever the API answers; 200 `[]` overwrites every
// file with exit 0: Q-026) must fail here, not in a page.
//
// Which files: the frozen snapshot test/fixtures/data-snapshot/ (= data/ at
// G, the data of every parity build; git-excluded by the owner's decision on
// I-11, its SHA-256 set is committed in test/fixtures/SHA256SUMS). When the
// snapshot folder is absent the tracked data/ is read. The release-recipe
// half of the row (a build of every step head with the live data-loader, 01 §4
// step 3a; I-10) is DEFERRED: it runs this file with T009_DATA_DIR=<the
// build's data/ folder>, which replaces the folder read; the floors are
// always the 90 % of the frozen snapshot's counts below.
//
// Failure messages name row indexes and field names only (the provider map
// holds public contact e-mails: I-11).
const crypto = require('crypto')
const fs = require('fs')
const path = require('path')

const ROOT = path.resolve(__dirname, '..', '..')
const SNAPSHOT_DIR = path.join(ROOT, 'test', 'fixtures', 'data-snapshot')
const TRACKED_DIR = path.join(ROOT, 'data')
const SUMS_FILE = path.join(ROOT, 'test', 'fixtures', 'SHA256SUMS')

// the counts of the frozen snapshot (floors = 90 % of these)
const SNAPSHOT = { formap: 15672, members: 477, totalArticlesCount: 452015991 }
const FLOOR_PERCENT = 90
const BILLING_TYPES = ['starting', 'supporting', 'sustaining']

const FILES = ['.formap.json', '.members.json', '.statistics.json']

function resolveSource() {
  const override = process.env.T009_DATA_DIR
  if (override) return { kind: 'override', dir: path.resolve(override) }
  const frozen = FILES.every((f) => fs.existsSync(path.join(SNAPSHOT_DIR, f)))
  return frozen
    ? { kind: 'snapshot', dir: SNAPSHOT_DIR }
    : { kind: 'tracked', dir: TRACKED_DIR }
}

const readJson = (dir, name) =>
  JSON.parse(fs.readFileSync(path.join(dir, name), 'utf8'))

const sha256 = (file) =>
  crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex')

// at least 90 % of the snapshot's count, in integers (no rounding question)
const atLeastFloor = (value, snapshotValue) =>
  value * 100 >= snapshotValue * FLOOR_PERCENT

const isPlainObject = (v) =>
  v !== null && typeof v === 'object' && !Array.isArray(v)

// {count, first}: the failing row indexes, never row content
const failing = (rows, ok) => {
  const bad = []
  rows.forEach((row, i) => {
    if (!ok(row)) bad.push(i)
  })
  return { count: bad.length, first: bad.slice(0, 10) }
}

describe('T-009 @P1 data files (frozen snapshot)', () => {
  const source = resolveSource()
  let formap
  let members
  let statistics

  beforeAll(() => {
    formap = readJson(source.dir, '.formap.json')
    members = readJson(source.dir, '.members.json')
    statistics = readJson(source.dir, '.statistics.json')
  })

  test('T-009 c1 @P1 .formap.json is an array of { id: number, name: string } rows', () => {
    expect(Array.isArray(formap)).toBe(true)
    expect(
      failing(
        formap,
        (row) =>
          isPlainObject(row) &&
          typeof row.id === 'number' &&
          Number.isFinite(row.id) &&
          typeof row.name === 'string'
      )
    ).toEqual({ count: 0, first: [] })
  })

  test('T-009 c1 @P1 every .formap.json row has a non-empty name (normalizeDataProviders drops nameless rows)', () => {
    expect(
      failing(
        formap,
        (row) => typeof row.name === 'string' && row.name.trim() !== ''
      )
    ).toEqual({
      count: 0,
      first: [],
    })
  })

  test('T-009 c2 @P1 .members.json rows have billing_type in starting, supporting or sustaining', () => {
    expect(Array.isArray(members)).toBe(true)
    expect(
      failing(
        members,
        (row) => isPlainObject(row) && BILLING_TYPES.includes(row.billing_type)
      )
    ).toEqual({ count: 0, first: [] })
  })

  test('T-009 c2 @P1 .members.json rows have repo_id as an integer, an integer array or null', () => {
    expect(
      failing(
        members,
        (row) =>
          row.repo_id === null ||
          Number.isInteger(row.repo_id) ||
          (Array.isArray(row.repo_id) && row.repo_id.every(Number.isInteger))
      )
    ).toEqual({ count: 0, first: [] })
  })

  test('T-009 c3 @P1 .statistics.json is a raw object with a numeric totalArticlesCount (no data wrapper: Q-004)', () => {
    expect(isPlainObject(statistics)).toBe(true)
    expect(typeof statistics.totalArticlesCount).toBe('number')
    expect(Number.isFinite(statistics.totalArticlesCount)).toBe(true)
    // the app reads `statistics.data`; a wrapped file changes the page text
    expect('data' in statistics).toBe(false)
  })

  test('T-009 c4 @P1 the floors: .formap.json and .members.json rows and totalArticlesCount are at least 90 % of the snapshot', () => {
    expect({
      formap: atLeastFloor(formap.length, SNAPSHOT.formap),
      members: atLeastFloor(members.length, SNAPSHOT.members),
      totalArticlesCount: atLeastFloor(
        statistics.totalArticlesCount,
        SNAPSHOT.totalArticlesCount
      ),
    }).toEqual({ formap: true, members: true, totalArticlesCount: true })
  })

  test('T-009 c4 @P1 an empty array in place of a file (Q-026: 200 [] overwrites the files) is below every floor', () => {
    expect(atLeastFloor(0, SNAPSHOT.formap)).toBe(false)
    expect(atLeastFloor(0, SNAPSHOT.members)).toBe(false)
    expect(atLeastFloor(undefined, SNAPSHOT.totalArticlesCount)).toBe(false)
    // the boundary: exactly 90 % passes, one below fails
    expect(atLeastFloor(14105, SNAPSHOT.formap)).toBe(true)
    expect(atLeastFloor(14104, SNAPSHOT.formap)).toBe(false)
    expect(atLeastFloor(430, SNAPSHOT.members)).toBe(true)
    expect(atLeastFloor(429, SNAPSHOT.members)).toBe(false)
  })

  if (source.kind === 'snapshot') {
    test('T-009 c4 @P1 the frozen snapshot holds the counts the floors are computed from', () => {
      expect({
        formap: formap.length,
        members: members.length,
        totalArticlesCount: statistics.totalArticlesCount,
      }).toEqual(SNAPSHOT)
    })

    test('T-009 c1 @P1 the frozen snapshot is the recorded one: SHA-256 of its three files = test/fixtures/SHA256SUMS', () => {
      const sums = {}
      fs.readFileSync(SUMS_FILE, 'utf8')
        .split('\n')
        .forEach((line) => {
          const [, hash, name] = line.match(/^([0-9a-f]{64}) {2}(.+)$/) || []
          if (name) sums[name] = hash
        })
      const actual = {}
      const expected = {}
      FILES.forEach((name) => {
        actual[`data-snapshot/${name}`] = sha256(path.join(SNAPSHOT_DIR, name))
        expected[`data-snapshot/${name}`] = sums[`data-snapshot/${name}`]
      })
      expect(actual).toEqual(expected)
    })
  }
})
