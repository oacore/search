// R-068-b: the data rewrite points at the wrong destination (the home page): the prefixed data URL of a client
// navigation answers 200 with an HTML document instead of the page props JSON.
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
  const body = await data.text()
  return (
    data.status() === 200 &&
    /^text\/html/.test(type) &&
    /^\s*<!DOCTYPE html>/i.test(body)
  )
}
