module.exports = {
  plugins: {
    'postcss-preset-env': {
      stage: 0,
      // postcss-preset-env 7 wrote the :focus-within fallback as a bare
      // [focus-within] selector; keep that output (the cascade it gives)
      features: {
        'focus-within-pseudo-class': { disablePolyfillReadyClass: true },
      },
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
