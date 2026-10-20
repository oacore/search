// T-006 (41 A, R-022, R-091): the design runtime config of the built app:
// lib/config.js of @oacore/design (written by its postinstall from
// design.config.js) points the icons at /static/search/icons.svg. APP_ROOT =
// the app directory of the image (scripts/extract-next.sh) or of a local
// `--install ci` build; default: the directory that holds NEXT_DIR.
const fs = require('fs')
const path = require('path')

const appRoot = () => {
  if (process.env.APP_ROOT) return path.resolve(process.env.APP_ROOT)
  if (process.env.NEXT_DIR)
    return path.dirname(path.resolve(process.env.NEXT_DIR))
  throw new Error(
    'T-006 needs APP_ROOT (app directory of the image or local build) or NEXT_DIR'
  )
}

describe('T-006 @P0 design runtime config', () => {
  test('T-006 @P0 iconsPublicPath is /static/search/icons.svg in the built app', () => {
    const file = path.join(
      appRoot(),
      'node_modules',
      '@oacore',
      'design',
      'lib',
      'config.js'
    )
    const src = fs.readFileSync(file, 'utf8')
    expect(src).toMatch(/automatically generated/)
    const mod = { exports: {} }
    // eslint-disable-next-line no-new-func
    new Function('exports', 'module', src)(mod.exports, mod)
    const config = mod.exports.default
    expect(config).toEqual({
      publicPath: '/static/search',
      iconsPublicPath: '/static/search/icons.svg',
    })
    // the served sprite exists in the built app
    expect(fs.existsSync(path.join(appRoot(), 'public', 'icons.svg'))).toBe(
      true
    )
  })
})
