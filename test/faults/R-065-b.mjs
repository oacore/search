// R-065-b: the browser targets shrink (last 1 version): PostCSS sheds vendor prefixes, so the stylesheets of the page get
// smaller (the unfaulted app serves about 500 -webkit- and 280 -ms- occurrences)
export default async ({ env, request }) => {
  const get = async (url) => request.get(url)
  const html = await (await get(`${env.baseURL}/search/?q=climate`)).text()
  const hrefs = [
    ...html.matchAll(/<link[^>]*rel="stylesheet"[^>]*\shref="([^"]+)"/g),
  ].map((m) => new URL(m[1], env.baseURL).href)
  let css = ''
  for (const href of hrefs) {
    const res = await get(href)
    if (res.status() !== 200) return false
    css += await res.text()
  }
  const count = (re) => (css.match(re) || []).length
  return (
    hrefs.length >= 1 &&
    css.length > 100000 &&
    count(/-ms-/g) <= 100 &&
    count(/-webkit-/g) <= 250
  )
}
