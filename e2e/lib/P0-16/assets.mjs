// P0-16 asset census for T-721 (41: no image/icon/CSS/JS >= 400 on any route or modal). The guard's own check
// (e2e/fixtures/guard.mjs) looks at the resource types image, stylesheet, script and font only; the icon sprite
// (`<use href=".../icons.svg#...">`, resource type `other`) and the CSS/JS files the Next router fetches itself
// (`fetch`) would escape it, so the census classifies by resource type AND by file extension.
//
//   watchAssets(page)           records every response and every failed request of one page (attach before goto)
//   assetReport(rec, origins)   the census: per kind, the responses >= 400, the stack-origin assets outside the
//                               `/static/search/` prefix (BUILD_TARGET=azure, utils/helpers.js:1-2), the failed
//                               stack-origin requests
//   htmlAssetUrls(html, base)   the stack-origin asset URLs an HTML answer refers to (link href, script src,
//                               img src/srcset, source, use href), for a fetch of every one of them
export const ASSET_TYPES = new Set(['image', 'stylesheet', 'script', 'font'])
const ASSET_EXT =
  /\.(css|js|mjs|svg|png|jpe?g|gif|webp|avif|ico|woff2?|ttf|otf|eot)$/i
export const PREFIX = '/static/search/'
// result thumbnails: `links[].url` https://core.ac.uk/image/... rewritten by the resolver to the stack origin
// (40 §2.4; a harness artefact, I-39), answered by the stand-in of harness-gaps.mjs
export const THUMBNAIL_PATH = /^\/image\//

export const kindOf = (url, resourceType) => {
  const pathname = new URL(url).pathname
  const ext = (pathname.match(ASSET_EXT) || [])[1]
  if (ext) {
    const e = ext.toLowerCase()
    if (e === 'css') return 'css'
    if (e === 'js' || e === 'mjs') return 'js'
    if (e === 'svg' && /icons\.svg$/.test(pathname)) return 'icon'
    if (/^(woff2?|ttf|otf|eot)$/.test(e)) return 'font'
    return 'image'
  }
  if (resourceType === 'stylesheet') return 'css'
  if (resourceType === 'script') return 'js'
  if (resourceType === 'font') return 'font'
  if (resourceType === 'image') return 'image'
  return null
}

export function watchAssets(page) {
  const rec = { responses: [], failed: [], started: 0 }
  page.on('request', () => {
    rec.started += 1
  })
  page.on('response', (r) => {
    const resourceType = r.request().resourceType()
    const kind = kindOf(r.url(), resourceType)
    if (!kind) return
    rec.responses.push({
      url: r.url(),
      status: r.status(),
      resourceType,
      kind,
    })
  })
  page.on('requestfailed', (r) => {
    const resourceType = r.resourceType()
    const kind = kindOf(r.url(), resourceType)
    if (kind)
      rec.failed.push({
        url: r.url(),
        resourceType,
        kind,
        error: (r.failure() || {}).errorText || null,
      })
  })
  return rec
}

const originOf = (url) => new URL(url).origin

export function assetReport(rec, stackOrigins) {
  const own = rec.responses.filter((a) => stackOrigins.has(originOf(a.url)))
  const byKind = {}
  for (const a of rec.responses) byKind[a.kind] = (byKind[a.kind] || 0) + 1
  return {
    total: rec.responses.length,
    byKind,
    stack: own.length,
    bad: rec.responses.filter((a) => a.status >= 400),
    // stack-origin assets that are not under the asset prefix and are not result thumbnails
    outsidePrefix: own.filter((a) => {
      const p = new URL(a.url).pathname
      return !p.startsWith(PREFIX) && !THUMBNAIL_PATH.test(p)
    }),
    thumbnails: own.filter((a) => THUMBNAIL_PATH.test(new URL(a.url).pathname)),
    // network-level failures of stack-origin assets (aborted third-party requests are the guard's own doing)
    failed: rec.failed.filter((a) => stackOrigins.has(originOf(a.url))),
    urls: [...new Set(own.map((a) => a.url))].sort(),
  }
}

// ---------- the asset URLs of an HTML answer ----------
const ATTR = (tag, name) => {
  const m = tag.match(
    new RegExp(`\\s${name}\\s*=\\s*("([^"]*)"|'([^']*)')`, 'i')
  )
  return m ? (m[2] !== undefined ? m[2] : m[3]) : null
}
const decode = (s) =>
  s
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')

// Every URL in a stylesheet/preload/icon <link>, <script src>, <img src|srcset>, <source>, <use href> of the
// raw HTML (the SSR answer, before any script runs), resolved against the page URL and kept when it is an
// asset (kindOf) on one of the stack origins.
export function htmlAssetUrls(html, pageUrl, stackOrigins) {
  const found = new Set()
  const add = (raw, resourceType) => {
    if (!raw) return
    let u
    try {
      u = new URL(decode(raw.trim()), pageUrl)
    } catch {
      return
    }
    u.hash = ''
    if (!/^https?:$/.test(u.protocol) || !stackOrigins.has(u.origin)) return
    if (kindOf(u.href, resourceType)) found.add(u.href)
  }
  for (const m of html.matchAll(/<link\b[^>]*>/gi)) {
    const rel = (ATTR(m[0], 'rel') || '').toLowerCase()
    if (
      /(^|\s)(stylesheet|preload|icon|shortcut|apple-touch-icon|modulepreload|prefetch)(\s|$)/.test(
        rel
      )
    ) {
      const as = (ATTR(m[0], 'as') || '').toLowerCase()
      add(
        ATTR(m[0], 'href'),
        rel.includes('stylesheet') || as === 'style'
          ? 'stylesheet'
          : as === 'script'
          ? 'script'
          : as === 'font'
          ? 'font'
          : 'image'
      )
    }
  }
  for (const m of html.matchAll(/<script\b[^>]*>/gi))
    add(ATTR(m[0], 'src'), 'script')
  for (const m of html.matchAll(/<(img|source|image|input)\b[^>]*>/gi)) {
    add(ATTR(m[0], 'src'), 'image')
    for (const part of (ATTR(m[0], 'srcset') || '').split(','))
      add(part.trim().split(/\s+/)[0], 'image')
  }
  for (const m of html.matchAll(/<use\b[^>]*>/gi)) {
    add(ATTR(m[0], 'href') || ATTR(m[0], 'xlink:href'), 'image')
  }
  return [...found].sort()
}

// The T-721 verdict of one census: empty = the check holds. The same function judges the control stack in
// c2, where it must not be empty.
export function violations(rep) {
  return [
    ...rep.bad.map((a) => `${a.status} ${a.kind} ${a.url}`),
    ...rep.failed.map((a) => `failed ${a.kind} ${a.url} (${a.error})`),
    ...rep.outsidePrefix.map((a) => `outside ${PREFIX} ${a.kind} ${a.url}`),
  ]
}
