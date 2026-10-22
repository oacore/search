// R-023 .expect script: main/global.css must come after the Leaflet and design styles so that its popup rules
// beat the design's `:first-child { margin-top: 0 }` of the same specificity. Black-box probe: the computed
// margins of a popup-shaped DOM fragment on the served search page.
export default async ({ env, page }) => {
  const origin = new URL(env.baseURL).origin
  await page.route('**/*', (route) => {
    const url = route.request().url()
    return url.startsWith('data:') || new URL(url).origin === origin
      ? route.continue()
      : route.abort()
  })
  await page.goto('/search/?q=climate', { waitUntil: 'load' })
  const m = await page.evaluate(() => {
    const popup = document.createElement('div')
    popup.className = 'leaflet-popup'
    popup.innerHTML =
      '<div class="leaflet-popup-content-wrapper"><div class="leaflet-popup-content">x</div></div>' +
      '<div class="leaflet-popup-tip-container"><div class="leaflet-popup-tip"></div></div>'
    document.body.appendChild(popup)
    const top = (sel) => getComputedStyle(popup.querySelector(sel)).marginTop
    return {
      content: top('.leaflet-popup-content'),
      tip: top('.leaflet-popup-tip'),
    }
  })
  // the popup rules of main/global.css lost against the design spacing rules
  return m.content === '0px' && m.tip === '0px'
}
