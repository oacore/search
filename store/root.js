import { observable } from 'mobx'

import Claim from './claim'
import DataProviders from './data-providers'
import DataProvider from './data-provider'

class Root {
  claim = new Claim()

  @observable dataProvider = null

  @observable dataProviders = null

  @observable statistics

  constructor({ statistics }) {
    this.statistics = statistics
  }

  extend({ dataProviders, dataProvider }) {
    if (!this.dataProviders && dataProviders != null)
      this.dataProviders = new DataProviders(dataProviders)

    if (!this.dataProvider && dataProvider != null)
      this.dataProvider = new DataProvider(dataProvider)
  }
}

export default Root
