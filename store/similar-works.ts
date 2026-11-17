import { createStore, type StoreApi } from 'zustand/vanilla'

import { transformDataProviders } from 'utils/data-providers-transform'
import invalidatePreviousRequests from 'utils/invalidatePreviousRequests'
import { fetchSimilarTo } from 'api/outputs'

// The similar-works store (E8), ported from the MobX class with its
// notifications: the synchronous part of the `fetchSimilar` action is one
// `setState`; `reset` was not an action, so it is one `setState` per field
// (70 §2.4). Fetched once per mount of the section (Q-055); the related
// searches read the same state.

export type SimilarWorksState = {
  error: boolean
  similarOutputs: any[] | null
  isLoading: boolean
  fetchSimilar: (id: any, params?: any) => Promise<void>
  reset: () => void
}

export type SimilarWorksStore = StoreApi<SimilarWorksState>

// one controller for every similar-works store, as the decorator's closure
// was; the request does not take the signal
const fetchSimilar = invalidatePreviousRequests(
  async (store: SimilarWorksStore, id: any, params: any) => {
    // the action part: reset() and isLoading in one notification
    store.setState({ similarOutputs: null, isLoading: true, error: false })
    try {
      const data = await fetchSimilarTo(id, { ...params })

      const similarOutputs = await Promise.all(
        data.map(async (output: any) => ({
          ...output,
          dataProviders: await transformDataProviders(
            output.dataProviders || [output.dataProvider]
          ),
        }))
      )

      store.setState({ similarOutputs })
    } catch {
      store.setState({ error: true })
    } finally {
      store.setState({ isLoading: false })
    }
  }
)

export const createSimilarWorksStore = (): SimilarWorksStore =>
  createStore<SimilarWorksState>()((set, get, api) => ({
    error: false,
    similarOutputs: null,
    isLoading: false,
    fetchSimilar: (id, params) => fetchSimilar(api, id, params),
    reset: () => {
      set({ similarOutputs: null })
      set({ isLoading: false })
      set({ error: false })
    },
  }))

export default createSimilarWorksStore
