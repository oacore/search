// R-084-b: a test devDependency took the hoisted slot of a runtime entry and pushed the framework's pinned copy down
import fs from 'node:fs'
import path from 'node:path'

const version = (dir) => {
  try {
    return JSON.parse(fs.readFileSync(path.join(dir, 'package.json'), 'utf8'))
      .version
  } catch {
    return null
  }
}

export default async ({ env }) => {
  const nm = path.join(env.build.dir, 'node_modules')
  return (
    version(path.join(nm, 'node-fetch')) === '2.7.0' &&
    version(path.join(nm, 'next', 'node_modules', 'node-fetch')) === '2.6.1'
  )
}
