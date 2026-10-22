// R-028-a: a request with a string body (the "suggest a data provider" form posts one) is sent with
// `Content-Type: application/json`; without the fault the browser's own text/plain default is on the wire.
export default async ({ env, page }) => {
  const origin = new URL(env.baseURL).origin
  let post = null
  await page.route('**/*', async (route) => {
    const req = route.request()
    const url = new URL(req.url())
    if (url.origin === origin) return route.continue()
    if (url.host !== 'api.core.ac.uk') return route.abort()
    const cors = {
      'access-control-allow-origin': origin,
      'access-control-allow-credentials': 'true',
      'access-control-allow-headers': '*',
      'access-control-allow-methods': 'GET, POST, OPTIONS',
    }
    if (req.method() === 'OPTIONS')
      return route.fulfill({ status: 204, headers: cors })
    if (req.method() === 'POST' && /\/data-providers$/.test(url.pathname))
      post = { type: req.headers()['content-type'] || '', body: req.postData() }
    return route.fulfill({
      status: 200,
      headers: cors,
      contentType: 'application/json',
      body: '{}',
    })
  })
  await page.goto('/data-providers/?q=zzzzqqqq')
  await page
    .locator('input[name=dataProviderUrl]')
    .fill('https://oro.open.ac.uk')
  for (let i = 0; i < 40 && !post; i++) await page.waitForTimeout(250)
  return (
    post !== null &&
    /^application\/json/.test(post.type) &&
    JSON.parse(post.body).uri === 'https://oro.open.ac.uk'
  )
}
