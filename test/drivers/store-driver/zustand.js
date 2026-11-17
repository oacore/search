// T-212 zustand driver: the vanilla stores of store/*.ts (see index.js). A
// store joins this file with its port. Plain fields live on the store api,
// reactive ones in its state; `observe` re-runs when a reactive field it read
// changes (Object.is), as a component's selector does.
const split = (field) => (field.startsWith('params.') ? field.slice(7) : null)

const handleOf = (spec, api) => {
  const isPlain = (field) => spec.plain.includes(field)
  const read = (field, state = api.getState()) => {
    if (isPlain(field)) return api[field]
    if (field === 'results') return api.selectResults(state)
    const param = split(field)
    return param ? state.params[param] : state[field]
  }
  const fields = [...spec.reactive, ...(spec.computed || []), ...spec.plain]
  const handle = {
    api,
    get: (field) => read(field),
    write: (field, value) => {
      const param = split(field)
      if (isPlain(field)) api[field] = value
      else if (param) api.params[param] = value
      else api.setState({ [field]: value })
    },
    call: (method, ...args) => {
      if (method === 'params.changeParams')
        return api.params.changeParams(...args)
      if (method === 'search') return api.search(...args)
      return api.getState()[method](...args)
    },
    plain: (value) => value,
    snapshot: () =>
      Object.fromEntries(fields.map((field) => [field, read(field)])),
    observe: (fn) => {
      const values = []
      let deps
      const run = () => {
        deps = new Map()
        const tracking = {
          ...handle,
          get: (field) => {
            const value = read(field)
            if (!isPlain(field)) deps.set(field, value)
            return value
          },
        }
        values.push(fn(tracking))
      }
      run()
      const dispose = api.subscribe((state) => {
        for (const [field, value] of deps) {
          if (!Object.is(read(field, state), value)) {
            run()
            return
          }
        }
      })
      return { values, dispose }
    },
    spy: (method) => jest.spyOn(api, method),
    params: () => api.params,
  }
  return handle
}

const store = (load) => ({
  create: (spec, ...args) => handleOf(spec, load()(...args)),
  of: handleOf,
})

module.exports = {
  name: 'zustand',
  stores: {
    claim: store(() => require('../../../store/claim').createClaimStore),
    report: store(() => require('../../../store/report').createReportStore),
    similarWorks: store(
      () => require('../../../store/similar-works').createSimilarWorksStore
    ),
  },
}
