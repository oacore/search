// setupFiles (runs before any test module is imported, 40 §2.1 and §5):
// build-time env values as env.config.js inlines them for the parity build, and
// a frozen Date. MAX_YEAR
// (modules/filters/year/hooks/use-year-filter-controller.js:6) is computed at
// module load.
const { FIXED_NOW, DATE_ONLY } = require('../utils/clock-constants')

process.env.API_KEY = 'test-key'
process.env.API_URL = 'https://api.core.ac.uk/internal'

// only Date is faked here; timers stay real until a test installs them
// (test/utils/clock.js)
jest.useFakeTimers({ now: FIXED_NOW, doNotFake: DATE_ONLY.doNotFake })
