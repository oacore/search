import { observable } from 'mobx'

import apiRequest from 'api'

class DataProvider {
  @observable outputs

  @observable page

  @observable metadata

  constructor({ outputs, metadata, page }) {
    this.outputs = outputs ?? []
    this.metadata = metadata ?? []
    this.page = page
  }

  static async loadOutputs({ id, page = 1 }) {
    const params = {
      from: (page - 1) * 20,
      size: 20,
    }

    const { data } = await apiRequest(`/data-providers/${id}/works`, {
      searchParams: params,
    })
    return data
  }

  static async loadMetadata({ id }) {
    const { data } = await apiRequest(`/data-providers/${id}`)
    return data
  }
}

export default DataProvider
