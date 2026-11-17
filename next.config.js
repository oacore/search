const path = require('path')

const withImages = require('next-images')
const { withSentryConfig } = require('@sentry/nextjs/config')

const envConfig = require('./env.config')
const cspConfig = require('./csp.config')
const helpers = require('./utils/helpers')

const nextConfig = {
  trailingSlash: true,
  env: envConfig,
  assetPrefix: helpers.getAssetsPath(''),
  // image imports stay URL strings of next-images (withImages below); Next's
  // own static image imports (from Next 11 on) would turn them into objects
  images: { disableStaticImages: true },
  // public client source maps under /_next/static, as the next-source-maps
  // wrapper gave them before (OD-42)
  productionBrowserSourceMaps: true,
  // From Next 12.2 the server logs each page whose data is over 128 kB, with
  // its path and query string; 0 skips that check, so the log stays as on
  // 10.2.3 (CS-N12-14)
  // From Next 13 the server code is minified too
  // (experimental.serverMinification); false keeps it as 12.3.7 built it, so
  // server stack traces keep the app's names (CS-N13-9)
  // SWC compiles the app (CS-SWC-1): the client keeps the usage-based core-js
  // 3 polyfills the Babel config injected (`useBuiltIns: 'usage'`,
  // `corejs: 3`) for the .browserslistrc engines (CS-BAB-5)
  experimental: {
    largePageDataBytes: 0,
    serverMinification: false,
    swcEnvOptions: { mode: 'usage', coreJs: '3' },
  },

  // The page data of client navigations is fetched from /search/_next/data
  // (pages/_app.jsx, useInterceptNextDataHref). From Next 12.2 a rewrite
  // after the pages no longer reaches that path, so the data rule is checked
  // before the pages; the other rewrites stay after them.
  async rewrites() {
    const dataPath = helpers.rewriteDataPath()
    return {
      beforeFiles: [
        {
          source: dataPath.source,
          destination: dataPath.destination,
        },
      ],
      afterFiles: [
        {
          source: `/static/:path*`,
          destination: '/:path*',
        },
      ],
    }
  },
  async headers() {
    return [
      {
        source: '/:path(.*)',
        headers: [{ key: 'Content-Security-Policy', value: cspConfig }],
      },
      // Next 14 answers this getInitialProps page with no-store, and Chromium
      // then loads it again on Back after a site cookie changed; this value
      // leaves no-store out, so the page is restored as on Next 13.5 (CS-N14-3)
      {
        source: '/outputs/update/',
        headers: [
          {
            key: 'Cache-Control',
            value: 'private, no-cache, max-age=0, must-revalidate',
          },
        ],
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

    // @sentry/nextjs's browser build and the @sentry modules it brings ship
    // ES2018+ syntax
    // (object spread, optional chaining), react-ga4 3 ships ES2022
    // (class fields), and Next compiles no node_modules code but its own, so
    // the client _app chunk would need ES2022. The client compilation compiles
    // them to the syntax of the app's own code (.browserslistrc): syntax only,
    // no polyfill, no helper import, ES modules kept for tree shaking. The
    // server keeps @sentry/nextjs as an external require and react-ga4 as
    // Next's external import.
    // Next 14's client main chunk also takes next/dist/lib/constants.js, which
    // Next ships as it is, with one object spread (ES2018); the rule compiles
    // that one file too, so the client floor stays ES2015 (CS-N14-2).
    // Next 15/16's main chunk adds next/dist/lib/route-pattern-normalizer.js,
    // also with an object spread (RC-1).
    // axios (api/http.ts, CS-AX-1) ships ES2018+ in its browser build.
    if (!isServer) {
      rules.push({
        test: /\.m?js$/,
        include: [
          /[\\/]node_modules[\\/]@sentry[\\/]/,
          /[\\/]node_modules[\\/]react-ga4[\\/]/,
          /[\\/]node_modules[\\/]axios[\\/]/,
          /[\\/]node_modules[\\/]next[\\/]dist[\\/]lib[\\/]constants\.js$/,
          /[\\/]node_modules[\\/]next[\\/]dist[\\/]lib[\\/]route-pattern-normalizer\.js$/,
        ],
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
      'react': path.join(__dirname, 'node_modules', 'react'),
      'react-dom': path.join(__dirname, 'node_modules', 'react-dom'),
    })

    return config
  },
}

// next-images always sets serverRuntimeConfig (undefined without
// dynamicAssetPrefix, which the app does not use); Next 16 has no runtime
// config and warns about the key, so the empty key is dropped (CS-N16-6)
const { serverRuntimeConfig, ...config } = withImages(nextConfig)
if (serverRuntimeConfig !== undefined)
  throw new Error('next-images set serverRuntimeConfig, which Next 16 ignores')

// @sentry/nextjs (CS-SEN-2): the SDK is set up in instrumentation.ts and
// instrumentation-client.ts. The build uploads and deletes no source maps,
// creates and injects no release, wraps no data-fetching function, adds no
// build-time instrumentation, route manifest or tunnel route and sends no
// telemetry. withSentryConfig also adds its build values to `env` and trace
// meta tags to `experimental.clientTraceMetadata`; both stay as the app had
// them, so the inlined variables and the page head do not change. The
// server requires the installed SDK, in instrumentation.ts as in the pages,
// so it runs as one copy, as @sentry/node did. The browser SDK leaves out its
// tracing code (`__SENTRY_TRACING__` false): the app samples no spans, and
// without the flag @sentry/nextjs adds browser tracing (web-vitals, ES2022)
// to the defaults, which the integration filter drops anyway.
const sentryConfig = withSentryConfig(
  {
    ...config,
    env: { ...config.env },
    experimental: { ...config.experimental },
    serverExternalPackages: ['@sentry/nextjs'],
  },
  {
    silent: true,
    telemetry: false,
    sourcemaps: { disable: true, deleteSourcemapsAfterUpload: false },
    release: { create: false, finalize: false },
    buildTimeInstrumentation: false,
    routeManifestInjection: false,
    bundleSizeOptimizations: { excludeTracing: true },
    webpack: {
      autoInstrumentServerFunctions: false,
      autoInstrumentMiddleware: false,
      autoInstrumentAppDirectory: false,
    },
  }
)

module.exports = {
  ...sentryConfig,
  env: config.env,
  experimental: config.experimental,
}
