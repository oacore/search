import { useEffect, useRef } from 'react'

const useDebouncedEffect = (callback, deps = [], delay = 250) => {
  const firstUpdate = useRef(true)
  useEffect(() => {
    if (firstUpdate.current) {
      firstUpdate.current = false
      callback()
      return () => {}
    }
    const handler = setTimeout(() => {
      callback()
    }, delay)

    return () => {
      clearTimeout(handler)
    }
  }, [delay, ...deps])
}

export default useDebouncedEffect
