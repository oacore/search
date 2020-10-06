import { observable } from 'mobx'

import Claim from './claim'
import DataProviders from './data-providers'

class Root {
  claim = new Claim()

  @observable dataProviders = null

  @observable statistics

  constructor({ statistics }) {
    this.statistics = statistics
  }

  extend({ dataProviders }) {
    if (!this.dataProviders && dataProviders != null)
      this.dataProviders = new DataProviders(dataProviders)
  }
}

export default Root
