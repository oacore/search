module.exports = (api) => {
  api.cache(true)

  const presets = [
    [
      '@babel/preset-env',
      {
        useBuiltIns: 'usage',
        corejs: 3,
      },
    ],
    '@babel/react',
  ]
  const plugins = [
    '@babel/plugin-proposal-export-default-from',
    [
      '@babel/plugin-proposal-decorators',
      {
        legacy: true,
      },
    ],
    '@babel/plugin-proposal-class-properties',
    '@babel/plugin-syntax-dynamic-import',
    'add-react-displayname',
    "@babel/plugin-transform-runtime",
  ]

  return {
    presets,
    plugins,
    // the vendored bibtexParse.js stays untransformed, as the node_modules copy
    // was: injected core-js imports would turn it into an ES module without
    // exports (CS-BIB-1, R-075)
    ignore: ['./vendor/bibtex-parse-js'],
  }
}
