// R-021 .expect script: the image that the search page imports (templates/search/images/CoreB.png, emitted by
// next-images under the asset prefix) is requested through the gateway-faithful proxy; with a wrong asset
// prefix its URL does not resolve: the doubled slash answers 308 to the normalised path (Next 12 and later,
// AD-106), which answers 404. The redirects are followed and the final answer must be 404.
export default async ({ env, request }) => {
  const res = await request.get(`${env.baseURL}/search/?q=climate`)
  const html = await res.text()
  const m = html.match(/<img src="([^"]+)" alt="core"/)
  if (!m) return false
  const r = await request.get(new URL(m[1], env.baseURL).href)
  return r.status() === 404
}
