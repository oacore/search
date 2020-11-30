import { extendObservable } from 'mobx'

import apiRequest from '../api'

class Article {
  constructor(metadata) {
    extendObservable(this, metadata)
  }

  static async fetchMetadata({ id }) {
    const { data } = await apiRequest(`/articles/${id}`)
    return data
  }
}

export default Article
