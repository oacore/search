// A webpack loader that compiles a module with Babel and only the options the
// rule passes (CS-SEN-4): `babel` is the @babel/core module, the other options
// go to Babel as they are. No babel.config.js and no .babelrc apply, so the
// module gets no core-js import and no helper import of its own config. An
// input map from an earlier loader is used; a `sourceMappingURL` comment of
// the file itself is not read, so the client source maps keep the module's
// own source.
module.exports = function babelSyntaxLoader(source, inputSourceMap) {
  const callback = this.async()
  const { babel, ...options } = this.query
  babel.transform(
    source,
    {
      ...options,
      babelrc: false,
      configFile: false,
      filename: this.resourcePath,
      sourceFileName: this.resourcePath,
      inputSourceMap: inputSourceMap || false,
      sourceMaps: this.sourceMap,
      caller: {
        name: 'babel-syntax-loader',
        supportsStaticESM: true,
        supportsDynamicImport: true,
      },
    },
    (error, result) => {
      if (error) callback(error)
      else if (!result) callback(null, source, inputSourceMap)
      else callback(null, result.code, result.map || undefined)
    }
  )
}
