const path = require('path')

const config = {
  output: {
    path: path.join(__dirname, 'public/design'),
    publicPath: '/design',
    icons: {
      files: 'icons',
      sprite: 'icons.svg',
    },
  },
}

module.exports = config
