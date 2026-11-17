// A zustand store api read as the MobX instance it replaced, for the store
// tests written against the classes: a property is the current state's
// field or method, a computed comes from the store's `select` functions,
// anything else from the api; an assignment is one setState.
module.exports = (api) =>
  new Proxy(
    {},
    {
      get: (_, prop) => {
        const state = api.getState()
        if (prop in state) return state[prop]
        if (api.select && prop in api.select) return api.select[prop](state)
        return api[prop]
      },
      set: (_, prop, value) => {
        api.setState({ [prop]: value })
        return true
      },
    }
  )
