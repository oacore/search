// Babel config of the Jest transform only (babel-jest in jest.config.js). The
// app build compiles with SWC (CS-SWC-1); Next reads no file of this name.
module.exports = {
  presets: [
    '@babel/preset-env',
    ['@babel/preset-react', { runtime: 'automatic' }],
    ['@babel/preset-typescript', { onlyRemoveTypeImports: true }],
  ],
  sourceType: 'unambiguous',
}
