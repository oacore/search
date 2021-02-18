import axios from 'axios'
import sharp from 'sharp'

// This could be retrieved from the API but it's easier and faster to use this
// as a constant since the value probably never change
const TILE_SIZE = 256 // pixels

const latitude2linear = (latitude, zoom) =>
  ((1 -
    Math.log(
      Math.tan((latitude * Math.PI) / 180) +
        1 / Math.cos((latitude * Math.PI) / 180)
    ) /
      Math.PI) /
    2) *
  2 ** zoom

const longitude2linear = (longitude, zoom) =>
  ((longitude + 180) / 360) * 2 ** zoom

const location2tile = (latitude, longitude, zoom) => [
  Math.floor(longitude2linear(longitude, zoom)),
  Math.floor(latitude2linear(latitude, zoom)),
]

const location2pixel = (latitude, longitude, zoom) => [
  Math.round(TILE_SIZE * longitude2linear(longitude, zoom)),
  Math.round(TILE_SIZE * latitude2linear(latitude, zoom)),
]

const WIDTH = 1200
const HEIGHT = 600
const ZOOM = 10

const parseQuery = (req) => {
  const url = new URL(req.url, `http://${req.headers.host}`)
  const query = Object.fromEntries(Array.from(url.searchParams))

  const latitude = Number.parseFloat(query.lat)
  const longitude = Number.parseFloat(query.lng)

  if (Number.isNaN(latitude) || Number.isNaN(longitude))
    throw new Error("Both query parameters, 'lat' and 'lng' must be set.")

  const width = Number.parseInt(query.w || WIDTH, 10)
  const height = Number.parseInt(query.h || HEIGHT, 10)
  const zoom = Number.parseInt(query.z || ZOOM, 10)

  return { latitude, longitude, zoom, width, height }
}

export default async function handler(req, res) {
  try {
    const { latitude, longitude, zoom, width, height } = parseQuery(req)

    const [shiftX, shiftY] = location2pixel(latitude, longitude, zoom).map(
      (n) => (n % TILE_SIZE) - TILE_SIZE / 2
    )

    const [shiftCol, shiftRow] = [shiftX >= 0 ? 0 : -1, shiftY >= 0 ? 0 : -1]

    const actualWidth = width + ((shiftX + TILE_SIZE) % TILE_SIZE)
    const actualHeight = height + ((shiftY + TILE_SIZE) % TILE_SIZE)

    const colCount = Math.ceil(actualWidth / TILE_SIZE)
    const rowCount = Math.ceil(actualHeight / TILE_SIZE)

    const [targetX, targetY] = location2tile(latitude, longitude, zoom)

    const center = {
      x: Math.floor(width / TILE_SIZE / 2),
      y: Math.floor(height / TILE_SIZE / 2),
    }

    const tileUrls = Array.from(Array(rowCount * colCount), (_, i) => {
      const rowIndex = Math.floor(i / colCount)
      const colIndex = i % colCount
      const x = targetX + colIndex - center.x + shiftCol
      const y = targetY + rowIndex - center.y + shiftRow
      const s = 'abc'.charAt(i % 3)

      return `http://${s}.tile.openstreetmap.org/${zoom}/${x}/${y}.png`
    })

    const tiles = await Promise.all(
      tileUrls.map((url) => axios({ url, responseType: 'arraybuffer' }))
    )

    // TODO: Streams could potentially speed up processing
    //       and reduce memory usage. However, on the first try I had no success
    //       to pipe this all together.
    const buffer = await sharp({
      create: {
        width: colCount * TILE_SIZE,
        height: rowCount * TILE_SIZE,
        channels: 3,
        background: 'white',
      },
    })
      .composite(
        tiles.map((response, i) => {
          const { data } = response
          return {
            input: data,
            top: Math.floor(i / colCount) * TILE_SIZE,
            left: (i % colCount) * TILE_SIZE,
          }
        })
      )
      .png()
      .toBuffer()
      .then((interBuffer) =>
        sharp(interBuffer)
          .extract({
            top: (shiftY + TILE_SIZE) % TILE_SIZE,
            left: (shiftX + TILE_SIZE) % TILE_SIZE,
            width,
            height,
          })
          .toBuffer()
      )
    res.setHeader('Content-Type', 'image/png').end(buffer)
  } catch (error) {
    res.status(400).end(error.message)
  }
}
