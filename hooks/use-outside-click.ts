import { useEffect } from 'react'

const useOutsideClick = (ref?: any, closeElement?: any) => {
  function handleClickOutside(event?: any) {
    if (ref.current && !ref.current.contains(event.target)) closeElement()
  }
  // eslint-disable-next-line consistent-return
  useEffect(() => {
    if (typeof window !== 'undefined') {
      document.addEventListener('mousedown', handleClickOutside)
      return () => {
        document.removeEventListener('mousedown', handleClickOutside)
      }
    }
  }, [])
}

export default useOutsideClick
