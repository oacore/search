#!/usr/bin/env node

const name = 'design'
const description = 'Runs library related scripts.'

if (require.main === module) {
  require('yargs')
    .scriptName(name)
    .describe(description)
    .usage('$0 <command>')
    .command(require('./build'))
    .demandCommand(1)
    .help().argv
}
