// T-417: run a function against a fresh module registry (P0-07). Every unit
// census loads React, the testing helpers, the census engine and the
// implementation anew, so module-level counters of the implementation (for
// example Tippy's `tippy-<n>` ids) start from the same value whatever ran
// before in the file or which tests were selected.
//
// @testing-library/react and user-event register afterEach/afterAll hooks when
// they are first required; inside a running test Jest rejects that, so the
// registration is skipped for the fresh copies (the census unmounts and
// cleans up itself after every observation).
const fresh = async (fn) => {
  let result
  await jest.isolateModulesAsync(async () => {
    const saved = { afterEach: global.afterEach, afterAll: global.afterAll }
    let modules
    global.afterEach = () => {}
    global.afterAll = () => {}
    try {
      const census = require('./census')
      const units = require('./units')
      const { loadImpl, implName } = require('./impl')
      modules = { census, units, impl: loadImpl(implName()) }
    } finally {
      global.afterEach = saved.afterEach
      global.afterAll = saved.afterAll
    }
    modules.census.fakeTimers()
    try {
      result = await fn(modules)
    } finally {
      modules.census.resetEnvironment()
    }
  })
  return result
}

module.exports = { fresh }
