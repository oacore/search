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
        el.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        el.normalizedName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        el.urlHomepage?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        el.normalizedInstitutionName
          ?.toLowerCase()
          .includes(searchTerm.toLowerCase()) ||
        el.aliases
          ?.join('|')
          .toLowerCase()
          .includes(searchTerm.toLowerCase()) ||
        el.rorId?.toLowerCase().includes(searchTerm.toLowerCase())
    )
  }
}

export default DataProviders
