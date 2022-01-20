import { makeObservable, observable, computed } from 'mobx'

import Params from './params'

export const schema = {
  q: {
    default: '',
    convert: 'string',
    validation: 'string',
  },
  size: {
    default: 10,
    validation: 'number',
    convert: 'number',
  },
  action: {
    default: null,
    validation: ['ADD', null],
  },
}

class DataProviders {
  data

  params

  get results() {
    return this.search(this.params.q)
  }

  constructor({ data, params = {} }) {
    makeObservable(this, {
      data: observable,
      results: computed,
    })

    this.data = data ?? []
    this.params = new Params(params, schema)
  }

  search(searchTerm) {
    return this.data.filter(
      (el) =>
        el.name?.toLowerCase().search(searchTerm.toLowerCase()) !== -1 ||
        el.normalizedName.toLowerCase().search(searchTerm.toLowerCase()) !== -1
    )
  }
}

export default DataProviders
