import { makeObservable, observable, action } from 'mobx'

import Claim from './claim'
import DataProviders from './data-providers'
import Report from './report'

class Root {
  claim = new Claim()

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
