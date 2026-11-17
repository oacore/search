export default function debounce(this: any, callback?: any, wait: any = 250) {
  let timeout: any
  return (...args: any[]) => {
    clearTimeout(timeout)
    timeout = setTimeout(() => callback.call(this, ...args), wait)
  }
}
