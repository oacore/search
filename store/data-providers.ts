import { createStore, type StoreApi } from 'zustand/vanilla'

import { convertAndValidate } from 'utils/validation'

// The /data-providers store, ported from the MobX DataProviders and Params
// classes (70 §2.4). The state holds `data` and the validated `params`;
// `results` is a selector memoised on (data, q), so it is computed once per
// change of either, as the MobX computed was.
//
// `params` on the store api is the object the page and
// useSyncUrlParamsWithStore work with, shaped as the Params instance was:
// own keys schema, q, size, action (in that order), each param read live from
// the state. Assigning a param is one `setState` (a write outside an action);
// `changeParams` validates and applies all keys in one `setState` (the
// action).

export const schema = {
  q: {
    default: '',
    convert: 'string',
    validation: 'string',
  },
  size: {
    default: 10,
    validation: 'number',
    convert: 'number',
  },
  action: {
    default: null,
    validation: ['ADD', null],
  },
}

export type DataProvidersState = {
  data: any[]
  params: Record<string, any>
}

export type DataProvidersStore = StoreApi<DataProvidersState> & {
  params: Record<string, any>
  search: (encodedSearchTerm: string) => any[]
  selectResults: (state: DataProvidersState) => any[]
}

const searchIn = (data: any[], encodedSearchTerm: string) => {
  const searchTerm = decodeURI(encodedSearchTerm)

  return data.filter(
    (el) =>
      el.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      el.normalizedName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      el.urlHomepage?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      el.normalizedInstitutionName
        ?.toLowerCase()
        .includes(searchTerm.toLowerCase()) ||
      el.aliases?.join('|').toLowerCase().includes(searchTerm.toLowerCase()) ||
      el.rorId?.toLowerCase().includes(searchTerm.toLowerCase())
  )
}

const createParams = (
  api: StoreApi<DataProvidersState>,
  paramsSchema: typeof schema
) => {
  const params: Record<string, any> = { schema: paramsSchema }

  Object.keys(api.getState().params).forEach((key) => {
    Object.defineProperty(params, key, {
      enumerable: true,
      configurable: true,
      get: () => api.getState().params[key],
      set: (value) =>
        api.setState({ params: { ...api.getState().params, [key]: value } }),
    })
  })

  Object.defineProperty(params, 'changeParams', {
    configurable: true,
    writable: true,
    value: ({ ...changed }: Record<string, any>) => {
      // every own enumerable key but schema, as `{ schema, ...rest }` did
      const assignedParams = Object.fromEntries(
        Object.entries(params).filter(([key]) => key !== 'schema')
      )

      const newParams = convertAndValidate({
        schema: params.schema,
        params: {
          ...assignedParams,
          ...changed,
        },
      })
      api.setState({ params: { ...api.getState().params, ...newParams } })
    },
  })

  return params
}

export const createDataProvidersStore = ({
  data,
  params = {},
}: {
  data?: any[] | null
  params?: Record<string, any>
}): DataProvidersStore => {
  const api = createStore<DataProvidersState>()(() => ({
    data: data ?? [],
    params: convertAndValidate({ schema, params }),
  })) as DataProvidersStore

  api.params = createParams(api, schema)

  api.search = (encodedSearchTerm) =>
    searchIn(api.getState().data, encodedSearchTerm)

  let memo: { data: any[]; q: any; results: any[] } | null = null
  api.selectResults = (state) => {
    if (memo && memo.data === state.data && memo.q === state.params.q)
      return memo.results
    const results = api.search(state.params.q)
    memo = { data: state.data, q: state.params.q, results }
    return results
  }

  return api
}

export default createDataProvidersStore
