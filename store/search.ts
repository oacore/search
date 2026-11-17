import { createStore, type StoreApi } from 'zustand/vanilla'
import Router from 'next/router'

import { downloadResultsInCSV } from '../api/search'
import { batched, type Batch } from './batch'

// utils/helpers has no findDataProviders: the import is undefined, as it was
// in the MobX store; the branch that calls it never runs (dataProviders stays
// empty)
// @ts-expect-error -- kept as the MobX store imported it
import { findDataProviders } from 'utils/helpers'
import invalidatePreviousRequests from 'utils/invalidatePreviousRequests'

// The search store (E3 and the sort options), ported from the MobX class
// with its notifications (70 §2.4): the methods that were actions run in
// `act` (one notification); setActiveLimit, setActiveDownloadModal and
// setActiveSortOptionData were not, so each of their writes notifies on its
// own. Assigned arrays and objects are copied as MobX copied them, so the
// stored sort options never alias the module-level ones setSortOptions
// mutates, and the data-provider sort keeps its inversion and its write to
// Router.query (Q-043).

const sortFilterValues = [
  {
    value: 'recent',
    checked: false,
  },
  {
    value: 'relevance',
    checked: false,
  },
]

export type SearchState = {
  works: any[]
  query: any
  isLoading: boolean
  dataProviders: any[]
  sortOptions: any[]
  activeLimit: any
  activeDownloadModal: any
  setWorks: (works: any[]) => void
  setWorkDataProviders: (works: any[], dataProviders: any[]) => void
  setIsLoading: (loading: boolean) => void
  setActiveLimit: (limit: any) => void
  setQuery: (query: any) => void
  setActiveDownloadModal: (value?: any) => void
  setSortOptions: (activeSortValue: any) => void
  setActiveSortOptionData: (sortType: any, pathname: any) => void
  setActiveSortOption: (sortType: any, ...rest: any[]) => void
  downloadResults: (...args: any[]) => Promise<void>
  reset: () => void
}

export type SearchStore = StoreApi<SearchState>

type Context = { api: SearchStore } & Batch<SearchState>

const setWorkDataProviders = (
  { act, write }: Context,
  works: any[],
  dataProviders: any[]
) =>
  act(() => {
    const worksWithDataProviders = findDataProviders(dataProviders, works)
    write({ works: worksWithDataProviders })
  })

const setWorks = (ctx: Context, works: any[]) =>
  ctx.act(() => {
    ctx.write({ works })
    if (ctx.api.getState().dataProviders.length > 0)
      setWorkDataProviders(ctx, works, ctx.api.getState().dataProviders)
  })

const setSortOptions = ({ act, write }: Context, activeSortValue: any) =>
  act(() => {
    const options = sortFilterValues.map((sortOption) => {
      sortOption.checked = false
      if (sortOption.value === activeSortValue) sortOption.checked = true
      return sortOption
    })

    write({ sortOptions: options })
  })

// one controller for every search store, as the decorator's closure was;
// the request does not take the signal
const downloadResults = invalidatePreviousRequests(async (ctx: Context) => {
  const { api, act, write } = ctx
  try {
    act(() => write({ isLoading: true }))
    const body = {
      q: api.getState().query,
      accept: 'text/csv',
      limit: api.getState().activeLimit,
    }
    await downloadResultsInCSV(body)
    write({ activeDownloadModal: false })
  } catch (error) {
    console.error(error)
  } finally {
    act(() => write({ isLoading: false }))
  }
})

export const createSearchStore = (): SearchStore =>
  createStore<SearchState>()((set, get, api) => {
    const ctx: Context = { api, ...batched(api) }
    const { act, write } = ctx

    return {
      works: [],
      query: null,
      isLoading: false,
      dataProviders: [],
      sortOptions: [],
      activeLimit: 10,
      activeDownloadModal: false,
      setWorks: (works) => setWorks(ctx, works),
      setWorkDataProviders: (works, dataProviders) =>
        setWorkDataProviders(ctx, works, dataProviders),
      setIsLoading: (loading) => act(() => write({ isLoading: loading })),
      setActiveLimit: (limit) => write({ activeLimit: limit }),
      setQuery: (query) => act(() => write({ query })),
      setActiveDownloadModal: (value) => write({ activeDownloadModal: value }),
      setSortOptions: (activeSortValue) => setSortOptions(ctx, activeSortValue),
      setActiveSortOptionData: (sortType, pathname) => {
        if (pathname?.includes('data-providers')) delete Router.query.id

        setSortOptions(ctx, sortType.value)
        Router.push({
          pathname,
          query: {
            ...Router.query,
            sort: sortType.value === 'recent' ? 'relevance' : sortType.value,
            page: 1,
          },
        })
      },
      setActiveSortOption: (sortType) =>
        act(() => {
          setSortOptions(ctx, sortType.value)
          Router.push({
            pathname: '/search',
            query: {
              ...Router.query,
              sort: sortType.value,
              page: 1,
            },
          })
        }),
      downloadResults: (...args) => act(() => downloadResults(ctx, ...args)),
      reset: () =>
        act(() =>
          write({
            works: [],
            isLoading: false,
            activeLimit: 1000,
            query: null,
          })
        ),
    }
  })

export default createSearchStore
