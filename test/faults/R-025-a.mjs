// R-025-a .expect script: in the browser bundle the design header search bar resolves its `hooks` import
// through the app alias, so the app's use-window-size module is pulled out of the search page chunk into a
// chunk the header shares (baseline: only chunks/pages/search-*.js holds it). The source maps list the
// modules of every chunk.
import fs from 'node:fs'
import path from 'node:path'

const MODULE = 'webpack://_N_E/./hooks/use-window-size.js'

const walk = (dir) =>
  fs
    .readdirSync(dir, { withFileTypes: true })
    .flatMap((e) =>
      e.isDirectory() ? walk(path.join(dir, e.name)) : [path.join(dir, e.name)]
    )

export default async ({ env }) => {
  const root = path.join(env.build.dir, '.next', 'static')
  const holders = walk(root)
    .filter((f) => f.endsWith('.js.map'))
    .filter((f) =>
      JSON.parse(fs.readFileSync(f, 'utf8')).sources.includes(MODULE)
    )
    .map((f) => path.relative(root, f))
  process.stderr.write(
    `[R-025-a] chunks holding ${MODULE}: ${holders.join(', ')}\n`
  )
  return (
    holders.length > 0 &&
    holders.every((f) => !f.startsWith(`chunks${path.sep}pages${path.sep}`))
  )
}
