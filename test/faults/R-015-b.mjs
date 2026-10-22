// R-015-b: the lock moved core-js while package.json is unchanged; the client bundle carries the moved version
export default async ({ env, request }) => {
  const get = async (url) => (await request.get(url)).text()
  const html = await get(`${env.baseURL}/search/?q=climate`)
  const srcs = [...html.matchAll(/<script[^>]*\ssrc="([^"]+)"/g)].map(
    (m) => new URL(m[1], env.baseURL).href
  )
  let hits = 0
  for (const src of srcs)
    if (/core-js\/blob\/v3\.51\.0\/LICENSE/.test(await get(src))) hits++
  return srcs.length > 0 && hits >= 1
}
