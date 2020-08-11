const helpers = (path = '/', target = process.env.BUILD_TARGET || '') =>
  target === 'aws' ? `/data-providers${path}` : path

module.exports = { getAssetsPath: helpers }
