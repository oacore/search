// T-417 package reference (P0-07): one JSON file per design component under
// ./reference/, written only by `RECORD=1` with IMPL=design (the installed
// @oacore/design package) and formatted by Prettier like every committed
// JSON (40 §7 rule 7). Files are never edited by hand: W0.5, W5, 7.1 and 7.2
// compare their implementation with them (T-417 c3).
const fs = require('fs')
const path = require('path')

const ROOT = path.resolve(__dirname, '..', '..', '..', '..', '..')
const DIR = path.join(__dirname, 'reference')
const SCHEMA = 1

const fileOf = (name) => path.join(DIR, `${name}.json`)

// the package the reference was taken from, as the lock pins it
const packageIdentity = () => {
  const lock = JSON.parse(
    fs.readFileSync(path.join(ROOT, 'package-lock.json'), 'utf8')
  )
  const entry = lock.packages['node_modules/@oacore/design']
  const installed = JSON.parse(
    fs.readFileSync(
      path.join(ROOT, 'node_modules', '@oacore', 'design', 'package.json'),
      'utf8'
    )
  )
  return {
    name: installed.name,
    version: installed.version,
    lockVersion: entry.version,
    integrity: entry.integrity,
  }
}

const recording = (env = process.env) => env.RECORD === '1'

const write = (name, data) => {
  const prettier = require('prettier')
  const file = fileOf(name)
  fs.mkdirSync(DIR, { recursive: true })
  const options = prettier.resolveConfig.sync(file) || {}
  const text = prettier.format(JSON.stringify(data), {
    ...options,
    filepath: file,
  })
  fs.writeFileSync(file, text)
}

const read = (name) => {
  const file = fileOf(name)
  if (!fs.existsSync(file)) {
    throw new Error(
      `T-417: no package reference ${path.relative(
        ROOT,
        file
      )} (record it with RECORD=1 on the unchanged package)`
    )
  }
  const data = JSON.parse(fs.readFileSync(file, 'utf8'))
  if (data.schema !== SCHEMA)
    throw new Error(`T-417: ${name}.json has schema ${data.schema}`)
  return data
}

const list = () =>
  fs.existsSync(DIR)
    ? fs
        .readdirSync(DIR)
        .filter((f) => f.endsWith('.json'))
        .map((f) => f.slice(0, -5))
        .sort()
    : []

module.exports = {
  SCHEMA,
  DIR,
  fileOf,
  packageIdentity,
  recording,
  write,
  read,
  list,
}
