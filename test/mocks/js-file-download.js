// js-file-download factory spy (40 §2.1). The package is a CommonJS function
// (module.exports = fileDownload), which api/search.js reads with require()
// and calls, so the spy is callable itself; `.default` serves
// `import FileDownload from 'js-file-download'` through Babel's default
// interop.
const fileDownload = jest.fn()
fileDownload.default = fileDownload

module.exports = fileDownload
