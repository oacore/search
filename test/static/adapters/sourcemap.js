// Source map v3 reader for the build-artefact adapters (40 §3 layer A, 40 §8
// rule 7). No dependency: the `mappings` string is decoded once per map, and
// originalPositionFor() answers the original source of a generated position
// (line and column 0-based), or null for an unmapped position. Index maps
// (`sections`) are rejected: no Next 10 output uses them.
const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'
const DIGIT = new Map([...B64].map((c, i) => [c, i]))

function decodeVlq(segment) {
  const values = []
  let value = 0
  let shift = 0
  for (const ch of segment) {
    const digit = DIGIT.get(ch)
    if (digit === undefined)
      throw new Error(`invalid base64 VLQ digit ${JSON.stringify(ch)}`)
    value += (digit & 31) << shift
    if (digit & 32) shift += 5
    else {
      values.push(value & 1 ? -(value >>> 1) : value >>> 1)
      value = 0
      shift = 0
    }
  }
  return values
}

// lines[generatedLine] = [[generatedColumn, sourceIndex, originalLine,
// originalColumn] | [generatedColumn]], sorted by generated column
function decodeMappings(mappings) {
  const lines = []
  let source = 0
  let originalLine = 0
  let originalColumn = 0
  for (const lineText of mappings.split(';')) {
    const segments = []
    let column = 0
    for (const seg of lineText.split(',').filter(Boolean)) {
      const v = decodeVlq(seg)
      column += v[0]
      if (v.length >= 4) {
        source += v[1]
        originalLine += v[2]
        originalColumn += v[3]
        segments.push([column, source, originalLine, originalColumn])
      } else segments.push([column])
    }
    segments.sort((a, b) => a[0] - b[0])
    lines.push(segments)
  }
  return lines
}

class SourceMap {
  constructor(json) {
    const map = typeof json === 'string' ? JSON.parse(json) : json
    if (map.sections) throw new Error('index source maps are not supported')
    if (map.version !== 3)
      throw new Error(`source map version ${map.version} is not supported`)
    this.sources = map.sources || []
    this.sourcesContent = map.sourcesContent || []
    this.lines = decodeMappings(map.mappings || '')
  }

  originalPositionFor(line, column) {
    const segments = this.lines[line]
    if (!segments || !segments.length) return null
    let lo = 0
    let hi = segments.length - 1
    let found = -1
    while (lo <= hi) {
      const mid = (lo + hi) >> 1
      if (segments[mid][0] <= column) {
        found = mid
        lo = mid + 1
      } else hi = mid - 1
    }
    if (found < 0 || segments[found].length < 4) return null
    const [, source, originalLine, originalColumn] = segments[found]
    return {
      source: this.sources[source],
      line: originalLine,
      column: originalColumn,
    }
  }
}

// generated 0-based (line, column) of every offset in `text`, for a sorted
// list of offsets
function positionsOf(text, offsets) {
  const out = []
  let line = 0
  let lineStart = 0
  let i = 0
  for (const offset of offsets) {
    for (; i < offset; i++) {
      if (text.charCodeAt(i) === 10) {
        line++
        lineStart = i + 1
      }
    }
    out.push({ line, column: offset - lineStart })
  }
  return out
}

module.exports = { SourceMap, decodeVlq, decodeMappings, positionsOf }
