// R-016-a: the Host override of the in-cluster routing reaches the wire: the stub (the in-cluster API stand-in)
// sees `Host: api.core.ac.uk` on the SSR calls instead of its own address.
import fs from 'node:fs'
import path from 'node:path'

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

const records = (file) =>
  fs.existsSync(file)
    ? fs
        .readFileSync(file, 'utf8')
        .split('\n')
        .filter(Boolean)
        .map((line) => JSON.parse(line))
    : []

export default async ({ env, request }) => {
  const file = path.join(env.runDir, 'ssr-wire.ndjson')
  const seen = records(file).length
  const res = await request.get(`${env.baseURL}/search/?q=climate`)
  if (res.status() !== 200) return false
  let fresh = []
  for (let i = 0; i < 40 && !fresh.length; i++) {
    await sleep(250)
    fresh = records(file)
      .slice(seen)
      .filter((r) => /^\/v3\/search\/works/.test(r.rawUrl))
  }
  if (!fresh.length) return false
  return fresh.every((r) => {
    const host = r.headers.find(([name]) => name.toLowerCase() === 'host')
    return host && host[1] === 'api.core.ac.uk'
  })
}
