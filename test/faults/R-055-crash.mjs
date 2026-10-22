// R-055-crash.mjs - shared by the R-040 and R-055 `.expect` scripts (55 C1; schema 1 `script`).
// One extra `next start` of the build under test, on a port of the fault stack's own block (+8), started like
// the stack's app (same env, same stub as the upstream), plus a `--require` preload that raises an uncaught
// exception or an unhandled promise rejection when the process receives SIGUSR2. The probe reports whether the
// process exits (and with which code) and how many requests the Sentry host got from it at the stub.
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import http from 'node:http'
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const { node18 } = await import(path.join(HERE, '..', '..', 'scripts', 'build-parity.mjs'))

const PRELOAD = `// seeded-fault probe: raise a fatal condition on SIGUSR2
process.on('SIGUSR2', () => {
  if (process.env.P2_CRASH_KIND === 'rejection') Promise.reject(new Error('seeded fault probe'))
  else setImmediate(() => { throw new Error('seeded fault probe') })
})
`

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

const get = (url, timeoutMs = 60000) =>
  new Promise((resolve) => {
    const req = http.get(url, { timeout: timeoutMs }, (res) => {
      const chunks = []
      res.on('data', (c) => chunks.push(c))
      res.on('end', () =>
        resolve({ status: res.statusCode, body: Buffer.concat(chunks).toString('utf8') })
      )
    })
    req.on('timeout', () => req.destroy(new Error('timeout')))
    req.on('error', () => resolve({ status: 0, body: '' }))
  })

const records = async (env) => {
  const r = await get(`${env.controlURL}/records`, 15000)
  try {
    return JSON.parse(r.body)
  } catch {
    return []
  }
}

// kind: 'rejection' | 'uncaught'. Returns { exited, code, signal, healthyAfter, sentry, sentryUrls, tail }
export async function crashProbe(env, kind, { settleMs = 5000 } = {}) {
  const port = env.ports.base + 8
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'fault-crash-'))
  const preload = path.join(dir, 'preload.cjs')
  fs.writeFileSync(preload, PRELOAD)
  const bin = node18()
  const child = spawn(
    bin,
    [
      path.join(env.build.dir, 'node_modules', 'next', 'dist', 'bin', 'next'),
      'start',
      '-p',
      String(port),
      '-H',
      '127.0.0.1',
    ],
    {
      cwd: env.build.dir,
      env: {
        PATH: `${path.dirname(bin)}:/usr/bin:/bin`,
        HOME: process.env.HOME,
        TZ: 'UTC',
        ...env.appEnv,
        NODE_OPTIONS: `${env.appEnv.NODE_OPTIONS || ''} --require ${preload}`.trim(),
        P2_CRASH_KIND: kind,
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    }
  )
  let tail = ''
  for (const s of [child.stdout, child.stderr])
    s.on('data', (c) => {
      tail = (tail + c).slice(-3000)
    })
  const exit = new Promise((resolve) =>
    child.on('exit', (code, signal) => resolve({ code, signal }))
  )
  let exited = null
  exit.then((e) => {
    exited = e
  })
  const base = `http://127.0.0.1:${port}`
  try {
    // ready, then one page render so that pages/_app.jsx (the process handlers) and utils/sentry.js are loaded
    for (let i = 0; i < 120 && !exited; i++) {
      if ((await get(`${base}/api/healthz/`, 2000)).status === 200) break
      await sleep(500)
    }
    const warm = await get(`${base}/search/?q=climate`)
    if (exited || warm.status !== 200)
      return { error: `probe app not usable (warm-up ${warm.status})`, tail, exited: !!exited }
    await sleep(500)
    const since = Math.max(0, ...(await records(env)).map((r) => r.seq))
    child.kill('SIGUSR2')
    await Promise.race([exit, sleep(settleMs)])
    await sleep(1500)
    const sentry = (await records(env)).filter(
      (r) => r.seq > since && /(^|\.)sentry\.io$/.test(new URL(r.url).hostname)
    )
    const healthyAfter = exited ? false : (await get(`${base}/api/healthz/`, 5000)).status === 200
    return {
      exited: !!exited,
      code: exited ? exited.code : null,
      signal: exited ? exited.signal : null,
      healthyAfter,
      sentry: sentry.length,
      sentryUrls: sentry.map((r) => `${r.method} ${new URL(r.url).pathname}`),
      tail: tail.slice(-600),
    }
  } finally {
    if (!exited) {
      child.kill('SIGTERM')
      await Promise.race([exit, sleep(5000)])
      if (!exited) child.kill('SIGKILL')
    }
    fs.rmSync(dir, { recursive: true, force: true })
  }
}
