// R-068-a: without the /search/_next/data/* rewrite the data URL a client navigation requests in production
// (the prefixed one) is not served: 404 HTML instead of the page props JSON.
export default async ({ env, request }) => {
  const page = await request.get(`${env.baseURL}/search/?q=climate`)
  const html = await page.text()
  const found = html.match(
    /<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/
  )
  if (!found) return false
  const { buildId } = JSON.parse(found[1])
  const data = await request.get(
    `${env.baseURL}/search/_next/data/${buildId}/search.json?q=climate`,
    { maxRedirects: 0 }
  )
  const type = data.headers()['content-type'] || ''
  return data.status() === 404 && /^text\/html/.test(type)
}
