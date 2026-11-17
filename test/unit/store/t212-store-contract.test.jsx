// T-212 (41 C, R-004, R-011, R-030, R-073): the store-driver contract. The
// store cases of T-203, T-205, T-206, T-207 and T-208 (and the params rows of
// T-107) run on test/drivers/store-driver: on the MobX class until a store is
// ported, on its zustand store after (70 §3.5), with the same literals. The
// MobX stores write after `await` outside an action, which MobX reports with
// a dev-only console.warn (the production build prints nothing); those
// warnings, and only those, are allowed here.
const { setupMsw } = require('../../utils/msw')
const { driverFor } = require('../../drivers/store-driver')

const { server, http, HttpResponse } = setupMsw()

const CASES = {
  claim: require('../../drivers/store-driver/cases/claim'),
  report: require('../../drivers/store-driver/cases/report'),
  similarWorks: require('../../drivers/store-driver/cases/similar-works'),
  dataProviders: require('../../drivers/store-driver/cases/data-providers'),
}

const MOBX_STRICT =
  /^\[MobX\] Since strict-mode is enabled, changing \(observed\) observable values without using an action is not allowed\. Tried to modify: /

describe('T-212 @P0 store-driver contract', () => {
  let warn
  beforeEach(() => {
    warn = jest.spyOn(console, 'warn').mockImplementation(() => {})
  })
  afterEach(() => {
    for (const [message] of warn.mock.calls)
      expect(message).toMatch(MOBX_STRICT)
    jest.restoreAllMocks()
  })

  for (const [store, cases] of Object.entries(CASES)) {
    describe(store, () => {
      cases({ driver: driverFor(store), server, http, HttpResponse })
    })
  }
})
