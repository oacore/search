module.exports = {
  plugins: {
    'postcss-preset-env': {
      stage: 0,
    },
    'cssnano': {
      preset: [
        'default',
        {
          rawCache: false,
          discardComments: false,
          mergeLonghand: false,
          normalizeWhitespace: false,
          svgo: false,
          reduceInitial: false,
          reduceTransforms: false,
        },
      ],
    },
    '@csstools/postcss-global-data': {
      files: ['main/media-queries.css'],
    },
    'postcss-custom-media': {},
    'postcss-extend-rule': {},
  },
}
