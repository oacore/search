// Clock helpers for Jest tests (40 §5). The setup file freezes Date at FIXED_NOW with real timers.
const { FIXED_NOW, DATE_ONLY } = require('./clock-constants')

// fake every timer (setTimeout, intervals, Date, ...) starting at FIXED_NOW
const useFakeTimers = () => jest.useFakeTimers({ now: FIXED_NOW, doNotFake: [] })

// back to the setup default: Date frozen at FIXED_NOW, timers real
const restoreClock = () => {
  jest.useRealTimers()
  jest.useFakeTimers({ now: FIXED_NOW, doNotFake: DATE_ONLY.doNotFake })
}

module.exports = { FIXED_NOW, useFakeTimers, restoreClock }
