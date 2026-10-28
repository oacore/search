#!/usr/bin/env node

const configCommand = require('./config')
const iconsCommand = require('./icons')

const name = 'build'
const description = 'Builds part of the library based on the command.'

const handler = async () => {
  await configCommand.handler()
  await iconsCommand.handler()
}

const builder = (yargs) =>
  yargs.command(configCommand).command(iconsCommand).help()

if (require.main === module) {
  require('yargs')
    .scriptName(name)
    .usage('$0 [command]', description, builder, handler).argv
}

module.exports = {
  command: name,
  desc: description,
  builder,
  handler,
}
