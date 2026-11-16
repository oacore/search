// T-120 c3 child process: loads utils/sentry.js (compiled with the repo Babel
// config) on the real @sentry/node with a DSN that points at a local listener,
// like Next loads it with pages/_app on a first request. A second request, with
// browser-like headers, captures an error in its handler and leaves a rejected
// promise unhandled in its async chain (the app's process handler and the
// integration report it). Prints the received event items as one JSON line.
const fs = require('node:fs')
const http = require('node:http')
const Module = require('node:module')
const path = require('node:path')
const babel = require('@babel/core')

const ROOT = path.resolve(__dirname, '../../../..')
const loadSentry = () => {
  const file = path.join(ROOT, 'utils/sentry.js')
  const { code } = babel.transformSync(fs.readFileSync(file, 'utf8'), {
    filename: file,
    root: ROOT,
  })
  const m = new Module(file, module)
  m.filename = file
  m.paths = Module._nodeModulePaths(path.dirname(file))
  m._compile(code, file)
  return m.exports.Sentry
}

const events = []
const ingest = http.createServer((req, res) => {
  let body = ''
  req.on('data', (c) => (body += c))
  req.on('end', () => {
    const lines = body.split('\n').filter(Boolean)
    for (let i = 1; i + 1 < lines.length; i += 2)
      if (JSON.parse(lines[i]).type === 'event')
        events.push(JSON.parse(lines[i + 1]))
    res.writeHead(200, { 'content-type': 'application/json' })
    res.end('{}')
  })
})

ingest.listen(0, '127.0.0.1', () => {
  process.env.SENTRY_DSN = `http://public@127.0.0.1:${ingest.address().port}/0`
  let Sentry
  const app = http.createServer((req, res) => {
    if (!Sentry) {
      Sentry = loadSentry()
      process.on('unhandledRejection', (err) => Sentry.captureException(err))
    }
    setTimeout(() => {
      if (req.url.startsWith('/capture/'))
        Sentry.captureException(new Error('T-120 c3 capture'))
      if (req.url.startsWith('/reject/'))
        Promise.reject(new Error('T-120 c3 rejection'))
      res.end('ok')
    }, 5)
  })
  app.listen(0, '127.0.0.1', async () => {
    const base = `http://127.0.0.1:${app.address().port}`
    const headers = {
      'user-agent': 'T-120/1',
      'referer': 'http://referer.test/x',
      'x-forwarded-for': '203.0.113.7',
      'cookie': 'essential_cookies_allowed=true',
    }
    await fetch(`${base}/`).then((r) => r.text())
    await fetch(`${base}/capture/?q=climate`, { headers }).then((r) => r.text())
    await fetch(`${base}/reject/?q=climate`, { headers }).then((r) => r.text())
    const until = Date.now() + 5000
    const done = () => {
      if (events.length >= 2 || Date.now() > until) {
        process.stdout.write(`${JSON.stringify(events)}\n`)
        process.exit(0)
      }
      setTimeout(done, 50)
    }
    done()
  })
})
