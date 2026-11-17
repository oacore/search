import type { StoreApi } from 'zustand/vanilla'

// What the MobX stores gave their readers, for the ports of Search and
// Filters (70 §2.4):
//
// - `observableCopy(value)`: MobX made an assigned plain object or array
//   observable by copying it deeply, and kept a value that was already
//   observable as it was. The copy keeps that: a value made here before is
//   kept (so aliases between the store's own objects stay, R-030), any other
//   plain object or array is copied deeply, everything else is kept.
// - `batched(api)`: a MobX action notified its observers once, at its end,
//   for all its writes; a write outside an action notified at once. `act(fn)`
//   runs fn as an action: every `setState` inside is visible to `getState`
//   at once, and the store's subscribers hear of them once, when the
//   outermost act returns (for an async fn, at its first `await`, as MobX's
//   action ended there). `touch()` notifies of in-place writes to the
//   store's own objects (MobX notified those per property).

const owned = new WeakSet<object>()

const isPlainObject = (value: object) => {
  const proto = Object.getPrototypeOf(value)
  return proto === Object.prototype || proto === null
}

export const observableCopy = <T>(value: T): T => {
  if (value === null || typeof value !== 'object') return value
  if (owned.has(value as object)) return value
  let copy: any
  if (Array.isArray(value)) copy = value.map(observableCopy)
  else if (isPlainObject(value as object)) {
    copy = {}
    Object.keys(value as object).forEach((key) => {
      copy[key] = observableCopy((value as any)[key])
    })
  } else return value
  owned.add(copy)
  return copy
}

export type Batch<S> = {
  act: <R>(fn: () => R) => R
  write: (patch: Partial<S>) => void
  touch: () => void
}

export const batched = <S>(api: StoreApi<S>): Batch<S> => {
  type Listener = (state: S, prevState: S) => void
  const listeners = new Set<Listener>()
  let depth = 0
  let pending = false
  let batchPrev: S | null = null

  api.subscribe((state, prevState) => {
    if (depth > 0) {
      if (!pending) {
        pending = true
        batchPrev = prevState
      }
      return
    }
    listeners.forEach((listener) => listener(state, prevState))
  })

  // the store's own subscribe, wrapped
  api.subscribe = (listener: Listener) => {
    listeners.add(listener)
    return () => {
      listeners.delete(listener)
    }
  }

  const act = <R>(fn: () => R): R => {
    depth += 1
    try {
      return fn()
    } finally {
      depth -= 1
      if (depth === 0 && pending) {
        const prevState = batchPrev as S
        pending = false
        batchPrev = null
        const state = api.getState()
        listeners.forEach((listener) => listener(state, prevState))
      }
    }
  }

  const write = (patch: Partial<S>) => {
    const copied = Object.fromEntries(
      Object.entries(patch).map(([key, value]) => [key, observableCopy(value)])
    ) as Partial<S>
    api.setState(copied)
  }

  const touch = () => api.setState({})

  return { act, write, touch }
}
