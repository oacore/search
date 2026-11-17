import { makeObservable, observable, action } from 'mobx'

import { createClaimStore } from './claim'
import { createSimilarWorksStore } from './similar-works'
import DataProviders from './data-providers'
import { createReportStore } from './report'
import Search from './search'
import Filters from './filters'

class Root {
  // a zustand store api, a plain field until CS-ZU-7
  claim = createClaimStore()

  // a zustand store api, a plain field until CS-ZU-7
  similarWorks = createSimilarWorksStore()

  search = new Search()

  dataProviders = null

  // a zustand store api, a plain field until CS-ZU-7
  report = createReportStore()

  filters = new Filters()

  statistics

  constructor({ statistics }) {
    makeObservable(this, {
      statistics: observable,
      dataProviders: observable,
      filters: observable,
      extend: action,
    })

    this.statistics = statistics
  }

  extend({ dataProviders }) {
    if (!this.dataProviders && dataProviders != null)
      this.dataProviders = new DataProviders(dataProviders)
  }
}

export default Root
