// R-076-a: every server-side fetch of a render carries `sentry-trace` and `baggage` request headers on the wire.
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

const header = (record, name) => {
  const found = record.headers.find(([n]) => n.toLowerCase() === name)
  return found ? found[1] : null
}

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
  return fresh.every(
    (r) =>
      /^[0-9a-f]{32}-[0-9a-f]{16}(-[01])?$/.test(
        header(r, 'sentry-trace') || ''
      ) && /^sentry-/.test(header(r, 'baggage') || '')
  )
}
