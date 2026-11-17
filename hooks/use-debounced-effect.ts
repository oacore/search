import { useEffect, useRef } from 'react'

const useDebouncedEffect = (
  callback?: any,
  deps: any = [],
  delay: any = 250
) => {
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
