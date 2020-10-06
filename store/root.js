import { observable } from 'mobx'

import Claim from './claim'
import DataProviders from './data-providers'

class Root {
  claim = new Claim()

  @observable dataProviders = null

  @observable statistics

  init({ dataProviders = {}, statistics = {} } = {}) {
    this.dataProviders = new DataProviders(dataProviders)
    this.statistics = statistics
  }
}

export default Root
