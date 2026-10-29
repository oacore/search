const path = require('path')

const withImages = require('next-images')

const envConfig = require('./env.config')
const cspConfig = require('./csp.config')
const helpers = require('./utils/helpers')

const nextConfig = {
  trailingSlash: true,
  env: envConfig,
  assetPrefix: helpers.getAssetsPath(''),
  // `next build` lints from Next 11 on; linting stays in the lint script
  eslint: { ignoreDuringBuilds: true },
  // image imports stay URL strings of next-images (withImages below); Next's
  // own static image imports (from Next 11 on) would turn them into objects
  images: { disableStaticImages: true },
  // public client source maps under /_next/static, as the next-source-maps
  // wrapper gave them before (OD-42)
  productionBrowserSourceMaps: true,

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

  webpack(config, { isServer, dev, defaultLoaders }) {
    const { rules } = config.module
    // `fs` resolves to an empty module in the client bundle (lib/loader.js
    // imports it; its cache reads and writes are caught there)
    if (!isServer)
      config.resolve.fallback = { ...config.resolve.fallback, fs: false }

    // The server maps the next-source-maps wrapper wrote: it set this devtool
    // for both compilations, productionBrowserSourceMaps covers the client
    // only. They are not served.
    if (isServer && !dev) config.devtool = 'source-map'

    // The vendored bibtexParse.js stays untransformed, as the node_modules
    // copy was (CS-BIB-1, R-075). Next 12's Babel loader resolves one config
    // per kind of file and reuses it, so the `ignore` of babel.config.js no
    // longer reaches that file, and the injected core-js imports would turn it
    // into an ES module without exports. Every rule that runs Next's Babel
    // loader excludes the vendored directory; the build stops when there is
    // none.
    const bibtexDir = path.join(__dirname, 'vendor', 'bibtex-parse-js')
    const babelLoader = defaultLoaders.babel.loader
    let babelRules = 0
    const excludeBibtex = (rule) => {
      if (!rule || typeof rule !== 'object') return
      const nested = [...(rule.oneOf || []), ...(rule.rules || [])]
      nested.forEach(excludeBibtex)
      const uses = Array.isArray(rule.use) ? rule.use : [rule.use]
      if (!uses.some((use) => use && use.loader === babelLoader)) return
      rule.exclude = rule.exclude ? [rule.exclude, bibtexDir] : bibtexDir
      babelRules += 1
    }
    rules.forEach(excludeBibtex)
    if (babelRules === 0)
      throw new Error('No rule runs the Babel loader that bibtexParse.js skips')

    // @sentry/browser 7 and the @sentry/core and @sentry/utils modules it
    // brings ship ES2018 syntax (object spread), and Next 10 compiles no
    // node_modules code but its own, so the client _app chunk would need
    // ES2018. The client compilation compiles them to the syntax of the app's
    // own code (.browserslistrc): syntax only, no polyfill, no helper import,
    // ES modules kept for tree shaking. The server keeps @sentry/node as an
    // external require.
    if (!isServer) {
      rules.push({
        test: /\.m?js$/,
        include: /[\\/]node_modules[\\/]@sentry[\\/]/,
        use: {
          loader: path.join(__dirname, 'babel-syntax-loader.js'),
          options: {
            // loaded here, not at the top of the file: `next start` reads
            // this file too and never compiles, so the server process does
            // not load Babel
            babel: module.require('@babel/core'),
            cwd: __dirname,
            browserslistConfigFile: path.join(__dirname, '.browserslistrc'),
            presets: [
              ['@babel/preset-env', { modules: false, useBuiltIns: false }],
            ],
          },
        },
      })
    }

    // logrocket 12 (171 KB of source) is larger than the 160 KB from which
    // Next moves a node_modules module into a chunk of its own (the `lib`
    // split chunk), which would add one more script to every page. Keep the
    // SDK out of that chunk, so it stays in the shared chunk it was in before.
    if (!isServer && !dev) {
      const { lib } = config.optimization.splitChunks.cacheGroups
      if (!lib || typeof lib.test !== 'function')
        throw new Error('The client build has no lib split chunk to patch')
      const { test } = lib
      lib.test = (mod) =>
        test(mod) &&
        !/[\\/]node_modules[\\/]logrocket[\\/]/.test(mod.nameForCondition())
    }

    // The production CSS keeps the output of Next 10.2.3's minifier,
    // cssnano-simple 2.0.0, until step 6.9 (OD-37 A). Next 12's own minifier
    // keeps the source order of the heading declarations that 2.0.0 merged
    // after the h2 and h4 rules of the design's type.css, so the headings
    // would take other line-heights and every page below them would move.
    // Next's CSS minimizer plugin stays as it is (stage, cache, map options);
    // only its PostCSS run is the one of 10.2.3. The build stops when there
    // is no CSS minimizer to replace.
    if (!isServer && !dev) {
      const { minimizer } = config.optimization
      const isCssMinimizer = (entry) =>
        typeof entry === 'function' &&
        String(entry).includes('CssMinimizerPlugin')
      const cssMinimizerAt = minimizer.findIndex(isCssMinimizer)
      if (cssMinimizerAt < 0 || minimizer.filter(isCssMinimizer).length > 1)
        throw new Error('The client build has no CSS minimizer to replace')
      minimizer[cssMinimizerAt] = (compiler) => {
        const fromNext = (request) =>
          module.require(
            require.resolve(request, {
              paths: [path.dirname(require.resolve('next/package.json'))],
            })
          )
        const { CssMinimizerPlugin } = fromNext(
          'next/dist/build/webpack/plugins/css-minimizer-plugin'
        )
        const postcss = fromNext('postcss')
        const postcssScss = fromNext('next/dist/compiled/postcss-scss')
        const cssnanoSimple = module.require('cssnano-simple')
        const { SourceMapSource, RawSource } = compiler.webpack.sources
        class Minimizer extends CssMinimizerPlugin {
          optimizeAsset(file, asset) {
            const postcssOptions = {
              ...this.options.postcssOptions,
              to: file,
              from: file,
              parser: postcssScss,
            }
            let input
            if (postcssOptions.map && asset.sourceAndMap) {
              const { source, map } = asset.sourceAndMap()
              input = source
              postcssOptions.map.prev = map || false
            } else input = asset.source()
            return postcss([cssnanoSimple])
              .process(input, postcssOptions)
              .then((res) =>
                res.map
                  ? new SourceMapSource(res.css, file, res.map.toJSON())
                  : new RawSource(res.css)
              )
          }
        }
        new Minimizer({
          postcssOptions: { map: { inline: false, annotation: false } },
        }).apply(compiler)
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
      '@sentry/node': isServer ? '@sentry/node' : '@sentry/browser',
      'react': path.join(__dirname, 'node_modules', 'react'),
      'react-dom': path.join(__dirname, 'node_modules', 'react-dom'),
    })

    return config
  },
}

module.exports = withImages(nextConfig)
