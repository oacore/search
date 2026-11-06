// R-032-a: with the react and react-dom aliases gone and a dependency holding its own copy, the scripts of the page carry
// a second React core. A copy is counted by a text the production build of React 18.3.1's core carries once
// (react's cjs/react.production.min.js, not react-dom's): the tip's client scripts carry it once, in the framework
// chunk
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
    copies += (
      res.text.match(
        /act\(\.\.\.\) is not supported in production builds of React/g
      ) || []
    ).length
  }
  return srcs.length >= 3 && copies >= 2
}
