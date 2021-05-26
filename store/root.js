import { makeObservable, observable, action } from 'mobx'

import Claim from './claim'
import DataProviders from './data-providers'

class Root {
  claim = new Claim()

  dataProviders = null

  statistics

  constructor({ statistics }) {
    makeObservable(this, {
      statistics: observable,
      dataProviders: observable,
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
