// stryker.config.mjs - C2 mutation score (55 C2, VF-08). The run is started locally with `npm run mutation`
// (= `stryker run stryker.config.mjs`, 40 §10); the lean track runs one sampled pass at the stabilisation gate
// (55 §0). StrykerJS 10 with @stryker-mutator/jest-runner (02), on the tooling
// Node 24 (40 §2.1); the Jest projects `node` and `dom` of jest.config.js are the test suite.
//
// Mutated set (55 C2): api/ utils/ store/ hooks/ lib/ data/ templates/**/{utils,hooks}/ (.ts/.tsx included for 6.6).
// Score = Stryker's mutationScore, where a mutant no test covers counts as survived. Exclusions live only here,
// each with its reason: EXCLUDED_MUTATE (files) and EXCLUDED_MUTATORS (mutator names), both empty at 2.7.
//
// VF-08 (settled at 2.7). Stryker 10 parses and instruments with Babel 8, and Babel 8's parse loads the project-wide
// babel.config.js of its working directory: the repo's Babel 7 config (preset-env 7, legacy decorators) then
// fails every file with `Requires Babel "^7.0.0-0", but was loaded with "8.0.x"`. So the run does not start in the
// checkout: this config copies the files git lists for the checkout (tracked and untracked, ignore rules
// applied) into a staging directory without babel.config.js and moves the process there before Stryker reads
// the project. The instrumenter then sees no project config and parses with PARSER_PLUGINS (`decorators-legacy`
// for the MobX stores, `jsx`, `exportDefaultFrom`); Jest keeps compiling with the unchanged Babel 7 config, passed
// to babel-jest explicitly by path. Nothing in the checkout is written; the app files are never touched.
//
// Other Jest adjustments (the test runs themselves are as `npm run test:unit` runs them):
// - testEnvironment and testSequencer: generated modules (see jestHelpers);
// - testNamePattern: leaves out EXCLUDED_TESTS (tests that are red only on Stryker's Node 24, each with a reason);
// - testPathIgnorePatterns: also EXCLUDED_TEST_FILES (test files that execute no statement of the set, left out
//   for their run time only, each with its evidence);
// - resolver: the checkout's test/esm-resolver.js (the sandbox links node_modules, so resolved package paths are
//   those of the checkout's node_modules, which that copy expects);
// - TZ=UTC as in `npm run test:unit`; a private Jest cache directory.
//
// Output (never in the checkout): $MUTATION_OUT, else $ARTIFACT_DIR/mutation, else ../search-upgrade-artifacts/
// mutation (40 §2): mutation.html, mutation.json (mutation-testing-report-schema), stryker-incremental.json
// (incremental mode, kept between runs; also saved, partial, when a run is stopped with SIGINT/SIGTERM, so a run
// cut at a time cap resumes), events/ (every result as soon as it is known), project/ (staging copy), tmp/
// (sandboxes), jest-env/, jest-cache/, test-names/. Concurrency: $MUTATION_CONCURRENCY, else Stryker's default.
//
// Scores (the numbers the step and gate records read): `node stryker.config.mjs --scores <mutation.json>...`
// prints overall and per CORE entry (JSON with --json); several reports of disjoint `--mutate` subsets are read as
// one. Score = Stryker's mutationScore: (Killed + Timeout) / (Killed + Timeout + Survived + NoCoverage); compile
// and runtime errors and ignored mutants are left out, as Stryker leaves them out.
import fs from 'node:fs'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'

const ROOT = path.dirname(fileURLToPath(import.meta.url))
const OUT = path.resolve(
  process.env.MUTATION_OUT ||
    path.join(
      process.env.ARTIFACT_DIR ||
        path.join(ROOT, '..', 'search-upgrade-artifacts'),
      'mutation'
    )
)
const STAGE = path.join(OUT, 'project')
// the side effects (staging copy, chdir, generated environment) happen only when Stryker loads this file
const BY_STRYKER = (() => {
  try {
    return (
      path.basename(fs.realpathSync(process.argv[1] || '')) === 'stryker.js'
    )
  } catch {
    return false
  }
})()
const PROJECT = BY_STRYKER ? STAGE : ROOT

export const MUTATE = [
  'api/**/*.{js,jsx,ts,tsx}',
  'utils/**/*.{js,jsx,ts,tsx}',
  'store/**/*.{js,jsx,ts,tsx}',
  'hooks/**/*.{js,jsx,ts,tsx}',
  'lib/**/*.{js,jsx,ts,tsx}',
  'data/**/*.{js,jsx,ts,tsx}',
  'templates/**/utils/**/*.{js,jsx,ts,tsx}',
  'templates/**/hooks/**/*.{js,jsx,ts,tsx}',
]
// [glob, reason]; a reason is required (55 C2)
export const EXCLUDED_MUTATE = []
// [mutator name, reason]
export const EXCLUDED_MUTATORS = []

// the core files of 55 C2 (>= 90% each); an entry ending in `/` is a folder (all its files as one)
export const CORE = [
  'api/index.js',
  'api/internalize.js',
  'utils/filters-transform.js',
  'store/filters.js',
  'hooks/use-sync-url-params-with-store/',
]

const DETECTED = new Set(['Killed', 'Timeout'])
const UNDETECTED = new Set(['Survived', 'NoCoverage'])
// reports: parsed mutation-testing-report-schema JSON files (disjoint file sets)
export function scores(reports) {
  const files = {}
  for (const r of reports)
    for (const [name, f] of Object.entries(r.files || {})) {
      if (files[name]) throw new Error(`${name} is in two reports`)
      files[name] = f
    }
  const tally = (names) => {
    const status = {}
    let detected = 0
    let valid = 0
    for (const n of names)
      for (const m of files[n].mutants) {
        status[m.status] = (status[m.status] || 0) + 1
        if (DETECTED.has(m.status)) detected++
        if (DETECTED.has(m.status) || UNDETECTED.has(m.status)) valid++
      }
    return {
      files: names.length,
      detected,
      valid,
      score: valid ? Math.round((10000 * detected) / valid) / 100 : null,
      status,
    }
  }
  const names = Object.keys(files).sort()
  const inCore = (c) => (n) => c.endsWith('/') ? n.startsWith(c) : n === c
  return {
    overall: tally(names),
    core: Object.fromEntries(
      CORE.map((c) => [c, tally(names.filter(inCore(c)))])
    ),
    perFile: Object.fromEntries(names.map((n) => [n, tally([n])])),
  }
}

export const PARSER_PLUGINS = ['decorators-legacy', 'jsx', 'exportDefaultFrom']

// staging copy: the checkout as git lists it, minus babel.config.js (VF-08) and the Playwright baselines
// (`*-snapshots/`, read by no Jest test)
const SKIP = [/^babel\.config\.js$/, /(^|\/)[^/]+-snapshots\//]

function stage() {
  const list = execFileSync(
    'git',
    [
      '-C',
      ROOT,
      'ls-files',
      '-z',
      '--cached',
      '--others',
      '--exclude-standard',
    ],
    { encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 }
  )
    .split('\0')
    .filter(Boolean)
  fs.rmSync(STAGE, { recursive: true, force: true })
  fs.rmSync(NAMES, { recursive: true, force: true })
  fs.mkdirSync(STAGE, { recursive: true })
  for (const rel of list) {
    if (SKIP.some((re) => re.test(rel))) continue
    const from = path.join(ROOT, rel)
    let st
    try {
      st = fs.lstatSync(from)
    } catch {
      continue // deleted in the working tree
    }
    if (!st.isFile()) continue
    const to = path.join(STAGE, rel)
    fs.mkdirSync(path.dirname(to), { recursive: true })
    fs.copyFileSync(from, to)
  }
  // node_modules: a real directory (Stryker links only directories into its sandboxes) whose entries link to
  // the checkout's packages
  const nm = path.join(STAGE, 'node_modules')
  fs.mkdirSync(nm)
  for (const entry of fs.readdirSync(path.join(ROOT, 'node_modules')))
    fs.symlinkSync(path.join(ROOT, 'node_modules', entry), path.join(nm, entry))
}

// Generated helper modules (output directory, written only when Stryker loads this file):
// - project-environment.cjs, the test environment of both projects: Jest spreads the top-level options of a
//   `--config` JSON (the form in which the Stryker runner passes the config) into every project, and the runner
//   sets the top-level testEnvironment to its coverage wrapper, which loads the top-level testEnvironment named
//   here. It returns the environment of the test file's project (`dom` -> jest-fixed-jsdom, else node) and
//   records the full test names of each test file in test-names/. In a mutant run (Stryker sets
//   __STRYKER_ACTIVE_MUTANT__) it also bails: once a test of the run has failed, every later test of that run
//   is skipped. The Jest runner cannot bail itself (it forces Jest's `bail` off), and a mutant is Killed as soon
//   as one covering test fails, so the status of every mutant is the one a full run gives; only the killing
//   tests after the first are not run. The dry run (no active mutant) runs every test;
// - test-file-filter.cjs, the testSequencer: in a mutant run (Stryker passes the covering tests as
//   testNamePattern) it drops the test files that hold none of them. Those files would run no test anyway, so
//   the result is the same; it only spares loading them (each mutated file has ~40 related test files). It then
//   orders the files: those that failed in their last run first, then by their last duration, shortest first
//   (Jest's own order runs the longest first), so a killing test is usually reached early;
// - bail-test-runner.cjs, the testRunner of both projects (jest-circus): in a mutant run that has already failed
//   it returns a file's result as skipped without loading the file. Set per project only: Stryker's perTest
//   check reads the top-level testRunner, which stays jest-circus.
const NAMES = path.join(OUT, 'test-names')
function jestHelpers() {
  const dir = path.join(OUT, 'jest-env')
  const env = path.join(dir, 'project-environment.cjs')
  const sequencer = path.join(dir, 'test-file-filter.cjs')
  const runner = path.join(dir, 'bail-test-runner.cjs')
  if (!BY_STRYKER) return { env, sequencer, runner }
  fs.mkdirSync(dir, { recursive: true })
  fs.writeFileSync(
    env,
    `// generated by stryker.config.mjs: the jest.config.js environment of the test file's project
'use strict'
const fs = require('fs')
const path = require('path')
const NAMES = ${JSON.stringify(NAMES)}
const load = (name) => require(require.resolve(name, { paths: [process.cwd()] }))
const fullName = (test) => {
  const parts = [test.name]
  for (let d = test.parent; d && d.parent; d = d.parent) parts.unshift(d.name)
  return parts.join(' ')
}
// bail state of the mutant run in progress (Jest runs in band in a Stryker test runner process: one run at a time)
const BAIL = global.__p2StrykerBail || (global.__p2StrykerBail = { mutant: null, failed: false })
module.exports = function ProjectEnvironment(config, context) {
  const d = config.projectConfig.displayName
  const name = d && typeof d === 'object' ? d.name : d
  const mod = name === 'dom' ? load('jest-fixed-jsdom') : load('jest-environment-node')
  const Env = mod.TestEnvironment || mod.default || mod
  const names = new Set()
  class Recording extends Env {
    async handleTestEvent(event, state) {
      if (event.name === 'test_start') names.add(fullName(event.test))
      const active = process.env.__STRYKER_ACTIVE_MUTANT__
      if (active) {
        if (BAIL.mutant !== active) {
          BAIL.mutant = active
          BAIL.failed = false
        }
        if (event.name === 'test_start' && BAIL.failed) event.test.mode = 'skip'
        if (event.name === 'test_done' && event.test.errors.length) BAIL.failed = true
      }
      if (super.handleTestEvent) await super.handleTestEvent(event, state)
    }
    async teardown() {
      try {
        fs.mkdirSync(NAMES, { recursive: true })
        fs.appendFileSync(path.join(NAMES, process.pid + '.jsonl'), JSON.stringify({ file: context.testPath, names: [...names] }) + '\\n')
      } catch (e) {}
      await super.teardown()
    }
  }
  return new Recording(config, context)
}
`
  )
  fs.writeFileSync(
    sequencer,
    `// generated by stryker.config.mjs: drops test files that hold none of the tests a mutant run asks for
'use strict'
const fs = require('fs')
const path = require('path')
const Base = require(require.resolve('@jest/test-sequencer', { paths: [process.cwd()] })).default
const NAMES = ${JSON.stringify(NAMES)}
const recorded = () => {
  const map = new Map()
  let files = []
  try { files = fs.readdirSync(NAMES) } catch (e) { return map }
  for (const f of files)
    for (const line of fs.readFileSync(path.join(NAMES, f), 'utf8').split('\\n')) {
      if (!line) continue
      let r
      try { r = JSON.parse(line) } catch (e) { continue }
      const set = map.get(r.file) || new Set()
      for (const n of r.names) set.add(n)
      map.set(r.file, set)
    }
  return map
}
module.exports = class TestFileFilter extends Base {
  constructor(options) {
    super(options)
    this.pattern = options && options.globalConfig ? options.globalConfig.testNamePattern : null
  }
  sort(tests) {
    if (this.pattern) {
      const map = recorded()
      if (map.size) {
        const re = new RegExp(this.pattern, 'i')
        // a file without a record (it never ran here) is kept
        tests = tests.filter((t) => !map.has(t.path) || [...map.get(t.path)].some((n) => re.test(n)))
      }
    }
    if (!process.env.__STRYKER_ACTIVE_MUTANT__) return super.sort(tests)
    // mutant run: last failed first, then shortest last duration first, files without a duration last
    const key = (t) => [this.hasFailed(t) ? 0 : 1, this.time(t) == null ? 1 : 0, this.time(t) || 0, t.path]
    return tests
      .map((t) => ({ t, k: key(t) }))
      .sort((a, b) => {
        for (let i = 0; i < a.k.length; i++) if (a.k[i] !== b.k[i]) return a.k[i] < b.k[i] ? -1 : 1
        return 0
      })
      .map((x) => x.t)
  }
}
`
  )
  fs.writeFileSync(
    runner,
    `// generated by stryker.config.mjs: jest-circus, except that a mutant run skips the test files after its first
// failure without loading them (the environment above records the failure)
'use strict'
const BAIL = global.__p2StrykerBail || (global.__p2StrykerBail = { mutant: null, failed: false })
const load = (name) => require(require.resolve(name, { paths: [process.cwd()] }))
const circus = load('jest-circus/runner')
const runCircus = circus.default || circus
const { createEmptyTestResult } = load('@jest/test-result')
module.exports = async function bailTestRunner(globalConfig, config, environment, runtime, testPath, sendMessageToJest) {
  const active = process.env.__STRYKER_ACTIVE_MUTANT__
  if (active && BAIL.mutant === active && BAIL.failed) {
    // one pending entry: Jest reports a file without any test result as a failed suite
    const result = createEmptyTestResult()
    result.testFilePath = testPath
    result.numPendingTests = 1
    result.testResults = [
      {
        ancestorTitles: [],
        duration: 0,
        failureDetails: [],
        failureMessages: [],
        fullName: 'not run: the mutant run had failed',
        invocations: 0,
        location: null,
        numPassingAsserts: 0,
        retryReasons: [],
        status: 'pending',
        title: 'not run: the mutant run had failed',
      },
    ]
    return result
  }
  return runCircus(globalConfig, config, environment, runtime, testPath, sendMessageToJest)
}
`
  )
  return { env, sequencer, runner }
}

// tests left out of the Stryker run: [full-name fragment, reason] (each must be red on the unchanged app under
// Stryker's Node 24 only; Jest itself runs them on the runtime Node, 40 §2.1)
export const EXCLUDED_TESTS = [
  [
    'T-504 c5 @P0 as the response is serialised in production',
    'pins the Node 18.20.8 serialisation of a fetch Response (no own `url`); on Node 24 the Response carries `url`, so the test is red on the unchanged app',
  ],
  [
    "T-104 c2 @P0 Jest runs on the Node major of the step's runtime image",
    'asserts that Jest itself runs on the runtime Node major (18); Stryker runs Jest on Node 24',
  ],
]
// test files left out of the Stryker run: [repository path, reason]. Only a file that executes no statement of
// the mutated set may be listed (it can kill no mutant, so every mutant keeps its status); it is listed only
// for its run time, because Jest's related-test search and Stryker's static mutants would run it in every pass
export const EXCLUDED_TEST_FILES = [
  [
    'test/unit/design/t417-design-contract.test.jsx',
    'T-417 tests @oacore/design (node_modules) and design.config.js only: its one path to the set is the lazy `require` of store/ inside `withStore` of test/utils/render.js, which it never calls, and the 2.7 dry run of the core files gave it no covered mutant; it is ~27 min of every run (98 tests, interaction census) that runs it',
  ],
]
const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
const exclusionPattern = () =>
  EXCLUDED_TESTS.length
    ? `^(?!.*(?:${EXCLUDED_TESTS.map(([t]) => escapeRe(t)).join('|')})).*$`
    : undefined

function jestProjects() {
  const base = createRequire(path.join(PROJECT, 'package.json'))(
    path.join(PROJECT, 'jest.config.js')
  )
  const babelConfig = path.join(ROOT, 'babel.config.js')
  return ['node', 'dom'].map((name) => {
    const p = base.projects.find((x) => x.displayName === name)
    if (!p) throw new Error(`jest.config.js has no project ${name}`)
    // rootDir comes from the sandbox the test runner works in
    const { rootDir, ...rest } = p
    const transform = Object.fromEntries(
      Object.entries(rest.transform).map(([re, t]) => [
        re,
        t === 'babel-jest' ? ['babel-jest', { configFile: babelConfig }] : t,
      ])
    )
    return {
      ...rest,
      transform,
      testPathIgnorePatterns: [
        ...(rest.testPathIgnorePatterns || ['/node_modules/']),
        ...EXCLUDED_TEST_FILES.map(([file]) => `/${escapeRe(file)}$`),
      ],
      resolver: path.join(ROOT, 'test', 'esm-resolver.js'),
      cacheDirectory: path.join(OUT, 'jest-cache'),
      // per project only: Stryker's perTest check reads the top-level testRunner (jest-circus, the default)
      testRunner: helpers.runner,
    }
  })
}

if (BY_STRYKER) {
  process.env.TZ = 'UTC'
  stage()
  process.chdir(STAGE)
}

const helpers = jestHelpers()
const mutate = [...MUTATE, ...EXCLUDED_MUTATE.map(([glob]) => `!${glob}`)]

export default {
  packageManager: 'npm',
  testRunner: 'jest',
  plugins: ['@stryker-mutator/jest-runner'],
  coverageAnalysis: 'perTest',
  mutate,
  mutator: {
    plugins: PARSER_PLUGINS,
    excludedMutations: EXCLUDED_MUTATORS.map(([name]) => name),
  },
  jest: {
    projectType: 'custom',
    configFile: 'jest.config.js',
    config: {
      testEnvironment: helpers.env,
      testSequencer: helpers.sequencer,
      testNamePattern: exclusionPattern(),
      projects: jestProjects(),
    },
    enableFindRelatedTests: true,
  },
  ignorePatterns: [],
  tempDirName: path.join(OUT, 'tmp'),
  cleanTempDir: true,
  incremental: true,
  incrementalFile: path.join(OUT, 'stryker-incremental.json'),
  // event-recorder: every mutant result is on disk as soon as it is known (events/), so a run stopped at a time
  // cap still yields the scores of the mutants it tested (`--scores-events`)
  reporters: [
    'clear-text',
    'progress-append-only',
    'html',
    'json',
    'event-recorder',
  ],
  eventReporter: { baseDir: path.join(OUT, 'events') },
  clearTextReporter: {
    allowColor: false,
    logTests: false,
    reportMutants: false,
  },
  htmlReporter: { fileName: path.join(OUT, 'mutation.html') },
  jsonReporter: { fileName: path.join(OUT, 'mutation.json') },
  // 55 C2 thresholds; `break` stays unset: the gate reads the report (overall >= 80, each CORE file >= 90,
  // none below its 2.7 value), Stryker does not fail the run
  thresholds: { high: 90, low: 80, break: null },
  timeoutMS: 30000,
  timeoutFactor: 2,
  // the initial run executes the whole suite in one process (Stryker runs Jest in band)
  dryRunTimeoutMinutes: 60,
  ...(process.env.MUTATION_CONCURRENCY
    ? { concurrency: Number(process.env.MUTATION_CONCURRENCY) }
    : {}),
}

// the repository path of a file of the staging copy or of a sandbox
const repoPath = (f) => {
  const m = /\/(?:project|tmp\/sandbox-[^/]+)\/(.+)$/.exec(
    f.split(path.sep).join('/')
  )
  return m ? m[1] : f
}
const mutantKey = (file, m) =>
  [
    file,
    m.mutatorName,
    m.replacement,
    m.location.start.line,
    m.location.start.column,
    m.location.end.line,
    m.location.end.column,
  ].join('|')
// a planned mutant carries Stryker's internal 0-based location; results and reports are 1-based
const reportLocation = ({ start, end }) => ({
  start: { line: start.line + 1, column: start.column + 1 },
  end: { line: end.line + 1, column: end.column + 1 },
})
const planKey = (mutant) =>
  mutantKey(repoPath(mutant.fileName), {
    ...mutant,
    location: reportLocation(mutant.location),
  })
const readEvents = (dir) => {
  const names = fs.readdirSync(dir).sort()
  const read = (f) => JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'))
  const one = (suffix) => {
    const f = names.find((n) => n.endsWith(suffix))
    return f ? read(f) : null
  }
  return {
    plan: one('-onMutationTestingPlanReady.json'),
    tested: names.filter((n) => n.endsWith('-onMutantTested.json')).map(read),
  }
}

// the event-recorder files of runs (`<out>/events`, in run order) as one report: every mutant planned by the
// last run with its latest result (a later run's result of the same mutant wins), or `Pending` (not tested
// before the runs stopped; left out of the score like Stryker's own pending mutants)
export function reportFromEvents(dirs) {
  const runs = [].concat(dirs).map(readEvents)
  const last = runs[runs.length - 1]
  if (!last.plan)
    throw new Error('the last run has no onMutationTestingPlanReady event')
  const status = new Map()
  for (const run of runs) {
    for (const { mutant, plan } of run.plan ? run.plan.mutantPlans : [])
      if (plan === 'EarlyResult' && mutant.status)
        status.set(planKey(mutant), mutant.status)
    for (const m of run.tested)
      status.set(mutantKey(repoPath(m.fileName), m), m.status)
  }
  const files = {}
  for (const { mutant } of last.plan.mutantPlans) {
    const name = repoPath(mutant.fileName)
    files[name] = files[name] || { mutants: [] }
    files[name].mutants.push({
      id: mutant.id,
      status: status.get(planKey(mutant)) || 'Pending',
    })
  }
  return { files }
}

// `node stryker.config.mjs --scores <report.json>... [--json]`: the scores of the given reports (disjoint file
// sets; mutation.json, or stryker-incremental.json, which Stryker also saves, partial, when a run is stopped by
// SIGINT/SIGTERM, e.g. at a time cap: the next run reuses it); `--scores-events <out>/events...`: the same from
// the event-recorder files of runs of one file set, in run order, with the not-yet-tested mutants counted
if (
  !BY_STRYKER &&
  path.resolve(process.argv[1] || '') === fileURLToPath(import.meta.url) &&
  (process.argv.includes('--scores') ||
    process.argv.includes('--scores-events'))
) {
  const args = process.argv.slice(2).filter((a) => !a.startsWith('--'))
  const s = scores(
    process.argv.includes('--scores-events')
      ? [reportFromEvents(args)]
      : args.map((f) => JSON.parse(fs.readFileSync(f, 'utf8')))
  )
  if (process.argv.includes('--json'))
    process.stdout.write(`${JSON.stringify(s, null, 1)}\n`)
  else {
    const row = (k, t) =>
      `| ${k} | ${t.files} | ${t.detected} | ${t.valid} | ${
        t.status.Pending || 0
      } | ${t.score === null ? 'n/a' : `${t.score}%`} |`
    console.log(
      [
        '| Scope | Files | Detected | Valid | Not tested | Score |',
        '|---|---|---|---|---|---|',
        row('overall', s.overall),
        ...Object.entries(s.core).map(([k, t]) => row(k, t)),
      ].join('\n')
    )
  }
}
