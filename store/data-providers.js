import { observable, computed } from 'mobx'

import Params from './params'

const schema = {
  query: {
    default: '',
    convert: (value) => value.toString(),
  },
  size: {
    default: 10,
    validation: 'number',
    convert: (value) => Number(value),
  },
  action: {
    default: null,
    validation: (value) => ['ADD', null].includes(value),
  },
}

class DataProviders {
  @observable data

  @observable params

  @computed
  get results() {
    return this.search(this.params.query)
  }

  constructor({ data, params = {} }) {
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
