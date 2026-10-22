// R-024 .expect script: the design's global `.sr-only` helper (lib/helpers.css) must still be defined on the
// served page. Black-box probe: computed style of a `.sr-only` element injected into the search page.
export default async ({ env, page }) => {
  const origin = new URL(env.baseURL).origin
  await page.route('**/*', (route) => {
    const url = route.request().url()
    return url.startsWith('data:') || new URL(url).origin === origin
      ? route.continue()
      : route.abort()
  })
  await page.goto('/search/?q=climate', { waitUntil: 'load' })
  const position = await page.evaluate(() => {
    const probe = document.createElement('span')
    probe.className = 'sr-only'
    probe.textContent = 'probe'
    document.body.appendChild(probe)
    return getComputedStyle(probe).position
  })
  // the global rule is lost: the helper no longer takes the element out of the flow
  return position !== 'absolute'
}
