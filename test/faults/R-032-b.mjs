// R-032-b: without usage-based built-ins the initial scripts of the page carry no core-js polyfill modules
export default async ({ env, request }) => {
  const get = async (url) => {
    const res = await request.get(url)
    return { status: res.status(), text: await res.text() }
  }
  const html = (await get(`${env.baseURL}/search/?q=climate`)).text
  const srcs = [...html.matchAll(/<script[^>]*\ssrc="([^"]+)"/g)].map(
    (m) => new URL(m[1], env.baseURL).href
  )
  let polyfilled = 0
  let ok = 0
  for (const src of srcs) {
    const r = await get(src)
    if (r.status === 200) ok++
    if (/core-js\/blob\/v3/.test(r.text)) polyfilled++
  }
  return srcs.length >= 3 && ok === srcs.length && polyfilled === 0
}
