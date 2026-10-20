// T-012 (41 A): harness self-tests in the Jest `node` project (c1-c4); c5-c7 run in test/static.
const { registerProjectChecks } = require('../../utils/harness-checks')

registerProjectChecks('node')
