import { computed, observable, action } from 'mobx'

class DataProvider {
  @observable query = ''

  @observable request = null

  @observable created = null

  @observable duplicated = []

  @observable error = null

  @computed
  get isLoading() {
    return this.request !== null
  }

  @action
  retrieve() {
    if (this.query === '') return
    this.reset()
    clearTimeout(this.request)
    this.request = setTimeout(() => {
      if (this.query === 'https://success.url')
        this.created = { url: this.query }
      else if (this.query === 'https://duplicate.url')
        this.duplicated = [{ url: this.query }]
      else if (this.query === 'https://multiple-duplicates.url')
        this.duplicated = [{ url: this.query }, { url: this.query }]
      else this.error = true

      this.request = null
    }, 1000)
  }

  @action reset() {
    this.request = null
    this.created = null
    this.duplicated = []
    this.error = null
  }
}

export default DataProvider
