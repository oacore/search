import { observable } from 'mobx'

import Claim from './claim'
import DataProviders from './data-providers'
import DataProvider from './data-provider'

class Root {
  claim = new Claim()

  @observable dataProvider = null

  @observable dataProviders = null

  @observable statistics

  init({ dataProviders = {}, statistics = {}, dataProvider = {} } = {}) {
    this.dataProviders = new DataProviders(dataProviders)
    this.dataProvider = new DataProvider(dataProvider)
    this.statistics = statistics
  }
}

export default Root
