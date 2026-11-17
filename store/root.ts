import { createClaimStore } from './claim'
import { createSimilarWorksStore } from './similar-works'
import { createDataProvidersStore } from './data-providers'
import { createReportStore } from './report'
import { createSearchStore } from './search'
import { createFiltersStore } from './filters'

// The root holds one zustand store api per store; statistics, set at
// creation, never changes. Components subscribe to a store's fields with
// zustand's useStore and a selector.
class Root {
  claim = createClaimStore()

  similarWorks = createSimilarWorksStore()

  search = createSearchStore()

  dataProviders: any = null

  report = createReportStore()

  filters = createFiltersStore()

  statistics

  constructor({ statistics, dataProviders }: any) {
    this.statistics = statistics
    // seeded at creation (pages/_app.jsx), so the state a server render and
    // its hydration read is the one the page renders
    this.extend({ dataProviders })
  }

  extend({ dataProviders }: any) {
    if (!this.dataProviders && dataProviders != null)
      this.dataProviders = createDataProvidersStore(dataProviders)
  }
}

export default Root
