// Call forms the app's components use and @types/react 19 no longer declares:
// `useRef()` without an initial value and `useCallback(fn)` without a
// dependency list (both run unchanged in React 19)
export {}

declare module 'react' {
  function useRef<T = any>(): RefObject<T>
  function useCallback<T extends (...args: any[]) => any>(callback: T): T
}
