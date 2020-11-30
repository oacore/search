import { observable } from 'mobx'

import Claim from './claim'
import DataProviders from './data-providers'
import DataProvider from './data-provider'
import Article from './article'

class Root {
  claim = new Claim()

  @observable dataProvider = null

  @observable dataProviders = null

  @observable article = null

  @observable statistics

  constructor({ statistics }) {
    this.statistics = statistics
  }

  extend({ dataProviders, dataProvider, article }) {
    if (!this.dataProviders && dataProviders != null)
      this.dataProviders = new DataProviders(dataProviders)

    if (!this.dataProvider && dataProvider != null)
      this.dataProvider = new DataProvider(dataProvider)

    if (!this.article && article != null) this.article = new Article(article)
  }
}

export default Root
