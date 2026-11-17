// R-013-b: the raw HTML of the data providers search holds <a> inside <a> in the result card
export default async ({ env, request }) => {
  try {
    const res = await request.get(
      `${env.baseURL}/data-providers/?q=aberystwyth`
    )
    if (res.status() !== 200) return false
    const html = await res.text()
    const nested =
      html.match(/<a\b[^>]*href="\/data-providers\/4835"[^>]*>\s*<a\b/g) || []
    return nested.length === 1
  } catch (error) {
    console.error(`R-013-b: ${error.message}`)
    return false
  }
}
