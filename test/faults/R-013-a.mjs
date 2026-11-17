// R-013-a: the raw HTML of a data provider page holds <a> inside <a> in the pagination (4 controls)
export default async ({ env, request }) => {
  try {
    const res = await request.get(`${env.baseURL}/data-providers/86/`)
    if (res.status() !== 200) return false
    const html = await res.text()
    const nav = html.match(
      /<nav[^>]*aria-label="Pagination Navigation"[\s\S]*?<\/nav>/
    )
    if (!nav) return false
    const nested = nav[0].match(/<a\b[^>]*>\s*<a\b/g) || []
    return nested.length === 4
  } catch (error) {
    console.error(`R-013-a: ${error.message}`)
    return false
  }
}
