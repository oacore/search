// T-203 (41 C, R-011, R-039, R-046, R-081): the reactivity contract of the
// MobX stores. c1 generates, for every store class, what MobX knows about each
// field and method (observable / computed / action, or plain) and compares it
// with the table frozen in __baseline__/t203-reactivity.json. The table is
// regenerated only by `RECORD=1`; the file is never edited by hand. c2 drives
// an `autorun` per observable and counts its runs per write. From 6.0 this
// row is rewritten through T-212 (store-driver contract); until then it is the
// MobX-API oracle for decorators (store/filters.js) and annotation maps.
const fs = require('fs')
const path = require('path')

const mobx = require('mobx')

const Claim = require('../../../store/claim').default
const DataProviders = require('../../../store/data-providers').default
const { schema } = require('../../../store/data-providers')
const Filters = require('../../../store/filters').default
const Params = require('../../../store/params').default
const Report = require('../../../store/report').default
const Root = require('../../../store/root').default
const Search = require('../../../store/search').default
const SimilarWorks = require('../../../store/similar-works').default

const BASELINE = path.join(__dirname, '__baseline__', 't203-reactivity.json')

const { autorun, runInAction } = mobx

// one fresh instance per class, constructed the way the app does
const instances = () => ({
  Claim: new Claim(),
  DataProviders: new DataProviders({ data: [], params: {} }),
  Filters: new Filters(),
  Params: new Params({}, schema),
  Report: new Report(),
  Root: new Root({ statistics: {} }),
  Search: new Search(),
  SimilarWorks: new SimilarWorks(),
})

const descriptorOf = (instance, name) => {
  for (
    let o = instance;
    o && o !== Object.prototype;
    o = Object.getPrototypeOf(o)
  ) {
    const d = Object.getOwnPropertyDescriptor(o, name)
    if (d) return d
  }
  return undefined
}

// never reads the member (a computed `maxYear` throws without data)
const kindOf = (instance, name) => {
  if (mobx.isComputedProp(instance, name)) return 'computed'
  if (mobx.isObservableProp(instance, name)) return 'observable'
  const d = descriptorOf(instance, name)
  if (d.get || d.set) return 'plain-accessor'
  if (typeof d.value === 'function')
    return mobx.isAction(d.value) ? 'action' : 'plain-method'
  return 'plain'
}

const describeClass = (instance) => {
  const names = new Set(Object.getOwnPropertyNames(instance))
  for (
    let o = Object.getPrototypeOf(instance);
    o && o !== Object.prototype;
    o = Object.getPrototypeOf(o)
  )
    for (const name of Object.getOwnPropertyNames(o)) names.add(name)
  names.delete('constructor')
  return Object.fromEntries(
    [...names].sort().map((name) => [name, kindOf(instance, name)])
  )
}

const generate = () =>
  Object.fromEntries(
    Object.entries(instances()).map(([name, instance]) => [
      name,
      describeClass(instance),
    ])
  )

// a value different from the current one, of the same kind
const different = (current) => {
  if (typeof current === 'boolean') return !current
  if (typeof current === 'number') return current + 1
  if (typeof current === 'string') return `${current}!`
  if (current === null || current === undefined) return 'written'
  if (Array.isArray(current)) return [...current, 'written']
  return { ...current, written: true }
}
const isPrimitive = (v) => v === null || typeof v !== 'object'

const MOBX_STRICT =
  /^\[MobX\] Since strict-mode is enabled, changing \(observed\) observable values without using an action is not allowed\. Tried to modify: /

describe('T-203 @P0 reactivity contract', () => {
  afterEach(() => jest.restoreAllMocks())

  test('T-203 c1 @P0 observable, computed, action per field and method equals the frozen table', () => {
    const table = generate()

    if (process.env.RECORD === '1') {
      fs.writeFileSync(
        BASELINE,
        `${JSON.stringify({ schema: 1, classes: table }, null, 2)}\n`
      )
    }
    const baseline = JSON.parse(fs.readFileSync(BASELINE, 'utf8'))
    expect(baseline.schema).toBe(1)
    expect(table).toEqual(baseline.classes)

    // facts the table must hold, whatever was recorded (41: non-observable
    // Claim.duplicated, un-actioned Search/Report methods)
    expect(table.Claim.duplicated).toBe('plain')
    expect(table.Claim.created).toBe('observable')
    expect(table.Claim.retrieve).toBe('action')
    for (const name of [
      'setActiveLimit',
      'setActiveDownloadModal',
      'setActiveSortOptionData',
    ])
      expect(table.Search[name]).toBe('plain-method')
    expect(table.Search.downloadResults).toBe('action')
    expect(table.Search.sortOptions).toBe('observable')
    expect(table.Report.submit).toBe('plain-method')
    expect(table.Report.fetchOutput).toBe('plain-method')
    expect(table.Report.reset).toBe('action')
    expect(table.SimilarWorks.reset).toBe('plain-method')
    expect(table.SimilarWorks.fetchSimilar).toBe('action')
    // legacy decorators of Filters
    expect(table.Filters.data).toBe('observable')
    expect(table.Filters.maxYear).toBe('computed')
    expect(table.Filters.filterNamesWithoutYear).toBe('computed')
    expect(table.Filters.filterNamesWithoutPublisher).toBe('plain-accessor')
    expect(table.Filters.fetchFilters).toBe('action')
    expect(table.Filters.getFilterByValue).toBe('action')
    // annotation maps of Root, DataProviders and the dynamic keys of Params
    expect(table.Root.search).toBe('plain')
    expect(table.Root.claim).toBe('observable')
    expect(table.Root.extend).toBe('action')
    expect(table.DataProviders.results).toBe('computed')
    expect(table.DataProviders.params).toBe('plain')
    expect(table.Params.q).toBe('observable')
    expect(table.Params.schema).toBe('plain')
    expect(table.Params.changeParams).toBe('action')
  })

  test('T-203 c2 @P0 an autorun on an observable runs once per write', () => {
    const table = generate()
    const checked = []
    for (const [className, instance] of Object.entries(instances())) {
      const observables = Object.entries(table[className]).filter(
        ([, kind]) => kind === 'observable'
      )
      for (const [name] of observables) {
        const label = `${className}.${name}`
        let runs = 0
        const dispose = autorun(() => {
          // eslint-disable-next-line no-unused-expressions
          instance[name]
          runs += 1
        })
        expect(runs).toBe(1)
        const next = different(mobx.toJS(instance[name]))
        runInAction(() => {
          instance[name] = next
        })
        expect([label, runs]).toEqual([label, 2])
        if (isPrimitive(next)) {
          // the same value again is not a change
          runInAction(() => {
            instance[name] = next
          })
          expect([label, runs]).toEqual([label, 2])
        }
        dispose()
        checked.push(label)
      }
    }
    expect(checked).toHaveLength(
      Object.values(table).flatMap((c) =>
        Object.values(c).filter((k) => k === 'observable')
      ).length
    )

    // a field that is not observable never notifies (Claim.duplicated)
    const claim = new Claim()
    let runs = 0
    const dispose = autorun(() => {
      // eslint-disable-next-line no-unused-expressions
      claim.duplicated
      runs += 1
    })
    runInAction(() => {
      claim.duplicated = { message: '{}' }
    })
    expect(runs).toBe(1)
    expect(claim.duplicated).toEqual({ message: '{}' })
    dispose()
  })

  test('T-203 c2 @P0 computeds run once per change of their inputs', () => {
    // Filters.maxYear needs a year facet
    const filters = new Filters()
    runInAction(() => {
      filters.data = [
        { label: 'year', items: [{ value: 2001 }, { value: 1999 }] },
      ]
    })
    const seen = []
    const stop = autorun(() => seen.push(filters.maxYear))
    runInAction(() => {
      filters.data = [{ label: 'year', items: [{ value: 2005 }] }]
    })
    expect(seen).toEqual([2001, 2005])
    // same maximum: the computed value is equal, the autorun does not run
    runInAction(() => {
      filters.data = [{ label: 'year', items: [{ value: 2005 }, { value: 7 }] }]
    })
    expect(seen).toEqual([2001, 2005])
    stop()

    // DataProviders.results is cached inside a reaction: one search() per
    // change of data or q, although the reaction reads it twice
    const providers = new DataProviders({
      data: [
        { id: 1, name: 'Alpha' },
        { id: 2, name: 'Beta' },
      ],
      params: { q: 'a' },
    })
    const search = jest.spyOn(providers, 'search')
    const results = []
    const stopResults = autorun(() => {
      results.push(providers.results.map((p) => p.id))
      providers.results.length // eslint-disable-line no-unused-expressions
    })
    expect(search).toHaveBeenCalledTimes(1)
    runInAction(() => {
      providers.params.q = 'be'
    })
    expect(search).toHaveBeenCalledTimes(2)
    runInAction(() => {
      providers.data.push({ id: 3, name: 'Beryl' })
    })
    expect(search).toHaveBeenCalledTimes(3)
    expect(results).toEqual([[1, 2], [2], [2, 3]])
    stopResults()
  })

  test('T-203 c2 @P0 an action batches its writes, an un-actioned method notifies per field', () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {})
    const observedRuns = (instance, names) => {
      const state = { runs: 0 }
      const dispose = autorun(() => {
        names.forEach((name) => instance[name])
        state.runs += 1
      })
      return { state, dispose }
    }

    // Report.reset and Claim.reset are annotated actions: one run
    const report = new Report()
    const reportFields = Object.keys(generate().Report).filter(
      (n) => generate().Report[n] === 'observable'
    )
    runInAction(() => {
      report.output = { id: 1 }
      report.updateOption = 'takeDownFullText'
      report.role = 'author'
      report.isLoading = true
      report.error = 'failed'
      report.isModalReportTypeActive = true
      report.isModalReportFormActive = true
      report.isModalReportSuccessActive = true
    })
    let probe = observedRuns(report, reportFields)
    report.reset()
    expect(probe.state.runs).toBe(2)
    probe.dispose()

    const claim = new Claim()
    runInAction(() => {
      claim.query = 'q'
      claim.request = {}
      claim.created = {}
      claim.error = new Error('x')
      claim.isLoading = true
    })
    probe = observedRuns(claim, [
      'query',
      'request',
      'created',
      'error',
      'isLoading',
    ])
    claim.reset()
    // reset() without arguments keeps `query`: four fields change in one run
    expect(probe.state.runs).toBe(2)
    expect(claim.query).toBe('q')
    probe.dispose()
    expect(warn).not.toHaveBeenCalled()

    // SimilarWorks.reset is not annotated: three writes, three runs, and the
    // dev-mode strict-mode warning for each write to an observed field
    const similar = new SimilarWorks()
    runInAction(() => {
      similar.similarOutputs = [{ id: 1 }]
      similar.isLoading = true
      similar.error = true
    })
    probe = observedRuns(similar, ['similarOutputs', 'isLoading', 'error'])
    similar.reset()
    expect(probe.state.runs).toBe(4)
    expect(warn).toHaveBeenCalledTimes(3)
    for (const [message] of warn.mock.calls)
      expect(message).toMatch(MOBX_STRICT)
    probe.dispose()

    // Search.setActiveLimit and setActiveDownloadModal: a single field each,
    // one run and one warning
    warn.mockClear()
    const search = new Search()
    probe = observedRuns(search, ['activeLimit', 'activeDownloadModal'])
    search.setActiveLimit(25)
    search.setActiveDownloadModal(true)
    expect(probe.state.runs).toBe(3)
    expect(search.activeLimit).toBe(25)
    expect(search.activeDownloadModal).toBe(true)
    expect(warn).toHaveBeenCalledTimes(2)
    for (const [message] of warn.mock.calls)
      expect(message).toMatch(MOBX_STRICT)
    probe.dispose()

    // the annotated Search.setQuery does not warn
    warn.mockClear()
    probe = observedRuns(search, ['query'])
    search.setQuery('climate')
    expect(probe.state.runs).toBe(2)
    expect(warn).not.toHaveBeenCalled()
    probe.dispose()
  })
})
