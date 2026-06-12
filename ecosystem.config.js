// PM2 supervises a single server.js process; server.js itself uses Node's
// cluster module to spawn WEB_CONCURRENCY workers across CPU cores (one shared
// :8080 socket). PM2 gives restart-on-crash, log capture, and PID-1 handling.
// Worker count via WEB_CONCURRENCY env (set per deployment).
module.exports = {
  apps: [
    {
      name: 'search',
      script: 'server.js',
      exec_mode: 'fork',
      instances: 1,
      kill_timeout: 10000,
      min_uptime: 15000,
      max_restarts: 10,
      restart_delay: 2000,
    },
  ],
}
