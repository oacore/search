import { createStore, type StoreApi } from 'zustand/vanilla'

import invalidatePreviousRequests from '../utils/invalidatePreviousRequests'

import { createReport, fetchMetadata } from 'api/outputs'

// The report store (E10, takedown), ported from the MobX class with its
// notifications: `reset` was an action (one `setState`); `submit` and
// `fetchOutput` were not, so each of their writes is a `setState` of its own
// (70 §2.4). The state lives as long as the client singleton, so an error
// survives a navigation (Q-094).

const ERROR_MESSAGE =
  'We couldn’t perform the action. For any issue contact theteam@core.science'

export type ReportState = {
  output: any
  updateOption: any
  role: any
  isLoading: boolean
  error: any
  isModalReportTypeActive: boolean
  isModalReportFormActive: boolean
  isModalReportSuccessActive: boolean
  reset: () => void
  submit: (data: any) => Promise<void>
  fetchOutput: (id: any) => Promise<void>
}

export type ReportStore = StoreApi<ReportState>

// one controller per function for every report store, as the decorator's
// closures were; neither request takes the signal
const submit = invalidatePreviousRequests(
  async (store: ReportStore, data: any) => {
    data.updateOption = store.getState().updateOption
    data.role = store.getState().role
    store.setState({ isLoading: true })
    try {
      await createReport(data)
      store.setState({ isModalReportSuccessActive: true })
    } catch {
      store.setState({ error: ERROR_MESSAGE })
    } finally {
      store.setState({ isLoading: false })
    }
  }
)

const fetchOutput = invalidatePreviousRequests(
  async (store: ReportStore, id: any) => {
    store.setState({ isLoading: true })
    try {
      const rawOutput = await fetchMetadata(id)
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { fullText: _, ...output } = rawOutput
      store.setState({ output })
      store.setState({ isModalReportTypeActive: true })
    } catch {
      store.setState({ error: ERROR_MESSAGE })
    } finally {
      store.setState({ isLoading: false })
    }
  }
)

export const createReportStore = (): ReportStore =>
  createStore<ReportState>()((set, get, api) => ({
    output: {},
    updateOption: null,
    role: null,
    isLoading: false,
    error: null,
    isModalReportTypeActive: false,
    isModalReportFormActive: false,
    isModalReportSuccessActive: false,
    reset: () =>
      set({
        output: {},
        updateOption: null,
        role: null,
        isLoading: false,
        error: null,
        isModalReportTypeActive: false,
        isModalReportFormActive: false,
        isModalReportSuccessActive: false,
      }),
    submit: (data) => submit(api, data),
    fetchOutput: (id) => fetchOutput(api, id),
  }))

export default createReportStore
