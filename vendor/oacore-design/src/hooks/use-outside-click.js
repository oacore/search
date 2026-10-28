import { useEffect } from 'react'

const useOutsideClick = (ref, closeElement) => {
  function handleClickOutside(event) {
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
