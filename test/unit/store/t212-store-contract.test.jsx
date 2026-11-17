// T-212 (41 C, R-004, R-011, R-030, R-073): the store-driver contract. The
// store cases of T-203, T-205, T-206, T-207 and T-208 (and the params rows of
// T-107, the Search and Filters rows of T-204, T-201, T-202, T-211) run on
// test/drivers/store-driver. They ran on the MobX classes first and hold
// those results as literals; since CS-ZU-8 every store is a zustand store
// (70 §3.5). The MobX stores reported their writes after `await` outside an
// action with a dev-only console.warn; the zustand stores warn nothing.
const { setupMsw } = require('../../utils/msw')
const { driverFor } = require('../../drivers/store-driver')

const { server, http, HttpResponse } = setupMsw()

const CASES = {
  claim: require('../../drivers/store-driver/cases/claim'),
  report: require('../../drivers/store-driver/cases/report'),
  similarWorks: require('../../drivers/store-driver/cases/similar-works'),
  dataProviders: require('../../drivers/store-driver/cases/data-providers'),
  search: require('../../drivers/store-driver/cases/search'),
  filters: require('../../drivers/store-driver/cases/filters'),
}

describe('T-212 @P0 store-driver contract', () => {
  let warn
  beforeEach(() => {
    warn = jest.spyOn(console, 'warn').mockImplementation(() => {})
  })
  afterEach(() => {
    expect(warn).not.toHaveBeenCalled()
    jest.restoreAllMocks()
  })

  for (const [store, cases] of Object.entries(CASES)) {
    describe(store, () => {
      cases({ driver: driverFor(store), server, http, HttpResponse })
    })
  }
})
