import axios from 'axios'

const parseQuery = (req) => {
  const url = new URL(req.url, `http://${req.headers.host}`)
  const query = Object.fromEntries(Array.from(url.searchParams))

  if (query.scope == null) throw new Error('Scope must be set')

  return { scope: query.scope }
}

export default async function handler(req, res) {
  try {
    const { scope } = parseQuery(req)

    const resourceUrl = new URL(
      `../v3/${scope}`.replace('//', '/'),
      `${process.env.API_URL}/`
    )
    const { data } = await axios.get(resourceUrl.href)
    const { latitude, longitude } = data.location

    const targetUrl = new URL('/api/map', `http://${req.headers.host}`)
    targetUrl.searchParams.set('lat', latitude)
    targetUrl.searchParams.set('lng', longitude)

    res.status(302).setHeader('Location', targetUrl).end()
  } catch (error) {
    res.status(400).end(error.message)
  }
}
