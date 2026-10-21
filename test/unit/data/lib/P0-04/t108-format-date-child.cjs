// Child process of T-108 c1. process.env.TZ assigned inside a Jest test does not
// reach the real process (Jest gives each test file its own copy of
// process.env), so each time zone gets a real process started with TZ set. The
// parent sends the expressions to evaluate as JSON on stdin; this script
// evaluates them with the app's formatDate (utils/helpers.js, CommonJS) and
// prints the results as JSON. Dates and undefined are encoded, JSON has no
// notation for them.
const path = require('path')

const { formatDate } = require(path.join(process.argv[2], 'utils/helpers.js'))

const encode = (value) => {
  if (value === undefined) return { undefined: true }
  if (value instanceof Date) return { date: String(value) }
  return value
}

let input = ''
process.stdin.setEncoding('utf8')
process.stdin.on('data', (chunk) => {
  input += chunk
})
process.stdin.on('end', () => {
  const expressions = JSON.parse(input)
  const results = expressions.map((expression) => {
    // eslint-disable-next-line no-new-func
    const value = new Function('formatDate', `return (${expression})`)(
      formatDate
    )
    return encode(value)
  })
  process.stdout.write(
    JSON.stringify({
      timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      results,
    })
  )
})
