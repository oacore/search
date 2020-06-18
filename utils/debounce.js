export default function debounce(callback, wait = 250) {
  let timeout
  return (...args) => {
    clearTimeout(timeout)
    timeout = setTimeout(() => callback.call(this, ...args), wait)
  }
}
