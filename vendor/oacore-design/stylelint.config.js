const { resolve } = require('path')

const basePath = resolve(__dirname, 'node_modules')
const groupSelectors = `${basePath}/@oacore/stylelint-config-base`

module.exports = {
  extends: groupSelectors,
}
