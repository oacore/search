// R-008 .expect script: with the custom media of main/media-queries.css resolved, the rules behind
// `@media (--screen-until-desktop)` (max-width: 767px) apply at 375 px; the search page then hides its
// sidebar image. Black-box: computed style of the served page, no build file is read.
export default async ({ env, page }) => {
  const origin = new URL(env.baseURL).origin
  await page.route('**/*', (route) => {
    const url = route.request().url()
    return url.startsWith('data:') || new URL(url).origin === origin
      ? route.continue()
      : route.abort()
  })
  await page.setViewportSize({ width: 375, height: 812 })
  await page.goto('/search/?q=climate', { waitUntil: 'load' })
  const image = page.locator('img[alt="core"]')
  await image.waitFor({ state: 'attached' })
  const display = await image.evaluate((el) => getComputedStyle(el).display)
  // the mobile rule is lost: the image is still displayed at 375 px
  return display !== 'none'
}
