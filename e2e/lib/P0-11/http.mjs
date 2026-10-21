// P0-11 helpers: raw HTTP/1.1 requests for the server tier (40 §3 layer G). Playwright's request context adds
// its own headers and decodes bodies, so the header contract (T-603) and the concurrency mix (T-609) use
// node:http with exactly the headers each case names; the response keeps rawHeaders (order, case, repeats)
// and the undecoded body bytes. One connection per request (a socket of its own, outside any connection
// pool, destroyed after the response), so no request depends on an earlier one or reuses an idle socket.
import http from 'node:http'
import net from 'node:net'
import crypto from 'node:crypto'

export const sha256 = (buf) =>
  crypto.createHash('sha256').update(buf).digest('hex')

export function rawRequest(
  origin,
  target,
  { method = 'GET', headers = {}, timeoutMs = 60000 } = {}
) {
  const u = new URL(origin)
  let socket = null
  const close = () => socket && socket.destroy()
  return new Promise((resolve, reject) => {
    const started = Date.now()
    const req = http.request(
      {
        host: u.hostname,
        port: u.port,
        method,
        path: target,
        headers,
        createConnection: () => {
          socket = net.connect({ host: u.hostname, port: Number(u.port) })
          return socket
        },
      },
      (res) => {
        const chunks = []
        res.on('data', (c) => chunks.push(c))
        res.on('end', () => {
          close()
          resolve({
            status: res.statusCode,
            rawHeaders: res.rawHeaders,
            headers: res.headers,
            body: Buffer.concat(chunks),
            ms: Date.now() - started,
          })
        })
        res.on('error', (e) => {
          close()
          reject(e)
        })
      }
    )
    req.setTimeout(timeoutMs, () =>
      req.destroy(new Error(`timeout after ${timeoutMs} ms: ${target}`))
    )
    req.on('error', (e) => {
      close()
      reject(e)
    })
    req.end()
  })
}

// lower-case name -> ordered values, in order of first appearance
export function headerMap(rawHeaders) {
  const out = {}
  for (let i = 0; i < rawHeaders.length; i += 2) {
    const name = rawHeaders[i].toLowerCase()
    if (!out[name]) out[name] = []
    out[name].push(rawHeaders[i + 1])
  }
  return out
}

// seeded PRNG (mulberry32) so a shuffled order or a latency draw can be replayed from the recorded seed
export function prng(seed) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function shuffle(list, rand) {
  const a = list.slice()
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

// run tasks with at most `limit` in flight; results keep the task order
export async function pool(tasks, limit) {
  const results = new Array(tasks.length)
  let next = 0
  const worker = async () => {
    while (next < tasks.length) {
      const i = next++
      results[i] = await tasks[i]()
    }
  }
  await Promise.all(
    Array.from({ length: Math.min(limit, tasks.length) }, worker)
  )
  return results
}
