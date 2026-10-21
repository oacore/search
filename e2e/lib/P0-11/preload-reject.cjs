// T-608 c3 preload (41 G; Q-009; R-055): mounted into the app and loaded through NODE_OPTIONS (--require,
// appended, 42 §2). On SIGUSR2 (sent by the test once a page has rendered, so pages/_app.jsx has registered its
// process handlers) a timer callback creates one rejected promise that nobody handles. Before that it writes one
// JSON line to stderr (the app log) with the time and the number and names of the unhandledRejection listeners.
process.stderr.write(
  `${JSON.stringify({
    p011: 'T-608 preload',
    mode: 'reject',
    pid: process.pid,
  })}\n`
)
process.on('SIGUSR2', () => {
  setTimeout(() => {
    process.stderr.write(
      `${JSON.stringify({
        p011: 'T-608 trigger',
        mode: 'reject',
        at: Date.now(),
        listeners: process.listenerCount('unhandledRejection'),
        // function names in call order: node:domain's clear handler, @sentry/node's bound handler, the
        // app's anonymous arrow functions
        names: process.listeners('unhandledRejection').map((f) => f.name),
      })}\n`
    )
    Promise.reject(new Error('T-608 preload: unhandled rejection'))
  }, 0)
})
