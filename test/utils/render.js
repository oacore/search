// The only RTL importer (40 §2.1). Queries, events and waits come from
// @testing-library/dom 10; RTL 12 (React 17) only mounts. dom 10 is configured
// to wrap events and async utilities in React 17 act, because RTL 12 does not
// act-wrap dom-10 events (review:test-strategy.verdicts TS-08). The RTL 16 swap
// (W6a, CS-R18-5) edits only this file.
const React = require('react')
const { act } = require('react-dom/test-utils')
const dom = require('@testing-library/dom')
const rtl = require('@testing-library/react')
const userEventModule = require('@testing-library/user-event')
const { RouterContext } = require('next/dist/shared/lib/router-context')

const { router: mockRouter } = require('../mocks/next-router')

dom.configure({
  eventWrapper: (cb) => {
    let result
    act(() => {
      result = cb()
    })
    return result
  },
  asyncWrapper: async (cb) => {
    let result
    await act(async () => {
      result = await cb()
    })
    return result
  },
})

const userEvent = userEventModule.default || userEventModule

// compose wrapper components: wrap(A, B) renders <A><B>{children}</B></A>
const composeWrappers = (wrappers) => {
  const list = wrappers.filter(Boolean)
  if (!list.length) return undefined
  return ({ children }) =>
    list.reduceRight((acc, W) => React.createElement(W, null, acc), children)
}

const render = (ui, { wrapper, wrappers = [], ...options } = {}) => {
  const result = rtl.render(ui, {
    ...options,
    wrapper: composeWrappers([...wrappers, wrapper]),
  })
  return { ...result, ...dom.getQueriesForElement(result.baseElement) }
}

// RouterContext provider for components that read the router through next/link
// or next/dist internals
const withRouter = (router = mockRouter) => {
  const WithRouter = ({ children }) =>
    React.createElement(RouterContext.Provider, { value: router }, children)
  return WithRouter
}

// the app's StoreProvider around a given RootStore instance (store/index.jsx)
const withStore = (store) => {
  const { StoreProvider } = require('../../store')
  const WithStore = ({ children }) =>
    React.createElement(StoreProvider, { store }, children)
  return WithStore
}

// local renderHook (RTL 12 has none)
const renderHook = (hook, { initialProps, wrapper, wrappers = [] } = {}) => {
  const result = { current: undefined, all: [] }
  const Probe = ({ hookProps }) => {
    const value = hook(hookProps)
    result.current = value
    result.all.push(value)
    return null
  }
  const view = render(React.createElement(Probe, { hookProps: initialProps }), {
    wrapper,
    wrappers,
  })
  return {
    result,
    rerender: (props) =>
      view.rerender(React.createElement(Probe, { hookProps: props })),
    unmount: view.unmount,
  }
}

module.exports = {
  render,
  renderHook,
  withRouter,
  withStore,
  act,
  cleanup: rtl.cleanup,
  screen: dom.screen,
  within: dom.within,
  waitFor: dom.waitFor,
  waitForElementToBeRemoved: dom.waitForElementToBeRemoved,
  fireEvent: dom.fireEvent,
  prettyDOM: dom.prettyDOM,
  userEvent,
}
