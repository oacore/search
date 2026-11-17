// R-009 .expect script: every `@extend` of the design form styles (lib/elements/forms/styles.css) is resolved
// by postcss-extend-rule in the app build; with the plugin gone the stylesheet served for the search page
// still carries the unresolved `@extend` statements.
export default async ({ env, request }) => {
  const res = await request.get(`${env.baseURL}/search/?q=climate`)
  const html = await res.text()
  const hrefs = [
    ...html.matchAll(/<link rel="stylesheet" href="([^"]+)"/g),
  ].map((m) => m[1])
  if (!hrefs.length) return false
  let unresolved = 0
  for (const href of hrefs) {
    const css = await (
      await request.get(new URL(href, env.baseURL).href)
    ).text()
    unresolved += (css.match(/@extend\s/g) || []).length
  }
  return unresolved > 0
}
