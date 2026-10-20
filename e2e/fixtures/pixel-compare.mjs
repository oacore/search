// Exact RGBA comparator (40 §1), without Playwright so Jest (T-012) and scripts can run it:
// pass = equal size and 0 differing pixels; anti-aliased pixels count (Playwright's own comparator skips them).
//
// CLI: node e2e/fixtures/pixel-compare.mjs <a.png> <b.png> [--diff <out.png>] [--json]   (exit 0 = identical)
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { PNG } from 'pngjs'

export const COMPARATOR = 'exact-rgba-v1'

export const decodePng = (buf) => PNG.sync.read(buf)

// returns { sameSize, width, height, diffPixels, diffPng (Buffer or null) }
export function comparePngs(a, b, { diff = true } = {}) {
  const A = Buffer.isBuffer(a) ? decodePng(a) : a
  const B = Buffer.isBuffer(b) ? decodePng(b) : b
  if (A.width !== B.width || A.height !== B.height) {
    return { sameSize: false, width: [A.width, B.width], height: [A.height, B.height], diffPixels: Math.max(A.width * A.height, B.width * B.height), diffPng: null }
  }
  const { width, height } = A
  const out = diff ? new PNG({ width, height }) : null
  let diffPixels = 0
  for (let i = 0; i < width * height; i++) {
    const o = i * 4
    const same = A.data[o] === B.data[o] && A.data[o + 1] === B.data[o + 1] && A.data[o + 2] === B.data[o + 2] && A.data[o + 3] === B.data[o + 3]
    if (!same) diffPixels++
    if (out) {
      if (same) {
        // faded copy of the expected image
        const g = Math.round(255 - (255 - (A.data[o] * 0.3 + A.data[o + 1] * 0.59 + A.data[o + 2] * 0.11)) * 0.1)
        out.data[o] = g
        out.data[o + 1] = g
        out.data[o + 2] = g
        out.data[o + 3] = 255
      } else {
        out.data[o] = 255
        out.data[o + 1] = 0
        out.data[o + 2] = 0
        out.data[o + 3] = 255
      }
    }
  }
  return { sameSize: true, width, height, diffPixels, diffPng: out && diffPixels ? PNG.sync.write(out) : null }
}

function main(argv) {
  const files = argv.filter((a, i) => !a.startsWith('--') && argv[i - 1] !== '--diff')
  const i = argv.indexOf('--diff')
  const r = comparePngs(fs.readFileSync(files[0]), fs.readFileSync(files[1]))
  if (i >= 0 && r.diffPng) fs.writeFileSync(argv[i + 1], r.diffPng)
  const res = { comparator: COMPARATOR, sameSize: r.sameSize, width: r.width, height: r.height, diffPixels: r.diffPixels }
  console.log(argv.includes('--json') ? JSON.stringify(res) : `${r.diffPixels} differing pixels${r.sameSize ? '' : ' (size differs)'}`)
  process.exit(r.sameSize && r.diffPixels === 0 ? 0 : 1)
}

if (fileURLToPath(import.meta.url) === path.resolve(process.argv[1] || '')) main(process.argv.slice(2))
