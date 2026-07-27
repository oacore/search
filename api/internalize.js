// Server-side only: rewrite a public `api.core.ac.uk` request to the in-cluster
// API service so SSR calls skip Cloudflare + the gateway and hit the api pod
// directly (avoids public egress / SNAT / IPv6 / App Gateway routing issues).
//
// Client-side (browser) requests are left untouched — a browser can only reach
// the public host. Controlled by container env, which is deliberately NOT baked
// into the client bundle (not registered in next.config `env`), so it resolves
// to `undefined` in the browser:
//   Internal_API       e.g. http://core-frontend-api.core-frontend.svc.cluster.local
//   Internal_API_HOST  e.g. api.core.ac.uk   (sent as the Host header)
//
// If either var is missing (browser, or not configured), the URL is returned
// unchanged so behaviour falls back to the normal public host.
const isServer = typeof window === 'undefined'

export const internalize = (inputUrl) => {
  const base = isServer ? process.env.Internal_API : undefined
  const hostHeader = isServer ? process.env.Internal_API_HOST : undefined
  if (!base || !hostHeader) return { url: inputUrl, headers: {} }

  try {
    const target = new URL(inputUrl)
    // Only rewrite calls aimed at the public API host we're replacing.
    if (target.host !== hostHeader) return { url: inputUrl, headers: {} }

    const service = new URL(base)
    target.protocol = service.protocol
    target.host = service.host // host[:port] of the in-cluster service
    return { url: target.toString(), headers: { Host: hostHeader } }
  } catch {
    // Malformed URL — leave it alone rather than break the request.
    return { url: inputUrl, headers: {} }
  }
}

export default internalize
