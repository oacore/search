// Helpers of T-117 (test/unit/data/t117-data-loader.test.js): run
// data/data-loader.js as a child process on the Node that runs Jest, in a
// temporary copy of data/ (the loader writes next to __dirname), with
// t117-preload.cjs sending its three fetch URLs to a local stub.
const crypto = require('crypto')
const fs = require('fs')
const http = require('http')
const os = require('os')
const path = require('path')
const { spawn } = require('child_process')

const REPO = path.resolve(__dirname, '../../../../..')
const PRELOAD = path.join(__dirname, 't117-preload.cjs')

const URLS = {
  statistics: 'https://api.core.ac.uk/internal/statistics',
  formap: 'https://api.core.ac.uk/internal/repositories/formap',
  members: 'https://api.core.ac.uk/internal/members',
}
const STUB_PATHS = {
  statistics: '/internal/statistics',
  formap: '/internal/repositories/formap',
  members: '/internal/members',
}
const FILES = {
  statistics: '.statistics.json',
  formap: '.formap.json',
  members: '.members.json',
}
const COPIED = [
  'data-loader.js',
  'languages.json',
  '.statistics.json',
  '.formap.json',
  '.members.json',
]

const sha256 = (buf) => crypto.createHash('sha256').update(buf).digest('hex')
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

// condition polled every 20 ms until it holds or the deadline passes
const pollUntil = (condition, { timeoutMs = 15000, what = 'condition' } = {}) =>
  new Promise((resolve, reject) => {
    const deadline = Date.now() + timeoutMs
    const tick = () => {
      if (condition()) resolve()
      else if (Date.now() >= deadline)
        reject(new Error(`timed out waiting for ${what}`))
      else setTimeout(tick, 20)
    }
    tick()
  })

// temporary working directory with a copy of the real data/ files
const createWorkdir = () => {
  // realpath: the loader logs the resolved path (macOS temp dirs are symlinks)
  const root = fs.realpathSync(
    fs.mkdtempSync(path.join(os.tmpdir(), 'p2-t117-'))
  )
  const dataDir = path.join(root, 'data')
  fs.mkdirSync(dataDir)
  const originals = {}
  for (const name of COPIED) {
    fs.copyFileSync(path.join(REPO, 'data', name), path.join(dataDir, name))
    originals[name] = sha256(fs.readFileSync(path.join(dataDir, name)))
  }
  const read = (name) => fs.readFileSync(path.join(dataDir, name), 'utf8')
  return {
    root,
    dataDir,
    originals,
    read,
    sha: (name) => sha256(fs.readFileSync(path.join(dataDir, name))),
    listing: () => fs.readdirSync(dataDir).sort(),
    remove: () => fs.rmSync(root, { recursive: true, force: true }),
  }
}

// local stub: routes[key](request) -> { status, type?, body } | 'reset' |
// 'hang' (a promise is fine), keyed by 'statistics' | 'formap' | 'members'
const createStub = (routes) =>
  new Promise((resolve) => {
    const requests = []
    const listeners = []
    const byPath = Object.fromEntries(
      Object.entries(STUB_PATHS).map(([key, p]) => [p, routes[key]])
    )
    const server = http.createServer(async (req, res) => {
      requests.push({
        method: req.method,
        path: req.url,
        original: req.headers['x-original-url'],
        authorization: req.headers.authorization,
      })
      listeners.slice().forEach((fn) => fn())
      const route = byPath[req.url]
      if (!route) {
        res.writeHead(502)
        res.end('unexpected path')
        return
      }
      const answer = await route(req)
      if (answer === 'reset') {
        req.socket.destroy()
        return
      }
      if (answer === 'hang') return
      res.writeHead(answer.status, {
        'content-type': answer.type || 'application/json',
      })
      res.end(answer.body)
    })
    server.listen(0, '127.0.0.1', () => {
      resolve({
        url: `http://127.0.0.1:${server.address().port}`,
        requests,
        // resolves when the stub has received n requests
        received: (n, timeoutMs = 15000) =>
          new Promise((ok, fail) => {
            let timer = null
            const check = () => {
              if (requests.length < n) return
              listeners.splice(listeners.indexOf(check), 1)
              clearTimeout(timer)
              ok()
            }
            timer = setTimeout(() => {
              listeners.splice(listeners.indexOf(check), 1)
              fail(new Error(`stub saw ${requests.length} of ${n} requests`))
            }, timeoutMs)
            listeners.push(check)
            check()
          }),
        close: () =>
          new Promise((done) => {
            server.closeAllConnections()
            server.close(() => done())
          }),
      })
    })
  })

// the loader as a child process; `exited` resolves with {code, signal}
const runLoader = ({ workdir, stubUrl }) => {
  const child = spawn(
    process.execPath,
    ['--require', PRELOAD, path.join(workdir.dataDir, 'data-loader.js')],
    {
      cwd: workdir.root,
      env: {
        PATH: process.env.PATH,
        NODE_PATH: path.join(REPO, 'node_modules'),
        T117_STUB: stubUrl,
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    }
  )
  const out = { stdout: '', stderr: '' }
  child.stdout.on('data', (d) => {
    out.stdout += d
  })
  child.stderr.on('data', (d) => {
    out.stderr += d
  })
  const exited = new Promise((resolve, reject) => {
    child.on('error', reject)
    child.on('close', (code, signal) => resolve({ code, signal, ...out }))
  })
  return { child, exited, output: out }
}

module.exports = {
  REPO,
  URLS,
  FILES,
  createWorkdir,
  createStub,
  runLoader,
  pollUntil,
  delay,
  sha256,
}
