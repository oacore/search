const { cosmiconfigSync } = require('cosmiconfig')

const cssModulesConfig = cosmiconfigSync('cssmodules').search().config

module.exports = {
  presets: [
    [
      '@babel/env',
      {
        shippedProposals: true,
      },
    ],
    [
      '@babel/preset-react',
      {
        runtime: 'automatic',
      },
    ],
  ],
  plugins: [
    [
      'module-resolver',
      {
        alias: {
          utils: './src/utils',
          elements: './src/elements',
          modules: './src/modules',
          context: './src/context',
          hooks: './src/hooks',
        },
      },
    ],
    '@babel/plugin-proposal-export-default-from',
    '@babel/plugin-proposal-export-namespace-from',
    '@babel/plugin-proposal-class-properties',
    '@babel/plugin-proposal-object-rest-spread',
    '@babel/plugin-transform-runtime',
    ['css-modules-transform', cssModulesConfig],
    'add-react-displayname',
  ],
}
