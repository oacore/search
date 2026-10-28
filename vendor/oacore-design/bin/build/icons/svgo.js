const SVGO = require('svgo')

const processOptions = (options = {}) => {
  const plugins = Object.entries(options.plugins).map(([name, flag]) => ({
    [name]: flag,
  }))
  return { ...options, plugins }
}

const MySVGO = function MySVGO(options) {
  SVGO.call(this, processOptions(options))
}

MySVGO.prototype = Object.create(SVGO.prototype)
MySVGO.prototype.constructor = MySVGO

MySVGO.Config = (options) => SVGO.Config(processOptions(options))

module.exports = MySVGO
