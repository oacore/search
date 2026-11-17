// T-212 store-driver contract (41 C; docs/upgrade/70-phase6.md §2.4, §3.5).
// The store cases (cases/*.js) talk to a store only through a handle, so the
// same cases run on the MobX classes and on their zustand ports:
//
//   const h = driverFor('claim').create(...args)
//   h.get(field)          current value ('params.q' reads a param, 'results'
//                         the computed / memoised selector)
//   h.write(field, value) one write as a component does it (a single
//                         notification), plain fields included
//   h.call(method, ...a)  a store method ('params.changeParams' on the params)
//   h.plain(value)        a plain copy for comparisons (toJS on MobX)
//   h.snapshot()          plain copy of every contract field
//   h.observe(fn)         runs fn(t) now and again whenever a reactive field it
//                         read through `t.get` changes (autorun semantics);
//                         returns { values, dispose }
//   h.spy(method)         jest.spyOn on the method the computed calls
//   h.params()            the params object handed to useSyncUrlParamsWithStore
//
// A store has one driver at a time: MobX until its port, zustand after it
// (a MobX store file is deleted by its port, 70 §0 rule 5). The cases hold
// the MobX results as literals, so the port passes the same cases with the
// same results.
const mobx = require('./mobx')
const zustand = require('./zustand')

// fields per store: reactive ones notify, plain ones never do (§2.4 (1))
const SPECS = {
  claim: {
    reactive: ['query', 'request', 'created', 'error', 'isLoading'],
    plain: ['duplicated'],
  },
  report: {
    reactive: [
      'output',
      'updateOption',
      'role',
      'isLoading',
      'error',
      'isModalReportTypeActive',
      'isModalReportFormActive',
      'isModalReportSuccessActive',
    ],
    plain: [],
  },
  similarWorks: {
    reactive: ['error', 'similarOutputs', 'isLoading'],
    plain: [],
  },
  dataProviders: {
    reactive: ['data', 'params.q', 'params.size', 'params.action'],
    computed: ['results'],
    plain: [],
  },
  search: {
    reactive: [
      'works',
      'query',
      'isLoading',
      'dataProviders',
      'sortOptions',
      'activeLimit',
      'activeDownloadModal',
    ],
    plain: [],
  },
  filters: {
    reactive: [
      'data',
      'initialData',
      'activeFilter',
      'activeFilterSuggestions',
      'aggregationsNames',
      'groupedYearDates',
      'isLoading',
      'yearWorksCount',
      'isVisibleClearButton',
    ],
    computed: ['maxYear', 'filterNamesWithoutYear'],
    plain: [],
  },
}

const DRIVERS = [zustand, mobx]

const driverFor = (store) => {
  const driver = DRIVERS.find((d) => d.stores[store])
  if (!driver) throw new Error(`no store driver for ${store}`)
  return {
    name: driver.name,
    spec: SPECS[store],
    create: (...args) => driver.stores[store].create(SPECS[store], ...args),
    of: (instance) => driver.stores[store].of(SPECS[store], instance),
  }
}

module.exports = { driverFor, SPECS }
