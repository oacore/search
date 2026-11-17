// Jest configuration of the parity harness (docs/upgrade/40-test-strategy.md
// §2.1). babel-jest with jest.babel.config.js (CS-SWC-1); never next/jest.
// jest.swc.config.js runs the same projects through @swc/jest.
// Every project carries its own transform, transformIgnorePatterns,
// moduleNameMapper and setupFiles: a top-level transform is ignored by
// projects.
const path = require('path')

const esmAllowList = require('./test/esm-allow-list.json')

const escape = (s) =>
  s.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '[^/]+')
const allowed = esmAllowList.packages.map(escape).join('|')

// the live aliases of next.config.js:86-100 (`config` points at a file that
// does not exist)
const ALIASES = [
  'api',
  'data',
  'main',
  'hooks',
  'store',
  'utils',
  'templates',
  'modules',
  'lib',
]

const shared = {
  rootDir: __dirname,
  transform: {
    '\\.module\\.css$': '<rootDir>/test/transforms/css-module.js',
    '\\.(png|jpe?g|gif|svg|webp|ico|bmp)$':
      '<rootDir>/test/transforms/file-url.js',
    '\\.[jt]sx?$': [
      'babel-jest',
      { configFile: path.join(__dirname, 'jest.babel.config.js') },
    ],
  },
  // one pattern (T-012 c2): node_modules except the ESM allow-list, and the
  // vendored bibtexParse.js, which the build leaves untransformed (CS-BIB-1),
  // so Jest loads it untransformed too
  transformIgnorePatterns: [
    `/node_modules/(?!(?:${allowed})/)|/vendor/bibtex-parse-js/`,
  ],
  moduleNameMapper: {
    // synthetic copies with the real top-level shape (no `data` key in
    // statistics: Q-004)
    '^data/\\.(statistics|formap|members)\\.json$':
      '<rootDir>/test/fixtures/data/.$1.json',
    '^next/router$': '<rootDir>/test/mocks/next-router.js',
    // global CSS (not CSS modules) -> empty style object
    '^(?!.*\\.module\\.css$).+\\.css$': '<rootDir>/test/mocks/style.js',
    [`^(${ALIASES.join('|')})(/.*)?$`]: '<rootDir>/$1$2',
  },
  moduleFileExtensions: [
    'js',
    'jsx',
    'ts',
    'tsx',
    'json',
    'cjs',
    'mjs',
    'node',
  ],
  // admits allow-listed packages that ship `.mjs` (VF-07)
  resolver: '<rootDir>/test/esm-resolver.js',
  setupFiles: ['<rootDir>/test/setup/env-clock.js'],
  testPathIgnorePatterns: [
    '/node_modules/',
    '<rootDir>/e2e/',
    '<rootDir>/.next/',
  ],
  // git-excluded local work folders hold unpacked packages: a second
  // package.json named like an installed one makes the haste map ambiguous;
  // the vendored design is such a package (CS-DSN-2: tests load the
  // installed copy, node_modules/@oacore/design)
  modulePathIgnorePatterns: [
    '<rootDir>/\\.p2-work/',
    '<rootDir>/vendor/oacore-design/',
  ],
  coveragePathIgnorePatterns: [
    '/node_modules/',
    '<rootDir>/vendor/oacore-design/',
  ],
}

module.exports = {
  projects: [
    {
      ...shared,
      displayName: 'node',
      testEnvironment: 'node',
      testMatch: ['<rootDir>/test/{unit,pages}/**/*.test.js'],
      setupFilesAfterEnv: ['<rootDir>/test/setup/mocks.js'],
    },
    {
      ...shared,
      displayName: 'dom',
      testEnvironment: 'jest-fixed-jsdom',
      testEnvironmentOptions: { url: 'http://localhost/' },
      testMatch: ['<rootDir>/test/{unit,pages}/**/*.test.jsx'],
      setupFilesAfterEnv: [
        '<rootDir>/test/setup/mocks.js',
        '<rootDir>/test/setup/dom.js',
      ],
    },
    {
      ...shared,
      displayName: 'static',
      testEnvironment: 'node',
      testMatch: ['<rootDir>/test/static/**/*.test.js'],
      setupFilesAfterEnv: ['<rootDir>/test/setup/mocks.js'],
    },
    {
      // ops tests (T-902, T-903, T-904, T-908): plain CommonJS over the tools
      // and recorded reports, no transform and no setup files
      rootDir: __dirname,
      displayName: 'ops',
      testEnvironment: 'node',
      testMatch: ['<rootDir>/test/ops/**/*.test.js'],
      transform: {},
      modulePathIgnorePatterns: [
        '<rootDir>/\\.p2-work/',
        '<rootDir>/vendor/oacore-design/',
      ],
      coveragePathIgnorePatterns: [
        '/node_modules/',
        '<rootDir>/vendor/oacore-design/',
      ],
      testPathIgnorePatterns: ['/node_modules/', '<rootDir>/.next/'],
    },
  ],
}
