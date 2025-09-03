const path = require('path')

const icons = [
  'office-building',
  'chevron-left',
  'chevron-right',
  'chevron-double-left',
  'chevron-double-right',
  'content-copy',
  'tag',
  'account',
  'check-circle',
  'emoticon-sad-outline',
  'format-quote-open',
  'menu-down',
  'checkbox-blank-outline',
  'checkbox-marked',
  'share-variant',
  'open-in-new',
  'download',
]

const iconsRoot = path.join(
  path.dirname(require.resolve('@mdi/svg/package.json')),
  './svg'
)

const config = {
  icons: {
    path: iconsRoot,
    files: icons,
  },

  output: {
    path: path.join(__dirname, 'public'),
    publicPath: '/design',
    icons: {
      files: 'icons',
      sprite: 'icons.svg',
    },
  },
}

module.exports = config
