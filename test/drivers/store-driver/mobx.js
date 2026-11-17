// T-212 MobX driver: the store classes of store/*.js (see index.js). A store
// leaves this file when its port deletes the class.
const { autorun, runInAction, toJS } = require('mobx')

const split = (field) => (field.startsWith('params.') ? field.slice(7) : null)

const handleOf = (spec, instance) => {
  const fields = [...spec.reactive, ...(spec.computed || []), ...spec.plain]
  const handle = {
    instance,
    get: (field) => {
      const param = split(field)
      return param ? instance.params[param] : instance[field]
    },
    write: (field, value) =>
      runInAction(() => {
        const param = split(field)
        if (param) instance.params[param] = value
        else instance[field] = value
      }),
    call: (method, ...args) =>
      method === 'params.changeParams'
        ? instance.params.changeParams(...args)
        : instance[method](...args),
    plain: (value) => toJS(value),
    snapshot: () =>
      Object.fromEntries(
        fields.map((field) => [field, toJS(handle.get(field))])
      ),
    observe: (fn) => {
      const values = []
      const dispose = autorun(() => {
        values.push(fn(handle))
      })
      return { values, dispose }
    },
    spy: (method) => jest.spyOn(instance, method),
    params: () => instance.params,
  }
  return handle
}

// eslint-disable-next-line no-unused-vars -- the filters and search stores join
const store = (load) => ({
  create: (spec, ...args) => handleOf(spec, new (load())(...args)),
  of: handleOf,
})

module.exports = {
  name: 'mobx',
  stores: {},
}
