#!/usr/bin/env node

const handler = require('./runner')

const name = 'icons'
const description = 'Copies icons and builds a sprite.'

if (require.main === module) {
  require('yargs').scriptName(name).usage('$0', description, handler).help()
    .argv
}

module.exports = {
  command: name,
  desc: description,
  handler,
}
