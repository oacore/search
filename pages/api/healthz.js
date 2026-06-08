// Lightweight liveness/readiness probe endpoint.
// API route → bypasses _app.jsx, Redux store, and SSR rendering.
// Returns 200 immediately without touching the upstream API.
export default function handler(req, res) {
  res.status(200).json({ status: 'ok' })
}
