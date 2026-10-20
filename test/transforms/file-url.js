// Images imported by app code resolve to a URL string, as next-images emits (never an object).
const path = require('path')

module.exports = {
  process(sourceText, sourcePath) {
    const url = `/_next/static/images/${path.basename(sourcePath)}`
    return { code: `module.exports = ${JSON.stringify(url)};` }
  },
  getCacheKey(sourceText, sourcePath) {
    return `file-url:${path.basename(sourcePath)}`
  },
}
