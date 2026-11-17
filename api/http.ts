import axios, { type AxiosRequestConfig, type AxiosResponse } from 'axios'

// HTTP transport for `api/index.js`: `fetch`'s signature, a fetch `Response`
// back, axios (fetch adapter) underneath. Same code on server and browser.
//
// The adapter's fetch hook sends the caller's own url and init to the
// runtime's fetch, so the wire stays what native fetch sends (method, headers,
// User-Agent, Accept-Encoding, string-body Content-Type, Host handling), the
// caller's AbortSignal is the one fetch sees, and fetch's own rejection
// (AbortError / signal.reason, `TypeError: fetch failed` with its cause) is
// what the caller gets. No AxiosError leaves this module: it would carry the
// request config (Authorization, internal URLs) into serialised errors.

class Call {
  url: string | URL

  init?: RequestInit

  response?: Response

  failed = false

  error: unknown = undefined

  constructor(url: string | URL, init?: RequestInit) {
    this.url = url
    this.init = init
  }
}

const CALL = 'transportCall'

const fetchHook = (_request: unknown, options?: Record<string, unknown>) => {
  const call = options?.[CALL] as Call
  return globalThis.fetch(call.url, call.init).then(
    (response) => {
      call.response = response
      return response
    },
    (error) => {
      call.failed = true
      call.error = error
      throw error
    }
  )
}

const instance = axios.create({
  adapter: 'fetch',
  // the body stays a stream, read later by the caller as with fetch
  responseType: 'stream',
  transformRequest: [(data) => data],
  transformResponse: [(data) => data],
  validateStatus: () => true,
  withCredentials: true,
  withXSRFToken: false,
  env: { fetch: fetchHook as unknown as typeof fetch },
})

// statuses whose Response must have a null body
const NULL_BODY_STATUS = [101, 103, 204, 205, 304]

const toResponse = (result: AxiosResponse, native: Response): Response => {
  const body = NULL_BODY_STATUS.includes(result.status)
    ? null
    : (result.data ?? null)
  const response = new Response(body, {
    status: result.status,
    statusText: result.statusText,
    headers: native.headers,
  })
  Object.defineProperty(response, 'url', {
    value: native.url,
    enumerable: false,
  })
  return response
}

const toNativeError = (error: unknown): unknown => {
  if (!axios.isAxiosError(error)) return error
  const { cause } = error as { cause?: unknown }
  return cause ?? new TypeError(error.message)
}

export const transport = async (
  url: string | URL,
  init?: RequestInit
): Promise<Response> => {
  const call = new Call(url, init)
  let result: AxiosResponse
  try {
    result = await instance.request({
      url: String(url),
      method: init?.method,
      fetchOptions: { [CALL]: call },
    } as AxiosRequestConfig)
  } catch (error) {
    if (call.failed) throw call.error
    if (call.response) return call.response
    throw toNativeError(error)
  }
  return toResponse(result, call.response as Response)
}

export default transport
