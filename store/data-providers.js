import { observable, computed } from 'mobx'

class DataProviders {
  @observable query

  @observable size = 10

  @observable action

  @observable data

  @computed
  get results() {
    return this.search(this.query)
  }

  constructor({ query, size, action, data }) {
    this.query = query ?? ''
    this.action = action
    this.size = Number(size) || 10
    this.data = data ?? []
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
