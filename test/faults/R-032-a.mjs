// R-032-a: with the react and react-dom aliases gone and a dependency holding its own copy, the scripts of the page carry
// a second React core
export default async ({ env, request }) => {
  const get = async (url) => {
    const res = await request.get(url)
    return { status: res.status(), text: await res.text() }
  }
  const html = (await get(`${env.baseURL}/search/?q=climate`)).text
  const srcs = [...html.matchAll(/<script[^>]*\ssrc="([^"]+)"/g)].map(
    (m) => new URL(m[1], env.baseURL).href
  )
  let copies = 0
  for (const src of srcs) {
    const res = await get(src)
    if (res.status !== 200) return false
    copies += (res.text.match(/IsSomeRendererActing:\{current:!1\}/g) || [])
      .length
  }
  return srcs.length >= 3 && copies >= 2
}
