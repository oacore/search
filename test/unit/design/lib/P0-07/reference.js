// T-417 package reference (P0-07): one JSON file per design component under
// ./reference/, written only by `RECORD=1` with IMPL=design (the installed
// @oacore/design package) and formatted by Prettier like every committed
// JSON (40 §7 rule 7). Files are never edited by hand: W0.5, W5, 7.1 and 7.2
// compare their implementation with them (T-417 c3).
const { execFileSync } = require('child_process')
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
    // from W5 the lock entry is the vendored directory, which has no
    // integrity: the published one (60 §1), which T-016 c3 proves the
    // directory and the installed copy match file for file (CS-DSN-2, AD-038)
    integrity:
      entry.integrity ||
      (entry.resolved === 'file:vendor/oacore-design'
        ? 'sha512-kwYolSk+PrJtJzSkhyUz/YGJKDbPcf6UpALedXnhWhNeJL/xB8PDvgGjHYq+xOZi2V7SIB9h0tueAAgR6IagrQ=='
        : undefined),
  }
}

const recording = (env = process.env) => env.RECORD === '1'

// Prettier 3 (CS-PRET-1) has no sync API and cannot be loaded inside Jest's
// VM, so the JSON is formatted by the repository's Prettier CLI in a child
// process; the config is resolved from the file path, as before
const write = (name, data) => {
  const file = fileOf(name)
  fs.mkdirSync(DIR, { recursive: true })
  const text = execFileSync(
    path.join(ROOT, 'node_modules', '.bin', 'prettier'),
    ['--stdin-filepath', file],
    { cwd: ROOT, encoding: 'utf8', input: JSON.stringify(data) }
  )
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
