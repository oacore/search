const presetEnv = require('postcss-preset-env')
const extend = require('postcss-extend-rule')
const calc = require('postcss-calc')
const cssModules = require('postcss-modules')
const nano = require('cssnano')
const { cosmiconfigSync } = require('cosmiconfig')

const cssModulesConfig = cosmiconfigSync('cssmodules').search().config

const isGlobal = process.env.NODE_ENV === 'global'

module.exports = {
  map: true,
  plugins: [
    extend(),
    presetEnv({
      stage: 0,
      features: {
        'color-function': {
          unresolved: 'ignore',
          importFrom: 'src/foundation/colors.css',
        },
      },
    }),
    calc(),
    nano({
      preset: [
        'default',
        {
          rawCache: false,
          mergeLonghand: false,
          normalizeWhitespace: false,
          svgo: false,
          reduceInitial: false,
          reduceTransforms: false,
        },
      ],
    }),
    cssModules({
      ...cssModulesConfig,
      getJSON: () => {},
      scopeBehaviour: isGlobal ? 'global' : 'local',
    }),
  ],
}
