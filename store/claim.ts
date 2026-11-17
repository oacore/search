import { createStore, type StoreApi } from 'zustand/vanilla'

import invalidatePreviousRequests from '../utils/invalidatePreviousRequests'

import apiRequest from 'api'

// The claim form store (E16), ported from the MobX class with its
// notifications: one `setState` per MobX action and one per write outside an
// action (70 §2.4). `duplicated` was not observable and stays outside the
// reactive state, on the store api: a 409 reaches the page only through the
// `isLoading` flip.

export type ClaimState = {
  query: string
  request: unknown
  created: any
  error: any
  isLoading: boolean
  retrieve: () => Promise<void>
  reset: (options?: { query: boolean }) => void
}

export type ClaimStore = StoreApi<ClaimState> & { duplicated: any }

// one controller for every claim store, as the decorator's closure was
const retrieve = invalidatePreviousRequests(
  async (store: ClaimStore, signal?: AbortSignal) => {
    // the action part: reset() and isLoading in one notification
    store.duplicated = null
    store.setState({
      request: null,
      created: null,
      error: null,
      isLoading: true,
    })
    try {
      const { data } = await apiRequest('/data-providers', {
        method: 'POST',
        body: JSON.stringify({
          uri: store.getState().query,
        }),
        signal,
      })
      store.setState({ created: data })
    } catch (error: any) {
      const { status, data } = error
      if (status === 409) store.duplicated = data
      else store.setState({ error })
    } finally {
      store.setState({ isLoading: false })
    }
  }
)

export const createClaimStore = (): ClaimStore =>
  createStore<ClaimState>()((set, get, api) => {
    const store = api as ClaimStore
    store.duplicated = null
    return {
      query: '',
      request: null,
      created: null,
      error: null,
      isLoading: false,
      retrieve: () => retrieve(store),
      reset: ({ query } = { query: false }) => {
        store.duplicated = null
        set({
          request: null,
          created: null,
          error: null,
          ...(query ? { query: '' } : {}),
        })
      },
    }
  }) as ClaimStore

export default createClaimStore
