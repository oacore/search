import fs from 'fs'
import path from 'path'

// Hard cap on how long an SSR render will wait for the internal API.
// Without this, a slow/ratelimited api.core.ac.uk makes _app.getInitialProps
// hang forever, which wedges the whole Node event loop under load.
const FETCH_TIMEOUT_MS = 3000

class Loader {
  constructor(url, fileName) {
    this.baseUrl = url
    // path.resolve already yields an absolute path against process.cwd() (/app).
    this.fileName = path.resolve(fileName)
  }

  // eslint-disable-next-line class-methods-use-this
  log(...args) {
    if (process.env.NODE_ENV !== 'production')
      // eslint-disable-next-line no-console
      console.log(...args)
  }

  async fetchData(url) {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)
    try {
      const res = await fetch(url, { signal: controller.signal })
      if (res.status >= 400) throw new Error(`Bad status ${res.status}`)
      const data = await res.json()
      return { data, timestamp: new Date().getDate() }
    } finally {
      clearTimeout(timer)
    }
  }

  readCache() {
    try {
      // this.fileName is already absolute — do NOT join with __dirname.
      return JSON.parse(fs.readFileSync(this.fileName, 'utf8'))
    } catch (error) {
      this.log('data cache not initialized', error.message)
      return null
    }
  }

  writeCache(data) {
    try {
      fs.writeFileSync(this.fileName, JSON.stringify(data), 'utf8')
      this.log('Wrote to data cache')
    } catch (error) {
      this.log('Error writing data to file', error.message)
    }
  }

  async getData() {
    // 1. Serve from committed/warm cache if present — fast, never blocks.
    const cached = this.readCache()
    if (cached) return cached

    // 2. No cache — fetch live, bounded by timeout. On any failure
    //    (timeout, network, bad status) return null so SSR still renders.
    try {
      const data = await this.fetchData(this.baseUrl)
      this.writeCache(data)
      return data
    } catch (error) {
      this.log('live fetch failed, rendering without it', error.message)
      return null
    }
  }
}

export default Loader
