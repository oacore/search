// T-203 (41 C, R-011, R-039, R-046, R-081): the reactivity contract of the
// MobX stores. c1 generates, for every store class, what MobX knows about each
// field and method (observable / computed / action, or plain) and compares it
// with the table frozen in __baseline__/t203-reactivity.json. The table is
// regenerated only by `RECORD=1`; the file is never edited by hand. c2 drives
// an `autorun` per observable and counts its runs per write. From 6.0 this
// row is rewritten through T-212 (store-driver contract); until then it is the
// MobX-API oracle for decorators (store/filters.js) and annotation maps.
// A store leaves this file with its zustand port; its rows are T-212's.
const fs = require('fs')
const path = require('path')

const mobx = require('mobx')

const Filters = require('../../../store/filters').default
const Root = require('../../../store/root').default

const BASELINE = path.join(__dirname, '__baseline__', 't203-reactivity.json')

const { autorun, runInAction } = mobx

// one fresh instance per class, constructed the way the app does
const instances = () => ({
  Filters: new Filters(),
  Root: new Root({ statistics: {} }),
})

const descriptorOf = (instance, name) => {
  for (
    let o = instance;
    o && o !== Object.prototype;
    o = Object.getPrototypeOf(o)
  ) {
    const d = Object.getOwnPropertyDescriptor(o, name)
    if (d) return d
  }
  return undefined
}

// never reads the member (a computed `maxYear` throws without data)
const kindOf = (instance, name) => {
  if (mobx.isComputedProp(instance, name)) return 'computed'
  if (mobx.isObservableProp(instance, name)) return 'observable'
  const d = descriptorOf(instance, name)
  if (d.get || d.set) return 'plain-accessor'
  if (typeof d.value === 'function')
    return mobx.isAction(d.value) ? 'action' : 'plain-method'
  return 'plain'
}

const describeClass = (instance) => {
  const names = new Set(Object.getOwnPropertyNames(instance))
  for (
    let o = Object.getPrototypeOf(instance);
    o && o !== Object.prototype;
    o = Object.getPrototypeOf(o)
  )
    for (const name of Object.getOwnPropertyNames(o)) names.add(name)
  names.delete('constructor')
  return Object.fromEntries(
    [...names].sort().map((name) => [name, kindOf(instance, name)])
  )
}

const generate = () =>
  Object.fromEntries(
    Object.entries(instances()).map(([name, instance]) => [
      name,
      describeClass(instance),
    ])
  )

// a value different from the current one, of the same kind
const different = (current) => {
  if (typeof current === 'boolean') return !current
  if (typeof current === 'number') return current + 1
  if (typeof current === 'string') return `${current}!`
  if (current === null || current === undefined) return 'written'
  if (Array.isArray(current)) return [...current, 'written']
  return { ...current, written: true }
}
const isPrimitive = (v) => v === null || typeof v !== 'object'

describe('T-203 @P0 reactivity contract', () => {
  afterEach(() => jest.restoreAllMocks())

  test('T-203 c1 @P0 observable, computed, action per field and method equals the frozen table', () => {
    const table = generate()

    if (process.env.RECORD === '1') {
      fs.writeFileSync(
        BASELINE,
        `${JSON.stringify({ schema: 1, classes: table }, null, 2)}\n`
      )
    }
    const baseline = JSON.parse(fs.readFileSync(BASELINE, 'utf8'))
    expect(baseline.schema).toBe(1)
    expect(table).toEqual(baseline.classes)

    // facts the table must hold, whatever was recorded (the ported stores,
    // Search included, are T-212's)
    // legacy decorators of Filters
    expect(table.Filters.data).toBe('observable')
    expect(table.Filters.maxYear).toBe('computed')
    expect(table.Filters.filterNamesWithoutYear).toBe('computed')
    expect(table.Filters.filterNamesWithoutPublisher).toBe('plain-accessor')
    expect(table.Filters.fetchFilters).toBe('action')
    expect(table.Filters.getFilterByValue).toBe('action')
    // annotation map of Root (the ported stores are plain fields)
    expect(table.Root.search).toBe('plain')
    expect(table.Root.claim).toBe('plain')
    expect(table.Root.extend).toBe('action')
    expect(table.Root.dataProviders).toBe('plain')
  })

  test('T-203 c2 @P0 an autorun on an observable runs once per write', () => {
    const table = generate()
    const checked = []
    for (const [className, instance] of Object.entries(instances())) {
      const observables = Object.entries(table[className]).filter(
        ([, kind]) => kind === 'observable'
      )
      for (const [name] of observables) {
        const label = `${className}.${name}`
        let runs = 0
        const dispose = autorun(() => {
          // eslint-disable-next-line no-unused-expressions
          instance[name]
          runs += 1
        })
        expect(runs).toBe(1)
        const next = different(mobx.toJS(instance[name]))
        runInAction(() => {
          instance[name] = next
        })
        expect([label, runs]).toEqual([label, 2])
        if (isPrimitive(next)) {
          // the same value again is not a change
          runInAction(() => {
            instance[name] = next
          })
          expect([label, runs]).toEqual([label, 2])
        }
        dispose()
        checked.push(label)
      }
    }
    expect(checked).toHaveLength(
      Object.values(table).flatMap((c) =>
        Object.values(c).filter((k) => k === 'observable')
      ).length
    )
  })

  test('T-203 c2 @P0 computeds run once per change of their inputs', () => {
    // Filters.maxYear needs a year facet (DataProviders.results: T-212)
    const filters = new Filters()
    runInAction(() => {
      filters.data = [
        { label: 'year', items: [{ value: 2001 }, { value: 1999 }] },
      ]
    })
    const seen = []
    const stop = autorun(() => seen.push(filters.maxYear))
    runInAction(() => {
      filters.data = [{ label: 'year', items: [{ value: 2005 }] }]
    })
    expect(seen).toEqual([2001, 2005])
    // same maximum: the computed value is equal, the autorun does not run
    runInAction(() => {
      filters.data = [{ label: 'year', items: [{ value: 2005 }, { value: 7 }] }]
    })
    expect(seen).toEqual([2001, 2005])
    stop()
  })
})
