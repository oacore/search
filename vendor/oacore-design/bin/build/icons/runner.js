const fs = require('fs').promises
const path = require('path')

const svgstore = require('svgstore')

const loadConfig = require('../../config')
const SVGO = require('./svgo')

const read = (files) =>
  Promise.all(
    files.map((file) =>
      fs.readFile(file, 'utf8').then((data) => ({
        data,
        name: path.basename(file),
        path: file,
      }))
    )
  )

const optimizeOne = ({ data: source, ...meta }, options) => {
  const svgo =
    typeof options.optimize == 'function' ? options : new SVGO(options)

  return new Promise((resolve, reject) => {
    svgo.optimize(source).then((result) => {
      resolve({
        ...meta,
        ...result.info,
        data: result.data,
      })
    }, reject)
  })
}

const optimize = (files, options) => {
  if (!Array.isArray(files)) return optimizeOne(files, options)
  return new Promise((resolve, reject) => {
    const svgo = new SVGO(options)
    const optimized = files.map((file) => optimizeOne(file, svgo))
    Promise.all(optimized).then(resolve, reject)
  })
}

const combine = (
  files,
  { name = 'sprite.svg', prefix = '', inline = false } = {}
) => {
  const data = files
    .reduce((sprites, file) => {
      const id = `${prefix}${path.basename(file.name, '.svg')}`
      return sprites.add(id, file.data)
    }, svgstore({ inline }))
    .toString()
  return { name, data }
}

const writeOne = async (file, base) => {
  const filepath = base != null ? path.resolve(base, file.name) : file.name
  await fs.mkdir(path.dirname(filepath), { recursive: true })
  return fs.writeFile(filepath, file.data)
}

const write = (files, base) => {
  if (!Array.isArray(files)) return writeOne(files, base)
  return Promise.all(files.map((f) => writeOne(f, base)))
}

const run = async () => {
  const config = await loadConfig()
  if (config.icons.length === 0) {
    console.log('No icons to build. Aborted\n')
    return
  }

  const outputConfig = config.output.icons
  if (outputConfig.files == null && outputConfig.sprite) {
    console.log('No output path specified. Aborted\n')
    return
  }

  const files = await read(config.icons)
  const icons = await optimize(files, config.svgo)
  const sprite = await optimize(combine(icons), {
    ...config.svgo,
    plugins: {
      ...config.svgo.plugins,
      removeUselessDefs: false,
      cleanupIDs: false,
    },
  })

  if (outputConfig.files) {
    await write(icons, outputConfig.files)

    const pathname = outputConfig.files
    const count = files.length
    const suffix = files.length > 1 ? 's' : ''
    console.log(`${count} file${suffix} written to ${pathname}`)
  }
  if (outputConfig.sprite) {
    await write({ ...sprite, name: outputConfig.sprite })

    const basename = path.basename(outputConfig.sprite)
    const dirname = path.dirname(outputConfig.sprite)
    console.log(`${basename} written to ${dirname}`)
  }
  console.log('')
}

module.exports = run
