// The Jest projects of jest.config.js with @swc/jest in place of babel-jest
// (`npm run test:unit:swc`, CS-SWC-1): the options are Next's own Jest SWC
// options (next/dist/build/swc/options.js getJestSWCOptions, with the
// tsconfig.json compiler options), cut to the keys @swc/core reads. Its pass
// set must equal the babel-jest run's.
const path = require('path')

const { getJestSWCOptions } = require('next/dist/build/swc/options')

const base = require('./jest.config')
const { compilerOptions } = require('./tsconfig.json')

const swcOptions = (filename) => {
  const all = getJestSWCOptions({
    isServer: false,
    filename,
    esm: false,
    jsConfig: { compilerOptions },
    pagesDir: path.join(__dirname, 'pages'),
  })
  const { jsc, env, module, sourceMaps } = all
  const { cacheRoot, ...experimental } = jsc.experimental
  return {
    jsc: { ...jsc, experimental },
    env,
    module,
    sourceMaps,
    swcrc: false,
  }
}

// the babel-jest entry of every project, in the same place of the transform
const swcTransform = (transform) =>
  Object.fromEntries(
    Object.entries(transform).flatMap(([pattern, value]) =>
      pattern === '\\.[jt]sx?$'
        ? [
            ['\\.tsx$', ['@swc/jest', swcOptions('file.tsx')]],
            ['\\.ts$', ['@swc/jest', swcOptions('file.ts')]],
            ['\\.jsx?$', ['@swc/jest', swcOptions('file.js')]],
          ]
        : [[pattern, value]]
    )
  )

module.exports = {
  ...base,
  projects: base.projects.map((project) =>
    project.transform && Object.keys(project.transform).length
      ? { ...project, transform: swcTransform(project.transform) }
      : project
  ),
}
