#!/usr/bin/env node

const handler = require('./runner')

const name = 'config'
const description = 'Builds runtime configuration.'

const builder = (yargs) =>
  yargs
    .positional('output', {
      describe: 'output file path',
      type: 'string',
    })
    .help()

if (require.main === module) {
  require('yargs')
    .scriptName(name)
    .usage('$0 [output]', description, builder, handler).argv
}

module.exports = { command: name, desc: description, builder, handler }
