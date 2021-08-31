import { makeObservable, observable, action } from 'mobx'

import Claim from './claim'
import SimilarWorks from './similar-works'
import DataProviders from './data-providers'
import Report from './report'
import Search from './search'

class Root {
  claim = new Claim()

  similarWorks = new SimilarWorks()

  search = new Search()

  dataProviders = null

  report = new Report()

  statistics

  constructor({ statistics }) {
    makeObservable(this, {
      statistics: observable,
      dataProviders: observable,
      claim: observable,
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
