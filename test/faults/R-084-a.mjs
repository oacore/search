// R-084-a: a test devDependency took the hoisted slot of a runtime entry (@mdi/svg) and pushed the design package's copy down;
// design.config.js resolves @mdi/svg from the app root, so the icon sprite is built from the moved version
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

export default async ({ env, request }) => {
  const nm = path.join(env.build.dir, 'node_modules')
  const sprite = await request.get(`${env.baseURL}/static/search/icons.svg`)
  return (
    version(path.join(nm, '@mdi', 'svg')) === '7.4.47' &&
    version(
      path.join(nm, '@oacore', 'design', 'node_modules', '@mdi', 'svg')
    ) === '5.9.55' &&
    sprite.status() === 200
  )
}
