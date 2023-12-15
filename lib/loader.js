import fs from 'fs'
import path from 'path'

class Loader {
  constructor(url, fileName) {
    this.baseUrl = url
    this.fileName = path.resolve(fileName)
  }

  // eslint-disable-next-line class-methods-use-this
  log(...args) {
    if (process.env.NODE_ENV !== 'production')
      // eslint-disable-next-line no-console
      console.log(...args)
  }

  async fetchData(url) {
    const date = new Date()
    let stats = null
    return new Promise((resolve, reject) => {
      fetch(url)
        .then((res) => {
          if (res.status >= 400) throw new Error('Could not fetch actual data')
          return res
        })
        .then((res) => res.json())
        .then((data) => {
          stats = {
            data,
            timestamp: date.getDate(),
          }
          resolve(stats)
        })
        .catch((error) => {
          this.log(error)
          reject()
        })
    })
  }

  async getData() {
    let cachedData
    try {
      cachedData = JSON.parse(
        fs.readFileSync(path.join(__dirname, this.fileName), 'utf8')
      )
    } catch (error) {
      this.log('data cache not initialized')
    }
    // Fetch data once a day

    const data = await this.fetchData(this.baseUrl)
    try {
      fs.writeFileSync(
        path.join(__dirname, this.fileName),
        JSON.stringify(data),
        'utf8'
      )
      this.log('Wrote to data cache')
    } catch (error) {
      this.log('Error writing data to file')
      this.log(error)
    }

    cachedData = data
    return cachedData
  }
}

export default Loader
