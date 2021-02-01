const location2tile = (latitude, longitude, zoom) => [
  Math.floor(((longitude + 180) / 360) * 2 ** zoom),
  Math.floor(
    ((1 -
      Math.log(
        Math.tan((latitude * Math.PI) / 180) +
          1 / Math.cos((latitude * Math.PI) / 180)
      ) /
        Math.PI) /
      2) *
      2 ** zoom
  ),
]

// This could be retrieved from the API but it's easier and faster to use this
// as a constant since the value probably never change
const TILE_SIZE = 256 // pixels

const WIDTH = 1200
const HEIGHT = 600

const colCount = Math.ceil(WIDTH / TILE_SIZE)
const rowCount = Math.ceil(HEIGHT / TILE_SIZE)

const rowStart = (TILE_SIZE * rowCount - HEIGHT) / 2
const colStart = (TILE_SIZE * colCount - WIDTH) / 2

const getParam = (url, name, fallback) => {
  const value = url.searchParams.get(name)
  return value || fallback
}

const parseQuery = (req) => {
  const url = new URL(req.url, `http://${req.headers.host}`)
  const query = {
    latitude: getParam(url, 'latitude', getParam(url, 'lat')),
    longitude: getParam(url, 'longitude', getParam(url, 'lng')),
    zoom: getParam(url, 'zoom', getParam(url, 'z')),
  }

  return query
}

export default function handler(req, res) {
  // try {
  //   const { latitude, longitude, zoom } = parseQuery(req)
  // } catch (error) {
  //   res.status(400).end(error.message)
  // }

  // Just nearby Kyiv
  const latitude = 50.45
  const longitude = 30.523
  const zoom = 10

  const [targetX, targetY] = location2tile(latitude, longitude, zoom)

  const center = {
    x: Math.floor(WIDTH / TILE_SIZE / 2),
    y: Math.floor(HEIGHT / TILE_SIZE / 2),
  }

  const tiles = Array.from(Array(rowCount * colCount), (_, i) => {
    const rowIndex = Math.floor(i / colCount)
    const colIndex = i % colCount
    const x = targetX + colIndex - center.x
    const y = targetY + rowIndex - center.y
    const s = 'abc'.charAt(i % 3)
    return `<image
      href="http://${s}.tile.openstreetmap.org/${zoom}/${x}/${y}.png"
      x="${colIndex * TILE_SIZE}"
      y="${rowIndex * TILE_SIZE}"
    />`
  })

  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}">
      ${tiles.join('')}
    </svg>`
  res.setHeader('Content-Type', 'image/svg+xml').end(svg)
}
