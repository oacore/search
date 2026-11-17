import React from 'react'

export default function useWindowSize() {
  const [windowSize, setWindowSize] = React.useState({
    width: undefined,
    height: undefined,
  })

  function changeWindowSize() {
    setWindowSize({ width: window.innerWidth, height: window.innerHeight })
  }

  // eslint-disable-next-line consistent-return
  React.useEffect(() => {
    if (typeof window !== 'undefined') {
      window.addEventListener('resize', changeWindowSize)

      changeWindowSize()
      return () => {
        window.removeEventListener('resize', changeWindowSize)
      }
    }
  }, [])

  return windowSize
}
