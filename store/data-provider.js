import { observable, action } from 'mobx'

import apiRequest from 'api'

class DataProvider {
  @observable outputs

  @observable metadata

  @observable id

  @observable query

  @observable from

  @observable size

  @observable loading = false

  constructor({ id, q, from, size, outputs, metadata }) {
    this.id = id
    this.from = from ?? 0
    this.size = size ?? 10
    this.query = q
    this.outputs = outputs ?? []
    this.metadata = metadata ?? []
  }

  static async fetchOutputs({ id, from, size, q, ...restParams }) {
    const params = {
      from,
      size,
      q,
      ...restParams,
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

  @action
  loadOutputs = async () => {
    // show loading placeholders only when search takes more than 500ms
    const timeout = setTimeout(() => {
      this.loading = true
    }, 500)
    this.loading = true
    this.outputs = await DataProvider.fetchOutputs({
      id: this.id,
      from: this.from,
      size: this.size,
      q: this.query,
    })
    clearTimeout(timeout)
    this.loading = false
  }

  @action
  loadSuggestions = async (searchTerm) =>
    DataProvider.fetchOutputs({ id: this.id, q: searchTerm, from: 0, size: 10 })
}

export default DataProvider
