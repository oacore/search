import { observable, action } from 'mobx'

import Params from './params'

import apiRequest from 'api'

export const schema = {
  q: {
    default: '',
    convert: 'string',
    validation: 'string',
  },

  from: {
    default: 0,
    validation: 'number',
    convert: 'number',
  },
  size: {
    default: 10,
    validation: 'number',
    convert: 'number',
  },
}

class DataProvider {
  @observable metadata

  @observable id

  @observable loading = false

  @observable isLoadingMore = false

  @observable params

  @observable outputsData

  @observable outputs

  constructor({ id, outputs, metadata, params = {} }) {
    this.id = id
    this.params = new Params(params, schema)

    if (!outputs) this.loadOutputs()
    else this.outputs = outputs ?? []

    if (!metadata) this.loadMetadata()
    else this.metadata = metadata
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

  static async fetchMetadata({ id }) {
    const { data } = await apiRequest(`/data-providers/${id}`)
    return data
  }

  @action
  loadMetadata = async () => {
    this.metadata = await DataProvider.fetchMetadata({ id: this.id })
  }

  @action
  loadOutputs = async ({ loadMore = false } = {}) => {
    this.loading = true
    this.isLoadingMore = loadMore

    this.outputs = (loadMore ? this.outputs : []).concat(
      await DataProvider.fetchOutputs({
        id: this.id,
        from: loadMore
          ? this.params.from + this.outputs.length
          : this.params.from,
        size: loadMore
          ? this.params.size - this.outputs.length
          : this.params.size,
        q: this.params.q,
      })
    )

    this.loading = false
    this.isLoadingMore = false
  }
}

export default DataProvider
