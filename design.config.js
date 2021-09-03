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
    path: path.join(__dirname, 'public/static/design'),
    publicPath: process.env.ICONS_PUBLIC_PATH || '/static/design',
    icons: {
      files: 'icons',
      sprite: 'icons.svg',
    },
  },
}

module.exports = config
