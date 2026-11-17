// T-119 (41 B, R-055): App.getInitialProps (pages/_app.jsx:125-137). Q-004:
// the statistics file has no `data` key, so the statistics are always the
// fallback {totalArticlesCount: 'more than 356 million'}; the harness synthetic
// copy test/fixtures/data/.statistics.json keeps that shape. Q-007:
// `statistics` is a module-level `let` assigned on every call.
//
// The loaders (lib/*-loader.js) really run: they read data/.statistics.json,
// data/.formap.json and data/.members.json from the working directory (the
// cache hit, no fetch). MSW is on only to make sure nothing can leave the
// process.
const path = require('path')

const Sentry = require('@sentry/nextjs')

const { setupMsw } = require('../../utils/msw')

setupMsw()

const FALLBACK = { totalArticlesCount: 'more than 356 million' }

// the process handlers every load of the app registers, removed after the test
const registered = []

// a fresh copy of the app (and of the loader class it uses): `statistics` is
// module state. `statisticsModule` replaces the baked data/.statistics.json.
// `handlers` are the process listeners the app registered while loading.
const loadApp = (statisticsModule) => {
  const statisticsPath = require.resolve('data/.statistics.json')
  const on = jest.spyOn(process, 'on')
  let App
  let Loader
  let added
  try {
    jest.isolateModules(() => {
      if (statisticsModule) jest.doMock(statisticsPath, () => statisticsModule)
      App = require('../../../pages/_app').default
      Loader = require('../../../lib/loader').default
    })
  } finally {
    added = [...on.mock.calls]
    on.mockRestore()
    if (statisticsModule) jest.dontMock(statisticsPath)
  }
  registered.push(...added)
  return { App, Loader, handlers: Object.fromEntries(added) }
}

describe('T-119 @P0 App.getInitialProps', () => {
  afterEach(() => {
    jest.restoreAllMocks()
    registered
      .splice(0)
      .forEach(([event, handler]) => process.removeListener(event, handler))
  })

  test('T-119 @P0 Q-004 the statistics are the fallback text because the statistics file has no `data` key', async () => {
    // shape of the committed file: a raw object, no `data`
    const raw = require('data/.statistics.json')
    expect(Object.keys(raw)).not.toContain('data')
    expect(typeof raw.totalArticlesCount).toBe('number')

    const { App } = loadApp()
    const props = await App.getInitialProps()
    expect(props).toEqual({ statistics: FALLBACK })
    expect(Object.keys(props)).toEqual(['statistics'])
    expect(Object.keys(props.statistics)).toEqual(['totalArticlesCount'])
    expect(props.statistics.totalArticlesCount).toBe('more than 356 million')
  })

  test('T-119 @P0 Q-004 an empty or null `data` key gives the fallback too', async () => {
    const raw = require('data/.statistics.json')
    const answers = await Promise.all(
      [{}, null, undefined, 0, ''].map((data) =>
        loadApp({ ...raw, data }).App.getInitialProps()
      )
    )
    answers.forEach((props) => expect(props.statistics).toEqual(FALLBACK))
  })

  test('T-119 @P0 the three loaders run one after the other (statistics, data providers, members) and their results are discarded', async () => {
    const { App, Loader } = loadApp()
    const log = []
    const original = Loader.prototype.getData
    jest
      .spyOn(Loader.prototype, 'getData')
      .mockImplementation(async function getData() {
        const name = path.basename(this.fileName)
        log.push(`start ${name}`)
        const result = await original.call(this)
        log.push(`end ${name}`)
        return result
      })
    const props = await App.getInitialProps()
    expect(log).toEqual([
      'start .statistics.json',
      'end .statistics.json',
      'start .formap.json',
      'end .formap.json',
      'start .members.json',
      'end .members.json',
    ])
    // the loaded files (a cache hit) never reach the props
    expect(props).toEqual({ statistics: FALLBACK })
  })

  test('T-119 @P0 Q-007 the fallback is a new object per call, so one request cannot change the next', async () => {
    const { App } = loadApp()
    const first = await App.getInitialProps()
    first.statistics.totalArticlesCount = 'changed by a page'
    first.statistics.extra = true
    const second = await App.getInitialProps()
    expect(second.statistics).toEqual(FALLBACK)
    expect(second.statistics).not.toBe(first.statistics)
    expect(second).not.toBe(first)
  })

  test('T-119 @P0 Q-007 with a `data` key the baked object itself is shared by every call (module-level `statistics`)', async () => {
    const data = { totalArticlesCount: 4242, repositoriesCount: 7 }
    const baked = { totalArticlesCount: 1, data }
    const { App } = loadApp(baked)
    const first = await App.getInitialProps()
    const second = await App.getInitialProps()
    expect(first.statistics).toBe(data)
    expect(second.statistics).toBe(data)
    expect(first.statistics).toBe(second.statistics)
    // a change made through one request is seen by the next one
    first.statistics.totalArticlesCount = 7
    expect((await App.getInitialProps()).statistics.totalArticlesCount).toBe(7)

    // the assignment happens on every call: when `data` empties, the next call
    // falls back
    baked.data = {}
    const third = await App.getInitialProps()
    expect(third.statistics).toEqual(FALLBACK)
    expect(third.statistics).not.toBe(data)
  })

  test('T-119 @P0 R-055 importing the app registers the unhandledRejection and uncaughtException handlers that report to Sentry', () => {
    Sentry.captureException.mockClear()
    const { handlers: all } = loadApp()
    const handlers = Object.fromEntries(
      Object.entries(all).filter(([event]) =>
        ['unhandledRejection', 'uncaughtException'].includes(event)
      )
    )
    expect(Object.keys(handlers).sort()).toEqual([
      'uncaughtException',
      'unhandledRejection',
    ])
    const rejection = new Error('rejected')
    const exception = new Error('thrown')
    handlers.unhandledRejection(rejection)
    handlers.uncaughtException(exception)
    expect(Sentry.captureException.mock.calls).toEqual([
      [rejection],
      [exception],
    ])
  })
})
