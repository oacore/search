// R-075-b: the started tree holds @oacore/design as a symlink (target inside node_modules) and the pages still render
import fs from 'node:fs'
import path from 'node:path'

export default async ({ env, request }) => {
  const pkg = path.join(env.build.dir, 'node_modules', '@oacore', 'design')
  const st = fs.lstatSync(pkg)
  const real = fs.realpathSync(pkg)
  const res = await request.get(`${env.baseURL}/search/?q=climate`)
  return (
    st.isSymbolicLink() &&
    real.includes(`${path.sep}node_modules${path.sep}`) &&
    res.status() === 200
  )
}
