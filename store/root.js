import { makeObservable, observable, action } from 'mobx'

import { createClaimStore } from './claim'
import { createSimilarWorksStore } from './similar-works'
import { createDataProvidersStore } from './data-providers'
import { createReportStore } from './report'
import { createSearchStore } from './search'
import Filters from './filters'

class Root {
  // a zustand store api, a plain field until CS-ZU-7
  claim = createClaimStore()

  // a zustand store api, a plain field until CS-ZU-7
  similarWorks = createSimilarWorksStore()

  // a zustand store api, a plain field until CS-ZU-7
  search = createSearchStore()

  // a zustand store api, a plain field until CS-ZU-7
  dataProviders = null

  // a zustand store api, a plain field until CS-ZU-7
  report = createReportStore()

  filters = new Filters()

  statistics

  constructor({ statistics, dataProviders }) {
    makeObservable(this, {
      statistics: observable,
      filters: observable,
      extend: action,
    })

    this.statistics = statistics
    // seeded at creation (pages/_app.jsx), so the state a server render and
    // its hydration read is the one the page renders
    this.extend({ dataProviders })
  }

  extend({ dataProviders }) {
    if (!this.dataProviders && dataProviders != null)
      this.dataProviders = createDataProvidersStore(dataProviders)
  }
}

export default Root
