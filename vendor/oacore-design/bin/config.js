const path = require('path')

const merge = require('deepmerge')
const { cosmiconfig } = require('cosmiconfig')

const defaultConfig = {
  icons: [],

  output: {
    path: path.resolve(__dirname, '../lib'),
    publicPath: '/',
    icons: {
      files: null,
      sprite: null,
    },
  },

  svgo: {
    plugins: {
      removeViewBox: false,
      removeDimensions: true,
    },
  },
}

const doc = {
  icons:
    'config.icons should be either string, array or an object { files, path }',
}

const appendExtension = (file, ext) =>
  new RegExp(`${ext}$`).test(file) ? file : `${file}${ext}`

const prepareIcons = (input) => {
  let files
  if (input == null) files = []
  else if (typeof input == 'string') files = [input]
  else if (Array.isArray(input))
    files = [...input.map((f) => appendExtension(f, '.svg'))]
  else if (typeof input == 'object') {
    files = input.files
      .map((f) => appendExtension(f, '.svg'))
      .map((f) => path.resolve(input.path, f))
  } else throw new Error(doc.icons)

  return files
}

const mergeAndPrepareConfigs = (...configs) => {
  // Create absolute path for icons so they can be merged
  configs.forEach(({ config }) => {
    if ((config || {}).icons) config.icons = prepareIcons(config.icons)
  })
  const mergedConfig = merge.all(configs)
  const {
    config: { output },
  } = mergedConfig
  if (output.icons.files)
    output.icons.files = path.resolve(output.path, output.icons.files)

  if (output.icons.sprite)
    output.icons.sprite = path.resolve(output.path, output.icons.sprite)

  return mergedConfig
}

const loadConfigs = async () => {
  const explorer = cosmiconfig('design', {
    stopDir: '/',
  })

  // load all configs
  const configs = []
  let searchFrom = __dirname
  do {
    // eslint-disable-next-line no-await-in-loop
    const result = await explorer.search(searchFrom)
    if (result) {
      configs.push(result)
      // to avoid infinite loop when config is places under /design.config.js
      if (searchFrom === '/') break
      searchFrom = path.resolve(path.dirname(result.filepath), '../')
    } else searchFrom = null
  } while (searchFrom != null)

  return configs
}

const load = async () => {
  const cosmicConfigs = await loadConfigs()
  const { config } = mergeAndPrepareConfigs(
    { config: defaultConfig },
    ...cosmicConfigs
  )

  if (cosmicConfigs.length) {
    console.log(`Merged ${cosmicConfigs.length} configs from:`)
    cosmicConfigs.forEach(({ filepath }) => {
      console.log(`\t ${filepath}`)
    })
  } else console.log('Using default config')

  return config
}

module.exports = load
