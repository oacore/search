const path = require('path')

const withImages = require('next-images')
const withSourceMaps = require('@zeit/next-source-maps')
const frontmatter = require('remark-frontmatter')
const withMDX = require('@next/mdx')({
  extension: /\.mdx?$/,
  options: {
    remarkPlugins: [frontmatter],
  },
})

const envConfig = require('./config')

const nextConfig = {
  env: envConfig,

  webpack(config) {
    const { rules } = config.module

    // TODO: Remove once https://github.com/zeit/next.js/issues/10584 is solved and released
    // Find the array of "style rules" in the webpack config.
    // This is the array of webpack rules that:
    // - is inside a 'oneOf' block
    // - contains a rule that matches 'file.css'
    const styleRules = (
      rules.find(
        (m) => m.oneOf && m.oneOf.find(({ test: reg }) => reg.test('file.css'))
      ) || {}
    ).oneOf
    if (!styleRules) return config
    // Find all the webpack rules that handle CSS modules
    // Look for rules that match '.module.css'
    // but aren't being used to generate
    // error messages.
    const cssModuleRules = [
      styleRules.find(
        ({ test: reg, use }) =>
          reg.test('file.module.css') && use.loader !== 'error-loader'
      ),
    ].filter((n) => n) // remove 'undefined' values
    // Add the 'localsConvention' config option to the CSS loader config
    // in each of these rules.
    cssModuleRules.forEach((cmr) => {
      // Find the item inside the 'use' list that defines css-loader
      const cssLoaderConfig = cmr.use.find(({ loader }) =>
        loader.includes('css-loader')
      )
      if (cssLoaderConfig && cssLoaderConfig.options) {
        // Patch it with the new config
        cssLoaderConfig.options.localsConvention = 'camelCase'
      }
    })

    // TODO: Enable 3th party source maps once we use Sentry
    // config.module.rules.push({
    //   test: /\.js$/,
    //   use: ['source-map-loader'],
    //   enforce: 'pre',
    // })

    Object.assign(config.resolve.alias, {
      'api': path.join(__dirname, 'api'),
      'main': path.join(__dirname, 'main'),
      'hooks': path.join(__dirname, 'hooks'),
      'config': path.join(__dirname, 'config.js'),
      'store': path.join(__dirname, 'store'),
      'utils': path.join(__dirname, 'utils'),
      'texts': path.join(__dirname, 'texts'),
      'templates': path.join(__dirname, 'templates'),
      'modules': path.join(__dirname, 'modules'),
      '@sentry/node': config.isServer ? '@sentry/node' : '@sentry/browser',

      'react': path.join(__dirname, 'node_modules', 'react'),
      'react-dom': path.join(__dirname, 'node_modules', 'react-dom'),
    })

    return config
  },
}

module.exports = withMDX(withSourceMaps(withImages(nextConfig)))
