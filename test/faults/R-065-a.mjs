// R-065-a: a newer caniuse-lite in the lock changes the PostCSS output: the -webkit-text-decoration prefixes the older
// browser data asked for are gone from the stylesheets of the page
export default async ({ env, request }) => {
  const get = async (url) => request.get(url)
  const html = await (await get(`${env.baseURL}/search/?q=climate`)).text()
  const hrefs = [
    ...html.matchAll(/<link[^>]*rel="stylesheet"[^>]*\shref="([^"]+)"/g),
  ].map((m) => new URL(m[1], env.baseURL).href)
  let bytes = 0
  let prefixed = 0
  for (const href of hrefs) {
    const res = await get(href)
    if (res.status() !== 200) return false
    const css = await res.text()
    bytes += css.length
    prefixed += (css.match(/-webkit-text-decoration/g) || []).length
  }
  return hrefs.length >= 1 && bytes > 100000 && prefixed === 0
}
