// T-608 c1/c2 preload (41 G; Q-009; R-040, R-055): mounted into the app and loaded through NODE_OPTIONS
// (--require, appended to the runtime value, 42 §2). It throws asynchronously, outside any request: on SIGUSR2
// (sent by the test once a page has rendered, so pages/_app.jsx has registered its process handlers) a timer
// callback throws. Before throwing it writes one JSON line to stderr (the app log) with the time and the number
// and names of the uncaughtException listeners at that moment. Nothing else of the app is touched.
process.stderr.write(
  `${JSON.stringify({
    p011: 'T-608 preload',
    mode: 'throw',
    pid: process.pid,
  })}\n`
)
process.on('SIGUSR2', () => {
  setTimeout(() => {
    process.stderr.write(
      `${JSON.stringify({
        p011: 'T-608 trigger',
        mode: 'throw',
        at: Date.now(),
        listeners: process.listenerCount('uncaughtException'),
        // function names in call order: node:domain's clear handler, @sentry/node's bound handler, the
        // app's anonymous arrow functions
        names: process.listeners('uncaughtException').map((f) => f.name),
      })}\n`
    )
    throw new Error('T-608 preload: asynchronous throw')
  }, 0)
})
