// T-212 (41 C, R-004, R-018, R-073): T-209 store isolation through the store
// driver, in the node project. jest.isolateModules loads store/index.jsx anew
// (it computes isServer and calls enableStaticRendering at load, 40 §7 rule
// 6); client = `window` defined while the store modules load. React's
// scheduler (loaded through mobx-react-lite -> react-dom) then picks
// MessageChannel, whose port would keep the node process alive; hiding
// MessageChannel during the load makes it use its timer branch instead.
const load = ({ client = false } = {}) => {
  const savedChannel = global.MessageChannel
  if (client) {
    global.window = {}
    global.MessageChannel = undefined
  }
  let mod
  try {
    jest.isolateModules(() => {
      mod = require('../../../store')
    })
  } finally {
    if (client) {
      delete global.window
      global.MessageChannel = savedChannel
    }
  }
  return mod
}

describe('T-212 @P0 store-driver contract: isolation', () => {
  require('../../drivers/store-driver/cases/root')({ load })
})
