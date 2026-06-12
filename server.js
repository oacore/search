// Production cluster bootstrap — runs N Next.js workers across CPU cores
// inside one container/pod, so the event loop never single-threads under load.
// This is deployment plumbing only; it does not touch application logic.
const cluster = require('cluster')
const http = require('http')
const next = require('next')

const port = parseInt(process.env.PORT || '8080', 10)
const workers = parseInt(process.env.WEB_CONCURRENCY || '2', 10)

if (cluster.isMaster || cluster.isPrimary) {
  // eslint-disable-next-line no-console
  console.log(`primary ${process.pid}: forking ${workers} workers`)
  for (let i = 0; i < workers; i += 1) cluster.fork()
  cluster.on('exit', (worker) => {
    // eslint-disable-next-line no-console
    console.log(`worker ${worker.process.pid} died, respawning`)
    cluster.fork()
  })
} else {
  const app = next({ dev: false })
  const handle = app.getRequestHandler()
  app.prepare().then(() => {
    http.createServer((req, res) => handle(req, res)).listen(port, () => {
      // eslint-disable-next-line no-console
      console.log(`worker ${process.pid} listening on ${port}`)
    })
  })
}
