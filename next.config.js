const path = require('path')

const withImages = require('next-images')
const withSourceMaps = require('@zeit/next-source-maps')

const envConfig = require('./env.config')
const cspConfig = require('./csp.config')
const helpers = require('./utils/helpers')

const nextConfig = {
  trailingSlash: true,
  env: envConfig,
  assetPrefix: helpers.getAssetsPath(''),

  async rewrites() {
    const dataPath = helpers.rewriteDataPath()
    return [
      {
        source: dataPath.source,
        destination: dataPath.destination,
      },
      {
        source: `/static/:path*`,
        destination: '/:path*',
      },
    ]
  },
  async headers() {
    return [
      {
        source: '/:path(.*)',
        headers: [{ key: 'Content-Security-Policy', value: cspConfig }],
      },
    ]
  },

  webpack(config, { isServer }) {
    const { rules } = config.module
    if (!isServer) {
      config.node = {
        fs: 'empty',
      }
    }

    // TODO: Remove once https://github.com/zeit/next.js/issues/10584 is solved and released
    // CSS modules also export every class under its camelCase name
    // (css-loader `exportLocalsConvention`). Visit every rule, nested `oneOf`
    // and `rules` lists included, and patch each css-loader with `modules`
    // options in a rule whose RegExp `test` accepts 'file.module.css'. Rules
    // with any other `test` (a string path, a function, none) are skipped. The
    // build stops when nothing was patched, since the pages would otherwise
    // lose most of their class names.
    let cssModuleLoaders = 0
    const patchCssModuleRule = (rule) => {
      if (!rule || typeof rule !== 'object') return
      const nested = [...(rule.oneOf || []), ...(rule.rules || [])]
      nested.forEach(patchCssModuleRule)
      const tests = Array.isArray(rule.test) ? rule.test : [rule.test]
      const isCssModuleRule = tests.some(
        (test) => test instanceof RegExp && test.test('file.module.css')
      )
      if (!isCssModuleRule || !Array.isArray(rule.use)) return
      rule.use.forEach((use) => {
        if (
          use &&
          typeof use.loader === 'string' &&
          /[\\/]css-loader[\\/]/.test(use.loader) &&
          use.options &&
          use.options.modules
        ) {
          use.options.modules.exportLocalsConvention = 'camelCase'
          cssModuleLoaders += 1
        }
      })
    }
    rules.forEach(patchCssModuleRule)
    if (cssModuleLoaders === 0)
      throw new Error('The camelCase CSS-module patch matched no css-loader')

    // TODO: Enable 3th party source maps once we use Sentry
    // config.module.rules.push({
    //   test: /\.js$/,
    //   use: ['source-map-loader'],
    //   enforce: 'pre',
    // })

    Object.assign(config.resolve.alias, {
      'api': path.join(__dirname, 'api'),
      'data': path.join(__dirname, 'data'),
      'main': path.join(__dirname, 'main'),
      'hooks': path.join(__dirname, 'hooks'),
      'config': path.join(__dirname, 'config.js'),
      'store': path.join(__dirname, 'store'),
      'utils': path.join(__dirname, 'utils'),
      'templates': path.join(__dirname, 'templates'),
      'modules': path.join(__dirname, 'modules'),
      'lib': path.join(__dirname, 'lib'),
      '@sentry/node': config.isServer ? '@sentry/node' : '@sentry/browser',
      'react': path.join(__dirname, 'node_modules', 'react'),
      'react-dom': path.join(__dirname, 'node_modules', 'react-dom'),
    })

    return config
  },
}

module.exports = withImages(withSourceMaps(nextConfig))
