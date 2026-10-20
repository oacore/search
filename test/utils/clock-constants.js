// Clock constants shared by test/setup/env-clock.js and test/utils/clock.js (40 §5).
const FIXED_NOW = Date.parse('2026-01-15T12:00:00Z')

const ALL_FAKEABLE = [
  'Date',
  'hrtime',
  'nextTick',
  'performance',
  'queueMicrotask',
  'requestAnimationFrame',
  'cancelAnimationFrame',
  'requestIdleCallback',
  'cancelIdleCallback',
  'setImmediate',
  'clearImmediate',
  'setInterval',
  'clearInterval',
  'setTimeout',
  'clearTimeout',
]

const DATE_ONLY = { doNotFake: ALL_FAKEABLE.filter((n) => n !== 'Date') }

module.exports = { FIXED_NOW, ALL_FAKEABLE, DATE_ONLY }
