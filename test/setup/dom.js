// setupFilesAfterEnv of the dom project (40 §2.1): jest-dom matchers, and every console.error/console.warn
// outside test/console-allow/react-<major.minor>.json fails the test that printed it.
require('@testing-library/jest-dom')
require('./jsdom-gaps')
const util = require('util')
const { version } = require('react/package.json')

const allowFile = `../console-allow/react-${version.split('.').slice(0, 2).join('.')}.json`
const allow = require(allowFile).entries.map((e) => ({ ...e, re: new RegExp(e.pattern) }))

const seen = []
const original = { error: console.error, warn: console.warn }

for (const level of ['error', 'warn']) {
  // eslint-disable-next-line no-console
  console[level] = (...args) => {
    const message = util.format(...args)
    if (!allow.some((e) => e.re.test(message))) seen.push({ level, message })
    original[level](...args)
  }
}

beforeEach(() => {
  seen.length = 0
})

afterEach(() => {
  if (!seen.length) return
  const lines = seen.map((s) => `console.${s.level}: ${s.message.split('\n')[0]}`)
  seen.length = 0
  throw new Error(`unexpected console output (not in ${allowFile.slice(3)}):\n${lines.join('\n')}`)
})
